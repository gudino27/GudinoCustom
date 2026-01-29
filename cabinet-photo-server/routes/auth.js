// This file contains all authentication-related API endpoints
// REQUIRED IMPORTS
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { userDb, getDb } = require("../db-helpers");
const { authenticateUser } = require("../middleware/auth");
const { passwordResetLimiter, authStrictLimiter, publicApiLimiter } = require("../middleware/rate-limiters");
const { emailTransporter } = require("../utils/email");
const { validatePasswordComplexity } = require("../utils/password-validation");
const { handleError } = require("../utils/error-handler");

// Rate limiter for login endpoint - 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: "Too many login attempts, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false } // Trust proxy configured at app level
});

router.get("/me", authenticateUser, (req, res) => {
  res.json({ user: req.user });
});

// Login route with rate limiting
router.post("/login", loginLimiter, async (req, res) => {
  const { username, password, deviceId, deviceType } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  try {
    const result = await userDb.authenticateUser(username, password, ipAddress, userAgent);

    if (!result) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if account is locked
    if (result.locked) {
      return res.status(423).json({
        error: result.message,
        lockedUntil: result.lockedUntil
      });
    }

    // Check if password change is required
    if (result.user.must_change_password === 1) {
      return res.status(403).json({
        error: "Password change required",
        mustChangePassword: true,
        message: "You must change your password before accessing the system",
        username: result.user.username
      });
    }

    // Generate refresh token for mobile apps (if deviceId provided)
    let refreshToken = null;
    if (deviceId && deviceType) {
      refreshToken = await userDb.createRefreshToken(
        result.user.id,
        deviceId,
        deviceType,
        ipAddress,
        userAgent
      );
    }

    res.json({
      token: result.token,
      refreshToken,
      user: result.user,
      message: `Welcome, ${result.user.full_name || result.user.username}!`
    });
  } catch (error) {
    handleError(error, "Login failed", res, 500);
  }
});

router.post("/logout", authenticateUser, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const refreshToken = req.body?.refreshToken; // Optional - only sent from mobile app

    // Invalidate session token
    if (token) {
      await userDb.invalidateSession(token);
    }

    // Revoke refresh token if provided (mobile app only)
    if (refreshToken) {
      await userDb.revokeRefreshToken(refreshToken);
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    handleError(error, "Logout failed", res, 500);
  }
});

// Refresh access token using refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    // Validate refresh token
    const tokenData = await userDb.validateRefreshToken(refreshToken);

    if (!tokenData) {
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    // Generate new access token (session token)
    const newToken = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const db = require('../db-helpers').getDb();
    const dbConn = await db;

    await dbConn.run(
      `INSERT INTO user_sessions (user_id, token, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [tokenData.user_id, newToken, expiresAt.toISOString(), ipAddress, userAgent]
    );

    await dbConn.close();

    res.json({
      token: newToken,
      user: {
        id: tokenData.user_id,
        username: tokenData.username,
        email: tokenData.email,
        role: tokenData.role,
        full_name: tokenData.full_name
      }
    });
  } catch (error) {
    handleError(error, "Failed to refresh token", res, 500);
  }
});
// Password reset endpoints
router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const resetData = await userDb.createPasswordResetToken(email);
    // Always return success to prevent email enumeration
    if (resetData) {
      // Send email with reset link
      const resetUrl = `https://gudinocustom.com/reset-password?token=${resetData.token}`;
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: resetData.user.email,
        subject: "Password Reset - GudinoCustom Admin",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hello ${resetData.user.username},</p>
            <p>You requested a password reset for your GudinoCustom admin account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
            <p>Best regards,<br>GudinoCustom Team</p>
          </div>
        `,
      };
      await emailTransporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}`);
    }
    // Always return success message
    res.json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    handleError(error, "Failed to process password reset request", res, 500);
  }
});
router.post("/reset-password", passwordResetLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    // Validate password complexity
    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    const success = await userDb.resetPassword(token, password);
    if (!success) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    handleError(error, "Failed to reset password", res, 500);
  }
});
router.get("/validate-reset-token/:token", publicApiLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    const resetRecord = await userDb.validatePasswordResetToken(token);
    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    res.json({
      valid: true,
      username: resetRecord.username,
      expires_at: resetRecord.expires_at,
    });
  } catch (error) {
    handleError(error, "Failed to validate token", res, 500);
  }
});

// Force password change endpoint (no authentication required - special case for must_change_password)
router.post("/change-password-required", authStrictLimiter, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  try {
    // Validate required fields
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Username, current password, and new password are required" });
    }

    // First, authenticate with current credentials
    const result = await userDb.authenticateUser(username, currentPassword, ipAddress, userAgent);

    if (!result || !result.user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check if password change is actually required
    if (result.user.must_change_password !== 1) {
      return res.status(400).json({ error: "Password change not required for this account" });
    }

    // Validate new password complexity
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Ensure new password is different from old password
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const db = await getDb();

    await db.run(
      'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, result.user.id]
    );

    // Generate new session token
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    // Create session in database
    await db.run(
      `INSERT INTO user_sessions (user_id, token, expires_at, ip_address, user_agent, last_activity)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [result.user.id, token, expiresAt.toISOString(), ipAddress, userAgent]
    );

    res.json({
      success: true,
      message: "Password changed successfully",
      token,
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        full_name: result.user.full_name
      }
    });
  } catch (error) {
    handleError(error, "Failed to change password", res, 500);
  }
});

// Regular password change endpoint (for authenticated users)
router.post("/change-password", authenticateUser, authStrictLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    // Validate new password complexity
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }

    // Verify current password
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Ensure new password is different
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await db.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    handleError(error, "Failed to change password", res, 500);
  }
});

// EXPORTS
module.exports = router;

