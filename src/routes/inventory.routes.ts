import { Router } from 'express';
import * as inventory from '../controllers/inventory.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { stockAdjustRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect, authorize('MANAGER', 'ADMIN'));

router.get('/', inventory.getInventory);
router.get('/summary', inventory.getSummary);
router.get('/low-stock', inventory.getLowStock);
router.get('/movements', inventory.getMovements);
router.patch('/:bookId/adjust', mongoIdParam('bookId'), stockAdjustRules, inventory.adjustStock);
router.patch('/:bookId/low-stock-level', mongoIdParam('bookId'), inventory.updateLowStockLevel);

export default router;