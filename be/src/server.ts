import dotenv from 'dotenv';
import path from 'path';
import app from './app';
import connectDB from './config/database';
import { startWeatherCron } from './jobs/weather-cron';
import { startShippingCron } from './jobs/shipping-cron';
import { startWithdrawalCron } from './jobs/withdrawal-cron';
import { createLogger } from './utils/logger';

const log = createLogger('Server');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = process.env.PORT || 8080;

// Connect to MongoDB
connectDB(() => {
  // Start cron jobs only when DB is ready, otherwise they will immediately fail with buffered queries.
  startWeatherCron();
  startShippingCron();
  startWithdrawalCron().catch(() => log.error('Không thể khởi tạo đối soát rút tiền'));
});

// Start server
const server = app.listen(PORT, () => {
  log.info(`PreOnic Backend running on port ${PORT} (env=${process.env.NODE_ENV || 'development'})`);
  log.info(`API base: http://localhost:${PORT}/api/v1`);
});

// Bắt promise rejection chưa handle — chỉ log, không crash để tránh chết server vì lỗi tạm thời.
process.on('unhandledRejection', (err: any) => {
  log.error('Unhandled promise rejection (server kept running)', {
    name: err?.name ?? 'Error',
    message: err?.message ?? err,
  });
});

process.on('uncaughtException', (err: Error) => {
  log.error('UNCAUGHT EXCEPTION', { name: err.name, message: err.message });
  if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('connect')) {
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  log.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    log.info('Process terminated.');
  });
});
