import test from "node:test";
import assert from "node:assert/strict";
import { canRecordOfficialResult } from "../lib/result-readiness";
import type { Challenge } from "../lib/types";
test("scheduled games become actionable at their end, without a player result report", () => {
  const start = Date.parse("2026-10-27T20:00:00Z");
  const c = {
    status: "scheduled",
    scheduledAt: new Date(start).toISOString(),
    durationMinutes: 90,
  } as Challenge;
  assert.equal(canRecordOfficialResult(c, start + 89 * 60000), false);
  assert.equal(canRecordOfficialResult(c, start + 90 * 60000), true);
  assert.equal(
    canRecordOfficialResult(
      { ...c, status: "result_pending" },
      start + 90 * 60000,
    ),
    true,
  );
  for (const status of [
    "accepted",
    "completed",
    "cancelled",
    "refused",
    "expired",
  ] as const)
    assert.equal(
      canRecordOfficialResult({ ...c, status }, start + 120 * 60000),
      false,
    );
  assert.equal(
    canRecordOfficialResult(
      { ...c, scheduledAt: undefined },
      start + 120 * 60000,
    ),
    false,
  );
  assert.equal(
    canRecordOfficialResult(
      { ...c, scheduledAt: "invalid" },
      start + 120 * 60000,
    ),
    false,
  );
});
