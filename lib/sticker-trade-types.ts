import type { PlayerAttributes } from "./padel-attributes";
export interface StickerCatalogCard {
  playerId: string;
  name: string;
  photo: string;
  division: string;
  divisionCode: "ouro" | "prata" | "bronze";
  assessment?: Pick<PlayerAttributes, "overall" | "attributes">;
}
export interface StickerCatalog {
  _id: string;
  seasonId: string;
  cards: StickerCatalogCard[];
  createdAt: string;
  createdBy: string;
}
export interface StickerInventory {
  _id: string;
  seasonId: string;
  userId: string;
  stickerPlayerId: string;
  count: number;
  reserved: number;
  version: number;
  updatedAt: string;
}
export interface StickerMovement {
  _id: string;
  seasonId: string;
  userId: string;
  stickerPlayerId: string;
  delta: number;
  kind: "pack" | "trade";
  sourceId: string;
  proposalVersion?: number;
  counterpartUserId?: string;
  createdAt: string;
}
export interface StickerMigration {
  _id: string;
  seasonId: string;
  version: 1;
  createdAt: string;
  createdBy: string;
}
export interface StickerTradeItem {
  stickerPlayerId: string;
  quantity: number;
}
export type StickerTradeStatus =
  | "PENDING"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED"
  | "EXPIRED"
  | "INVALIDATED";
export interface StickerProposal {
  version: number;
  authorUserId: string;
  requestId: string;
  fingerprint: string;
  offered: StickerTradeItem[];
  requested: StickerTradeItem[];
  createdAt: string;
}
export interface StickerTrade {
  _id: string;
  seasonId: string;
  initiatorUserId: string;
  recipientUserId: string;
  requestId: string;
  fingerprint: string;
  proposerUserId: string;
  offered: StickerTradeItem[];
  requested: StickerTradeItem[];
  version: number;
  proposals: StickerProposal[];
  status: StickerTradeStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  acceptedVersion?: number;
  acceptedBy?: string;
  acceptedAt?: string;
  movementIds?: string[];
  closedReason?: string;
}
export interface StickerTradeMessage {
  _id: string;
  tradeId: string;
  seasonId: string;
  userId: string;
  requestId: string;
  text: string;
  createdAt: string;
}
export interface StickerPreference {
  _id: string;
  seasonId: string;
  userId: string;
  version: number;
  discoverable: boolean;
  acceptingProposals: boolean;
  blockedUserIds: string[];
  mutedTradeIds: string[];
  updatedAt: string;
}
export interface StickerReport {
  _id: string;
  seasonId: string;
  tradeId: string;
  reporterUserId: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  version: number;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}
export interface StickerTradeView {
  id: string;
  seasonId: string;
  version: number;
  status: StickerTradeStatus;
  partner: { playerId: string; name: string; photo: string };
  proposerPlayerId: string;
  canRespond: boolean;
  initiatedByMe: boolean;
  offered: StickerTradeItem[];
  requested: StickerTradeItem[];
  youGive: StickerTradeItem[];
  youReceive: StickerTradeItem[];
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  closedReason?: string;
  proposals: {
    version: number;
    authorPlayerId: string;
    offered: StickerTradeItem[];
    requested: StickerTradeItem[];
    createdAt: string;
  }[];
  receipt?: {
    proposalVersion: number;
    acceptedAt: string;
    youGave: StickerTradeItem[];
    youReceived: StickerTradeItem[];
    movementIds: string[];
  };
}
export interface StickerMessageView {
  id: string;
  authorPlayerId: string;
  authorName: string;
  text: string;
  createdAt: string;
}
export interface StickerCommunityMember {
  playerId: string;
  name: string;
  photo: string;
  duplicates: StickerTradeItem[];
  youNeed: number;
  theyNeed: number;
}
export interface StickerTradingView {
  isAdmin: boolean;
  tradeSettings: {
    enabled: boolean;
    maxCopies: number;
    maxPending: number;
    hours: number;
  };
  preferences: {
    version: number;
    discoverable: boolean;
    acceptingProposals: boolean;
    blockedPlayers: { playerId: string; name: string }[];
    mutedTradeIds: string[];
  };
  community: StickerCommunityMember[];
  trades: StickerTradeView[];
  selectedTrade: StickerTradeView | null;
  messages: StickerMessageView[];
  hasEarlierMessages: boolean;
  hasLaterMessages?: boolean;
  partnerDuplicates: StickerTradeItem[];
  ownReports: {
    id: string;
    tradeId: string;
    status: "OPEN" | "RESOLVED";
    createdAt: string;
  }[];
  administrativeCollectors: { playerId: string; name: string }[];
  messageCursor?: string;
  movements: {
    id: string;
    stickerPlayerId: string;
    delta: number;
    kind: "pack" | "trade";
    sourceId: string;
    createdAt: string;
  }[];
  reports: {
    id: string;
    tradeId: string;
    reporterName: string;
    status: "OPEN" | "RESOLVED";
    version: number;
    createdAt: string;
  }[];
  administrativeTrades: {
    id: string;
    version: number;
    participants: string[];
    createdAt: string;
    expiresAt: string;
  }[];
}
