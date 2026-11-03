import cron from 'node-cron';
import { WithdrawalService } from '../services/withdrawal.service';
import { createLogger } from '../utils/logger';
import WithdrawalRequest from '../models/WithdrawalRequest.model';

const log = createLogger('WithdrawalCron');
let running = false;
let started = false;

export async function runWithdrawalJob() {
  if (running) return;
  running = true;
  try {
    await WithdrawalService.reconcilePending();
  } catch {
    log.error(
      'Không thể đối soát các yêu cầu rút tiền; sẽ thử lại ở lần tiếp theo',
    );
  } finally {
    running = false;
  }
}

export async function startWithdrawalCron() {
  if (started) return;
  started = true;
  // Upgrade old pending requests to real wallet holds without sending any payouts.
  const users = await WithdrawalRequest.distinct('userId', {
    status: 'pending',
    fundsReserved: { $ne: true },
  });
  for (const userId of users) {
    try {
      await WithdrawalService.reserveLegacyRequests(String(userId));
    } catch {
      log.warn(
        'Có yêu cầu rút cũ chưa giữ được số dư; cần kiểm tra trước khi phê duyệt',
      );
    }
  }
  cron.schedule('* * * * *', runWithdrawalJob);
  await runWithdrawalJob();
}
