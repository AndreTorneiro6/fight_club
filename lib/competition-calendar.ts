import type { State } from "./types";
import { clubWeek } from "./calendar";
export function firstCompetitionWeek(s: Pick<State, "seasons">) {
  return (
    s.seasons.find((e) => e.status === "active") ??
    s.seasons.find((e) => e.status === "paused")
  )?.firstCompetitionWeek;
}
export function seasonWeek(
  s: Pick<State, "seasons">,
  value: string | number = Date.now(),
) {
  const week = clubWeek(value).start,
    first = firstCompetitionWeek(s);
  return first && week < first ? first : week;
}
