import { test } from "node:test";
import assert from "node:assert/strict";
import { filterFeatureView } from "../lib/feature-view";
import { collections, type State, type Actor, type Player } from "../lib/types";
import type {
  CompetitionSchedule,
  CompetitionChallenge,
} from "../lib/competition-types";
import type { Prediction } from "../lib/predictions";

const actor: Actor = { userId: "u1", playerId: "p1", role: "player" };
function fixture() {
  const state = Object.fromEntries(
    collections.map((key) => [key, []]),
  ) as unknown as State;
  state.divisions = [
    { _id: "ouro", code: "ouro", name: "Ouro", tier: 1, capacity: 24 },
  ];
  state.players = [1, 2, 3].map((n): Player => ({
    _id: `p${n}`,
    name: `Jogador ${n}`,
    userId: `u${n}`,
    email: "",
    phone: "",
    photo: "",
    number: n,
    divisionId: "ouro",
    position: n,
    previousPosition: n,
    status: "active",
    partner: "",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: "2026-10-21T10:00:00Z",
  }));
  state.competitionSchedules = ["DRAFT", "APPROVED", "PUBLISHED"].map(
    (status, i) => ({
      _id: `s${i}`,
      roundId: "r1",
      version: 1,
      revision: i + 1,
      status,
      snapshot: [
        {
          id: "historic-p1:p4",
          rank: 1,
          active: true,
          members: [{ playerId: "p1", name: "Jogador 1" }],
        },
      ],
      effectiveDistance: 2,
      championPositions: [2, 3],
      weekType: "NORMAL",
      pairs: [],
      unmatched: [],
      warnings: [],
      errors: [],
      createdAt: "2026-10-21T10:00:00Z",
      createdBy: "admin",
      ...(status === "PUBLISHED"
        ? { publishedAt: "2026-10-21T11:00:00Z" }
        : {}),
    }),
  ) as CompetitionSchedule[];
  state.competitionChallenges = [
    { _id: "own", attackerId: "p1", defenderId: "p2" },
    { _id: "historical", attackerId: "historic-p1:p4", defenderId: "p2" },
    { _id: "other", attackerId: "p3", defenderId: "p2" },
  ] as CompetitionChallenge[];
  state.predictions = [
    { _id: "mine", userId: "u1" },
    { _id: "other", userId: "u2" },
  ] as Prediction[];
  state.competitionAbsences = [
    {
      _id: "absence",
      competitionId: "c1",
      divisionId: "ouro",
      teamId: "p2",
      from: "2026-10-21",
      to: "2026-10-22",
      reason: "Informação médica privada",
      roundIds: [],
      approvedBy: "admin",
      approvedAt: "2026-10-21T10:00:00Z",
      recoveryAllowed: false,
    },
  ];
  return state;
}

test("player projection hides drafts, approvals, unrelated challenges and other predictions", () => {
  const state = fixture();
  filterFeatureView(state, actor);
  assert.deepEqual(
    state.competitionSchedules?.map((s) => s.status),
    ["PUBLISHED"],
  );
  assert.deepEqual(
    state.competitionChallenges?.map((c) => c._id),
    ["own", "historical"],
  );
  assert.deepEqual(
    state.predictions?.map((p) => p._id),
    ["mine"],
  );
  assert.equal(state.competitionAbsences?.[0].reason, "Ausência aprovada");
  assert.doesNotMatch(JSON.stringify(state), /Informação médica privada/);
});

test("administrator projection preserves private proposals for review", () => {
  const state = fixture(),
    before = structuredClone(state);
  filterFeatureView(state, { ...actor, role: "admin" });
  assert.deepEqual(state, before);
});

test("an approved schedule without publication cannot become public by setting its status alone", () => {
  const state = fixture();
  delete state.competitionSchedules![2].publishedAt;
  filterFeatureView(state, actor);
  assert.deepEqual(state.competitionSchedules, []);
});
