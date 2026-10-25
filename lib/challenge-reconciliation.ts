import { createHash } from "node:crypto";
import { clubWeek } from "./calendar";
import {
  challengeMemberIds,
  challengeParticipants,
  challengeTeamName,
} from "./team-competition";
import { rankingEntries } from "./ranking-groups";
import type { Challenge, State } from "./types";

export type ReconciliationState = Pick<
  State,
  "players" | "challenges" | "divisions" | "matches" | "results"
>;
export type ReconciliationScope = {
  seasonId: string;
  weekStart: string;
  divisionId?: string;
};
export const reconciliationExplanation =
  "A competição funciona por dupla, não por jogador. Uma falha na identificação dos parceiros permitiu desafios incompatíveis. Nesta correção mantém-se o primeiro envio válido por dupla e cancelam-se os pedidos posteriores incompatíveis, sem derrota nem alteração do ranking. Ambos os parceiros podem consultar e gerir o mesmo desafio. Abre Desafios e volta a confirmar o estado da tua dupla.";

/** One-off chronological repair, not a change to the normal pending-queue/rotation rules. */
export function planChallengeReconciliation(
  s: ReconciliationState,
  input: ReconciliationScope,
  timestamp = Date.now(),
) {
  const scope: ReconciliationScope = {
    seasonId: input.seasonId,
    weekStart: input.weekStart,
    ...(input.divisionId ? { divisionId: input.divisionId } : {}),
  };
  const inScope = (c: Challenge) =>
    c.seasonId === scope.seasonId &&
    (c.weekStart ?? clubWeek(c.createdAt).start) === scope.weekStart &&
    (!scope.divisionId || c.divisionId === scope.divisionId);
  const rows = s.challenges
    .filter(inScope)
    .sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.number - b.number ||
        a._id.localeCompare(b._id),
    );
  const kept: {
    id: string;
    number: number;
    attacker: string;
    defender: string;
    status: string;
    createdAt: string;
  }[] = [];
  const cancelled: {
    id: string;
    number: number;
    attacker: string;
    defender: string;
    retainedId: string;
    retainedNumber: number;
    reason: string;
    createdAt: string;
  }[] = [];
  const review: { id: string; number: number; reason: string }[] = [];
  const skipped: { id: string; number: number; reason: string }[] = [];
  const retained = new Map<string, Challenge>();
  const participants = (c: Challenge) => challengeParticipants(c, s.players);
  const describe = (c: Challenge) => ({
    id: c._id,
    number: c.number,
    attacker: challengeTeamName(c, c.challengerId, s.players),
    defender: challengeTeamName(c, c.defenderId, s.players),
    createdAt: c.createdAt,
  });
  const protectedMatch = (c: Challenge) =>
    c.status !== "pending" ||
    !!c.scheduledAt ||
    !!c.scheduleProposal ||
    !!c.officialPublication ||
    !!c.courtPayments?.some((p) => p.paid) ||
    s.matches.some((m) => m.challengeId === c._id) ||
    s.results.some((r) => r.challengeId === c._id);
  for (const c of rows) {
    if (
      ["cancelled", "refused", "expired"].includes(c.status) ||
      (c.status === "pending" && Date.parse(c.respondBy) <= timestamp)
    ) {
      skipped.push({
        id: c._id,
        number: c.number,
        reason: "Pedido encerrado ou fora do prazo; não é reaberto.",
      });
      continue;
    }
    if (c.competitionRoundId) {
      review.push({
        id: c._id,
        number: c.number,
        reason:
          "Jornada gerida: usar o processo de revisão oficial, sem alterar compromissos publicados.",
      });
      continue;
    }
    const a = challengeMemberIds(c, "attack", s.players),
      d = challengeMemberIds(c, "defense", s.players);
    const identityError =
      [...a, ...d].some(
        (id) =>
          !s.players.some((p) => p._id === id && p.divisionId === c.divisionId),
      ) ||
      a.some((id) => d.includes(id)) ||
      !Number.isFinite(Date.parse(c.createdAt)) ||
      !Number.isFinite(Date.parse(c.respondBy));
    const rosterTeams = rankingEntries(s.players, c.divisionId);
    const ambiguous = [a, d].some((ids) => {
      const t = rosterTeams.find((t) =>
        t.members.some((p) => p._id === ids[0]),
      );
      return (
        !t ||
        t.members
          .map((p) => p._id)
          .sort()
          .join(":") !== [...ids].sort().join(":")
      );
    });
    if (identityError || ambiguous) {
      review.push({
        id: c._id,
        number: c.number,
        reason:
          "Identidade da dupla ou datas incompatíveis; é necessária revisão administrativa.",
      });
      continue;
    }
    const blockers = [
      ...new Set(
        participants(c)
          .map((id) => retained.get(id))
          .filter((v): v is Challenge => !!v),
      ),
    ];
    if (!blockers.length) {
      kept.push({ ...describe(c), status: c.status });
      for (const id of participants(c)) retained.set(id, c);
      continue;
    }
    const first = blockers.sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.number - b.number ||
        a._id.localeCompare(b._id),
    )[0];
    if (protectedMatch(c)) {
      review.push({
        id: c._id,
        number: c.number,
        reason: `Compromisso já aceite, com horário ou resultado, em conflito com o envio anterior #${first.number}. Não será cancelado automaticamente.`,
      });
      continue;
    }
    cancelled.push({
      ...describe(c),
      retainedId: first._id,
      retainedNumber: first.number,
      reason: `A dupla já está envolvida no desafio anterior #${first.number}. Cancelamento administrativo de pedido posterior incompatível; sem derrota nem alteração do ranking.`,
    });
  }
  const recipients = s.players.filter(
    (p) =>
      p.status === "active" &&
      !p.awaitingApproval &&
      !p.registrationRejectedAt &&
      (!scope.divisionId || p.divisionId === scope.divisionId),
  );
  const notificationDrafts = recipients
    .sort((a, b) => a._id.localeCompare(b._id))
    .map((p) => {
      const ownKept = kept.filter((k) =>
        participants(rows.find((c) => c._id === k.id)!).includes(p._id),
      );
      const ownCancelled = cancelled.filter((k) =>
        participants(rows.find((c) => c._id === k.id)!).includes(p._id),
      );
      return {
        playerId: p._id,
        name: p.name,
        title: "Revê os desafios da tua dupla",
        body: [
          reconciliationExplanation,
          ownKept.length
            ? `Mantido: ${ownKept.map((c) => `#${c.number}`).join(", ")}.`
            : "",
          ownCancelled.length
            ? `Cancelados: ${ownCancelled.map((c) => `#${c.number} (mantido #${c.retainedNumber})`).join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" "),
        challengeId: ownKept[0]?.id ?? ownCancelled[0]?.id,
      };
    });
  const payload = {
    policy: "FIRST_SUBMISSION_TEAM_SLOT_V1",
    scope,
    kept,
    cancelled,
    review,
    skipped,
    notificationDrafts,
  };
  // Include current commitments and identities, not just the selected cancellations, to reject stale reviews.
  const basis = {
    payload,
    rows: rows.map((c) => ({
      id: c._id,
      number: c.number,
      season: c.seasonId,
      division: c.divisionId,
      attacker: c.challengerId,
      defender: c.defenderId,
      attackerTeam: c.challengerTeam,
      defenderTeam: c.defenderTeam,
      createdAt: c.createdAt,
      respondBy: c.respondBy,
      week: c.weekStart,
      status: c.status,
      managed: c.competitionRoundId,
      publication: c.officialPublication,
      scheduledAt: c.scheduledAt,
      proposal: c.scheduleProposal,
      paidCourt: !!c.courtPayments?.some((p) => p.paid),
    })),
    players: s.players
      .map((p) => ({
        id: p._id,
        division: p.divisionId,
        partner: p.partner,
        partnerId: p.partnerId,
        position: p.position,
        status: p.status,
        name: p.name,
        awaitingApproval: p.awaitingApproval,
        rejected: p.registrationRejectedAt,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    matches: s.matches
      .map((m) => ({ _id: m._id, challengeId: m.challengeId }))
      .filter((m) => rows.some((c) => c._id === m.challengeId))
      .sort((a, b) => a._id.localeCompare(b._id)),
    results: s.results
      .map((r) => ({ _id: r._id, challengeId: r.challengeId }))
      .filter((r) => rows.some((c) => c._id === r.challengeId))
      .sort((a, b) => a._id.localeCompare(b._id)),
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(basis))
    .digest("hex");
  return {
    ...payload,
    fingerprint,
    generatedAt: new Date(timestamp).toISOString(),
    canApply: review.length === 0 && kept.length > 0,
  };
}
