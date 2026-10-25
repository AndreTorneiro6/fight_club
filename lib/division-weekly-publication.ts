import { randomUUID } from "node:crypto";
import type { State, WeeklyRound } from "./types";
import { ensure } from "./rules";
import { rankingEntries } from "./ranking-groups";
import { weeklyPositionReason } from "./weekly";
import { weeklyPublishedAt } from "./weekly-publication";
import { divisionRankingPublished } from "./round-transition";
import { challengeDistance } from "./challenge-distance";
import { clubWeek } from "./calendar";
export function divisionPaperSignature(
  s: State,
  r: WeeklyRound,
  divisionId: string,
) {
  const teams = rankingEntries(s.players, divisionId);
  const ids = new Set(teams.flatMap((t) => t.members.map((m) => m._id)));
  return JSON.stringify({
    assignments: r.assignments
      .filter((a) => ids.has(a.playerId))
      .sort((a, b) => a.playerId.localeCompare(b.playerId)),
    teams: teams.map((t) =>
      t.members.map((m) => [m._id, m.position, m.status, m.awaitingApproval]),
    ),
    weekType: r.weekType,
    distance: challengeDistance(s, divisionId),
  });
}
export function publishDivisionPapers(
  s: State,
  divisionId: string,
  weekStart: string,
  expectedVersion: number,
  approve: boolean,
  by: string,
  timestamp: number,
) {
  const r = s.weeklyRounds.find((r) => r.weekStart === weekStart);
  ensure(
    r && s.divisions.some((d) => d._id === divisionId),
    "Papéis ou divisão não encontrados.",
  );
  ensure(
    (r.version ?? 0) === expectedVersion,
    "Outro administrador alterou os papéis. Atualiza antes de continuar.",
    409,
  );
  ensure(
    !weeklyPublishedAt(r, divisionId),
    "Os papéis desta divisão já estão publicados.",
  );
  ensure(
    weekStart >= clubWeek(timestamp).start,
    "Escolhe uma semana atual ou futura.",
  );
  for (const team of rankingEntries(s.players, divisionId)) {
    const active = team.members.filter(
      (m) =>
        m.status === "active" &&
        !m.awaitingApproval &&
        !m.registrationRejectedAt,
    );
    if (!active.length) continue;
    const roles = active.map(
      (m) => r.assignments.find((a) => a.playerId === m._id)?.role,
    );
    ensure(
      roles.every(Boolean) && new Set(roles).size === 1,
      "Atribui um único papel a todos os membros de cada dupla.",
    );
    for (const m of active)
      ensure(
        !weeklyPositionReason(s.players, m._id, roles[0]!),
        "Papel incompatível com a posição da dupla.",
      );
  }
  const source = r.divisionTransitions?.[divisionId];
  if (source)
    ensure(
      divisionRankingPublished(s, r.seasonId!, divisionId, source.previousWeek),
      "Publica primeiro o ranking semanal desta divisão.",
    );
  const signature = divisionPaperSignature(s, r, divisionId),
    now = new Date(timestamp).toISOString();
  r.divisionPublications ??= {};
  const publication = (r.divisionPublications[divisionId] ??= {});
  if (approve)
    Object.assign(publication, {
      approvedAt: now,
      approvedBy: by,
      approvalSnapshot: signature,
    });
  else {
    ensure(
      publication.approvedAt && publication.approvalSnapshot === signature,
      "Aprova esta versão dos papéis antes de publicar.",
      409,
    );
    Object.assign(publication, { publishedAt: now, publishedBy: by });
    // The final opening is always an explicit administrator action in a guided transition.
    if (source)
      r.divisionChallengeOpenings = {
        ...r.divisionChallengeOpenings,
        [divisionId]: null,
      };
    for (const a of r.assignments) {
      const p = s.players.find((p) => p._id === a.playerId);
      if (
        !p ||
        p.divisionId !== divisionId ||
        p.status !== "active" ||
        p.awaitingApproval
      )
        continue;
      const dedupe = `division-papers:${weekStart}:${divisionId}:${p._id}`;
      if (s.notifications.some((n) => n.dedupe === dedupe)) continue;
      s.notifications.push({
        _id: randomUUID(),
        playerId: p._id,
        kind: "challenge",
        title: "Papel semanal publicado",
        body: `Semana de ${weekStart}: ${a.role === "attack" ? "Ataque" : "Defesa"}. Consulta os papéis e a abertura dos desafios.`,
        createdAt: now,
        read: false,
        dedupe,
        deliveryChannels: ["push"],
      });
    }
    if (
      s.divisions.every((d) => r.divisionPublications?.[d._id]?.publishedAt)
    ) {
      r.publishedAt = now;
      r.publishedBy = by;
    }
  }
  r.version = (r.version ?? 0) + 1;
  s.audit.push({
    _id: randomUUID(),
    userId: by,
    action: approve ? "week.division.approved" : "week.division.published",
    createdAt: now,
    details: JSON.stringify({ divisionId, weekStart, version: r.version }),
  });
  return { id: r._id };
}
