"use client";
import { useEffect, useState } from "react";
import type { View, State, Challenge } from "@/lib/types";
import { rankingEntries } from "@/lib/ranking-groups";
import { dynamicWeeklyPlan } from "@/lib/dynamic-weekly";
import { clubWeek } from "@/lib/calendar";
import { challengeDistance } from "@/lib/challenge-distance";

export default function OuroOpponentsControl({
  s,
  week,
  teamKey,
  run,
  busy,
}: {
  s: View;
  week: string;
  teamKey: string;

  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const division = s.divisions.find((d) => d.code === "ouro")!;
  const teams = rankingEntries(s.players, division._id);
  const index = teams.findIndex((t) => t.id === teamKey);
  const round = s.weeklyRounds.find((r) => r.weekStart === week);
  const defaults = teams.slice(0, index).map((t) => t.id);
  const saved = JSON.stringify(
    round?.ouroAllowedOpponents?.[teamKey] ?? defaults,
  );
  const [selected, setSelected] = useState<string[]>(JSON.parse(saved));
  const [simulation, setSimulation] = useState("");
  useEffect(() => {
    setSelected(JSON.parse(saved));
    setSimulation("");
  }, [saved, week, teamKey]);
  if (!round || index < 1) return null;
  const preview = {
    ...s,
    weeklyRounds: s.weeklyRounds.map((r) =>
      r.weekStart === week
        ? {
            ...r,
            ouroAllowedOpponents: {
              ...r.ouroAllowedOpponents,
              [teamKey]: selected,
            },
          }
        : r,
    ),
  } as State;
  const initial = dynamicWeeklyPlan(preview, division._id, week);
  const name = (key: string) =>
    teams
      .find((t) => t.id === key)
      ?.members.map((p) => p.name)
      .join(" + ") ?? key;
  const rank = (key: string) => teams.findIndex((t) => t.id === key) + 1;
  const options = initial.eligible;
  const example = options.find(
    (p) => `${p.attackerKey}>${p.defenderKey}` === simulation,
  );
  if (example)
    preview.challenges = [
      ...preview.challenges,
      {
        _id: "preview-only",
        divisionId: division._id,
        weekStart: week,
        createdAt: new Date().toISOString(),
        challengerId: example.attackerId,
        defenderId: example.defenderId,
        status: "accepted",
      } as Challenge,
    ];
  const plan = example
    ? dynamicWeeklyPlan(preview, division._id, week)
    : initial;
  const historical = week < clubWeek().start;
  const fixed = initial.fixed.some(
    (p) => p.attackerKey === teamKey || p.defenderKey === teamKey,
  );
  const targets = plan.eligible.filter((p) => p.attackerKey === teamKey);
  const available = targets.map(
    (p) =>
      `#${rank(p.defenderKey)} ${name(p.defenderKey)}${rank(p.attackerKey) - rank(p.defenderKey) > challengeDistance(s, division._id) || (rank(p.defenderKey) === 1 && rank(p.attackerKey) > s.settings[0].titleMaxPosition) ? " · alcance alargado necessário" : ""}`,
  );
  return (
    <details className="inset stack">
      <summary>Adversários permitidos e simulação</summary>
      <p>Opções calculadas com os papéis guardados.</p>
      <p>
        Alcance normal: {challengeDistance(s, division._id)} posições. As
        exclusões também se aplicam ao alcance alargado.
      </p>
      <div className="stack">
        {teams.slice(0, index).map((t) => (
          <label className="check" key={t.id}>
            <input
              type="checkbox"
              checked={selected.includes(t.id)}
              disabled={busy || fixed || historical}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, t.id]
                    : selected.filter((k) => k !== t.id),
                )
              }
            />
            #{rank(t.id)} {name(t.id)}
          </label>
        ))}
      </div>
      <button
        className="small"
        disabled={
          busy || fixed || historical || saved === JSON.stringify(selected)
        }
        onClick={() =>
          void run(
            {
              type: "admin.week.ouro.opponents.save",
              weekStart: week,
              expectedVersion: round.version ?? 0,
              teamKey,
              allowedTeamKeys: selected,
            },
            "Adversários permitidos guardados.",
          )
        }
      >
        Guardar adversários permitidos
      </button>
      {fixed && <p>Esta dupla já tem um confronto definido.</p>}
      <label>
        Simular outro desafio · não cria jogos
        <select
          value={simulation}
          onChange={(e) => setSimulation(e.target.value)}
        >
          <option value="">Situação atual</option>
          {options.map((p) => (
            <option
              key={`${p.attackerKey}>${p.defenderKey}`}
              value={`${p.attackerKey}>${p.defenderKey}`}
            >
              #{rank(p.attackerKey)} → #{rank(p.defenderKey)}
            </option>
          ))}
        </select>
      </label>
      <p>
        {example ? "Após o desafio simulado" : "Disponíveis agora"}:{" "}
        {available.join("; ") || "Sem adversários para atacar."}
      </p>
      <p>
        {plan.maximumMatches} jogos possíveis para {teams.length} duplas.
        {plan.maximumMatches * 2 < teams.length
          ? " As regras e exclusões deixam duplas sem jogo possível."
          : ""}
      </p>
      {example && (
        <p>
          Restantes confrontos:{" "}
          {plan.canonical
            .map((p) => `#${rank(p.attackerKey)} → #${rank(p.defenderKey)}`)
            .join("; ") || "Nenhum."}
        </p>
      )}
    </details>
  );
}
