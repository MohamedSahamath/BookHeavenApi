import { Router } from 'express';
import * as categories from '../controllers/category.controller';
import { protect, optionalAuth } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { categoryRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.get('/', optionalAuth, categories.getCategories);

router.post('/', protect, authorize('MANAGER', 'ADMIN'), categoryRules, categories.createCategory);
router.put('/:id', protect, authorize('MANAGER', 'ADMIN'), mongoIdParam(), categoryRules, categories.updateCategory);
router.delete('/:id', protect, authorize('MANAGER', 'ADMIN'), mongoIdParam(), categories.deleteCategory);

export default router;