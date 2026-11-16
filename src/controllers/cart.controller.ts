import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as cartService from '../services/cart.service';

export const getCart = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await cartService.buildCartSummary(req.user!.id), 'Cart loaded');
});

export const addItem = asyncHandler(async (req: AuthRequest, res) => {
  const cart = await cartService.addToCart(req.user!.id, req.body.bookId, Number(req.body.quantity));
  sendSuccess(res, cart, 'Added to cart');
});

export const updateItem = asyncHandler(async (req: AuthRequest, res) => {
  const cart = await cartService.updateCartItem(req.user!.id, req.params.bookId, Number(req.body.quantity));
  sendSuccess(res, cart, 'Cart updated');
});

export const removeItem = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await cartService.removeCartItem(req.user!.id, req.params.bookId), 'Removed from cart');
});

export const clearCart = asyncHandler(async (req: AuthRequest, res) => {
  await cartService.clearCart(req.user!.id);
  sendSuccess(res, await cartService.buildCartSummary(req.user!.id), 'Cart cleared');
});