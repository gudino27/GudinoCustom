// This file contains admin-only configuration endpoints
// REQUIRED IMPORTS 
const express = require("express");
const router = express.Router();
const {getDb,userDb, invoiceDb} = require("../db-helpers");
const { authenticateUser, requireRole } = require("../middleware/auth");
const { sanitizeQueryString } = require("../middleware/validation");
const { 
  twilioClient,
  sendSmsWithRouting,
  getSmsRoutingRecipients,
  getSmsRoutingSettings
} = require("../utils/sms");
const bcrypt = require("bcryptjs");
const {
  generateInvitationToken,
  sendInvitation,
  cleanupExpiredInvitations
} = require("../services/notification-service");
// User management endpoints (admin and super admin can view users)
router.get("/api/users",authenticateUser,requireRole(["admin", "super_admin"]),async (req, res) => {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const users = await userDb.getAllUsers();
      // Filter out inactive users unless specifically requested
      const filteredUsers = includeInactive
        ? users
        : users.filter((user) => user.is_active === 1);
      res.json({ success: true, users: filteredUsers });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  }
);
router.post("/api/users",authenticateUser,requireRole("super_admin"),async (req, res) => {
    const { username, email, password, role, full_name } = req.body;
    try {
      // Validate input
      if (!username || !email || !password) {
        return res
          .status(400)
          .json({ error: "Username, email, and password are required" });
      }
      if (!["admin", "super_admin", "employee"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const userId = await userDb.createUser({
        username,
        email,
        password,
        role,
        full_name,
        created_by: req.user.id,
      });
      res.status(201).json({
        message: "User created successfully",
        userId,
      });
    } catch (error) {
      console.error("Error creating user:", error);
      if (error.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Username or email already exists" });
      } else {
        res.status(500).json({ error: "Failed to create user" });
      }
    }
  }
);
router.put("/api/users/:id",authenticateUser,requireRole("super_admin"),async (req, res) => {
    const userId = parseInt(req.params.id);
    const updates = req.body;
    try {
      // Prevent super admin from demoting themselves
      if (
        userId === req.user.id &&
        updates.role &&
        updates.role !== "super_admin"
      ) {
        return res
          .status(400)
          .json({ error: "Cannot change your own role from super_admin" });
      }

      // Validate role if provided
      if (updates.role && !["admin", "super_admin", "employee"].includes(updates.role)) {
        return res
          .status(400)
          .json({ error: "Invalid role. Must be admin, super_admin, or employee" });
      }
      const success = await userDb.updateUser(userId, updates);

      if (!success) {
        return res
          .status(400)
          .json({ error: "User not found or no valid fields to update" });
      }
      res.json({ message: "User updated successfully" });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  }
);
router.delete("/api/users/:id",authenticateUser,requireRole("super_admin"),async (req, res) => {
    const userId = parseInt(req.params.id);
    try {
      // Prevent super admin from deleting themselves
      if (userId === req.user.id) {
        return res
          .status(400)
          .json({ error: "Cannot delete your own account" });
      }
      // delete the user
      const db = await getDb();
      const result = await db.run("DELETE FROM users WHERE id = ?", userId);
      //await db.close();
      if (result.changes > 0) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  }
);

// Invitation System Endpoints

// Send invitation to new user
router.post("/api/users/send-invite",authenticateUser,requireRole("super_admin"),async (req, res) => {
    const { email, phone, full_name, role, language, deliveryMethod } = req.body;

    try {
      // Validate required fields
      if (!full_name || !role) {
        return res.status(400).json({ error: "Full name and role are required" });
      }

      // Validate role (super_admin can create any role)
      if (!["admin", "super_admin", "employee"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      // Validate delivery method and contact info
      if (!deliveryMethod || !["email", "sms", "both"].includes(deliveryMethod)) {
        return res.status(400).json({ error: "Invalid delivery method" });
      }

      if ((deliveryMethod === "email" || deliveryMethod === "both") && !email) {
        return res.status(400).json({ error: "Email address required for email delivery" });
      }

      if ((deliveryMethod === "sms" || deliveryMethod === "both") && !phone) {
        return res.status(400).json({ error: "Phone number required for SMS delivery" });
      }

      // Check if user with this email already exists
      if (email) {
        const existingUser = await userDb.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ error: "User with this email already exists" });
        }
      }

      // Generate invitation token
      const token = generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      // Save invitation to database
      const db = await getDb();
      const result = await db.run(
        `INSERT INTO invitation_tokens 
         (email, phone, full_name, role, language, token, expires_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          email || null,
          phone || null,
          full_name,
          role,
          language || "en",
          token,
          expiresAt.toISOString(),
          req.user.id
        ]
      );

      // Send invitation via specified method(s)
      const invitationData = {
        email,
        phone,
        fullName: full_name,
        role,
        language: language || "en",
        token,
        deliveryMethod
      };

      const sendResult = await sendInvitation(invitationData);

      if (!sendResult.success) {
        // Rollback invitation if sending failed
        await db.run("DELETE FROM invitation_tokens WHERE id = ?", [result.lastID]);
        
        return res.status(500).json({
          error: "Failed to send invitation",
          details: {
            email: sendResult.email?.error,
            sms: sendResult.sms?.error
          }
        });
      }

      res.status(201).json({
        success: true,
        message: "Invitation sent successfully",
        invitationId: result.lastID,
        expiresAt: expiresAt.toISOString(),
        deliveryResults: {
          email: sendResult.email,
          sms: sendResult.sms
        }
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ error: "Failed to send invitation" });
    }
  }
);

// Get pending invitations (super_admin only)
router.get("/api/users/invitations",authenticateUser,requireRole("super_admin"),async (req, res) => {
    try {
      const db = await getDb();
      const invitations = await db.all(
        `SELECT 
          i.id, i.email, i.phone, i.full_name, i.role, i.language,
          i.expires_at, i.used_at, i.created_at,
          u.username as created_by_username, u.full_name as created_by_name
         FROM invitation_tokens i
         LEFT JOIN users u ON i.created_by = u.id
         WHERE i.used_at IS NULL
         ORDER BY i.created_at DESC`
      );

      res.json({ success: true, invitations });
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  }
);

// Resend invitation (super_admin only)
router.post("/api/users/invitations/:id/resend",authenticateUser,requireRole("super_admin"),async (req, res) => {
    const invitationId = parseInt(req.params.id);
    const deliveryMethod = req.body?.deliveryMethod;

    try {
      const db = await getDb();
      
      // Get invitation details
      const invitation = await db.get(
        "SELECT * FROM invitation_tokens WHERE id = ? AND used_at IS NULL",
        [invitationId]
      );

      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or already used" });
      }

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        return res.status(400).json({ error: "Invitation has expired" });
      }

      // Send invitation
      const invitationData = {
        email: invitation.email,
        phone: invitation.phone,
        fullName: invitation.full_name,
        role: invitation.role,
        language: invitation.language,
        token: invitation.token,
        deliveryMethod: deliveryMethod || (invitation.email && invitation.phone ? "both" : invitation.email ? "email" : "sms")
      };

      console.log('🔄 Resending invitation with data:', JSON.stringify(invitationData, null, 2));

      const sendResult = await sendInvitation(invitationData);

      if (!sendResult.success) {
        return res.status(500).json({
          error: "Failed to resend invitation",
          details: {
            email: sendResult.email?.error,
            sms: sendResult.sms?.error
          }
        });
      }

      res.json({
        success: true,
        message: "Invitation resent successfully",
        deliveryResults: {
          email: sendResult.email,
          sms: sendResult.sms
        }
      });
    } catch (error) {
      console.error("Error resending invitation:", error);
      res.status(500).json({ error: "Failed to resend invitation" });
    }
  }
);

// Cancel invitation (super_admin only)
router.delete("/api/users/invitations/:id",authenticateUser,requireRole("super_admin"),async (req, res) => {
    const invitationId = parseInt(req.params.id);

    try {
      const db = await getDb();
      const result = await db.run(
        "DELETE FROM invitation_tokens WHERE id = ? AND used_at IS NULL",
        [invitationId]
      );

      if (result.changes > 0) {
        res.json({ success: true, message: "Invitation cancelled successfully" });
      } else {
        res.status(404).json({ error: "Invitation not found or already used" });
      }
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ error: "Failed to cancel invitation" });
    }
  }
);

// Validate invitation token (PUBLIC - no authentication required)
router.get("/api/users/validate-invite/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const db = await getDb();
    const invitation = await db.get(
      `SELECT id, email, phone, full_name, role, language, expires_at, used_at
       FROM invitation_tokens 
       WHERE token = ?`,
      [token]
    );

    if (!invitation) {
      return res.status(404).json({ 
        valid: false, 
        error: "Invalid invitation link" 
      });
    }

    // Check if already used
    if (invitation.used_at) {
      return res.status(400).json({ 
        valid: false, 
        error: "This invitation has already been used" 
      });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ 
        valid: false, 
        error: "This invitation has expired" 
      });
    }

    res.json({
      valid: true,
      invitation: {
        fullName: invitation.full_name,
        email: invitation.email,
        phone: invitation.phone,
        role: invitation.role,
        language: invitation.language
      }
    });
  } catch (error) {
    console.error("Error validating invitation:", error);
    res.status(500).json({ error: "Failed to validate invitation" });
  }
});

// Complete registration (PUBLIC - no authentication required)
router.post("/api/users/complete-registration", async (req, res) => {
  const { token, username, password } = req.body;

  try {
    // Validate input
    if (!token || !username || !password) {
      return res.status(400).json({ 
        error: "Token, username, and password are required" 
      });
    }

    const db = await getDb();
    
    // Get and validate invitation
    const invitation = await db.get(
      "SELECT * FROM invitation_tokens WHERE token = ?",
      [token]
    );

    if (!invitation) {
      return res.status(404).json({ error: "Invalid invitation link" });
    }

    if (invitation.used_at) {
      return res.status(400).json({ error: "This invitation has already been used" });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: "This invitation has expired" });
    }

    // Check if username already exists
    const existingUser = await db.get(
      "SELECT id FROM users WHERE username = ?",
      [username]
    );

    if (existingUser) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Check if email already exists (if invitation has email)
    if (invitation.email) {
      const existingEmail = await db.get(
        "SELECT id FROM users WHERE email = ?",
        [invitation.email]
      );

      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await db.run(
      `INSERT INTO users 
       (username, email, password_hash, role, full_name, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [
        username,
        invitation.email || `${username}@temp.local`,
        passwordHash,
        invitation.role,
        invitation.full_name,
        invitation.created_by
      ]
    );

    // Mark invitation as used
    await db.run(
      "UPDATE invitation_tokens SET used_at = datetime('now') WHERE id = ?",
      [invitation.id]
    );

    // Log activity
    await db.run(
      `INSERT INTO activity_logs 
       (user_id, user_name, action, details, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [
        userResult.lastID,
        username,
        "user_registered",
        `User completed registration via invitation (${invitation.role})`
      ]
    );

    console.log(`✅ New user registered: ${username} (${invitation.role})`);

    res.status(201).json({
      success: true,
      message: "Registration completed successfully",
      userId: userResult.lastID,
      username,
      role: invitation.role
    });
  } catch (error) {
    console.error("Error completing registration:", error);
    res.status(500).json({ error: "Failed to complete registration" });
  }
});
// SMS Routing Management Endpoints
// Get SMS routing settings
router.get("/api/admin/sms-routing/settings",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const db = await getDb();
      const settings = await db.all(
        "SELECT * FROM sms_routing_settings ORDER BY message_type"
      );
      res.json(settings);
    } catch (error) {
      console.error("Error fetching SMS routing settings:", error);
      res.status(500).json({ error: "Failed to fetch SMS routing settings" });
    }
  }
);
// Update SMS routing settings
router.put("/api/admin/sms-routing/settings/:messageType",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const db = await getDb();
      const { messageType } = req.params;
      const { is_enabled, routing_mode } = req.body;
      const result = await db.run(
        `UPDATE sms_routing_settings
         SET is_enabled = ?, routing_mode = ?, updated_at = CURRENT_TIMESTAMP
         WHERE message_type = ?`,
        [is_enabled, routing_mode, messageType]
      );
      if (result.changes === 0) {
        await db.run(
          `INSERT INTO sms_routing_settings (message_type, is_enabled, routing_mode)
           VALUES (?, ?, ?)`,
          [messageType, is_enabled, routing_mode]
        );
      }
      res.json({
        success: true,
        message: "SMS routing settings updated successfully",
      });
    } catch (error) {
      console.error("Error updating SMS routing settings:", error);
      res.status(500).json({ error: "Failed to update SMS routing settings" });
    }
  }
);
// Get SMS routing recipients
router.get("/api/admin/sms-routing/recipients",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const db = await getDb();
      const { messageType } = req.query;
      let query = `
        SELECT r.*, e.name as employee_name, e.position
        FROM sms_routing_recipients r
        LEFT JOIN employees e ON r.employee_id = e.id
      `;
      const params = [];
      if (messageType) {
        query += " WHERE r.message_type = ?";
        params.push(messageType);
      }
      query += " ORDER BY r.message_type, r.priority_order ASC";
      const recipients = await db.all(query, params);
      res.json(recipients);
    } catch (error) {
      console.error("Error fetching SMS routing recipients:", error);
      res.status(500).json({ error: "Failed to fetch SMS routing recipients" });
    }
  }
);
// Add SMS routing recipient
router.post("/api/admin/sms-routing/recipients",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const db = await getDb();
      const {
        message_type,
        employee_id,
        phone_number,
        name,
        priority_order = 0,
      } = req.body;
      if (!message_type || !phone_number || !name) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const result = await db.run(
        `INSERT INTO sms_routing_recipients
         (message_type, employee_id, phone_number, name, priority_order)
         VALUES (?, ?, ?, ?, ?)`,
        [message_type, employee_id || null, phone_number, name, priority_order]
      );
      res.json({
        success: true,
        id: result.lastID,
        message: "SMS routing recipient added successfully",
      });
    } catch (error) {
      console.error("Error adding SMS routing recipient:", error);
      res.status(500).json({ error: "Failed to add SMS routing recipient" });
    }
  }
);
// Update SMS routing recipient
router.put("/api/admin/sms-routing/recipients/:id",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const db = await getDb();
      const { id } = req.params;
      const { employee_id, phone_number, name, is_active, priority_order } =
        req.body;
      const result = await db.run(
        `UPDATE sms_routing_recipients
         SET employee_id = ?, phone_number = ?, name = ?, is_active = ?, priority_order = ?
         WHERE id = ?`,
        [employee_id || null, phone_number, name, is_active, priority_order, id]
      );
      if (result.changes === 0) {
        return res
          .status(404)
          .json({ error: "SMS routing recipient not found" });
      }
      res.json({
        success: true,
        message: "SMS routing recipient updated successfully",
      });
    } catch (error) {
      console.error("Error updating SMS routing recipient:", error);
      res.status(500).json({ error: "Failed to update SMS routing recipient" });
    }
  }
);
// Delete SMS routing recipient
router.delete("/api/admin/sms-routing/recipients/:id",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const db = await getDb();
      const { id } = req.params;
      const result = await db.run(
        "DELETE FROM sms_routing_recipients WHERE id = ?",
        [id]
      );
      if (result.changes === 0) {
        return res
          .status(404)
          .json({ error: "SMS routing recipient not found" });
      }
      res.json({
        success: true,
        message: "SMS routing recipient deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting SMS routing recipient:", error);
      res.status(500).json({ error: "Failed to delete SMS routing recipient" });
    }
  }
);
// Get SMS routing history
router.get("/api/admin/sms-routing/history",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const db = await getDb();
      const { messageType, limit = 50, offset = 0 } = req.query;
      let query = "SELECT * FROM sms_routing_history";
      const params = [];
      if (messageType) {
        query += " WHERE message_type = ?";
        params.push(messageType);
      }
      query += " ORDER BY sent_at DESC LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));
      const history = await db.all(query, params);
      res.json(history);
    } catch (error) {
      console.error("Error fetching SMS routing history:", error);
      res.status(500).json({ error: "Failed to fetch SMS routing history" });
    }
  }
);
// Test SMS routing for a specific message type
router.post("/api/admin/sms-routing/test/:messageType",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const { messageType } = req.params;
      const { message } = req.body;

      const testMessage =
        message ||
        `Test message for ${messageType} routing from Gudino Custom Cabinets! 🧪`;
      const result = await sendSmsWithRouting(messageType, testMessage);
      res.json({
        success: result.success,
        message: result.success
          ? "Test SMS routing completed"
          : "Test SMS routing failed",
        details: result,
      });
    } catch (error) {
      console.error("Error testing SMS routing:", error);
      res.status(500).json({ error: "Failed to test SMS routing" });
    }
  }
);
// Test SMS endpoint
router.post("/api/admin/test-sms",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      if (!twilioClient) {
        return res.status(500).json({ error: "SMS service not configured" });
      }

      const { phone, message } = req.body;
      const testMessage =
        message || "Test message from Gudino Custom Cabinets! 👋";
      const testPhone = phone || process.env.ADMIN_PHONE || "+15095154089";

      console.log(" Testing SMS to:", testPhone);

      const smsOptions = {
        body: testMessage,
        to: testPhone,
      };

      // Use messaging service if available, otherwise fallback to phone number
      if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
        smsOptions.messagingServiceSid =
          process.env.TWILIO_MESSAGING_SERVICE_SID;
        console.log(
          " Using messaging service SID:",
          process.env.TWILIO_MESSAGING_SERVICE_SID
        );
      } else if (process.env.TWILIO_PHONE_NUMBER) {
        smsOptions.from = process.env.TWILIO_PHONE_NUMBER;
        console.log(" Using phone number:", process.env.TWILIO_PHONE_NUMBER);
      } else {
        throw new Error(
          "Neither messaging service SID nor phone number configured"
        );
      }

      const result = await twilioClient.messages.create(smsOptions);
      console.log(" Test SMS sent successfully! SID:", result.sid);

      res.json({
        success: true,
        message: "Test SMS sent successfully",
        sid: result.sid,
        sentTo: testPhone,
      });
    } catch (error) {
      console.error(" Test SMS failed:", error);
      res
        .status(500)
        .json({ error: `Failed to send test SMS: ${error.message}` });
    }
  }
);
// Client Management Endpoints
router.get("/api/admin/clients", authenticateUser, async (req, res) => {
  try {
    const clients = await invoiceDb.getAllClients();
    res.json(clients);
  } catch (error) {
    console.error("Error getting clients:", error);
    res.status(500).json({ error: "Failed to get clients" });
  }
});

router.get("/api/admin/clients/search", authenticateUser, async (req, res) => {
  try {
    // Security: Sanitize query parameter to prevent type confusion attacks
    // Rejects arrays/objects that could bypass length validation
    const q = sanitizeQueryString(req.query.q, { minLength: 2, maxLength: 100 });
    if (!q) {
      return res.json([]);
    }
    const clients = await invoiceDb.searchClients(q);
    res.json(clients);
  } catch (error) {
    console.error("Error searching clients:", error);
    res.status(500).json({ error: "Failed to search clients" });
  }
});

router.post("/api/admin/clients", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.createClient(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ error: "Failed to create client" });
  }
});

router.get("/api/admin/clients/:id", authenticateUser, async (req, res) => {
  try {
    const client = await invoiceDb.getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  } catch (error) {
    console.error("Error getting client:", error);
    res.status(500).json({ error: "Failed to get client" });
  }
});

router.put("/api/admin/clients/:id", authenticateUser, async (req, res) => {
  try {
    await invoiceDb.updateClient(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: "Failed to update client" });
  }
});

router.delete("/api/admin/clients/:id", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.deleteClient(req.params.id);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({ error: "Failed to delete client" });
  }
});

// Line Item Labels Endpoints
router.get("/api/admin/line-item-labels", authenticateUser, async (req, res) => {
  try {
    const labels = await invoiceDb.getLineItemLabels();
    res.json(labels);
  } catch (error) {
    console.error("Error getting line item labels:", error);
    res.status(500).json({ error: "Failed to get line item labels" });
  }
});

router.post("/api/admin/line-item-labels", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.createLineItemLabel(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error creating line item label:", error);
    res.status(500).json({ error: "Failed to create line item label" });
  }
});

router.put("/api/admin/line-item-labels/:id", authenticateUser, async (req, res) => {
  try {
    await invoiceDb.updateLineItemLabel(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating line item label:", error);
    res.status(500).json({ error: "Failed to update line item label" });
  }
});

router.delete("/api/admin/line-item-labels/:id", authenticateUser, async (req, res) => {
  try {
    await invoiceDb.deleteLineItemLabel(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting line item label:", error);
    res.status(500).json({ error: "Failed to delete line item label" });
  }
});

// Tax Rates Endpoints
router.get("/api/admin/tax-rates", authenticateUser, async (req, res) => {
  try {
    const rates = await invoiceDb.getTaxRates();
    res.json(rates);
  } catch (error) {
    console.error("Error getting tax rates:", error);
    res.status(500).json({ error: "Failed to get tax rates" });
  }
});

router.post("/api/admin/tax-rates", authenticateUser, async (req, res) => {
  try {
    const taxData = { ...req.body, created_by: req.user.id };
    const result = await invoiceDb.createTaxRate(taxData);
    res.json(result);
  } catch (error) {
    console.error("Error creating tax rate:", error);
    res.status(500).json({ error: "Failed to create tax rate" });
  }
});

router.put("/api/admin/tax-rates/:id", authenticateUser, async (req, res) => {
  try {
    const taxData = { ...req.body, updated_by: req.user.id };
    await invoiceDb.updateTaxRate(req.params.id, taxData);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating tax rate:", error);
    res.status(500).json({ error: "Failed to update tax rate" });
  }
});

router.delete("/api/admin/tax-rates/:id", authenticateUser, async (req, res) => {
  try {
    await invoiceDb.deleteTaxRate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting tax rate:", error);
    res.status(500).json({ error: "Failed to delete tax rate" });
  }
});

// Design Notification Settings Endpoints
// Admin endpoint - Get design notification settings (super_admin only)
router.get("/api/admin/design-notification-settings",authenticateUser,async (req, res) => {
    try {
      if (req.user.role !== "super_admin") {
        return res.status(403).json({ error: "Super admin access required" });
      }
      res.json({
        notificationType: process.env.DESIGN_NOTIFICATION_TYPE || "email",
        adminEmail: process.env.ADMIN_EMAIL,
        adminPhone: process.env.ADMIN_PHONE,
      });
    } catch (error) {
      console.error("Error getting notification settings:", error);
      res.status(500).json({ error: "Failed to get notification settings" });
    }
  }
);
// Admin endpoint - Update design notification settings (super_admin only)
router.put("/api/admin/design-notification-settings",authenticateUser,async (req, res) => {
    try {
      if (req.user.role !== "super_admin") {
        return res.status(403).json({ error: "Super admin access required" });
      }
      const { notificationType } = req.body;
      if (!["email", "sms", "both"].includes(notificationType)) {
        return res.status(400).json({ error: "Invalid notification type" });
      }
      // For now, we'll just acknowledge the change (it won't persist across server restarts)
      process.env.DESIGN_NOTIFICATION_TYPE = notificationType;
      res.json({
        success: true,
        notificationType: notificationType,
        message: "Notification settings updated successfully",
      });
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ error: "Failed to update notification settings" });
    }
  }
);
// Security & Audit Log Routes
// Get activity logs (audit trail)
router.get("/api/admin/security/activity-logs", authenticateUser, requireRole("super_admin"), async (req, res) => {
  try {
    const { userId, action, limit, offset } = req.query;
    const logs = await userDb.getActivityLogs({
      userId: userId ? parseInt(userId) : undefined,
      action,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    });
    res.json(logs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

// Get failed login attempts
router.get("/api/admin/security/failed-logins", authenticateUser, requireRole("super_admin"), async (req, res) => {
  try {
    const { hours } = req.query;
    const logs = await userDb.getFailedLoginAttempts(hours ? parseInt(hours) : 24);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching failed login attempts:", error);
    res.status(500).json({ error: "Failed to fetch failed login attempts" });
  }
});

// Get currently locked accounts
router.get("/api/admin/security/locked-accounts", authenticateUser, requireRole("super_admin"), async (req, res) => {
  try {
    const accounts = await userDb.getLockedAccounts();
    res.json(accounts);
  } catch (error) {
    console.error("Error fetching locked accounts:", error);
    res.status(500).json({ error: "Failed to fetch locked accounts" });
  }
});

// Unlock a user account (admin action)
router.post("/api/admin/security/unlock-account/:userId", authenticateUser, requireRole("super_admin"), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    await userDb.unlockAccount(userId, req.user.id, req.user.full_name || req.user.username);
    res.json({ success: true, message: "Account unlocked successfully" });
  } catch (error) {
    console.error("Error unlocking account:", error);
    res.status(500).json({ error: "Failed to unlock account" });
  }
});

// Test geolocation with any IP address (admin only)
router.post("/api/admin/test-geolocation", authenticateUser, requireRole("admin"), async (req, res) => {
  try {
    const { ip } = req.body;

    if (!ip) {
      return res.status(400).json({ error: "IP address is required" });
    }

    const { getLocationFromIP } = require("../utils/geolocation");
    const location = await getLocationFromIP(ip);

    res.json({
      success: true,
      ip: ip,
      location: location,
      privacy_compliant: !location.latitude && !location.longitude,
      message: "Geolocation test successful"
    });
  } catch (error) {
    console.error("Error testing geolocation:", error);
    res.status(500).json({ error: "Failed to test geolocation" });
  }
});

// QUICK QUOTE MANAGEMENT ENDPOINTS
// Get all quick quote submissions (admin and super_admin)
router.get("/api/admin/quick-quotes", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const db = await getDb();
    const status = req.query.status; // 'all', 'new', 'contacted', 'quote_sent', 'converted', 'closed'

    let query = `
      SELECT
        id, client_name, client_email, client_phone, client_language,
        project_type, room_dimensions, budget_range, preferred_materials,
        preferred_colors, message, photos, status, assigned_employee_id,
        priority, internal_notes, ip_address, geolocation, submitted_at,
        contacted_at, converted_at
      FROM quick_quote_submissions
    `;

    const params = [];
    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY priority DESC, submitted_at DESC';

    const quotes = await db.all(query, params);
    res.json(quotes);
  } catch (error) {
    console.error('Error fetching quick quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quick quotes' });
  }
});

// Get quick quote stats (admin and super_admin)
router.get("/api/admin/quick-quotes/stats", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const db = await getDb();

    const stats = await db.get(`
      SELECT
        COUNT(*) as totalQuotes,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as newQuotes,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contactedQuotes,
        SUM(CASE WHEN status = 'quote_sent' THEN 1 ELSE 0 END) as quoteSentQuotes,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as convertedQuotes,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closedQuotes
      FROM quick_quote_submissions
    `);

    const statusBreakdown = {
      new: stats.newQuotes || 0,
      contacted: stats.contactedQuotes || 0,
      quote_sent: stats.quoteSentQuotes || 0,
      converted: stats.convertedQuotes || 0,
      closed: stats.closedQuotes || 0
    };

    res.json({
      totalQuotes: stats.totalQuotes || 0,
      statusBreakdown
    });
  } catch (error) {
    console.error('Error fetching quick quote stats:', error);
    res.status(500).json({ error: 'Failed to fetch quick quote stats' });
  }
});

// Get specific quick quote by ID (admin and super_admin)
router.get("/api/admin/quick-quotes/:id", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const db = await getDb();
    const quoteId = parseInt(req.params.id);

    const quote = await db.get(
      'SELECT * FROM quick_quote_submissions WHERE id = ?',
      [quoteId]
    );

    if (!quote) {
      return res.status(404).json({ error: 'Quick quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error fetching quick quote:', error);
    res.status(500).json({ error: 'Failed to fetch quick quote' });
  }
});

// Update quick quote status (admin and super_admin)
router.put("/api/admin/quick-quotes/:id/status", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const db = await getDb();
    const quoteId = parseInt(req.params.id);
    const { status } = req.body;

    const validStatuses = ['new', 'contacted', 'quote_sent', 'converted', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Update status and set timestamp if applicable
    let updateQuery = 'UPDATE quick_quote_submissions SET status = ?';
    const params = [status];

    if (status === 'contacted' || status === 'quote_sent') {
      updateQuery += ', contacted_at = CURRENT_TIMESTAMP';
    } else if (status === 'converted') {
      updateQuery += ', converted_at = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = ?';
    params.push(quoteId);

    await db.run(updateQuery, params);
    res.json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating quick quote status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Update quick quote internal note (admin and super_admin)
router.put("/api/admin/quick-quotes/:id/note", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const db = await getDb();
    const quoteId = parseInt(req.params.id);
    const { note } = req.body;

    await db.run(
      'UPDATE quick_quote_submissions SET internal_notes = ? WHERE id = ?',
      [note, quoteId]
    );

    res.json({ success: true, message: 'Note updated successfully' });
  } catch (error) {
    console.error('Error updating quick quote note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete quick quote (admin and super_admin)
router.delete("/api/admin/quick-quotes/:id", authenticateUser, requireRole(["admin", "super_admin"]), async (req, res) => {
  try {
    const db = await getDb();
    const quoteId = parseInt(req.params.id);

    const result = await db.run(
      'DELETE FROM quick_quote_submissions WHERE id = ?',
      [quoteId]
    );

    if (result.changes > 0) {
      res.json({ success: true, message: 'Quick quote deleted successfully' });
    } else {
      res.status(404).json({ error: 'Quick quote not found' });
    }
  } catch (error) {
    console.error('Error deleting quick quote:', error);
    res.status(500).json({ error: 'Failed to delete quick quote' });
  }
});

// EXPORTS
module.exports = router;

