// PDF GENERATION UTILITIES 
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { invoiceDb } = require("../db-helpers");

// Low-level PDF generation with retry mechanism
async function generatePdfWithRetry(htmlContent, options, maxRetries = 3) {
  let pdfBuffer;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`PDF generation attempt ${attempt}/${maxRetries}...`);
      const browser = await puppeteer.launch({
        args: options.args || [],
        executablePath: options.executablePath || undefined,
        headless: true
      });
      try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: options.timeout || 30000 });
        pdfBuffer = await page.pdf({
          format: options.format || 'A4',
          margin: options.margin || options.border,
          printBackground: options.printBackground !== false,
          landscape: options.orientation === 'landscape'
        });
      } finally {
        await browser.close();
      }
      console.log(
        `PDF generated successfully on attempt ${attempt}, size: ${pdfBuffer.length} bytes`
      );
      return pdfBuffer;
    } catch (error) {
      lastError = error;
      console.error(`PDF generation attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        const delay = attempt * 2000; // 2s, 4s delays
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `PDF generation failed after ${maxRetries} attempts. Last error: ${lastError.message}`
  );
}
// Translation helper for invoices (English/Spanish)
function getInvoiceTranslations(language = "english") {
  const translations = {
    english: {
      subject: "Invoice from Gudino Custom Cabinets",
      greeting: "Hello",
      invoiceTitle: "Invoice",
      billTo: "Bill To",
      description: "Description",
      quantity: "Qty",
      unitPrice: "Unit Price",
      total: "Total",
      subtotal: "Subtotal",
      discount: "Discount",
      markup: "Markup",
      tax: "Tax",
      grandTotal: "Total",
      amountPaid: "Amount Paid",
      remainingBalance: "Remaining Balance",
      dueDate: "Due Date",
      invoiceDate: "Invoice Date",
      paymentHistory: "Payment History",
      notes: "Notes",
      thankYou: "Thank you for your business!",
      questions:
        "If you have any questions about this invoice, please contact us",
      viewOnline: "View Invoice Online",
      companyName: "Gudino Custom Cabinets",
    },
    spanish: {
      subject: "Factura de Gudino Custom Cabinets",
      greeting: "Hola",
      invoiceTitle: "Factura",
      billTo: "Facturar a",
      description: "Descripción",
      quantity: "Cant.",
      unitPrice: "Precio Unitario",
      total: "Total",
      subtotal: "Subtotal",
      discount: "Descuento",
      markup: "Margen",
      tax: "Impuesto",
      grandTotal: "Total",
      amountPaid: "Cantidad Pagada",
      remainingBalance: "Saldo Pendiente",
      dueDate: "Fecha de Vencimiento",
      invoiceDate: "Fecha de Factura",
      paymentHistory: "Historial de Pagos",
      notes: "Notas",
      thankYou: "¡Gracias por su negocio!",
      questions:
        "Si tiene alguna pregunta sobre esta factura, por favor contáctenos",
      viewOnline: "Ver Factura en Línea",
      companyName: "Gudino Custom Cabinets",
    },
  };

  return translations[language] || translations.english;
}
// High-level invoice PDF generator with full HTML template
async function generateInvoicePdf(invoiceId, language = "english") {
  // Get translations for the specified language
  const t = getInvoiceTranslations(language);

  // Get invoice details with client info and line items
  const invoice = await invoiceDb.getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const client = await invoiceDb.getClientById(invoice.client_id);
  if (!client) {
    throw new Error("Client not found");
  }

  // Get tax rate information to display city name
  const taxRateInfo = await invoiceDb.getTaxRateByRate(invoice.tax_rate);

  const lineItems = await invoiceDb.getInvoiceLineItems(invoiceId);

  const clientName = client.is_business
    ? client.company_name
    : `${client.first_name} ${client.last_name}`;

  const clientAddress = client.address || "";
  const payments = await invoiceDb.getInvoicePayments(invoiceId);
  const totalPaid = payments.reduce(
    (sum, payment) => sum + parseFloat(payment.payment_amount),
    0
  );
  const balanceDue = invoice.total_amount - totalPaid;

  // Create Google Maps link for company address
  const companyAddress = "70 Ray Rd, Sunnyside, WA 98944";
  const googleMapsLink = `https://maps.google.com/?q=${encodeURIComponent(
    companyAddress
  )}`;
  // Read logo file and convert to base64
  const fs = require("fs");
  const path = require("path");
  let logoBase64 = "";
  let logoError = "";
  try {
    const logoPath = path.join(__dirname, "..", "uploads", "logo.jpeg");
    console.log("Looking for logo at:", logoPath);
    console.log("Logo file exists:", fs.existsSync(logoPath));

    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;
      console.log(
        "Logo loaded successfully, size:",
        logoBuffer.length,
        "bytes"
      );
    } else {
      logoError = "Logo file not found at path";
    }
  } catch (error) {
    console.log("Logo file error:", error.message);
    logoError = error.message;
  }

  // Generate HTML content using professional template with language support
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="${language === "spanish" ? "es" : "en"}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${clientName} - ${invoice.invoice_number.split("-").pop()}</title>
      <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: rgba(110, 110, 110, 0.1); }
          .invoice-container { max-width: 800px; margin: 0 auto; padding: 40px; background: rgba(110, 110, 110, 0.1); }
          .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid rgba(110, 110, 110, 1); padding-bottom: 30px; }
          .company-info { flex: 1; display: flex; align-items: flex-start; gap: 20px; }
          .company-logo { width: 300px;  object-fit: contain; flex-shrink: 0; }
          .company-text { flex: 1; }
          .company-name { font-size: 28px; font-weight: bold; color: rgba(0, 0, 0, 1); margin-bottom: 10px; }
          .company-details { font-size: 14px; color: rgba(0, 0, 0, 1); line-height: 1.5; }
          .invoice-title { font-size: 48px; font-weight: bold; color: rgba(0, 0, 0, 1); text-align: right; margin-bottom: 20px; }
          .invoice-meta { text-align: right; font-size: 14px; color: rgba(0, 0, 0, 1); }
          .billing-info { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 40px; }
          .bill-to, .invoice-details { flex: 1; }
          .section-title { font-size: 18px; font-weight: bold; color: rgba(0, 0, 0, 1); margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
          .bill-to-content, .invoice-details-content { font-size: 14px; line-height: 1.6; color: rgba(0, 0, 0, 1); }
          .line-items { margin-bottom: 20px; }
          .line-items table { width: 100%; border-collapse: collapse; font-size: 14px; }
          .line-items th { background-color: rgba(110, 110, 110, 1); color: #000000ff; font-weight: bold; padding: 12px; border: 0.25px solid #000000ff; text-align: left; }
          .line-items td { background-color: rgba(110,110,110,0.15);padding: 12px; border: 0.5px solid #000000ff; vertical-align: top; }
          .line-items .text-center { text-align: center; }
          .line-items .text-right { text-align: right; }
          .item-title { font-weight: 600; margin-bottom: 5px; color: #1f2937; }
          .item-description { color: #4b5563; }
          .totals { margin-left: auto; width: 300px; margin-bottom: 40px; }
          .totals table { width: 100%; font-size: 14px; border-collapse: collapse; }
          .totals td {
            padding: 12px 15px;
            background-color: rgba(110, 110, 110, 0.15);
            border: 1px solid #000000ff;
            border-collapse: collapse;
          }
          .totals .total-row {
            font-weight: bold;
            font-size: 16px;
            background-color: rgba(110, 110, 110, 0.75) !important;
            border-top: 2px solid #000000ff;
            border-bottom: 2px solid #000000ff;
          }
          .totals .text-right { text-align: right; }
          .notes { margin-bottom: 20px; }
          .notes-content { background-color: #f9fafb; padding: 20px; border-left: 4px solid rgba(110, 110, 110, 1); font-size: 14px; line-height: 1.6; }
          .footer { text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="invoice-header">
          <div class="company-info">
            <div class="company-text">
               ${
                 logoBase64
                   ? `<img src="${logoBase64}" alt="Company Logo" class="company-logo">`
                   : `<div style="width: 100px; height: 100px; color: white; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center;">NO LOGO</div>`
               }
              <div class="company-details">
                Phone: (509) 515-4090<br>
                Email: admin@gudinocustom.com<br>
                <a href="${googleMapsLink}" target="_blank">${companyAddress}</a>
              </div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="invoice-title">${t.invoiceTitle.toUpperCase()}</div>
            <div class="invoice-meta">
              <strong>${t.invoiceTitle} #:</strong> ${
    invoice.invoice_number.split("2025-")[1]
  }<br>
              <strong>${t.invoiceDate}:</strong> ${new Date(
    invoice.invoice_date
  ).toLocaleDateString()}<br>
              <strong>${t.dueDate}:</strong> ${new Date(
    invoice.due_date
  ).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div class="billing-info">
          <div class="bill-to">
            <div class="section-title">${t.billTo}</div>
            <div class="bill-to-content">
              <strong>${clientName}</strong><br>
              ${client.email ? `${client.email}<br>` : ""}
              ${client.phone ? `${client.phone}<br>` : ""}
              ${
                client.tax_exempt_number
                  ? `<br><em>Tax Exempt #: ${client.tax_exempt_number}</em>`
                  : ""
              }
            </div>
          </div>
          <div class="invoice-details">
            <div class="section-title">${t.invoiceTitle} Details</div>
            <div class="invoice-details-content">
              <strong>Status:</strong> ${
                invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
              }<br>
              <strong>Project Type:</strong> ${
                client.is_business ? "Commercial" : "Residential"
              }<br>
              <strong>Service address:</strong>
              ${clientAddress ? `${clientAddress}<br>` : ""}
            </div>
          </div>
        </div>

        <div class="line-items">
          <table>
            <thead>
              <tr>
                <th>Item(s)</th>
                <th class="text-center">${t.quantity}</th>
                <th class="text-right">Rate</th>
                <th class="text-right">${t.total}</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems
                .map((item) => {
                  let formattedDescription = item.description || "";
                  if (formattedDescription.includes("-")) {
                    const listItems = formattedDescription
                      .split("-")
                      .map((text) => text.trim())
                      .filter((text) => text.length > 0)
                      .map((text) => `<li>${text}</li>`)
                      .join("");
                    formattedDescription = `<ul style="margin: 5px 0; padding-left: 20px;">${listItems}</ul>`;
                  }
                  return `
                <tr>
                  <td>
                    ${
                      item.title
                        ? `<div class="item-title">${item.title}</div>`
                        : ""
                    }
                    <div class="item-description">${formattedDescription}</div>
                  </td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-right">$${(item.unit_price || 0).toFixed(
                    2
                  )}</td>
                  <td class="text-right">$${(
                    (item.quantity || 0) * (item.unit_price || 0)
                  ).toFixed(2)}</td>
                </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div class="totals">
          <table>
            <tr>
              <td>${t.subtotal}:</td>
              <td class="text-right">$${(invoice.subtotal || 0).toFixed(2)}</td>
            </tr>
            ${
              (invoice.discount_amount || 0) > 0
                ? `
            <tr>
              <td>${t.discount}:</td>
              <td class="text-right">-$${(invoice.discount_amount || 0).toFixed(
                2
              )}</td>
            </tr>
            `
                : ""
            }
            ${
              (invoice.markup_amount || 0) > 0
                ? `
            <tr>
              <td>${t.markup}:</td>
              <td class="text-right">$${(invoice.markup_amount || 0).toFixed(
                2
              )}</td>
            </tr>
            `
                : ""
            }
            <tr>
              <td>${t.tax}${
    taxRateInfo?.city
      ? `: ${
          taxRateInfo.city.charAt(0).toUpperCase() + taxRateInfo.city.slice(1)
        }`
      : ""
  } (${(invoice.tax_rate || 0).toFixed(2)}%):</td>
              <td class="text-right">$${(invoice.tax_amount || 0).toFixed(
                2
              )}</td>
            </tr>
            <tr class="total-row">
              <td><strong>${t.grandTotal}:</strong></td>
              <td class="text-right"><strong>$${(
                invoice.total_amount || 0
              ).toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>

        ${
          invoice.notes
            ? `
        <div class="notes">
          <div class="section-title">${t.notes}</div>
          <div class="notes-content">${invoice.notes}</div>
        </div>
        `
            : ""
        }

        <div class="footer">
          ${t.thankYou}<br>
          ${t.questions} admin@gudinocustom.com ${
    language === "spanish" ? "o" : "or"
  } (509) 515-4090
        </div>
      </div>
    </body>
    </html>`;

  // PDF generation options with Docker container support
  const options = {
    format: "A4",
    border: {
      top: "0.5in",
      right: "0.5in",
      bottom: "0.5in",
      left: "0.5in",
    },
    paginationOffset: 1,
    type: "pdf",
    quality: "75",
    orientation: "portrait",
    timeout: 30000,
    // Puppeteer options for Docker containers
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  };

  // Generate PDF with error handling
  try {
    console.log("Generating PDF for email attachment...");
    const pdfBuffer = await generatePdfWithRetry(htmlContent, options);

    // Validate PDF buffer
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("Generated PDF buffer is empty");
    }

    console.log(
      `PDF generated successfully for email, size: ${pdfBuffer.length} bytes`
    );
    return pdfBuffer;
  } catch (pdfError) {
    console.error("PDF generation error in generateInvoicePdf:", pdfError);
    console.error("HTML content length:", htmlContent.length);
    throw new Error(`PDF generation failed: ${pdfError.message}`);
  }
}
// EXPORTS
module.exports = {
  generatePdfWithRetry,       // Low-level retry wrapper
  generateInvoicePdf,         // High-level invoice PDF with template
  getInvoiceTranslations      // Translation helper (exported for email functions)
};

// NOTES:
// - generatePdfWithRetry: Generic function, works with any HTML + options
// - generateInvoicePdf: Invoice-specific, fetches data from DB and generates PDF
// - getInvoiceTranslations: Returns English/Spanish text for invoice templates
//
// The generateInvoicePdf function:
//   1. Fetches invoice data from database
//   2. Gets translations via getInvoiceTranslations()
//   3. Builds HTML template with invoice data
//   4. Calls generatePdfWithRetry() to generate PDF buffer
//   5. Returns the PDF buffer
