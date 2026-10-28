import type { Challenge } from "./types";

function matchWindow(c: Challenge) {
  if (
    !c.scheduledAt ||
    !Number.isFinite(c.durationMinutes) ||
    c.durationMinutes <= 0
  )
    return;
  const start = Date.parse(c.scheduledAt);
  if (!Number.isFinite(start)) return;
  return { start, end: start + c.durationMinutes * 60000 };
}
/** Started matches need administrative follow-up before their result becomes actionable. */
export function isMatchInProgress(c: Challenge, now = Date.now()) {
  const window = matchWindow(c);
  return (
    c.status === "scheduled" &&
    !!window &&
    window.start <= now &&
    now < window.end
  );
}
/** A scheduled game is actionable after its full booked duration, even without a player report. */
export function canRecordOfficialResult(c: Challenge, now = Date.now()) {
  const window = matchWindow(c);
  return (
    ["scheduled", "result_pending", "disputed"].includes(c.status) &&
    !!window &&
    window.end <= now
  );
}
/** The next boundary is derived from the booking; no MongoDB status transition is required. */
export function nextMatchTransition(challenges: Challenge[], now = Date.now()) {
  let next = Infinity;
  for (const c of challenges) {
    if (!["scheduled", "result_pending", "disputed"].includes(c.status))
      continue;
    const window = matchWindow(c);
    if (!window) continue;
    if (c.status === "scheduled" && window.start > now)
      next = Math.min(next, window.start);
    if (window.end > now) next = Math.min(next, window.end);
  }
  return next === Infinity ? undefined : next;
}
