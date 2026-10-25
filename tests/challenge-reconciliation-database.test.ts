import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, readState, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import { planChallengeReconciliation } from "../lib/challenge-reconciliation";
import { seed } from "../scripts/seed";
import type { Actor, Challenge } from "../lib/types";

test("Mongo transaction retries a simultaneous administrative reconciliation without duplicate cancellation or notices", async () => {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = repl.getUri();
  process.env.MONGODB_DB = "reconcile_test";
  const { client, db } = await database();
  try {
    await seed(true);
    const now = Date.parse("2026-10-25T12:00:00Z");
    let actor: Actor;
    await transaction((s) => {
      const p = s.players.find((p) => p._id === "player-1")!;
      actor = { userId: p.userId!, playerId: p._id, role: "admin" };
      for (const [a, b] of [
        ["player-5", "player-6"],
        ["player-7", "player-8"],
      ]) {
        const x = s.players.find((p) => p._id === a)!,
          y = s.players.find((p) => p._id === b)!;
        x.partner = y.name;
        x.partnerId = y._id;
        y.partner = x.name;
        y.partnerId = x._id;
      }
      const c: Challenge = {
        _id: "first",
        number: 1,
        seasonId: s.seasons[0]._id,
        divisionId: "ouro",
        challengerId: "player-7",
        defenderId: "player-5",
        challengerTeam: s.players
          .filter((p) => ["player-7", "player-8"].includes(p._id))
          .map((p) => ({ playerId: p._id, name: p.name })),
        defenderTeam: s.players
          .filter((p) => ["player-5", "player-6"].includes(p._id))
          .map((p) => ({ playerId: p._id, name: p.name })),
        challengerPosition: 7,
        defenderPosition: 5,
        status: "pending",
        createdAt: new Date(now - 2000).toISOString(),
        respondBy: new Date(now + 3600000).toISOString(),
        scheduleBy: new Date(now + 86400000).toISOString(),
        playBy: new Date(now + 7 * 86400000).toISOString(),
        weekStart: "2026-10-26",
        durationMinutes: 90,
      };
      s.challenges = [
        c,
        {
          ...structuredClone(c),
          _id: "later",
          number: 2,
          challengerId: "player-8",
          defenderId: "player-6",
          createdAt: new Date(now - 1000).toISOString(),
        },
      ];
    });
    const initial = await readState(db),
      scope = { seasonId: initial.seasons[0]._id, weekStart: "2026-10-26" },
      plan = planChallengeReconciliation(initial, scope, now),
      command = {
        type: "admin.challenges.reconciliation.apply",
        ...scope,
        operationId: "simultaneous-repair",
        fingerprint: plan.fingerprint,
        reason: "Corrigir duplicação das contas dos parceiros",
        confirmation: "RECONCILIAR",
        notifyPlayers: true,
      };
    const results = await Promise.all([
      transaction((s) => execute(s, actor!, command, now)),
      transaction((s) => execute(s, actor!, command, now)),
    ]);
    assert.equal(
      results.filter((r) => "alreadyApplied" in r && r.alreadyApplied).length,
      1,
    );
    const final = await readState(db);
    assert.equal(
      final.challenges.find((c) => c._id === "later")?.status,
      "cancelled",
    );
    assert.equal(
      final.challenges.find((c) => c._id === "first")?.status,
      "pending",
    );
    assert.equal(
      final.audit.filter((a) => a.action === "challenge.reconciliation.applied")
        .length,
      1,
    );
    const notices = final.notifications.filter((n) =>
      n.dedupe?.startsWith("challenge-reconciliation:"),
    );
    assert.equal(notices.length, plan.notificationDrafts.length);
    assert.equal(new Set(notices.map((n) => n.dedupe)).size, notices.length);
    assert.deepEqual(final.history, initial.history);
    assert.deepEqual(final.results, initial.results);
  } finally {
    await client.close();
    await repl.stop();
  }
});
