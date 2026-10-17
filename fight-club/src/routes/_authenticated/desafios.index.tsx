import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, SectionTitle } from "@/components/AppShell";
import { ChallengeCard } from "@/components/ChallengeCard";
import { RankingList } from "@/components/RankingList";
import {
  ACTIVE,
  challengeable,
  displayStatus,
  useChallenges,
  useCourts,
  useMe,
  usePlayers,
  useSettings,
} from "@/lib/league";

export const Route = createFileRoute("/_authenticated/desafios/")({
  head: () => ({
    meta: [
      { title: "Desafios — Fight Club Padel League" },
      { name: "description", content: "Os teus desafios." },
    ],
  }),
  component: Desafios,
});

function Desafios() {
  const { data: me } = useMe();
  const { data: players = [] } = usePlayers();
  const { data: challenges = [] } = useChallenges();
  const { data: courts = [] } = useCourts();
  const { data: settings } = useSettings();
  const p = me?.player;
  const mine = challenges.filter((c) => p && (c.challenger_id === p.id || c.defender_id === p.id));
  const active = mine.filter((c) => ACTIVE.includes(c.status) && displayStatus(c) !== "expired");
  const past = mine.filter((c) => !active.includes(c));
  const allowed = challengeable(p, players, challenges, settings);
  const targets = players.filter((x) => allowed.has(x.id));
  const court = (id: string | null) => courts.find((c) => c.id === id)?.name;

  return (
    <AppShell title="DESAFIOS">
      <section className="panel p-4">
        <SectionTitle>⚔ PODES DESAFIAR</SectionTitle>
        <div className="mt-3">
          {targets.length ? (
            <RankingList players={targets} me={p} allowed={allowed} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {active.length
                ? "Termina o teu desafio ativo para lançar outro."
                : "Ninguém disponível dentro das regras neste momento."}{" "}
              <Link to="/ranking" className="text-gold">
                Ver ranking →
              </Link>
            </p>
          )}
        </div>
      </section>
      <SectionTitle>ATIVOS</SectionTitle>
      {active.length ? (
        active.map((c) => (
          <ChallengeCard key={c.id} c={c} players={players} courtName={court(c.court_id)} />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Sem desafios ativos.</p>
      )}
      <SectionTitle>HISTÓRICO</SectionTitle>
      {past.length ? (
        past.map((c) => (
          <ChallengeCard key={c.id} c={c} players={players} courtName={court(c.court_id)} />
        ))
      ) : (
        <p className="text-sm text-muted-foreground">Ainda sem histórico.</p>
      )}
    </AppShell>
  );
}
