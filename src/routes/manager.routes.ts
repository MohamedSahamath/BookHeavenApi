import { Router } from 'express';
import * as manager from '../controllers/manager.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';

const router = Router();

router.get('/dashboard', protect, authorize('MANAGER', 'ADMIN'), manager.getDashboard);

export default router;