// In-app notifications for whoever is logged in
const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../middleware/auth");
const { getDb } = require("../db-helpers");

async function withDb(operation) {
  const db = await getDb();
  try {
    return await operation(db);
  } finally {
    await db.close();
  }
}

// GET /api/notifications - The newest notifications and the unread count
router.get("/", authenticateUser, async (req, res) => {
  try {
    await withDb(async (db) => {
      const notifications = await db.all(
        `SELECT id, type, title, body, entry_id, read_at, created_at FROM notifications
         WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
        [req.user.id]
      );
      const { unread } = await db.get(
        `SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND read_at IS NULL`,
        [req.user.id]
      );

      res.json({ success: true, notifications, unreadCount: unread });
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to get notifications" });
  }
});

// POST /api/notifications/read-all - Mark everything as read
router.post("/read-all", authenticateUser, async (req, res) => {
  try {
    await withDb(async (db) => {
      await db.run(
        `UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL`,
        [req.user.id]
      );
      res.json({ success: true, message: "Marked as read" });
    });
  } catch (error) {
    console.error("Read all notifications error:", error);
    res.status(500).json({ success: false, message: "Failed to update notifications" });
  }
});

// POST /api/notifications/:id/read - Mark one as read
router.post("/:id/read", authenticateUser, async (req, res) => {
  try {
    await withDb(async (db) => {
      await db.run(
        `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id]
      );
      res.json({ success: true, message: "Marked as read" });
    });
  } catch (error) {
    console.error("Read notification error:", error);
    res.status(500).json({ success: false, message: "Failed to update notification" });
  }
});

module.exports = router;
