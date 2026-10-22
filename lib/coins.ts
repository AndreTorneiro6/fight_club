import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "./rules";
import type { Actor, Challenge, State } from "./types";
import { coinBalance, defaultCoinSettings, type CoinEntry } from "./coin-types";

const reward = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
    cost: z.number().int().min(1).max(1000000),
    active: z.boolean(),
  })
  .strict();
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("admin.coins.settings"),
      expectedVersion: z.number().int().min(0),
      enabled: z.boolean(),
      name: z.string().trim().min(1).max(60),
      bookingCoins: z.number().int().min(0).max(1000000),
      rewards: z
        .array(reward)
        .max(50)
        .refine(
          (r) => new Set(r.map((x) => x.id)).size === r.length,
          "Recompensas duplicadas.",
        ),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.coins.adjust"),
      playerId: z.string().min(1),
      amount: z
        .number()
        .int()
        .min(-1000000)
        .max(1000000)
        .refine((n) => n !== 0),
      reason: z.string().trim().min(3).max(500),
      expectedBalance: z.number().int(),
      requestId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.coins.redeem"),
      playerId: z.string().min(1),
      rewardId: z.string().uuid(),
      expectedVersion: z.number().int().min(0),
      expectedBalance: z.number().int(),
      requestId: z.string().uuid(),
    })
    .strict(),
]);
export function executeCoins(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "As moedas estão em teste privado para administradores.",
    403,
  );
  const cmd = schema.parse(raw),
    settings = s.coinSettings?.[0] ?? defaultCoinSettings;
  const now = new Date(timestamp).toISOString();
  if (cmd.type === "admin.coins.settings") {
    ensure(
      settings.version === cmd.expectedVersion,
      "A configuração mudou. Atualiza antes de guardar.",
      409,
    );
    const { type: _, expectedVersion: __, ...values } = cmd;
    s.coinSettings = [
      {
        ...values,
        _id: "coins",
        version: settings.version + 1,
        updatedAt: now,
        updatedBy: actor.userId,
      },
    ];
    s.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      details: JSON.stringify({ before: settings, after: s.coinSettings[0] }),
      createdAt: now,
    });
    return { version: settings.version + 1 };
  }
  s.coinEntries ??= [];
  const fingerprint = JSON.stringify(cmd);
  const existing = s.coinEntries.find((e) => e.requestId === cmd.requestId);
  if (existing) {
    ensure(
      existing.fingerprint === fingerprint,
      "Este pedido já foi usado com outros valores.",
      409,
    );
    return { _id: existing._id };
  }
  ensure(settings.enabled, "Ativa o teste das moedas na configuração.");
  ensure(
    s.players.some(
      (p) =>
        p._id === cmd.playerId &&
        p.status !== "removed" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    ),
    "Jogador indisponível.",
  );
  const balance = coinBalance(s.coinEntries, cmd.playerId);
  ensure(
    balance === cmd.expectedBalance,
    "O saldo mudou. Revê os movimentos antes de continuar.",
    409,
  );
  let amount: number, reason: string, snapshot: CoinEntry["reward"];
  if (cmd.type === "admin.coins.redeem") {
    ensure(
      settings.version === cmd.expectedVersion,
      "O catálogo mudou. Revê o preço antes de trocar.",
      409,
    );
    const item = settings.rewards.find(
      (r) => r.id === cmd.rewardId && r.active,
    );
    ensure(item, "Recompensa indisponível.");
    snapshot = { id: item.id, title: item.title, cost: item.cost };
    amount = -item.cost;
    reason = `Troca no clube: ${item.title}`;
  } else {
    amount = cmd.amount;
    reason = cmd.reason;
  }
  ensure(amount > 0 || balance + amount >= 0, "Saldo insuficiente.");
  const entry: CoinEntry = {
    _id: randomUUID(),
    playerId: cmd.playerId,
    amount,
    kind: cmd.type === "admin.coins.redeem" ? "REDEMPTION" : "ADJUSTMENT",
    reason,
    reward: snapshot,
    requestId: cmd.requestId,
    fingerprint,
    createdAt: now,
    createdBy: actor.userId,
  };
  s.coinEntries.push(entry);
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: cmd.type,
    details: JSON.stringify(entry),
    createdAt: now,
  });
  return { _id: entry._id };
}
const booked = (s: State, c: Challenge) =>
  !!c.scheduledAt &&
  (["scheduled", "result_pending", "disputed", "completed"].includes(
    c.status,
  ) ||
    (c.status === "schedule_pending" &&
      c.scheduleProposal?.previousStatus === "scheduled")) &&
  s.matches.some((m) => m.challengeId === c._id);
const members = (c: Challenge) => [
  ...new Set([
    ...(c.challengerTeam?.map((p) => p.playerId) ?? [c.challengerId]),
    ...(c.defenderTeam?.map((p) => p.playerId) ?? [c.defenderId]),
  ]),
];
/** Runs inside the shared MongoDB transaction, including worker cancellations. No historical backfill. */
export function reconcileCoins(
  s: State,
  before: State,
  timestamp = Date.now(),
) {
  const settings = s.coinSettings?.[0] ?? defaultCoinSettings;
  const entries = (s.coinEntries ??= []);
  const now = new Date(timestamp).toISOString();
  const append = (
    entry: Omit<CoinEntry, "_id" | "createdAt" | "createdBy">,
  ) => {
    const value = {
      ...entry,
      _id: randomUUID(),
      createdAt: now,
      createdBy: "__system__",
    };
    entries.push(value);
    s.audit.push({
      _id: randomUUID(),
      userId: "__system__",
      action: "admin.coins.booking",
      details: JSON.stringify(value),
      createdAt: now,
    });
  };
  // Existing awards retain their original amount and participant snapshot, even after settings change.
  const sources = new Set(
    entries.filter((e) => e.kind === "BOOKING").map((e) => e.sourceId!),
  );
  for (const sourceId of sources) {
    const c = s.challenges.find((c) => c._id === sourceId);
    const active = !!c && booked(s, c);
    const originals = new Map(
      entries
        .filter((e) => e.sourceId === sourceId && e.kind === "BOOKING")
        .map((e) => [e.playerId, e]),
    );
    for (const [playerId, original] of originals) {
      const net = entries
        .filter((e) => e.sourceId === sourceId && e.playerId === playerId)
        .reduce((n, e) => n + e.amount, 0);
      const target = active ? original.amount : 0;
      if (net !== target)
        append({
          playerId,
          sourceId,
          amount: target - net,
          kind: target ? "BOOKING" : "REVERSAL",
          reason: target
            ? "Reposição da marcação original"
            : "Anulação das moedas da marcação cancelada",
        });
    }
  }
  if (
    !settings.enabled ||
    !before.coinSettings?.[0]?.enabled ||
    settings.bookingCoins === 0
  )
    return;
  for (const c of s.challenges) {
    const old = before.challenges.find((x) => x._id === c._id);
    if (
      sources.has(c._id) ||
      !booked(s, c) ||
      (old && booked(before, old)) ||
      c.status === "completed"
    )
      continue;
    for (const playerId of members(c)) {
      if (
        !s.players.some(
          (p) =>
            p._id === playerId &&
            p.status !== "removed" &&
            !p.awaitingApproval &&
            !p.registrationRejectedAt,
        )
      )
        continue;
      append({
        playerId,
        sourceId: c._id,
        amount: settings.bookingCoins,
        kind: "BOOKING",
        reason: `Jogo #${c.number} marcado pela app`,
      });
    }
  }
}
