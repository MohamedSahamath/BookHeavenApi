import Stripe from 'stripe';
import { getStripe } from '../config/payment';
import { Payment, IPayment } from '../models/payment.model';
import { Order } from '../models/order.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/apiError';
import { createPendingOrder, confirmOrderAfterPayment } from './order.service';

const toCents = (amount: number) => Math.round(amount * 100);

export const createCheckoutSession = async (userId: string, addressId: string) => {
  const order = await createPendingOrder(userId, addressId);
  const user = await User.findById(userId);
  const stripe = getStripe();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency: 'lkr',
      unit_amount: toCents(item.unitPrice),
      product_data: { name: item.title, description: item.authorNames.join(', ') || undefined },
    },
  }));

  if (order.deliveryCharge > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'lkr',
        unit_amount: toCents(order.deliveryCharge),
        product_data: { name: 'Island-wide delivery (within 5 days)' },
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'], // CARD ONLY - no cash on delivery / bank transfer
    line_items: lineItems,
    customer_email: user?.email,
    metadata: { orderId: order._id.toString(), userId },
    success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/payment/cancel?order_id=${order._id}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // session valid for 30 minutes
  });

  const payment = await Payment.create({
    order: order._id,
    customer: userId,
    sessionId: session.id,
    amount: order.totalAmount,
    currency: 'LKR',
    status: 'PENDING',
  });

  order.payment = payment._id;
  await order.save();

  return { checkoutUrl: session.url, orderId: order._id, sessionId: session.id };
};

const handlePaidSession = async (payment: IPayment, session: Stripe.Checkout.Session) => {
  if (session.metadata?.orderId !== payment.order.toString()) {
    throw new ApiError(400, 'Payment does not match this order');
  }
  if (session.amount_total !== toCents(payment.amount)) {
    throw new ApiError(400, 'Paid amount does not match the order total');
  }

  let transactionId: string | undefined;
  let cardBrand: string | undefined;
  let cardLast4: string | undefined;

  const intent = session.payment_intent;
  if (intent && typeof intent !== 'string') {
    transactionId = intent.id;
    const charge = intent.latest_charge;
    if (charge && typeof charge !== 'string') {
      cardBrand = charge.payment_method_details?.card?.brand || undefined;
      cardLast4 = charge.payment_method_details?.card?.last4 || undefined;
    }
  } else if (typeof intent === 'string') {
    transactionId = intent;
  }

  await Payment.updateOne(
    { _id: payment._id, status: 'PENDING' },
    { status: 'SUCCESS', transactionId, cardBrand, cardLast4, paidAt: new Date() }
  );

  return confirmOrderAfterPayment(payment.order.toString());
};

export const verifyPayment = async (sessionId: string, userId: string) => {
  const payment = await Payment.findOne({ sessionId });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.customer.toString() !== userId) throw new ApiError(403, 'This payment does not belong to you');

  if (payment.status === 'SUCCESS') {
    const order = await confirmOrderAfterPayment(payment.order.toString());
    return { status: 'SUCCESS', order };
  }
  if (payment.status !== 'PENDING') {
    const order = await Order.findById(payment.order);
    return { status: payment.status, order };
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  });

  if (session.payment_status === 'paid') {
    const order = await handlePaidSession(payment, session);
    return { status: order && order.status === 'CANCELLED' ? 'REFUND_PENDING' : 'SUCCESS', order };
  }

  if (session.status === 'expired') {
    await markPaymentFailed(payment, 'Payment session expired');
    return { status: 'FAILED', order: await Order.findById(payment.order) };
  }

  return { status: 'PENDING', order: await Order.findById(payment.order) };
};

const markPaymentFailed = async (payment: IPayment, reason: string) => {
  await Payment.updateOne({ _id: payment._id, status: 'PENDING' }, { status: 'FAILED', failureReason: reason });
  await Order.updateOne(
    { _id: payment.order, status: 'PAYMENT_PENDING' },
    {
      status: 'CANCELLED',
      paymentStatus: 'FAILED',
      cancelledAt: new Date(),
      cancelReason: reason,
      $push: { statusHistory: { status: 'CANCELLED', changedAt: new Date(), note: reason } },
    }
  );
};

export const handleWebhook = async (rawBody: Buffer, signature: string | undefined) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new ApiError(400, 'Webhook secret not configured');
  if (!signature) throw new ApiError(400, 'Missing Stripe signature');

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.expired') {
    const eventSession = event.data.object as Stripe.Checkout.Session;
    const payment = await Payment.findOne({ sessionId: eventSession.id });
    if (!payment) return;

    if (event.type === 'checkout.session.completed' && eventSession.payment_status === 'paid') {
      const fullSession = await getStripe().checkout.sessions.retrieve(eventSession.id, {
        expand: ['payment_intent.latest_charge'],
      });
      await handlePaidSession(payment, fullSession);
    } else if (event.type === 'checkout.session.expired') {
      await markPaymentFailed(payment, 'Payment session expired');
    }
  }
};

export const cancelPayment = async (orderId: string, userId: string) => {
  const payment = await Payment.findOne({ order: orderId, customer: userId });
  if (!payment) throw new ApiError(404, 'Payment not found');
  if (payment.status !== 'PENDING') return { status: payment.status };

  try {
    await getStripe().checkout.sessions.expire(payment.sessionId);
  } catch {
  }
  await markPaymentFailed(payment, 'Payment cancelled by customer');
  return { status: 'FAILED' };
};

export const listTransactions = async (
  query: { status?: string; from?: string; to?: string },
  page: number,
  limit: number,
  skip: number
) => {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.from || query.to) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) range.$lte = new Date(`${query.to}T23:59:59`);
    filter.createdAt = range;
  }

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('customer', 'fullName email')
      .populate('order', 'orderNumber invoiceNumber status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { payments, total, page, limit };
};