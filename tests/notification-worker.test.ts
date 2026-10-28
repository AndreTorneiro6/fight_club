import test from "node:test";
import assert from "node:assert/strict";
import {
  drainDeliveryBatch,
  deliveryBatchSize,
  deliveryConcurrency,
  deliveryIntervalMs,
} from "../lib/notification-worker";
test("one delivery cycle drains a league-wide burst rather than only twenty recipients per minute", async () => {
  const pending = Array.from({ length: 132 }, (_, i) => i),
    sent = new Set<number>();
  let active = 0,
    maxActive = 0;
  const count = await drainDeliveryBatch(async (limit) => {
    active++;
    maxActive = Math.max(maxActive, active);
    let processed = 0;
    for (; processed < limit; processed++) {
      const id = pending.shift();
      if (id === undefined) break;
      await Promise.resolve();
      assert.equal(sent.has(id), false);
      sent.add(id);
    }
    active--;
    return { processed };
  });
  assert.equal(count, 132);
  assert.equal(pending.length, 0);
  assert.equal(sent.size, 132);
  assert.equal(maxActive, deliveryConcurrency);
  assert.equal(deliveryIntervalMs, 5000);
  assert(deliveryBatchSize * deliveryConcurrency >= 132);
});
