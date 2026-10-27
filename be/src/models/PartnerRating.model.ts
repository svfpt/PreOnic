import mongoose, { Document, Schema } from 'mongoose';

export interface IPartnerRating extends Document {
  contractId: mongoose.Types.ObjectId;
  reviewerId: mongoose.Types.ObjectId;
  revieweeId: mongoose.Types.ObjectId;
  reviewerRole: 'farmer' | 'enterprise';
  revieweeRole: 'farmer' | 'enterprise';
  criteria: {
    transparency?: number;
    paymentPunctuality?: number;
    coordination?: number;
    quality?: number;
    onTimeDelivery?: number;
    committedVolume?: number;
  };
  overallRating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartnerRatingSchema = new Schema<IPartnerRating>(
  {
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    revieweeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewerRole: {
      type: String,
      enum: ['farmer', 'enterprise'],
      required: true,
    },
    revieweeRole: {
      type: String,
      enum: ['farmer', 'enterprise'],
      required: true,
    },
    criteria: {
      type: Schema.Types.Mixed,
      required: true,
    },
    overallRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },
  },
  {
    timestamps: true,
  }
);

PartnerRatingSchema.index({ contractId: 1, reviewerId: 1 }, { unique: true });
PartnerRatingSchema.index({ revieweeId: 1, createdAt: -1 });
PartnerRatingSchema.index({ reviewerId: 1, createdAt: -1 });

export default mongoose.model<IPartnerRating>('PartnerRating', PartnerRatingSchema);
