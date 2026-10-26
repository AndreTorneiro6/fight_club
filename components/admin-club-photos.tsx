"use client";
import { useState } from "react";
import type { View } from "@/lib/types";
import {
  photoUnlockProgress,
  type ClubPhoto,
  type PhotoUnlockRule,
} from "@/lib/club-photo-types";
import styles from "./admin-club-photos.module.css";
const labels: Record<PhotoUnlockRule, string> = {
  UNDECIDED: "Por definir",
  MANUAL: "Decisão do administrador / evento",
  MATCHES: "Jogos concluídos",
  COINS: "Moedas do clube",
};
export default function AdminClubPhotos({
  state: s,
  run,
  busy,
  refresh,
}: {
  state: View;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
  refresh: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false),
    [message, setMessage] = useState(""),
    [playerId, setPlayerId] = useState(s.actor.playerId);
  if (s.actor.role !== "admin") return null;
  const players = s.players
    .filter(
      (p) =>
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  return (
    <section
      className={`stack ${styles.root}`}
      aria-label="Fotografias desbloqueáveis em teste privado"
    >
      <header className="panel stack">
        <div className="row between wrap">
          <h2>Fotografias para desbloquear</h2>
          <span className="badge">Só administradores · teste privado</span>
        </div>
        <p>
          Carrega as fotografias e decide depois como cada jogador as pode
          desbloquear. As novas fotografias ficam com a regra Por definir.
        </p>
        <p className="muted">
          Ficheiros privados, fora da pasta pública. Mesmo os desbloqueios de
          teste continuam invisíveis aos jogadores nesta fase.
        </p>
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            setUploading(true);
            setMessage("");
            try {
              const response = await fetch("/api/club-photos", {
                method: "POST",
                body: new FormData(form),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              form.reset();
              await refresh();
              setMessage(
                "Fotografia adicionada. Podes definir a regra mais tarde.",
              );
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Não foi possível carregar.",
              );
            } finally {
              setUploading(false);
            }
          }}
        >
          <label>
            Título da fotografia
            <input name="title" maxLength={100} />
          </label>
          <label>
            Fotografia JPG, PNG ou WebP · até 2 MB
            <input
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <button className="primary" disabled={uploading || busy}>
            {uploading ? "A carregar…" : "Adicionar fotografia"}
          </button>
        </form>
        {message && <p role="status">{message}</p>}
        <label>
          Pré-visualizar coleção do jogador
          <select
            aria-label="Pré-visualizar coleção do jogador"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          >
            {players.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className={styles.grid}>
        {(s.clubPhotos ?? []).map((photo) => (
          <PhotoCard
            key={`${photo._id}:${photo.version}`}
            photo={photo}
            state={s}
            playerId={playerId}
            run={run}
            busy={busy}
          />
        ))}
        {!s.clubPhotos?.length && (
          <p className="panel">Ainda não existem fotografias no catálogo.</p>
        )}
      </div>
    </section>
  );
}
function PhotoCard({
  photo,
  state: s,
  playerId,
  run,
  busy,
}: {
  photo: ClubPhoto;
  state: View;
  playerId: string;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(photo),
    [reason, setReason] = useState("");
  const progress = photoUnlockProgress(s, photo, playerId),
    dirty = JSON.stringify(draft) !== JSON.stringify(photo);
  return (
    <article className="panel stack" aria-label={`Fotografia ${photo.title}`}>
      {/* Private authenticated file endpoint; never Next public assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.photo}
        src={`/api/club-photos/${photo._id}`}
        alt={photo.title}
      />
      <span className="badge">
        {progress.unlocked
          ? "Desbloqueada para este jogador"
          : `Bloqueada · ${labels[photo.rule]}`}
      </span>
      <label>
        Título
        <input
          maxLength={100}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </label>
      <label>
        Descrição
        <textarea
          maxLength={500}
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <label>
        Como desbloquear
        <select
          aria-label={`Como desbloquear ${photo.title}`}
          value={draft.rule}
          onChange={(e) =>
            setDraft({ ...draft, rule: e.target.value as PhotoUnlockRule })
          }
        >
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {draft.rule === "MATCHES" || draft.rule === "COINS" ? (
        <label>
          {draft.rule === "MATCHES"
            ? "Número de jogos concluídos"
            : "Custo em moedas"}
          <input
            type="number"
            min={1}
            max={1000000}
            value={draft.target}
            onChange={(e) =>
              setDraft({ ...draft, target: Number(e.target.value) })
            }
          />
        </label>
      ) : null}
      <label>
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />{" "}
        Disponível no catálogo
      </label>
      <button
        disabled={busy || !dirty || !draft.title.trim()}
        onClick={() =>
          void run(
            {
              type: "admin.photos.update",
              photoId: photo._id,
              expectedVersion: photo.version,
              title: draft.title,
              description: draft.description,
              active: draft.active,
              rule: draft.rule,
              target: draft.target,
            },
            "Fotografia atualizada.",
          )
        }
      >
        Guardar fotografia
      </button>
      {!progress.unlocked && (
        <>
          <p className="muted">
            {photo.rule === "UNDECIDED"
              ? "Regra ainda por decidir. Escolhe uma opção quando estiveres preparado."
              : photo.rule === "MATCHES"
                ? `Jogos confirmados: ${progress.matches} / ${photo.target}`
                : photo.rule === "COINS"
                  ? `Saldo: ${progress.balance} · Custo: ${photo.target}. A confirmação desconta moedas reais da carteira, mesmo neste teste privado.`
                  : "O administrador pode atribuir esta fotografia por participação ou evento."}
          </p>
          <label>
            Motivo do desbloqueio
            <input
              value={reason}
              minLength={3}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            disabled={
              busy || dirty || !progress.eligible || reason.trim().length < 3
            }
            onClick={() => {
              if (
                photo.rule === "COINS" &&
                !window.confirm(
                  `Descontar ${photo.target} moedas da carteira deste jogador?`,
                )
              )
                return;
              void run(
                {
                  type: "admin.photos.unlock",
                  photoId: photo._id,
                  playerId,
                  expectedVersion: photo.version,
                  expectedBalance: progress.balance,
                  requestId: crypto.randomUUID(),
                  reason,
                },
                "Fotografia desbloqueada.",
              );
            }}
          >
            Desbloquear para este jogador
          </button>
        </>
      )}
    </article>
  );
}
