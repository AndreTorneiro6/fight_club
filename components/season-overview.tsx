"use client";
import { useState, type FormEvent } from "react";
import { seasonDetails } from "@/lib/season-details";
import type { Season, State } from "@/lib/types";
import styles from "./season-overview.module.css";

export function SeasonOverview({
  state,
  season,
}: {
  state: State;
  season: Season;
}) {
  const stats = seasonDetails(state, season);
  const source = {
    current: "Plantel atual da época.",
    planned:
      "Plantel previsto a partir dos jogadores atuais; confirma as inscrições antes de iniciar.",
    archived: "Plantel do ranking final guardado.",
    recorded:
      "Arquivo antigo sem plantel completo: contam apenas participantes registados nos desafios.",
  }[stats.source];
  return (
    <div className={styles.overview}>
      <dl className={styles.totals}>
        {[
          ["Jogadores", stats.players],
          ["Equipas", stats.teams],
          ["Jogos", stats.matches],
          ["Concluídos", stats.completed],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">{source}</p>
      <details>
        <summary>Detalhes da época</summary>
        <p>
          {stats.divisions.length} divisões · {stats.scheduled} jogos marcados ·{" "}
          {stats.pending} jogos por marcar
        </p>
        <div className={styles.table}>
          <table>
            <caption>Jogadores e jogos por divisão · {season.name}</caption>
            <thead>
              <tr>
                <th>Divisão</th>
                <th>Jogadores</th>
                <th>Equipas</th>
                <th>Jogos</th>
                <th>Concluídos</th>
                <th>Marcados</th>
                <th>Por marcar</th>
              </tr>
            </thead>
            <tbody>
              {stats.divisions.map((d) => (
                <tr key={d.id}>
                  <th scope="row">{d.name}</th>
                  <td>{d.players}</td>
                  <td>{d.teams}</td>
                  <td>{d.matches}</td>
                  <td>{d.completed}</td>
                  <td>{d.scheduled}</td>
                  <td>{d.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Os jogos incluem partidas marcadas e resultados confirmados nesta
          época. Desafios pendentes, cancelados e recusados não contam como
          jogos realizados. Cada partida de equipa conta uma vez.
        </p>
      </details>
    </div>
  );
}
export function SeasonEditor({
  season,
  busy,
  run,
  close,
}: {
  season: Season;
  busy: boolean;
  run: (command: unknown, message?: string) => Promise<unknown>;
  close: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    name: season.name,
    start: season.start,
    end: season.end,
    pauseStart: season.pauseStart,
    pauseEnd: season.pauseEnd,
  }));
  const [version, setVersion] = useState(season.version ?? 0),
    [error, setError] = useState("");
  const conflict = (season.version ?? 0) !== version;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const result = await run(
        {
          type: "admin.season.update",
          seasonId: season._id,
          expectedVersion: version,
          ...draft,
        },
        "Época atualizada.",
      );
      if (result) close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  }
  return (
    <form onSubmit={(event) => void save(event)}>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {conflict && (
        <div className="error" role="alert">
          Esta época foi alterada por outro administrador. O teu texto foi
          mantido.{" "}
          <button
            type="button"
            onClick={() => {
              setDraft({
                name: season.name,
                start: season.start,
                end: season.end,
                pauseStart: season.pauseStart,
                pauseEnd: season.pauseEnd,
              });
              setVersion(season.version ?? 0);
              setError("");
            }}
          >
            Carregar versão atual
          </button>
        </div>
      )}
      <label>
        Nome da época
        <input
          value={draft.name}
          required
          minLength={2}
          maxLength={150}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <div className="form-grid">
        {(
          [
            ["start", "Início da época"],
            ["end", "Fim da época"],
            ["pauseStart", "Pausa · início opcional"],
            ["pauseEnd", "Pausa · fim opcional"],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="date"
              required={key === "start" || key === "end"}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="muted">
        As datas definem o período da época. Para começar a competição, usa
        Iniciar / retomar. Guardar estas alterações não muda rankings nem
        remarca jogos publicados.
      </p>
      <button
        className="primary"
        disabled={busy || conflict || season.status === "completed"}
      >
        Guardar alterações da época
      </button>
    </form>
  );
}
