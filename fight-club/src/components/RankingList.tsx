import { Link } from "@tanstack/react-router";
import { ChallengeButton } from "./ChallengeDialog";
import { Avatar } from "./AppShell";
import type { Player } from "@/lib/league";

export function Trend({ p }: { p: Player }) {
  if (p.previous_position == null || p.previous_position === p.position)
    return <span className="text-muted-foreground">–</span>;
  const up = p.previous_position > p.position;
  return (
    <span className={up ? "text-success" : "text-destructive"}>
      {up ? "▲" : "▼"}
      {Math.abs(p.previous_position - p.position)}
    </span>
  );
}

const medal = ["🥇", "🥈", "🥉"];

export function RankingList({
  players,
  me,
  allowed,
  limit,
  showAvatars,
}: {
  players: Player[];
  me?: Player | null | undefined;
  allowed: Set<string>;
  limit?: number | undefined;
  showAvatars?: boolean | undefined;
}) {
  let list = players;
  if (limit && me) {
    const top = players.slice(0, limit);
    list =
      top.some((p) => p.id === me.id) || me.division_id !== players[0]?.division_id
        ? top
        : [...top, me];
  }
  return (
    <div className="space-y-2">
      {list.map((p) => {
        const mine = p.id === me?.id;
        const champ = p.position === 1;
        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl p-2.5 ${champ || mine ? "panel-gold" : "bg-muted ring-1 ring-border"} ${p.status !== "active" ? "opacity-50" : ""}`}
          >
            <span
              className={`w-6 text-center font-display text-lg ${champ || mine ? "text-gold" : p.position === 3 ? "text-bronze" : "text-silver"}`}
            >
              {p.position}
            </span>
            {showAvatars && <Avatar name={p.name} url={p.avatar_url} size="size-9" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-bold">{p.name}</span>
                {medal[p.position - 1] && (
                  <span className="text-[13px]">{medal[p.position - 1]}</span>
                )}
                {mine && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gold">
                    tu
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.wins}V–{p.losses}D · <Trend p={p} />
                {p.previous_position != null && <span> · ant. #{p.previous_position}</span>}
                {p.status !== "active" && <span> · inativo</span>}
              </div>
            </div>
            {champ ? (
              <span className="rounded-lg bg-primary/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-gold ring-1 ring-primary/40">
                Campeão
              </span>
            ) : me && allowed.has(p.id) ? (
              <ChallengeButton me={me} target={p} />
            ) : mine ? (
              <Link
                to="/desafios"
                className="rounded-lg panel-gold px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-gold"
              >
                Subir
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
