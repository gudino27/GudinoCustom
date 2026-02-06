/**
 * Push Notification Utility
 * Handles sending push notifications via Expo Push Notification service
 * and Apple Push Notification service (APNs) for native iOS devices
 */

const { getDb } = require('../db-helpers');

// Expo Push Notification API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// APNs HTTP/2 endpoints
const APNS_PRODUCTION_URL = 'https://api.push.apple.com';
const APNS_SANDBOX_URL = 'https://api.sandbox.push.apple.com';

/**
 * Send APNs push notification to native iOS devices
 * Uses the HTTP/2 APNs API with token-based (.p8) authentication
 * Falls back to no-op if APNs credentials are not configured
 * @param {Array} nativeTokens - Array of {token, user_id, device_type} objects
 * @param {Object} notification - Notification details
 * @returns {Promise<Object>} - Result with successes and errors
 */
async function sendApnsNotification(nativeTokens, notification) {
  // Check if APNs is configured
  const apnsKeyId = process.env.APNS_KEY_ID;
  const apnsTeamId = process.env.APNS_TEAM_ID;
  const apnsKeyPath = process.env.APNS_KEY_PATH;
  const apnsBundleId = process.env.APNS_BUNDLE_ID || 'com.gudinocustom.GCWadmin';
  const apnsEnvironment = process.env.APNS_ENVIRONMENT || 'production';

  if (!apnsKeyId || !apnsTeamId || !apnsKeyPath) {
    console.log('⚠️ APNs not configured (missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_KEY_PATH). Native iOS push skipped.');
    console.log('  ℹ️  To enable native iOS push, set APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH in .env');
    return { sent: 0, failed: 0, skipped: nativeTokens.length, reason: 'apns_not_configured' };
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    const http2 = require('http2');

    // Resolve key path relative to the project root (cabinet-photo-server/)
    const resolvedKeyPath = path.isAbsolute(apnsKeyPath)
      ? apnsKeyPath
      : path.resolve(__dirname, '..', apnsKeyPath);

    // Read the .p8 key file
    const key = fs.readFileSync(resolvedKeyPath, 'utf8');

    // Create JWT for APNs authentication
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: apnsKeyId })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({ iss: apnsTeamId, iat: now })).toString('base64url');
    const signer = crypto.createSign('SHA256');
    signer.update(`${header}.${claims}`);
    const signature = signer.sign(key, 'base64url');
    const jwt = `${header}.${claims}.${signature}`;

    const apnsHost = apnsEnvironment === 'production' ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';
    const successes = [];
    const errors = [];

    // Helper: send one push via HTTP/2
    function sendOneApns(tokenData, payloadBuffer) {
      return new Promise((resolve) => {
        const client = http2.connect(`https://${apnsHost}`);
        client.on('error', (err) => {
          resolve({ ok: false, error: err.message });
          client.close();
        });

        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${tokenData.token}`,
          'authorization': `bearer ${jwt}`,
          'apns-topic': apnsBundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'apns-expiration': '0',
          'content-type': 'application/json',
        });

        let responseData = '';
        let statusCode = 0;

        req.on('response', (headers) => {
          statusCode = headers[':status'];
        });
        req.on('data', (chunk) => { responseData += chunk; });
        req.on('end', () => {
          client.close();
          if (statusCode === 200) {
            resolve({ ok: true });
          } else {
            let reason = `HTTP ${statusCode}`;
            try {
              const body = JSON.parse(responseData);
              reason = body.reason || reason;
            } catch {}
            resolve({ ok: false, error: reason, status: statusCode });
          }
        });
        req.on('error', (err) => {
          resolve({ ok: false, error: err.message });
          client.close();
        });

        req.end(payloadBuffer);
      });
    }

    for (const tokenData of nativeTokens) {
      try {
        const payload = {
          aps: {
            alert: {
              title: notification.title,
              body: notification.body
            },
            sound: notification.sound || 'default',
            badge: notification.badge || 0
          },
          ...notification.data
        };

        const result = await sendOneApns(tokenData, Buffer.from(JSON.stringify(payload)));

        if (result.ok) {
          successes.push({ token: tokenData.token });
        } else {
          errors.push({ token: tokenData.token, error: result.error });

          // Deactivate invalid tokens
          if (result.status === 410 || result.error === 'Unregistered' || result.error === 'BadDeviceToken') {
            const db = await getDb();
            await db.run('UPDATE push_tokens SET is_active = 0 WHERE token = ?', [tokenData.token]);
            await db.close();
          }
        }
      } catch (err) {
        errors.push({ token: tokenData.token, error: err.message });
      }
    }

    console.log(`📱 APNs: ${successes.length} sent, ${errors.length} failed`);
    return { sent: successes.length, failed: errors.length, errors: errors.length > 0 ? errors : undefined };

  } catch (error) {
    console.error('❌ APNs error:', error.message);
    return { sent: 0, failed: nativeTokens.length, errors: [{ error: error.message }] };
  }
}

/**
 * Send a push notification to specific users
 * @param {number[]} userIds - Array of user IDs to send notification to
 * @param {Object} notification - Notification details
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {Object} notification.data - Additional data to send with notification
 * @param {string} notification.sound - Sound to play (default: 'default')
 * @param {number} notification.badge - Badge count
 * @returns {Promise<Object>} - Result of sending notifications
 */
async function sendPushNotification(userIds, notification) {
  try {
    // Get active push tokens for the specified users
    const db = await getDb();
    const placeholders = userIds.map(() => '?').join(',');

    const tokens = await db.all(
      `SELECT token, user_id, device_type
       FROM push_tokens
       WHERE user_id IN (${placeholders}) AND is_active = 1`,
      userIds
    );

    if (tokens.length === 0) {
      console.log('⚠️ No active push tokens found for users:', userIds);
      await db.close();
      return { success: true, sent: 0, message: 'No active push tokens found' };
    }

    // Split tokens by type: native iOS vs Expo
    const nativeIosTokens = tokens.filter(t => t.device_type === 'ios_native');
    const expoTokens = tokens.filter(t => t.device_type !== 'ios_native');

    let totalSent = 0;
    let totalFailed = 0;
    const allErrors = [];

    // Send to native iOS devices via APNs
    if (nativeIosTokens.length > 0) {
      const apnsResult = await sendApnsNotification(nativeIosTokens, notification);
      totalSent += apnsResult.sent || 0;
      totalFailed += apnsResult.failed || 0;
      if (apnsResult.errors) allErrors.push(...apnsResult.errors);

      // Update last_used_at for native tokens that were sent successfully
      for (const tokenData of nativeIosTokens) {
        db.run(
          'UPDATE push_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?',
          [tokenData.token]
        ).catch(err => console.error('Error updating token last_used_at:', err));
      }
    }

    // Send to Expo-managed devices
    if (expoTokens.length > 0) {
      // Prepare messages for Expo Push API
      const messages = expoTokens.map(tokenData => ({
        to: tokenData.token,
        sound: notification.sound || 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        badge: notification.badge || 0,
        priority: 'high',
        channelId: 'default'
      }));

      // Send notifications to Expo Push API
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ Expo Push API error:', result);
        // Don't throw — we may have already sent APNs notifications
        totalFailed += expoTokens.length;
      } else {
        // Process results and handle errors
        result.data.forEach((ticket, index) => {
          if (ticket.status === 'error') {
            allErrors.push({
              token: expoTokens[index].token,
              error: ticket.message,
              details: ticket.details
            });
            totalFailed++;

            // If token is invalid, mark it as inactive
            if (ticket.details?.error === 'DeviceNotRegistered') {
              db.run(
                'UPDATE push_tokens SET is_active = 0 WHERE token = ?',
                [expoTokens[index].token]
              ).catch(err => console.error('Error deactivating token:', err));
            }
          } else {
            totalSent++;

            // Update last_used_at for successful sends
            db.run(
              'UPDATE push_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?',
              [expoTokens[index].token]
            ).catch(err => console.error('Error updating token last_used_at:', err));
          }
        });
      }
    }

    console.log(`✅ Push notifications sent: ${totalSent} success, ${totalFailed} errors`);

    if (allErrors.length > 0) {
      console.error('Push notification errors:', allErrors);
    }

    await db.close();

    return {
      success: true,
      sent: totalSent,
      failed: totalFailed,
      errors: allErrors.length > 0 ? allErrors : undefined
    };

  } catch (error) {
    console.error('❌ Error sending push notifications:', error);
    throw error;
  }
}

/**
 * Send notification to all admin and super_admin users
 * @param {Object} notification - Notification details
 * @returns {Promise<Object>} - Result of sending notifications
 */
async function sendToAdmins(notification) {
  try {
    const db = await getDb();

    // Get all admin and super_admin user IDs
    const admins = await db.all(
      `SELECT id FROM users WHERE (role = 'admin' OR role = 'super_admin') AND is_active = 1`
    );
    await db.close();

    if (admins.length === 0) {
      console.log('⚠️ No active admin users found');
      return { success: true, sent: 0, message: 'No active admin users' };
    }

    const adminIds = admins.map(admin => admin.id);
    return await sendPushNotification(adminIds, notification);

  } catch (error) {
    console.error('❌ Error sending notifications to admins:', error);
    throw error;
  }
}

/**
 * Send notification when a testimonial link is opened
 * @param {Object} data - Testimonial link data
 * @param {string} data.clientName - Name of the client
 * @returns {Promise<Object>} - Result of sending notification
 */
async function notifyTestimonialLinkOpened(data) {
  return await sendToAdmins({
    title: 'Testimonial Link Opened',
    body: `${data.clientName} has opened their testimonial link.`,
    data: {
      type: 'testimonial_opened',
      clientName: data.clientName,
      screen: 'Testimonials'
    },
    badge: 1
  });
}

/**
 * Send notification when a testimonial is submitted
 * @param {Object} data - Testimonial submission data
 * @param {string} data.clientName - Name of the client
 * @param {number} data.rating - Rating given
 * @param {string} data.projectType - Type of project
 * @returns {Promise<Object>} - Result of sending notification
 */
async function notifyTestimonialSubmitted(data) {
  return await sendToAdmins({
    title: 'New Testimonial Received',
    body: `${data.clientName} submitted a ${data.rating}-star review for ${data.projectType}`,
    data: {
      type: 'testimonial_submitted',
      clientName: data.clientName,
      rating: data.rating,
      projectType: data.projectType,
      screen: 'Testimonials'
    },
    badge: 1
  });
}

/**
 * Send notification when an invoice is opened for the first time
 * @param {Object} data - Invoice data
 * @param {string} data.clientName - Name of the client
 * @param {string} data.invoiceNumber - Invoice number
 * @returns {Promise<Object>} - Result of sending notification
 */
async function notifyInvoiceOpened(data) {
  return await sendToAdmins({
    title: 'Invoice Opened',
    body: `${data.clientName} has opened invoice ${data.invoiceNumber}.`,
    data: {
      type: 'invoice_opened',
      clientName: data.clientName,
      invoiceNumber: data.invoiceNumber,
      screen: 'Invoices'
    },
    badge: 1
  });
}

/**
 * Send notification when a client views updated invoice changes
 * @param {Object} data - Invoice data
 * @param {string} data.clientName - Name of the client
 * @param {string} data.invoiceNumber - Invoice number
 * @returns {Promise<Object>} - Result of sending notification
 */
async function notifyInvoiceChangesViewed(data) {
  return await sendToAdmins({
    title: 'Invoice Changes Viewed',
    body: `${data.clientName} has viewed the updated invoice ${data.invoiceNumber}.`,
    data: {
      type: 'invoice_changes_viewed',
      clientName: data.clientName,
      invoiceNumber: data.invoiceNumber,
      screen: 'Invoices'
    },
    badge: 1
  });
}

/**
 * Send notification when a new design is submitted
 * @param {Object} data - Design submission data
 * @param {string} data.clientName - Name of the client
 * @param {number} data.totalPrice - Total price of the design
 * @param {string} data.contactPreference - Client's preferred contact method
 * @param {number} data.designId - ID of the saved design
 * @returns {Promise<Object>} - Result of sending notification
 */
async function notifyDesignSubmitted(data) {
  return await sendToAdmins({
    title: 'New Design Submitted',
    body: `${data.clientName} submitted a new cabinet design — $${Number(data.totalPrice).toFixed(2)}`,
    data: {
      type: 'design_submitted',
      clientName: data.clientName,
      totalPrice: String(data.totalPrice),
      designId: String(data.designId),
      screen: 'Designs'
    },
    badge: 1
  });
}

/**
 * Send notification when a quick quote is submitted
 * @param {Object} data - Quick quote submission data
 * @param {string} data.clientName - Name of the client
 * @param {string} data.projectType - Type of project
 * @param {number} data.submissionId - ID of the saved submission
 * @returns {Promise<Object>} - Result of sending notification
 */
async function notifyQuickQuoteSubmitted(data) {
  const projectLabels = {
    kitchen: 'Kitchen Cabinets',
    bathroom: 'Bathroom Vanities',
    custom: 'Custom Woodworking',
    'new-construction': 'New Construction',
    remodel: 'Remodel',
    addition: 'Addition'
  };
  const label = projectLabels[data.projectType] || data.projectType;
  return await sendToAdmins({
    title: 'New Quick Quote Request',
    body: `${data.clientName} requested a quote for ${label}`,
    data: {
      type: 'quick_quote_submitted',
      clientName: data.clientName,
      projectType: data.projectType,
      submissionId: String(data.submissionId),
      screen: 'Designs'
    },
    badge: 1
  });
}

module.exports = {
  sendPushNotification,
  sendToAdmins,
  notifyTestimonialLinkOpened,
  notifyTestimonialSubmitted,
  notifyInvoiceOpened,
  notifyInvoiceChangesViewed,
  notifyDesignSubmitted,
  notifyQuickQuoteSubmitted
};
