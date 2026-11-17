import { Router } from 'express';
import * as suppliers from '../controllers/supplier.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { supplierRules, supplierOrderRules, receiveSupplierOrderRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect, authorize('MANAGER', 'ADMIN'));

router.get('/orders', suppliers.getSupplierOrders);
router.post('/orders', supplierOrderRules, suppliers.createSupplierOrder);
router.patch('/orders/:id', mongoIdParam(), suppliers.updateSupplierOrder);
router.patch('/orders/:id/receive', mongoIdParam(), receiveSupplierOrderRules, suppliers.receiveSupplierOrder);
router.patch('/orders/:id/not-received', mongoIdParam(), suppliers.markNotReceived);
router.delete('/orders/:id', mongoIdParam(), suppliers.deleteSupplierOrder);

router.get('/', suppliers.getSuppliers);
router.post('/', supplierRules, suppliers.createSupplier);
router.get('/:id', mongoIdParam(), suppliers.getSupplier);
router.put('/:id', mongoIdParam(), supplierRules, suppliers.updateSupplier);
router.patch('/:id/status', mongoIdParam(), suppliers.toggleSupplierStatus);
router.delete('/:id', mongoIdParam(), suppliers.deleteSupplier);

export default router;