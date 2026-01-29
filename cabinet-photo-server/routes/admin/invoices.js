const express = require("express");
const router = express.Router();
const { authenticateUser, requireRole } = require("../../middleware/auth");
const { sanitizeQueryString } = require("../../middleware/validation");
const { getDb, queueDbOperation, invoiceDb } = require("../../db-helpers");
const {
  generatePdfWithRetry,
  generateInvoicePdf,
  getInvoiceTranslations,
} = require("../../utils/pdf-generator");
const { emailTransporter, generateInvoiceEmailOptions, generateReceiptEmailOptions } = require("../../utils/email");
const { generateReceiptPdf } = require("../../utils/receipt-generator");
const { twilioClient } = require("../../utils/sms");
const { getLocationFromIP } = require("../../utils/geolocation");
// Admin endpoint - Get all invoices
router.get("/", authenticateUser, async (req, res) => {
  try {
    const invoices = await invoiceDb.getAllInvoices();
    res.json(invoices);
  } catch (error) {
    console.error("Error getting invoices:", error);
    res.status(500).json({ error: "Failed to get invoices" });
  }
});
// Admin endpoint - Get invoice tracking data
router.get("/tracking", authenticateUser, async (req, res) => {
  try {
    const db = await getDb();
    // Get invoice tracking data with view counts, last viewed times, and location data
    const trackingData = await db.all(`
      SELECT
        i.id,
        i.invoice_number,
        i.client_id,
        i.total_amount,
        i.status,
        i.created_at,
        c.company_name,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.is_business,
        t.token,
        t.viewed_at,
        t.view_count,
        t.created_at as token_created_at,
        (SELECT client_ip FROM invoice_views WHERE invoice_id = i.id ORDER BY viewed_at DESC LIMIT 1) as client_ip,
        (SELECT country FROM invoice_views WHERE invoice_id = i.id ORDER BY viewed_at DESC LIMIT 1) as country,
        (SELECT region FROM invoice_views WHERE invoice_id = i.id ORDER BY viewed_at DESC LIMIT 1) as region,
        (SELECT city FROM invoice_views WHERE invoice_id = i.id ORDER BY viewed_at DESC LIMIT 1) as city,
        (SELECT timezone FROM invoice_views WHERE invoice_id = i.id ORDER BY viewed_at DESC LIMIT 1) as timezone
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN invoice_tokens t ON i.id = t.invoice_id AND t.is_active = 1
      ORDER BY i.created_at DESC
    `);
    await db.close();
    // Format the data for frontend consumption
    const formattedData = trackingData.map((item) => ({
      ...item,
      client_name: item.is_business
        ? item.company_name
        : `${item.first_name} ${item.last_name}`,
      has_token: !!item.token,
      is_viewed: !!item.viewed_at,
      view_count: item.view_count || 0,
      last_viewed: item.viewed_at,
    }));
    res.json(formattedData);
  } catch (error) {
    console.error("Error getting invoice tracking data:", error);
    res.status(500).json({ error: "Failed to get invoice tracking data" });
  }
});
// Admin endpoint - Get invoice view statistics
router.get("/view-stats", authenticateUser, async (req, res) => {
  try {
    const stats = await invoiceDb.getAllInvoiceViewStats();
    res.json(stats);
  } catch (error) {
    console.error("Error getting invoice view stats:", error);
    res.status(500).json({ error: "Failed to get invoice view statistics" });
  }
});
// Admin endpoint - Get invoices needing reminders
router.get("/needing-reminders", authenticateUser, async (req, res) => {
  try {
    const invoices = await invoiceDb.getInvoicesNeedingReminders();
    res.json(invoices);
  } catch (error) {
    console.error("Error getting invoices needing reminders:", error);
    res.status(500).json({ error: "Failed to get invoices needing reminders" });
  }
});
// Admin endpoint - Get invoice by ID
router.get("/:id", authenticateUser, async (req, res) => {
  try {
    const invoice = await invoiceDb.getInvoiceById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json(invoice);
  } catch (error) {
    console.error("Error getting invoice:", error);
    res.status(500).json({ error: "Failed to get invoice" });
  }
});
// Admin endpoint - Create new invoice
router.post("/", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.createInvoice(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});
// Admin endpoint - Update invoice
router.put("/:id", authenticateUser, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const updateData = req.body;
    // Check if invoice exists
    const existingInvoice = await invoiceDb.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    // Update the invoice
    const result = await invoiceDb.updateInvoice(invoiceId, updateData);
    res.json(result);
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: "Failed to update invoice" });
  }
});
// Admin endpoint - Get all clients
router.get("/clients", authenticateUser, async (req, res) => {
  try {
    const clients = await invoiceDb.getAllClients();
    res.json(clients);
  } catch (error) {
    console.error("Error getting clients:", error);
    res.status(500).json({ error: "Failed to get clients" });
  }
});
// Admin endpoint - Search clients with debouncing support
router.get("/clients/search", authenticateUser, async (req, res) => {
  try {
    // Security: Sanitize query parameter to prevent type confusion attacks
    // Rejects arrays/objects that could bypass length validation
    const q = sanitizeQueryString(req.query.q, { minLength: 2, maxLength: 100 });
    if (!q) {
      return res.json([]); // Return empty array for invalid or short queries
    }
    const clients = await invoiceDb.searchClients(q);
    res.json(clients);
  } catch (error) {
    console.error("Error searching clients:", error);
    res.status(500).json({ error: "Failed to search clients" });
  }
});
// Admin endpoint - Create new client
router.post("/clients", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.createClient(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ error: "Failed to create client" });
  }
});
// Admin endpoint - Get single client by ID
router.get("/clients/:id", authenticateUser, async (req, res) => {
  try {
    const client = await invoiceDb.getClientById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  } catch (error) {
    console.error("Error getting client:", error);
    res.status(500).json({ error: "Failed to get client" });
  }
});
// Admin endpoint - Update client
router.put("/clients/:id", authenticateUser, async (req, res) => {
  try {
    await invoiceDb.updateClient(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ error: "Failed to update client" });
  }
});
// Admin endpoint - Delete client
router.delete("/clients/:id", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.deleteClient(req.params.id);
    res.json({ success: true, changes: result.changes });
  } catch (error) {
    console.error("Error deleting client:", error);
    res.status(500).json({ error: "Failed to delete client" });
  }
});
// Admin endpoint - Get line item labels
router.get("/line-item-labels", authenticateUser, async (req, res) => {
  try {
    const labels = await invoiceDb.getLineItemLabels();
    res.json(labels);
  } catch (error) {
    console.error("Error getting line item labels:", error);
    res.status(500).json({ error: "Failed to get line item labels" });
  }
});
// Admin endpoint - Create line item label
router.post("/line-item-labels", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.createLineItemLabel(req.body);
    res.json(result);
  } catch (error) {
    console.error("Error creating line item label:", error);
    res.status(500).json({ error: "Failed to create line item label" });
  }
});
// Admin endpoint - Update line item label
router.put("/line-item-labels/:id", authenticateUser, async (req, res) => {
  try {
    await invoiceDb.updateLineItemLabel(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating line item label:", error);
    res.status(500).json({ error: "Failed to update line item label" });
  }
});
// Admin endpoint - Delete line item label
router.delete("/line-item-labels/:id", authenticateUser, async (req, res) => {
  try {
    await invoiceDb.deleteLineItemLabel(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting line item label:", error);
    res.status(500).json({ error: "Failed to delete line item label" });
  }
});
// Admin endpoint - Fix tax rate precision manually
router.post("/fix-tax-precision", authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Super admin access required" });
    }
    await invoiceDb.fixTaxRatePrecision();
    res.json({
      success: true,
      message: "Tax rate precision fixed successfully",
    });
  } catch (error) {
    console.error("Error fixing tax precision:", error);
    res.status(500).json({ error: "Failed to fix tax precision" });
  }
});
// Admin endpoint - Add payment to invoice
router.post("/:id/payments", authenticateUser, async (req, res) => {
  try {
    const paymentData = {
      ...req.body,
      invoice_id: req.params.id,
      created_by: req.user.id,
    };
    const result = await invoiceDb.addPayment(paymentData);
    res.json(result);
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ error: "Failed to add payment" });
  }
});
// Admin endpoint - Get payments for an invoice
router.get("/:id/payments", authenticateUser, async (req, res) => {
  try {
    const payments = await invoiceDb.getInvoicePayments(req.params.id);
    res.json(payments);
  } catch (error) {
    console.error("Error getting invoice payments:", error);
    res.status(500).json({ error: "Failed to get invoice payments" });
  }
});
// Admin endpoint - Get all payments (for payment management)
router.get("/payments", authenticateUser, async (req, res) => {
  try {
    const payments = await invoiceDb.getAllPayments();
    res.json(payments);
  } catch (error) {
    console.error("Error getting all payments:", error);
    res.status(500).json({ error: "Failed to get payments" });
  }
});
// Admin endpoint - Recalculate all invoice balances (for fixing balance issues)
router.post("/recalculate-balances", authenticateUser, async (req, res) => {
  try {
    const { getDb } = require("./db-helpers");
    const db = await getDb();
    // Get all invoices
    const invoices = await db.all("SELECT id, total_amount FROM invoices");
    let updatedCount = 0;
    for (const invoice of invoices) {
      // Calculate actual balance due
      const paymentsResult = await db.get(
        "SELECT SUM(payment_amount) as total_paid FROM invoice_payments WHERE invoice_id = ?",
        [invoice.id]
      );
      const totalPaid = paymentsResult.total_paid || 0;
      const balanceDue = Math.max(0, (invoice.total_amount || 0) - totalPaid);
      // Update the invoice with correct balance
      await db.run("UPDATE invoices SET balance_due = ? WHERE id = ?", [
        balanceDue,
        invoice.id,
      ]);
      // Also update status
      await invoiceDb.updateInvoiceStatus(invoice.id);
      updatedCount++;
    }
    await db.close();
    res.json({
      message: `Successfully recalculated balances for ${updatedCount} invoices`,
    });
  } catch (error) {
    console.error("Error recalculating invoice balances:", error);
    res.status(500).json({ error: "Failed to recalculate invoice balances" });
  }
});
// Admin endpoint - Update payment
router.put("/payments/:id", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.updatePayment(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ error: "Failed to update payment" });
  }
});
// Admin endpoint - Delete payment
router.delete("/payments/:id", authenticateUser, async (req, res) => {
  try {
    const result = await invoiceDb.deletePayment(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("Error deleting payment:", error);
    res.status(500).json({ error: "Failed to delete payment" });
  }
});
router.post("/:id/send-email", authenticateUser, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const {
      message,
      language = "english",
      sendToSelf = false,
      selfEmail = "",
      additionalEmails = [],
      useCustomClientEmail = false,
      customClientEmail = "",
    } = req.body;
    // Get invoice details with client info
    const invoice = await invoiceDb.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const client = await invoiceDb.getClientById(invoice.client_id);
    // Determine primary client email
    let primaryClientEmail;
    if (useCustomClientEmail) {
      if (!customClientEmail || !customClientEmail.trim()) {
        return res.status(400).json({
          error:
            "Custom client email is required when using custom client email option",
        });
      }
      primaryClientEmail = customClientEmail.trim();
    } else {
      if (!client || !client.email) {
        return res.status(400).json({ error: "Client email not found" });
      }
      primaryClientEmail = client.email;
    }
    // Start with primary client email as first recipient
    let recipients = [primaryClientEmail];
    // Add self email if requested
    if (sendToSelf) {
      if (!selfEmail || !selfEmail.trim()) {
        return res.status(400).json({
          error: "Self email address is required when also sending to self",
        });
      }
      recipients.push(selfEmail.trim());
    }
    // Add valid additional emails
    if (additionalEmails && additionalEmails.length > 0) {
      const validAdditionalEmails = additionalEmails
        .filter((email) => email && email.trim() && email.includes("@"))
        .map((email) => email.trim());
      recipients = [...recipients, ...validAdditionalEmails];
    }
    // Remove duplicates
    recipients = [...new Set(recipients)];
    // Update invoice status from draft to unpaid when sending
    if (invoice.status === "draft") {
      await invoiceDb.markInvoiceAsSent(invoiceId);
    }
    // Get or create the invoice token for the client access link
    let invoiceToken = invoice.token;
    if (!invoiceToken) {
      // Create a new token for this invoice if it doesn't exist
      const tokenResult = await invoiceDb.createInvoiceToken(invoiceId);
      invoiceToken = tokenResult.token;
    }
    const viewLink = `${process.env.FRONTEND_URL}/invoice/${invoiceToken}`;
    const clientName =
      client.company_name || `${client.first_name} ${client.last_name}`;
    // Get translations based on selected language
    const t = getInvoiceTranslations(language);
    // Generate PDF for attachment
    let pdfBuffer;
    try {
      pdfBuffer = await generateInvoicePdf(invoiceId, language);
    } catch (pdfError) {
      console.error("Failed to generate PDF for email:", pdfError);
      return res.status(500).json({
        error: "Failed to generate PDF attachment",
        details:
          process.env.NODE_ENV === "development" ? pdfError.message : undefined,
      });
    }
    const mailOptions = generateInvoiceEmailOptions({
      recipients,
      invoice,
      clientName,
      viewLink,
      language,
      message,
      pdfBuffer,
      translations: t,
    });

    try {
      await emailTransporter.sendMail(mailOptions);
      console.log(
        `Invoice email sent successfully to: ${recipients.join(", ")}`
      );

      res.json({
        success: true,
        message: "Invoice email sent successfully with PDF attachment",
        sentTo: recipients,
        recipientCount: recipients.length,
      });
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      return res.status(500).json({
        error: "Failed to send invoice email",
        details:
          process.env.NODE_ENV === "development"
            ? emailError.message
            : undefined,
      });
    }
  } catch (error) {
    console.error("Error in invoice email endpoint:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      error: "Failed to process invoice email request",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
// Admin endpoint - Send invoice via SMS
router.post("/:id/send-sms", authenticateUser, async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(500).json({ error: "SMS service not configured" });
    }

    const invoiceId = req.params.id;
    const { message, customPhone } = req.body;

    // Get invoice details with client info
    const invoice = await invoiceDb.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const client = await invoiceDb.getClientById(invoice.client_id);

    // Update invoice status from draft to unpaid when sending
    if (invoice.status === "draft") {
      await invoiceDb.markInvoiceAsSent(invoiceId);
    }

    // Use custom phone if provided by super admin, otherwise use client phone
    let targetPhone = customPhone;
    if (!customPhone) {
      if (!client || !client.phone) {
        return res.status(400).json({ error: "Client phone number not found" });
      }
      targetPhone = client.phone;
    }

    // Get or create the invoice token for the client access link
    let invoiceToken = invoice.token;
    if (!invoiceToken) {
      // Create a new token for this invoice if it doesn't exist
      const tokenResult = await invoiceDb.createInvoiceToken(invoiceId);
      invoiceToken = tokenResult.token;
    }
    const viewLink = `${process.env.FRONTEND_URL}/invoice/${invoiceToken}`;

    const clientName =
      client.company_name || `${client.first_name} ${client.last_name}`;

    // Format phone number (ensure it has country code)
    let phoneNumber = targetPhone.replace(/\D/g, ""); // Remove non-digits
    if (phoneNumber.length === 10) {
      phoneNumber = `+1${phoneNumber}`; // Add US country code
    } else if (phoneNumber.length === 11 && phoneNumber.startsWith("1")) {
      phoneNumber = `+${phoneNumber}`;
    } else if (!phoneNumber.startsWith("+")) {
      phoneNumber = `+1${phoneNumber}`;
    }

    const smsBody = `Hi ${clientName}, your invoice ${invoice.invoice_number
      .split("-")
      .pop()} from Gudino Custom Cabinets is ready. Total: $${invoice.total_amount.toFixed(
      2
    )}. View online: ${viewLink}${message ? `. Message: ${message}` : ""}`;

    // Send SMS using messaging service (preferred method)
    const smsOptions = {
      body: smsBody,
      to: phoneNumber,
    };

    // Use messaging service if available, otherwise fallback to phone number
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      smsOptions.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    } else if (process.env.TWILIO_PHONE_NUMBER) {
      smsOptions.from = process.env.TWILIO_PHONE_NUMBER;
    } else {
      throw new Error(
        "Neither messaging service SID nor phone number configured"
      );
    }

    await twilioClient.messages.create(smsOptions);

    res.json({
      success: true,
      message: "Invoice SMS sent successfully",
      sentTo: phoneNumber,
    });
  } catch (error) {
    console.error("Error sending invoice SMS:", error);
    res.status(500).json({ error: "Failed to send invoice SMS" });
  }
});
// Admin endpoint - Update invoice number
router.put("/:id/invoice-number", authenticateUser, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { invoice_number } = req.body;

    if (!invoice_number || !invoice_number.trim()) {
      return res.status(400).json({ error: "Invoice number is required" });
    }

    // Check if invoice exists
    const existingInvoice = await invoiceDb.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Check if invoice number is already in use by another invoice
    const duplicateInvoice = await invoiceDb.getInvoiceByNumber(
      invoice_number.trim()
    );
    if (duplicateInvoice && duplicateInvoice.id !== parseInt(invoiceId)) {
      return res.status(400).json({ error: "Invoice number already in use" });
    }

    // Update the invoice number
    const result = await invoiceDb.updateInvoiceNumber(
      invoiceId,
      invoice_number.trim(),
      req.user.id
    );

    res.json({
      success: true,
      message: "Invoice number updated successfully",
      invoice_number: invoice_number.trim(),
    });
  } catch (error) {
    console.error("Error updating invoice number:", error);
    res.status(500).json({ error: "Failed to update invoice number" });
  }
});
// Admin endpoint - Delete invoice completely
router.delete("/:id", authenticateUser, async (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Check if invoice exists
    const existingInvoice = await invoiceDb.getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Delete the invoice (cascade delete will handle related records)
    const result = await invoiceDb.deleteInvoice(invoiceId, req.user.id);

    // Run health check to fix ID gaps after deletion
    try {
      await invoiceDb.performDatabaseHealthCheck();
    } catch (healthError) {
      console.error("Health check after invoice deletion failed:", healthError);
      // Continue even if health check fails
    }

    res.json({
      success: true,
      message: "Invoice deleted successfully",
      invoice_number: existingInvoice.invoice_number,
    });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

// Superadmin endpoint - Delete ALL invoices (requires special confirmation)
router.delete("/delete-all", authenticateUser, async (req, res) => {
  try {
    // Check if user is superadmin (you may need to add this field to users table)
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ error: "Superadmin access required" });
    }

    const { confirmationCode } = req.body;

    if (!confirmationCode) {
      return res.status(400).json({
        error: "Confirmation code required",
        required_code: "DELETE_ALL_INVOICES_CONFIRM",
      });
    }

    const result = await invoiceDb.deleteAllInvoices(
      req.user.id,
      confirmationCode
    );

    // Run health check to reset sequences after deleting all invoices
    try {
      await invoiceDb.performDatabaseHealthCheck();
    } catch (healthError) {
      console.error(
        "Health check after deleting all invoices failed:",
        healthError
      );
      // Continue even if health check fails
    }

    res.json({
      message: `All invoices deleted successfully. ${result.deletedCount} invoices removed.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting all invoices:", error);
    if (error.message === "Invalid confirmation code") {
      return res.status(400).json({
        error: error.message,
        required_code: "DELETE_ALL_INVOICES_CONFIRM",
      });
    }
    res.status(500).json({ error: "Failed to delete all invoices" });
  }
});
// Admin endpoint - Create tax rate
router.post("/tax-rates", authenticateUser, async (req, res) => {
  try {
    const { state_code, city, tax_rate, description } = req.body;

    if (!city || !tax_rate) {
      return res.status(400).json({ error: "city and tax rate are required" });
    }

    // Validate tax rate is a valid number (now stored as percentage)
    const numericTaxRate = parseFloat(tax_rate);
    if (isNaN(numericTaxRate) || numericTaxRate < 0 || numericTaxRate > 100) {
      return res
        .status(400)
        .json({ error: "Tax rate must be a valid number between 0 and 100" });
    }

    // Check for duplicate
    const existing = await invoiceDb.findTaxRate(city, state_code || "");
    if (existing) {
      return res
        .status(400)
        .json({ error: "Tax rate already exists for this location" });
    }

    const result = await invoiceDb.createTaxRate({
      state_code: state_code.toUpperCase() || "",
      city: city,
      tax_rate: numericTaxRate, // Store as percentage
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "Tax rate created successfully",
      id: result.id,
    });
  } catch (error) {
    console.error("Error creating tax rate:", error);
    console.error("Error stack:", error.stack);
    console.error("Request body:", req.body);
    res
      .status(500)
      .json({ error: "Failed to create tax rate", details: error.message });
  }
});
// Admin endpoint - Update tax rate
router.put("/tax-rates/:id", authenticateUser, async (req, res) => {
  try {
    const taxRateId = req.params.id;
    const { state_code, county, city, tax_rate, description, is_active } =
      req.body;

    if (!state_code || tax_rate === undefined) {
      return res
        .status(400)
        .json({ error: "State code and tax rate are required" });
    }

    // Validate tax rate is a valid number (now stored as percentage)
    const numericTaxRate = parseFloat(tax_rate);
    if (isNaN(numericTaxRate) || numericTaxRate < 0 || numericTaxRate > 100) {
      return res
        .status(400)
        .json({ error: "Tax rate must be a valid number between 0 and 100" });
    }

    // Check if tax rate exists
    const existing = await invoiceDb.getTaxRateById(taxRateId);
    if (!existing) {
      return res.status(404).json({ error: "Tax rate not found" });
    }

    // Check for duplicate if location changed
    if (
      state_code !== existing.state_code ||
      (county || "") !== (existing.county || "") ||
      (city || "") !== (existing.city || "")
    ) {
      const duplicate = await invoiceDb.findTaxRate(
        state_code,
        county || "",
        city || ""
      );
      if (duplicate && duplicate.id !== parseInt(taxRateId)) {
        return res
          .status(400)
          .json({ error: "Tax rate already exists for this location" });
      }
    }

    const result = await invoiceDb.updateTaxRate(taxRateId, {
      state_code: state_code.toUpperCase(),
      county: county || null,
      city: city || null,
      tax_rate: numericTaxRate, // Store as percentage
      description: description || null,
      is_active: is_active !== undefined ? is_active : existing.is_active,
      updated_by: req.user.id,
    });

    res.json({
      success: true,
      message: "Tax rate updated successfully",
    });
  } catch (error) {
    console.error("Error updating tax rate:", error);
    res.status(500).json({ error: "Failed to update tax rate" });
  }
});
// Admin endpoint - Delete tax rate
router.delete("/tax-rates/:id", authenticateUser, async (req, res) => {
  try {
    const taxRateId = req.params.id;

    // Check if tax rate exists
    const existing = await invoiceDb.getTaxRateById(taxRateId);
    if (!existing) {
      return res.status(404).json({ error: "Tax rate not found" });
    }

    // Check if tax rate is being used by any invoices
    const inUse = await invoiceDb.isTaxRateInUse(taxRateId);
    if (inUse) {
      return res.status(400).json({
        error:
          "Cannot delete tax rate that is being used by existing invoices. Deactivate it instead.",
      });
    }

    const result = await invoiceDb.deleteTaxRate(taxRateId);

    res.json({
      success: true,
      message: "Tax rate deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting tax rate:", error);
    res.status(500).json({ error: "Failed to delete tax rate" });
  }
});
// Admin endpoint - Bulk delete tax rates
router.post("/tax-rates/bulk-delete", authenticateUser, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: "Array of tax rate IDs is required" });
    }

    let deletedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const id of ids) {
      try {
        // Check if tax rate exists
        const existing = await invoiceDb.getTaxRateById(id);
        if (!existing) {
          errors.push(`Tax rate with ID ${id} not found`);
          errorCount++;
          continue;
        }

        // Check if tax rate is being used by any invoices
        const inUse = await invoiceDb.isTaxRateInUse(id);
        if (inUse) {
          errors.push(
            `Cannot delete tax rate ID ${id} - it is being used by existing invoices`
          );
          errorCount++;
          continue;
        }

        await invoiceDb.deleteTaxRate(id);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting tax rate ${id}:`, error);
        errors.push(`Failed to delete tax rate ID ${id}`);
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} tax rate(s)${
        errorCount > 0 ? `, failed to delete ${errorCount}` : ""
      }`,
      deletedCount,
      errorCount,
      errors,
    });
  } catch (error) {
    console.error("Error bulk deleting tax rates:", error);
    res.status(500).json({ error: "Failed to bulk delete tax rates" });
  }
});
// Admin endpoint - Bulk add tax rates
router.post("/tax-rates/bulk-add", authenticateUser, async (req, res) => {
  try {
    const { taxRates } = req.body;

    if (!Array.isArray(taxRates) || taxRates.length === 0) {
      return res.status(400).json({ error: "Array of tax rates is required" });
    }

    let createdCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const taxRate of taxRates) {
      try {
        const { state_code, city, tax_rate, description } = taxRate;

        if (!state_code || !tax_rate) {
          errors.push(
            `Missing required fields (state_code, tax_rate) for entry: ${JSON.stringify(
              taxRate
            )}`
          );
          errorCount++;
          continue;
        }

        // Validate tax rate is a valid number
        const numericTaxRate = parseFloat(tax_rate);
        if (isNaN(numericTaxRate) || numericTaxRate < 0 || numericTaxRate > 1) {
          errors.push(`Invalid tax rate ${tax_rate} - must be between 0 and 1`);
          errorCount++;
          continue;
        }

        // Check for duplicate
        const existing = await invoiceDb.findTaxRate(state_code, city || "");
        if (existing) {
          errors.push(
            `Tax rate already exists for ${state_code}${
              city ? `, ${city}` : ""
            }`
          );
          errorCount++;
          continue;
        }

        await invoiceDb.createTaxRate({
          state_code: state_code.toUpperCase(),
          city: city || null,
          tax_rate: numericTaxRate,
          description: description || null,
          updated_by: req.user.id,
        });

        createdCount++;
      } catch (error) {
        console.error(`Error creating tax rate:`, error);
        errors.push(`Failed to create tax rate: ${JSON.stringify(taxRate)}`);
        errorCount++;
      }
    }

    res.json({
      success: true,
      message: `Successfully created ${createdCount} tax rate(s)${
        errorCount > 0 ? `, failed to create ${errorCount}` : ""
      }`,
      createdCount,
      errorCount,
      errors,
    });
  } catch (error) {
    console.error("Error bulk adding tax rates:", error);
    res.status(500).json({ error: "Failed to bulk add tax rates" });
  }
});
// Admin endpoint - Generate invoice PDF
router.get("/:id/pdf", authenticateUser, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const language = req.query.lang || "en";

    const invoice = await invoiceDb.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const pdfBuffer = await generateInvoicePdf(invoiceId, language);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="invoice-${invoice.invoice_number
        .split("-")
        .pop()}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).json({
      error: "Failed to generate PDF",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
// Admin endpoint - Generate receipt PDF for a payment
router.get("/:invoiceId/payments/:paymentId/receipt/pdf", authenticateUser, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const language = req.query.lang || "en";

    const payment = await invoiceDb.getPaymentById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const invoice = await invoiceDb.getInvoiceById(payment.invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
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
// Admin endpoint - Send receipt via email/SMS
router.post("/:invoiceId/payments/:paymentId/receipt/send", authenticateUser, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { recipients, language = "en", send_via = "email" } = req.body;

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ error: "At least one recipient is required" });
    }

    const payment = await invoiceDb.getPaymentById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const invoice = await invoiceDb.getInvoiceById(payment.invoice_id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const client = await invoiceDb.getClientById(invoice.client_id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const clientName = client.is_business
      ? client.company_name
      : `${client.first_name} ${client.last_name}`;

    // Generate receipt PDF
    const pdfBuffer = await generateReceiptPdf(paymentId, language);

    const results = { email: null, sms: null };

    // Get or create invoice token for the receipt link
    let tokenData = await invoiceDb.createInvoiceToken(invoice.id);
    const receiptLink = `${process.env.FRONTEND_URL || 'https://gudinocustom.com'}/invoice/${tokenData.token}/payment/${payment.id}`;

    // Send via email
    if (send_via === "email" || send_via === "both") {
      const emailRecipients = recipients.filter(r => r.includes("@"));
      if (emailRecipients.length === 0) {
        return res.status(400).json({ error: "Email address required for email delivery" });
      }

      try {
        const mailOptions = generateReceiptEmailOptions({
          recipients: emailRecipients,
          payment,
          invoice,
          clientName,
          language,
          pdfBuffer,
          receiptLink,
        });

        await emailTransporter.sendMail(mailOptions);
        results.email = { success: true, recipients: emailRecipients };
      } catch (emailError) {
        console.error("Error sending receipt email:", emailError);
        results.email = { success: false, error: emailError.message };
      }
    }

    // Send via SMS
    if (send_via === "sms" || send_via === "both") {
      const phoneRecipients = recipients.filter(r => !r.includes("@"));
      if (phoneRecipients.length === 0) {
        return res.status(400).json({ error: "Phone number required for SMS delivery" });
      }

      if (!twilioClient) {
        return res.status(500).json({ error: "SMS service not configured" });
      }

      try {
        const invoiceShortNumber = invoice.invoice_number.split("-").pop();
        const amount = parseFloat(payment.payment_amount).toFixed(2);
        const remaining = parseFloat(payment.remaining_balance || 0).toFixed(2);

        const smsMessage = language === "es"
          ? `Recibo de Pago - Factura #${invoiceShortNumber}\n\nMonto Pagado: $${amount}\nSaldo Restante: $${remaining}\n\nVer/Descargar Recibo:\n${receiptLink}\n\nGracias por su pago!\n- Gudino Custom Woodworking`
          : `Payment Receipt - Invoice #${invoiceShortNumber}\n\nAmount Paid: $${amount}\nRemaining Balance: $${remaining}\n\nView/Download Receipt:\n${receiptLink}\n\nThank you for your payment!\n- Gudino Custom Woodworking`;

        const smsResults = [];
        for (const phone of phoneRecipients) {
          const smsOptions = {
            body: smsMessage,
            to: phone,
          };

          if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
            smsOptions.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
          } else if (process.env.TWILIO_PHONE_NUMBER) {
            smsOptions.from = process.env.TWILIO_PHONE_NUMBER;
          }

          const smsResult = await twilioClient.messages.create(smsOptions);
          smsResults.push({ phone, sid: smsResult.sid });
        }

        results.sms = { success: true, sent: smsResults };
      } catch (smsError) {
        console.error("Error sending receipt SMS:", smsError);
        results.sms = { success: false, error: smsError.message };
      }
    }

    const overallSuccess =
      (results.email?.success || results.email === null) &&
      (results.sms?.success || results.sms === null);

    res.json({
      success: overallSuccess,
      results,
    });
  } catch (error) {
    console.error("Error sending receipt:", error);
    res.status(500).json({ error: "Failed to send receipt" });
  }
});
// Admin endpoint - Get tax rates
router.get("/tax-rates", authenticateUser, async (req, res) => {
  try {
    const rates = await invoiceDb.getTaxRates();
    res.json(rates);
  } catch (error) {
    console.error("Error getting tax rates:", error);
    res.status(500).json({ error: "Failed to get tax rates" });
  }
});
// Admin endpoint - Update tax rate
router.put("/tax-rates/:id", authenticateUser, async (req, res) => {
  try {
    const taxData = { ...req.body, updated_by: req.user.id };
    await invoiceDb.updateTaxRate(req.params.id, taxData);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating tax rate:", error);
    res.status(500).json({ error: "Failed to update tax rate" });
  }
});
// Admin endpoint - Get reminder settings for an invoice
router.get("/:id/reminder-settings", authenticateUser, async (req, res) => {
  try {
    const settings = await invoiceDb.getReminderSettings(req.params.id);
    res.json(
      settings || { reminders_enabled: false, reminder_days: "7,14,30" }
    );
  } catch (error) {
    console.error("Error getting reminder settings:", error);
    res.status(500).json({ error: "Failed to get reminder settings" });
  }
});
// Admin endpoint - Update reminder settings for an invoice
router.put("/:id/reminder-settings", authenticateUser, async (req, res) => {
  try {
    const { reminders_enabled, reminder_days } = req.body;
    await invoiceDb.updateReminderSettings(req.params.id, {
      reminders_enabled,
      reminder_days,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating reminder settings:", error);
    res.status(500).json({ error: "Failed to update reminder settings" });
  }
});
// Admin endpoint - Send manual reminder for an invoice
router.post("/:id/send-reminder", authenticateUser, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { reminder_type = "both", custom_message } = req.body;

    // Get invoice with client info
    const invoice = await invoiceDb.getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    const client = await invoiceDb.getClientById(invoice.client_id);
    const clientName = client.is_business
      ? client.company_name
      : `${client.first_name} ${client.last_name}`;

    // Calculate days overdue
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));

    // Calculate balance due
    const payments = await invoiceDb.getInvoicePayments(invoiceId);
    const totalPaid = payments.reduce(
      (sum, payment) => sum + parseFloat(payment.payment_amount),
      0
    );
    const balanceDue = invoice.total_amount - totalPaid;

    const viewLink = `${
      process.env.FRONTEND_URL || "https://gudinocustom.com"
    }/invoice/${invoice.public_token}`;

    let emailSuccess = true;
    let smsSuccess = true;

    // Send email reminder
    if (reminder_type === "email" || reminder_type === "both") {
      try {
        const emailMessage =
          custom_message ||
          `This is a friendly reminder that your invoice is ${
            daysOverdue > 0
              ? `${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`
              : "due soon"
          }.`;

        await emailTransporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: client.email,
          subject: `Payment Reminder - Invoice ${invoice.invoice_number
            .split("-")
            .pop()}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #f59e0b; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">Payment Reminder</h1>
              </div>
              
              <div style="padding: 30px; background: #f8fafc;">
                <h2 style="color: #1e3a8a; margin-top: 0;">Invoice ${invoice.invoice_number
                  .split("-")
                  .pop()}</h2>
                
                <p>Dear ${clientName},</p>
                
                <p>${emailMessage}</p>
                
                <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Invoice Details:</strong></p>
                  <p><strong>Invoice Number:</strong> ${invoice.invoice_number
                    .split("-")
                    .pop()}</p>
                  <p><strong>Original Due Date:</strong> ${new Date(
                    invoice.due_date
                  ).toLocaleDateString()}</p>
                  <p><strong>Amount Due:</strong> $${balanceDue.toFixed(2)}</p>
                  ${
                    daysOverdue > 0
                      ? `<p style="color: #dc2626;"><strong>Days Overdue:</strong> ${daysOverdue}</p>`
                      : ""
                  }
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${viewLink}" 
                     style="background-color: #1e3a8a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    View Invoice & Pay Online
                  </a>
                </div>
                
                <p>Please contact us if you have any questions about this invoice.</p>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #6b7280; font-size: 14px;">
                  <p>Gudino Custom Cabinets</p>
                  <p>Email: ${process.env.ADMIN_EMAIL}</p>
                  <p>Phone: ${process.env.ADMIN_PHONE || "(509) 790-3516"}</p>
                </div>
              </div>
            </div>
          `,
        });
      } catch (error) {
        console.error("Email reminder failed:", error);
        emailSuccess = false;
      }
    }

    // Send SMS reminder
    if (
      (reminder_type === "sms" || reminder_type === "both") &&
      client.phone &&
      twilioClient
    ) {
      try {
        const smsMessage = custom_message
          ? `Payment reminder: ${custom_message} Invoice ${invoice.invoice_number
              .split("-")
              .pop()} - $${balanceDue.toFixed(2)} due. View: ${viewLink}`
          : `Payment reminder: Invoice ${invoice.invoice_number
              .split("-")
              .pop()} is ${
              daysOverdue > 0
                ? `${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue`
                : "due"
            } - $${balanceDue.toFixed(2)}. View: ${viewLink}`;

        const smsOptions = {
          body: smsMessage,
          to: client.phone,
        };

        if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
          smsOptions.messagingServiceSid =
            process.env.TWILIO_MESSAGING_SERVICE_SID;
        } else if (process.env.TWILIO_PHONE_NUMBER) {
          smsOptions.from = process.env.TWILIO_PHONE_NUMBER;
        }

        await twilioClient.messages.create(smsOptions);
      } catch (error) {
        console.error("SMS reminder failed:", error);
        smsSuccess = false;
      }
    }

    // Log the reminder attempt
    await invoiceDb.logReminder({
      invoice_id: invoiceId,
      reminder_type,
      days_overdue: daysOverdue,
      sent_by: req.user.id,
      message:
        custom_message ||
        `${daysOverdue > 0 ? "Overdue" : "Due"} payment reminder`,
      successful: emailSuccess && smsSuccess,
    });

    res.json({
      success: true,
      emailSent:
        reminder_type === "email" || reminder_type === "both"
          ? emailSuccess
          : null,
      smsSent:
        reminder_type === "sms" || reminder_type === "both" ? smsSuccess : null,
    });
  } catch (error) {
    console.error("Error sending reminder:", error);
    res.status(500).json({ error: "Failed to send reminder" });
  }
});
// Admin endpoint - Get reminder history for an invoice
router.get("/:id/reminder-history", authenticateUser, async (req, res) => {
  try {
    const history = await invoiceDb.getReminderHistory(req.params.id);
    res.json(history);
  } catch (error) {
    console.error("Error getting reminder history:", error);
    res.status(500).json({ error: "Failed to get reminder history" });
  }
});
module.exports = router;
