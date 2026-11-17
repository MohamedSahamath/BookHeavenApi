import { Types } from 'mongoose';
import { Delivery, IDelivery } from '../models/delivery.model';
import { Order, IOrder } from '../models/order.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/apiError';
import { ORDER_STATUS_FLOW } from '../utils/constants';
import { notifyUser, notifyRoles } from './notification.service';
import { sendEmail, emailTemplate } from '../utils/email';
import { OrderStatus } from '../types';

export const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY'];

export const isOrderDelayed = (order: Pick<IOrder, 'status' | 'expectedDeliveryDate'>): boolean =>
  Boolean(
    order.expectedDeliveryDate &&
      ACTIVE_DELIVERY_STATUSES.includes(order.status) &&
      new Date() > new Date(order.expectedDeliveryDate)
  );

export const createDeliveryForOrder = async (order: IOrder) => {
  const a = order.shippingAddress;
  return Delivery.findOneAndUpdate(
    { order: order._id },
    {
      order: order._id,
      customer: order.customer,
      customerName: a.recipientName,
      contactNumber: a.phone,
      address: [a.addressLine1, a.addressLine2].filter(Boolean).join(', '),
      city: a.city,
      district: a.district,
      postalCode: a.postalCode,
      orderDate: order.confirmedAt || new Date(),
      expectedDeliveryDate: order.expectedDeliveryDate,
      status: 'PENDING',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const listDeliveries = async (
  query: { status?: string; district?: string; delayed?: string; search?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.district) filter.district = query.district;
  if (query.search) {
    const regex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ customerName: regex }, { contactNumber: regex }, { trackingNumber: regex }];
  }
  if (query.delayed === 'true') {
    filter.status = { $in: ['PENDING', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY'] };
    filter.expectedDeliveryDate = { $lt: new Date() };
  }

  const [deliveries, total] = await Promise.all([
    Delivery.find(filter)
      .populate('order', 'orderNumber totalAmount status')
      .sort({ expectedDeliveryDate: 1 })
      .skip(skip)
      .limit(limit),
    Delivery.countDocuments(filter),
  ]);

  const now = new Date();
  const withDelay = deliveries.map((d) => ({
    ...d.toObject(),
    isDelayed: !['DELIVERED', 'CANCELLED'].includes(d.status) && d.expectedDeliveryDate < now,
  }));
  return { deliveries: withDelay, total, page, limit };
};

export const updateDeliveryStatus = async (
  orderId: string,
  data: { status: 'DISPATCHED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'; courierName?: string; trackingNumber?: string; notes?: string },
  staffId: string
) => {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const allowed = ORDER_STATUS_FLOW[order.status];
  if (!allowed.includes(data.status)) {
    throw new ApiError(400, `Cannot change order from ${order.status} to ${data.status}`);
  }

  const delivery = await Delivery.findOne({ order: orderId });
  if (!delivery) throw new ApiError(404, 'Delivery record not found');

  if (data.status === 'DISPATCHED' && !data.courierName && !delivery.courierName) {
    throw new ApiError(422, 'Courier name is required to dispatch an order');
  }

  const now = new Date();
  const update: Partial<IDelivery> = { status: data.status };
  if (data.courierName) update.courierName = data.courierName;
  if (data.trackingNumber) update.trackingNumber = data.trackingNumber;
  if (data.notes) update.notes = data.notes;
  if (data.status === 'DISPATCHED') update.dispatchDate = now;
  if (data.status === 'DELIVERED') {
    update.deliveredDate = now;
    if (!delivery.dispatchDate) update.dispatchDate = now;
  }
  Object.assign(delivery, update);
  await delivery.save();

  order.status = data.status;
  order.statusHistory.push({ status: data.status, changedAt: now, changedBy: new Types.ObjectId(staffId), note: data.notes });
  if (data.status === 'DELIVERED') order.deliveredAt = now;
  await order.save();

  // Tell the customer
  const messages: Record<string, string> = {
    DISPATCHED: `Your order ${order.orderNumber} has been dispatched via ${delivery.courierName}${delivery.trackingNumber ? ` (tracking: ${delivery.trackingNumber})` : ''}.`,
    OUT_FOR_DELIVERY: `Your order ${order.orderNumber} is out for delivery today.`,
    DELIVERED: `Your order ${order.orderNumber} has been delivered. Enjoy your books!`,
  };
  await notifyUser(order.customer, 'Delivery update', messages[data.status], 'DELIVERY', `/orders/${order._id}`);

  if (data.status === 'DISPATCHED') {
    const customer = await User.findById(order.customer);
    if (customer) {
      await sendEmail(customer.email, `Order ${order.orderNumber} dispatched`, emailTemplate('Your order is on the way!', `<p>${messages.DISPATCHED}</p>`));
    }
  }

  return { order, delivery };
};

export const checkDelayedDeliveries = async (): Promise<number> => {
  const lateOrders = await Order.find({
    status: { $in: ACTIVE_DELIVERY_STATUSES },
    expectedDeliveryDate: { $lt: new Date() },
    delayNotified: false,
  });

  for (const order of lateOrders) {
    await notifyUser(
      order.customer,
      'Delivery delayed',
      `Sorry! Order ${order.orderNumber} has passed its 5-day delivery date. You can submit a delivery complaint from your order page.`,
      'DELIVERY',
      `/orders/${order._id}`
    );
    await notifyRoles(['MANAGER'], 'Delayed delivery', `Order ${order.orderNumber} is past its expected delivery date.`, 'DELIVERY', '/manager/deliveries?delayed=true');
    order.delayNotified = true;
    await order.save();
  }
  return lateOrders.length;
};

export const getDeliveryStats = async () => {
  const [pending, processing, dispatched, outForDelivery, delivered, delayed] = await Promise.all([
    Delivery.countDocuments({ status: 'PENDING' }),
    Delivery.countDocuments({ status: 'PROCESSING' }),
    Delivery.countDocuments({ status: 'DISPATCHED' }),
    Delivery.countDocuments({ status: 'OUT_FOR_DELIVERY' }),
    Delivery.countDocuments({ status: 'DELIVERED' }),
    Delivery.countDocuments({
      status: { $in: ['PENDING', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY'] },
      expectedDeliveryDate: { $lt: new Date() },
    }),
  ]);
  return { pending, processing, dispatched, outForDelivery, delivered, delayed };
};