import { database, transaction } from "./db";
import { processDeadlines } from "./engine";
import { dispatchNotifications } from "./notification-delivery";

/** Run one worker for a self-hosted installation, or call /api/jobs every minute. */
export function startNotificationWorker(intervalMs = 60000) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await transaction((s) => processDeadlines(s));
      await dispatchNotifications((await database()).db, 20);
    } catch {
      console.error(
        "Notification worker failed; the queue remains available for retry.",
      );
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  void tick();
  return () => clearInterval(timer);
}
