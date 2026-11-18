import { Order } from '../models/order.model';
import { Expense } from '../models/expense.model';
import { User } from '../models/user.model';
import { Book } from '../models/book.model';
import { Inventory } from '../models/inventory.model';
import { SupplierOrder } from '../models/supplierOrder.model';
import { getInventorySummary } from './inventory.service';
import { getOrderStats } from './order.service';
import { getComplaintStats } from './complaint.service';
import { getDeliveryStats } from './delivery.service';
import { getSupplierStats } from './supplier.service';

const TZ = 'Asia/Colombo';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const paidOrderMatch = { paymentStatus: 'SUCCESS', status: { $ne: 'CANCELLED' } };

const yearRange = (year: number) => ({
  $gte: new Date(`${year}-01-01T00:00:00+05:30`),
  $lt: new Date(`${year + 1}-01-01T00:00:00+05:30`),
});

const monthRange = (year: number, month: number) => {
  const start = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+05:30`);
  const end = month === 12
    ? new Date(`${year + 1}-01-01T00:00:00+05:30`)
    : new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00+05:30`);
  return { $gte: start, $lt: end };
};

export interface MonthlyRow {
  month: number;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  orders: number;
  booksSold: number;
}

export const getMonthlyFinancials = async (year: number): Promise<MonthlyRow[]> => {
  const [revenueByMonth, expensesByMonth] = await Promise.all([
    Order.aggregate([
      { $match: { ...paidOrderMatch, confirmedAt: yearRange(year) } },
      {
        $group: {
          _id: { $month: { date: '$confirmedAt', timezone: TZ } },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 },
          booksSold: { $sum: { $sum: '$items.quantity' } },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { expenseDate: yearRange(year) } },
      { $group: { _id: { $month: { date: '$expenseDate', timezone: TZ } }, expenses: { $sum: '$amount' } } },
    ]),
  ]);

  return MONTHS.map((label, index) => {
    const month = index + 1;
    const r = revenueByMonth.find((x: { _id: number }) => x._id === month);
    const e = expensesByMonth.find((x: { _id: number }) => x._id === month);
    const revenue = r ? r.revenue : 0;
    const expenses = e ? e.expenses : 0;
    return {
      month,
      label,
      revenue,
      expenses,
      profit: revenue - expenses,
      orders: r ? r.orders : 0,
      booksSold: r ? r.booksSold : 0,
    };
  });
};

export const getProfitReport = async (period: 'monthly' | 'quarterly' | 'yearly', year: number) => {
  if (period === 'yearly') {
    const years = [year - 2, year - 1, year];
    const rows = [];
    for (const y of years) {
      const months = await getMonthlyFinancials(y);
      const revenue = months.reduce((s, m) => s + m.revenue, 0);
      const expenses = months.reduce((s, m) => s + m.expenses, 0);
      rows.push({ label: String(y), revenue, expenses, profit: revenue - expenses, orders: months.reduce((s, m) => s + m.orders, 0) });
    }
    return rows;
  }

  const months = await getMonthlyFinancials(year);
  if (period === 'monthly') return months;

  return [1, 2, 3, 4].map((q) => {
    const part = months.slice((q - 1) * 3, q * 3);
    const revenue = part.reduce((s, m) => s + m.revenue, 0);
    const expenses = part.reduce((s, m) => s + m.expenses, 0);
    return { label: `Q${q} ${year}`, revenue, expenses, profit: revenue - expenses, orders: part.reduce((s, m) => s + m.orders, 0) };
  });
};

export const getBestSellingBooks = async (limit = 10) =>
  Order.aggregate([
    { $match: paidOrderMatch },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.book',
        title: { $first: '$items.title' },
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.lineTotal' },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: limit },
  ]);

export const getSalesByCategory = async () =>
  Order.aggregate([
    { $match: paidOrderMatch },
    { $unwind: '$items' },
    { $lookup: { from: 'books', localField: 'items.book', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' },
    { $lookup: { from: 'categories', localField: 'book.category', foreignField: '_id', as: 'category' } },
    { $unwind: '$category' },
    {
      $group: {
        _id: '$category._id',
        category: { $first: '$category.name' },
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.lineTotal' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

export const getExpenseBreakdown = async (year: number, month?: number) =>
  Expense.aggregate([
    { $match: { expenseDate: month ? monthRange(year, month) : yearRange(year) } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

// All charts for the Admin analytics page in one call
export const getAnalytics = async (year: number) => {
  const [monthly, bestSellers, salesByCategory, inventory, expenseBreakdown] = await Promise.all([
    getMonthlyFinancials(year),
    getBestSellingBooks(10),
    getSalesByCategory(),
    getInventorySummary(),
    getExpenseBreakdown(year),
  ]);
  return { year, monthly, bestSellers, salesByCategory, inventory, expenseBreakdown };
};

//Dashboards 
export const getAdminDashboard = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [customers, managers, totalBooks, soldAgg, orderStats, complaintStats, monthly, supplierPaymentsAgg, recentOrders] =
    await Promise.all([
      User.countDocuments({ role: 'CUSTOMER' }),
      User.countDocuments({ role: 'MANAGER' }),
      Book.countDocuments({ isActive: true }),
      Book.aggregate([{ $group: { _id: null, sold: { $sum: '$soldCount' } } }]),
      getOrderStats(),
      getComplaintStats(),
      getMonthlyFinancials(year),
      Expense.aggregate([{ $match: { category: 'SUPPLIER_PAYMENT' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Order.find({ status: { $ne: 'PAYMENT_PENDING' } }).populate('customer', 'fullName').sort({ createdAt: -1 }).limit(5),
    ]);

  const thisMonth = monthly[month - 1];
  return {
    totalCustomers: customers,
    totalManagers: managers,
    totalBooks,
    totalBooksSold: soldAgg[0]?.sold || 0,
    totalOrders: orderStats.total,
    pendingOrders: orderStats.confirmed + orderStats.processing,
    deliveredOrders: orderStats.delivered,
    pendingComplaints: complaintStats.open,
    monthlyRevenue: thisMonth.revenue,
    monthlyExpenses: thisMonth.expenses,
    monthlyProfit: thisMonth.profit,
    totalSupplierPayments: supplierPaymentsAgg[0]?.total || 0,
    yearRevenue: monthly.reduce((s, m) => s + m.revenue, 0),
    yearExpenses: monthly.reduce((s, m) => s + m.expenses, 0),
    yearProfit: monthly.reduce((s, m) => s + m.profit, 0),
    monthly,
    recentOrders,
  };
};

// Manager dashboard 
export const getManagerDashboard = async () => {
  const [totalBooks, inventory, orderStats, supplierStats, complaintStats, deliveryStats, lowStock] = await Promise.all([
    Book.countDocuments({ isActive: true }),
    getInventorySummary(),
    getOrderStats(),
    getSupplierStats(),
    getComplaintStats(),
    getDeliveryStats(),
    Inventory.find({ $expr: { $lte: ['$quantity', '$lowStockLevel'] } })
      .populate('book', 'title isbn')
      .sort({ quantity: 1 })
      .limit(8),
  ]);

  return {
    totalBooks,
    availableStock: inventory.totalStock,
    lowStockBooks: inventory.lowStock,
    outOfStockBooks: inventory.outOfStock,
    totalOrders: orderStats.total,
    pendingOrders: orderStats.confirmed,
    processingOrders: orderStats.processing,
    dispatchedOrders: orderStats.dispatched + orderStats.outForDelivery,
    deliveredOrders: orderStats.delivered,
    delayedDeliveries: deliveryStats.delayed,
    pendingSupplierDeliveries: supplierStats.pending + supplierStats.partial,
    receivedSupplierDeliveries: supplierStats.received,
    overdueSupplierDeliveries: supplierStats.overdue,
    openComplaints: complaintStats.open,
    lowStockList: lowStock,
  };
};

//Data for PDF reports
export const getSalesReportData = async (year: number, month: number) => {
  const orders = await Order.find({ ...paidOrderMatch, confirmedAt: monthRange(year, month) })
    .populate('customer', 'fullName')
    .sort({ confirmedAt: 1 });
  return orders;
};

export const getExpenseReportData = (year: number, month: number) =>
  Expense.find({ expenseDate: monthRange(year, month) }).sort({ expenseDate: 1 });

export const getInventoryReportData = () =>
  Inventory.find().populate('book', 'title isbn price isActive').sort({ quantity: 1 });

export const getSupplierDeliveryReportData = (year: number, month: number) =>
  SupplierOrder.find({ orderDate: monthRange(year, month) })
    .populate('supplier', 'name')
    .populate('book', 'title')
    .sort({ orderDate: 1 });

export const getOrderSummaryData = async (year: number, month: number) => {
  const range = monthRange(year, month);
  const [byStatus, orders] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
    ]),
    Order.find({ createdAt: range }).populate('customer', 'fullName').sort({ createdAt: 1 }),
  ]);
  return { byStatus, orders };
};

export const monthName = (month: number) => MONTHS[month - 1];