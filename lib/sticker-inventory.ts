import { normalizePlayerAttributes } from "./padel-attributes";
import type { State } from "./types";
import type {
  StickerCatalogCard,
  StickerInventory,
  StickerTradeItem,
} from "./sticker-trade-types";

export function stickerCatalogRoster(state: State): StickerCatalogCard[] {
  return state.players
    .filter(
      (p) =>
        !p.spectator &&
        p.status !== "removed" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt &&
        state.divisions.some((d) => d._id === p.divisionId),
    )
    .map((p) => {
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
}
export function catalogCards(state: State, seasonId: string) {
  return (
    state.stickerCatalogs?.find((c) => c.seasonId === seasonId)?.cards ??
    stickerCatalogRoster(state)
  );
}
export function ensureStickerCatalog(
  state: State,
  seasonId: string,
  userId: string,
  now: string,
) {
  let catalog = state.stickerCatalogs?.find((c) => c.seasonId === seasonId);
  if (!catalog) {
    const cards = stickerCatalogRoster(state),
      known = new Set(cards.map((c) => c.playerId));
    // Historical pack contents cannot disappear from the migrated collection.
    for (const id of new Set(
      (state.stickerPacks ?? [])
        .filter((p) => p.seasonId === seasonId)
        .flatMap((p) => p.stickerPlayerIds),
    ))
      if (!known.has(id)) {
        const old = state.players.find((p) => p._id === id),
          division = state.divisions.find((d) => d._id === old?.divisionId);
        cards.push({
          playerId: id,
          name: old?.name ?? "Jogador arquivado",
          photo: "",
          division: division?.name ?? "Arquivo",
          divisionCode: division?.code ?? "bronze",
        });
        known.add(id);
      }
    catalog = {
      _id: seasonId,
      seasonId,
      cards,
      createdAt: now,
      createdBy: userId,
    };
    (state.stickerCatalogs ??= []).push(catalog);
  }
  return catalog;
}
export function inventoryRow(
  state: State,
  seasonId: string,
  userId: string,
  stickerPlayerId: string,
  now: string,
): StickerInventory {
  let row = state.stickerInventories?.find(
    (i) =>
      i.seasonId === seasonId &&
      i.userId === userId &&
      i.stickerPlayerId === stickerPlayerId,
  );
  if (!row) {
    row = {
      _id: `${seasonId}:${userId}:${stickerPlayerId}`,
      seasonId,
      userId,
      stickerPlayerId,
      count: 0,
      reserved: 0,
      version: 0,
      updatedAt: now,
    };
    (state.stickerInventories ??= []).push(row);
  }
  return row;
}
export function awardStickerPack(
  state: State,
  pack: NonNullable<State["stickerPacks"]>[number],
  now: string,
  recorded = new Set(
    (state.stickerMovements ?? []).map((movement) => movement._id),
  ),
) {
  const quantities = new Map<string, number>();
  for (const id of pack.stickerPlayerIds)
    quantities.set(id, (quantities.get(id) ?? 0) + 1);
  for (const [id, quantity] of quantities) {
    const movementId = `pack:${pack._id}:${id}`;
    if (recorded.has(movementId)) continue;
    recorded.add(movementId);
    const row = inventoryRow(state, pack.seasonId, pack.userId, id, now);
    row.count += quantity;
    row.version++;
    row.updatedAt = now;
    (state.stickerMovements ??= []).push({
      _id: movementId,
      seasonId: pack.seasonId,
      userId: pack.userId,
      stickerPlayerId: id,
      delta: quantity,
      kind: "pack",
      sourceId: pack._id,
      createdAt: pack.createdAt,
    });
  }
}
/** Re-entrant migration: deterministic movement IDs preserve every old pack exactly once. */
export function migrateStickerInventory(
  state: State,
  seasonId: string,
  userId: string,
  now: string,
) {
  const catalog = ensureStickerCatalog(state, seasonId, userId, now);
  const recorded = new Set(
    (state.stickerMovements ?? []).map((movement) => movement._id),
  );
  for (const pack of state.stickerPacks ?? [])
    if (pack.seasonId === seasonId)
      awardStickerPack(state, pack, now, recorded);
  if (!state.stickerMigrations?.some((m) => m.seasonId === seasonId)) {
    (state.stickerMigrations ??= []).push({
      _id: seasonId,
      seasonId,
      version: 1,
      createdAt: now,
      createdBy: userId,
    });
    state.audit.push({
      _id: `sticker-migration:${seasonId}`,
      userId,
      action: "stickers.inventory.migrate",
      details: JSON.stringify({ seasonId }),
      createdAt: now,
    });
  }
  return catalog;
}
export function stickerCounts(state: State, seasonId: string, userId: string) {
  const counts = new Map<string, number>();
  if (state.stickerMigrations?.some((m) => m.seasonId === seasonId)) {
    for (const row of state.stickerInventories ?? [])
      if (row.seasonId === seasonId && row.userId === userId)
        counts.set(row.stickerPlayerId, row.count);
  } else
    for (const pack of state.stickerPacks ?? [])
      if (pack.seasonId === seasonId && pack.userId === userId)
        for (const id of pack.stickerPlayerIds)
          counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}
export function stickerDuplicates(
  state: State,
  seasonId: string,
  userId: string,
): StickerTradeItem[] {
  const reservations = new Map(
    (state.stickerInventories ?? [])
      .filter((row) => row.seasonId === seasonId && row.userId === userId)
      .map((row) => [row.stickerPlayerId, row.reserved]),
  );
  const counts = stickerCounts(state, seasonId, userId),
    items: StickerTradeItem[] = [];
  for (const [id, count] of counts) {
    const reserved = reservations.get(id) ?? 0;
    const quantity = Math.max(0, count - 1 - reserved);
    if (quantity) items.push({ stickerPlayerId: id, quantity });
  }
  return items.sort((a, b) =>
    a.stickerPlayerId.localeCompare(b.stickerPlayerId),
  );
}
