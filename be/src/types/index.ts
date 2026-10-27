import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'farmer' | 'enterprise' | 'admin';
  fullName: string;
}

export interface JwtUserPayload extends AuthenticatedUser {
  iat?: number;
  exp?: number;
}

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// User roles
export enum UserRole {
  FARMER = 'farmer',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin',
}

// ===== AUTH TYPES =====

// Register request body - matches FE Register.jsx form
export interface RegisterBody {
  fullName: string;        // From FE: formData.fullName
  email: string;           // From FE: formData.email
  phone: string;           // From FE: formData.phone
  province?: string;       // From FE: formData.province
  district?: string;       // From FE: formData.district
  ward?: string;           // From FE: formData.ward
  password: string;        // From FE: formData.password
  confirmPassword: string; // From FE: formData.confirmPassword
  role: 'farmer' | 'enterprise'; // From FE: selectedRole
  agreeTerms: boolean | string;  // From FE: formData.agreeTerms (boolean or string "true"/"on")
}

// Login request body - matches FE Auth.jsx form
export interface LoginBody {
  emailOrPhone: string;    // From FE: formData.emailOrPhone (can be email or phone)
  password: string;        // From FE: formData.password
  rememberMe?: boolean;    // From FE: formData.rememberMe
}

// Forgot password request body
export interface ForgotPasswordBody {
  email: string;
}

// Reset password request body
export interface ResetPasswordBody {
  token: string;
  password: string;
  confirmPassword: string;
}

// Update password request body (authenticated user)
export interface UpdatePasswordBody {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// Update profile request body
export interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  avatar?: string;
  address?: string;
  province?: string;
  district?: string;
  ward?: string;
  farmName?: string;
  farmSize?: number | string;
  companyName?: string;
  taxCode?: string;
}

// Google OAuth login body — Google chỉ tạo/đăng nhập tài khoản nông dân.
export interface GoogleLoginBody {
  accessToken?: string;   // OAuth2 access token from FE useGoogleLogin
  credential?: string;    // ID token from GoogleLogin component
}

// Auth response with tokens
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ===== GENERIC TYPES =====

// Response types
export interface ApiResponse<T = unknown> {
  success?: boolean;
  status: 'success' | 'error';
  message?: string;
  data?: T;
  error?: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  status: 'success';
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===== CONTRACT TYPES =====

export type ContractStatus = 'draft' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled' | 'disputed';

export type EscrowStatus = 'awaiting_deposit' | 'funded' | 'partially_released' | 'fully_released' | 'refunded' | 'disputed';

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'disputed';

export type DisputeStatus = 'open' | 'under_review' | 'resolved_farmer' | 'resolved_enterprise' | 'closed';

// ===== WEATHER & INSURANCE TYPES =====

export type WeatherAlertType = 'extreme_heat' | 'extreme_cold' | 'heavy_rain' | 'strong_wind' | 'drought';

export type WeatherAlertSeverity = 'warning' | 'critical';

export type InsuranceCoveredEvent = 'natural_disaster' | 'disease' | 'both';

export type NotificationType = 'weather_alert' | 'contract' | 'escrow' | 'system' | 'insurance';

// Insurance subdocument shape (both farmer and enterprise fill their own)
export interface InsuranceInfo {
  insuranceCompany: string;
  policyNumber: string;
  insuredValue: number;         // VND
  coveredEvents: InsuranceCoveredEvent;
  validFrom: Date;
  validTo: Date;
  attachmentUrl?: string;
}

// Weather data snapshot from OpenWeatherMap
export interface WeatherData {
  temp: number;           // °C
  humidity: number;       // %
  windSpeed: number;      // km/h
  rain1h?: number;        // mm in last 1h
  rain24h?: number;       // mm in last 24h
  description: string;
  icon: string;
}

// Weather thresholds
export interface WeatherThresholds {
  extremeHeatTemp: number;      // > 38°C
  extremeColdTemp: number;      // < 5°C
  heavyRainMm: number;          // > 100mm/day
  strongWindKmh: number;        // > 60 km/h
  droughtMm: number;            // < 5mm in 14 days
  droughtDays: number;          // 14 days
}

// Location info embedded in User/Contract
export interface LocationInfo {
  province?: string;
  district?: string;
  ward?: string;
  address?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

