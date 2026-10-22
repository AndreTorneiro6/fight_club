import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, State } from "./types";
import { LeagueError } from "./rules";

import { type PlayerAttributes } from "./padel-attributes";
export type { PlayerAttributes } from "./padel-attributes";
const score = z.number().int().min(0).max(99);
export const playerAttributesCommandSchema = z
  .object({
    type: z.literal("player.attributes.save"),
    playerId: z.string().min(1).max(100).optional(),
    overall: score.optional(),
    expectedVersion: z.number().int().min(0),
    attributes: z
      .object({
        speed: score,
        smash: score,
        lob: score,
        volley: score,
        defense: score,
        physic: score,
      })
      .strict(),
  })
  .strict();

export function executePlayerAttributes(
  state: State,
  actor: Actor,
  raw: unknown,
  at: string,
) {
  const command = playerAttributesCommandSchema.parse(raw);
  const targetId = command.playerId ?? actor.playerId;
  if (targetId !== actor.playerId && actor.role !== "admin")
    throw new LeagueError("Só podes editar o teu próprio cartão.", 403);
  const player = state.players.find(
    (p) =>
      p._id === targetId &&
      (actor.role === "admin" || p.userId === actor.userId),
  );
  if (
    !player ||
    player.status === "removed" ||
    player.awaitingApproval ||
    player.registrationRejectedAt
  )
    throw new LeagueError("Perfil sem acesso ao cartão de jogador.", 403);
  state.playerAttributes ??= [];
  const previous = state.playerAttributes.find(
    (p) => p.playerId === player._id,
  );
  if ((previous?.version ?? 0) !== command.expectedVersion)
    throw new LeagueError(
      "Os atributos foram alterados noutra sessão. Recarrega antes de guardar.",
      409,
    );
  const next: PlayerAttributes = {
    _id: previous?._id ?? randomUUID(),
    playerId: player._id,
    version: (previous?.version ?? 0) + 1,
    attributes: command.attributes,
    ...(command.overall !== undefined ? { overall: command.overall } : {}),
    createdAt: previous?.createdAt ?? at,
    updatedAt: at,
  };
  if (previous)
    state.playerAttributes[state.playerAttributes.indexOf(previous)] = next;
  else state.playerAttributes.push(next);
  state.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: command.type,
    details: JSON.stringify({
      playerId: player._id,
      source: targetId === actor.playerId ? "self_assessed" : "admin_assessed",
      editedBy: actor.playerId,
      before: previous,
      after: next,
    }),
    createdAt: at,
  });
  return { ok: true, version: next.version };
}
