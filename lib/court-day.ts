import { addClubDays, clubDateTime } from "./calendar";

/** Time blocks spanning a Lisbon calendar day, including clock changes. */
export function courtDayIntervals(day: string, minutes = 90) {
  if (![60, 90].includes(minutes))
    throw new Error("Escolhe blocos de 1 hora ou 1h30.");
  const first = Date.parse(clubDateTime(day, "00:00"));
  const last = Date.parse(clubDateTime(addClubDays(day, 1), "00:00"));
  const slots: { start: string; end: string }[] = [];
  for (let at = first; at < last; at += minutes * 60000)
    slots.push({
      start: new Date(at).toISOString(),
      end: new Date(Math.min(at + minutes * 60000, last)).toISOString(),
    });
  return slots;
}
