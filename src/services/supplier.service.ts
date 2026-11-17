import { Supplier, ISupplier } from '../models/supplier.model';
import { SupplierOrder } from '../models/supplierOrder.model';
import { Book } from '../models/book.model';
import { Expense } from '../models/expense.model';
import { ApiError } from '../utils/apiError';
import { increaseStock } from './inventory.service';
import { notifyRoles } from './notification.service';
import { SupplierOrderStatus } from '../types';

export const listSuppliers = async (
  query: { search?: string; status?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: regex }, { contactPerson: regex }, { email: regex }];
  }
  if (query.status === 'active') filter.isActive = true;
  if (query.status === 'inactive') filter.isActive = false;

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter).populate('suppliedBooks', 'title isbn').sort({ name: 1 }).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);
  return { suppliers, total, page, limit };
};

export const getSupplierById = async (id: string) => {
  const supplier = await Supplier.findById(id).populate('suppliedBooks', 'title isbn coverImage');
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  const recentOrders = await SupplierOrder.find({ supplier: id })
    .populate('book', 'title isbn')
    .sort({ createdAt: -1 })
    .limit(10);
  return { supplier, recentOrders };
};

export const createSupplier = (data: Partial<ISupplier>) => Supplier.create(data);

export const updateSupplier = async (id: string, data: Partial<ISupplier>) => {
  const supplier = await Supplier.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  return supplier;
};

export const toggleSupplierStatus = async (id: string) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) throw new ApiError(404, 'Supplier not found');
  supplier.isActive = !supplier.isActive;
  await supplier.save();
  return supplier;
};

export const deleteSupplier = async (id: string) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) throw new ApiError(404, 'Supplier not found');

  const orderCount = await SupplierOrder.countDocuments({ supplier: id });
  if (orderCount > 0) {
    supplier.isActive = false;
    await supplier.save();
    return { softDeleted: true, message: 'Supplier has order history, so it was deactivated' };
  }
  await supplier.deleteOne();
  return { softDeleted: false, message: 'Supplier deleted' };
};

export const listSupplierOrders = async (
  query: { status?: string; supplier?: string; book?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.supplier) filter.supplier = query.supplier;
  if (query.book) filter.book = query.book;

  const [orders, total] = await Promise.all([
    SupplierOrder.find(filter)
      .populate('supplier', 'name contactPerson phone')
      .populate('book', 'title isbn coverImage')
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SupplierOrder.countDocuments(filter),
  ]);
  return { orders, total, page, limit };
};

export const createSupplierOrder = async (
  data: {
    supplier: string;
    book: string;
    orderedQuantity: number;
    unitCost: number;
    orderDate?: string;
    expectedDeliveryDate: string;
    notes?: string;
  },
  userId: string
) => {
  const [supplier, book] = await Promise.all([Supplier.findById(data.supplier), Book.findById(data.book)]);
  if (!supplier || !supplier.isActive) throw new ApiError(400, 'Supplier not found or inactive');
  if (!book) throw new ApiError(400, 'Book not found');

  const order = await SupplierOrder.create({
    referenceNumber: `SO-${Date.now()}`,
    supplier: data.supplier,
    book: data.book,
    orderedQuantity: Number(data.orderedQuantity),
    unitCost: Number(data.unitCost),
    orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
    expectedDeliveryDate: new Date(data.expectedDeliveryDate),
    notes: data.notes,
    createdBy: userId,
  });

  await Supplier.updateOne({ _id: data.supplier }, { $addToSet: { suppliedBooks: data.book } });

  return order;
};

export const updateSupplierOrder = async (
  id: string,
  data: { orderedQuantity?: number; unitCost?: number; expectedDeliveryDate?: string; notes?: string }
) => {
  const order = await SupplierOrder.findById(id);
  if (!order) throw new ApiError(404, 'Supplier order not found');
  if (order.status !== 'PENDING') throw new ApiError(400, 'Only pending supplier orders can be edited');

  if (data.orderedQuantity !== undefined) order.orderedQuantity = Number(data.orderedQuantity);
  if (data.unitCost !== undefined) order.unitCost = Number(data.unitCost);
  if (data.expectedDeliveryDate) order.expectedDeliveryDate = new Date(data.expectedDeliveryDate);
  if (data.notes !== undefined) order.notes = data.notes;
  await order.save();
  return order;
};

export const receiveSupplierOrder = async (
  id: string,
  receivedQuantity: number,
  userId: string,
  receivedDate?: string
) => {
  const order = await SupplierOrder.findById(id).populate('book', 'title').populate('supplier', 'name');
  if (!order) throw new ApiError(404, 'Supplier order not found');

  if (!['PENDING', 'PARTIALLY_RECEIVED'].includes(order.status)) {
    throw new ApiError(400, `Cannot receive books for an order with status ${order.status}`);
  }

  const qty = Number(receivedQuantity);
  const remaining = order.orderedQuantity - order.receivedQuantity;
  if (qty > remaining) {
    throw new ApiError(400, `Only ${remaining} more book(s) are expected for this order`);
  }

  const newReceived = order.receivedQuantity + qty;
  const newStatus: SupplierOrderStatus = newReceived >= order.orderedQuantity ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

  const updated = await SupplierOrder.findOneAndUpdate(
    { _id: id, receivedQuantity: order.receivedQuantity },
    {
      receivedQuantity: newReceived,
      status: newStatus,
      actualReceivedDate: receivedDate ? new Date(receivedDate) : new Date(),
    },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'This order was just updated by someone else. Please refresh.');

  const bookId = updated.book;

  await increaseStock(bookId, qty, 'SUPPLIER_DELIVERY', {
    reason: `Received from supplier order ${order.referenceNumber}`,
    supplierOrder: order._id,
    performedBy: userId,
  });

  await Expense.create({
    title: `Supplier payment - ${order.referenceNumber}`,
    category: 'SUPPLIER_PAYMENT',
    amount: qty * order.unitCost,
    expenseDate: new Date(),
    description: `${qty} x book @ LKR ${order.unitCost}`,
    supplierOrder: order._id,
    recordedBy: userId,
  });

  const bookTitle = (order.book as unknown as { title: string }).title;
  await notifyRoles(
    ['MANAGER', 'ADMIN'],
    'Supplier delivery received',
    `${qty} copies of "${bookTitle}" received (${order.referenceNumber}).`,
    'SUPPLIER',
    '/manager/supplier-orders'
  );

  return SupplierOrder.findById(id).populate('supplier', 'name').populate('book', 'title isbn');
};

export const markNotReceived = async (id: string, notes?: string) => {
  const order = await SupplierOrder.findById(id);
  if (!order) throw new ApiError(404, 'Supplier order not found');
  if (order.status !== 'PENDING') throw new ApiError(400, 'Only pending orders can be marked as not received');

  order.status = 'NOT_RECEIVED';
  if (notes) order.notes = notes;
  await order.save();

  await notifyRoles(['MANAGER', 'ADMIN'], 'Supplier delivery not received', `${order.referenceNumber} was marked as NOT RECEIVED.`, 'SUPPLIER', '/manager/supplier-orders');
  return order;
};

export const deleteSupplierOrder = async (id: string) => {
  const order = await SupplierOrder.findById(id);
  if (!order) throw new ApiError(404, 'Supplier order not found');
  if (order.receivedQuantity > 0) throw new ApiError(400, 'Cannot delete an order that has received books');
  await order.deleteOne();
};

export const getSupplierStats = async () => {
  const [pending, partial, received, notReceived, overdue] = await Promise.all([
    SupplierOrder.countDocuments({ status: 'PENDING' }),
    SupplierOrder.countDocuments({ status: 'PARTIALLY_RECEIVED' }),
    SupplierOrder.countDocuments({ status: 'RECEIVED' }),
    SupplierOrder.countDocuments({ status: 'NOT_RECEIVED' }),
    SupplierOrder.countDocuments({
      status: { $in: ['PENDING', 'PARTIALLY_RECEIVED'] },
      expectedDeliveryDate: { $lt: new Date() },
    }),
  ]);
  return { pending, partial, received, notReceived, overdue };
};