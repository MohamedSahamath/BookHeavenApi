import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICartItem {
  book: Types.ObjectId;
  quantity: number;
}

export interface ICart extends Document {
  user: Types.ObjectId;
  items: ICartItem[];
}

const cartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        _id: false,
        book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
  },
  { timestamps: true }
);

export const Cart = mongoose.model<ICart>('Cart', cartSchema);