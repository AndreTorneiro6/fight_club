import { rankingEntries, teamMembers } from "./ranking-groups";
import type { Challenge, Player, State, WeeklyRound } from "./types";
import { addClubDays, clubDay, clubWeek } from "./calendar";

export function weeklyPositionReason(
  players: Player[],
  playerId: string,
  role: "attack" | "defense",
) {
  const player = players.find((entry) => entry._id === playerId);
  if (!player) return null;
  const teams = rankingEntries(players, player.divisionId);
  const boundary = role === "attack" ? teams[0] : teams.at(-1);
  if (!boundary?.members.some((member) => member._id === playerId)) return null;
  return role === "attack"
    ? "A primeira equipa do ranking não pode atacar."
    : "A última equipa do ranking não pode defender.";
}

export function frozenRanking(s: State, playerId: string, now = Date.now()) {
  const today = clubDay(now);
  return s.exceptions.some(
    (entry) =>
      entry.playerId === playerId &&
      entry.vacation &&
      entry.from <= today &&
      entry.to >= today,
  );
}
/** Publication opens preparation for the immediately following playing week.
 * Older commitments keep their saved week; drafts and distant weeks cannot open challenges. */
export function weeklyChallengeWeek(s: State, now = Date.now()) {
  const current = clubWeek(now).start,
    next = addClubDays(current, 7);
  const season =
    s.seasons.find((season) => season.status === "active") ??
    s.seasons.find((season) => season.status === "paused");
  return s.weeklyRounds.some(
    (r) =>
      r.weekStart === next &&
      r.publishedAt &&
      Date.parse(r.publishedAt) <= now &&
      (!r.seasonId || r.seasonId === season?._id),
  )
    ? next
    : current;
}
export function weeklyOpeningAt(
  round: Pick<WeeklyRound, "challengesOpenAt" | "divisionChallengeOpenings">,
  divisionId: string,
) {
  return Object.prototype.hasOwnProperty.call(
    round.divisionChallengeOpenings ?? {},
    divisionId,
  )
    ? round.divisionChallengeOpenings![divisionId]
    : round.challengesOpenAt;
}
export function weeklyRole(
  s: State,
  playerId: string,
  now = Date.now(),
  weekStart = weeklyChallengeWeek(s, now),
) {
  const round = s.weeklyRounds.find((entry) => entry.weekStart === weekStart);
  return round?.publishedAt
    ? round.assignments.find((entry) => entry.playerId === playerId)?.role
    : undefined;
}
export function weeklyReason(
  s: State,
  attacker: Player,
  defender: Player,
  now = Date.now(),
  ignoreId?: string,
) {
  const attackingTeam = teamMembers(s.players, attacker._id);
  const defendingTeam = teamMembers(s.players, defender._id);
  if (
    attacker._id !== defender._id &&
    attackingTeam.some((member) => member._id === defender._id)
  )
    return "Não podes desafiar a tua própria equipa.";
  if (!s.settings[0].weeklyCompetition) return null;
  const week =
    (ignoreId
      ? s.challenges.find((c) => c._id === ignoreId)?.weekStart
      : undefined) ?? weeklyChallengeWeek(s, now);
  if (
    !s.weeklyRounds.some(
      (round) => round.weekStart === week && round.publishedAt,
    )
  )
    return "A aguardar a publicação dos papéis semanais pelo administrador.";
  const selected = s.weeklyRounds.find((r) => r.weekStart === week)!;
  const opensAt = weeklyOpeningAt(selected, attacker.divisionId);
  if (opensAt === null)
    return "Os desafios desta divisão aguardam abertura pelo administrador.";
  if (opensAt && Date.parse(opensAt) > now)
    return `Os desafios para a semana de ${week} abrem em ${new Date(opensAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })} (Portugal).`;
  const open = selected.weekType === "OPEN_ATTACK";
  if (!open) {
    if (weeklyRole(s, attacker._id, now, week) !== "attack")
      return "Esta semana estás em defesa. Só os atacantes podem lançar desafios.";
    if (weeklyRole(s, defender._id, now, week) !== "defense")
      return "Este jogador não está em defesa esta semana.";
    if (
      attackingTeam.some(
        (member) =>
          member.status === "active" &&
          weeklyRole(s, member._id, now, week) !== "attack",
      ) ||
      defendingTeam.some(
        (member) =>
          member.status === "active" &&
          weeklyRole(s, member._id, now, week) !== "defense",
      )
    )
      return "O clube precisa de atribuir o mesmo papel aos parceiros da equipa.";
  }
  const positionReason =
    weeklyPositionReason(s.players, attacker._id, "attack") ??
    weeklyPositionReason(s.players, defender._id, "defense");
  if (positionReason) return positionReason;
  for (const p of [...attackingTeam, ...defendingTeam]) {
    if (
      s.matches.some(
        (match) =>
          clubWeek(match.start).start === week &&
          s.challenges.some(
            (c) =>
              c._id === match.challengeId &&
              c._id !== ignoreId &&
              [c.challengerId, c.defenderId].includes(p._id) &&
              !["cancelled", "refused", "expired"].includes(c.status),
          ),
      )
    )
      return attackingTeam.some((member) => member._id === p._id)
        ? "Já tens um jogo nesta semana."
        : "Este jogador já tem um jogo nesta semana.";

    if (
      s.challenges.some(
        (c) =>
          c._id !== ignoreId &&
          !(c.status === "pending" && Date.parse(c.respondBy) <= now) &&
          (c.status !== "pending" ||
            (attackingTeam.some((m) => m._id === p._id) &&
              attackingTeam.some((m) => m._id === c.challengerId))) &&
          (c.weekStart ?? clubWeek(c.createdAt).start) === week &&
          [c.challengerId, c.defenderId].includes(p._id) &&
          !["cancelled", "refused", "expired"].includes(c.status),
      )
    )
      return attackingTeam.some((member) => member._id === p._id)
        ? "Já tens um desafio atribuído nesta semana."
        : "Este defensor já tem um desafio nesta semana.";
  }
  return null;
}
export function weeklyWindow(
  s: State,
  ids: string[],
  now = Date.now(),
  weekStart = weeklyChallengeWeek(s, now),
) {
  ids = [
    ...new Set(
      ids.flatMap((id) =>
        teamMembers(s.players, id).map((member) => member._id),
      ),
    ),
  ];
  const week = clubWeek(weekStart);
  let deferredUntil: string | undefined;
  // Consecutive vacations can extend a deferred challenge until both players return.
  for (let pass = 0; pass <= s.exceptions.length; pass++) {
    const bound = deferredUntil ? clubWeek(deferredUntil).end : week.end;
    const relevant = s.exceptions.filter(
      (entry) =>
        ids.includes(entry.playerId) &&
        entry.vacation &&
        entry.from <= bound &&
        entry.to >= clubDay(now),
    );
    const last = relevant
      .map((entry) => entry.to)
      .sort()
      .at(-1);
    const next = last ? addClubDays(last, 1) : undefined;
    if (!next || next === deferredUntil) break;
    deferredUntil = next;
  }
  return {
    weekStart: week.start,
    deferredUntil,
    playBy: clubWeek(deferredUntil ?? week.start).endsAt,
  };
}
export function weeklyBookingReason(
  s: State,
  c: Challenge,
  start: string,
  now = Date.now(),
) {
  if (!s.settings[0].weeklyCompetition) return null;
  const week = clubWeek(start).start;
  const teamIds = [c.challengerId, c.defenderId].flatMap((id) =>
    teamMembers(s.players, id).map((member) => member._id),
  );
  if (c.weekStart && !c.deferredUntil && week !== c.weekStart)
    return "O jogo deve realizar-se na semana do desafio.";
  if (c.deferredUntil && clubDay(start) < c.deferredUntil)
    return "Marca o jogo após o regresso de férias dos jogadores.";
  if (
    s.matches.some(
      (match) =>
        match.challengeId !== c._id &&
        clubWeek(match.start).start === week &&
        s.challenges.some(
          (other) =>
            other._id === match.challengeId &&
            !["cancelled", "refused", "expired"].includes(other.status) &&
            teamIds.some((id) =>
              [other.challengerId, other.defenderId].includes(id),
            ),
        ),
    )
  )
    return "Um dos jogadores já tem um jogo nessa semana. O limite é um jogo por semana.";
  return null;
}

/** Regulatory order, including rotation of a contested benefit in the previous week. */
export function weeklyPriority(
  s: State,
  defenderId: string,
  now = Date.now(),
  weekStart = weeklyChallengeWeek(s, now),
) {
  const members = teamMembers(s.players, defenderId).map((m) => m._id),
    week = weekStart;
  const group = s.challenges
    .filter(
      (c) =>
        (c.weekStart ?? clubWeek(c.createdAt).start) === week &&
        members.includes(c.defenderId) &&
        c.status === "pending" &&
        Date.parse(c.respondBy) > now,
    )
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) ||
        a.number - b.number ||
        a._id.localeCompare(b._id),
    );
  if (!group.length) return undefined;
  const previous = addClubDays(week, -7);
  const benefited = s.challenges
    .filter(
      (c) =>
        (c.weekStart ?? clubWeek(c.createdAt).start) === previous &&
        c.weeklyPriorityWinner &&
        c.weeklyPriorityReason?.includes("disputada"),
    )
    .flatMap((c) => teamMembers(s.players, c.challengerId).map((m) => m._id));
  const rotated = group.length > 1 && benefited.includes(group[0].challengerId);
  const winner = rotated
    ? (group.find((c) => !benefited.includes(c.challengerId)) ?? group[0])
    : group[0];
  return {
    id: winner._id,
    reason:
      group.length > 1
        ? rotated
          ? "Rotação de prioridade disputada"
          : "Primeira submissão válida disputada"
        : "Único desafio válido",
  };
}
