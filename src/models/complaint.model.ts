import mongoose, { Schema, Document, Types } from 'mongoose';
import { ComplaintStatus, ComplaintType, Role } from '../types';

export interface IComplaintResponse {
  responder: Types.ObjectId;
  responderRole: Role;
  message: string;
  createdAt: Date;
}

export interface IComplaint extends Document {
  _id: Types.ObjectId;
  complaintNumber: string;
  customer: Types.ObjectId;
  order: Types.ObjectId;
  type: ComplaintType;
  subject: string;
  description: string;
  status: ComplaintStatus;
  responses: IComplaintResponse[];
  statusHistory: { status: ComplaintStatus; changedAt: Date; changedBy?: Types.ObjectId; note?: string }[];
  resolvedAt?: Date;
  createdAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    complaintNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    type: {
      type: String,
      enum: ['DELIVERY_DELAY', 'DAMAGED_BOOK', 'WRONG_BOOK', 'PAYMENT_ISSUE', 'OTHER'],
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'],
      default: 'SUBMITTED',
    },
    responses: [
      {
        _id: false,
        responder: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        responderRole: { type: String, enum: ['ADMIN', 'MANAGER', 'CUSTOMER'], required: true },
        message: { type: String, required: true, trim: true, maxlength: 2000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    resolvedAt: Date,
  },
  { timestamps: true }
);

complaintSchema.index({ customer: 1, createdAt: -1 });
complaintSchema.index({ status: 1 });

export const Complaint = mongoose.model<IComplaint>('Complaint', complaintSchema);