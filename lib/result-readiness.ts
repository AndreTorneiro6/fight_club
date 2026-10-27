import type { Challenge } from "./types";
/** A scheduled game is actionable after its full booked duration, even without a player report. */
export function canRecordOfficialResult(c: Challenge, now = Date.now()) {
  return (
    ["scheduled", "result_pending", "disputed"].includes(c.status) &&
    !!c.scheduledAt &&
    Number.isFinite(c.durationMinutes) &&
    Date.parse(c.scheduledAt) + c.durationMinutes * 60000 <= now
  );
}
