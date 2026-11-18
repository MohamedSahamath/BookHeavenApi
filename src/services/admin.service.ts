import { User } from '../models/user.model';
import { Order } from '../models/order.model';
import { Expense } from '../models/expense.model';
import { ApiError } from '../utils/apiError';
import { Role, ExpenseCategory } from '../types';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listUsers = async (
  role: Role,
  query: { search?: string; status?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = { role };
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
  }
  if (query.status === 'active') filter.isActive = true;
  if (query.status === 'inactive') filter.isActive = false;

  const [users, total] = await Promise.all([
    User.find(filter).select('-addresses').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  let orderCounts = new Map<string, number>();
  if (role === 'CUSTOMER' && users.length > 0) {
    const counts = await Order.aggregate([
      { $match: { customer: { $in: users.map((u) => u._id) }, paymentStatus: 'SUCCESS' } },
      { $group: { _id: '$customer', count: { $sum: 1 } } },
    ]);
    orderCounts = new Map(counts.map((c: { _id: unknown; count: number }) => [String(c._id), c.count]));
  }

  return {
    users: users.map((u) => ({ ...u.toJSON(), orderCount: orderCounts.get(u._id.toString()) || 0 })),
    total,
    page,
    limit,
  };
};

export const createManager = async (data: { fullName: string; email: string; phone: string; password: string }) => {
  const existing = await User.findOne({ $or: [{ email: data.email }, { phone: data.phone }] });
  if (existing) throw new ApiError(409, 'Email or mobile number is already used');
  return User.create({ ...data, role: 'MANAGER' });
};

export const updateManager = async (id: string, data: { fullName?: string; email?: string; phone?: string; password?: string }) => {
  const manager = await User.findOne({ _id: id, role: 'MANAGER' });
  if (!manager) throw new ApiError(404, 'Manager not found');

  if (data.fullName) manager.fullName = data.fullName;
  if (data.email) manager.email = data.email;
  if (data.phone) manager.phone = data.phone;
  if (data.password) manager.password = data.password; // hashed in pre('save')
  await manager.save();
  return manager;
};

// Activate / deactivate any non-admin account. Deactivated users cannot log in.
export const setUserStatus = async (id: string, role: Role, isActive: boolean) => {
  const user = await User.findOne({ _id: id, role });
  if (!user) throw new ApiError(404, `${role === 'MANAGER' ? 'Manager' : 'Customer'} not found`);
  user.isActive = isActive;
  if (!isActive) user.refreshTokenHash = undefined; // force logout
  await user.save();
  return user;
};

export const getCustomerDetails = async (id: string) => {
  const customer = await User.findOne({ _id: id, role: 'CUSTOMER' });
  if (!customer) throw new ApiError(404, 'Customer not found');
  const orders = await Order.find({ customer: id }).sort({ createdAt: -1 }).limit(20);
  return { customer, orders };
};

export const listExpenses = async (
  query: { category?: string; from?: string; to?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.category) filter.category = query.category;
  if (query.from || query.to) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(`${query.to}T23:59:59`);
    filter.expenseDate = range;
  }

  const [expenses, total, sumAgg] = await Promise.all([
    Expense.find(filter).populate('recordedBy', 'fullName').sort({ expenseDate: -1 }).skip(skip).limit(limit),
    Expense.countDocuments(filter),
    Expense.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  return { expenses, total, totalAmount: sumAgg[0]?.total || 0, page, limit };
};

export const createExpense = (
  data: { title: string; category: ExpenseCategory; amount: number; expenseDate?: string; description?: string },
  userId: string
) =>
  Expense.create({
    title: data.title,
    category: data.category,
    amount: Number(data.amount),
    expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
    description: data.description,
    recordedBy: userId,
  });

export const updateExpense = async (id: string, data: Record<string, unknown>) => {
  const expense = await Expense.findById(id);
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (expense.category === 'SUPPLIER_PAYMENT') {
    throw new ApiError(400, 'Supplier payments are created automatically and cannot be edited');
  }
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== '') expense.set(key, value);
  });
  await expense.save();
  return expense;
};

export const deleteExpense = async (id: string) => {
  const expense = await Expense.findById(id);
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (expense.category === 'SUPPLIER_PAYMENT') {
    throw new ApiError(400, 'Supplier payments are created automatically and cannot be deleted');
  }
  await expense.deleteOne();
};