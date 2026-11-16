import { Response } from 'express';
import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { refreshCookieOptions, verifyRefreshToken } from '../utils/jwt';
import * as authService from '../services/auth.service';

const REFRESH_COOKIE = 'refreshToken';

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
};

export const register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.registerCustomer({ fullName, email, phone, password });
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { user, accessToken }, 'Registration successful', 201);
});

export const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body.email, req.body.password);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { user, accessToken }, 'Login successful');
});

export const refresh = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.refreshTokens(req.cookies?.[REFRESH_COOKIE]);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { user, accessToken }, 'Token refreshed');
});

export const logout = asyncHandler(async (req: AuthRequest, res) => {
  let userId = req.user?.id;
  if (!userId && req.cookies?.[REFRESH_COOKIE]) {
    try {
      userId = verifyRefreshToken(req.cookies[REFRESH_COOKIE]).id;
    } catch {
      userId = undefined;
    }
  }
  if (userId) await authService.logout(userId);
  const { maxAge, ...clearOptions } = refreshCookieOptions();
  void maxAge;
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  sendSuccess(res, null, 'Logged out');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body.identifier);
  sendSuccess(res, null, 'If an account exists for these details, a password reset link has been sent to the registered email.');
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  sendSuccess(res, null, 'Password reset successful. Please log in.');
});

export const getMe = asyncHandler(async (req: AuthRequest, res) => {
  const user = await authService.getProfile(req.user!.id);
  sendSuccess(res, user, 'Profile loaded');
});

export const updateMe = asyncHandler(async (req: AuthRequest, res) => {
  const user = await authService.updateProfile(req.user!.id, { fullName: req.body.fullName });
  sendSuccess(res, user, 'Profile updated');
});

export const changePassword = asyncHandler(async (req: AuthRequest, res) => {
  await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  sendSuccess(res, null, 'Password changed');
});

export const requestContactChange = asyncHandler(async (req: AuthRequest, res) => {
  await authService.requestContactChange(req.user!.id, req.body.type, req.body.value);
  sendSuccess(res, null, 'Verification code sent');
});

export const verifyContactChange = asyncHandler(async (req: AuthRequest, res) => {
  const user = await authService.verifyContactChange(req.user!.id, String(req.body.otp || ''));
  sendSuccess(res, user, 'Contact details updated');
});

export const getAddresses = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await authService.getAddresses(req.user!.id), 'Addresses loaded');
});

export const addAddress = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await authService.addAddress(req.user!.id, req.body), 'Address added', 201);
});

export const updateAddress = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await authService.updateAddress(req.user!.id, req.params.addressId, req.body), 'Address updated');
});

export const deleteAddress = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await authService.deleteAddress(req.user!.id, req.params.addressId), 'Address deleted');
});