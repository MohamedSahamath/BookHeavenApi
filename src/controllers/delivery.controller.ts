import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as deliveryService from '../services/delivery.service';

export const getDeliveries = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 15);
  const result = await deliveryService.listDeliveries(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.deliveries, 'Deliveries loaded', 200, buildPagination(page, limit, result.total));
});

export const getDeliveryStats = asyncHandler(async (_req, res) => {
  sendSuccess(res, await deliveryService.getDeliveryStats(), 'Delivery stats loaded');
});

export const updateDelivery = asyncHandler(async (req: AuthRequest, res) => {
  const { status, courierName, trackingNumber, notes } = req.body;
  const result = await deliveryService.updateDeliveryStatus(req.params.orderId, { status, courierName, trackingNumber, notes }, req.user!.id);
  sendSuccess(res, result, `Delivery updated to ${status}`);
});

export const runDelayCheck = asyncHandler(async (_req, res) => {
  const count = await deliveryService.checkDelayedDeliveries();
  sendSuccess(res, { notified: count }, `${count} delayed order(s) notified`);
});