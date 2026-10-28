import type { Challenge } from "./types";

type MatchSchedule = Pick<Challenge, "_id" | "number" | "status"> &
  Partial<
    Pick<
      Challenge,
      "scheduledAt" | "scheduleProposal" | "durationMinutes" | "playBy"
    >
  >;
const closed = new Set(["completed", "cancelled", "refused", "expired"]);
const time = (value?: string) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : Infinity;
};
/** Use the proposed time only while the match is awaiting schedule confirmation. */
export function matchStart(game: MatchSchedule) {
  return game.status === "schedule_pending"
    ? (game.scheduleProposal?.start ?? game.scheduledAt)
    : (game.scheduledAt ?? game.scheduleProposal?.start);
}
/** Upcoming/ongoing first (earliest first), history newest first, undated games last. */
export function matchOrder(now = Date.now()) {
  const group = (game: MatchSchedule, start: number) =>
    start === Infinity
      ? 2
      : !closed.has(game.status) &&
          start + (game.durationMinutes ?? 0) * 60000 > now
        ? 0
        : 1;
  return (a: MatchSchedule, b: MatchSchedule) => {
    const aStart = time(matchStart(a)),
      bStart = time(matchStart(b));
    const aGroup = group(a, aStart),
      bGroup = group(b, bStart);
    return (
      aGroup - bGroup ||
      (aGroup === 2
        ? time(a.playBy) - time(b.playBy)
        : aGroup === 1
          ? bStart - aStart
          : aStart - bStart) ||
      a.number - b.number ||
      a._id.localeCompare(b._id)
    );
  };
}
