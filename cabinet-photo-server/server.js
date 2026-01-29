require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");

// Import database helpers
const {
  getDb,
  queueDbOperation,
  photoDb,
  employeeDb,
  designDb,
  userDb,
  analyticsDb,
  testimonialDb,
  invoiceDb,
} = require("./db-helpers");

// Import database initialization
const { initializeDatabase } = require("./init-database");

// Import middleware
const { globalLimiter } = require("./middleware/rate-limiters");

// Import routes
const photosRoutes = require("./routes/photos");
const employeesRoutes = require("./routes/employees");
const pricingRoutes = require("./routes/pricing");
const designsRoutes = require("./routes/designs");
const authRoutes = require("./routes/auth");
const analyticsRoutes = require("./routes/analytics");
const invoicesRoutes = require("./routes/invoices");
const adminInvoicesRoutes = require("./routes/admin/invoices");
const testimonialsRoutes = require("./routes/testimonials");
const adminTestimonialsRoutes = require("./routes/admin/testimonials");
const pushTokensRoutes = require("./routes/push-tokens");
const timeclockRoutes = require("./routes/timeclock");
const adminRoutes = require("./routes/admin");
const miscRoutes = require("./routes/misc");
const instagramRoutes = require("./routes/instagram");
const timelinesRoutes = require("./routes/timelines");
const appointmentsRoutes = require("./routes/appointments");
const showroomRoutes = require("./routes/showroom");

const app = express();

// Trust proxy - this allows Express to read X-Forwarded-For headers from nginx
app.set('trust proxy', true);

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net"
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",  // Allow inline scripts (needed for React and embedded scripts)
        "https://www.instagram.com",
        "https://cdn.jsdelivr.net",  // Bootstrap and other CDN scripts
        "https://cdnjs.cloudflare.com",  // Cloudflare CDN
        // Removed: "https://ajax.cloudflare.com" - Rocket Loader causes mobile reload loops
        "https://static.cloudflareinsights.com"  // Cloudflare analytics
      ],
      workerSrc: ["'self'", "blob:"],  // Allow service workers
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://www.instagram.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  referrerPolicy: { policy: 'same-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://gudinocustom.com",
      "https://www.gudinocustom.com",
      "https://api.gudinocustom.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(express.json());

// Special middleware for analytics sendBeacon (text/plain)
app.use("/api/analytics/time", express.text({ type: "text/plain" }));
app.use("/api/analytics/time", (req, res, next) => {
  if (
    req.headers["content-type"] === "text/plain" &&
    typeof req.body === "string"
  ) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON in request body" });
    }
  }
  next();
});

// Apply global rate limiting to all API routes
// Protects against DoS attacks and general abuse (500 req/15min per IP)
app.use('/api', globalLimiter);

// Override Cross-Origin-Resource-Policy for static files to allow cross-origin access
app.use(["/photos", "/testimonial-photos"], (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});

// Serve static files from uploads directory
app.use("/photos", express.static(path.join(__dirname, "uploads")));
app.use("/testimonial-photos", express.static(path.join(__dirname, "uploads", "testimonial-photos")));
// Serve showroom uploads (panoramas, textures, materials)
app.use("/uploads/showroom", express.static(path.join(__dirname, "uploads", "showroom")));
// Serve 3DVista demo panoramas for testing virtual showroom
app.use("/demo-panoramas", express.static(path.join(__dirname, "..", "3dvistademo")));

// Mount routes
app.use("/api/photos", photosRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/prices", pricingRoutes);
app.use("/api/designs", designsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/invoice", invoicesRoutes); 
app.use("/api/admin/invoices", adminInvoicesRoutes);
app.use("/api/testimonials", testimonialsRoutes);
app.use("/api/admin/push-tokens", pushTokensRoutes);
app.use("/api/timeclock", timeclockRoutes);
app.use("/api/admin", adminTestimonialsRoutes);
app.use("/api/instagram", instagramRoutes);
app.use("/api", timelinesRoutes);
app.use("/", appointmentsRoutes);
app.use("/api/showroom", showroomRoutes);
app.use("/", adminRoutes);
app.use("/", miscRoutes);

// Initialize database and start server
const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Run database initialization/migrations
    await initializeDatabase();

    // Start the Express server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📂 Upload directory: ${path.join(__dirname, "uploads")}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
