// This file contains all testimonial-related API endpoints
// REQUIRED IMPORTS
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const sharp = require("sharp");
const rateLimit = require("express-rate-limit");
const { testimonialDb } = require("../db-helpers");
const { authenticateUser } = require("../middleware/auth");
const { emailTransporter } = require("../utils/email");
const { uploadMemory } = require("../middleware/upload");
const { getLocationFromIP } = require("../utils/geolocation");
const { notifyTestimonialLinkOpened, notifyTestimonialSubmitted } = require("../utils/push-notifications");
const { handleError } = require("../utils/error-handler");

// Rate limiter for testimonial submissions (3 per hour per IP)
const testimonialSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many testimonial submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false } // Trust proxy configured at app level
});
// Public endpoint - Get all visible testimonials
router.get("/", async (req, res) => {
  try {
    const testimonials = await testimonialDb.getAllTestimonials(true);
    // This list is public, so it never carries how to reach the client
    res.json(testimonials.map(({ client_email, token_id, ...testimonial }) => testimonial));
  } catch (error) {
    handleError(error, "Failed to get testimonials", res, 500);
  }
});
// Public endpoint - Validate testimonial token and return token data
router.get("/validate-token/:token", async (req, res) => {
  try {
    const tokenData = await testimonialDb.validateToken(req.params.token);
    if (tokenData) {
      // Return token data for auto-populating the form
      res.json({
        valid: true,
        client_name: tokenData.client_name,
        project_type: tokenData.project_type
      });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    handleError(error, "Failed to validate token", res, 500);
  }
});

// Public endpoint - Track testimonial link open from frontend
router.post("/track-open", async (req, res) => {
  try {
    const { token } = req.body;

    // Validate token exists and is not expired
    const tokenData = await testimonialDb.validateToken(token);
    if (!tokenData) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Extract request information
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || req.headers['referrer'] || '';

    // Get geolocation data
    const location = await getLocationFromIP(ip);

    // Track the link open (city-level only for privacy compliance)
    await testimonialDb.trackLinkOpen(token, {
      ip_address: ip,
      user_agent: userAgent,
      referer: referer,
      city: location.city,
      region: location.region,
      country: location.country,
      country_code: location.country_code
    });

    // Send push notification to admins
    try {
      await notifyTestimonialLinkOpened({
        clientName: tokenData.client_name
      });
    } catch (notifError) {
      // Don't fail the request if notification fails
      console.error('Failed to send push notification:', notifError);
    }

    res.json({ success: true });
  } catch (error) {
    handleError(error, "Failed to track link open", res, 500);
  }
});

// Public endpoint - Track testimonial link open and redirect to form
router.get("/t/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Validate token exists and is not expired
    const tokenData = await testimonialDb.validateToken(token);
    if (!tokenData) {
      return res.redirect('/testimonials?error=invalid_token');
    }

    // Extract request information
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];
    const userAgent = req.headers['user-agent'] || '';
    const referer = req.headers['referer'] || req.headers['referrer'] || '';

    // Get geolocation data
    const location = await getLocationFromIP(ip);

    // Track the link open (city-level only for privacy compliance)
    await testimonialDb.trackLinkOpen(token, {
      ip_address: ip,
      user_agent: userAgent,
      referer: referer,
      city: location.city,
      region: location.region,
      country: location.country,
      country_code: location.country_code
    });

    // Redirect to testimonial form with token
    res.redirect(`/testimonials?token=${token}`);
  } catch (error) {
    console.error("Error tracking link open:", error);
    res.redirect('/testimonials');
  }
});

// Public endpoint - Submit testimonial with photos
router.post("/submit", testimonialSubmitLimiter, uploadMemory.array("photos", 5), async (req, res) => {
    try {
      const { client_name, message, rating, project_type, token } = req.body;
      // Validate token
      let tokenData;
      tokenData = await testimonialDb.validateToken(token);
      if (!tokenData) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }
      // Create testimonial
      const testimonial = await testimonialDb.createTestimonial({
        client_name,
        message,
        rating: parseInt(rating),
        project_type,
        client_email: tokenData.client_email,
        token_id: tokenData.id,
      });
      // Process and save photos if any
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const timestamp = Date.now();
          const filename = `testimonial_${testimonial.id}_${timestamp}_${i}.jpg`;
          const thumbnailFilename = `testimonial_${testimonial.id}_${timestamp}_${i}_thumb.jpg`;
          const filePath = `/testimonial-photos/${filename}`;
          const thumbnailPath = `/testimonial-photos/${thumbnailFilename}`;
          const fullPath = path.join(
            __dirname,
            "..",
            "uploads",
            "testimonial-photos",
            filename
          );
          const thumbnailFullPath = path.join(
            __dirname,
            "..",
            "uploads",
            "testimonial-photos",
            thumbnailFilename
          );
          // Ensure directory exists
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          // Process main image with orientation fix
          const processedImage = await sharp(file.buffer)
            .rotate() // Auto-rotate based on EXIF orientation
            .jpeg({ quality: 85 })
            .resize(1200, 1200, { fit: "inside", withoutEnlargement: true });
          const metadata = await processedImage.metadata();
          await processedImage.toFile(fullPath);
          // Create high-quality thumbnail with orientation fix
          await sharp(file.buffer)
            .rotate() // Auto-rotate based on EXIF orientation
            .jpeg({ quality: 90, mozjpeg: true }) // Higher quality for testimonials
            .resize(400, 400, { fit: "cover", withoutEnlargement: false })
            .toFile(thumbnailFullPath);
          // Save to database
          await testimonialDb.addTestimonialPhoto(testimonial.id, {
            filename,
            original_name: file.originalname,
            file_path: filePath,
            thumbnail_path: thumbnailPath,
            file_size: file.size,
            mime_type: "image/jpeg",
            width: metadata.width,
            height: metadata.height,
            display_order: i,
          });
        }
      }
      // Mark token as used
      await testimonialDb.markTokenUsed(token);

      // Send push notification to admins
      try {
        await notifyTestimonialSubmitted({
          clientName: client_name,
          rating: parseInt(rating),
          projectType: project_type
        });
      } catch (notifError) {
        // Don't fail the request if notification fails
        console.error('Failed to send push notification:', notifError);
      }

      res.json({ success: true, testimonial_id: testimonial.id });
    } catch (error) {
      handleError(error, "Failed to submit testimonial", res, 500);
    }
  }
);
// EXPORTS
module.exports = router;
// 
