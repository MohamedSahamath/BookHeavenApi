import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { ApiError } from '../utils/apiError';
import { sendError } from '../utils/response';

export const notFound = (req: Request, res: Response) => {
  sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return sendError(res, err.message, err.statusCode, err.errors);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return sendError(res, 'Validation failed', 422, errors);
  }

  if (err instanceof mongoose.Error.CastError) {
    return sendError(res, `Invalid ${err.path}: ${String(err.value)}`, 400);
  }

  const mongoErr = err as { code?: number; keyValue?: Record<string, unknown> };
  if (mongoErr.code === 11000) {
    const field = Object.keys(mongoErr.keyValue || {})[0] || 'field';
    return sendError(res, `${field} already exists`, 409);
  }

  if (err instanceof multer.MulterError) {
    return sendError(res, err.message, 400);
  }

  console.error('❌ Unexpected error:', err);
  return sendError(res, 'Internal server error', 500);
};