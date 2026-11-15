import mongoose, { Schema, Document, Types } from 'mongoose';

export type DeliveryStatus = 'PENDING' | 'PROCESSING' | 'DISPATCHED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface IDelivery extends Document {
  _id: Types.ObjectId;
  order: Types.ObjectId;
  customer: Types.ObjectId;
  customerName: string;
  contactNumber: string;
  address: string;
  city: string;
  district: string;
  postalCode: string;
  orderDate: Date;
  expectedDeliveryDate: Date;
  dispatchDate?: Date;
  deliveredDate?: Date;
  status: DeliveryStatus;
  courierName?: string;
  trackingNumber?: string;
  notes?: string;
}

const deliverySchema = new Schema<IDelivery>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    postalCode: { type: String, required: true },
    orderDate: { type: Date, required: true },
    expectedDeliveryDate: { type: Date, required: true },
    dispatchDate: Date,
    deliveredDate: Date,
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      default: 'PENDING',
    },
    courierName: { type: String, trim: true },
    trackingNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

deliverySchema.index({ status: 1, expectedDeliveryDate: 1 });
deliverySchema.index({ district: 1 });

export const Delivery = mongoose.model<IDelivery>('Delivery', deliverySchema);