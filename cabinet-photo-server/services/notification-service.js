const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { twilioClient } = require('../utils/sms');
const config = require('../config');

// Email transporter configuration
let emailTransporter = null;

if (config.email.auth.user && config.email.auth.pass) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || config.email.host,
    port: process.env.EMAIL_PORT || config.email.port,
    secure: process.env.EMAIL_SECURE === 'true' || config.email.secure,
    auth: {
      user: process.env.EMAIL_USER || config.email.auth.user,
      pass: process.env.EMAIL_PASS || config.email.auth.pass
    }
  });
  console.log('✅ Email service configured');
} else {
  console.warn('⚠️  Email service not configured - invitation emails will not be sent');
}

/**
 * Generate a secure random token for invitations
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate registration link
 * @param {string} token - Invitation token
 * @param {string} platform - 'webapp' or 'ios'
 */
function generateRegistrationLink(token, platform = 'webapp') {
  if (platform === 'ios') {
    // Deep link for iOS app
    return `gcwadmin://register/${token}`;
  }

  // Use frontendUrl for public registration routes (not admin panel)
  const baseUrl = config.urls.frontendUrl || 'https://gudinocustom.com';
  return `${baseUrl}/register/${token}`;
}

/**
 * Generate password reset link
 * @param {string} token - Password reset token
 */
function generatePasswordResetLink(token) {
  // Use frontendUrl for public password reset routes (not admin panel)
  const baseUrl = config.urls.frontendUrl || 'https://gudinocustom.com';
  return `${baseUrl}/reset-password?token=${token}`;
}

/**
 * Email templates for invitations (bilingual)
 */
const emailTemplates = {
  en: {
    subject: 'Invitation to Join Gudino Custom Cabinets',
    body: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to Gudino Custom Cabinets!</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Hello ${data.fullName},
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            You have been invited to create an account as a <strong>${data.role}</strong> for Gudino Custom Cabinets.
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            To complete your registration and set up your account, please click the button below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.registrationLink}" 
               style="background-color: #2563eb; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
              Complete Registration
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
            Or copy and paste this link into your browser:<br>
            <a href="${data.registrationLink}" style="color: #2563eb; word-break: break-all;">${data.registrationLink}</a>
          </p>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-top: 30px;">
            <strong>Important:</strong> This invitation link will expire in 7 days.
          </p>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
            If you did not expect this invitation, please disregard this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>Gudino Custom Cabinets</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `
  },
  es: {
    subject: 'Invitación para Unirse a Gudino Custom Cabinets',
    body: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">¡Bienvenido a Gudino Custom Cabinets!</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Hola ${data.fullName},
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Has sido invitado a crear una cuenta como <strong>${data.role}</strong> para Gudino Custom Cabinets.
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Para completar tu registro y configurar tu cuenta, por favor haz clic en el botón a continuación:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.registrationLink}" 
               style="background-color: #2563eb; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold; display: inline-block;">
              Completar Registro
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
            O copia y pega este enlace en tu navegador:<br>
            <a href="${data.registrationLink}" style="color: #2563eb; word-break: break-all;">${data.registrationLink}</a>
          </p>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin-top: 30px;">
            <strong>Importante:</strong> Este enlace de invitación expirará en 7 días.
          </p>
          
          <p style="font-size: 14px; color: #6b7280; line-height: 1.6;">
            Si no esperabas esta invitación, por favor ignora este correo electrónico.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>Gudino Custom Cabinets</p>
          <p>Este es un mensaje automatizado. Por favor no respondas a este correo.</p>
        </div>
      </div>
    `
  }
};

/**
 * SMS templates for invitations (bilingual)
 */
const smsTemplates = {
  en: (data) => 
    `Welcome to Gudino Custom Cabinets! You've been invited to create an account as ${data.role}. Complete your registration here: ${data.registrationLink} (Expires in 7 days)`,
  
  es: (data) =>
    `¡Bienvenido a Gudino Custom Cabinets! Has sido invitado a crear una cuenta como ${data.role}. Completa tu registro aquí: ${data.registrationLink} (Expira en 7 días)`
};

/**
 * Role name translations
 */
const roleNames = {
  employee: { en: 'Employee', es: 'Empleado' },
  admin: { en: 'Admin', es: 'Administrador' },
  super_admin: { en: 'Super Admin', es: 'Super Administrador' }
};

/**
 * Send invitation email
 * @param {Object} invitation - Invitation details
 * @param {string} invitation.email - Recipient email
 * @param {string} invitation.fullName - Recipient full name
 * @param {string} invitation.role - User role
 * @param {string} invitation.token - Invitation token
 * @param {string} invitation.language - Language preference ('en' or 'es')
 */
async function sendInvitationEmail(invitation) {
  if (!emailTransporter) {
    console.warn('Email service not configured - skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const language = invitation.language || 'en';
    const template = emailTemplates[language];
    const registrationLink = generateRegistrationLink(invitation.token, 'webapp');
    const roleName = roleNames[invitation.role]?.[language] || invitation.role;

    const mailOptions = {
      from: config.email.from,
      to: invitation.email,
      subject: template.subject,
      html: template.body({
        fullName: invitation.fullName,
        role: roleName,
        registrationLink
      })
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Invitation email sent to ${invitation.email} - Message ID: ${result.messageId}`);
    
    return {
      success: true,
      messageId: result.messageId,
      recipient: invitation.email
    };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send invitation SMS
 * @param {Object} invitation - Invitation details
 * @param {string} invitation.phone - Recipient phone number
 * @param {string} invitation.fullName - Recipient full name
 * @param {string} invitation.role - User role
 * @param {string} invitation.token - Invitation token
 * @param {string} invitation.language - Language preference ('en' or 'es')
 */
async function sendInvitationSMS(invitation) {
  if (!twilioClient) {
    console.warn('SMS service not configured - skipping SMS');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const language = invitation.language || 'en';
    const template = smsTemplates[language];
    const registrationLink = generateRegistrationLink(invitation.token, 'webapp');
    const roleName = roleNames[invitation.role]?.[language] || invitation.role;

    const messageBody = template({
      fullName: invitation.fullName,
      role: roleName,
      registrationLink
    });

    const smsOptions = {
      body: messageBody,
      to: invitation.phone
    };

    // Use messaging service if available, otherwise use phone number
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      smsOptions.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    } else if (process.env.TWILIO_PHONE_NUMBER) {
      smsOptions.from = process.env.TWILIO_PHONE_NUMBER;
    } else {
      throw new Error('Neither messaging service SID nor phone number configured');
    }

    const result = await twilioClient.messages.create(smsOptions);
    console.log(`✅ Invitation SMS sent to ${invitation.phone} - SID: ${result.sid}`);
    
    return {
      success: true,
      sid: result.sid,
      recipient: invitation.phone
    };
  } catch (error) {
    console.error('Error sending invitation SMS:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Send invitation via specified delivery method(s)
 * @param {Object} invitation - Invitation details
 * @param {string} invitation.deliveryMethod - 'email', 'sms', or 'both'
 */
async function sendInvitation(invitation) {
  const results = {
    email: null,
    sms: null,
    success: false
  };

  const { deliveryMethod } = invitation;

  // Send email if requested
  if (deliveryMethod === 'email' || deliveryMethod === 'both') {
    if (!invitation.email) {
      results.email = { success: false, error: 'Email address required' };
    } else {
      results.email = await sendInvitationEmail(invitation);
    }
  }

  // Send SMS if requested
  if (deliveryMethod === 'sms' || deliveryMethod === 'both') {
    if (!invitation.phone) {
      results.sms = { success: false, error: 'Phone number required' };
    } else {
      results.sms = await sendInvitationSMS(invitation);
    }
  }

  // Determine overall success
  if (deliveryMethod === 'both') {
    results.success = results.email?.success || results.sms?.success;
  } else if (deliveryMethod === 'email') {
    results.success = results.email?.success || false;
  } else if (deliveryMethod === 'sms') {
    results.success = results.sms?.success || false;
  }

  return results;
}

/**
 * Clean up expired invitation tokens
 * Should be called periodically (e.g., daily cron job)
 */
async function cleanupExpiredInvitations(db) {
  try {
    const result = await db.run(
      'DELETE FROM invitation_tokens WHERE expires_at < datetime("now") AND used_at IS NULL'
    );
    
    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} expired invitation tokens`);
    }
    
    return result.changes;
  } catch (error) {
    console.error('Error cleaning up expired invitations:', error);
    return 0;
  }
}

module.exports = {
  generateInvitationToken,
  generateRegistrationLink,
  generatePasswordResetLink,
  sendInvitation,
  sendInvitationEmail,
  sendInvitationSMS,
  cleanupExpiredInvitations
};
