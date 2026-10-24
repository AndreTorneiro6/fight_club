import { randomUUID } from "node:crypto";
import type { State, Actor } from "./types";
import { ensure } from "./rules";
import { weeklyOpeningAt } from "./weekly";
import { clubWeek, clubDay, addClubDays } from "./calendar";

export function scheduleWeeklyOpening(
  s: State,
  actor: Actor,
  weekStart: string,
  expectedVersion: number,
  opensAt: string | null,
  reason: string,
  timestamp = Date.now(),
  divisionId?: string,
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem definir a abertura.",
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
    opensAt !== null || !!divisionId,
    "Seleciona uma divisão para aguardar abertura manual.",
  );
  ensure(
    opensAt === null ||
      (Number.isFinite(Date.parse(opensAt)) &&
        Date.parse(opensAt) >= timestamp),
    "Escolhe uma abertura atual ou futura.",
  );
  const canonical = opensAt === null ? null : new Date(opensAt).toISOString();
  ensure(
    weekStart >= clubWeek(timestamp).start &&
      (canonical === null ||
        (clubDay(canonical) >= addClubDays(weekStart, -7) &&
          Date.parse(canonical) <= Date.parse(clubWeek(weekStart).endsAt))),
    "A abertura deve estar entre a semana anterior e o fim da semana dos jogos.",
  );
  ensure(
    !s.challenges.some(
      (c) =>
        (!divisionId || c.divisionId === divisionId) &&
        !c.competitionRoundId &&
        (c.weekStart ?? clubWeek(c.createdAt).start) === weekStart &&
        !["cancelled", "refused", "expired"].includes(c.status),
    ),
    "Já existem desafios nesta semana. Resolve os compromissos antes de alterar a abertura.",
  );
  const previous = divisionId
    ? weeklyOpeningAt(r, divisionId)
    : r.challengesOpenAt;
  if (divisionId) {
    r.divisionChallengeOpenings ??= {};
    r.divisionChallengeOpenings[divisionId] = canonical;
  } else {
    r.challengesOpenAt = canonical!;
  }
  r.version = (r.version ?? 0) + 1;
  delete r.openingNotifiedAt;
  if (!r.publishedAt) {
    delete r.approvedAt;
    delete r.approvedBy;
    delete r.approvedVersion;
    delete r.approvalSnapshot;
  }
  s.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: "week.opening.scheduled",
    details: JSON.stringify({
      weekStart,
      divisionId,
      previous,
      opensAt: canonical,
      reason: reason.trim(),
    }),
    createdAt: new Date(timestamp).toISOString(),
  });
  return { ok: true };
}
export function notifyWeeklyOpenings(s: State, timestamp = Date.now()) {
  const now = new Date(timestamp).toISOString(),
    current = clubWeek(timestamp).start,
    next = addClubDays(current, 7);
  const season = s.seasons.find((season) => season.status === "active");
  if (!season || !s.settings[0].weeklyCompetition) return;
  for (const r of s.weeklyRounds) {
    if (
      !r.publishedAt ||
      ![current, next].includes(r.weekStart) ||
      (r.seasonId && r.seasonId !== season._id)
    )
      continue;
    let created = 0;
    for (const p of s.players.filter(
      (p) =>
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )) {
      const opensAt = weeklyOpeningAt(r, p.divisionId);
      if (!opensAt || opensAt > now) continue;
      const dedupe = `weekly-open:${r.weekStart}:${opensAt}:${p._id}`;
      if (s.notifications.some((n) => n.dedupe === dedupe)) continue;
      created++;
      s.notifications.push({
        _id: randomUUID(),
        playerId: p._id,
        kind: "challenge",
        title: "🥊 Os desafios estão abertos!",
        body: `Já podes desafiar para a semana de ${r.weekStart}. ${r.weekType === "OPEN_ATTACK" ? "SEMANA DE ATAQUE LIVRE — todas as duplas elegíveis podem desafiar acima, exceto o campeão." : "Consulta o teu papel de ATAQUE ou DEFESA e os adversários elegíveis."}`,
        weeklyChallengeOpening: {
          weekStart: r.weekStart,
          opensAt,
          divisionId: p.divisionId,
        },
        deliveryChannels: ["push"],
        createdAt: now,
        read: false,
        dedupe,
      });
    }
    if (!created) continue;
    r.openingNotifiedAt = now;
    s.audit.push({
      _id: randomUUID(),
      userId: "system",
      action: "week.opening.notified",
      details: JSON.stringify({
        weekStart: r.weekStart,
        opensAt: r.challengesOpenAt,
      }),
      createdAt: now,
    });
  }
}
