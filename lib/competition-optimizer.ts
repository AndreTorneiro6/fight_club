import type {
  CompetitionTeam,
  CompetitionPair,
  CompetitionMeeting,
  CompetitionWeights,
} from "./competition-types";
import { defaultCompetitionWeights } from "./competition-types";
export interface OptimizerInput {
  teams: CompetitionTeam[];
  round: number;
  distance: number;
  championPositions: number[];
  history: CompetitionMeeting[];
  unavailable?: string[];
  protectedPairs?: CompetitionPair[];
  priorities?: CompetitionPair[];
  weights?: CompetitionWeights;
  basic?: boolean;
  forbiddenPairs?: string[];
  diagnose?: boolean;
}
export function pairingError(
  a: CompetitionTeam | undefined,
  d: CompetitionTeam | undefined,
  distance: number,
  champions: number[],
) {
  if (!a || !d) return "Equipa inexistente.";
  if (!a.active || !d.active) return "Equipa indisponível.";
  if (a.id === d.id || a.rank <= d.rank)
    return "O atacante tem de estar abaixo do defensor.";
  if (a.rank - d.rank > distance) return "Distância de ataque excedida.";
  if (d.rank === 1 && !champions.includes(a.rank))
    return "Equipa sem elegibilidade para o título.";
  return undefined;
}
export function roleStatistics(
  history: CompetitionMeeting[],
  teamId: string,
  round: number,
) {
  const games = history
    .filter(
      (h) => h.round < round && [h.attackerId, h.defenderId].includes(teamId),
    )
    .sort((a, b) => a.round - b.round);
  const roles = games.map((h) =>
    h.attackerId === teamId ? "attack" : "defense",
  );
  const lastRole = roles.at(-1);
  let streak = 0;
  for (let i = roles.length - 1; i >= 0 && roles[i] === lastRole; i--) streak++;
  return {
    attacks: roles.filter((r) => r === "attack").length,
    defenses: roles.filter((r) => r === "defense").length,
    lastRole,
    streak,
    attacks3: games.filter(
      (h) => h.round >= round - 3 && h.attackerId === teamId,
    ).length,
    defenses3: games.filter(
      (h) => h.round >= round - 3 && h.defenderId === teamId,
    ).length,
    attacks5: games.filter(
      (h) => h.round >= round - 5 && h.attackerId === teamId,
    ).length,
    defenses5: games.filter(
      (h) => h.round >= round - 5 && h.defenderId === teamId,
    ).length,
  };
}
export function optimize(input: OptimizerInput) {
  const { teams, round, distance, championPositions, history } = input,
    weights = input.weights ?? defaultCompetitionWeights;
  const unavailable = new Set(input.unavailable ?? []),
    fixed = input.protectedPairs ?? [];
  const used = new Set<string>(),
    errors: string[] = [];
  for (const p of fixed) {
    const error = pairingError(
      teams.find((t) => t.id === p.attackerId),
      teams.find((t) => t.id === p.defenderId),
      distance,
      championPositions,
    );
    if (error) errors.push(error);
    for (const id of [p.attackerId, p.defenderId]) {
      if (used.has(id) || unavailable.has(id))
        errors.push("Compromisso protegido incompatível.");
      used.add(id);
    }
  }
  if (errors.length)
    return {
      pairs: [],
      unmatched: teams.map((t) => t.id),
      errors,
      warnings: errors,
    };
  const available = teams
    .filter((t) => t.active && !unavailable.has(t.id) && !used.has(t.id))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  if (available.length > 20)
    throw new Error("O otimizador exato suporta até 20 equipas por liga.");
  const edge = (a: CompetitionTeam, d: CompetitionTeam) => {
    const past = history.filter(
      (h) =>
        h.round < round &&
        [h.attackerId, h.defenderId].includes(a.id) &&
        [h.attackerId, h.defenderId].includes(d.id),
    );
    const last = Math.max(0, ...past.map((h) => h.round)),
      consecutive = last === round - 1;
    const ar = roleStatistics(history, a.id, round),
      dr = roleStatistics(history, d.id, round);
    const priority = input.priorities?.some(
      (p) => p.attackerId === a.id && p.defenderId === d.id,
    )
      ? weights.priority
      : 0;
    const cost = input.basic
      ? 0
      : (consecutive ? weights.consecutive : 0) +
        past.filter((h) => h.round >= round - 2).length * weights.recent +
        past.length * weights.frequency +
        (ar.attacks - ar.defenses + dr.defenses - dr.attacks) * weights.role +
        (ar.lastRole === "attack" ? ar.streak : 0) * weights.role +
        (dr.lastRole === "defense" ? dr.streak : 0) * weights.role +
        last;
    return { score: priority - cost, past, last, consecutive };
  };
  type Solution = { count: number; score: number; pairs: CompetitionPair[] };
  const memo = new Map<number, Solution>();
  const solve = (mask: number): Solution => {
    if (!mask) return { count: 0, score: 0, pairs: [] };
    const cached = memo.get(mask);
    if (cached) return cached;
    let i = 0;
    while (!(mask & (1 << i))) i++;
    let best = solve(mask & ~(1 << i));
    for (let j = i + 1; j < available.length; j++) {
      if (!(mask & (1 << j))) continue;
      const d = available[i],
        a = available[j];
      if (
        pairingError(a, d, distance, championPositions) ||
        input.forbiddenPairs?.includes([a.id, d.id].sort().join(":"))
      )
        continue;
      const tail = solve(mask & ~(1 << i) & ~(1 << j)),
        e = edge(a, d),
        candidate = {
          count: tail.count + 1,
          score: tail.score + e.score,
          pairs: [
            {
              attackerId: a.id,
              defenderId: d.id,
              reason: `Distância ${a.rank - d.rank}; ${e.past.length} encontros anteriores; último: ${e.last || "nenhum"}.`,
              warnings: e.consecutive
                ? ["Repetição consecutiva; escolhida pela otimização global."]
                : [],
            },
            ...tail.pairs,
          ],
        };
      if (
        candidate.count > best.count ||
        (candidate.count === best.count && candidate.score > best.score)
      )
        best = candidate;
    }
    memo.set(mask, best);
    return best;
  };
  const result = solve((1 << available.length) - 1),
    pairs = [...fixed, ...result.pairs];
  const covered = new Set(pairs.flatMap((p) => [p.attackerId, p.defenderId]));
  if (input.diagnose !== false && !input.basic)
    for (const p of pairs) {
      const meetings = history.filter(
        (h) =>
          h.round < round &&
          [h.attackerId, h.defenderId].includes(p.attackerId) &&
          [h.attackerId, h.defenderId].includes(p.defenderId),
      );
      if (!meetings.length) continue;
      const protectedEdge = fixed.some(
        (f) => f.attackerId === p.attackerId && f.defenderId === p.defenderId,
      );
      const alternative = protectedEdge
        ? undefined
        : optimize({
            ...input,
            diagnose: false,
            forbiddenPairs: [
              ...(input.forbiddenPairs ?? []),
              [p.attackerId, p.defenderId].sort().join(":"),
            ],
          });
      p.warnings = [
        ...(p.warnings ?? []),
        protectedEdge
          ? "Repetição protegida por compromisso aceite ou bloqueio administrativo."
          : alternative && alternative.pairs.length === pairs.length
            ? "Repetição evitável isoladamente; a solução global pondera variedade, prioridades e papéis."
            : "Repetição inevitável para manter a cobertura máxima com os compromissos protegidos.",
      ];
    }
  return {
    pairs,
    unmatched: teams.filter((t) => !covered.has(t.id)).map((t) => t.id),
    errors: [],
    warnings: pairs.flatMap((p) => p.warnings ?? []),
  };
}
