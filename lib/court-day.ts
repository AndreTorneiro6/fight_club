import { addClubDays, clubDateTime } from "./calendar";

/** Full-duration windows starting every 30 minutes from 07:00 to midnight in Lisbon. */
export function courtDayIntervals(day: string, minutes = 90) {
  if (![60, 90].includes(minutes))
    throw new Error("Escolhe blocos de 1 hora ou 1h30.");
  const first = Date.parse(clubDateTime(day, "07:00"));
  const last = Date.parse(clubDateTime(addClubDays(day, 1), "00:00"));
  const slots: { start: string; end: string }[] = [];
  for (let at = first; at + minutes * 60000 <= last; at += 30 * 60000)
    slots.push({
      start: new Date(at).toISOString(),
      end: new Date(at + minutes * 60000).toISOString(),
    });
  return slots;
}

export type CourtTimelineStatus = "clear" | "busy" | "league" | "unknown";
export type CourtTimelineSegment = {
  start: string;
  end: string;
  status: CourtTimelineStatus;
};
/** Exact occupation boundaries, independent of the selected game duration. */
export function courtTimelineSegments(
  from: string,
  until: string,
  bookings: { start: string; end: string; source: "league" | "playtomic" }[],
  externalKnown: boolean,
): CourtTimelineSegment[] {
  const first = Date.parse(from),
    last = Date.parse(until);
  const relevant = bookings
    .map((b) => ({ ...b, from: Date.parse(b.start), until: Date.parse(b.end) }))
    .filter((b) => b.until > b.from && b.from < last && b.until > first);
  const boundaries = [
    ...new Set([
      first,
      last,
      ...relevant.flatMap((b) => [
        Math.max(first, b.from),
        Math.min(last, b.until),
      ]),
    ]),
  ].sort((a, b) => a - b);
  const segments: CourtTimelineSegment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const a = boundaries[i],
      b = boundaries[i + 1];
    const occupied = relevant.filter((item) => item.from < b && item.until > a);
    const status: CourtTimelineStatus = occupied.some(
      (item) => item.source === "league",
    )
      ? "league"
      : occupied.length
        ? "busy"
        : externalKnown
          ? "clear"
          : "unknown";
    const end = new Date(b).toISOString(),
      previous = segments.at(-1);
    if (previous?.status === status) previous.end = end;
    else segments.push({ start: new Date(a).toISOString(), end, status });
  }
  return segments;
}
