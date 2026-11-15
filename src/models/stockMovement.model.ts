import mongoose, { Schema, Document, Types } from 'mongoose';
import { StockMovementType } from '../types';

export interface IStockMovement extends Document {
  book: Types.ObjectId;
  type: StockMovementType;
  quantity: number; 
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  order?: Types.ObjectId;
  supplierOrder?: Types.ObjectId;
  performedBy?: Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    type: {
      type: String,
      required: true,
      enum: ['INITIAL', 'SUPPLIER_DELIVERY', 'MANUAL_ADD', 'MANUAL_REMOVE', 'SALE', 'ORDER_CANCELLED'],
    },
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    newQuantity: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    supplierOrder: { type: Schema.Types.ObjectId, ref: 'SupplierOrder' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stockMovementSchema.index({ book: 1, createdAt: -1 });

export const StockMovement = mongoose.model<IStockMovement>('StockMovement', stockMovementSchema);