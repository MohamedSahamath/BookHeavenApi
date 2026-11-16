import { Router } from 'express';
import * as cart from '../controllers/cart.controller';
import { protect } from '../middleware/auth';
import { authorize } from '../middleware/role';
import { cartItemRules, cartQuantityRules, mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect, authorize('CUSTOMER'));

router.get('/', cart.getCart);
router.post('/items', cartItemRules, cart.addItem);
router.patch('/items/:bookId', mongoIdParam('bookId'), cartQuantityRules, cart.updateItem);
router.delete('/items/:bookId', mongoIdParam('bookId'), cart.removeItem);
router.delete('/', cart.clearCart);

export default router;