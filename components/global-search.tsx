"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight } from "lucide-react";
import type { View } from "@/lib/types";
import {
  searchEntries,
  findSearchEntries,
  type SearchEntry,
} from "@/lib/app-search";
import styles from "./global-search.module.css";
export default function GlobalSearch({ state }: { state: View }) {
  const router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    listId = useId();
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const entries = useMemo(() => searchEntries(state), [state]);
  const results = useMemo(
    () => findSearchEntries(entries, query),
    [entries, query],
  );
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${activeIndex}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, query, listId]);
  function show() {
    if (!dialog.current?.open) {
      dialog.current?.showModal();
      setOpen(true);
    }
    input.current?.focus();
  }
  function close() {
    dialog.current?.close();
  }
  function navigate(entry: SearchEntry) {
    close();
    router.push(entry.href);
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k"
      ) {
        const other = document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"]',
        );
        if (other && other !== dialog.current) return;
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else show();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className={styles.root}>
      <form
        className={styles.bar}
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          show();
        }}
      >
        <Search size={19} aria-hidden="true" />
        <input
          aria-label="Pesquisa global"
          type="search"
          maxLength={120}
          placeholder="Pesquisar na app…"
          value={open ? "" : query}
          autoComplete="off"
          onClick={show}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            show();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              show();
            }
          }}
        />
        <button
          type="button"
          aria-label="Abrir pesquisa (Ctrl+K ou Cmd+K)"
          onClick={show}
        >
          <kbd>Ctrl / ⌘ K</kbd>
        </button>
      </form>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-label="Pesquisar na app"
        onClose={() => {
          setOpen(false);
          setQuery("");
          setActive(0);
        }}
        onClick={(event) => {
          if (event.target === dialog.current) {
            const bounds = dialog.current.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              close();
          }
        }}
      >
        <div className={styles.head}>
          <Search aria-hidden="true" size={20} />
          <input
            ref={input}
            role="combobox"
            aria-label="O que procuras?"
            aria-controls={listId}
            aria-expanded={open}
            aria-autocomplete="list"
            aria-activedescendant={
              results[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
            placeholder={
              state.actor.role === "admin"
                ? "Jogos, ideias, gamificação…"
                : "Ranking, jogos, prémios…"
            }
            autoComplete="off"
            maxLength={120}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setActive((previous) =>
                  results.length
                    ? (previous +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        results.length) %
                      results.length
                    : 0,
                );
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const entry = results[activeIndex];
                if (entry) navigate(entry);
              }
            }}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Fechar pesquisa"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        <div
          role="listbox"
          id={listId}
          aria-label="Resultados da pesquisa"
          className={styles.results}
        >
          {results.map((entry, index) => (
            <button
              key={entry.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              className={styles.result}
              onMouseMove={() => setActive(index)}
              onClick={() => navigate(entry)}
            >
              <span>
                <small>{entry.kind}</small>
                <strong>{entry.label}</strong>
                <small>{entry.description}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
        {!results.length && (
          <p className={styles.empty} role="status">
            Não encontrámos resultados. Experimenta outro termo.
          </p>
        )}
        <footer className={styles.footer}>
          ↑ ↓ selecionar · Enter abrir · Esc fechar{" "}
          <span>
            {state.actor.role === "admin" ? "Espaço Admin" : "Espaço Jogador"}
          </span>
        </footer>
      </dialog>
    </div>
  );
}
