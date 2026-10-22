import test from "node:test";
import assert from "node:assert/strict";
import {
  optimize,
  pairingError,
  roleStatistics,
} from "../lib/competition-optimizer";
import type {
  CompetitionMeeting,
  CompetitionTeam,
} from "../lib/competition-types";
function teams(n = 12): CompetitionTeam[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    rank: i + 1,
    active: true,
    members: [{ playerId: String(i + 1), name: String(i + 1) }],
  }));
}
function simulate(n = 12, attackerWins = false) {
  const ts = teams(n),
    history: CompetitionMeeting[] = [];
  for (let round = 1; round <= 10; round++) {
    const result = optimize({
      teams: ts,
      round,
      distance: 2,
      championPositions: [2, 3],
      history,
    });
    assert.equal(result.errors.length, 0);
    assert.equal(result.pairs.length, n / 2);
    assert.equal(
      new Set(result.pairs.flatMap((p) => [p.attackerId, p.defenderId])).size,
      n,
    );
    for (const p of result.pairs) {
      assert.equal(
        pairingError(
          ts.find((t) => t.id === p.attackerId),
          ts.find((t) => t.id === p.defenderId),
          2,
          [2, 3],
        ),
        undefined,
      );
      history.push({
        round,
        ...p,
        winnerId: attackerWins ? p.attackerId : p.defenderId,
      });
    }
    if (attackerWins)
      for (const p of result.pairs) {
        const a = ts.find((t) => t.id === p.attackerId)!,
          d = ts.find((t) => t.id === p.defenderId)!;
        const temp = a.rank;
        a.rank = d.rank;
        d.rank = temp;
      }
    assert.deepEqual(
      ts.map((t) => t.rank).sort((a, b) => a - b),
      Array.from({ length: n }, (_, i) => i + 1),
    );
  }
  return { ts, history };
}
test("12 teams, ten defender wins rounds preserve ranks, achieve all16 possible fullcoverage edges and zero consecutive repeats", () => {
  const { ts, history } = simulate();
  assert.deepEqual(
    ts.map((t) => t.rank),
    ts.map((_, i) => i + 1),
  );
  const pairs = new Set(
    history.map((h) => [h.attackerId, h.defenderId].sort().join(":")),
  );
  assert.equal(pairs.size, 16);
  for (const h of history)
    assert.ok(
      !history.some(
        (p) =>
          p.round === h.round - 1 &&
          [p.attackerId, p.defenderId].includes(h.attackerId) &&
          [p.attackerId, p.defenderId].includes(h.defenderId),
      ),
    );
});
test("all attacker wins direct swaps preserve unique rankings for10rounds", () => {
  simulate(12, true);
});
test("Bronze10teams supports10rounds", () => {
  simulate(10);
});
test("championship explicit eligibility is independent of distance and rank2 no priority", () => {
  const ts = teams();
  assert.ok(pairingError(ts[3], ts[0], 3, [2, 3]));
  assert.equal(pairingError(ts[2], ts[0], 3, [2, 3]), undefined);
  assert.ok(pairingError(ts[2], ts[0], 1, [2, 3]));
});
test("locked match preserved, absences create validpartial and accepted conflicts do not fabricate solution", () => {
  const ts = teams();
  const fixed = { attackerId: "3", defenderId: "1", locked: true };
  const result = optimize({
    teams: ts,
    round: 1,
    distance: 2,
    championPositions: [2, 3],
    history: [],
    protectedPairs: [fixed],
    unavailable: ["5"],
  });
  assert.ok(
    result.pairs.some((p) => p.attackerId === "3" && p.defenderId === "1"),
  );
  assert.ok(result.unmatched.includes("5"));
  assert.ok(
    !result.pairs.some((p) => [p.attackerId, p.defenderId].includes("5")),
  );
  const bad = optimize({
    teams: ts,
    round: 1,
    distance: 2,
    championPositions: [2, 3],
    history: [],
    protectedPairs: [fixed, { attackerId: "2", defenderId: "1" }],
  });
  assert.ok(bad.errors.length);
  assert.equal(bad.pairs.length, 0);
});
test("role sliding windows retain old totals and exclude current/future assigned matches", () => {
  const history: CompetitionMeeting[] = [
    { round: 1, attackerId: "A", defenderId: "B" },
    { round: 4, attackerId: "A", defenderId: "B" },
    { round: 5, attackerId: "B", defenderId: "A" },
    { round: 8, attackerId: "A", defenderId: "B" },
  ];
  const r = roleStatistics(history, "A", 6);
  assert.equal(r.attacks, 2);
  assert.equal(r.defenses, 1);
  assert.equal(r.attacks3, 1);
  assert.equal(r.attacks5, 2);
  assert.equal(r.lastRole, "defense");
});
test("all13 feasible distance2 perfect matchings have only16 distinct edges", () => {
  const ts = teams(),
    all: string[][] = [];
  function enumerate(left: CompetitionTeam[], edges: string[]) {
    if (!left.length) {
      all.push(edges);
      return;
    }
    const d = left[0];
    for (let i = 1; i < left.length; i++) {
      const a = left[i];
      if (pairingError(a, d, 2, [2, 3])) continue;
      enumerate(
        left.filter((_, j) => j !== 0 && j !== i),
        [...edges, [a.id, d.id].sort().join(":")],
      );
    }
  }
  enumerate(ts, []);
  assert.equal(all.length, 13);
  assert.equal(new Set(all.flat()).size, 16);
});
test("deterministic same input and configurable distance expands edges", () => {
  const input = {
    teams: teams(),
    round: 1,
    distance: 2,
    championPositions: [2, 3],
    history: [],
  };
  assert.deepEqual(optimize(input), optimize(input));
  assert.equal(
    pairingError(input.teams[5], input.teams[2], 2, [2, 3]),
    "Distância de ataque excedida.",
  );
  assert.equal(
    pairingError(input.teams[5], input.teams[2], 3, [2, 3]),
    undefined,
  );
});
