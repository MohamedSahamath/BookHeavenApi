import { Router } from 'express';
import * as notifications from '../controllers/notification.controller';
import { protect } from '../middleware/auth';
import { mongoIdParam } from '../middleware/validation';

const router = Router();

router.use(protect);

router.get('/', notifications.getNotifications);
router.get('/unread-count', notifications.getUnreadCount);
router.patch('/read-all', notifications.markAllAsRead);
router.patch('/:id/read', mongoIdParam(), notifications.markAsRead);
router.delete('/:id', mongoIdParam(), notifications.deleteNotification);

export default router;