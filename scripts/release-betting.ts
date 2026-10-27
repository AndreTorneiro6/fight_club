/** One-time, explicitly invoked player launch. All writes use the validated domain in one transaction. */
import { database, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import type { Actor, User } from "../lib/types";

const sendAt = process.argv
  .find((arg) => arg.startsWith("--announce-at="))
  ?.slice("--announce-at=".length);
if (
  !process.argv.includes("--reset") ||
  !sendAt ||
  !Number.isFinite(Date.parse(sendAt))
) {
  throw new Error(
    "Usage: tsx scripts/release-betting.ts --reset --announce-at=<ISO timestamp>",
  );
}
const { client } = await database();
try {
  const result = await transaction(async (state, db, session) => {
    const users = await db
      .collection<User>("users")
      .find({ role: "admin", verified: true }, { session })
      .toArray();
    const player = state.players.find(
      (p) =>
        users.some((u) => u._id === p.userId) &&
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    );
    if (!player?.userId)
      throw new Error("No verified active administrator available.");
    const actor: Actor = {
      userId: player.userId,
      playerId: player._id,
      role: "admin",
    };
    const now = Date.now();
    const schedule = execute(
      state,
      actor,
      { type: "admin.match-vote.announce", sendAt },
      now,
    );
    const reset = execute(
      state,
      actor,
      { type: "admin.match-vote.reset", confirmation: "RESET" },
      now,
    );
    if ("notificationIds" in reset && reset.notificationIds.length)
      await db
        .collection("notification_deliveries")
        .deleteMany(
          { notificationId: { $in: reset.notificationIds } },
          { session },
        );
    return { schedule, reset };
  });
  console.log(JSON.stringify(result));
} finally {
  await client.close();
}
