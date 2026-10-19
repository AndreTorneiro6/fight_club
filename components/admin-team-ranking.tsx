"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Snowflake } from "lucide-react";
import { rankingEntries } from "@/lib/ranking-groups";
import { frozenRanking } from "@/lib/weekly";
import type { View } from "@/lib/types";

export default function AdminTeamRanking({
  s,
  run,
  busy,
}: {
  s: View;
  run: (command: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [division, setDivision] = useState(
    s.players.find((player) => player._id === s.actor.playerId)?.divisionId ??
      s.divisions[0]?._id ??
      "",
  );
  const [dragging, setDragging] = useState<string | null>(null),
    [over, setOver] = useState<string | null>(null);
  const entries = rankingEntries(s.players, division);
  async function move(playerId: string, targetPlayerId: string) {
    setDragging(null);
    setOver(null);
    await run(
      { type: "admin.ranking.move", playerId, targetPlayerId },
      "Posição da equipa atualizada.",
    );
  }
  return (
    <section className="panel stack">
      <div>
        <h2>Ordenar ranking por equipas</h2>
        <p>
          Arrasta uma equipa para a posição pretendida. Os botões de subir e
          descer também funcionam no telemóvel.
        </p>
      </div>
      <label>
        Categoria do ranking
        <select
          value={division}
          onChange={(event) => {
            setDivision(event.target.value);
            setDragging(null);
            setOver(null);
          }}
        >
          {s.divisions.map((division) => (
            <option key={division._id} value={division._id}>
              {division.name}
            </option>
          ))}
        </select>
      </label>
      <ol className="team-ranking-list" aria-label="Ranking de equipas">
        {entries.map((entry, index) => {
          const frozen = entry.members.some((member) =>
            frozenRanking(s, member._id),
          );
          const label = entry.members.map((member) => member.name).join(" + ");
          return (
            <li
              key={entry.id}
              data-admin-ranking-entry={entry.id}
              className={`inset team-ranking-item ${over === entry.id ? "drag-over" : ""} ${dragging === entry.members[0]._id ? "dragging" : ""}`}
              draggable={!busy && !frozen}
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", entry.members[0]._id);
                event.dataTransfer.effectAllowed = "move";
                setDragging(entry.members[0]._id);
              }}
              onDragOver={(event) => {
                if (
                  !busy &&
                  dragging &&
                  !entry.members.some((member) => member._id === dragging)
                ) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setOver(entry.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain");
                if (
                  !busy &&
                  entries.some((entry) =>
                    entry.members.some((member) => member._id === id),
                  )
                )
                  void move(id, entry.members[0]._id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <GripVertical size={20} aria-hidden="true" />
              <span className="rank-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="team-ranking-names">
                <strong>{label}</strong>
                <small>
                  {entry.members.length > 1 ? "Equipa" : "Jogador sem parceiro"}{" "}
                  ·{" "}
                  {entry.members
                    .map((member) => `#${member.position}`)
                    .join(" / ")}
                </small>
                {frozen && (
                  <small className="role-label">
                    <Snowflake size={13} />
                    Ranking congelado
                  </small>
                )}
              </div>
              <div className="row">
                <button
                  className="icon-button"
                  aria-label={`Subir ${label}`}
                  disabled={busy || frozen || index === 0}
                  onClick={() =>
                    void move(
                      entry.members[0]._id,
                      entries[index - 1].members[0]._id,
                    )
                  }
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Descer ${label}`}
                  disabled={busy || frozen || index === entries.length - 1}
                  onClick={() =>
                    void move(
                      entry.members[0]._id,
                      entries[index + 1].members[0]._id,
                    )
                  }
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {!entries.length && (
        <p>Não existem equipas ou jogadores aprovados nesta categoria.</p>
      )}
      <small>
        Os parceiros movem-se juntos. As posições congeladas são preservadas e
        todas as alterações ficam no histórico da liga.
      </small>
    </section>
  );
}
