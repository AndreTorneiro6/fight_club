import test from "node:test";
import assert from "node:assert/strict";
import { matchFrozenUntil } from "../lib/match-freeze";
import { collections, type Challenge, type State } from "../lib/types";
const now = Date.parse("2026-10-29T12:00:00Z");
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  const c = {
    _id: "game",
    challengerId: "a",
    defenderId: "b",
    challengerTeam: [
      { playerId: "a", name: "A" },
      { playerId: "partner", name: "Partner" },
    ],
    status: "accepted",
    scheduleBy: "2026-11-30T12:00:00Z",
    playBy: "2026-11-30T12:00:00Z",
  } as Challenge;
  return { s, c };
}
test("a partner's active vacation freezes both title and ordinary matches until the return date", () => {
  const { s, c } = fixture();
  s.exceptions.push({
    _id: "holiday",
    playerId: "partner",
    from: "2026-10-24",
    to: "2026-11-15",
    vacation: true,
    note: "Férias",
  });
  assert.equal(matchFrozenUntil(s, c, now), "2026-11-16");
  assert.equal(
    matchFrozenUntil(s, { ...c, titleFight: true }, now),
    "2026-11-16",
  );
  assert.equal(
    matchFrozenUntil(s, c, Date.parse("2026-11-16T00:00:00Z")),
    undefined,
  );
  s.exceptions[0].playerId = "unrelated";
  assert.equal(matchFrozenUntil(s, c, now), undefined);
});
test("saved deferments thaw on return and never freeze played or terminal matches", () => {
  const { s, c } = fixture();
  c.deferredUntil = "2026-11-16";
  assert.equal(matchFrozenUntil(s, c, now), "2026-11-16");
  for (const status of [
    "completed",
    "cancelled",
    "expired",
    "refused",
    "result_pending",
    "disputed",
  ] as const)
    assert.equal(matchFrozenUntil(s, { ...c, status }, now), undefined);
  assert.equal(
    matchFrozenUntil(
      s,
      { ...c, status: "scheduled", scheduledAt: "2026-10-28T12:00:00Z" },
      now,
    ),
    undefined,
  );
  assert.equal(
    matchFrozenUntil(s, c, Date.parse("2026-11-16T00:00:00Z")),
    undefined,
  );
});
