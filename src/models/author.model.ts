import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuthor extends Document {
  _id: Types.ObjectId;
  name: string;
  biography?: string;
  nationality?: string;
  photoUrl?: string;
  isActive: boolean;
}

const authorSchema = new Schema<IAuthor>(
  {
    name: { type: String, required: [true, 'Author name is required'], trim: true, maxlength: 100 },
    biography: { type: String, trim: true, maxlength: 2000 },
    nationality: { type: String, trim: true },
    photoUrl: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

authorSchema.index({ name: 1 });

export const Author = mongoose.model<IAuthor>('Author', authorSchema);