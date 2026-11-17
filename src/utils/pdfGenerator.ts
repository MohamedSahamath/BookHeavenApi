import PDFDocument from 'pdfkit';
import { Response } from 'express';

const BRAND = '#1e3a8a';
const GREY = '#6b7280';

export const formatLKR = (amount: number): string =>
  `LKR ${Number(amount || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (date?: Date | string): string =>
  date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const drawHeader = (doc: PDFKit.PDFDocument, title: string) => {
  doc.roundedRect(50, 45, 42, 42, 6).fill(BRAND);
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('BH', 50, 57, { width: 42, align: 'center' });

  doc.fillColor(BRAND).fontSize(20).text('BookHaven', 102, 47);
  doc.fillColor(GREY).fontSize(9).font('Helvetica')
    .text('Online Book Shopping & Nationwide Delivery', 102, 70)
    .text('No. 25, Galle Road, Colombo 03, Sri Lanka | +94 11 234 5678 | support@bookhaven.lk', 102, 82);

  doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold').text(title, 50, 45, { align: 'right' });
  doc.moveTo(50, 105).lineTo(545, 105).strokeColor('#e5e7eb').stroke();
  doc.font('Helvetica').fillColor('#111827');
};

const startPdf = (res: Response, fileName: string) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);
  return doc;
};

//Invoice
export interface InvoiceData {
  invoiceNumber: string;
  orderNumber: string;
  orderId: string;
  invoiceDate: Date;
  customerName: string;
  customerEmail?: string;
  address: string[];
  items: { title: string; authors: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  deliveryCharge: number;
  total: number;
  paymentMethod: string;
  transactionRef: string;
  paymentStatus: string;
}

export const generateInvoicePdf = (res: Response, data: InvoiceData) => {
  const doc = startPdf(res, `${data.invoiceNumber}.pdf`);
  drawHeader(doc, 'INVOICE');

  // Invoice details
  doc.fontSize(10).font('Helvetica-Bold').text('Invoice Details', 50, 120);
  doc.font('Helvetica').fillColor(GREY)
    .text(`Invoice No: ${data.invoiceNumber}`, 50, 136)
    .text(`Order No: ${data.orderNumber}`)
    .text(`Order ID: ${data.orderId}`)
    .text(`Invoice Date: ${formatDate(data.invoiceDate)}`);

  doc.fillColor('#111827').font('Helvetica-Bold').text('Bill To', 320, 120);
  doc.font('Helvetica').fillColor(GREY).text(data.customerName, 320, 136);
  if (data.customerEmail) doc.text(data.customerEmail, 320);
  data.address.forEach((line) => doc.text(line, 320));

  // Items table
  let y = 230;
  doc.rect(50, y, 495, 22).fill('#f3f4f6');
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9);
  doc.text('Book', 58, y + 7, { width: 190 });
  doc.text('Author(s)', 250, y + 7, { width: 110 });
  doc.text('Qty', 362, y + 7, { width: 30, align: 'right' });
  doc.text('Unit Price', 395, y + 7, { width: 70, align: 'right' });
  doc.text('Amount', 468, y + 7, { width: 70, align: 'right' });

  doc.font('Helvetica').fontSize(9);
  y += 28;
  data.items.forEach((item) => {
    const rowHeight = Math.max(doc.heightOfString(item.title, { width: 190 }), doc.heightOfString(item.authors, { width: 110 })) + 8;
    if (y + rowHeight > 720) {
      doc.addPage();
      y = 60;
    }
    doc.fillColor('#111827').text(item.title, 58, y, { width: 190 });
    doc.fillColor(GREY).text(item.authors, 250, y, { width: 110 });
    doc.fillColor('#111827')
      .text(String(item.quantity), 362, y, { width: 30, align: 'right' })
      .text(formatLKR(item.unitPrice), 395, y, { width: 70, align: 'right' })
      .text(formatLKR(item.lineTotal), 468, y, { width: 70, align: 'right' });
    y += rowHeight;
    doc.moveTo(50, y - 3).lineTo(545, y - 3).strokeColor('#f3f4f6').stroke();
  });

  // Totals
  y += 10;
  const totalLine = (label: string, value: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 10).fillColor('#111827');
    doc.text(label, 340, y, { width: 110, align: 'right' });
    doc.text(value, 455, y, { width: 83, align: 'right' });
    y += bold ? 20 : 16;
  };
  totalLine('Subtotal', formatLKR(data.subtotal));
  totalLine('Delivery Charges', data.deliveryCharge === 0 ? 'FREE' : formatLKR(data.deliveryCharge));
  doc.moveTo(340, y).lineTo(545, y).strokeColor('#e5e7eb').stroke();
  y += 6;
  totalLine('Total Amount', formatLKR(data.total), true);

  // Payment information
  y += 20;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text('Payment Information', 50, y);
  doc.font('Helvetica').fillColor(GREY)
    .text(`Payment Method: ${data.paymentMethod}`, 50, y + 16)
    .text(`Transaction Reference: ${data.transactionRef}`)
    .text(`Payment Status: ${data.paymentStatus}`);

  doc.fontSize(9).fillColor(GREY).text(
    'Thank you for shopping with BookHaven! Orders are delivered island-wide within 5 calendar days.',
    50, 760, { align: 'center', width: 495 }
  );

  doc.end();
};

//Generic table report
export interface ReportColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface ReportData {
  fileName: string;
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: string[][];
  summary?: [string, string][];
}

export const generateTableReport = (res: Response, data: ReportData) => {
  const doc = startPdf(res, data.fileName);
  drawHeader(doc, 'REPORT');

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text(data.title, 50, 120);
  doc.fontSize(9).font('Helvetica').fillColor(GREY)
    .text(data.subtitle, 50, 140)
    .text(`Generated: ${new Date().toLocaleString('en-GB')}`, 50, 152);

  let y = 175;

  // Summary boxes
  if (data.summary && data.summary.length > 0) {
    const boxWidth = 495 / data.summary.length;
    data.summary.forEach(([label, value], i) => {
      const x = 50 + i * boxWidth;
      doc.rect(x + 2, y, boxWidth - 4, 44).fill('#eff6ff');
      doc.fillColor(GREY).fontSize(8).text(label, x + 10, y + 8, { width: boxWidth - 20 });
      doc.fillColor(BRAND).fontSize(11).font('Helvetica-Bold').text(value, x + 10, y + 22, { width: boxWidth - 20 });
      doc.font('Helvetica');
    });
    y += 60;
  }

  const drawTableHeader = () => {
    doc.rect(50, y, 495, 20).fill(BRAND);
    let x = 54;
    doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
    data.columns.forEach((col) => {
      doc.text(col.header, x, y + 6, { width: col.width - 6, align: col.align || 'left' });
      x += col.width;
    });
    doc.font('Helvetica');
    y += 24;
  };

  drawTableHeader();

  if (data.rows.length === 0) {
    doc.fillColor(GREY).fontSize(10).text('No records for this period.', 50, y + 10, { align: 'center', width: 495 });
  }

  data.rows.forEach((row, index) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
      drawTableHeader();
    }
    if (index % 2 === 1) doc.rect(50, y - 3, 495, 16).fill('#f9fafb');
    let x = 54;
    doc.fillColor('#111827').fontSize(8);
    row.forEach((cell, i) => {
      const col = data.columns[i];
      doc.text(cell, x, y, { width: col.width - 6, align: col.align || 'left', lineBreak: false, ellipsis: true });
      x += col.width;
    });
    y += 16;
  });

  doc.end();
};