import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, State } from "./types";
import { ensure } from "./rules";

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        !!url.hostname &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Usa um URL HTTPS válido, sem credenciais.");
const schema = z
  .object({
    type: z.literal("admin.sponsors.save"),
    sponsorId: z.string().uuid().optional(),
    expectedVersion: z.number().int().min(0),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000),
    website: httpsUrl,
    logo: httpsUrl,
    label: z.string().trim().max(60),
    order: z.number().int().min(0).max(10000),
    published: z.boolean(),
  })
  .strict();
export function executeSponsors(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem gerir patrocinadores.",
    403,
  );
  const cmd = schema.parse(raw);
  const existing = s.sponsors?.find((p) => p._id === cmd.sponsorId);
  if (cmd.sponsorId) ensure(existing, "Patrocinador não encontrado.", 404);
  ensure(
    (existing?.version ?? 0) === cmd.expectedVersion,
    "Este patrocinador foi alterado por outro administrador. O teu rascunho foi preservado; consulta a versão atual.",
    409,
  );
  ensure(
    existing || (s.sponsors?.length ?? 0) < 100,
    "Limite de 100 patrocinadores atingido.",
  );
  const now = new Date(timestamp).toISOString();
  const { type: _, sponsorId: __, expectedVersion: ___, ...fields } = cmd;
  const sponsor = {
    ...fields,
    _id: existing?._id ?? randomUUID(),
    version: (existing?.version ?? 0) + 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedBy: actor.userId,
  };
  s.sponsors = [
    ...(s.sponsors ?? []).filter((p) => p._id !== sponsor._id),
    sponsor,
  ];
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify({ before: existing ?? null, after: sponsor }),
    createdAt: now,
  });
  return { _id: sponsor._id, version: sponsor.version };
}
