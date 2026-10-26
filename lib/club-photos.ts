import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, State } from "./types";
import { ensure } from "./rules";
import { executeCoins } from "./coins";
import { photoUnlockProgress } from "./club-photo-types";
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("admin.photos.create"),
      photoId: z.string().uuid(),
      title: z.string().trim().min(1).max(100),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.photos.update"),
      photoId: z.string().uuid(),
      expectedVersion: z.number().int().min(0),
      title: z.string().trim().min(1).max(100),
      description: z.string().trim().max(500),
      active: z.boolean(),
      rule: z.enum(["UNDECIDED", "MANUAL", "MATCHES", "COINS"]),
      target: z.number().int().min(1).max(1000000),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.photos.unlock"),
      photoId: z.string().uuid(),
      playerId: z.string().min(1),
      expectedVersion: z.number().int().min(0),
      expectedBalance: z.number().int().optional(),
      requestId: z.string().uuid(),
      reason: z.string().trim().min(3).max(500),
    })
    .strict(),
]);
export function executeClubPhotos(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "As fotografias estão em teste privado para administradores.",
    403,
  );
  const cmd = schema.parse(raw),
    now = new Date(timestamp).toISOString();
  if (cmd.type === "admin.photos.create") {
    ensure(
      !(s.clubPhotos ?? []).some((p) => p._id === cmd.photoId),
      "Fotografia já registada.",
      409,
    );
    (s.clubPhotos ??= []).push({
      _id: cmd.photoId,
      title: cmd.title,
      description: "",
      version: 0,
      active: true,
      rule: "UNDECIDED",
      target: 1,
      createdAt: now,
      createdBy: actor.userId,
      updatedAt: now,
      updatedBy: actor.userId,
    });
  } else {
    const photo = s.clubPhotos?.find((p) => p._id === cmd.photoId);
    ensure(photo, "Fotografia não encontrada.", 404);
    ensure(
      photo.version === cmd.expectedVersion,
      "A fotografia mudou. Atualiza antes de continuar.",
      409,
    );
    if (cmd.type === "admin.photos.update") {
      const { type: _, photoId: __, expectedVersion: ___, ...values } = cmd;
      Object.assign(photo, values, {
        version: photo.version + 1,
        updatedAt: now,
        updatedBy: actor.userId,
      });
    } else {
      ensure(
        s.players.some(
          (p) =>
            p._id === cmd.playerId &&
            p.status === "active" &&
            !p.awaitingApproval &&
            !p.registrationRejectedAt,
        ),
        "Jogador indisponível.",
      );
      const progress = photoUnlockProgress(s, photo, cmd.playerId);
      if (progress.unlocked) return { ok: true };
      ensure(
        progress.eligible,
        photo.rule === "UNDECIDED"
          ? "Define primeiro como desbloquear esta fotografia."
          : "O jogador ainda não cumpre a regra de desbloqueio.",
      );
      if (photo.rule === "COINS")
        executeCoins(
          s,
          actor,
          {
            type: "admin.coins.adjust",
            playerId: cmd.playerId,
            expectedBalance: cmd.expectedBalance,
            amount: -photo.target,
            reason: `Fotografia: ${photo.title}`,
            requestId: cmd.requestId,
          },
          timestamp,
        );
      (s.clubPhotoUnlocks ??= []).push({
        _id: randomUUID(),
        photoId: photo._id,
        playerId: cmd.playerId,
        rule: photo.rule,
        target: photo.target,
        reason: cmd.reason,
        unlockedAt: now,
        unlockedBy: actor.userId,
      });
    }
  }
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify(cmd),
    createdAt: now,
  });
  return { ok: true };
}
