/** Explicit administrator policy change; account link emails are outside the league outbox. */
import { database, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import { ensure } from "../lib/rules";
import type { User, Actor } from "../lib/types";
ensure(
  process.argv.includes("--disable"),
  "Use --disable to reserve email for account matters.",
);
const { client } = await database();
try {
  const result = await transaction(async (s, db, session) => {
    const admins = await db
      .collection<User>("users")
      .find({ role: "admin", verified: true }, { session })
      .toArray();
    const p = s.players.find(
      (p) =>
        admins.some((u) => u._id === p.userId) &&
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    );
    ensure(p?.userId, "No active verified administrator.");
    const actor: Actor = { userId: p.userId, playerId: p._id, role: "admin" };
    execute(s, actor, {
      type: "admin.notifications.email-policy",
      enabled: false,
    });
    const cancelled = await db
      .collection("notification_deliveries")
      .updateMany(
        { channel: "email", status: { $in: ["pending", "retry", "blocked"] } },
        {
          $set: {
            status: "skipped",
            error:
              "Email reservado a questões de conta por decisão do administrador.",
          },
        },
        { session },
      );
    return {
      leagueEmailsEnabled: s.settings[0].leagueEmailsEnabled,
      cancelledPendingLeagueEmails: cancelled.modifiedCount,
    };
  });
  console.log(JSON.stringify(result));
} finally {
  await client.close();
}
