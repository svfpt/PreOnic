import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentTransaction extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'topup' | 'escrow_deposit' | 'escrow_release' | 'refund' | 'commission' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  paymentMethod: 'sepay' | 'internal' | 'demo' | 'bank_transfer';
  gatewayRef?: string;
  orderCode?: number;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  completedAt?: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['topup', 'escrow_deposit', 'escrow_release', 'refund', 'commission', 'withdrawal'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['sepay', 'internal', 'demo', 'bank_transfer'],
      required: true,
    },
    gatewayRef: { type: String },
    orderCode: { type: Number, unique: true, sparse: true },
    description: { type: String, required: true },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

PaymentTransactionSchema.index({ userId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ status: 1 });

export default mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  PaymentTransactionSchema
);
