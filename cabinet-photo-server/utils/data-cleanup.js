
// DATA CLEANUP UTILITY

// This file handles automated cleanup of old tracking data per privacy policy
// Retention Policy: 24 months for analytics data
// Purpose: Privacy compliance and database performance

const { open } = require('sqlite');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/**
 * Get database connection
 * @returns {Promise<Database>}
 */
async function getDb() {
  const dbPath = path.join(__dirname, '..', 'database', 'cabinet_photos.db');
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

/**
 * Clean up old analytics data (24-month retention)
 * Runs automatically on server startup
 * @returns {Promise<Object>} Cleanup statistics
 */
async function cleanupOldAnalytics() {
  const db = await getDb();
  const stats = {
    page_analytics: 0,
    testimonial_tracking: 0,
    total: 0,
    errors: []
  };

  try {
    console.log('🧹 Starting data cleanup (24-month retention policy)...');

    // Calculate cutoff date (24 months ago)
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 24);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`   Deleting records older than: ${cutoffDate.toLocaleDateString()}`);

    // Clean up page analytics
    try {
      const analyticsResult = await db.run(
        `DELETE FROM page_analytics WHERE viewed_at < datetime(?)`,
        [cutoffISO]
      );
      stats.page_analytics = analyticsResult.changes || 0;
      console.log(`   ✅ Deleted ${stats.page_analytics} old page analytics records`);
    } catch (error) {
      console.error('   ❌ Error cleaning page_analytics:', error.message);
      stats.errors.push({ table: 'page_analytics', error: error.message });
    }

    // Clean up testimonial link tracking
    // Only delete if not associated with an active testimonial
    try {
      const trackingResult = await db.run(`
        DELETE FROM testimonial_link_tracking
        WHERE opened_at < datetime(?)
        AND token NOT IN (
          SELECT tt.token
          FROM testimonial_tokens tt
          INNER JOIN testimonials t ON tt.id = t.token_id
          WHERE t.is_visible = 1
        )
      `, [cutoffISO]);
      stats.testimonial_tracking = trackingResult.changes || 0;
      console.log(`   ✅ Deleted ${stats.testimonial_tracking} old testimonial tracking records`);
    } catch (error) {
      console.error('   ❌ Error cleaning testimonial_link_tracking:', error.message);
      stats.errors.push({ table: 'testimonial_link_tracking', error: error.message });
    }

    // Calculate total
    stats.total = stats.page_analytics + stats.testimonial_tracking;

    if (stats.total > 0) {
      console.log(`🎉 Data cleanup completed! Removed ${stats.total} old records total`);
    } else {
      console.log('✨ No old data to clean up - all records within retention period');
    }

    // Run VACUUM to reclaim disk space (optional, can be slow on large databases)
    try {
      console.log('🔧 Optimizing database...');
      await db.exec('VACUUM');
      console.log('✅ Database optimized');
    } catch (error) {
      console.warn('⚠️  Database optimization skipped:', error.message);
    }

  } catch (error) {
    console.error('❌ Data cleanup error:', error);
    stats.errors.push({ general: error.message });
  } finally {
    await db.close();
  }

  return stats;
}

/**
 * Clean up specific user's analytics data (for privacy requests)
 * @param {number} userId - User ID to delete data for
 * @returns {Promise<Object>} Deletion statistics
 */
async function deleteUserAnalytics(userId) {
  const db = await getDb();
  const stats = {
    deleted: 0,
    errors: []
  };

  try {
    const result = await db.run(
      `DELETE FROM page_analytics WHERE user_id = ?`,
      [userId]
    );
    stats.deleted = result.changes || 0;
    console.log(`✅ Deleted ${stats.deleted} analytics records for user ${userId}`);
  } catch (error) {
    console.error(`❌ Error deleting user ${userId} analytics:`, error);
    stats.errors.push(error.message);
  } finally {
    await db.close();
  }

  return stats;
}

/**
 * Get analytics data retention statistics
 * @returns {Promise<Object>} Retention stats
 */
async function getRetentionStats() {
  const db = await getDb();
  const stats = {};

  try {
    // Get oldest and newest analytics records
    const analyticsStats = await db.get(`
      SELECT
        COUNT(*) as total,
        MIN(viewed_at) as oldest,
        MAX(viewed_at) as newest
      FROM page_analytics
    `);
    stats.page_analytics = analyticsStats;

    // Get testimonial tracking stats
    const trackingStats = await db.get(`
      SELECT
        COUNT(*) as total,
        MIN(opened_at) as oldest,
        MAX(opened_at) as newest
      FROM testimonial_link_tracking
    `);
    stats.testimonial_tracking = trackingStats;

    // Calculate records that will be deleted in next cleanup
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 24);

    const expiredAnalytics = await db.get(
      `SELECT COUNT(*) as count FROM page_analytics WHERE viewed_at < datetime(?)`,
      [cutoffDate.toISOString()]
    );
    stats.expired_analytics = expiredAnalytics.count;

    const expiredTracking = await db.get(
      `SELECT COUNT(*) as count FROM testimonial_link_tracking WHERE opened_at < datetime(?)`,
      [cutoffDate.toISOString()]
    );
    stats.expired_tracking = expiredTracking.count;

  } catch (error) {
    console.error('Error getting retention stats:', error);
    stats.error = error.message;
  } finally {
    await db.close();
  }

  return stats;
}

/**
 * Clean up private client design links (180-day retention)
 * Every link whose active_until is more than 180 days ago loses its views,
 * its row and its folder. Folders under uploads/design-links/ with no row are
 * removed too. Runs at startup and once a day (server.js). No VACUUM.
 * Logs link ids only, never tokens.
 * @returns {Promise<Object>} Cleanup statistics
 */
const DESIGN_LINKS_DIR = path.join(__dirname, '..', 'uploads', 'design-links');
const DESIGN_LINK_TOKEN_RE = /^[a-f0-9]{64}$/;
const DESIGN_LINK_RETENTION_DAYS = 180;
// A POST makes the folder just before it inserts the row: leave fresh folders alone
const DESIGN_LINK_ORPHAN_GRACE_MS = 60 * 60 * 1000;

function designLinkFolder(token) {
  if (typeof token !== 'string' || !DESIGN_LINK_TOKEN_RE.test(token)) return null;
  const dir = path.join(DESIGN_LINKS_DIR, token);
  return path.dirname(dir) === DESIGN_LINKS_DIR ? dir : null;
}

async function cleanupDesignLinks() {
  const { getDb: getHelperDb, designLinkDb } = require('../db-helpers');
  const stats = { links: 0, orphanFolders: 0, errors: [] };
  const cutoff = Date.now() - DESIGN_LINK_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  try {
    const db = await getHelperDb();
    let rows;
    try {
      rows = await db.all('SELECT id, token, active_until FROM design_links');
    } finally {
      await db.close();
    }

    const kept = new Set();
    for (const row of rows) {
      const until = Date.parse(row.active_until);
      // Compared in JS only; an unreadable date is kept, never guessed
      if (!(until < cutoff)) {
        kept.add(row.token);
        continue;
      }
      try {
        await designLinkDb.remove(row.id);
        stats.links++;
        const dir = designLinkFolder(row.token);
        if (dir) {
          await fs.promises.rm(dir, { recursive: true, force: true });
        } else {
          console.error('   Design link folder skipped: bad token on link', row.id);
        }
      } catch (error) {
        console.error('   Error removing design link', row.id, error.message);
        stats.errors.push({ link: row.id, error: error.message });
      }
    }

    let entries = [];
    try {
      entries = await fs.promises.readdir(DESIGN_LINKS_DIR);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const name of entries) {
      if (kept.has(name)) continue;
      const dir = path.join(DESIGN_LINKS_DIR, name);
      if (path.dirname(dir) !== DESIGN_LINKS_DIR) continue;
      try {
        const st = await fs.promises.lstat(dir);
        if (Date.now() - st.mtimeMs < DESIGN_LINK_ORPHAN_GRACE_MS) continue;
        await fs.promises.rm(dir, { recursive: true, force: true });
        stats.orphanFolders++;
      } catch (error) {
        console.error('   Error removing a design link folder with no row:', error.code || error.message);
        stats.errors.push({ folder: true, error: error.message });
      }
    }

    if (stats.links || stats.orphanFolders) {
      console.log(` Design links: removed ${stats.links} ended link(s) and ${stats.orphanFolders} folder(s) with no link`);
    }
  } catch (error) {
    console.error(' Design link cleanup error:', error.message);
    stats.errors.push({ general: error.message });
  }

  return stats;
}

// EXPORTS
module.exports = {
  cleanupOldAnalytics,
  cleanupDesignLinks,
  deleteUserAnalytics,
  getRetentionStats
};
