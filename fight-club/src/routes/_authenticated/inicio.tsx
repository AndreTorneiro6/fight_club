import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Avatar, SectionTitle } from "@/components/AppShell";
import { RankingList, Trend } from "@/components/RankingList";
import {
  ACTIVE,
  divStyle,
  challengeable,
  displayStatus,
  fmtDateTime,
  statusOf,
  useChallenges,
  useCourts,
  useDivisions,
  useMe,
  usePlayers,
  useSettings,
} from "@/lib/league";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Início — Fight Club Padel League" },
      { name: "description", content: "O teu painel na liga." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data: me } = useMe();
  const { data: players = [] } = usePlayers();
  const { data: divisions = [] } = useDivisions();
  const { data: challenges = [] } = useChallenges();
  const { data: courts = [] } = useCourts();
  const { data: settings } = useSettings();
  const p = me?.player;

  if (!p)
    return (
      <AppShell>
        <div className="panel p-5 text-sm text-muted-foreground">A carregar…</div>
      </AppShell>
    );

  const div = divisions.find((d) => d.id === p.division_id);
  const ds = divStyle(div?.code);
  const divPlayers = players.filter((x) => x.division_id === p.division_id);
  const allowed = challengeable(p, players, challenges, settings);
  const mine = challenges.filter((c) => c.challenger_id === p.id || c.defender_id === p.id);
  const next = mine.find((c) => ACTIVE.includes(c.status) && displayStatus(c) !== "expired");
  const name = (id: string) => players.find((x) => x.id === id);
  let streak = 0;
  for (const c of mine.filter((c) => c.status === "completed")) {
    if (c.winner_id === p.id) streak++;
    else break;
  }

  return (
    <AppShell>
      <section className="panel p-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar name={p.name} url={p.avatar_url} size="size-20 !rounded-2xl text-3xl" />
            <span className="absolute -bottom-2 -right-2 grid size-8 place-items-center rounded-full bg-primary font-display text-lg text-primary-foreground ring-2 ring-background">
              {p.position}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-3xl leading-none tracking-wide">
              {p.name.toUpperCase()}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full panel-gold px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${ds.text}`}
              >
                {ds.emoji} {div?.name}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-silver">
                Rank #{p.position}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">
                <Trend p={p} />
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-border panel-sunk py-3 text-center">
          <Stat v={`${p.wins}–${p.losses}`} l="V–D" gold />
          <Stat v={mine.length} l="Desafios" />
          <Stat v={streak} l="Sequência" />
        </div>
      </section>

      <section className="panel relative overflow-hidden p-4">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />
        <div className="flex items-center justify-between">
          <div className="font-display text-lg tracking-[0.2em] text-gold">PRÓXIMO DESAFIO</div>
          {next && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-silver">
              {statusOf(displayStatus(next)).icon} {statusOf(displayStatus(next)).label}
            </span>
          )}
        </div>
        {next ? (
          <>
            <div className="mt-3 flex items-center gap-3">
              <Side
                n={name(next.challenger_id)?.name}
                sub={`#${name(next.challenger_id)?.position}`}
              />
              <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary ring-1 ring-border">
                <span className="font-display text-lg text-gold">VS</span>
                <div className="belt-shine absolute inset-y-0 w-1/2" />
              </div>
              <Side n={name(next.defender_id)?.name} sub={`#${name(next.defender_id)?.position}`} />
            </div>
            <div className="mt-3 flex items-center justify-between panel-sunk px-3 py-2 text-[12px] text-silver">
              <span>
                {next.scheduled_at ? `🗓 ${fmtDateTime(next.scheduled_at)}` : "Por marcar"}
              </span>
              <span className="font-medium text-foreground">
                {courts.find((c) => c.id === next.court_id)?.name ?? "Neiva Padel Club"}
              </span>
            </div>
            <Link
              to="/desafios/$id"
              params={{ id: next.id }}
              className="mt-3 block w-full rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-bold uppercase tracking-wide text-primary-foreground active:scale-[0.98]"
            >
              Ver jogo
            </Link>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Sem desafios ativos.{" "}
            {allowed.size > 0 ? "Escolhe um adversário e sobe no ranking." : ""}
          </p>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Quick to="/ranking" n="01" label="Desafiar" gold />
        <Quick to="/ranking" n="02" label="Ranking" />
        <Quick to="/jogos" n="03" label="Meus jogos" />
        <Link
          to="/ranking"
          className="col-span-2 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary/25 to-primary/5 px-4 py-3 ring-1 ring-primary/30 active:scale-[0.98]"
        >
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl leading-none text-gold">★</span>
            <span className="text-[12px] font-bold uppercase tracking-wide text-gold">
              Title Fight
            </span>
          </div>
          <span className="text-[11px] font-medium text-silver">vs #1 →</span>
        </Link>
        <Quick to="/perfil" n="04" label="Perfil" />
      </section>

      <section className="panel p-4">
        <SectionTitle
          right={
            <Link to="/ranking" className="text-[11px] font-medium text-silver/70">
              Ver tudo →
            </Link>
          }
        >
          RANKING {div?.name.toUpperCase()}
        </SectionTitle>
        <div className="mt-3">
          <RankingList players={divPlayers} me={p} allowed={allowed} limit={4} />
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ v, l, gold }: { v: string | number; l: string; gold?: boolean }) {
  return (
    <div>
      <div className={`font-display text-2xl leading-none ${gold ? "text-gold" : ""}`}>{v}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{l}</div>
    </div>
  );
}
function Side({ n, sub }: { n?: string | undefined; sub: string }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="truncate font-display text-xl leading-none tracking-wide">
        {(n ?? "").split(" ")[0]?.toUpperCase()}
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
function Quick({
  to,
  n,
  label,
  gold,
}: {
  to: "/ranking" | "/jogos" | "/perfil";
  n: string;
  label: string;
  gold?: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-center ring-1 ring-border active:scale-95"
    >
      <span className={`font-display text-sm tracking-wider ${gold ? "text-gold" : "text-silver"}`}>
        {n}
      </span>
      <span className="text-[11px] font-semibold">{label}</span>
    </Link>
  );
}
