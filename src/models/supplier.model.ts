import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISupplier extends Document {
  _id: Types.ObjectId;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    district: string;
    postalCode?: string;
  };
  suppliedBooks: Types.ObjectId[];
  notes?: string;
  isActive: boolean;
}

const supplierSchema = new Schema<ISupplier>(
  {
    name: { type: String, required: [true, 'Supplier name is required'], trim: true, unique: true },
    contactPerson: { type: String, required: [true, 'Contact person is required'], trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
    phone: { type: String, required: true, match: [/^0\d{9}$/, 'Phone must be 10 digits starting with 0'] },
    address: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      district: { type: String, required: true, trim: true },
      postalCode: { type: String, trim: true },
    },
    suppliedBooks: [{ type: Schema.Types.ObjectId, ref: 'Book' }],
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Supplier = mongoose.model<ISupplier>('Supplier', supplierSchema);