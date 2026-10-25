import { randomUUID } from "node:crypto";
import type { Actor, Season, State } from "./types";
import { clubWeek } from "./calendar";
import { ensure } from "./rules";
export function validateFirstCompetitionWeek(
  s: State,
  season: Season,
  week: string | undefined,
  start = season.start,
  end = season.end,
) {
  if (!week) return;
  ensure(
    /^\d{4}-\d{2}-\d{2}$/.test(week) &&
      clubWeek(week).start === week &&
      week >= clubWeek(start).start &&
      week <= end,
    "A primeira semana competitiva deve ser uma segunda-feira dentro da época.",
  );
  ensure(
    !s.challenges.some(
      (c) =>
        c.seasonId === season._id &&
        !["cancelled", "refused", "expired"].includes(c.status) &&
        (c.weekStart ?? clubWeek(c.scheduledAt ?? c.createdAt).start) < week,
    ),
    "Existem desafios ou jogos anteriores à nova primeira semana. Revê-os antes de alterar.",
    409,
  );
  const configs = new Set(
    (s.competitionConfigurations ?? [])
      .filter((c) => c.seasonId === season._id)
      .map((c) => c._id),
  );
  ensure(
    !(s.competitionRounds ?? []).some(
      (r) =>
        configs.has(r.competitionId) &&
        clubWeek(r.startsAt).start < week &&
        (s.competitionSchedules ?? []).some(
          (q) => q.roundId === r._id && q.status === "PUBLISHED",
        ),
    ),
    "A primeira semana excluiria uma jornada oficial publicada.",
    409,
  );
}
/** Explicit season boundary update; opening/preparation dates and historic records are preserved. */
export function setFirstCompetitionWeek(
  s: State,
  actor: Actor,
  input: {
    seasonId: string;
    expectedVersion: number;
    weekStart: string;
    reason: string;
  },
  now = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem definir a primeira semana.",
    403,
  );
  const season = s.seasons.find((e) => e._id === input.seasonId);
  ensure(
    season && season.status !== "completed",
    "Escolhe uma época não arquivada.",
  );
  ensure(
    input.expectedVersion === (season.version ?? 0),
    "A época foi alterada. Atualiza antes de guardar.",
    409,
  );
  ensure(input.reason.trim().length >= 10, "Indica o motivo da alteração.");
  validateFirstCompetitionWeek(s, season, input.weekStart);
  if (season.firstCompetitionWeek === input.weekStart)
    return { changed: false };
  const before = { ...season };
  season.firstCompetitionWeek = input.weekStart;
  season.version = (season.version ?? 0) + 1;
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "season.competition-start.updated",
    createdAt: new Date(now).toISOString(),
    details: JSON.stringify({ ...input, before, after: { ...season } }),
  });
  return { changed: true, firstCompetitionWeek: input.weekStart };
}
