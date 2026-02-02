const path = require('path');

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  // Security
  jwt: {
    secret: (() => {
      if (!process.env.JWT_SECRET) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('❌ CRITICAL: JWT_SECRET environment variable must be set in production');
        } else {
          console.warn('⚠️  WARNING: Using default JWT secret in development. NEVER use this in production!');
          console.warn('⚠️  Set JWT_SECRET environment variable before deploying to production.');
          return 'dev-secret-change-this-INSECURE';
        }
      }
      return process.env.JWT_SECRET;
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
  },

  // Database
  database: {
    path: process.env.DB_PATH || path.join(__dirname, 'database', 'cabinet_photos.db'),
    poolSize: parseInt(process.env.DB_POOL_SIZE) || 5
  },

  // GeoLite2 Database Configuration
  geoLite2: {
    path: process.env.GEOLITE2_DB_PATH || path.join(__dirname, 'data', 'geolite2', 'GeoLite2-City.mmdb'),
    enabled: process.env.GEOLITE2_ENABLED !== 'false' // Default enabled
  },

  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST || 'smtp.zeptomail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || 'no-reply@gudinocustom.com',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@gudinocustom.com'
  },

  // File Upload Configuration
  uploads: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/jpg'
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    path: process.env.UPLOAD_PATH || path.join(__dirname, 'uploads'),
    thumbnailSizes: {
      small: { width: 400, height: 300 },
      medium: { width: 800, height: 600 },
      large: { width: 1200, height: 900 }
    }
  },

  // CORS Configuration
  cors: {
    origins: (() => {
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.CORS_ORIGINS) {
          throw new Error('❌ CRITICAL: CORS_ORIGINS environment variable must be set in production');
        }
        return process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
      }
      // Development fallback
      return process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:5500'
      ];
    })(),
    credentials: process.env.CORS_CREDENTIALS !== 'false'
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    dir: process.env.LOG_DIR || path.join(__dirname, 'logs')
  },

  // URLs
  urls: {
    adminUrl: (() => {
      const url = process.env.ADMIN_URL || 'http://localhost:3000';

      // Warn if ADMIN_URL includes a path that could cause routing issues
      if (url.includes('/admin') && !url.endsWith('/admin')) {
        console.warn('⚠️  WARNING: ADMIN_URL contains a path which may cause routing issues.');
        console.warn('⚠️  Current value:', url);
        console.warn('⚠️  Consider using FRONTEND_URL for public routes instead.');
      }

      return url;
    })(),
    frontendUrl: (() => {
      const url = process.env.FRONTEND_URL || process.env.ADMIN_URL || 'http://localhost:3000';

      // Warn if FRONTEND_URL includes paths
      if (url.split('//')[1]?.includes('/')) {
        console.warn('⚠️  WARNING: FRONTEND_URL should not include URL paths.');
        console.warn('⚠️  Current value:', url);
        console.warn('⚠️  URL generation for registration/password reset may fail.');
      }

      return url;
    })(),
    apiUrl: process.env.API_URL || 'http://localhost:3001'
  }
};

// Create required directories
const requiredDirs = [
  config.uploads.path,
  path.join(config.uploads.path, 'thumbnails'),
  path.join(config.uploads.path, 'employees'),
  path.join(config.uploads.path, 'employees', 'thumbnails'),
  path.join(config.uploads.path, 'showcase'),
  path.join(config.uploads.path, 'kitchen'),
  path.join(config.uploads.path, 'bathroom'),
  path.join(config.uploads.path, 'custom'),
  config.logging.dir,
  path.dirname(config.database.path),
  path.dirname(config.geoLite2.path) // GeoLite2 database directory
];

const fs = require('fs');
requiredDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

module.exports = config;