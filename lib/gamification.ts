import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { State, Actor } from "./types";
import { ensure } from "./rules";
import { defaultGamificationSettings } from "./gamification-types";
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/, "Cor inválida.");
const score = z.number().int().min(0).max(99);
const label = z.string().trim().min(1).max(40);
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("admin.gamification.settings"),
      expectedVersion: z.number().int().min(0),
      frontTitle: label,
      backTitle: label,
      labels: z
        .object({ bar: label, banter: label, partner: label, fairplay: label })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.gamification.profile"),
      playerId: z.string().min(1).max(100),
      expectedVersion: z.number().int().min(0),
      expectedSettingsVersion: z.number().int().min(0),
      nickname: z.string().trim().max(40),
      slogan: z.string().trim().max(100).optional(),
      signature: z
        .array(
          z
            .array(
              z
                .object({
                  x: z.number().min(0).max(1),
                  y: z.number().min(0).max(1),
                })
                .strict(),
            )
            .min(1)
            .max(160),
        )
        .max(40)
        .optional(),
      avatar: z
        .object({
          skin: color,
          hairColor: color,
          shirt: color,
          background: color,
          hair: z.enum(["short", "wave", "long", "bald"]),
          expression: z.enum(["smile", "focused"]),
          glasses: z.boolean(),
          beard: z.boolean(),
        })
        .strict(),
      social: z
        .object({ bar: score, banter: score, partner: score, fairplay: score })
        .strict(),
    })
    .strict(),
]);
export function executeGamification(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "A gamificação está em teste privado para administradores.",
    403,
  );
  const cmd = schema.parse(raw),
    settings = state.gamificationSettings?.[0] ?? defaultGamificationSettings;
  const now = new Date(timestamp).toISOString();
  let previous: unknown, next: unknown;
  let version: number;
  if (cmd.type === "admin.gamification.settings") {
    ensure(
      cmd.expectedVersion === settings.version,
      "As definições foram alteradas por outro administrador. O rascunho foi mantido.",
      409,
    );
    const { type: _, expectedVersion: __, ...fields } = cmd;
    previous = settings;
    version = settings.version + 1;
    const updated = {
      ...fields,
      _id: "gamification",
      version,
      updatedAt: now,
      updatedBy: actor.userId,
    };
    next = updated;
    state.gamificationSettings = [updated];
  } else {
    ensure(
      cmd.expectedSettingsVersion === settings.version,
      "Os nomes dos atributos foram alterados. Revê as definições antes de guardar o cartão.",
      409,
    );
    ensure(
      state.players.some(
        (p) =>
          p._id === cmd.playerId &&
          p.status !== "removed" &&
          !p.awaitingApproval &&
          !p.registrationRejectedAt,
      ),
      "Jogador sem acesso ao cartão.",
      403,
    );
    state.gamificationProfiles ??= [];
    const existing = state.gamificationProfiles.find(
      (p) => p.playerId === cmd.playerId,
    );
    ensure(
      (existing?.version ?? 0) === cmd.expectedVersion,
      "Este cartão foi alterado por outro administrador. O rascunho foi mantido.",
      409,
    );
    previous = existing ?? null;
    version = (existing?.version ?? 0) + 1;
    const updated = {
      _id: existing?._id ?? randomUUID(),
      playerId: cmd.playerId,
      version,
      nickname: cmd.nickname,
      slogan: cmd.slogan ?? existing?.slogan ?? "",
      signature: cmd.signature ?? existing?.signature ?? [],
      avatar: cmd.avatar,
      social: cmd.social,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      updatedBy: actor.userId,
    };
    next = updated;
    state.gamificationProfiles = [
      ...state.gamificationProfiles.filter((p) => p.playerId !== cmd.playerId),
      updated,
    ];
  }
  state.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify({ before: previous, after: next }),
    createdAt: now,
  });
  return { version };
}
