"use client";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { Challenge } from "@/lib/types";
import type { MatchVote } from "@/lib/match-voting";
import { formatSetScores, type SetScore } from "@/lib/set-scores";
import {
  matchScorePrediction,
  requiredPredictionSets,
} from "@/lib/match-score-prediction";
import styles from "./admin-match-voting.module.css";
type DraftSet = { attacker: string; defender: string };
const emptySet = (): DraftSet => ({ attacker: "", defender: "" });
export default function MatchScorePrediction({
  game,
  attacker,
  defender,
  own,
  open,
  busy,
  run,
}: {
  game: Challenge;
  attacker: string;
  defender: string;
  own?: MatchVote;
  open: boolean;
  busy: boolean;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<DraftSet[]>([
      emptySet(),
      emptySet(),
      emptySet(),
    ]),
    [error, setError] = useState(""),
    [expected, setExpected] = useState<string | null>(null);
  const mine = own?.withdrawnAt ? undefined : own;
  const firstTwo = draft
    .slice(0, 2)
    .every((s) => s.attacker !== "" && s.defender !== "")
    ? draft
        .slice(0, 2)
        .map((s) => ({
          attacker: Number(s.attacker),
          defender: Number(s.defender),
        }))
    : [];
  const needed = requiredPredictionSets(firstTwo),
    count = needed === 3 ? 3 : 2;
  const sets: SetScore[] = draft
    .slice(0, count)
    .map((s) => ({
      attacker: Number(s.attacker),
      defender: Number(s.defender),
    }));
  let preview: ReturnType<typeof matchScorePrediction> | undefined;
  if (
    draft.slice(0, count).every((s) => s.attacker !== "" && s.defender !== "")
  ) {
    try {
      preview = matchScorePrediction(sets, game.challengerId, game.defenderId);
    } catch {}
  }
  const edit = () => {
    const scores = mine?.setScores ?? [];
    setDraft(
      [0, 1, 2].map((i) =>
        scores[i]
          ? {
              attacker: String(scores[i].attacker),
              defender: String(scores[i].defender),
            }
          : emptySet(),
      ),
    );
    setExpected(own?.updatedAt ?? null);
    setError("");
    dialog.current?.showModal();
  };
  const change = (
    index: number,
    side: "attacker" | "defender",
    value: string,
  ) =>
    setDraft((current) => {
      const next = current.map((set, i) =>
        i === index ? { ...set, [side]: value } : set,
      );
      const scores = next
        .slice(0, 2)
        .every((s) => s.attacker !== "" && s.defender !== "")
        ? next
            .slice(0, 2)
            .map((s) => ({
              attacker: Number(s.attacker),
              defender: Number(s.defender),
            }))
        : [];
      if (index < 2 && requiredPredictionSets(scores) !== 3)
        next[2] = emptySet();
      return next;
    });
  return (
    <div className="stack">
      {mine && (
        <button
          className={styles.savedPrediction}
          disabled={busy || !open}
          onClick={() =>
            void run(
              {
                type: "admin.match-vote.remove",
                challengeId: game._id,
                expectedWinnerId: mine.winnerId,
                expectedUpdatedAt: mine.updatedAt,
              },
              "Palpite retirado.",
            )
          }
        >
          <strong>
            O teu palpite:{" "}
            {mine.setScores
              ? formatSetScores(mine.setScores)
              : "sem resultados por set"}
          </strong>
          <small>
            {open ? "Toca novamente para retirar" : "Palpite encerrado"}
          </small>
        </button>
      )}
      <button disabled={!open || busy} onClick={edit}>
        {mine ? "Editar palpite" : "Prever resultado"}
      </button>
      <dialog
        ref={dialog}
        className={styles.scoreDialog}
        aria-labelledby={`prediction-title-${game._id}`}
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              const value = matchScorePrediction(
                sets,
                game.challengerId,
                game.defenderId,
              );
              if (
                await run(
                  {
                    type: "admin.match-vote.predict",
                    challengeId: game._id,
                    setScores: value.setScores,
                    expectedUpdatedAt: expected,
                  },
                  "Palpite guardado.",
                )
              )
                dialog.current?.close();
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Revê os resultados dos sets.",
              );
            }
          }}
        >
          <div className="row between">
            <h2 id={`prediction-title-${game._id}`}>
              O teu palpite · Jogo #{game.number}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar palpite"
              onClick={() => dialog.current?.close()}
            >
              <X size={20} />
            </button>
          </div>
          <p className={styles.predictionNotice}>
            É apenas uma previsão. Não altera o resultado oficial do jogo.
          </p>
          <div className={styles.setTeams}>
            <strong>
              {attacker}
              <small>ATAQUE</small>
            </strong>
            <strong>
              {defender}
              <small>DEFESA</small>
            </strong>
          </div>
          {draft.slice(0, count).map((set, index) => (
            <fieldset key={index} className={styles.setRow}>
              <legend>{index + 1}.º set</legend>
              <label>
                <span className="sr-only">Ataque · {index + 1}.º set</span>
                <input
                  aria-label={`Ataque · ${index + 1}.º set`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  step={1}
                  value={set.attacker}
                  required
                  disabled={!open || busy}
                  onChange={(event) =>
                    change(index, "attacker", event.target.value)
                  }
                />
              </label>
              <span aria-hidden="true">—</span>
              <label>
                <span className="sr-only">Defesa · {index + 1}.º set</span>
                <input
                  aria-label={`Defesa · ${index + 1}.º set`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  step={1}
                  value={set.defender}
                  required
                  disabled={!open || busy}
                  onChange={(event) =>
                    change(index, "defender", event.target.value)
                  }
                />
              </label>
            </fieldset>
          ))}
          <small className="muted">
            {needed === 3
              ? "Um set para cada dupla: preenche o terceiro."
              : needed === 2
                ? "Dois sets ganhos pela mesma dupla: não há terceiro set."
                : "O terceiro set aparece apenas se cada dupla ganhar um dos dois primeiros."}
          </small>
          {preview && (
            <p>
              Este palpite prevê a vitória de{" "}
              <strong>
                {preview.winnerId === game.challengerId ? attacker : defender}
              </strong>
              .
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <button className="primary" disabled={busy || !open} type="submit">
            Guardar palpite
          </button>
        </form>
      </dialog>
    </div>
  );
}
