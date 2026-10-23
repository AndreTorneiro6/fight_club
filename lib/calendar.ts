import type { Player, View } from "./types";
export interface Proposal {
  day: string;
  start: string;
  end: string;
  selected: boolean;
}
export function wallTime(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(timestamp);
  const p = (type: string) => parts.find((x) => x.type === type)!.value;
  return {
    day: `${p("year")}-${p("month")}-${p("day")}`,
    time: `${p("hour")}:${p("minute")}`,
  };
}
export function clubDay(value: string | number) {
  return wallTime(typeof value === "string" ? Date.parse(value) : value).day;
}
/** Calendar proposals always use club time, independently of the device timezone. */
export function clubDateTime(day: string, time: string) {
  const target = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(target))
    throw new Error("Preenche a data e as horas de cada opção.");
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const wall = wallTime(guess);
    guess += target - Date.parse(`${wall.day}T${wall.time}:00Z`);
  }
  const wall = wallTime(guess);
  if (wall.day !== day || wall.time !== time)
    throw new Error(
      "Esta hora não existe devido à mudança de hora. Escolhe outra.",
    );
  return new Date(guess).toISOString();
}
export function initialProposals(
  s: View,
  p: Player,
  now = Date.now(),
  weekly?: { deferredUntil?: string; playBy: string },
): Proposal[] {
  const count = s.settings[0].initialSuggestionCount,
    items: Proposal[] = [],
    availability = s.availability.filter((w) => w.playerId === p._id);
  const today = wallTime(now).day;
  const deadline = Math.min(
    weekly ? Date.parse(weekly.playBy) : Infinity,
    weekly?.deferredUntil ? Infinity : now + s.settings[0].playDays * 86400000,
    Date.parse(
      (s.seasons.find((x) => x.status === "active")?.end ?? "9999-12-31") +
        "T23:59:59Z",
    ),
  );
  const firstDay = weekly?.deferredUntil ?? today;
  const horizon = weekly
    ? Math.max(
        s.settings[0].playDays,
        Math.ceil((Date.parse(weekly.playBy) - now) / 86400000),
      )
    : s.settings[0].playDays;
  for (let i = 0; i <= horizon && items.length < count; i++) {
    const date = new Date(firstDay + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + i);
    const day = date.toISOString().slice(0, 10);
    if (
      s.exceptions.some(
        (x) => x.playerId === p._id && x.from <= day && x.to >= day,
      )
    )
      continue;
    const window = availability.find(
      (w) =>
        w.weekday === date.getUTCDay() &&
        Number(w.end.slice(0, 2)) * 60 +
          Number(w.end.slice(3)) -
          (Number(w.start.slice(0, 2)) * 60 + Number(w.start.slice(3))) >=
          s.settings[0].matchMinutes,
    );
    if (availability.length && !window) continue;
    const start = window?.start ?? "19:00",
      end = window?.end ?? "22:00";
    if (
      Date.parse(clubDateTime(day, end)) > deadline ||
      Date.parse(clubDateTime(day, start)) <= now
    )
      continue;
    items.push({ day, start, end, selected: true });
  }
  while (items.length < count)
    items.push({ day: "", start: "19:00", end: "22:00", selected: true });
  return items;
}

export function addClubDays(day: string, amount: number) {
  const date = new Date(day + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function clubWeek(value: string | number = Date.now()) {
  const day =
    typeof value === "string" && value.length === 10 ? value : clubDay(value);
  const offset = (new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7;
  const start = addClubDays(day, -offset);
  const end = addClubDays(start, 6);
  return {
    start,
    end,
    endsAt: new Date(
      Date.parse(clubDateTime(addClubDays(start, 7), "00:00")) - 1,
    ).toISOString(),
  };
}
