import mongoose, { Document, Schema } from 'mongoose';

// ===== INTERFACE =====

export interface IReview extends Document {
  productId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  reviewerName: string;
  reviewerAvatar: string;
  rating: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== SCHEMA =====

const ReviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewerName: {
      type: String,
      required: true,
      trim: true,
    },
    reviewerAvatar: {
      type: String,
      default: '',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

// One review per user per product
ReviewSchema.index({ productId: 1, reviewerId: 1 }, { unique: true });

export default mongoose.model<IReview>('Review', ReviewSchema);
