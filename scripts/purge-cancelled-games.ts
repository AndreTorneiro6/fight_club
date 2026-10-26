import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { database, readState, transaction } from "../lib/db";
import {
  cancelledGameCleanupPreview,
  purgeCancelledGames,
} from "../lib/purge-cancelled-games";
const apply = process.argv.includes("--apply");
const backup = process.argv.find((a) => a.startsWith("--backup="))?.slice(9);
if (apply && !backup)
  throw new Error(
    "Indica --backup=/caminho/privado.json.gz antes de eliminar.",
  );
const { db, client } = await database();
try {
  if (!apply)
    console.log(
      JSON.stringify({
        mode: "preview",
        ...cancelledGameCleanupPreview(await readState(db)),
      }),
    );
  else {
    const result = await transaction(async (s, db, session) => {
      const ids = new Set(
        s.challenges.filter((c) => c.status === "cancelled").map((c) => c._id),
      );
      if (ids.size) {
        const related = <T extends { challengeId?: string }>(rows: T[]) =>
          rows.filter((r) => r.challengeId && ids.has(r.challengeId));
        const notifications = related(s.notifications);
        const deliveries = await db
          .collection("notification_deliveries")
          .find(
            { notificationId: { $in: notifications.map((n) => n._id) } },
            { session },
          )
          .toArray();
        await writeFile(
          backup!,
          gzipSync(
            JSON.stringify({
              createdAt: new Date().toISOString(),
              challenges: s.challenges.filter((c) => ids.has(c._id)),
              matches: related(s.matches),
              messages: related(s.messages),
              slots: related(s.slots),
              notifications,
              deliveries,
              predictions: related(s.predictions ?? []),
            }),
          ),
          { mode: 0o600 },
        );
      }
      const result = purgeCancelledGames(
        s,
        {
          userId: "system:maintenance",
          playerId: "system:maintenance",
          role: "admin",
        },
        "Eliminar definitivamente os jogos cancelados a pedido do administrador",
      );
      const deliveries = await db
        .collection("notification_deliveries")
        .deleteMany(
          { notificationId: { $in: result.notificationIds } },
          { session },
        );
      return {
        deleted: result.deleted,
        divisions: result.divisions,
        removedDeliveries: deliveries.deletedCount,
        remainingCancelled: cancelledGameCleanupPreview(s).count,
      };
    });
    console.log(JSON.stringify({ mode: "applied", ...result }));
  }
} finally {
  await client.close();
}
