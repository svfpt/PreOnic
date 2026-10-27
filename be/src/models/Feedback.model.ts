import mongoose, { Document, Schema } from 'mongoose';

// Phản hồi hệ thống do Nông dân / Doanh nghiệp gửi → Admin xem & xử lý.
export type FeedbackCategory = 'bug' | 'feature' | 'ux' | 'payment' | 'other';
export type FeedbackStatus = 'new' | 'read' | 'resolved';

export interface IFeedback extends Document {
  userId: mongoose.Types.ObjectId;
  userRole: 'farmer' | 'enterprise';
  userName: string;
  userEmail: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userRole: {
      type: String,
      enum: ['farmer', 'enterprise'],
      required: true,
    },
    // Lưu snapshot tên/email tại thời điểm gửi để admin xem nhanh kể cả khi user đổi hồ sơ.
    userName: { type: String, required: true, trim: true },
    userEmail: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['bug', 'feature', 'ux', 'payment', 'other'],
      default: 'other',
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: ['new', 'read', 'resolved'],
      default: 'new',
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IFeedback>('Feedback', FeedbackSchema);
