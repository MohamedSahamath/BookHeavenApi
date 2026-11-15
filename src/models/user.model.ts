import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role } from '../types';
import { SRI_LANKA_DISTRICTS } from '../utils/constants';

export interface IAddress {
  _id?: Types.ObjectId;
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;
  postalCode: string;
  isDefault: boolean;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  isActive: boolean;
  addresses: Types.DocumentArray<IAddress & Document>;
  recentlyViewed: Types.ObjectId[];
  refreshTokenHash?: string;
  pendingContact?: {
    type: 'EMAIL' | 'PHONE';
    value: string;
    otpHash: string;
    expiresAt: Date;
  };
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const addressSchema = new Schema<IAddress>({
  label: { type: String, default: 'Home', trim: true },
  recipientName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, match: [/^0\d{9}$/, 'Phone must be 10 digits starting with 0'] },
  addressLine1: { type: String, required: true, trim: true },
  addressLine2: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  district: { type: String, required: true, enum: SRI_LANKA_DISTRICTS },
  postalCode: { type: String, required: true, match: [/^\d{5}$/, 'Postal code must be 5 digits'] },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      match: [/^0\d{9}$/, 'Mobile number must be 10 digits starting with 0'],
    },
    // select: false => password is never returned in queries unless we ask for it
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['ADMIN', 'MANAGER', 'CUSTOMER'], default: 'CUSTOMER' },
    isActive: { type: Boolean, default: true },
    addresses: [addressSchema],
    recentlyViewed: [{ type: Schema.Types.ObjectId, ref: 'Book' }],
    refreshTokenHash: { type: String, select: false },
    pendingContact: {
      type: {
        type: String,
        enum: ['EMAIL', 'PHONE'],
      },
      value: String,
      otpHash: String,
      expiresAt: Date,
    },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });

// Before saving, hash the password if it was changed (bcryptjs, 10 salt rounds)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compares a plain password with the hashed password in the database
userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Remove sensitive fields whenever a user is converted to JSON
userSchema.set('toJSON', {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.pendingContact;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);