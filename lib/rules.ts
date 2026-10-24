import {
  challengeSide,
  challengeMemberIds,
  teamPosition,
} from "./team-competition";
import { rankingEntries, teamMembers } from "./ranking-groups";
import { weeklyReason } from "./weekly";
import type { Challenge, Player, Settings, Slot, State } from "./types";

export class LeagueError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function ensure(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new LeagueError(message, status);
}
export const terminal = new Set([
  "completed",
  "cancelled",
  "refused",
  "expired",
]);
export const involves = (c: Challenge, id: string, players?: Player[]) =>
  !!challengeSide(c, id, players);
export function effectiveStatus(c: Challenge, now = Date.now()) {
  if (c.status === "pending" && Date.parse(c.respondBy) < now) return "expired";
  if (
    ["accepted", "schedule_pending"].includes(c.status) &&
    Math.min(Date.parse(c.scheduleBy), Date.parse(c.playBy)) < now
  )
    return "expired";
  if (
    c.status === "scheduled" &&
    c.scheduledAt &&
    Date.parse(c.scheduledAt) <= now &&
    now < Date.parse(c.scheduledAt) + c.durationMinutes * 60000
  )
    return "live";
  return c.status;
}
export function activeChallenges(s: State, id: string, now: number) {
  return s.challenges.filter(
    (c) => involves(c, id, s.players) && !terminal.has(effectiveStatus(c, now)),
  );
}
export function challengeReason(
  s: State,
  me: Player,
  defender: Player,
  now = Date.now(),
  title = false,
): string | null {
  const rules = s.settings[0];
  const weekly = weeklyReason(s, me, defender, now);
  if (weekly) return weekly;
  if (teamMembers(s.players, me._id).some((m) => m._id === defender._id))
    return "Não podes desafiar-te a ti próprio.";
  if (me.status !== "active" || defender.status !== "active")
    return "Jogador indisponível.";
  if (me.divisionId !== defender.divisionId)
    return "Só podes desafiar na tua divisão.";
  const teams = rankingEntries(s.players, me.divisionId),
    aRank = teams.findIndex((t) => t.members.some((m) => m._id === me._id)) + 1,
    dRank =
      teams.findIndex((t) => t.members.some((m) => m._id === defender._id)) + 1;
  if (dRank >= aRank || aRank - dRank > rules.maxPositionsAbove)
    return "Adversário fora do limite de posições.";
  if (dRank === 1 && aRank > rules.titleMaxPosition)
    return "Posição fora das regras do jogo do título.";
  if (title && aRank > rules.titleMaxPosition)
    return "Posição fora das regras de Title Fight.";
  if (
    activeChallenges(s, me._id, now).filter(
      (c) =>
        !rules.weeklyCompetition ||
        c.status !== "pending" ||
        challengeSide(c, me._id, s.players) === "attack",
    ).length >= rules.maxActiveChallenges ||
    activeChallenges(s, defender._id, now).filter(
      (c) => !rules.weeklyCompetition || c.status !== "pending",
    ).length >= rules.maxActiveChallenges
  )
    return "Limite de desafios simultâneos atingido.";
  const previous = s.challenges
    .filter(
      (c) =>
        challengeMemberIds(c, "attack", s.players).includes(me._id) &&
        c.status !== "cancelled",
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (
    previous &&
    Date.parse(previous.createdAt) + rules.minDaysBetween * 86400000 > now
  )
    return "Aguarda o intervalo mínimo entre desafios.";
  if (
    s.challenges.some(
      (c) =>
        !terminal.has(effectiveStatus(c, now)) &&
        involves(c, me._id, s.players) &&
        involves(c, defender._id, s.players),
    )
  )
    return "Já existe um desafio entre estes jogadores.";
  return null;
}
export function compatibleStarts(
  a: Slot[],
  b: Slot[],
  duration: number,
  step: number,
  now = Date.now(),
  deadline = Infinity,
) {
  if (duration <= 0 || step <= 0) return [];
  const values = new Set<string>();
  for (const x of a)
    for (const y of b) {
      const start = Math.max(Date.parse(x.start), Date.parse(y.start), now);
      const end = Math.min(Date.parse(x.end), Date.parse(y.end), deadline);
      for (
        let t = Math.ceil(start / (step * 60000)) * step * 60000;
        t + duration * 60000 <= end;
        t += step * 60000
      )
        values.add(new Date(t).toISOString());
    }
  return [...values].sort();
}
export function canRefuse(s: State, c: Challenge, now = Date.now()) {
  return (
    s.settings[0].refusalRule !== "busy_only" ||
    s.challenges.some(
      (x) =>
        x._id !== c._id &&
        involves(x, c.defenderId, s.players) &&
        [
          "accepted",
          "schedule_pending",
          "scheduled",
          "live",
          "result_pending",
          "disputed",
        ].includes(effectiveStatus(x, now)),
    )
  );
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return Date.parse(a) < Date.parse(d) && Date.parse(c) < Date.parse(b);
}
export function fmtDate(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Lisbon",
      })
    : "Por definir";
}
export function fmtTime(value?: string) {
  return value
    ? new Date(value).toLocaleTimeString("pt-PT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Lisbon",
      })
    : "—";
}
