import type { Challenge, Player, State, WeeklyRound } from "./types";
import { clubWeek } from "./calendar";
import { firstCompetitionWeek } from "./competition-calendar";
import { effectiveRoles } from "./effective-roles";
import { weeklyPublishedAt } from "./weekly-publication";
import { challengeMemberIds } from "./team-competition";
import { rankingEntries, type RankingEntry } from "./ranking-groups";
import {
  weeklyPairAllowed,
  weeklyTeamAvailable,
  weeklyTeamUnavailableReason,
  weeklyTeamVacationUntil,
} from "./weekly-pairing-rules";
import { dynamicWeeklyEnabled, dynamicWeeklyPlan } from "./dynamic-weekly";

type Role = "attack" | "defense";
const ended = new Set(["cancelled", "refused", "expired"]);
const weekOf = (c: Challenge) => c.weekStart ?? clubWeek(c.createdAt).start;

export type WeekRoleEntry = {
  week: string;
  /** Role published for the week. */
  initial?: Role;
  /** Role the team actually had: its game's side, else the effective role. */
  final?: Role;
  game?: {
    number: number;
    opponent: string;
    status: Challenge["status"];
    outcome?: "win" | "loss";
  };
};

/** Published weeks before `beforeWeek`, newest first, with the team's roles and game. */
export function teamRoleHistory(
  s: State,
  team: Player[],
  beforeWeek: string,
  limit = 5,
): WeekRoleEntry[] {
  const ids = new Set(team.map((m) => m._id)),
    divisionId = team[0]?.divisionId,
    first = firstCompetitionWeek(s);
  return s.weeklyRounds
    .filter(
      (r) =>
        r.weekStart < beforeWeek &&
        (!first || r.weekStart >= first) &&
        weeklyPublishedAt(r, divisionId),
    )
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    .slice(0, limit)
    .map((r) => {
      const roleIn = (list: WeeklyRound["assignments"]) =>
        list.find((a) => ids.has(a.playerId))?.role;
      const games = s.challenges.filter(
        (c) =>
          !c.competitionRoundId &&
          weekOf(c) === r.weekStart &&
          (["attack", "defense"] as const).some((side) =>
            challengeMemberIds(c, side, s.players).some((id) => ids.has(id)),
          ),
      );
      const c = games.find((c) => !ended.has(c.status)) ?? games.at(-1);
      const side = c
        ? challengeMemberIds(c, "attack", s.players).some((id) => ids.has(id))
          ? ("attack" as const)
          : ("defense" as const)
        : undefined;
      const result = c && s.results.find((x) => x.challengeId === c._id);
      const winnerSide =
        result &&
        (challengeMemberIds(c!, "attack", s.players).includes(result.winnerId)
          ? "attack"
          : "defense");
      const other = side === "attack" ? c?.defenderTeam : c?.challengerTeam;
      return {
        week: r.weekStart,
        initial: roleIn(r.assignments),
        final: c && !ended.has(c.status) ? side : roleIn(effectiveRoles(r)),
        game: c
          ? {
              number: c.number,
              opponent:
                other?.map((m) => m.name).join(" + ") ??
                s.players.find(
                  (p) =>
                    p._id ===
                    (side === "attack" ? c.defenderId : c.challengerId),
                )?.name ??
                "",
              status: c.status,
              outcome: winnerSide
                ? winnerSide === side
                  ? "win"
                  : "loss"
                : undefined,
            }
          : undefined,
      };
    });
}

export type TeamWeekOptions = {
  rank: number;
  available: boolean;
  /** Why the team is out of this week's schedule. */
  unavailableReason?: string;
  /** Last vacation day overlapping the week: its game stays frozen until then. */
  vacationUntil?: string;
  /** Opponents this team could attack (defenders under the current roles). */
  attack: { rank: number; name: string }[];
  /** Opponents that could attack this team (attackers under the current roles). */
  defense: { rank: number; name: string }[];
  /** Game already committed this week, if any. */
  committed?: { rank: number; name: string; side: Role };
  /** Game in the planner's schedule for these roles. */
  planned?: { rank: number; name: string; side: Role };
  /** Role the planner would give, when it differs from the one on screen. */
  plannerRole?: Role;
};

/** Every team's possible games for `week` under the roles currently chosen
 * (`roles` by player), using the same rules as the dynamic planner. */
export function divisionWeekOptions(
  s: State,
  divisionId: string,
  week: string,
  roles: Record<string, Role>,
) {
  const entries = rankingEntries(s.players, divisionId);
  const name = (t: RankingEntry) => t.members.map((m) => m.name).join(" + ");
  const rank = (t: RankingEntry) => entries.indexOf(t) + 1;
  const roleOf = (t: RankingEntry) => {
    const set = new Set(t.members.map((m) => roles[m._id]).filter(Boolean));
    return set.size === 1 ? [...set][0] : undefined;
  };
  const live = s.challenges.filter(
    (c) =>
      !c.competitionRoundId &&
      c.divisionId === divisionId &&
      weekOf(c) === week &&
      !ended.has(c.status),
  );
  const commitment = (t: RankingEntry) => {
    for (const c of live)
      for (const side of ["attack", "defense"] as const)
        if (
          challengeMemberIds(c, side, s.players).some((id) =>
            t.members.some((m) => m._id === id),
          )
        ) {
          const otherIds = challengeMemberIds(
            c,
            side === "attack" ? "defense" : "attack",
            s.players,
          );
          const other = entries.find((e) =>
            e.members.some((m) => otherIds.includes(m._id)),
          );
          return other
            ? { rank: rank(other), name: name(other), side }
            : undefined;
        }
  };
  const committed = new Map(entries.map((t) => [t.id, commitment(t)]));
  const free = (t: RankingEntry) =>
    weeklyTeamAvailable(s, t, week) && !committed.get(t.id);

  // Planner schedule for the roles on screen.
  const planned = new Map<string, TeamWeekOptions["planned"]>();
  const plannerRoles = new Map<string, Role>();
  if (dynamicWeeklyEnabled(s, divisionId)) {
    const ids = new Set(entries.flatMap((t) => t.members.map((m) => m._id)));
    const existing = s.weeklyRounds.find((r) => r.weekStart === week);
    const assignments = [
      ...(existing?.assignments ?? []).filter((a) => !ids.has(a.playerId)),
      ...Object.entries(roles)
        .filter(([id]) => ids.has(id))
        .map(([playerId, role]) => ({ playerId, role })),
    ];
    const preview: State = {
      ...s,
      weeklyRounds: [
        ...s.weeklyRounds.filter((r) => r.weekStart !== week),
        {
          ...(existing ?? { _id: week, version: 0, weekType: "NORMAL" }),
          weekStart: week,
          assignments,
          dynamicAssignments: undefined,
        } as WeeklyRound,
      ],
    };
    const plan = dynamicWeeklyPlan(preview, divisionId, week);
    for (const p of [...plan.fixed, ...plan.canonical]) {
      const a = entries.find((t) => t.id === p.attackerKey),
        d = entries.find((t) => t.id === p.defenderKey);
      if (!a || !d) continue;
      planned.set(a.id, { rank: rank(d), name: name(d), side: "attack" });
      planned.set(d.id, { rank: rank(a), name: name(a), side: "defense" });
      plannerRoles.set(a.id, "attack");
      plannerRoles.set(d.id, "defense");
    }
  }

  return new Map(
    entries.map((t): [string, TeamWeekOptions] => {
      const mine = roleOf(t),
        open = free(t);
      const attack =
        open && mine !== "defense"
          ? entries.filter(
              (d) =>
                free(d) &&
                roleOf(d) !== "attack" &&
                weeklyPairAllowed(s, divisionId, entries, t, d, week),
            )
          : [];
      const defense =
        open && mine !== "attack"
          ? entries.filter(
              (a) =>
                free(a) &&
                roleOf(a) !== "defense" &&
                weeklyPairAllowed(s, divisionId, entries, a, t, week),
            )
          : [];
      const plannerRole = plannerRoles.get(t.id);
      return [
        t.id,
        {
          rank: rank(t),
          available: weeklyTeamAvailable(s, t, week),
          unavailableReason:
            weeklyTeamUnavailableReason(s, t, week) ?? undefined,
          vacationUntil: weeklyTeamVacationUntil(s, t, week),
          attack: attack.map((d) => ({ rank: rank(d), name: name(d) })),
          defense: defense.map((a) => ({ rank: rank(a), name: name(a) })),
          committed: committed.get(t.id),
          planned: planned.get(t.id),
          plannerRole:
            plannerRole && mine && plannerRole !== mine
              ? plannerRole
              : undefined,
        },
      ];
    }),
  );
}
