"use client";
import { useEffect, useMemo, useState } from "react";
import type { EngagementSettings } from "@/lib/predictions";
import {
  engagementCommand,
  useEngagement,
  type EngagementData,
} from "./engagement-client";
import styles from "./engagement.module.css";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
type LeaderboardRow = EngagementData["leaderboard"][number] & {
  position: number;
};
function PredictionLeaderboard({
  rows,
}: {
  rows: EngagementData["leaderboard"];
}) {
  const [filter, setFilter] = useState("");
  const data = useMemo(
    () => rows.map((r, i) => ({ ...r, position: i + 1 })),
    [rows],
  );
  const columns = useMemo<ColumnDef<LeaderboardRow>[]>(
    () => [
      { accessorKey: "position", header: "#" },
      { accessorKey: "name", header: "Jogador" },
      { accessorKey: "points", header: "Pontos" },
      { accessorKey: "predictions", header: "Palpites" },
      { accessorKey: "correct", header: "Vencedores certos" },
    ],
    [],
  );
  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });
  useEffect(() => {
    const last = Math.max(0, table.getPageCount() - 1);
    if (table.getState().pagination.pageIndex > last) table.setPageIndex(last);
  }, [data, filter, table]);
  return (
    <>
      <div className={styles.toolbar}>
        <label>
          Pesquisar na classificação
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              table.setPageIndex(0);
            }}
          />
        </label>
        <label>
          Linhas por página
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.tablewrap}>
        <table className={styles.table}>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((h) => (
                  <th key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.original.playerId}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.actions}>
        <span>
          {table.getFilteredRowModel().rows.length} jogadores · Página{" "}
          {table.getState().pagination.pageIndex + 1} de{" "}
          {Math.max(1, table.getPageCount())}
        </span>
        <button
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Anterior
        </button>
        <button
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Seguinte
        </button>
      </div>
    </>
  );
}
function MatchPrediction({
  match,
  data,
  onSaved,
}: {
  match: EngagementData["matches"][number];
  data: EngagementData;
  onSaved: () => Promise<void>;
}) {
  const existing = data.predictions.find((p) => p.challengeId === match.id),
    [winner, setWinner] = useState(existing?.winnerId ?? match.attackerId),
    [score, setScore] = useState<"2-0" | "2-1">(existing?.setScore ?? "2-0"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (existing) {
      setWinner(existing.winnerId);
      setScore(existing.setScore);
    }
  }, [existing?.updatedAt]);
  const cutoff =
    existing && match.cutoff && existing.lockAt < match.cutoff
      ? existing.lockAt
      : match.cutoff;
  const open =
    !!cutoff &&
    Date.now() < Date.parse(cutoff) &&
    ["scheduled", "accepted", "schedule_pending"].includes(match.status);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await engagementCommand({
        type: "prediction.save",
        challengeId: match.id,
        winnerId: winner,
        setScore: score,
      });
      await onSaved();
      setMessage("Palpite guardado.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={styles.match}>
      <div>
        <small>
          {match.division} · Jogo #{match.number}
        </small>
        <h3>
          {match.attacker} × {match.defender}
        </h3>
      </div>
      <p>
        {match.start
          ? new Date(match.start).toLocaleString("pt-PT")
          : "A aguardar horário confirmado"}
        {cutoff && (
          <> · Palpites até {new Date(cutoff).toLocaleString("pt-PT")}</>
        )}
      </p>
      <div
        className={styles.winnerChoices}
        role="group"
        aria-label={`Escolher equipa vencedora do jogo ${match.number}`}
      >
        {[
          { id: match.attackerId, name: match.attacker },
          { id: match.defenderId, name: match.defender },
        ].map((team) => (
          <button
            key={team.id}
            type="button"
            aria-pressed={winner === team.id}
            disabled={!open || busy}
            onClick={() => setWinner(team.id)}
          >
            <span>{team.name}</span>
            <strong>
              {winner === team.id ? "✓ Vence" : "Escolher vencedora"}
            </strong>
          </button>
        ))}
      </div>
      <div className={styles.formrow}>
        <label>
          Equipa vencedora
          <select
            aria-label={`Vencedor do jogo ${match.number}`}
            disabled={!open || busy}
            value={winner}
            onChange={(e) => setWinner(e.target.value)}
          >
            <option value={match.attackerId}>{match.attacker}</option>
            <option value={match.defenderId}>{match.defender}</option>
          </select>
        </label>
        <label>
          Resultado em sets
          <select
            aria-label={`Sets do jogo ${match.number}`}
            disabled={!open || busy}
            value={score}
            onChange={(e) => setScore(e.target.value as "2-0" | "2-1")}
          >
            <option>2-0</option>
            <option>2-1</option>
          </select>
        </label>
      </div>
      {open ? (
        <button disabled={busy} onClick={() => void save()}>
          {busy
            ? "A guardar…"
            : existing
              ? "Atualizar palpite"
              : "Guardar palpite"}
        </button>
      ) : (
        <span className={styles.badge}>
          {match.cutoff
            ? "PALPITES ENCERRADOS"
            : "SEM HORÁRIO — PALPITES INDISPONÍVEIS"}
        </span>
      )}
      {existing && (
        <p>
          O teu palpite:{" "}
          {existing.winnerId === match.attackerId
            ? match.attacker
            : match.defender}
          , {existing.setScore} ·{" "}
          {existing.settlement === "settled"
            ? `${existing.points} pontos`
            : existing.settlement === "void"
              ? "Anulado — 0 pontos"
              : "A aguardar resultado oficial"}
        </p>
      )}
      {match.winnerId && (
        <p>
          Resultado oficial:{" "}
          {match.winnerId === match.attackerId
            ? match.attacker
            : match.defender}{" "}
          · {match.score}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </article>
  );
}
export function PredictionCenter({ revision }: { revision?: unknown }) {
  const { data, error, refresh } = useEngagement(revision),
    [history, setHistory] = useState(false),
    [clock, setClock] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClock((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void clock;
  return (
    <section className={styles.layout}>
      <h2>Palpites Fight Club</h2>
      <p>
        Joga por pontos. Uma classificação independente, sem apostas ou prémios
        monetários.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>A carregar palpites…</p>}
      {data && (
        <>
          <p>
            Vencedor certo: <strong>{data.settings.winnerPoints} pontos</strong>
            . Resultado em sets certo:{" "}
            <strong>+{data.settings.exactScorePoints}</strong>. Os pontos só são
            atribuídos após validação oficial. Cada palpite conserva a pontuação
            em vigor quando foi criado.
          </p>
          <div className={styles.actions}>
            <button aria-pressed={!history} onClick={() => setHistory(false)}>
              Jogos publicados
            </button>
            <button aria-pressed={history} onClick={() => setHistory(true)}>
              Os meus palpites ({data.predictions.length})
            </button>
          </div>
          {data.matches.filter(
            (m) =>
              !history || data.predictions.some((p) => p.challengeId === m.id),
          ).length === 0 && (
            <p>
              {history
                ? "Ainda não tens palpites."
                : "Ainda não existem jogos oficialmente publicados. As propostas privadas nunca aparecem aqui."}
            </p>
          )}
          {data.matches
            .filter(
              (m) =>
                !history ||
                data.predictions.some((p) => p.challengeId === m.id),
            )
            .map((match) => (
              <MatchPrediction
                key={match.id}
                match={match}
                data={data}
                onSaved={refresh}
              />
            ))}
          <div className={styles.panel}>
            <h3>Classificação de palpites</h3>
            <p className={styles.muted}>
              Apenas palpites com resultado validado. Desempate: vencedores
              certos, depois nome.
            </p>
            {data.leaderboard.length ? (
              <PredictionLeaderboard rows={data.leaderboard} />
            ) : (
              <p>
                Os primeiros pontos aparecem após os resultados serem validados.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
export function EngagementAdmin({ revision }: { revision?: unknown }) {
  const { data, error, refresh } = useEngagement(revision),
    [draft, setDraft] = useState<EngagementSettings | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const settings = draft ?? data?.settings;
  async function save() {
    if (!settings) return;
    setBusy(true);
    setMessage("");
    try {
      await engagementCommand({
        type: "admin.engagement.settings",
        expectedVersion: settings.version,
        winnerPoints: settings.winnerPoints,
        exactScorePoints: settings.exactScorePoints,
        lockMinutes: settings.lockMinutes,
        ratingWeights: settings.ratingWeights,
      });
      setDraft(null);
      await refresh();
      setMessage("Definições guardadas e registadas no histórico.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.layout}>
      <h2>Cartões e palpites</h2>
      <p>
        Estas funcionalidades são independentes do ranking, dos desafios e dos
        papéis de ataque e defesa.
      </p>
      {error && <p role="alert">{error}</p>}
      {settings && (
        <form
          className={styles.panel}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h3>Pontuação dos palpites</h3>
          <div className={styles.settings}>
            {(
              [
                ["winnerPoints", "Vencedor certo", 100],
                ["exactScorePoints", "Bónus por sets certos", 100],
                ["lockMinutes", "Encerrar antes do jogo (minutos)", 1440],
              ] as const
            ).map(([key, label, max]) => (
              <label key={key}>
                {label}
                <input
                  required
                  type="number"
                  min="0"
                  max={max}
                  value={settings[key]}
                  onChange={(e) =>
                    setDraft({ ...settings, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <p className={styles.muted}>
            Novas regras de pontos aplicam-se a novos palpites. Os existentes
            conservam os pontos contratados. Um horário adiado nunca reabre um
            palpite encerrado.
          </p>
          <h3>Pesos do rating (0–100)</h3>
          <div className={styles.settings}>
            {(
              Object.keys(
                settings.ratingWeights,
              ) as (keyof EngagementSettings["ratingWeights"])[]
            ).map((key) => (
              <label key={key}>
                {
                  {
                    attack: "Ataque",
                    defense: "Defesa",
                    wins: "Vitórias",
                    consistency: "Consistência",
                    form: "Forma",
                  }[key]
                }
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  value={settings.ratingWeights[key]}
                  onChange={(e) =>
                    setDraft({
                      ...settings,
                      ratingWeights: {
                        ...settings.ratingWeights,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <p>
            Rating = soma de cada métrica × peso ÷ soma dos pesos disponíveis.
            Métricas sem dados são excluídas. A alteração recalcula os cartões
            com estatísticas reais, sem alterar resultados.
          </p>
          <div className={styles.actions}>
            <button disabled={busy} type="submit">
              {busy ? "A guardar…" : "Guardar definições"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                void refresh();
              }}
            >
              Recarregar definições
            </button>
          </div>
          {message && <p role="status">{message}</p>}
        </form>
      )}
    </section>
  );
}
