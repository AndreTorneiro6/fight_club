"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, AtSign } from "lucide-react";
import ChatMessageActions from "./chat-message-actions";
import { discussionTargets } from "@/lib/match-voting-targets";
import type { View, Challenge } from "@/lib/types";
import {
  chatMentionTargets,
  chatMessageParts,
  type ChatMention,
} from "@/lib/chat-mentions";
const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export default function ChallengeChat({
  s,
  c,
  run,
  busy,
  connection,
  community = false,
}: {
  community?: boolean;
  s: View;
  c: Challenge;
  run: (cmd: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
  connection?: "connecting" | "live" | "reconnecting";
}) {
  const readOnly = s.actor.role === "spectator";
  const [text, setText] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [query, setQuery] = useState<{
      start: number;
      end: number;
      value: string;
    } | null>(null),
    [active, setActive] = useState(0);
  const requestId = useRef<{ payload: string; id: string } | undefined>(
    undefined,
  );
  const sending = useRef(false);
  const [sendError, setSendError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    box = useRef<HTMLDivElement>(null);
  const chat = (community ? (s.matchDiscussionMessages ?? []) : s.messages)
    .filter((m) => m.challengeId === c._id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const targets = (
      community ? discussionTargets(s) : chatMentionTargets(s, c)
    ).filter((t) => t.playerId !== s.actor.playerId),
    matches = query
      ? targets
          .filter((t) =>
            normalize(t.name).includes(normalize(query.value.trim())),
          )
          .slice(0, 8)
      : [];
  const last = chat.at(-1)?._id;
  useEffect(() => {
    const scroll = () => {
      const target = location.hash.startsWith("#mensagem-")
        ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
        : null;
      if (target && box.current?.contains(target))
        target.scrollIntoView({ block: "center" });
      else if (box.current) box.current.scrollTop = box.current.scrollHeight;
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, [last]);
  const update = (value: string, caret: number) => {
    setText(value);
    const prefix = value.slice(0, caret),
      match = /(?:^|\s)@([^@]*)$/.exec(prefix);
    setQuery(
      match
        ? { start: prefix.lastIndexOf("@"), end: caret, value: match[1] }
        : null,
    );
    setActive(0);
  };
  const choose = (target: ChatMention) => {
    if (!query) return;
    const next =
        text.slice(0, query.start) + `@${target.name} ` + text.slice(query.end),
      caret = query.start + target.name.length + 2;
    if (next.length > 2000) return;
    setText(next);
    setSelected((ids) => [...new Set([...ids, target.playerId])]);
    setQuery(null);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(caret, caret);
    });
  };
  return (
    <section
      className="panel stack"
      aria-labelledby={`challenge-chat-${c._id}`}
    >
      <div className="row between wrap">
        <h2 id={`challenge-chat-${c._id}`}>
          {community ? "Conversa do jogo" : "Chat do desafio"}
        </h2>
        <span
          className={`badge ${connection === "live" ? "positive" : "muted"}`}
          role="status"
        >
          <span className="dot" style={{ background: "currentColor" }} />
          {connection === "live"
            ? "Em direto"
            : connection === "reconnecting"
              ? "A reconectar…"
              : "A ligar…"}
        </span>
      </div>
      <div ref={box} className="chat-box stack" aria-live="polite">
        {chat.length ? (
          chat.map((m) => (
            <div
              className={`message ${m.playerId === s.actor.playerId ? "mine" : ""}`}
              id={`mensagem-${m._id}`}
              key={m._id}
            >
              <strong>
                {s.players.find((p) => p._id === m.playerId)?.name ??
                  "Organização"}
              </strong>
              <p
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  margin: "4px 0",
                }}
              >
                {chatMessageParts(m).map((part, i) =>
                  part.mention ? (
                    <mark className="chat-mention" key={i}>
                      {part.text}
                    </mark>
                  ) : (
                    part.text
                  ),
                )}
              </p>
              <small>
                {new Date(m.createdAt).toLocaleString("pt-PT", {
                  timeZone: "Europe/Lisbon",
                })}
                {m.updatedAt ? " · editada" : ""}
              </small>
              {!readOnly && m.playerId === s.actor.playerId && (
                <ChatMessageActions
                  message={m}
                  community={community}
                  busy={busy}
                  run={run}
                />
              )}
            </div>
          ))
        ) : (
          <p>
            {readOnly
              ? "Ainda não existem mensagens sobre este jogo."
              : community
                ? "Quem vai ganhar? Abre a conversa sobre este jogo."
                : "Combina os detalhes do jogo com o teu adversário."}
          </p>
        )}
      </div>
      {!readOnly && (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || sending.current || !text.trim()) return;
            const mentionIds = selected.filter((id) => {
              const target = targets.find((t) => t.playerId === id);
              return target && text.includes(`@${target.name}`);
            });
            const payload = JSON.stringify([c._id, text, mentionIds]);
            if (community && requestId.current?.payload !== payload)
              requestId.current = { payload, id: crypto.randomUUID() };
            sending.current = true;
            setSendError("");
            try {
              const result = await run(
                {
                  type: community ? "match-discussion.send" : "message.send",
                  challengeId: c._id,
                  text,
                  mentionIds,
                  ...(community ? { requestId: requestId.current!.id } : {}),
                },
                "",
              );
              if (!result) {
                setSendError(
                  "Não foi possível enviar. A mensagem foi mantida; tenta novamente.",
                );
                return;
              }
              requestId.current = undefined;
              setText("");
              setSelected([]);
              setQuery(null);
              input.current?.focus();
            } catch {
              setSendError(
                "Não foi possível enviar. A mensagem foi mantida; tenta novamente.",
              );
            } finally {
              sending.current = false;
            }
          }}
        >
          {sendError && (
            <p className="error" role="alert">
              {sendError}
            </p>
          )}
          <small>
            {community
              ? "Os jogadores do jogo, quem já participou na conversa e as pessoas mencionadas recebem notificações. Escreve @ para mencionar."
              : "Escreve @ e escolhe um jogador ou administrador para o mencionar e notificar."}
          </small>
          {matches.length > 0 && (
            <div
              className="inset stack chat-mention-options"
              id={`mention-list-${c._id}`}
              role="listbox"
              aria-label="Pessoas que podes mencionar"
            >
              {matches.map((target, index) => (
                <button
                  type="button"
                  role="option"
                  id={`mention-option-${target.playerId}`}
                  aria-selected={active === index}
                  className={`row between ${active === index ? "primary" : ""}`}
                  key={target.playerId}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(target)}
                >
                  <span>@{target.name}</span>
                  <small>
                    {target.kind === "admin"
                      ? "Administrador"
                      : community
                        ? "Jogador da liga"
                        : "Jogador do desafio"}
                  </small>
                </button>
              ))}
            </div>
          )}
          <div className="row">
            <button
              type="button"
              className="icon-button"
              aria-label="Mencionar alguém"
              onClick={() => {
                const caret = input.current?.selectionStart ?? text.length,
                  prefix = caret && !/\s/.test(text[caret - 1]) ? " @" : "@",
                  value = text.slice(0, caret) + prefix + text.slice(caret);
                update(value, caret + prefix.length);
                requestAnimationFrame(() => {
                  input.current?.focus();
                  input.current?.setSelectionRange(
                    caret + prefix.length,
                    caret + prefix.length,
                  );
                });
              }}
            >
              <AtSign size={18} />
            </button>
            <input
              ref={input}
              className="flex-1"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={matches.length > 0}
              aria-controls={`mention-list-${c._id}`}
              aria-activedescendant={
                matches.length
                  ? `mention-option-${matches[Math.min(active, matches.length - 1)].playerId}`
                  : undefined
              }
              value={text}
              onChange={(e) =>
                update(
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length,
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery(null);
                  return;
                }
                if (!matches.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => (i + 1) % matches.length);
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => (i + matches.length - 1) % matches.length);
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  choose(matches[Math.min(active, matches.length - 1)]);
                }
              }}
              name="text"
              placeholder="Escreve uma mensagem…"
              aria-label="Mensagem"
              required
              maxLength={2000}
            />
            <button
              disabled={busy || !text.trim()}
              aria-label="Enviar mensagem"
              className="primary"
            >
              <ArrowRight size={17} />
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
