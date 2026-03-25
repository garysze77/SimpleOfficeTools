const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
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
      receipts = [],
      themeColor = '#3b82f6',
      currency = '$',
      taxEnabled = false,
      taxRate = 0,
      taxName = 'Tax',
      tc = ''
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    if (!receipts || receipts.length === 0) {
      return res.status(400).json({ error: 'receipts array is required' });
    }

    const getCurrencySymbol = (curr) => {
      const symbols = { 'HKD': '$', 'USD': '$', 'EUR': '€', 'GBP': '£', 'CNY': '¥', 'JPY': '¥' };
      return symbols[curr] || curr || '$';
    };
    const currencySymbol = getCurrencySymbol(currency);
    const formatCurrency = (amount) => currencySymbol + parseFloat(amount).toFixed(2);

    // Load Chinese font
    const fontPath = path.join(__dirname, '..', 'fonts', 'NotoSansCJKsc-Regular.otf');
    let hasChineseFont = false;
    try {
      if (fs.existsSync(fontPath)) {
        hasChineseFont = true;
      }
    } catch (e) {}

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margin: 40
    });

    if (hasChineseFont) {
      doc.registerFont('NotoSans', fontPath);
    }

    const font = hasChineseFont ? 'NotoSans' : 'Helvetica';

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // Page: 595.28 x 841.89 points
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    const contentWidth = pageWidth - 2 * margin; // 515

    // Table columns - 4 columns that sum to contentWidth
    const col1 = 50;   // Qty
    const col2 = 230;  // Description  
    const col3 = 110;  // Unit
    const col4 = 125;  // Amount
    // Total: 50+230+110+125 = 515 = contentWidth

    // Process each receipt
    receipts.forEach((receipt, idx) => {
      if (idx > 0) doc.addPage();

      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'INVOICE' } = receipt;

      let y = margin;

      // === HEADER BAR ===
      doc.rect(0, 0, pageWidth, 50).fill(themeColor);
      doc.fillColor('#ffffff').fontSize(18).font(font).text(companyName, margin, 10, { align: 'center', width: contentWidth });
      if (companyAddress) doc.fontSize(9).text(companyAddress, margin, 28, { align: 'center', width: contentWidth });
      if (contactPerson) doc.fontSize(8).text(contactPerson, margin, 38, { align: 'center', width: contentWidth });

      y = 60;

      // === TYPE BOX ===
      doc.rect(margin, y, contentWidth, 25).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(14).font(font).text(type.toUpperCase(), margin, y + 6, { align: 'center', width: contentWidth });

      y += 35;

      // === FROM / BILL TO BOXES ===
      const boxW = (contentWidth - 10) / 2;

      // FROM
      doc.rect(margin, y, boxW, 50).fillAndStroke('#f5f5f5', '#dddddd');
      doc.fillColor(themeColor).fontSize(8).font(font).text('FROM', margin + 8, y + 6);
      doc.fillColor('#000000').fontSize(10).text(companyName, margin + 8, y + 18);
      if (companyAddress) doc.fillColor('#666666').fontSize(8).text(companyAddress, margin + 8, y + 30);

      // BILL TO
      const billX = margin + boxW + 10;
      doc.rect(billX, y, boxW, 50).fillAndStroke('#f5f5f5', '#dddddd');
      doc.fillColor(themeColor).fontSize(8).font(font).text('BILL TO', billX + 8, y + 6);
      doc.fillColor('#000000').fontSize(10).text(clientName, billX + 8, y + 18);
      if (clientAddress) doc.fillColor('#666666').fontSize(8).text(clientAddress, billX + 8, y + 30);

      y += 60;

      // === INVOICE DETAILS ===
      doc.rect(margin, y, contentWidth, 16).fillAndStroke('#eeeeee', '#dddddd');
      doc.fillColor('#000000').fontSize(9).font(font);
      doc.text(`Invoice No: ${receiptNo}`, margin + 8, y + 3);
      doc.text(`Date: ${date}`, margin + contentWidth - 80, y + 3, { width: 75, align: 'right' });

      y += 26;

      // === TABLE HEADER ===
      doc.rect(margin, y, contentWidth, 18).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(9).font(font);
      doc.text('Qty', margin + 5, y + 4, { width: col1 - 10, align: 'center' });
      doc.text('Description', margin + col1 + 5, y + 4, { width: col2 - 10, align: 'left' });
      doc.text('Unit', margin + col1 + col2 + 5, y + 4, { width: col3 - 10, align: 'right' });
      doc.text('Amount', margin + col1 + col2 + col3 + 5, y + 4, { width: col4 - 10, align: 'right' });

      y += 18;

      // === TABLE ROWS ===
      items.forEach((item, i) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f9f9f9';
        doc.rect(margin, y, contentWidth, 18).fillAndStroke(bg, '#dddddd');
        doc.fillColor('#000000').fontSize(9).font(font);
        doc.text(String(item.qty || 0), margin + 5, y + 4, { width: col1 - 10, align: 'center' });
        doc.text(item.description || '', margin + col1 + 5, y + 4, { width: col2 - 10, align: 'left' });
        doc.text(formatCurrency(item.unitCost || 0), margin + col1 + col2 + 5, y + 4, { width: col3 - 10, align: 'right' });
        doc.text(formatCurrency(item.amount || 0), margin + col1 + col2 + col3 + 5, y + 4, { width: col4 - 10, align: 'right' });
        y += 18;
      });

      // === TOTALS SECTION ===
      y += 8;

      const subtotal = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
      const taxAmt = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + taxAmt;

      // Subtotal row
      doc.rect(margin, y, contentWidth, 16).fillAndStroke('#f0f0f0', '#cccccc');
      doc.fillColor('#666666').fontSize(9).font(font).text('Subtotal:', margin + col1 + col2 + 10, y + 3);
      doc.fillColor('#000000').text(formatCurrency(subtotal), margin + contentWidth - 8, y + 3, { width: col4, align: 'right' });
      y += 18;

      // Tax row
      if (taxEnabled && taxAmt > 0) {
        doc.rect(margin, y, contentWidth, 16).fillAndStroke('#f0f0f0', '#cccccc');
        doc.fillColor('#666666').fontSize(9).font(font).text(`${taxName} (${taxRate}%):`, margin + col1 + col2 + 10, y + 3);
        doc.fillColor('#000000').text(formatCurrency(taxAmt), margin + contentWidth - 8, y + 3, { width: col4, align: 'right' });
        y += 18;
      }

      // Total row
      y += 5;
      doc.rect(margin, y, contentWidth, 22).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(11).font(font).text('TOTAL:', margin + col1 + col2 + 10, y + 5);
      doc.fontSize(13).text(formatCurrency(total), margin + contentWidth - 8, y + 4, { width: col4, align: 'right' });

      y += 32;

      // === TERMS & CONDITIONS ===
      if (tc) {
        doc.moveTo(margin, y).lineTo(margin + contentWidth, y).stroke('#cccccc');
        doc.fillColor('#666666').fontSize(8).font(font).text('Terms & Conditions:', margin, y + 6);
        doc.fontSize(9).text(tc, margin, y + 18, { width: contentWidth });
        y += 40;
      }

      // === PAGE NUMBER ===
      doc.fillColor('#aaaaaa').fontSize(8).text(`Page ${idx + 1} of ${receipts.length}`, margin, pageHeight - 35, { align: 'center', width: contentWidth });
    });

    doc.end();
    await new Promise(r => doc.on('end', r));

    const pdfBuffer = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt.pdf"`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};
