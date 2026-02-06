// This file contains utility endpoints: health check, sitemap, robots.txt, etc.
// REQUIRED IMPORTS
const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const multer = require("multer");
const { getDb, photoDb, testimonialDb } = require("../db-helpers");
const { authenticateUser, requireRole } = require("../middleware/auth");
const {
  emailTransporter,
  generateQuickQuoteConfirmationEmail,
  generateQuickQuoteAdminNotification,
} = require("../utils/email");
const { sendSmsWithRouting } = require("../utils/sms");
const { notifyQuickQuoteSubmitted } = require("../utils/push-notifications");
const PORT = process.env.PORT || 3001;

// Configure multer for quick quote photo uploads (max 5 photos, 10MB each)
const quickQuoteStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads", "quick-quote-photos");
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const quickQuoteUpload = multer({
  storage: quickQuoteStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Quick quote submission endpoint (alternative to full designer)
router.post("/api/contact/quick-quote", quickQuoteUpload.array("photos", 5), async (req, res) => {
  try {
    const {
      client_name,
      client_email,
      client_phone,
      client_language,
      project_type,
      room_dimensions,
      budget_range,
      preferred_materials,
      preferred_colors,
      message,
    } = req.body;

    // Validate required fields
    if (!client_name || !client_email || !project_type) {
      return res.status(400).json({
        error: "Missing required fields: client_name, client_email, and project_type are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client_email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate project type
    const validProjectTypes = ["kitchen", "bathroom", "custom", "new-construction", "remodel", "addition"];
    if (!validProjectTypes.includes(project_type)) {
      return res.status(400).json({
        error: "Invalid project_type. Must be one of: kitchen, bathroom, custom, new-construction, remodel, addition",
      });
    }

    // Get IP address and geolocation
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    let geolocation = null;

    // Optional: Get geolocation from IP (using ipapi.co - free tier)
    try {
      const https = require("https");
      const geoData = await new Promise((resolve, reject) => {
        https.get(`https://ipapi.co/${ipAddress}/json/`, (geoRes) => {
          let data = "";
          geoRes.on("data", (chunk) => (data += chunk));
          geoRes.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (json.city && json.region && json.country_name) {
                resolve(`${json.city}, ${json.region}, ${json.country_name}`);
              } else {
                resolve(null);
              }
            } catch (e) {
              resolve(null);
            }
          });
        }).on("error", () => resolve(null));
      });
      geolocation = geoData;
    } catch (error) {
      console.log("Geolocation lookup failed:", error.message);
    }

    // Process uploaded photos
    const photoFilenames = req.files ? req.files.map((file) => file.filename) : [];
    const photosJson = JSON.stringify(photoFilenames);

    // Save to database
    const db = await getDb();
    const result = await db.run(
      `INSERT INTO quick_quote_submissions
       (client_name, client_email, client_phone, client_language, project_type,
        room_dimensions, budget_range, preferred_materials, preferred_colors,
        message, photos, ip_address, geolocation, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_name,
        client_email,
        client_phone || null,
        client_language || "en",
        project_type,
        room_dimensions || null,
        budget_range || null,
        preferred_materials || null,
        preferred_colors || null,
        message || null,
        photosJson,
        ipAddress,
        geolocation,
        "new",
      ]
    );

    const submissionId = result.lastID;

    // Send confirmation email to client
    try {
      const confirmationEmailOptions = generateQuickQuoteConfirmationEmail({
        clientName: client_name,
        clientEmail: client_email,
        projectType: project_type,
        language: client_language || "en",
        submissionId,
      });
      await emailTransporter.sendMail(confirmationEmailOptions);
      console.log(`✉️  Confirmation email sent to ${client_email}`);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the request if email fails
    }

    // Send notification email to admin
    try {
      const adminNotificationOptions = generateQuickQuoteAdminNotification({
        clientName: client_name,
        clientEmail: client_email,
        clientPhone: client_phone,
        projectType: project_type,
        roomDimensions: room_dimensions,
        budgetRange: budget_range,
        preferredMaterials: preferred_materials,
        preferredColors: preferred_colors,
        message,
        photoCount: photoFilenames.length,
        language: client_language || "en",
        submissionId,
        ipAddress,
        geolocation,
      });
      await emailTransporter.sendMail(adminNotificationOptions);
      console.log(`✉️  Admin notification email sent`);
    } catch (emailError) {
      console.error("Failed to send admin notification email:", emailError);
    }

    // Send SMS notification to admin
    try {
      const projectTypeLabels = {
        kitchen: "Kitchen Cabinets",
        bathroom: "Bathroom Vanities",
        custom: "Custom Woodworking",
      };
      const smsMessage = `New Quote Request!\n\nClient: ${client_name}\nProject: ${projectTypeLabels[project_type]}\nEmail: ${client_email}${client_phone ? `\nPhone: ${client_phone}` : ""}\n\nView details in admin panel: https://gudinocustom.com/admin`;

      await sendSmsWithRouting("quote_request", smsMessage);
      console.log(`📱 SMS notification sent to admin`);
    } catch (smsError) {
      console.error("Failed to send SMS notification:", smsError);
    }

    // Push notification for quick quote submissions
    try {
      await notifyQuickQuoteSubmitted({
        clientName: client_name,
        projectType: project_type,
        submissionId,
      });
      console.log('🔔 Quick quote push notification sent to admins');
    } catch (pushError) {
      console.error('⚠️  Quick quote push notification error:', pushError.message);
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: "Quote request submitted successfully",
      submissionId,
      confirmation: {
        email: client_email,
        language: client_language || "en",
      },
    });
  } catch (error) {
    console.error("Quick quote submission error:", error);
    res.status(500).json({
      error: "Failed to submit quote request",
      details: error.message,
    });
  }
});

// Gets the storage info
router.get("/api/storage-info", async (req, res) => {
  try {
    const db = await getDb();

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_photos,
        SUM(file_size) as total_size,
        COUNT(CASE WHEN featured = 1 THEN 1 END) as featured_count
      FROM photos
    `);

    const categoryStats = await db.all(`
      SELECT category, COUNT(*) as count
      FROM photos
      GROUP BY category
    `);

    //await db.close();

    const categoryBreakdown = {};
    categoryStats.forEach((stat) => {
      categoryBreakdown[stat.category] = stat.count;
    });

    res.json({
      totalPhotos: stats.total_photos || 0,
      totalStorageUsed: stats.total_size
        ? `${(stats.total_size / 1024 / 1024).toFixed(2)} MB`
        : "0 MB",
      featuredCount: stats.featured_count || 0,
      byCategory: categoryBreakdown,
      storagePath: path.resolve("uploads"),
      serverUrl: `https://api.gudinocustom.com:${PORT}`,
    });
  } catch (error) {
    console.error("Storage info error:", error);
    res.status(500).json({ error: "Failed to get storage info" });
  }
});
// Add authentication to debug uploads
router.get("/api/debug/uploads",authenticateUser,requireRole(["super_admin"]),async (req, res) => {
    try {
      const uploadsDir = path.join(__dirname, "uploads");
      const categories = await fs.readdir(uploadsDir);

      const structure = {};
      for (const category of categories) {
        const categoryPath = path.join(uploadsDir, category);
        const stat = await fs.stat(categoryPath);
        if (stat.isDirectory()) {
          const files = await fs.readdir(categoryPath);
          structure[category] = files;
        }
      }

      res.json({ uploadsDir, structure });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Health check endpoint
router.get("/api/health", async (req, res) => {
  try {
    const health = {
      status: "OK",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      checks: {},
    };

    // Database connectivity check
    try {
      const db = await getDb();
      const testQuery = await db.get("SELECT 1 as test");
      await db.close();
      health.checks.database = {
        status: "OK",
        message: "Database connection successful",
      };
    } catch (error) {
      health.checks.database = {
        status: "ERROR",
        message: `Database error: ${error.message}`,
      };
      health.status = "DEGRADED";
    }

    // File system checks
    try {
      const uploadsDir = path.join(__dirname, "..", "uploads");
      await fs.access(uploadsDir);
      health.checks.uploads = {
        status: "OK",
        message: "Uploads directory accessible",
      };
    } catch (error) {
      health.checks.uploads = {
        status: "ERROR",
        message: `Uploads directory error: ${error.message}`,
      };
      health.status = "DEGRADED";
    }

    // Dependencies check
    health.checks.dependencies = {
      status: "OK",
      express: require("express/package.json").version,
      sharp: require("sharp/package.json").version,
    };

    // Set appropriate HTTP status code
    const statusCode =
      health.status === "OK" ? 200 : health.status === "DEGRADED" ? 200 : 503;

    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});
// Dynamic sitemap generation
router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = "https://gudinocustom.com";
    const currentDate = new Date().toISOString();

    // Get all photos to extract categories and recent updates
    const photos = await photoDb.getAllPhotos();
    const categories = [...new Set(photos.map((photo) => photo.category))];
    const latestPhotoDate =
      photos.length > 0
        ? new Date(
            Math.max(...photos.map((photo) => new Date(photo.uploaded_at)))
          ).toISOString()
        : currentDate;

    // Get testimonials for last modified date
    const testimonials = await testimonialDb.getAllTestimonials(true);
    const latestTestimonialDate =
      testimonials.length > 0
        ? new Date(
            Math.max(...testimonials.map((t) => new Date(t.created_at)))
          ).toISOString()
        : currentDate;

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/portfolio</loc>
    <lastmod>${latestPhotoDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/design</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  
  <!-- Portfolio Category Pages -->
${categories
  .map((category) => {
    const categoryPhotos = photos.filter((p) => p.category === category);
    const latestCategoryUpdate =
      categoryPhotos.length > 0
        ? new Date(
            Math.max(...categoryPhotos.map((p) => new Date(p.uploaded_at)))
          ).toISOString()
        : currentDate;

    return `  <url>
    <loc>${baseUrl}/portfolio?category=${encodeURIComponent(category)}</loc>
    <lastmod>${latestCategoryUpdate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  })
  .join("\n")}

  <!-- Services Pages (inferred from categories) -->
  <url>
    <loc>${baseUrl}/services/kitchen-cabinets</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/services/bathroom-vanities</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/services/custom-woodworking</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/services/cabinet-design</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Testimonials Page -->
  <url>
    <loc>${baseUrl}/testimonials</loc>
    <lastmod>${latestTestimonialDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>

  <!-- FAQ and Info Pages -->
  <url>
    <loc>${baseUrl}/faq</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${baseUrl}/process</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
</urlset>`;

    res.set("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
});
// Robots.txt for SEO
router.get("/robots.txt", (req, res) => {
  const robotsTxt = `# As a condition of accessing this website, you agree to abide by the following
# content signals:

# (a)  If a content-Signal = yes, you may collect content for the corresponding
#      use.
# (b)  If a content-Signal = no, you may not collect content for the
#      corresponding use.
# (c)  If the website operator does not include a content signal for a
#      corresponding use, the website operator neither grants nor restricts
#      permission via content signal with respect to the corresponding use.
# The content signals and their meanings are:
# search:   building a search index and providing search results (e.g., returning
#           hyperlinks and short excerpts from your website's contents). Search does not
#           include providing AI-generated search summaries.
# ai-input: inputting content into one or more AI models (e.g., retrieval
#           augmented generation, grounding, or other real-time taking of content for
#           generative AI search answers).
# ai-train: training or fine-tuning AI models.
# ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF
# RIGHTS UNDER ARTICLE 4 OF THE EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT
# AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET.
# BEGIN Cloudflare Managed content
# User-Agent: *
# Content-Signal: search=yes,ai-train=no
# Allow: /
User-agent: Amazonbot
Disallow: /
User-agent: Applebot-Extended
Disallow: /
User-agent: Bytespider
Disallow: /
User-agent: CCBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: GPTBot
Disallow: /
User-agent: meta-externalagent
Disallow: /
# END Cloudflare Managed Content
User-agent: *
Allow: /
# Sitemap
Sitemap: https://gudinocustom.com/sitemap.xml
# Disallow admin and private areas
Disallow: /admin
Disallow: /api/
Disallow: /reset-password
# Allow specific API endpoints that should be crawled
Allow: /api/photos
Allow: /api/testimonials
# Crawl delay (optional)
Crawl-delay: 1`;

  res.set("Content-Type", "text/plain");
  res.send(robotsTxt);
});
// List uploads directory (for debugging)
router.get("/api/debug/uploads", async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, "uploads");
    const categories = await fs.readdir(uploadsDir);

    const structure = {};
    for (const category of categories) {
      const categoryPath = path.join(uploadsDir, category);
      const stat = await fs.stat(categoryPath);
      if (stat.isDirectory()) {
        const files = await fs.readdir(categoryPath);
        structure[category] = files;
      }
    }

    res.json({ uploadsDir, structure });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// EXPORTS
module.exports = router;
