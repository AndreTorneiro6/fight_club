import type { State } from "./types";
import { addClubDays, clubWeek } from "./calendar";
import { firstCompetitionWeek } from "./competition-calendar";
import { rankingEntries } from "./ranking-groups";
import { weeklyPairAllowed } from "./weekly-pairing-rules";
import { challengeSide } from "./team-competition";
import { ensure } from "./rules";

export function manualMatchmakingWeeks(s: State, now = Date.now()) {
  const season = s.seasons.find((e) => e.status === "active");
  if (!season) return [];
  let week = [
    clubWeek(now).start,
    clubWeek(season.start).start,
    firstCompetitionWeek(s) ?? "",
  ]
    .sort()
    .at(-1)!;
  const weeks: string[] = [];
  for (; week <= season.end && weeks.length < 520; week = addClubDays(week, 7))
    weeks.push(week);
  return weeks;
}
export function validateManualWeek(s: State, week: string, now: number) {
  ensure(
    manualMatchmakingWeeks(s, now).includes(week),
    "Escolhe uma segunda-feira atual ou futura dentro da época ativa.",
  );
}
export function manualPairingReason(
  s: State,
  divisionId: string,
  week: string,
  challengerId: string,
  defenderId: string,
  ignorePairId?: string,
) {
  const teams = rankingEntries(s.players, divisionId);
  const attacker = teams.find((t) =>
    t.members.some((p) => p._id === challengerId),
  );
  const defender = teams.find((t) =>
    t.members.some((p) => p._id === defenderId),
  );
  if (!attacker || !defender || attacker.id === defender.id)
    return "Escolhe duas duplas diferentes da divisão.";
  if (
    ![...attacker.members, ...defender.members].every(
      (p) =>
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
  )
    return "As duas duplas devem estar ativas e aprovadas.";
  if (!weeklyPairAllowed(s, divisionId, teams, attacker, defender, week))
    return "Confronto inválido: verifica a distância, o título, os adversários da semana anterior e os jogos pendentes entre estas duplas.";
  const ids = [...attacker.members, ...defender.members].map((p) => p._id);
  if (
    s.challenges.some(
      (c) =>
        c.divisionId === divisionId &&
        c.weekStart === week &&
        !["cancelled", "refused", "expired"].includes(c.status) &&
        ids.some((id) => challengeSide(c, id, s.players)),
    )
  )
    return "Uma destas duplas já tem um jogo nesta semana.";
  const plans = s.weeklyRounds;
  const plan = plans.find((r) => r.weekStart === week)?.manualMatchups?.[
    divisionId
  ];
  if (
    plan?.pairs.some(
      (p) =>
        p.id !== ignorePairId &&
        !p.challengeId &&
        [p.challengerId, p.defenderId].some((id) => ids.includes(id)),
    )
  )
    return "Uma destas duplas já está escolhida no rascunho desta semana.";
  for (const adjacent of [addClubDays(week, -7), addClubDays(week, 7)]) {
    const pairs =
      plans.find((r) => r.weekStart === adjacent)?.manualMatchups?.[divisionId]
        ?.pairs ?? [];
    if (
      pairs.some(
        (p) =>
          (!p.challengeId ||
            s.challenges.some(
              (c) =>
                c._id === p.challengeId &&
                !["cancelled", "refused", "expired"].includes(c.status),
            )) &&
          [p.challengerTeamKey, p.defenderTeamKey].sort().join("|") ===
            [attacker.id, defender.id].sort().join("|"),
      )
    )
      return "As mesmas duplas não podem repetir-se em semanas consecutivas, incluindo rascunhos.";
  }
  return null;
}
