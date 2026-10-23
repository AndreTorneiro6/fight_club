"use client";
import ChallengeTimeProposal from "./challenge-time-proposal";
import { sameRoles } from "@/lib/role-proposals";
import { useState } from "react";
import type { View } from "@/lib/types";
import type { CompetitionRound } from "@/lib/competition-types";
import {
  competitionPriorities,
  challengeContext,
  eligibleChallengeTargets,
} from "@/lib/challenge-access";

type Props = {
  s: View;
  round: CompetitionRound;
  busy?: boolean;
  run: (command: unknown, message?: string) => Promise<unknown>;
};
export function RoundRoles({ s, round: r, run, busy }: Props) {
  const e = challengeContext(s, r);
  const [roles, setRoles] = useState<Record<string, "attack" | "defense">>(
    r.roles ??
      Object.fromEntries(
        e.teams.map((t) => [
          t.id,
          t.rank !== 1 && (t.rank === e.teams.length || t.rank % 2 === 0)
            ? "attack"
            : "defense",
        ]),
      ),
  );
  const official = (s.competitionSchedules ?? []).some(
    (q) => q.roundId === r._id && q.status === "PUBLISHED",
  );
  const preview = r.rolesPublishedAt
    ? r
    : { ...r, roles, roleSnapshot: e.teams, rolesPublishedAt: "preview" };
  const name = (id: string) =>
    e.teams
      .find((t) => t.id === id)
      ?.members.map((m) => m.name)
      .join(" + ") ?? id;
  return (
    <div className="card stack">
      <h3>Papéis e acesso aos desafios</h3>
      <p role="status">
        {r.rolesPublishedAt
          ? "PUBLICADO"
          : r.rolesApprovedAt && r.rolesApprovedVersion === r.version
            ? "APROVADO — aguarda publicação"
            : "RASCUNHO — aguarda aprovação"}
      </p>
      {r.rolesGeneratedAt && (
        <small>
          Proposta gerada{" "}
          {r.rolesGeneratedBy === "system"
            ? "automaticamente"
            : "pelo administrador"}{" "}
          · {new Date(r.rolesGeneratedAt).toLocaleString("pt-PT")}
        </small>
      )}
      {r.rolesWarnings?.map((w) => (
        <p key={w}>{w}</p>
      ))}
      <details>
        <summary>Histórico de papéis das jornadas anteriores</summary>
        {(s.competitionRounds ?? [])
          .filter(
            (p) =>
              p.competitionId === r.competitionId &&
              p.divisionId === r.divisionId &&
              p.number < r.number,
          )
          .sort((a, b) => b.number - a.number)
          .map((p) => (
            <div className="inset stack" key={p._id}>
              <strong>
                Jornada {p.number} ·{" "}
                {p.rolesPublishedAt
                  ? "Publicado"
                  : p.rolesApprovedAt
                    ? "Aprovado"
                    : "Rascunho"}
                {p.settledAt ? " · Concluída" : ""}
              </strong>
              {(p.roleSnapshot ?? e.teams).map((t) => (
                <small key={t.id}>
                  {t.members.map((m) => m.name).join(" + ")}:{" "}
                  {p.roles?.[t.id] === "attack"
                    ? "ATAQUE"
                    : p.roles?.[t.id] === "defense"
                      ? "DEFESA"
                      : "Por atribuir"}
                </small>
              ))}
            </div>
          ))}
        {!(s.competitionRounds ?? []).some(
          (p) =>
            p.competitionId === r.competitionId &&
            p.divisionId === r.divisionId &&
            p.number < r.number,
        ) && <p>Sem jornadas anteriores.</p>}
      </details>
      <p>
        {r.rolesPublishedAt
          ? "Papéis publicados — os jogadores podem escolher adversários elegíveis."
          : "Rascunho privado — publica os papéis para abrir o acesso aos desafios."}{" "}
        Os jogos continuam sujeitos a aprovação e publicação separadas.
      </p>
      <p>
        Prioridades regulamentares:{" "}
        {competitionPriorities(s, r)
          .map(
            (c) =>
              `${name(c.attackerId)} → ${name(c.defenderId)} (${c.priorityReason})`,
          )
          .join("; ") || "Sem desafios pendentes"}
      </p>
      {e.type === "OPEN_ATTACK" && (
        <p>
          <strong>SEMANA DE ATAQUE LIVRE</strong> — todas as duplas elegíveis
          podem iniciar desafios, exceto o campeão.
        </p>
      )}
      {e.teams.map((t) => (
        <div className="inset stack" key={t.id}>
          <label>
            {t.rank}. {name(t.id)}{" "}
            <select
              aria-label={`Papel de ${name(t.id)}`}
              disabled={busy || !!r.rolesPublishedAt || r.locked || official}
              value={roles[t.id] ?? ""}
              onChange={(ev) =>
                setRoles({
                  ...roles,
                  [t.id]: ev.target.value as "attack" | "defense",
                })
              }
            >
              <option value="">Selecionar</option>
              <option value="attack" disabled={t.rank === 1}>
                ATAQUE
              </option>
              <option value="defense" disabled={t.rank === e.teams.length}>
                DEFESA
              </option>
            </select>
          </label>
          {
            <small>
              {r.rolesPublishedAt
                ? "Adversários elegíveis:"
                : "Pré-visualização dos adversários:"}{" "}
              {eligibleChallengeTargets(s, preview, t.id)
                .map((t) => `${t.rank}. ${name(t.id)}`)
                .join("; ") || "Nenhum"}{" "}
              · Desafios recebidos:{" "}
              {
                (s.competitionChallenges ?? []).filter(
                  (c) =>
                    c.roundId === r._id &&
                    c.defenderId === t.id &&
                    c.status === "PENDING",
                ).length
              }
            </small>
          }
        </div>
      ))}
      {!r.rolesPublishedAt && (
        <div className="row wrap">
          <button
            disabled={busy || r.locked || official}
            onClick={() =>
              run(
                {
                  type: "competition.roles.generate",
                  roundId: r._id,
                  expectedVersion: r.version,
                },
                "Proposta automática de papéis gerada",
              )
            }
          >
            Gerar proposta de papéis
          </button>
          <button
            disabled={busy || r.locked || official}
            onClick={() =>
              run(
                {
                  type: "competition.roles.save",
                  roundId: r._id,
                  expectedVersion: r.version,
                  roles,
                  publish: false,
                },
                "Rascunho de papéis guardado",
              )
            }
          >
            Guardar papéis
          </button>
          <button
            disabled={busy || r.locked || official}
            onClick={async () => {
              const saved = await run(
                {
                  type: "competition.roles.save",
                  roundId: r._id,
                  expectedVersion: r.version,
                  roles,
                  publish: false,
                },
                "Rascunho guardado",
              );
              if (saved)
                await run(
                  {
                    type: "competition.roles.approve",
                    roundId: r._id,
                    expectedVersion: r.version + 1,
                  },
                  "Papéis aprovados; aguardam publicação",
                );
            }}
          >
            Aprovar papéis
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              r.locked ||
              official ||
              !r.rolesApprovedAt ||
              r.rolesApprovedVersion !== r.version ||
              !sameRoles(roles, r.roles ?? {})
            }
            onClick={() =>
              run(
                {
                  type: "competition.roles.save",
                  roundId: r._id,
                  expectedVersion: r.version,
                  roles,
                  publish: true,
                },
                "Papéis publicados",
              )
            }
          >
            Publicar ATAQUE / DEFESA
          </button>
        </div>
      )}
      {r.rolesPublishedAt && (
        <button
          disabled={busy || r.locked || !!r.settledAt || official}
          onClick={() => {
            const reason = window.prompt(
              "Motivo obrigatório para bloquear ou reabrir desafios",
            );
            if (reason)
              void run(
                {
                  type: "competition.challenges.control",
                  roundId: r._id,
                  expectedVersion: r.version,
                  blocked: !r.challengesBlocked,
                  reason,
                },
                "Acesso aos desafios atualizado",
              );
          }}
        >
          {r.challengesBlocked ? "Reabrir desafios" : "Bloquear desafios"}
        </button>
      )}
    </div>
  );
}
export function PlayerRoundChallenges({ s, round: r, run, busy }: Props) {
  const e = challengeContext(s, r),
    own = e.teams.find((t) =>
      t.members.some((m) => m.playerId === s.actor.playerId),
    );
  const name = (id: string) =>
    e.teams
      .find((t) => t.id === id)
      ?.members.map((m) => m.name)
      .join(" + ") ?? id;
  const published = (s.competitionSchedules ?? []).some(
    (q) => q.roundId === r._id && q.status === "PUBLISHED" && !q.incremental,
  );
  const attack =
    !!r.rolesPublishedAt &&
    !!own &&
    own.rank !== 1 &&
    (e.type === "OPEN_ATTACK" || r.roles?.[own.id] === "attack");
  const ownChallenges = (s.competitionChallenges ?? []).filter(
    (c) =>
      c.roundId === r._id &&
      own &&
      [c.attackerId, c.defenderId].includes(own.id),
  );
  const occupied = ownChallenges.some((c) =>
    ["ACCEPTED", "SCHEDULED", "COMPLETED"].includes(c.status),
  );
  const pending = ownChallenges.some(
    (c) => c.attackerId === own?.id && c.status === "PENDING",
  );
  const eligible = own
    ? eligibleChallengeTargets(s, r, own.id).filter(
        (t) =>
          !r.challengeTargets || r.challengeTargets[own.id]?.includes(t.id),
      )
    : [];
  const closed =
    Date.now() < Date.parse(r.opensAt) ||
    Date.now() >= Date.parse(r.closesAt) ||
    r.locked ||
    r.challengesBlocked ||
    !!r.settledAt;
  const labels: Record<string, string> = {
    PENDING: "A aguardar resposta",
    ACCEPTED: "Aceite — aguarda aprovação e publicação",
    REJECTED: "Recusado",
    EXPIRED: "Expirado",
    CANCELLED: "Cancelado",
    SCHEDULED: "Jogo oficial publicado",
    COMPLETED: "Concluído",
  };
  return (
    <>
      <div className="card stack">
        <h2>
          {!r.rolesPublishedAt
            ? "OS MEUS DESAFIOS"
            : attack
              ? "🥊 OS MEUS DESAFIOS — MODO ATAQUE"
              : "🛡️ OS MEUS DESAFIOS — MODO DEFESA"}
        </h2>
        <p>
          Ranking: {own?.rank ?? "—"} · Jornada {r.number} · Distância máxima:{" "}
          {e.distance} posições.
        </p>
        {!r.rolesPublishedAt ? (
          <p>
            A aguardar a publicação dos papéis da jornada pelo administrador.
          </p>
        ) : (
          <>
            {!attack && (
              <p>
                Esta jornada estás em modo DEFESA. Aguarda pelos desafios das
                duplas elegíveis.
              </p>
            )}
            {r.challengesBlocked && (
              <p>Desafios bloqueados pela organização.</p>
            )}
            {occupied && (
              <p>
                A tua dupla já tem um compromisso nesta jornada. Um desafio
                aceite só se torna oficial após aprovação e publicação
                administrativa.
              </p>
            )}
            {pending && (
              <p>
                Já enviaste um desafio. Aguarda a resposta antes de iniciar
                outro.
              </p>
            )}
            {attack && !occupied && !pending && !published && (
              <>
                <h3>Duplas em DEFESA disponíveis</h3>
                {eligible.map((t) => {
                  const previous = s.challenges
                    .filter(
                      (c) =>
                        c.status === "completed" &&
                        [
                          ...(c.challengerTeam ?? [
                            { playerId: c.challengerId },
                          ]),
                          ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
                        ].some((m) =>
                          t.members.some((p) => p.playerId === m.playerId),
                        ) &&
                        [
                          ...(c.challengerTeam ?? [
                            { playerId: c.challengerId },
                          ]),
                          ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
                        ].some((m) =>
                          own?.members.some((p) => p.playerId === m.playerId),
                        ),
                    )
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
                  return (
                    <div className="inset stack" key={t.id}>
                      <strong>
                        {t.rank}. {name(t.id)}
                      </strong>
                      <small>
                        Disponível para desafio
                        {r.challengePendingCounts?.[t.id]
                          ? ` · ${r.challengePendingCounts[t.id]} desafio(s) pendente(s), sujeito a prioridade`
                          : ""}{" "}
                        · Último encontro:{" "}
                        {previous
                          ? new Date(
                              previous.scheduledAt ?? previous.createdAt,
                            ).toLocaleDateString("pt-PT")
                          : "Ainda não se defrontaram"}
                      </small>
                      <button
                        disabled={busy || closed}
                        onClick={() =>
                          run(
                            {
                              type: "competition.challenge.submit",
                              roundId: r._id,
                              defenderId: t.id,
                            },
                            "Desafio enviado; aguarda resposta",
                          )
                        }
                      >
                        DESAFIAR
                      </button>
                    </div>
                  );
                })}
                {!eligible.length && (
                  <p role="status">
                    Não existem duplas disponíveis para desafiar nesta jornada.
                    A organização será notificada.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
      <div className="card stack">
        <h3>Desafios recebidos e enviados</h3>
        {!ownChallenges.length && <p>Sem desafios nesta jornada.</p>}
        {ownChallenges.map((c) => (
          <div className="inset stack" key={c._id}>
            <strong>
              {c.attackerRank}. {name(c.attackerId)} → {c.defenderRank}.{" "}
              {name(c.defenderId)}
            </strong>
            <p>
              {labels[c.status]} {c.invalidReason}
            </p>
            <small>
              Enviado: {new Date(c.createdAt).toLocaleString("pt-PT")} ·
              Responder até: {new Date(c.respondBy).toLocaleString("pt-PT")}
            </small>
            <p>
              Prioridade:{" "}
              {c.priorityReason ??
                (c.priorityEligible
                  ? "Desafio prioritário"
                  : c.status === "PENDING"
                    ? "Aguarda avaliação regulamentar"
                    : "Resposta registada")}
            </p>
            {c.responseNote && (
              <p>Resposta / proposta de horário: {c.responseNote}</p>
            )}
            <ChallengeTimeProposal
              key={`${c._id}:${c.timeVersion ?? 0}`}
              s={s}
              round={r}
              challenge={c}
              run={run}
              busy={busy}
            />
            {c.defenderId === own?.id &&
              c.status === "PENDING" &&
              !published &&
              (!attack || e.type === "OPEN_ATTACK") && (
                <div className="row wrap">
                  <button
                    disabled={
                      busy ||
                      !!r.challengesBlocked ||
                      r.locked ||
                      Date.now() >= Date.parse(c.respondBy) ||
                      !c.priorityEligible ||
                      !!c.invalidReason ||
                      occupied
                    }
                    onClick={() =>
                      run(
                        {
                          type: "competition.challenge.respond",
                          challengeId: c._id,
                          accept: true,
                        },
                        "Desafio aceite; aguarda publicação administrativa",
                      )
                    }
                  >
                    ACEITAR DESAFIO
                  </button>
                  <button
                    disabled={
                      busy ||
                      !!r.challengesBlocked ||
                      r.locked ||
                      Date.now() >= Date.parse(c.respondBy) ||
                      !!c.invalidReason ||
                      occupied
                    }
                    onClick={() => {
                      const note = window.prompt(
                        "Resposta ou proposta de horário (não confirma o jogo)",
                      );
                      if (note)
                        void run(
                          {
                            type: "competition.challenge.note",
                            challengeId: c._id,
                            note,
                          },
                          "Resposta enviada",
                        );
                    }}
                  >
                    RESPONDER / PROPOR HORÁRIO
                  </button>
                  <button
                    disabled={
                      busy ||
                      !!r.challengesBlocked ||
                      r.locked ||
                      Date.now() >= Date.parse(c.respondBy) ||
                      !c.priorityEligible ||
                      !!c.invalidReason ||
                      occupied
                    }
                    onClick={() => {
                      const reason = window.prompt(
                        "Motivo obrigatório da recusa",
                      );
                      if (reason)
                        void run(
                          {
                            type: "competition.challenge.respond",
                            challengeId: c._id,
                            accept: false,
                            reason,
                          },
                          "Recusa registada",
                        );
                    }}
                  >
                    RECUSAR DESAFIO
                  </button>
                </div>
              )}
            <details>
              <summary>Histórico de respostas</summary>
              {c.decisions.map((d, i) => (
                <p key={i}>
                  {new Date(d.at).toLocaleString("pt-PT")} · {d.action}
                </p>
              ))}
            </details>
          </div>
        ))}
      </div>
    </>
  );
}
