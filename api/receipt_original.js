const fontkit = require('fontkit');
const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfkit');

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

    // Load embedded Chinese font
    let chineseFont = null;
    const fontPath = path.join(__dirname, '..', 'fonts', 'NotoSansCJKsc-Regular.otf');

    try {
      if (fs.existsSync(fontPath)) {
        chineseFont = fontkit.openSync(fontPath);
        console.log('Loaded Chinese font from:', fontPath);
      } else {
        console.log('Font file not found at:', fontPath);
      }
    } catch (e) {
      console.log('Error loading font:', e.message);
    }

    // Create PDF document
    const doc = new PdfPrinter(chineseFont || 'Helvetica');

    const pdfDoc = doc.createDocument({
      size: 'A4',
      margins: { top: 20, bottom: 20, left: 20, right: 20 }
    });

    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {});

    // Process each receipt
    receipts.forEach((receipt, index) => {
      if (index > 0) {
        pdfDoc.addPage();
      }

      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;

      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const grandTotal = subtotal + taxAmount;

      const pageWidth = 210;
      const margin = 20;

      // Header background
      pdfDoc.rect(0, 0, pageWidth, 35).fill(themeRGB.r, themeRGB.g, themeRGB.b);

      // Company name
      pdfDoc.fillColor(255, 255, 255).fontSize(18).font(chineseFont ? chineseFont : 'Helvetica').text(companyName, margin, 12, { align: 'center', width: pageWidth - 2 * margin });

      // Company details
      if (companyAddress) {
        pdfDoc.fontSize(9).text(companyAddress, margin, 20, { align: 'center', width: pageWidth - 2 * margin });
      }
      if (contactPerson) {
        pdfDoc.fontSize(8).text(contactPerson, margin, 26, { align: 'center', width: pageWidth - 2 * margin });
      }
      if (others) {
        pdfDoc.fontSize(7).text(others, margin, 30, { align: 'center', width: pageWidth - 2 * margin });
      }

      // Document type box
      const boxY = 45;
      pdfDoc.rect(margin, boxY, pageWidth - 2 * margin, 20).stroke(themeRGB.r, themeRGB.g, themeRGB.b);
      pdfDoc.fillColor(themeRGB.r, themeRGB.g, themeRGB.b).fontSize(14).text(type.toUpperCase(), margin, boxY + 5, { align: 'center', width: pageWidth - 2 * margin });
      pdfDoc.fillColor(100, 100, 100).fontSize(10).text('TAX INVOICE / RECEIPT', margin, boxY + 12, { align: 'center', width: pageWidth - 2 * margin });

      // From / Bill To
      const sectionY = 75;
      const boxWidth = (pageWidth - 2 * margin - 5) / 2;

      // From box
      pdfDoc.rect(margin, sectionY, boxWidth, 30).fill(247, 250, 252);
      pdfDoc.fillColor(themeRGB.r, themeRGB.g, themeRGB.b).fontSize(8).text('FROM', margin + 5, sectionY + 5);
      pdfDoc.fillColor(0, 0, 0).fontSize(10).text(companyName, margin + 5, sectionY + 12);
      if (companyAddress) {
        pdfDoc.fillColor(100, 100, 100).fontSize(9).text(companyAddress, margin + 5, sectionY + 18);
      }

      // Bill To box
      const billToX = margin + boxWidth + 5;
      pdfDoc.rect(billToX, sectionY, boxWidth, 30).fill(247, 250, 252);
      pdfDoc.fillColor(themeRGB.r, themeRGB.g, themeRGB.b).fontSize(8).text('BILL TO', billToX + 5, sectionY + 5);
      pdfDoc.fillColor(0, 0, 0).fontSize(10).text(clientName, billToX + 5, sectionY + 12);
      if (clientAddress) {
        pdfDoc.fillColor(100, 100, 100).fontSize(9).text(clientAddress, billToX + 5, sectionY + 18);
      }

      // Invoice details
      const detailsY = sectionY + 35;
      pdfDoc.rect(margin, detailsY, pageWidth - 2 * margin, 10).fill(237, 242, 247);
      pdfDoc.fillColor(0, 0, 0).fontSize(9).text(`Invoice No: ${receiptNo}`, margin + 5, detailsY + 3);
      pdfDoc.text(`Date: ${date}`, margin + 100, detailsY + 3);

      // Items table
      const tableY = detailsY + 18;
      const rowHeight = 8;
      const colWidths = [20, 90, 35, 35];
      const cols = ['Qty', 'Description', 'Unit Price', 'Amount'];

      // Table header
      pdfDoc.rect(margin, tableY, pageWidth - 2 * margin, rowHeight).fill(themeRGB.r, themeRGB.g, themeRGB.b);
      pdfDoc.fillColor(255, 255, 255).fontSize(8);
      let xPos = margin + 5;
      cols.forEach((col, i) => {
        const align = i === 0 || i === 2 || i === 3 ? 'center' : 'left';
        pdfDoc.text(col, xPos, tableY + 2, { width: colWidths[i], align });
        xPos += colWidths[i];
      });

      // Table rows
      let currentY = tableY + rowHeight;
      items.forEach((item, i) => {
        const bgColor = i % 2 === 0 ? [255, 255, 255] : [249, 250, 251];
        pdfDoc.rect(margin, currentY, pageWidth - 2 * margin, rowHeight).fill(bgColor[0], bgColor[1], bgColor[2]);

        pdfDoc.fillColor(0, 0, 0).fontSize(8);
        xPos = margin + 5;
        const rowData = [String(item.qty || 0), item.description || '', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)];
        rowData.forEach((cell, j) => {
          const align = j === 0 || j === 2 || j === 3 ? 'center' : 'left';
          pdfDoc.text(cell, xPos, currentY + 2, { width: colWidths[j], align });
          xPos += colWidths[j];
        });
        currentY += rowHeight;
      });

      // Subtotal
      pdfDoc.rect(margin + 145, currentY, 70, rowHeight).fill(247, 250, 252);
      pdfDoc.fillColor(100, 100, 100).fontSize(8).text('Subtotal:', margin + 150, currentY + 2);
      pdfDoc.fillColor(0, 0, 0).text(formatCurrency(subtotal), margin + 180, currentY + 2, { width: 35, align: 'right' });
      currentY += rowHeight;

      // Tax
      if (taxEnabled && taxAmount > 0) {
        pdfDoc.rect(margin + 145, currentY, 70, rowHeight).fill(247, 250, 252);
        pdfDoc.fillColor(100, 100, 100).fontSize(8).text(`${taxName} (${taxRate}%):`, margin + 150, currentY + 2);
        pdfDoc.fillColor(0, 0, 0).text(formatCurrency(taxAmount), margin + 180, currentY + 2, { width: 35, align: 'right' });
        currentY += rowHeight;
      }

      // Total
      const totalY = currentY;
      pdfDoc.rect(margin + 145, totalY, 70, rowHeight + 2).fill(themeRGB.r, themeRGB.g, themeRGB.b);
      pdfDoc.fillColor(255, 255, 255).fontSize(10).text('TOTAL', margin + 150, totalY + 3);
      pdfDoc.fontSize(12).text(formatCurrency(grandTotal), margin + 180, totalY + 3, { width: 35, align: 'right' });

      // Terms & Conditions
      if (tc) {
        const tcY = totalY + rowHeight + 10;
        pdfDoc.moveTo(margin, tcY).lineTo(pageWidth - margin, tcY).stroke(226, 232, 240);
        pdfDoc.fillColor(74, 85, 104).fontSize(8).text('Terms & Conditions:', margin, tcY + 5);
        pdfDoc.text(tc, margin, tcY + 12, { width: pageWidth - 2 * margin });
      }

      // Page number
      pdfDoc.fillColor(150, 150, 150).fontSize(8).text(`Page ${index + 1} of ${receipts.length}`, margin, 287, { align: 'center', width: pageWidth - 2 * margin });
    });

    pdfDoc.end();

    await new Promise(resolve => pdfDoc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipts.pdf"`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};