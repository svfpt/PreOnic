import mongoose, { Document, Schema } from 'mongoose';

// ===== INTERFACE =====

export interface IDispute extends Document {
  contractId: mongoose.Types.ObjectId;
  escrowId: mongoose.Types.ObjectId;
  milestoneStep: number;
  raisedBy: mongoose.Types.ObjectId;
  raisedByRole: 'farmer' | 'enterprise';
  againstUserId: mongoose.Types.ObjectId;
  reason: string;
  evidence: string[];
  status: 'open' | 'under_review' | 'resolved_farmer' | 'resolved_enterprise' | 'closed';
  adminNotes?: string;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== SCHEMA =====

const DisputeSchema = new Schema<IDispute>(
  {
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'Contract',
      required: true,
    },
    escrowId: {
      type: Schema.Types.ObjectId,
      ref: 'Escrow',
      required: true,
    },
    milestoneStep: {
      type: Number,
      required: true,
    },
    raisedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    raisedByRole: {
      type: String,
      enum: ['farmer', 'enterprise'],
      required: true,
    },
    againstUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      minlength: [10, 'Reason must be at least 10 characters'],
    },
    evidence: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved_farmer', 'resolved_enterprise', 'closed'],
      default: 'open',
    },
    adminNotes: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
    resolution: {
      type: String,
    },
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
DisputeSchema.index({ contractId: 1 });
DisputeSchema.index({ escrowId: 1 });
DisputeSchema.index({ raisedBy: 1 });
DisputeSchema.index({ status: 1 });

export default mongoose.model<IDispute>('Dispute', DisputeSchema);
