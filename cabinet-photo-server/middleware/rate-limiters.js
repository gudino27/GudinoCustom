/**
 * Rate Limiting Middleware
 *
 * Centralized rate limiting configuration to prevent abuse and DoS attacks.
 * Uses express-rate-limit to protect authentication, API endpoints, and public routes.
 */

const rateLimit = require('express-rate-limit');
const { clientIp } = require('../utils/client-ip');

/**
 * Global rate limiter for all API requests
 * Prevents general abuse and DoS attacks
 *
 * Limits: 500 requests per 15 minutes per IP
 * Applies to: All /api routes
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path === '/health' || req.path === '/api/health';
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login
 *
 * Limits: 5 requests per 15 minutes per IP
 * Applies to: Login, change password endpoints
 */
const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts, try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Password reset rate limiter
 * Prevents email enumeration and abuse
 *
 * Limits: 3 requests per hour per IP
 * Applies to: Forgot password, reset password endpoints
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: { error: 'Too many password reset attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false // Count all requests, even successful ones
});

/**
 * Public API rate limiter
 * Protects public endpoints from excessive use
 *
 * Limits: 100 requests per 15 minutes per IP
 * Applies to: Public API endpoints, token validation
 */
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Public design link rate limiter
 * The client's 3D design view (GET /api/design-links/:token and its scene.glb).
 * One open is 2 requests, and phone carriers share IPs.
 *
 * Limits: 120 requests per 15 minutes per client IP
 */
const designLinkPublicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // 120 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIp,
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.status(429).json({ error: 'rate_limited' });
  }
});

module.exports = {
  globalLimiter,
  authStrictLimiter,
  passwordResetLimiter,
  publicApiLimiter,
  designLinkPublicLimiter
};
