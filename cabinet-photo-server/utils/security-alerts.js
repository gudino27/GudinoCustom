const { getDb } = require("../db-helpers");
const { notifyRoles } = require("./notifications");

const ALERT_WINDOW = "-1 hour";

// Records a request the server refused because of who was asking. Every attempt goes
// in the activity log; super admins get one notification per person and page an hour.
// Never fails the request it is reporting on. No IP, see utils/client-ip.js.
async function reportBlockedAttempt(req, details) {
  let db;
  try {
    db = await getDb();
    const person = await db.get(`SELECT full_name, username FROM users WHERE id = ?`, [req.user?.id]);
    const name = person?.full_name || person?.username || "Someone";
    const target = `${req.method} ${req.baseUrl || ""}${req.path}`;
    const summary = details || `Tried to reach ${target}`;
    const logged = details ? `${details} (${target})` : summary;

    await db.run(
      `INSERT INTO activity_logs (user_id, user_name, action, details) VALUES (?, ?, 'access_denied', ?)`,
      [req.user?.id, name, logged]
    );

    const dedupeKey = `blocked:${req.user?.id}:${target}`;
    const alreadyAlerted = await db.get(
      `SELECT id FROM notifications WHERE dedupe_key = ? AND created_at > datetime('now', ?) LIMIT 1`,
      [dedupeKey, ALERT_WINDOW]
    );

    if (!alreadyAlerted) {
      await notifyRoles(db, ["super_admin"], {
        type: "security",
        title: `${name} was blocked`,
        body: summary,
        dedupeKey,
      });
    }
  } catch (error) {
    console.error("Blocked attempt report error:", error);
  } finally {
    if (db) await db.close();
  }
}

module.exports = { reportBlockedAttempt };
