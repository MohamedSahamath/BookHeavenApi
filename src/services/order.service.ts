import { Types } from 'mongoose';
import { Order, IOrder, IShippingAddress } from '../models/order.model';
import { Payment } from '../models/payment.model';
import { Delivery } from '../models/delivery.model';
import { Cart } from '../models/cart.model';
import { Book } from '../models/book.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/apiError';
import { addDays, DELIVERY_DAYS } from '../utils/constants';
import { JwtPayload } from '../types';
import { buildCartSummary } from './cart.service';
import { decreaseStock, increaseStock } from './inventory.service';
import { createDeliveryForOrder, isOrderDelayed } from './delivery.service';
import { notifyUser, notifyRoles } from './notification.service';
import { sendEmail, emailTemplate } from '../utils/email';

const isStaff = (user: JwtPayload) => user.role === 'ADMIN' || user.role === 'MANAGER';

export const createPendingOrder = async (userId: string, addressId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const address = user.addresses.id(addressId);
  if (!address) throw new ApiError(400, 'Delivery address not found');

  const cart = await buildCartSummary(userId);
  if (cart.items.length === 0) throw new ApiError(400, 'Your cart is empty');

  const problems = cart.items.filter((i) => !i.isAvailable);
  if (problems.length > 0) {
    const list = problems.map((p) => `"${p.title}" (only ${p.stock} left)`).join(', ');
    throw new ApiError(409, `Not enough stock for: ${list}. Please update your cart.`);
  }

  const shippingAddress: IShippingAddress = {
    recipientName: address.recipientName,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    district: address.district,
    postalCode: address.postalCode,
  };

  const order = await Order.create({
    orderNumber: `BH${Date.now()}`,
    customer: userId,
    items: cart.items.map((i) => ({
      book: i.bookId,
      title: i.title,
      isbn: i.isbn,
      authorNames: i.authorNames,
      coverImage: i.coverImage,
      unitPrice: i.unitPrice,
      unitCost: i.unitCost,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: cart.subtotal,
    deliveryCharge: cart.deliveryCharge,
    totalAmount: cart.total,
    shippingAddress,
    status: 'PAYMENT_PENDING',
    paymentStatus: 'PENDING',
    statusHistory: [{ status: 'PAYMENT_PENDING', changedAt: new Date(), note: 'Order created, waiting for payment' }],
  });

  return order;
};

export const confirmOrderAfterPayment = async (orderId: string): Promise<IOrder | null> => {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: 'PAYMENT_PENDING' },
    {
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
      confirmedAt: now,
      expectedDeliveryDate: addDays(now, DELIVERY_DAYS), // 5-day delivery rule
      invoiceNumber: `INV-${yyyymm}-${orderId.toString().slice(-6).toUpperCase()}`,
      $push: { statusHistory: { status: 'CONFIRMED', changedAt: now, note: 'Payment successful' } },
    },
    { new: true }
  );

  if (!order) return Order.findById(orderId);

  const reduced: { book: Types.ObjectId; quantity: number }[] = [];
  try {
    for (const item of order.items) {
      await decreaseStock(item.book, item.quantity, 'SALE', {
        order: order._id,
        reason: `Sold in order ${order.orderNumber}`,
      });
      reduced.push({ book: item.book, quantity: item.quantity });
    }
  } catch {
    for (const r of reduced) {
      await increaseStock(r.book, r.quantity, 'ORDER_CANCELLED', {
        order: order._id,
        reason: `Rollback - order ${order.orderNumber} could not be completed`,
      });
    }
    order.status = 'CANCELLED';
    order.paymentStatus = 'REFUND_PENDING';
    order.cancelledAt = new Date();
    order.cancelReason = 'A book went out of stock while payment was processing. A refund will be issued.';
    order.statusHistory.push({ status: 'CANCELLED', changedAt: new Date(), note: order.cancelReason });
    await order.save();
    await Payment.updateOne({ order: order._id }, { status: 'REFUND_PENDING' });

    await notifyUser(order.customer, 'Order could not be completed', `${order.orderNumber}: ${order.cancelReason}`, 'ORDER', `/orders/${order._id}`);
    await notifyRoles(['ADMIN'], 'Refund required', `Order ${order.orderNumber} needs a refund (stock ran out).`, 'ORDER');
    return order;
  }

  await Book.bulkWrite(
    order.items.map((i) => ({ updateOne: { filter: { _id: i.book }, update: { $inc: { soldCount: i.quantity } } } }))
  );

  // Create the delivery record and remove the bought books from the cart
  await createDeliveryForOrder(order);
  await Cart.updateOne({ user: order.customer }, { $pull: { items: { book: { $in: order.items.map((i) => i.book) } } } });

  // Notifications + email
  const expected = order.expectedDeliveryDate ? order.expectedDeliveryDate.toDateString() : '';
  await notifyUser(order.customer, 'Order confirmed', `Payment received for ${order.orderNumber}. Expected delivery: ${expected}.`, 'ORDER', `/orders/${order._id}`);
  await notifyRoles(['MANAGER'], 'New order', `New paid order ${order.orderNumber} (LKR ${order.totalAmount.toFixed(2)}).`, 'ORDER', '/manager/orders');

  const customer = await User.findById(order.customer);
  if (customer) {
    await sendEmail(
      customer.email,
      `Order ${order.orderNumber} confirmed`,
      emailTemplate(
        'Thank you for your order!',
        `<p>Hi ${customer.fullName}, we received your payment of <b>LKR ${order.totalAmount.toFixed(2)}</b>.</p>
         <p>Invoice: ${order.invoiceNumber}<br/>Expected delivery: <b>${expected}</b></p>
         <p>You can download your invoice from "My Orders".</p>`
      )
    );
  }

  return order;
};

//Customer views
export const getMyOrders = async (userId: string, status: string | undefined, page: number, limit: number, skip: number) => {
  const filter: Record<string, unknown> = { customer: userId };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return {
    orders: orders.map((o) => ({ ...o.toObject(), isDelayed: isOrderDelayed(o) })),
    total,
    page,
    limit,
  };
};

// One order with payment + delivery.
export const getOrderDetails = async (orderId: string, user: JwtPayload) => {
  const order = await Order.findById(orderId).populate('customer', 'fullName email phone');
  if (!order) throw new ApiError(404, 'Order not found');

  const customerId = (order.customer as unknown as { _id: Types.ObjectId })._id.toString();
  if (!isStaff(user) && customerId !== user.id) {
    throw new ApiError(403, 'You can only view your own orders');
  }

  const [payment, delivery] = await Promise.all([
    Payment.findOne({ order: orderId }).select('-__v'),
    Delivery.findOne({ order: orderId }),
  ]);

  return { order: { ...order.toObject(), isDelayed: isOrderDelayed(order) }, payment, delivery };
};

//Staff views
export const listAllOrders = async (
  query: { status?: string; search?: string; delayed?: string; from?: string; to?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    const customers = await User.find({ $or: [{ fullName: regex }, { email: regex }, { phone: regex }] }).select('_id');
    filter.$or = [{ orderNumber: regex }, { invoiceNumber: regex }, { customer: { $in: customers.map((c) => c._id) } }];
  }

  if (query.delayed === 'true') {
    filter.status = { $in: ['CONFIRMED', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY'] };
    filter.expectedDeliveryDate = { $lt: new Date() };
  }

  if (query.from || query.to) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(`${query.to}T23:59:59`);
    filter.createdAt = range;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).populate('customer', 'fullName email phone').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);

  return {
    orders: orders.map((o) => ({ ...o.toObject(), isDelayed: isOrderDelayed(o) })),
    total,
    page,
    limit,
  };
};

const restockOrder = async (order: IOrder, staffId?: string) => {
  for (const item of order.items) {
    await increaseStock(item.book, item.quantity, 'ORDER_CANCELLED', {
      order: order._id,
      reason: `Order ${order.orderNumber} cancelled`,
      performedBy: staffId,
    });
  }
  await Book.bulkWrite(
    order.items.map((i) => ({ updateOne: { filter: { _id: i.book }, update: { $inc: { soldCount: -i.quantity } } } }))
  );
};

// Staff: CONFIRMED -> PROCESSING, or cancel before dispatch
export const updateOrderStatus = async (orderId: string, status: 'PROCESSING' | 'CANCELLED', note: string | undefined, staffId: string) => {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const allowedNext: Record<string, string[]> = {
    PAYMENT_PENDING: ['CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['CANCELLED'],
  };
  if (!(allowedNext[order.status] || []).includes(status)) {
    throw new ApiError(400, `Cannot change order from ${order.status} to ${status}. Use the delivery page for dispatch updates.`);
  }

  const wasPaid = order.paymentStatus === 'SUCCESS';
  const now = new Date();

  order.status = status;
  order.statusHistory.push({ status, changedAt: now, changedBy: new Types.ObjectId(staffId), note });

  if (status === 'PROCESSING') {
    await Delivery.updateOne({ order: orderId }, { status: 'PROCESSING' });
    await notifyUser(order.customer, 'Order processing', `We are packing your order ${order.orderNumber}.`, 'ORDER', `/orders/${order._id}`);
  }

  if (status === 'CANCELLED') {
    order.cancelledAt = now;
    order.cancelReason = note || 'Cancelled by BookHaven';
    if (wasPaid) {
      await restockOrder(order, staffId);
      order.paymentStatus = 'REFUND_PENDING';
      await Payment.updateOne({ order: orderId }, { status: 'REFUND_PENDING' });
    } else {
      order.paymentStatus = 'FAILED';
      await Payment.updateOne({ order: orderId, status: 'PENDING' }, { status: 'FAILED', failureReason: 'Order cancelled' });
    }
    await Delivery.updateOne({ order: orderId }, { status: 'CANCELLED' });
    await notifyUser(order.customer, 'Order cancelled', `Order ${order.orderNumber} was cancelled. ${wasPaid ? 'Your refund is being processed.' : ''}`, 'ORDER', `/orders/${order._id}`);
  }

  await order.save();
  return order;
};

// Customer cancels an unpaid order (e.g. they closed the payment page)
export const cancelUnpaidOrder = async (orderId: string, userId: string) => {
  const order = await Order.findOne({ _id: orderId, customer: userId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.status !== 'PAYMENT_PENDING') {
    throw new ApiError(400, 'Only unpaid orders can be cancelled. Please submit a complaint for paid orders.');
  }

  order.status = 'CANCELLED';
  order.paymentStatus = 'FAILED';
  order.cancelledAt = new Date();
  order.cancelReason = 'Payment cancelled by customer';
  order.statusHistory.push({ status: 'CANCELLED', changedAt: new Date(), note: order.cancelReason });
  await order.save();

  await Payment.updateOne({ order: orderId, status: 'PENDING' }, { status: 'FAILED', failureReason: 'Cancelled by customer' });
  return order;
};

// Order + customer data for the invoice PDF
export const getInvoiceOrder = async (orderId: string, user: JwtPayload) => {
  const { order, payment } = await getOrderDetails(orderId, user);
  if (!order.invoiceNumber || !payment || payment.status === 'PENDING' || payment.status === 'FAILED') {
    throw new ApiError(400, 'Invoice is only available for paid orders');
  }
  return { order, payment };
};

export const getOrderStats = async () => {
  const [total, pending, confirmed, processing, dispatched, outForDelivery, delivered, cancelled] = await Promise.all([
    Order.countDocuments({ status: { $ne: 'PAYMENT_PENDING' } }),
    Order.countDocuments({ status: 'PAYMENT_PENDING' }),
    Order.countDocuments({ status: 'CONFIRMED' }),
    Order.countDocuments({ status: 'PROCESSING' }),
    Order.countDocuments({ status: 'DISPATCHED' }),
    Order.countDocuments({ status: 'OUT_FOR_DELIVERY' }),
    Order.countDocuments({ status: 'DELIVERED' }),
    Order.countDocuments({ status: 'CANCELLED' }),
  ]);
  return { total, pending, confirmed, processing, dispatched, outForDelivery, delivered, cancelled };
};