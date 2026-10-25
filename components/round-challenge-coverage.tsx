"use client";
import { weeklyPublishedAt } from "@/lib/weekly-publication";
import type { View } from "@/lib/types";
import { rankingEntries } from "@/lib/ranking-groups";
import { clubWeek } from "@/lib/calendar";
import type {
  CompetitionTeam,
  CompetitionRound,
} from "@/lib/competition-types";
import { challengeContext } from "@/lib/challenge-access";

export default function RoundChallengeCoverage({
  s,
  round: r,
  weekStart,
  divisionId,
}: {
  s: View;
  round?: CompetitionRound;
  weekStart?: string;
  divisionId?: string;
}) {
  if (s.actor.role !== "admin") return null;
  const weekly = s.weeklyRounds.find((w) => w.weekStart === weekStart);
  const legacyTeams: CompetitionTeam[] = weekly?.teamSnapshot
    ? weekly.teamSnapshot
        .filter((t) => t.divisionId === divisionId)
        .map((t, i) => ({
          id: t.id,
          rank: i + 1,
          active: t.playerIds.every((id) =>
            s.players.some((p) => p._id === id && p.status === "active"),
          ),
          members: t.playerIds.map((id) => ({
            playerId: id,
            name:
              s.players.find((p) => p._id === id)?.name ?? "Jogador removido",
          })),
        }))
    : rankingEntries(s.players, divisionId ?? "").map((t, i) => ({
        id: t.id,
        rank: i + 1,
        active: t.members.every((p) => p.status === "active"),
        members: t.members.map((p) => ({ playerId: p._id, name: p.name })),
      }));
  const context = r
    ? challengeContext(s, r)
    : { teams: legacyTeams, type: weekly?.weekType ?? "NORMAL" };
  const roles =
    r?.roles ??
    Object.fromEntries(
      legacyTeams.map((t) => [
        t.id,
        weekly?.assignments.find((a) =>
          t.members.some((m) => m.playerId === a.playerId),
        )?.role,
      ]),
    );
  const legacyGames = s.challenges.filter(
    (c) =>
      !c.competitionRoundId &&
      c.divisionId === divisionId &&
      (c.weekStart ?? clubWeek(c.createdAt).start) === weekStart,
  );
  const challenges = r
    ? (s.competitionChallenges ?? []).filter((c) => c.roundId === r._id)
    : legacyGames.map((c) => ({
        attackerId: (c.challengerTeam ?? [{ playerId: c.challengerId }])
          .map((m) => m.playerId)
          .sort()
          .join(":"),
        defenderId: (c.defenderTeam ?? [{ playerId: c.defenderId }])
          .map((m) => m.playerId)
          .sort()
          .join(":"),
        status:
          c.status === "schedule_pending" ? "ACCEPTED" : c.status.toUpperCase(),
      }));
  const title = r
    ? `Jornada ${r.number}`
    : `${s.divisions.find((d) => d._id === divisionId)?.name ?? "Liga"} — Semana ${weekStart}`;
  const published = r
    ? !!r.rolesPublishedAt
    : !!weeklyPublishedAt(weekly, divisionId);
  const sent = new Set(challenges.map((c) => c.attackerId)),
    received = new Set(challenges.map((c) => c.defenderId));
  const lists = [
    {
      title: "Duplas que não enviaram desafios",
      teams: context.teams.filter((t) => !sent.has(t.id)),
      direction: "sent",
    },
    {
      title: "Duplas que não receberam desafios",
      teams: context.teams.filter((t) => !received.has(t.id)),
      direction: "received",
    },
  ];
  return (
    <section
      className="card stack"
      aria-label="Participação nos desafios da jornada"
    >
      <h3>Participação nos desafios — {title}</h3>
      <p>
        Submissões desta liga e jornada, incluindo desafios recusados, expirados
        ou cancelados. Ter enviado ou recebido um desafio não significa ter um
        jogo marcado.
      </p>
      {!published && (
        <p>Papéis por publicar — os desafios ainda não estão abertos.</p>
      )}
      <p role="status">
        {
          context.teams.filter((t) => !sent.has(t.id) && !received.has(t.id))
            .length
        }{" "}
        duplas sem qualquer desafio enviado ou recebido.
      </p>
      <div className="form-grid">
        {lists.map((list) => (
          <section
            key={list.direction}
            className="inset stack"
            aria-label={list.title}
          >
            <h4>
              {list.title} ({list.teams.length})
            </h4>
            {list.teams.length === 0 ? (
              <p>
                Todas as duplas já{" "}
                {list.direction === "sent" ? "enviaram" : "receberam"} desafios.
              </p>
            ) : (
              list.teams.map((t) => {
                const role =
                  t.rank === 1
                    ? "DEFESA"
                    : context.type === "OPEN_ATTACK"
                      ? "ATAQUE LIVRE"
                      : roles[t.id] === "attack"
                        ? "ATAQUE"
                        : roles[t.id] === "defense"
                          ? "DEFESA"
                          : "Por atribuir";
                const own = challenges.filter((c) =>
                  [c.attackerId, c.defenderId].includes(t.id),
                );
                const absence =
                  r &&
                  s.competitionAbsences?.some(
                    (a) =>
                      a.competitionId === r.competitionId &&
                      a.divisionId === r.divisionId &&
                      a.teamId === t.id &&
                      (a.roundIds.includes(r._id) ||
                        (a.from < r.endsAt && a.to > r.startsAt)),
                  );
                const official = s.challenges.some(
                  (c) =>
                    (r
                      ? c.competitionRoundId === r._id
                      : !c.competitionRoundId &&
                        c.divisionId === divisionId &&
                        (c.weekStart ?? clubWeek(c.createdAt).start) ===
                          weekStart &&
                        [
                          "scheduled",
                          "result_pending",
                          "disputed",
                          "completed",
                        ].includes(c.status)) &&
                    !["cancelled", "refused", "expired"].includes(c.status) &&
                    [
                      ...(c.challengerTeam ?? [{ playerId: c.challengerId }]),
                      ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
                    ].some((m) =>
                      t.members.some((p) => p.playerId === m.playerId),
                    ),
                );
                return (
                  <div key={t.id} className="stack">
                    <strong>
                      {t.rank}. {t.members.map((m) => m.name).join(" + ")}
                    </strong>
                    <div className="row wrap">
                      <span className="badge">{role}</span>
                      <small>
                        {absence
                          ? "Ausência aprovada"
                          : !t.active ||
                              t.members.some(
                                (m) =>
                                  !s.players.some(
                                    (p) =>
                                      p._id === m.playerId &&
                                      p.status === "active" &&
                                      !p.awaitingApproval &&
                                      !p.registrationRejectedAt,
                                  ),
                              )
                            ? "Dupla inativa / inscrição pendente"
                            : official
                              ? "Já tem jogo oficial"
                              : own.some((c) => c.status === "ACCEPTED")
                                ? "Desafio aceite — aguarda marcação"
                                : own.some((c) => c.status === "PENDING")
                                  ? "Aguarda resposta a desafio"
                                  : own.length
                                    ? "Sem desafio em curso"
                                    : "Sem desafios nesta jornada"}
                      </small>
                    </div>
                    {list.direction === "sent" && role === "DEFESA" && (
                      <small>
                        Em DEFESA, a dupla aguarda desafios e não deve iniciar
                        um.
                      </small>
                    )}
                    {list.direction === "received" &&
                      t.rank === context.teams.length && (
                        <small>A última dupla só pode atacar.</small>
                      )}
                  </div>
                );
              })
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
