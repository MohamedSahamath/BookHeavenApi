import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBook extends Document {
  _id: Types.ObjectId;
  title: string;
  isbn: string;
  description: string;
  authors: Types.ObjectId[];
  category: Types.ObjectId;
  price: number;
  discountPercent: number;
  purchaseCost: number;
  coverImage: string;
  publisher?: string;
  publicationYear?: number;
  language: string;
  pages?: number;
  isFeatured: boolean;
  isActive: boolean;
  soldCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 200 },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
      match: [/^(\d{10}|\d{13})$/, 'ISBN must be 10 or 13 digits'],
    },
    description: { type: String, required: [true, 'Description is required'], maxlength: 5000 },
    authors: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Author' }],
      validate: [(v: Types.ObjectId[]) => v.length > 0, 'At least one author is required'],
    },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'] },
    price: { type: Number, required: [true, 'Price is required'], min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 90 },
    purchaseCost: { type: Number, required: [true, 'Purchase cost is required'], min: 0 },
    coverImage: { type: String, default: '' },
    publisher: { type: String, trim: true },
    publicationYear: { type: Number, min: 1000, max: 3000 },
    language: { type: String, default: 'English' },
    pages: { type: Number, min: 1 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

bookSchema.index({ title: 'text', description: 'text' });
bookSchema.index({ category: 1 });
bookSchema.index({ authors: 1 });
bookSchema.index({ price: 1 });
bookSchema.index({ soldCount: -1 });
bookSchema.index({ createdAt: -1 });

export const getSellingPrice = (book: { price: number; discountPercent?: number }): number => {
  const discount = book.discountPercent || 0;
  return Math.round(book.price * (1 - discount / 100) * 100) / 100;
};

export const Book = mongoose.model<IBook>('Book', bookSchema);