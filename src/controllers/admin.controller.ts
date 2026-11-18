import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as adminService from '../services/admin.service';
import * as reportService from '../services/report.service';
import * as paymentService from '../services/payment.service';

export const getDashboard = asyncHandler(async (_req, res) => {
  sendSuccess(res, await reportService.getAdminDashboard(), 'Admin dashboard loaded');
});

export const getManagers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const result = await adminService.listUsers('MANAGER', req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.users, 'Managers loaded', 200, buildPagination(page, limit, result.total));
});

export const createManager = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  const manager = await adminService.createManager({ fullName, email, phone, password });
  sendSuccess(res, manager, 'Manager account created', 201);
});

export const updateManager = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  const manager = await adminService.updateManager(req.params.id, { fullName, email, phone, password });
  sendSuccess(res, manager, 'Manager updated');
});

export const setManagerStatus = asyncHandler(async (req, res) => {
  const manager = await adminService.setUserStatus(req.params.id, 'MANAGER', Boolean(req.body.isActive));
  sendSuccess(res, manager, manager.isActive ? 'Manager activated' : 'Manager deactivated');
});

export const getCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const result = await adminService.listUsers('CUSTOMER', req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.users, 'Customers loaded', 200, buildPagination(page, limit, result.total));
});

export const getCustomer = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.getCustomerDetails(req.params.id), 'Customer loaded');
});

export const setCustomerStatus = asyncHandler(async (req, res) => {
  const customer = await adminService.setUserStatus(req.params.id, 'CUSTOMER', Boolean(req.body.isActive));
  sendSuccess(res, customer, customer.isActive ? 'Customer activated' : 'Customer deactivated');
});

export const getTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const result = await paymentService.listTransactions(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, result.payments, 'Transactions loaded', 200, buildPagination(page, limit, result.total));
});

export const getExpenses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const result = await adminService.listExpenses(req.query as Record<string, string>, page, limit, skip);
  sendSuccess(res, { expenses: result.expenses, totalAmount: result.totalAmount }, 'Expenses loaded', 200, buildPagination(page, limit, result.total));
});

export const createExpense = asyncHandler(async (req: AuthRequest, res) => {
  const expense = await adminService.createExpense(req.body, req.user!.id);
  sendSuccess(res, expense, 'Expense recorded', 201);
});

export const updateExpense = asyncHandler(async (req, res) => {
  const { title, category, amount, expenseDate, description } = req.body;
  const expense = await adminService.updateExpense(req.params.id, { title, category, amount, expenseDate, description });
  sendSuccess(res, expense, 'Expense updated');
});

export const deleteExpense = asyncHandler(async (req, res) => {
  await adminService.deleteExpense(req.params.id);
  sendSuccess(res, null, 'Expense deleted');
});