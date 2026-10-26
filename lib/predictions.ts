import { predictionCutoff } from "./prediction-cutoff";
export { predictionCutoff } from "./prediction-cutoff";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, Challenge, State } from "./types";
import { LeagueError } from "./rules";

export interface EngagementSettings {
  _id: string;
  version: number;
  winnerPoints: number;
  exactScorePoints: number;
  lockMinutes: number;
  ratingWeights: {
    attack: number;
    defense: number;
    wins: number;
    consistency: number;
    form: number;
  };
  updatedAt?: string;
  updatedBy?: string;
}
export interface Prediction {
  _id: string;
  userId: string;
  playerId: string;
  challengeId: string;
  winnerId: string;
  setScore: "2-0" | "2-1";
  createdAt: string;
  updatedAt: string;
  lockAt: string;
  winnerPoints: number;
  exactScorePoints: number;
  points?: number;
  settlement?: "settled" | "void";
  resultFingerprint?: string;
  settledAt?: string;
}
export const defaultEngagementSettings: EngagementSettings = {
  _id: "engagement",
  version: 0,
  winnerPoints: 3,
  exactScorePoints: 2,
  lockMinutes: 0,
  ratingWeights: {
    attack: 25,
    defense: 25,
    wins: 20,
    consistency: 10,
    form: 20,
  },
};
export const engagementCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("prediction.save"),
    challengeId: z.string().min(1).max(100),
    winnerId: z.string().min(1).max(100),
    setScore: z.enum(["2-0", "2-1"]),
  }),
  z.object({
    type: z.literal("admin.engagement.settings"),
    expectedVersion: z.number().int().min(0),
    winnerPoints: z.number().int().min(0).max(100),
    exactScorePoints: z.number().int().min(0).max(100),
    lockMinutes: z.number().int().min(0).max(1440),
    ratingWeights: z
      .object({
        attack: z.number().int().min(0).max(100),
        defense: z.number().int().min(0).max(100),
        wins: z.number().int().min(0).max(100),
        consistency: z.number().int().min(0).max(100),
        form: z.number().int().min(0).max(100),
      })
      .refine(
        (x) => Object.values(x).some((n) => n > 0),
        "Define pelo menos um peso positivo.",
      ),
  }),
]);
export function engagementSettings(state: State): EngagementSettings {
  return (
    state.engagementSettings?.[0] ?? structuredClone(defaultEngagementSettings)
  );
}
export function publishedChallenge(challenge: Challenge) {
  return !!challenge.officialPublication;
}
function winnerSide(challenge: Challenge, winnerId: string): string | null {
  if (
    winnerId === challenge.challengerId ||
    challenge.challengerTeam?.some((p) => p.playerId === winnerId)
  )
    return challenge.challengerId;
  if (
    winnerId === challenge.defenderId ||
    challenge.defenderTeam?.some((p) => p.playerId === winnerId)
  )
    return challenge.defenderId;
  return null;
}
/** Explicit set totals, or valid completed padel sets. Ambiguous legacy text earns no exact-score bonus. */
export function officialSetScore(score: string): "2-0" | "2-1" | null {
  if (/^\s*[02]\s*[-–:]\s*[02]\s*$/.test(score)) {
    const [a, b] = score.split(/[-–:]/).map(Number);
    if ((a === 2 && b === 0) || (b === 2 && a === 0)) return "2-0";
  }
  if (/^\s*(2\s*[-–:]\s*1|1\s*[-–:]\s*2)\s*$/.test(score)) return "2-1";
  const sets = score
    .trim()
    .split(/\s*[,;]\s*|\s+/)
    .filter(Boolean);
  if (sets.length < 2 || sets.length > 3) return null;
  let a = 0,
    b = 0;
  for (const set of sets) {
    const m = /^(\d{1,2})[-:](\d{1,2})(?:\(\d+\))?$/.exec(set);
    if (!m) return null;
    const x = +m[1],
      y = +m[2],
      high = Math.max(x, y),
      low = Math.min(x, y);
    if (!(
      (high === 6 && low <= 4) ||
      (high === 7 && (low === 5 || low === 6)) ||
      (high === 10 && low <= 8) ||
      (high > 10 && high - low === 2)
    ))
      return null;
    if (a === 2 || b === 2) return null;
    if (x > y) a++;
    else b++;
  }
  return Math.max(a, b) === 2 ? (Math.min(a, b) === 0 ? "2-0" : "2-1") : null;
}
export function settlePredictions(state: State, at = new Date().toISOString()) {
  for (const challenge of state.challenges) {
    if (!publishedChallenge(challenge)) continue;
    const start =
      state.matches.find((m) => m.challengeId === challenge._id)?.start ??
      challenge.scheduledAt;
    if (
      start &&
      (!challenge.predictionCutoffAt || start < challenge.predictionCutoffAt)
    )
      challenge.predictionCutoffAt = start;
  }
  for (const prediction of state.predictions ?? []) {
    const challenge = state.challenges.find(
      (c) => c._id === prediction.challengeId,
    );
    if (!challenge || !publishedChallenge(challenge)) continue;
    if (["cancelled", "refused", "expired"].includes(challenge.status)) {
      prediction.points = 0;
      prediction.settlement = "void";
      prediction.settledAt ??= at;
      continue;
    }
    const result = state.results.find((r) => r.challengeId === challenge._id);
    if (challenge.status !== "completed" || !result) {
      // A correction can reopen the result. Never keep provisional points on the board.
      delete prediction.points;
      delete prediction.settlement;
      delete prediction.resultFingerprint;
      delete prediction.settledAt;
      continue;
    }
    const fingerprint = `${result._id}:${result.winnerId}:${result.score}:${result.confirmedAt}`;
    if (
      prediction.resultFingerprint === fingerprint &&
      prediction.settlement === "settled"
    )
      continue;
    const correct =
      prediction.winnerId === winnerSide(challenge, result.winnerId);
    prediction.points = correct
      ? prediction.winnerPoints +
        (officialSetScore(result.score) === prediction.setScore
          ? prediction.exactScorePoints
          : 0)
      : 0;
    prediction.settlement = "settled";
    prediction.resultFingerprint = fingerprint;
    prediction.settledAt = at;
  }
}
export function executeEngagement(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp: string | number = new Date().toISOString(),
) {
  const at = new Date(timestamp).toISOString();
  const cmd = engagementCommandSchema.parse(raw);
  if (cmd.type === "admin.engagement.settings") {
    if (actor.role !== "admin")
      throw new LeagueError(
        "Apenas administradores podem alterar as regras.",
        403,
      );
    const current = engagementSettings(state);
    if (current.version !== cmd.expectedVersion)
      throw new LeagueError(
        "As definições foram alteradas por outro administrador. Atualiza a página.",
        409,
      );
    state.engagementSettings = [
      {
        _id: "engagement",
        version: current.version + 1,
        winnerPoints: cmd.winnerPoints,
        exactScorePoints: cmd.exactScorePoints,
        lockMinutes: cmd.lockMinutes,
        ratingWeights: cmd.ratingWeights,
        updatedAt: at,
        updatedBy: actor.userId,
      },
    ];
    state.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      details: JSON.stringify({
        before: current,
        after: state.engagementSettings[0],
      }),
      createdAt: at,
    });
    return { ok: true };
  }
  const player = state.players.find(
    (p) => p._id === actor.playerId && p.userId === actor.userId,
  );
  if (
    !player ||
    player.status === "removed" ||
    player.awaitingApproval ||
    player.registrationRejectedAt
  )
    throw new LeagueError("Perfil sem acesso aos palpites.", 403);
  const challenge = state.challenges.find((c) => c._id === cmd.challengeId);
  if (!challenge || !publishedChallenge(challenge))
    throw new LeagueError(
      "Apenas jogos oficialmente publicados aceitam palpites.",
      404,
    );
  if (!["scheduled", "schedule_pending", "accepted"].includes(challenge.status))
    throw new LeagueError("Os palpites para este jogo estão encerrados.");
  if (![challenge.challengerId, challenge.defenderId].includes(cmd.winnerId))
    throw new LeagueError("Escolhe uma das equipas deste jogo.");
  settlePredictions(state, at);
  const settings = engagementSettings(state),
    cutoff = predictionCutoff(state, challenge, settings);
  if (!cutoff)
    throw new LeagueError("O jogo ainda não tem horário confirmado.");
  state.predictions ??= [];
  const existing = state.predictions.find(
    (p) => p.userId === actor.userId && p.challengeId === challenge._id,
  );
  // Preserve the earliest previously promised cutoff; rescheduling cannot reopen a locked prediction.
  const lockAt =
    existing && existing.lockAt < cutoff ? existing.lockAt : cutoff;
  if (Date.parse(at) >= Date.parse(lockAt))
    throw new LeagueError(
      "Os palpites encerraram antes do início do jogo.",
      409,
    );
  if (existing)
    Object.assign(existing, {
      winnerId: cmd.winnerId,
      setScore: cmd.setScore,
      updatedAt: at,
      lockAt,
    });
  else
    state.predictions.push({
      _id: randomUUID(),
      userId: actor.userId,
      playerId: actor.playerId,
      challengeId: challenge._id,
      winnerId: cmd.winnerId,
      setScore: cmd.setScore,
      createdAt: at,
      updatedAt: at,
      lockAt,
      winnerPoints: settings.winnerPoints,
      exactScorePoints: settings.exactScorePoints,
    });
  return { ok: true };
}
export function predictionLeaderboard(state: State) {
  const rows = new Map<
    string,
    {
      playerId: string;
      name: string;
      points: number;
      predictions: number;
      correct: number;
    }
  >();
  for (const p of state.predictions ?? []) {
    if (p.settlement !== "settled") continue;
    const player = state.players.find((x) => x._id === p.playerId);
    const row = rows.get(p.userId) ?? {
      playerId: p.playerId,
      name: player?.name ?? "Jogador removido",
      points: 0,
      predictions: 0,
      correct: 0,
    };
    row.points += p.points ?? 0;
    row.predictions++;
    const challenge = state.challenges.find((c) => c._id === p.challengeId);
    const result = state.results.find((r) => r.challengeId === p.challengeId);
    row.correct += +(
      !!challenge &&
      !!result &&
      p.winnerId === winnerSide(challenge, result.winnerId)
    );
    rows.set(p.userId, row);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.correct - a.correct ||
      a.name.localeCompare(b.name, "pt-PT") ||
      a.playerId.localeCompare(b.playerId),
  );
}
