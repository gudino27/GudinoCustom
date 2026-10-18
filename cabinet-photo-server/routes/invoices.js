// INVOICE ROUTES (Admin + Public)
// This file contains all invoice-related API endpoints
// REQUIRED IMPORTS 
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const { invoiceDb } = require("../db-helpers");
const { authenticateUser } = require("../middleware/auth");
const { generatePdfWithRetry, generateInvoicePdf, getInvoiceTranslations } = require("../utils/pdf-generator");
const { generateReceiptPdf } = require("../utils/receipt-generator");
const { emailTransporter } = require("../utils/email");
const { twilioClient } = require("../utils/sms");
const { getLocationFromIP } = require("../utils/geolocation");
const { notifyInvoiceOpened, notifyInvoiceChangesViewed } = require("../utils/push-notifications");

// Public endpoint - Generate invoice PDF by token (for client download)
router.get("/:token/pdf", async (req, res) => {
  try {
    const token = req.params.token;
    const tokenData = await invoiceDb.getInvoiceByToken(token);
    if (!tokenData) {
      return res.status(404).json({ error: "Invoice not found or access expired" });
    }

    const invoiceId = tokenData.invoice_id || tokenData.id;
    const pdfBuffer = await generateInvoicePdf(invoiceId, "en");

    const invoice = await invoiceDb.getInvoiceById(invoiceId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${invoice.invoice_number.split("-").pop()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating public PDF:", error);
    res.status(500).json({
      error: "Failed to generate PDF",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Public endpoint - Get receipt data by invoice token and payment ID
router.get("/:token/payment/:paymentId", async (req, res) => {
  try {
    const { token, paymentId } = req.params;

    // Verify invoice token
    const invoice = await invoiceDb.getInvoiceByToken(token);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found or access expired" });
    }

    // Get payment and verify it belongs to this invoice
    const payment = await invoiceDb.getPaymentById(paymentId);
    if (!payment || payment.invoice_id !== invoice.invoice_id) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Get all payments for this invoice to calculate totals
    const allPayments = await invoiceDb.getInvoicePayments(invoice.invoice_id);
    const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.payment_amount), 0);
    const remainingBalance = Math.max(0, parseFloat(invoice.total_amount) - totalPaid);

    res.json({
      payment: {
        id: payment.id,
        amount: payment.payment_amount,
        method: payment.payment_method,
        date: payment.payment_date,
        check_number: payment.check_number,
        notes: payment.notes,
      },
      invoice: {
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        client_name: invoice.is_business
          ? invoice.company_name
          : `${invoice.first_name} ${invoice.last_name}`,
      },
      totals: {
        total_paid: totalPaid.toFixed(2),
        remaining_balance: remainingBalance.toFixed(2),
        is_paid_in_full: remainingBalance <= 0,
      },
    });
  } catch (error) {
    console.error("Error fetching receipt data:", error);
    res.status(500).json({ error: "Failed to fetch receipt data" });
  }
});

// Public endpoint - Generate receipt PDF by invoice token and payment ID
router.get("/:token/payment/:paymentId/pdf", async (req, res) => {
  try {
    const { token, paymentId } = req.params;
    const language = req.query.lang || "en";

    // Verify invoice token
    const invoice = await invoiceDb.getInvoiceByToken(token);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found or access expired" });
    }

    // Get payment and verify it belongs to this invoice
    const payment = await invoiceDb.getPaymentById(paymentId);
    if (!payment || payment.invoice_id !== invoice.invoice_id) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const pdfBuffer = await generateReceiptPdf(paymentId, language);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="receipt-${invoice.invoice_number.split("-").pop()}-${paymentId}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating receipt PDF:", error);
    res.status(500).json({
      error: "Failed to generate receipt PDF",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Public endpoint - Get tracking data for invoice by token
router.get("/:token/tracking", async (req, res) => {
  try {
    const token = req.params.token;

    // First verify the token is valid and get invoice
    const invoice = await invoiceDb.getInvoiceByToken(token);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found or expired" });
    }

    // Get tracking data for this invoice using the invoice ID
    const invoiceId = invoice.invoice_id || invoice.id;

    // Get view tracking data
    const trackingData = await invoiceDb.getInvoiceTracking(invoiceId);

    res.json({
      totalViews: trackingData.length,
      uniqueIPs: [...new Set(trackingData.map((view) => view.client_ip))]
        .length,
      firstViewed:
        trackingData.length > 0
          ? trackingData[trackingData.length - 1].viewed_at
          : null,
      lastViewed: trackingData.length > 0 ? trackingData[0].viewed_at : null,
      recentViews: trackingData.slice(0, 10), // Last 10 views
      locationSummary: trackingData.reduce((acc, view) => {
        const location =
          view.city && view.country
            ? `${view.city}, ${view.country}`
            : view.country || "Unknown";
        acc[location] = (acc[location] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error("Error getting invoice tracking:", error);
    res.status(500).json({ error: "Failed to get tracking data" });
  }
});

// Public endpoint - Get invoice by token (for client viewing)
router.get("/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const invoice = await invoiceDb.getInvoiceByToken(token);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found or expired" });
    }

    // Track the view with location data
    // req.ip will now correctly return the real client IP due to 'trust proxy' setting
    const clientIp = req.ip || req.headers["x-real-ip"] || req.headers["x-forwarded-for"]?.split(',')[0] || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"];

    const invoiceId = invoice.invoice_id;

    // Get location data from IP (non-blocking)
    const locationData = await getLocationFromIP(clientIp);

    const viewInfo = await invoiceDb.trackInvoiceView(
      invoiceId,
      token,
      clientIp,
      userAgent,
      locationData
    );
    console.log("✅ Invoice view tracked successfully", viewInfo);

    // Send push notification to admins for first view or first view after update
    try {
      const clientName = invoice.is_business
        ? invoice.company_name
        : `${invoice.first_name} ${invoice.last_name}`;

      if (viewInfo.isFirstView) {
        await notifyInvoiceOpened({
          clientName,
          invoiceNumber: invoice.invoice_number
        });
      } else if (viewInfo.isFirstViewAfterUpdate) {
        await notifyInvoiceChangesViewed({
          clientName,
          invoiceNumber: invoice.invoice_number
        });
      }
    } catch (notifError) {
      // Don't fail the request if notification fails
      console.error('Failed to send push notification:', notifError);
    }

    // Remove admin_notes from public view (security: clients should never see admin notes)
    const { admin_notes, ...clientInvoice } = invoice;

    res.json(clientInvoice);
  } catch (error) {
    console.error("Error getting invoice by token:", error);
    res.status(500).json({ error: "Failed to get invoice" });
  }
});



// EXPORTS
module.exports = router;
