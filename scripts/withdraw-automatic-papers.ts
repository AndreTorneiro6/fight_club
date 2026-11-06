import { database, readState, transaction } from "../lib/db";
import { execute } from "../lib/engine";
const apply = process.argv.includes("--apply");
const weekStart = process.argv.find((a) => a.startsWith("--week="))?.slice(7);
const divisionIds =
  process.argv
    .find((a) => a.startsWith("--divisions="))
    ?.slice(12)
    .split(",") ?? [];
if (!weekStart || !divisionIds.length)
  throw new Error("Indica --week=AAAA-MM-DD --divisions=ouro,prata");
const actor = {
  userId: "system:maintenance",
  playerId: "system:maintenance",
  role: "admin" as const,
};
const { db, client } = await database();
try {
  const run = (s: Awaited<ReturnType<typeof readState>>) =>
    divisionIds.map((divisionId) => {
      const round = s.weeklyRounds.find((r) => r.weekStart === weekStart);
      if (!round?.divisionPublications?.[divisionId]?.publishedAt)
        return { divisionId, alreadyDraft: true, notificationIds: [] };
      const result = execute(s, actor, {
        type: "admin.week.division.withdrawAutomatic",
        weekStart,
        divisionId,
        expectedVersion: round.version ?? 0,
        reason:
          "Corrigir publicação automática indevida: só o ranking é automático; papéis e abertura são decisões do administrador.",
      }) as { notificationIds: string[]; version: number };
      return { divisionId, ...result };
    });
  if (!apply)
    console.log(
      JSON.stringify({ mode: "preview", result: run(await readState(db)) }),
    );
  else
    console.log(
      JSON.stringify({
        mode: "applied",
        result: await transaction(async (s, db, session) => {
          const result = run(s);
          await db.collection("notification_deliveries").deleteMany(
            {
              notificationId: {
                $in: result.flatMap((r) => r.notificationIds),
              },
            },
            { session },
          );
          return result.map(({ notificationIds, ...r }) => ({
            ...r,
            removedNotices: notificationIds.length,
          }));
        }),
      }),
    );
} finally {
  await client.close();
}
