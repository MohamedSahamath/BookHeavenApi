import { Router } from 'express';
import * as deliveries from '../controllers/delivery.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { deliveryUpdateRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect, authorize('MANAGER', 'ADMIN'));

router.get('/', deliveries.getDeliveries);
router.get('/stats', deliveries.getDeliveryStats);
router.post('/check-delays', deliveries.runDelayCheck);
router.patch('/:orderId', mongoIdParam('orderId'), deliveryUpdateRules, deliveries.updateDelivery);

export default router;