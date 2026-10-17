import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { RankingList } from "@/components/RankingList";
import {
  divStyle,
  challengeable,
  useChallenges,
  useDivisions,
  useMe,
  usePlayers,
  useSettings,
} from "@/lib/league";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — Fight Club Padel League" },
      { name: "description", content: "Rankings Ouro, Prata e Bronze." },
    ],
  }),
  component: RankingPage,
});

function RankingPage() {
  const { data: me } = useMe();
  const { data: divisions = [] } = useDivisions();
  const { data: players = [] } = usePlayers();
  const { data: challenges = [] } = useChallenges();
  const { data: settings } = useSettings();
  const [div, setDiv] = useState<string>();
  useEffect(() => {
    if (!div && (me?.player || divisions[0])) setDiv(me?.player?.division_id ?? divisions[0]?.id);
  }, [me, divisions, div]);
  const allowed = challengeable(me?.player, players, challenges, settings);

  return (
    <AppShell title="RANKING">
      <div className="grid grid-cols-3 gap-2">
        {divisions.map((d) => {
          const s = divStyle(d.code);
          return (
            <button
              key={d.id}
              onClick={() => setDiv(d.id)}
              className={`rounded-2xl py-3 font-display text-lg tracking-widest ring-1 ${div === d.id ? `panel-gold ${s.text}` : "bg-card ring-border text-muted-foreground"}`}
            >
              {s.emoji} {d.name}
            </button>
          );
        })}
      </div>
      {settings && me?.player && (
        <p className="text-xs text-muted-foreground">
          Podes desafiar até {settings.max_positions_above} posições acima de ti na tua divisão.
        </p>
      )}
      <RankingList
        players={players.filter((p) => p.division_id === div)}
        me={me?.player}
        allowed={allowed}
        showAvatars
      />
    </AppShell>
  );
}
