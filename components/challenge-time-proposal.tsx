"use client";
import { useState } from "react";
import { clubDateTime, clubDay, wallTime } from "@/lib/calendar";
import type { View } from "@/lib/types";
import type {
  CompetitionChallenge,
  CompetitionRound,
} from "@/lib/competition-types";
import { challengeContext } from "@/lib/challenge-access";
type Props = {
  s: View;
  round: CompetitionRound;
  challenge: CompetitionChallenge;
  busy?: boolean;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
};
export default function ChallengeTimeProposal({
  s,
  round: r,
  challenge: c,
  busy,
  run,
}: Props) {
  const [error, setError] = useState(""),
    [court, setCourt] = useState(c.timeProposal?.courtId ?? "");
  const admin = s.actor.role === "admin",
    teams = challengeContext(s, r).teams,
    own = teams.find((t) =>
      t.members.some((m) => m.playerId === s.actor.playerId),
    ),
    p = c.timeProposal;
  const initialStart =
    p?.start ??
    new Date(Math.ceil(Date.parse(r.startsAt) / 60000) * 60000).toISOString();
  const writable =
    c.status === "ACCEPTED" &&
    !r.locked &&
    !r.settledAt &&
    !r.challengesBlocked;
  const ownConfirmed =
    own?.id === c.attackerId
      ? p?.attackerConfirmed
      : own?.id === c.defenderId
        ? p?.defenderConfirmed
        : false;
  const labels = {
    PENDING_TEAMS: "Horário proposto — aguarda confirmação da outra dupla",
    AWAITING_ADMIN:
      "As duas duplas confirmaram o horário — aguarda decisão administrativa",
    APPROVED: "Jogo aprovado e publicado pelo clube",
    REJECTED: "Horário recusado — é necessária outra proposta",
  };
  if (c.status !== "ACCEPTED" && !p) return null;
  return (
    <div className="inset stack" aria-label="Proposta de horário do desafio">
      <h4>Marcação e decisão do clube</h4>
      {!p && (
        <p>
          O desafio está aceite. As duplas podem propor uma data e hora; o clube
          toma a decisão final.
        </p>
      )}
      {p && (
        <>
          <strong>{labels[p.status]}</strong>
          <p>
            {new Date(p.start).toLocaleString("pt-PT", {
              timeZone: "Europe/Lisbon",
            })}{" "}
            · {p.minutes} minutos ·{" "}
            {s.courts.find((x) => x._id === p.courtId)?.name ??
              "Campo por atribuir"}
          </p>
          <small>
            Dupla atacante:{" "}
            {p.attackerConfirmed ? "confirmou" : "aguarda confirmação"} · Dupla
            defensora:{" "}
            {p.defenderConfirmed ? "confirmou" : "aguarda confirmação"}
          </small>
          {p.reason && <p>Motivo: {p.reason}</p>}
        </>
      )}
      {admin && p && writable && (
        <>
          <label>
            Campo para a marcação
            <select value={court} onChange={(e) => setCourt(e.target.value)}>
              <option value="">Selecionar campo</option>
              {s.courts
                .filter((x) => x.active)
                .map((x) => (
                  <option key={x._id} value={x._id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="row wrap">
            <button
              disabled={
                busy ||
                p.status !== "AWAITING_ADMIN" ||
                !p.attackerConfirmed ||
                !p.defenderConfirmed ||
                !court
              }
              onClick={() =>
                run(
                  {
                    type: "competition.challenge.time.decide",
                    challengeId: c._id,
                    expectedVersion: c.timeVersion ?? 0,
                    accept: true,
                    courtId: court,
                  },
                  "Jogo aprovado e publicado",
                )
              }
            >
              APROVAR E PUBLICAR JOGO
            </button>
            <button
              disabled={busy || p.status === "REJECTED"}
              onClick={() => {
                const reason = window.prompt("Motivo da recusa do horário");
                if (reason)
                  void run(
                    {
                      type: "competition.challenge.time.decide",
                      challengeId: c._id,
                      expectedVersion: c.timeVersion ?? 0,
                      accept: false,
                      reason,
                    },
                    "Horário recusado com registo",
                  );
              }}
            >
              RECUSAR HORÁRIO
            </button>
          </div>
          <small>
            A aprovação publica este jogo no calendário oficial e notifica as
            duas duplas. Os restantes desafios continuam a aguardar decisão.
          </small>
        </>
      )}
      {!admin && writable && own && (
        <>
          {p?.status === "PENDING_TEAMS" && !ownConfirmed && (
            <div className="row wrap">
              <button
                disabled={busy}
                onClick={() =>
                  run(
                    {
                      type: "competition.challenge.time.respond",
                      challengeId: c._id,
                      expectedVersion: c.timeVersion ?? 0,
                      accept: true,
                    },
                    "Horário confirmado; aguarda decisão do clube",
                  )
                }
              >
                CONFIRMAR HORÁRIO
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt(
                    "Motivo para recusar este horário",
                  );
                  if (reason)
                    void run(
                      {
                        type: "competition.challenge.time.respond",
                        challengeId: c._id,
                        expectedVersion: c.timeVersion ?? 0,
                        accept: false,
                        reason,
                      },
                      "Horário recusado",
                    );
                }}
              >
                RECUSAR HORÁRIO
              </button>
            </div>
          )}
          <details open={!p || p.status === "REJECTED"}>
            <summary>
              {p ? "Propor outro horário" : "Propor data e hora"}
            </summary>
            <form
              className="stack"
              aria-label="Propor horário do jogo"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                const data = new FormData(e.currentTarget);
                try {
                  const start = clubDateTime(
                    String(data.get("day")),
                    String(data.get("time")),
                  );
                  await run(
                    {
                      type: "competition.challenge.time.propose",
                      challengeId: c._id,
                      expectedVersion: c.timeVersion ?? 0,
                      start,
                      courtId: String(data.get("court")) || undefined,
                    },
                    "Horário proposto; aguarda confirmação da outra dupla",
                  );
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Horário inválido.",
                  );
                }
              }}
            >
              <label>
                Data proposta
                <input
                  type="date"
                  name="day"
                  required
                  min={clubDay(r.startsAt)}
                  max={clubDay(Date.parse(r.endsAt) - 1)}
                  defaultValue={clubDay(initialStart)}
                />
              </label>
              <label>
                Hora proposta
                <input
                  type="time"
                  name="time"
                  required
                  defaultValue={wallTime(Date.parse(initialStart)).time}
                />
              </label>
              <label>
                Campo preferido
                <select name="court" defaultValue={p?.courtId ?? ""}>
                  <option value="">A organização escolhe</option>
                  {s.courts
                    .filter((x) => x.active)
                    .map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
              <small>
                Uma nova proposta invalida as confirmações e a aprovação do
                horário anterior.
              </small>
              <button
                disabled={
                  busy || Date.now() >= Date.parse(r.schedulingDeadline)
                }
              >
                ENVIAR PROPOSTA DE HORÁRIO
              </button>
            </form>
          </details>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
