import type { State } from "./types";
import { challengeParticipants } from "./team-competition";
import { coinBalance } from "./coin-types";
export type PhotoUnlockRule = "UNDECIDED" | "MANUAL" | "MATCHES" | "COINS";
export interface ClubPhoto {
  _id: string;
  title: string;
  description: string;
  version: number;
  active: boolean;
  rule: PhotoUnlockRule;
  target: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
export interface ClubPhotoUnlock {
  _id: string;
  photoId: string;
  playerId: string;
  rule: PhotoUnlockRule;
  target: number;
  reason: string;
  unlockedAt: string;
  unlockedBy: string;
}
export function photoUnlockProgress(
  state: State,
  photo: ClubPhoto,
  playerId: string,
) {
  const unlocked =
    state.clubPhotoUnlocks?.some(
      (u) => u.photoId === photo._id && u.playerId === playerId,
    ) ?? false;
  const matches = state.challenges.filter(
    (c) =>
      c.status === "completed" &&
      state.results.some((r) => r.challengeId === c._id) &&
      challengeParticipants(c, state.players).includes(playerId),
  ).length;
  const balance = coinBalance(state.coinEntries ?? [], playerId);
  const eligible =
    photo.active &&
    photo.rule !== "UNDECIDED" &&
    (photo.rule === "MANUAL" ||
      (photo.rule === "MATCHES" && matches >= photo.target) ||
      (photo.rule === "COINS" &&
        !!state.coinSettings?.[0]?.enabled &&
        balance >= photo.target));
  return { unlocked, matches, balance, eligible };
}
