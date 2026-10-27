import express, { Application, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
// Import routes
import authRoutes from './routes/auth.routes';
import farmerRoutes from './routes/farmer.routes';
import enterpriseRoutes from './routes/enterprise.routes';
import productRoutes from './routes/product.routes';
import contractRoutes from './routes/contract.routes';
import escrowRoutes from './routes/escrow.routes';
import weatherRoutes from './routes/weather.routes';
import notificationRoutes from './routes/notification.routes';
import messagingRoutes from './routes/messaging.routes';
import uploadRoutes from './routes/upload.routes';
import paymentRoutes from './routes/payment.routes';
import partnerRatingRoutes from './routes/partner-rating.routes';
import feedbackRoutes from './routes/feedback.routes';
import adminRoutes from './routes/admin.routes';
import { REQUEST_LIMITS } from './constants';

// Import middlewares
import { errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// Render (và đa số PaaS) đặt app sau reverse proxy → tin tưởng 1 lớp proxy để
// express-rate-limit đọc đúng IP client từ X-Forwarded-For, tránh ValidationError.
app.set('trust proxy', 1);

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value) return null;
  return value.trim().replace(/\/$/, '');
};

const allowedOrigins = new Set(
  [process.env.FRONTEND_URL, ...(process.env.FRONTEND_URLS || '').split(',')]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin))
);

const isAllowedOrigin = (origin?: string | null): boolean => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;

  if (allowedOrigins.has(normalizedOrigin)) return true;

  try {
    const parsedOrigin = new URL(normalizedOrigin);
    if (parsedOrigin.hostname.endsWith('.vercel.app')) return true;

    if (process.env.NODE_ENV !== 'production') {
      return parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1';
    }
  } catch {
    return false;
  }

  return false;
};

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  })
);

// Cookie parser
app.use(cookieParser());

// Body parser
app.use(express.json({ limit: REQUEST_LIMITS.JSON_BODY }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_LIMITS.URL_ENCODED_BODY }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'PreOnic API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Avoid long buffered query timeouts when MongoDB is unavailable.
app.use((req: Request, res: Response, next) => {
  if (req.path === '/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      status: 'error',
      message: 'Database is temporarily unavailable. Please try again shortly.',
    });
  }

  next();
});

// API Routes
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/farmer`, farmerRoutes);
app.use(`${API_PREFIX}/enterprise`, enterpriseRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/contracts`, contractRoutes);
app.use(`${API_PREFIX}/escrow`, escrowRoutes);
app.use(`${API_PREFIX}/weather`, weatherRoutes);
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
app.use(`${API_PREFIX}/messaging`, messagingRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/payment`, paymentRoutes);
app.use(`${API_PREFIX}/partner-ratings`, partnerRatingRoutes);
app.use(`${API_PREFIX}/feedback`, feedbackRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);

// Images are now served via Cloudinary — no local /uploads route needed

// 404 Handler
app.all('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

export default app;
