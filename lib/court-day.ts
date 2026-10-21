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
