import mongoose, { Schema, Document, Types } from 'mongoose';
import { SupplierOrderStatus } from '../types';

export interface ISupplierOrder extends Document {
  _id: Types.ObjectId;
  referenceNumber: string;
  supplier: Types.ObjectId;
  book: Types.ObjectId;
  orderedQuantity: number;
  receivedQuantity: number;
  unitCost: number;
  orderDate: Date;
  expectedDeliveryDate: Date;
  actualReceivedDate?: Date;
  status: SupplierOrderStatus;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const supplierOrderSchema = new Schema<ISupplierOrder>(
  {
    referenceNumber: { type: String, required: true, unique: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    orderedQuantity: { type: Number, required: true, min: [1, 'Ordered quantity must be at least 1'] },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    orderDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date, required: true },
    actualReceivedDate: Date,
    status: {
      type: String,
      enum: ['PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'NOT_RECEIVED'],
      default: 'PENDING',
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

supplierOrderSchema.index({ supplier: 1, status: 1 });

export const SupplierOrder = mongoose.model<ISupplierOrder>('SupplierOrder', supplierOrderSchema);