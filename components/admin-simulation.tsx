"use client";
import styles from "./admin-lab.module.css";
import SharedAdminTests from "./shared-admin-tests";
import { useState } from "react";
import type { View } from "@/lib/types";
import { rankingEntries } from "@/lib/ranking-groups";
import type { simulateAdmin } from "@/lib/admin-simulation";
type Report = ReturnType<typeof simulateAdmin>;
export default function AdminSimulation({
  state,
  run,
  busy,
}: {
  state: View;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [divisionId, setDivision] = useState(state.divisions[0]?._id ?? ""),
    [mode, setMode] = useState<"challenge" | "matchmaking">("matchmaking"),
    [roundId, setRound] = useState(""),
    [rounds, setRounds] = useState(3),
    [distance, setDistance] = useState(2),
    [attackerId, setAttacker] = useState(""),
    [defenderId, setDefender] = useState(""),
    [lock, setLock] = useState(false),
    [unavailable, setUnavailable] = useState<string[]>([]),
    [outcome, setOutcome] = useState("DEFENDERS_WIN"),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [report, setReport] = useState<Report | null>(null);
  const teams = rankingEntries(state.players, divisionId),
    label = (id: string) =>
      teams
        .find((t) => t.id === id)
        ?.members.map((p) => p.name)
        .join(" + ") ?? id;
  const teamOptions = teams.map((t, i) => (
    <option key={t.id} value={t.id}>
      {i + 1}. {label(t.id)}
    </option>
  ));
  async function simulate() {
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const body =
        mode === "challenge"
          ? {
              mode,
              attackerId:
                teams.find((t) => t.id === attackerId)?.members[0]._id ??
                attackerId,
              defenderId:
                teams.find((t) => t.id === defenderId)?.members[0]._id ??
                defenderId,
            }
          : {
              mode,
              divisionId,
              ...(roundId ? { roundId } : {}),
              rounds,
              distance,
              outcome,
              unavailable,
              ...(lock ? { locked: { attackerId, defenderId } } : {}),
            };
      const response = await fetch("/api/admin/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível simular.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className={`stack ${styles.root}`}
      aria-label="Simulador privado de desafios"
    >
      <h2>Simulador de desafios</h2>
      <SharedAdminTests state={state} run={run} busy={busy} />
      <div className="panel stack">
        <h3>Simulação automática sem notificações</h3>
        <strong className="badge">SIMULAÇÃO PRIVADA · NÃO ALTERA A LIGA</strong>
        <p>
          Experimenta regras numa cópia. Não cria desafios, reservas,
          resultados, rankings ou notificações reais.
        </p>
        <div className="row wrap">
          <label>
            Tipo de simulação
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                setReport(null);
              }}
            >
              <option value="matchmaking">
                Emparelhamento e resultados hipotéticos
              </option>
              <option value="challenge">
                Submissão e aceitação de um desafio
              </option>
            </select>
          </label>
          <label>
            Divisão a simular
            <select
              value={divisionId}
              onChange={(e) => {
                setDivision(e.target.value);
                setReport(null);
                setRound("");
                setUnavailable([]);
                setAttacker("");
                setDefender("");
              }}
            >
              {state.divisions.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {mode === "matchmaking" && (
          <>
            <div className="row wrap">
              <label>
                Regras da jornada
                <select
                  value={roundId}
                  onChange={(e) => {
                    setRound(e.target.value);
                    const r = state.competitionRounds?.find(
                      (r) => r._id === e.target.value,
                    );
                    const c = state.competitionConfigurations?.find(
                      (c) => c._id === r?.competitionId,
                    );
                    if (r && c)
                      setDistance(
                        r.distanceOverride ??
                          c.leagueDistances[divisionId] ??
                          c.defaultDistance,
                      );
                  }}
                >
                  <option value="">
                    Cenário livre · título elegível para posições 2 e 3
                  </option>
                  {(state.competitionRounds ?? [])
                    .filter((r) => r.divisionId === divisionId)
                    .map((r) => (
                      <option key={r._id} value={r._id}>
                        Jornada {r.number}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Jornadas a simular
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                />
              </label>
              <label>
                Distância de ataque no teste
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, teams.length - 1)}
                  value={distance}
                  onChange={(e) => setDistance(Number(e.target.value))}
                />
              </label>
              <label>
                Resultados hipotéticos
                <select
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="DEFENDERS_WIN">
                    Todos os defensores ganham
                  </option>
                  <option value="ATTACKERS_WIN">
                    Todos os atacantes ganham
                  </option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend>Equipas indisponíveis neste teste</legend>
              {teams.map((t) => (
                <label className="row" key={t.id}>
                  <input
                    type="checkbox"
                    checked={unavailable.includes(t.id)}
                    onChange={(e) =>
                      setUnavailable(
                        e.target.checked
                          ? [...unavailable, t.id]
                          : unavailable.filter((id) => id !== t.id),
                      )
                    }
                  />
                  {label(t.id)}
                </label>
              ))}
            </fieldset>
            <label className="row">
              <input
                type="checkbox"
                checked={lock}
                onChange={(e) => setLock(e.target.checked)}
              />
              Fixar um emparelhamento na primeira jornada de teste
            </label>
          </>
        )}
        {(mode === "challenge" || lock) && (
          <div className="row wrap">
            <label>
              Equipa atacante
              <select
                value={attackerId}
                onChange={(e) => setAttacker(e.target.value)}
              >
                <option value="">Seleciona</option>
                {teamOptions}
              </select>
            </label>
            <label>
              Equipa defensora
              <select
                value={defenderId}
                onChange={(e) => setDefender(e.target.value)}
              >
                <option value="">Seleciona</option>
                {teamOptions}
              </select>
            </label>
          </div>
        )}
        <button
          disabled={
            loading ||
            teams.length < 2 ||
            ((mode === "challenge" || lock) && (!attackerId || !defenderId))
          }
          onClick={() => void simulate()}
        >
          {loading ? "A simular…" : "Executar simulação privada"}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
      {report && (
        <div className="panel stack">
          <h3>Relatório de simulação</h3>
          <p role="status">{report.notice}</p>
          {report.mode === "challenge" ? (
            report.steps.map((s, i) => (
              <p key={i}>
                <strong>
                  {s.name}: {s.ok ? "válido" : "bloqueado"}
                </strong>{" "}
                · {s.message}
              </p>
            ))
          ) : (
            <>
              <p>
                {report.rounds.reduce((n, r) => n + r.pairs.length, 0)} jogos
                hipotéticos ·{" "}
                {report.rounds.reduce((n, r) => n + r.errors.length, 0)} erros
                de regras
              </p>
              {report.rounds.map((r) => (
                <div className="inset stack" key={r.number}>
                  <h4>Jornada de teste {r.number}</h4>
                  {r.errors.map((e, i) => (
                    <p role="alert" key={i}>
                      {e}
                    </p>
                  ))}
                  {r.unmatched.length > 0 && (
                    <p>Sem jogo: {r.unmatched.map(label).join("; ")}</p>
                  )}
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Ataque</th>
                          <th>Defesa</th>
                          <th>Motivo e avisos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.pairs.map((p) => (
                          <tr key={`${p.attackerId}:${p.defenderId}`}>
                            <td>{label(p.attackerId)}</td>
                            <td>{label(p.defenderId)}</td>
                            <td>
                              {p.reason} {p.warnings?.join(" · ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>
                    Ranking após o teste:{" "}
                    {r.after
                      .map((t) => `${t.rank}. ${label(t.id)}`)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              <h4>Distribuição de papéis (inclui histórico confirmado)</h4>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Equipa</th>
                      <th>Ataques</th>
                      <th>Defesas</th>
                      <th>Sequência atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.roles.map((r) => (
                      <tr key={r.teamId}>
                        <td>{label(r.teamId)}</td>
                        <td>{r.attacks}</td>
                        <td>{r.defenses}</td>
                        <td>
                          {r.streak} ·{" "}
                          {r.lastRole === "attack"
                            ? "ataque"
                            : r.lastRole === "defense"
                              ? "defesa"
                              : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
