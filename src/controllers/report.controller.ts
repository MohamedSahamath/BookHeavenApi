import { Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { generateTableReport, formatLKR } from '../utils/pdfGenerator';
import * as reportService from '../services/report.service';

const readYear = (req: Request) => Number(req.query.year) || new Date().getFullYear();
const readMonth = (req: Request) => {
  const m = Number(req.query.month);
  return m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
};
const shortDate = (d?: Date) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

export const getAnalytics = asyncHandler(async (req, res) => {
  sendSuccess(res, await reportService.getAnalytics(readYear(req)), 'Analytics loaded');
});

export const getProfitReport = asyncHandler(async (req, res) => {
  const period = (['monthly', 'quarterly', 'yearly'].includes(String(req.query.period)) ? req.query.period : 'monthly') as
    | 'monthly'
    | 'quarterly'
    | 'yearly';
  sendSuccess(res, await reportService.getProfitReport(period, readYear(req)), 'Profit report loaded');
});

export const salesPdf = asyncHandler(async (req, res) => {
  const year = readYear(req);
  const month = readMonth(req);
  const orders = await reportService.getSalesReportData(year, month);
  const total = orders.reduce((s, o) => s + o.totalAmount, 0);
  const books = orders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0);

  generateTableReport(res, {
    fileName: `sales-${year}-${month}.pdf`,
    title: 'Monthly Sales Report',
    subtitle: `${reportService.monthName(month)} ${year}`,
    summary: [
      ['Paid orders', String(orders.length)],
      ['Books sold', String(books)],
      ['Total sales', formatLKR(total)],
    ],
    columns: [
      { header: 'Date', width: 65 },
      { header: 'Order No', width: 105 },
      { header: 'Invoice', width: 105 },
      { header: 'Customer', width: 110 },
      { header: 'Items', width: 35, align: 'right' },
      { header: 'Total', width: 75, align: 'right' },
    ],
    rows: orders.map((o) => [
      shortDate(o.confirmedAt),
      o.orderNumber,
      o.invoiceNumber || '-',
      (o.customer as unknown as { fullName: string })?.fullName || '-',
      String(o.items.reduce((x, i) => x + i.quantity, 0)),
      formatLKR(o.totalAmount),
    ]),
  });
});

export const expensesPdf = asyncHandler(async (req, res) => {
  const year = readYear(req);
  const month = readMonth(req);
  const expenses = await reportService.getExpenseReportData(year, month);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const supplier = expenses.filter((e) => e.category === 'SUPPLIER_PAYMENT').reduce((s, e) => s + e.amount, 0);

  generateTableReport(res, {
    fileName: `expenses-${year}-${month}.pdf`,
    title: 'Monthly Expenses Report',
    subtitle: `${reportService.monthName(month)} ${year}`,
    summary: [
      ['Records', String(expenses.length)],
      ['Supplier payments', formatLKR(supplier)],
      ['Total expenses', formatLKR(total)],
    ],
    columns: [
      { header: 'Date', width: 70 },
      { header: 'Title', width: 190 },
      { header: 'Category', width: 115 },
      { header: 'Amount', width: 120, align: 'right' },
    ],
    rows: expenses.map((e) => [shortDate(e.expenseDate), e.title, e.category.replace('_', ' '), formatLKR(e.amount)]),
  });
});

export const profitPdf = asyncHandler(async (req, res) => {
  const year = readYear(req);
  const months = await reportService.getMonthlyFinancials(year);
  const revenue = months.reduce((s, m) => s + m.revenue, 0);
  const expenses = months.reduce((s, m) => s + m.expenses, 0);

  generateTableReport(res, {
    fileName: `profit-${year}.pdf`,
    title: 'Profit Report (Monthly)',
    subtitle: `Year ${year}  |  Profit = Revenue - Expenses`,
    summary: [
      ['Revenue', formatLKR(revenue)],
      ['Expenses', formatLKR(expenses)],
      ['Net profit', formatLKR(revenue - expenses)],
    ],
    columns: [
      { header: 'Month', width: 75 },
      { header: 'Orders', width: 60, align: 'right' },
      { header: 'Revenue', width: 120, align: 'right' },
      { header: 'Expenses', width: 120, align: 'right' },
      { header: 'Profit', width: 120, align: 'right' },
    ],
    rows: months.map((m) => [m.label, String(m.orders), formatLKR(m.revenue), formatLKR(m.expenses), formatLKR(m.profit)]),
  });
});

// ---------- PDF: operations (ADMIN + MANAGER) ----------
export const inventoryPdf = asyncHandler(async (_req, res) => {
  const items = await reportService.getInventoryReportData();
  const totalStock = items.reduce((s, i) => s + i.quantity, 0);
  const out = items.filter((i) => i.quantity === 0).length;
  const low = items.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockLevel).length;

  generateTableReport(res, {
    fileName: 'inventory-report.pdf',
    title: 'Inventory Report',
    subtitle: 'Current stock of all books',
    summary: [
      ['Books', String(items.length)],
      ['Total copies', String(totalStock)],
      ['Low stock', String(low)],
      ['Out of stock', String(out)],
    ],
    columns: [
      { header: 'Title', width: 205 },
      { header: 'ISBN', width: 95 },
      { header: 'Stock', width: 50, align: 'right' },
      { header: 'Low level', width: 55, align: 'right' },
      { header: 'Status', width: 90 },
    ],
    rows: items.map((i) => {
      const book = i.book as unknown as { title: string; isbn: string } | null;
      const status = i.quantity === 0 ? 'OUT OF STOCK' : i.quantity <= i.lowStockLevel ? 'LOW STOCK' : 'IN STOCK';
      return [book?.title || '-', book?.isbn || '-', String(i.quantity), String(i.lowStockLevel), status];
    }),
  });
});

export const supplierDeliveriesPdf = asyncHandler(async (req, res) => {
  const year = readYear(req);
  const month = readMonth(req);
  const orders = await reportService.getSupplierDeliveryReportData(year, month);

  generateTableReport(res, {
    fileName: `supplier-deliveries-${year}-${month}.pdf`,
    title: 'Supplier Deliveries Report',
    subtitle: `${reportService.monthName(month)} ${year}`,
    summary: [
      ['Supplier orders', String(orders.length)],
      ['Ordered copies', String(orders.reduce((s, o) => s + o.orderedQuantity, 0))],
      ['Received copies', String(orders.reduce((s, o) => s + o.receivedQuantity, 0))],
    ],
    columns: [
      { header: 'Reference', width: 90 },
      { header: 'Supplier', width: 95 },
      { header: 'Book', width: 125 },
      { header: 'Ordered', width: 45, align: 'right' },
      { header: 'Received', width: 50, align: 'right' },
      { header: 'Status', width: 90 },
    ],
    rows: orders.map((o) => [
      o.referenceNumber,
      (o.supplier as unknown as { name: string })?.name || '-',
      (o.book as unknown as { title: string })?.title || '-',
      String(o.orderedQuantity),
      String(o.receivedQuantity),
      o.status.replace('_', ' '),
    ]),
  });
});

export const orderSummaryPdf = asyncHandler(async (req, res) => {
  const year = readYear(req);
  const month = readMonth(req);
  const { byStatus, orders } = await reportService.getOrderSummaryData(year, month);
  const count = (status: string) => byStatus.find((s: { _id: string }) => s._id === status)?.count || 0;

  generateTableReport(res, {
    fileName: `order-summary-${year}-${month}.pdf`,
    title: 'Order Summary Report',
    subtitle: `${reportService.monthName(month)} ${year}`,
    summary: [
      ['All orders', String(orders.length)],
      ['Delivered', String(count('DELIVERED'))],
      ['In progress', String(count('CONFIRMED') + count('PROCESSING') + count('DISPATCHED') + count('OUT_FOR_DELIVERY'))],
      ['Cancelled', String(count('CANCELLED'))],
    ],
    columns: [
      { header: 'Date', width: 65 },
      { header: 'Order No', width: 110 },
      { header: 'Customer', width: 120 },
      { header: 'District', width: 75 },
      { header: 'Status', width: 125 },
    ],
    rows: orders.map((o) => [
      shortDate(o.createdAt),
      o.orderNumber,
      (o.customer as unknown as { fullName: string })?.fullName || '-',
      o.shippingAddress.district,
      o.status.replace(/_/g, ' '),
    ]),
  });
});