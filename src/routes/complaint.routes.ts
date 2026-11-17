import { Router } from 'express';
import * as complaints from '../controllers/complaint.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { complaintRules, complaintStatusRules, complaintResponseRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect);

router.post('/', authorize('CUSTOMER'), complaintRules, complaints.createComplaint);
router.get('/my', authorize('CUSTOMER'), complaints.getMyComplaints);

router.get('/', authorize('MANAGER', 'ADMIN'), complaints.getAllComplaints);
router.patch('/:id/status', authorize('MANAGER', 'ADMIN'), mongoIdParam(), complaintStatusRules, complaints.updateStatus);

router.get('/:id', mongoIdParam(), complaints.getComplaint);
router.post('/:id/responses', mongoIdParam(), complaintResponseRules, complaints.addResponse);

export default router;