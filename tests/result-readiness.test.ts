import test from "node:test";
import assert from "node:assert/strict";
import {
  canRecordOfficialResult,
  isMatchInProgress,
  nextMatchTransition,
} from "../lib/result-readiness";
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

test("a scheduled game enters follow-up exactly at start and leaves at the result boundary", () => {
  const start = Date.parse("2026-10-28T20:30:00Z");
  const c = {
    status: "scheduled",
    scheduledAt: new Date(start).toISOString(),
    durationMinutes: 90,
  } as Challenge;
  assert.equal(isMatchInProgress(c, start - 1), false);
  assert.equal(isMatchInProgress(c, start), true);
  assert.equal(isMatchInProgress(c, start + 89 * 60000), true);
  assert.equal(canRecordOfficialResult(c, start), false);
  assert.equal(isMatchInProgress(c, start + 90 * 60000), false);
  assert.equal(canRecordOfficialResult(c, start + 90 * 60000), true);
  for (const status of [
    "completed",
    "cancelled",
    "refused",
    "expired",
    "accepted",
    "result_pending",
    "disputed",
  ] as const)
    assert.equal(
      isMatchInProgress({ ...c, status }, start + 10 * 60000),
      false,
    );
});
test("overview schedules the next start/end transition and ignores concluded or invalid games", () => {
  const start = Date.parse("2026-10-28T20:30:00Z");
  const c = {
    status: "scheduled",
    scheduledAt: new Date(start).toISOString(),
    durationMinutes: 90,
  } as Challenge;
  assert.equal(nextMatchTransition([c], start - 1), start);
  assert.equal(nextMatchTransition([c], start), start + 90 * 60000);
  assert.equal(nextMatchTransition([c], start + 90 * 60000), undefined);
  assert.equal(
    nextMatchTransition([{ ...c, status: "completed" }], start - 1),
    undefined,
  );
  assert.equal(
    nextMatchTransition(
      [
        { ...c, scheduledAt: "invalid" },
        { ...c, durationMinutes: 0 },
      ],
      start - 1,
    ),
    undefined,
  );
  assert.equal(isMatchInProgress({ ...c, durationMinutes: -10 }, start), false);
  assert.equal(
    canRecordOfficialResult({ ...c, durationMinutes: -10 }, start),
    false,
  );
});
