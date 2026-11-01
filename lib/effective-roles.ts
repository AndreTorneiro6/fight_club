import type { WeeklyRound } from "./types";

type Role = WeeklyRound["assignments"][number];

/**
 * Effective weekly roles: published roles, overridden per player by any
 * dynamic (planner/admin) role. Republishing one division clears only that
 * division's dynamic roles, so a whole-list fallback would hide its roles.
 */
export function effectiveRoles(round: Pick<WeeklyRound, "assignments" | "dynamicAssignments">): Role[] {
  if (!round.dynamicAssignments) return round.assignments;
  const roles = new Map(round.assignments.map((a) => [a.playerId, a.role]));
  for (const a of round.dynamicAssignments) roles.set(a.playerId, a.role);
  return [...roles].map(([playerId, role]) => ({ playerId, role }));
}
