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
      companyWebsite = '',
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

    // Load logo
    const logoPath = path.join(__dirname, '..', 'images', 'scga-logo.png');
    let hasLogo = false;
    try {
      if (fs.existsSync(logoPath)) {
        hasLogo = true;
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

    const headerHeight = 65;

    // Table columns
    const col1 = 50;   // Qty
    const col2 = 235;  // Description
    const col3 = 105;  // Unit
    const col4 = 125;  // Amount

    // Track page number manually
    let currentPage = 1;
    const totalPages = receipts.length;

    // Helper to draw header
    const drawHeader = () => {
      doc.rect(0, 0, pageWidth, headerHeight).fill(themeColor);
      if (hasLogo) {
        doc.image(logoPath, margin, 8, { width: 50, height: 50 });
      }
      const textX = hasLogo ? margin + 60 : margin;
      const textWidth = hasLogo ? contentWidth - 60 : contentWidth;
      doc.fillColor('#ffffff').fontSize(16).font(font).text(companyName, textX, 10, { width: textWidth });
      if (companyAddress) doc.fontSize(8).text(companyAddress, textX, 28, { width: textWidth });
      if (contactPerson) doc.fontSize(8).text(contactPerson, textX, 40, { width: textWidth });
      if (companyWebsite) doc.fontSize(8).text(companyWebsite, textX, 52, { width: textWidth });
    };
    const drawHeader = () => {
      doc.rect(0, 0, pageWidth, headerHeight).fill(themeColor);
      if (hasLogo) {
        doc.image(logoPath, margin, 8, { width: 50, height: 50 });
      }
      const textX = hasLogo ? margin + 60 : margin;
      const textWidth = hasLogo ? contentWidth - 60 : contentWidth;
      doc.fillColor('#ffffff').fontSize(16).font(font).text(companyName, textX, 10, { width: textWidth });
      if (companyAddress) doc.fontSize(8).text(companyAddress, textX, 28, { width: textWidth });
      if (contactPerson) doc.fontSize(8).text(contactPerson, textX, 40, { width: textWidth });
      if (companyWebsite) doc.fontSize(8).text(companyWebsite, textX, 52, { width: textWidth });
    };

    // Helper to draw footer
    const drawFooter = () => {
      doc.fillColor('#aaaaaa').fontSize(8).text(`Page ${currentPage}`, margin, pageHeight - 30, { align: 'center', width: contentWidth });
    };

    // Process each receipt
    receipts.forEach((receipt, idx) => {
      if (idx > 0) {
        doc.addPage();
        currentPage++;
      }

      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'INVOICE' } = receipt;

      let y = margin;

      // === HEADER ===
      drawHeader();
      y = headerHeight + 8;

      // === TYPE BOX ===
      doc.rect(margin, y, contentWidth, 20).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(12).font(font).text(type.toUpperCase(), margin, y + 4, { align: 'center', width: contentWidth });
      y += 28;

      // === FROM / BILL TO ===
      const boxW = (contentWidth - 10) / 2;
      doc.rect(margin, y, boxW, 40).fillAndStroke('#f8f8f8', '#dddddd');
      doc.fillColor(themeColor).fontSize(7).font(font).text('FROM', margin + 6, y + 4);
      doc.fillColor('#000000').fontSize(9).text(companyName, margin + 6, y + 14);
      if (companyAddress) doc.fillColor('#666666').fontSize(7).text(companyAddress, margin + 6, y + 25);

      const billX = margin + boxW + 10;
      doc.rect(billX, y, boxW, 40).fillAndStroke('#f8f8f8', '#dddddd');
      doc.fillColor(themeColor).fontSize(7).font(font).text('BILL TO', billX + 6, y + 4);
      doc.fillColor('#000000').fontSize(9).text(clientName, billX + 6, y + 14);
      if (clientAddress) doc.fillColor('#666666').fontSize(7).text(clientAddress, billX + 6, y + 25);
      y += 48;

      // === INVOICE DETAILS ===
      doc.rect(margin, y, contentWidth, 14).fillAndStroke('#eeeeee', '#dddddd');
      doc.fillColor('#000000').fontSize(8).font(font);
      doc.text(`Invoice No: ${receiptNo}`, margin + 6, y + 3);
      doc.text(`Date: ${date}`, margin + contentWidth - 70, y + 3, { width: 65, align: 'right' });
      y += 20;

      // === TABLE HEADER ===
      doc.rect(margin, y, contentWidth, 18).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(9).font(font);
      doc.text('Qty', margin + 5, y + 5, { width: col1 - 10, align: 'center' });
      doc.text('Description', margin + col1 + 5, y + 5, { width: col2 - 10, align: 'left' });
      doc.text('Unit', margin + col1 + col2 + 5, y + 5, { width: col3 - 10, align: 'right' });
      doc.text('Amount', margin + col1 + col2 + col3 + 5, y + 5, { width: col4 - 10, align: 'right' });
      y += 18;

      // === TABLE ROWS ===
      items.forEach((item, i) => {
        // Check for page overflow - BEFORE drawing this row
        if (y + 18 > pageHeight - 60) {
          // End current page with footer
          doc.fillColor('#aaaaaa').fontSize(8).text(`Page ${doc.page.number}`, margin, pageHeight - 30, { align: 'center', width: contentWidth });
          // Add new page
          doc.addPage();
          y = margin;
          drawHeader();
          y = headerHeight + 8;
          // Draw table header on new page
          doc.rect(margin, y, contentWidth, 18).fillAndStroke(themeColor, themeColor);
          doc.fillColor('#ffffff').fontSize(9).font(font);
          doc.text('Qty', margin + 5, y + 5, { width: col1 - 10, align: 'center' });
          doc.text('Description', margin + col1 + 5, y + 5, { width: col2 - 10, align: 'left' });
          doc.text('Unit', margin + col1 + col2 + 5, y + 5, { width: col3 - 10, align: 'right' });
          doc.text('Amount', margin + col1 + col2 + col3 + 5, y + 5, { width: col4 - 10, align: 'right' });
          y += 18;
        }

        const bg = i % 2 === 0 ? '#ffffff' : '#fafafa';
        doc.rect(margin, y, contentWidth, 18).fillAndStroke(bg, '#dddddd');
        doc.fillColor('#000000').fontSize(9).font(font);
        doc.text(String(item.qty || 0), margin + 5, y + 5, { width: col1 - 10, align: 'center' });
        doc.text(item.description || '', margin + col1 + 5, y + 5, { width: col2 - 10, align: 'left' });
        doc.text(formatCurrency(item.unitCost || 0), margin + col1 + col2 + 5, y + 5, { width: col3 - 10, align: 'right' });
        doc.text(formatCurrency(item.amount || 0), margin + col1 + col2 + col3 + 5, y + 5, { width: col4 - 10, align: 'right' });
        y += 18;
      });

      y += 10;

      // === TOTALS ===
      const subtotal = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
      const taxAmt = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + taxAmt;

      // Subtotal
      doc.rect(margin, y, contentWidth, 16).fillAndStroke('#f5f5f5', '#cccccc');
      doc.fillColor('#555555').fontSize(9).font(font).text('Subtotal:', margin + col1 + col2 + 5, y + 4);
      doc.fillColor('#000000').text(formatCurrency(subtotal), margin + col1 + col2 + col3 + 5, y + 4, { width: col4 - 10, align: 'right' });
      y += 18;

      // Tax
      if (taxEnabled && taxAmt > 0) {
        doc.rect(margin, y, contentWidth, 16).fillAndStroke('#f5f5f5', '#cccccc');
        doc.fillColor('#555555').fontSize(9).font(font).text(`${taxName} (${taxRate}%):`, margin + col1 + col2 + 5, y + 4);
        doc.fillColor('#000000').text(formatCurrency(taxAmt), margin + col1 + col2 + col3 + 5, y + 4, { width: col4 - 10, align: 'right' });
        y += 18;
      }

      // Total
      y += 5;
      doc.rect(margin, y, contentWidth, 20).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(11).font(font).text('TOTAL:', margin + col1 + col2 + 5, y + 5);
      doc.fontSize(13).text(formatCurrency(total), margin + col1 + col2 + col3 + 5, y + 4, { width: col4 - 10, align: 'right' });
      y += 30;

      // === T&C ON LEFT, SIGNATURE ON RIGHT ===
      if (tc) {
        const tcY = y;
        // T&C on LEFT (60% width)
        const tcWidth = (contentWidth - 10) * 0.6;
        doc.moveTo(margin, tcY).lineTo(margin + tcWidth, tcY).stroke('#cccccc');
        doc.fillColor('#666666').fontSize(8).font(font).text('Terms & Conditions:', margin, tcY + 6);
        // Split T&C by | and list each on new line
        const tcItems = tc.split('|').map(s => s.trim()).filter(s => s);
        let tcTextY = tcY + 18;
        tcItems.forEach(item => {
          doc.fontSize(8).text('• ' + item, margin, tcTextY, { width: tcWidth });
          tcTextY += 12;
        });

        // Signature area on RIGHT (40% width)
        const sigX = margin + tcWidth + 10;
        const sigW = contentWidth - tcWidth - 10;
        doc.moveTo(sigX, tcY).lineTo(sigX + sigW, tcY).stroke('#cccccc');
        doc.fillColor('#666666').fontSize(8).font(font).text('Signature:', sigX, tcY + 6);
        // Signature line
        doc.moveTo(sigX, tcY + 40).lineTo(sigX + sigW, tcY + 40).stroke('#999999');
        doc.fillColor('#888888').fontSize(7).text('Authorized Signature', sigX, tcY + 44, { width: sigW, align: 'center' });

        y = tcTextY + 10;
      }

      // === FOOTER at end of receipt ===
      doc.fillColor('#aaaaaa').fontSize(8).text(`Page ${doc.page.number}`, margin, pageHeight - 30, { align: 'center', width: contentWidth });
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
