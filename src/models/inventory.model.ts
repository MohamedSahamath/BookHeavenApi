import mongoose, { Schema, Document, Types } from 'mongoose';
import { DEFAULT_LOW_STOCK_LEVEL } from '../utils/constants';

export interface IInventory extends Document {
  book: Types.ObjectId;
  quantity: number;
  lowStockLevel: number;
  lowStockNotified: boolean;
  updatedAt: Date;
}

const inventorySchema = new Schema<IInventory>(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true, unique: true },
    quantity: { type: Number, required: true, default: 0, min: [0, 'Stock cannot be negative'] },
    lowStockLevel: { type: Number, default: DEFAULT_LOW_STOCK_LEVEL, min: 0 },
    lowStockNotified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

inventorySchema.index({ quantity: 1 });

export const Inventory = mongoose.model<IInventory>('Inventory', inventorySchema);