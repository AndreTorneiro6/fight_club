import { execute } from "./engine";
import { ensure } from "./rules";
import type { Actor, State } from "./types";
export function cancelledGameCleanupPreview(s: State) {
  const games = s.challenges.filter((c) => c.status === "cancelled");
  const ids = new Set(games.map((c) => c._id));
  const protectedIds = new Set([
    ...s.results
      .filter((r) => ids.has(r.challengeId))
      .map((r) => r.challengeId),
    ...s.history
      .filter((h) => h.challengeId && ids.has(h.challengeId))
      .map((h) => h.challengeId!),
    ...(s.predictions ?? [])
      .filter((p) => ids.has(p.challengeId) && (p.points ?? 0) > 0)
      .map((p) => p.challengeId),
  ]);
  return {
    count: games.length,
    protectedCount: protectedIds.size,
    divisions: s.divisions.map((d) => ({
      division: d.code,
      count: games.filter((c) => c.divisionId === d._id).length,
    })),
  };
}
/** Explicit maintenance only: normal cancellations remain auditable until an admin requests cleanup. */
export function purgeCancelledGames(s: State, actor: Actor, note: string) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem eliminar jogos.",
    403,
  );
  const preview = cancelledGameCleanupPreview(s);
  ensure(
    preview.protectedCount === 0,
    "Existem cancelados com resultados, pontos ou movimentos de ranking: é necessária revisão antes de eliminar.",
  );
  const protectedState = () =>
    JSON.stringify([
      s.players,
      s.results,
      s.history,
      s.champions,
      s.settings,
      s.seasons,
      s.weeklyRounds,
    ]);
  const before = protectedState();
  const games = s.challenges.filter((c) => c.status === "cancelled");
  const ids = new Set(games.map((c) => c._id));
  const notificationIds: string[] = [];
  for (const c of games) {
    const result = execute(s, actor, {
      type: "admin.match.delete",
      challengeId: c._id,
      note,
    });
    if ("notificationIds" in result)
      notificationIds.push(...(result.notificationIds as string[]));
  }
  s.predictions = (s.predictions ?? []).filter((p) => !ids.has(p.challengeId));
  ensure(
    protectedState() === before,
    "A limpeza não pode alterar o ranking, resultados, regras ou papéis.",
  );
  return { ...preview, deleted: games.length, notificationIds };
}
