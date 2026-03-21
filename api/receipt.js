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
    // Dynamic import to handle ESM modules
    const { default: jsPDF } = await import('jspdf');

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

    // Parse hex color to RGB
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 59, g: 130, b: 246 };
    };
    const themeRGB = hexToRgb(themeColor);

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Use Unicode font
    doc.setFont('helvetica');

    // Process each receipt
    receipts.forEach((receipt, index) => {
      if (index > 0) {
        doc.addPage();
      }

      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;

      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const grandTotal = subtotal + taxAmount;

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;

      // Header background
      doc.setFillColor(themeRGB.r, themeRGB.g, themeRGB.b);
      doc.rect(0, 0, pageWidth, 35, 'F');

      // Company name (white)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, pageWidth / 2, 15, { align: 'center' });

      // Company details
      if (companyAddress) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(companyAddress, pageWidth / 2, 22, { align: 'center' });
      }
      if (contactPerson) {
        doc.setFontSize(8);
        doc.text(contactPerson, pageWidth / 2, 27, { align: 'center' });
      }
      if (others) {
        doc.setFontSize(7);
        doc.text(others, pageWidth / 2, 31, { align: 'center' });
      }

      // Document type box
      doc.setDrawColor(themeRGB.r, themeRGB.g, themeRGB.b);
      doc.setLineWidth(0.5);
      doc.rect(margin, 45, pageWidth - 2 * margin, 20);

      doc.setTextColor(themeRGB.r, themeRGB.g, themeRGB.b);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(type.toUpperCase(), pageWidth / 2, 52, { align: 'center' });

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('TAX INVOICE / RECEIPT', pageWidth / 2, 60, { align: 'center' });

      // From / Bill To section
      const sectionY = 75;
      const sectionHeight = 30;
      const boxWidth = (pageWidth - 2 * margin - 5) / 2;

      // From box
      doc.setFillColor(247, 250, 252);
      doc.rect(margin, sectionY, boxWidth, sectionHeight, 'F');

      doc.setTextColor(themeRGB.r, themeRGB.g, themeRGB.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('FROM', margin + 5, sectionY + 6);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, margin + 5, sectionY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      if (companyAddress) {
        doc.text(companyAddress, margin + 5, sectionY + 18);
      }

      // Bill To box
      const billToX = margin + boxWidth + 5;
      doc.setFillColor(247, 250, 252);
      doc.rect(billToX, sectionY, boxWidth, sectionHeight, 'F');

      doc.setTextColor(themeRGB.r, themeRGB.g, themeRGB.b);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('BILL TO', billToX + 5, sectionY + 6);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(clientName, billToX + 5, sectionY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      if (clientAddress) {
        doc.text(clientAddress, billToX + 5, sectionY + 18);
      }

      // Invoice details
      const detailsY = sectionY + sectionHeight + 5;
      doc.setFillColor(237, 242, 247);
      doc.rect(margin, detailsY, pageWidth - 2 * margin, 10, 'F');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Invoice No: ${receiptNo}`, margin + 5, detailsY + 7);
      doc.text(`Date: ${date}`, margin + 100, detailsY + 7);

      // Items table
      const tableY = detailsY + 18;
      const rowHeight = 8;
      const qtyWidth = 20;
      const descWidth = 90;
      const priceWidth = 35;
      const amountWidth = 35;

      // Table header
      doc.setFillColor(themeRGB.r, themeRGB.g, themeRGB.b);
      doc.rect(margin, tableY, pageWidth - 2 * margin, rowHeight, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Qty', margin + qtyWidth / 2, tableY + 5.5, { align: 'center' });
      doc.text('Description', margin + qtyWidth + 5, tableY + 5.5);
      doc.text('Unit Price', margin + qtyWidth + descWidth + priceWidth / 2, tableY + 5.5, { align: 'center' });
      doc.text('Amount', margin + qtyWidth + descWidth + priceWidth + amountWidth / 2, tableY + 5.5, { align: 'center' });

      // Table rows
      let currentY = tableY + rowHeight;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');

      items.forEach((item, i) => {
        if (i % 2 === 0) {
          doc.setFillColor(255, 255, 255);
        } else {
          doc.setFillColor(249, 250, 251);
        }
        doc.rect(margin, currentY, pageWidth - 2 * margin, rowHeight, 'F');

        doc.setFontSize(8);
        doc.text(String(item.qty || 0), margin + qtyWidth / 2, currentY + 5.5, { align: 'center' });
        doc.text(item.description || '', margin + qtyWidth + 5, currentY + 5.5);
        doc.text(formatCurrency(item.unitCost || 0), margin + qtyWidth + descWidth + priceWidth / 2, currentY + 5.5, { align: 'center' });
        doc.text(formatCurrency(item.amount || 0), margin + qtyWidth + descWidth + priceWidth + amountWidth / 2, currentY + 5.5, { align: 'right' });

        currentY += rowHeight;
      });

      // Subtotal
      doc.setFillColor(247, 250, 252);
      doc.rect(margin + qtyWidth + descWidth, currentY, priceWidth + amountWidth, rowHeight, 'F');

      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.text('Subtotal:', margin + qtyWidth + descWidth + 5, currentY + 5.5);
      doc.setTextColor(0, 0, 0);
      doc.text(formatCurrency(subtotal), margin + qtyWidth + descWidth + priceWidth + amountWidth, currentY + 5.5, { align: 'right' });
      currentY += rowHeight;

      // Tax
      if (taxEnabled && taxAmount > 0) {
        doc.setFillColor(247, 250, 252);
        doc.rect(margin + qtyWidth + descWidth, currentY, priceWidth + amountWidth, rowHeight, 'F');

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text(`${taxName} (${taxRate}%):`, margin + qtyWidth + descWidth + 5, currentY + 5.5);
        doc.setTextColor(0, 0, 0);
        doc.text(formatCurrency(taxAmount), margin + qtyWidth + descWidth + priceWidth + amountWidth, currentY + 5.5, { align: 'right' });
        currentY += rowHeight;
      }

      // Total
      const totalY = currentY;
      doc.setFillColor(themeRGB.r, themeRGB.g, themeRGB.b);
      doc.rect(margin + qtyWidth + descWidth, totalY, priceWidth + amountWidth, rowHeight + 4, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL', margin + qtyWidth + descWidth + 5, totalY + 6);
      doc.setFontSize(12);
      doc.text(formatCurrency(grandTotal), margin + qtyWidth + descWidth + priceWidth + amountWidth, totalY + 6, { align: 'right' });

      // Terms & Conditions
      if (tc) {
        const tcY = totalY + rowHeight + 15;
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, tcY, pageWidth - margin, tcY);

        doc.setTextColor(74, 85, 104);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Terms & Conditions:', margin, tcY + 8);

        doc.setFont('helvetica', 'normal');
        doc.text(tc, margin, tcY + 15, { maxWidth: pageWidth - 2 * margin });
      }

      // Page number
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${index + 1} of ${receipts.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    });

    // Generate PDF buffer
    const pdfBuffer = doc.output('arraybuffer');

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipts.pdf"`);
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};