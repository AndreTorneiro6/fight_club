import test from "node:test";
import assert from "node:assert/strict";
import { executeCompetition } from "../lib/competition";
import {
  collections,
  defaultSettings,
  type State,
  type Actor,
  type Player,
} from "../lib/types";
import {
  defaultCompetitionWeights,
  type CompetitionSchedule,
} from "../lib/competition-types";
const at = Date.parse("2026-10-21T10:00:00Z"),
  start = "2026-10-23T18:00:00.000Z";
const admin: Actor = { userId: "admin", playerId: "p1", role: "admin" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((c) => [c, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings }];
  s.divisions = [
    { _id: "ouro", name: "Ouro", code: "ouro", tier: 1, capacity: 4 },
  ];
  s.seasons = [
    {
      _id: "season",
      name: "2026",
      start: "2026-01-01",
      end: "2027-01-01",
      pauseStart: "",
      pauseEnd: "",
      status: "active",
    },
  ];
  s.players = Array.from({ length: 4 }, (_, i): Player => ({
    _id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    email: `p${i}@test.local`,
    phone: "",
    photo: "",
    number: i + 1,
    divisionId: "ouro",
    position: i + 1,
    previousPosition: i + 1,
    status: "active",
    partner: "",
    wins: 0,
    losses: 0,
    challengesWon: 0,
    challengesLost: 0,
    createdAt: new Date(at).toISOString(),
  }));
  s.courts = [
    { _id: "c1", name: "Campo 1", active: true },
    { _id: "c2", name: "Campo 2", active: true },
    { _id: "inactive", name: "Desativado", active: false },
  ];
  run(s, {
    type: "competition.config.save",
    expectedVersion: 0,
    seasonId: "season",
    enabled: true,
    officialRounds: 10,
    defaultDistance: 2,
    leagueDistances: {},
    championPositions: [2, 3],
    responseHours: 48,
    firstOpen: true,
    finalOpen: true,
    weights: defaultCompetitionWeights,
  });
  run(s, {
    type: "competition.round.save",
    expectedVersion: 0,
    competitionId: s.competitionConfigurations![0]._id,
    divisionId: "ouro",
    number: 1,
    opensAt: "2026-10-20T10:00:00Z",
    closesAt: "2026-10-22T10:00:00Z",
    schedulingDeadline: "2026-10-23T10:00:00Z",
    startsAt: "2026-10-23T10:00:00Z",
    endsAt: "2026-10-27T10:00:00Z",
    instructions: "",
  });
  run(s, {
    type: "competition.generate",
    expectedVersion: 0,
    roundId: s.competitionRounds![0]._id,
  });
  return { s, q: s.competitionSchedules![0] };
}
function run(s: State, cmd: unknown) {
  return executeCompetition(s, admin, cmd, at);
}
function edit(
  s: State,
  q: CompetitionSchedule,
  pairs: CompetitionSchedule["pairs"],
) {
  run(s, {
    type: "competition.edit",
    scheduleId: q._id,
    expectedVersion: q.version,
    pairs,
  });
}
function approve(s: State, q: CompetitionSchedule) {
  run(s, {
    type: "competition.approve",
    scheduleId: q._id,
    expectedVersion: q.version,
  });
}
function publish(s: State, q: CompetitionSchedule) {
  approve(s, q);
  run(s, {
    type: "competition.publish",
    scheduleId: q._id,
    expectedVersion: q.version,
  });
}
test("club court assignment requires activecourt and kickoff; overlapping proposed matches block approval", () => {
  const { s, q } = fixture();
  edit(
    s,
    q,
    q.pairs.map((p) => ({ ...p, courtId: "c1" })),
  );
  assert.ok(q.errors.some((e) => e.includes("data e hora")));
  assert.throws(() => approve(s, q));
  edit(
    s,
    q,
    q.pairs.map((p, i) => ({ ...p, start, courtId: i ? "c2" : "inactive" })),
  );
  assert.ok(q.errors.some((e) => e.includes("inativo")));
  edit(
    s,
    q,
    q.pairs.map((p) => ({ ...p, start, courtId: "c1" })),
  );
  assert.ok(q.errors.some((e) => e.includes("sobrepostos")));
  assert.throws(() => approve(s, q));
});
test("calendar conflicts use actualintervals and allow adjacent matches", () => {
  const { s, q } = fixture();
  s.matches.push({
    _id: "external",
    challengeId: "external",
    courtId: "c1",
    start,
    end: "2026-10-23T19:30:00.000Z",
    seasonId: "season",
  });
  edit(
    s,
    q,
    q.pairs.map((p, i) => ({
      ...p,
      start: i ? "2026-10-23T19:30:00.000Z" : start,
      courtId: i ? "c2" : "c1",
    })),
  );
  assert.ok(q.errors.some((e) => e.includes("outro jogo")));
  edit(
    s,
    q,
    q.pairs.map((p) => ({ ...p, start: "2026-10-23T19:30:00.000Z" })),
  );
  assert.equal(q.errors.length, 0);
  publish(s, q);
  assert.equal(s.challenges[0].courtId, "c1");
  assert.equal(
    s.matches.find((m) => m.challengeId === s.challenges[0]._id)?.courtId,
    "c1",
  );
});
test("court-only amendment preserves officialmatch identity, immutable priorrevision and targeted notifications", () => {
  const { s, q } = fixture();
  edit(
    s,
    q,
    q.pairs.map((p, i) => ({ ...p, start, courtId: i ? "c2" : "c1" })),
  );
  publish(s, q);
  const originalId = q.pairs[0].challengeId!,
    cutoff = s.challenges.find((c) => c._id === originalId)!.predictionCutoffAt;
  run(s, {
    type: "competition.amend",
    scheduleId: q._id,
    expectedVersion: q.version,
    reason: "Trocar os campos",
  });
  const revision = s.competitionSchedules!.at(-1)!;
  edit(
    s,
    revision,
    revision.pairs.map((p, i) => ({ ...p, courtId: i ? "c1" : "c2" })),
  );
  const before = s.notifications.length;
  publish(s, revision);
  assert.equal(revision.pairs[0].challengeId, originalId);
  assert.equal(s.challenges.find((c) => c._id === originalId)!.courtId, "c2");
  assert.equal(
    s.challenges.find((c) => c._id === originalId)!.predictionCutoffAt,
    cutoff,
  );
  assert.equal(q.pairs[0].courtId, "c1");
  assert.equal(s.notifications.length - before, 4);
  assert.equal(
    s.matches.find((m) => m.challengeId === originalId)?.courtId,
    "c2",
  );
});
test("completed officialmatch court cannot change via scheduling amendment", () => {
  const { s, q } = fixture();
  edit(
    s,
    q,
    q.pairs.map((p, i) => ({ ...p, start, courtId: i ? "c2" : "c1" })),
  );
  publish(s, q);
  s.challenges.find((c) => c._id === q.pairs[0].challengeId)!.status =
    "completed";
  run(s, {
    type: "competition.amend",
    scheduleId: q._id,
    expectedVersion: q.version,
    reason: "Tentativa de trocar campo",
  });
  const revision = s.competitionSchedules!.at(-1)!;
  assert.throws(
    () =>
      edit(
        s,
        revision,
        revision.pairs.map((p, i) => (i ? p : { ...p, courtId: "c2" })),
      ),
    /concluído/,
  );
});
