import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as bookService from '../services/book.service';

export const getAuthors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 50);
  const result = await bookService.listAuthors(req.query.search as string | undefined, page, limit, skip);
  sendSuccess(res, result.authors, 'Authors loaded', 200, buildPagination(page, limit, result.total));
});

// Author details + all books by this author
export const getAuthor = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query, 12);
  const [author, books] = await Promise.all([
    bookService.getAuthorById(req.params.id),
    bookService.listBooks({ author: req.params.id, sort: (req.query.sort as string) || 'newest' }, page, limit, skip),
  ]);
  sendSuccess(res, { author, books: books.books }, 'Author loaded', 200, buildPagination(page, limit, books.total));
});

export const createAuthor = asyncHandler(async (req, res) => {
  const { name, biography, nationality, photoUrl } = req.body;
  sendSuccess(res, await bookService.createAuthor({ name, biography, nationality, photoUrl }), 'Author added', 201);
});

export const updateAuthor = asyncHandler(async (req, res) => {
  const { name, biography, nationality, photoUrl, isActive } = req.body;
  sendSuccess(res, await bookService.updateAuthor(req.params.id, { name, biography, nationality, photoUrl, isActive }), 'Author updated');
});

export const deleteAuthor = asyncHandler(async (req, res) => {
  await bookService.deleteAuthor(req.params.id);
  sendSuccess(res, null, 'Author deleted');
});