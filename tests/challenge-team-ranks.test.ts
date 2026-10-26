import test from "node:test";
import assert from "node:assert/strict";
import {
  collections,
  defaultSettings,
  type State,
  type Player,
  type Challenge,
  type Actor,
} from "../lib/types";
import {
  challengeTeamRanks,
  legacyTeamSnapshotPlan,
} from "../lib/challenge-team-ranks";
import { isTitleMatch } from "../lib/title-matches";
import { execute } from "../lib/engine";
import { matchdayCards } from "../lib/matchday";
const admin: Actor = { role: "admin", userId: "a", playerId: "p1" };
function fixture() {
  const s = Object.fromEntries(
    collections.map((k) => [k, []]),
  ) as unknown as State;
  s.settings = [{ ...defaultSettings }];
  s.divisions = [
    { _id: "gold", code: "ouro", name: "Ouro", tier: 1, capacity: 12 },
  ];
  s.players = Array.from(
    { length: 6 },
    (_, i) =>
      ({
        _id: `p${i + 1}`,
        name: `Player ${i + 1}`,
        divisionId: "gold",
        position: i + 1,
        previousPosition: i + 1,
        partnerId: `p${i % 2 === 0 ? i + 2 : i}`,
        partner: "",
        status: "active",
      }) as Player,
  );
  s.challenges = [
    {
      _id: "old",
      number: 1,
      divisionId: "gold",
      challengerId: "p6",
      defenderId: "p1",
      challengerPosition: 6,
      defenderPosition: 1,
      status: "scheduled",
      scheduledAt: "2026-10-26T19:00:00Z",
      createdAt: "2026-10-26T12:00:00Z",
      seasonId: "season",
    },
  ] as Challenge[];
  return s;
}
test("legacy second partner ordinal6 exports the same team position3 as their partner, never6", () => {
  const s = fixture(),
    c = s.challenges[0];
  assert.deepEqual(challengeTeamRanks(s, c), {
    attacker: 3,
    defender: 1,
    source: "legacy-converted",
  });
  const card = matchdayCards(s, "2026-10-26", "all", "title")[0];
  assert.equal(card.attackerRank, 3);
  assert.equal(card.defenderRank, 1);
  c.challengerId = "p5";
  c.challengerPosition = 5;
  assert.equal(challengeTeamRanks(s, c).attacker, 3);
});
test("conversion groups actual teams, including single-member teams; it does not divide individual positions by2", () => {
  const s = fixture();
  s.players[2].partnerId = undefined;
  s.players[3].partnerId = "p5";
  s.players[4].partnerId = "p4";
  s.players[5].partnerId = undefined;
  const ranks = challengeTeamRanks(s, s.challenges[0]);
  assert.equal(ranks.attacker, 4);
  assert.equal(ranks.defender, 1);
});
test("team snapshots remain historical after today's ranking changes; published competition snapshots are already team ranks", () => {
  const s = fixture(),
    c = s.challenges[0];
  c.positionSnapshotModel = "team";
  c.challengerPosition = 3;
  s.players[5].position = 1;
  assert.equal(challengeTeamRanks(s, c).attacker, 3);
  c.positionSnapshotModel = undefined;
  c.competitionRoundId = "round";
  assert.equal(challengeTeamRanks(s, c).attacker, 3);
});
test("unverifiable legacy history is never labelled as team ranks", () => {
  const s = fixture(),
    c = s.challenges[0];
  c.status = "completed";
  assert.equal(challengeTeamRanks(s, c).source, "unavailable");
  c.status = "scheduled";
  s.players[5].position = 2;
  assert.equal(challengeTeamRanks(s, c).attacker, undefined);
});
test("admin normalization audits original values and changes only position snapshot fields", () => {
  const s = fixture(),
    before = structuredClone(s);
  const plan = legacyTeamSnapshotPlan(s);
  assert.deepEqual(
    execute(s, admin, {
      type: "admin.challenges.team_positions.normalize",
      snapshots: plan.map(
        ({ challengeId, challengerPosition, defenderPosition }) => ({
          challengeId,
          challengerPosition,
          defenderPosition,
        }),
      ),
      note: "Fix legacy individual ordinals",
    }),
    { normalized: 1 },
  );
  assert.equal(s.challenges[0].challengerPosition, 3);
  assert.equal(s.challenges[0].positionSnapshotModel, "team");
  assert.deepEqual(s.players, before.players);
  assert.deepEqual(s.matches, before.matches);
  assert.deepEqual(s.history, before.history);
  assert.deepEqual(s.notifications, before.notifications);
  assert.equal(s.audit.at(-1)?.action, "challenge.team_positions.normalized");
  assert.match(s.audit.at(-1)!.details, /individual/);
  assert.equal(legacyTeamSnapshotPlan(s).length, 0);
});
test("normalization rejects players, stale inputs and completed historical games before mutation", () => {
  for (const mode of ["player", "stale", "completed"]) {
    const s = fixture();
    if (mode === "completed") s.challenges[0].status = "completed";
    const before = structuredClone(s);
    assert.throws(() =>
      execute(
        s,
        { ...admin, role: mode === "player" ? "player" : "admin" },
        {
          type: "admin.challenges.team_positions.normalize",
          snapshots: [
            {
              challengeId: "old",
              challengerPosition: mode === "stale" ? 5 : 6,
              defenderPosition: 1,
            },
          ],
          note: "Fix legacy ordinals",
        },
      ),
    );
    assert.deepEqual(s, before);
  }
});

test("challenging the champion's second registered player still exports a title game with team position1", () => {
  const s = fixture(),
    c = s.challenges[0];
  c.defenderId = "p2";
  c.defenderPosition = 2;
  assert.equal(isTitleMatch(c, s), true);
  const cards = matchdayCards(s, "2026-10-26", "all", "title");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].defenderRank, 1);
  assert.equal(matchdayCards(s, "2026-10-26", "all", "fixtures").length, 0);
});
