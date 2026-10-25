import { test } from "node:test";
import assert from "node:assert/strict";
import { initialAgendaWeek } from "../lib/game-agenda";
import type { Challenge } from "../lib/types";
const now = Date.parse("2026-10-25T15:00:00Z");
const game = (date: string, status = "scheduled") =>
  ({ scheduledAt: date, status, durationMinutes: 90 }) as Challenge;
test("Sunday agenda opens next weeks confirmed fixtures rather than an empty current week", () => {
  assert.equal(
    initialAgendaWeek(
      [game("2026-10-27T19:30:00Z"), game("2026-10-28T19:30:00Z")],
      now,
    ),
    "2026-10-26",
  );
});
test("agenda selects the nearest upcoming or in-progress game and ignores cancelled and historical fixtures", () => {
  assert.equal(
    initialAgendaWeek(
      [
        game("2026-10-20T19:30:00Z", "completed"),
        game("2026-10-25T14:30:00Z", "cancelled"),
        game("2026-11-03T19:00:00Z"),
        game("2026-10-28T19:00:00Z"),
      ],
      now,
    ),
    "2026-10-26",
  );
  assert.equal(
    initialAgendaWeek([game("2026-10-25T14:30:00Z")], now),
    "2026-10-19",
  );
});
test("no scheduled fixtures uses this week without treating a private proposal as a confirmed game", () => {
  assert.equal(
    initialAgendaWeek(
      [
        {
          scheduleProposal: { start: "2026-11-03T19:00:00Z" },
          status: "schedule_pending",
        } as Challenge,
      ],
      now,
    ),
    "2026-10-19",
  );
});
