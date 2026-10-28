import { database, transaction } from "./db";
import { processDeadlines } from "./engine";
import { dispatchNotifications } from "./notification-delivery";

export const deliveryIntervalMs = 5000;
export const deliveryConcurrency = 4;
export const deliveryBatchSize = 40;

/** Atomic delivery leases let bounded consumers drain a burst without minute-long gaps. */
export async function drainDeliveryBatch(
  dispatch: (limit: number) => Promise<{ processed: number }>,
) {
  const results = await Promise.allSettled(
    Array.from({ length: deliveryConcurrency }, () =>
      dispatch(deliveryBatchSize),
    ),
  );
  if (results.some((result) => result.status === "rejected"))
    console.error(
      "Notification delivery consumer failed; leased jobs remain retryable.",
    );
  return results.reduce(
    (count, result) =>
      count + (result.status === "fulfilled" ? result.value.processed : 0),
    0,
  );
}
/** Deadline scans stay at one minute; delivery does not wait for those transactions. */
export function startNotificationWorker(intervalMs = 60000) {
  let deadlineBusy = false,
    deliveryBusy = false;
  const deliver = async () => {
    if (deliveryBusy) return;
    deliveryBusy = true;
    try {
      const { db } = await database();
      await drainDeliveryBatch((limit) => dispatchNotifications(db, limit));
    } catch {
      console.error(
        "Notification worker failed; the queue remains available for retry.",
      );
    } finally {
      deliveryBusy = false;
    }
  };
  const deadlines = async () => {
    if (deadlineBusy) return;
    deadlineBusy = true;
    try {
      await transaction((s) => processDeadlines(s));
    } catch {
      console.error("Deadline worker failed; the next scan will retry.");
    } finally {
      deadlineBusy = false;
      void deliver();
    }
  };
  const deadlineTimer = setInterval(() => void deadlines(), intervalMs);
  const deliveryTimer = setInterval(() => void deliver(), deliveryIntervalMs);
  void deadlines();
  void deliver();
  return () => {
    clearInterval(deadlineTimer);
    clearInterval(deliveryTimer);
  };
}
