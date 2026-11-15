import { Response, NextFunction } from 'express';
import { AuthRequest, Role } from '../types';
import { sendError } from '../utils/response';

export const authorize =
  (...allowedRoles: Role[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Not authorized. Please log in.', 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 'You do not have permission to access this resource', 403);
    }
    next();
  };