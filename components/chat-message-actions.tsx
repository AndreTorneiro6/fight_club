"use client";
import { useState } from "react";
import type { Message } from "@/lib/types";

export default function ChatMessageActions({
  message,
  community,
  busy,
  run,
}: {
  message: Message;
  community: boolean;
  busy: boolean;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
}) {
  const [mode, setMode] = useState<"edit" | "delete" | null>(null);
  const [draft, setDraft] = useState(message.text);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [version, setVersion] = useState(
    message.updatedAt ?? message.createdAt,
  );
  const locked = busy || pending;
  async function submit() {
    if (locked || !mode) return;
    setPending(true);
    setError("");
    try {
      const result = await run(
        {
          type: `${community ? "match-discussion" : "message"}.${mode}`,
          challengeId: message.challengeId,
          messageId: message._id,
          expectedUpdatedAt: version,
          ...(mode === "edit" ? { text: draft } : {}),
        },
        "",
      );
      if (result) setMode(null);
      else
        setError(
          "Não foi possível guardar. Atualiza a conversa e tenta novamente.",
        );
    } catch {
      setError("Não foi possível guardar. Tenta novamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="stack">
      {!mode ? (
        <div className="row wrap">
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              setDraft(message.text);
              setVersion(message.updatedAt ?? message.createdAt);
              setError("");
              setMode("edit");
            }}
          >
            Editar
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              setError("");
              setVersion(message.updatedAt ?? message.createdAt);
              setMode("delete");
            }}
          >
            Apagar
          </button>
        </div>
      ) : (
        <div className="stack">
          {mode === "edit" ? (
            <label className="stack">
              Editar mensagem
              <textarea
                aria-label="Editar mensagem"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                disabled={locked}
                autoFocus
              />
            </label>
          ) : (
            <p>Apagar esta mensagem para todos?</p>
          )}
          <div className="row wrap">
            <button
              type="button"
              className="primary"
              disabled={locked || (mode === "edit" && !draft.trim())}
              onClick={submit}
            >
              {mode === "edit" ? "Guardar alteração" : "Confirmar apagar"}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setMode(null);
                setError("");
              }}
            >
              Cancelar
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
