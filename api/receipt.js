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

    // Column widths that sum to contentWidth (495)
    const colWidths = [50, 250, 100, 95];
    const cols = ['Qty', 'Description', 'Unit', 'Amount'];
    const rowHeight = 18;
    const headerHeight = 22;

    // Helper to draw header on current page
    const drawHeader = (yPos) => {
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

      return 75;
    };

    // Helper to draw table header row
    const drawTableHeader = (yPos) => {
      doc.rect(margin, yPos, contentWidth, headerHeight).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(10).font(font);
      let xPos = margin + 8;
      cols.forEach((col, i) => {
        const align = i === 0 || i === 2 || i === 3 ? 'center' : 'left';
        doc.text(col, xPos, yPos + 6, { width: colWidths[i], align });
        xPos += colWidths[i];
      });
      return yPos + headerHeight;
    };

    // Helper to draw footer
    const drawFooter = (pageNum, totalPages) => {
      doc.fillColor('#a0aec0').fontSize(8).text(
        `Page ${pageNum} of ${totalPages}`,
        margin,
        pageHeight - 50,
        { align: 'center', width: contentWidth }
      );
    };

    // Process each receipt
    receipts.forEach((receipt, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;

      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const grandTotal = subtotal + taxAmount;

      let y = drawHeader();

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

      // Calculate space needed for table + subtotal/tax/total + footer
      const itemsHeight = items.length * rowHeight;
      const totalsSectionHeight = taxEnabled ? rowHeight * 3 + 25 : rowHeight * 2 + 20;
      const tcHeight = tc ? 50 : 0;
      const spaceNeeded = itemsHeight + totalsSectionHeight + tcHeight;
      const availableSpace = pageHeight - margin - y - 70; // 70 for footer buffer

      // If items won't fit, add page
      if (spaceNeeded > availableSpace && items.length > 0) {
        doc.addPage();
        y = drawHeader(y);
        y += 15;
      }

      // Items table header
      y = drawTableHeader(y);

      // Calculate x positions for right-aligned amounts (after Description + Unit)
      const amountColStart = margin + colWidths[0] + colWidths[1]; // 50 + 250 = 300
      const unitColStart = margin + colWidths[0]; // 50

      // Table rows with page overflow handling
      let currentPageStartY = y;
      items.forEach((item, i) => {
        // Check if we need a new page for this row
        if (y + rowHeight > pageHeight - 70) {
          // Draw footer on current page
          drawFooter(index + 1, receipts.length);
          // Add new page
          doc.addPage();
          y = drawHeader(y);
          y += 15;
          // Draw table header on new page
          y = drawTableHeader(y);
        }

        const bgColor = i % 2 === 0 ? '#ffffff' : '#f7fafc';
        doc.rect(margin, y, contentWidth, rowHeight).fillAndStroke(bgColor, '#e2e8f0');

        doc.fillColor('#000000').fontSize(10).font(font);
        let xPos = margin + 8;

        // Qty (centered)
        doc.text(String(item.qty || 0), xPos, y + 5, { width: colWidths[0], align: 'center' });
        xPos += colWidths[0];

        // Description (left aligned)
        doc.text(item.description || '', xPos, y + 5, { width: colWidths[1], align: 'left' });
        xPos += colWidths[1];

        // Unit Price (centered)
        doc.text(formatCurrency(item.unitCost || 0), xPos, y + 5, { width: colWidths[2], align: 'center' });
        xPos += colWidths[2];

        // Amount (right aligned)
        doc.text(formatCurrency(item.amount || 0), xPos, y + 5, { width: colWidths[3], align: 'right' });

        y += rowHeight;
      });

      // Check if totals section fits, if not add new page
      if (y > pageHeight - 100) {
        doc.addPage();
        y = drawHeader(y);
        y += 15;
      }

      // Subtotal row - align with Amount column (right side)
      y += 15;
      const totalsX = margin + colWidths[0] + colWidths[1]; // Start after Description column
      const totalsWidth = colWidths[2] + colWidths[3]; // Unit + Amount columns

      doc.rect(totalsX, y, totalsWidth, rowHeight).fillAndStroke('#f7fafc', '#e2e8f0');
      doc.fillColor('#718096').fontSize(10).font(defaultFont).text('Subtotal:', totalsX + 8, y + 4);
      doc.fillColor('#000000').text(formatCurrency(subtotal), totalsX + totalsWidth - 8, y + 4, { width: colWidths[3], align: 'right' });
      y += rowHeight;

      // Tax row
      if (taxEnabled && taxAmount > 0) {
        doc.rect(totalsX, y, totalsWidth, rowHeight).fillAndStroke('#f7fafc', '#e2e8f0');
        doc.fillColor('#718096').fontSize(10).text(`${taxName} (${taxRate}%):`, totalsX + 8, y + 4);
        doc.fillColor('#000000').text(formatCurrency(taxAmount), totalsX + totalsWidth - 8, y + 4, { width: colWidths[3], align: 'right' });
        y += rowHeight;
      }

      // Total row
      y += 8;
      doc.rect(totalsX, y, totalsWidth, rowHeight + 4).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(12).font(defaultFont).text('TOTAL', totalsX + 8, y + 6);
      doc.fontSize(14).text(formatCurrency(grandTotal), totalsX + totalsWidth - 8, y + 5, { width: colWidths[3], align: 'right' });

      // Terms & Conditions
      if (tc) {
        y += rowHeight + 30;
        // Check if TC fits, if not add new page
        if (y + 40 > pageHeight - 70) {
          doc.addPage();
          y = drawHeader(y);
          y += 15;
        }
        doc.moveTo(margin, y).lineTo(pageWidth - margin, y).stroke('#e2e8f0');
        doc.fillColor('#4a5568').fontSize(9).text('Terms & Conditions:', margin, y + 8);
        doc.fontSize(9).text(tc, margin, y + 20, { width: contentWidth });
      }

      // Page number
      drawFooter(index + 1, receipts.length);
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
