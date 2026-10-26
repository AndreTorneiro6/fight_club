import type { State, Challenge } from "./types";
export function predictionCutoff(
  state: State,
  challenge: Challenge,
  settings = state.engagementSettings?.[0] ?? { lockMinutes: 0 },
): string | null {
  const match = state.matches.find((m) => m.challengeId === challenge._id);
  const scheduled = match?.start ?? challenge.scheduledAt;
  const start =
    challenge.predictionCutoffAt &&
    (!scheduled || challenge.predictionCutoffAt < scheduled)
      ? challenge.predictionCutoffAt
      : scheduled;
  if (!start || !Number.isFinite(Date.parse(start))) return null;
  return new Date(
    Date.parse(start) - settings.lockMinutes * 60000,
  ).toISOString();
}
