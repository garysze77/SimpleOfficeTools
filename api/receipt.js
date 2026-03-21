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
    // Dynamic import pdfmake
    const PdfPrinter = await import('pdfmake');

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

    // Parse hex color
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 59, g: 130, b: 246 };
    };
    const themeRGB = hexToRgb(themeColor);
    const themeColorRgb = `rgb(${themeRGB.r}, ${themeRGB.g}, ${themeRGB.b})`;

    // Use Helvetica (basic font that supports Latin) - for Chinese we rely on system
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const printer = new PdfPrinter.default(fonts);

    // Build PDF content
    const content = [];

    receipts.forEach((receipt, index) => {
      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;

      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const grandTotal = subtotal + taxAmount;

      // Build items table
      const tableBody = [
        // Header
        [
          { text: 'Qty', fillColor: themeColorRgb, color: 'white', alignment: 'center' },
          { text: 'Description', fillColor: themeColorRgb, color: 'white' },
          { text: 'Unit Price', fillColor: themeColorRgb, color: 'white', alignment: 'right' },
          { text: 'Amount', fillColor: themeColorRgb, color: 'white', alignment: 'right' }
        ]
      ];

      // Data rows
      items.forEach((item, i) => {
        tableBody.push([
          { text: String(item.qty || 0), alignment: 'center', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' },
          { text: item.description || '', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' },
          { text: formatCurrency(item.unitCost || 0), alignment: 'right', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' },
          { text: formatCurrency(item.amount || 0), alignment: 'right', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' }
        ]);
      });

      // Subtotal
      tableBody.push([
        { text: '', border: [false, false, false, false] },
        { text: 'Subtotal', colSpan: 2, alignment: 'right', bold: true, fillColor: '#f7fafc' },
        { text: '', fillColor: '#f7fafc' },
        { text: formatCurrency(subtotal), alignment: 'right', fillColor: '#f7fafc' }
      ]);

      // Tax
      if (taxEnabled && taxAmount > 0) {
        tableBody.push([
          { text: '', border: [false, false, false, false] },
          { text: `${taxName} (${taxRate}%)`, colSpan: 2, alignment: 'right', color: '#64748b', fillColor: '#f7fafc' },
          { text: '', fillColor: '#f7fafc' },
          { text: formatCurrency(taxAmount), alignment: 'right', fillColor: '#f7fafc' }
        ]);
      }

      // Total
      tableBody.push([
        { text: '', border: [false, false, false, false] },
        { text: 'TOTAL', colSpan: 2, alignment: 'right', bold: true, color: 'white', fillColor: themeColorRgb },
        { text: '', fillColor: themeColorRgb },
        { text: formatCurrency(grandTotal), alignment: 'right', bold: true, color: 'white', fillColor: themeColorRgb }
      ]);

      // Build receipt content
      const receiptContent = [
        // Header
        {
          fillColor: themeColorRgb,
          table: { body: [[{ text: companyName, color: 'white', fontSize: 18, bold: true, alignment: 'center' }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 5] as [number, number, number, number]
        }
      ];

      if (companyAddress) {
        receiptContent.push({ text: companyAddress, color: '#e2e8f0', fontSize: 9, alignment: 'center', margin: [0, 0, 0, 3] });
      }
      if (contactPerson) {
        receiptContent.push({ text: contactPerson, color: '#e2e8f0', fontSize: 8, alignment: 'center', margin: [0, 0, 0, 2] });
      }
      if (others) {
        receiptContent.push({ text: others, color: '#cbd5e0', fontSize: 7, alignment: 'center', margin: [0, 0, 0, 5] });
      }

      // Document type box
      receiptContent.push({
        stack: [
          { text: type.toUpperCase(), color: themeColorRgb, fontSize: 14, bold: true, alignment: 'center', margin: [0, 10, 0, 5] },
          { text: 'TAX INVOICE / RECEIPT', color: '#4a5568', fontSize: 10, alignment: 'center' }
        ],
        border: [1, 1, 1, 1],
        borderColor: themeColorRgb,
        margin: [20, 0, 20, 10]
      });

      // From / Bill To
      receiptContent.push({
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'FROM', color: themeColorRgb, fontSize: 8, bold: true, margin: [0, 8, 0, 4] },
              { text: companyName, bold: true },
              { text: companyAddress || '', color: '#4a5568', fontSize: 9 }
            ]
          },
          {
            width: '50%',
            stack: [
              { text: 'BILL TO', color: themeColorRgb, fontSize: 8, bold: true, margin: [0, 8, 0, 4] },
              { text: clientName, bold: true },
              { text: clientAddress || '', color: '#4a5568', fontSize: 9 }
            ]
          }
        ],
        margin: [0, 0, 0, 10]
      });

      // Invoice details
      receiptContent.push({
        text: `Invoice No: ${receiptNo}          Date: ${date}`,
        fontSize: 9,
        fillColor: '#edf2f7',
        margin: [0, 0, 0, 15],
        padding: 8
      });

      // Items table
      receiptContent.push({
        table: {
          headerRows: 1,
          widths: [20, '*', 40, 40],
          body: tableBody
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6
        },
        margin: [0, 0, 0, 10]
      });

      // Terms & Conditions
      if (tc) {
        receiptContent.push({
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 475, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }] as any[] },
            { text: 'Terms & Conditions:', bold: true, fontSize: 8, margin: [0, 10, 0, 5] },
            { text: tc, fontSize: 8, color: '#4a5568' }
          ],
          margin: [20, 10, 20, 0]
        });
      }

      // Page number
      receiptContent.push({
        text: `Page ${index + 1} of ${receipts.length}`,
        alignment: 'center',
        fontSize: 8,
        color: '#888',
        margin: [0, 20, 0, 0]
      });

      content.push(receiptContent);

      // Add page break if not last receipt
      if (index < receipts.length - 1) {
        content.push({ text: '', pageBreak: 'after' });
      }
    });

    // Create PDF document
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 20],
      content,
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10
      }
    };

    // Generate PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {});

    pdfDoc.end();

    // Wait for PDF to be generated
    await new Promise(resolve => pdfDoc.on('end', resolve));

    const pdfBuffer = Buffer.concat(chunks);

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipts.pdf"`);
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};