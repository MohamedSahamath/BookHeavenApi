import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import { generateInvoicePdf } from '../utils/pdfGenerator';
import * as orderService from '../services/order.service';

export const getMyOrders = asyncHandler(async (req: AuthRequest, res) => {
  const { page, limit, skip } = getPagination(req.query, 10);
  const result = await orderService.getMyOrders(req.user!.id, req.query.status as string | undefined, page, limit, skip);
  sendSuccess(res, result.orders, 'Orders loaded', 200, buildPagination(page, limit, result.total));
});

export const getOrder = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await orderService.getOrderDetails(req.params.id, req.user!), 'Order loaded');
});

export const cancelMyOrder = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await orderService.cancelUnpaidOrder(req.params.id, req.user!.id), 'Order cancelled');
});

export const downloadInvoice = asyncHandler(async (req: AuthRequest, res) => {
  const { order, payment } = await orderService.getInvoiceOrder(req.params.id, req.user!);
  const customer = order.customer as unknown as { fullName: string; email: string };
  const a = order.shippingAddress;

  generateInvoicePdf(res, {
    invoiceNumber: order.invoiceNumber!,
    orderNumber: order.orderNumber,
    orderId: order._id.toString(),
    invoiceDate: order.confirmedAt || order.createdAt,
    customerName: customer.fullName,
    customerEmail: customer.email,
    address: [
      a.recipientName,
      a.addressLine1,
      a.addressLine2 || '',
      `${a.city}, ${a.district} ${a.postalCode}`,
      `Tel: ${a.phone}`,
    ].filter(Boolean),
    items: order.items.map((i) => ({
      title: i.title,
      authors: i.authorNames.join(', '),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    total: order.totalAmount,
    paymentMethod: `Online Card Payment${payment.cardBrand ? ` (${payment.cardBrand.toUpperCase()} **** ${payment.cardLast4})` : ''}`,
    transactionRef: payment.transactionId || payment.sessionId,
    paymentStatus: payment.status === 'SUCCESS' ? 'PAID' : payment.status,
  });
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 15);
  const result = await orderService.listAllOrders(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.orders, 'Orders loaded', 200, buildPagination(page, limit, result.total));
});

export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res) => {
  const order = await orderService.updateOrderStatus(req.params.id, req.body.status, req.body.note, req.user!.id);
  sendSuccess(res, order, `Order is now ${order.status}`);
});

export const getOrderStats = asyncHandler(async (_req, res) => {
  sendSuccess(res, await orderService.getOrderStats(), 'Order stats loaded');
});