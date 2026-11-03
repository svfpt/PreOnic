import { createHash } from 'crypto';
import { PayOS } from '@payos/node';
import { AppError } from '../middlewares/error.middleware';

export function getPayoutClient() {
  const clientId = process.env.PAYOS_PAYOUT_CLIENT_ID?.trim();
  const apiKey = process.env.PAYOS_PAYOUT_API_KEY?.trim();
  const checksumKey = process.env.PAYOS_PAYOUT_CHECKSUM_KEY?.trim();
  if (!clientId || !apiKey || !checksumKey) {
    throw new AppError(
      'Chưa cấu hình khóa kênh chi payOS (PAYOS_PAYOUT_CLIENT_ID, PAYOS_PAYOUT_API_KEY, PAYOS_PAYOUT_CHECKSUM_KEY)',
      503,
    );
  }
  return {
    client: new PayOS({
      clientId,
      apiKey,
      checksumKey,
      timeout: 15000,
      maxRetries: 0,
    }),
    channel: createHash('sha256').update(clientId).digest('hex'),
  };
}

export function requirePayoutEnabled() {
  if (process.env.PAYOS_PAYOUT_ENABLED !== 'true') {
    throw new AppError('Chức năng chuyển tiền tự động chưa được bật', 503);
  }
  return getPayoutClient();
}
