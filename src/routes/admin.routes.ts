import { Router } from 'express';
import * as admin from '../controllers/admin.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { managerCreateRules, managerUpdateRules, expenseRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect, authorize('ADMIN'));

router.get('/dashboard', admin.getDashboard);

router.get('/managers', admin.getManagers);
router.post('/managers', managerCreateRules, admin.createManager);
router.put('/managers/:id', mongoIdParam(), managerUpdateRules, admin.updateManager);
router.patch('/managers/:id/status', mongoIdParam(), admin.setManagerStatus);

router.get('/customers', admin.getCustomers);
router.get('/customers/:id', mongoIdParam(), admin.getCustomer);
router.patch('/customers/:id/status', mongoIdParam(), admin.setCustomerStatus);

router.get('/transactions', admin.getTransactions);

router.get('/expenses', admin.getExpenses);
router.post('/expenses', expenseRules, admin.createExpense);
router.put('/expenses/:id', mongoIdParam(), admin.updateExpense);
router.delete('/expenses/:id', mongoIdParam(), admin.deleteExpense);

export default router;