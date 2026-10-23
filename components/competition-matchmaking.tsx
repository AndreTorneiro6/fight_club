"use client";
import RoundChallengeCoverage from "./round-challenge-coverage";
import ChallengeTimeProposal from "./challenge-time-proposal";
import { RoundRoles, PlayerRoundChallenges } from "./round-challenge-roles";
import { useState } from "react";
import { statusLabels, type View } from "@/lib/types";
import type {
  CompetitionPair,
  CompetitionRound,
  CompetitionSchedule,
} from "@/lib/competition-types";
import { defaultCompetitionWeights } from "@/lib/competition-types";
import { roleStatistics } from "@/lib/competition-optimizer";
import type { CompetitionMeeting } from "@/lib/competition-types";
import { rankingEntries } from "@/lib/ranking-groups";
const seasonStatusLabels = {
  active: "ativa",
  paused: "pausada",
  draft: "em preparação",
  completed: "concluída",
} as const;
const competitionLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  APPROVED: "Aprovado",
  PUBLISHED: "Publicado",
  PENDING: "A aguardar resposta",
  ACCEPTED: "Aceite",
  REJECTED: "Recusado",
  EXPIRED: "Expirado",
  SCHEDULED: "Publicado",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};
type Props = {
  s: View;
  run: (command: unknown, message?: string) => Promise<unknown>;
  busy?: boolean;
};
const fieldStyle = { display: "grid", gap: 5 } as const;
const formStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))",
  gap: 16,
} as const;
function iso(value: FormDataEntryValue | null) {
  return new Date(String(value)).toISOString();
}
function value(data: FormData, key: string) {
  return String(data.get(key) ?? "");
}
function effective(s: View, r: CompetitionRound) {
  const rawConfig = s.competitionConfigurations?.find(
    (c) => c._id === r.competitionId,
  );
  const config = rawConfig
    ? {
        ...rawConfig,
        championPositions:
          rawConfig.leagueOverrides?.[r.divisionId]?.championPositions ??
          rawConfig.championPositions,
      }
    : undefined;
  const publication = s.competitionSchedules
    ?.filter((q) => q.roundId === r._id && q.status === "PUBLISHED")
    .sort((a, b) => b.revision - a.revision)[0];
  return {
    config,
    distance:
      publication?.effectiveDistance ??
      r.distanceOverride ??
      config?.leagueDistances[r.divisionId] ??
      config?.defaultDistance ??
      2,
    type:
      publication?.weekType ??
      r.weekType ??
      ((r.number === 1 && config?.firstOpen) ||
      (r.number === config?.officialRounds && config?.finalOpen)
        ? "OPEN_ATTACK"
        : "NORMAL"),
  };
}
export function CompetitionMatchmaking({ s, run, busy }: Props) {
  const [configurationId, setConfigurationId] = useState("");
  const configurations = s.competitionConfigurations ?? [];
  const config =
    configurationId === "new"
      ? undefined
      : (configurations.find((c) => c._id === configurationId) ??
        configurations.find((c) => c.enabled) ??
        configurations[0]);
  const selectedSeason = s.seasons.find(
    (season) => season._id === config?.seasonId,
  );
  const [divisionId, setDivision] = useState(s.divisions[0]?._id ?? "");
  const rounds = (s.competitionRounds ?? [])
    .filter(
      (r) => r.divisionId === divisionId && r.competitionId === config?._id,
    )
    .sort((a, b) => a.number - b.number);
  const [roundId, setRound] = useState("");
  const round = rounds.find((r) => r._id === roundId) ?? rounds.at(-1);
  const schedules = (s.competitionSchedules ?? [])
    .filter((q) => q.roundId === round?._id)
    .sort((a, b) => b.revision - a.revision);
  const proposal =
    schedules.find((q) => q.status !== "PUBLISHED" && !q.supersededBy) ??
    schedules[0];
  const teams = rankingEntries(s.players, divisionId);
  const name = (id: string) =>
    teams
      .find((t) => t.id === id)
      ?.members.map((m) => m.name)
      .join(" + ") ??
    proposal?.snapshot
      .find((t) => t.id === id)
      ?.members.map((m) => m.name)
      .join(" + ") ??
    id;
  const [editRound, setEditRound] = useState(false);
  const send = (command: unknown, message: string) => run(command, message);
  return (
    <section
      className="stack competition-management"
      aria-label="Fight Club matchmaking"
    >
      <div className="card">
        <h2>FIGHT CLUB — COMPETIÇÃO E JORNADAS</h2>
        <p>
          O algoritmo propõe. O administrador revê, aprova e publica. As
          propostas são privadas.
        </p>
        <label style={fieldStyle}>
          Competição
          <select
            value={configurationId === "new" ? "new" : (config?._id ?? "new")}
            onChange={(event) => {
              setConfigurationId(event.target.value);
              setRound("");
              setEditRound(false);
            }}
          >
            {configurations.map((entry) => (
              <option key={entry._id} value={entry._id}>
                {s.seasons.find((season) => season._id === entry.seasonId)
                  ?.name ?? entry.seasonId}
                {" — época "}
                {
                  seasonStatusLabels[
                    s.seasons.find((season) => season._id === entry.seasonId)
                      ?.status ?? "draft"
                  ]
                }
              </option>
            ))}
            <option value="new">Criar competição para outra época</option>
          </select>
        </label>
        {selectedSeason && (
          <p role="status">
            <strong>Época {seasonStatusLabels[selectedSeason.status]}</strong> ·{" "}
            {selectedSeason.name}
          </p>
        )}
        <p>
          <strong>
            {!config
              ? "Competição por jornadas ainda não configurada"
              : config.enabled
                ? "Competição por jornadas ativada"
                : "Competição por jornadas por ativar"}
          </strong>
        </p>
        {config && !config.enabled && (
          <p>
            A época e a competição por jornadas têm estados independentes.
            Ativar a época não publica papéis nem abre desafios. Para usar
            jornadas, ativa a opção nas Definições da competição e configura as
            respetivas datas.
          </p>
        )}

        <details>
          <summary>Definições da competição</summary>
          <form
            key={`config-${config?._id ?? "new"}-${config?.version ?? 0}`}
            style={formStyle}
            onSubmit={async (event) => {
              event.preventDefault();
              const d = new FormData(event.currentTarget);
              const distances = Object.fromEntries(
                s.divisions.map((l) => [
                  l._id,
                  Number(d.get(`distance-${l._id}`)),
                ]),
              );
              const saved = await send(
                {
                  type: "competition.config.save",
                  competitionId: config?._id,
                  expectedVersion: config?.version ?? 0,
                  seasonId: value(d, "seasonId"),
                  enabled: d.has("enabled"),
                  officialRounds: Number(d.get("rounds")),
                  defaultDistance: Number(d.get("distance")),
                  leagueDistances: distances,
                  championPositions: value(d, "champions")
                    .split(",")
                    .map(Number),
                  responseHours: Number(d.get("responseHours")),
                  recoveryRequiresAbsence: d.has("recoveryRequiresAbsence"),
                  roleWarningThreshold: Number(d.get("roleWarningThreshold")),
                  opponentWarningThreshold: Number(
                    d.get("opponentWarningThreshold"),
                  ),
                  leagueOverrides: Object.fromEntries(
                    s.divisions.map((l) => [
                      l._id,
                      {
                        championPositions: value(d, `champions-${l._id}`)
                          .split(",")
                          .map(Number),
                        responseHours: Number(d.get(`response-${l._id}`)),
                        recoveryRequiresAbsence: d.has(
                          `recovery-absence-${l._id}`,
                        ),
                        roleWarningThreshold: Number(
                          d.get(`role-threshold-${l._id}`),
                        ),
                        opponentWarningThreshold: Number(
                          d.get(`opponent-threshold-${l._id}`),
                        ),
                        weights: Object.fromEntries(
                          Object.entries(defaultCompetitionWeights).map(
                            ([key, def]) => [
                              key,
                              Number(d.get(`weight-${l._id}-${key}`) ?? def),
                            ],
                          ),
                        ),
                      },
                    ]),
                  ),
                  firstOpen: d.has("firstOpen"),
                  finalOpen: d.has("finalOpen"),
                  weights: Object.fromEntries(
                    Object.entries(defaultCompetitionWeights).map(
                      ([key, def]) => [
                        key,
                        Number(d.get(`weight-${key}`) ?? def),
                      ],
                    ),
                  ),
                },
                "Definições guardadas",
              );
              if (
                saved &&
                typeof saved === "object" &&
                "competitionId" in saved &&
                typeof saved.competitionId === "string"
              )
                setConfigurationId(saved.competitionId);
            }}
          >
            <label style={fieldStyle}>
              Época
              <select
                name="seasonId"
                defaultValue={
                  config?.seasonId ??
                  s.seasons.find((a) => a.status === "active")?._id
                }
              >
                {s.seasons.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Jornadas oficiais
              <input
                name="rounds"
                type="number"
                min="1"
                max="52"
                defaultValue={config?.officialRounds ?? 10}
                required
              />
            </label>
            <label style={fieldStyle}>
              Distância geral
              <input
                name="distance"
                type="number"
                min="1"
                max="19"
                defaultValue={config?.defaultDistance ?? 2}
                required
              />
            </label>
            {s.divisions.map((l) => (
              <label key={l._id} style={fieldStyle}>
                Distância — {l.name}
                <input
                  name={`distance-${l._id}`}
                  type="number"
                  min="1"
                  max={Math.max(1, rankingEntries(s.players, l._id).length - 1)}
                  defaultValue={
                    config?.leagueDistances[l._id] ??
                    config?.defaultDistance ??
                    2
                  }
                  required
                />
              </label>
            ))}
            <label style={fieldStyle}>
              Posições que podem desafiar o campeão
              <input
                name="champions"
                defaultValue={(config?.championPositions ?? [2, 3]).join(",")}
                required
              />
            </label>
            <label style={fieldStyle}>
              Horas para responder
              <input
                type="number"
                name="responseHours"
                min="1"
                max="720"
                defaultValue={config?.responseHours ?? 48}
              />
            </label>
            <label style={fieldStyle}>
              Avisar após sequência do mesmo papel
              <input
                type="number"
                min="1"
                max="20"
                name="roleWarningThreshold"
                defaultValue={config?.roleWarningThreshold ?? 3}
              />
            </label>
            <label style={fieldStyle}>
              Avisar após encontros repetidos em 5 jornadas
              <input
                type="number"
                min="1"
                max="20"
                name="opponentWarningThreshold"
                defaultValue={config?.opponentWarningThreshold ?? 2}
              />
            </label>
            <label>
              <input
                type="checkbox"
                name="firstOpen"
                defaultChecked={config?.firstOpen ?? true}
              />{" "}
              Primeira jornada: ataque livre
            </label>
            <label>
              <input
                type="checkbox"
                name="finalOpen"
                defaultChecked={config?.finalOpen ?? true}
              />{" "}
              Última jornada: ataque livre
            </label>
            <label>
              <input
                type="checkbox"
                name="recoveryRequiresAbsence"
                defaultChecked={config?.recoveryRequiresAbsence ?? false}
              />{" "}
              Exigir ausência aprovada para recuperar um jogo adiado
            </label>
            <label>
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={config?.enabled ?? false}
              />{" "}
              Ativar após revisão das regras e simulação
            </label>
            {Object.entries(defaultCompetitionWeights).map(([key, def]) => (
              <label key={key} style={fieldStyle}>
                Peso{" "}
                {
                  (
                    {
                      consecutive: "repetição consecutiva",
                      recent: "adversários recentes",
                      frequency: "frequência de encontros",
                      role: "equilíbrio de papéis",
                      priority: "prioridade de desafios",
                    } as Record<string, string>
                  )[key]
                }
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  name={`weight-${key}`}
                  defaultValue={
                    config?.weights[
                      key as keyof typeof defaultCompetitionWeights
                    ] ?? def
                  }
                />
              </label>
            ))}
            {s.divisions.map((l) => (
              <details key={`override-${l._id}`}>
                <summary>Regras independentes — {l.name}</summary>
                <label>
                  <input
                    type="checkbox"
                    name={`recovery-absence-${l._id}`}
                    defaultChecked={
                      config?.leagueOverrides?.[l._id]
                        ?.recoveryRequiresAbsence ??
                      config?.recoveryRequiresAbsence ??
                      false
                    }
                  />{" "}
                  Exigir ausência aprovada para recuperação
                </label>
                <label style={fieldStyle}>
                  Posições elegíveis para o título
                  <input
                    name={`champions-${l._id}`}
                    defaultValue={(
                      config?.leagueOverrides?.[l._id]?.championPositions ??
                      config?.championPositions ?? [2, 3]
                    ).join(",")}
                    required
                  />
                </label>
                <label style={fieldStyle}>
                  Horas para resposta
                  <input
                    type="number"
                    min="1"
                    max="720"
                    name={`response-${l._id}`}
                    defaultValue={
                      config?.leagueOverrides?.[l._id]?.responseHours ??
                      config?.responseHours ??
                      48
                    }
                  />
                </label>
                <label style={fieldStyle}>
                  Limiar de sequência do papel
                  <input
                    type="number"
                    min="1"
                    max="20"
                    name={`role-threshold-${l._id}`}
                    defaultValue={
                      config?.leagueOverrides?.[l._id]?.roleWarningThreshold ??
                      config?.roleWarningThreshold ??
                      3
                    }
                  />
                </label>
                <label style={fieldStyle}>
                  Limiar de encontros em 5 jornadas
                  <input
                    type="number"
                    min="1"
                    max="20"
                    name={`opponent-threshold-${l._id}`}
                    defaultValue={
                      config?.leagueOverrides?.[l._id]
                        ?.opponentWarningThreshold ??
                      config?.opponentWarningThreshold ??
                      2
                    }
                  />
                </label>
                {Object.entries(defaultCompetitionWeights).map(([key, def]) => (
                  <label style={fieldStyle} key={key}>
                    Peso {key}
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      name={`weight-${l._id}-${key}`}
                      defaultValue={
                        config?.leagueOverrides?.[l._id]?.weights?.[
                          key as keyof typeof defaultCompetitionWeights
                        ] ??
                        config?.weights[
                          key as keyof typeof defaultCompetitionWeights
                        ] ??
                        def
                      }
                    />
                  </label>
                ))}
              </details>
            ))}
            <button disabled={busy}>Guardar definições</button>
          </form>
        </details>
      </div>
      <div className="card">
        <div style={formStyle}>
          <label style={fieldStyle}>
            Liga
            <select
              value={divisionId}
              onChange={(e) => {
                setDivision(e.target.value);
                setRound("");
                setEditRound(false);
              }}
            >
              {s.divisions.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            Jornada
            <select
              value={round?._id ?? ""}
              onChange={(e) => {
                setRound(e.target.value);
                setEditRound(false);
              }}
            >
              {rounds.map((r) => (
                <option key={r._id} value={r._id}>
                  Jornada {r.number}
                  {r.settledAt ? " — liquidada" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="button" onClick={() => setEditRound((v) => !v)}>
          Criar semana especial / editar jornada futura
        </button>
        {editRound && config && (
          <RoundForm
            key={round?._id ?? "new"}
            configId={config._id}
            divisionId={divisionId}
            round={round}
            maxRounds={config.officialRounds}
            busy={busy}
            run={run}
          />
        )}
        {!config && <p>Guarda primeiro as definições da competição.</p>}
      </div>
      {round && (
        <>
          <div className="card">
            <h3>
              Jornada {round.number} ·{" "}
              {effective(s, round).type === "OPEN_ATTACK"
                ? "SEMANA DE ATAQUE LIVRE"
                : "SEMANA NORMAL"}
            </h3>
            <p>
              Distância máxima: {effective(s, round).distance} posições.{" "}
              {round.instructions}
            </p>
            <p>
              {proposal ? competitionLabels[proposal.status] : "Sem proposta"} ·
              versão {proposal?.version ?? 0} · {proposal?.pairs.length ?? 0}{" "}
              jogos ·{" "}
              {(proposal?.snapshot.length ?? teams.length) -
                (proposal?.unmatched.length ?? teams.length)}{" "}
              equipas cobertas
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                disabled={busy || round.locked || !config?.enabled}
                onClick={() =>
                  send(
                    {
                      type: "competition.generate",
                      roundId: round._id,
                      scheduleId:
                        proposal?.status !== "PUBLISHED"
                          ? proposal?._id
                          : undefined,
                      expectedVersion:
                        proposal?.status !== "PUBLISHED"
                          ? (proposal?.version ?? 0)
                          : 0,
                      preserveLocks: true,
                    },
                    "Proposta gerada — revê antes de aprovar",
                  )
                }
              >
                {proposal ? "Regenerar restantes jogos" : "Gerar confrontos"}
              </button>
              {proposal && proposal.status !== "PUBLISHED" && (
                <>
                  <button
                    disabled={busy}
                    onClick={() =>
                      send(
                        {
                          type: "competition.validate",
                          scheduleId: proposal._id,
                          expectedVersion: proposal.version,
                        },
                        "Validação concluída",
                      )
                    }
                  >
                    Validar calendário
                  </button>
                  <button
                    disabled={busy || proposal.errors.length > 0}
                    onClick={() =>
                      send(
                        {
                          type: "competition.approve",
                          scheduleId: proposal._id,
                          expectedVersion: proposal.version,
                        },
                        "Versão aprovada",
                      )
                    }
                  >
                    Aprovar calendário
                  </button>
                  <button
                    disabled={busy || proposal.status !== "APPROVED"}
                    onClick={() =>
                      send(
                        {
                          type: "competition.publish",
                          scheduleId: proposal._id,
                          expectedVersion: proposal.version,
                        },
                        "Jornada publicada",
                      )
                    }
                  >
                    Publicar calendário
                  </button>
                </>
              )}
              {proposal?.status === "PUBLISHED" && (
                <button
                  disabled={busy || round.locked}
                  onClick={() => {
                    const reason = window.prompt(
                      "Motivo obrigatório da alteração publicada",
                    );
                    if (reason)
                      void send(
                        {
                          type: "competition.amend",
                          scheduleId: proposal._id,
                          expectedVersion: proposal.version,
                          reason,
                        },
                        "Revisão privada criada",
                      );
                  }}
                >
                  Criar alteração controlada
                </button>
              )}
              <button
                disabled={
                  busy ||
                  !schedules.some((q) => q.status === "PUBLISHED") ||
                  round.locked
                }
                onClick={() =>
                  send(
                    {
                      type: "competition.round.lock",
                      roundId: round._id,
                      expectedVersion: round.version,
                    },
                    "Jornada bloqueada",
                  )
                }
              >
                Bloquear jornada
              </button>
              <button
                disabled={busy || !!round.settledAt}
                onClick={() =>
                  send(
                    {
                      type: "competition.settle",
                      roundId: round._id,
                      expectedVersion: round.version,
                    },
                    "Ranking liquidado por trocas diretas",
                  )
                }
              >
                Liquidar resultados e ranking
              </button>
            </div>
            <p>
              Ao editar uma versão aprovada, a aprovação é anulada. Publicar é
              sempre uma ação separada.
            </p>
            {proposal?.unmatched.length ? (
              <p role="status">
                Equipas sem jogo: {proposal.unmatched.map(name).join("; ")}.
                Ausências, compromissos aceites ou limites podem impedir um
                calendário completo.
              </p>
            ) : null}
            {proposal?.errors.map((e, i) => (
              <p role="alert" key={i}>
                Erro: {e}
              </p>
            ))}
            {proposal?.warnings.map((e, i) => (
              <p key={i}>Aviso: {e}</p>
            ))}
          </div>
          {proposal && (
            <ScheduleEditor
              key={`${proposal._id}:${proposal.version}`}
              q={proposal}
              s={s}
              run={run}
              busy={busy}
            />
          )}
          <RoundRoles
            key={`${round._id}:${round.version}`}
            s={s}
            round={round}
            run={run}
            busy={busy}
          />
          <RoundChallengeCoverage s={s} round={round} />
          <div className="card">
            <h3>Desafios e prioridades</h3>
            <p role="status">
              {
                (s.competitionChallenges ?? []).filter(
                  (c) => c.roundId === round._id && c.status === "PENDING",
                ).length
              }{" "}
              aguardam aceitação/recusa ·{" "}
              {
                (s.competitionChallenges ?? []).filter(
                  (c) => c.roundId === round._id && c.status === "ACCEPTED",
                ).length
              }{" "}
              aceites ·{" "}
              {
                (s.competitionChallenges ?? []).filter(
                  (c) =>
                    c.roundId === round._id &&
                    c.timeProposal?.status === "AWAITING_ADMIN",
                ).length
              }{" "}
              horários aguardam decisão do clube
            </p>
            {(s.competitionChallenges ?? [])
              .filter((c) => c.roundId === round._id)
              .map((c) => (
                <div className="inset stack" key={c._id}>
                  {name(c.attackerId)} → {name(c.defenderId)} ·{" "}
                  {competitionLabels[c.status]} ·{" "}
                  {new Date(c.createdAt).toLocaleString("pt-PT")}{" "}
                  {c.priorityReason}{" "}
                  {c.status === "PENDING" && (
                    <p>
                      A aguardar aceitação ou recusa da dupla defensora até{" "}
                      {new Date(c.respondBy).toLocaleString("pt-PT", {
                        timeZone: "Europe/Lisbon",
                      })}
                      .
                    </p>
                  )}
                  {c.responseNote && (
                    <p>Resposta / proposta de horário: {c.responseNote}</p>
                  )}
                  <ChallengeTimeProposal
                    key={`${c._id}:${c.timeVersion ?? 0}`}
                    s={s}
                    round={round}
                    challenge={c}
                    run={run}
                    busy={busy}
                  />
                  {c.invalidReason && <strong> — {c.invalidReason}</strong>}{" "}
                  {["ACCEPTED", "PENDING"].includes(c.status) && (
                    <button
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt(
                          "Motivo obrigatório para cancelar este compromisso",
                        );
                        if (reason)
                          void send(
                            {
                              type: "competition.challenge.cancel",
                              challengeId: c._id,
                              reason,
                            },
                            "Desafio cancelado com registo",
                          );
                      }}
                    >
                      Resolver / cancelar
                    </button>
                  )}
                  <details>
                    <summary>Histórico de respostas e intervenções</summary>
                    {c.decisions.map((d, i) => (
                      <p key={i}>
                        {new Date(d.at).toLocaleString("pt-PT")} · {d.action}
                      </p>
                    ))}
                  </details>
                </div>
              ))}
            <p>
              A primeira submissão válida tem prioridade, com rotação se a mesma
              equipa beneficiou de disputa na jornada anterior.
            </p>
          </div>
          <HistoryDashboard s={s} round={round} />
          <AbsenceRecovery s={s} round={round} run={run} busy={busy} />
          <details className="card">
            <summary>Histórico de versões e decisões</summary>
            {schedules.map((q) => (
              <p key={q._id}>
                Revisão {q.revision} · versão {q.version} ·{" "}
                {competitionLabels[q.status]} · {q.reason} ·{" "}
                {q.approvedAt
                  ? `aprovada ${new Date(q.approvedAt).toLocaleString("pt-PT")}`
                  : "sem aprovação"}
              </p>
            ))}
            {s.audit
              .filter((a) => a.action.startsWith("competition."))
              .slice(-30)
              .reverse()
              .map((a) => (
                <p key={a._id}>
                  {new Date(a.createdAt).toLocaleString("pt-PT")} · {a.action}
                </p>
              ))}
          </details>
        </>
      )}
    </section>
  );
}
function RoundForm({
  configId,
  divisionId,
  round,
  maxRounds,
  run,
  busy,
}: {
  configId: string;
  divisionId: string;
  round?: CompetitionRound;
  maxRounds: number;
  run: Props["run"];
  busy?: boolean;
}) {
  const [isNew, setNew] = useState(!round);
  const current = isNew ? undefined : round;
  return (
    <>
      <label>
        <input
          type="checkbox"
          checked={isNew}
          onChange={(e) => setNew(e.target.checked)}
        />{" "}
        Criar nova jornada
      </label>
      <form
        key={String(isNew)}
        style={formStyle}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void run(
            {
              type: "competition.round.save",
              roundId: current?._id,
              expectedVersion: current?.version ?? 0,
              competitionId: configId,
              divisionId,
              number: Number(d.get("number")),
              weekType: value(d, "type") || undefined,
              distanceOverride: value(d, "distance")
                ? Number(d.get("distance"))
                : undefined,
              opensAt: iso(d.get("opensAt")),
              closesAt: iso(d.get("closesAt")),
              schedulingDeadline: iso(d.get("schedulingDeadline")),
              startsAt: iso(d.get("startsAt")),
              endsAt: iso(d.get("endsAt")),
              instructions: value(d, "instructions"),
            },
            "Jornada guardada",
          );
        }}
      >
        <label style={fieldStyle}>
          Número
          <input
            required
            type="number"
            name="number"
            min="1"
            max={maxRounds}
            defaultValue={current?.number ?? (round?.number ?? 0) + 1}
          />
        </label>
        <label style={fieldStyle}>
          Tipo
          <select name="type" defaultValue={current?.weekType ?? ""}>
            <option value="">Automático (primeira/final)</option>
            <option value="NORMAL">Normal</option>
            <option value="OPEN_ATTACK">SEMANA DE ATAQUE LIVRE</option>
          </select>
        </label>
        <label style={fieldStyle}>
          Distância especial (opcional)
          <input
            type="number"
            name="distance"
            min="1"
            max="19"
            defaultValue={current?.distanceOverride}
          />
        </label>
        {(
          [
            ["opensAt", "Abertura de desafios"],
            ["closesAt", "Fecho de desafios"],
            ["schedulingDeadline", "Prazo de marcação"],
            ["startsAt", "Início da jornada"],
            ["endsAt", "Fim da jornada"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} style={fieldStyle}>
            {label}
            <input
              type="datetime-local"
              name={key}
              required
              defaultValue={
                current?.[key]
                  ? new Date(
                      Date.parse(current[key]) -
                        new Date(current[key]).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : undefined
              }
            />
          </label>
        ))}
        <label style={fieldStyle}>
          Instruções
          <textarea name="instructions" defaultValue={current?.instructions} />
        </label>
        <button disabled={busy}>Guardar jornada</button>
      </form>
    </>
  );
}
function ScheduleEditor({
  q,
  s,
  run,
  busy,
}: {
  q: CompetitionSchedule;
  s: View;
  run: Props["run"];
  busy?: boolean;
}) {
  const [pairs, setPairs] = useState<CompetitionPair[]>(q.pairs);
  const readonly = q.status === "PUBLISHED";
  const name = (id: string) =>
    q.snapshot
      .find((t) => t.id === id)
      ?.members.map((m) => m.name)
      .join(" + ") ?? id;
  const change = (i: number, value: Partial<CompetitionPair>) =>
    setPairs(pairs.map((p, j) => (j === i ? { ...p, ...value } : p)));
  return (
    <div className="card">
      <h3>ATAQUE / DEFESA — proposta</h3>
      {pairs.map((p, i) => {
        const a = q.snapshot.find((t) => t.id === p.attackerId),
          d = q.snapshot.find((t) => t.id === p.defenderId);
        const alternatives = q.snapshot.filter(
          (t) =>
            a &&
            t.active &&
            t.rank < a.rank &&
            a.rank - t.rank <= q.effectiveDistance &&
            (t.rank !== 1 || q.championPositions.includes(a.rank)),
        );
        return (
          <div
            key={i}
            style={{
              ...formStyle,
              padding: "16px 0",
              borderBottom: "1px solid #8885",
            }}
          >
            <label style={fieldStyle}>
              ATAQUE
              <select
                disabled={readonly}
                value={p.attackerId}
                onChange={(e) => change(i, { attackerId: e.target.value })}
              >
                {q.snapshot.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.rank}. {name(t.id)}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              DEFESA
              <select
                disabled={readonly}
                value={p.defenderId}
                onChange={(e) => change(i, { defenderId: e.target.value })}
              >
                {q.snapshot.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.rank}. {name(t.id)}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Data e hora
              <input
                disabled={readonly}
                type="datetime-local"
                value={
                  p.start
                    ? new Date(
                        Date.parse(p.start) -
                          new Date(p.start).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  change(i, {
                    start: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
              />
            </label>
            <label style={fieldStyle}>
              Campo do clube
              <select
                disabled={readonly}
                value={p.courtId ?? ""}
                onChange={(e) =>
                  change(i, { courtId: e.target.value || undefined })
                }
              >
                <option value="">Por atribuir</option>
                {s.courts
                  .filter((c) => c.active || c._id === p.courtId)
                  .map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                      {!c.active ? " (inativo)" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <input
                disabled={readonly}
                type="checkbox"
                checked={!!p.locked}
                onChange={(e) => change(i, { locked: e.target.checked })}
              />{" "}
              Bloquear este jogo na regeneração
            </label>
            <label style={fieldStyle}>
              Recuperação autorizada
              <select
                disabled={readonly}
                value={p.recoveryId ?? ""}
                onChange={(e) =>
                  change(i, { recoveryId: e.target.value || undefined })
                }
              >
                <option value="">Jogo normal</option>
                {(s.competitionRecoveries ?? [])
                  .filter((r) => r.roundId === q.roundId)
                  .map((r) => (
                    <option value={r._id} key={r._id}>
                      {r.reason}
                    </option>
                  ))}
              </select>
            </label>
            <div>
              <p>Distância: {a && d ? a.rank - d.rank : "—"}</p>
              <p>{p.reason}</p>
              {p.warnings?.map((w, j) => (
                <p key={j}>Aviso: {w}</p>
              ))}
              <details>
                <summary>Ver alternativas elegíveis</summary>
                {alternatives.map((t) => (
                  <p key={t.id}>
                    {name(t.id)}{" "}
                    {pairs.some(
                      (other, j) =>
                        j !== i &&
                        [other.attackerId, other.defenderId].includes(t.id),
                    )
                      ? "— já atribuído; ajusta os restantes jogos"
                      : "— livre nesta proposta"}
                  </p>
                ))}
              </details>
              {!readonly && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      change(i, {
                        attackerId: p.defenderId,
                        defenderId: p.attackerId,
                      })
                    }
                  >
                    Trocar ataque / defesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setPairs(pairs.filter((_, j) => j !== i))}
                  >
                    Remover jogo
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {!readonly && (
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}
        >
          <button
            disabled={busy || q.snapshot.length < 2}
            onClick={() =>
              setPairs([
                ...pairs,
                {
                  attackerId: q.snapshot.at(-1)!.id,
                  defenderId: q.snapshot.at(-2)!.id,
                },
              ])
            }
          >
            Adicionar jogo
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(
                {
                  type: "competition.edit",
                  scheduleId: q._id,
                  expectedVersion: q.version,
                  pairs,
                },
                "Alterações guardadas e revalidadas; aprovação anulada",
              )
            }
          >
            Guardar alterações e validar
          </button>
        </div>
      )}
    </div>
  );
}
function AbsenceRecovery({
  s,
  round,
  run,
  busy,
}: {
  s: View;
  round: CompetitionRound;
  run: Props["run"];
  busy?: boolean;
}) {
  const teams = rankingEntries(s.players, round.divisionId);
  return (
    <details className="card">
      <summary>Gerir ausências e aprovar recuperações</summary>
      <h3>Ausência aprovada</h3>
      <form
        style={formStyle}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void run(
            {
              type: "competition.absence.add",
              competitionId: round.competitionId,
              divisionId: round.divisionId,
              teamId: value(d, "teamId"),
              from: iso(d.get("from")),
              to: iso(d.get("to")),
              reason: value(d, "reason"),
              roundIds: [round._id],
              recoveryAllowed: d.has("recoveryAllowed"),
            },
            "Ausência aprovada sem penalização automática",
          );
        }}
      >
        <label style={fieldStyle}>
          Equipa
          <select name="teamId">
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.members.map((m) => m.name).join(" + ")}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldStyle}>
          Desde
          <input required type="datetime-local" name="from" />
        </label>
        <label style={fieldStyle}>
          Até
          <input required type="datetime-local" name="to" />
        </label>
        <label style={fieldStyle}>
          Motivo
          <input required minLength={3} name="reason" />
        </label>
        <label>
          <input type="checkbox" name="recoveryAllowed" /> Permitir recuperação
        </label>
        <button disabled={busy}>Aprovar ausência</button>
      </form>
      <h3>Recuperação na jornada seguinte</h3>
      <form
        style={formStyle}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void run(
            {
              type: "competition.recovery.approve",
              roundId: round._id,
              sourceRoundId: value(d, "sourceRoundId"),
              teamIds: [value(d, "a"), value(d, "d")],
              reason: value(d, "reason"),
            },
            "Recuperação autorizada e auditada",
          );
        }}
      >
        <label style={fieldStyle}>
          Jornada de origem
          <select name="sourceRoundId">
            {(s.competitionRounds ?? [])
              .filter(
                (r) =>
                  r.competitionId === round.competitionId &&
                  r.divisionId === round.divisionId &&
                  r.number === round.number - 1,
              )
              .map((r) => (
                <option key={r._id} value={r._id}>
                  {r.number}
                </option>
              ))}
          </select>
        </label>
        {["a", "d"].map((key, i) => (
          <label key={key} style={fieldStyle}>
            Equipa {i + 1}
            <select name={key}>
              {teams.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.members.map((m) => m.name).join(" + ")}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label style={fieldStyle}>
          Motivo
          <input required minLength={3} name="reason" />
        </label>
        <button disabled={busy}>Aprovar recuperação</button>
      </form>
      <p>
        A autorização permite um segundo jogo, exige horários sem sobreposição e
        não permite contornar distância, título ou ausências.
      </p>
      {(s.competitionAbsences ?? [])
        .filter((a) => a.divisionId === round.divisionId)
        .map((a) => (
          <p key={a._id}>
            {a.teamId}: {a.reason} ·{" "}
            {new Date(a.from).toLocaleDateString("pt-PT")}–
            {new Date(a.to).toLocaleDateString("pt-PT")}
          </p>
        ))}
    </details>
  );
}
export function PlayerCompetition({ s, run, busy }: Props) {
  const me = s.players.find((p) => p._id === s.actor.playerId);
  const rounds = (s.competitionRounds ?? [])
    .filter(
      (r) =>
        r.divisionId === me?.divisionId &&
        (s.competitionConfigurations?.some(
          (c) => c._id === r.competitionId && c.enabled,
        ) ||
          s.competitionSchedules?.some(
            (q) => q.roundId === r._id && q.status === "PUBLISHED",
          )),
    )
    .sort((a, b) => b.number - a.number);
  const [selected, setSelected] = useState("");
  const pending = rounds
    .filter(
      (r) =>
        !r.settledAt &&
        s.competitionConfigurations?.some(
          (c) => c._id === r.competitionId && c.enabled,
        ),
    )
    .sort((a, b) => a.opensAt.localeCompare(b.opensAt) || a.number - b.number);
  const now = new Date().toISOString();
  const round =
    rounds.find((r) => r._id === selected) ??
    pending.find((r) => r.opensAt <= now && r.endsAt > now) ??
    pending.find((r) => r.opensAt > now) ??
    pending.at(-1) ??
    rounds[0];
  if (!round)
    return (
      <div className="panel competition-management">
        <h2>Jornadas oficiais</h2>
        <p>
          A próxima jornada será apresentada quando o clube configurar a
          competição.
        </p>
      </div>
    );
  const e = effective(s, round),
    teams = rankingEntries(s.players, round.divisionId),
    own = teams.find((t) => t.members.some((m) => m._id === s.actor.playerId));
  const publication = (s.competitionSchedules ?? [])
    .filter((q) => q.roundId === round._id && q.status === "PUBLISHED")
    .sort((a, b) => b.revision - a.revision)[0];
  const ownMatch = s.challenges.filter(
    (c) =>
      c.competitionRoundId === round._id &&
      c.status !== "cancelled" &&
      [
        ...(c.challengerTeam ?? [{ playerId: c.challengerId }]),
        ...(c.defenderTeam ?? [{ playerId: c.defenderId }]),
      ].some((m) => m.playerId === s.actor.playerId),
  );
  const name = (id: string) =>
    teams
      .find((t) => t.id === id)
      ?.members.map((m) => m.name)
      .join(" + ") ?? id;
  return (
    <section className="stack competition-management">
      <div className="card">
        <h2>
          FIGHT CLUB — {publication ? "JORNADA OFICIAL" : "DESAFIOS DA JORNADA"}{" "}
          {round.number}
        </h2>
        <label style={fieldStyle}>
          Jornada
          <select
            value={round._id}
            onChange={(ev) => setSelected(ev.target.value)}
          >
            {rounds.map((r) => (
              <option key={r._id} value={r._id}>
                {r.number}
              </option>
            ))}
          </select>
        </label>
        <h3>
          {e.type === "OPEN_ATTACK"
            ? "SEMANA DE ATAQUE LIVRE"
            : "SEMANA NORMAL"}
        </h3>
        {e.type === "OPEN_ATTACK" && (
          <p>
            Todas as equipas elegíveis podem desafiar. Cada jogo mantém uma
            equipa no ATAQUE e outra na DEFESA.
          </p>
        )}
        <p>
          Ranking atual: {own ? teams.indexOf(own) + 1 : "—"} · Distância
          máxima: {e.distance} posições.
        </p>
        <p>
          Desafios: {new Date(round.opensAt).toLocaleString("pt-PT")} até{" "}
          {new Date(round.closesAt).toLocaleString("pt-PT")}.
        </p>
        <p>{round.instructions}</p>
        {!publication && (
          <p>
            O calendário está em preparação. Apenas os jogos aprovados e
            publicados pelo administrador são oficiais.
          </p>
        )}
      </div>
      <PlayerRoundChallenges s={s} round={round} run={run} busy={busy} />
      {ownMatch.map((c) => (
        <div className="card" key={c._id}>
          <h3>
            Jogo oficial ·{" "}
            {c.titleFight ? "JOGO DO TÍTULO" : "JORNADA " + round.number}
          </h3>
          <p>
            <strong>ATAQUE:</strong>{" "}
            {c.challengerTeam?.map((m) => m.name).join(" + ")}
          </p>
          <p>
            <strong>DEFESA:</strong>{" "}
            {c.defenderTeam?.map((m) => m.name).join(" + ")}
          </p>
          <p>
            {c.scheduledAt
              ? new Date(c.scheduledAt).toLocaleString("pt-PT")
              : "Horário por definir pelo clube"}{" "}
            · {statusLabels[c.status]} {c.score}
          </p>
        </div>
      ))}
      <div className="card">
        <h3>Ausências aprovadas</h3>
        {(s.competitionAbsences ?? [])
          .filter((a) => a.teamId === own?.id)
          .map((a) => (
            <p key={a._id}>
              {new Date(a.from).toLocaleDateString("pt-PT")}–
              {new Date(a.to).toLocaleDateString("pt-PT")}: {a.reason}
            </p>
          ))}
        <p>
          Ausências aprovadas não causam derrota automática. Recuperações exigem
          autorização do clube.
        </p>
      </div>
    </section>
  );
}

function HistoryDashboard({ s, round }: { s: View; round: CompetitionRound }) {
  const history: CompetitionMeeting[] = s.challenges
    .filter(
      (c) =>
        c.divisionId === round.divisionId &&
        c.status === "completed" &&
        s.results.some((result) => result.challengeId === c._id),
    )
    .flatMap((c) => {
      const r = s.competitionRounds?.find(
        (r) =>
          r._id === c.competitionRoundId &&
          r.competitionId === round.competitionId,
      );
      return r
        ? [
            {
              round: r.number,
              attackerId: (
                c.challengerTeam?.map((m) => m.playerId) ?? [c.challengerId]
              )
                .sort()
                .join(":"),
              defenderId: (
                c.defenderTeam?.map((m) => m.playerId) ?? [c.defenderId]
              )
                .sort()
                .join(":"),
              completedAt: c.completedAt,
              winnerId: c.winnerId,
            },
          ]
        : [];
    });
  const teams = rankingEntries(s.players, round.divisionId);
  const name = (id: string) =>
    teams
      .find((t) => t.id === id)
      ?.members.map((m) => m.name)
      .join(" + ") ?? id;
  return (
    <details className="card">
      <summary>Histórico de ATAQUE / DEFESA e adversários</summary>
      <p>
        Apenas jogos oficialmente concluídos contam. Uma atribuição proposta ou
        publicada ainda não é um jogo realizado.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Equipa</th>
              <th>Ataques</th>
              <th>Defesas</th>
              <th>Último papel / sequência</th>
              <th>A/D últimas 3</th>
              <th>A/D últimas 5</th>
              <th>Adversários anteriores</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const stats = roleStatistics(history, t.id, round.number),
                games = history.filter(
                  (h) =>
                    h.round < round.number &&
                    [h.attackerId, h.defenderId].includes(t.id),
                );
              return (
                <tr key={t.id}>
                  <td>{name(t.id)}</td>
                  <td>{stats.attacks}</td>
                  <td>{stats.defenses}</td>
                  <td>
                    {stats.lastRole === "attack"
                      ? "ATAQUE"
                      : stats.lastRole === "defense"
                        ? "DEFESA"
                        : "—"}{" "}
                    / {stats.streak}
                  </td>
                  <td>
                    {stats.attacks3}/{stats.defenses3}
                  </td>
                  <td>
                    {stats.attacks5}/{stats.defenses5}
                  </td>
                  <td>
                    {[
                      ...new Set(
                        games.map((h) =>
                          h.attackerId === t.id ? h.defenderId : h.attackerId,
                        ),
                      ),
                    ].map((id) => {
                      const meetings = games.filter((h) =>
                        [h.attackerId, h.defenderId].includes(id),
                      );
                      const last = meetings.at(-1);
                      return (
                        <p key={id}>
                          {name(id)}: {meetings.length} encontros · últimas 3:{" "}
                          {
                            meetings.filter((h) => h.round >= round.number - 3)
                              .length
                          }{" "}
                          · últimas 5:{" "}
                          {
                            meetings.filter((h) => h.round >= round.number - 5)
                              .length
                          }{" "}
                          · último: jornada {last?.round}
                          {last?.completedAt
                            ? ` (${new Date(last.completedAt).toLocaleDateString("pt-PT")})`
                            : ""}
                        </p>
                      );
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
