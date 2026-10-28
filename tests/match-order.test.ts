import test from "node:test";
import assert from "node:assert/strict";
import { matchOrder, matchStart } from "../lib/match-order";
import type { Challenge } from "../lib/types";
const now = Date.parse("2026-10-28T12:00:00Z");
const game = (
  id: string,
  date?: string,
  status: Challenge["status"] = "scheduled",
  number = 1,
) =>
  ({
    _id: id,
    number,
    status,
    scheduledAt: date,
    durationMinutes: 90,
  }) as Challenge;
const ids = (games: Challenge[]) =>
  games.sort(matchOrder(now)).map((g) => g._id);
test("future games sort by playing time rather than creation order or match number", () => {
  assert.deepEqual(
    ids([
      game("far", "2026-10-30T19:00:00Z", "scheduled", 1),
      game("near", "2026-10-28T19:00:00Z", "scheduled", 3),
      game("middle", "2026-10-29T19:00:00Z", "scheduled", 2),
    ]),
    ["near", "middle", "far"],
  );
});
test("ongoing games lead upcoming fixtures and history follows from newest to oldest", () => {
  assert.deepEqual(
    ids([
      game("old", "2026-10-25T10:00:00Z", "completed"),
      game("upcoming", "2026-10-29T19:00:00Z"),
      game("recent", "2026-10-27T10:00:00Z", "completed"),
      game("live", "2026-10-28T11:00:00Z"),
    ]),
    ["live", "upcoming", "recent", "old"],
  );
});
test("unscheduled and invalid dates follow dated games and use their deadlines", () => {
  const near = { ...game("no-time-near"), playBy: "2026-10-29T19:00:00Z" };
  const far = { ...game("no-time-far"), playBy: "2026-11-02T19:00:00Z" };
  assert.deepEqual(
    ids([
      far,
      game("invalid", "invalid"),
      near,
      game("dated", "2026-10-30T19:00:00Z"),
    ]),
    ["dated", "no-time-near", "no-time-far", "invalid"],
  );
});
test("comparison handles UTC offsets as instants and uses the time actually displayed for proposals", () => {
  const proposal = {
    ...game("proposal", "2026-10-28T23:00:00Z", "schedule_pending"),
    scheduleProposal: { start: "2026-10-28T15:00:00Z" },
  } as Challenge;
  const confirmed = { ...proposal, status: "scheduled" as const };
  assert.equal(matchStart(proposal), "2026-10-28T15:00:00Z");
  assert.equal(matchStart(confirmed), "2026-10-28T23:00:00Z");
  assert.deepEqual(
    ids([
      proposal,
      game("offset-earlier", "2026-10-28T15:30:00+02:00"),
      game("utc-later", "2026-10-28T14:00:00Z"),
    ]),
    ["offset-earlier", "utc-later", "proposal"],
  );
});
test("equal times have a deterministic match-number and ID tie break", () => {
  assert.deepEqual(
    ids([
      game("z", "2026-10-29T19:00:00Z", "scheduled", 3),
      game("b", "2026-10-29T19:00:00Z", "scheduled", 1),
      game("a", "2026-10-29T19:00:00Z", "scheduled", 1),
    ]),
    ["a", "b", "z"],
  );
});
