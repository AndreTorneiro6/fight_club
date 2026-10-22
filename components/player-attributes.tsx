"use client";
import { useState } from "react";
import {
  attributeKeys,
  personalRating,
  normalizePlayerAttributes,
  type PadelAttributes,
  type PlayerAttributes,
} from "@/lib/padel-attributes";
import type { PlayerCard } from "@/lib/player-cards";
import { engagementCommand, useEngagement } from "./engagement-client";
import styles from "./player-attributes.module.css";

const labels = {
  speed: "Velocidade",
  smash: "Smash",
  lob: "Lob",
  volley: "Voleio",
  defense: "Defesa",
  physic: "Físico",
};
const initial: PadelAttributes = {
  speed: 50,
  smash: 50,
  lob: 50,
  volley: 50,
  defense: 50,
  physic: 50,
};
export function PlayerAttributesEditor({
  card,
  saved,
  refresh,
  adminTarget = false,
}: {
  card: PlayerCard;
  saved: PlayerAttributes | null;
  refresh: () => Promise<void>;
  adminTarget?: boolean;
}) {
  const [draft, setDraft] = useState<{
    attributes: PadelAttributes;
    overall?: number;
    version: number;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const normalized = saved ? normalizePlayerAttributes(saved) : null;
  const attributes = draft?.attributes ?? normalized?.attributes ?? initial;
  const rating =
    draft?.overall ?? normalized?.overall ?? personalRating(attributes);
  const badges = [
    saved ? "Perfil criado" : "Cria o teu cartão",
    ...(card.played ? ["Primeiro jogo"] : []),
    ...(card.won >= 1 ? ["Primeira vitória"] : []),
    ...(card.played >= 10 ? ["10 jogos oficiais"] : []),
    ...(card.champion ? ["Campeão"] : []),
  ];
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await engagementCommand({
        type: "player.attributes.save",
        expectedVersion: draft?.version ?? saved?.version ?? 0,
        attributes,
        overall: rating,
        ...(adminTarget ? { playerId: card.playerId } : {}),
      });
      await refresh();
      setDraft(null);
      setMessage(
        adminTarget
          ? "Cartão do jogador atualizado."
          : "Atributos guardados no teu cartão.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    setBusy(true);
    setMessage("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d")!;
      const colors =
        card.theme === "ouro"
          ? ["#201a08", "#c99b3e"]
          : card.theme === "prata"
            ? ["#111c29", "#a8c5df"]
            : ["#25150e", "#c18658"];
      const gradient = ctx.createLinearGradient(0, 0, 720, 1000);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 720, 1000);
      ctx.strokeStyle = "#ffffff77";
      ctx.lineWidth = 3;
      ctx.strokeRect(30, 30, 660, 940);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("FIGHT CLUB · PADEL", 360, 85);
      ctx.font = "bold 125px sans-serif";
      ctx.fillText(String(rating), 165, 225);
      let photoDrawn = false;
      if (card.photo) {
        try {
          const url = new URL(card.photo, location.origin);
          if (url.origin === location.origin) {
            const image = new Image();
            image.src = url.href;
            await image.decode();
            ctx.save();
            ctx.beginPath();
            ctx.arc(480, 185, 76, 0, Math.PI * 2);
            ctx.clip();
            const scale = Math.max(152 / image.width, 152 / image.height);
            ctx.drawImage(
              image,
              480 - (image.width * scale) / 2,
              185 - (image.height * scale) / 2,
              image.width * scale,
              image.height * scale,
            );
            ctx.restore();
            photoDrawn = true;
          }
        } catch {
          /* A missing photograph falls back to initials. */
        }
      }
      if (!photoDrawn) {
        ctx.font = "bold 64px sans-serif";
        ctx.fillText(
          card.name
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join(""),
          480,
          205,
        );
      }
      ctx.font = "22px sans-serif";
      ctx.fillText("RATING PESSOAL · AUTOAVALIAÇÃO", 360, 280);
      ctx.font = "bold 40px sans-serif";
      const words = card.name.split(/\s+/);
      let line = "",
        y = 365;
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > 580 && line) {
          ctx.fillText(line, 360, y);
          y += 46;
          line = word;
        } else line = next;
      }
      ctx.fillText(line, 360, y);
      ctx.font = "24px sans-serif";
      ctx.fillText(card.division.toUpperCase(), 360, y + 45);
      let row = Math.max(490, y + 100);
      ctx.font = "28px sans-serif";
      for (const key of attributeKeys) {
        ctx.textAlign = "left";
        ctx.fillText(labels[key], 90, row);
        ctx.textAlign = "right";
        ctx.fillText(String(attributes[key]), 630, row);
        row += 57;
      }
      ctx.textAlign = "center";
      ctx.font = "21px sans-serif";
      ctx.fillText("Atributos declarados pelo jogador · 0–99", 360, 920);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Não foi possível gerar a imagem.")),
          "image/png",
        ),
      );
      const file = new File([blob], "fight-club-cartao-pessoal.png", {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `Cartão de ${card.name}`,
          });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMessage("Cartão pessoal guardado como imagem.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao partilhar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.editor} aria-labelledby="personal-card-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>O TEU JOGO, O TEU ESTILO</span>
          <h2 id="personal-card-title">
            {adminTarget ? "Editar cartão do jogador" : "O meu cartão de padel"}
          </h2>
          <p>
            Personaliza os teus atributos de 0 a 99 e partilha o teu estilo em
            campo.
          </p>
        </div>
        <span className={styles.tag}>AUTOAVALIAÇÃO</span>
      </div>
      <div className={styles.columns}>
        <article
          className={`${styles.card} ${styles[card.theme]}`}
          aria-label="Pré-visualização do cartão pessoal"
        >
          <div className={styles.top}>
            <strong>
              {rating}
              <small>GERAL</small>
            </strong>
            <span>
              {card.division.toUpperCase()}
              <br />
              PADEL CLUB
            </span>
          </div>
          {card.photo ? (
            <img src={card.photo} alt={card.name} className={styles.photo} />
          ) : (
            <div className={styles.initials}>
              {card.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </div>
          )}
          <h3>{card.name}</h3>
          <span className={styles.source}>ATRIBUTOS PESSOAIS</span>
          <div className={styles.metrics}>
            {attributeKeys.map((key) => (
              <div key={key}>
                <strong>{attributes[key]}</strong>
                <span>{labels[key]}</span>
              </div>
            ))}
          </div>
        </article>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h3>Como avalias o teu jogo?</h3>
          <p>
            O geral pode ser definido por ti. Sem um valor definido, usa-se a
            média dos seis atributos, arredondada. As estatísticas oficiais dos
            jogos aparecem nos cartões de competição abaixo.
          </p>
          <div className={styles.sliders}>
            <label>
              <span>
                Overall <strong>{rating}</strong>
              </span>
              <input
                aria-label="Overall"
                type="range"
                min="0"
                max="99"
                value={rating}
                disabled={busy}
                onChange={(event) =>
                  setDraft({
                    attributes,
                    overall: Number(event.target.value),
                    version: draft?.version ?? saved?.version ?? 0,
                  })
                }
              />
            </label>
            {attributeKeys.map((key) => (
              <label key={key}>
                <span>
                  {labels[key]} <strong>{attributes[key]}</strong>
                </span>
                <input
                  aria-label={labels[key]}
                  disabled={busy}
                  type="range"
                  min="0"
                  max="99"
                  value={attributes[key]}
                  onChange={(event) =>
                    setDraft({
                      attributes: {
                        ...attributes,
                        [key]: Number(event.target.value),
                      },
                      version: draft?.version ?? saved?.version ?? 0,
                      overall: rating,
                    })
                  }
                />
              </label>
            ))}
          </div>
          {draft && saved && draft.version !== saved.version && (
            <p role="alert">
              O cartão foi atualizado noutra sessão. Recarrega os atributos
              antes de guardar.
            </p>
          )}
          <div className={styles.actions}>
            <button type="submit" disabled={busy}>
              {busy ? "A guardar…" : "Guardar atributos"}
            </button>
            <button
              type="button"
              disabled={busy || !!draft || !saved}
              onClick={() => void share()}
            >
              Partilhar cartão pessoal
            </button>
            {draft && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setMessage("");
                }}
              >
                Recarregar atributos
              </button>
            )}
          </div>
          {!!draft && (
            <small>
              Guarda os atributos para partilhar o cartão atualizado.
            </small>
          )}
          {message && <p role="status">{message}</p>}
          <div className={styles.progress}>
            <h3>Conquistas em campo</h3>
            <p>
              {card.played} jogos oficiais · {card.won} vitórias
            </p>
            <div className={styles.badges}>
              {badges.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

export function AdminPlayerCards({ revision }: { revision?: unknown }) {
  const { data, error, refresh } = useEngagement(revision);
  const [selectedId, setSelectedId] = useState("");
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>A carregar cartões pessoais…</p>;
  if (!data.isAdmin) return null;
  const selected =
    data.cards.find((card) => card.playerId === selectedId) ?? data.cards[0];
  return (
    <section className={styles.editor}>
      <h2>Gerir cartões dos jogadores</h2>
      <label>
        Jogador do cartão
        <select
          aria-label="Jogador do cartão"
          value={selected?.playerId ?? ""}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {data.cards.map((card) => (
            <option key={card.playerId} value={card.playerId}>
              {card.name}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <PlayerAttributesEditor
          key={selected.playerId}
          card={selected}
          saved={
            data.personalCards.find(
              (entry) => entry.playerId === selected.playerId,
            ) ?? null
          }
          refresh={refresh}
          adminTarget
        />
      ) : (
        <p>Não existem jogadores elegíveis.</p>
      )}
    </section>
  );
}
