import { AuthRequest } from '../types';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, getPagination, buildPagination } from '../utils/response';
import * as notificationService from '../services/notification.service';

export const getNotifications = asyncHandler(async (req: AuthRequest, res) => {
  const { page, limit, skip } = getPagination(req.query, 10);
  const result = await notificationService.getMyNotifications(req.user!.id, page, limit, skip);
  sendSuccess(
    res,
    { notifications: result.notifications, unreadCount: result.unreadCount },
    'Notifications loaded',
    200,
    buildPagination(page, limit, result.total)
  );
});

export const getUnreadCount = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, { unreadCount: await notificationService.getUnreadCount(req.user!.id) }, 'Unread count loaded');
});

export const markAsRead = asyncHandler(async (req: AuthRequest, res) => {
  sendSuccess(res, await notificationService.markAsRead(req.user!.id, req.params.id), 'Marked as read');
});

export const markAllAsRead = asyncHandler(async (req: AuthRequest, res) => {
  await notificationService.markAllAsRead(req.user!.id);
  sendSuccess(res, null, 'All notifications marked as read');
});

export const deleteNotification = asyncHandler(async (req: AuthRequest, res) => {
  await notificationService.deleteNotification(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Notification deleted');
});