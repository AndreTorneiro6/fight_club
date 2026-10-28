import { matchOrder } from "./match-order";
import type { Challenge } from "./types";
import { clubWeek } from "./calendar";

/** Open the agenda on the next confirmed fixture, rather than an empty current week. */
export function initialAgendaWeek(challenges: Challenge[], now = Date.now()) {
  const next = challenges
    .filter(
      (c) =>
        c.scheduledAt &&
        !["cancelled", "refused", "expired"].includes(c.status) &&
        Date.parse(c.scheduledAt) + c.durationMinutes * 60000 > now,
    )
    .sort(matchOrder(now))[0];
  return clubWeek(next?.scheduledAt ?? now).start;
}
