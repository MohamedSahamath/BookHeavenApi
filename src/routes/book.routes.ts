import { Router } from 'express';
import * as books from '../controllers/book.controller';
import { protect, optionalAuth } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { uploadCover } from '../middleware/upload';
import { bookRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.get('/', optionalAuth, books.getBooks);
router.get('/home', books.getHome);
router.get('/:id', optionalAuth, mongoIdParam(), books.getBook);

router.post('/', protect, authorize('MANAGER', 'ADMIN'), uploadCover, bookRules, books.createBook);
router.put('/:id', protect, authorize('MANAGER', 'ADMIN'), mongoIdParam(), uploadCover, bookRules, books.updateBook);
router.delete('/:id', protect, authorize('MANAGER', 'ADMIN'), mongoIdParam(), books.deleteBook);

export default router;