import { Router } from 'express';
import * as authors from '../controllers/author.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { authorRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.get('/', authors.getAuthors);
router.get('/:id', mongoIdParam(), authors.getAuthor);

router.post('/', protect, authorize('MANAGER', 'ADMIN'), authorRules, authors.createAuthor);
router.put('/:id', protect, authorize('MANAGER', 'ADMIN'), mongoIdParam(), authorRules, authors.updateAuthor);
router.delete('/:id', protect, authorize('MANAGER', 'ADMIN'), mongoIdParam(), authors.deleteAuthor);

export default router;