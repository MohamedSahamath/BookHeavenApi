import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as inventoryService from '../services/inventory.service';

export const getInventory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const result = await inventoryService.listInventory(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.items, 'Inventory loaded', 200, buildPagination(page, limit, result.total));
});

export const getSummary = asyncHandler(async (_req, res) => {
  sendSuccess(res, await inventoryService.getInventorySummary(), 'Inventory summary loaded');
});

export const getLowStock = asyncHandler(async (_req, res) => {
  sendSuccess(res, await inventoryService.getLowStockItems(), 'Low stock items loaded');
});

export const adjustStock = asyncHandler(async (req: AuthRequest, res) => {
  const { type, quantity, reason } = req.body;
  const inventory = await inventoryService.adjustStock(req.params.bookId, type, Number(quantity), reason, req.user!.id);
  sendSuccess(res, inventory, 'Stock updated');
});

export const updateLowStockLevel = asyncHandler(async (req, res) => {
  const inventory = await inventoryService.updateLowStockLevel(req.params.bookId, Number(req.body.lowStockLevel));
  sendSuccess(res, inventory, 'Low stock level updated');
});

export const getMovements = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const result = await inventoryService.getMovements(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.movements, 'Stock movements loaded', 200, buildPagination(page, limit, result.total));
});