const fontkit = require('fontkit');
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
    const PdfPrinter = (await import('pdfmake')).default;

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
    const themeColorRgb = `rgb(${themeRGB.r}, ${themeRGB.g}, ${themeRGB.b})`;

    // Find a font that supports Chinese
    let chineseFont = null;
    const fontPaths = [
      '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
      '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
      '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
      '/usr/share/fonts/truetype/arphic/uming.ttc',
      '/usr/share/fonts/truetype/arphic/ukai.ttc',
      '/System/Library/Fonts/PingFang.ttc',
      '/System/Library/Fonts/STHeiti Light.ttc',
    ];

    for (const fontPath of fontPaths) {
      try {
        if (fs.existsSync(fontPath)) {
          chineseFont = fontkit.openSync(fontPath);
          console.log('Found font:', fontPath);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    // Get font names
    let fontNames = {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique'
    };

    if (chineseFont) {
      fontNames = {
        normal: chineseFont.fonts[0].familyName || 'Noto Sans',
        bold: chineseFont.fonts[0].familyName || 'Noto Sans',
        italics: chineseFont.fonts[0].familyName || 'Noto Sans',
        bolditalics: chineseFont.fonts[0].familyName || 'Noto Sans'
      };
    }

    const fonts = { Helvetica: fontNames };
    const printer = new PdfPrinter(fonts);

    const content = [];

    receipts.forEach((receipt, index) => {
      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'RECEIPT' } = receipt;

      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const grandTotal = subtotal + taxAmount;

      const tableBody = [
        [
          { text: 'Qty', fillColor: themeColorRgb, color: 'white', alignment: 'center' },
          { text: 'Description', fillColor: themeColorRgb, color: 'white' },
          { text: 'Unit Price', fillColor: themeColorRgb, color: 'white', alignment: 'right' },
          { text: 'Amount', fillColor: themeColorRgb, color: 'white', alignment: 'right' }
        ]
      ];

      items.forEach((item, i) => {
        tableBody.push([
          { text: String(item.qty || 0), alignment: 'center', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' },
          { text: item.description || '', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' },
          { text: formatCurrency(item.unitCost || 0), alignment: 'right', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' },
          { text: formatCurrency(item.amount || 0), alignment: 'right', fillColor: i % 2 === 0 ? 'white' : '#f9fafb' }
        ]);
      });

      tableBody.push([
        { text: '', border: [false, false, false, false] },
        { text: 'Subtotal', colSpan: 2, alignment: 'right', bold: true, fillColor: '#f7fafc' },
        { text: '', fillColor: '#f7fafc' },
        { text: formatCurrency(subtotal), alignment: 'right', fillColor: '#f7fafc' }
      ]);

      if (taxEnabled && taxAmount > 0) {
        tableBody.push([
          { text: '', border: [false, false, false, false] },
          { text: `${taxName} (${taxRate}%)`, colSpan: 2, alignment: 'right', color: '#64748b', fillColor: '#f7fafc' },
          { text: '', fillColor: '#f7fafc' },
          { text: formatCurrency(taxAmount), alignment: 'right', fillColor: '#f7fafc' }
        ]);
      }

      tableBody.push([
        { text: '', border: [false, false, false, false] },
        { text: 'TOTAL', colSpan: 2, alignment: 'right', bold: true, color: 'white', fillColor: themeColorRgb },
        { text: '', fillColor: themeColorRgb },
        { text: formatCurrency(grandTotal), alignment: 'right', bold: true, color: 'white', fillColor: themeColorRgb }
      ]);

      const receiptContent = [
        {
          fillColor: themeColorRgb,
          table: { body: [[{ text: companyName, color: 'white', fontSize: 18, bold: true, alignment: 'center' }]] },
          layout: 'noBorders',
          margin: [0, 0, 0, 5]
        }
      ];

      if (companyAddress) receiptContent.push({ text: companyAddress, color: '#e2e8f0', fontSize: 9, alignment: 'center', margin: [0, 0, 0, 3] });
      if (contactPerson) receiptContent.push({ text: contactPerson, color: '#e2e8f0', fontSize: 8, alignment: 'center', margin: [0, 0, 0, 2] });
      if (others) receiptContent.push({ text: others, color: '#cbd5e0', fontSize: 7, alignment: 'center', margin: [0, 0, 0, 5] });

      receiptContent.push({
        stack: [
          { text: type.toUpperCase(), color: themeColorRgb, fontSize: 14, bold: true, alignment: 'center', margin: [0, 10, 0, 5] },
          { text: 'TAX INVOICE / RECEIPT', color: '#4a5568', fontSize: 10, alignment: 'center' }
        ],
        border: [1, 1, 1, 1],
        borderColor: themeColorRgb,
        margin: [20, 0, 20, 10]
      });

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

      receiptContent.push({
        text: `Invoice No: ${receiptNo}          Date: ${date}`,
        fontSize: 9,
        fillColor: '#edf2f7',
        margin: [0, 0, 0, 15],
        padding: 8
      });

      receiptContent.push({
        table: {
          headerRows: 1,
          widths: [20, '*', 40, 40],
          body: tableBody
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6
        },
        margin: [0, 0, 0, 10]
      });

      if (tc) {
        receiptContent.push({
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 475, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }] },
            { text: 'Terms & Conditions:', bold: true, fontSize: 8, margin: [0, 10, 0, 5] },
            { text: tc, fontSize: 8, color: '#4a5568' }
          ],
          margin: [20, 10, 20, 0]
        });
      }

      receiptContent.push({
        text: `Page ${index + 1} of ${receipts.length}`,
        alignment: 'center',
        fontSize: 8,
        color: '#888',
        margin: [0, 20, 0, 0]
      });

      content.push(receiptContent);

      if (index < receipts.length - 1) {
        content.push({ text: '', pageBreak: 'after' });
      }
    });

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [20, 20, 20, 20],
      content,
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 10
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {});

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