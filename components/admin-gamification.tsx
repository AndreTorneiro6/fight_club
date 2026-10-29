"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Player, View } from "@/lib/types";
import {
  defaultAvatar,
  defaultSocial,
  defaultGamificationSettings,
  socialKeys,
  type AvatarStyle,
  type GamificationProfile,
  type GamificationSettings,
} from "@/lib/gamification-types";
import { useEngagement } from "./engagement-client";
import LeagueCardArtwork from "./league-card-artwork";
import CardSignature from "./card-signature";
import AdminCoins from "./admin-coins";
import { exportTwoSidedCard } from "./gamification-export";
import styles from "./gamification.module.css";
type Props = {
  state: View;
  run: (command: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
};
type CardDraft = {
  nickname: string;
  slogan: string;
  signature: NonNullable<GamificationProfile["signature"]>;
  avatar: AvatarStyle;
  social: GamificationProfile["social"];
  version: number;
  settingsVersion: number;
};
function Cards({ state, run, busy }: Props) {
  const { data, error } = useEngagement(state);
  const settings =
    state.gamificationSettings?.[0] ?? defaultGamificationSettings;
  const players = state.players
    .filter(
      (p) =>
        p.status !== "removed" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  const [playerId, setPlayerId] = useState(state.actor.playerId),
    [draft, setDraft] = useState<CardDraft | null>(null),
    [back, setBack] = useState(false),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState("");
  const frontRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLElement>(null);
  const [cartoon, setCartoon] = useState<{
    source: string;
    url: string;
  } | null>(null);
  const [cartoonError, setCartoonError] = useState("");
  const [cartoonAttempt, setCartoonAttempt] = useState(0);
  const player = players.find((p) => p._id === playerId),
    saved = state.gamificationProfiles?.find((p) => p.playerId === playerId);
  const live: CardDraft = {
    nickname: saved?.nickname ?? "",
    slogan: saved?.slogan ?? "",
    signature: saved?.signature ?? [],
    avatar: saved?.avatar ?? defaultAvatar,
    social: saved?.social ?? defaultSocial,
    version: saved?.version ?? 0,
    settingsVersion: settings.version,
  };
  const value = draft ?? live,
    conflict =
      !!draft &&
      ((saved?.version ?? 0) !== draft.version ||
        settings.version !== draft.settingsVersion);
  const sourcePhoto = player?.photo ?? "";
  const cartoonUrl = cartoon?.source === sourcePhoto ? cartoon.url : "";
  useEffect(() => {
    setCartoonError("");
    if (!sourcePhoto) return;
    const match = /^\/api\/photos\/([a-zA-Z0-9-]{1,80})$/.exec(sourcePhoto);
    if (!match) {
      setCartoonError("Carrega a fotografia no Perfil para gerar o cartoon.");
      return;
    }
    const controller = new AbortController();
    let objectUrl = "";
    void fetch(`/api/photos/${match[1]}/cartoon`, {
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Não foi possível gerar o cartoon. Tenta novamente.");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setCartoon({ source: sourcePhoto, url: objectUrl });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setCartoonError("Não foi possível gerar o cartoon. Tenta novamente.");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourcePhoto, cartoonAttempt]);
  const personal = data?.personalCards.find((p) => p.playerId === playerId);
  const division = state.divisions.find((d) => d._id === player?.divisionId);
  const change = (patch: Partial<CardDraft>) =>
    setDraft({ ...value, ...patch });
  useEffect(() => {
    if (!draft) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [draft]);
  async function save() {
    const result = await run(
      {
        type: "admin.gamification.profile",
        playerId,
        expectedVersion: value.version,
        expectedSettingsVersion: value.settingsVersion,
        nickname: value.nickname,
        slogan: value.slogan,
        signature: value.signature,
        avatar: value.avatar,
        social: value.social,
      },
      "Avatar e verso da carta guardados em teste privado.",
    );
    if (result) {
      setDraft(null);
      setMessage("");
    }
  }
  async function download() {
    if (!saved || !player || draft) return;
    setExporting(true);
    setMessage("");
    try {
      const front = frontRef.current?.querySelector("svg");
      const backSvg = backRef.current?.querySelector("svg");
      if (!front || !backSvg) throw new Error("Carta indisponível.");
      await exportTwoSidedCard(front, backSvg);
      setMessage("Imagem com frente e verso descarregada.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="panel stack">
      <label>
        Jogador para testar a carta
        <select
          disabled={busy}
          aria-label="Jogador para testar a carta"
          value={playerId}
          onChange={(e) => {
            if (
              draft &&
              !window.confirm(
                "Descartar as alterações por guardar deste jogador?",
              )
            )
              return;
            setPlayerId(e.target.value);
            setDraft(null);
            setBack(false);
            setMessage("");
          }}
        >
          <option value="">Seleciona um jogador</option>
          {players.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      {player ? (
        <div className={styles.columns}>
          <div className="stack">
            <div className="row wrap" aria-label="Escolher face da carta">
              <button aria-pressed={!back} onClick={() => setBack(false)}>
                Frente · Fotografia do perfil
              </button>
              <button aria-pressed={back} onClick={() => setBack(true)}>
                Verso · Cartoon
              </button>
            </div>
            <div className={styles.stage}>
              <div className={styles.card} data-face={back ? "back" : "front"}>
                <article
                  className={styles.face}
                  ref={frontRef}
                  aria-label="Frente da carta"
                  aria-hidden={back}
                >
                  <LeagueCardArtwork
                    player={player}
                    profile={value}
                    settings={settings}
                    attributes={personal}
                    stats={data?.cards.find((c) => c.playerId === playerId)}
                    theme={division?.code ?? "ouro"}
                    back={false}
                    photo={player.photo || ""}
                  />
                </article>
                <article
                  className={`${styles.face} ${styles.back}`}
                  ref={backRef}
                  aria-label="Verso da carta"
                  aria-hidden={!back}
                >
                  <LeagueCardArtwork
                    player={player}
                    profile={value}
                    settings={settings}
                    attributes={personal}
                    stats={data?.cards.find((c) => c.playerId === playerId)}
                    theme={division?.code ?? "ouro"}
                    back
                    photo={cartoonUrl}
                  />
                  {sourcePhoto && !cartoonUrl && (
                    <div className={styles.cartoonStatus} role="status">
                      <p>
                        {cartoonError ||
                          "A criar cartoon da fotografia de perfil…"}
                      </p>
                      {cartoonError && (
                        <button
                          type="button"
                          onClick={() => {
                            setCartoon(null);
                            setCartoonAttempt((n) => n + 1);
                          }}
                        >
                          Tentar novamente
                        </button>
                      )}
                    </div>
                  )}
                </article>
              </div>
            </div>
            <button aria-pressed={back} onClick={() => setBack(!back)}>
              Virar carta · {back ? "ver frente" : "ver verso"}
            </button>
            <button
              disabled={
                busy ||
                exporting ||
                !!draft ||
                !saved ||
                !data ||
                (!!sourcePhoto && !cartoonUrl)
              }
              onClick={() => void download()}
            >
              Exportar as duas faces (PNG)
            </button>
            <small>
              Guarda primeiro. A imagem contém as duas faces, o slogan e a
              assinatura. Usa uma fotografia carregada no Perfil para exportar.
            </small>
            {message && <p role="status">{message}</p>}
          </div>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void save().catch(() => {});
            }}
          >
            <h3>Personalizar a carta</h3>
            <p>
              O verso usa um cartoon gerado localmente da fotografia do Perfil.
              Sem foto, mostra as iniciais do jogador. Os atributos sociais são
              brincadeira e não são estatísticas verificadas nem avaliações de
              outros jogadores.
            </p>
            {conflict && (
              <div className="inset stack" role="alert">
                <p>
                  Outro administrador alterou a carta ou os nomes dos atributos.
                  O teu rascunho foi preservado.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Descartar o rascunho e carregar a versão atual?",
                      )
                    )
                      setDraft(null);
                  }}
                >
                  Carregar carta atual
                </button>
              </div>
            )}
            <label>
              Alcunha no verso
              <input
                disabled={busy}
                maxLength={40}
                value={value.nickname}
                onChange={(e) => change({ nickname: e.target.value })}
              />
            </label>
            <label>
              Slogan da carta
              <textarea
                disabled={busy}
                maxLength={100}
                rows={3}
                value={value.slogan}
                placeholder="Escolhe a frase que te representa"
                onChange={(e) => change({ slogan: e.target.value })}
              />
            </label>
            <CardSignature
              value={value.signature}
              disabled={busy}
              onChange={(signature) => change({ signature })}
            />
            <div className={styles.social}>
              {socialKeys.map((key) => (
                <label key={key}>
                  {settings.labels[key]}
                  <input
                    disabled={busy}
                    aria-label={`Valor social: ${settings.labels[key]}`}
                    type="number"
                    min={0}
                    max={99}
                    value={value.social[key]}
                    onChange={(e) =>
                      change({
                        social: {
                          ...value.social,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <small>
              Valores de 0 a 99, independentes das moedas, resultados,
              estatísticas oficiais e ranking. Os nomes são editáveis em
              Definições.
            </small>
            <button className="primary" disabled={busy || !draft || conflict}>
              Guardar avatar e carta
            </button>
            <span role="status" className="muted">
              {draft
                ? "Alterações por guardar"
                : saved
                  ? `Guardado · versão ${saved.version}`
                  : "Pré-visualização; ainda não existe personalização guardada"}
            </span>
            <p>
              A frente utiliza a fotografia real do perfil do jogador e os
              atributos de padel já guardados em Admin → Cartões e palpites. Se
              estiverem por definir, aparecem travessões.
            </p>
          </form>
        </div>
      ) : (
        <p>Escolhe um jogador da liga para testar.</p>
      )}
    </div>
  );
}
function SettingsEditor({ state, run, busy }: Props) {
  const live = state.gamificationSettings?.[0] ?? defaultGamificationSettings;
  const [draft, setDraft] = useState<GamificationSettings | null>(null);
  const value = draft ?? live;
  const conflict = !!draft && draft.version !== live.version;
  async function save() {
    const result = await run(
      {
        type: "admin.gamification.settings",
        expectedVersion: value.version,
        frontTitle: value.frontTitle,
        backTitle: value.backTitle,
        labels: value.labels,
      },
      "Definições da gamificação guardadas.",
    );
    if (result) setDraft(null);
  }
  useEffect(() => {
    if (!draft) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [draft]);
  return (
    <form
      className="panel stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save().catch(() => {});
      }}
    >
      <h3>Textos e atributos da carta</h3>
      <p>
        Os dois administradores partilham estas definições. Os valores de cada
        jogador continuam no seu cartão; mudar um nome não altera as pontuações
        guardadas.
      </p>
      {conflict && (
        <p role="alert">
          As definições mudaram noutra sessão.{" "}
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Descartar as alterações e carregar as definições atuais?",
                )
              )
                setDraft(null);
            }}
          >
            Carregar definições atuais
          </button>
        </p>
      )}
      <p>O cabeçalho da frente acompanha o modelo da divisão.</p>
      <label>
        Título do verso
        <input
          disabled={busy}
          required
          maxLength={40}
          value={value.backTitle}
          onChange={(e) => setDraft({ ...value, backTitle: e.target.value })}
        />
      </label>
      {socialKeys.map((key, i) => (
        <label key={key}>
          Nome do atributo social {i + 1}
          <input
            disabled={busy}
            required
            maxLength={40}
            value={value.labels[key]}
            onChange={(e) =>
              setDraft({
                ...value,
                labels: { ...value.labels, [key]: e.target.value },
              })
            }
          />
        </label>
      ))}
      <button className="primary" disabled={busy || !draft || conflict}>
        Guardar definições da gamificação
      </button>
      <small>
        A disponibilização a jogadores continua fechada. Não existe publicação
        automática nem uma opção para desbloquear modos de competição.
      </small>
    </form>
  );
}
export default function AdminGamification(
  props: Props & { onOpenAlbum: () => void },
) {
  const [tab, setTab] = useState("cards");
  if (props.state.actor.role !== "admin") return null;
  return (
    <section
      className={`stack ${styles.root}`}
      aria-label="Gamificação em teste privado"
    >
      <div className="panel stack">
        <h2>Gamificar · laboratório do clube</h2>
        <strong className="badge">
          Em implementação · teste privado para administradores
        </strong>
        <p>
          Avatares, cartas de duas faces e recompensas de participação. Nada
          nesta área altera o ranking ou fica disponível no espaço Jogador.
        </p>
        <div className={`stack gap-sm ${styles.guide}`}>
          <strong>Como testar</strong>
          <p>
            1. Escolhe um jogador com fotografia no Perfil e guarda a carta.
          </p>
          <p>2. Vira a carta para ver o verso e exporta as duas faces.</p>
          <p>
            3. No Bar e prémios, configura moedas/recompensas e testa as trocas.
          </p>
          <p>4. Ajusta os títulos e os nomes dos atributos em Definições.</p>
        </div>
        <div className="row wrap">
          <button disabled={props.busy} onClick={props.onOpenAlbum}>
            Abrir caderneta
          </button>
          <Link className="button" href="/premios">
            Consultar prémios da liga
          </Link>
        </div>
      </div>
      <nav className={styles.tabs} aria-label="Áreas da gamificação">
        {(
          [
            ["cards", "Cartas e avatares"],
            ["bar", "Bar e prémios"],
            ["settings", "Definições"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            disabled={props.busy}
            className={tab === id ? "primary" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div hidden={tab !== "cards"}>
        <Cards {...props} />
      </div>
      <div hidden={tab !== "bar"}>
        <AdminCoins {...props} />
      </div>
      <div hidden={tab !== "settings"}>
        <SettingsEditor {...props} />
      </div>
    </section>
  );
}
