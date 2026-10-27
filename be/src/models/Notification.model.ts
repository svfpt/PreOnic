  import mongoose, { Document, Schema } from 'mongoose';
import { NotificationType } from '../types';

// ===== INTERFACE =====

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedId?: mongoose.Types.ObjectId;
  relatedModel?: 'Contract' | 'Escrow' | 'WeatherAlert' | 'Dispute';
  severity?: 'info' | 'warning' | 'critical';
  emailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== SCHEMA =====

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['weather_alert', 'contract', 'escrow', 'system', 'insurance'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    relatedId: {
      type: Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
      enum: ['Contract', 'Escrow', 'WeatherAlert', 'Dispute'],
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    emailSent: {
      type: Boolean,
      default: false,
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
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ type: 1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
