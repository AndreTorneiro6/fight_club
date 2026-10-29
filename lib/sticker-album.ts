import {
  awardStickerPack,
  catalogCards,
  migrateStickerInventory,
  stickerCounts,
} from "./sticker-inventory";
import {
  executeStickerTrading,
  projectedStickerState,
  requireStickerAccess,
  stickerCollector,
  stickerTradingCommands,
  stickerTradingView,
} from "./sticker-trading";
import { normalizePlayerAttributes } from "./padel-attributes";
import { randomInt, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, State } from "./types";
import type {
  StickerSettings,
  StickerRewardMetric,
  StickerAlbumView,
} from "./sticker-types";
import { ensure } from "./rules";

export function stickerDay(timestamp = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const get = (key: string) => parts.find((part) => part.type === key)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
const metric = z.enum(["visits", "matches", "collection"]);
const schema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("admin.stickers.settings"),
      seasonId: z.string().min(1),
      expectedVersion: z.number().int().min(0),
      enabled: z.boolean(),
      communityEnabled: z.boolean().optional(),
      tradesEnabled: z.boolean().optional(),
      maxTradeCopies: z.number().int().min(1).max(100).optional(),
      maxPendingTrades: z.number().int().min(1).max(50).optional(),
      tradeHours: z.number().int().min(1).max(168).optional(),
      dailyPacks: z.number().int().min(1).max(5),
      packSize: z.number().int().min(1).max(10),
      rewardEnabled: z.boolean(),
      rewardTitle: z.string().trim().max(120),
      rewardMetric: metric,
      rewardTarget: z.number().int().min(1).max(10000),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.stickers.open"),
      seasonId: z.string().min(1),
      requestId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.stickers.claim"),
      seasonId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("admin.stickers.redeem"),
      rewardId: z.string().min(1),
      code: z.string().min(1).max(100),
      expectedVersion: z.number().int().min(1),
    })
    .strict(),
]);
function assertAdmin(actor: Actor) {
  ensure(
    actor.role === "admin",
    "A caderneta está em teste privado e só está disponível no espaço de administrador.",
    403,
  );
}
function roster(state: State) {
  return state.players.filter(
    (p) =>
      !p.spectator &&
      p.status !== "removed" &&
      !p.awaitingApproval &&
      !p.registrationRejectedAt &&
      state.divisions.some((d) => d._id === p.divisionId),
  );
}
export function stickerSettings(
  state: State,
  seasonId: string,
): StickerSettings {
  return (
    state.stickerSettings?.find((s) => s.seasonId === seasonId) ?? {
      _id: seasonId,
      seasonId,
      version: 0,
      enabled: false,
      communityEnabled: false,
      tradesEnabled: false,
      maxTradeCopies: 10,
      maxPendingTrades: 5,
      tradeHours: 72,
      dailyPacks: 1,
      packSize: 3,
      rewardEnabled: false,
      rewardTitle: "",
      rewardMetric: "visits",
      rewardTarget: 7,
      campaignId: "",
      updatedAt: "",
      updatedBy: "",
    }
  );
}
function progress(
  state: State,
  userId: string,
  playerId: string,
  seasonId: string,
) {
  const packs = (state.stickerPacks ?? []).filter(
    (p) => p.userId === userId && p.seasonId === seasonId,
  );
  const available = new Set(
    catalogCards(state, seasonId).map((card) => card.playerId),
  );
  const counts = stickerCounts(state, seasonId, userId);
  const collected = [...available].filter(
    (id) => (counts.get(id) ?? 0) > 0,
  ).length;
  const matches = new Set(
    state.results
      .filter(
        (r) =>
          r.seasonId === seasonId && Number.isFinite(Date.parse(r.confirmedAt)),
      )
      .filter((r) => {
        const c = state.challenges.find(
          (c) =>
            c._id === r.challengeId &&
            c.seasonId === seasonId &&
            c.status === "completed",
        );
        if (
          !c ||
          c.refusalReason ||
          /falta de comparência|recusa|forfeit|walkover|w\/o|autom[aá]tic/i.test(
            r.score,
          )
        )
          return false;
        const side = (
          main: string,
          snapshot: { playerId: string }[] | undefined,
        ) =>
          snapshot?.length
            ? snapshot.some((p) => p.playerId === playerId)
            : main === playerId;
        return (
          side(c.challengerId, c.challengerTeam) ||
          side(c.defenderId, c.defenderTeam)
        );
      })
      .map((r) => r.challengeId),
  ).size;
  return {
    visits: new Set(packs.map((p) => p.day)).size,
    matches,
    collection: available.size
      ? Math.floor((100 * collected) / available.size)
      : 0,
    collected,
    total: available.size,
  };
}
function audit(
  state: State,
  actor: Actor,
  action: string,
  details: unknown,
  now: string,
) {
  state.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action,
    details: JSON.stringify(details),
    createdAt: now,
  });
}
export function stickerAlbumView(
  state: State,
  actor: Actor,
  timestamp = Date.now(),
  options: {
    seasonId?: string;
    tradeId?: string;
    beforeMessageId?: string;
    messageId?: string;
  } = {},
): StickerAlbumView {
  if (options.tradeId) {
    const trade = state.stickerTrades?.find(
      (t) =>
        t._id === options.tradeId &&
        [t.initiatorUserId, t.recipientUserId].includes(actor.userId),
    );
    ensure(trade, "Negociação não encontrada.", 404);
    ensure(
      !options.seasonId || options.seasonId === trade.seasonId,
      "A negociação pertence a outra época.",
      400,
    );
    options = { ...options, seasonId: trade.seasonId };
  }
  const mine = new Set(
    (state.stickerPacks ?? [])
      .filter((p) => p.userId === actor.userId)
      .map((p) => p.seasonId),
  );
  for (const trade of state.stickerTrades ?? [])
    if ([trade.initiatorUserId, trade.recipientUserId].includes(actor.userId))
      mine.add(trade.seasonId);
  const season = options.seasonId
    ? state.seasons.find((s) => s._id === options.seasonId)
    : (state.seasons.find(
        (season) =>
          season.status === "active" &&
          (actor.role === "admin" ||
            state.stickerSettings?.some(
              (cfg) => cfg.seasonId === season._id && cfg.communityEnabled,
            )),
      ) ??
      [...state.seasons]
        .reverse()
        .find(
          (season) =>
            mine.has(season._id) &&
            (actor.role === "admin" ||
              state.stickerSettings?.some(
                (cfg) => cfg.seasonId === season._id && cfg.communityEnabled,
              )),
        ) ??
      state.seasons.find((season) => season.status === "active"));
  if (options.seasonId) ensure(season, "Época não encontrada.", 404);
  if (actor.role !== "admin")
    requireStickerAccess(state, actor, season?._id ?? "");
  const projected = projectedStickerState(state, timestamp);
  const ownPacks = (state.stickerPacks ?? []).filter(
    (p) => p.userId === actor.userId && p.seasonId === season?._id,
  );
  const counts = season
    ? stickerCounts(state, season._id, actor.userId)
    : new Map<string, number>();
  const settings = season ? stickerSettings(state, season._id) : null;
  const cards = season
    ? catalogCards(state, season._id)
    : roster(state).map((p) => {
        const d = state.divisions.find((d) => d._id === p.divisionId)!;
        const saved = state.playerAttributes?.find((a) => a.playerId === p._id),
          normalized = saved ? normalizePlayerAttributes(saved) : undefined;
        return {
          playerId: p._id,
          name: p.name,
          photo: p.photo,
          division: d.name,
          divisionCode: d.code,
          ...(normalized
            ? {
                assessment: {
                  overall: normalized.overall,
                  attributes: normalized.attributes,
                },
              }
            : {}),
        };
      });
  return {
    preview: !settings?.communityEnabled,
    isAdmin: actor.role === "admin",
    currentPlayerId: actor.playerId,
    season: season
      ? {
          _id: season._id,
          name: season.name,
          active: season.status === "active",
        }
      : null,
    seasons: state.seasons
      .filter(
        (s) =>
          actor.role === "admin" ||
          ((mine.has(s._id) || s.status === "active") &&
            state.stickerSettings?.some(
              (cfg) => cfg.seasonId === s._id && cfg.communityEnabled,
            )),
      )
      .map((s) => ({ id: s._id, name: s.name, active: s.status === "active" })),
    settings:
      settings && actor.role !== "admin"
        ? { ...settings, updatedBy: "" }
        : settings,
    day: stickerDay(timestamp),
    remainingPacks:
      settings?.enabled && season?.status === "active"
        ? Math.max(
            0,
            settings.dailyPacks -
              ownPacks.filter((p) => p.day === stickerDay(timestamp)).length,
          )
        : 0,
    roster: cards.map((card) => {
      const count = counts.get(card.playerId) ?? 0;
      const reserved =
        projected.stickerInventories?.find(
          (row) =>
            row.seasonId === season?._id &&
            row.userId === actor.userId &&
            row.stickerPlayerId === card.playerId,
        )?.reserved ?? 0;
      return {
        ...card,
        count,
        reserved,
        availableDuplicates: Math.max(0, count - 1 - reserved),
      };
    }),
    ownPacks,
    ownRewards: (state.stickerRewards ?? []).filter(
      (r) => r.userId === actor.userId,
    ),
    redemptions:
      actor.role === "admin" ? [...(state.stickerRewards ?? [])] : [],
    progress: season
      ? progress(state, actor.userId, actor.playerId, season._id)
      : { visits: 0, matches: 0, collection: 0, collected: 0, total: 0 },
    ...(season
      ? { trading: stickerTradingView(projected, actor, season._id, options) }
      : {}),
  };
}
/** Must be invoked within the shared MongoDB transaction. Never publishes or changes competition data. */
export function executeStickerAlbum(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  const requestedType =
    raw && typeof raw === "object" && "type" in raw ? String(raw.type) : "";
  if (stickerTradingCommands.has(requestedType as never))
    return executeStickerTrading(state, actor, raw, timestamp);
  const publicAction =
    requestedType === "stickers.open" || requestedType === "stickers.claim";
  if (!publicAction) assertAdmin(actor);
  const cmd = schema.parse(
    publicAction
      ? {
          ...(raw as Record<string, unknown>),
          type: requestedType.replace(/^stickers\./, "admin.stickers."),
        }
      : raw,
  );
  if (publicAction && "seasonId" in cmd)
    requireStickerAccess(state, actor, cmd.seasonId);
  const now = new Date(timestamp).toISOString();
  if (cmd.type === "admin.stickers.redeem") {
    const reward = state.stickerRewards?.find((r) => r._id === cmd.rewardId);
    ensure(
      reward && reward.code === cmd.code.trim().toUpperCase(),
      "Vale ou código não encontrado.",
      404,
    );
    ensure(
      reward.version === cmd.expectedVersion && reward.status === "AVAILABLE",
      "Este vale já foi utilizado ou alterado. Atualiza a página.",
      409,
    );
    const current = progress(
      state,
      reward.userId,
      reward.playerId,
      reward.seasonId,
    );
    const rosterIds = reward.requiredRosterIds;
    const owned = new Set(
      [...stickerCounts(state, reward.seasonId, reward.userId)]
        .filter(([, count]) => count > 0)
        .map(([id]) => id),
    );
    const rewardProgress =
      reward.metric === "collection" && rosterIds?.length
        ? Math.floor(
            (100 * rosterIds.filter((id) => owned.has(id)).length) /
              rosterIds.length,
          )
        : current[reward.metric];
    ensure(
      rewardProgress >= reward.target,
      "O progresso foi corrigido e já não cumpre o objetivo deste vale. Revê a origem antes de o validar.",
      409,
    );
    reward.status = "REDEEMED";
    reward.version++;
    reward.redeemedAt = now;
    reward.redeemedBy = actor.userId;
    audit(
      state,
      actor,
      cmd.type,
      { rewardId: reward._id, ownerId: reward.userId },
      now,
    );
    return { rewardId: reward._id, version: reward.version };
  }
  const season = state.seasons.find((s) => s._id === cmd.seasonId);
  ensure(
    season?.status === "active",
    "É necessária uma época ativa para testar a caderneta.",
    409,
  );
  const settings = stickerSettings(state, season._id);
  if (cmd.type === "admin.stickers.settings") {
    ensure(
      settings.version === cmd.expectedVersion,
      "Outro administrador alterou a configuração. Atualiza antes de guardar.",
      409,
    );
    ensure(
      cmd.rewardMetric !== "collection" || cmd.rewardTarget <= 100,
      "O objetivo da coleção não pode ultrapassar 100%.",
    );
    ensure(
      !cmd.rewardEnabled || cmd.rewardTitle.length > 0,
      "Define o prémio antes de ativar a campanha.",
    );
    const changed =
      settings.rewardTitle !== cmd.rewardTitle ||
      settings.rewardMetric !== cmd.rewardMetric ||
      settings.rewardTarget !== cmd.rewardTarget;
    const updated: StickerSettings = {
      ...settings,
      ...Object.fromEntries(
        Object.entries(cmd).filter(([, value]) => value !== undefined),
      ),
      _id: settings._id,
      version: settings.version + 1,
      campaignId:
        changed || !settings.campaignId ? randomUUID() : settings.campaignId,
      updatedAt: now,
      updatedBy: actor.userId,
    };
    const {
      type: ignored,
      expectedVersion: ignoredVersion,
      ...saved
    } = updated as StickerSettings & {
      type?: string;
      expectedVersion?: number;
    };
    void ignored;
    void ignoredVersion;
    state.stickerSettings = [
      ...(state.stickerSettings ?? []).filter((s) => s.seasonId !== season._id),
      saved,
    ];
    if (saved.communityEnabled)
      migrateStickerInventory(state, season._id, actor.userId, now);
    audit(state, actor, cmd.type, { before: settings, after: saved }, now);
    return { version: saved.version };
  }
  const p = state.players.find(
    (p) => p._id === actor.playerId && p.userId === actor.userId,
  );
  ensure(
    p && stickerCollector(state, actor.userId)?._id === p._id,
    "É necessário um perfil aprovado da liga para colecionar.",
    403,
  );
  if (cmd.type === "admin.stickers.open") {
    const replay = state.stickerPacks?.find(
      (pack) =>
        pack.userId === actor.userId && pack.requestId === cmd.requestId,
    );
    if (replay) {
      ensure(
        replay.seasonId === season._id,
        "Este pedido pertence a outra época.",
        409,
      );
      return { pack: replay };
    }
    ensure(
      settings.enabled,
      "Ativa o teste da caderneta antes de abrir uma saqueta.",
      409,
    );
    const day = stickerDay(timestamp);
    ensure(
      (state.stickerPacks ?? []).filter(
        (pack) =>
          pack.userId === actor.userId &&
          pack.seasonId === season._id &&
          pack.day === day,
      ).length < settings.dailyPacks,
      "Já abriste as saquetas disponíveis hoje. Volta amanhã (hora de Lisboa).",
      409,
    );
    if (publicAction)
      migrateStickerInventory(state, season._id, actor.userId, now);
    const candidates = state.stickerMigrations?.some(
      (m) => m.seasonId === season._id,
    )
      ? catalogCards(state, season._id).map((card) => card.playerId)
      : roster(state).map((p) => p._id);
    ensure(
      candidates.length,
      "Não existem jogadores elegíveis para a coleção.",
      409,
    );
    const pack = {
      _id: randomUUID(),
      seasonId: season._id,
      userId: actor.userId,
      playerId: actor.playerId,
      day,
      requestId: cmd.requestId,
      stickerPlayerIds: Array.from(
        { length: settings.packSize },
        () => candidates[randomInt(candidates.length)],
      ),
      createdAt: now,
    };
    (state.stickerPacks ??= []).push(pack);
    if (state.stickerMigrations?.some((m) => m.seasonId === season._id))
      awardStickerPack(state, pack, now);
    audit(
      state,
      actor,
      publicAction ? requestedType : cmd.type,
      { packId: pack._id, seasonId: season._id },
      now,
    );
    return { pack };
  }
  ensure(
    settings.enabled && settings.rewardEnabled && settings.campaignId,
    "Não existe uma campanha de prémios ativa.",
    409,
  );
  const existing = state.stickerRewards?.find(
    (r) => r.userId === actor.userId && r.campaignId === settings.campaignId,
  );
  if (existing) return { reward: existing };
  ensure(
    progress(state, actor.userId, actor.playerId, season._id)[
      settings.rewardMetric
    ] >= settings.rewardTarget,
    "Ainda não atingiste o objetivo desta campanha.",
    409,
  );
  const reward = {
    _id: randomUUID(),
    seasonId: season._id,
    campaignId: settings.campaignId,
    userId: actor.userId,
    playerId: actor.playerId,
    title: settings.rewardTitle,
    metric: settings.rewardMetric as StickerRewardMetric,
    target: settings.rewardTarget,
    code: randomBytes(8).toString("hex").toUpperCase(),
    status: "AVAILABLE" as const,
    version: 1,
    claimedAt: now,
    ...(settings.rewardMetric === "collection"
      ? {
          requiredRosterIds: catalogCards(state, season._id).map(
            (card) => card.playerId,
          ),
        }
      : {}),
  };
  (state.stickerRewards ??= []).push(reward);
  audit(
    state,
    actor,
    publicAction ? requestedType : cmd.type,
    { rewardId: reward._id, campaignId: reward.campaignId },
    now,
  );
  return { reward };
}
