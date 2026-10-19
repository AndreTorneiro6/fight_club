import { database, readState, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import { rankingEntries } from "../lib/ranking-groups";
import type { State, User } from "../lib/types";

const candidates = (state: State) =>
  state.divisions
    .flatMap((division) => rankingEntries(state.players, division._id))
    .filter(
      (entry) =>
        entry.members.length === 2 &&
        entry.members.some(
          (member) =>
            member.partnerId !==
            entry.members.find((other) => other._id !== member._id)!._id,
        ),
    );
const { db, client } = await database();
try {
  if (!process.argv.includes("--apply")) {
    console.log(
      JSON.stringify({
        mode: "preview",
        pairsToSynchronise: candidates(await readState(db)).length,
      }),
    );
  } else {
    const result = await transaction(async (state, txDb, session) => {
      const pairs = candidates(state);
      if (!pairs.length) return { pairsSynchronised: 0 };
      const adminUser = await txDb
        .collection<User>("users")
        .findOne({ role: "admin" }, { session });
      const adminPlayer = state.players.find(
        (player) => player.userId === adminUser?._id,
      );
      if (!adminUser || !adminPlayer)
        throw new Error(
          "No administrator account available for the audited partner update.",
        );
      const actor = {
        userId: adminUser._id,
        playerId: adminPlayer._id,
        role: "admin" as const,
      };
      for (const pair of pairs)
        execute(state, actor, {
          type: "admin.partner.set",
          playerId: pair.members[0]._id,
          partnerId: pair.members[1]._id,
        });
      return { pairsSynchronised: pairs.length };
    });
    console.log(JSON.stringify(result));
  }
} finally {
  await client.close();
}
