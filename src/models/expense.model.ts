import mongoose, { Schema, Document, Types } from 'mongoose';
import { ExpenseCategory } from '../types';

export interface IExpense extends Document {
  _id: Types.ObjectId;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: Date;
  description?: string;
  supplierOrder?: Types.ObjectId;
  recordedBy: Types.ObjectId;
}

const expenseSchema = new Schema<IExpense>(
  {
    title: { type: String, required: [true, 'Expense title is required'], trim: true },
    category: {
      type: String,
      enum: ['SUPPLIER_PAYMENT', 'DELIVERY', 'SALARY', 'RENT', 'UTILITIES', 'MARKETING', 'OTHER'],
      required: true,
    },
    amount: { type: Number, required: true, min: [0, 'Amount cannot be negative'] },
    expenseDate: { type: Date, required: true, default: Date.now },
    description: { type: String, trim: true },
    supplierOrder: { type: Schema.Types.ObjectId, ref: 'SupplierOrder' },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

expenseSchema.index({ expenseDate: -1 });
expenseSchema.index({ category: 1 });

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);