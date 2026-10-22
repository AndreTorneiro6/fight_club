"use client";
import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Save,
  Archive,
  RotateCcw,
  Eye,
  Pencil,
} from "lucide-react";
import type { View } from "@/lib/types";
import styles from "./admin-notes.module.css";

type Draft = { id?: string; version: number; title: string; body: string };
const emptyDraft = (): Draft => ({ version: 0, title: "", body: "" });
export default function AdminNotes({
  state,
  run,
  busy,
}: {
  state: View;
  run: (command: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft),
    [dirty, setDirty] = useState(false),
    [query, setQuery] = useState(""),
    [archived, setArchived] = useState(false),
    [preview, setPreview] = useState(false);
  const notes = state.adminNotes ?? [];
  const current = notes.find((note) => note._id === draft.id);
  const conflict = !!current && current.version !== draft.version && dirty;
  useEffect(() => {
    if (current && !dirty)
      setDraft({
        id: current._id,
        version: current.version,
        title: current.title,
        body: current.body,
      });
  }, [current?._id, current?.version, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  function select(id?: string) {
    if (
      dirty &&
      !window.confirm("Tens alterações por guardar. Queres descartá-las?")
    )
      return;
    const note = notes.find((entry) => entry._id === id);
    setDraft(
      note
        ? {
            id: note._id,
            version: note.version,
            title: note.title,
            body: note.body,
          }
        : emptyDraft(),
    );
    setDirty(false);
    setPreview(false);
  }
  async function save(asCopy = false) {
    const result = await run(
      {
        type: "admin.notes.save",
        noteId: asCopy ? undefined : draft.id,
        expectedVersion: asCopy ? 0 : draft.version,
        title: draft.title,
        body: draft.body,
      },
      "Ideia guardada.",
    );
    if (
      result &&
      typeof result === "object" &&
      "_id" in result &&
      "version" in result
    ) {
      setDraft((previous) => ({
        ...previous,
        id: String(result._id),
        version: Number(result.version),
      }));
      setDirty(false);
    }
  }
  async function archive() {
    if (!current || dirty) return;
    const result = await run(
      {
        type: "admin.notes.archive",
        noteId: current._id,
        expectedVersion: current.version,
        archived: !current.archived,
      },
      current.archived ? "Ideia restaurada." : "Ideia arquivada.",
    );
    if (result) {
      setDraft(emptyDraft());
      setDirty(false);
    }
  }
  if (state.actor.role !== "admin") return null;
  const filtered = notes
    .filter(
      (note) =>
        note.archived === archived &&
        `${note.title} ${note.body}`
          .toLocaleLowerCase("pt-PT")
          .includes(query.toLocaleLowerCase("pt-PT")),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <section className="panel stack" aria-label="Bloco de ideias">
      <div className={styles.toolbar}>
        <FileText size={24} />
        <div>
          <h2>Bloco de ideias</h2>
          <p className={styles.hint}>
            Notas privadas, partilhadas apenas entre administradores.
          </p>
        </div>
      </div>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <button
            className="button gold"
            onClick={() => select()}
            disabled={busy}
          >
            <Plus size={16} /> Nova ideia
          </button>
          <input
            className={styles.search}
            aria-label="Pesquisar ideias"
            placeholder="Pesquisar ideias…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <label className={styles.toolbar}>
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
            />{" "}
            Ver arquivadas
          </label>
          <div className={styles.list}>
            {filtered.map((note) => (
              <button
                key={note._id}
                className={styles.item}
                aria-current={draft.id === note._id}
                onClick={() => select(note._id)}
              >
                <strong>{note.title}</strong>
                <small>
                  {new Date(note.updatedAt).toLocaleString("pt-PT")}
                </small>
              </button>
            ))}
            {!filtered.length && (
              <p className={styles.hint}>Ainda não há ideias nesta lista.</p>
            )}
          </div>
        </aside>
        <div className={styles.editor}>
          {conflict && (
            <div className={styles.warning} role="status">
              Outro administrador guardou uma nova versão. O teu texto está
              preservado. Podes guardá-lo como uma nova ideia ou descartar as
              alterações para consultar a versão atual.
              <div className={styles.toolbar}>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void save(true).catch(() => {})}
                >
                  Guardar como nova ideia
                </button>
                <button
                  className="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Descartar o teu texto e carregar a versão atual?",
                      )
                    ) {
                      setDirty(false);
                    }
                  }}
                >
                  Carregar versão atual
                </button>
              </div>
            </div>
          )}
          <label>
            Título
            <input
              aria-label="Título da ideia"
              maxLength={160}
              value={draft.title}
              disabled={current?.archived || busy}
              onChange={(event) => {
                setDraft({ ...draft, title: event.target.value });
                setDirty(true);
              }}
            />
          </label>
          <div className={styles.toolbar}>
            <button className="button" onClick={() => setPreview(!preview)}>
              {preview ? <Pencil size={16} /> : <Eye size={16} />}{" "}
              {preview ? "Editar texto" : "Pré-visualizar"}
            </button>
            <span className={styles.hint}>
              {draft.body.length.toLocaleString("pt-PT")} / 30 000 caracteres
            </span>
          </div>
          {preview ? (
            <article className={styles.preview}>
              {draft.body || "A tua ideia aparece aqui."}
            </article>
          ) : (
            <textarea
              className={styles.body}
              aria-label="Texto da ideia"
              placeholder="Escreve ideias, planos para a liga ou notas para a equipa de administração…"
              maxLength={30000}
              value={draft.body}
              disabled={current?.archived || busy}
              onChange={(event) => {
                setDraft({ ...draft, body: event.target.value });
                setDirty(true);
              }}
            />
          )}
          <div className={styles.toolbar}>
            <button
              className="button gold"
              disabled={
                busy ||
                !dirty ||
                !draft.title.trim() ||
                conflict ||
                current?.archived
              }
              onClick={() => void save().catch(() => {})}
            >
              <Save size={16} /> Guardar ideia
            </button>
            {current && (
              <button
                className="button"
                disabled={busy || dirty}
                onClick={() => void archive().catch(() => {})}
              >
                {current.archived ? (
                  <RotateCcw size={16} />
                ) : (
                  <Archive size={16} />
                )}{" "}
                {current.archived ? "Restaurar" : "Arquivar"}
              </button>
            )}
            <span className={styles.hint} role="status">
              {dirty
                ? "Alterações por guardar"
                : current
                  ? `Guardada · versão ${current.version}`
                  : "Nova ideia"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
