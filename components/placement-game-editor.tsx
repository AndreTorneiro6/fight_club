"use client";
import { useState } from "react";
import type { PlacementEvent, PlacementGame } from "@/lib/placement-types";
import { validateSetScores } from "@/lib/set-scores";
export default function PlacementGameEditor({
  event,
  game,
  run,
  busy,
  onClose,
  expectedVersion,
}: {
  event: PlacementEvent;
  game?: PlacementGame;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
  onClose?: () => void;
  expectedVersion?: number;
}) {
  const [error, setError] = useState("");
  const stale =
    expectedVersion !== undefined && expectedVersion !== event.version;
  return (
    <form
      className="stack inset"
      aria-label={
        game
          ? "Editar resultado de colocação"
          : "Adicionar resultado de colocação"
      }
      onSubmit={async (e) => {
        e.preventDefault();
        if (stale) return;
        setError("");
        const form = e.currentTarget,
          data = new FormData(form);
        try {
          const teamA = String(data.get("teamA")),
            teamB = String(data.get("teamB"));
          const setScores = [0, 1, 2]
            .filter(
              (i) =>
                data.get(`set-${i}-a`) !== "" || data.get(`set-${i}-b`) !== "",
            )
            .map((i) => ({
              a:
                data.get(`set-${i}-a`) === ""
                  ? NaN
                  : Number(data.get(`set-${i}-a`)),
              b:
                data.get(`set-${i}-b`) === ""
                  ? NaN
                  : Number(data.get(`set-${i}-b`)),
            }));
          const setsA = setScores.filter((s) => s.a > s.b).length,
            setsB = setScores.filter((s) => s.b > s.a).length;
          validateSetScores(
            setScores.map((s) => ({ attacker: s.a, defender: s.b })),
            teamA,
            teamB,
            setsA > setsB ? teamA : teamB,
          );
          const result: PlacementGame = {
            id:
              game?.id || String(data.get("id")).trim() || crypto.randomUUID(),
            teamA,
            teamB,
            setScores,
            setsA,
            setsB,
            pointsA: setScores.reduce((n, s) => n + s.a, 0),
            pointsB: setScores.reduce((n, s) => n + s.b, 0),
          };
          const saved = await run(
            game
              ? {
                  type: "admin.placement.game.update",
                  eventId: event._id,
                  expectedVersion: expectedVersion ?? event.version,
                  game: result,
                  reason: String(data.get("reason")),
                }
              : {
                  type: "admin.placement.games",
                  eventId: event._id,
                  expectedVersion: event.version,
                  games: [result],
                },
            game ? "Resultado corrigido." : "Jogo registado.",
          );
          if (saved) {
            form.reset();
            onClose?.();
          }
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Revê os resultados por set.",
          );
        }
      }}
    >
      <h3>{game ? "Editar resultado" : "Adicionar resultado"}</h3>
      <p>
        Uma pontuação por set, na ordem Equipa A / Equipa B. O terceiro set só é
        necessário com 1–1; pode ser super tie-break. Os totais são calculados a
        partir destes resultados.
      </p>
      {game && !game.setScores && (
        <p>
          Este registo antigo tem apenas totais. Preenche os resultados reais de
          cada set para guardar a correção.
        </p>
      )}
      <label>
        Identificador do jogo
        <input
          name="id"
          maxLength={150}
          defaultValue={game?.id ?? ""}
          readOnly={!!game}
          placeholder="Opcional · ID do Excel"
        />
      </label>
      <div className="form-grid">
        {(["teamA", "teamB"] as const).map((key, i) => (
          <label key={key}>
            Equipa {i ? "B" : "A"}
            <select name={key} required defaultValue={game?.[key] ?? ""}>
              <option value="">Seleciona</option>
              {event.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div className="form-grid" key={i}>
          {(["a", "b"] as const).map((side) => (
            <label key={side}>
              {i + 1}.º set · Equipa {side.toUpperCase()}
              <input
                name={`set-${i}-${side}`}
                aria-label={`${i + 1}.º set Equipa ${side.toUpperCase()}`}
                type="number"
                min={0}
                max={99}
                required={i < 2}
                defaultValue={game?.setScores?.[i]?.[side]}
              />
            </label>
          ))}
        </div>
      ))}
      {game && (
        <label>
          Motivo da correção
          <textarea name="reason" required minLength={3} maxLength={2000} />
        </label>
      )}
      {stale && (
        <p role="alert">
          Outro administrador alterou o evento. Os teus campos foram
          preservados; fecha e reabre a edição para rever a versão atual antes
          de guardar.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="row wrap">
        <button
          className="primary"
          disabled={busy || stale || event.status !== "DRAFT"}
        >
          {game ? "Guardar correção do jogo" : "Adicionar jogo"}
        </button>
        {onClose && (
          <button type="button" onClick={onClose}>
            Cancelar edição
          </button>
        )}
      </div>
    </form>
  );
}
