import { addClubDays, clubDay } from "./calendar";
import { challengeParticipants } from "./team-competition";
import { effectiveStatus, terminal } from "./rules";
import type { Challenge, State } from "./types";

/** A display of the existing vacation/deferment rules; never changes match state. */
export function matchFrozenUntil(s: State, c: Challenge, now = Date.now()) {
  if (
    terminal.has(effectiveStatus(c, now)) ||
    ["result_pending", "disputed"].includes(c.status) ||
    (c.scheduledAt && Date.parse(c.scheduledAt) <= now)
  )
    return undefined;
  const today = clubDay(now),
    ids = challengeParticipants(c, s.players);
  const dates = s.exceptions
    .filter(
      (e) =>
        e.vacation &&
        ids.includes(e.playerId) &&
        e.from <= today &&
        e.to >= today,
    )
    .map((e) => addClubDays(e.to, 1));
  if (c.deferredUntil && c.deferredUntil > today) dates.push(c.deferredUntil);
  return dates.sort().at(-1);
}
