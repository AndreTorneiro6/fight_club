import { optimize } from "./competition-optimizer";
import type {
  CompetitionMeeting,
  CompetitionTeam,
  WeekType,
} from "./competition-types";
export type TeamRoles = Record<string, "attack" | "defense">;
export const sameRoles = (a: TeamRoles, b: TeamRoles) =>
  JSON.stringify(Object.entries(a).sort()) ===
  JSON.stringify(Object.entries(b).sort());
/** Propose roles only. Pairings used by the solver are never official matches. */
export function proposeTeamRoles(input: {
  teams: CompetitionTeam[];
  distance: number;
  champions: number[];
  weekType: WeekType;
  round: number;
  history?: CompetitionMeeting[];
  previous?: TeamRoles;
  unavailable?: string[];
}) {
  const roles: TeamRoles = {},
    warnings: string[] = [];
  if (input.weekType === "OPEN_ATTACK") {
    for (const t of input.teams)
      roles[t.id] = t.rank === 1 ? "defense" : "attack";
    return { roles, warnings };
  }
  const result = optimize({
    teams: input.teams,
    distance: input.distance,
    championPositions: input.champions,
    round: input.round,
    history: input.history ?? [],
    unavailable: input.unavailable,
    rolePreferences: Object.fromEntries(
      Object.entries(input.previous ?? {}).map(([id, role]) => [
        id,
        role === "attack" ? "defense" : "attack",
      ]),
    ),
  });
  for (const p of result.pairs) {
    roles[p.attackerId] = "attack";
    roles[p.defenderId] = "defense";
  }
  for (const t of input.teams) {
    roles[t.id] ??=
      t.rank === 1
        ? "defense"
        : t.rank === input.teams.length
          ? "attack"
          : input.previous?.[t.id] === "attack"
            ? "defense"
            : "attack";
    if (result.unmatched.includes(t.id))
      warnings.push(
        `Dupla ${t.rank}: sem combinação completa; rever adversários/ausências.`,
      );
  }
  return { roles, warnings: [...result.errors, ...warnings] };
}
