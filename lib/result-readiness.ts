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
/** Started matches remain in progress until the booked end or official result. */
export function isMatchInProgress(c: Challenge, now = Date.now()) {
  const window = matchWindow(c);
  return (
    c.status === "scheduled" &&
    !!window &&
    window.start <= now &&
    now < window.end
  );
}
/** Administrators can record an official result from the scheduled start. */
export function canRecordOfficialResult(c: Challenge, now = Date.now()) {
  const window = matchWindow(c);
  return (
    ["scheduled", "result_pending", "disputed"].includes(c.status) &&
    !!window &&
    window.start <= now
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

/** Day boundaries follow the club timezone, independent of the browser or server timezone. */
export function todayMatches(challenges: Challenge[], now = Date.now()) {
  const day = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-CA", {
      timeZone: "Europe/Lisbon",
    });
  const today = day(now);
  return challenges
    .filter(
      (c) =>
        c.scheduledAt &&
        Number.isFinite(Date.parse(c.scheduledAt)) &&
        ["scheduled", "result_pending", "disputed", "completed"].includes(
          c.status,
        ) &&
        day(Date.parse(c.scheduledAt)) === today,
    )
    .sort(
      (a, b) =>
        Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!) ||
        a.number - b.number,
    );
}
