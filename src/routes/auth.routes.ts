import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as auth from '../controllers/auth.controller';
import { protect, optionalAuth } from '../middleware/auth';
import { authorize } from '../middleware/role';
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
  updateProfileRules,
  contactChangeRules,
  addressRules,
  mongoIdParam,
} from '../middleware/validation';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

router.post('/register', authLimiter, registerRules, auth.register);
router.post('/login', authLimiter, loginRules, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', optionalAuth, auth.logout);
router.post('/forgot-password', authLimiter, forgotPasswordRules, auth.forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordRules, auth.resetPassword);

router.get('/me', protect, auth.getMe);
router.patch('/me', protect, updateProfileRules, auth.updateMe);
router.patch('/change-password', protect, changePasswordRules, auth.changePassword);

router.post('/contact-change/request', protect, authorize('CUSTOMER'), authLimiter, contactChangeRules, auth.requestContactChange);
router.post('/contact-change/verify', protect, authorize('CUSTOMER'), auth.verifyContactChange);

router.get('/addresses', protect, authorize('CUSTOMER'), auth.getAddresses);
router.post('/addresses', protect, authorize('CUSTOMER'), addressRules, auth.addAddress);
router.put('/addresses/:addressId', protect, authorize('CUSTOMER'), mongoIdParam('addressId'), addressRules, auth.updateAddress);
router.delete('/addresses/:addressId', protect, authorize('CUSTOMER'), mongoIdParam('addressId'), auth.deleteAddress);

export default router;