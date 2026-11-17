import { Request } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as paymentService from '../services/payment.service';

export const createCheckout = asyncHandler(async (req: AuthRequest, res) => {
  const result = await paymentService.createCheckoutSession(req.user!.id, req.body.addressId);
  sendSuccess(res, result, 'Redirecting to secure card payment', 201);
});

export const verifyPayment = asyncHandler(async (req: AuthRequest, res) => {
  const result = await paymentService.verifyPayment(String(req.body.sessionId || ''), req.user!.id);
  sendSuccess(res, result, `Payment status: ${result.status}`);
});

export const cancelPayment = asyncHandler(async (req: AuthRequest, res) => {
  const result = await paymentService.cancelPayment(String(req.body.orderId || ''), req.user!.id);
  sendSuccess(res, result, 'Payment cancelled');
});

export const webhook = asyncHandler(async (req: Request, res) => {
  await paymentService.handleWebhook(req.body as Buffer, req.headers['stripe-signature'] as string | undefined);
  res.json({ received: true });
});