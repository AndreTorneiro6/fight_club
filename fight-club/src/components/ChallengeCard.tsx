import { Link } from "@tanstack/react-router";
import {
  statusOf,
  displayStatus,
  fmtDate,
  fmtDateTime,
  type Challenge,
  type Player,
} from "@/lib/league";

export function ChallengeCard({
  c,
  players,
  courtName,
}: {
  c: Challenge;
  players: Player[];
  courtName?: string | undefined;
}) {
  const a = players.find((p) => p.id === c.challenger_id);
  const b = players.find((p) => p.id === c.defender_id);
  const st = statusOf(displayStatus(c));
  return (
    <Link to="/desafios/$id" params={{ id: c.id }} className="block panel p-4 active:scale-[0.99]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-display text-sm tracking-widest text-muted-foreground">
          DESAFIO #{c.number}
        </span>
        <span className={`font-semibold ${st.tone}`}>
          {st.icon} {st.label}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate font-display text-xl ${c.winner_id === a?.id ? "text-gold" : ""}`}
        >
          {a?.name} <span className="text-sm text-muted-foreground">#{c.challenger_pos}</span>
        </span>
        <span className="font-display text-gold">VS</span>
        <span
          className={`min-w-0 flex-1 truncate text-right font-display text-xl ${c.winner_id === b?.id ? "text-gold" : ""}`}
        >
          {b?.name} <span className="text-sm text-muted-foreground">#{c.defender_pos}</span>
        </span>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {c.scheduled_at
          ? `🗓 ${fmtDateTime(c.scheduled_at)}${courtName ? ` · ${courtName}` : ""}`
          : `Prazo: ${fmtDate(c.play_by)}`}
        {c.score && ` · ${c.score}`}
      </div>
    </Link>
  );
}
