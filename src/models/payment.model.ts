import mongoose, { Schema, Document, Types } from 'mongoose';
import { PaymentStatus } from '../types';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  customer: Types.ObjectId;
  provider: 'STRIPE';
  method: 'CARD';
  sessionId: string;
  transactionId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  cardBrand?: string;
  cardLast4?: string;
  paidAt?: Date;
  failureReason?: string;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: String, enum: ['STRIPE'], default: 'STRIPE' },
    method: { type: String, enum: ['CARD'], default: 'CARD' }, 
    sessionId: { type: String, required: true, unique: true },
    transactionId: { type: String, unique: true, sparse: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'LKR' },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING', 'REFUNDED'],
      default: 'PENDING',
    },
    cardBrand: String,
    cardLast4: String,
    paidAt: Date,
    failureReason: String,
  },
  { timestamps: true }
);

paymentSchema.index({ order: 1 });
paymentSchema.index({ status: 1, paidAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);