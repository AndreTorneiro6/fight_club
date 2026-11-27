import { weeklyRoleName } from "./weekly-role-rules";
import type { State } from "./types";
import { rankingEntries } from "./ranking-groups";
import { dynamicRoleChanges, dynamicWeeklyEnabled } from "./dynamic-weekly";

/** Why a division's roles for `week` cannot be published as they are, or null.
 * Roles are valid when the dynamic planner would keep every one of them. */
export function weeklyRolesProblem(s: State, divisionId: string, week: string) {
  const round = s.weeklyRounds.find((r) => r.weekStart === week);
  if (!round) return "Não existem papéis para esta semana.";
  if (
    round.weekType === "OPEN_ATTACK" ||
    !dynamicWeeklyEnabled(s)
  )
    return null;
  const ids = new Set(
    rankingEntries(s.players, divisionId).flatMap((t) =>
      t.members.map((m) => m._id),
    ),
  );
  const changes = dynamicRoleChanges(
    s,
    divisionId,
    week,
    round.assignments.filter((a) => ids.has(a.playerId)),
  );
  return changes.length
    ? `Os papéis não permitem o máximo de jogos sem trocas: ${changes
        .map(
          (c) =>
            `${c.team} (${weeklyRoleName(c.from)} → ${weeklyRoleName(c.to)})`,
        )
        .join("; ")}.`
    : null;
}
