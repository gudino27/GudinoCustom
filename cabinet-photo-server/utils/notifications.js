// In-app notifications. Stored one row per person so each keeps their own read state.

async function notifyUser(db, userId, { type, title, body, entryId = null, dedupeKey = null }) {
  await db.run(
    `INSERT INTO notifications (user_id, type, title, body, entry_id, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, body, entryId, dedupeKey]
  );
}

async function notifyRoles(db, roles, notice) {
  const placeholders = roles.map(() => "?").join(", ");
  const people = await db.all(
    `SELECT id FROM users WHERE is_active = 1 AND role IN (${placeholders})`,
    roles
  );

  for (const person of people) {
    await notifyUser(db, person.id, notice);
  }
}

module.exports = { notifyUser, notifyRoles };
