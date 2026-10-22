"use client";
import { useState } from "react";
import type { PlayerCard } from "@/lib/player-cards";
import { useEngagement } from "./engagement-client";
import styles from "./engagement.module.css";
import { PlayerAttributesEditor } from "./player-attributes";
const labels = {
  attack: "Ataque",
  defense: "Defesa",
  wins: "Vitórias",
  consistency: "Consistência",
  form: "Forma",
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
async function cardImage(card: PlayerCard): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1040;
  const ctx = canvas.getContext("2d")!;
  const colors =
    card.theme === "ouro"
      ? ["#fff1b7", "#bc8b39"]
      : card.theme === "prata"
        ? ["#f2f8ff", "#9eacba"]
        : ["#f9dac1", "#b77d52"];
  const gradient = ctx.createLinearGradient(0, 0, 720, 1040);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 720, 1040);
  ctx.strokeStyle = card.champion ? "#fff8cb" : "#ffffff99";
  ctx.lineWidth = 12;
  ctx.strokeRect(18, 18, 684, 1004);
  ctx.fillStyle = "#211c16";
  ctx.textAlign = "center";
  ctx.font = "bold 27px sans-serif";
  ctx.fillText("FIGHT CLUB · NEIVA PADEL", 360, 70);
  ctx.font = "bold 95px sans-serif";
  ctx.fillText(card.rating === null ? "—" : String(card.rating), 100, 185);
  ctx.font = "22px sans-serif";
  ctx.fillText("RATING", 100, 220);
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(card.division.toUpperCase(), 360, 140);
  let photo = false;
  if (card.photo) {
    try {
      const url = new URL(card.photo, location.origin);
      if (url.origin === location.origin) {
        const img = new Image();
        img.src = url.href;
        await img.decode();
        ctx.save();
        ctx.beginPath();
        ctx.arc(360, 300, 130, 0, Math.PI * 2);
        ctx.clip();
        const scale = Math.max(260 / img.width, 260 / img.height);
        ctx.drawImage(
          img,
          360 - (img.width * scale) / 2,
          300 - (img.height * scale) / 2,
          img.width * scale,
          img.height * scale,
        );
        ctx.restore();
        photo = true;
      }
    } catch {
      /* An unavailable photo falls back to initials. */
    }
  }
  if (!photo) {
    ctx.font = "bold 90px sans-serif";
    ctx.fillText(initials(card.name), 360, 325);
  }
  ctx.font = "bold 36px sans-serif";
  const name = card.name;
  const words = name.split(" ");
  let line = "",
    y = 490;
  for (const word of words) {
    if (ctx.measureText(`${line} ${word}`).width > 600) {
      ctx.fillText(line, 360, y);
      y += 42;
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  ctx.fillText(line, 360, y);
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(
    [card.champion ? "CAMPEÃO" : "", card.teamOfWeek ? "EQUIPA DA JORNADA" : ""]
      .filter(Boolean)
      .join(" · "),
    360,
    580,
  );
  ctx.font = "25px sans-serif";
  let row = 640;
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    ctx.textAlign = "left";
    ctx.fillText(labels[key].toUpperCase(), 90, row);
    ctx.textAlign = "right";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText(card[key] === null ? "—" : String(card[key]), 630, row);
    ctx.font = "25px sans-serif";
    row += 55;
  }
  ctx.textAlign = "center";
  ctx.font = "22px sans-serif";
  ctx.fillText(
    `${card.played} jogos · ${card.won} vitórias · ${card.recent.join(" ") || "Sem resultados"}`,
    360,
    960,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Não foi possível criar a imagem.")),
      "image/png",
    ),
  );
}
export function PlayerCards({ revision }: { revision?: unknown }) {
  const { data, error, refresh } = useEngagement(revision),
    [search, setSearch] = useState(""),
    [league, setLeague] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  async function share(card: PlayerCard, download = false) {
    setBusy(card.playerId);
    setNotice("");
    try {
      const blob = await cardImage(card),
        file = new File(
          [blob],
          `fight-club-${card.name.replace(/\s+/g, "-")}.png`,
          { type: "image/png" },
        );
      if (!download && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: card.name });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNotice("Cartão guardado. Podes partilhá-lo no WhatsApp.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Erro ao gerar cartão.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className={styles.layout}>
      {data?.cards.find((card) => card.playerId === data.currentPlayerId) && (
        <PlayerAttributesEditor
          card={data.cards.find(
            (card) => card.playerId === data.currentPlayerId,
          )!}
          saved={data.ownAttributes}
          refresh={refresh}
        />
      )}
      <h2>Cartões de jogador</h2>
      <p>
        O teu percurso em campo, numa imagem. Estatísticas de jogos com
        resultado oficialmente validado.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data && !error && <p>A carregar cartões…</p>}
      {data && (
        <>
          <div className={styles.toolbar}>
            <label>
              Pesquisar jogador
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome"
              />
            </label>
            <label>
              Liga
              <select
                value={league}
                onChange={(e) => setLeague(e.target.value)}
              >
                <option value="">Todas</option>
                {[...new Set(data.cards.map((c) => c.division))].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.grid}>
            {data.cards
              .filter(
                (c) =>
                  (!league || c.division === league) &&
                  c.name
                    .toLocaleLowerCase("pt-PT")
                    .includes(search.toLocaleLowerCase("pt-PT")),
              )
              .map((card) => (
                <article
                  key={card.playerId}
                  className={`${styles.card} ${styles[card.theme]} ${card.champion ? styles.champion : ""}`}
                >
                  <div className={styles.top}>
                    <div>
                      <strong className={styles.rating}>
                        {card.rating ?? "—"}
                      </strong>
                      <div>RATING</div>
                    </div>
                    <strong>{card.division.toUpperCase()}</strong>
                  </div>
                  {card.photo ? (
                    <img
                      className={styles.photo}
                      src={card.photo}
                      alt={card.name}
                    />
                  ) : (
                    <div className={styles.photo}>{initials(card.name)}</div>
                  )}
                  <div className={styles.name}>{card.name}</div>
                  <div className={styles.actions}>
                    {card.champion && (
                      <span className={styles.badge}>CAMPEÃO</span>
                    )}
                    {card.teamOfWeek && (
                      <span className={styles.badge}>EQUIPA DA JORNADA</span>
                    )}
                  </div>
                  <div className={styles.metrics}>
                    {(Object.keys(labels) as (keyof typeof labels)[]).map(
                      (key) => (
                        <span key={key}>
                          {labels[key]}
                          <strong>{card[key] ?? "—"}</strong>
                        </span>
                      ),
                    )}
                  </div>
                  <small>
                    {card.played} jogos · {card.won} vitórias · Forma:{" "}
                    {card.recent.join(" ") || "sem jogos"}
                  </small>
                  <div className={styles.actions}>
                    <button
                      disabled={busy === card.playerId}
                      onClick={() => void share(card)}
                    >
                      Partilhar cartão
                    </button>
                    <button
                      disabled={busy === card.playerId}
                      onClick={() => void share(card, true)}
                    >
                      PNG
                    </button>
                  </div>
                </article>
              ))}
          </div>
          <details className={styles.panel}>
            <summary>Como são calculados os cartões?</summary>
            <p>
              Ataque e defesa: percentagem de vitórias em cada papel. Vitórias:
              percentagem global. Forma: vitórias nos últimos cinco jogos.
              Consistência: participação nas últimas cinco jornadas publicadas
              da liga. Uma métrica sem amostra aparece como — e não entra no
              rating. Sem resultados validados, não existe rating.
            </p>
            <p>
              Rating: média ponderada das métricas disponíveis, de 0 a 100.
              Pesos atuais:{" "}
              {Object.entries(data.settings.ratingWeights)
                .map(
                  ([key, value]) =>
                    `${labels[key as keyof typeof labels]} ${value}`,
                )
                .join(" · ")}
              . Os administradores podem alterá-los.
            </p>
            <p>
              Campeão: equipa no topo do ranking atual. Equipa da jornada:
              vencedores com maior distância de ataque na última jornada
              concluída; as defesas valem uma posição. Empates recebem a
              distinção em conjunto. Os prémios são visuais e não alteram a
              competição.
            </p>
            <p>
              As imagens externas podem aparecer no cartão da aplicação; a
              exportação usa fotografias carregadas no clube ou iniciais para
              garantir uma imagem segura.
            </p>
          </details>
        </>
      )}
    </section>
  );
}
