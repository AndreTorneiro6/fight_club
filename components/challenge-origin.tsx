"use client";
import Link from "next/link";
import { challengeOrigin, challengeOriginLabels } from "@/lib/challenge-origin";
import type { Challenge, View } from "@/lib/types";
export default function ChallengeOriginLabel({
  s,
  c,
  detailed = false,
}: {
  s: View;
  c: Challenge;
  detailed?: boolean;
}) {
  if (s.actor.role !== "admin") return null;
  const origin = challengeOrigin(s, c),
    actor = s.players.find((p) => p.userId === origin.actorUserId),
    trigger = s.challenges.find((x) => x._id === origin.triggerChallengeId);
  if (!detailed)
    return (
      <span
        className={`badge ${origin.kind === "rules" ? "gold" : ""}`}
        data-challenge-origin={origin.kind}
      >
        {challengeOriginLabels[origin.kind]}
      </span>
    );
  return (
    <div
      className="inset stack"
      style={{ gap: 6 }}
      data-challenge-origin={origin.kind}
    >
      <strong>{challengeOriginLabels[origin.kind]}</strong>
      {actor && origin.kind !== "rules" && (
        <small>Registado por {actor.name}.</small>
      )}
      {origin.kind === "rules" && (
        <small>
          {origin.reason ??
            "Emparelhamento automático necessário para preservar a prioridade e a cobertura da jornada."}
        </small>
      )}
      {trigger && (
        <Link className="link" href={`/desafios/${trigger._id}`}>
          Originado pelo desafio #{String(trigger.number).padStart(3, "0")}
        </Link>
      )}
      {origin.kind === "unknown" && (
        <small>
          O histórico disponível não permite confirmar quem iniciou este
          confronto.
        </small>
      )}
    </div>
  );
}
