import mongoose, { Document, Schema } from 'mongoose';
import { WeatherAlertType, WeatherAlertSeverity, WeatherData } from '../types';

// ===== INTERFACE =====

export interface IWeatherAlert extends Document {
  userId: mongoose.Types.ObjectId;
  contractId?: mongoose.Types.ObjectId;
  alertType: WeatherAlertType;
  severity: WeatherAlertSeverity;
  location: {
    province: string;
    district?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  weatherData: WeatherData;
  thresholdExceeded: string;   // e.g. "Nhiệt độ 42°C > ngưỡng 38°C"
  message: string;             // Human readable alert message
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== SCHEMA =====

const WeatherAlertSchema = new Schema<IWeatherAlert>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'Contract',
    },
    alertType: {
      type: String,
      enum: ['extreme_heat', 'extreme_cold', 'heavy_rain', 'strong_wind', 'drought'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      required: true,
    },
    location: {
      province: { type: String, required: true },
      district: { type: String },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
    },
    weatherData: {
      temp: { type: Number, required: true },
      humidity: { type: Number },
      windSpeed: { type: Number },
      rain1h: { type: Number },
      rain24h: { type: Number },
      description: { type: String },
      icon: { type: String },
    },
    thresholdExceeded: {
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
WeatherAlertSchema.index({ userId: 1, createdAt: -1 });
WeatherAlertSchema.index({ alertType: 1 });
WeatherAlertSchema.index({ severity: 1 });
WeatherAlertSchema.index({ 'location.province': 1 });

export default mongoose.model<IWeatherAlert>('WeatherAlert', WeatherAlertSchema);
