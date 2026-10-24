import type { State } from "./types";
import type { CompetitionRound, CompetitionTeam } from "./competition-types";
import { rankingEntries } from "./ranking-groups";
import { pairingError } from "./competition-optimizer";

/** Published roles are separate from the private official schedule. Pure: safe in UI and domain. */
export function challengeContext(s: State, r: CompetitionRound) {
  const config = s.competitionConfigurations?.find(
    (c) => c._id === r.competitionId,
  );
  const publication = (s.competitionSchedules ?? [])
    .filter((q) => q.roundId === r._id && q.status === "PUBLISHED")
    .sort((a, b) => b.revision - a.revision)[0];
  const teams: CompetitionTeam[] =
    publication?.snapshot ??
    (r.rolesPublishedAt && r.roleSnapshot
      ? r.roleSnapshot
      : rankingEntries(s.players, r.divisionId).map((t, i) => ({
          id: t.id,
          rank: i + 1,
          active: t.members.every((m) => m.status === "active"),
          members: t.members.map((m) => ({ playerId: m._id, name: m.name })),
        })));
  const type =
    publication?.weekType ??
    r.weekType ??
    ((r.number === 1 && config?.firstOpen) ||
    (r.number === config?.officialRounds && config?.finalOpen)
      ? "OPEN_ATTACK"
      : "NORMAL");
  return {
    teams,
    type,
    distance:
      publication?.effectiveDistance ??
      r.distanceOverride ??
      config?.leagueDistances[r.divisionId] ??
      config?.defaultDistance ??
      1,
    champions: publication?.championPositions ??
      config?.leagueOverrides?.[r.divisionId]?.championPositions ??
      config?.championPositions ?? [2, 3],
  };
}
export function challengeRoleError(
  s: State,
  r: CompetitionRound,
  attackerId: string,
  defenderId: string,
) {
  if (!r.rolesPublishedAt)
    return "A aguardar a publicação dos papéis da jornada pelo administrador.";
  const e = challengeContext(s, r),
    a = e.teams.find((t) => t.id === attackerId),
    d = e.teams.find((t) => t.id === defenderId);
  const invalid = pairingError(a, d, e.distance, e.champions);
  if (invalid) return invalid;
  if (e.type === "NORMAL" && r.roles?.[attackerId] !== "attack")
    return "Esta jornada estás em modo DEFESA. Apenas as duplas em ATAQUE podem desafiar.";
  if (e.type === "NORMAL" && r.roles?.[defenderId] !== "defense")
    return "A dupla adversária não está em DEFESA nesta jornada.";
  return undefined;
}
export function challengeTargetError(
  s: State,
  r: CompetitionRound,
  attackerId: string,
  defenderId: string,
  ignoreId?: string,
) {
  const invalid = challengeRoleError(s, r, attackerId, defenderId);
  if (invalid) return invalid;
  if (r.challengesBlocked) return "Desafios bloqueados pela organização.";
  const e = challengeContext(s, r);
  for (const id of [attackerId, defenderId]) {
    const team = e.teams.find((t) => t.id === id)!;
    if (!rankingEntries(s.players, r.divisionId).some((t) => t.id === id))
      return "Composição da dupla alterada; contacta a organização.";
    if (
      team.members.some(
        (m) =>
          !s.players.some(
            (p) =>
              p._id === m.playerId &&
              p.divisionId === r.divisionId &&
              p.status === "active" &&
              !p.awaitingApproval &&
              !p.registrationRejectedAt,
          ),
      )
    )
      return "Composição da dupla alterada; contacta a organização.";
    if (
      s.competitionAbsences?.some(
        (a) =>
          a.competitionId === r.competitionId &&
          a.divisionId === r.divisionId &&
          a.teamId === id &&
          (a.roundIds.includes(r._id) ||
            (a.from < r.endsAt && a.to > r.startsAt)),
      )
    )
      return "Ausência aprovada.";
    if (
      s.competitionChallenges?.some(
        (c) =>
          c._id !== ignoreId &&
          c.roundId === r._id &&
          c.status === "ACCEPTED" &&
          [c.attackerId, c.defenderId].includes(id),
      )
    )
      return "Compromisso aceite incompatível.";
    if (
      s.challenges.some(
        (c) =>
          !["cancelled", "refused", "expired"].includes(c.status) &&
          (c.competitionRoundId === r._id ||
            (!c.competitionRoundId &&
              !["pending", "completed"].includes(c.status) &&
              (!c.scheduledAt ||
                (c.scheduledAt >= r.startsAt && c.scheduledAt < r.endsAt)))) &&
          [
            ...(c.challengerTeam ?? [{ playerId: c.challengerId }]),
            ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
          ].some((m) => team.members.some((p) => p.playerId === m.playerId)),
      )
    )
      return "Jogo confirmado incompatível.";
  }
  return undefined;
}
export function eligibleChallengeTargets(
  s: State,
  r: CompetitionRound,
  attackerId: string,
) {
  return challengeContext(s, r).teams.filter(
    (t) => !challengeTargetError(s, r, attackerId, t.id),
  );
}

export function competitionPriorities(
  s: State,
  round: CompetitionRound,
  now?: string,
) {
  const challenges = (s.competitionChallenges ?? [])
    .filter(
      (c) =>
        c.roundId === round._id &&
        ["PENDING", "ACCEPTED"].includes(c.status) &&
        !c.invalidReason &&
        (!now || c.status === "ACCEPTED" || c.respondBy > now),
    )
    .sort(
      (a, b) =>
        (a.submissionOrder ?? 0) - (b.submissionOrder ?? 0) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a._id.localeCompare(b._id),
    );
  const winners = [];
  for (const defender of new Set(challenges.map((c) => c.defenderId))) {
    const group = challenges.filter((c) => c.defenderId === defender);
    const previousRounds = new Set(
      (s.competitionRounds ?? [])
        .filter(
          (r) =>
            r.competitionId === round.competitionId &&
            r.divisionId === round.divisionId &&
            r.number === round.number - 1 &&
            (s.competitionSchedules ?? []).some(
              (q) => q.roundId === r._id && q.status === "PUBLISHED",
            ),
        )
        .map((r) => r._id),
    );
    const prior = (s.competitionChallenges ?? []).filter(
      (c) =>
        (previousRounds.has(c.roundId) &&
          c.priorityWinner &&
          c.priorityReason === "Rotação de prioridade disputada") ||
        (previousRounds.has(c.roundId) &&
          c.priorityWinner &&
          c.priorityReason === "Primeiro desafio válido disputado"),
    );
    const rotated =
      group.length > 1 &&
      prior.some((p) => p.attackerId === group[0].attackerId);
    const accepted = group.find((c) => c.status === "ACCEPTED");
    const winner =
      accepted ??
      (rotated
        ? (group.find(
            (c) => !prior.some((p) => p.attackerId === c.attackerId),
          ) ?? group[0])
        : group[0]);
    winners.push({
      ...winner,
      priorityReason:
        accepted?.priorityReason ??
        (group.length > 1
          ? rotated
            ? "Rotação de prioridade disputada"
            : "Primeiro desafio válido disputado"
          : "Único desafio válido"),
    });
  }
  // A pending request can only advance when first for both teams, across attack and defense.
  const ordered = [...challenges];
  for (const winner of winners) {
    const first = ordered.find((c) => c.defenderId === winner.defenderId);
    const row = ordered.find((c) => c._id === winner._id);
    if (first && row && first !== row) {
      ordered.splice(ordered.indexOf(row), 1);
      ordered.splice(ordered.indexOf(first), 0, row);
    }
  }
  const heads = new Map<string, string>();
  for (const c of [
    ...ordered.filter((c) => c.status === "ACCEPTED"),
    ...ordered.filter((c) => c.status !== "ACCEPTED"),
  ])
    for (const id of [c.attackerId, c.defenderId])
      if (!heads.has(id)) heads.set(id, c._id);
  return winners.filter(
    (c) =>
      c.status === "ACCEPTED" ||
      (heads.get(c.attackerId) === c._id && heads.get(c.defenderId) === c._id),
  );
}
