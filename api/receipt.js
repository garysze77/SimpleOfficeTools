const html2canvas = require('html2canvas');
const { jsPDF } = require('jspdf');

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const {
      companyName,
      companyAddress = '',
      contactPerson = '',
      others = '',
      receipts = [],
      themeColor = '#3b82f6',
      template = 'classic',
      currency = '$',
      taxEnabled = false,
      taxRate = 0,
      taxName = 'Tax',
      logoData = null,
      tc = ''
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    if (!receipts || receipts.length === 0) {
      return res.status(400).json({ error: 'receipts array is required' });
    }

    // Currency symbol mapping
    const getCurrencySymbol = (curr) => {
      const symbols = { 'HKD': '$', 'USD': '$', 'EUR': '€', 'GBP': '£', 'CNY': '¥', 'JPY': '¥' };
      return symbols[curr] || curr || '$';
    };
    const currencySymbol = getCurrencySymbol(currency);
    const formatCurrency = (amount) => currencySymbol + parseFloat(amount).toFixed(2);

    // Generate HTML for all receipts
    const htmlContent = generatePDFHTML({
      receipts,
      companyName,
      companyAddress,
      contactPerson,
      others,
      themeColor,
      template,
      currencySymbol,
      formatCurrency,
      taxEnabled,
      taxRate,
      taxName,
      logoData,
      tc
    });

    // Create a mock DOM environment for html2canvas
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(`<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>`, {
      pretendToBeVisual: true,
      resources: 'usable'
    });

    const { window } = dom;
    global.document = window.document;
    global.navigator = window.navigator;
    global.HTMLElement = window.HTMLElement;
    global.Element = window.Element;
    global.Node = window.Node;
    global.DOMParser = window.DOMParser;

    // Write HTML content to document
    document.body.innerHTML = htmlContent;

    // Render each page and add to PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pages = document.querySelectorAll('.receipt-page');

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 794, // A4 at 96 DPI
        windowHeight: 1123
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (i > 0) {
        pdf.addPage();
      }

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    }

    // Generate PDF buffer
    const pdfBuffer = pdf.output('arraybuffer');

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipts.pdf"`);
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};

function generatePDFHTML(data) {
  const {
    receipts,
    companyName,
    companyAddress,
    contactPerson,
    others,
    themeColor,
    template,
    currencySymbol,
    formatCurrency,
    taxEnabled,
    taxRate,
    taxName,
    logoData,
    tc
  } = data;

  const receiptsHTML = receipts.map((receipt, index) => {
    const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;
    const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
    const total = subtotal + taxAmount;

    const itemsHtml = items.map((item, i) => `
      <tr style="${i % 2 === 0 ? 'background:#fff' : 'background:#f9fafb'}">
        <td style="text-align:center;padding:8px;border-bottom:1px solid #e2e8f0;">${item.qty || 0}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${item.description || ''}</td>
        <td style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">${formatCurrency(item.unitCost || 0)}</td>
        <td style="text-align:right;padding:8px;border-bottom:1px solid #e2e8f0;">${formatCurrency(item.amount || 0)}</td>
      </tr>
    `).join('');

    let taxRowHtml = '';
    if (taxEnabled && taxAmount > 0) {
      taxRowHtml = `
        <tr>
          <td colspan="3" style="text-align:right;padding:6px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:9pt;">${taxName} (${taxRate}%)</td>
          <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e2e8f0;">${formatCurrency(taxAmount)}</td>
        </tr>
      `;
    }

    return `
      <div class="receipt-page">
        ${getTemplateHTML({
          companyName, companyAddress, contactPerson, others,
          receiptNo, date, clientName, clientAddress,
          itemsHtml, taxRowHtml, subtotal, total,
          themeColor, type, template, logoData, tc,
          pageNum: index + 1, totalPages: receipts.length,
          formatCurrency
        })}
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Microsoft JhengHei", "PingFang SC", "Noto Sans SC", "WenQuanYi Micro Hei", "Heiti SC", sans-serif; }
    .receipt-page { width: 794px; min-height: 1123px; padding: 80px; background: white; }
  </style>
</head>
<body>
${receiptsHTML}
</body>
</html>
  `;
}

function getTemplateHTML(data) {
  const { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, itemsHtml, taxRowHtml, subtotal, total, themeColor, type, template, logoData, tc, pageNum, totalPages, formatCurrency } = data;

  const totalBox = `
    <div style="background:${themeColor};color:white;padding:12px 15px;border-radius:4px;margin-top:10px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12pt;font-weight:700;">TOTAL</span>
      <span style="font-size:16pt;font-weight:700;">${formatCurrency(total)}</span>
    </div>
  `;

  const tcHtml = tc ? `
    <div style="margin-top:20px;font-size:8pt;color:#4a5568;border-top:1px solid #e2e8f0;padding-top:10px;">
      <strong>Terms & Conditions:</strong><br>${tc.replace(/\n/g, '<br>')}
    </div>
  ` : '';

  return `
    <div style="background:${themeColor};padding:18px;margin:-80px -80px 18px -80px;">
      <h1 style="margin:0;font-size:18pt;color:white;font-weight:600;text-align:center;">${companyName}</h1>
      ${companyAddress ? `<p style="margin:4px 0;color:#e2e8f0;font-size:9pt;text-align:center;">${companyAddress}</p>` : ''}
      ${contactPerson ? `<p style="margin:4px 0;color:#e2e8f0;font-size:8pt;text-align:center;">${contactPerson}</p>` : ''}
      ${others ? `<p style="margin:4px 0;color:#cbd5e0;font-size:7pt;text-align:center;">${others}</p>` : ''}
    </div>
    <div style="text-align:center;margin:12px 0;border:2px solid ${themeColor};padding:12px;border-radius:6px;">
      <h2 style="margin:0;font-size:14pt;color:${themeColor};font-weight:700;">${type.toUpperCase()}</h2>
      <h3 style="margin:4px 0;font-size:10pt;color:#4a5568;">TAX INVOICE / RECEIPT</h3>
    </div>
    <div style="display:flex;margin:12px 0;font-size:9pt;background:#f7fafc;padding:12px;border-radius:4px;border-left:4px solid ${themeColor};">
      <div style="flex:1;">
        <div style="color:${themeColor};font-weight:700;margin-bottom:6px;font-size:8pt;text-transform:uppercase;">From</div>
        <strong>${companyName}</strong><br>
        <span style="color:#4a5568;">${companyAddress || ''}</span>
      </div>
      <div style="flex:1;border-left:1px solid #e2e8f0;padding-left:12px;">
        <div style="color:${themeColor};font-weight:700;margin-bottom:6px;font-size:8pt;text-transform:uppercase;">Bill To</div>
        <strong>${clientName}</strong><br>
        <span style="color:#4a5568;">${clientAddress || ''}</span>
      </div>
    </div>
    <div style="margin:12px 0;font-size:9pt;background:#edf2f7;padding:8px 12px;border-radius:4px;display:flex;justify-content:space-between;">
      <span><strong>Invoice No:</strong> <span style="color:${themeColor};">${receiptNo}</span></span>
      <span><strong>Date:</strong> <span style="color:${themeColor};">${date}</span></span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:9pt;margin:10px 0;">
      <thead>
        <tr style="background:${themeColor};color:white;">
          <th style="padding:10px;text-align:center;">Qty</th>
          <th style="padding:10px;text-align:left;">Description</th>
          <th style="padding:10px;text-align:right;">Unit Price</th>
          <th style="padding:10px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}${taxRowHtml}</tbody>
    </table>
    ${totalBox}
    ${tcHtml}
    <div style="text-align:center;font-size:8pt;color:#888;margin-top:15px;">
      Page ${pageNum} of ${totalPages}
    </div>
  `;
}