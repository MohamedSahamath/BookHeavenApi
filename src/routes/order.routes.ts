import { Router } from 'express';
import * as orders from '../controllers/order.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { orderStatusRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect);

// Customer
router.get('/my', authorize('CUSTOMER'), orders.getMyOrders);
router.patch('/:id/cancel', authorize('CUSTOMER'), mongoIdParam(), orders.cancelMyOrder);

// Staff
router.get('/', authorize('MANAGER', 'ADMIN'), orders.getAllOrders);
router.get('/stats', authorize('MANAGER', 'ADMIN'), orders.getOrderStats);
router.patch('/:id/status', authorize('MANAGER', 'ADMIN'), mongoIdParam(), orderStatusRules, orders.updateOrderStatus);

// Both 
router.get('/:id', mongoIdParam(), orders.getOrder);
router.get('/:id/invoice', mongoIdParam(), orders.downloadInvoice);

export default router;