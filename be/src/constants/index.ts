/**
 * Application-wide constants
 * Eliminates magic numbers and provides single source of truth
 */

// ===== TIME CONSTANTS (in milliseconds) =====
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const TEN_MINUTES_MS = 10 * 60 * 1000;

// ===== REQUEST LIMITS =====
export const REQUEST_LIMITS = {
  JSON_BODY: '20mb',
  URL_ENCODED_BODY: '20mb',
} as const;

// ===== AUTH CONSTANTS =====
export const PASSWORD_MIN_LENGTH = 6;

// ===== COOKIE CONFIG =====
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const getRefreshTokenCookieOptions = (maxAge: number = THIRTY_DAYS_MS) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge,
});

export const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  expires: new Date(0),
};

// ===== PAGINATION DEFAULTS =====
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

// ===== USER ROLES =====
export const ROLES = {
  FARMER: 'farmer',
  ENTERPRISE: 'enterprise',
  ADMIN: 'admin',
} as const;

// ===== CONTRACT CONFIG =====
export const CONTRACT_CONFIG = {
  CODE_PREFIX: 'PRE',
  CODE_SEQUENCE_MIN: 1000,
  CODE_SEQUENCE_SPAN: 9000,
  MAX_CODE_GENERATION_ATTEMPTS: 10,
  COMMISSION_RATE: 3, // % — phải khớp với COMPANY.COMMISSION_RATE trong fe/src/constants/index.js
} as const;

export const UNIT_TO_KG = {
  kg: 1,
  ta: 100,
  tan: 1000,
  thung: 25,
} as const;

// ===== PRODUCT CONFIG =====
export const PRODUCT_CONFIG = {
  DEFAULT_PAGE_SIZE: 50,
  DEFAULT_SELLER_NAME: 'Nông dân',
  DEFAULT_SELLER_RATING: 5,
  DEFAULT_TOTAL_CONTRACTS: 0,
} as const;

// ===== PAYMENT LIMITS =====
export const PAYMENT_LIMITS = {
  MIN_TOPUP_VND: 10_000,
  MIN_DEMO_TOPUP_VND: 1_000,
  MAX_TOPUP_VND: 500_000_000,
} as const;

// ===== WEATHER THRESHOLDS =====
export const WEATHER_THRESHOLDS = {
  EXTREME_HEAT_TEMP: 38,      // °C
  EXTREME_COLD_TEMP: 5,       // °C
  HEAVY_RAIN_MM: 100,         // mm/day
  STRONG_WIND_KMH: 60,        // km/h
  DROUGHT_MM: 5,              // mm in DROUGHT_DAYS
  DROUGHT_DAYS: 14,           // consecutive days
} as const;

// ===== WEATHER CRON SCHEDULE =====
export const WEATHER_CRON_SCHEDULE = '0 */6 * * *';  // Every 6 hours

export const WEATHER_API = {
  TIMEOUT_MS: 10_000,
  FORECAST_ITEM_COUNT: 40,
  RATE_LIMIT_DELAY_MS: 1_100,
  DUPLICATE_ALERT_WINDOW_MS: 6 * 60 * 60 * 1000,
  DEFAULT_PROVINCE: 'Ha Noi',
  DEFAULT_COORDS: {
    lat: 21.0285,
    lng: 105.8542,
  },
} as const;
