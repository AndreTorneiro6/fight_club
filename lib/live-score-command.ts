import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "./rules";
import type { Actor, State } from "./types";
import { liveScoreFor, validateLiveScore } from "./live-score";
import { notifyMatchVoteLiveScore } from "./match-voting";
const score = z.object({
  attacker: z.number().int().min(0).max(2),
  defender: z.number().int().min(0).max(2),
  games: z
    .array(
      z.object({
        attacker: z.number().int().min(0).max(99),
        defender: z.number().int().min(0).max(99),
      }),
    )
    .min(1)
    .max(3)
    .optional(),
});
const commandSchema = score.extend({
  type: z.literal("admin.live-score.save"),
  challengeId: z.string().min(1).max(100),
  expectedVersion: z.number().int().min(0),
});
/** Executed by the domain engine inside the normal MongoDB transaction. */
export function executeLiveScore(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Só o administrador pode atualizar o marcador.",
    403,
  );
  const cmd = commandSchema.parse(raw);
  const c = s.challenges.find((c) => c._id === cmd.challengeId);
  ensure(c, "Jogo não encontrado.", 404);
  ensure(
    liveScoreFor(c, timestamp),
    "O marcador só está disponível após o início e antes do resultado oficial.",
  );
  ensure(
    (c.liveScore?.version ?? 0) === cmd.expectedVersion,
    "O marcador foi atualizado por outro administrador. Consulta a versão atual.",
    409,
  );
  validateLiveScore(cmd);
  const previous = c.liveScore;
  const displayed = liveScoreFor(c, timestamp)!;
  if (
    displayed.attacker === cmd.attacker &&
    displayed.defender === cmd.defender &&
    JSON.stringify(displayed.games) === JSON.stringify(cmd.games)
  )
    return { _id: c._id, version: c.liveScore?.version ?? 0 };
  c.liveScore = {
    attacker: cmd.attacker,
    defender: cmd.defender,
    games: cmd.games,
    scheduledAt: c.scheduledAt!,
    version: cmd.expectedVersion + 1,
    updatedAt: new Date(timestamp).toISOString(),
  };
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    createdAt: c.liveScore.updatedAt,
    details: JSON.stringify({
      challengeId: c._id,
      previous: previous ?? null,
      score: c.liveScore,
    }),
  });
  notifyMatchVoteLiveScore(s, c, timestamp);
  return { _id: c._id, version: c.liveScore.version };
}
