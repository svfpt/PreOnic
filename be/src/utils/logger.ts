// Logger có cấu trúc dùng chung cho toàn bộ backend.
// Production: pino JSON output (machine-readable cho APM/CloudWatch/Render logs).
// Development: pretty single-line (dễ đọc trên console).
// API: createLogger(scope).{debug|info|warn|error}(message, meta?).

import pino, { Logger as PinoLogger } from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const minLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();

// Pretty transport chỉ chạy dev — tránh phụ thuộc pino-pretty trong prod build.
const rootLogger: PinoLogger = isProd
  ? pino({ level: minLevel })
  : pino({
      level: minLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
    });

export function createLogger(scope: string) {
  const child = rootLogger.child({ scope });
  return {
    debug: (message: string, meta?: unknown) => meta !== undefined ? child.debug({ meta }, message) : child.debug(message),
    info:  (message: string, meta?: unknown) => meta !== undefined ? child.info({ meta },  message) : child.info(message),
    warn:  (message: string, meta?: unknown) => meta !== undefined ? child.warn({ meta },  message) : child.warn(message),
    error: (message: string, meta?: unknown) => meta !== undefined ? child.error({ meta }, message) : child.error(message),
  };
}

export type Logger = ReturnType<typeof createLogger>;
