import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "./rules";
import type { Actor, State } from "./types";
import type {
  StickerTrade,
  StickerTradeItem,
  StickerPreference,
  StickerTradeView,
  StickerTradingView,
} from "./sticker-trade-types";
import {
  catalogCards,
  inventoryRow,
  migrateStickerInventory,
  stickerCounts,
  stickerDuplicates,
} from "./sticker-inventory";

const id = z.string().min(1).max(160),
  version = z.number().int().min(1);
const items = z
  .array(
    z
      .object({
        stickerPlayerId: id,
        quantity: z.number().int().min(1).max(100),
      })
      .strict(),
  )
  .min(1)
  .max(100);
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("stickers.preferences.save"),
      seasonId: id,
      expectedVersion: z.number().int().min(0),
      discoverable: z.boolean(),
      acceptingProposals: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.block"),
      seasonId: id,
      playerId: id,
      blocked: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.mute"),
      tradeId: id,
      muted: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.trade.propose"),
      seasonId: id,
      recipientPlayerId: id,
      requestId: z.string().uuid(),
      offered: items,
      requested: items,
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.trade.counter"),
      tradeId: id,
      expectedVersion: version,
      requestId: z.string().uuid(),
      offered: items,
      requested: items,
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.trade.accept"),
      tradeId: id,
      expectedVersion: version,
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.trade.decline"),
      tradeId: id,
      expectedVersion: version,
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.trade.cancel"),
      tradeId: id,
      expectedVersion: version,
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.chat.send"),
      tradeId: id,
      requestId: z.string().uuid(),
      text: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      type: z.literal("stickers.report"),
      tradeId: id,
      reason: z.string().trim().min(3).max(2000),
    })
    .strict(),
  z
    .object({ type: z.literal("admin.stickers.migrate"), seasonId: id })
    .strict(),
  z
    .object({
      type: z.literal("admin.stickers.trade.cancel"),
      tradeId: id,
      expectedVersion: version,
      reason: z.string().trim().min(3).max(300),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.stickers.report.inspect"),
      reportId: id,
      beforeMessageId: id.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.stickers.report.resolve"),
      reportId: id,
      expectedVersion: version,
      resolution: z.string().trim().min(3).max(1000),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.stickers.ledger"),
      seasonId: id,
      playerId: id,
      beforeMovementId: id.optional(),
    })
    .strict(),
]);
export const stickerTradingCommands = new Set(
  schema.options.map((option) => option.shape.type.value),
);
export function stickerCollector(s: State, userId: string) {
  return s.players.find(
    (p) =>
      p.userId === userId &&
      p.status === "active" &&
      !p.awaitingApproval &&
      !p.registrationRejectedAt,
  );
}
export function requireStickerAccess(s: State, actor: Actor, seasonId: string) {
  if (actor.role === "admin") return;
  const player = stickerCollector(s, actor.userId);
  ensure(
    player && player._id === actor.playerId,
    "É necessário um perfil aprovado e ativo para aceder à caderneta.",
    403,
  );
  ensure(
    s.stickerSettings?.some(
      (settings) => settings.seasonId === seasonId && settings.communityEnabled,
    ),
    "A caderneta está em teste privado e só está disponível no espaço de administrador.",
    403,
  );
}
function collector(s: State, actor: Actor) {
  const p = stickerCollector(s, actor.userId);
  ensure(
    p && p._id === actor.playerId,
    "É necessário um perfil aprovado e ativo para colecionar e negociar.",
    403,
  );
  return p;
}
export function tradingLimits(s: State, seasonId: string) {
  const cfg = s.stickerSettings?.find((c) => c.seasonId === seasonId);
  return {
    enabled:
      !!cfg?.tradesEnabled &&
      s.seasons.some(
        (season) => season._id === seasonId && season.status === "active",
      ),
    maxCopies: cfg?.maxTradeCopies ?? 10,
    maxPending: cfg?.maxPendingTrades ?? 5,
    hours: cfg?.tradeHours ?? 72,
  };
}
export function stickerPreference(
  s: State,
  seasonId: string,
  userId: string,
): StickerPreference {
  return (
    s.stickerPreferences?.find(
      (p) => p.seasonId === seasonId && p.userId === userId,
    ) ?? {
      _id: `${seasonId}:${userId}`,
      seasonId,
      userId,
      version: 0,
      discoverable: false,
      acceptingProposals: true,
      blockedUserIds: [],
      mutedTradeIds: [],
      updatedAt: "",
    }
  );
}
function savePreference(s: State, preference: StickerPreference, now: string) {
  const saved = {
    ...preference,
    version: preference.version + 1,
    updatedAt: now,
  };
  s.stickerPreferences = [
    ...(s.stickerPreferences ?? []).filter((p) => p._id !== saved._id),
    saved,
  ];
  return saved;
}
function log(
  s: State,
  actor: Actor | undefined,
  action: string,
  details: unknown,
  now: string,
) {
  s.audit.push({
    _id: randomUUID(),
    userId: actor?.userId ?? "__system__",
    action,
    details: JSON.stringify(details),
    createdAt: now,
  });
}
function participants(t: StickerTrade) {
  return [t.initiatorUserId, t.recipientUserId];
}
function counterpart(t: StickerTrade, userId: string) {
  return t.initiatorUserId === userId ? t.recipientUserId : t.initiatorUserId;
}
function blocked(s: State, seasonId: string, a: string, b: string) {
  return (
    stickerPreference(s, seasonId, a).blockedUserIds.includes(b) ||
    stickerPreference(s, seasonId, b).blockedUserIds.includes(a)
  );
}
function notice(
  s: State,
  userId: string,
  title: string,
  body: string,
  key: string,
  now: string,
  trade?: StickerTrade,
  messageId?: string,
  reportId?: string,
) {
  const playerId =
    userId === "__admins__"
      ? "__admins__"
      : s.players.find((p) => p.userId === userId)?._id;
  if (!playerId) return;
  const old = s.notifications.find(
    (n) => n.playerId === playerId && n.dedupe === key,
  );
  if (old) {
    if (messageId) {
      old.chatMessageId = messageId;
      old.read = false;
    }
    return;
  }
  s.notifications.push({
    _id: randomUUID(),
    playerId,
    title,
    body,
    read: false,
    createdAt: now,
    dedupe: key,
    kind: "general",
    deliveryChannels: ["push"],
    ...(trade ? { stickerTradeId: trade._id, seasonId: trade.seasonId } : {}),
    ...(messageId ? { chatMessageId: messageId } : {}),
    ...(reportId ? { stickerReportId: reportId } : {}),
  });
}
function tradeNotice(
  s: State,
  t: StickerTrade,
  recipient: string,
  title: string,
  body: string,
  event: string,
  now: string,
) {
  notice(
    s,
    recipient,
    title,
    body,
    `stickers:${t._id}:${event}:${t.version}:${recipient}`,
    now,
    t,
  );
}
function close(
  s: State,
  t: StickerTrade,
  status: Exclude<StickerTrade["status"], "PENDING" | "COMPLETED">,
  reason: string,
  now: string,
  actor?: Actor,
) {
  if (t.status !== "PENDING") return;
  t.status = status;
  t.closedReason = reason;
  t.version++;
  t.updatedAt = now;
  for (const userId of participants(t))
    if (userId !== actor?.userId)
      tradeNotice(
        s,
        t,
        userId,
        status === "EXPIRED"
          ? "Proposta de cromos expirada"
          : "Negociação de cromos terminada",
        "Consulta o histórico da negociação na caderneta.",
        status,
        now,
      );
  log(
    s,
    actor,
    "stickers.trade.closed",
    { tradeId: t._id, status, reason },
    now,
  );
}
/** Rebuild from pending promises, so expiry/cancellation cannot leak or double-release a reservation. */
function rebuildReservations(s: State, now: string) {
  const desired = new Map<string, number>();
  const inventoryIndex = new Map(
    (s.stickerInventories ?? []).map((row) => [
      JSON.stringify([row.seasonId, row.userId, row.stickerPlayerId]),
      row,
    ]),
  );
  for (const t of [...(s.stickerTrades ?? [])]
    .filter((t) => t.status === "PENDING")
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id),
    )) {
    const rows = t.offered.map((item) => ({
      item,
      row: inventoryIndex.get(
        JSON.stringify([t.seasonId, t.proposerUserId, item.stickerPlayerId]),
      ),
    }));
    if (
      rows.some(
        ({ item, row }) =>
          !row || row.count - 1 - (desired.get(row._id) ?? 0) < item.quantity,
      )
    ) {
      close(
        s,
        t,
        "INVALIDATED",
        "Os repetidos prometidos deixaram de estar disponíveis.",
        now,
      );
      continue;
    }
    for (const { item, row } of rows)
      desired.set(row!._id, (desired.get(row!._id) ?? 0) + item.quantity);
  }
  for (const row of s.stickerInventories ?? []) {
    const reserved = desired.get(row._id) ?? 0;
    if (row.reserved !== reserved) {
      row.reserved = reserved;
      row.version++;
      row.updatedAt = now;
    }
  }
}
export function reconcileStickerTrades(s: State, timestamp = Date.now()) {
  const now = new Date(timestamp).toISOString();
  for (const t of s.stickerTrades ?? [])
    if (t.status === "PENDING") {
      if (Date.parse(t.expiresAt) <= timestamp)
        close(s, t, "EXPIRED", "A proposta atingiu o prazo de validade.", now);
      else if (
        !s.seasons.some(
          (season) => season._id === t.seasonId && season.status === "active",
        )
      )
        close(s, t, "INVALIDATED", "A época encerrou.", now);
      else if (participants(t).some((userId) => !stickerCollector(s, userId)))
        close(
          s,
          t,
          "INVALIDATED",
          "Uma das contas deixou de estar ativa e aprovada.",
          now,
        );
      else if (blocked(s, t.seasonId, t.initiatorUserId, t.recipientUserId))
        close(
          s,
          t,
          "CANCELLED",
          "Foram bloqueadas novas negociações entre estas contas.",
          now,
        );
    }
  rebuildReservations(s, now);
}
/** Pure read projection; discarded notifications/audit never leave a GET request. */
export function projectedStickerState(s: State, timestamp = Date.now()): State {
  const copy = {
    ...s,
    stickerTrades: (s.stickerTrades ?? []).map((t) => ({ ...t })),
    stickerInventories: (s.stickerInventories ?? []).map((row) => ({ ...row })),
    notifications: [],
    audit: [],
  };
  reconcileStickerTrades(copy, timestamp);
  return copy;
}
function terms(s: State, seasonId: string, input: StickerTradeItem[]) {
  const totals = new Map<string, number>();
  for (const item of input)
    totals.set(
      item.stickerPlayerId,
      (totals.get(item.stickerPlayerId) ?? 0) + item.quantity,
    );
  const result = [...totals]
    .map(([stickerPlayerId, quantity]) => ({ stickerPlayerId, quantity }))
    .sort((a, b) => a.stickerPlayerId.localeCompare(b.stickerPlayerId));
  const allowed = new Set(catalogCards(s, seasonId).map((c) => c.playerId));
  ensure(
    result.every((item) => allowed.has(item.stickerPlayerId)),
    "A proposta contém um cromo que não pertence a esta época.",
    409,
  );
  ensure(
    result.reduce((sum, item) => sum + item.quantity, 0) <=
      tradingLimits(s, seasonId).maxCopies,
    "A quantidade de cromos ultrapassa o limite por lado.",
    409,
  );
  return result;
}
function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function enough(
  s: State,
  seasonId: string,
  userId: string,
  items: StickerTradeItem[],
  release?: StickerTrade,
) {
  const counts = stickerCounts(s, seasonId, userId);
  return items.every((item) => {
    const row = s.stickerInventories?.find(
      (row) =>
        row.seasonId === seasonId &&
        row.userId === userId &&
        row.stickerPlayerId === item.stickerPlayerId,
    );
    const ownReservation =
      release?.status === "PENDING" && release.proposerUserId === userId
        ? (release.offered.find(
            (old) => old.stickerPlayerId === item.stickerPlayerId,
          )?.quantity ?? 0)
        : 0;
    return (
      (counts.get(item.stickerPlayerId) ?? 0) -
        1 -
        (row?.reserved ?? 0) +
        ownReservation >=
      item.quantity
    );
  });
}
function activeTrading(s: State, seasonId: string) {
  ensure(
    s.seasons.some(
      (season) => season._id === seasonId && season.status === "active",
    ),
    "Esta época já não aceita novas trocas.",
    409,
  );
  ensure(
    tradingLimits(s, seasonId).enabled,
    "As trocas estão pausadas pela administração.",
    409,
  );
}
function ownedTrade(s: State, actor: Actor, tradeId: string) {
  const trade = s.stickerTrades?.find(
    (t) => t._id === tradeId && participants(t).includes(actor.userId),
  );
  ensure(trade, "Negociação não encontrada.", 404);
  return trade;
}
function person(s: State, userId: string) {
  const p = s.players.find((p) => p.userId === userId);
  return {
    playerId: p?._id ?? "",
    name: p?.name ?? "Conta indisponível",
    photo: p?.photo ?? "",
  };
}
export function stickerTradeView(
  s: State,
  t: StickerTrade,
  userId: string,
): StickerTradeView {
  const proposer = t.proposerUserId === userId;
  return {
    id: t._id,
    seasonId: t.seasonId,
    version: t.version,
    status: t.status,
    partner: person(s, counterpart(t, userId)),
    proposerPlayerId: person(s, t.proposerUserId).playerId,
    canRespond: t.status === "PENDING" && !proposer,
    initiatedByMe: t.initiatorUserId === userId,
    offered: t.offered,
    requested: t.requested,
    youGive: proposer ? t.offered : t.requested,
    youReceive: proposer ? t.requested : t.offered,
    expiresAt: t.expiresAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    closedReason: t.closedReason,
    proposals: t.proposals.map((p) => ({
      version: p.version,
      authorPlayerId: person(s, p.authorUserId).playerId,
      offered: p.offered,
      requested: p.requested,
      createdAt: p.createdAt,
    })),
    ...(t.status === "COMPLETED"
      ? {
          receipt: {
            proposalVersion: t.acceptedVersion!,
            acceptedAt: t.acceptedAt!,
            youGave: proposer ? t.offered : t.requested,
            youReceived: proposer ? t.requested : t.offered,
            movementIds: t.movementIds ?? [],
          },
        }
      : {}),
  };
}
function messagePage(
  s: State,
  tradeId: string,
  beforeMessageId?: string,
  messageId?: string,
) {
  const all = (s.stickerTradeMessages ?? [])
    .filter((m) => m.tradeId === tradeId)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id),
    );
  let end = all.length;
  if (beforeMessageId) {
    end = all.findIndex((m) => m._id === beforeMessageId);
    ensure(end >= 0, "Página de mensagens inválida.", 400);
  }
  if (messageId) {
    const index = all.findIndex((message) => message._id === messageId);
    ensure(index >= 0, "Mensagem não encontrada nesta negociação.", 404);
    end = Math.min(all.length, index + 51);
  }
  const start = Math.max(0, end - 100),
    messages = all.slice(start, end).map((m) => ({
      id: m._id,
      authorPlayerId: person(s, m.userId).playerId,
      authorName: person(s, m.userId).name,
      text: m.text,
      createdAt: m.createdAt,
    }));
  return {
    messages,
    hasEarlierMessages: start > 0,
    hasLaterMessages: end < all.length,
    messageCursor: start > 0 ? messages[0]?.id : undefined,
  };
}
export function stickerTradingView(
  s: State,
  actor: Actor,
  seasonId: string,
  options: {
    tradeId?: string;
    beforeMessageId?: string;
    messageId?: string;
  } = {},
): StickerTradingView {
  const preferences = stickerPreference(s, seasonId, actor.userId),
    mine = stickerCounts(s, seasonId, actor.userId),
    ownDuplicates = stickerDuplicates(s, seasonId, actor.userId);
  const community = (s.stickerPreferences ?? [])
    .filter(
      (p) =>
        p.seasonId === seasonId &&
        p.userId !== actor.userId &&
        p.discoverable &&
        p.acceptingProposals &&
        stickerCollector(s, p.userId) &&
        !blocked(s, seasonId, actor.userId, p.userId),
    )
    .map((p) => {
      const theirs = stickerCounts(s, seasonId, p.userId),
        duplicates = stickerDuplicates(s, seasonId, p.userId);
      return {
        ...person(s, p.userId),
        duplicates,
        youNeed: duplicates.filter((item) => !mine.get(item.stickerPlayerId))
          .length,
        theyNeed: ownDuplicates.filter(
          (item) => !theirs.get(item.stickerPlayerId),
        ).length,
      };
    })
    .sort(
      (a, b) =>
        b.youNeed + b.theyNeed - (a.youNeed + a.theyNeed) ||
        a.name.localeCompare(b.name, "pt-PT"),
    );
  const trades = (s.stickerTrades ?? [])
    .filter(
      (t) => t.seasonId === seasonId && participants(t).includes(actor.userId),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => stickerTradeView(s, t, actor.userId));
  const selected = options.tradeId
    ? ownedTrade(s, actor, options.tradeId)
    : undefined;
  const selectedTrade = selected
    ? stickerTradeView(s, selected, actor.userId)
    : null;
  const chat = selected
    ? messagePage(s, selected._id, options.beforeMessageId, options.messageId)
    : { messages: [], hasEarlierMessages: false };
  const partnerDuplicates = selected
    ? stickerDuplicates(s, seasonId, counterpart(selected, actor.userId))
    : [];
  if (
    selected?.status === "PENDING" &&
    selected.proposerUserId !== actor.userId
  )
    for (const item of selected.offered) {
      const existing = partnerDuplicates.find(
        (other) => other.stickerPlayerId === item.stickerPlayerId,
      );
      if (existing) existing.quantity += item.quantity;
      else partnerDuplicates.push({ ...item });
    }
  const collectors = new Map<string, { playerId: string; name: string }>();
  if (actor.role === "admin") {
    for (const p of s.players)
      if (p.userId && !p.awaitingApproval && !p.registrationRejectedAt)
        collectors.set(p.userId, { playerId: p._id, name: p.name });
    for (const pack of s.stickerPacks ?? [])
      if (pack.seasonId === seasonId && !collectors.has(pack.userId))
        collectors.set(pack.userId, {
          playerId: pack.playerId,
          name:
            catalogCards(s, seasonId).find((c) => c.playerId === pack.playerId)
              ?.name ?? "Conta arquivada",
        });
  }
  return {
    partnerDuplicates,
    administrativeCollectors: [...collectors.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-PT"),
    ),
    ownReports: (s.stickerReports ?? [])
      .filter(
        (report) =>
          report.seasonId === seasonId &&
          report.reporterUserId === actor.userId,
      )
      .map((report) => ({
        id: report._id,
        tradeId: report.tradeId,
        status: report.status,
        createdAt: report.createdAt,
      })),
    isAdmin: actor.role === "admin",
    tradeSettings: tradingLimits(s, seasonId),
    preferences: {
      version: preferences.version,
      discoverable: preferences.discoverable,
      acceptingProposals: preferences.acceptingProposals,
      blockedPlayers: preferences.blockedUserIds
        .map((userId) => person(s, userId))
        .map(({ playerId, name }) => ({ playerId, name })),
      mutedTradeIds: preferences.mutedTradeIds,
    },
    community,
    trades,
    selectedTrade,
    ...chat,
    movements: (s.stickerMovements ?? [])
      .filter((m) => m.userId === actor.userId && m.seasonId === seasonId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200)
      .map((m) => ({
        id: m._id,
        stickerPlayerId: m.stickerPlayerId,
        delta: m.delta,
        kind: m.kind,
        sourceId: m.sourceId,
        createdAt: m.createdAt,
      })),
    reports:
      actor.role === "admin"
        ? (s.stickerReports ?? [])
            .filter((r) => r.seasonId === seasonId)
            .map((r) => ({
              id: r._id,
              tradeId: r.tradeId,
              reporterName: person(s, r.reporterUserId).name,
              status: r.status,
              version: r.version,
              createdAt: r.createdAt,
            }))
        : [],
    administrativeTrades:
      actor.role === "admin"
        ? (s.stickerTrades ?? [])
            .filter((t) => t.seasonId === seasonId && t.status === "PENDING")
            .map((t) => ({
              id: t._id,
              version: t.version,
              participants: participants(t).map(
                (userId) => person(s, userId).name,
              ),
              createdAt: t.createdAt,
              expiresAt: t.expiresAt,
            }))
        : [],
  };
}
/** Called inside the existing serialized Mongo transaction; never sends a network delivery here. */
export function executeStickerTrading(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  const cmd = schema.parse(raw),
    now = new Date(timestamp).toISOString();
  if (cmd.type.startsWith("admin."))
    ensure(
      actor.role === "admin",
      "Esta ação exige o espaço Administrador.",
      403,
    );
  if (cmd.type === "admin.stickers.migrate") {
    ensure(
      s.seasons.some((season) => season._id === cmd.seasonId),
      "Época não encontrada.",
      404,
    );
    const catalog = migrateStickerInventory(s, cmd.seasonId, actor.userId, now);
    log(s, actor, cmd.type, { seasonId: cmd.seasonId }, now);
    return { migrated: true, catalogSize: catalog.cards.length };
  }
  if (cmd.type === "admin.stickers.ledger") {
    const target = s.players.find((p) => p._id === cmd.playerId);
    const targetUserId =
      target?.userId ??
      s.stickerPacks?.find(
        (pack) =>
          pack.playerId === cmd.playerId && pack.seasonId === cmd.seasonId,
      )?.userId;
    ensure(targetUserId, "Conta não encontrada.", 404);
    const all = (s.stickerMovements ?? [])
      .filter((m) => m.seasonId === cmd.seasonId && m.userId === targetUserId)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b._id.localeCompare(a._id),
      );
    const start = cmd.beforeMovementId
      ? all.findIndex((m) => m._id === cmd.beforeMovementId) + 1
      : 0;
    ensure(
      !cmd.beforeMovementId || start > 0,
      "Página de movimentos inválida.",
      400,
    );
    log(
      s,
      actor,
      cmd.type,
      {
        seasonId: cmd.seasonId,
        playerId: cmd.playerId,
        beforeMovementId: cmd.beforeMovementId,
      },
      now,
    );
    return {
      movements: all.slice(start, start + 100),
      hasMore: start + 100 < all.length,
    };
  }
  if (
    cmd.type === "admin.stickers.report.inspect" ||
    cmd.type === "admin.stickers.report.resolve"
  ) {
    const report = s.stickerReports?.find((r) => r._id === cmd.reportId);
    ensure(report, "Denúncia não encontrada.", 404);
    if (cmd.type === "admin.stickers.report.resolve") {
      ensure(
        report.status === "OPEN" && report.version === cmd.expectedVersion,
        "A denúncia já foi alterada.",
        409,
      );
      report.status = "RESOLVED";
      report.version++;
      report.resolvedAt = now;
      report.resolvedBy = actor.userId;
      report.resolution = cmd.resolution;
      const reportedTrade = s.stickerTrades?.find(
        (trade) => trade._id === report.tradeId,
      );
      notice(
        s,
        report.reporterUserId,
        "Denúncia de cromos analisada",
        "A tua denúncia foi analisada pela administração.",
        `stickers:report-resolved:${report._id}`,
        now,
        reportedTrade,
      );
      log(s, actor, cmd.type, { reportId: report._id }, now);
      return { resolved: true };
    }
    const trade = s.stickerTrades?.find((t) => t._id === report.tradeId);
    ensure(trade, "Negociação não encontrada.", 404);
    log(
      s,
      actor,
      cmd.type,
      {
        reportId: report._id,
        tradeId: trade._id,
        beforeMessageId: cmd.beforeMessageId,
      },
      now,
    );
    return {
      report: {
        id: report._id,
        reason: report.reason,
        status: report.status,
        version: report.version,
        resolution: report.resolution,
      },
      participants: participants(trade).map((userId) => person(s, userId)),
      trade: stickerTradeView(s, trade, trade.initiatorUserId),
      ...messagePage(s, trade._id, cmd.beforeMessageId),
    };
  }
  if (cmd.type === "admin.stickers.trade.cancel") {
    const trade = s.stickerTrades?.find((t) => t._id === cmd.tradeId);
    ensure(trade, "Negociação não encontrada.", 404);
    ensure(
      trade.status === "PENDING" && trade.version === cmd.expectedVersion,
      "A negociação já foi alterada.",
      409,
    );
    close(s, trade, "CANCELLED", cmd.reason, now, actor);
    rebuildReservations(s, now);
    return { cancelled: true };
  }
  collector(s, actor);
  const seasonId =
    "seasonId" in cmd
      ? cmd.seasonId
      : ownedTrade(s, actor, cmd.tradeId).seasonId;
  requireStickerAccess(s, actor, seasonId);
  if (cmd.type === "stickers.preferences.save") {
    const previous = stickerPreference(s, seasonId, actor.userId);
    ensure(
      previous.version === cmd.expectedVersion,
      "As preferências foram alteradas. Atualiza a caderneta.",
      409,
    );
    const preference = savePreference(
      s,
      {
        ...previous,
        discoverable: cmd.discoverable,
        acceptingProposals: cmd.acceptingProposals,
      },
      now,
    );
    log(
      s,
      actor,
      cmd.type,
      {
        seasonId,
        discoverable: cmd.discoverable,
        acceptingProposals: cmd.acceptingProposals,
      },
      now,
    );
    return { version: preference.version };
  }
  if (cmd.type === "stickers.block") {
    const target = s.players.find((p) => p._id === cmd.playerId);
    ensure(
      target?.userId && target.userId !== actor.userId,
      "Escolhe outra conta.",
      400,
    );
    const previous = stickerPreference(s, seasonId, actor.userId),
      blockedUserIds = previous.blockedUserIds.filter(
        (id) => id !== target.userId,
      );
    if (cmd.blocked) blockedUserIds.push(target.userId);
    savePreference(s, { ...previous, blockedUserIds }, now);
    if (cmd.blocked)
      for (const trade of s.stickerTrades ?? [])
        if (
          trade.seasonId === seasonId &&
          participants(trade).includes(actor.userId) &&
          participants(trade).includes(target.userId)
        )
          close(
            s,
            trade,
            "CANCELLED",
            "Foram bloqueadas novas negociações entre estas contas.",
            now,
            actor,
          );
    rebuildReservations(s, now);
    log(
      s,
      actor,
      cmd.type,
      { seasonId, playerId: target._id, blocked: cmd.blocked },
      now,
    );
    return { blocked: cmd.blocked };
  }
  if (cmd.type === "stickers.trade.propose") {
    activeTrading(s, seasonId);
    reconcileStickerTrades(s, timestamp);
    const target = s.players.find((p) => p._id === cmd.recipientPlayerId);
    ensure(
      target?.userId &&
        target.userId !== actor.userId &&
        stickerCollector(s, target.userId),
      "Escolhe outra conta aprovada e ativa.",
      409,
    );
    const catalog = migrateStickerInventory(s, seasonId, actor.userId, now);
    void catalog;
    const offered = terms(s, seasonId, cmd.offered),
      requested = terms(s, seasonId, cmd.requested),
      hash = fingerprint({
        seasonId,
        recipient: target.userId,
        offered,
        requested,
      });
    const replay = s.stickerTrades?.find(
      (t) =>
        t.initiatorUserId === actor.userId && t.requestId === cmd.requestId,
    );
    if (replay) {
      ensure(
        replay.fingerprint === hash,
        "Este pedido já foi usado com outros cromos.",
        409,
      );
      return { id: replay._id, version: replay.version, replayed: true };
    }
    const mine = stickerPreference(s, seasonId, actor.userId),
      theirs = stickerPreference(s, seasonId, target.userId);
    ensure(
      mine.acceptingProposals &&
        theirs.acceptingProposals &&
        theirs.discoverable &&
        !blocked(s, seasonId, actor.userId, target.userId),
      "Esta conta não está disponível para novas propostas.",
      409,
    );
    ensure(
      (s.stickerTrades ?? []).filter(
        (t) =>
          t.seasonId === seasonId &&
          t.initiatorUserId === actor.userId &&
          t.status === "PENDING",
      ).length < tradingLimits(s, seasonId).maxPending,
      "Atingiste o limite de negociações pendentes iniciadas.",
      409,
    );
    ensure(
      enough(s, seasonId, actor.userId, offered),
      "Só podes oferecer repetidos disponíveis, preservando a última cópia.",
      409,
    );
    ensure(
      enough(s, seasonId, target.userId, requested),
      "Os repetidos pedidos já não estão disponíveis.",
      409,
    );
    const trade: StickerTrade = {
      _id: randomUUID(),
      seasonId,
      initiatorUserId: actor.userId,
      recipientUserId: target.userId,
      requestId: cmd.requestId,
      fingerprint: hash,
      proposerUserId: actor.userId,
      offered,
      requested,
      version: 1,
      proposals: [
        {
          version: 1,
          authorUserId: actor.userId,
          requestId: cmd.requestId,
          fingerprint: hash,
          offered,
          requested,
          createdAt: now,
        },
      ],
      status: "PENDING",
      expiresAt: new Date(
        timestamp + tradingLimits(s, seasonId).hours * 3600000,
      ).toISOString(),
      createdAt: now,
      updatedAt: now,
    };
    (s.stickerTrades ??= []).push(trade);
    rebuildReservations(s, now);
    tradeNotice(
      s,
      trade,
      target.userId,
      "Nova proposta de cromos",
      "Recebeste uma proposta. Revê os cromos que dás e recebes na caderneta.",
      "proposed",
      now,
    );
    log(s, actor, cmd.type, { tradeId: trade._id, seasonId }, now);
    return { id: trade._id, version: trade.version };
  }
  const trade = ownedTrade(s, actor, cmd.tradeId);
  if (cmd.type === "stickers.chat.send") {
    const replay = s.stickerTradeMessages?.find(
      (m) => m.userId === actor.userId && m.requestId === cmd.requestId,
    );
    if (replay) {
      ensure(
        replay.tradeId === trade._id && replay.text === cmd.text,
        "Este pedido já foi usado noutra mensagem.",
        409,
      );
      return { id: replay._id, replayed: true };
    }
  }
  if (cmd.type === "stickers.trade.counter") {
    const replay = trade.proposals.find(
      (p) => p.authorUserId === actor.userId && p.requestId === cmd.requestId,
    );
    if (replay) {
      const aggregate = (list: StickerTradeItem[]) => {
        const totals = new Map<string, number>();
        for (const item of list)
          totals.set(
            item.stickerPlayerId,
            (totals.get(item.stickerPlayerId) ?? 0) + item.quantity,
          );
        return [...totals]
          .map(([stickerPlayerId, quantity]) => ({ stickerPlayerId, quantity }))
          .sort((a, b) => a.stickerPlayerId.localeCompare(b.stickerPlayerId));
      };
      ensure(
        replay.fingerprint ===
          fingerprint({
            offered: aggregate(cmd.offered),
            requested: aggregate(cmd.requested),
          }),
        "Este pedido já foi usado com outros cromos.",
        409,
      );
      return { id: trade._id, version: trade.version, replayed: true };
    }
  }
  if (cmd.type === "stickers.mute") {
    const previous = stickerPreference(s, seasonId, actor.userId),
      mutedTradeIds = previous.mutedTradeIds.filter((id) => id !== trade._id);
    if (cmd.muted) mutedTradeIds.push(trade._id);
    savePreference(s, { ...previous, mutedTradeIds }, now);
    return { muted: cmd.muted };
  }
  if (cmd.type === "stickers.report") {
    const old = s.stickerReports?.find(
      (r) =>
        r.tradeId === trade._id &&
        r.reporterUserId === actor.userId &&
        r.status === "OPEN",
    );
    if (old) return { id: old._id };
    const report = {
      _id: randomUUID(),
      seasonId,
      tradeId: trade._id,
      reporterUserId: actor.userId,
      reason: cmd.reason,
      status: "OPEN" as const,
      version: 1,
      createdAt: now,
    };
    (s.stickerReports ??= []).push(report);
    notice(
      s,
      "__admins__",
      "Denúncia sobre troca de cromos",
      "Foi enviada uma denúncia para análise na caderneta.",
      `stickers:report:${report._id}`,
      now,
      trade,
      undefined,
      report._id,
    );
    log(s, actor, cmd.type, { reportId: report._id, tradeId: trade._id }, now);
    return { id: report._id };
  }
  if (
    cmd.type === "stickers.trade.accept" &&
    trade.status === "COMPLETED" &&
    trade.acceptedVersion === cmd.expectedVersion &&
    trade.acceptedBy === actor.userId
  )
    return {
      completed: true,
      replayed: true,
      receipt: stickerTradeView(s, trade, actor.userId).receipt,
    };
  reconcileStickerTrades(s, timestamp);
  if (trade.status !== "PENDING")
    return {
      unavailable: true,
      status: trade.status,
      reason: trade.closedReason ?? "Esta negociação já terminou.",
    };
  if (cmd.type === "stickers.chat.send") {
    const replay = s.stickerTradeMessages?.find(
      (m) => m.userId === actor.userId && m.requestId === cmd.requestId,
    );
    if (replay) {
      ensure(
        replay.tradeId === trade._id && replay.text === cmd.text,
        "Este pedido já foi usado noutra mensagem.",
        409,
      );
      return { id: replay._id };
    }
    ensure(
      (s.stickerTradeMessages ?? []).filter(
        (m) =>
          m.userId === actor.userId &&
          Date.parse(m.createdAt) > timestamp - 60000,
      ).length < 20,
      "Aguarda um momento antes de enviar mais mensagens.",
      429,
    );
    const message = {
      _id: randomUUID(),
      tradeId: trade._id,
      seasonId,
      userId: actor.userId,
      requestId: cmd.requestId,
      text: cmd.text,
      createdAt: now,
    };
    (s.stickerTradeMessages ??= []).push(message);
    const other = counterpart(trade, actor.userId);
    if (
      !stickerPreference(s, seasonId, other).mutedTradeIds.includes(trade._id)
    )
      notice(
        s,
        other,
        "Mensagem na negociação de cromos",
        "Tens novas mensagens numa negociação da caderneta.",
        `stickers:chat:${trade._id}:${other}:${Math.floor(timestamp / 60000)}`,
        now,
        trade,
        message._id,
      );
    log(
      s,
      actor,
      cmd.type,
      { tradeId: trade._id, messageId: message._id },
      now,
    );
    return { id: message._id };
  }
  ensure(
    trade.version === cmd.expectedVersion,
    "A proposta mudou. Revê a versão atual antes de continuar.",
    409,
  );
  if (
    cmd.type === "stickers.trade.cancel" ||
    cmd.type === "stickers.trade.decline"
  ) {
    if (cmd.type === "stickers.trade.decline")
      ensure(
        trade.proposerUserId !== actor.userId,
        "Não podes recusar a tua própria proposta.",
        403,
      );
    close(
      s,
      trade,
      cmd.type === "stickers.trade.cancel" ? "CANCELLED" : "DECLINED",
      cmd.type === "stickers.trade.cancel"
        ? "Negociação cancelada por um participante."
        : "Proposta recusada pelo destinatário.",
      now,
      actor,
    );
    rebuildReservations(s, now);
    return { closed: true, status: trade.status };
  }
  activeTrading(s, seasonId);
  ensure(
    trade.proposerUserId !== actor.userId,
    "Apenas a outra pessoa pode aceitar ou fazer contraproposta.",
    403,
  );
  if (cmd.type === "stickers.trade.counter") {
    const offered = terms(s, seasonId, cmd.offered),
      requested = terms(s, seasonId, cmd.requested),
      hash = fingerprint({ offered, requested });
    const replay = trade.proposals.find(
      (p) => p.authorUserId === actor.userId && p.requestId === cmd.requestId,
    );
    if (replay) {
      ensure(
        replay.fingerprint === hash,
        "Este pedido já foi usado com outros cromos.",
        409,
      );
      return { id: trade._id, version: trade.version, replayed: true };
    }
    ensure(
      enough(s, seasonId, actor.userId, offered, trade),
      "Não tens esses repetidos disponíveis para reservar.",
      409,
    );
    ensure(
      enough(s, seasonId, counterpart(trade, actor.userId), requested, trade),
      "Os repetidos pedidos já não estão disponíveis.",
      409,
    );
    trade.version++;
    trade.proposerUserId = actor.userId;
    trade.offered = offered;
    trade.requested = requested;
    trade.updatedAt = now;
    trade.expiresAt = new Date(
      timestamp + tradingLimits(s, seasonId).hours * 3600000,
    ).toISOString();
    trade.proposals.push({
      version: trade.version,
      authorUserId: actor.userId,
      requestId: cmd.requestId,
      fingerprint: hash,
      offered,
      requested,
      createdAt: now,
    });
    rebuildReservations(s, now);
    tradeNotice(
      s,
      trade,
      counterpart(trade, actor.userId),
      "Contraproposta de cromos",
      "Os termos mudaram. Revê a nova versão dos cromos que dás e recebes.",
      "counter",
      now,
    );
    log(
      s,
      actor,
      cmd.type,
      { tradeId: trade._id, version: trade.version },
      now,
    );
    return { id: trade._id, version: trade.version };
  }
  // Recheck both complete sides before applying any movement; a missing side invalidates, never partially transfers.
  if (
    !enough(s, seasonId, trade.proposerUserId, trade.offered, trade) ||
    !enough(s, seasonId, actor.userId, trade.requested)
  ) {
    close(
      s,
      trade,
      "INVALIDATED",
      "Os repetidos necessários deixaram de estar disponíveis.",
      now,
    );
    rebuildReservations(s, now);
    return {
      unavailable: true,
      status: trade.status,
      reason: trade.closedReason,
    };
  }
  const movementIds: string[] = [];
  for (const [from, to, terms] of [
    [trade.proposerUserId, actor.userId, trade.offered],
    [actor.userId, trade.proposerUserId, trade.requested],
  ] as const)
    for (const item of terms)
      for (const [userId, delta, other] of [
        [from, -item.quantity, to],
        [to, item.quantity, from],
      ] as const) {
        const movementId = `trade:${trade._id}:${trade.version}:${userId}:${item.stickerPlayerId}:${delta < 0 ? "out" : "in"}`;
        ensure(
          !s.stickerMovements?.some((m) => m._id === movementId),
          "Esta transferência já foi registada.",
          409,
        );
        const row = inventoryRow(
          s,
          seasonId,
          userId,
          item.stickerPlayerId,
          now,
        );
        row.count += delta;
        row.version++;
        row.updatedAt = now;
        (s.stickerMovements ??= []).push({
          _id: movementId,
          seasonId,
          userId,
          stickerPlayerId: item.stickerPlayerId,
          delta,
          kind: "trade",
          sourceId: trade._id,
          proposalVersion: trade.version,
          counterpartUserId: other,
          createdAt: now,
        });
        movementIds.push(movementId);
      }
  trade.acceptedVersion = trade.version;
  trade.acceptedBy = actor.userId;
  trade.acceptedAt = now;
  trade.movementIds = movementIds;
  trade.status = "COMPLETED";
  trade.version++;
  trade.updatedAt = now;
  rebuildReservations(s, now);
  tradeNotice(
    s,
    trade,
    trade.proposerUserId,
    "Troca de cromos concluída",
    "Os cromos foram transferidos em conjunto. O comprovativo está na caderneta.",
    "completed",
    now,
  );
  log(
    s,
    actor,
    cmd.type,
    { tradeId: trade._id, proposalVersion: trade.acceptedVersion, movementIds },
    now,
  );
  return {
    completed: true,
    receipt: stickerTradeView(s, trade, actor.userId).receipt,
  };
}
