import { isVotingMatch } from "./match-voting-targets";
import type { Challenge, State, Actor } from "./types";
import { challengeSide, challengeTeamName } from "./team-competition";
export function calendarMatch(s: State, c: Challenge, actor: Actor) {
  if (
    !["scheduled", "result_pending", "disputed", "completed"].includes(
      c.status,
    ) ||
    !c.scheduledAt ||
    (actor.role !== "admin" &&
      !(actor.role === "spectator" && isVotingMatch(s, c)) &&
      !challengeSide(c, actor.playerId, s.players))
  )
    return undefined;
  const match = s.matches.find((m) => m.challengeId === c._id),
    start = match?.start ?? c.scheduledAt,
    end =
      match?.end ??
      new Date(Date.parse(start) + c.durationMinutes * 60000).toISOString();
  return {
    id: c._id,
    title: `Fight Club · ${challengeTeamName(c, c.challengerId, s.players)} vs ${challengeTeamName(c, c.defenderId, s.players)}`,
    start,
    end,
    location: `Neiva Padel Club · ${s.courts.find((x) => x._id === (match?.courtId ?? c.courtId))?.name ?? "Campo por definir"}`,
    description: `${s.divisions.find((d) => d._id === c.divisionId)?.name ?? "Liga"} · Jogo #${c.number}. Horário confirmado pelo clube.`,
  };
}
export type CalendarMatch = NonNullable<ReturnType<typeof calendarMatch>>;
export const calendarStamp = (value: string) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
export function googleCalendarLink(event: CalendarMatch) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${calendarStamp(event.start)}/${calendarStamp(event.end)}`,
    location: event.location,
    details: event.description,
    ctz: "Europe/Lisbon",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
function fold(line: string) {
  let result = "",
    length = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (length + bytes > 75) {
      result += "\r\n ";
      length = 1;
    }
    result += char;
    length += bytes;
  }
  return result;
}
export function matchCalendarFile(events: CalendarMatch[], now = Date.now()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Neiva//Fight Club Padel League//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(event.id)}@fightclub`,
      `DTSTAMP:${calendarStamp(new Date(now).toISOString())}`,
      `DTSTART:${calendarStamp(event.start)}`,
      `DTEND:${calendarStamp(event.end)}`,
      `SUMMARY:${escape(event.title)}`,
      `LOCATION:${escape(event.location)}`,
      `DESCRIPTION:${escape(event.description)}`,
      "END:VEVENT",
    );
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
