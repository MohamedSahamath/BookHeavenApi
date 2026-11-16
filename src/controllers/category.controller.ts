import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as bookService from '../services/book.service';

export const getCategories = asyncHandler(async (req: AuthRequest, res) => {
  const isStaff = req.user && (req.user.role === 'ADMIN' || req.user.role === 'MANAGER');
  const categories = isStaff && req.query.all === 'true'
    ? await bookService.listAllCategories()
    : await bookService.getCategoriesWithCounts();
  sendSuccess(res, categories, 'Categories loaded');
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await bookService.createCategory({ name: req.body.name, description: req.body.description });
  sendSuccess(res, category, 'Category added', 201);
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  sendSuccess(res, await bookService.updateCategory(req.params.id, { name, description, isActive }), 'Category updated');
});

export const deleteCategory = asyncHandler(async (req, res) => {
  await bookService.deleteCategory(req.params.id);
  sendSuccess(res, null, 'Category deleted');
});