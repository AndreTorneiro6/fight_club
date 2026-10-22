export interface CoinReward {
  id: string;
  title: string;
  cost: number;
  active: boolean;
}
export interface CoinSettings {
  _id: string;
  version: number;
  enabled: boolean;
  name: string;
  bookingCoins: number;
  rewards: CoinReward[];
  updatedAt?: string;
  updatedBy?: string;
}
export interface CoinEntry {
  _id: string;
  playerId: string;
  amount: number;
  kind: "BOOKING" | "REVERSAL" | "ADJUSTMENT" | "REDEMPTION";
  sourceId?: string;
  requestId?: string;
  fingerprint?: string;
  reason: string;
  createdAt: string;
  createdBy: string;
  reward?: { id: string; title: string; cost: number };
}
export const defaultCoinSettings: CoinSettings = {
  _id: "coins",
  version: 0,
  enabled: false,
  name: "Moedas Fight Club",
  bookingCoins: 10,
  rewards: [],
};
export function coinBalance(entries: CoinEntry[], playerId: string) {
  return entries
    .filter((e) => e.playerId === playerId)
    .reduce((n, e) => n + e.amount, 0);
}
