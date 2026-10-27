import mongoose from 'mongoose';
import { createLogger } from '../utils/logger';

const log = createLogger('DB');

const MONGODB_URI = () => process.env.MONGODB_URI || 'mongodb://localhost:27017/preoonic';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 8000;
const SERVER_SELECTION_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 45_000;
const CONNECT_TIMEOUT_MS = 10_000;
const IPV4_FAMILY = 4;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let isConnecting = false;
let hasConnectedOnce = false;

// Kết nối MongoDB có cơ chế retry.  Không đăng ký handler 'disconnected' lồng vào chuỗi mới —
// mongoose tự bắn 'disconnected', ta xử lý riêng bằng handler có guard chống stack.
export async function connectDB(onConnected?: () => void): Promise<void> {
  mongoose.connection.once('connected', () => {
    log.info(`MongoDB Connected: ${mongoose.connection.host}`);
    log.info(`Database: ${mongoose.connection.name}`);
    isConnecting = false;
    hasConnectedOnce = true;

    if (onConnected) {
      onConnected();
    }

    mongoose.connection.on('disconnected', onDisconnected);
  });

  mongoose.connection.on('error', (err: Error) => {
    log.error('MongoDB error', err.message);
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    log.info('MongoDB connection closed through app termination');
    process.exit(0);
  });

  await attempt(0);
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function hasDatabaseConnectedOnce(): boolean {
  return hasConnectedOnce;
}

function onDisconnected() {
  mongoose.connection.off('disconnected', onDisconnected);
  log.warn('MongoDB disconnected — reconnecting...');
  attempt(1).catch(() => {});
}

async function attempt(start: number): Promise<void> {
  if (isConnecting) return;
  isConnecting = true;

  for (let i = start; i <= MAX_RETRIES; i++) {
    if (i === 0) log.info('Connecting to MongoDB...');
    else log.info(`Reconnecting to MongoDB (attempt ${i}/${MAX_RETRIES})...`);

    try {
      await mongoose.connect(MONGODB_URI(), {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
        socketTimeoutMS: SOCKET_TIMEOUT_MS,
        connectTimeoutMS: CONNECT_TIMEOUT_MS,
        family: IPV4_FAMILY,
      });
      return;
    } catch (err: any) {
      log.error(`MongoDB connection failed: ${err.message}`);
      if (i < MAX_RETRIES) {
        log.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      } else {
        log.error('Max retries reached. Server running without DB — retry manually or fix Atlas IP whitelist.');
        isConnecting = false;
      }
    }
  }
}

export default connectDB;
