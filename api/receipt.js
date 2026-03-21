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
        console.log('Loaded Chinese font from:', fontPath);
      } else {
        console.log('Font file not found at:', fontPath);
      }
    } catch (e) {
      console.log('Error loading font:', e.message);
    }

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margin: 50
    });

    // Register font
    if (hasChineseFont) {
      doc.registerFont('NotoSans', fontPath);
    }

    const font = hasChineseFont ? 'NotoSans' : 'Helvetica';
    const defaultFont = 'Helvetica';

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // A4 dimensions in points: 595.28 x 841.89
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const contentWidth = pageWidth - 2 * margin;

    // Process each receipt
    receipts.forEach((receipt, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;

      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const grandTotal = subtotal + taxAmount;

      let y = margin;

      // Header background
      doc.rect(0, 0, pageWidth, 60).fill(themeColor);

      // Company name
      doc.fillColor('#ffffff').fontSize(20).font(font).text(companyName, margin, 15, { align: 'center', width: contentWidth });

      // Company details
      if (companyAddress) {
        doc.fontSize(10).text(companyAddress, margin, 35, { align: 'center', width: contentWidth });
      }
      if (contactPerson) {
        doc.fontSize(9).text(contactPerson, margin, 47, { align: 'center', width: contentWidth });
      }

      y = 75;

      // Document type box
      doc.rect(margin, y, contentWidth, 25).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(16).font(font).text(type.toUpperCase(), margin, y + 6, { align: 'center', width: contentWidth });

      y += 35;

      // From / Bill To boxes
      const boxWidth = (contentWidth - 10) / 2;
      const boxHeight = 50;

      // From box
      doc.rect(margin, y, boxWidth, boxHeight).fillAndStroke('#f7fafc', '#e2e8f0');
      doc.fillColor(themeColor).fontSize(9).font(font).text('FROM', margin + 8, y + 8);
      doc.fillColor('#000000').fontSize(11).text(companyName, margin + 8, y + 20);
      if (companyAddress) {
        doc.fillColor('#718096').fontSize(9).text(companyAddress, margin + 8, y + 34);
      }

      // Bill To box
      const billToX = margin + boxWidth + 10;
      doc.rect(billToX, y, boxWidth, boxHeight).fillAndStroke('#f7fafc', '#e2e8f0');
      doc.fillColor(themeColor).fontSize(9).font(font).text('BILL TO', billToX + 8, y + 8);
      doc.fillColor('#000000').fontSize(11).text(clientName, billToX + 8, y + 20);
      if (clientAddress) {
        doc.fillColor('#718096').fontSize(9).text(clientAddress, billToX + 8, y + 34);
      }

      y += boxHeight + 15;

      // Invoice details
      doc.rect(margin, y, contentWidth, 18).fillAndStroke('#edf2f7', '#e2e8f0');
      doc.fillColor('#000000').fontSize(10).font(defaultFont).text(`Invoice No: ${receiptNo}`, margin + 10, y + 5);
      doc.text(`Date: ${date}`, margin + 180, y + 5);
      y += 30;

      // Items table header
      const rowHeight = 14;
      const colWidths = [40, 200, 100, 80];
      const cols = ['Qty', 'Description', 'Unit Price', 'Amount'];

      doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(10).font(font);
      let xPos = margin + 8;
      cols.forEach((col, i) => {
        const align = i === 0 || i === 2 || i === 3 ? 'center' : 'left';
        doc.text(col, xPos, y + 3, { width: colWidths[i], align });
        xPos += colWidths[i];
      });
      y += rowHeight;

      // Table rows
      items.forEach((item, i) => {
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(bgColor, '#e2e8f0');

        doc.fillColor('#000000').fontSize(10).font(font);
        xPos = margin + 8;
        const rowData = [String(item.qty || 0), item.description || '', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)];
        rowData.forEach((cell, j) => {
          const align = j === 0 || j === 2 || j === 3 ? 'center' : 'left';
          doc.text(cell, xPos, y + 3, { width: colWidths[j], align });
          xPos += colWidths[j];
        });
        y += rowHeight;
      });

      // Subtotal row
      y += 10;
      doc.rect(margin + 280, y, contentWidth - 280, rowHeight).fillAndStroke('#f7fafc', '#e2e8f0');
      doc.fillColor('#718096').fontSize(10).font(defaultFont).text('Subtotal:', margin + 290, y + 3);
      doc.fillColor('#000000').text(formatCurrency(subtotal), margin + 420, y + 3, { width: 70, align: 'right' });
      y += rowHeight;

      // Tax row
      if (taxEnabled && taxAmount > 0) {
        doc.rect(margin + 280, y, contentWidth - 280, rowHeight).fillAndStroke('#f7fafc', '#e2e8f0');
        doc.fillColor('#718096').fontSize(10).text(`${taxName} (${taxRate}%):`, margin + 290, y + 3);
        doc.fillColor('#000000').text(formatCurrency(taxAmount), margin + 420, y + 3, { width: 70, align: 'right' });
        y += rowHeight;
      }

      // Total row
      y += 5;
      doc.rect(margin + 280, y, contentWidth - 280, rowHeight + 6).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(12).text('TOTAL', margin + 290, y + 6);
      doc.fontSize(14).text(formatCurrency(grandTotal), margin + 420, y + 5, { width: 70, align: 'right' });

      // Terms & Conditions
      if (tc) {
        y += rowHeight + 25;
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke('#e2e8f0');
        doc.fillColor('#4a5568').fontSize(9).text('Terms & Conditions:', margin, y + 8);
        doc.fontSize(9).text(tc, margin, y + 20, { width: contentWidth });
      }

      // Page number
      doc.fillColor('#a0aec0').fontSize(8).text(`Page ${index + 1} of ${receipts.length}`, margin, pageHeight - 40, { align: 'center', width: contentWidth });
    });

    doc.end();

    await new Promise(resolve => doc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipts.pdf"`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};