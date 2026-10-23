import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { State, Actor } from "./types";
import type { AdminTestChallenge } from "./admin-test-types";
import { ensure } from "./rules";
const id = z.string().min(1).max(150);
const current = { id, expectedVersion: z.number().int().min(1) };
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("admin.test.create"),
      requestId: z.uuid(),
      defenderId: id,
      note: z.string().trim().max(300),
      channels: z.array(z.enum(["push", "email", "whatsapp"])).max(3),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.test.respond"),
      ...current,
      accept: z.boolean(),
    })
    .strict(),
  z.object({ type: z.literal("admin.test.cancel"), ...current }).strict(),
  z
    .object({
      type: z.literal("admin.test.propose"),
      ...current,
      start: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({ type: z.literal("admin.test.confirmSchedule"), ...current })
    .strict(),
  z
    .object({
      type: z.literal("admin.test.result"),
      ...current,
      winnerId: id,
      score: z.enum(["2-0", "2-1"]),
    })
    .strict(),
  z
    .object({ type: z.literal("admin.test.confirmResult"), ...current })
    .strict(),
]);
export function executeAdminTest(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem participar nos testes.",
    403,
  );
  const cmd = schema.parse(raw),
    now = new Date(timestamp).toISOString();
  const accounts = s.adminTestAccounts ?? [];
  ensure(
    accounts.some((a) => a.playerId === actor.playerId),
    "A conta tem de ser administradora e verificada.",
    403,
  );
  s.adminTestChallenges ??= [];
  let challenge: AdminTestChallenge, description: string;
  const notify = (target: string, title: string, body: string) =>
    s.notifications.push({
      _id: randomUUID(),
      playerId: target,
      title: `TESTE · ${title}`,
      body,
      read: false,
      createdAt: now,
      adminTestId: challenge._id,
      testChannels: challenge.channels,
    });
  if (cmd.type === "admin.test.create") {
    ensure(
      cmd.defenderId !== actor.playerId &&
        accounts.some((a) => a.playerId === cmd.defenderId),
      "Escolhe outro administrador verificado.",
      403,
    );
    const existing = s.adminTestChallenges.find(
      (c) => c.requestId === cmd.requestId && c.attackerId === actor.playerId,
    );
    if (existing) {
      ensure(
        existing.defenderId === cmd.defenderId &&
          existing.note === cmd.note &&
          JSON.stringify(existing.channels) ===
            JSON.stringify([...new Set(cmd.channels)]),
        "O pedido já foi usado com outros dados.",
        409,
      );
      return { id: existing._id };
    }
    ensure(
      s.adminTestChallenges.filter(
        (c) =>
          [c.attackerId, c.defenderId].includes(actor.playerId) &&
          !["CANCELLED", "COMPLETED", "DECLINED"].includes(c.status),
      ).length < 10,
      "Conclui ou cancela os testes anteriores.",
    );
    challenge = {
      _id: randomUUID(),
      requestId: cmd.requestId,
      attackerId: actor.playerId,
      defenderId: cmd.defenderId,
      note: cmd.note,
      channels: [...new Set(cmd.channels)],
      status: "PENDING",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    s.adminTestChallenges.push(challenge);
    description = "Desafio de teste enviado";
    notify(
      cmd.defenderId,
      description,
      `${accounts.find((a) => a.playerId === actor.playerId)!.name} enviou-te um desafio de teste. ${cmd.note}`,
    );
  } else {
    const found = s.adminTestChallenges.find((c) => c._id === cmd.id);
    ensure(found, "Teste não encontrado.", 404);
    challenge = found;
    ensure(
      [challenge.attackerId, challenge.defenderId].includes(actor.playerId),
      "Só os participantes podem alterar este teste.",
      403,
    );
    ensure(
      accounts.some((a) => a.playerId === challenge.attackerId) &&
        accounts.some((a) => a.playerId === challenge.defenderId),
      "Um participante já não é administrador.",
      409,
    );
    ensure(
      challenge.version === cmd.expectedVersion,
      "O teste foi alterado. Atualiza antes de responder.",
      409,
    );
    ensure(
      !["COMPLETED", "CANCELLED", "DECLINED"].includes(challenge.status),
      "O teste já terminou.",
      409,
    );
    const other =
      challenge.attackerId === actor.playerId
        ? challenge.defenderId
        : challenge.attackerId;
    if (cmd.type === "admin.test.respond") {
      ensure(
        actor.playerId === challenge.defenderId &&
          challenge.status === "PENDING",
        "Só o destinatário pode responder a um teste pendente.",
        403,
      );
      challenge.status = cmd.accept ? "ACCEPTED" : "DECLINED";
      description = cmd.accept
        ? "Desafio de teste aceite"
        : "Desafio de teste recusado";
    } else if (cmd.type === "admin.test.cancel") {
      challenge.status = "CANCELLED";
      description = "Desafio de teste cancelado";
    } else if (cmd.type === "admin.test.propose") {
      ensure(
        ["ACCEPTED", "SCHEDULE_PROPOSED"].includes(challenge.status),
        "Aceita primeiro o teste.",
      );
      ensure(Date.parse(cmd.start) > timestamp, "Escolhe uma data futura.");
      challenge.start = cmd.start;
      challenge.proposedBy = actor.playerId;
      challenge.status = "SCHEDULE_PROPOSED";
      description = "Horário de teste proposto";
    } else if (cmd.type === "admin.test.confirmSchedule") {
      ensure(
        challenge.status === "SCHEDULE_PROPOSED" &&
          challenge.proposedBy !== actor.playerId,
        "O outro participante tem de confirmar o horário.",
      );
      challenge.status = "SCHEDULED";
      description = "Horário de teste confirmado";
    } else if (cmd.type === "admin.test.result") {
      ensure(
        challenge.status === "SCHEDULED",
        "Confirma primeiro o horário de teste.",
      );
      ensure(
        [challenge.attackerId, challenge.defenderId].includes(cmd.winnerId),
        "Vencedor inválido.",
      );
      challenge.winnerId = cmd.winnerId;
      challenge.score = cmd.score;
      challenge.reportedBy = actor.playerId;
      challenge.status = "RESULT_PENDING";
      description = "Resultado de teste submetido";
    } else {
      ensure(
        challenge.status === "RESULT_PENDING" &&
          challenge.reportedBy !== actor.playerId,
        "O outro participante tem de confirmar o resultado.",
      );
      challenge.status = "COMPLETED";
      description = "Resultado de teste confirmado";
    }
    challenge.version++;
    challenge.updatedAt = now;
    notify(
      other,
      description,
      "Abre o simulador partilhado para consultar e responder. Este teste não altera a competição.",
    );
  }
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify({
      testId: challenge._id,
      status: challenge.status,
      version: challenge.version,
    }),
    createdAt: now,
  });
  return { id: challenge._id };
}
