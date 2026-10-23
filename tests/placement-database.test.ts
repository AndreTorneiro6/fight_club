import test from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { database, mutate, readState, view } from "../lib/db";
import { seed } from "../scripts/seed";
import { defaultPlacementRules } from "../lib/placement-types";
import { simulateAdmin } from "../lib/admin-simulation";
import type { Actor } from "../lib/types";

test("placement persists atomically, concurrent imports cannot overwrite, and simulations do not persist", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "placement_test";
  const { client, db } = await database();
  try {
    await seed(true);
    const initial = await readState(db);
    const p = initial.players.find((p) => p.email === "admin@fightclub.local")!;
    const actor: Actor = { userId: p.userId!, playerId: p._id, role: "admin" };
    const season = initial.seasons[0],
      division = initial.divisions[0];
    const created = (await mutate(actor, {
      type: "admin.placement.create",
      seasonId: season._id,
      divisionId: division._id,
      name: "Colocação teste",
      date: "2026-10-23",
      rules: defaultPlacementRules,
    })) as { id: string };
    let state = await readState(db);
    const event = state.placementEvents!.find((e) => e._id === created.id)!;
    assert.ok(event);
    const command = {
      type: "admin.placement.games",
      eventId: event._id,
      expectedVersion: 1,
      games: [
        {
          id: "import-1",
          teamA: event.teams[0].id,
          teamB: event.teams[1].id,
          setsA: 2,
          setsB: 0,
          pointsA: 12,
          pointsB: 5,
        },
      ],
    };
    const results = await Promise.allSettled([
      mutate(actor, command),
      mutate(actor, command),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    state = await readState(db);
    assert.equal(state.placementEvents![0].games.length, 1);
    assert.equal(state.placementEvents![0].version, 2);
    assert.deepEqual(state.players, initial.players);
    const snapshot = structuredClone(state);
    simulateAdmin(state, actor, {
      mode: "matchmaking",
      divisionId: division._id,
      rounds: 3,
      distance: 2,
      outcome: "DEFENDERS_WIN",
      unavailable: [],
    });
    assert.deepEqual(state, snapshot);
    assert.deepEqual(await readState(db), snapshot);
    const hidden = await view({
      ...actor,
      role: "player",
      accountRole: "admin",
      workspace: "player",
    });
    assert.deepEqual(hidden.placementEvents, []);
    await assert.rejects(mutate({ ...actor, role: "player" }, command));
  } finally {
    await client.close();
    await mongo.stop();
  }
});
