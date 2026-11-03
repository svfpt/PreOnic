import mongoose, { Schema, Document } from 'mongoose';

// Đơn xin rút tiền: User gửi đơn -> Admin xem xét -> Admin hoàn thành (trừ số dư) hoặc từ chối.
export interface IWithdrawalRequest extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  bankName: string;
  bankBin?: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  note?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'failed';
  fundsReserved: boolean;
  payoutReference?: string;
  idempotencyKey?: string;
  payoutChannel?: string;
  payoutId?: string;
  dispatchAttemptedAt?: Date;
  lastCheckedAt?: Date;
  lastError?: string;
  adminNote?: string;
  processedBy?: mongoose.Types.ObjectId;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 1 },
    bankName: { type: String, required: true, trim: true },
    bankBin: { type: String, match: /^\d{6}$/ },
    bankAccountNumber: { type: String, required: true, trim: true },
    bankAccountHolder: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String, trim: true },
    fundsReserved: { type: Boolean, default: false },
    payoutReference: { type: String, unique: true, sparse: true },
    idempotencyKey: { type: String },
    payoutChannel: { type: String },
    payoutId: { type: String },
    dispatchAttemptedAt: { type: Date },
    lastCheckedAt: { type: Date },
    lastError: { type: String },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

WithdrawalRequestSchema.index({ userId: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IWithdrawalRequest>(
  'WithdrawalRequest',
  WithdrawalRequestSchema,
);
