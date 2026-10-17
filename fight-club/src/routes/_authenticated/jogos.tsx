import { createFileRoute } from "@tanstack/react-router";
import { AppShell, SectionTitle } from "@/components/AppShell";
import { ChallengeCard } from "@/components/ChallengeCard";
import { useChallenges, useCourts, useMe, usePlayers } from "@/lib/league";

export const Route = createFileRoute("/_authenticated/jogos")({
  head: () => ({
    meta: [
      { title: "Jogos — Fight Club Padel League" },
      { name: "description", content: "Jogos marcados e resultados." },
    ],
  }),
  component: Jogos,
});

function Jogos() {
  const { data: me } = useMe();
  const { data: players = [] } = usePlayers();
  const { data: challenges = [] } = useChallenges();
  const { data: courts = [] } = useCourts();
  const p = me?.player;
  const games = challenges.filter((c) => c.scheduled_at || c.status === "completed");
  const mine = games.filter((c) => p && (c.challenger_id === p.id || c.defender_id === p.id));
  const upcoming = games
    .filter((c) => c.status === "scheduled")
    .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!));
  const court = (id: string | null) => courts.find((c) => c.id === id)?.name;
  return (
    <AppShell title="JOGOS">
      <SectionTitle>OS MEUS JOGOS</SectionTitle>
      {mine.length ? (
        mine.map((c) => (
          <ChallengeCard key={c.id} c={c} players={players} courtName={court(c.court_id)} />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Ainda sem jogos.</p>
      )}
      <SectionTitle>PRÓXIMOS NA LIGA</SectionTitle>
      {upcoming.length ? (
        upcoming.map((c) => (
          <ChallengeCard key={c.id} c={c} players={players} courtName={court(c.court_id)} />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Sem jogos marcados.</p>
      )}
    </AppShell>
  );
}
