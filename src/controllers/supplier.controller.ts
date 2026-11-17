import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as supplierService from '../services/supplier.service';

export const getSuppliers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const result = await supplierService.listSuppliers(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.suppliers, 'Suppliers loaded', 200, buildPagination(page, limit, result.total));
});

export const getSupplier = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.getSupplierById(req.params.id), 'Supplier loaded');
});

export const createSupplier = asyncHandler(async (req, res) => {
  const { name, contactPerson, email, phone, address, notes } = req.body;
  sendSuccess(res, await supplierService.createSupplier({ name, contactPerson, email, phone, address, notes }), 'Supplier added', 201);
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const { name, contactPerson, email, phone, address, notes, isActive } = req.body;
  sendSuccess(res, await supplierService.updateSupplier(req.params.id, { name, contactPerson, email, phone, address, notes, isActive }), 'Supplier updated');
});

export const toggleSupplierStatus = asyncHandler(async (req, res) => {
  const supplier = await supplierService.toggleSupplierStatus(req.params.id);
  sendSuccess(res, supplier, supplier.isActive ? 'Supplier activated' : 'Supplier deactivated');
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const result = await supplierService.deleteSupplier(req.params.id);
  sendSuccess(res, result, result.message);
});

export const getSupplierOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 20);
  const result = await supplierService.listSupplierOrders(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.orders, 'Supplier orders loaded', 200, buildPagination(page, limit, result.total));
});

export const createSupplierOrder = asyncHandler(async (req: AuthRequest, res) => {
  const order = await supplierService.createSupplierOrder(req.body, req.user!.id);
  sendSuccess(res, order, 'Supplier order created (stock will increase when books are received)', 201);
});

export const updateSupplierOrder = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.updateSupplierOrder(req.params.id, req.body), 'Supplier order updated');
});

export const receiveSupplierOrder = asyncHandler(async (req: AuthRequest, res) => {
  const order = await supplierService.receiveSupplierOrder(
    req.params.id,
    Number(req.body.receivedQuantity),
    req.user!.id,
    req.body.receivedDate
  );
  sendSuccess(res, order, 'Books received and stock updated');
});

export const markNotReceived = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.markNotReceived(req.params.id, req.body.notes), 'Marked as not received');
});

export const deleteSupplierOrder = asyncHandler(async (req, res) => {
  await supplierService.deleteSupplierOrder(req.params.id);
  sendSuccess(res, null, 'Supplier order deleted');
});