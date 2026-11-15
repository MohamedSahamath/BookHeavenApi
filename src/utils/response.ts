import { Response } from 'express';

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200,
  pagination?: PaginationInfo
): Response => {
  const body: Record<string, unknown> = { success: true, message, data };
  if (pagination) body.pagination = pagination;
  return res.status(statusCode).json(body);
};

export const sendError = (
  res: Response,
  message = 'Something went wrong',
  statusCode = 500,
  errors?: unknown
): Response => {
  const body: Record<string, unknown> = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

export const getPagination = (query: { page?: unknown; limit?: unknown }, defaultLimit = 10) => {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || defaultLimit), 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const buildPagination = (page: number, limit: number, total: number): PaginationInfo => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit) || 1,
});