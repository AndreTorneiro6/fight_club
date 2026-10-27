import { randomUUID } from "node:crypto";
import { challengeMemberIds, teamPosition } from "./team-competition";
import { teamMembers } from "./ranking-groups";
import type { Challenge, Result, State } from "./types";

export function resultPositions(s: State, c: Challenge) {
  return s.players
    .filter((p) => p.divisionId === c.divisionId)
    .map((p) => ({ playerId: p._id, position: p.position }));
}
export function resultTeamRanks(s: State, c: Challenge) {
  return {
    attacker: teamPosition(s.players, c.challengerId),
    defender: teamPosition(s.players, c.defenderId),
  };
}
/** Undo/reapply only a provable, untouched direct swap. Later ranking changes are preserved. */
export function reconcileResultRanking(
  s: State,
  c: Challenge,
  result: Result,
  winnerId: string,
  at: string,
  movable: (id: string) => boolean,
) {
  if (c.competitionRoundId) return "managed";
  if ((result.rankingEffect?.model ?? s.settings[0].rankingModel) !== "swap")
    return "manual_review";
  const attack = challengeMemberIds(c, "attack", s.players),
    defense = challengeMemberIds(c, "defense", s.players);
  if (attack.length !== defense.length) return "manual_review";
  const members = [...attack, ...defense];
  for (const [id, ids] of [
    [c.challengerId, attack],
    [c.defenderId, defense],
  ] as const) {
    const current = teamMembers(s.players, id)
      .map((p) => p._id)
      .sort();
    if (JSON.stringify(current) !== JSON.stringify([...ids].sort()))
      return "manual_review";
  }
  let effect = result.rankingEffect;
  if (!effect) {
    const history = s.history.filter(
      (h) =>
        h.challengeId === c._id &&
        h.createdAt === result.confirmedAt &&
        h.reason === "Resultado da dupla — troca de posição",
    );
    if (
      !history.length ||
      new Set(history.map((h) => h.playerId)).size !== members.length ||
      members.some((id) => !history.some((h) => h.playerId === id))
    )
      return "manual_review";
    effect = {
      model: "swap",
      before: history.map((h) => ({
        playerId: h.playerId,
        position: h.oldPosition,
      })),
      after: history.map((h) => ({
        playerId: h.playerId,
        position: h.newPosition,
      })),
    };
  }
  const before = new Map(effect.before.map((p) => [p.playerId, p.position]));
  const after = new Map(effect.after.map((p) => [p.playerId, p.position]));
  if (
    members.some(
      (id) =>
        !before.has(id) ||
        !after.has(id) ||
        s.players.find((p) => p._id === id)?.divisionId !== c.divisionId,
    )
  )
    return "manual_review";
  // Any subsequent movement, even if later reversed, needs explicit review.
  if (
    s.history.some(
      (h) =>
        members.includes(h.playerId) &&
        h.createdAt > (result.rankingReconciledAt ?? result.confirmedAt) &&
        h.reason !== "Correção de resultado — ranking reconciliado",
    )
  )
    return "manual_review";
  if (
    members.some(
      (id) => s.players.find((p) => p._id === id)!.position !== after.get(id),
    )
  )
    return "manual_review";
  const desired = new Map(before);
  const attackSlots = attack.map((id) => before.get(id)!).sort((a, b) => a - b),
    defenseSlots = defense.map((id) => before.get(id)!).sort((a, b) => a - b);
  const shouldSwap =
    winnerId === c.challengerId &&
    Math.min(...attackSlots) > Math.min(...defenseSlots) &&
    (!c.titleFight || s.settings[0].titleAffectsRanking);
  if (shouldSwap) {
    for (const [team, slots] of [
      [attack, defenseSlots],
      [defense, attackSlots],
    ] as const)
      [...team]
        .sort((a, b) => before.get(a)! - before.get(b)!)
        .forEach((id, i) => desired.set(id, slots[i]));
  }
  const changed = members.filter((id) => desired.get(id) !== after.get(id));
  if (changed.some((id) => !movable(id))) return "manual_review";
  const baseline = s.players.map((p) => ({
    ...p,
    position: before.get(p._id) ?? p.position,
  }));
  const beforeRanks = {
    attacker: teamPosition(baseline, c.challengerId),
    defender: teamPosition(baseline, c.defenderId),
  };
  const priorRanks = new Map(
    members.map((id) => [id, teamPosition(s.players, id)]),
  );
  for (const id of changed) {
    const p = s.players.find((p) => p._id === id)!;
    const previous = p.position;
    const oldTeamPosition = priorRanks.get(id);
    p.previousPosition = previous;
    p.position = desired.get(id)!;
    s.history.push({
      _id: randomUUID(),
      playerId: id,
      divisionId: c.divisionId,
      oldPosition: previous,
      newPosition: p.position,
      oldTeamPosition,
      reason: "Correção de resultado — ranking reconciliado",
      challengeId: c._id,
      createdAt: at,
    });
  }
  const ranks = resultTeamRanks(s, c);
  for (const h of s.history.filter(
    (h) =>
      h.challengeId === c._id &&
      h.createdAt === at &&
      h.reason === "Correção de resultado — ranking reconciliado",
  ))
    h.newTeamPosition = attack.includes(h.playerId)
      ? ranks.attacker
      : ranks.defender;
  result.rankingEffect = {
    ...effect,
    after: effect.after.map((p) => ({
      ...p,
      position: desired.get(p.playerId) ?? p.position,
    })),
  };
  result.rankingOutcome = { before: beforeRanks, after: ranks };
  result.rankingReconciledAt = at;
  return changed.length ? "reconciled" : "unchanged";
}
