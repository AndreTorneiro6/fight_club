"use client";
import { useEffect, useState } from "react";
import { formatSetScores } from "@/lib/set-scores";
import {
  officialVotingResult,
  officialResultNews,
  matchVoteOutcome,
  voteOutcomeLabel,
} from "@/lib/match-vote-outcome";
import type { View } from "@/lib/types";
import { challengeTeamRanks } from "@/lib/challenge-team-ranks";
import { isTitleMatch } from "@/lib/title-matches";
import { challengeTeamName } from "@/lib/team-competition";
import {
  isVotingMatch,
  matchVotingCutoff,
  defaultMatchVotingSettings,
  votingCountdown,
} from "@/lib/match-voting-targets";
import ChallengeChat from "./challenge-chat";
import MatchScorePrediction from "./match-score-prediction";
import styles from "./admin-match-voting.module.css";

export default function AdminMatchVoting({
  state: s,
  run,
  busy,
  connection,
}: {
  state: View;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
  connection?: "connecting" | "live" | "reconnecting";
}) {
  const [division, setDivision] = useState("all"),
    [group, setGroup] = useState<"open" | "mine" | "waiting" | "result">(
      "open",
    ),
    [selected, setSelected] = useState<string>(),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    setSelected(
      new URLSearchParams(window.location.search).get("jogo") ?? undefined,
    );
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const games = s.challenges
    .filter(
      (c) =>
        isVotingMatch(s, c) &&
        (division === "all" || c.divisionId === division),
    )
    .sort(
      (a, b) =>
        (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999") ||
        a.number - b.number,
    );
  const game = games.find((c) => c._id === selected);
  function votingState(c: View["challenges"][number]) {
    const stored = (s.matchVotes ?? []).find(
      (v) => v.challengeId === c._id && v.userId === s.actor.userId,
    );
    const cutoff = matchVotingCutoff(s, c);
    const lockAt =
      stored && cutoff && stored.lockAt < cutoff ? stored.lockAt : cutoff;
    const open =
      !!lockAt &&
      clock < Date.parse(lockAt) &&
      ["scheduled", "accepted", "schedule_pending"].includes(c.status);
    return {
      stored,
      mine: stored?.withdrawnAt ? undefined : stored,
      lockAt,
      open,
    };
  }
  const grouped = {
    open: games.filter((c) => votingState(c).open),
    mine: games.filter((c) => votingState(c).mine),
    waiting: games.filter(
      (c) => !votingState(c).open && !officialVotingResult(s, c),
    ),
    result: games.filter((c) => !!officialVotingResult(s, c)),
  };
  const settings = s.matchVotingSettings?.[0] ?? defaultMatchVotingSettings;
  return (
    <section className={`stack ${styles.root}`} aria-label="Central de Apostas">
      <header className="panel stack">
        <div className="row between wrap">
          <h2>Central de Apostas</h2>
          <span className="badge">Um palpite por pessoa</span>
        </div>
        <div
          className={`tabs ${styles.groups}`}
          role="group"
          aria-label="Estado das apostas"
        >
          {(
            [
              ["open", "Abertas"],
              ["mine", "Os meus palpites"],
              ["waiting", "A aguardar"],
              ["result", "Resultados"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={group === id}
              className={group === id ? "active" : ""}
              onClick={() => {
                setGroup(id);
                setSelected(undefined);
              }}
            >
              {label} <span className="badge">{grouped[id].length}</span>
            </button>
          ))}
        </div>
        <p>Prevê o resultado de cada set e conversa sobre o jogo.</p>
        <p className="muted">
          Um palpite por pessoa e jogo. O terceiro set só é necessário com um
          set ganho por cada dupla. As previsões não alteram resultados
          oficiais, moedas ou o ranking.
        </p>
        {s.actor.role === "admin" && (
          <label className={styles.cutoffSetting}>
            Fechar votação antes do jogo
            <select
              aria-label="Fechar votação antes do jogo"
              value={settings.lockMinutes}
              disabled={busy}
              onChange={(event) =>
                void run(
                  {
                    type: "admin.match-vote.settings",
                    expectedVersion: settings.version,
                    lockMinutes: Number(event.target.value),
                  },
                  "Prazo da votação atualizado.",
                )
              }
            >
              <option value={30}>30 minutos antes</option>
              <option value={60}>1 hora antes</option>
            </select>
          </label>
        )}
        <div className="tabs" role="group" aria-label="Divisão da votação">
          {[["all", "Todos"], ...s.divisions.map((d) => [d._id, d.name])].map(
            ([id, label]) => (
              <button
                key={id}
                aria-pressed={division === id}
                className={division === id ? "active" : ""}
                onClick={() => {
                  setDivision(id);
                  setSelected(undefined);
                }}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </header>
      {game ? (
        <>
          <button
            className={styles.back}
            onClick={() => setSelected(undefined)}
          >
            ← Voltar aos jogos
          </button>
          {renderGame(game, true)}
          <ChallengeChat
            key={game._id}
            s={s}
            c={game}
            run={run}
            busy={busy}
            connection={connection}
            community
          />
        </>
      ) : (
        <div className={styles.grid}>
          {grouped[group].map((c) => renderGame(c, false))}
          {!grouped[group].length && (
            <p className="panel">
              {group === "mine"
                ? "Ainda não tens palpites guardados nesta divisão. Escolhe um jogo em Abertas para participar."
                : group === "open"
                  ? "Não existem apostas abertas nesta divisão."
                  : group === "waiting"
                    ? "Não existem jogos a aguardar resultado nesta divisão."
                    : "Não existem resultados oficiais nesta divisão."}
            </p>
          )}
        </div>
      )}
    </section>
  );
  function renderGame(c: View["challenges"][number], detail: boolean) {
    const { stored, mine, lockAt, open } = votingState(c);
    const official = officialVotingResult(s, c);
    const summary = s.matchVoteSummaries?.find(
      (item) => item.challengeId === c._id,
    );
    const total = summary?.total ?? 0;
    const messages = (s.matchDiscussionMessages ?? []).filter(
      (m) => m.challengeId === c._id,
    ).length;
    const ranks = challengeTeamRanks(s, c);
    const titleFight = isTitleMatch(c, s);
    const knownRanks = !!ranks.attacker && !!ranks.defender;
    return (
      <article
        key={c._id}
        className={`panel stack ${styles.game}`}
        aria-label={`Votação do jogo ${c.number}`}
      >
        <div className="row between wrap">
          <span className="eyebrow gold">
            {s.divisions.find((d) => d._id === c.divisionId)?.name} · Jogo #
            {c.number}
          </span>
          <span className="badge">
            {official
              ? "Resultado oficial"
              : open
                ? "Votação aberta"
                : "A aguardar resultado"}
          </span>
        </div>
        <h3>
          {challengeTeamName(c, c.challengerId, s.players)} ×{" "}
          {challengeTeamName(c, c.defenderId, s.players)}
        </h3>
        {official && (
          <section
            className="inset stack"
            aria-label={`Resultado oficial do jogo ${c.number}`}
          >
            <h4>Resultado oficial</h4>
            <strong>
              {official.sets
                ? formatSetScores(official.sets)
                : official.result.score || "Sets não indicados"}
            </strong>
            <small>Sets na ordem ATAQUE / DEFESA.</small>
            <p>{officialResultNews(s, c)}</p>
            {mine && (
              <p role="status">
                <strong>
                  {
                    voteOutcomeLabel[
                      matchVoteOutcome(
                        mine,
                        official.result.winnerId,
                        official.sets,
                      )
                    ]
                  }
                </strong>
              </p>
            )}
          </section>
        )}
        {!official && (
          <div className={styles.stakes}>
            <strong>
              {titleFight
                ? "Jogo do título · 1.º lugar em disputa"
                : ranks.defender
                  ? `${ranks.defender}.º lugar em disputa`
                  : "Disputa de ranking"}
            </strong>
            <small>
              {knownRanks
                ? `Se o ataque vencer, as duplas trocam o ${ranks.attacker}.º e o ${ranks.defender}.º lugares. Se a defesa vencer, mantêm as posições.`
                : "As posições históricas deste jogo não estão disponíveis."}
            </small>
          </div>
        )}
        {!open && !official && (
          <p role="status">
            A votação fechou. A aguardar confirmação do resultado pelo
            administrador.
          </p>
        )}
        <p className="muted">
          {lockAt
            ? `Votos até ${new Date(lockAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`
            : "A aguardar horário confirmado"}
        </p>
        {open && lockAt && (
          <div
            className={styles.countdown}
            role="timer"
            aria-label={`Tempo para fechar votação do jogo ${c.number}`}
          >
            Fecha em <strong>{votingCountdown(lockAt, clock)}</strong>
          </div>
        )}
        <div
          className={styles.choices}
          role="group"
          aria-label={`Palpites por dupla do jogo ${c.number}`}
        >
          {[c.challengerId, c.defenderId].map((id) => {
            const count = (summary?.outcomes ?? [])
              .filter((outcome) => outcome.winnerId === id)
              .reduce((sum, outcome) => sum + outcome.count, 0);
            const percent = total ? Math.round((count / total) * 100) : 0;
            return (
              <div
                key={id}
                className={`${styles.teamSummary} ${mine?.winnerId === id ? styles.selectedTeam : ""}`}
              >
                <small className={styles.position}>
                  {id === c.challengerId ? "ATAQUE" : "DEFESA"} ·{" "}
                  {id === c.challengerId
                    ? ranks.attacker
                      ? `${ranks.attacker}.º lugar`
                      : "Posição indisponível"
                    : ranks.defender
                      ? `${ranks.defender}.º lugar`
                      : "Posição indisponível"}
                </small>
                <strong>{challengeTeamName(c, id, s.players)}</strong>
                <span>
                  {mine?.winnerId === id ? "✓ O teu voto · " : ""}
                  {count} {count === 1 ? "voto" : "votos"} · {percent}%
                </span>
                <span className={styles.track}>
                  <span style={{ width: `${percent}%` }} />
                </span>
              </div>
            );
          })}
        </div>
        <section
          className={styles.anonymousResults}
          aria-label={`Palpites por resultado do jogo ${c.number}`}
        >
          <div className="row between wrap">
            <h4>Palpites por resultado</h4>
            <span className="badge">Anónimos</span>
          </div>
          <small className="muted">
            Sets na ordem ATAQUE / DEFESA. Os autores não são apresentados.
          </small>
          {summary?.outcomes.length ? (
            <ul>
              {summary.outcomes.map((outcome) => (
                <li key={JSON.stringify([outcome.winnerId, outcome.setScores])}>
                  <strong>
                    {outcome.setScores
                      ? formatSetScores(outcome.setScores)
                      : `Vitória de ${challengeTeamName(c, outcome.winnerId, s.players)} · sem sets`}
                  </strong>
                  <span>
                    {outcome.count}{" "}
                    {outcome.count === 1 ? "palpite" : "palpites"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Ainda não existem palpites.</p>
          )}
        </section>
        <MatchScorePrediction
          game={c}
          attacker={challengeTeamName(c, c.challengerId, s.players)}
          defender={challengeTeamName(c, c.defenderId, s.players)}
          own={stored}
          open={open}
          busy={busy}
          run={run}
        />
        <small className="muted">
          Posições das duplas guardadas para este jogo.
        </small>
        <div className="row between wrap">
          <small>
            {total} votos · {messages} mensagens
          </small>
          {!detail && (
            <button onClick={() => setSelected(c._id)}>
              Abrir conversa do jogo
            </button>
          )}
        </div>
      </article>
    );
  }
}
