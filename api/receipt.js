const { jsPDF } = require('jspdf');
require('jspdf-autotable');

// Chinese font - Noto Sans SC (subset, minimal version for basic characters)
// Using a simple approach: we'll use system fonts or fallback
// For Vercel, we'll use html2canvas + jsPDF approach which supports Chinese

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

    const rgb = hexToRgb(themeColor);
    const getCurrencySymbol = (curr) => {
      const symbols = { 'HKD': '$', 'USD': '$', 'EUR': '€', 'GBP': '£', 'CNY': '¥', 'JPY': '¥' };
      return symbols[curr] || curr || '$';
    };
    const currencySymbol = getCurrencySymbol(currency);
    const formatCurrency = (amount) => currencySymbol + parseFloat(amount).toFixed(2);

    // Generate HTML content for each receipt
    const htmlContents = receipts.map((receipt, index) => {
      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;
      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + taxAmount;

      return generateHTML({
        companyName,
        companyAddress,
        contactPerson,
        others,
        receiptNo,
        date,
        clientName,
        clientAddress,
        items,
        type,
        subtotal,
        taxAmount,
        total,
        taxEnabled,
        taxName,
        taxRate,
        themeColor,
        logoData,
        tc,
        pageNum: index + 1,
        totalPages: receipts.length,
        template,
        formatCurrency
      });
    });

    // For Chinese support, we need to return HTML that can be converted client-side
    // Or we can try using a font embedding approach

    // Create PDF with basic ASCII support - Chinese characters will be handled as placeholders
    // The actual Chinese support requires client-side rendering

    // For full Chinese support, we'll return a special response indicating HTML output
    const useHtmlOutput = [companyName, companyAddress, contactPerson, others, tc, ...receipts.map(r => r.clientName + r.clientAddress + r.items.map(i => i.description).join(''))].some(str =>
      /[\u4e00-\u9fff]/.test(str)
    );

    if (useHtmlOutput) {
      // Return HTML for client-side conversion to PDF
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <style>
    body { font-family: "Microsoft JhengHei", "PingFang SC", "Noto Sans SC", sans-serif; }
    .receipt-page { width: 210mm; min-height: 297mm; padding: 20mm; background: white; margin: 0 auto; }
  </style>
</head>
<body>
${htmlContents.join('\n')}
<script>
  // Auto-generate PDF if requested
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('download') === 'pdf') {
    // Handle PDF download
    window.print();
  }
</script>
</body>
</html>`);
    }

    // For non-Chinese content, use standard PDF generation
    const doc = new jsPDF();

    for (let i = 0; i < receipts.length; i++) {
      if (i > 0) doc.addPage();
      const receipt = receipts[i];
      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;
      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + taxAmount;

      renderPDF(doc, {
        companyName, companyAddress, contactPerson, others,
        receiptNo, date, clientName, clientAddress, items, type,
        subtotal, taxAmount, total, taxEnabled, taxName, taxRate,
        themeColor, rgb, formatCurrency, logoData, tc,
        pageNum: i + 1, totalPages: receipts.length, template
      });
    }

    const pdfBuffer = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipts.pdf"`);
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};

function generateHTML(data) {
  const {
    companyName, companyAddress, contactPerson, others,
    receiptNo, date, clientName, clientAddress, items, type,
    subtotal, taxAmount, total, taxEnabled, taxName, taxRate,
    themeColor, logoData, tc, pageNum, totalPages, template, formatCurrency
  } = data;

  const itemsHtml = items.map(item => `
    <tr>
      <td style="text-align:center;padding:10px;border-bottom:1px solid #e2e8f0;">${item.qty || 0}</td>
      <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${item.description || ''}</td>
      <td style="text-align:right;padding:10px;border-bottom:1px solid #e2e8f0;">${formatCurrency(item.unitCost || 0)}</td>
      <td style="text-align:right;padding:10px;border-bottom:1px solid #e2e8f0;">${formatCurrency(item.amount || 0)}</td>
    </tr>
  `).join('');

  let taxRowHtml = '';
  if (taxEnabled && taxAmount > 0) {
    taxRowHtml = `
      <tr>
        <td colspan="3" style="text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;">${taxName} (${taxRate}%)</td>
        <td style="text-align:right;padding:8px 10px;border-bottom:1px solid #e2e8f0;">${formatCurrency(taxAmount)}</td>
      </tr>
    `;
  }

  const stampHtml = '';

  const totalBox = `
    <div style="background:${themeColor};color:white;padding:15px 20px;border-radius:6px;margin-top:15px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:14pt;font-weight:600;">TOTAL</span>
      <span style="font-size:18pt;font-weight:700;">${formatCurrency(total)}</span>
    </div>
  `;

  const tcHtml = tc ? `
    <div style="margin-top:25px;font-size:8pt;color:#4a5568;border-top:1px solid #e2e8f0;padding-top:10px;">
      <strong>Terms & Conditions:</strong><br>${tc.replace(/\n/g, '<br>')}
    </div>
  ` : '';

  // Classic template HTML
  return `
    <div class="receipt-page" style="font-family: 'Microsoft JhengHei', 'PingFang SC', 'Noto Sans SC', sans-serif;">
      <div style="background:linear-gradient(135deg,${themeColor},${themeColor});padding:20px;margin:-20mm -20mm 20px -20mm;text-align:center;">
        <h1 style="margin:0;font-size:20pt;color:white;font-weight:600;">${companyName}</h1>
        ${companyAddress ? `<p style="margin:5px 0;color:#e2e8f0;font-size:10pt;">${companyAddress}</p>` : ''}
        ${contactPerson ? `<p style="margin:5px 0;color:#e2e8f0;font-size:9pt;">${contactPerson}</p>` : ''}
        ${others ? `<p style="margin:5px 0;color:#cbd5e0;font-size:8pt;">${others}</p>` : ''}
      </div>
      <div style="text-align:center;margin:15px 0;border:2px solid ${themeColor};padding:15px;border-radius:8px;">
        <h2 style="margin:0;font-size:16pt;color:${themeColor};font-weight:700;">${type.toUpperCase()}</h2>
        <h3 style="margin:5px 0;font-size:11pt;color:#4a5568;">TAX INVOICE / RECEIPT</h3>
      </div>
      <div style="display:flex;margin:15px 0;font-size:10pt;background:#f7fafc;padding:15px;border-radius:6px;border-left:4px solid ${themeColor};">
        <div style="flex:1;">
          <div style="color:${themeColor};font-weight:700;margin-bottom:8px;font-size:9pt;">FROM</div>
          <strong>${companyName}</strong><br>
          <span style="color:#4a5568;">${companyAddress || ''}</span>
        </div>
        <div style="flex:1;border-left:1px solid #e2e8f0;padding-left:15px;">
          <div style="color:${themeColor};font-weight:700;margin-bottom:8px;font-size:9pt;">BILL TO</div>
          <strong>${clientName}</strong><br>
          <span style="color:#4a5568;">${clientAddress || ''}</span>
        </div>
      </div>
      <div style="margin:15px 0;font-size:10pt;background:#edf2f7;padding:10px 15px;border-radius:4px;display:flex;justify-content:space-between;">
        <span><strong>Invoice No:</strong> <span style="color:${themeColor};">${receiptNo}</span></span>
        <span><strong>Date:</strong> <span style="color:${themeColor};">${date}</span></span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:10pt;margin:10px 0;">
        <thead>
          <tr style="background:${themeColor};color:white;">
            <th style="padding:12px;text-align:center;">Qty</th>
            <th style="padding:12px;text-align:left;">Description</th>
            <th style="padding:12px;text-align:right;">Unit Price</th>
            <th style="padding:12px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}${taxRowHtml}</tbody>
      </table>
      ${totalBox}
      ${stampHtml}
      ${tcHtml}
      <div style="text-align:center;font-size:8pt;color:#888;margin-top:20px;">
        Page ${pageNum} of ${totalPages}
      </div>
    </div>
  `;
}

function renderPDF(doc, data) {
  const { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, taxAmount, total, taxEnabled, taxName, taxRate, themeColor, rgb, formatCurrency, logoData, tc, pageNum, totalPages } = data;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (companyAddress) doc.text(companyAddress, pageWidth / 2, 26, { align: 'center' });
  if (contactPerson) doc.text(contactPerson, pageWidth / 2, 32, { align: 'center' });
  if (others) doc.text(others, pageWidth / 2, 38, { align: 'center' });

  y = 55;

  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(1);
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'S');

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(type.toUpperCase(), pageWidth / 2, y + 10, { align: 'center' });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(11);
  doc.text('TAX INVOICE / RECEIPT', pageWidth / 2, y + 18, { align: 'center' });

  y += 35;

  doc.setFillColor(247, 250, 252);
  doc.roundedRect(15, y, pageWidth - 30, 30, 2, 2, 'F');

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FROM', 20, y + 8);

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 20, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (companyAddress) doc.text(doc.splitTextToSize(companyAddress, 70), 20, y + 21);

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', pageWidth / 2 + 5, y + 8);

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(clientName || '-', pageWidth / 2 + 5, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (clientAddress) doc.text(doc.splitTextToSize(clientAddress, 70), pageWidth / 2 + 5, y + 21);

  y += 40;

  doc.setFillColor(237, 242, 247);
  doc.rect(15, y, pageWidth - 30, 12, 'F');

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No:`, 20, y + 8);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text(receiptNo || '-', 50, y + 8);

  doc.setTextColor(50, 50, 50);
  doc.text(`Date:`, pageWidth - 60, y + 8);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text(date || '-', pageWidth - 40, y + 8);

  y += 15;

  const tableData = items.map(item => [item.qty || 0, item.description || '-', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)]);
  if (taxEnabled && taxAmount > 0) {
    tableData.push(['', '', taxName + ' (' + taxRate + '%)', formatCurrency(taxAmount)]);
  }

  doc.autoTable({
    startY: y,
    head: [['Qty', 'Description', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } },
    margin: { left: 15, right: 15 }
  });

  y = doc.lastAutoTable.finalY + 10;

  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.roundedRect(pageWidth - 95, y, 80, 20, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', pageWidth - 85, y + 13);
  doc.setFontSize(16);
  doc.text(formatCurrency(total), pageWidth - 25, y + 13, { align: 'right' });

  y += 30;

  if (tc) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(tc, pageWidth - 30), 15, y);
  }

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 59, g: 130, b: 246 };
}
