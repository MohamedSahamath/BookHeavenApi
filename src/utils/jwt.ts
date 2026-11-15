import jwt, { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '../types';

const accessSecret = (): string => process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
const refreshSecret = (): string => process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';

export const generateAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, accessSecret(), {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES || '15m') as SignOptions['expiresIn'],
  });

export const generateRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, refreshSecret(), {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES || '7d') as SignOptions['expiresIn'],
  });

export const verifyAccessToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, accessSecret()) as JwtPayload;
  return { id: decoded.id, role: decoded.role };
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, refreshSecret()) as JwtPayload;
  return { id: decoded.id, role: decoded.role };
};

export const refreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  };
};