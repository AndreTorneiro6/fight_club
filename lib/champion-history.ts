import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "./rules";
import { clubDay } from "./calendar";
import type { Actor, State } from "./types";

const id = z.string().min(1).max(100);
const schema = z
  .object({
    type: z.literal("admin.champions.correct-history"),
    divisionId: id,
    championId: id,
    expectedPlayerId: id,
    expectedSince: z.iso.datetime({ offset: true }),
    since: z.iso.datetime({ offset: true }),
    removeHistoryIds: z.array(id).max(20),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

/** Explicit correction of a mistaken title record, preserving the removed content in the audit. */
export function executeChampionHistory(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin" && !actor.workspaceSelectionRequired,
    "Apenas administradores.",
    403,
  );
  const cmd = schema.parse(raw);
  const current = s.champions.find((c) => c._id === cmd.championId);
  ensure(
    current &&
      current.divisionId === cmd.divisionId &&
      !current.until &&
      current.playerId === cmd.expectedPlayerId &&
      current.since === cmd.expectedSince,
    "O registo do campeão mudou. Atualiza antes de corrigir.",
    409,
  );
  ensure(
    s.champions.filter((c) => c.divisionId === cmd.divisionId && !c.until)
      .length === 1,
    "Revê os campeões atuais desta divisão.",
    409,
  );
  const season = s.seasons.find((season) => season._id === current.seasonId);
  ensure(
    season &&
      clubDay(cmd.since) >= season.start &&
      clubDay(cmd.since) <= season.end &&
      Date.parse(cmd.since) <= timestamp,
    "A data do título deve pertencer à época e não pode ser futura.",
  );
  const ids = new Set(cmd.removeHistoryIds);
  ensure(ids.size === cmd.removeHistoryIds.length, "Registos repetidos.");
  const removed = s.champions.filter((c) => ids.has(c._id));
  ensure(
    removed.length === ids.size &&
      removed.every(
        (c) =>
          c.divisionId === cmd.divisionId &&
          c.seasonId === current.seasonId &&
          !!c.until &&
          c._id !== current._id,
      ),
    "Só podes remover os registos históricos indicados da mesma divisão e época.",
    409,
  );
  ensure(
    !s.champions.some(
      (c) =>
        c.divisionId === cmd.divisionId &&
        c.seasonId === current.seasonId &&
        c._id !== current._id &&
        !ids.has(c._id) &&
        c.until &&
        Date.parse(c.until) > Date.parse(cmd.since),
    ),
    "A data sobrepõe-se a outro título guardado.",
    409,
  );
  const before = structuredClone(current);
  const now = new Date(timestamp).toISOString();
  current.since = cmd.since;
  s.champions = s.champions.filter((c) => !ids.has(c._id));
  const affected = new Set(
    [before, ...removed].flatMap((c) => [
      c.playerId,
      ...(c.teamSnapshot ?? []).map((p) => p.playerId),
    ]),
  );
  for (const playerId of affected) {
    const p = s.players.find((p) => p._id === playerId);
    if (p)
      s.history.push({
        _id: randomUUID(),
        playerId,
        divisionId: cmd.divisionId,
        oldPosition: p.position,
        newPosition: p.position,
        reason: `Correção do histórico do título: ${cmd.reason}`,
        createdAt: now,
      });
  }
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify({
      reason: cmd.reason,
      before,
      after: current,
      removed,
    }),
    createdAt: now,
  });
  return {
    correctedChampionId: current._id,
    since: current.since,
    removedHistoryIds: cmd.removeHistoryIds,
  };
}
