import mongoose, { Document, Schema } from 'mongoose';

// ===== MILESTONE INTERFACE =====

export interface IMilestone {
  _id?: mongoose.Types.ObjectId;
  step: number;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'disputed';
  requiredBy: 'farmer' | 'enterprise' | 'system';
  farmerConfirmed: boolean;
  farmerConfirmedAt?: Date;
  enterpriseConfirmed: boolean;
  enterpriseConfirmedAt?: Date;
  releaseAmount: number;
  releasePercentage: number;
  completedAt?: Date;
  evidence?: string;
}

// ===== ESCROW INTERFACE =====

export interface IEscrow extends Document {
  contractId: mongoose.Types.ObjectId;
  farmerId: mongoose.Types.ObjectId;
  enterpriseId: mongoose.Types.ObjectId;
  totalAmount: number;
  depositedAmount: number;
  releasedAmount: number;
  refundedAmount: number;
  status: 'awaiting_deposit' | 'funded' | 'partially_released' | 'fully_released' | 'refunded' | 'disputed';
  milestones: IMilestone[];
  transactions: IEscrowTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

// ===== TRANSACTION INTERFACE =====

export interface IEscrowTransaction {
  _id?: mongoose.Types.ObjectId;
  type: 'deposit' | 'release' | 'refund';
  amount: number;
  fromUserId: mongoose.Types.ObjectId;
  toUserId?: mongoose.Types.ObjectId;
  milestoneStep?: number;
  description: string;
  createdAt: Date;
}

// ===== SCHEMAS =====

const MilestoneSchema = new Schema<IMilestone>(
  {
    step: {
      type: Number,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'disputed'],
      default: 'pending',
    },
    requiredBy: {
      type: String,
      enum: ['farmer', 'enterprise', 'system'],
      default: 'system',
    },
    farmerConfirmed: {
      type: Boolean,
      default: false,
    },
    farmerConfirmedAt: {
      type: Date,
    },
    enterpriseConfirmed: {
      type: Boolean,
      default: false,
    },
    enterpriseConfirmedAt: {
      type: Date,
    },
    releaseAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    releasePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    completedAt: {
      type: Date,
    },
    evidence: {
      type: String,
    },
  },
  { _id: true }
);

const EscrowTransactionSchema = new Schema<IEscrowTransaction>(
  {
    type: {
      type: String,
      enum: ['deposit', 'release', 'refund'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    milestoneStep: {
      type: Number,
    },
    description: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const EscrowSchema = new Schema<IEscrow>(
  {
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
      unique: true,
    },
    farmerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    enterpriseId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    depositedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    releasedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['awaiting_deposit', 'funded', 'partially_released', 'fully_released', 'refunded', 'disputed'],
      default: 'awaiting_deposit',
    },
    milestones: [MilestoneSchema],
    transactions: [EscrowTransactionSchema],
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc: any, ret: any) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
EscrowSchema.index({ farmerId: 1 });
EscrowSchema.index({ enterpriseId: 1 });
EscrowSchema.index({ status: 1 });

export default mongoose.model<IEscrow>('Escrow', EscrowSchema);
