import { Router } from 'express';
import * as payments from '../controllers/payment.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { checkoutRules } from '../middleware/validation';

const router = Router();

router.use(protect, authorize('CUSTOMER'));

router.post('/checkout', checkoutRules, payments.createCheckout);
router.post('/verify', payments.verifyPayment);
router.post('/cancel', payments.cancelPayment);

export default router;