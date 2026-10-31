import type { State } from "./types";
import { rankingEntries } from "./ranking-groups";
import { challengeTeamKey } from "./team-competition";
import { clubWeek } from "./calendar";
import { challengeDistance } from "./challenge-distance";
export function dynamicWeeklyEnabled(s: State, divisionId?: string) {
  return !!(
    s.settings[0].weeklyCompetition &&
    s.settings[0].weeklyMandatoryChallenges &&
    s.settings[0].weeklyDynamicRoles &&
    (!s.settings[0].weeklyDynamicDivisionIds ||
      (divisionId
        ? s.settings[0].weeklyDynamicDivisionIds.includes(divisionId)
        : s.settings[0].weeklyDynamicDivisionIds.length > 0))
  );
}
export type DynamicPair = {
  attackerId: string;
  defenderId: string;
  attackerKey: string;
  defenderKey: string;
};
/** Exact maximum-cardinality matching. Keep all optimal alternatives, not one greedy schedule. */
function computeDynamicWeeklyPlan(s: State, divisionId: string, week: string) {
  const entries = rankingEntries(s.players, divisionId),
    pairs: DynamicPair[] = [],
    fixed: DynamicPair[] = [],
    errors: string[] = [];
  const occupied = new Set<string>();
  const challenges = s.challenges.filter(
    (c) =>
      !c.competitionRoundId &&
      c.divisionId === divisionId &&
      (c.weekStart ?? clubWeek(c.createdAt).start) === week,
  );
  for (const c of challenges.filter((c) =>
    [
      "accepted",
      "schedule_pending",
      "scheduled",
      "result_pending",
      "disputed",
      "completed",
    ].includes(c.status),
  )) {
    const a = challengeTeamKey(c, "attack", s.players),
      d = challengeTeamKey(c, "defense", s.players);
    if (!entries.some((t) => t.id === a) || !entries.some((t) => t.id === d))
      errors.push(
        "A composição de uma dupla com compromisso foi alterada. É necessária revisão administrativa.",
      );
    if (occupied.has(a) || occupied.has(d))
      errors.push(
        "Existem compromissos incompatíveis. É necessária revisão administrativa.",
      );
    occupied.add(a);
    occupied.add(d);
    fixed.push({
      attackerId: c.challengerId,
      defenderId: c.defenderId,
      attackerKey: a,
      defenderKey: d,
    });
  }
  const available = entries.filter(
    (t) =>
      !occupied.has(t.id) &&
      t.members.every(
        (p) =>
          p.status === "active" &&
          !p.awaitingApproval &&
          !p.registrationRejectedAt &&
          !s.exceptions.some(
            (e) =>
              e.playerId === p._id &&
              e.vacation &&
              e.from <= week &&
              e.to >= clubWeek(week).end,
          ),
      ),
  );
  const distance = challengeDistance(s, divisionId),
    title = s.settings[0].titleMaxPosition;
  for (const a of available)
    for (const d of available) {
      const ar = entries.indexOf(a) + 1,
        dr = entries.indexOf(d) + 1;
      if (ar > dr && ar - dr <= distance && (dr !== 1 || ar <= title))
        pairs.push({
          attackerId: a.members[0]._id,
          defenderId: d.members[0]._id,
          attackerKey: a.id,
          defenderKey: d.id,
        });
    }
  const indices = new Map(available.map((t, i) => [t.id, i])),
    edges = pairs.map((p) => ({
      ...p,
      a: indices.get(p.attackerKey)!,
      d: indices.get(p.defenderKey)!,
    }));
  // BigInt avoids truncating team masks to 32 bits. Standard league sizes are 10/12 teams.
  const bit = (i: number) => 1n << BigInt(i),
    full = (1n << BigInt(available.length)) - 1n,
    memo = new Map<bigint, number>();
  function best(mask: bigint): number {
    if (!mask) return 0;
    const saved = memo.get(mask);
    if (saved !== undefined) return saved;
    let i = 0;
    while (!(mask & bit(i))) i++;
    let score = best(mask & ~bit(i));
    for (const e of edges) {
      if (e.a !== i && e.d !== i) continue;
      const j = e.a === i ? e.d : e.a;
      if (mask & bit(j))
        score = Math.max(score, 1 + best(mask & ~bit(i) & ~bit(j)));
    }
    memo.set(mask, score);
    return score;
  }
  const maximum = best(full),
    eligible = edges.filter(
      (e) => 1 + best(full & ~bit(e.a) & ~bit(e.d)) === maximum,
    );
  // An edge is forced only when excluding it reduces the maximum achievable coverage.
  const forced = eligible.filter((e) => {
    const excluded = new Map<bigint, number>();
    function without(mask: bigint): number {
      if (!mask) return 0;
      const saved = excluded.get(mask);
      if (saved !== undefined) return saved;
      let i = 0;
      while (!(mask & bit(i))) i++;
      let score = without(mask & ~bit(i));
      for (const other of edges) {
        if (other === e || (other.a !== i && other.d !== i)) continue;
        const j = other.a === i ? other.d : other.a;
        if (mask & bit(j))
          score = Math.max(score, 1 + without(mask & ~bit(i) & ~bit(j)));
      }
      excluded.set(mask, score);
      return score;
    }
    return without(full) < maximum;
  });
  const round = s.weeklyRounds.find((r) => r.weekStart === week);
  const preferred = round?.dynamicAssignments ?? round?.assignments ?? [];
  const roleFor = (key: string) =>
    preferred.find((r) =>
      entries
        .find((t) => t.id === key)
        ?.members.some((m) => m._id === r.playerId),
    )?.role;
  const choices = new Map<bigint, (typeof edges)[number] | null>(),
    costs = new Map<bigint, number>();
  function minimumChanges(mask: bigint): number {
    if (!mask) return 0;
    const saved = costs.get(mask);
    if (saved !== undefined) return saved;
    let i = 0;
    while (!(mask & bit(i))) i++;
    const target = best(mask),
      rest = mask & ~bit(i);
    let cost = Infinity,
      choice: (typeof edges)[number] | null = null;
    if (best(rest) === target) cost = minimumChanges(rest);
    for (const e of edges) {
      if (e.a !== i && e.d !== i) continue;
      const j = e.a === i ? e.d : e.a;
      if (!(mask & bit(j))) continue;
      const remaining = rest & ~bit(j);
      if (1 + best(remaining) !== target) continue;
      const candidate =
        minimumChanges(remaining) +
        Number(roleFor(e.attackerKey) === "defense") +
        Number(roleFor(e.defenderKey) === "attack");
      if (candidate < cost || (candidate === cost && choice === null)) {
        cost = candidate;
        choice = e;
      }
    }
    costs.set(mask, cost);
    choices.set(mask, choice);
    return cost;
  }
  minimumChanges(full);
  const canonical: DynamicPair[] = [];
  let remaining = full;
  while (remaining) {
    const e = choices.get(remaining);
    if (e) {
      const { a, d, ...pair } = e;
      canonical.push(pair);
      remaining &= ~bit(a) & ~bit(d);
    } else {
      let i = 0;
      while (!(remaining & bit(i))) i++;
      remaining &= ~bit(i);
    }
  }
  return {
    canonical,
    maximumMatches: maximum + fixed.length,
    fixed,
    eligible: eligible.map(({ a, d, ...p }) => p),
    forced: errors.length ? [] : forced.map(({ a, d, ...p }) => p),
    errors,
    teams: entries,
  };
}
const planCache = new WeakMap<
  State,
  Map<
    string,
    { signature: string; plan: ReturnType<typeof computeDynamicWeeklyPlan> }
  >
>();
export function dynamicWeeklyPlan(s: State, divisionId: string, week: string) {
  const key = divisionId + ":" + week;
  const signature = JSON.stringify([
    s.players,
    s.challenges,
    s.exceptions,
    s.settings[0].divisionChallengeDistances,
    s.settings[0].maxPositionsAbove,
    s.settings[0].titleMaxPosition,
    s.weeklyRounds.find((r) => r.weekStart === week)?.assignments,
    s.weeklyRounds.find((r) => r.weekStart === week)?.dynamicAssignments,
  ]);
  let cache = planCache.get(s);
  if (!cache) {
    cache = new Map();
    planCache.set(s, cache);
  }
  const saved = cache.get(key);
  if (saved?.signature === signature) return saved.plan;
  const plan = computeDynamicWeeklyPlan(s, divisionId, week);
  cache.set(key, { signature, plan });
  return plan;
}
export function dynamicRole(s: State, playerId: string, week: string) {
  const p = s.players.find((p) => p._id === playerId);
  if (!p) return;
  const plan = dynamicWeeklyPlan(s, p.divisionId, week),
    team = plan.teams.find((t) => t.members.some((m) => m._id === playerId));
  if (!team) return;
  if (plan.fixed.some((p) => p.attackerKey === team.id))
    return "attack" as const;
  if (plan.fixed.some((p) => p.defenderKey === team.id))
    return "defense" as const;
  if (
    s.weeklyRounds.find((r) => r.weekStart === week)?.weekType !== "OPEN_ATTACK"
  ) {
    if (plan.canonical.some((p) => p.attackerKey === team.id))
      return "attack" as const;
    if (plan.canonical.some((p) => p.defenderKey === team.id))
      return "defense" as const;
  }
  if (plan.eligible.some((p) => p.attackerKey === team.id))
    return "attack" as const;
  if (plan.eligible.some((p) => p.defenderKey === team.id))
    return "defense" as const;
}
export function dynamicTargetReason(
  s: State,
  attackerId: string,
  defenderId: string,
  week: string,
) {
  const p = s.players.find((p) => p._id === attackerId);
  if (!p) return "Dupla inexistente.";
  const plan = dynamicWeeklyPlan(s, p.divisionId, week);
  const a =
    plan.teams.findIndex((t) => t.members.some((m) => m._id === attackerId)) +
    1;
  const d =
    plan.teams.findIndex((t) => t.members.some((m) => m._id === defenderId)) +
    1;
  if (!a || !d) return "As duplas devem pertencer à mesma divisão.";
  if (d >= a || a - d > challengeDistance(s, p.divisionId))
    return "Adversário fora do limite de posições.";
  if (d === 1 && a > s.settings[0].titleMaxPosition)
    return "Posição fora das regras do jogo do título.";
  if (plan.errors.length) return plan.errors[0];
  // The first otherwise valid challenge has regulatory priority, even if it leaves only a partial schedule.
  // Once protected commitments exist, preserve their best achievable remaining coverage.
  if (!plan.fixed.length) return null;
  return plan.eligible.some(
    (e) =>
      plan.teams
        .find((t) => t.id === e.attackerKey)
        ?.members.some((m) => m._id === attackerId) &&
      plan.teams
        .find((t) => t.id === e.defenderKey)
        ?.members.some((m) => m._id === defenderId),
  )
    ? null
    : "Este adversário é necessário para outra dupla. Os papéis foram ajustados para preservar o máximo de jogos da jornada.";
}

/** Teams whose role the dynamic planner would change if these roles were
 * published for the division, so the administrator can adjust them first. */
export function dynamicRoleChanges(
  s: State,
  divisionId: string,
  week: string,
  assignments: { playerId: string; role: "attack" | "defense" }[],
) {
  if (!dynamicWeeklyEnabled(s, divisionId)) return [];
  const preview: State = {
    ...s,
    weeklyRounds: s.weeklyRounds.map((r) =>
      r.weekStart === week
        ? { ...r, assignments, dynamicAssignments: undefined }
        : r,
    ),
  };
  return rankingEntries(s.players, divisionId).flatMap((team) => {
    const published = assignments.find((a) =>
      team.members.some((m) => m._id === a.playerId),
    )?.role;
    const planned = dynamicRole(preview, team.members[0]._id, week);
    return published && planned && planned !== published
      ? [
          {
            team: team.members.map((m) => m.name).join(" + "),
            from: published,
            to: planned,
          },
        ]
      : [];
  });
}
