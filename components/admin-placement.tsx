"use client";
import PlacementGameEditor from "./placement-game-editor";
import styles from "./admin-lab.module.css";
import { useState } from "react";
import type { View } from "@/lib/types";
import type {
  PlacementEvent,
  PlacementGame,
  PlacementFixture,
} from "@/lib/placement-types";
import { defaultPlacementRules } from "@/lib/placement-types";
import { placementStandings } from "@/lib/placement-standings";
import DataRows from "./data-rows";
type Props = {
  state: View;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
};
function EventEditor({
  event,
  run,
  busy,
}: {
  event: PlacementEvent;
  run: Props["run"];
  busy: boolean;
}) {
  const [name, setName] = useState(event.name),
    [date, setDate] = useState(event.date),
    [rules, setRules] = useState(event.rules);
  return (
    <form
      className="row wrap"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          {
            type: "admin.placement.update",
            eventId: event._id,
            expectedVersion: event.version,
            name,
            date,
            rules,
          },
          "Evento atualizado.",
        );
      }}
    >
      <label>
        Nome do evento
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
        />
      </label>
      <label>
        Data do evento
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label>
        Pontos para desempate
        <select
          value={rules.pointsMode}
          onChange={(e) =>
            setRules({
              ...rules,
              pointsMode: e.target.value as typeof rules.pointsMode,
            })
          }
        >
          <option value="TOTAL_POINTS">Total de pontos marcados</option>
          <option value="CLASSIFICATION_POINTS">Pontos de classificação</option>
        </select>
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={rules.protectVacationPositions ?? false}
          onChange={(e) =>
            setRules({ ...rules, protectVacationPositions: e.target.checked })
          }
        />
        Aplicar proteção de férias também na colocação inicial
      </label>
      {rules.pointsMode === "CLASSIFICATION_POINTS" && (
        <>
          <label>
            Pontos por vitória
            <input
              type="number"
              min={0}
              max={100000}
              value={rules.winPoints}
              onChange={(e) =>
                setRules({ ...rules, winPoints: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Pontos por derrota
            <input
              type="number"
              min={0}
              max={100000}
              value={rules.lossPoints}
              onChange={(e) =>
                setRules({ ...rules, lossPoints: Number(e.target.value) })
              }
            />
          </label>
        </>
      )}
      <button disabled={busy || event.status !== "DRAFT"}>
        Guardar evento e regras
      </button>
    </form>
  );
}
export default function AdminPlacement({ state, run, busy }: Props) {
  const [seasonId, setSeason] = useState(
      state.seasons.find((s) => s.status === "active")?._id ??
        state.seasons.find((s) => s.status !== "completed")?._id ??
        "",
    ),
    [divisionId, setDivision] = useState(state.divisions[0]?._id ?? ""),
    [name, setName] = useState("Evento de colocação"),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventId, setEvent] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [tieOrder, setTieOrder] = useState<string[]>([]),
    [confirmTies, setConfirmTies] = useState(false);
  const events = (state.placementEvents ?? []).filter(
      (e) => e.seasonId === seasonId && e.divisionId === divisionId,
    ),
    event =
      events.find((e) => e._id === eventId) ??
      [...events].sort(
        (a, b) =>
          b.games.length +
          (b.fixtures?.length ?? 0) -
          (a.games.length + (a.fixtures?.length ?? 0)),
      )[0];
  const [editing, setEditing] = useState<PlacementGame | null>(null),
    [editingVersion, setEditingVersion] = useState(0),
    [scoringFixture, setScoringFixture] = useState<PlacementFixture | null>(
      null,
    );
  const group = events.filter((e) => selected.includes(e._id));
  const ranking = placementStandings(group, tieOrder);
  const editable = event?.status === "DRAFT";
  const label = (id: string) =>
    event?.teams.find((t) => t.id === id)?.name ?? id;
  function reset() {
    setEvent("");
    setEditing(null);
    setScoringFixture(null);
    setSelected([]);
    setTieOrder([]);
    setConfirmTies(false);
  }
  return (
    <section
      className={`stack ${styles.root}`}
      aria-label="Eventos de colocação"
    >
      <div className="panel stack">
        <h2>Eventos de colocação</h2>
        <p>
          Constrói o ranking inicial por equipa, sem alterar os resultados
          oficiais da liga. A diferença de sets é o primeiro critério: 2–0 dá
          +2; 2–1 dá +1. Os pontos são o segundo critério.
        </p>
        <div className="row wrap">
          <label>
            Época de colocação
            <select
              value={seasonId}
              onChange={(e) => {
                setSeason(e.target.value);
                reset();
              }}
            >
              {state.seasons.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                  {s.status === "completed" ? " · concluída" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Divisão de colocação
            <select
              value={divisionId}
              onChange={(e) => {
                setDivision(e.target.value);
                reset();
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
        <form
          className="row wrap"
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await run(
              {
                type: "admin.placement.create",
                seasonId,
                divisionId,
                name,
                date,
                rules: defaultPlacementRules,
              },
              "Evento criado.",
            );
            if (result && typeof result === "object" && "id" in result) {
              setEvent(String(result.id));
              setEditing(null);
              setScoringFixture(null);
            }
          }}
        >
          <label>
            Nome do novo evento
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label>
            Data do novo evento
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <button disabled={busy}>Criar evento de colocação</button>
        </form>
      </div>
      {event && (
        <div className="panel stack">
          <label>
            Evento
            <select
              value={event._id}
              onChange={(e) => {
                setEvent(e.target.value);
                setEditing(null);
                setScoringFixture(null);
              }}
            >
              {events.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} · {e.date} · {e.games.length} resultados ·{" "}
                  {e.fixtures?.length ?? 0} por jogar ·{" "}
                  {e.status === "APPLIED" ? "aplicado" : "rascunho"}
                </option>
              ))}
            </select>
          </label>
          <p>
            {event.teams.length} equipas · {event.games.length} resultados ·{" "}
            {event.fixtures?.length ?? 0} por jogar · versão {event.version}
          </p>
          <EventEditor
            key={`${event._id}:${event.version}`}
            event={event}
            run={run}
            busy={busy}
          />
          {editable && (
            <>
              <PlacementGameEditor
                key={`add:${event._id}:${event.version}`}
                event={event}
                run={run}
                busy={busy}
              />
              {editing && (
                <PlacementGameEditor
                  key={`edit:${event._id}:${editing.id}:${editingVersion}`}
                  event={event}
                  game={editing}
                  expectedVersion={editingVersion}
                  run={run}
                  busy={busy}
                  onClose={() => setEditing(null)}
                />
              )}
            </>
          )}
          {scoringFixture && editable && (
            <PlacementGameEditor
              key={`fixture:${event._id}:${scoringFixture.id}:${editingVersion}`}
              event={event}
              fixture={scoringFixture}
              expectedVersion={editingVersion}
              run={run}
              busy={busy}
              onClose={() => setScoringFixture(null)}
            />
          )}
          <h3>Jogos de colocação</h3>
          <p>
            Resultados registados por set. Os jogos por jogar aparecem abaixo e
            não contam para a classificação até terem resultado.
          </p>
          <DataRows
            data={event.games}
            searchText={(g) => `${label(g.teamA)} ${label(g.teamB)} ${g.id}`}
            label="jogos de colocação"
          >
            {(rows) => (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Jogo</th>
                      <th>Equipa A</th>
                      <th>Equipa B</th>
                      <th>Resultado por set</th>
                      <th>Sets</th>
                      <th>Pontos</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((g) => (
                      <tr key={g.id}>
                        <td>{g.id}</td>
                        <td>{label(g.teamA)}</td>
                        <td>{label(g.teamB)}</td>
                        <td>
                          {g.setScores
                            ?.map((s, i) => `${i + 1}.º: ${s.a}–${s.b}`)
                            .join(" · ") ?? "Apenas totais"}
                        </td>
                        <td>
                          {g.setsA}–{g.setsB}
                        </td>
                        <td>
                          {g.pointsA}–{g.pointsB}
                        </td>
                        <td>
                          {editable && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                setEditing(g);
                                setEditingVersion(event.version);
                              }}
                            >
                              Editar resultado
                            </button>
                          )}
                          {editable && (
                            <button
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm("Remover este jogo do evento?")
                                )
                                  void run(
                                    {
                                      type: "admin.placement.removeGame",
                                      eventId: event._id,
                                      expectedVersion: event.version,
                                      gameId: g.id,
                                    },
                                    "Jogo removido do evento.",
                                  );
                              }}
                            >
                              Remover jogo
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataRows>
          {!!event.fixtures?.length && (
            <DataRows
              data={event.fixtures}
              label="jogos por jogar"
              searchText={(g) => `${g.id} ${label(g.teamA)} ${label(g.teamB)}`}
            >
              {(rows) => (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Jogo</th>
                        <th>Equipa A</th>
                        <th>Equipa B</th>
                        <th>Estado</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((g) => (
                        <tr key={g.id}>
                          <td>{g.id}</td>
                          <td>{label(g.teamA)}</td>
                          <td>{label(g.teamB)}</td>
                          <td>Por jogar</td>
                          <td>
                            {editable && (
                              <>
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    setScoringFixture(g);
                                    setEditingVersion(event.version);
                                  }}
                                >
                                  Adicionar resultado
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Remover este jogo por jogar?",
                                      )
                                    )
                                      void run(
                                        {
                                          type: "admin.placement.removeFixture",
                                          eventId: event._id,
                                          expectedVersion: event.version,
                                          gameId: g.id,
                                        },
                                        "Jogo removido.",
                                      );
                                  }}
                                >
                                  Remover jogo
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataRows>
          )}
        </div>
      )}
      {!!events.length && (
        <div className="panel stack">
          <h3>Classificação acumulada e ranking inicial</h3>
          <p>
            Seleciona os eventos da mesma época/divisão. A classificação fica em
            pré-visualização até confirmares a aplicação.
          </p>
          {events.map((e) => (
            <label className="row" key={e._id}>
              <input
                type="checkbox"
                checked={selected.includes(e._id)}
                onChange={(v) => {
                  setSelected(
                    v.target.checked
                      ? [...selected, e._id]
                      : selected.filter((id) => id !== e._id),
                  );
                  setTieOrder([]);
                  setConfirmTies(false);
                }}
              />
              {e.name} · {e.games.length} jogos
            </label>
          ))}
          {group.length > 0 && (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pos.</th>
                      <th>Equipa</th>
                      <th>Jogos</th>
                      <th>Sets +/−</th>
                      <th>Dif.</th>
                      <th>Pontos</th>
                      <th>Empate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.name}</td>
                        <td>{r.played}</td>
                        <td>
                          {r.setsFor}/{r.setsAgainst}
                        </td>
                        <td>
                          {r.setDifference > 0 ? "+" : ""}
                          {r.setDifference}
                        </td>
                        <td>{r.rankingPoints}</td>
                        <td>
                          {r.tied ? "Rever ordem" : ""}
                          {i > 0 &&
                            r.setDifference === ranking[i - 1].setDifference &&
                            r.rankingPoints ===
                              ranking[i - 1].rankingPoints && (
                              <button
                                aria-label={`Subir ${r.name} no empate`}
                                onClick={() => {
                                  const order = ranking.map((x) => x.id);
                                  [order[i - 1], order[i]] = [
                                    order[i],
                                    order[i - 1],
                                  ];
                                  setTieOrder(order);
                                  setConfirmTies(false);
                                }}
                              >
                                ↑
                              </button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {new Set(ranking.map((r) => r.played)).size > 1 && (
                <p role="status">
                  As equipas têm números diferentes de jogos. Confirma se o
                  evento está completo.
                </p>
              )}
              {ranking.some((r) => !r.played) && (
                <p role="alert">
                  Existem equipas sem jogos. Completa os resultados antes de
                  aplicar.
                </p>
              )}
              {ranking.some((r) => r.tied) && (
                <label className="row">
                  <input
                    type="checkbox"
                    checked={confirmTies}
                    onChange={(e) => setConfirmTies(e.target.checked)}
                  />
                  Confirmo a ordem apresentada para os empates completos
                </label>
              )}
              <p>
                O ranking provisório pode ser atualizado com os resultados
                disponíveis e mantém os jogos editáveis. A competição oficial
                ainda não pode ter desafios, propostas ou papéis publicados.
              </p>
              <button
                disabled={
                  busy ||
                  group.some((e) => e.status !== "DRAFT") ||
                  !group.some((e) => e.games.length > 0) ||
                  (ranking.some((r) => r.tied) && !confirmTies)
                }
                onClick={() =>
                  run(
                    {
                      type: "admin.placement.previewRanking",
                      events: group.map((e) => ({
                        id: e._id,
                        version: e.version,
                      })),
                      tieOrder: ranking.map((r) => r.id),
                      confirmTies,
                    },
                    "Ranking provisório atualizado; os jogos continuam editáveis.",
                  )
                }
              >
                Atualizar ranking provisório
              </button>
              <button
                className="primary"
                disabled={
                  busy ||
                  group.some((e) => e.status !== "DRAFT") ||
                  ranking.some((r) => !r.played) ||
                  (ranking.some((r) => r.tied) && !confirmTies)
                }
                onClick={() => {
                  if (
                    window.confirm(
                      "Aplicar este ranking inicial? Os eventos selecionados ficam fechados. Esta ação é bloqueada se já existirem desafios oficiais.",
                    )
                  )
                    void run(
                      {
                        type: "admin.placement.apply",
                        events: group.map((e) => ({
                          id: e._id,
                          version: e.version,
                        })),
                        tieOrder: ranking.map((r) => r.id),
                        confirmTies,
                      },
                      "Ranking inicial aplicado com histórico.",
                    );
                }}
              >
                Aplicar ranking inicial
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
