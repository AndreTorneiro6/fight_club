import test from "node:test";
import assert from "node:assert/strict";
import type { Db, ClientSession } from "mongodb";
import { readState } from "../lib/db";
test("independent state reads use bounded concurrency while a transaction stays strictly serial", async () => {
  for (const transactional of [false, true]) {
    let active = 0,
      max = 0;
    const db = {
      collection: () => ({
        find: () => ({
          toArray: async () => {
            active++;
            max = Math.max(max, active);
            await new Promise((resolve) => setTimeout(resolve, 1));
            active--;
            return [];
          },
        }),
      }),
    } as unknown as Db;
    const s = await readState(
      db,
      transactional ? ({} as ClientSession) : undefined,
    );
    assert.deepEqual(s.players, []);
    assert(transactional ? max === 1 : max > 1 && max <= 8);
  }
});
