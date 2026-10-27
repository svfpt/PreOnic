import { WeatherService } from '../services/weather.service';
import { NotificationService } from '../services/notification.service';
import WeatherAlert from '../models/WeatherAlert.model';
import { createLogger } from '../utils/logger';

const log = createLogger('WeatherCron');

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const INITIAL_CATCHUP_DELAY_MS = 30_000;
const EVERY_SIX_HOURS_CRON = '0 */6 * * *';

const ALERT_TYPE_LABELS: Record<string, string> = {
  extreme_heat: 'Nắng nóng cực điểm',
  extreme_cold: 'Rét đậm cực mạnh',
  heavy_rain: 'Mưa lớn',
  strong_wind: 'Gió mạnh / Bão',
  drought: 'Hạn hán',
};

// Job định kỳ: kiểm tra thời tiết, tạo alert + dọn dẹp dữ liệu cũ.
export async function runWeatherCronJob(): Promise<void> {
  log.info(`Starting weather check at ${new Date().toISOString()}`);

  try {
    const alertCount = await WeatherService.runWeatherCheckForAllUsers();
    log.info(`Created ${alertCount} weather alerts`);

    if (alertCount > 0) {
      const fiveMinutesAgo = new Date(Date.now() - FIVE_MINUTES_MS);
      const newAlerts = await WeatherAlert.find({ createdAt: { $gte: fiveMinutesAgo } });

      for (const alert of newAlerts) {
        try {
          await NotificationService.createWeatherAlertNotification(
            alert.userId.toString(),
            String(alert._id),
            `Cảnh báo thời tiết: ${getAlertTypeLabel(alert.alertType)}`,
            alert.message,
            alert.severity as 'warning' | 'critical'
          );
        } catch (notifErr) {
          log.error(`Notification creation failed for alert ${alert._id}`, notifErr);
        }
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    const cleanupResult = await WeatherAlert.deleteMany({
      isRead: true,
      createdAt: { $lt: thirtyDaysAgo },
    });
    if (cleanupResult.deletedCount > 0) {
      log.info(`Cleaned up ${cleanupResult.deletedCount} old alerts`);
    }

    const notifCleanup = await NotificationService.cleanupOldNotifications();
    if (notifCleanup > 0) {
      log.info(`Cleaned up ${notifCleanup} old notifications`);
    }

    log.info(`Completed at ${new Date().toISOString()}`);
  } catch (error) {
    log.error('Weather cron failed', error);
  }
}

export function startWeatherCron(): void {
  try {
    const cron = require('node-cron');
    cron.schedule(EVERY_SIX_HOURS_CRON, () => {
      runWeatherCronJob();
    });

    log.info('Scheduled to run every 6 hours');

    setTimeout(() => {
      log.info('Running initial weather check...');
      runWeatherCronJob();
    }, INITIAL_CATCHUP_DELAY_MS);
  } catch {
    log.warn('node-cron not installed, skipping cron setup. Install with: npm install node-cron');
  }
}

function getAlertTypeLabel(type: string): string {
  return ALERT_TYPE_LABELS[type] || type;
}
