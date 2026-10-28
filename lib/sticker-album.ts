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
  const available = new Set(roster(state).map((p) => p._id));
  const collected = new Set(
    packs.flatMap((p) => p.stickerPlayerIds).filter((id) => available.has(id)),
  ).size;
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
): StickerAlbumView {
  assertAdmin(actor);
  const season = state.seasons.find((s) => s.status === "active") ?? null;
  const ownPacks = (state.stickerPacks ?? []).filter(
    (p) => p.userId === actor.userId && p.seasonId === season?._id,
  );
  const counts = new Map<string, number>();
  for (const id of ownPacks.flatMap((p) => p.stickerPlayerIds))
    counts.set(id, (counts.get(id) ?? 0) + 1);
  const settings = season ? stickerSettings(state, season._id) : null;
  return {
    preview: true,
    season: season ? { _id: season._id, name: season.name } : null,
    settings,
    day: stickerDay(timestamp),
    remainingPacks: settings?.enabled
      ? Math.max(
          0,
          settings.dailyPacks -
            ownPacks.filter((p) => p.day === stickerDay(timestamp)).length,
        )
      : 0,
    roster: roster(state).map((p) => {
      const d = state.divisions.find((d) => d._id === p.divisionId)!;
      return {
        playerId: p._id,
        name: p.name,
        photo: p.photo,
        division: d.name,
        divisionCode: d.code,
        count: counts.get(p._id) ?? 0,
      };
    }),
    ownPacks,
    ownRewards: (state.stickerRewards ?? []).filter(
      (r) => r.userId === actor.userId,
    ),
    redemptions: [...(state.stickerRewards ?? [])],
    progress: season
      ? progress(state, actor.userId, actor.playerId, season._id)
      : { visits: 0, matches: 0, collection: 0, collected: 0, total: 0 },
  };
}
/** Must be invoked within the shared MongoDB transaction. Never publishes or changes competition data. */
export function executeStickerAlbum(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  assertAdmin(actor);
  const cmd = schema.parse(raw);
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
      (state.stickerPacks ?? [])
        .filter(
          (p) => p.userId === reward.userId && p.seasonId === reward.seasonId,
        )
        .flatMap((p) => p.stickerPlayerIds),
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
      ...cmd,
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
    audit(state, actor, cmd.type, { before: settings, after: saved }, now);
    return { version: saved.version };
  }
  const p = state.players.find(
    (p) => p._id === actor.playerId && p.userId === actor.userId,
  );
  ensure(
    p && roster(state).some((entry) => entry._id === p._id),
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
    const candidates = roster(state);
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
        () => candidates[randomInt(candidates.length)]._id,
      ),
      createdAt: now,
    };
    (state.stickerPacks ??= []).push(pack);
    audit(
      state,
      actor,
      cmd.type,
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
      ? { requiredRosterIds: roster(state).map((p) => p._id) }
      : {}),
  };
  (state.stickerRewards ??= []).push(reward);
  audit(
    state,
    actor,
    cmd.type,
    { rewardId: reward._id, campaignId: reward.campaignId },
    now,
  );
  return { reward };
}
