"use client";
import { useEffect, useRef, useState } from "react";
import type { View } from "@/lib/types";
type Proposal = { token: string; summary: string; expiresAt: string };
type Message = {
  role: "user" | "assistant";
  content: string;
  proposal?: Proposal;
  outcome?: string;
};
export default function AdminAssistant({
  s,
  refresh,
}: {
  s: View;
  refresh: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState<{
      available: boolean;
      model: string;
    } | null>(null),
    [applying, setApplying] = useState("");
  const controller = useRef<AbortController | null>(null),
    end = useRef<HTMLDivElement>(null);
  const storageKey = `fightclub-assistant:${s.actor.userId}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved))
        setMessages(
          saved
            .filter(
              (m) =>
                ["user", "assistant"].includes(m.role) &&
                typeof m.content === "string",
            )
            .slice(-8)
            .map((m) => ({ role: m.role, content: m.content })),
        );
    } catch {}
    const abort = new AbortController();
    fetch("/api/admin/assistant", { signal: abort.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, [storageKey]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy]);
  function save(next: Message[]) {
    setMessages(next);
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify(
          next.slice(-8).map(({ role, content }) => ({ role, content })),
        ),
      );
    } catch {}
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy || applying) return;
    const next: Message[] = [
      ...messages.map((m) =>
        m.proposal && !m.outcome
          ? { ...m, outcome: "Substituída por um novo pedido." }
          : m,
      ),
      { role: "user", content: text.trim() },
    ];
    const input = next
      .slice(-7)
      .map(({ role, content }) => ({ role, content }));
    if (input.reduce((sum, m) => sum + m.content.length, 0) > 6000) {
      setError("Inicia uma nova conversa para continuar.");
      return;
    }
    save(next);
    setText("");
    setBusy(true);
    setError("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const r = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: input }),
        signal: abort.signal,
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error ?? "Não foi possível obter resposta.");
      save([
        ...next,
        { role: "assistant", content: data.reply, proposal: data.proposal },
      ]);
      setStatus((previous) =>
        previous ? { ...previous, available: true } : previous,
      );
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Pedido cancelado. Nenhuma alteração foi aplicada."
          : e instanceof Error
            ? e.message
            : "Não foi possível obter resposta.",
      );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  async function confirm(index: number, proposal: Proposal) {
    setApplying(proposal.token);
    setError("");
    try {
      const r = await fetch("/api/admin/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: proposal.token }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Não foi possível aplicar.");
      save(
        messages.map((m, i) =>
          i === index
            ? { ...m, outcome: "Alteração aplicada e registada na auditoria." }
            : m,
        ),
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível aplicar.");
    } finally {
      setApplying("");
    }
  }
  return (
    <section className="card assistant-panel" aria-label="Assistente local">
      <div className="row between wrap">
        <div>
          <h2>Assistente</h2>
          <p className="muted">
            Conversa sobre ideias e consulta a liga. As alterações precisam da
            tua confirmação.
          </p>
        </div>
        <span className="badge positive">100% local</span>
      </div>
      <p className="muted">
        Podes pedir para marcar quotas, associar parceiros ou mover equipas no
        ranking. Para contas e outras operações, usa as secções do painel.
      </p>
      {status && (
        <p className="muted">
          {status.available
            ? "Modelo local pronto."
            : "O modelo local está indisponível. Podes tentar novamente."}
        </p>
      )}
      <div className="row wrap">
        <button
          className="small"
          disabled={busy || !!applying || !messages.length}
          onClick={() => {
            save([]);
            setError("");
          }}
        >
          Nova conversa
        </button>
      </div>
      <div
        className="assistant-messages"
        role="log"
        aria-label="Conversa com o assistente"
        aria-live="polite"
      >
        {!messages.length && (
          <div className="assistant-welcome">
            <p>Como posso ajudar?</p>
            <div className="row wrap">
              {[
                "Dá-me três ideias para dinamizar a liga.",
                "Resume o estado atual da liga.",
                "Quem tem quotas por pagar?",
              ].map((prompt) => (
                <button
                  className="small"
                  key={prompt}
                  onClick={() => setText(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <article key={i} className={`assistant-message ${m.role}`}>
            <strong>{m.role === "user" ? "Tu" : "Assistente"}</strong>
            <p>{m.content}</p>
            {m.proposal && (
              <div className="assistant-proposal">
                <strong>Proposta para revisão</strong>
                <p>{m.proposal.summary}</p>
                {m.outcome ? (
                  <p role="status">{m.outcome}</p>
                ) : (
                  <>
                    <p className="muted">
                      Confirma apenas se corresponde ao teu pedido. Válida
                      durante 10 minutos.
                    </p>
                    <div className="row wrap">
                      <button
                        className="primary small"
                        disabled={busy || !!applying}
                        onClick={() => confirm(i, m.proposal!)}
                      >
                        {applying === m.proposal.token
                          ? "A aplicar…"
                          : "Confirmar alteração"}
                      </button>
                      <button
                        className="small"
                        disabled={!!applying}
                        onClick={() =>
                          save(
                            messages.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    outcome:
                                      "Proposta rejeitada. Nenhuma alteração aplicada.",
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        Rejeitar
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
        {busy && (
          <p role="status">
            O assistente está a responder no Pi. Pode demorar alguns minutos…
          </p>
        )}
        <div ref={end} />
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <form onSubmit={send} className="assistant-form">
        <label htmlFor="assistant-message">Mensagem</label>
        <textarea
          id="assistant-message"
          maxLength={2000}
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreve uma pergunta ou um pedido…"
          disabled={busy || !!applying}
        />
        <div className="row wrap">
          <button
            className="primary"
            disabled={busy || !!applying || !text.trim()}
          >
            Enviar
          </button>
          {busy && (
            <button type="button" onClick={() => controller.current?.abort()}>
              Cancelar resposta
            </button>
          )}
        </div>
      </form>
      <small className="muted">
        A conversa fica neste separador. O modelo pode enganar-se; verifica os
        dados e as propostas.
      </small>
    </section>
  );
}
