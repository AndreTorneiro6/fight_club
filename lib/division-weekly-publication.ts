import { matchdayWeekLabel } from "./matchday";
import { randomUUID } from "node:crypto";
import type { State, WeeklyRound, Actor } from "./types";
import { ensure } from "./rules";
import { challengeSide } from "./team-competition";
import { effectiveRoles } from "./effective-roles";
import { rankingEntries } from "./ranking-groups";
import { weeklyPositionReason } from "./weekly";
import { weeklyPublishedAt } from "./weekly-publication";
import { divisionRankingPublished } from "./round-transition";
import { challengeDistance } from "./challenge-distance";
import { clubWeek, clubDay, addClubDays } from "./calendar";
import { weeklyRoleName } from "./weekly-role-rules";
export function divisionPaperSignature(
  s: State,
  r: WeeklyRound,
  divisionId: string,
) {
  const teams = rankingEntries(s.players, divisionId);
  const ids = new Set(teams.flatMap((t) => t.members.map((m) => m._id)));
  return JSON.stringify({
    ouroAllowedOpponents:
      s.divisions.find((d) => d._id === divisionId)?.code === "ouro"
        ? r.ouroAllowedOpponents
        : undefined,
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
  if (weeklyPublishedAt(r, divisionId) && !approve) {
    const draft = r.divisionRoleDrafts?.[divisionId];
    ensure(
      draft,
      "Os papéis já estão publicados. Guarda as alterações antes de republicar.",
    );
    return correctPublishedDivisionPapers(
      s,
      divisionId,
      weekStart,
      expectedVersion,
      draft,
      "Republicação dos papéis guardados pelo administrador.",
      by,
      timestamp,
    );
  }
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
      divisionRankingPublished(
        s,
        r.seasonId!,
        divisionId,
        source.previousWeek,
        timestamp,
      ),
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
    const minutes = r.divisionOpeningDelays?.[divisionId];
    if (
      source ||
      (minutes === undefined &&
        !Object.prototype.hasOwnProperty.call(
          r.divisionChallengeOpenings ?? {},
          divisionId,
        ) &&
        !r.challengesOpenAt)
    ) {
      r.divisionChallengeOpenings = {
        ...r.divisionChallengeOpenings,
        [divisionId]: null,
      };
    } else if (minutes !== undefined) {
      const opensAt = new Date(timestamp + minutes * 60000).toISOString();
      ensure(
        Date.parse(opensAt) <= Date.parse(clubWeek(weekStart).endsAt),
        "O intervalo de abertura ultrapassa o fim da jornada.",
      );
      r.divisionChallengeOpenings = {
        ...r.divisionChallengeOpenings,
        [divisionId]: opensAt,
      };
    }
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
        body: `${matchdayWeekLabel(s, weekStart, divisionId, timestamp)}: ${weeklyRoleName(a.role)}. Consulta os papéis e a abertura dos desafios.`,
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

/** Republish changed roles while preserving committed teams and existing games. */
export function correctPublishedDivisionPapers(
  s: State,
  divisionId: string,
  weekStart: string,
  expectedVersion: number,
  changes: { playerId: string; role: "attack" | "defense" | "super_attack" }[],
  reason: string,
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
    weeklyPublishedAt(r, divisionId),
    "Só é possível corrigir papéis já publicados.",
  );
  ensure(
    weekStart >= clubWeek(timestamp).start,
    "Escolhe uma semana atual ou futura.",
  );
  ensure(
    new Set(changes.map((c) => c.playerId)).size === changes.length,
    "Cada jogador só pode ter um papel.",
  );
  const liveRoles = effectiveRoles(r);
  for (const change of changes) {
    if (
      liveRoles.find((a) => a.playerId === change.playerId)?.role ===
      change.role
    )
      continue;
    const committed = s.challenges.some(
      (c) =>
        c.divisionId === divisionId &&
        !c.competitionRoundId &&
        (c.weekStart ?? clubWeek(c.createdAt).start) === weekStart &&
        !["cancelled", "refused", "expired"].includes(c.status) &&
        challengeSide(c, change.playerId, s.players),
    );
    const reserved = r.manualMatchups?.[divisionId]?.pairs.some(
      (pair) =>
        pair.publishedAt &&
        !pair.challengeId &&
        [pair.challengerId, pair.defenderId].some((id) =>
          rankingEntries(s.players, divisionId).some(
            (team) =>
              team.members.some((m) => m._id === id) &&
              team.members.some((m) => m._id === change.playerId),
          ),
        ),
    );
    ensure(
      !committed && !reserved,
      "Mantém os papéis das equipas que já têm desafios ou jogos obrigatórios nesta semana.",
    );
  }
  ensure(changes.length > 0, "Indica os papéis a corrigir.");
  for (const change of changes)
    ensure(
      s.players.find((p) => p._id === change.playerId)?.divisionId ===
        divisionId && r.assignments.some((a) => a.playerId === change.playerId),
      "Jogador sem papel publicado nesta divisão.",
    );
  const actualChanges = changes.filter(
    (change) =>
      liveRoles.find((a) => a.playerId === change.playerId)?.role !==
      change.role,
  );
  const before = liveRoles.filter((a) =>
    actualChanges.some((c) => c.playerId === a.playerId),
  );
  const nextRoles = liveRoles.map(
    (a) => actualChanges.find((c) => c.playerId === a.playerId) ?? a,
  );
  // Validate the affected teams before applying anything. Untouched historical roles stay intact.
  for (const team of rankingEntries(s.players, divisionId)) {
    if (
      !team.members.some((m) => actualChanges.some((c) => c.playerId === m._id))
    )
      continue;
    const active = team.members.filter(
      (m) =>
        m.status === "active" &&
        !m.awaitingApproval &&
        !m.registrationRejectedAt,
    );
    const roles = active.map(
      (m) => nextRoles.find((a) => a.playerId === m._id)?.role,
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
  r.assignments = r.assignments.map(
    (a) => actualChanges.find((c) => c.playerId === a.playerId) ?? a,
  );
  if (r.dynamicAssignments)
    r.dynamicAssignments = r.dynamicAssignments.map(
      (a) => actualChanges.find((c) => c.playerId === a.playerId) ?? a,
    );
  if (r.divisionRoleDrafts) delete r.divisionRoleDrafts[divisionId];
  r.version = (r.version ?? 0) + 1;
  const now = new Date(timestamp).toISOString();
  for (const change of actualChanges) {
    const old = before.find((b) => b.playerId === change.playerId);
    if (old?.role === change.role) continue;
    s.notifications.push({
      _id: randomUUID(),
      playerId: change.playerId,
      kind: "challenge",
      title: "Papel semanal corrigido",
      body: `${matchdayWeekLabel(s, weekStart, divisionId, timestamp)}: o teu papel passou para ${weeklyRoleName(change.role)}. Consulta os papéis e a abertura dos desafios.`,
      createdAt: now,
      read: false,
      dedupe: `division-papers-correction:${weekStart}:${divisionId}:${r.version}:${change.playerId}`,
      deliveryChannels: ["push"],
    });
  }
  s.audit.push({
    _id: randomUUID(),
    userId: by,
    action: "week.division.corrected",
    createdAt: now,
    details: JSON.stringify({
      divisionId,
      weekStart,
      reason,
      before,
      after: actualChanges,
      version: r.version,
    }),
  });
  return { id: r._id };
}

/** Withdraw an unintended automatic publication only while it has no games.
 * Keep assignments as a private draft and preserve the original in the audit. */
export function withdrawAutomaticDivisionPapers(
  s: State,
  divisionId: string,
  weekStart: string,
  expectedVersion: number,
  reason: string,
  by: string,
  timestamp: number,
) {
  const r = s.weeklyRounds.find((r) => r.weekStart === weekStart);
  ensure(
    r && s.divisions.some((d) => d._id === divisionId),
    "Papéis ou divisão não encontrados.",
  );
  ensure(
    r.version === expectedVersion,
    "A jornada foi alterada. Atualiza antes de continuar.",
    409,
  );
  ensure(
    weekStart >= clubWeek(timestamp).start,
    "Escolhe uma semana atual ou futura.",
  );
  const publication = r.divisionPublications?.[divisionId];
  ensure(
    publication?.publishedAt &&
      publication.publishedBy === "system:weekly-turnover",
    "Só é possível retirar uma publicação automática.",
  );
  ensure(reason.trim().length >= 10, "Indica o motivo da reposição.");
  ensure(
    !s.challenges.some(
      (c) =>
        c.divisionId === divisionId &&
        (c.weekStart ?? clubWeek(c.createdAt).start) === weekStart &&
        !["cancelled", "refused", "expired"].includes(c.status),
    ),
    "Já existem desafios nesta semana; é necessária revisão administrativa.",
    409,
  );
  const before = structuredClone(r);
  const playerIds = new Set([
    ...s.players.filter((p) => p.divisionId === divisionId).map((p) => p._id),
    ...(r.teamSnapshot ?? [])
      .filter((t) => t.divisionId === divisionId)
      .flatMap((t) => t.playerIds),
  ]);
  const notices = s.notifications.filter(
    (n) =>
      n.dedupe?.startsWith(`division-papers:${weekStart}:${divisionId}:`) ||
      (n.weeklyChallengeOpening?.weekStart === weekStart &&
        n.weeklyChallengeOpening.divisionId === divisionId),
  );
  const notificationIds = notices.map((n) => n._id);
  const removed = new Set(notificationIds);
  s.notifications = s.notifications.filter((n) => !removed.has(n._id));
  delete r.divisionPublications![divisionId];
  delete r.publishedAt;
  delete r.publishedBy;
  delete r.approvedAt;
  delete r.approvedBy;
  delete r.approvedVersion;
  delete r.approvalSnapshot;
  r.divisionChallengeOpenings = {
    ...r.divisionChallengeOpenings,
    [divisionId]: null,
  };
  if (r.divisionOpeningDelays) delete r.divisionOpeningDelays[divisionId];
  r.dynamicAssignments = r.dynamicAssignments?.filter(
    (a) => !playerIds.has(a.playerId),
  );
  r.version = (r.version ?? 0) + 1;
  s.audit.push({
    _id: randomUUID(),
    userId: by,
    action: "week.division.automatic-publication.withdrawn",
    createdAt: new Date(timestamp).toISOString(),
    details: JSON.stringify({
      divisionId,
      weekStart,
      reason,
      before,
      notices,
      version: r.version,
    }),
  });
  return { notificationIds, version: r.version };
}

/** Schedules the publication of a division's weekly papers. */
export function scheduleDivisionPapersPublication(
  s: State,
  actor: Actor,
  weekStart: string,
  expectedVersion: number,
  publishesAt: string | null,
  reason: string,
  timestamp = Date.now(),
  divisionId: string,
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem agendar a publicação dos papéis.",
    403,
  );
  const r = s.weeklyRounds.find((r) => r.weekStart === weekStart);
  ensure(r, "Papéis semanais não encontrados.", 404);
  ensure(
    Number.isInteger(expectedVersion) && (r.version ?? 0) === expectedVersion,
    "Outro administrador alterou os papéis. Atualiza antes de continuar.",
    409,
  );
  ensure(
    typeof reason === "string" &&
      reason.trim().length >= 3 &&
      reason.length <= 2000,
    "Indica o motivo da alteração.",
  );
  ensure(
    !divisionId || s.divisions.some((d) => d._id === divisionId),
    "Divisão inválida.",
  );
  ensure(
    publishesAt !== null || !!divisionId,
    "Seleciona uma divisão para aguardar publicação manual.",
  );
  ensure(
    publishesAt === null ||
      (Number.isFinite(Date.parse(publishesAt)) &&
        Date.parse(publishesAt) >= timestamp),
    "Escolhe uma publicação atual ou futura.",
  );
  if (publishesAt !== null)
    for (const [d, source] of Object.entries(r.divisionTransitions ?? {})) {
      if (divisionId && divisionId !== d) continue;
      ensure(
        divisionRankingPublished(
          s,
          r.seasonId!,
          d,
          source.previousWeek,
          timestamp,
        ),
        "Publica primeiro o ranking semanal desta divisão.",
      );
    }
  const canonical =
    publishesAt === null ? null : new Date(publishesAt).toISOString();
  ensure(
    weekStart >= clubWeek(timestamp).start &&
      (canonical === null ||
        (clubDay(canonical) >= addClubDays(weekStart, -7) &&
          Date.parse(canonical) <= Date.parse(clubWeek(weekStart).endsAt))),
    "A publicação deve estar entre a semana anterior e o fim da semana dos jogos.",
  );
  const previous =
    r.divisionPublications?.[divisionId]?.publishedAt ??
    r.divisionPublications?.[divisionId]?.approvedAt;
  r.divisionPublications ??= {};
  const pub = (r.divisionPublications[divisionId] ??= {});
  if (canonical !== null) {
    pub.scheduledAt = canonical;
  } else {
    delete pub.scheduledAt;
  }
  r.version = (r.version ?? 0) + 1;
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "week.division.publication.scheduled",
    details: JSON.stringify({
      weekStart,
      divisionId,
      previous,
      publishesAt: canonical,
      reason: reason.trim(),
    }),
    createdAt: new Date(timestamp).toISOString(),
  });
  return { ok: true };
}

/** Configures a countdown delay for automatic publication of a division's weekly papers. */
export function configureDivisionPapersPublicationDelay(
  s: State,
  actor: Actor,
  input: {
    weekStart: string;
    divisionId: string;
    expectedVersion: number;
    minutes: number;
    activate: boolean;
    reason: string;
  },
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem configurar a contagem de publicação.",
    403,
  );
  const r = s.weeklyRounds.find((r) => r.weekStart === input.weekStart);
  ensure(r, "Papéis semanais não encontrados.", 404);
  ensure(
    s.divisions.some((d) => d._id === input.divisionId),
    "Divisão inválida.",
  );
  ensure(
    Number.isInteger(input.minutes) &&
      input.minutes >= 0 &&
      input.minutes <= 10080,
    "Intervalo inválido.",
  );
  ensure(
    (r.version ?? 0) === input.expectedVersion,
    "Outro administrador alterou os papéis. Atualiza antes de continuar.",
    409,
  );
  ensure(input.reason.trim().length >= 3, "Indica o motivo.");
  const publication = r.divisionPublications?.[input.divisionId];
  if (publication?.approvedAt) {
    ensure(input.activate, "Confirma a ativação da contagem.");
    scheduleDivisionPapersPublication(
      s,
      actor,
      input.weekStart,
      input.expectedVersion,
      new Date(timestamp + input.minutes * 60000).toISOString(),
      input.reason,
      timestamp,
      input.divisionId,
    );
  } else {
    ensure(!input.activate, "Aprova os papéis antes de ativar a contagem.");
    r.version = (r.version ?? 0) + 1;
  }
  r.divisionPublicationDelays = {
    ...r.divisionPublicationDelays,
    [input.divisionId]: input.minutes,
  };
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "week.division.publication.delay.configured",
    createdAt: new Date(timestamp).toISOString(),
    details: JSON.stringify({
      ...input,
      publishesAt: publication?.approvedAt
        ? r.divisionPublications?.[input.divisionId]?.scheduledAt
        : null,
    }),
  });
  return { ok: true, version: r.version };
}
