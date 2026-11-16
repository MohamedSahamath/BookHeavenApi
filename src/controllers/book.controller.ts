import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as bookService from '../services/book.service';

const baseUrl = (req: AuthRequest) => `${req.protocol}://${req.get('host')}`;

export const getBooks = asyncHandler(async (req: AuthRequest, res) => {
  const { page, limit, skip } = getPagination(req.query, 12);
  const isStaff = req.user && (req.user.role === 'ADMIN' || req.user.role === 'MANAGER');
  const includeInactive = Boolean(isStaff && req.query.includeInactive === 'true');

  const result = await bookService.listBooks(
    { ...(req.query as Record<string, string>), includeInactive },
    page,
    limit,
    skip
  );
  sendSuccess(res, result.books, 'Books loaded', 200, buildPagination(page, limit, result.total));
});

export const getHome = asyncHandler(async (_req, res) => {
  sendSuccess(res, await bookService.getHomeData(), 'Home data loaded');
});

export const getBook = asyncHandler(async (req: AuthRequest, res) => {
  const book = await bookService.getBookById(req.params.id, {
    countView: req.user?.role !== 'ADMIN' && req.user?.role !== 'MANAGER',
  });
  sendSuccess(res, book, 'Book loaded');
});

export const createBook = asyncHandler(async (req: AuthRequest, res) => {
  const book = await bookService.createBook(req.body, req.file, baseUrl(req), req.user!.id);
  sendSuccess(res, book, 'Book added', 201);
});

export const updateBook = asyncHandler(async (req: AuthRequest, res) => {
  const book = await bookService.updateBook(req.params.id, req.body, req.file, baseUrl(req));
  sendSuccess(res, book, 'Book updated');
});

export const deleteBook = asyncHandler(async (req, res) => {
  const result = await bookService.deleteBook(req.params.id);
  sendSuccess(res, result, result.message);
});