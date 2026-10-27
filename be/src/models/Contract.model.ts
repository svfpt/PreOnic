import mongoose, { Document, Schema } from 'mongoose';
import { InsuranceCoveredEvent } from '../types';
import { UNIT_TO_KG } from '../constants';

// ===== INTERFACES =====

export interface IInsuranceInfo {
  insuranceCompany?: string;
  policyNumber?: string;
  insuredValue?: number;
  coveredEvents?: InsuranceCoveredEvent;
  validFrom?: Date;
  validTo?: Date;
  attachmentUrl?: string;
}

export interface IContractLocation {
  province?: string;
  district?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface IContract extends Document {
  contractCode: string;
  productId?: mongoose.Types.ObjectId;
  farmerId: mongoose.Types.ObjectId;
  enterpriseId: mongoose.Types.ObjectId;
  farmerName: string;
  enterpriseName: string;
  productName: string;
  quantity: number;
  unit: 'tan' | 'ta' | 'kg' | 'thung';
  pricePerUnit: number;
  totalValue: number;
  commission: number;
  commissionRate: number;
  depositAmount: number;
  depositPercentage: number;
  paymentTerms: '50_50' | '30_70' | '100_delivery' | '100_upfront';
  deliveryDate: Date;
  notes?: string;
  status: 'draft' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled' | 'disputed';
  signedByFarmer: boolean;
  signedByEnterprise: boolean;
  signedAt?: Date;
  signOtpHash?: string;
  signOtpExpiry?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  farmLocation?: IContractLocation;
  insuranceFarmer?: IInsuranceInfo;
  insuranceEnterprise?: IInsuranceInfo;
  riskSharingTerms?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== SCHEMA =====

const ContractSchema = new Schema<IContract>(
  {
    contractCode: {
      type: String,
      required: true,
      unique: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
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
    farmerName: {
      type: String,
      required: true,
    },
    enterpriseName: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.01, 'Quantity must be positive'],
    },
    unit: {
      type: String,
      enum: ['tan', 'ta', 'kg', 'thung'],
      default: 'tan',
    },
    pricePerUnit: {
      type: Number,
      required: [true, 'Price per unit is required'],
      min: [0, 'Price must be non-negative'],
    },
    totalValue: {
      type: Number,
      required: true,
    },
    commission: {
      type: Number,
      required: true,
    },
    commissionRate: {
      type: Number,
      default: 3,
    },
    depositAmount: {
      type: Number,
      required: true,
      min: [0, 'Deposit amount must be non-negative'],
    },
    depositPercentage: {
      type: Number,
      required: true,
      min: [0, 'Deposit percentage must be non-negative'],
      max: [100, 'Deposit percentage cannot exceed 100'],
    },
    paymentTerms: {
      type: String,
      enum: ['50_50', '30_70', '100_delivery', '100_upfront'],
      default: '50_50',
    },
    deliveryDate: {
      type: Date,
      required: [true, 'Delivery date is required'],
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'active', 'completed', 'cancelled', 'disputed'],
      default: 'draft',
    },
    signedByFarmer: {
      type: Boolean,
      default: false,
    },
    signedByEnterprise: {
      type: Boolean,
      default: false,
    },
    signedAt: {
      type: Date,
    },
    signOtpHash: {
      type: String,
      select: false,
    },
    signOtpExpiry: {
      type: Date,
      select: false,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    cancelReason: {
      type: String,
    },
    farmLocation: {
      province: { type: String },
      district: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    insuranceFarmer: {
      insuranceCompany: { type: String },
      policyNumber: { type: String },
      insuredValue: { type: Number, min: 0 },
      coveredEvents: { type: String, enum: ['natural_disaster', 'disease', 'both'] },
      validFrom: { type: Date },
      validTo: { type: Date },
      attachmentUrl: { type: String },
    },
    insuranceEnterprise: {
      insuranceCompany: { type: String },
      policyNumber: { type: String },
      insuredValue: { type: Number, min: 0 },
      coveredEvents: { type: String, enum: ['natural_disaster', 'disease', 'both'] },
      validFrom: { type: Date },
      validTo: { type: Date },
      attachmentUrl: { type: String },
    },
    riskSharingTerms: {
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

// Auto-generate contract code before saving
ContractSchema.pre('save', async function (next) {
  if (this.isNew && !this.contractCode) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Contract').countDocuments();
    this.contractCode = `PRE-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Auto-calculate totalValue and commission
ContractSchema.pre('save', function (next) {
  if (this.isModified('quantity') || this.isModified('pricePerUnit')) {
    const unitFactor = UNIT_TO_KG[this.unit as keyof typeof UNIT_TO_KG] ?? 1;
    this.totalValue = Math.round(this.quantity * this.pricePerUnit * unitFactor);
    this.commission = Math.round(this.totalValue * this.commissionRate / 100);
  }
  next();
});

// Indexes
ContractSchema.index({ farmerId: 1, status: 1 });
ContractSchema.index({ enterpriseId: 1, status: 1 });
ContractSchema.index({ status: 1 });

export default mongoose.model<IContract>('Contract', ContractSchema);
