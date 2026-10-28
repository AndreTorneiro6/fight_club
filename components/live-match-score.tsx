"use client";
import { useEffect, useState } from "react";
import styles from "./live-match-score.module.css";
import type { Challenge, View } from "@/lib/types";
import { completedLiveSet, liveScoreFor } from "@/lib/live-score";
import { challengeTeamName } from "@/lib/team-competition";

function useMatchClock(c: Challenge) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const until = Date.parse(c.scheduledAt ?? "") - Date.now();
    const delay = until > 0 ? Math.min(30000, until) : 30000;
    const timer = setTimeout(update, delay);
    window.addEventListener("focus", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
    };
  }, [c.scheduledAt, now]);
  return now;
}
export function LiveMatchScore({ c }: { c: Challenge }) {
  const current = liveScoreFor(c, useMatchClock(c));
  if (!current) return null;
  return (
    <div
      className={styles.score}
      aria-label={`Marcador provisório do jogo ${c.number}`}
    >
      <strong>
        Sets · {current.attacker}–{current.defender}
      </strong>
      {current.games && (
        <span>
          {current.games
            .map((g, i) => `${i + 1}.º set: ${g.attacker}–${g.defender}`)
            .join(" · ")}
        </span>
      )}
      <small>Provisório · ATAQUE / DEFESA</small>
    </div>
  );
}
export function LiveMatchScoreEditor({
  s,
  c,
  run,
  busy,
}: {
  s: View;
  c: Challenge;
  busy: boolean;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
}) {
  const now = useMatchClock(c);
  const [open, setOpen] = useState(false);
  if (s.actor.role !== "admin" || !liveScoreFor(c, now)) return null;
  return (
    <div className={styles.editor}>
      <button
        disabled={busy}
        aria-expanded={open}
        aria-controls={`live-score-${c._id}`}
        onClick={() => setOpen(!open)}
      >
        Atualizar marcador (opcional)
      </button>
      {open && (
        <ScoreForm
          key={`${c._id}:${c.liveScore?.version ?? 0}`}
          {...{ s, c, run, busy }}
          close={() => setOpen(false)}
        />
      )}
    </div>
  );
}
function ScoreForm({
  s,
  c,
  run,
  busy,
  close,
}: {
  s: View;
  c: Challenge;
  busy: boolean;
  close: () => void;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
}) {
  const existing =
    c.liveScore?.scheduledAt === c.scheduledAt ? c.liveScore : undefined;
  const [detail, setDetail] = useState(!!existing?.games);
  const [totals, setTotals] = useState({
    attacker: existing?.attacker ?? 0,
    defender: existing?.defender ?? 0,
  });
  const [games, setGames] = useState(
    existing?.games ?? [{ attacker: 0, defender: 0 }],
  );
  const counts = { attacker: 0, defender: 0 };
  games.forEach((g, i) => {
    if (completedLiveSet(g.attacker, g.defender, i === 2))
      counts[g.attacker > g.defender ? "attacker" : "defender"]++;
  });
  return (
    <form
      id={`live-score-${c._id}`}
      className={`inset ${styles.form}`}
      aria-label={`Atualizar marcador do jogo ${c.number}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await run(
            {
              type: "admin.live-score.save",
              challengeId: c._id,
              expectedVersion: c.liveScore?.version ?? 0,
              ...(detail ? counts : totals),
              games: detail ? games : undefined,
            },
            "Marcador provisório atualizado.",
          )
        )
          close();
      }}
    >
      <p>
        Atualização opcional. Só a confirmação oficial liquida as apostas e
        atualiza o ranking.
      </p>
      <label>
        Detalhe do marcador
        <select
          aria-label="Detalhe do marcador"
          value={detail ? "games" : "sets"}
          onChange={(e) => setDetail(e.target.value === "games")}
        >
          <option value="sets">Só sets</option>
          <option value="games">Jogos de cada set</option>
        </select>
      </label>
      <small>
        ATAQUE: {challengeTeamName(c, c.challengerId, s.players)} · DEFESA:{" "}
        {challengeTeamName(c, c.defenderId, s.players)}
      </small>
      {!detail ? (
        <div className="row wrap">
          {(["attacker", "defender"] as const).map((side) => (
            <label key={side}>
              Sets {side === "attacker" ? "ataque" : "defesa"}
              <input
                type="number"
                min={0}
                max={2}
                required
                value={totals[side]}
                onChange={(e) =>
                  setTotals({ ...totals, [side]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      ) : (
        <>
          <strong>
            Sets · {counts.attacker}–{counts.defender}
          </strong>
          {games.map((g, i) => (
            <div className="row wrap" key={i}>
              {(["attacker", "defender"] as const).map((side) => (
                <label key={side}>
                  {i + 1}.º set · {side === "attacker" ? "Ataque" : "Defesa"}
                  <input
                    type="number"
                    min={0}
                    max={99}
                    required
                    value={g[side]}
                    onChange={(e) =>
                      setGames(
                        games.map((v, j) =>
                          j === i
                            ? { ...v, [side]: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          ))}
          <div className="row wrap">
            {games.length < 3 && (
              <button
                type="button"
                onClick={() =>
                  setGames([...games, { attacker: 0, defender: 0 }])
                }
              >
                Adicionar set
              </button>
            )}
            {games.length > 1 && (
              <button
                type="button"
                onClick={() => setGames(games.slice(0, -1))}
              >
                Remover último set
              </button>
            )}
          </div>
        </>
      )}
      <div className="row wrap">
        <button className="primary" disabled={busy}>
          Guardar marcador provisório
        </button>
        <button type="button" onClick={close}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
