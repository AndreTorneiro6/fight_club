import { randomUUID } from "node:crypto";
import type { State, Notification } from "./types";
const hour = 3600000;
export const responseReminderHours = [12, 6, 3, 1] as const;
export function responseDeadlineText(deadline: string) {
  return new Date(deadline).toLocaleString("pt-PT", {
    timeZone: "Europe/Lisbon",
    dateStyle: "short",
    timeStyle: "short",
  });
}
export function responseWindowText(createdAt: string, respondBy: string) {
  const hours = (Date.parse(respondBy) - Date.parse(createdAt)) / hour;
  return `${hours} horas${hours > 0 && hours % 24 === 0 ? ` (${hours / 24} ${hours === 24 ? "dia" : "dias"})` : ""}`;
}
/** After worker downtime choose only the nearest outstanding milestone, not a burst
 * of every missed reminder. Deadlines, not mutable settings, remain authoritative. */
export function responseReminderStage(
  createdAt: string,
  respondBy: string,
  at: number,
) {
  const remaining = Date.parse(respondBy) - at,
    duration = Date.parse(respondBy) - Date.parse(createdAt);
  if (remaining <= 0 || at < Date.parse(createdAt)) return;
  return responseReminderHours
    .filter((h) => duration > h * hour && remaining <= h * hour)
    .at(-1);
}
type ResponseNotice = {
  id: string;
  createdAt: string;
  respondBy: string;
  label: string;
  defenderIds: string[];
  participantIds: string[];
  challengeId?: string;
  competitionNotice?: boolean;
};
export function notifyResponseReminder(
  s: State,
  c: ResponseNotice,
  at: number,
) {
  const stage = responseReminderStage(c.createdAt, c.respondBy, at);
  if (!stage) return;
  const minutes = Math.max(
      1,
      Math.ceil((Date.parse(c.respondBy) - at) / 60000),
    ),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  const remaining = h
    ? `${h} ${h === 1 ? "hora" : "horas"}${m ? ` e ${m} min` : ""}`
    : `${minutes} min`;
  for (const playerId of new Set(c.defenderIds)) {
    const dedupe = `response-deadline:${c.id}:${c.respondBy}:${stage}:${playerId}`;
    if (s.notifications.some((n) => n.dedupe === dedupe)) continue;
    s.notifications.push({
      _id: randomUUID(),
      playerId,
      kind: "reminder",
      responseDeadline: {
        id: c.id,
        managed: !!c.competitionNotice,
        respondBy: c.respondBy,
        status: "pending",
      },
      title: "Lembrete — desafio por responder",
      body: `${c.label}. Faltam ${remaining} para aceitares ou recusares o desafio. Prazo: ${responseDeadlineText(c.respondBy)} (Portugal). Consulta o desafio e a prioridade regulamentar.`,
      challengeId: c.challengeId,
      competitionNotice: c.competitionNotice,
      createdAt: new Date(at).toISOString(),
      read: false,
      dedupe,
      deliveryChannels: ["push"],
    });
  }
}
export function notifyResponseExpired(s: State, c: ResponseNotice, at: number) {
  for (const playerId of new Set(c.participantIds)) {
    const dedupe = `response-expired:${c.id}:${c.respondBy}:${playerId}`;
    if (s.notifications.some((n) => n.dedupe === dedupe)) continue;
    s.notifications.push({
      _id: randomUUID(),
      playerId,
      kind: "update",
      responseDeadline: {
        id: c.id,
        managed: !!c.competitionNotice,
        respondBy: c.respondBy,
        status: "expired",
      },
      title: "Desafio expirado — prazo de resposta terminou",
      body: `${c.label}. O prazo para aceitar ou recusar terminou em ${responseDeadlineText(c.respondBy)} (Portugal), sem resposta. O desafio expirou; consulta a organização.`,
      challengeId: c.challengeId,
      competitionNotice: c.competitionNotice,
      createdAt: new Date(at).toISOString(),
      read: false,
      dedupe,
      deliveryChannels: ["push"],
    });
  }
}

/** Rechecked immediately before a delayed provider send. */
export function responseNoticeIsCurrent(
  n: Notification,
  source: { status: string; respondBy: string } | null,
  at: number,
) {
  const expected = n.responseDeadline;
  if (!expected) return true;
  if (
    !source ||
    source.respondBy !== expected.respondBy ||
    source.status.toLowerCase() !== expected.status
  )
    return false;
  return expected.status === "pending"
    ? Date.parse(source.respondBy) > at
    : Date.parse(source.respondBy) <= at;
}
