const { jsPDF } = require('jspdf');
require('jspdf-autotable');

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
    const {
      // Company info
      companyName,
      companyAddress = '',
      contactPerson = '',
      others = '',

      // Receipt data
      receipts = [],

      // Options
      themeColor = '#3b82f6',
      template = 'classic',
      tc = ''
    } = req.body;

    // Validation
    if (!companyName) {
      return res.status(400).json({ error: 'companyName is required' });
    }

    if (!receipts || receipts.length === 0) {
      return res.status(400).json({ error: 'receipts array is required' });
    }

    // Parse theme color
    const rgb = hexToRgb(themeColor);

    // Create PDF
    const doc = new jsPDF();

    for (let i = 0; i < receipts.length; i++) {
      if (i > 0) {
        doc.addPage();
      }

      const receipt = receipts[i];
      const {
        receiptNo = '',
        date = '',
        clientName = '',
        clientAddress = '',
        items = [],
        type = 'RECEIPT'
      } = receipt;

      // Calculate total
      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

      // Render receipt based on template
      switch (template) {
        case 'modern':
          renderModernTemplate(doc, { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum: i + 1, totalPages: receipts.length });
          break;
        case 'minimal':
          renderMinimalTemplate(doc, { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum: i + 1, totalPages: receipts.length });
          break;
        case 'bold':
          renderBoldTemplate(doc, { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum: i + 1, totalPages: receipts.length });
          break;
        default:
          renderClassicTemplate(doc, { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum: i + 1, totalPages: receipts.length });
      }
    }

    // Return PDF
    const pdfBuffer = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipts.pdf"`);
    return res.send(Buffer.from(pdfBuffer));

  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
  }
};

// Classic Template (original)
function renderClassicTemplate(doc, data) {
  const { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum, totalPages } = data;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header with theme color
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, pageWidth / 2, 18, { align: 'center' });

  // Company details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (companyAddress) doc.text(companyAddress, pageWidth / 2, 26, { align: 'center' });
  if (contactPerson) doc.text(contactPerson, pageWidth / 2, 32, { align: 'center' });
  if (others) doc.text(others, pageWidth / 2, 38, { align: 'center' });

  y = 55;

  // Invoice title box
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(1);
  doc.roundedRect(15, y, pageWidth - 30, 25, 3, 3, 'S');

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(type.toUpperCase(), pageWidth / 2, y + 10, { align: 'center' });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(11);
  doc.text('TAX INVOICE / RECEIPT', pageWidth / 2, y + 18, { align: 'center' });

  y += 35;

  // From / Bill To section
  doc.setFillColor(247, 250, 252);
  doc.roundedRect(15, y, pageWidth - 30, 30, 2, 2, 'F');

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FROM', 20, y + 8);

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 20, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (companyAddress) doc.text(doc.splitTextToSize(companyAddress, 70), 20, y + 21);

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', pageWidth / 2 + 5, y + 8);

  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(clientName || '-', pageWidth / 2 + 5, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (clientAddress) doc.text(doc.splitTextToSize(clientAddress, 70), pageWidth / 2 + 5, y + 21);

  y += 40;

  // Invoice details
  doc.setFillColor(237, 242, 247);
  doc.rect(15, y, pageWidth - 30, 12, 'F');

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No:`, 20, y + 8);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text(receiptNo || '-', 50, y + 8);

  doc.setTextColor(50, 50, 50);
  doc.text(`Date:`, pageWidth - 60, y + 8);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text(date || '-', pageWidth - 40, y + 8);

  y += 15;

  // Items table
  const tableData = items.map(item => [item.qty || 0, item.description || '-', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)]);

  doc.autoTable({
    startY: y,
    head: [['Qty', 'Description', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } },
    margin: { left: 15, right: 15 }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Total box
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.roundedRect(pageWidth - 95, y, 80, 20, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', pageWidth - 85, y + 13);
  doc.setFontSize(16);
  doc.text(formatCurrency(subtotal), pageWidth - 25, y + 13, { align: 'right' });

  y += 30;

  // Terms & Conditions
  if (tc) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(tc, pageWidth - 30), 15, y);
  }

  // Page number
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
}

// Modern Template
function renderModernTemplate(doc, data) {
  const { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum, totalPages } = data;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header - clean with bottom border
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 50, 'F');

  // Company name left
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName, 15, 25);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  if (companyAddress) doc.text(companyAddress, 15, 33);
  if (contactPerson) doc.text(contactPerson, 15, 40);

  // Type label right
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(pageWidth - 65, 10, 50, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(type.toUpperCase(), pageWidth - 40, 27, { align: 'center' });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('TAX INVOICE / RECEIPT', pageWidth - 40, 40, { align: 'center' });

  y = 55;

  // Divider line
  doc.setDrawColor(rgb.r, rgb.g, rgb.b);
  doc.setLineWidth(2);
  doc.line(15, y, pageWidth - 15, y);

  y += 15;

  // Bill To and Details side by side
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, y, 90, 35, 2, 2, 'F');
  doc.roundedRect(pageWidth - 105, y, 90, 35, 2, 2, 'F');

  // Bill To
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 20, y + 10);
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(clientName || '-', 20, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  if (clientAddress) doc.text(doc.splitTextToSize(clientAddress, 70), 20, y + 26);

  // Details
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No: ${receiptNo || '-'}`, pageWidth - 95, y + 10);
  doc.text(`Date: ${date || '-'}`, pageWidth - 95, y + 18);

  y += 45;

  // Items table with border
  const tableData = items.map(item => [item.qty || 0, item.description || '-', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)]);

  doc.autoTable({
    startY: y,
    head: [['Qty', 'Description', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [rgb.r, rgb.g, rgb.b], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } },
    margin: { left: 15, right: 15 }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Total right aligned
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.roundedRect(pageWidth - 95, y, 80, 20, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', pageWidth - 85, y + 13);
  doc.setFontSize(16);
  doc.text(formatCurrency(subtotal), pageWidth - 25, y + 13, { align: 'right' });

  y += 30;

  // Terms & Conditions
  if (tc) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(tc, pageWidth - 30), 15, y);
  }

  // Page number
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
}

// Minimal Template
function renderMinimalTemplate(doc, data) {
  const { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum, totalPages } = data;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Simple header
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'normal');
  doc.text(companyName, 15, y + 10);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(10);
  if (companyAddress) doc.text(companyAddress, 15, y + 18);
  if (contactPerson) doc.text(contactPerson, 15, y + 25);

  y = 45;

  // Centered title with lines
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(1);
  doc.line(15, y, pageWidth - 15, y);

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'normal');
  doc.text(type.toUpperCase(), pageWidth / 2, y + 20, { align: 'center' });

  doc.setDrawColor(229, 231, 235);
  doc.line(15, y + 28, pageWidth - 15, y + 28);

  y += 40;

  // From / To
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`From: ${companyName}`, 15, y);
  doc.text(`To: ${clientName || '-'}`, pageWidth / 2, y);

  y += 15;

  // Simple table with bottom border
  doc.autoTable({
    startY: y,
    head: [['Qty', 'Description', 'Unit Price', 'Amount']],
    body: items.map(item => [item.qty || 0, item.description || '-', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)]),
    theme: 'plain',
    headStyles: { fillColor: [255, 255, 255], textColor: [31, 41, 55], fontStyle: 'bold', fontSize: 10, borderBottom: '2px solid #1f2937' },
    bodyStyles: { fontSize: 9, textColor: [31, 41, 55] },
    columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } },
    margin: { left: 15, right: 15 }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Invoice details and total
  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(2);
  doc.line(15, y, pageWidth - 15, y);

  y += 10;
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice No: ${receiptNo || '-'}`, 15, y);
  doc.text(`Date: ${date || '-'}`, 80, y);

  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL: ', pageWidth - 70, y);
  doc.setFontSize(18);
  doc.text(formatCurrency(subtotal), pageWidth - 15, y, { align: 'right' });

  y += 20;

  // Terms & Conditions
  if (tc) {
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;
    doc.setTextColor(107, 114, 128);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(tc, pageWidth - 30), 15, y);
  }

  // Page number
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
}

// Bold Template
function renderBoldTemplate(doc, data) {
  const { companyName, companyAddress, contactPerson, others, receiptNo, date, clientName, clientAddress, items, type, subtotal, themeColor, rgb, tc, pageNum, totalPages } = data;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Full width header
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, pageWidth, 55, 'F');

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(companyName.toUpperCase(), pageWidth / 2, 22, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  if (companyAddress) doc.text(companyAddress, pageWidth / 2, 32, { align: 'center' });
  if (contactPerson) doc.text(contactPerson, pageWidth / 2, 40, { align: 'center' });
  if (others) doc.text(others, pageWidth / 2, 48, { align: 'center' });

  y = 65;

  // Centered type label
  doc.setFillColor(31, 41, 55);
  doc.roundedRect(pageWidth / 2 - 50, y, 100, 18, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(type.toUpperCase(), pageWidth / 2, y + 12, { align: 'center' });

  y += 30;

  // Bill To and Details boxes
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(15, y, 85, 40, 2, 2, 'F');
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(3);
  doc.roundedRect(15, y, 85, 40, 2, 2, 'S');

  doc.setTextColor(146, 64, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 20, y + 10);
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(12);
  doc.text(clientName || '-', 20, y + 20);
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14);
  if (clientAddress) doc.text(doc.splitTextToSize(clientAddress, 65), 20, y + 28);

  doc.setFillColor(219, 234, 254);
  doc.roundedRect(pageWidth - 100, y, 85, 40, 2, 2, 'F');
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(pageWidth - 100, y, 85, 40, 2, 2, 'S');

  doc.setTextColor(30, 64, 175);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DETAILS', pageWidth - 95, y + 10);
  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.text(`Invoice No:`, pageWidth - 95, y + 20);
  doc.text(receiptNo || '-', pageWidth - 60, y + 20);
  doc.text(`Date:`, pageWidth - 95, y + 28);
  doc.text(date || '-', pageWidth - 75, y + 28);

  y += 50;

  // Items table with shadow
  doc.autoTable({
    startY: y,
    head: [['Qty', 'Description', 'Unit Price', 'Amount']],
    body: items.map(item => [item.qty || 0, item.description || '-', formatCurrency(item.unitCost || 0), formatCurrency(item.amount || 0)]),
    theme: 'grid',
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right', cellWidth: 35 }, 3: { halign: 'right', cellWidth: 35 } },
    margin: { left: 15, right: 15 }
  });

  y = doc.lastAutoTable.finalY + 10;

  // Total box
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.roundedRect(pageWidth - 95, y, 80, 22, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', pageWidth - 85, y + 14);
  doc.setFontSize(18);
  doc.text(formatCurrency(subtotal), pageWidth - 25, y + 14, { align: 'right' });

  y += 32;

  // Terms & Conditions
  if (tc) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions:', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(tc, pageWidth - 30), 15, y);
  }

  // Page number
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
}

function formatCurrency(amount) {
  return '$' + parseFloat(amount).toFixed(2);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 59, g: 130, b: 246 };
}
