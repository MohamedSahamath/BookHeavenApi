import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/user.model';
import { sendError } from '../utils/response';

const getTokenFromHeader = (req: AuthRequest): string | null => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  return null;
};

export const protect = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = getTokenFromHeader(req);
  if (!token) {
    return sendError(res, 'Not authorized. Please log in.', 401);
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.id).select('role isActive');
    if (!user || !user.isActive) {
      return sendError(res, 'Account not found or deactivated', 401);
    }

    req.user = { id: payload.id, role: user.role };
    next();
  } catch {
    return sendError(res, 'Session expired. Please log in again.', 401);
  }
};

export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = getTokenFromHeader(req);
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // ignore invalid token - continue as guest
    }
  }
  next();
};