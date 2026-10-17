import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "@/lib/league";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fight Club Padel League — Neiva Padel Club" },
      {
        name: "description",
        content:
          "A liga competitiva de padel do Neiva Padel Club: ranking, desafios, marcação de jogos e cinturões.",
      },
      { property: "og:title", content: "Fight Club Padel League" },
      {
        property: "og:description",
        content: "Desafia, marca e sobe no ranking da liga do Neiva Padel Club.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: user } = useSession();
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="arena-glow-a pointer-events-none absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl" />
      <div className="arena-glow-b pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full blur-3xl" />
      <div className="relative">
        <div className="text-5xl">🥊</div>
        <h1 className="mt-4 font-display text-7xl leading-none tracking-[0.12em]">FIGHT CLUB</h1>
        <div className="mt-2 font-display text-xl tracking-[0.5em] text-silver/70">
          PADEL LEAGUE
        </div>
        <div className="mx-auto mt-6 flex max-w-xs justify-center gap-3 font-display text-lg tracking-widest">
          <span className="text-gold">OURO</span>·<span className="text-silver">PRATA</span>·
          <span className="text-bronze">BRONZE</span>
        </div>
        <p className="mx-auto mt-6 max-w-xs text-sm text-muted-foreground">
          Desafia. Marca. Vence. Sobe no ranking do Neiva Padel Club.
        </p>
        <Link
          to={user ? "/inicio" : "/auth"}
          className="mt-8 inline-flex rounded-xl bg-primary px-8 py-3 text-sm font-bold uppercase tracking-wider text-primary-foreground transition-transform active:scale-[0.98]"
        >
          {user ? "Entrar na arena" : "Entrar"}
        </Link>
      </div>
    </div>
  );
}
