import { Types } from 'mongoose';
import { Notification } from '../models/notification.model';
import { User } from '../models/user.model';
import { NotificationType, Role } from '../types';
import { ApiError } from '../utils/apiError';

export const notifyUser = async (
  userId: string | Types.ObjectId,
  title: string,
  message: string,
  type: NotificationType = 'SYSTEM',
  link?: string
): Promise<void> => {
  try {
    await Notification.create({ user: userId, title, message, type, link });
  } catch (error) {
    console.error('Notification failed:', (error as Error).message);
  }
};

export const notifyRoles = async (
  roles: Role[],
  title: string,
  message: string,
  type: NotificationType = 'SYSTEM',
  link?: string
): Promise<void> => {
  try {
    const users = await User.find({ role: { $in: roles }, isActive: true }).select('_id');
    if (users.length === 0) return;
    await Notification.insertMany(users.map((u) => ({ user: u._id, title, message, type, link })));
  } catch (error) {
    console.error('Role notification failed:', (error as Error).message);
  }
};

export const getMyNotifications = async (userId: string, page: number, limit: number, skip: number) => {
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments({ user: userId }),
    Notification.countDocuments({ user: userId, isRead: false }),
  ]);
  return { notifications, total, unreadCount, page, limit };
};

export const getUnreadCount = (userId: string) => Notification.countDocuments({ user: userId, isRead: false });

export const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId }, // users can only update their own notifications
    { isRead: true },
    { new: true }
  );
  if (!notification) throw new ApiError(404, 'Notification not found');
  return notification;
};

export const markAllAsRead = async (userId: string) => {
  await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
};

export const deleteNotification = async (userId: string, notificationId: string) => {
  const result = await Notification.findOneAndDelete({ _id: notificationId, user: userId });
  if (!result) throw new ApiError(404, 'Notification not found');
};