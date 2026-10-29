import type { PlayerAttributes } from "./padel-attributes";
/** Public presentation types. Community access is explicitly enabled per season; private preview is admin-only. */
export type StickerRewardMetric = "visits" | "matches" | "collection";
export interface StickerSettings {
  _id: string;
  seasonId: string;
  version: number;
  enabled: boolean;
  communityEnabled?: boolean;
  tradesEnabled?: boolean;
  maxTradeCopies?: number;
  maxPendingTrades?: number;
  tradeHours?: number;
  dailyPacks: number;
  packSize: number;
  rewardEnabled: boolean;
  rewardTitle: string;
  rewardMetric: StickerRewardMetric;
  rewardTarget: number;
  campaignId: string;
  updatedAt: string;
  updatedBy: string;
}
export interface StickerPack {
  _id: string;
  seasonId: string;
  userId: string;
  playerId: string;
  day: string;
  requestId: string;
  stickerPlayerIds: string[];
  createdAt: string;
}
export interface StickerReward {
  _id: string;
  seasonId: string;
  campaignId: string;
  userId: string;
  playerId: string;
  title: string;
  metric: StickerRewardMetric;
  target: number;
  code: string;
  status: "AVAILABLE" | "REDEEMED";
  version: number;
  claimedAt: string;
  redeemedAt?: string;
  redeemedBy?: string;
  requiredRosterIds?: string[];
}
export interface StickerAlbumView {
  preview: boolean;
  isAdmin?: boolean;
  currentPlayerId?: string;
  seasons?: { id: string; name: string; active: boolean }[];
  trading?: import("./sticker-trade-types").StickerTradingView;
  season: { _id: string; name: string; active?: boolean } | null;
  settings: StickerSettings | null;
  day: string;
  remainingPacks: number;
  roster: {
    playerId: string;
    name: string;
    photo: string;
    division: string;
    divisionCode: string;
    count: number;
    reserved?: number;
    availableDuplicates?: number;
    assessment?: Pick<PlayerAttributes, "overall" | "attributes">;
  }[];
  ownPacks: StickerPack[];
  ownRewards: StickerReward[];
  redemptions: StickerReward[];
  progress: {
    visits: number;
    matches: number;
    collection: number;
    collected: number;
    total: number;
  };
}
