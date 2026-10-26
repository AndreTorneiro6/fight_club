"use client";
import { useEffect, useState } from "react";
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
    [selected, setSelected] = useState<string>(),
    [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (s.actor.role !== "admin") return null;
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
  const settings = s.matchVotingSettings?.[0] ?? defaultMatchVotingSettings;
  return (
    <section
      className={`stack ${styles.root}`}
      aria-label="Central de Apostas em teste privado"
    >
      <header className="panel stack">
        <div className="row between wrap">
          <h2>Central de Apostas</h2>
          <span className="badge">Teste privado · só administradores</span>
        </div>
        <p>Vota na dupla que vai ganhar e conversa sobre cada jogo.</p>
        <p className="muted">
          Um voto por pessoa e jogo. Podes mudar até ao fecho. Sem resultados em
          sets, moedas ou alterações à classificação da liga.
        </p>
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
          {games.map((c) => renderGame(c, false))}
          {!games.length && (
            <p className="panel">
              Ainda não existem jogos publicados nesta divisão.
            </p>
          )}
        </div>
      )}
    </section>
  );
  function renderGame(c: View["challenges"][number], detail: boolean) {
    const stored = (s.matchVotes ?? []).find(
      (v) => v.challengeId === c._id && v.userId === s.actor.userId,
    );
    const votes = (s.matchVotes ?? []).filter(
        (v) => v.challengeId === c._id && !v.withdrawnAt,
      ),
      mine = stored?.withdrawnAt ? undefined : stored,
      cutoff = matchVotingCutoff(s, c),
      lockAt =
        stored && cutoff && stored.lockAt < cutoff ? stored.lockAt : cutoff;
    const open =
      !!lockAt &&
      clock < Date.parse(lockAt) &&
      ["scheduled", "accepted", "schedule_pending"].includes(c.status);
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
            {open ? "Votação aberta" : "Votação fechada"}
          </span>
        </div>
        <h3>
          {challengeTeamName(c, c.challengerId, s.players)} ×{" "}
          {challengeTeamName(c, c.defenderId, s.players)}
        </h3>
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
          aria-label={`Dupla vencedora do jogo ${c.number}`}
        >
          {[c.challengerId, c.defenderId].map((id) => {
            const count = votes.filter((v) => v.winnerId === id).length;
            const percent = votes.length
              ? Math.round((count / votes.length) * 100)
              : 0;
            return (
              <button
                key={id}
                type="button"
                disabled={busy || !open}
                aria-pressed={mine?.winnerId === id}
                onClick={() =>
                  void run(
                    mine?.winnerId === id
                      ? {
                          type: "admin.match-vote.remove",
                          challengeId: c._id,
                          expectedWinnerId: mine.winnerId,
                          expectedUpdatedAt: mine.updatedAt,
                        }
                      : {
                          type: "admin.match-vote.save",
                          challengeId: c._id,
                          winnerId: id,
                        },
                    mine?.winnerId === id ? "Voto retirado." : "Voto guardado.",
                  )
                }
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
              </button>
            );
          })}
        </div>
        {open && (
          <small className="muted">
            Toca na dupla para votar. Toca novamente na dupla selecionada para
            retirar o voto.
          </small>
        )}
        <small className="muted">
          Posições das duplas guardadas para este jogo.
        </small>
        <div className="row between wrap">
          <small>
            {votes.length} votos · {messages} mensagens
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
