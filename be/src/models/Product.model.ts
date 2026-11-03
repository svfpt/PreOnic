import mongoose, { Document, Schema } from 'mongoose';

// ===== INTERFACES =====

export interface ISeller {
  userId?: mongoose.Types.ObjectId;
  name: string;
  avatar: string;
  rating: number;
  totalContracts: number;
}

export interface IProduct extends Document {
  name: string;
  location: string;
  farm: string;
  image: string;
  priceMin: number;
  priceMax: number;
  unit: string;
  expectedDate: string;
  progress: number;
  remaining: number;
  totalQuantity: number;
  note: string;
  badge: string;
  category: 'fruit' | 'vegetable' | 'rice' | 'coffee' | 'tea' | 'spice' | 'grain' | 'other';
  region: 'north' | 'central' | 'south';
  type: 'fresh' | 'dried' | 'processed';
  rating: number;
  reviewCount: number;
  description: string;
  nutritionInfo: string;
  certifications: string[];
  seller: ISeller;
  commitments: string[];
  createdBy?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== SCHEMAS =====

const SellerSchema = new Schema<ISeller>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    name: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    totalContracts: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Tên sản phẩm là bắt buộc'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Địa điểm là bắt buộc'],
      trim: true,
    },
    farm: {
      type: String,
      required: [true, 'Tên trang trại là bắt buộc'],
      trim: true,
    },
    image: {
      type: String,
      default: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=600',
    },
    priceMin: {
      type: Number,
      required: [true, 'Giá tối thiểu là bắt buộc'],
      min: 0,
    },
    priceMax: {
      type: Number,
      required: [true, 'Giá tối đa là bắt buộc'],
      min: 0,
    },
    unit: {
      type: String,
      default: 'kg',
    },
    expectedDate: {
      type: String,
      default: '',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    remaining: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    note: {
      type: String,
      default: '',
    },
    badge: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      enum: ['fruit', 'vegetable', 'rice', 'coffee', 'tea', 'spice', 'grain', 'other'],
      required: [true, 'Danh mục là bắt buộc'],
    },
    region: {
      type: String,
      enum: ['north', 'central', 'south'],
      required: [true, 'Vùng miền là bắt buộc'],
    },
    type: {
      type: String,
      enum: ['fresh', 'dried', 'processed'],
      default: 'fresh',
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: '',
    },
    nutritionInfo: {
      type: String,
      default: '',
    },
    certifications: {
      type: [String],
      default: [],
    },
    seller: {
      type: SellerSchema,
      required: true,
    },
    commitments: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
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
ProductSchema.index({ category: 1 });
ProductSchema.index({ region: 1 });
ProductSchema.index({ name: 'text', location: 'text', farm: 'text' });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ createdBy: 1 });

export default mongoose.model<IProduct>('Product', ProductSchema);
