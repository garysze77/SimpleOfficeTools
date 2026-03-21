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
      others = '',
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

    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 59, g: 130, b: 246 };
    };
    const themeRGB = hexToRgb(themeColor);
    const themeColorStr = `#${themeColor.replace('#', '')}`;

    // Load embedded Chinese font
    const fontPath = path.join(__dirname, '..', 'fonts', 'NotoSansCJKsc-Regular.otf');
    let font = 'Helvetica';

    try {
      if (fs.existsSync(fontPath)) {
        font = 'NotoSans';
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
      margins: { top: 20, bottom: 20, left: 20, right: 20 }
    });

    // Register fonts with pdfkit
    doc.registerFont('NotoSans', fontPath);

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    const pageWidth = 210;
    const margin = 20;
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

      let y = 20;

      // Header background
      doc.rect(0, 0, pageWidth, 40).fill(themeColorStr);

      // Company name
      doc.fillColor('#ffffff').fontSize(18).font(font).text(companyName, margin, 12, { align: 'center', width: contentWidth });

      // Company details
      if (companyAddress) {
        doc.fontSize(9).text(companyAddress, margin, 22, { align: 'center', width: contentWidth });
      }
      if (contactPerson) {
        doc.fontSize(8).text(contactPerson, margin, 30, { align: 'center', width: contentWidth });
      }

      y = 50;

      // Document type box
      doc.rect(margin, y, contentWidth, 22).fillAndStroke(themeColorStr, themeColorStr);
      doc.fillColor('#ffffff').fontSize(14).text(type.toUpperCase(), margin, y + 5, { align: 'center', width: contentWidth });

      y += 30;

      // From / Bill To boxes
      const boxWidth = (contentWidth - 5) / 2;
      const boxHeight = 35;

      // From box
      doc.rect(margin, y, boxWidth, boxHeight).fillAndStroke('#f7fafc', '#e2e8f0');
      doc.fillColor(themeColorStr).fontSize(8).font(font).text('FROM', margin + 5, y + 5);
      doc.fillColor('#000000').fontSize(10).text(companyName, margin + 5, y + 14);
      if (companyAddress) {
        doc.fillColor('#718096').fontSize(8).text(companyAddress, margin + 5, y + 23);
      }

      // Bill To box
      const billToX = margin + boxWidth + 5;
      doc.rect(billToX, y, boxWidth, boxHeight).fillAndStroke('#f7fafc', '#e2e8f0');
      doc.fillColor(themeColorStr).fontSize(8).text('BILL TO', billToX + 5, y + 5);
      doc.fillColor('#000000').fontSize(10).text(clientName, billToX + 5, y + 14);
      if (clientAddress) {
        doc.fillColor('#718096').fontSize(8).text(clientAddress, billToX + 5, y + 23);
      }

      y += boxHeight + 10;

      // Invoice details
      doc.rect(margin, y, contentWidth, 12).fillAndStroke('#edf2f7', '#e2e8f0');
      doc.fillColor('#000000').fontSize(9).text(`Invoice No: ${receiptNo}`, margin + 5, y + 3);
      doc.text(`Date: ${date}`, margin + 100, y + 3);
      y += 20;

      // Items table header
      const rowHeight = 10;
      const colWidths = [20, 90, 35, 35];
      const cols = ['Qty', 'Description', 'Unit Price', 'Amount'];

      doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(themeColorStr, themeColorStr);
      doc.fillColor('#ffffff').fontSize(8).font(font);
      let xPos = margin + 5;
      cols.forEach((col, i) => {
        const align = i === 0 || i === 2 || i === 3 ? 'center' : 'left';
        doc.text(col, xPos, y + 2, { width: colWidths[i], align });
        xPos += colWidths[i];
      });
      y += rowHeight;

      // Table rows
      items.forEach((item, i) => {
        const bgColor = i % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(bgColor, '#e2e8f0');

        doc.fillColor('#000000').fontSize(8).font(font);
        xPos = margin + 5;
        const rowData = [String(item.qty || 0), item.description || '', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)];
        rowData.forEach((cell, j) => {
          const align = j === 0 || j === 2 || j === 3 ? 'center' : 'left';
          doc.text(cell, xPos, y + 2, { width: colWidths[j], align });
          xPos += colWidths[j];
        });
        y += rowHeight;
      });

      // Subtotal row
      y += 5;
      doc.rect(margin + 145, y, 70, rowHeight).fillAndStroke('#f7fafc', '#e2e8f0');
      doc.fillColor('#718096').fontSize(8).text('Subtotal:', margin + 150, y + 2);
      doc.fillColor('#000000').text(formatCurrency(subtotal), margin + 180, y + 2, { width: 35, align: 'right' });
      y += rowHeight;

      // Tax row
      if (taxEnabled && taxAmount > 0) {
        doc.rect(margin + 145, y, 70, rowHeight).fillAndStroke('#f7fafc', '#e2e8f0');
        doc.fillColor('#718096').fontSize(8).text(`${taxName} (${taxRate}%):`, margin + 150, y + 2);
        doc.fillColor('#000000').text(formatCurrency(taxAmount), margin + 180, y + 2, { width: 35, align: 'right' });
        y += rowHeight;
      }

      // Total row
      y += 3;
      doc.rect(margin + 145, y, 70, rowHeight + 4).fillAndStroke(themeColorStr, themeColorStr);
      doc.fillColor('#ffffff').fontSize(10).text('TOTAL', margin + 150, y + 4);
      doc.fontSize(12).text(formatCurrency(grandTotal), margin + 180, y + 4, { width: 35, align: 'right' });

      // Terms & Conditions
      if (tc) {
        y += rowHeight + 15;
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke('#e2e8f0');
        doc.fillColor('#4a5568').fontSize(8).text('Terms & Conditions:', margin, y + 5);
        doc.fontSize(8).text(tc, margin, y + 14, { width: contentWidth });
      }

      // Page number
      doc.fillColor('#a0aec0').fontSize(8).text(`Page ${index + 1} of ${receipts.length}`, margin, 280, { align: 'center', width: contentWidth });
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