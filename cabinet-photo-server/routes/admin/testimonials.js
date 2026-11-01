// this file is for admin-specific testimonial routes
// Required Imports
const express = require("express");
const router = express.Router();
const { authenticateUser, requireRole } = require("../../middleware/auth");

const adminOnly = requireRole(["admin", "super_admin"]);
const { uploadMemory } = require("../../middleware/upload");
const { getDb, queueDbOperation, testimonialDb } = require("../../db-helpers");
const { emailTransporter } = require("../../utils/email");
const { twilioClient } = require("../../utils/sms");
// Admin endpoint - Send testimonial link
router.post("/send-testimonial-link",authenticateUser, adminOnly,async (req, res) => {
    try {
      const { client_name, client_email, client_phone, project_type, send_via = "email" } = req.body;

      // Create token
      const tokenData = await testimonialDb.createToken({
        client_name,
        client_email,
        project_type,
        sent_by: req.user.id,
      });

      const testimonialLink = `${process.env.FRONTEND_URL || req.protocol + "://" + req.get("host").replace("api.", "")}/testimonial/${tokenData.token}`;

      const results = { email: null, sms: null };

      // Send via email
      if (send_via === "email" || send_via === "both") {
        if (!client_email) {
          return res.status(400).json({ error: "Client email is required for email delivery" });
        }

        try {
          const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: client_email,
            subject: "Share Your Experience with Gudino Custom Woodworking",
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Hi ${client_name},</h2>
              <p>Thank you for choosing Gudino Custom Woodworking for your ${project_type} project!</p>
              <p>We'd love to hear about your experience and see photos of your completed project. Your feedback helps other homeowners discover our carpentry services.</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${testimonialLink}" style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Share Your Experience</a>
              </p>
              <p><small>This link will expire in 30 days. If you have any questions, please don't hesitate to contact us.</small></p>
              <p>Best regards,<br>Gudino Custom Woodworking Team</p>
            </div>
          `,
          };
          await emailTransporter.sendMail(mailOptions);
          results.email = { success: true };
        } catch (emailError) {
          console.error("Error sending testimonial email:", emailError);
          results.email = { success: false, error: emailError.message };
        }
      }

      // Send via SMS
      if (send_via === "sms" || send_via === "both") {
        if (!client_phone) {
          return res.status(400).json({ error: "Client phone is required for SMS delivery" });
        }

        if (!twilioClient) {
          return res.status(500).json({ error: "SMS service not configured" });
        }

        try {
          const smsMessage = `Hi ${client_name}! Thank you for choosing Gudino Custom Woodworking for your ${project_type} project. We'd love to hear about your experience! Share your testimonial here: ${testimonialLink}`;

          const smsOptions = {
            body: smsMessage,
            to: client_phone,
          };

          if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
            smsOptions.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
          } else if (process.env.TWILIO_PHONE_NUMBER) {
            smsOptions.from = process.env.TWILIO_PHONE_NUMBER;
          }

          const smsResult = await twilioClient.messages.create(smsOptions);
          results.sms = { success: true, sid: smsResult.sid };
        } catch (smsError) {
          console.error("Error sending testimonial SMS:", smsError);
          results.sms = { success: false, error: smsError.message };
        }
      }

      const overallSuccess = (results.email?.success || results.email === null) && (results.sms?.success || results.sms === null);

      res.json({
        success: overallSuccess,
        token: tokenData.token,
        results
      });
    } catch (error) {
      console.error("Error sending testimonial link:", error);
      res.status(500).json({ error: "Failed to send testimonial link" });
    }
  }
);
// Admin endpoint - Get all testimonials
router.get("/testimonials", authenticateUser, adminOnly, async (req, res) => {
  try {
    const testimonials = await testimonialDb.getAllTestimonials(false);
    res.json(testimonials);
  } catch (error) {
    console.error("Error getting admin testimonials:", error);
    res.status(500).json({ error: "Failed to get testimonials" });
  }
});
// Admin endpoint - Get testimonial tokens with status filtering
router.get("/testimonial-tokens", authenticateUser, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const tokens = await testimonialDb.getTokens(null, status);
    res.json(tokens);
  } catch (error) {
    console.error("Error getting testimonial tokens:", error);
    res.status(500).json({ error: "Failed to get testimonial tokens" });
  }
});

// Admin endpoint - Get tracking data for a specific token
router.get("/testimonial-tokens/:token/tracking", authenticateUser, adminOnly, async (req, res) => {
  try {
    const { token } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const trackingData = await testimonialDb.getTokenTracking(token, limit, offset);
    res.json(trackingData);
  } catch (error) {
    console.error("Error getting token tracking:", error);
    res.status(500).json({ error: "Failed to get token tracking" });
  }
});
// Admin endpoint - Delete testimonial token
router.delete("/testimonial-tokens/:token",authenticateUser, adminOnly,async (req, res) => {
    try {
      const { token } = req.params;
      await testimonialDb.deleteToken(token);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting testimonial token:", error);
      res.status(500).json({ error: "Failed to delete testimonial token" });
    }
  }
);
// Admin endpoint - Update testimonial visibility
router.put("/testimonials/:id/visibility",authenticateUser, adminOnly,async (req, res) => {
    try {
      const { is_visible } = req.body;
      await testimonialDb.updateTestimonialVisibility(
        req.params.id,
        is_visible
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating testimonial visibility:", error);
      res
        .status(500)
        .json({ error: "Failed to update testimonial visibility" });
    }
  }
);
// Admin endpoint - Delete testimonial (super admin only)
router.delete("/testimonials/:id",authenticateUser, adminOnly,async (req, res) => {
    try {
      if (req.user.role !== "super_admin") {
        return res.status(403).json({ error: "Super admin access required" });
      }
      // Get testimonial photos to delete files
      const testimonial = await testimonialDb.getTestimonialById(req.params.id);
      if (testimonial && testimonial.photos) {
        for (const photo of testimonial.photos) {
          try {
            await fs.unlink(path.join(__dirname, "public", photo.file_path));
            if (photo.thumbnail_path) {
              await fs.unlink(
                path.join(__dirname, "public", photo.thumbnail_path)
              );
            }
          } catch (err) {
            console.warn("Could not delete photo file:", err.message);
          }
        }
      }
      await testimonialDb.deleteTestimonial(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting testimonial:", error);
      res.status(500).json({ error: "Failed to delete testimonial" });
    }
  }
);
// Admin endpoint - Get testimonial analytics
router.get("/testimonial-analytics",authenticateUser, adminOnly,async (req, res) => {
    try {
      const dateRange = parseInt(req.query.days) || 30;
      const db = await getDb();
      // Get testimonial submission stats
      const submissions = await db.get(`
      SELECT 
        COUNT(*) as total_submissions,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN photos.testimonial_id IS NOT NULL THEN 1 END) as submissions_with_photos
      FROM testimonials t
      LEFT JOIN (
        SELECT DISTINCT testimonial_id 
        FROM testimonial_photos
      ) photos ON t.id = photos.testimonial_id
      WHERE t.created_at >= datetime('now', '-${dateRange} days')
    `);
      // Get testimonial activity by day
      const dailyActivity = await db.all(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as submissions
      FROM testimonials 
      WHERE created_at >= datetime('now', '-${dateRange} days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);
      // Get rating distribution
      const ratingDistribution = await db.all(`
      SELECT 
        rating,
        COUNT(*) as count
      FROM testimonials 
      WHERE created_at >= datetime('now', '-${dateRange} days')
      GROUP BY rating
      ORDER BY rating DESC
    `);
      // Get project types
      const projectTypes = await db.all(`
      SELECT 
        project_type,
        COUNT(*) as count,
        AVG(rating) as avg_rating
      FROM testimonials 
      WHERE created_at >= datetime('now', '-${dateRange} days')
      GROUP BY project_type
      ORDER BY count DESC
    `);
      // Get testimonial link activity
      const linkActivity = await db.all(`
      SELECT 
        COUNT(*) as total_links_sent,
        COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as links_used,
        ROUND(
          (COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 1
        ) as conversion_rate
      FROM testimonial_tokens 
      WHERE created_at >= datetime('now', '-${dateRange} days')
    `);
      res.json({
        submissions: submissions || {
          total_submissions: 0,
          avg_rating: 0,
          submissions_with_photos: 0,
        },
        daily_activity: dailyActivity,
        rating_distribution: ratingDistribution,
        project_types: projectTypes,
        link_activity: linkActivity[0] || {
          total_links_sent: 0,
          links_used: 0,
          conversion_rate: 0,
        },
      });
    } catch (error) {
      console.error("Error fetching testimonial analytics:", error);
      res.status(500).json({ error: "Failed to fetch testimonial analytics" });
    }
  }
);
//Required Exports
module.exports = router;
