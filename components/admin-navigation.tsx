"use client";

import { adminGroups as groups } from "@/lib/admin-sections";

export default function AdminNavigation({
  tab,
  onSelect,
}: {
  tab: string;
  onSelect: (tab: string) => void;
}) {
  return (
    <nav className="admin-navigation" aria-label="Secções da administração">
      <button
        className={tab === "summary" ? "primary" : ""}
        aria-current={tab === "summary" ? "page" : undefined}
        onClick={() => onSelect("summary")}
      >
        Resumo
      </button>
      <div className="admin-navigation-groups">
        {groups.map((group) => (
          <div className="admin-navigation-group" key={group.label}>
            <strong className="muted">{group.label}</strong>
            <div className="row wrap">
              {group.items.map(([value, label]) => (
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
        ))}
      </div>
    </nav>
  );
}
