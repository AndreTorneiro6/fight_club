import test from "node:test";
import assert from "node:assert/strict";
import { challengeOrigin } from "../lib/challenge-origin";
import type { Challenge } from "../lib/types";
const c = { _id: "c", mandatoryAssignment: true } as Challenge;
const entry = (action: string, details: unknown, userId = "player") => ({
  _id: action,
  action,
  details: JSON.stringify(details),
  userId,
  createdAt: "2026-10-25T12:00:00Z",
});
test("mandatory status alone never implies automatic origin", () => {
  assert.equal(challengeOrigin({ audit: [] }, c).kind, "unknown");
});
test("legacy automatic provenance includes explicit triggering challenge and reason", () => {
  const audit = [
    entry(
      "admin.challenge.created",
      { challengeId: "c" },
      "system:weekly-matchmaking",
    ),
    entry("challenge.forced-by-priority", {
      challengeId: "c",
      triggerChallengeId: "first",
      reason: "Necessário",
    }),
  ];
  assert.deepEqual(challengeOrigin({ audit }, c), {
    kind: "rules",
    triggerChallengeId: "first",
    reason: "Necessário",
    createdAt: "2026-10-25T12:00:00Z",
  });
});
test("player and admin actions stay distinct and malformed audit records do not fabricate an origin", () => {
  assert.equal(
    challengeOrigin(
      { audit: [entry("challenge.created", { challengeId: "c" })] },
      c,
    ).kind,
    "player",
  );
  assert.equal(
    challengeOrigin(
      {
        audit: [
          entry("admin.challenge.created", { challengeId: "c" }, "admin"),
        ],
      },
      c,
    ).kind,
    "admin",
  );
  assert.equal(
    challengeOrigin(
      { audit: [{ ...entry("challenge.created", {}), details: "bad json" }] },
      c,
    ).kind,
    "unknown",
  );
});
test("persisted provenance takes precedence over incomplete historical logs", () => {
  assert.equal(
    challengeOrigin(
      { audit: [] },
      { ...c, origin: { kind: "player", actorUserId: "p" } },
    ).kind,
    "player",
  );
});
