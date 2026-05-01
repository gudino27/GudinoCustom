// RECEIPT PDF GENERATOR UTILITY
const puppeteer = require('puppeteer');
const { invoiceDb } = require('../db-helpers');

// Generate receipt PDF for a payment
async function generateReceiptPdf(paymentId, language = 'en') {
  try {
    // Get payment details
    const payment = await invoiceDb.getPaymentById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // Get invoice details
    const invoice = await invoiceDb.getInvoiceById(payment.invoice_id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Get client details
    const client = await invoiceDb.getClientById(invoice.client_id);
    if (!client) {
      throw new Error('Client not found');
    }

    const clientName = client.is_business
      ? client.company_name
      : `${client.first_name} ${client.last_name}`;

    // Translations
    const translations = {
      en: {
        receiptTitle: 'Payment Receipt',
        receiptFor: 'Receipt for',
        invoiceNumber: 'Invoice Number',
        paymentDate: 'Payment Date',
        paymentMethod: 'Payment Method',
        amountPaid: 'Amount Paid',
        invoiceTotal: 'Invoice Total',
        remainingBalance: 'Remaining Balance',
        paidInFull: 'Paid in Full',
        partialPayment: 'Partial Payment',
        thankYou: 'Thank you for your payment!',
        questions: 'If you have any questions about this receipt, please contact us.',
        companyName: 'Gudino Custom Woodworking'
      },
      es: {
        receiptTitle: 'Recibo de Pago',
        receiptFor: 'Recibo para',
        invoiceNumber: 'Número de Factura',
        paymentDate: 'Fecha de Pago',
        paymentMethod: 'Método de Pago',
        amountPaid: 'Monto Pagado',
        invoiceTotal: 'Total de Factura',
        remainingBalance: 'Saldo Restante',
        paidInFull: 'Pagado Completo',
        partialPayment: 'Pago Parcial',
        thankYou: '¡Gracias por su pago!',
        questions: 'Si tiene alguna pregunta sobre este recibo, contáctenos.',
        companyName: 'Gudino Custom Woodworking'
      }
    };

    const t = translations[language] || translations.en;

    // Calculate remaining balance
    const allPayments = await invoiceDb.getInvoicePayments(invoice.id);
    const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.payment_amount), 0);
    const remainingBalance = parseFloat(invoice.total_amount) - totalPaid;
    const isPaidInFull = remainingBalance <= 0;

    // Read logo
    const fs = require('fs');
    const path = require('path');
    let logoBase64 = '';
    try {
      const logoPath = path.join(__dirname, '..', 'uploads', 'logo.jpeg');
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
      console.log('Logo not found for receipt');
    }

    // Format payment method for display
    const formatPaymentMethod = (method) => {
      const methods = {
        'cash': language === 'es' ? 'Efectivo' : 'Cash',
        'check': language === 'es' ? 'Cheque' : 'Check',
        'credit-card': language === 'es' ? 'Tarjeta de Crédito' : 'Credit Card',
        'debit-card': language === 'es' ? 'Tarjeta de Débito' : 'Debit Card',
        'bank-transfer': language === 'es' ? 'Transferencia Bancaria' : 'Bank Transfer',
        'other': language === 'es' ? 'Otro' : 'Other'
      };
      return methods[method] || method;
    };

    // Generate HTML for receipt
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${language}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${t.receiptTitle} - ${payment.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #000000; background: rgb(110, 110, 110); }
          .receipt-container { max-width: 600px; margin: 40px auto; padding: 40px; background: white; }
          .receipt-header { text-align: center; margin-bottom: 40px; border-bottom: 3px solid #000000; padding-bottom: 10px; }
          .company-logo { width: 200px; margin-bottom: 5px; }
          .company-info { font-size: 14px; color: #000000; margin-bottom: 10px; }
          .receipt-title { font-size: 32px; font-weight: bold; color: #000000; margin: 10px 0; }
          .receipt-status { display: inline-block; padding: 8px; border-radius: 10px; font-weight: bold; font-size: 14px; margin-top: 5px; }
          .receipt-status.paid { background: #dcfce7; color: #000000; }
          .receipt-status.partial { background: #fef3c7; color: #000000; }
          .client-section { margin-bottom: 15px; }
          .section-title { font-size: 18px; font-weight: bold; color: #000000; margin-bottom: 10px; }
          .info-row { display: flex; justify-content: space-between; padding: 3px; border-bottom: 1px solid #e5e7eb; }
          .info-label { font-weight: 600; color: #000000; }
          .info-value { color: #000000; }
          .payment-section { background: #f3f4f6; padding: 10px; border-radius: 8px; margin: 5px 0; }
          .amount-paid { font-size: 36px; font-weight: bold; color: #000000; text-align: center; margin: 5px 0; }
          .balance-info { background: white; padding: 5px; border-radius: 8px; margin-top: 5px; }
          .footer { text-align: center; margin-top: 5px; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #000000; font-size: 14px; }
          .thank-you { font-size: 18px; font-weight: 600; color: #000000; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="receipt-header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Company Logo" class="company-logo">` : ''}
            <div class="company-info">
              Phone: (509) 515-4090<br>
              Email: admin@gudinocustom.com<br>
              70 Ray Rd , Sunnyside, WA 98944
            </div>
            <div class="receipt-title">${t.receiptTitle}</div>
            <div class="receipt-status ${isPaidInFull ? 'paid' : 'partial'}">
              ${isPaidInFull ? t.paidInFull : t.partialPayment}
            </div>
          </div>

          <div class="client-section">
            <div class="section-title">${t.receiptFor}</div>
            <div class="info-row">
              <span class="info-label">${language === 'es' ? 'Cliente' : 'Client'}:</span>
              <span class="info-value">${clientName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t.invoiceNumber}:</span>
              <span class="info-value">${invoice.invoice_number.split('-').pop()}</span>
            </div>
          </div>

          <div class="payment-section">
            <div class="section-title" style="text-align: center; color: #000000; margin-bottom: 5px;">
              ${language === 'es' ? 'Detalles del Pago' : 'Payment Details'}
            </div>

            <div class="amount-paid">$${parseFloat(payment.payment_amount).toFixed(2)}</div>

            <div class="info-row">
              <span class="info-label">${t.paymentDate}:</span>
              <span class="info-value">${new Date(payment.payment_date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t.paymentMethod}:</span>
              <span class="info-value">${formatPaymentMethod(payment.payment_method)}</span>
            </div>
            ${payment.transaction_id ? `
            <div class="info-row">
              <span class="info-label">${language === 'es' ? 'ID de Transacción' : 'Transaction ID'}:</span>
              <span class="info-value">${payment.transaction_id}</span>
            </div>
            ` : ''}
            ${payment.notes ? `
            <div class="info-row">
              <span class="info-label">${language === 'es' ? 'Notas' : 'Notes'}:</span>
              <span class="info-value">${payment.notes}</span>
            </div>
            ` : ''}

            <div class="balance-info">
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">${t.invoiceTotal}:</span>
                <span class="info-value">$${parseFloat(invoice.total_amount).toFixed(2)}</span>
              </div>
              <div class="info-row" style="border-bottom: none;">
                <span class="info-label">${language === 'es' ? 'Total Pagado' : 'Total Paid'}:</span>
                <span class="info-value">$${totalPaid.toFixed(2)}</span>
              </div>
              <div class="info-row" style="border-bottom: none; padding-top: 5px; border-top: 2px solid #e5e7eb;">
                <span class="info-label" style="font-size: 18px;">${t.remainingBalance}:</span>
                <span class="info-value" style="font-size: 18px; font-weight: bold; color: #000000;">
                  $${Math.max(0, remainingBalance).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="thank-you">${t.thankYou}</div>
            <p>${t.questions}</p>
            <p style="color: rgba(110, 110, 110, 1);">admin@gudinocustom.com | (509) 515-4090</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // PDF options
    const options = {
      format: 'A4',
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      printBackground: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    };

    const browser = await puppeteer.launch({
      args: options.args || [],
      executablePath: options.executablePath || undefined,
      headless: true
    });
    let pdfBuffer;
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        margin: options.margin || options.border,
        printBackground: options.printBackground !== false,
        landscape: options.orientation === 'landscape'
      });
    } finally {
      await browser.close();
    }

    return pdfBuffer;
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    throw error;
  }
}

module.exports = {
  generateReceiptPdf
};
