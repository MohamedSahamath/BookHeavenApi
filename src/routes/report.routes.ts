import { Router } from 'express';
import * as reports from '../controllers/report.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';

const router = Router();

router.use(protect);

router.get('/analytics', authorize('ADMIN'), reports.getAnalytics);
router.get('/profit', authorize('ADMIN'), reports.getProfitReport);
router.get('/pdf/sales', authorize('ADMIN'), reports.salesPdf);
router.get('/pdf/expenses', authorize('ADMIN'), reports.expensesPdf);
router.get('/pdf/profit', authorize('ADMIN'), reports.profitPdf);

router.get('/pdf/inventory', authorize('ADMIN', 'MANAGER'), reports.inventoryPdf);
router.get('/pdf/supplier-deliveries', authorize('ADMIN', 'MANAGER'), reports.supplierDeliveriesPdf);
router.get('/pdf/orders', authorize('ADMIN', 'MANAGER'), reports.orderSummaryPdf);

export default router;