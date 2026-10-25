"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { adminGroups as groups } from "@/lib/admin-sections";

const primary = [
  ["summary", "Resumo"],
  ["games", "Jogos"],
  ["challenges", "Desafios"],
  ["results", "Resultados"],
  ["weekly", "Papéis semanais"],
  ["players", "Jogadores"],
] as const;
const primaryIds = new Set<string>(primary.map(([id]) => id));

export default function AdminNavigation({
  tab,
  onSelect,
}: {
  tab: string;
  onSelect: (tab: string) => void;
}) {
  const [expanded, setExpanded] = useState(() => !primaryIds.has(tab));
  useEffect(() => {
    if (!primaryIds.has(tab)) setExpanded(true);
  }, [tab]);
  const [query, setQuery] = useState("");
  const normalized = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const open = expanded;
  return (
    <nav className="admin-navigation" aria-label="Secções da administração">
      <div className="admin-primary-navigation" aria-label="Gestão diária">
        {primary.map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "primary" : ""}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => onSelect(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="admin-tools">
        <button
          className="admin-tools-toggle"
          aria-expanded={open}
          aria-controls="admin-tools-panel"
          onClick={() => {
            setExpanded(!open);
          }}
        >
          <span>
            Mais ferramentas <small>Configuração, comunicação e extras</small>
          </span>
          <ChevronDown
            size={16}
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          />
        </button>
        {open && (
          <div id="admin-tools-panel" className="admin-tools-content">
            <label className="admin-tool-search">
              <Search size={16} />
              <span className="sr-only">
                Procurar ferramenta de administração
              </span>
              <input
                type="search"
                placeholder="Procurar ferramenta…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="admin-navigation-groups">
              {groups.map((group) => {
                const items = group.items.filter(
                  ([id, label]) =>
                    !primaryIds.has(id) &&
                    normalized(label).includes(normalized(query)),
                );
                if (!items.length) return null;
                return (
                  <div className="admin-navigation-group" key={group.label}>
                    <strong className="muted">{group.label}</strong>
                    <div className="row wrap">
                      {items.map(([value, label]) => (
                        <button
                          key={value}
                          className={tab === value ? "primary small" : "small"}
                          aria-current={tab === value ? "page" : undefined}
                          onClick={() => onSelect(value)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {!groups.some((g) =>
              g.items.some(
                ([id, label]) =>
                  !primaryIds.has(id) &&
                  normalized(label).includes(normalized(query)),
              ),
            ) && (
              <p role="status" className="muted">
                Nenhuma ferramenta encontrada.
              </p>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
