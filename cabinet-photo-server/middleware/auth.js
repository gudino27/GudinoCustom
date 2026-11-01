
// AUTHENTICATION MIDDLEWARE
// This file contains the JWT authentication middleware
//
// Copy lines 107-157 from server.js (the authenticateUser function and JWT setup)
//
// REQUIRED IMPORTS (add these at the top):
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { userDb } = require("../db-helpers");
const { reportBlockedAttempt } = require("../utils/security-alerts");
const JWT_SECRET = process.env.JWT_SECRET;
const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No authentication token provided" });
  }

  try {
    const result = await userDb.validateSession(token);

    if (!result) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = result.user;

    // If token was rotated, send new token in response header
    if (result.newToken) {
      res.setHeader('X-New-Token', result.newToken);
    }

    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
};

// Middleware for role-based access control
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(userRole)) {
      reportBlockedAttempt(req);
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

// Super admin specific middleware
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== 'super_admin') {
    reportBlockedAttempt(req);
    return res.status(403).json({ error: "Super admin access required" });
  }

  next();
};

// Admin or Super Admin middleware (for payroll management)
const isAdminOrSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    reportBlockedAttempt(req);
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};




// EXPORTS (add at the bottom):
module.exports = {
  authenticateUser,
  requireRole,
  isSuperAdmin,
  isAdminOrSuperAdmin,
  JWT_SECRET // Export this so other files can use it
};

