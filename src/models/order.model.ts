import mongoose, { Schema, Document, Types } from 'mongoose';
import { OrderStatus, PaymentStatus } from '../types';

export interface IOrderItem {
  book: Types.ObjectId;
  title: string;
  isbn: string;
  authorNames: string[];
  coverImage?: string;
  unitPrice: number;
  unitCost: number;
  quantity: number;
  lineTotal: number;
}

export interface IShippingAddress {
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;
  postalCode: string;
}

export interface IStatusHistory {
  status: OrderStatus;
  changedAt: Date;
  changedBy?: Types.ObjectId;
  note?: string;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  customer: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  deliveryCharge: number;
  totalAmount: number;
  shippingAddress: IShippingAddress;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payment?: Types.ObjectId;
  invoiceNumber?: string;
  confirmedAt?: Date;
  expectedDeliveryDate?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  statusHistory: IStatusHistory[];
  delayNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    title: { type: String, required: true },
    isbn: { type: String, required: true },
    authorNames: [String],
    coverImage: String,
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [orderItemSchema],
      validate: [(v: IOrderItem[]) => v.length > 0, 'Order must have at least one item'],
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryCharge: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: {
      recipientName: { type: String, required: true },
      phone: { type: String, required: true },
      addressLine1: { type: String, required: true },
      addressLine2: String,
      city: { type: String, required: true },
      district: { type: String, required: true },
      postalCode: { type: String, required: true },
    },
    status: {
      type: String,
      enum: ['PAYMENT_PENDING', 'CONFIRMED', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'PAYMENT_PENDING',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING', 'REFUNDED'],
      default: 'PENDING',
    },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
    // sparse => the unique rule only applies to orders that HAVE an invoice number
    invoiceNumber: { type: String, unique: true, sparse: true },
    confirmedAt: Date,
    expectedDeliveryDate: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    delayNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ confirmedAt: 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);