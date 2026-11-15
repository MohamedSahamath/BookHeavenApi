import mongoose, { Schema, Document, Types } from 'mongoose';
import { NotificationType } from '../types';

export interface INotification extends Document {
  user: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['ORDER', 'DELIVERY', 'COMPLAINT', 'STOCK', 'SUPPLIER', 'SYSTEM'],
      default: 'SYSTEM',
    },
    link: String,
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);