import { writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { database, readState, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import { legacyTeamSnapshotPlan } from "../lib/challenge-team-ranks";
const apply = process.argv.includes("--apply"),
  backup = process.argv.find((a) => a.startsWith("--backup="))?.slice(9);
const expected = Number(
  process.argv.find((a) => a.startsWith("--expected="))?.slice(11),
);
if (apply && (!backup || !Number.isInteger(expected)))
  throw new Error("Indica --backup=/caminho/privado.json.gz e --expected=N.");
const { client, db } = await database();
try {
  if (!apply) {
    const s = await readState(db),
      plan = legacyTeamSnapshotPlan(s);
    console.log(
      JSON.stringify({
        mode: "preview",
        count: plan.length,
        games: plan.map((p) => ({
          number: s.challenges.find((c) => c._id === p.challengeId)!.number,
          before: [p.challengerPosition, p.defenderPosition],
          after: [p.teamAttacker, p.teamDefender],
        })),
      }),
    );
  } else {
    const result = await transaction(async (s) => {
      const plan = legacyTeamSnapshotPlan(s);
      if (plan.length !== expected)
        throw new Error("A lista mudou: volta a validar antes de aplicar.");
      if (!plan.length) return { normalized: 0, remaining: 0 };
      const protectedState = () =>
        JSON.stringify([
          s.players,
          s.matches,
          s.results,
          s.history,
          s.weeklyRounds,
          s.seasons,
          s.settings,
          s.champions,
          s.notifications,
        ]);
      const before = protectedState(),
        ids = new Set(plan.map((p) => p.challengeId));
      await writeFile(
        backup!,
        gzipSync(JSON.stringify(s.challenges.filter((c) => ids.has(c._id)))),
        { mode: 0o600 },
      );
      const result = execute(
        s,
        {
          role: "admin",
          userId: "system:maintenance",
          playerId: "system:maintenance",
        },
        {
          type: "admin.challenges.team_positions.normalize",
          snapshots: plan.map(
            ({ challengeId, challengerPosition, defenderPosition }) => ({
              challengeId,
              challengerPosition,
              defenderPosition,
            }),
          ),
          note: "Corrigir posições individuais legadas para posições das duplas nos registos e cartazes, após validação",
        },
      );
      if (protectedState() !== before)
        throw new Error("A normalização alterou dados protegidos.");
      return { ...result, remaining: legacyTeamSnapshotPlan(s).length };
    });
    console.log(JSON.stringify({ mode: "applied", ...result }));
  }
} finally {
  await client.close();
}
