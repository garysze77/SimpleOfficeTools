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

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margin: 50
    });

    if (hasChineseFont) {
      doc.registerFont('NotoSans', fontPath);
    }

    const font = hasChineseFont ? 'NotoSans' : 'Helvetica';

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // A4: 595.28 x 841.89 points
    const PW = 595.28;
    const PH = 841.89;
    const ML = 50; // margin left
    const MR = 50; // margin right
    const MT = 50; // margin top
    const CW = PW - ML - MR; // content width = 495

    // Column definitions - each column width should sum to CW
    const COL = {
      qty: { x: ML, w: 50, label: 'Qty', align: 'center' },
      desc: { x: ML + 50, w: 230, label: 'Description', align: 'left' },
      unit: { x: ML + 280, w: 90, label: 'Unit', align: 'right' },
      amt: { x: ML + 370, w: 125, label: 'Amount', align: 'right' }
    };
    // Total: qty(50) + desc(230) + unit(90) + amt(125) = 495 = CW

    const ROW = 20; // row height
    const HDR = 25; // header row height

    const cyan = '#00BCD4';
    const lgray = '#f0f0f0';
    const dgray = '#666666';

    // Process each receipt
    receipts.forEach((receipt, idx) => {
      if (idx > 0) doc.addPage();

      const { receiptNo = '', date = '', clientName = '', clientAddress = '', items = [], type = 'INVOICE' } = receipt;

      let y = MT;

      // === HEADER ===
      doc.rect(0, 0, PW, 60).fill(themeColor);
      doc.fillColor('#ffffff').fontSize(20).font(font).text(companyName, ML, 12, { align: 'center', width: CW });
      if (companyAddress) doc.fontSize(10).text(companyAddress, ML, 32, { align: 'center', width: CW });
      if (contactPerson) doc.fontSize(9).text(contactPerson, ML, 44, { align: 'center', width: CW });

      y = 70;

      // === TYPE BOX ===
      doc.rect(ML, y, CW, 30).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(16).font(font).text(type.toUpperCase(), ML, y + 7, { align: 'center', width: CW });

      y += 40;

      // === FROM / BILL TO ===
      const BW = (CW - 10) / 2;

      // FROM box
      doc.rect(ML, y, BW, 55).fillAndStroke(lgray, '#cccccc');
      doc.fillColor(themeColor).fontSize(8).font(font).text('FROM', ML + 8, y + 6);
      doc.fillColor('#000000').fontSize(11).text(companyName, ML + 8, y + 18);
      if (companyAddress) doc.fillColor(dgray).fontSize(9).text(companyAddress, ML + 8, y + 32);

      // BILL TO box
      const BTX = ML + BW + 10;
      doc.rect(BTX, y, BW, 55).fillAndStroke(lgray, '#cccccc');
      doc.fillColor(themeColor).fontSize(8).font(font).text('BILL TO', BTX + 8, y + 6);
      doc.fillColor('#000000').fontSize(11).text(clientName, BTX + 8, y + 18);
      if (clientAddress) doc.fillColor(dgray).fontSize(9).text(clientAddress, BTX + 8, y + 32);

      y += 65;

      // === INVOICE DETAILS BAR ===
      doc.rect(ML, y, CW, 18).fillAndStroke('#e0e0e0', '#cccccc');
      doc.fillColor('#000000').fontSize(9).font(font);
      doc.text(`Invoice No: ${receiptNo}`, ML + 8, y + 4);
      doc.text(`Date: ${date}`, ML + CW - 100, y + 4, { width: 95, align: 'right' });

      y += 28;

      // === TABLE HEADER ===
      doc.rect(ML, y, CW, HDR).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(10).font(font);
      doc.text('Qty', COL.qty.x + 5, y + 7, { width: COL.qty.w - 10, align: COL.qty.align });
      doc.text('Description', COL.desc.x + 5, y + 7, { width: COL.desc.w - 10, align: COL.desc.align });
      doc.text('Unit', COL.unit.x + 5, y + 7, { width: COL.unit.w - 10, align: COL.unit.align });
      doc.text('Amount', COL.amt.x + 5, y + 7, { width: COL.amt.w - 10, align: COL.amt.align });

      y += HDR;

      // === TABLE ROWS ===
      items.forEach((item, i) => {
        const bg = i % 2 === 0 ? '#ffffff' : lgray;
        doc.rect(ML, y, CW, ROW).fillAndStroke(bg, '#dddddd');
        doc.fillColor('#000000').fontSize(9).font(font);
        doc.text(String(item.qty || 0), COL.qty.x + 5, y + 5, { width: COL.qty.w - 10, align: COL.qty.align });
        doc.text(item.description || '', COL.desc.x + 5, y + 5, { width: COL.desc.w - 10, align: COL.desc.align });
        doc.text(formatCurrency(item.unitCost || 0), COL.unit.x + 5, y + 5, { width: COL.unit.w - 10, align: COL.unit.align });
        doc.text(formatCurrency(item.amount || 0), COL.amt.x + 5, y + 5, { width: COL.amt.w - 10, align: COL.amt.align });
        y += ROW;
      });

      y += 10;

      // === SUBTOTAL ===
      const subtotal = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
      const taxAmt = taxEnabled ? subtotal * (taxRate / 100) : 0;
      const total = subtotal + taxAmt;

      // Subtotal label
      doc.rect(ML + 280, y, CW - 280, ROW).fillAndStroke(lgray, '#cccccc');
      doc.fillColor(dgray).fontSize(9).font(font).text('Subtotal:', ML + 288, y + 5);
      doc.fillColor('#000000').text(formatCurrency(subtotal), ML + CW - 8, y + 5, { width: 115, align: 'right' });

      y += ROW;

      // Tax
      if (taxEnabled && taxAmt > 0) {
        doc.rect(ML + 280, y, CW - 280, ROW).fillAndStroke(lgray, '#cccccc');
        doc.fillColor(dgray).fontSize(9).font(font).text(`${taxName} (${taxRate}%):`, ML + 288, y + 5);
        doc.fillColor('#000000').text(formatCurrency(taxAmt), ML + CW - 8, y + 5, { width: 115, align: 'right' });
        y += ROW;
      }

      // Total
      y += 5;
      doc.rect(ML + 280, y, CW - 280, ROW + 4).fillAndStroke(themeColor, themeColor);
      doc.fillColor('#ffffff').fontSize(11).font(font).text('TOTAL:', ML + 288, y + 8);
      doc.fontSize(14).text(formatCurrency(total), ML + CW - 8, y + 7, { width: 115, align: 'right' });

      y += ROW + 15;

      // === TERMS & CONDITIONS ===
      if (tc) {
        doc.moveTo(ML, y).lineTo(ML + CW, y).stroke('#cccccc');
        doc.fillColor(dgray).fontSize(8).font(font).text('Terms & Conditions:', ML, y + 8);
        doc.fontSize(9).text(tc, ML, y + 20, { width: CW });
        y += 40;
      }

      // === FOOTER ===
      doc.fillColor('#aaaaaa').fontSize(8).text(`Page ${idx + 1} of ${receipts.length}`, ML, PH - 40, { align: 'center', width: CW });
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
