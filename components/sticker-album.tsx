"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  StickerAlbumView,
  StickerPack,
  StickerRewardMetric,
} from "@/lib/sticker-types";
import { engagementCommand } from "./engagement-client";
import styles from "./sticker-album.module.css";
import { PlayerStickerArtwork } from "./player-sticker-artwork";
import { StickerCommunity, type StickerQuery } from "./sticker-community";

type Draft = {
  enabled: boolean;
  communityEnabled: boolean;
  tradesEnabled: boolean;
  maxTradeCopies: number;
  maxPendingTrades: number;
  tradeHours: number;
  dailyPacks: number;
  packSize: number;
  rewardEnabled: boolean;
  rewardTitle: string;
  rewardMetric: StickerRewardMetric;
  rewardTarget: number;
  version: number;
};
const defaults: Draft = {
  enabled: false,
  communityEnabled: false,
  tradesEnabled: false,
  maxTradeCopies: 10,
  maxPendingTrades: 5,
  tradeHours: 72,
  dailyPacks: 1,
  packSize: 3,
  rewardEnabled: false,
  rewardTitle: "Uma bebida no clube",
  rewardMetric: "visits",
  rewardTarget: 5,
  version: 0,
};
const metricNames = {
  visits: "Dias com saquetas abertas",
  matches: "Jogos oficiais confirmados",
  collection: "Coleção completa (%)",
};
export function StickerAlbum({
  revision,
  queryKey = "",
}: {
  revision?: unknown;
  queryKey?: string;
}) {
  const [albumTab, setAlbumTab] = useState<
    "collection" | "duplicates" | "community" | "negotiations" | "history"
  >("collection");
  const queryRef = useRef<StickerQuery>({});
  const lastQuery = useRef<string | null>(null);
  const reportId = new URLSearchParams(queryKey).get("report") ?? undefined;
  const [data, setData] = useState<StickerAlbumView | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(defaults),
    [dirty, setDirty] = useState(false),
    [query, setQuery] = useState(""),
    [division, setDivision] = useState(""),
    [ownership, setOwnership] = useState("all"),
    [revealed, setRevealed] = useState<StickerPack | null>(null),
    [motion, setMotion] = useState(false),
    [code, setCode] = useState(""),
    [reducedMotion, setReducedMotion] = useState(false);
  const previewRef = useRef<HTMLDialogElement>(null);
  const [focused, setFocused] = useState("");
  const focusedPlayer = data?.roster.find(
    (player) => player.playerId === focused,
  );
  const dirtyRef = useRef(false),
    editedSeason = useRef<string | null>(null),
    sequence = useRef(0),
    requestId = useRef<string | null>(null),
    busyRef = useRef(false);
  dirtyRef.current = dirty;
  const refresh = useCallback(async () => {
    const n = ++sequence.current;
    try {
      const params = new URLSearchParams();
      if (queryRef.current.seasonId)
        params.set("epoca", queryRef.current.seasonId);
      if (queryRef.current.tradeId)
        params.set("negociacao", queryRef.current.tradeId);
      if (queryRef.current.beforeMessageId)
        params.set("antes", queryRef.current.beforeMessageId);
      if (queryRef.current.messageId)
        params.set("mensagem", queryRef.current.messageId);
      const response = await fetch(`/api/album?${params}`, {
        cache: "no-store",
      });
      const value = await response.json();
      if (
        !response.ok &&
        sequence.current === n &&
        [401, 403].includes(response.status)
      )
        setData(null);
      if (!response.ok)
        throw new Error(
          value.error ?? "Não foi possível carregar a caderneta.",
        );
      if (sequence.current !== n) return;
      const album = value as StickerAlbumView;
      setData(album);
      if (!dirtyRef.current)
        setDraft(
          album.settings ? { ...defaults, ...album.settings } : defaults,
        );
    } catch (e) {
      if (sequence.current === n)
        setError(e instanceof Error ? e.message : "Erro de ligação.");
    }
  }, []);
  useEffect(() => {
    if (lastQuery.current !== queryKey) {
      const params = new URLSearchParams(queryKey);
      const hash = window.location.hash.slice(1);
      queryRef.current = {
        seasonId: params.get("epoca") ?? "",
        tradeId: params.get("negociacao") ?? "",
        messageId: hash.startsWith("mensagem-") ? hash.slice(9) : "",
      };
      if (params.has("negociacao") || params.has("negociacoes"))
        setAlbumTab("negotiations");
      else if (params.has("report")) setAlbumTab("history");
      lastQuery.current = queryKey;
    }
    void refresh();
    return () => {
      sequence.current++;
    };
  }, [refresh, revision, queryKey]);
  const selectTrade = useCallback(
    async (query: StickerQuery) => {
      setRevealed(null);
      if (query.seasonId !== queryRef.current.seasonId)
        requestId.current = null;
      previewRef.current?.close();
      queryRef.current = {
        seasonId: query.seasonId,
        tradeId: query.tradeId,
        beforeMessageId: query.beforeMessageId ?? "",
        messageId: query.messageId ?? "",
      };
      setData((previous) =>
        previous && previous.trading
          ? {
              ...previous,
              trading: {
                ...previous.trading,
                selectedTrade: null,
                messages: [],
              },
            }
          : previous,
      );
      setAlbumTab(query.tradeId ? "negotiations" : "collection");
      const params = new URLSearchParams(window.location.search);
      if (query.seasonId) params.set("epoca", query.seasonId);
      else params.delete("epoca");
      if (query.tradeId) params.set("negociacao", query.tradeId);
      else params.delete("negociacao");
      params.delete("report");
      const next = params.toString();
      // Next's native-history integration updates the parent useSearchParams as well.
      lastQuery.current = next;
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${next ? `?${next}` : ""}`,
      );
      await refresh();
    },
    [refresh],
  );
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setMotion(false);
    };
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const act = useCallback(
    async (command: unknown, success: string) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setError("");
      setMessage("");
      try {
        const result = await engagementCommand(command);
        queryRef.current.beforeMessageId = "";
        queryRef.current.messageId = "";
        if (result?.unavailable) {
          await refresh();
          throw new Error(
            result.reason ?? "A negociação já não está disponível.",
          );
        }
        setMessage(success);
        await refresh();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível concluir.");
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  const openPack = useCallback(async () => {
    if (
      !data?.season ||
      !data.settings?.enabled ||
      data.remainingPacks < 1 ||
      busyRef.current
    )
      return;
    requestId.current ??= crypto.randomUUID();
    const result = await act(
      {
        type: data.isAdmin ? "admin.stickers.open" : "stickers.open",
        seasonId: data.season._id,
        requestId: requestId.current,
      },
      "Saqueta aberta. Os cromos foram guardados na tua coleção.",
    );
    if (result?.pack) {
      setRevealed(result.pack);
      requestId.current = null;
    }
  }, [data, act]);
  useEffect(() => {
    if (!motion) return;
    let previous = 0;
    const shake = (event: DeviceMotionEvent) => {
      const a = event.acceleration;
      if (!a) return;
      const strength =
        Math.abs(a.x ?? 0) + Math.abs(a.y ?? 0) + Math.abs(a.z ?? 0);
      if (strength > 24 && Date.now() - previous > 3000) {
        previous = Date.now();
        void openPack();
      }
    };
    window.addEventListener("devicemotion", shake);
    return () => window.removeEventListener("devicemotion", shake);
  }, [motion, openPack]);
  async function enableMotion() {
    try {
      const api = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<string>;
      };
      if (!api)
        throw new Error(
          "Este dispositivo não suporta o movimento. Usa o botão Abrir saqueta.",
        );
      if (
        api.requestPermission &&
        (await api.requestPermission()) !== "granted"
      )
        throw new Error(
          "Movimento não autorizado. Podes abrir a saqueta pelo botão.",
        );
      setMotion(true);
      setMessage(
        "Movimento ativo. Abana o telemóvel para abrir uma saqueta; o botão continua disponível.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Usa o botão para abrir a saqueta.",
      );
    }
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (!dirtyRef.current) editedSeason.current = data?.season?._id ?? null;
    setDirty(true);
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function save() {
    if (!data?.season) return;
    if (editedSeason.current && editedSeason.current !== data.season._id) {
      setError(
        "Este rascunho pertence a outra época. Carrega a configuração atual antes de guardar.",
      );
      return;
    }
    const result = await act(
      {
        type: "admin.stickers.settings",
        seasonId: data.season._id,
        expectedVersion: draft.version,
        enabled: draft.enabled,
        communityEnabled: draft.communityEnabled,
        tradesEnabled: draft.tradesEnabled,
        maxTradeCopies: draft.maxTradeCopies,
        maxPendingTrades: draft.maxPendingTrades,
        tradeHours: draft.tradeHours,
        dailyPacks: draft.dailyPacks,
        packSize: draft.packSize,
        rewardEnabled: draft.rewardEnabled,
        rewardTitle: draft.rewardTitle,
        rewardMetric: draft.rewardMetric,
        rewardTarget: draft.rewardTarget,
      },
      "Configuração da prévia guardada.",
    );
    if (result) {
      editedSeason.current = null;
      dirtyRef.current = false;
      setDirty(false);
      await refresh();
    }
  }
  const filtered =
    data?.roster.filter(
      (p) =>
        (!query ||
          p.name
            .toLocaleLowerCase("pt-PT")
            .includes(query.toLocaleLowerCase("pt-PT"))) &&
        (!division || p.divisionCode === division) &&
        (albumTab === "duplicates"
          ? p.count > 1
          : ownership === "all" ||
            (ownership === "owned" && p.count > 0) ||
            (ownership === "missing" && !p.count)),
    ) ?? [];
  const settings = data?.settings;
  const isAdmin = data?.isAdmin ?? data?.trading?.isAdmin ?? true;
  const conflict =
    dirty &&
    ((settings?.version ?? 0) !== draft.version ||
      (!!editedSeason.current && editedSeason.current !== data?.season?._id));
  const progress = settings && data ? data.progress[settings.rewardMetric] : 0;
  const ownReward = data?.ownRewards.find(
    (r) => r.campaignId === settings?.campaignId,
  );
  const redemption = data?.redemptions.find(
    (r) => r.code.toUpperCase() === code.trim().toUpperCase(),
  );
  function sticker(playerId: string, index: number, reveal = false) {
    const p = data?.roster.find((p) => p.playerId === playerId);
    if (!p) return null;
    const repeats =
      reveal && revealed
        ? revealed.stickerPlayerIds.slice(0, index).includes(playerId) ||
          p.count >
            revealed.stickerPlayerIds.filter((id) => id === playerId).length
        : false;
    return (
      <article
        className={styles.sticker}
        data-division={p.divisionCode.toUpperCase()}
        data-owned={p.count > 0}
        key={`${playerId}-${index}`}
      >
        <button
          type="button"
          className={styles.cromoButton}
          aria-label={`Ampliar cromo de ${p.name}`}
          onClick={() => {
            setFocused(p.playerId);
            previewRef.current?.showModal();
          }}
        >
          <div className={styles.cardArtwork}>
            <PlayerStickerArtwork
              name={p.name}
              photo={p.photo}
              theme={
                p.divisionCode === "ouro" || p.divisionCode === "prata"
                  ? p.divisionCode
                  : "bronze"
              }
              assessment={p.assessment}
              concealed={p.count < 1 && !reveal}
            />
          </div>
        </button>
        <span className={styles.quantity}>
          {reveal
            ? repeats
              ? "Repetido"
              : "Novo cromo"
            : p.count
              ? `${p.count} ${p.count === 1 ? "cromo" : "cromos"}`
              : "Por colecionar"}
        </span>
        {!reveal && p.count > 1 && (
          <small className={styles.hint}>
            {p.availableDuplicates ?? Math.max(0, p.count - 1)} para troca ·{" "}
            {p.reserved ?? 0} reservados
          </small>
        )}
      </article>
    );
  }
  return (
    <section className={styles.layout} aria-label="Caderneta de cromos">
      <header className={styles.header}>
        <div>
          <span className={styles.badge}>
            {data?.preview === false
              ? "Caderneta da comunidade"
              : "Prévia exclusiva dos administradores"}
          </span>
          <h2>Caderneta Fight Club</h2>
          <p className={styles.hint}>
            {data?.preview === false
              ? "Coleciona os jogadores da liga, descobre repetidos e combina trocas com a comunidade."
              : "Os jogadores da nossa liga, numa coleção tua. Testem os dois antes de qualquer lançamento."}
          </p>
        </div>
        {data?.seasons?.length ? (
          <label>
            Época da caderneta
            <select
              value={data.season?._id ?? ""}
              onChange={(event) =>
                void selectTrade({ seasonId: event.target.value, tradeId: "" })
              }
            >
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.active ? "" : " · Encerrada"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span>{data?.season?.name}</span>
        )}
      </header>
      {data?.season && (
        <nav className={styles.tabs} aria-label="Secções da caderneta">
          {(
            [
              ["collection", "A minha caderneta"],
              ["duplicates", "Repetidos"],
              ["community", "Comunidade"],
              ["negotiations", "Negociações"],
              ["history", "Histórico"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={albumTab === id}
              onClick={() => setAlbumTab(id)}
            >
              {label}
              {id === "negotiations" &&
                !!data.trading?.trades.some(
                  (trade) => trade.status === "PENDING" && trade.canRespond,
                ) && (
                  <span className={styles.tabCount}>
                    {
                      data.trading.trades.filter(
                        (trade) =>
                          trade.status === "PENDING" && trade.canRespond,
                      ).length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <div role="alert" className={`${styles.notice} ${styles.error}`}>
          {error}
        </div>
      )}
      {message && (
        <div role="status" className={styles.notice}>
          {message}
        </div>
      )}
      {!data ? (
        <p>A carregar a caderneta…</p>
      ) : !data.season ? (
        <div className={styles.notice}>
          É necessária uma época ativa para iniciar a coleção.
        </div>
      ) : (
        <>
          {albumTab === "collection" && (
            <>
              <div className={styles.hero}>
                <div className={styles.pack} aria-hidden="true">
                  <small>NEIVA PADEL</small>
                  <strong>
                    FIGHT
                    <br />
                    CLUB
                  </strong>
                  <small>COLEÇÃO DA LIGA</small>
                </div>
                <div>
                  <h3>A tua saqueta diária</h3>
                  <p>
                    {settings?.enabled
                      ? `${data.remainingPacks} ${data.remainingPacks === 1 ? "saqueta disponível" : "saquetas disponíveis"} hoje`
                      : isAdmin
                        ? "Ativa as saquetas na configuração abaixo para começar."
                        : "As saquetas estão pausadas pela administração."}
                  </p>
                  <p className={styles.hint}>
                    {settings?.packSize ?? 3} cromos por saqueta. A
                    disponibilidade renova à meia-noite de Lisboa. Podem sair
                    cromos repetidos.
                  </p>
                  <div className={styles.actions}>
                    <button
                      disabled={
                        busy ||
                        !settings?.enabled ||
                        !data.remainingPacks ||
                        !data.roster.length
                      }
                      onClick={() => void openPack()}
                    >
                      {busy ? "A processar…" : "Abrir saqueta"}
                    </button>
                    <button
                      className={styles.secondary}
                      disabled={
                        busy ||
                        reducedMotion ||
                        !settings?.enabled ||
                        !data.remainingPacks
                      }
                      onClick={() =>
                        motion ? setMotion(false) : void enableMotion()
                      }
                    >
                      {motion ? "Desativar movimento" : "Ativar shake"}
                    </button>
                  </div>
                  <p className={styles.hint}>
                    Tocar no botão funciona sempre, sem permissões de movimento.
                    A coleção pertence à tua conta, mesmo quando mudas de espaço
                    de trabalho.
                  </p>
                </div>
              </div>
              {revealed && (
                <section
                  className={`${styles.panel} ${styles.reveal}`}
                  aria-label="Cromos da saqueta"
                >
                  <h3>A tua última saqueta</h3>
                  <div className={styles.grid}>
                    {revealed.stickerPlayerIds.map((id, i) =>
                      sticker(id, i, true),
                    )}
                  </div>
                </section>
              )}
            </>
          )}
          {(albumTab === "collection" || albumTab === "duplicates") && (
            <section className={styles.panel}>
              <h3>
                {albumTab === "duplicates" ? "Repetidos" : "A minha coleção"} ·{" "}
                {data.progress.collected}/{data.progress.total}
              </h3>
              <progress
                className={styles.progress}
                value={data.progress.collected}
                max={Math.max(1, data.progress.total)}
                aria-label="Progresso da coleção"
              />
              <div className={styles.filters}>
                <label>
                  Procurar jogador
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Nome do jogador"
                  />
                </label>
                <label>
                  Divisão
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                  >
                    <option value="">Todas as divisões</option>
                    {Array.from(
                      new Map(
                        data.roster.map((p) => [p.divisionCode, p.division]),
                      ).entries(),
                    ).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Mostrar cromos
                  <select
                    value={ownership}
                    onChange={(e) => setOwnership(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="owned">Já tenho</option>
                    <option value="missing">Em falta</option>
                  </select>
                </label>
              </div>
              {!data.roster.length ? (
                <p>Ainda não existem jogadores elegíveis na época ativa.</p>
              ) : !filtered.length ? (
                <p>Nenhum jogador corresponde a estes filtros.</p>
              ) : (
                <div className={styles.grid}>
                  {filtered.map((p, i) => sticker(p.playerId, i))}
                </div>
              )}
            </section>
          )}
          {albumTab === "collection" && (
            <section className={styles.panel}>
              <h3>Recompensa no clube</h3>
              {!settings?.rewardEnabled ? (
                <p className={styles.hint}>
                  Não existe uma campanha de recompensas ativa. Configurem e
                  validem a oferta com o clube antes do lançamento.
                </p>
              ) : (
                <>
                  <p>
                    <strong>{settings.rewardTitle}</strong>
                  </p>
                  <p>
                    {metricNames[settings.rewardMetric]}: {progress}/
                    {settings.rewardTarget}
                  </p>
                  <progress
                    className={styles.progress}
                    value={Math.min(progress, settings.rewardTarget)}
                    max={settings.rewardTarget}
                    aria-label="Progresso da recompensa"
                  />
                  {ownReward ? (
                    <div className={styles.voucher}>
                      <code>{ownReward.code}</code>
                      <span>
                        {ownReward.status === "REDEEMED"
                          ? "Recompensa entregue"
                          : "Vale disponível — apresenta este código no clube"}
                      </span>
                    </div>
                  ) : (
                    <div className={styles.actions}>
                      <button
                        disabled={
                          busy ||
                          !settings.enabled ||
                          progress < settings.rewardTarget
                        }
                        onClick={() =>
                          void act(
                            {
                              type: isAdmin
                                ? "admin.stickers.claim"
                                : "stickers.claim",
                              seasonId: data.season!._id,
                            },
                            "Vale criado. Apresenta o código no clube.",
                          )
                        }
                      >
                        Obter vale
                      </button>
                    </div>
                  )}
                  <p className={styles.hint}>
                    Os jogos só contam após confirmação oficial. A coleção conta
                    cromos diferentes; saquetas repetidas no mesmo dia contam
                    uma visita.
                  </p>
                </>
              )}
            </section>
          )}
          {isAdmin && albumTab === "collection" && (
            <section className={styles.panel}>
              <h3>
                {data.preview
                  ? "Configuração do teste"
                  : "Configuração da caderneta"}
              </h3>
              <p className={styles.hint}>
                As opções de comunidade e trocas são independentes das saquetas.
                Enquanto a comunidade estiver desligada, apenas os
                administradores testam a caderneta.
              </p>
              {conflict && (
                <div role="alert" className={styles.notice}>
                  Outro administrador alterou a configuração. O teu rascunho foi
                  preservado.{" "}
                  <button
                    className={styles.button}
                    onClick={() => {
                      dirtyRef.current = false;
                      editedSeason.current = null;
                      setDirty(false);
                      void refresh();
                    }}
                  >
                    Carregar versão atual
                  </button>
                </div>
              )}
              <div className={styles.form}>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.communityEnabled}
                    onChange={(event) =>
                      change("communityEnabled", event.target.checked)
                    }
                  />
                  Disponibilizar caderneta à comunidade
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.tradesEnabled}
                    onChange={(event) =>
                      change("tradesEnabled", event.target.checked)
                    }
                  />
                  Permitir trocas de cromos
                </label>
                <label>
                  Exemplares máximos por lado
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.maxTradeCopies}
                    onChange={(event) =>
                      change("maxTradeCopies", Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Negociações pendentes por conta
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={draft.maxPendingTrades}
                    onChange={(event) =>
                      change("maxPendingTrades", Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  Validade das propostas (horas)
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={draft.tradeHours}
                    onChange={(event) =>
                      change("tradeHours", Number(event.target.value))
                    }
                  />
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => change("enabled", e.target.checked)}
                  />
                  Ativar saquetas na prévia admin
                </label>
                <label>
                  Saquetas por dia
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={draft.dailyPacks}
                    onChange={(e) =>
                      change("dailyPacks", Number(e.target.value))
                    }
                  />
                </label>
                <label>
                  Cromos por saqueta
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={draft.packSize}
                    onChange={(e) => change("packSize", Number(e.target.value))}
                  />
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={draft.rewardEnabled}
                    onChange={(e) => change("rewardEnabled", e.target.checked)}
                  />
                  Ativar recompensa de teste
                </label>
                <label>
                  Nome da recompensa
                  <input
                    maxLength={120}
                    value={draft.rewardTitle}
                    onChange={(e) => change("rewardTitle", e.target.value)}
                  />
                </label>
                <label>
                  Objetivo da recompensa
                  <select
                    value={draft.rewardMetric}
                    onChange={(e) =>
                      change(
                        "rewardMetric",
                        e.target.value as StickerRewardMetric,
                      )
                    }
                  >
                    {Object.entries(metricNames).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantidade para ganhar
                  <input
                    type="number"
                    min="1"
                    max={draft.rewardMetric === "collection" ? 100 : 10000}
                    value={draft.rewardTarget}
                    onChange={(e) =>
                      change("rewardTarget", Number(e.target.value))
                    }
                  />
                </label>
              </div>
              <p className={styles.hint}>
                Alterar a campanha de recompensa inicia um novo objetivo; os
                vales já emitidos são preservados.
              </p>
              <div className={styles.actions}>
                <button disabled={busy || conflict} onClick={() => void save()}>
                  Guardar configuração da caderneta
                </button>
                {dirty && <small>Alterações por guardar</small>}
              </div>
            </section>
          )}
          {data.trading &&
            (albumTab === "community" ||
              albumTab === "negotiations" ||
              albumTab === "history") && (
              <StickerCommunity
                key={`${data.currentPlayerId}:${data.isAdmin}:${data.season?._id}:${albumTab}:${data.trading.selectedTrade?.id ?? "none"}`}
                data={data}
                mode={albumTab}
                busy={busy}
                act={act}
                select={selectTrade}
                reportId={reportId}
              />
            )}
        </>
      )}
      {data &&
        data.ownRewards.some(
          (r) =>
            r.campaignId !== settings?.campaignId || !settings?.rewardEnabled,
        ) && (
          <section className={styles.panel}>
            <h3>Os teus vales anteriores</h3>
            {data.ownRewards
              .filter(
                (r) =>
                  r.campaignId !== settings?.campaignId ||
                  !settings?.rewardEnabled,
              )
              .map((reward) => (
                <div className={styles.voucher} key={reward._id}>
                  <strong>{reward.title}</strong>
                  <code>{reward.code}</code>
                  <span>
                    {reward.status === "REDEEMED"
                      ? "Recompensa entregue"
                      : "Vale por utilizar"}
                  </span>
                </div>
              ))}
          </section>
        )}
      {data && isAdmin && albumTab === "collection" && (
        <section className={styles.panel}>
          <h3>Validar entrega no clube</h3>
          <p className={styles.hint}>
            Consulta o código apresentado. A entrega fica registada com o
            administrador e só pode acontecer uma vez.
          </p>
          <div className={styles.form}>
            <label>
              Código do vale
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código apresentado no clube"
              />
            </label>
          </div>
          {code && !redemption && <p>Vale não encontrado nesta época.</p>}
          {redemption && (
            <div className={styles.voucher}>
              <strong>{redemption.title}</strong>
              <span>
                {data.roster.find(
                  (player) => player.playerId === redemption.playerId,
                )?.name ?? "Colecionador"}
              </span>
              <code>{redemption.code}</code>
              {redemption.status === "REDEEMED" ? (
                <span>Este vale já foi entregue.</span>
              ) : (
                <button
                  className={styles.button}
                  disabled={busy}
                  onClick={() =>
                    void act(
                      {
                        type: "admin.stickers.redeem",
                        rewardId: redemption._id,
                        code: redemption.code,
                        expectedVersion: redemption.version,
                      },
                      "Entrega registada. O vale foi utilizado.",
                    )
                  }
                >
                  Confirmar entrega da recompensa
                </button>
              )}
            </div>
          )}
        </section>
      )}
      <dialog
        ref={previewRef}
        className={styles.cromoDialog}
        aria-label="Cromo ampliado"
        onClose={() => setFocused("")}
        onClick={(event) => {
          if (event.target === event.currentTarget) previewRef.current?.close();
        }}
      >
        <button
          type="button"
          autoFocus
          className={styles.closePreview}
          onClick={() => previewRef.current?.close()}
        >
          Fechar
        </button>
        {focusedPlayer && (
          <div className={styles.cardArtwork}>
            <PlayerStickerArtwork
              name={focusedPlayer.name}
              photo={focusedPlayer.photo}
              theme={
                focusedPlayer.divisionCode === "ouro" ||
                focusedPlayer.divisionCode === "prata"
                  ? focusedPlayer.divisionCode
                  : "bronze"
              }
              assessment={focusedPlayer.assessment}
              concealed={focusedPlayer.count < 1}
            />
          </div>
        )}
      </dialog>
    </section>
  );
}
