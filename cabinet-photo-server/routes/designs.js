// This file contains all design-related API endpoints
// REQUIRED IMPORTS
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const rateLimit = require("express-rate-limit");
const {getDb,designDb} = require("../db-helpers");
const {authenticateUser, requireRole } = require("../middleware/auth");
const {uploadMemory } = require("../middleware/upload");
const { emailTransporter } = require("../utils/email");
const { sendSmsWithRouting } = require("../utils/sms");
const { handleError } = require("../utils/error-handler");
const { notifyDesignSubmitted } = require("../utils/push-notifications");

// Rate limiter for design submissions (5 per 15 minutes per IP)
const designSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many design submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false } // Trust proxy configured at app level
});
// Get all designs (for admin panel)
router.get("/", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const status = req.query.status || null;
    const designs = await designDb.getAllDesigns(status);
    res.json(designs);
  } catch (error) {
    handleError(error, "Failed to fetch designs", res, 500);
  }
});
// Send email notification
router.post("/", designSubmitLimiter, uploadMemory.single("pdf"), async (req, res) => {
  try {
    console.log("\n=== NEW DESIGN SUBMISSION ===");
    // Parse design data from form data
    let designData;
    try {
      designData = JSON.parse(req.body.designData);
      console.log("Parsed design data successfully");
    } catch (parseError) {
      console.error("Failed to parse design data:", parseError);
      return res.status(400).json({ error: "Invalid design data format" });
    }
    // Add PDF buffer
    if (req.file) {
      designData.pdf_data = req.file.buffer;
      console.log("PDF size:", req.file.buffer.length, "bytes");
    }
    console.log("Design images:", {
      has_floor_plan: !!designData.floor_plan_image,
      floor_plan_size: designData.floor_plan_image
        ? designData.floor_plan_image.length
        : 0,
      wall_view_count: designData.wall_view_images?.length || 0,
      total_size: JSON.stringify(designData).length,
    });
    // Check if data is too large since SQLite sadly has limnits
    const dataSize = JSON.stringify(designData).length;
    if (dataSize > 10 * 1024 * 1024) {
      // 10MB limit
      console.warn(
        "Design data very large:",
        (dataSize / 1024 / 1024).toFixed(2),
        "MB"
      );
    }
    // Save to database
    const designId = await designDb.saveDesign(designData);
    console.log(` Design #${designId} saved for ${designData.client_name}`);
    // email notification
    const notificationType = process.env.DESIGN_NOTIFICATION_TYPE || "email";
    if (
      (notificationType === "email" || notificationType === "both") &&
      process.env.EMAIL_USER &&
      process.env.EMAIL_PASS
    ) {
      try {
        const info = await emailTransporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: "info@gudinocustom.com",
          subject: `New Cabinet Design - ${
            designData.client_name
          } - $${designData.total_price.toFixed(2)}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Cabinet Design Submitted</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Client:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">${
                    designData.client_name
                  }</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Contact:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    ${
                      designData.contact_preference === "email"
                        ? designData.client_email
                        : designData.client_phone
                    }
                    (prefers ${designData.contact_preference})
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Total:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee; color: #27ae60; font-size: 18px;">
                    <strong>$${designData.total_price.toFixed(2)}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Rooms:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    ${
                      designData.include_kitchen
                        ? `✓ Kitchen (${
                            designData.kitchen_data?.elements?.length || 0
                          } items)<br>`
                        : ""
                    }
                    ${
                      designData.include_bathroom
                        ? `✓ Bathroom (${
                            designData.bathroom_data?.elements?.length || 0
                          } items)`
                        : ""
                    }
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>Design Preview:</strong></td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    ${
                      designData.floor_plan_image
                        ? "✓ Floor plan included<br>"
                        : ""
                    }
                    ${
                      designData.wall_view_images?.length
                        ? `✓ ${designData.wall_view_images.length} wall views included`
                        : ""
                    }
                  </td>
                </tr>
              </table>
              
              <div style="margin-top: 30px; text-align: center;">
                <a href="${
                  process.env.ADMIN_URL || "https://gudinocustom.com"
                }/admin#designs" 
                   style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  View Design in Admin Panel
                </a>
              </div>
            </div>
          `,
        });
        console.log("📧 Email sent:", info.messageId);
      } catch (emailError) {
        console.error("⚠️  Email failed:", emailError.message);
      }
    }
    // SMS notification for design submissions using routing system
    if (notificationType === "sms" || notificationType === "both") {
      try {
        const smsBody = `New cabinet design from ${
          designData.client_name
        } - $${designData.total_price.toFixed(2)}. Contact: ${
          designData.contact_preference === "email"
            ? designData.client_email
            : designData.client_phone
        }`;

        const smsResult = await sendSmsWithRouting(
          "design_submission",
          smsBody
        );

        if (smsResult.success) {
          console.log(
            `📱 Design SMS notification sent to ${smsResult.totalSent} recipient(s)`
          );
        } else {
          console.error("⚠️  Design SMS routing failed:", smsResult.error);
        }
      } catch (smsError) {
        console.error("⚠️  SMS routing error:", smsError.message);
      }
    }

    // Push notification for design submissions (to admin devices)
    try {
      await notifyDesignSubmitted({
        clientName: designData.client_name,
        totalPrice: designData.total_price,
        contactPreference: designData.contact_preference,
        designId
      });
      console.log('🔔 Design push notification sent to admins');
    } catch (pushError) {
      console.error('⚠️  Design push notification error:', pushError.message);
    }

    res.json({
      success: true,
      designId,
      message: "Design saved successfully",
    });
  } catch (error) {
    handleError(error, "Failed to save design", res, 500);
  }
});
router.get("/stats", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const stats = await designDb.getDesignStats();
    res.json(stats);
  } catch (error) {
    handleError(error, "Failed to fetch design statistics", res, 500);
  }
});
// Also fix the single design route
router.get("/:id", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const designId = parseInt(req.params.id);
    const design = await designDb.getDesign(designId);
    if (design) {
      res.json(design);
    } else {
      res.status(404).json({ error: "Design not found" });
    }
  } catch (error) {
    handleError(error, "Failed to fetch design", res, 500);
  }
});
router.delete("/:id", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const designId = parseInt(req.params.id);
    const db = await getDb();
    const result = await db.run("DELETE FROM designs WHERE id = ?", designId);
    if (result.changes > 0) {
      console.log(`Design #${designId} deleted`);
      res.json({ success: true, message: "Design deleted successfully" });
    } else {
      res.status(404).json({ error: "Design not found" });
    }
  } catch (error) {
    handleError(error, "Failed to delete design", res, 500);
  }
});
// Get design PDF
router.get("/:id/pdf", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const designId = parseInt(req.params.id);
    const pdfData = await designDb.getDesignPdf(designId);
    if (pdfData) {
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="design-${designId}.pdf"`,
      });
      res.send(pdfData);
    } else {
      res.status(404).json({ error: "PDF not found" });
    }
  } catch (error) {
    handleError(error, "Failed to fetch PDF", res, 500);
  }
});
// Update design status
router.put("/:id/status", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const designId = parseInt(req.params.id);
    const { status, viewedBy } = req.body;
    const success = await designDb.updateDesignStatus(
      designId,
      status,
      viewedBy || req.user.username
    );
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Design not found" });
    }
  } catch (error) {
    handleError(error, "Failed to update design status", res, 500);
  }
});
// Update design note
router.put("/:id/note", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const designId = parseInt(req.params.id);
    const { note } = req.body;
    const success = await designDb.updateDesignNote(designId, note);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Design not found" });
    }
  } catch (error) {
    handleError(error, "Failed to update design note", res, 500);
  }
});
router.get("/:id/debug", authenticateUser, requireRole(['admin', 'super_admin']), async (req, res) => {
  try {
    const designId = parseInt(req.params.id);
    const db = await getDb();
    // Get raw data from database
    const design = await db.get("SELECT * FROM designs WHERE id = ?", designId);
    if (design) {
      // Check if kitchen_data and bathroom_data are stored
      const debugInfo = {
        id: design.id,
        client_name: design.client_name,
        has_kitchen_data: !!design.kitchen_data,
        has_bathroom_data: !!design.bathroom_data,
        kitchen_data_length: design.kitchen_data
          ? design.kitchen_data.length
          : 0,
        bathroom_data_length: design.bathroom_data
          ? design.bathroom_data.length
          : 0,
        kitchen_data_preview: design.kitchen_data
          ? design.kitchen_data.substring(0, 200)
          : null,
        bathroom_data_preview: design.bathroom_data
          ? design.bathroom_data.substring(0, 200)
          : null,
        pdf_data_size: design.pdf_data ? design.pdf_data.length : 0,
      };
      res.json(debugInfo);
    } else {
      res.status(404).json({ error: "Design not found" });
    }
  } catch (error) {
    handleError(error, "Failed to fetch debug information", res, 500);
  }
});
// EXPORTS 
module.exports = router;