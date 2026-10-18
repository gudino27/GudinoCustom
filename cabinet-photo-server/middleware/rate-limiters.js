/**
 * Rate Limiting Middleware
 *
 * Centralized rate limiting configuration to prevent abuse and DoS attacks.
 * Uses express-rate-limit to protect authentication, API endpoints, and public routes.
 */

const net = require('net');
const rateLimit = require('express-rate-limit');
const { clientIp } = require('../utils/client-ip');

// /api/design-links/... and /api/admin/design-links/... (any case, extra slashes)
const DESIGN_LINK_PATH_RE = /^\/+api\/+(admin\/+)?design-links(\/|$)/i;

function isDesignLinkPath(req) {
  const url = req.originalUrl || req.url || '';
  return DESIGN_LINK_PATH_RE.test(url.split('?')[0]);
}

// IPv6 address -> its /64 network ("2001:db8:1:2::/64"). IPv4 and IPv4-mapped
// IPv6 come back as the plain IPv4 address. Anything else is returned as is.
function ipv6Prefix64(ip) {
  let addr = String(ip).split('%')[0].toLowerCase();
  if (net.isIPv4(addr)) return addr;
  if (!net.isIPv6(addr)) return String(ip);
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(addr);
  if (mapped) return mapped[1];
  // A trailing dotted IPv4 becomes two hex groups
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(addr);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    addr = addr.slice(0, v4.index) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16);
  }
  const [head, tail] = addr.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const fill = addr.includes('::') ? 8 - headParts.length - tailParts.length : 0;
  const groups = [...headParts, ...Array(fill).fill('0'), ...tailParts];
  return groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':') + '::/64';
}

// Rate-limit key for the public design link routes: the client IP, with an
// IPv6 visitor keyed on its /64 so rotating addresses inside it does not help
function designLinkClientKey(req) {
  return ipv6Prefix64(clientIp(req));
}

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
  },
  // Design link routes answer per their contract (no-store, rate_limited);
  // everything else keeps the usual message
  handler: (req, res, next, options) => {
    if (isDesignLinkPath(req)) {
      res.set('Cache-Control', 'no-store');
      return res.status(429).json({ error: 'rate_limited' });
    }
    return res.status(options.statusCode).send(options.message);
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
  keyGenerator: designLinkClientKey,
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
  designLinkPublicLimiter,
  isDesignLinkPath,
  ipv6Prefix64
};
