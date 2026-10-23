export interface PlacementTeam {
  id: string;
  name: string;
  members: { playerId: string; name: string; position: number }[];
}
export interface PlacementGame {
  id: string;
  teamA: string;
  teamB: string;
  setsA: number;
  setsB: number;
  pointsA: number;
  pointsB: number;
  setScores?: { a: number; b: number }[];
}
export interface PlacementRules {
  pointsMode: "TOTAL_POINTS" | "CLASSIFICATION_POINTS";
  winPoints: number;
  lossPoints: number;
}
export interface PlacementEvent {
  _id: string;
  name: string;
  seasonId: string;
  divisionId: string;
  date: string;
  version: number;
  status: "DRAFT" | "APPLIED";
  rules: PlacementRules;
  teams: PlacementTeam[];
  games: PlacementGame[];
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  appliedBy?: string;
  appliedOrder?: string[];
  appliedEventIds?: string[];
}
export const defaultPlacementRules: PlacementRules = {
  pointsMode: "TOTAL_POINTS",
  winPoints: 3,
  lossPoints: 0,
};
