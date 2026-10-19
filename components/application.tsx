"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { rankingEntries, teamMembers, teamName } from "@/lib/ranking-groups";
import AdminTeamRanking from "./admin-team-ranking";
import MatchdayGenerator from "./matchday-generator";
import AppGuide, { FirstVisitWalkthrough } from "./app-guide";
import MobileApp, { PlayerAppRegistration } from "./mobile-app";
import {
  DeliveryStatus,
  NotificationSettings,
  PushNotificationSettings,
} from "./notification-settings";
import CourtAvailability from "./court-availability";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Crown,
  Download,
  Eye,
  EyeOff,
  Flame,
  History,
  Home,
  LogOut,
  Menu,
  Medal,
  MessageCircle,
  Plus,
  Search,
  Settings2,
  Shield,
  Swords,
  Sword,
  Gift,
  BookOpen,
  Target,
  Trophy,
  Users,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  activeChallenges,
  canRefuse,
  challengeReason,
  compatibleStarts,
  effectiveStatus,
  fmtDate,
  fmtTime,
  involves,
  terminal,
} from "@/lib/rules";
import {
  defaultSettings,
  statusLabels,
  type Challenge,
  type Player,
  type Settings,
  type View,
} from "@/lib/types";
import { WeeklyRoles, WeeklyBadge, WeekNavigation } from "./weekly-controls";
import { weeklyWindow, weeklyRole, frozenRanking } from "@/lib/weekly";
import {
  clubDateTime,
  clubDay,
  initialProposals,
  clubWeek,
  addClubDays,
} from "@/lib/calendar";

async function request(url: string, body?: unknown) {
  const res = await fetch(
    url,
    body instanceof FormData
      ? { method: "POST", body }
      : body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : { cache: "no-store" },
  );
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(
      new Error(data.error ?? "Não foi possível concluir a operação."),
      { status: res.status },
    );
  return data;
}
function Logo() {
  return (
    <div className="logo">
      <div className="logo-mark">
        <Swords size={23} />
      </div>
      <div>
        <div className="wordmark">FIGHT CLUB</div>
        <div className="submark">PADEL LEAGUE</div>
      </div>
    </div>
  );
}
function Avatar({ p, large = false }: { p?: Player; large?: boolean }) {
  return p?.photo ? (
    <img
      className={`avatar ${large ? "large" : ""}`}
      src={p.photo}
      alt={p.name}
    />
  ) : (
    <span className={`avatar ${large ? "large" : ""}`}>
      {p?.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("") ?? "FC"}
    </span>
  );
}
function DivisionBadge({ s, id }: { s: View; id: string }) {
  const d = s.divisions.find((d) => d._id === id);
  return (
    <span className={`badge ${d?.code === "ouro" ? "gold" : d?.code}`}>
      <Medal size={12} />
      {d?.name.toUpperCase()}
    </span>
  );
}
function Status({ c }: { c: Challenge }) {
  const status = effectiveStatus(c);
  return (
    <span className={`badge status-${status}`}>
      <span className="dot" style={{ background: "currentColor" }} />
      {statusLabels[status]}
    </span>
  );
}
function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Swords size={30} />
      <p>{text}</p>
      {children}
    </div>
  );
}
function Section({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="section-head">
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
function Heading({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: string;
  description: string;
  right?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow gold">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {right}
    </div>
  );
}
function Trend({ p }: { p: Player }) {
  const diff = p.previousPosition - p.position;
  return (
    <span
      className={diff > 0 ? "positive" : diff < 0 ? "negative" : "muted"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11,
      }}
    >
      {diff > 0 ? (
        <ArrowUp size={12} />
      ) : diff < 0 ? (
        <ArrowDown size={12} />
      ) : (
        "—"
      )}
      {diff ? Math.abs(diff) : ""}
    </span>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>("button,input,select,textarea")
      ?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,select,textarea,a[href]",
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
const nav = [
  { path: "inicio", label: "Início", icon: Home },
  { path: "ranking", label: "Ranking", icon: Medal },
  { path: "desafios", label: "Desafios", icon: Swords },
  { path: "jogos", label: "Jogos", icon: CalendarDays },
  { path: "perfil", label: "Perfil", icon: UserRound },
];
type Actions = {
  chatConnection?: "connecting" | "live" | "reconnecting";
  s: View;
  run: (cmd: unknown, message?: string) => Promise<any>;
  busy: boolean;
  notify: (text: string, bad?: boolean) => void;
  refresh: () => Promise<void>;
};

export function Application({
  route,
  googleEnabled,
  demo,
}: {
  route: string;
  googleEnabled: boolean;
  demo: boolean;
}) {
  const router = useRouter(),
    [s, setS] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [chatConnection, setChatConnection] = useState<
      "connecting" | "live" | "reconnecting"
    >("connecting"),
    [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const notify = useCallback(
    (text: string, bad = false) => setToast({ text, bad }),
    [],
  );
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const next = await request("/api/league");
      if (sequence !== refreshSequence.current) return;
      setS(next);
      setError("");
    } catch (e) {
      if ((e as { status: number }).status === 401) {
        router.replace("/auth");
        return;
      }
      setError((e as Error).message);
    }
  }, [router]);
  useEffect(() => {
    if (!route || ["auth", "inscricao"].includes(route)) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [route, refresh]);
  useEffect(() => {
    if (!route.startsWith("desafios/")) return;
    setChatConnection("connecting");
    const source = new EventSource(
      `/api/challenges/${encodeURIComponent(route.split("/")[1])}/events`,
    );
    const update = () => {
      void refresh();
    };
    source.addEventListener("ready", () => {
      setChatConnection("live");
      update();
    });
    source.addEventListener("change", update);
    source.addEventListener("revoked", () => {
      source.close();
      setChatConnection("reconnecting");
      update();
    });
    source.onerror = () => setChatConnection("reconnecting");
    return () => source.close();
  }, [route, refresh]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function run(cmd: unknown, message = "Guardado com sucesso.") {
    setBusy(true);
    try {
      const result = await request("/api/league", cmd);
      await refresh();
      if (message) notify(message);
      return result;
    } catch (e) {
      notify((e as Error).message, true);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  // Event handlers explicitly consume rejected commands; the error is already presented by run().
  const safeRun: Actions["run"] = async (cmd, message) => {
    try {
      return await run(cmd, message);
    } catch {
      return null;
    }
  };
  if (!route) return <Landing />;
  if (["auth", "inscricao"].includes(route))
    return <Auth googleEnabled={googleEnabled} demo={demo} />;
  if (!s)
    return (
      <main className="center-screen">
        {error ? (
          <div className="panel stack">
            <h2>Vamos preparar a liga</h2>
            <p className="error">{error}</p>
            <p>
              Configura a ligação MongoDB em <code>.env.local</code> e executa{" "}
              <code>npm run seed</code>, ou usa <code>npm run dev:demo</code>{" "}
              para experimentar.
            </p>
            <button onClick={refresh}>Tentar novamente</button>
          </div>
        ) : (
          <div className="loading">
            <div className="spinner" />
            <p>A entrar na arena…</p>
          </div>
        )}
      </main>
    );
  const p = s.players.find((p) => p._id === s.actor.playerId)!,
    admin = s.actor.role === "admin",
    unread = s.notifications.filter((n) => !n.read).length;
  if ((p.awaitingApproval || p.registrationRejectedAt) && !admin)
    return (
      <main className="center-screen">
        <div className="panel stack">
          <Logo />
          <h1>
            {p.registrationRejectedAt
              ? "Inscrição recusada"
              : "Inscrição recebida"}
          </h1>
          <p>
            {p.registrationRejectedAt
              ? "O clube não aprovou a tua inscrição. Contacta o clube se precisares de esclarecimentos. Esta conta será eliminada automaticamente 2 dias após a recusa."
              : "A tua inscrição aguarda a decisão do clube. Receberás um aviso quando a tua entrada na liga for aprovada."}
          </p>
          <p>Nome: {p.name}</p>
          <button onClick={() => void refresh()}>
            {p.registrationRejectedAt
              ? "Verificar estado"
              : "Verificar aprovação"}
          </button>
          <button
            onClick={async () => {
              await request("/api/auth/logout", {});
              router.replace("/auth");
            }}
          >
            Terminar sessão
          </button>
        </div>
      </main>
    );
  const actions: Actions = {
    s,
    run: safeRun,
    busy,
    notify,
    refresh,
    chatConnection,
  };
  const title =
    nav.find((n) => route.startsWith(n.path))?.label ??
    {
      admin: "Administração",
      ajuda: "Como usar a app",
      "ajuda/admin": "Manual do administrador",
      "title-fight": "Title Fight",
      campeoes: "Hall of Champions",
      epocas: "Épocas",
      estatisticas: "Estatísticas",
      notificacoes: "Notificações",
      regras: "Regras",
      premios: "Prémios",
    }[route] ??
    "Desafio";
  return (
    <>
      {!route.startsWith("ajuda") && (!admin || route === "admin") && (
        <FirstVisitWalkthrough
          key={`${p._id}:${admin}`}
          playerId={p._id}
          admin={admin}
        />
      )}
      <aside className="sidebar">
        <Link href="/inicio">
          <Logo />
        </Link>
        <div className="nav-label">A TUA ARENA</div>
        {nav.map((n) => (
          <Link
            key={n.path}
            href={"/" + n.path}
            className={`nav-link ${route.startsWith(n.path) ? "active" : ""}`}
          >
            <n.icon size={17} />
            {n.label}
          </Link>
        ))}
        <div className="nav-label">A LIGA</div>
        {[
          { path: "title-fight", label: "Title Fight", icon: Trophy },
          { path: "campeoes", label: "Hall of Champions", icon: Crown },
          { path: "epocas", label: "Épocas", icon: CalendarDays },
          { path: "estatisticas", label: "Estatísticas", icon: Target },
          { path: "regras", label: "Regras", icon: BookOpen },
          { path: "ajuda", label: "Como usar a app", icon: BookOpen },
          { path: "premios", label: "Prémios", icon: Gift },
          ...(admin
            ? [{ path: "admin", label: "Administração", icon: Shield }]
            : []),
        ].map((n) => (
          <Link
            key={n.path}
            href={"/" + n.path}
            className={`nav-link ${route === n.path ? "active" : ""}`}
          >
            <n.icon size={17} />
            {n.label}
          </Link>
        ))}
        <div className="sidebar-bottom">
          <div className="row">
            <span className="dot" />
            <span className="club-label">NEIVA PADEL CLUB</span>
          </div>
          <small>Uma vitória é uma vitória.</small>
          <button
            className="ghost small wide space-top"
            onClick={async () => {
              await request("/api/auth/logout", {});
              router.push("/auth");
            }}
          >
            <LogOut size={14} />
            Terminar sessão
          </button>
          <div className="sidebar-credit">
            Desenvolvido por <strong>WBGLabs</strong>
          </div>
        </div>
      </aside>
      <div className="app-main">
        {s.demo && (
          <div className="demo-note">
            DEMONSTRAÇÃO · Jogadores e dados fictícios
          </div>
        )}
        <header className="topbar">
          <div className="breadcrumb">
            Fight Club <span>/</span>
            <strong>{title}</strong>
          </div>
          <div className="row">
            <button
              className="icon-button mobile-only"
              aria-label="Menu da liga"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <span className="badge gold desktop-meta">
              <span className="dot" />
              {s.seasons.find((x) => x.status === "active")?.name ??
                "Época em pausa"}
            </span>
            {admin && (
              <Link className="button small" href="/admin">
                <Shield size={13} />
                Admin
              </Link>
            )}
            <Link
              href="/notificacoes"
              className="icon-button"
              aria-label={`Notificações: ${unread} por ler`}
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="notification-count">{unread}</span>
              )}
            </Link>
            <Link href="/perfil" className="row">
              <Avatar p={p} />
              <div className="desktop-meta">
                <div style={{ fontSize: 11, fontWeight: 800 }}>{p.name}</div>
                <small>
                  {admin ? "Administrador" : "Jogador"} · #{p.number}
                </small>
              </div>
            </Link>
          </div>
        </header>
        <main className="content">
          <PlayerAppRegistration />
          {error && <div className="error">{error}</div>}
          {route === "inicio" ? (
            <Dashboard {...actions} />
          ) : route === "ranking" ? (
            <Rankings {...actions} />
          ) : route === "desafios" ? (
            <Challenges {...actions} />
          ) : route.startsWith("desafios/") ? (
            <ChallengeDetail {...actions} id={route.split("/")[1]} />
          ) : route === "jogos" ? (
            <Games {...actions} />
          ) : route === "perfil" ? (
            <Profile {...actions} />
          ) : route === "notificacoes" ? (
            <Notifications {...actions} />
          ) : route === "ajuda" ? (
            <AppGuide playerId={p._id} />
          ) : route === "ajuda/admin" ? (
            admin ? (
              <AppGuide admin playerId={p._id} />
            ) : (
              <Empty text="Esta área é exclusiva dos administradores." />
            )
          ) : route === "admin" ? (
            admin ? (
              <Admin {...actions} />
            ) : (
              <Empty text="Esta área é exclusiva dos administradores." />
            )
          ) : route === "title-fight" ? (
            <TitleFights {...actions} />
          ) : route === "campeoes" ? (
            <Champions {...actions} />
          ) : route === "epocas" ? (
            <Seasons {...actions} />
          ) : route === "regras" || route === "premios" ? (
            <LeagueInformation {...actions} page={route} />
          ) : (
            <Statistics {...actions} />
          )}
          <div className="footer-note">
            NEIVA PADEL CLUB · FIGHT CLUB PADEL LEAGUE
          </div>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Menu principal">
        {nav.map((n) => (
          <Link
            key={n.path}
            href={"/" + n.path}
            className={route.startsWith(n.path) ? "active" : ""}
          >
            <n.icon size={19} />
            {n.label}
          </Link>
        ))}
      </nav>
      {menu && (
        <Modal title="A liga" close={() => setMenu(false)}>
          <div className="stack">
            {[
              ["title-fight", "Title Fight"],
              ["campeoes", "Hall of Champions"],
              ["epocas", "Épocas"],
              ["estatisticas", "Estatísticas"],
              ["regras", "Regras"],
              ["ajuda", "Como usar a app"],
              ...(admin ? [["ajuda/admin", "Manual do administrador"]] : []),
              ["premios", "Prémios"],
              ...(admin ? [["admin", "Administração"]] : []),
            ].map(([path, label]) => (
              <Link
                className="button"
                key={path}
                href={"/" + path}
                onClick={() => setMenu(false)}
              >
                {label}
                <ArrowRight size={14} />
              </Link>
            ))}
          </div>
        </Modal>
      )}
      {toast && (
        <div
          role={toast.bad ? "alert" : "status"}
          className={`toast ${toast.bad ? "bad" : ""}`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}

function Landing() {
  return (
    <div className="landing">
      <header>
        <Logo />
        <div className="row">
          <span className="eyebrow muted">NEIVA PADEL CLUB · PORTUGAL</span>
          <Link href="/auth" className="button">
            Entrar <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      <main className="landing-hero">
        <span className="badge gold">
          <span className="dot" /> A ARENA É TUA
        </span>
        <h1>
          FIGHT <span className="gold">CLUB</span>
        </h1>
        <div className="landing-sub">PADEL LEAGUE</div>
        <p>
          Desafia. Marca. Vence.
          <br />
          Sobe no ranking do Neiva Padel Club.
        </p>
        <div className="landing-divisions">
          <span className="gold">OURO</span>
          <span className="muted">·</span>
          <span style={{ color: "var(--silver)" }}>PRATA</span>
          <span className="muted">·</span>
          <span style={{ color: "var(--bronze)" }}>BRONZE</span>
        </div>
        <Link className="button primary" href="/auth">
          ENTRAR NA ARENA <ArrowRight size={17} />
        </Link>
        <small style={{ marginTop: 22 }}>Uma vitória é uma vitória.</small>
      </main>
      <footer>
        <span>TRÊS DIVISÕES. UM OBJETIVO. CONQUISTA O TEU LUGAR.</span>
        <span className="landing-credit">
          Desenvolvido por <strong>WBGLabs</strong>
        </span>
      </footer>
    </div>
  );
}

function Auth({
  googleEnabled,
  demo,
}: {
  googleEnabled: boolean;
  demo: boolean;
}) {
  const router = useRouter(),
    [mode, setMode] = useState("login"),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [token, setToken] = useState(""),
    [invitation, setInvitation] = useState(""),
    [invitationSetup, setInvitationSetup] = useState(false),
    [registrationDivisions, setRegistrationDivisions] = useState<
      { _id: string; name: string }[]
    >([]);
  useEffect(() => {
    setReady(true);
    const q = new URLSearchParams(location.search),
      t = q.get("token");
    if (q.get("invite")) {
      setInvitation(q.get("invite")!);
      setMode("register");
    }
    if (q.get("error") === "invite_required")
      setError(
        "Cria primeiro uma conta com email e palavra-passe. Sem convite, a entrada na liga precisa da aprovação do clube.",
      );
    if (q.get("purpose") === "invite") setInvitationSetup(true);
    if (q.has("password") || q.has("email")) {
      q.delete("password");
      q.delete("email");
      history.replaceState(
        history.state,
        "",
        location.pathname + (q.size ? "?" + q.toString() : ""),
      );
    }
    if (t) {
      if (q.get("purpose") === "verify") {
        void request("/api/auth/verify", { token: t })
          .then((res) => setMessage(res.message))
          .catch((e) => setError(e.message));
      } else {
        setToken(t);
        setMode("reset");
      }
    }
  }, []);
  useEffect(() => {
    setShowPassword(false);
  }, [mode]);
  useEffect(() => {
    if (mode !== "register" && !invitationSetup) return;
    let cancelled = false;
    void request("/api/auth/divisions")
      .then((data) => {
        if (!cancelled) setRegistrationDivisions(data.divisions);
      })
      .catch((error) => {
        if (!cancelled) setError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, invitationSetup]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await request(`/api/auth/${mode}`, {
        ...data,
        token,
        ...(mode === "register" || invitationSetup
          ? {
              invite: invitation || undefined,
              privacyAccepted: data.privacyAccepted === "on",
            }
          : {}),
      });
      if (mode === "forgot" || res.pending) {
        setMessage(res.message);
        if (res.pending) setMode("login");
      } else router.replace("/inicio");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="center-screen">
      <div className="panel auth-panel stack">
        <Link href="/">
          <Logo />
        </Link>
        <div className="divider" />
        <div>
          <div className="eyebrow gold">BEM-VINDO À ARENA</div>
          <h1 style={{ fontSize: 37, marginTop: 10 }}>
            {mode === "register"
              ? "Conquista o teu lugar"
              : mode === "forgot"
                ? "Recuperar acesso"
                : mode === "reset"
                  ? "Define o teu acesso"
                  : "O próximo desafio espera."}
          </h1>
          <p style={{ fontSize: 12, marginTop: 10 }}>
            A tua liga. Os teus desafios. O teu ranking.
          </p>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        {message && <div className="success">{message}</div>}
        <noscript>
          <p className="error">
            Ativa o JavaScript para iniciar sessão de forma segura.
          </p>
        </noscript>
        <form method="post" action={`/api/auth/${mode}`} onSubmit={submit}>
          {["register", "reset"].includes(mode) && (
            <label>
              Nome
              <input name="name" autoComplete="name" required minLength={2} />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
          )}
          {mode !== "forgot" && (
            <div className="password-field">
              <label htmlFor="auth-password">Palavra-passe</label>
              <div className="password-input">
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "login" ? 1 : 10}
                  maxLength={72}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={
                    showPassword
                      ? "Ocultar palavra-passe"
                      : "Mostrar palavra-passe"
                  }
                  aria-controls="auth-password"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? (
                    <EyeOff size={20} aria-hidden="true" />
                  ) : (
                    <Eye size={20} aria-hidden="true" />
                  )}
                </button>
              </div>
              {mode !== "login" && <small>Mínimo de 10 caracteres.</small>}
            </div>
          )}
          {(mode === "register" || invitationSetup) && (
            <>
              <label>
                Categoria / Ranking
                <select
                  name="divisionId"
                  defaultValue=""
                  required
                  disabled={!registrationDivisions.length}
                >
                  <option value="" disabled>
                    Escolher categoria
                  </option>
                  {registrationDivisions.map((division) => (
                    <option key={division._id} value={division._id}>
                      {division.name}
                    </option>
                  ))}
                </select>
              </label>
              <small>
                Escolhe Ouro, Prata ou Bronze. O clube pode rever a categoria ao
                aprovar a inscrição. Se já tens uma categoria atribuída pelo
                clube, essa atribuição é mantida.
              </small>
              {mode === "register" && (
                <p>
                  {invitation
                    ? "O convite do clube aprova a tua entrada automaticamente. Confirma o email para começar."
                    : "Depois de confirmares o email, aguarda a aprovação do clube para entrares na liga."}
                </p>
              )}
              <label className="check">
                <input type="checkbox" name="privacyAccepted" required />
                Li a{" "}
                <a
                  href="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  informação de privacidade
                </a>{" "}
                e compreendo como os meus dados são usados na liga.
              </label>
            </>
          )}
          <button
            disabled={
              busy ||
              !ready ||
              ((mode === "register" || invitationSetup) &&
                !registrationDivisions.length)
            }
            className="primary wide"
          >
            {busy
              ? "Aguarda…"
              : mode === "login"
                ? "Entrar na arena"
                : mode === "register"
                  ? "Criar conta"
                  : mode === "forgot"
                    ? "Enviar instruções"
                    : "Guardar e entrar"}
            <ArrowRight size={15} />
          </button>
        </form>
        {mode === "login" && (
          <>
            {googleEnabled && (
              <a className="button wide" href="/api/auth/google">
                Continuar com Google
              </a>
            )}
            <button
              className="ghost small"
              onClick={() => {
                setMode("forgot");
                setError("");
              }}
            >
              Esqueci-me da palavra-passe
            </button>
          </>
        )}
        <div className="center">
          <small>{mode === "login" ? "Ainda não tens conta? " : ""}</small>
          <button
            className="ghost small"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setMessage("");
            }}
          >
            {mode === "login" ? "Criar conta" : "Voltar à entrada"}
          </button>
        </div>
        {demo && (
          <div className="inset">
            <div className="eyebrow gold">CONTAS DE DEMONSTRAÇÃO</div>
            <p style={{ fontSize: 11, marginTop: 8 }}>
              Admin: admin@fightclub.local
              <br />
              Jogador: jogador@fightclub.local
              <br />
              Adversário: adversario@fightclub.local
              <br />
              Palavra-passe: <strong>FightClub2026!</strong>
            </p>
          </div>
        )}
        <small className="center">Neiva Padel Club · Portugal</small>
      </div>
    </main>
  );
}

function Dashboard(a: Actions) {
  const { s } = a,
    p = s.players.find((p) => p._id === s.actor.playerId)!,
    mine = s.challenges.filter((c) => involves(c, p._id)),
    next = mine
      .filter((c) => !terminal.has(effectiveStatus(c)))
      .sort((a, b) =>
        (a.scheduledAt ?? a.playBy).localeCompare(b.scheduledAt ?? b.playBy),
      )[0],
    div = s.divisions.find((d) => d._id === p.divisionId),
    season = s.seasons.find((x) => x.status === "active");
  const completed = mine
    .filter((c) => c.status === "completed")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  let streak = 0;
  for (const c of completed) {
    if (c.winnerId === p._id) streak++;
    else break;
  }
  return (
    <>
      <Heading
        eyebrow="A TUA ARENA"
        title={`Vamos a jogo, ${p.name.split(" ")[0]}.`}
        description="Cada desafio é uma oportunidade de subir. O próximo passo é teu."
        right={
          <span className="badge">
            <CalendarDays size={12} />
            {fmtDate(new Date().toISOString())}
          </span>
        }
      />
      <div className="stats-grid">
        {[
          { label: "POSIÇÃO ATUAL", value: `#${p.position}`, icon: Medal },
          { label: "VITÓRIAS", value: p.wins, icon: Trophy },
          { label: "JOGOS REALIZADOS", value: p.wins + p.losses, icon: Swords },
          { label: "SEQUÊNCIA DE VITÓRIAS", value: streak, icon: Flame },
        ].map((x) => (
          <div className="stat-card" key={x.label}>
            <div>
              <div className="eyebrow muted" style={{ fontSize: 8 }}>
                {x.label}
              </div>
              <div className="value">{x.value}</div>
            </div>
            <div className="stat-icon">
              <x.icon size={21} />
            </div>
          </div>
        ))}
      </div>
      <div className="home-grid">
        <Section
          title="O teu lugar na liga"
          right={<DivisionBadge s={s} id={p.divisionId} />}
          className="profile-card"
        >
          <div className="row" style={{ gap: 20 }}>
            <Avatar p={p} large />
            <div>
              <h2>{p.name.toUpperCase()}</h2>
              <div className="row wrap">
                <span className="badge">JOGADOR #{p.number}</span>
                <Trend p={p} />
                <span className="badge">
                  <span className="dot" />
                  {p.status === "active"
                    ? "Ativo"
                    : p.status === "suspended"
                      ? "Suspenso"
                      : "Inativo"}
                </span>
              </div>
            </div>
          </div>
          <div className="profile-stats">
            <div>
              <small>DIVISÃO</small>
              <strong className="gold">{div?.name.toUpperCase()}</strong>
            </div>
            <div>
              <small>VITÓRIAS / DERROTAS</small>
              <strong>
                {p.wins}
                <span className="muted"> / {p.losses}</span>
              </strong>
            </div>
            <div>
              <small>APROVEITAMENTO</small>
              <strong>
                {p.wins + p.losses
                  ? Math.round((p.wins / (p.wins + p.losses)) * 100)
                  : 0}
                %
              </strong>
            </div>
          </div>
        </Section>
        <Section
          title="Próximo desafio"
          right={<Swords className="gold" size={20} />}
          className="next-card"
        >
          {next ? (
            <>
              <div className="row between">
                <small>DESAFIO #{next.number}</small>
                <Status c={next} />
              </div>
              <Versus s={s} c={next} />
              <div className="row between inset">
                <span style={{ fontSize: 11 }}>
                  <CalendarDays size={12} />{" "}
                  {next.scheduledAt
                    ? fmtDate(next.scheduledAt)
                    : "À espera de marcação"}
                </span>
                <strong className="gold">
                  {next.scheduledAt ? fmtTime(next.scheduledAt) : "—"}
                </strong>
              </div>
              <Link
                className="button primary wide space-top"
                href={"/desafios/" + next._id}
              >
                Ver desafio <ArrowRight size={15} />
              </Link>
            </>
          ) : (
            <Empty text="Ainda não tens desafios ativos.">
              <Link href="/ranking" className="button primary">
                Escolher adversário <Swords size={14} />
              </Link>
            </Empty>
          )}
        </Section>
        <div className="quick-grid full">
          {[
            {
              href: "/ranking",
              icon: Swords,
              label: "Desafiar",
              sub: "Entra na competição",
            },
            {
              href: "/ranking",
              icon: Medal,
              label: "Ranking",
              sub: "Conhece a concorrência",
            },
            {
              href: "/jogos",
              icon: CalendarDays,
              label: "Meus jogos",
              sub: "Prepara o próximo jogo",
            },
            {
              href: "/title-fight",
              icon: Trophy,
              label: "Title Fight",
              sub: "Conquista o cinturão",
            },
          ].map((q) => (
            <Link className="quick" href={q.href} key={q.label}>
              <q.icon size={22} />
              <div>
                <strong>{q.label}</strong>
                <small>{q.sub}</small>
              </div>
              <ChevronRight size={14} style={{ marginLeft: "auto" }} />
            </Link>
          ))}
        </div>
        <Section
          title={`Ranking ${div?.name}`}
          right={
            <Link className="link" href="/ranking">
              Ver ranking <ArrowRight size={12} />
            </Link>
          }
        >
          <RankingTable {...a} divisionId={p.divisionId} limit={5} />
        </Section>
        <Section
          title="Dentro da arena"
          right={<Zap size={18} className="gold" />}
        >
          <div className="stack">
            <div className="inset">
              <div className="eyebrow gold">{season?.name ?? "ÉPOCA"}</div>
              <h3 style={{ margin: "10px 0" }}>Uma vitória é uma vitória.</h3>
              <p style={{ fontSize: 12 }}>
                Sem pontos por sets. Vence o desafio e conquista a posição do
                adversário.
              </p>
            </div>
            <div className="row between">
              <span className="muted">Jogadores ativos</span>
              <strong>
                {s.players.filter((p) => p.status === "active").length}
              </strong>
            </div>
            <div className="row between">
              <span className="muted">Desafios em curso</span>
              <strong>
                {
                  s.challenges.filter((c) => !terminal.has(effectiveStatus(c)))
                    .length
                }
              </strong>
            </div>
            <Link href="/campeoes" className="button wide">
              <Crown size={15} />
              Hall of Champions
              <ArrowRight size={14} />
            </Link>
          </div>
        </Section>
      </div>
    </>
  );
}
function Versus({ s, c }: { s: View; c: Challenge }) {
  return (
    <div className="versus">
      {[c.challengerId, "vs", c.defenderId].map((id) => {
        if (id === "vs")
          return (
            <span className="vs" key={id}>
              VS
            </span>
          );
        const p = s.players.find((p) => p._id === id);
        return (
          <div key={id}>
            <Avatar p={p} />
            <h3>{p?.name.split(" ")[0]}</h3>
            <small>
              #{p?.position} ·{" "}
              <span className="role-label">
                {id === c.challengerId ? (
                  <Sword size={12} />
                ) : (
                  <Shield size={12} />
                )}{" "}
                {id === c.challengerId ? "Ataque" : "Defesa"}
              </span>
            </small>
          </div>
        );
      })}
    </div>
  );
}
function RankingTable({
  s,
  run,
  busy,
  notify,
  refresh,
  divisionId,
  limit,
}: Actions & { divisionId: string; limit?: number }) {
  const p = s.players.find((p) => p._id === s.actor.playerId)!,
    [target, setTarget] = useState<Player | null>(null),
    router = useRouter();
  return (
    <>
      <div className="ranking-row ranking-header">
        <span>#</span>
        <span>Equipa / Jogador</span>
        <span>V / D</span>
        <span className="hide-mobile">Tendência</span>
        <span className="hide-mobile">Estado</span>
        <span className="right">Desafio</span>
      </div>
      {rankingEntries(s.players, divisionId)
        .slice(0, limit)
        .map((entry) => {
          const ownTeam = entry.members.some((member) => member._id === p._id);
          const options = entry.members.map((member) => ({
            member,
            reason: challengeReason(s, p, member),
          }));
          const targetMember = ownTeam
            ? undefined
            : options.find((option) => !option.reason)?.member;
          const messages = [
            ...new Set(options.map((option) => option.reason).filter(Boolean)),
          ];
          const teamMessage =
            ownTeam && entry.members.length > 1
              ? "A tua equipa"
              : messages.length === 1
                ? messages[0]
                : "Equipa indisponível para este desafio.";
          const activeTeam = entry.members.every(
            (member) => member.status === "active",
          );
          return (
            <div
              className={`ranking-row ${ownTeam ? "me" : ""} ${entry.members.length > 1 ? "ranking-team" : ""}`}
              key={entry.id}
              data-ranking-entry={entry.id}
            >
              <span
                className={`rank-number ${entry.position <= 3 ? "top" : ""}`}
                aria-label={`Posições: ${entry.members.map((member) => member.position).join(", ")}`}
              >
                {String(entry.position).padStart(2, "0")}
                {entry.members.length > 1 && (
                  <small className="muted">
                    / {String(entry.members[1].position).padStart(2, "0")}
                  </small>
                )}
              </span>
              <div className="ranking-member-list">
                {entry.members.length > 1 && (
                  <span className="ranking-team-label">Equipa</span>
                )}
                {entry.members.map((member) => (
                  <div className="row ranking-member" key={member._id}>
                    <Avatar p={member} />
                    <div className="player-name">
                      {member.name}{" "}
                      {member._id === p._id && (
                        <span className="gold">· Tu</span>
                      )}
                      <small>
                        Jogador #{member.number}
                        {entry.members.length === 1
                          ? member.partner
                            ? ` · Parceiro por confirmar: ${member.partner}`
                            : " · Sem parceiro atribuído"
                          : ""}
                      </small>
                    </div>
                  </div>
                ))}
                <WeeklyBadge
                  s={s}
                  player={entry.members[0]}
                  team={entry.members}
                />
              </div>
              <div className="ranking-member-list ranking-member-values">
                {entry.members.map((member) => (
                  <span
                    key={member._id}
                    title={`${member.name}: ${member.wins} vitórias / ${member.losses} derrotas`}
                  >
                    {member.wins}
                    <span className="muted"> / {member.losses}</span>
                  </span>
                ))}
              </div>
              <div className="hide-mobile ranking-member-list ranking-member-values">
                {entry.members.map((member) => (
                  <span key={member._id} title={member.name}>
                    <Trend p={member} />
                  </span>
                ))}
              </div>
              <div className="hide-mobile ranking-team-status">
                <span
                  className="dot"
                  style={{
                    background: activeTeam ? "var(--green)" : "var(--muted)",
                  }}
                />{" "}
                <small>
                  {entry.members.length > 1
                    ? activeTeam
                      ? "Ativa"
                      : "Indisponível"
                    : activeTeam
                      ? "Ativo"
                      : "Inativo"}
                </small>
              </div>
              <div
                className="right ranking-team-action"
                data-team-message={entry.id}
              >
                {targetMember ? (
                  <button
                    className="small"
                    style={{ color: "var(--gold)", borderColor: "#e7b85b33" }}
                    aria-label={
                      entry.members.length > 1
                        ? `Desafiar ${entry.members.map((member) => member.name).join(" + ")}`
                        : undefined
                    }
                    onClick={() => setTarget(targetMember)}
                  >
                    <Swords size={12} />
                    Desafiar
                  </button>
                ) : (
                  <small className="muted">{teamMessage}</small>
                )}
              </div>
            </div>
          );
        })}
      {target && (
        <ChallengeComposer
          s={s}
          run={run}
          busy={busy}
          notify={notify}
          refresh={refresh}
          target={target}
          close={() => setTarget(null)}
        />
      )}
    </>
  );
}
function Rankings(a: Actions) {
  const { s } = a,
    p = s.players.find((p) => p._id === s.actor.playerId)!,
    [division, setDivision] = useState(p.divisionId);
  return (
    <>
      <Heading
        eyebrow="CONQUISTA O TEU LUGAR"
        title="Ranking da liga"
        description="Três divisões. Um objetivo: chegar ao topo."
      />
      <Section
        title="Classificação"
        right={
          <span className="badge">
            {s.settings[0].rankingModel === "swap"
              ? "Troca de posições"
              : "Subida com deslocação"}
          </span>
        }
      >
        <div className="toolbar">
          <div className="tabs">
            {s.divisions.map((d) => (
              <button
                key={d._id}
                className={division === d._id ? "active" : ""}
                onClick={() => setDivision(d._id)}
              >
                <Medal size={13} />
                {d.name.toUpperCase()}
              </button>
            ))}
          </div>
          <small>
            Podes desafiar até {s.settings[0].maxPositionsAbove} posições acima.
          </small>
        </div>
        <RankingTable {...a} divisionId={division} />
      </Section>
    </>
  );
}
function ChallengeCard({ s, c }: { s: View; c: Challenge }) {
  const name = (id: string) =>
    terminal.has(effectiveStatus(c))
      ? (s.players.find((player) => player._id === id)?.name ?? "Jogador")
      : teamName(s.players, id) || "Jogador";
  const when =
    c.status === "schedule_pending" ? c.scheduleProposal?.start : c.scheduledAt;
  return (
    <Link href={"/desafios/" + c._id} className="challenge-card">
      <div className="row between">
        <small>
          #{String(c.number).padStart(3, "0")}{" "}
          {c.titleFight ? "· TITLE FIGHT" : ""}
        </small>
        <Status c={c} />
      </div>
      <div className="row wrap" style={{ marginTop: 12 }}>
        <span className="badge gold">
          <Sword size={12} />
          Ataque · {name(c.challengerId)}
        </span>
        <span className="badge">
          <Shield size={12} />
          Defesa · {name(c.defenderId)}
        </span>
      </div>
      <h3>
        {name(c.challengerId)} <span className="gold">vs</span>{" "}
        {name(c.defenderId)}
      </h3>
      <div className="row between wrap">
        <DivisionBadge s={s} id={c.divisionId} />
        <small>
          <CalendarDays size={11} />{" "}
          {when
            ? `${fmtDate(when)} · ${fmtTime(when)}`
            : `Até ${fmtDate(c.playBy)}`}
        </small>
      </div>
    </Link>
  );
}
function Challenges(a: Actions) {
  const { s } = a,
    [filter, setFilter] = useState(s.actor.role === "admin" ? "all" : "active"),
    [scope, setScope] = useState(s.actor.role === "admin" ? "league" : "mine"),
    [target, setTarget] = useState<Player | null>(null),
    [assign, setAssign] = useState(false),
    [division, setDivision] = useState("all"),
    [state, setState] = useState("all");
  const admin = s.actor.role === "admin",
    p = s.players.find((p) => p._id === s.actor.playerId)!;
  const pool = s.challenges.filter(
    (c) => (admin && scope === "league") || involves(c, p._id),
  );
  const list = pool
    .filter(
      (c) =>
        (division === "all" || c.divisionId === division) &&
        (state === "all" || effectiveStatus(c) === state) &&
        (filter === "all" ||
          (filter === "received" &&
            c.defenderId === p._id &&
            !terminal.has(effectiveStatus(c))) ||
          (filter === "sent" &&
            c.challengerId === p._id &&
            !terminal.has(effectiveStatus(c))) ||
          (filter === "active" && !terminal.has(effectiveStatus(c))) ||
          (filter === "completed" && terminal.has(effectiveStatus(c)))),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const eligible = s.players.filter((x) => !challengeReason(s, p, x));
  const eligibleTeams = rankingEntries(s.players, p.divisionId)
    .map((entry) => ({
      ...entry,
      target: entry.members.find((member) =>
        eligible.some((player) => player._id === member._id),
      ),
    }))
    .filter((entry) => entry.target);
  const active = activeChallenges(s, p._id, Date.now());
  const blockedReason =
    s.settings[0].weeklyCompetition && !weeklyRole(s, p._id)
      ? "A aguardar a publicação do teu papel semanal pelo administrador."
      : s.settings[0].weeklyCompetition && weeklyRole(s, p._id) === "defense"
        ? "Esta semana estás em defesa. Consulta os desafios recebidos."
        : p.status !== "active"
          ? "A tua conta de jogador não está ativa."
          : active.length >= s.settings[0].maxActiveChallenges
            ? `Já tens ${active.length} desafios ativos. O limite é ${s.settings[0].maxActiveChallenges}. Continua um dos desafios abaixo ou pede ao administrador para resolver um pendente.`
            : p.position === 1
              ? "Estás em primeiro lugar: não há jogadores acima de ti para desafiar. Podes receber desafios."
              : eligible.length === 0
                ? "Os adversários dentro do teu alcance já estão ocupados ou têm um desafio contigo. Consulta os teus desafios em curso."
                : "";
  return (
    <>
      <Heading
        eyebrow="CENTRAL DE DESAFIOS"
        title="Ataque e defesa"
        description="Recebe desafios, escolhe adversários e gere os teus jogos num só lugar."
        right={
          admin && s.settings[0].weeklyCompetition ? (
            <a className="button primary" href="#weekly-role-assignment">
              <Sword size={15} />
              <Shield size={15} />
              Definir papéis da semana
            </a>
          ) : admin ? (
            <button className="primary" onClick={() => setAssign(true)}>
              <Swords size={15} />
              Atribuir ataque / defesa
            </button>
          ) : (
            <a
              className="button primary"
              href={
                s.settings[0].weeklyCompetition
                  ? "#weekly-role-assignment"
                  : "#fazer-desafio"
              }
            >
              <Plus size={15} />
              Novo desafio
            </a>
          )
        }
      />
      <WeeklyRoles s={s} run={a.run} busy={a.busy} onChallenge={setTarget} />
      {admin && !s.settings[0].weeklyCompetition ? (
        <div className="inset space-top" style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12 }}>
            Para criar um confronto entre quaisquer jogadores, usa{" "}
            <strong className="gold">Atribuir ataque / defesa</strong>. Para
            marcar um desafio existente, abre-o e entra no{" "}
            <strong className="gold">Calendário do desafio</strong>.
          </p>
        </div>
      ) : (
        blockedReason && (
          <div
            className="inset stack"
            role="status"
            style={{ marginBottom: 20 }}
          >
            <p>{blockedReason}</p>
            <div className="row wrap">
              {active.map((c) => (
                <Link
                  className="button small"
                  key={c._id}
                  href={"/desafios/" + c._id}
                >
                  Continuar desafio #{c.number} ·{" "}
                  {statusLabels[effectiveStatus(c)]}
                  <ArrowRight size={12} />
                </Link>
              ))}
            </div>
          </div>
        )
      )}
      {admin && (
        <div className="tabs toolbar">
          <button
            className={scope === "mine" ? "active" : ""}
            onClick={() => {
              setScope("mine");
              setFilter("received");
            }}
          >
            Os meus desafios
          </button>
          <button
            className={scope === "league" ? "active" : ""}
            onClick={() => {
              setScope("league");
              setFilter("all");
            }}
          >
            Gestão de toda a liga
          </button>
        </div>
      )}
      <div className="stats-grid challenge-summary">
        {[
          {
            label: "A RECEBER",
            icon: Shield,
            count: pool.filter(
              (c) =>
                c.defenderId === p._id && !terminal.has(effectiveStatus(c)),
            ).length,
            filter: "received",
          },
          {
            label: "EM ATAQUE",
            icon: Sword,
            count: pool.filter(
              (c) =>
                c.challengerId === p._id && !terminal.has(effectiveStatus(c)),
            ).length,
            filter: "sent",
          },
          {
            label: "JOGOS MARCADOS",
            icon: CalendarDays,
            count: pool.filter((c) =>
              ["scheduled", "live"].includes(effectiveStatus(c)),
            ).length,
            filter: "active",
          },
          {
            label: "POR CONFIRMAR",
            icon: Trophy,
            count: pool.filter((c) => c.status === "result_pending").length,
            filter: "active",
          },
        ].map((x) => (
          <button
            className="stat-card"
            key={x.label}
            onClick={() => {
              setFilter(x.filter);
              setState(
                x.label === "JOGOS MARCADOS"
                  ? "scheduled"
                  : x.label === "POR CONFIRMAR"
                    ? "result_pending"
                    : "all",
              );
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div className="eyebrow muted">{x.label}</div>
              <div className="value">{x.count}</div>
            </div>
            <x.icon size={22} className="gold" />
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="tabs">
          {[
            ...(scope === "mine"
              ? [
                  ["received", "Recebidos"],
                  ["sent", "Enviados"],
                ]
              : []),
            ["active", "Em curso"],
            ["completed", "Histórico"],
            ["all", "Todos"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => {
                setFilter(v);
                setState("all");
              }}
            >
              {v === "received" ? (
                <Shield size={13} />
              ) : v === "sent" ? (
                <Sword size={13} />
              ) : null}
              {l}
            </button>
          ))}
        </div>
        <div className="row">
          <select
            aria-label="Divisão dos desafios"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="all">Todas as divisões</option>
            {s.divisions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Estado dos desafios"
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="all">Todos os estados</option>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      {list.length ? (
        <div className="challenge-grid">
          {list.map((c) => (
            <ChallengeCard key={c._id} s={s} c={c} />
          ))}
        </div>
      ) : (
        <Section title="Gestão dos teus desafios">
          <Empty text="Não existem desafios nesta lista. Consulta os enviados ou escolhe um novo adversário abaixo." />
        </Section>
      )}
      {scope === "mine" && !s.settings[0].weeklyCompetition && (
        <div id="fazer-desafio" className="space-top">
          <Section
            title="Fazer um desafio"
            right={<Sword size={19} className="gold" />}
          >
            <p style={{ fontSize: 12, marginBottom: 18 }}>
              Escolhe um adversário elegível e propõe logo três ou quatro opções
              de calendário.
            </p>
            {eligible.length ? (
              <div className="challenge-grid">
                {eligibleTeams.map((entry) => (
                  <div className="inset row between wrap" key={entry.id}>
                    <div>
                      <strong>
                        {entry.members.map((member) => member.name).join(" + ")}
                      </strong>
                      <small style={{ display: "block" }}>
                        {entry.members.length > 1
                          ? "Equipa"
                          : "Jogador sem parceiro"}{" "}
                        ·{" "}
                        {
                          s.divisions.find(
                            (category) =>
                              category._id === entry.members[0].divisionId,
                          )?.name
                        }
                      </small>
                    </div>
                    <button
                      className="small"
                      onClick={() => entry.target && setTarget(entry.target)}
                    >
                      <Sword size={13} />
                      Desafiar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                text={
                  blockedReason ||
                  "Não existem adversários elegíveis neste momento."
                }
              />
            )}
          </Section>
        </div>
      )}
      {target && (
        <ChallengeComposer
          {...a}
          target={target}
          close={() => setTarget(null)}
        />
      )}
      {assign && <AssignmentDialog {...a} close={() => setAssign(false)} />}
    </>
  );
}

function ChallengeDetail(a: Actions & { id: string }) {
  const { s, run, busy, id } = a,
    c = s.challenges.find((c) => c._id === id),
    [refuse, setRefuse] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const lastMessage = s.messages
    .filter((m) => m.challengeId === id)
    .at(-1)?._id;
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [lastMessage]);
  if (!c) return <Empty text="Desafio não encontrado." />;
  const mine = involves(c, s.actor.playerId),
    admin = s.actor.role === "admin",
    status = effectiveStatus(c),
    opponentId =
      c.challengerId === s.actor.playerId ? c.defenderId : c.challengerId;
  const mySlots = s.slots.filter(
      (x) => x.challengeId === id && x.playerId === s.actor.playerId,
    ),
    theirSlots = s.slots.filter(
      (x) => x.challengeId === id && x.playerId === opponentId,
    );
  const compatible = compatibleStarts(
    s.slots.filter(
      (x) => x.challengeId === id && x.playerId === c.challengerId,
    ),
    s.slots.filter((x) => x.challengeId === id && x.playerId === c.defenderId),
    c.durationMinutes,
    s.settings[0].slotStepMinutes,
    Date.now(),
    Date.parse(c.playBy),
  );
  const chat = s.messages
    .filter((x) => x.challengeId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const name = (id: string) =>
    s.players.find((p) => p._id === id)?.name ?? "Jogador";
  return (
    <>
      <Link href="/desafios" className="link row" style={{ marginBottom: 20 }}>
        <ArrowLeft size={14} />
        Voltar aos desafios
      </Link>
      <Heading
        eyebrow={c.titleFight ? "COMBATE PELO CINTURÃO" : "A TUA ARENA"}
        title={`Desafio #${String(c.number).padStart(3, "0")}`}
        description={`${name(c.challengerId)} vs ${name(c.defenderId)}`}
        right={<Status c={c} />}
      />
      <div className="detail-grid">
        <div className="stack">
          <IncomingTimeOffers {...a} c={c} />
          <TimeConfirmation {...a} c={c} />

          <Section
            title={c.titleFight ? "Title Fight" : "O confronto"}
            right={<DivisionBadge s={s} id={c.divisionId} />}
          >
            <Status c={c} />
            <Versus s={s} c={c} />
            <div className="inset row between wrap">
              <span>
                <CalendarDays size={14} />{" "}
                {c.scheduledAt
                  ? `${fmtDate(c.scheduledAt)} · ${fmtTime(c.scheduledAt)}`
                  : "Horário por definir"}
              </span>
              <span className="gold">
                {s.courts.find((x) => x._id === c.courtId)?.name ??
                  "Campo por definir"}
              </span>
            </div>
            {c.refusalReason && (
              <p className="space-top">
                Motivo da recusa: {c.refusalReason} {c.refusalNote}
              </p>
            )}
            {c.disputeNote && (
              <p className="error space-top">Disputa: {c.disputeNote}</p>
            )}
            {c.status === "completed" && (
              <div className="success space-top">
                <Trophy size={17} /> Vitória de{" "}
                <strong>{name(c.winnerId!)}</strong>
                {c.score && <div>{c.score}</div>}
              </div>
            )}
            {status === "pending" && c.defenderId === s.actor.playerId && (
              <div className="stack space-top">
                <p>
                  Foste desafiado. Aceita para encontrar um horário em comum.
                </p>
                <div className="row">
                  <button
                    className="primary flex-1"
                    disabled={busy}
                    onClick={() =>
                      run(
                        {
                          type: "challenge.respond",
                          challengeId: id,
                          accept: true,
                        },
                        "Desafio aceite.",
                      )
                    }
                  >
                    <Check size={15} />
                    Aceitar
                  </button>
                  <button
                    disabled={!canRefuse(s, c) || busy}
                    onClick={() => setRefuse(true)}
                  >
                    Recusar
                  </button>
                </div>
                {!canRefuse(s, c) && (
                  <small>
                    A recusa só é permitida quando já tens outro desafio aceite
                    ou ativo.
                  </small>
                )}
              </div>
            )}
            {!terminal.has(c.status) &&
              (admin ||
                (mine &&
                  s.settings[0].cancellationRule === "participants")) && (
                <button
                  className="ghost small space-top"
                  onClick={() => {
                    const note = prompt("Motivo do cancelamento:");
                    if (note)
                      void run(
                        { type: "challenge.cancel", challengeId: id, note },
                        "Desafio cancelado.",
                      );
                  }}
                >
                  Cancelar desafio
                </button>
              )}
          </Section>
          {["scheduled", "result_pending", "disputed", "completed"].includes(
            c.status,
          ) && (
            <Section title="Resultado do jogo">
              {c.status === "completed" ? (
                <div className="stack">
                  <strong className="gold">
                    Vitória de {name(c.winnerId!)}
                  </strong>
                  <p>{c.score || "Sets não indicados"}</p>
                  <small>
                    Resultado registado. Estatísticas e ranking atualizados.
                  </small>
                </div>
              ) : (
                <p>
                  O resultado é registado pelo administrador após o jogo. O
                  sistema atualiza automaticamente as estatísticas e o ranking.
                </p>
              )}
              {admin && <AdminResultButton {...a} c={c} />}
            </Section>
          )}
          <ChallengeCalendar {...a} c={c} />
          {mine && status === "accepted" && (
            <Section
              title="Vamos encontrar um horário"
              right={<Clock3 size={18} className="gold" />}
            >
              <div className="stack">
                <p style={{ fontSize: 12 }}>
                  Cada jogador propõe uma janela. O jogo dura{" "}
                  {c.durationMinutes} minutos e tem de terminar até{" "}
                  {fmtDate(c.playBy)}.
                </p>
                <div>
                  <h3 style={{ marginBottom: 12 }}>A tua disponibilidade</h3>
                  {mySlots.map((x) => (
                    <div key={x._id} className="slot">
                      <span>
                        {fmtDate(x.start)} · {fmtTime(x.start)}–{fmtTime(x.end)}
                      </span>
                      <button
                        className="icon-button"
                        aria-label="Remover horário"
                        onClick={() =>
                          run(
                            { type: "slot.delete", slotId: x._id },
                            "Horário removido.",
                          )
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      data = new FormData(form);
                    const result = await run(
                      {
                        type: "slot.add",
                        challengeId: id,
                        start: new Date(
                          String(data.get("start")),
                        ).toISOString(),
                        end: new Date(String(data.get("end"))).toISOString(),
                      },
                      "Disponibilidade adicionada.",
                    );
                    if (result) form.reset();
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Início
                      <input name="start" type="datetime-local" required />
                    </label>
                    <label>
                      Fim
                      <input name="end" type="datetime-local" required />
                    </label>
                  </div>
                  <button disabled={busy}>
                    <Plus size={14} />
                    Adicionar horário
                  </button>
                </form>
                <WeeklySuggestions {...a} c={c} />
                <div>
                  <h3 style={{ marginBottom: 12 }}>
                    Disponibilidade do adversário
                  </h3>
                  {theirSlots.length ? (
                    theirSlots.map((x) => (
                      <div className="slot" key={x._id}>
                        {fmtDate(x.start)} · {fmtTime(x.start)}–{fmtTime(x.end)}
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 12 }}>
                      O adversário ainda não propôs horários.
                    </p>
                  )}
                </div>
                <div className="inset stack">
                  <h3 className="gold">Horários compatíveis</h3>
                  {compatible.length ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        await run(
                          {
                            type: "match.schedule",
                            challengeId: id,
                            start: data.get("start"),
                            courtId: data.get("courtId") || undefined,
                          },
                          "Horário proposto. Falta a confirmação do adversário e do clube.",
                        );
                      }}
                    >
                      <label>
                        Horário
                        <select name="start">
                          {compatible.map((t) => (
                            <option value={t} key={t}>
                              {fmtDate(t)} · {fmtTime(t)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Campo
                        <select name="courtId">
                          <option value="">Definir campo mais tarde</option>
                          {s.courts
                            .filter((x) => x.active)
                            .map((x) => (
                              <option key={x._id} value={x._id}>
                                {x.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <button disabled={busy} className="primary">
                        <Check size={14} />
                        Propor este horário
                      </button>
                    </form>
                  ) : (
                    <p style={{ fontSize: 12 }}>
                      Quando os dois propuserem janelas em comum, as opções
                      aparecem aqui.
                    </p>
                  )}
                </div>
              </div>
            </Section>
          )}
          {(mine || admin) && (
            <Section
              title="Chat do desafio"
              right={
                <span
                  className={`badge ${a.chatConnection === "live" ? "positive" : "muted"}`}
                  role="status"
                >
                  <span
                    className="dot"
                    style={{ background: "currentColor" }}
                  />
                  {a.chatConnection === "live"
                    ? "Em direto"
                    : a.chatConnection === "reconnecting"
                      ? "A reconectar…"
                      : "A ligar…"}
                </span>
              }
            >
              <div className="stack">
                <div ref={chatRef} className="chat-box" aria-live="polite">
                  {chat.length ? (
                    chat.map((m) => (
                      <div
                        className={`message ${m.playerId === s.actor.playerId ? "mine" : ""}`}
                        key={m._id}
                      >
                        <strong>{name(m.playerId)}</strong>
                        {m.text}
                        <div>
                          <small>
                            {fmtDate(m.createdAt)} · {fmtTime(m.createdAt)}
                          </small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 12 }}>
                      Combina os detalhes do jogo com o teu adversário.
                    </p>
                  )}
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      text = new FormData(form).get("text");
                    if (
                      await run(
                        { type: "message.send", challengeId: id, text },
                        "",
                      )
                    )
                      form.reset();
                  }}
                >
                  <div className="row">
                    <input
                      name="text"
                      placeholder="Escreve uma mensagem…"
                      aria-label="Mensagem"
                      required
                      maxLength={2000}
                    />
                    <button
                      disabled={busy}
                      aria-label="Enviar mensagem"
                      className="primary"
                    >
                      <ArrowRight size={17} />
                    </button>
                  </div>
                </form>
              </div>
            </Section>
          )}
        </div>
        <div className="stack" style={{ alignContent: "start" }}>
          <Section title="Prazos do desafio">
            <div className="stack">
              {[
                ["Criado em", c.createdAt],
                ["Responder até", c.respondBy],
                ["Marcar até", c.scheduleBy],
                ["Jogar até", c.playBy],
              ].map(([label, value]) => (
                <div className="row between" key={label}>
                  <small>{label}</small>
                  <strong style={{ fontSize: 11 }}>{fmtDate(value)}</strong>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Como funciona">
            <div className="stack">
              {[
                "Aceita o desafio",
                "Ambos propõem disponibilidade",
                "Atacante e defensor aceitam o horário",
                "Clube confirma o campo",
                "Joga e comunica o resultado ao clube",
                "O administrador regista o vencedor",
                "O ranking atualiza automaticamente",
              ].map((t, i) => (
                <div className="row" key={t}>
                  <span className="badge gold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <small>{t}</small>
                </div>
              ))}
            </div>
          </Section>
          {admin && <AdminChallenge {...a} c={c} />}
        </div>
      </div>
      {refuse && (
        <Modal title="Recusar desafio" close={() => setRefuse(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = Object.fromEntries(new FormData(e.currentTarget));
              if (
                await run(
                  {
                    type: "challenge.respond",
                    challengeId: id,
                    accept: false,
                    ...data,
                  },
                  "Recusa registada e administrador notificado.",
                )
              )
                setRefuse(false);
            }}
          >
            <label>
              Motivo
              <select name="reason">
                {[
                  "Outro desafio ativo",
                  "Lesão",
                  "Indisponibilidade",
                  "Viagem",
                  "Outro",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Explicação
              <textarea name="note" maxLength={2000} />
            </label>
            <button className="danger" disabled={busy}>
              Confirmar recusa
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function WeeklySuggestions({ s, run, c, busy }: Actions & { c: Challenge }) {
  const windows = s.availability.filter((x) => x.playerId === s.actor.playerId),
    suggestions: { start: string; end: string }[] = [];
  // datetime-local values are interpreted in the browser's local timezone. Show that timezone explicitly.
  for (let i = 1; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    for (const w of windows.filter((w) => w.weekday === d.getDay())) {
      const start = new Date(d),
        end = new Date(d);
      const [h, m] = w.start.split(":").map(Number),
        [eh, em] = w.end.split(":").map(Number);
      start.setHours(h, m, 0, 0);
      end.setHours(eh, em, 0, 0);
      if (
        end.getTime() <= Date.parse(c.playBy) &&
        !s.exceptions.some(
          (x) =>
            x.playerId === s.actor.playerId &&
            x.from <= end.toLocaleDateString("en-CA") &&
            x.to >= start.toLocaleDateString("en-CA"),
        )
      )
        suggestions.push({
          start: start.toISOString(),
          end: end.toISOString(),
        });
    }
  }
  return suggestions.length ? (
    <details>
      <summary className="link" style={{ cursor: "pointer" }}>
        Usar a disponibilidade semanal
      </summary>
      <small>
        Fuso do dispositivo: {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </small>
      <div className="compatible space-top">
        {suggestions.slice(0, 8).map((x) => (
          <button
            className="small"
            key={x.start}
            disabled={busy}
            onClick={() =>
              run(
                { type: "slot.add", challengeId: c._id, ...x },
                "Horário proposto.",
              )
            }
          >
            {fmtDate(x.start)} · {fmtTime(x.start)}
          </button>
        ))}
      </div>
    </details>
  ) : null;
}
function AdminChallenge(a: Actions & { c: Challenge }) {
  const { s, run, c, busy } = a;
  const [assign, setAssign] = useState(false);
  return (
    <>
      <Section title="Intervenção administrativa">
        <AdminMatchActions {...a} c={c} />
        {["pending", "accepted"].includes(c.status) && !c.titleFight && (
          <button className="wide space-top" onClick={() => setAssign(true)}>
            <Sword size={14} />
            <Shield size={14} />
            Atribuir ataque / defesa
          </button>
        )}
        <div className="stack">
          <p style={{ fontSize: 12 }}>
            Cada intervenção fica registada no histórico.
          </p>
          {c.status === "completed" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await run(
                  {
                    type: "admin.result.correct",
                    challengeId: c._id,
                    ...Object.fromEntries(new FormData(e.currentTarget)),
                  },
                  "Resultado corrigido. Revê o ranking e o cinturão, se necessário.",
                );
              }}
            >
              <label>
                Corrigir vencedor
                <select name="winnerId" defaultValue={c.winnerId}>
                  {[c.challengerId, c.defenderId].map((pid) => (
                    <option value={pid} key={pid}>
                      {s.players.find((p) => p._id === pid)?.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sets
                <input name="score" defaultValue={c.score} />
              </label>
              <label>
                Motivo da correção
                <textarea name="note" required minLength={3} />
              </label>
              <p style={{ fontSize: 11 }}>
                As estatísticas serão corrigidas. Para preservar as alterações
                de jogos posteriores, revê a posição em Jogadores e o campeão em
                Title Fight.
              </p>
              <button disabled={busy}>Guardar correção</button>
            </form>
          )}
          {c.status !== "completed" && (
            <>
              <label>
                Declarar vencedor
                <select id={"winner-" + c._id}>
                  <option value="">Escolher jogador</option>
                  {[c.challengerId, c.defenderId].map((pid) => (
                    <option value={pid} key={pid}>
                      {s.players.find((p) => p._id === pid)?.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || terminal.has(c.status)}
                className="primary"
                onClick={() => {
                  const winnerId = (
                    document.getElementById(
                      "winner-" + c._id,
                    ) as HTMLSelectElement
                  ).value;
                  if (
                    winnerId &&
                    confirm("Confirmar vencedor e atualizar ranking?")
                  )
                    void run(
                      {
                        type: "admin.resolve",
                        challengeId: c._id,
                        action: "winner",
                        winnerId,
                      },
                      "Resultado resolvido.",
                    );
                }}
              >
                Confirmar vencedor
              </button>
              <div className="row wrap">
                {[
                  ["extend", "Prolongar prazo"],
                  ["replay", "Repetir jogo"],
                  ["void", "Anular jogo"],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    className="small"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`${label}?`))
                        void run(
                          { type: "admin.resolve", challengeId: c._id, action },
                          "Desafio atualizado.",
                        );
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {!terminal.has(c.status) && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await run(
                  {
                    type: "admin.schedule",
                    challengeId: c._id,
                    start: new Date(String(f.get("start"))).toISOString(),
                    courtId: f.get("courtId"),
                    minutes: Number(f.get("minutes")),
                  },
                  "Jogo marcado pelo administrador.",
                );
              }}
            >
              <h3>Reserva manual</h3>
              <label>
                Data e hora
                <input type="datetime-local" name="start" required />
              </label>
              <label>
                Campo
                <select name="courtId">
                  {s.courts
                    .filter((c) => c.active)
                    .map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Duração · minutos
                <input
                  name="minutes"
                  type="number"
                  min={15}
                  max={240}
                  defaultValue={c.durationMinutes}
                />
              </label>
              <button disabled={busy}>Propor horário pelo clube</button>
            </form>
          )}
        </div>
      </Section>
      {assign && <AssignmentDialog {...a} close={() => setAssign(false)} />}
    </>
  );
}
function Games(a: Actions) {
  const { s } = a;
  const [all, setAll] = useState(s.actor.role === "admin");
  const [week, setWeek] = useState(clubWeek().start);
  const games = s.challenges
    .filter(
      (c) =>
        (c.scheduledAt || c.scheduleProposal) &&
        clubWeek(c.scheduleProposal?.start ?? c.scheduledAt ?? c.createdAt)
          .start === week &&
        (all || involves(c, s.actor.playerId)) &&
        !["cancelled", "refused", "expired"].includes(c.status),
    )
    .sort((a, b) =>
      (b.scheduleProposal?.start ?? b.scheduledAt ?? b.playBy).localeCompare(
        a.scheduleProposal?.start ?? a.scheduledAt ?? a.playBy,
      ),
    );
  return (
    <>
      <Heading
        eyebrow="DENTRO DO CAMPO"
        title="Agenda de jogos"
        description="Todos os detalhes para chegares preparado ao próximo jogo."
        right={
          <a className="button" href={`/api/calendar?week=${week}`}>
            <Download size={14} />
            Calendário
          </a>
        }
      />
      <Section title="Disponibilidade dos campos">
        <CourtAvailability />
      </Section>
      <WeekNavigation week={week} onChange={setWeek} />
      <div className="toolbar">
        <div className="tabs">
          <button
            className={!all ? "active" : ""}
            onClick={() => setAll(false)}
          >
            Meus jogos
          </button>
          <button className={all ? "active" : ""} onClick={() => setAll(true)}>
            Jogos da liga
          </button>
        </div>
      </div>
      {games.length ? (
        <div className="challenge-grid">
          {games.map((c) => (
            <div key={c._id}>
              <ChallengeCard s={s} c={c} />
              <AdminMatchActions {...a} c={c} />
              {s.actor.role === "admin" && <AdminResultButton {...a} c={c} />}
            </div>
          ))}
        </div>
      ) : (
        <Section title="Próximos jogos">
          <Empty text="Ainda não existem jogos marcados." />
        </Section>
      )}
    </>
  );
}
function Notifications({ s, run, busy }: Actions) {
  return (
    <>
      <Heading
        eyebrow="MANTÉM-TE NO JOGO"
        title="Notificações"
        description="Desafios, marcações e resultados. Tudo num só lugar."
        right={
          <button
            disabled={busy}
            onClick={() =>
              run({ type: "notifications.read" }, "Notificações lidas.")
            }
          >
            <Check size={14} />
            Marcar todas como lidas
          </button>
        }
      />
      {s.actor.role === "admin" && (
        <Section title="Entregas externas">
          <DeliveryStatus s={s} />
        </Section>
      )}
      <Section title="A tua atividade">
        {s.notifications.length ? (
          s.notifications
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((n) => (
              <div
                className={`notification ${!n.read ? "unread" : ""}`}
                key={n._id}
              >
                <Bell size={18} className={n.read ? "muted" : "gold"} />
                <div className="flex-1">
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <small>
                    {fmtDate(n.createdAt)} · {fmtTime(n.createdAt)}
                  </small>
                  {n.challengeId && (
                    <Link
                      className="link"
                      href={"/desafios/" + n.challengeId}
                      style={{ marginLeft: 12 }}
                      onClick={() => {
                        void run(
                          { type: "notifications.read", notificationId: n._id },
                          "",
                        );
                      }}
                    >
                      Ver desafio →
                    </Link>
                  )}
                </div>
                {!n.read && (
                  <button
                    className="icon-button"
                    aria-label="Marcar como lida"
                    onClick={() =>
                      run(
                        { type: "notifications.read", notificationId: n._id },
                        "",
                      )
                    }
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))
        ) : (
          <Empty text="Estás a par de tudo." />
        )}
      </Section>
    </>
  );
}

async function uploadPhoto(file: File) {
  const form = new FormData();
  form.set("photo", file);
  return (await request("/api/photos/upload", form)).url as string;
}
const weekdays = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
function Profile(a: Actions) {
  const { s, run, busy, notify } = a,
    p = s.players.find((p) => p._id === s.actor.playerId)!,
    [photo, setPhoto] = useState(p.photo),
    [windows, setWindows] = useState(
      s.availability
        .filter((w) => w.playerId === p._id)
        .map(({ weekday, start, end }) => ({ weekday, start, end })),
    );
  return (
    <>
      <Heading
        eyebrow="O TEU PERFIL"
        title="Pronto para competir"
        description="Mantém o perfil atualizado e facilita a marcação dos teus jogos."
      />
      <Link className="button" href="/ajuda">
        <BookOpen size={17} /> Como usar a app · Guia passo a passo
      </Link>
      <div className="detail-grid">
        <div className="stack">
          <Section
            title="Dados do jogador"
            right={<DivisionBadge s={s} id={p.divisionId} />}
          >
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await run(
                  {
                    type: "profile.save",
                    ...Object.fromEntries(new FormData(e.currentTarget)),
                    photo,
                  },
                  "Perfil atualizado.",
                );
              }}
            >
              <div className="row">
                <Avatar p={{ ...p, photo }} large />
                <label className="flex-1">
                  Fotografia · JPG, PNG ou WebP até 2 MB
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        try {
                          setPhoto(await uploadPhoto(file));
                        } catch (e) {
                          notify((e as Error).message, true);
                        }
                    }}
                  />
                </label>
              </div>
              <label>
                Nome
                <input
                  name="name"
                  defaultValue={p.name}
                  required
                  minLength={2}
                />
              </label>
              <div className="form-grid">
                <label>
                  Email
                  <input value={p.email} readOnly />
                </label>
                <label>
                  Telefone
                  <input
                    key={p.phone}
                    name="phone"
                    defaultValue={p.phone}
                    maxLength={40}
                  />
                </label>
                <label>
                  Parceiro atual
                  <input name="partner" value={p.partner} readOnly />
                </label>
                <label>
                  Número de jogador
                  <input value={"#" + p.number} readOnly />
                </label>
              </div>
              <button className="primary" disabled={busy}>
                Guardar perfil
              </button>
            </form>
          </Section>
          <Section title="App dos jogadores">
            <MobileApp />
          </Section>
          <Section title="Notificações no telemóvel">
            <PushNotificationSettings />
          </Section>
          <Section title="Email e WhatsApp">
            <NotificationSettings
              key={JSON.stringify([p.phone, p.notificationPreferences])}
              player={p}
              busy={busy}
              save={(input) => run(input, "Preferências de alertas guardadas.")}
            />
          </Section>
          <Section title="Disponibilidade semanal">
            <div className="stack">
              <p style={{ fontSize: 12 }}>
                Estes horários ajudam a propor janelas para os desafios. Usa o
                fuso horário do teu dispositivo.
              </p>
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <div key={day} className="stack gap-sm">
                  <div className="row between">
                    <strong style={{ fontSize: 12 }}>{weekdays[day]}</strong>
                    <button
                      className="small"
                      onClick={() =>
                        setWindows([
                          ...windows,
                          { weekday: day, start: "18:00", end: "22:00" },
                        ])
                      }
                    >
                      <Plus size={12} />
                      Janela
                    </button>
                  </div>
                  {windows.map((w, i) =>
                    w.weekday === day ? (
                      <div className="availability-row" key={i}>
                        <small>Disponível</small>
                        <input
                          aria-label={`Início ${weekdays[day]}`}
                          type="time"
                          value={w.start}
                          onChange={(e) =>
                            setWindows(
                              windows.map((x, j) =>
                                i === j ? { ...x, start: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <input
                          aria-label={`Fim ${weekdays[day]}`}
                          type="time"
                          value={w.end}
                          onChange={(e) =>
                            setWindows(
                              windows.map((x, j) =>
                                i === j ? { ...x, end: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <button
                          className="icon-button"
                          aria-label="Remover janela"
                          onClick={() =>
                            setWindows(windows.filter((_, j) => i !== j))
                          }
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : null,
                  )}
                  {!windows.some((w) => w.weekday === day) && (
                    <small>Indisponível</small>
                  )}
                </div>
              ))}
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(
                    { type: "availability.save", windows },
                    "Disponibilidade guardada.",
                  )
                }
              >
                Guardar disponibilidade
              </button>
            </div>
          </Section>
          <Section title="Férias e indisponibilidade">
            <div className="stack">
              {s.exceptions
                .filter((x) => x.playerId === p._id)
                .map((x) => (
                  <div className="slot" key={x._id}>
                    <div>
                      {fmtDate(x.from)} → {fmtDate(x.to)}
                      <p>
                        {x.vacation ? "Férias · ranking congelado · " : ""}
                        {x.note}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Remover exceção"
                      onClick={() =>
                        run(
                          { type: "exception.delete", exceptionId: x._id },
                          "Exceção removida.",
                        )
                      }
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  if (
                    await run(
                      {
                        type: "exception.add",
                        ...Object.fromEntries(new FormData(form)),
                        vacation: new FormData(form).get("vacation") === "on",
                      },
                      "Exceção adicionada.",
                    )
                  )
                    form.reset();
                }}
              >
                <div className="form-grid">
                  <label>
                    De
                    <input type="date" name="from" required />
                  </label>
                  <label>
                    Até
                    <input type="date" name="to" required />
                  </label>
                </div>
                <label className="check">
                  <input name="vacation" type="checkbox" />
                  Férias · congelar a posição no ranking
                </label>
                <small>
                  Em férias podes receber desafios. Os jogos ficam para depois
                  do regresso e a tua posição mantém-se congelada durante a
                  ausência.
                </small>
                <label>
                  Motivo
                  <input
                    name="note"
                    placeholder="Férias, viagem…"
                    maxLength={2000}
                  />
                </label>
                <button disabled={busy}>
                  <Plus size={14} />
                  Adicionar exceção
                </button>
              </form>
            </div>
          </Section>
        </div>
        <div className="stack" style={{ alignContent: "start" }}>
          <PlayerHistory s={s} p={p} />
          <Section title="A tua conta">
            <div className="stack">
              <p style={{ fontSize: 12 }}>
                Para alterar o email ou recuperar o acesso, contacta o
                administrador do clube.
              </p>
              <button
                className="danger"
                onClick={async () => {
                  await request("/api/auth/logout", {});
                  location.href = "/auth";
                }}
              >
                <LogOut size={14} />
                Terminar sessão
              </button>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
function PlayerHistory({ s, p }: { s: View; p: Player }) {
  const history = s.history
      .filter((x) => x.playerId === p._id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    challenges = s.challenges
      .filter((c) => involves(c, p._id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Section
      title="Histórico do jogador"
      right={<History size={18} className="gold" />}
    >
      <div className="stack">
        <div className="row between">
          <small>Vitórias / Derrotas</small>
          <strong>
            {p.wins} / {p.losses}
          </strong>
        </div>
        <div className="row between">
          <small>Desafios ganhos / perdidos</small>
          <strong>
            {p.challengesWon} / {p.challengesLost}
          </strong>
        </div>
        <div className="divider" />
        <h3>Evolução no ranking</h3>
        {history.length ? (
          history.map((h) => (
            <div className="inset" key={h._id}>
              <div className="row between">
                <strong className="gold">
                  #{h.oldPosition} → #{h.newPosition}
                </strong>
                <small>{fmtDate(h.createdAt)}</small>
              </div>
              <small>
                {h.reason} ·{" "}
                {s.divisions.find((d) => d._id === h.divisionId)?.name}
              </small>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12 }}>
            Ainda não existem alterações de posição.
          </p>
        )}
        <h3>Jogos e desafios</h3>
        {challenges.length ? (
          challenges.map((c) => (
            <Link href={"/desafios/" + c._id} className="inset" key={c._id}>
              <div className="row between">
                <strong style={{ fontSize: 12 }}>Desafio #{c.number}</strong>
                <Status c={c} />
              </div>
              <small>
                {
                  s.players.find(
                    (x) =>
                      x._id ===
                      (c.challengerId === p._id
                        ? c.defenderId
                        : c.challengerId),
                  )?.name
                }{" "}
                · {fmtDate(c.createdAt)}
              </small>
            </Link>
          ))
        ) : (
          <p style={{ fontSize: 12 }}>Ainda não existem desafios.</p>
        )}
      </div>
    </Section>
  );
}

function Admin(a: Actions) {
  const { s } = a,
    [tab, setTab] = useState("summary");
  return (
    <>
      <Heading
        eyebrow="GESTÃO DA LIGA"
        title="Painel do administrador"
        description="Tu defines as regras. Os jogadores fazem o jogo."
      />
      <Link className="button" href="/ajuda/admin">
        <BookOpen size={17} /> Manual do administrador · Guia passo a passo
      </Link>
      <div className="tabs toolbar">
        {[
          ["summary", "Resumo"],
          ["players", "Jogadores"],
          ["registration", "Inscrições"],
          ["rankings", "Rankings"],
          ["weekly", "Papéis semanais"],
          ["partners", "Parceiros"],
          ["challenges", "Desafios"],
          ["games", "Jogos"],
          ["results", "Resultados"],
          ["posters", "Cartazes da jornada"],
          ["rules", "Regras"],
          ["courts", "Campos"],
          ["audit", "Auditoria"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={tab === v ? "active" : ""}
            onClick={() => setTab(v)}
          >
            {l}
          </button>
        ))}
        <Link href="/title-fight">Title Fights ↗</Link>
        <Link href="/epocas">Épocas ↗</Link>
      </div>
      {tab === "summary" ? (
        <>
          <div className="stats-grid">
            {[
              {
                label: "JOGADORES ATIVOS",
                v: s.players.filter((p) => p.status === "active").length,
              },
              {
                label: "DESAFIOS ATIVOS",
                v: s.challenges.filter((c) => !terminal.has(effectiveStatus(c)))
                  .length,
              },
              {
                label: "JOGOS MARCADOS",
                v: s.challenges.filter((c) => c.status === "scheduled").length,
              },
              {
                label: "CONFIRMAÇÕES DO CLUBE",
                v: s.challenges.filter(
                  (c) =>
                    c.status === "schedule_pending" &&
                    c.scheduleProposal?.challengerConfirmed &&
                    c.scheduleProposal?.defenderConfirmed,
                ).length,
              },
              {
                label: "RESULTADOS PENDENTES",
                v: s.challenges.filter((c) => c.status === "result_pending")
                  .length,
              },
              {
                label: "EM DISPUTA",
                v: s.challenges.filter((c) => c.status === "disputed").length,
              },
              {
                label: "EXPIRADOS",
                v: s.challenges.filter((c) => effectiveStatus(c) === "expired")
                  .length,
              },
              {
                label: "A MARCAR",
                v: s.challenges.filter((c) => effectiveStatus(c) === "accepted")
                  .length,
              },
              {
                label: "A AGUARDAR RESPOSTA",
                v: s.challenges.filter((c) => effectiveStatus(c) === "pending")
                  .length,
              },
            ].map((x) => (
              <div className="stat-card" key={x.label}>
                <div>
                  <div className="eyebrow muted">{x.label}</div>
                  <div className="value">{x.v}</div>
                </div>
              </div>
            ))}
          </div>
          <Section title="Requer a tua atenção">
            <div className="challenge-grid">
              {s.challenges
                .filter((c) =>
                  [
                    "disputed",
                    "result_pending",
                    "expired",
                    "schedule_pending",
                  ].includes(effectiveStatus(c)),
                )
                .map((c) => (
                  <ChallengeCard s={s} c={c} key={c._id} />
                ))}
            </div>
            {!s.challenges.some((c) =>
              [
                "disputed",
                "result_pending",
                "expired",
                "schedule_pending",
              ].includes(effectiveStatus(c)),
            ) && (
              <Empty text="Tudo a correr bem. A liga está nas mãos dos jogadores." />
            )}
          </Section>
        </>
      ) : tab === "partners" ? (
        <AdminPartners {...a} />
      ) : tab === "weekly" ? (
        <WeeklyRoles s={s} run={a.run} busy={a.busy} />
      ) : tab === "registration" ? (
        <AdminRegistration {...a} />
      ) : tab === "players" ? (
        <AdminPlayers {...a} />
      ) : tab === "rankings" ? (
        <AdminTeamRanking s={s} run={a.run} busy={a.busy} />
      ) : tab === "challenges" ? (
        <AdminChallenges {...a} />
      ) : tab === "games" ? (
        <Games {...a} />
      ) : tab === "results" ? (
        <AdminResults {...a} />
      ) : tab === "posters" ? (
        <MatchdayGenerator s={s} />
      ) : tab === "rules" ? (
        <Rules {...a} />
      ) : tab === "courts" ? (
        <Courts {...a} />
      ) : (
        <Section title="Registo de atividade">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ação</th>
                  <th>Autor</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {s.audit
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((x) => (
                    <tr key={x._id}>
                      <td>
                        {fmtDate(x.createdAt)} {fmtTime(x.createdAt)}
                      </td>
                      <td>{x.action}</td>
                      <td>
                        {s.players.find((p) => p.userId === x.userId)?.name ??
                          x.userId.slice(0, 12)}
                      </td>
                      <td
                        style={{
                          whiteSpace: "normal",
                          minWidth: 250,
                          maxWidth: 450,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {x.details}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!s.audit.length && (
            <Empty text="As ações administrativas vão aparecer aqui." />
          )}
        </Section>
      )}
    </>
  );
}
function AdminMatchActions(a: Actions & { c: Challenge }) {
  const { s, c, run, busy, notify } = a;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  if (s.actor.role !== "admin") return null;
  const editable = ["scheduled", "schedule_pending", "completed"].includes(
    c.status,
  );
  const start = c.scheduleProposal?.start ?? c.scheduledAt;
  const localStart = start
    ? new Date(Date.parse(start) - new Date(start).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
  return (
    <div className="stack space-top">
      {editable && (
        <button onClick={() => setEditing(true)}>Editar jogo</button>
      )}
      <button
        className="danger"
        disabled={busy}
        onClick={() => setDeleting(true)}
      >
        Eliminar jogo
      </button>
      {deleting && (
        <Modal
          title={`Eliminar jogo #${c.number}`}
          close={() => setDeleting(false)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const result = await run(
                {
                  type: "admin.match.delete",
                  challengeId: c._id,
                  note: data.get("note"),
                },
                "",
              );
              if (!result) return;
              setDeleting(false);
              notify(
                result.rankingReview || result.championReview
                  ? "Jogo eliminado e estatísticas corrigidas. Revê o ranking e o campeão: a reposição automática não foi possível."
                  : "Jogo e dados associados eliminados. Estatísticas e classificação atualizadas.",
              );
              if (location.pathname === `/desafios/${c._id}`)
                router.replace("/jogos");
            }}
          >
            <p>
              <strong>
                {s.players.find((p) => p._id === c.challengerId)?.name} vs{" "}
                {s.players.find((p) => p._id === c.defenderId)?.name}
              </strong>
            </p>
            <p>
              Esta ação elimina o desafio, a reserva, o resultado, as
              disponibilidades do desafio, as mensagens e as notificações
              associadas. Fica apenas o registo administrativo da eliminação.
            </p>
            {c.status === "completed" && (
              <p>
                As vitórias e derrotas são corrigidas. O ranking e o campeão são
                repostos quando não existem alterações posteriores; caso
                contrário, precisas de os rever.
              </p>
            )}
            <label>
              Motivo da eliminação
              <textarea name="note" minLength={3} maxLength={2000} required />
            </label>
            <label className="check">
              <input type="checkbox" required />
              Confirmo a eliminação definitiva deste jogo e dos dados
              associados.
            </label>
            <button className="danger" disabled={busy}>
              Eliminar definitivamente
            </button>
          </form>
        </Modal>
      )}
      {editing && (
        <Modal title="Editar jogo" close={() => setEditing(false)}>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const result = await run(
                {
                  type: "admin.match.update",
                  challengeId: c._id,
                  start: new Date(String(data.get("start"))).toISOString(),
                  courtId: data.get("courtId"),
                  minutes: Number(data.get("minutes")),
                  note: data.get("note"),
                },
                "Jogo atualizado. Os jogadores foram notificados.",
              );
              if (result) setEditing(false);
            }}
          >
            <p>
              O clube confirma a alteração diretamente e avisa os dois
              jogadores.
            </p>
            <label>
              Data e hora
              <input
                name="start"
                type="datetime-local"
                defaultValue={localStart}
                required
              />
            </label>
            <small>
              Fuso horário: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </small>
            <label>
              Campo
              <select
                name="courtId"
                defaultValue={c.scheduleProposal?.courtId ?? c.courtId}
                required
              >
                {s.courts
                  .filter((court) => court.active)
                  .map((court) => (
                    <option key={court._id} value={court._id}>
                      {court.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Duração · minutos
              <input
                name="minutes"
                type="number"
                min={15}
                max={240}
                defaultValue={c.scheduleProposal?.minutes ?? c.durationMinutes}
                required
              />
            </label>
            <label>
              Motivo da alteração
              <textarea name="note" minLength={3} maxLength={2000} required />
            </label>
            <button className="primary" disabled={busy}>
              Guardar alterações
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function AdminResultButton(a: Actions & { c: Challenge }) {
  const { s, c, busy, run } = a;
  const [open, setOpen] = useState(false);
  if (s.actor.role !== "admin") return null;
  const completed = c.status === "completed";
  const ready =
    ["scheduled", "result_pending", "disputed"].includes(c.status) &&
    !!c.scheduledAt &&
    Date.parse(c.scheduledAt) + c.durationMinutes * 60000 <= Date.now();
  return (
    <div className="stack space-top">
      <button
        className="primary"
        disabled={busy || (!completed && !ready)}
        onClick={() => setOpen(true)}
      >
        <Trophy size={15} />
        {completed ? "Corrigir resultado" : "Registar resultado"}
      </button>
      {!completed && !ready && (
        <small>
          Disponível após o fim do jogo
          {c.scheduledAt
            ? ` · ${fmtDate(c.scheduledAt)} às ${fmtTime(new Date(Date.parse(c.scheduledAt) + c.durationMinutes * 60000).toISOString())}`
            : ""}
          .
        </small>
      )}
      {open && (
        <Modal
          title={completed ? "Corrigir resultado" : "Registar resultado"}
          close={() => setOpen(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fields = Object.fromEntries(new FormData(e.currentTarget));
              if (
                await run(
                  {
                    type: completed
                      ? "admin.result.correct"
                      : "admin.result.record",
                    challengeId: c._id,
                    ...fields,
                  },
                  completed
                    ? "Resultado corrigido. Revê o ranking e o cinturão, se necessário."
                    : "Resultado registado. Estatísticas e ranking atualizados.",
                )
              )
                setOpen(false);
            }}
          >
            <p>
              {s.players.find((p) => p._id === c.challengerId)?.name} vs{" "}
              {s.players.find((p) => p._id === c.defenderId)?.name}
            </p>
            <label>
              Quem venceu?
              <select
                name="winnerId"
                required
                defaultValue={completed ? c.winnerId : (c.winnerId ?? "")}
              >
                <option value="" disabled>
                  Escolher vencedor
                </option>
                {[c.challengerId, c.defenderId].map((pid) => (
                  <option key={pid} value={pid}>
                    {s.players.find((p) => p._id === pid)?.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Resultado dos sets · opcional
              <input
                name="score"
                defaultValue={c.score ?? ""}
                placeholder="6-4 / 4-6 / 10-8"
                maxLength={150}
              />
            </label>
            {completed ? (
              <>
                <label>
                  Motivo da correção
                  <textarea
                    name="note"
                    required
                    minLength={3}
                    maxLength={2000}
                  />
                </label>
                <p>
                  As estatísticas são corrigidas automaticamente. Revê as
                  posições e o campeão: alterações de jogos posteriores são
                  preservadas.
                </p>
              </>
            ) : (
              <p>
                Uma vitória é uma vitória. Ao guardar, o ranking, as
                estatísticas e o histórico são atualizados automaticamente. Os
                sets não atribuem pontos.
              </p>
            )}
            <button className="primary" disabled={busy}>
              {completed
                ? "Guardar correção"
                : "Guardar resultado e atualizar ranking"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function AdminRegistration(a: Actions) {
  const { s, run, busy, notify } = a;
  const [link, setLink] = useState("");
  return (
    <Section title="Inscrições pelo grupo de WhatsApp">
      <div className="stack">
        <p>
          Cria um link e partilha-o com quem queres aceitar na liga. Quem se
          inscrever com um convite válido fica aprovado automaticamente e só
          precisa de confirmar o email. As inscrições feitas diretamente no
          site, sem convite, ficam a aguardar a aprovação do clube.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const result = await run(
              {
                type: "admin.registration.create",
                label: f.get("label"),
                expiryDays: Number(f.get("days")),
                maxUses: Number(f.get("uses")),
              },
              "Link de inscrição criado.",
            );
            if (result?.token)
              setLink(`${location.origin}/inscricao?invite=${result.token}`);
          }}
        >
          <label>
            Nome do convite
            <input
              name="label"
              required
              minLength={2}
              maxLength={150}
              defaultValue="Grupo Fight Club"
            />
          </label>
          <div className="form-grid">
            <label>
              Validade · dias
              <input
                name="days"
                type="number"
                min={1}
                max={90}
                defaultValue={7}
                required
              />
            </label>
            <label>
              Máximo de inscrições
              <input
                name="uses"
                type="number"
                min={1}
                max={500}
                defaultValue={50}
                required
              />
            </label>
          </div>
          <button className="primary" disabled={busy}>
            Criar link de inscrição
          </button>
        </form>
        {link && (
          <div className="inset stack">
            <label>
              Link para partilhar
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <a
              className="button"
              href={`https://wa.me/?text=${encodeURIComponent(`Inscreve-te na Fight Club Padel League do Neiva Padel Club: ${link}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir WhatsApp para partilhar
            </a>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `Inscreve-te na Fight Club Padel League do Neiva Padel Club: ${link}`,
                  );
                  notify("Mensagem copiada. Cola-a no grupo de WhatsApp.");
                } catch {
                  notify("Seleciona e copia o link apresentado.");
                }
              }}
            >
              Copiar mensagem para WhatsApp
            </button>
            <small>
              Copia o link agora. O segredo é guardado apenas como hash e não
              pode ser recuperado mais tarde.
            </small>
          </div>
        )}
        <h3>Convites criados</h3>
        {s.registrationLinks.map((x) => (
          <div className="inset row between wrap" key={x._id}>
            <div>
              <strong>{x.label}</strong>
              <p>
                {x.uses}/{x.maxUses} inscrições · até {fmtDate(x.expiresAt)} ·{" "}
                {x.active && Date.parse(x.expiresAt) > Date.now()
                  ? "Ativo"
                  : "Encerrado"}
              </p>
            </div>
            <button
              disabled={busy || !x.active}
              onClick={() =>
                run(
                  { type: "admin.registration.revoke", linkId: x._id },
                  "Link desativado.",
                )
              }
            >
              Desativar link
            </button>
          </div>
        ))}
        <p>
          As novas inscrições aparecem em Administração → Jogadores → Pendentes.
          Podes aprovar ou recusar cada pedido. Aprovar ativa o jogador; podes
          ajustar a divisão e posição ao editar.
        </p>
      </div>
    </Section>
  );
}

function AdminResults(a: Actions) {
  const { s } = a;
  const [filter, setFilter] = useState("pending"),
    [division, setDivision] = useState("all");
  const ready = (c: Challenge) =>
    ["scheduled", "result_pending", "disputed"].includes(c.status) &&
    !!c.scheduledAt &&
    Date.parse(c.scheduledAt) + c.durationMinutes * 60000 <= Date.now();
  const games = s.challenges
    .filter(
      (c) =>
        (division === "all" || c.divisionId === division) &&
        (filter === "pending"
          ? ready(c)
          : filter === "completed"
            ? c.status === "completed"
            : ["scheduled", "result_pending", "disputed", "completed"].includes(
                c.status,
              )),
    )
    .sort((a, b) =>
      (b.scheduledAt ?? b.createdAt).localeCompare(
        a.scheduledAt ?? a.createdAt,
      ),
    );
  return (
    <Section title="Registo de resultados">
      <div className="stack">
        <p>
          Escolhe o jogo e indica o vencedor. Só os administradores podem
          registar ou corrigir resultados; os jogadores consultam o resultado
          final.
        </p>
        <div className="toolbar">
          <div className="tabs">
            {[
              ["pending", "Por registar"],
              ["completed", "Concluídos"],
              ["all", "Todos os jogos"],
            ].map(([v, label]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <label>
            Divisão dos resultados
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
            >
              <option value="all">Todas as divisões</option>
              {s.divisions.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!games.length && (
          <Empty
            text={
              filter === "pending"
                ? "Não há jogos terminados com resultado por registar."
                : "Não existem jogos com estes filtros."
            }
          />
        )}
        <div className="challenge-grid">
          {games.map((c) => (
            <div className="inset stack" key={c._id}>
              <ChallengeCard s={s} c={c} />
              {c.status === "completed" && (
                <p>
                  <strong>
                    Vencedor:{" "}
                    {s.players.find((p) => p._id === c.winnerId)?.name}
                  </strong>
                  {c.score ? ` · ${c.score}` : ""}
                </p>
              )}
              <AdminResultButton {...a} c={c} />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function AdminChallenges(a: Actions) {
  const { s } = a,
    [division, setDivision] = useState("all"),
    [status, setStatus] = useState("all");
  const list = s.challenges
    .filter(
      (c) =>
        (division === "all" || c.divisionId === division) &&
        (status === "all" || effectiveStatus(c) === status),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <div className="toolbar">
        <div className="row">
          <select
            aria-label="Filtrar divisão"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
          >
            <option value="all">Todas as divisões</option>
            {s.divisions.map((d) => (
              <option value={d._id} key={d._id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar estado"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todos os estados</option>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <small>{list.length} desafios</small>
      </div>
      <div className="challenge-grid">
        {list.map((c) => (
          <ChallengeCard key={c._id} s={s} c={c} />
        ))}
      </div>
      {!list.length && <Empty text="Não existem desafios com estes filtros." />}
    </>
  );
}
function AdminPlayers(a: Actions) {
  const { s, run, busy, notify, refresh } = a,
    [filter, setFilter] = useState("all"),
    [registrationFilter, setRegistrationFilter] = useState("approved"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Player | "new" | null>(null),
    [history, setHistory] = useState<Player | null>(null),
    [vacationPlayer, setVacationPlayer] = useState<Player | null>(null),
    [link, setLink] = useState("");
  const registrationCounts = {
    approved: s.players.filter(
      (p) => !p.awaitingApproval && !p.registrationRejectedAt,
    ).length,
    pending: s.players.filter(
      (p) => p.awaitingApproval && !p.registrationRejectedAt,
    ).length,
    rejected: s.players.filter((p) => !!p.registrationRejectedAt).length,
  };
  const registrationPlayers = s.players.filter((p) =>
    registrationFilter === "pending"
      ? p.awaitingApproval && !p.registrationRejectedAt
      : registrationFilter === "rejected"
        ? !!p.registrationRejectedAt
        : !p.awaitingApproval && !p.registrationRejectedAt,
  );
  const matchesPlayerFilter = (p: Player, value: string) =>
    value === "all" || p.divisionId === value || p.status === value;
  const list = registrationPlayers
    .filter(
      (p) =>
        matchesPlayerFilter(p, filter) &&
        (p.name + " " + p.email).toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.divisionId.localeCompare(b.divisionId) || a.position - b.position,
    );
  async function account(p: Player, action: string) {
    try {
      const res = await request("/api/auth/" + action, { playerId: p._id });
      setLink(res.link);
      notify(
        res.sent
          ? "Email enviado."
          : "Endereço criado. Copia e envia ao jogador.",
      );
      await refresh();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <>
      <div className="tabs toolbar" aria-label="Estado das inscrições">
        {(
          [
            ["approved", "Aprovadas"],
            ["pending", "Pendentes"],
            ["rejected", "Recusadas"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            className={registrationFilter === value ? "active" : ""}
            aria-pressed={registrationFilter === value}
            onClick={() => {
              setRegistrationFilter(value);
              setFilter("all");
            }}
          >
            {label} ({registrationCounts[value]})
          </button>
        ))}
      </div>
      {registrationFilter === "rejected" && (
        <p className="space-bottom">
          As contas recusadas são eliminadas automaticamente 2 dias após a
          recusa. Podes aprovar uma inscrição antes dessa data para impedir a
          eliminação.
        </p>
      )}
      <div className="toolbar">
        <div className="tabs">
          {[
            ["all", "Todos"],
            ...s.divisions.map((d) => [d._id, d.name]),
            ["active", "Ativos"],
            ["suspended", "Suspensos"],
            ["removed", "Removidos"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {l} (
              {
                registrationPlayers.filter((p) => matchesPlayerFilter(p, v))
                  .length
              }
              )
            </button>
          ))}
        </div>
        <button className="primary" onClick={() => setEditing("new")}>
          <Plus size={14} />
          Adicionar jogador
        </button>
      </div>
      <div className="toolbar">
        <label className="row" style={{ flexDirection: "row" }}>
          <Search size={16} />
          <input
            placeholder="Pesquisar nome ou email…"
            aria-label="Pesquisar jogadores"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="row wrap">
          <a className="button small" href="/api/transfer?format=csv">
            <Download size={13} />
            CSV
          </a>
          <a className="button small" href="/api/transfer">
            <Download size={13} />
            Excel
          </a>
          <label
            className="button small"
            style={{ color: "var(--text)", cursor: "pointer" }}
          >
            Importar CSV / Excel
            <input
              className="sr-only"
              type="file"
              accept=".csv,.xlsx"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const f = new FormData();
                  f.set("file", file);
                  const res = await request("/api/transfer", f);
                  notify(`${res.count} jogadores importados.`);
                  await refresh();
                } catch (e) {
                  notify((e as Error).message, true);
                }
              }}
            />
          </label>
        </div>
      </div>
      <p style={{ fontSize: 11, marginBottom: 15 }}>
        Colunas: Nome, Email, Telefone, Divisão, Posição, Parceiro, Estado.
        Emails existentes atualizam o jogador sem duplicar o histórico.
      </p>
      <Section
        title={`${registrationFilter === "pending" ? "Inscrições pendentes" : registrationFilter === "rejected" ? "Inscrições recusadas" : "Jogadores aprovados"} · ${list.length}`}
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Jogador</th>
                <th>Divisão / Posição</th>
                <th>Estado</th>
                {registrationFilter === "rejected" && (
                  <th>Eliminação automática</th>
                )}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div className="row">
                      <Avatar p={p} />
                      <div>
                        <strong>{p.name}</strong>
                        <small style={{ display: "block" }}>
                          {p.email || "Sem email"} ·{" "}
                          {p.userId ? "Com conta" : "Sem conta"}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <DivisionBadge s={s} id={p.divisionId} />{" "}
                    <strong>#{p.position}</strong>
                  </td>
                  <td>
                    <span className="badge">
                      {p.registrationRejectedAt
                        ? "Inscrição recusada"
                        : p.awaitingApproval
                          ? "Por aprovar"
                          : {
                              active: "Ativo",
                              inactive: "Inativo",
                              suspended: "Suspenso",
                              removed: "Removido",
                            }[p.status]}
                    </span>
                    {frozenRanking(s, p._id) && (
                      <small className="gold" style={{ display: "block" }}>
                        Ranking congelado
                      </small>
                    )}
                  </td>
                  {registrationFilter === "rejected" && (
                    <td>
                      {p.registrationRejectedAt &&
                        (() => {
                          const expiry = new Date(
                            Date.parse(p.registrationRejectedAt) + 2 * 86400000,
                          ).toISOString();
                          return (
                            <span>
                              {fmtDate(expiry)} · {fmtTime(expiry)}
                            </span>
                          );
                        })()}
                    </td>
                  )}
                  <td>
                    <div className="table-actions">
                      <button className="small" onClick={() => setEditing(p)}>
                        Editar
                      </button>
                      <button className="small" onClick={() => setEditing(p)}>
                        Divisão / posição
                      </button>
                      <button
                        className="small"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              `${p.awaitingApproval || p.registrationRejectedAt ? "Aprovar inscrição" : p.status === "active" ? "Suspender" : "Reativar"} ${p.name}?`,
                            )
                          )
                            void run(
                              {
                                type: "admin.player.save",
                                playerId: p._id,
                                ...playerData(p),
                                status:
                                  p.status === "active"
                                    ? "suspended"
                                    : "active",
                                position: p.registrationRejectedAt
                                  ? s.players.filter(
                                      (other) =>
                                        other.divisionId === p.divisionId &&
                                        other.status !== "removed",
                                    ).length + 1
                                  : Math.max(1, p.position),
                              },
                              "Estado atualizado.",
                            );
                        }}
                      >
                        {p.awaitingApproval || p.registrationRejectedAt
                          ? "Aprovar inscrição"
                          : p.status === "active"
                            ? "Suspender"
                            : "Reativar"}
                      </button>
                      {p.awaitingApproval && (
                        <button
                          className="small danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                `Recusar a inscrição de ${p.name}? Esta pessoa não terá acesso à liga e a conta será eliminada automaticamente após 2 dias.`,
                              )
                            )
                              void run(
                                {
                                  type: "admin.registration.reject",
                                  playerId: p._id,
                                },
                                "Inscrição recusada.",
                              );
                          }}
                        >
                          Recusar inscrição
                        </button>
                      )}
                      {(p.status === "active" ||
                        s.exceptions.some(
                          (entry) =>
                            entry.playerId === p._id &&
                            entry.vacation &&
                            entry.to >= clubDay(Date.now()),
                        )) &&
                        !p.awaitingApproval &&
                        !p.registrationRejectedAt && (
                          <button
                            className="small"
                            onClick={() => setVacationPlayer(p)}
                          >
                            {frozenRanking(s, p._id)
                              ? "Gerir congelamento"
                              : "Congelar ranking"}
                          </button>
                        )}
                      <button className="small" onClick={() => setHistory(p)}>
                        Histórico
                      </button>
                      {p.email && (
                        <button
                          className="small"
                          onClick={() =>
                            account(p, p.userId ? "reset-player" : "invite")
                          }
                        >
                          {p.userId ? "Recuperar acesso" : "Convidar"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && (
          <Empty
            text={
              registrationFilter === "pending"
                ? "Não existem inscrições pendentes."
                : registrationFilter === "rejected"
                  ? "Não existem inscrições recusadas."
                  : "Não existem jogadores com estes filtros."
            }
          />
        )}
      </Section>
      {vacationPlayer && (
        <AdminVacationDialog
          {...a}
          player={
            s.players.find((p) => p._id === vacationPlayer._id) ??
            vacationPlayer
          }
          close={() => setVacationPlayer(null)}
        />
      )}
      {editing && (
        <PlayerEditor
          {...a}
          p={editing === "new" ? undefined : editing}
          close={() => setEditing(null)}
        />
      )}{" "}
      {history && (
        <Modal title={history.name} close={() => setHistory(null)}>
          <PlayerHistory s={s} p={history} />
        </Modal>
      )}
      {link && (
        <Modal title="Endereço de acesso" close={() => setLink("")}>
          <div className="stack">
            <p>
              Este endereço expira em 24 horas. Partilha-o apenas com o jogador.
            </p>
            <input
              aria-label="Endereço de acesso"
              value={link}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <button
              className="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  notify("Endereço copiado.");
                } catch {
                  notify("Seleciona e copia o endereço manualmente.");
                }
              }}
            >
              Copiar endereço
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function AdminVacationDialog(
  a: Actions & { player: Player; close: () => void },
) {
  const { s, run, busy, player, close } = a;
  const periods = s.exceptions.filter(
    (entry) =>
      entry.playerId === player._id &&
      entry.vacation &&
      entry.to >= clubDay(Date.now()),
  );
  return (
    <Modal title={`Congelar ranking · ${player.name}`} close={close}>
      <div className="stack">
        <p>
          O jogador mantém a posição durante as férias, pode receber desafios e
          joga após o regresso. Se já tiver um jogo confirmado nesse período,
          altera a marcação primeiro.
        </p>
        {periods.map((entry) => (
          <div className="inset stack" key={entry._id}>
            <strong>
              {fmtDate(entry.from)} → {fmtDate(entry.to)}
            </strong>
            {entry.note && <small>{entry.note}</small>}
            <button
              className="small"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(`Terminar este período de férias de ${player.name}?`)
                )
                  void run(
                    { type: "exception.delete", exceptionId: entry._id },
                    "Período de férias removido. O estado do ranking foi atualizado.",
                  );
              }}
            >
              Terminar congelamento
            </button>
          </div>
        ))}
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const result = await run(
              {
                type: "exception.add",
                playerId: player._id,
                vacation: true,
                from: data.get("from"),
                to: data.get("to"),
                note: String(data.get("note") ?? ""),
              },
              "Férias registadas. O ranking fica congelado nas datas indicadas.",
            );
            if (result) close();
          }}
        >
          <div className="form-grid">
            <label>
              Início do congelamento
              <input
                name="from"
                type="date"
                defaultValue={clubDay(Date.now())}
                required
              />
            </label>
            <label>
              Fim do congelamento
              <input
                name="to"
                type="date"
                defaultValue={addClubDays(clubDay(Date.now()), 7)}
                required
              />
            </label>
          </div>
          <label>
            Motivo do congelamento
            <input name="note" maxLength={2000} defaultValue="Férias" />
          </label>
          <button className="primary" disabled={busy}>
            Guardar congelamento
          </button>
        </form>
      </div>
    </Modal>
  );
}
function AdminPartners(a: Actions) {
  const { s, run, busy } = a;
  const [division, setDivision] = useState(s.divisions[0]?._id ?? "");
  const players = s.players
    .filter(
      (p) =>
        p.divisionId === division &&
        p.status !== "removed" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
    .sort((a, b) => a.position - b.position);
  return (
    <Section title="Parceiros por categoria">
      <div className="stack">
        <p>
          Escolhe um parceiro da mesma categoria para cada jogador. Ao guardar,
          a atribuição é aplicada automaticamente aos dois jogadores. O próprio
          jogador fica excluído das opções.
        </p>
        <label>
          Categoria dos parceiros
          <select
            value={division}
            onChange={(event) => setDivision(event.target.value)}
          >
            {s.divisions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {players.map((p) => (
          <form
            className="inset"
            key={`${p._id}:${p.partnerId ?? p.partner}`}
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              await run(
                {
                  type: "admin.partner.set",
                  playerId: p._id,
                  partnerId: String(data.get("partner")).trim(),
                },
                "Parceiro atualizado.",
              );
            }}
          >
            <div className="row between wrap">
              <strong>
                #{p.position} · {p.name}
              </strong>
              {p.partner && <small>Parceiro atual: {p.partner}</small>}
            </div>
            <label>
              Parceiro de {p.name}
              <select
                name="partner"
                aria-label={`Parceiro de ${p.name}`}
                defaultValue={
                  p.partnerId ??
                  (players.filter(
                    (other) => other._id !== p._id && other.name === p.partner,
                  ).length === 1
                    ? players.find(
                        (other) =>
                          other._id !== p._id && other.name === p.partner,
                      )!._id
                    : "")
                }
              >
                <option value="">Sem parceiro</option>
                {players
                  .filter((other) => other._id !== p._id)
                  .map((other) => (
                    <option key={other._id} value={other._id}>
                      #{other.position} · {other.name}
                    </option>
                  ))}
              </select>
            </label>
            <button className="small" disabled={busy}>
              Guardar parceiro
            </button>
          </form>
        ))}
        {!players.length && (
          <Empty text="Não existem jogadores aprovados nesta categoria." />
        )}
      </div>
    </Section>
  );
}
function playerData(p: Player) {
  return {
    name: p.name,
    email: p.email,
    phone: p.phone,
    photo: p.photo,
    divisionId: p.divisionId,
    position: p.position,
    status: p.status,
    partner: p.partner,
  };
}
function PlayerEditor({
  s,
  run,
  busy,
  notify,
  p,
  close,
}: Actions & { p?: Player; close: () => void }) {
  const [photo, setPhoto] = useState(p?.photo ?? "");
  return (
    <Modal title={p ? "Editar jogador" : "Adicionar jogador"} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget));
          if (
            await run(
              {
                type: "admin.player.save",
                playerId: p?._id,
                ...data,
                photo,
                position: Number(data.position),
              },
              "Jogador guardado.",
            )
          )
            close();
        }}
      >
        <label>
          Nome
          <input name="name" defaultValue={p?.name} minLength={2} required />
        </label>
        <div className="form-grid">
          <label>
            Email
            <input
              name="email"
              type="email"
              defaultValue={p?.email}
              required={!!p?.userId}
            />
          </label>
          <label>
            Telefone
            <input name="phone" defaultValue={p?.phone} />
          </label>
          <label>
            Divisão
            <select
              name="divisionId"
              defaultValue={p?.divisionId ?? ""}
              required
            >
              <option value="" disabled>
                Escolher categoria
              </option>
              {s.divisions.map((d) => (
                <option value={d._id} key={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Posição
            <input
              type="number"
              name="position"
              defaultValue={p?.position || 1}
              min={1}
              required
            />
          </label>
          <label>
            Estado
            <select name="status" defaultValue={p?.status ?? "active"}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="suspended">Suspenso</option>
              <option value="removed">Removido da época</option>
            </select>
          </label>
          <label>
            Parceiro
            <input name="partner" defaultValue={p?.partner} />
          </label>
        </div>
        <label>
          Fotografia
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file)
                try {
                  setPhoto(await uploadPhoto(file));
                } catch (e) {
                  notify((e as Error).message, true);
                }
            }}
          />
        </label>
        {photo && (
          <img
            src={photo}
            className="avatar large"
            alt="Fotografia do jogador"
          />
        )}
        <p style={{ fontSize: 11 }}>
          As mudanças de posição e divisão preservam o histórico. Para remover
          ou transferir, resolve primeiro os desafios ativos.
        </p>
        <button disabled={busy} className="primary">
          Guardar jogador
        </button>
      </form>
    </Modal>
  );
}

const settingLabels: Record<
  keyof Omit<Settings, "_id" | "rulesText" | "prizes">,
  string
> = {
  weeklyCompetition: "Competição semanal · um jogo e papéis publicados",
  requireClubConfirmation: "Exigir confirmação do clube e campo",
  initialSuggestionCount: "Opções iniciais de calendário · 3 ou 4",
  maxPositionsAbove: "Posições que pode desafiar acima",
  maxActiveChallenges: "Máximo de desafios simultâneos",
  minDaysBetween: "Intervalo mínimo entre desafios · dias",
  acceptHours: "Prazo para aceitar · horas",
  scheduleDays: "Prazo para marcar · dias",
  playDays: "Prazo para jogar · dias",
  matchMinutes: "Duração do jogo · minutos",
  slotStepMinutes: "Intervalo entre horários · minutos",
  rankingModel: "Modelo de ranking",
  refusalRule: "Regra de recusa",
  cancellationRule: "Regra de cancelamento",
  reminderHours: "Antecedência dos alertas · horas",
  promotionCount: "Jogadores que sobem",
  relegationCount: "Jogadores que descem",
  promotionPlacement: "Posição de entrada dos promovidos",
  relegationPlacement: "Posição de entrada dos despromovidos",
  titleMaxPosition: "Posição máxima do contender",
  titleChangesOnWin: "Transferir título se o contender vencer",
  titleAffectsRanking: "Title Fight altera o ranking",
  seasonMonths: "Duração sugerida de época · meses",
  extendDays: "Prolongamento de prazos · dias",
  extendResponseHours: "Prolongamento de resposta · horas",
};
function Rules({ s, run, busy }: Actions) {
  const [settings, setSettings] = useState(s.settings[0]);
  const options: Record<string, [string, string][]> = {
    promotionPlacement: [
      ["top", "Topo da nova divisão"],
      ["bottom", "Fundo da nova divisão"],
    ],
    relegationPlacement: [
      ["top", "Topo da nova divisão"],
      ["bottom", "Fundo da nova divisão"],
    ],
    rankingModel: [
      ["swap", "Troca de posições"],
      ["leapfrog", "Subida com deslocação"],
    ],
    refusalRule: [
      ["busy_only", "Apenas com outro desafio aceite/ativo"],
      ["reason", "Recusa com motivo"],
      ["forfeit", "Recusa dá derrota (exceto lesão)"],
    ],
    cancellationRule: [
      ["admin_only", "Apenas administrador"],
      ["participants", "Jogadores participantes"],
    ],
  };
  return (
    <Section
      title="Regras da competição"
      right={<Settings2 size={18} className="gold" />}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await run(
            { type: "admin.settings.save", settings },
            "Regras atualizadas.",
          );
        }}
      >
        <p style={{ fontSize: 12 }}>
          As regras aplicam-se às novas ações. Os prazos já atribuídos a
          desafios mantêm-se até uma intervenção do administrador.
        </p>
        <div className="form-grid">
          {Object.entries(settingLabels).map(([key, label]) => (
            <label
              key={key}
              className={
                typeof settings[key as keyof Settings] === "boolean"
                  ? "check"
                  : ""
              }
            >
              {label}
              {options[key] ? (
                <select
                  value={String(settings[key as keyof Settings])}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: e.target.value })
                  }
                >
                  {options[key].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : typeof settings[key as keyof Settings] === "boolean" ? (
                <input
                  type="checkbox"
                  checked={Boolean(settings[key as keyof Settings])}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: e.target.checked })
                  }
                />
              ) : (
                <input
                  type="number"
                  min={0}
                  required
                  value={Number(settings[key as keyof Settings])}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: Number(e.target.value) })
                  }
                />
              )}
            </label>
          ))}
        </div>
        <button className="primary" disabled={busy}>
          Guardar regras
        </button>
      </form>
      <div className="divider" />
      <h3>Capacidade das divisões</h3>
      <div className="three-grid space-top">
        {s.divisions.map((d) => (
          <form
            className="inset"
            key={d._id}
            onSubmit={async (e) => {
              e.preventDefault();
              await run({
                type: "admin.division.save",
                divisionId: d._id,
                capacity: Number(new FormData(e.currentTarget).get("capacity")),
              });
            }}
          >
            <label>
              {d.name}
              <input
                name="capacity"
                type="number"
                min={1}
                defaultValue={d.capacity}
              />
            </label>
            <button disabled={busy}>Guardar</button>
          </form>
        ))}
      </div>
    </Section>
  );
}
function Courts({ s, run, busy }: Actions) {
  return (
    <Section title="Campos e reservas">
      <div className="stack">
        <CourtAvailability />
        <p style={{ fontSize: 12 }}>
          Reservas de desafios impedem sobreposição no mesmo campo. Abre um
          desafio para marcar manualmente.
        </p>
        {s.courts.map((c) => (
          <form
            key={c._id}
            className="inset"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await run(
                {
                  type: "admin.court.save",
                  courtId: c._id,
                  name: f.get("name"),
                  playtomicResourceId: f.get("playtomicResourceId"),
                  active: f.get("active") === "on",
                },
                "Campo atualizado.",
              );
            }}
          >
            <div className="row wrap">
              <label className="flex-1">
                Nome
                <input name="name" defaultValue={c.name} />
              </label>
              <label className="check">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={c.active}
                />
                Ativo
              </label>
              <label className="flex-1">
                ID do campo no Playtomic
                <input
                  name="playtomicResourceId"
                  defaultValue={c.playtomicResourceId ?? ""}
                  maxLength={100}
                />
              </label>
              <button disabled={busy}>Guardar</button>
            </div>
          </form>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            if (
              await run(
                {
                  type: "admin.court.save",
                  name: new FormData(form).get("name"),
                  active: true,
                },
                "Campo adicionado.",
              )
            )
              form.reset();
          }}
        >
          <div className="row">
            <input
              aria-label="Nome do novo campo"
              name="name"
              placeholder="Novo campo"
              required
              minLength={2}
            />
            <button disabled={busy}>
              <Plus size={14} />
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </Section>
  );
}

function TitleFights(a: Actions) {
  const { s, run, busy } = a,
    p = s.players.find((p) => p._id === s.actor.playerId)!,
    admin = s.actor.role === "admin";
  return (
    <>
      <Heading
        eyebrow="O COMBATE PELO TÍTULO"
        title="Title Fight"
        description="O cinturão tem um dono. Por agora."
        right={
          <Link href="/campeoes" className="button">
            <Crown size={15} />
            Hall of Champions
          </Link>
        }
      />
      <div className="three-grid">
        {s.divisions.map((d) => {
          const champion = s.champions.find(
              (c) => c.divisionId === d._id && !c.until,
            ),
            holder = s.players.find((p) => p._id === champion?.playerId);
          const reason = holder
            ? challengeReason(s, p, holder, Date.now(), true)
            : "Sem campeão";
          return (
            <div className={`panel belt ${d.code}`} key={d._id}>
              <span className="eyebrow muted">
                {d.name.toUpperCase()} DIVISION
              </span>
              <div className="belt-icon">
                <Trophy size={39} />
              </div>
              <div className="eyebrow gold">
                {d.code === "ouro"
                  ? "GOLD"
                  : d.code === "prata"
                    ? "SILVER"
                    : "BRONZE"}{" "}
                BELT
              </div>
              <h2>{holder?.name ?? "Título por atribuir"}</h2>
              <small>
                {champion
                  ? `${champion.defenses} defesas · desde ${fmtDate(champion.since)}`
                  : "O administrador define o primeiro campeão."}
              </small>
              {holder && p.divisionId === d._id && holder._id !== p._id && (
                <div className="space-top">
                  <button
                    className="primary wide"
                    disabled={busy || !!reason}
                    title={reason ?? "Desafiar campeão"}
                    onClick={async () => {
                      const res = await run(
                        {
                          type: "challenge.create",
                          defenderId: holder._id,
                          titleFight: true,
                        },
                        "Title Fight enviado.",
                      );
                      if (res?.id) location.href = "/desafios/" + res.id;
                    }}
                  >
                    <Swords size={14} />
                    Desafiar campeão
                  </button>
                  {reason && <small>{reason}</small>}
                </div>
              )}
              {admin && (
                <form
                  className="space-top"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await run(
                      {
                        type: "admin.champion",
                        divisionId: d._id,
                        playerId: new FormData(e.currentTarget).get("playerId"),
                      },
                      "Campeão definido.",
                    );
                  }}
                >
                  <label className="sr-only" htmlFor={"champion-" + d._id}>
                    Campeão {d.name}
                  </label>
                  <select
                    id={"champion-" + d._id}
                    name="playerId"
                    defaultValue={holder?._id}
                  >
                    {s.players
                      .filter(
                        (p) => p.divisionId === d._id && p.status === "active",
                      )
                      .map((p) => (
                        <option value={p._id} key={p._id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                  <button disabled={busy}>Definir campeão</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
      <div className="space-top">
        <Section title="Combates pelo título">
          {s.challenges.some((c) => c.titleFight) ? (
            <div className="challenge-grid">
              {s.challenges
                .filter((c) => c.titleFight)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((c) => (
                  <ChallengeCard s={s} c={c} key={c._id} />
                ))}
            </div>
          ) : (
            <Empty text="O próximo Title Fight pode ser teu. Consulta as regras e desafia o campeão." />
          )}
        </Section>
      </div>
    </>
  );
}
function Champions({ s }: Actions) {
  return (
    <>
      <Heading
        eyebrow="O LEGADO DA LIGA"
        title="Hall of Champions"
        description="Os nomes que conquistaram o topo. As defesas que fizeram história."
      />
      <div className="three-grid">
        {s.divisions.map((d) => (
          <Section
            key={d._id}
            title={`${d.name} · ${d.code === "ouro" ? "Gold" : d.code === "prata" ? "Silver" : "Bronze"} Belt`}
            right={<Crown size={19} className="gold" />}
          >
            <div className="stack">
              {s.champions
                .filter((c) => c.divisionId === d._id)
                .sort((a, b) => b.since.localeCompare(a.since))
                .map((c) => {
                  const p = s.players.find((p) => p._id === c.playerId);
                  return (
                    <div className="inset" key={c._id}>
                      <div className="row">
                        <Avatar p={p} />
                        <div>
                          <strong style={{ fontSize: 12 }}>{p?.name}</strong>
                          <div>
                            <small>
                              {c.defenses} defesas{" "}
                              {c.until ? "" : "· Campeão atual"}
                            </small>
                          </div>
                        </div>
                      </div>
                      <small style={{ display: "block", marginTop: 10 }}>
                        {fmtDate(c.since)} →{" "}
                        {c.until ? fmtDate(c.until) : "Presente"}
                      </small>
                    </div>
                  );
                })}
              {!s.champions.some((c) => c.divisionId === d._id) && (
                <Empty text="A história deste cinturão ainda está por escrever." />
              )}
            </div>
          </Section>
        ))}
      </div>
    </>
  );
}
function Seasons({ s, run, busy }: Actions) {
  const admin = s.actor.role === "admin",
    [creating, setCreating] = useState(false),
    [archive, setArchive] = useState<string | null>(null);
  const selected = s.seasons.find((x) => x._id === archive);
  return (
    <>
      <Heading
        eyebrow="CADA ÉPOCA, UMA NOVA CONQUISTA"
        title="Épocas da liga"
        description="O ranking muda. A história permanece."
        right={
          admin ? (
            <button className="primary" onClick={() => setCreating(true)}>
              <Plus size={14} />
              Nova época
            </button>
          ) : undefined
        }
      />
      <div className="stack">
        {s.seasons
          .slice()
          .reverse()
          .map((season) => (
            <Section
              key={season._id}
              title={season.name}
              right={
                <span className="badge gold">
                  {
                    {
                      draft: "Preparação",
                      active: "Em competição",
                      paused: "Pausa",
                      completed: "Arquivada",
                    }[season.status]
                  }
                </span>
              }
            >
              <div className="row between wrap">
                <div>
                  <p>
                    {fmtDate(season.start)} → {fmtDate(season.end)}
                  </p>
                  {season.pauseStart && (
                    <small>
                      Pausa: {fmtDate(season.pauseStart)} →{" "}
                      {fmtDate(season.pauseEnd)}
                    </small>
                  )}
                </div>
                <div className="row wrap">
                  {season.archivedRankings && (
                    <button onClick={() => setArchive(season._id)}>
                      <History size={14} />
                      Ranking final
                    </button>
                  )}
                  {admin && season.status !== "completed" && (
                    <>
                      {season.status !== "active" && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            run(
                              {
                                type: "admin.season.status",
                                seasonId: season._id,
                                status: "active",
                              },
                              "Época iniciada.",
                            )
                          }
                        >
                          Iniciar / retomar
                        </button>
                      )}
                      {season.status === "active" && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              {
                                type: "admin.season.status",
                                seasonId: season._id,
                                status: "paused",
                              },
                              "Época em pausa.",
                            )
                          }
                        >
                          Pausar
                        </button>
                      )}
                      <button
                        className="danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            !confirm(
                              "Arquivar esta época? O ranking final ficará guardado.",
                            )
                          )
                            return;
                          const promote = confirm(
                            `Aplicar subidas (${s.settings[0].promotionCount}) e descidas (${s.settings[0].relegationCount})? Cancelar guarda a época sem transferências.`,
                          );
                          void run(
                            {
                              type: "admin.season.status",
                              seasonId: season._id,
                              status: "completed",
                              promote,
                            },
                            "Época arquivada.",
                          );
                        }}
                      >
                        Terminar época
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Section>
          ))}
      </div>
      {creating && (
        <Modal title="Criar nova época" close={() => setCreating(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  {
                    type: "admin.season.create",
                    ...Object.fromEntries(new FormData(e.currentTarget)),
                  },
                  "Época criada.",
                )
              )
                setCreating(false);
            }}
          >
            <label>
              Nome
              <input name="name" placeholder="Season 2" required />
            </label>
            <div className="form-grid">
              <label>
                Início
                <input type="date" name="start" required />
              </label>
              <label>
                Fim
                <input type="date" name="end" required />
              </label>
              <label>
                Pausa · início opcional
                <input type="date" name="pauseStart" />
              </label>
              <label>
                Pausa · fim opcional
                <input type="date" name="pauseEnd" />
              </label>
            </div>
            <p style={{ fontSize: 12 }}>
              Os jogadores e posições atuais transitam para a nova época. As
              épocas antigas conservam os rankings e resultados.
            </p>
            <button className="primary" disabled={busy}>
              Criar época
            </button>
          </form>
        </Modal>
      )}
      {selected?.archivedRankings && (
        <Modal
          title={`${selected.name} · Ranking final`}
          close={() => setArchive(null)}
        >
          <div className="stack">
            {s.divisions.map((d) => (
              <div key={d._id}>
                <h3 className="gold">{d.name}</h3>
                {rankingEntries(selected.archivedRankings!, d._id).map(
                  (entry) => (
                    <div className="slot" key={entry.id}>
                      <div className="stack">
                        {entry.members.length > 1 && (
                          <span className="badge">Equipa</span>
                        )}
                        {entry.members.map((member) => (
                          <div className="row between wrap" key={member._id}>
                            <span>
                              #{member.position} · {member.name}
                            </span>
                            <small>
                              {member.wins} V / {member.losses} D
                            </small>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
function Statistics({ s }: Actions) {
  const p = s.players.find((p) => p._id === s.actor.playerId)!,
    [opponent, setOpponent] = useState(""),
    results = s.results.filter(
      (r) => r.winnerId === p._id || r.loserId === p._id,
    ),
    head = results.filter(
      (r) => r.winnerId === opponent || r.loserId === opponent,
    );
  return (
    <>
      <Heading
        eyebrow="CONHECE O TEU JOGO"
        title="Estatísticas"
        description="O teu percurso, os teus adversários e as conquistas da liga."
      />
      <div className="home-grid">
        <Section title="O teu desempenho">
          <div className="stack">
            <div className="row between">
              <strong>Taxa de vitórias</strong>
              <strong className="gold">
                {p.wins + p.losses
                  ? Math.round((p.wins / (p.wins + p.losses)) * 100)
                  : 0}
                %
              </strong>
            </div>
            <div className="metrics-bar">
              <span
                style={{
                  width: `${p.wins + p.losses ? (p.wins / (p.wins + p.losses)) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="row between">
              <span className="muted">Vitórias</span>
              <strong>{p.wins}</strong>
            </div>
            <div className="row between">
              <span className="muted">Derrotas</span>
              <strong>{p.losses}</strong>
            </div>
            <div className="row between">
              <span className="muted">Jogos realizados</span>
              <strong>{p.wins + p.losses}</strong>
            </div>
            <div className="row between">
              <span className="muted">Desafios ativos</span>
              <strong>{activeChallenges(s, p._id, Date.now()).length}</strong>
            </div>
          </div>
        </Section>
        <Section title="Confronto direto">
          <div className="stack">
            <label>
              Adversário
              <select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
              >
                <option value="">Escolhe um jogador</option>
                {s.players
                  .filter((x) => x._id !== p._id)
                  .map((x) => (
                    <option value={x._id} key={x._id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            {opponent ? (
              <>
                <div className="row between">
                  <span>Tu</span>
                  <strong className="display gold" style={{ fontSize: 35 }}>
                    {head.filter((r) => r.winnerId === p._id).length} –{" "}
                    {head.filter((r) => r.winnerId === opponent).length}
                  </strong>
                  <span>Adversário</span>
                </div>
                <small>{head.length} jogos confirmados</small>
              </>
            ) : (
              <p>Seleciona um adversário para ver o histórico.</p>
            )}
          </div>
        </Section>
        <Section title="Mais vitórias na liga" className="full">
          <div className="stack">
            {s.players
              .slice()
              .sort((a, b) => b.wins - a.wins)
              .slice(0, 8)
              .map((p, i) => (
                <div className="row between" key={p._id}>
                  <div className="row">
                    <span
                      className="display gold"
                      style={{ fontSize: 24, minWidth: 22 }}
                    >
                      {i + 1}
                    </span>
                    <Avatar p={p} />
                    <strong style={{ fontSize: 12 }}>{p.name}</strong>
                  </div>
                  <div className="row">
                    <DivisionBadge s={s} id={p.divisionId} />
                    <strong>{p.wins} V</strong>
                  </div>
                </div>
              ))}
          </div>
        </Section>
      </div>
    </>
  );
}

function ChallengeComposer(
  a: Actions & { target: Player; close: () => void; titleFight?: boolean },
) {
  const { s, target, close, run, busy, notify } = a,
    p = s.players.find((p) => p._id === s.actor.playerId)!,
    router = useRouter();
  const weeklyWindowValue = s.settings[0].weeklyCompetition
    ? weeklyWindow(s, [p._id, target._id])
    : undefined;
  const [proposals, setProposals] = useState(() =>
      initialProposals(s, p, Date.now(), weeklyWindowValue),
    ),
    [include, setInclude] = useState(true);
  const selected = proposals.filter((p) => p.selected);
  return (
    <Modal
      title={a.titleFight ? "Propor Title Fight" : "Enviar desafio"}
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const initialSlots = include
              ? selected.map((p) => ({
                  start: clubDateTime(p.day, p.start),
                  end: clubDateTime(p.day, p.end),
                }))
              : undefined;
            const res = await run(
              {
                type: "challenge.create",
                defenderId: target._id,
                titleFight: a.titleFight ?? false,
                initialSlots,
              },
              "Desafio enviado com as tuas propostas.",
            );
            if (res?.id) {
              close();
              router.push("/desafios/" + res.id);
            }
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        <div className="inset row between wrap">
          <span className="role-label gold">
            <Sword size={16} />
            {teamName(s.players, p._id)}
          </span>
          <span className="role-label">
            <Shield size={16} />
            {teamName(s.players, target._id)}
          </span>
        </div>
        <p style={{ fontSize: 12 }}>
          Propõe {s.settings[0].initialSuggestionCount} opções para facilitar a
          marcação. O adversário tem {s.settings[0].acceptHours} horas para
          responder e pode aceitar logo um horário.
        </p>
        {weeklyWindowValue && (
          <p className="inset">
            {weeklyWindowValue.deferredUntil
              ? `Desafio adiado por férias: o jogo pode realizar-se a partir de ${weeklyWindowValue.deferredUntil}.`
              : "Um jogo por jogador nesta semana. Só podes desafiar defensores atribuídos pelo administrador."}
          </p>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={include}
            onChange={(e) => setInclude(e.target.checked)}
          />
          Propor horários já
        </label>
        {include && (
          <div className="stack proposal-grid">
            <small>
              Horários de Portugal (Europe/Lisbon). Revê as sugestões antes de
              enviar; cada janela deve permitir {s.settings[0].matchMinutes}{" "}
              minutos de jogo.
            </small>
            {proposals.map((p, i) => (
              <div key={i} className="inset stack gap-sm">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={(e) =>
                      setProposals(
                        proposals.map((x, j) =>
                          j === i ? { ...x, selected: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  <CalendarDays size={14} />
                  <strong>Opção {i + 1}</strong>
                </label>
                {p.selected && (
                  <>
                    <label>
                      Data da opção {i + 1}
                      <input
                        type="date"
                        required
                        value={p.day}
                        onChange={(e) =>
                          setProposals(
                            proposals.map((x, j) =>
                              j === i ? { ...x, day: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Início da opção {i + 1}
                        <input
                          type="time"
                          required
                          value={p.start}
                          onChange={(e) =>
                            setProposals(
                              proposals.map((x, j) =>
                                j === i ? { ...x, start: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Fim da opção {i + 1}
                        <input
                          type="time"
                          required
                          value={p.end}
                          onChange={(e) =>
                            setProposals(
                              proposals.map((x, j) =>
                                j === i ? { ...x, end: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            ))}
            {selected.length < 3 && (
              <p className="error">
                Seleciona pelo menos três opções ou combina os horários depois.
              </p>
            )}
          </div>
        )}
        {!include && (
          <p style={{ fontSize: 12 }}>
            Os dois jogadores propõem disponibilidade depois da aceitação, como
            habitualmente.
          </p>
        )}
        <button
          className="primary wide"
          disabled={busy || (include && selected.length < 3)}
        >
          <Sword size={15} />
          Enviar desafio
        </button>
      </form>
    </Modal>
  );
}

function AssignmentDialog(a: Actions & { close: () => void; c?: Challenge }) {
  const { s, run, busy, close, c } = a,
    router = useRouter(),
    [division, setDivision] = useState(c?.divisionId ?? s.divisions[0]._id),
    [attacker, setAttacker] = useState(c?.challengerId ?? ""),
    [defender, setDefender] = useState(c?.defenderId ?? "");
  const teams = rankingEntries(s.players, division).filter((entry) =>
    entry.members.some((member) => member.status === "active"),
  );
  const representative = (members: Player[], selected: string) =>
    members.find(
      (member) => member._id === selected && member.status === "active",
    ) ?? members.find((member) => member.status === "active")!;
  const attackerIds = teamMembers(s.players, attacker).map(
    (member) => member._id,
  );
  return (
    <Modal title="Atribuir ataque e defesa" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await run(
            {
              type: c ? "admin.challenge.assign" : "admin.challenge.create",
              challengeId: c?._id,
              challengerId: attacker,
              defenderId: defender,
            },
            c
              ? "Papéis atualizados. O defensor recebe um novo pedido de aceitação."
              : "Desafio atribuído. Jogadores notificados.",
          );
          if (result) {
            close();
            if (result.id) router.push("/desafios/" + result.id);
          }
        }}
      >
        <p style={{ fontSize: 12 }}>
          Define quem ataca e quem defende neste desafio. A intervenção fica no
          histórico. Os dois jogadores recebem uma notificação.
        </p>
        <label>
          Divisão do confronto
          <select
            value={division}
            disabled={!!c}
            onChange={(e) => {
              setDivision(e.target.value);
              setAttacker("");
              setDefender("");
            }}
          >
            {s.divisions.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="role-label gold">
            <Sword size={15} />
            Ataque · desafiante
          </span>
          <select
            aria-label="Jogador em ataque"
            required
            value={attacker}
            onChange={(e) => {
              setAttacker(e.target.value);
              if (
                teamMembers(s.players, e.target.value).some(
                  (member) => member._id === defender,
                )
              )
                setDefender("");
            }}
          >
            <option value="">Escolher atacante</option>
            {teams.map((entry) => (
              <option
                key={entry.id}
                value={representative(entry.members, attacker)._id}
              >
                {entry.members.map((member) => member.name).join(" + ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="role-label">
            <Shield size={15} />
            Defesa · defensor
          </span>
          <select
            aria-label="Jogador em defesa"
            required
            value={defender}
            onChange={(e) => setDefender(e.target.value)}
          >
            <option value="">Escolher defensor</option>
            {teams
              .filter(
                (entry) =>
                  !entry.members.some((member) =>
                    attackerIds.includes(member._id),
                  ),
              )
              .map((entry) => (
                <option
                  key={entry.id}
                  value={representative(entry.members, defender)._id}
                >
                  {entry.members.map((member) => member.name).join(" + ")}
                </option>
              ))}
          </select>
        </label>
        {c && (
          <p className="inset" style={{ fontSize: 12 }}>
            A alteração volta a pedir aceitação e retira as propostas de horário
            anteriores. O histórico é preservado.
          </p>
        )}
        <button
          className="primary"
          disabled={
            busy ||
            !attacker ||
            !defender ||
            (c?.challengerId === attacker && c?.defenderId === defender)
          }
        >
          <Sword size={15} />
          <Shield size={15} />
          Guardar atribuição
        </button>
      </form>
    </Modal>
  );
}

function LeagueInformation(a: Actions & { page: "regras" | "premios" }) {
  const { s, page, run, busy } = a,
    admin = s.actor.role === "admin",
    rules = s.settings[0];
  const [text, setText] = useState(rules.rulesText),
    [prizes, setPrizes] = useState(rules.prizes),
    [editing, setEditing] = useState(false);
  const isRules = page === "regras";
  async function save() {
    if (
      await run(
        {
          type: "admin.content.save",
          ...(isRules ? { rulesText: text } : { prizes }),
        },
        "Informação da liga publicada.",
      )
    )
      setEditing(false);
  }
  const rulesItems = [
    ...(rules.weeklyCompetition
      ? [
          [
            "Competição semanal",
            "Semana de segunda a domingo, com um jogo por jogador. O administrador publica os papéis de ataque e defesa antes dos desafios. Em férias, a posição fica congelada e os desafios podem ser jogados após o regresso.",
          ],
        ]
      : []),
    [
      "Confirmação da marcação",
      rules.requireClubConfirmation
        ? "Atacante e defensor aceitam o horário. Depois, o clube confirma a disponibilidade do campo. Só então o jogo fica marcado."
        : "Os dois jogadores aceitam o horário. A confirmação do clube está dispensada nas regras atuais.",
    ],
    [
      "Quem podes desafiar",
      `Até ${rules.maxPositionsAbove} posições acima, na mesma divisão, com ambos os jogadores ativos.`,
    ],
    [
      "Desafios em simultâneo",
      `No máximo ${rules.maxActiveChallenges} por jogador. Intervalo mínimo entre novos desafios: ${rules.minDaysBetween} dias.`,
    ],
    [
      "Prazos",
      `${rules.acceptHours} horas para aceitar, ${rules.scheduleDays} dias para marcar após a aceitação e ${rules.playDays} dias para jogar após a criação.`,
    ],
    [
      "Marcação",
      `Propõe ${rules.initialSuggestionCount} opções de calendário ou combina depois. O jogo dura ${rules.matchMinutes} minutos; as opções compatíveis têm intervalos de ${rules.slotStepMinutes} minutos.`,
    ],
    [
      "Ranking",
      rules.rankingModel === "swap"
        ? "Se o desafiante vencer um adversário acima, trocam de posição. As posições intermédias mantêm-se."
        : "Se o desafiante vencer um adversário acima, ocupa a posição dele e os jogadores intermédios descem um lugar.",
    ],
    [
      "Recusas",
      rules.refusalRule === "busy_only"
        ? "Só podes recusar quando já tens outro desafio aceite ou ativo."
        : rules.refusalRule === "forfeit"
          ? "A recusa dá derrota, exceto por lesão."
          : "Podes recusar indicando um motivo. O administrador é notificado.",
    ],
    [
      "Cancelamentos",
      rules.cancellationRule === "admin_only"
        ? "Só o administrador pode cancelar um desafio."
        : "Os participantes podem cancelar um desafio, indicando o motivo.",
    ],
    [
      "Resultados",
      "Só o administrador regista resultados. Os sets são opcionais e não atribuem pontos. Ao guardar o vencedor, o sistema atualiza automaticamente vitórias, derrotas e ranking segundo o modelo configurado.",
    ],
    [
      "Title Fight",
      `Podem desafiar o campeão jogadores até à posição ${rules.titleMaxPosition}. ${rules.titleChangesOnWin ? "O vencedor fica com o título." : "O título é gerido pelo administrador."}`,
    ],
    [
      "Promoções e despromoções",
      `No fecho da época, o administrador pode aplicar ${rules.promotionCount} subidas e ${rules.relegationCount} descidas entre divisões.`,
    ],
  ];
  return (
    <>
      <Heading
        eyebrow="INFORMAÇÃO DA LIGA"
        title={isRules ? "Regras da arena" : "Prémios da liga"}
        description={
          isRules
            ? "Consulta as regras em vigor antes de entrares em campo."
            : "As conquistas e os prémios anunciados pelo Neiva Padel Club."
        }
        right={
          admin ? (
            <button
              onClick={() => {
                setText(rules.rulesText);
                setPrizes(rules.prizes);
                setEditing(true);
              }}
            >
              <Settings2 size={15} />
              Editar {isRules ? "regulamento" : "prémios"}
            </button>
          ) : undefined
        }
      />
      {isRules ? (
        <div className="detail-grid">
          <Section
            title="Regras em vigor"
            right={<BookOpen size={19} className="gold" />}
          >
            <div className="stack">
              {rulesItems.map(([title, description], i) => (
                <div className="inset" key={title}>
                  <div className="row">
                    <span className="badge gold">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3>{title}</h3>
                  </div>
                  <p style={{ fontSize: 12, marginTop: 12 }}>{description}</p>
                </div>
              ))}
            </div>
          </Section>
          <div className="stack" style={{ alignContent: "start" }}>
            <Section title="Regulamento do clube">
              {rules.rulesText ? (
                <p style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
                  {rules.rulesText}
                </p>
              ) : (
                <p>
                  O regulamento complementar será publicado pelo clube. As
                  regras de competição em vigor estão descritas ao lado.
                </p>
              )}
            </Section>
            <Link href="/premios" className="button">
              <Gift size={16} />
              Consultar prémios
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : rules.prizes.length ? (
        <div className="three-grid">
          {rules.prizes.map((p, i) => (
            <Section
              key={i}
              title={p.title}
              right={<Gift className="gold" size={22} />}
            >
              <div className="stack">
                <span className="badge gold">
                  {p.divisionId
                    ? s.divisions.find((d) => d._id === p.divisionId)?.name
                    : "Todas as divisões"}
                  {p.placement ? " · " + p.placement : ""}
                </span>
                <p style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>
                  {p.description}
                </p>
              </div>
            </Section>
          ))}
        </div>
      ) : (
        <Section title="Prémios a anunciar">
          <Empty text="O clube ainda não publicou os prémios desta competição. Assim que forem definidos, podes consultá-los aqui." />
        </Section>
      )}
      {editing && (
        <Modal
          title={isRules ? "Publicar regulamento" : "Gerir prémios"}
          close={() => setEditing(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await save();
            }}
          >
            {isRules ? (
              <label>
                Regulamento complementar
                <textarea
                  rows={12}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={12000}
                />
                <small>
                  As regras numéricas são alteradas em Administração → Regras.
                </small>
              </label>
            ) : (
              <div className="stack">
                {prizes.map((p, i) => (
                  <div className="inset stack" key={i}>
                    <div className="row between">
                      <h3>Prémio {i + 1}</h3>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Remover prémio ${i + 1}`}
                        onClick={() =>
                          setPrizes(prizes.filter((_, j) => j !== i))
                        }
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <label>
                      Nome do prémio
                      <input
                        required
                        minLength={2}
                        maxLength={150}
                        value={p.title}
                        onChange={(e) =>
                          setPrizes(
                            prizes.map((x, j) =>
                              j === i ? { ...x, title: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Descrição
                      <textarea
                        maxLength={2000}
                        value={p.description}
                        onChange={(e) =>
                          setPrizes(
                            prizes.map((x, j) =>
                              j === i
                                ? { ...x, description: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Divisão
                      <select
                        value={p.divisionId}
                        onChange={(e) =>
                          setPrizes(
                            prizes.map((x, j) =>
                              j === i
                                ? { ...x, divisionId: e.target.value }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="">Todas as divisões</option>
                        {s.divisions.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Classificação ou condição
                      <input
                        maxLength={150}
                        value={p.placement}
                        placeholder="Ex.: Campeão da divisão"
                        onChange={(e) =>
                          setPrizes(
                            prizes.map((x, j) =>
                              j === i ? { ...x, placement: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={prizes.length >= 30}
                  onClick={() =>
                    setPrizes([
                      ...prizes,
                      {
                        title: "",
                        description: "",
                        divisionId: "",
                        placement: "",
                      },
                    ])
                  }
                >
                  <Plus size={14} />
                  Adicionar prémio
                </button>
              </div>
            )}
            <button className="primary" disabled={busy}>
              Publicar
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function ChallengeCalendar(a: Actions & { c: Challenge }) {
  const { s, c, run, busy, notify } = a,
    admin = s.actor.role === "admin",
    mine = involves(c, s.actor.playerId),
    status = effectiveStatus(c);
  const slots = s.slots.filter((x) => x.challengeId === c._id),
    anchor =
      c.scheduleProposal?.start ??
      c.scheduledAt ??
      (c.deferredUntil ? c.deferredUntil + "T12:00:00Z" : undefined) ??
      slots.slice().sort((a, b) => a.start.localeCompare(b.start))[0]?.start ??
      new Date().toISOString();
  const [week, setWeek] = useState(() => clubWeek(anchor).start),
    [selected, setSelected] = useState(() => clubDay(anchor)),
    [adding, setAdding] = useState(false);
  const canPropose =
    (mine || admin) &&
    (status === "accepted" ||
      (status === "pending" && (admin || s.actor.playerId === c.challengerId)));
  const selectedSlots = slots.filter((x) => clubDay(x.start) === selected),
    scheduledDay = c.scheduledAt ? clubDay(c.scheduledAt) : null;
  const compatible = compatibleStarts(
    slots.filter((x) => x.playerId === c.challengerId),
    slots.filter((x) => x.playerId === c.defenderId),
    c.durationMinutes,
    s.settings[0].slotStepMinutes,
    Date.now(),
    Date.parse(c.playBy),
  );
  const proposal = c.scheduleProposal,
    myConfirmed =
      proposal &&
      (s.actor.playerId === c.challengerId
        ? proposal.challengerConfirmed
        : proposal.defenderConfirmed);
  const name = (id: string) =>
    s.players.find((p) => p._id === id)?.name ?? "Jogador";
  return (
    <>
      <Section
        title="Calendário do desafio"
        right={<CalendarDays size={20} className="gold" />}
      >
        <div className="stack">
          <p style={{ fontSize: 12 }}>
            {status === "pending"
              ? "O desafio aguarda aceitação. Consulta as propostas no calendário."
              : status === "accepted"
                ? "Escolhe um dia e aceita uma proposta do adversário, ou escolhe um horário em comum. O jogo só fica marcado após as confirmações necessárias."
                : c.scheduledAt
                  ? "O jogo está assinalado no calendário. Seleciona o dia para consultar os detalhes."
                  : status === "expired"
                    ? "O prazo expirou. O administrador pode prolongá-lo para voltar a marcar."
                    : "Consulta as datas e propostas deste desafio."}
          </p>
          {status === "pending" && admin && (
            <button
              disabled={busy}
              onClick={() =>
                run(
                  {
                    type: "challenge.respond",
                    challengeId: c._id,
                    accept: true,
                  },
                  "Desafio aceite pelo administrador em nome do defensor.",
                )
              }
            >
              <Check size={14} />
              Aceitar desafio pelo defensor
            </button>
          )}
          {status === "schedule_pending" && proposal && (
            <div className="inset stack" role="status">
              <h3>
                Horário escolhido · {fmtDate(proposal.start)} ·{" "}
                {fmtTime(proposal.start)}
              </h3>
              {mine && !myConfirmed ? (
                <>
                  <p>Falta confirmares a tua presença neste horário.</p>
                  <button
                    className="primary wide"
                    disabled={busy}
                    onClick={() =>
                      run(
                        {
                          type: "match.confirm_time",
                          challengeId: c._id,
                          proposalId: proposal._id,
                        },
                        "Presença confirmada. A aguardar as restantes confirmações.",
                      )
                    }
                  >
                    <Check size={16} /> Confirmar a minha presença
                  </button>
                </>
              ) : (
                <p className="success">
                  {mine ? "A tua presença já está confirmada. " : ""}
                  {proposal.challengerConfirmed && proposal.defenderConfirmed
                    ? "A aguardar confirmação do campo pelo clube."
                    : "A aguardar confirmação do adversário."}
                </p>
              )}
              <small>
                Atacante:{" "}
                {proposal.challengerConfirmed ? "confirmado" : "por confirmar"}{" "}
                · Defensor:{" "}
                {proposal.defenderConfirmed ? "confirmado" : "por confirmar"} ·
                Clube: {proposal.clubConfirmed ? "confirmado" : "por confirmar"}
              </small>
            </div>
          )}
          {(mine || admin) && !terminal.has(c.status) && (
            <CourtAvailability c={c} />
          )}
          <div className="calendar-month">
            <WeekNavigation
              week={week}
              onChange={(value) => {
                setWeek(value);
                setSelected(value);
              }}
            />
            <div
              className="calendar-days"
              aria-label="Calendário semanal do desafio"
            >
              {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((w) => (
                <span className="calendar-weekday" key={w}>
                  {w}
                </span>
              ))}
              {Array.from({ length: 7 }, (_, i) => {
                const day = addClubDays(week, i),
                  hasAttack = slots.some(
                    (x) =>
                      x.playerId === c.challengerId && clubDay(x.start) === day,
                  ),
                  hasDefense = slots.some(
                    (x) =>
                      x.playerId === c.defenderId && clubDay(x.start) === day,
                  ),
                  isMatch = scheduledDay === day;
                return (
                  <button
                    key={day}
                    aria-label={
                      new Date(day + "T12:00:00Z").toLocaleDateString("pt-PT", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }) + (isMatch ? " · Jogo marcado" : "")
                    }
                    aria-pressed={selected === day}
                    className={`calendar-day ${selected === day ? "selected" : ""} ${isMatch ? "match" : ""} ${day === clubDay(Date.now()) ? "today" : ""}`}
                    onClick={() => setSelected(day)}
                  >
                    <span>{Number(day.slice(-2))}</span>
                    <span className="calendar-markers">
                      {hasAttack && <span className="attack-dot" />}
                      {hasDefense && <span className="defense-dot" />}
                      {isMatch && <Check size={10} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="row wrap" style={{ fontSize: 10 }}>
            <span className="role-label gold">
              <Sword size={12} />
              Proposta de ataque
            </span>
            <span className="role-label positive">
              <Shield size={12} />
              Proposta de defesa
            </span>
            <span className="role-label">
              <Check size={12} />
              Jogo marcado
            </span>
          </div>
          <div className="inset stack">
            <h3>{fmtDate(selected + "T12:00:00Z")}</h3>
            {scheduledDay === selected && c.scheduledAt && (
              <div className="success">
                <strong>Jogo marcado · {fmtTime(c.scheduledAt)}</strong>
                <div>
                  {s.courts.find((x) => x._id === c.courtId)?.name ??
                    "Campo por definir"}{" "}
                  · {c.durationMinutes} minutos
                </div>
              </div>
            )}
            {selectedSlots.map((x) => (
              <div className="slot wrap" key={x._id}>
                <div>
                  <span
                    className={`role-label ${x.playerId === c.challengerId ? "gold" : "positive"}`}
                  >
                    {x.playerId === c.challengerId ? (
                      <Sword size={13} />
                    ) : (
                      <Shield size={13} />
                    )}{" "}
                    {name(x.playerId)}
                  </span>
                  <div>
                    {fmtTime(x.start)}–{fmtTime(x.end)}
                  </div>
                </div>
                {mine &&
                  x.playerId !== s.actor.playerId &&
                  (status === "accepted" ||
                    (status === "pending" &&
                      s.actor.playerId === c.defenderId)) &&
                  Date.parse(x.start) > Date.now() && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          {
                            type: "match.accept_slot",
                            challengeId: c._id,
                            slotId: x._id,
                          },
                          "Horário aceite. Consulta as confirmações dos jogadores e do clube.",
                        )
                      }
                    >
                      <Check size={14} /> Escolher e aceitar este horário
                    </button>
                  )}
                {["pending", "accepted"].includes(status) &&
                  (admin || x.playerId === s.actor.playerId) && (
                    <button
                      className="icon-button"
                      aria-label={`Remover proposta de ${name(x.playerId)}`}
                      onClick={() =>
                        run(
                          { type: "slot.delete", slotId: x._id },
                          "Proposta removida.",
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  )}
              </div>
            ))}
            {!selectedSlots.length && scheduledDay !== selected && (
              <p style={{ fontSize: 12 }}>Não há propostas para este dia.</p>
            )}
            {canPropose && (
              <button
                className="primary"
                disabled={
                  busy ||
                  selected < clubDay(Date.now()) ||
                  selected > clubDay(c.playBy)
                }
                onClick={() => setAdding(true)}
              >
                <Plus size={14} />
                Propor horário neste dia
              </button>
            )}
            {status === "pending" &&
              !admin &&
              s.actor.playerId === c.defenderId && (
                <small>
                  Aceita o desafio para propor a tua disponibilidade.
                </small>
              )}
          </div>
          {(admin || mine) && status === "accepted" && (
            <div className="inset stack">
              <h3>Horários em comum</h3>
              {compatible.length ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    await run(
                      {
                        type: "match.schedule",
                        challengeId: c._id,
                        start: f.get("start"),
                        courtId: f.get("courtId") || undefined,
                      },
                      "Horário proposto. A aguardar as confirmações.",
                    );
                  }}
                >
                  <label>
                    Horário compatível
                    <select name="start">
                      {compatible.map((t) => (
                        <option value={t} key={t}>
                          {fmtDate(t)} · {fmtTime(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Campo para o jogo
                    <select name="courtId">
                      <option value="">Definir depois</option>
                      {s.courts
                        .filter((c) => c.active)
                        .map((c) => (
                          <option value={c._id} key={c._id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="primary" disabled={busy}>
                    Propor horário em comum
                  </button>
                </form>
              ) : (
                <p style={{ fontSize: 12 }}>
                  Ainda não há horários compatíveis. Indica a tua
                  disponibilidade no calendário ou aceita uma proposta do
                  adversário.
                </p>
              )}
            </div>
          )}
        </div>
      </Section>
      {adding && (
        <Modal
          title="Propor horário no calendário"
          close={() => setAdding(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              try {
                if (
                  await run(
                    {
                      type: "slot.add",
                      challengeId: c._id,
                      playerId: admin ? data.get("playerId") : undefined,
                      start: clubDateTime(
                        String(data.get("day")),
                        String(data.get("start")),
                      ),
                      end: clubDateTime(
                        String(data.get("day")),
                        String(data.get("end")),
                      ),
                    },
                    "Horário adicionado ao calendário.",
                  )
                )
                  setAdding(false);
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            <p style={{ fontSize: 12 }}>
              Horários de Portugal · a janela deve permitir {c.durationMinutes}{" "}
              minutos de jogo.
            </p>
            {admin && (
              <label>
                Disponibilidade de
                <select
                  aria-label="Jogador da proposta"
                  name="playerId"
                  defaultValue={c.challengerId}
                >
                  {[
                    c.challengerId,
                    ...(status === "accepted" ? [c.defenderId] : []),
                  ].map((pid) => (
                    <option value={pid} key={pid}>
                      {name(pid)} ·{" "}
                      {pid === c.challengerId ? "Ataque" : "Defesa"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Dia do horário
              <input type="date" name="day" defaultValue={selected} required />
            </label>
            <div className="form-grid">
              <label>
                Hora inicial
                <input type="time" name="start" defaultValue="19:00" required />
              </label>
              <label>
                Hora final
                <input type="time" name="end" defaultValue="22:00" required />
              </label>
            </div>
            <button disabled={busy} className="primary">
              Guardar horário no calendário
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function IncomingTimeOffers({ s, c, run, busy }: Actions & { c: Challenge }) {
  const mine = involves(c, s.actor.playerId),
    status = effectiveStatus(c);
  if (
    !mine ||
    !["pending", "accepted"].includes(status) ||
    (status === "pending" && s.actor.playerId !== c.defenderId)
  )
    return null;
  const offers = s.slots
    .filter(
      (x) =>
        x.challengeId === c._id &&
        x.playerId !== s.actor.playerId &&
        Date.parse(x.start) > Date.now(),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!offers.length) return null;
  return (
    <Section
      title="Horários propostos pelo adversário"
      right={<CalendarDays className="gold" size={20} />}
    >
      <div className="stack">
        <p style={{ fontSize: 12 }}>
          Escolhe uma proposta e toca em{" "}
          <strong className="gold">Aceitar este horário</strong>. Depois dos
          jogadores, o clube confirma o campo.
        </p>
        {offers.map((offer, i) => (
          <div key={offer._id} className="inset stack gap-sm">
            <span className="eyebrow gold">OPÇÃO {i + 1}</span>
            <strong>
              {fmtDate(offer.start)} · {fmtTime(offer.start)}
            </strong>
            <small>
              Janela disponível: {fmtTime(offer.start)}–{fmtTime(offer.end)} ·
              jogo de {c.durationMinutes} minutos
            </small>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(
                  {
                    type: "match.accept_slot",
                    challengeId: c._id,
                    slotId: offer._id,
                  },
                  "Horário aceite. Consulta as confirmações dos jogadores e do clube.",
                )
              }
            >
              <Check size={15} />
              Aceitar este horário
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TimeConfirmation({ s, c, run, busy }: Actions & { c: Challenge }) {
  const [rejecting, setRejecting] = useState(false),
    proposal = c.scheduleProposal;
  if (!proposal || !["schedule_pending", "scheduled"].includes(c.status))
    return null;
  const mine = involves(c, s.actor.playerId),
    admin = s.actor.role === "admin",
    both = proposal.challengerConfirmed && proposal.defenderConfirmed,
    isFinal = c.status === "scheduled",
    myConfirmed =
      s.actor.playerId === c.challengerId
        ? proposal.challengerConfirmed
        : proposal.defenderConfirmed;
  const label = (id: string) =>
    s.players.find((p) => p._id === id)?.name ?? "Jogador";
  return (
    <>
      <Section
        title={isFinal ? "Jogo confirmado" : "Confirmar o horário proposto"}
        right={
          <span className={`badge ${isFinal ? "positive" : "gold"}`}>
            {isFinal
              ? "Três partes confirmadas"
              : both
                ? "A aguardar o clube"
                : "A aguardar jogadores"}
          </span>
        }
        className="time-confirmation"
      >
        <div className="stack">
          <div className="inset">
            <h3 className="gold">
              {fmtDate(proposal.start)} · {fmtTime(proposal.start)}
            </h3>
            <p style={{ fontSize: 12, marginTop: 7 }}>
              {proposal.minutes} minutos ·{" "}
              {s.courts.find((x) => x._id === proposal.courtId)?.name ??
                "Campo a confirmar pelo clube"}
            </p>
          </div>
          <div className="confirmation-parties">
            {[
              {
                name: "Atacante",
                person: label(c.challengerId),
                ok: proposal.challengerConfirmed,
                icon: Sword,
              },
              {
                name: "Defensor",
                person: label(c.defenderId),
                ok: proposal.defenderConfirmed,
                icon: Shield,
              },
              {
                name: "Clube",
                person: "Neiva Padel Club",
                ok:
                  proposal.clubConfirmed ||
                  (isFinal && !s.settings[0].requireClubConfirmation),
                icon: Home,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`inset party ${p.ok ? "confirmed" : ""}`}
              >
                <p.icon size={20} />
                <strong>{p.name}</strong>
                <small>{p.person}</small>
                <span className={`badge ${p.ok ? "positive" : "gold"}`}>
                  {p.ok ? <Check size={12} /> : <Clock3 size={12} />}{" "}
                  {p.ok ? "Confirmado" : "Por confirmar"}
                </span>
              </div>
            ))}
          </div>
          {!isFinal && mine && !myConfirmed && (
            <button
              className="primary wide"
              disabled={busy}
              onClick={() =>
                run(
                  {
                    type: "match.confirm_time",
                    challengeId: c._id,
                    proposalId: proposal._id,
                  },
                  "Confirmaste o horário. Falta a confirmação das restantes partes.",
                )
              }
            >
              <Check size={16} />
              Aceitar horário proposto
            </button>
          )}
          {!isFinal && mine && myConfirmed && (
            <p className="success">
              Já aceitaste este horário.{" "}
              {both
                ? "Falta o clube confirmar o campo."
                : "Falta o adversário aceitar."}
            </p>
          )}
          {!isFinal && admin && (
            <form
              key={proposal._id}
              onSubmit={async (e) => {
                e.preventDefault();
                await run(
                  {
                    type: "admin.match.approve",
                    challengeId: c._id,
                    proposalId: proposal._id,
                    courtId: new FormData(e.currentTarget).get("courtId"),
                  },
                  "Clube confirmou o campo. Jogo marcado!",
                );
              }}
            >
              <label>
                Campo confirmado pelo clube
                <select
                  name="courtId"
                  required
                  defaultValue={proposal.courtId ?? ""}
                >
                  <option value="">Escolher campo disponível</option>
                  {s.courts
                    .filter((x) => x.active)
                    .map((x) => (
                      <option value={x._id} key={x._id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </label>
              {!both && (
                <p style={{ fontSize: 12 }}>
                  O clube só pode confirmar depois de o atacante e o defensor
                  aceitarem este horário.
                </p>
              )}
              <button className="primary" disabled={busy || !both}>
                <Check size={15} />
                Confirmar campo e marcar jogo
              </button>
            </form>
          )}
          {!isFinal && (mine || admin) && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => setRejecting(true)}
            >
              {admin
                ? "Clube sem disponibilidade / recusar horário"
                : "Recusar este horário"}
            </button>
          )}
        </div>
      </Section>
      {rejecting && (
        <Modal
          title="Recusar proposta de horário"
          close={() => setRejecting(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  {
                    type: admin ? "admin.match.reject" : "match.reject_time",
                    challengeId: c._id,
                    proposalId: proposal._id,
                    note: new FormData(e.currentTarget).get("note"),
                  },
                  "Horário recusado. Os jogadores podem combinar outra data.",
                )
              )
                setRejecting(false);
            }}
          >
            <label>
              Motivo
              <textarea name="note" required minLength={3} />
            </label>
            <button className="danger" disabled={busy}>
              Confirmar recusa do horário
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
