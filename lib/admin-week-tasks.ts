import { addClubDays, clubWeek } from "./calendar";
import { weeklyPublishedAt } from "./weekly-publication";
import { weeklyOpeningAt } from "./weekly";
import type { State } from "./types";

type WeeklyTaskState = Pick<
  State,
  | "settings"
  | "seasons"
  | "divisions"
  | "players"
  | "weeklyRounds"
  | "challenges"
  | "competitionConfigurations"
>;
export interface AdminWeekTask {
  label: string;
  count: number;
  detail: string;
  href: string;
  weekStart: string;
  divisionId: string;
}
/** The next admin actions for this week and the coming week; navigation only. */
export function adminWeekTasks(
  s: WeeklyTaskState,
  now = Date.now(),
): AdminWeekTask[] {
  if (
    !s.settings[0]?.weeklyCompetition ||
    s.competitionConfigurations?.some((c) => c.enabled)
  )
    return [];
  const season = s.seasons.find((e) => e.status === "active");
  if (!season) return [];
  const current = [
    clubWeek(now).start,
    clubWeek(season.start).start,
    season.firstCompetitionWeek ?? "",
  ]
    .sort()
    .at(-1)!;
  const tasks: AdminWeekTask[] = [];
  for (const week of [current, addClubDays(current, 7)]) {
    if (week > season.end) continue;
    const round = s.weeklyRounds.find(
      (r) => r.weekStart === week && (!r.seasonId || r.seasonId === season._id),
    );
    for (const d of s.divisions) {
      const players = s.players.filter(
        (p) =>
          p.divisionId === d._id &&
          p.status === "active" &&
          !p.awaitingApproval &&
          !p.registrationRejectedAt,
      );
      if (!players.length) continue;
      const add = (
        label: string,
        task: string,
        detail: string,
        count = 1,
        opening = false,
      ) =>
        tasks.push({
          label: `${label} · ${d.name}`,
          count,
          detail: `Semana de ${week.slice(8, 10)}/${week.slice(5, 7)} · ${detail}`,
          href: opening
            ? `/admin?tab=weekly&week=${week}&division=${d._id}`
            : `/admin?tab=week&week=${week}&division=${d._id}&task=${task}`,
          weekStart: week,
          divisionId: d._id,
        });
      if (!weeklyPublishedAt(round, d._id)) {
        const hasRoles =
          !!round &&
          players.every((p) =>
            round.assignments.some((a) => a.playerId === p._id),
          );
        const approved =
          !!round &&
          (round.divisionPublications?.[d._id]?.approvedAt ||
            (round.approvedAt && round.approvedVersion === round.version));
        if (!hasRoles)
          add(
            "Papéis por preparar",
            "roles",
            "Atribui ou gera os papéis desta divisão.",
          );
        else if (!approved)
          add(
            "Papéis por aprovar",
            "roles",
            "Revê os papéis em rascunho e aprova-os antes de publicar.",
          );
        else
          add(
            "Papéis por publicar",
            "roles",
            "Os papéis estão aprovados. Falta a publicação pelo administrador.",
          );
      } else if (!weeklyOpeningAt(round!, d._id)) {
        add(
          "Desafios por abrir",
          "roles",
          "Os papéis estão publicados. Decide quando abrir os desafios.",
          1,
          true,
        );
      }
      const pairs =
        round?.manualMatchups?.[d._id]?.pairs.filter((p) => !p.challengeId)
          .length ?? 0;
      if (pairs)
        add(
          "Jogos obrigatórios por publicar",
          "mandatory",
          "Revê e publica os confrontos guardados em rascunho.",
          pairs,
        );
      const unscheduled = s.challenges.filter(
        (c) =>
          c.seasonId === season._id &&
          c.divisionId === d._id &&
          !c.competitionRoundId &&
          (c.weekStart ?? clubWeek(c.createdAt).start) === week &&
          !c.scheduledAt &&
          ["accepted", "schedule_pending"].includes(c.status) &&
          !(
            c.status === "schedule_pending" &&
            c.scheduleProposal?.challengerConfirmed &&
            c.scheduleProposal?.defenderConfirmed
          ),
      ).length;
      if (unscheduled)
        add(
          "Jogos por agendar",
          "schedule",
          "Falta definir o horário e o campo destes jogos.",
          unscheduled,
        );
    }
  }
  return tasks;
}
