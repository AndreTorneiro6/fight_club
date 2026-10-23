"use client";
import PlacementGameEditor from "./placement-game-editor";
import styles from "./admin-lab.module.css";
import { useState } from "react";
import type { View } from "@/lib/types";
import type { PlacementEvent, PlacementGame } from "@/lib/placement-types";
import { defaultPlacementRules } from "@/lib/placement-types";
import { placementStandings } from "@/lib/placement-standings";
import DataRows from "./data-rows";
type Props = {
  state: View;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
};
type Preview = {
  eventId: string;
  version: number;
  games: PlacementGame[];
  duplicates: number;
  errors: { row: number; message: string }[];
  sheets: string[];
  allSheets: string[];
  sheetName: string;
  needsSheetSelection: boolean;
  skippedDivision: number;
  skippedUnplayed: number;
  convertedDates: number;
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
    [preview, setPreview] = useState<Preview | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [tieOrder, setTieOrder] = useState<string[]>([]),
    [confirmTies, setConfirmTies] = useState(false);
  const events = (state.placementEvents ?? []).filter(
      (e) => e.seasonId === seasonId && e.divisionId === divisionId,
    ),
    event = events.find((e) => e._id === eventId) ?? events[0];
  const [importedFile, setImportedFile] = useState<File | null>(null),
    [dateOrder, setDateOrder] = useState(""),
    [editing, setEditing] = useState<PlacementGame | null>(null),
    [editingVersion, setEditingVersion] = useState(0);
  const group = events.filter((e) => selected.includes(e._id));
  const ranking = placementStandings(group, tieOrder);
  const stale =
    !!preview &&
    (preview.eventId !== event?._id || preview.version !== event?.version);
  const editable = event?.status === "DRAFT";
  const label = (id: string) =>
    event?.teams.find((t) => t.id === id)?.name ?? id;
  async function importFile(file: File, sheetName = "", dates = dateOrder) {
    if (!event) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("eventId", event._id);
      body.set("sheetName", sheetName);
      body.set("dateOrder", dates);
      const response = await fetch("/api/placement-import", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na importação.");
    } finally {
      setLoading(false);
    }
  }
  function reset() {
    setEvent("");
    setImportedFile(null);
    setDateOrder("");
    setEditing(null);
    setSelected([]);
    setPreview(null);
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
              setImportedFile(null);
              setDateOrder("");
              setPreview(null);
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
                setImportedFile(null);
                setDateOrder("");
                setPreview(null);
              }}
            >
              {events.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} · {e.date} ·{" "}
                  {e.status === "APPLIED" ? "aplicado" : "rascunho"}
                </option>
              ))}
            </select>
          </label>
          <p>
            {event.teams.length} equipas · {event.games.length} jogos · versão{" "}
            {event.version}
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
              <h3>Importar jogos do Excel</h3>
              <a
                className="button"
                href={`/api/placement-import?eventId=${event._id}`}
              >
                Descarregar modelo Excel com equipas
              </a>
              <label>
                Excel ou CSV de jogos
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  disabled={busy || loading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportedFile(file);
                      setDateOrder("");
                      void importFile(file, "", "");
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {importedFile && (
                <label>
                  Interpretar datas nos sets
                  <select
                    value={dateOrder}
                    disabled={loading}
                    onChange={(e) => {
                      setDateOrder(e.target.value);
                      void importFile(
                        importedFile,
                        preview?.sheetName ?? "",
                        e.target.value,
                      );
                    }}
                  >
                    <option value="">
                      Não converter datas automaticamente
                    </option>
                    <option value="DAY_MONTH">
                      Dia–mês · 6 de abril → 6–4
                    </option>
                    <option value="MONTH_DAY">
                      Mês–dia · 6 de abril → 4–6
                    </option>
                  </select>
                </label>
              )}
              {loading && <p role="status">A validar ficheiro…</p>}
              {error && <p role="alert">{error}</p>}
              {preview && (
                <div className="inset stack">
                  <h4>Pré-visualização da importação</h4>
                  <p>
                    {preview.allSheets.length} folhas encontradas. Só a folha de
                    resultados selecionada será importada para esta divisão.
                  </p>
                  <label>
                    Folha de resultados
                    <select
                      value={preview.sheetName}
                      disabled={loading || !importedFile}
                      onChange={(e) => {
                        if (importedFile)
                          void importFile(importedFile, e.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Seleciona uma folha
                      </option>
                      {preview.sheets.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {preview.needsSheetSelection && (
                    <p role="status">
                      O documento tem várias folhas de resultados. Escolhe a que
                      queres importar.
                    </p>
                  )}
                  <p>
                    {preview.skippedDivision} jogos de outras divisões ignorados
                    · {preview.skippedUnplayed} jogos sem resultado ignorados.
                  </p>
                  {!!preview.convertedDates && (
                    <p role="status">
                      {preview.convertedDates} pontuações recuperadas de datas
                      com a interpretação escolhida. Confirma cada set antes de
                      guardar.
                    </p>
                  )}
                  <p>
                    {preview.games.length} jogos novos · {preview.duplicates}{" "}
                    duplicados ignorados · {preview.errors.length} erros
                  </p>
                  {preview.errors.map((e) => (
                    <p role="alert" key={e.row}>
                      Linha {e.row}: {e.message}
                    </p>
                  ))}
                  {stale && (
                    <p role="alert">
                      O evento foi alterado. Volta a importar o ficheiro.
                    </p>
                  )}
                  <DataRows
                    data={preview.games}
                    searchText={(g) =>
                      `${label(g.teamA)} ${label(g.teamB)} ${g.id}`
                    }
                    label="jogos a importar"
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
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </DataRows>
                  <button
                    disabled={
                      busy ||
                      stale ||
                      preview.needsSheetSelection ||
                      !!preview.errors.length ||
                      !preview.games.length
                    }
                    onClick={async () => {
                      const result = await run(
                        {
                          type: "admin.placement.games",
                          eventId: preview.eventId,
                          expectedVersion: preview.version,
                          games: preview.games,
                        },
                        "Jogos importados sem alterar o ranking.",
                      );
                      if (result) setPreview(null);
                    }}
                  >
                    Confirmar importação dos jogos
                  </button>
                </div>
              )}
            </>
          )}
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
