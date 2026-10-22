"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Sponsor } from "@/lib/sponsor-types";
import type { View } from "@/lib/types";
import styles from "./sponsors.module.css";

function Logo({ sponsor }: { sponsor: Sponsor }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [sponsor.logo]);
  return (
    <div className={styles.logo}>
      {sponsor.logo && !failed ? (
        <img
          src={sponsor.logo}
          alt={`Logótipo de ${sponsor.name}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">
          {sponsor.name.slice(0, 2).toLocaleUpperCase("pt-PT")}
        </span>
      )}
    </div>
  );
}
function SponsorCard({ sponsor, state }: { sponsor: Sponsor; state: View }) {
  const prizes = state.settings[0].prizes.filter(
    (p) => p.sponsorId === sponsor._id,
  );
  return (
    <article
      id={`sponsor-${sponsor._id}`}
      className={`panel stack ${styles.card}`}
    >
      <Logo sponsor={sponsor} />
      {sponsor.label && <span className="eyebrow gold">{sponsor.label}</span>}
      <h3>{sponsor.name}</h3>
      {sponsor.description && (
        <p className={styles.description}>{sponsor.description}</p>
      )}
      {prizes.length > 0 && (
        <div className="stack gap-sm">
          <strong>Apoia os prémios</strong>
          {prizes.map((p, i) => (
            <Link key={i} href="/premios">
              {p.title}
              {p.placement ? ` · ${p.placement}` : ""}
            </Link>
          ))}
        </div>
      )}
      {sponsor.website && (
        <a
          className="button"
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer"
        >
          Visitar {sponsor.name} ↗
        </a>
      )}
    </article>
  );
}
export function SponsorPage({ state }: { state: View }) {
  const published = (state.sponsors ?? [])
    .filter((p) => p.published)
    .sort(
      (a, b) =>
        a.order - b.order ||
        a.name.localeCompare(b.name, "pt-PT") ||
        a._id.localeCompare(b._id),
    );
  return (
    <section className="stack" aria-label="Patrocinadores da liga">
      <div className="panel stack">
        <div className="eyebrow gold">INFORMAÇÃO DA LIGA</div>
        <h2>Patrocínios da liga</h2>
        <p>Os parceiros que apoiam a competição e os prémios do Fight Club.</p>
        <Link href="/premios">Consultar prémios →</Link>
      </div>
      {published.length ? (
        <div className={styles.grid}>
          {published.map((sponsor) => (
            <SponsorCard key={sponsor._id} sponsor={sponsor} state={state} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <p>Os patrocinadores serão anunciados pelo clube.</p>
        </div>
      )}
    </section>
  );
}

type Draft = Pick<
  Sponsor,
  | "name"
  | "description"
  | "website"
  | "logo"
  | "label"
  | "order"
  | "published"
  | "version"
> & { id?: string };
const empty = (): Draft => ({
  name: "",
  description: "",
  website: "",
  logo: "",
  label: "",
  order: 0,
  published: false,
  version: 0,
});
const from = (s: Sponsor): Draft => ({
  id: s._id,
  version: s.version,
  name: s.name,
  description: s.description,
  website: s.website,
  logo: s.logo,
  label: s.label,
  order: s.order,
  published: s.published,
});
export function AdminSponsors({
  state,
  run,
  busy,
}: {
  state: View;
  run: (command: unknown, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(empty);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const sponsors = state.sponsors ?? [];
  const current = sponsors.find((p) => p._id === draft.id);
  const conflict = dirty && !!current && current.version !== draft.version;
  useEffect(() => {
    if (current && !dirty) setDraft(from(current));
  }, [current?._id, current?.version, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  if (state.actor.role !== "admin") return null;
  const change = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
  };
  function select(sponsor?: Sponsor) {
    if (dirty && !window.confirm("Descartar as alterações por guardar?"))
      return;
    setDraft(sponsor ? from(sponsor) : empty());
    setDirty(false);
  }
  async function save() {
    const { id, version, ...fields } = draft;
    const result = await run(
      {
        type: "admin.sponsors.save",
        sponsorId: id,
        expectedVersion: version,
        ...fields,
      },
      draft.published
        ? "Patrocinador publicado."
        : "Patrocinador guardado em privado.",
    );
    if (
      result &&
      typeof result === "object" &&
      "_id" in result &&
      "version" in result
    ) {
      setDraft((previous) => ({
        ...previous,
        id: String(result._id),
        version: Number(result.version),
      }));
      setDirty(false);
    }
  }
  const sorted = sponsors
    .filter((p) =>
      `${p.name} ${p.label}`
        .toLocaleLowerCase("pt-PT")
        .includes(query.toLocaleLowerCase("pt-PT")),
    )
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-PT"));
  return (
    <section className="stack" aria-label="Gestão de patrocínios">
      <div className="panel stack">
        <h2>Patrocínios</h2>
        <p>
          Gere os parceiros e associa-os aos prémios da liga. Só os
          patrocinadores publicados ficam visíveis aos jogadores.
        </p>
        <div className="row wrap">
          <Link href="/patrocinios" className="button">
            Ver página de patrocínios
          </Link>
          <Link href="/premios" className="button">
            Associar patrocinadores aos prémios
          </Link>
        </div>
      </div>
      <div className={styles.layout}>
        <aside className="panel stack">
          <button className="primary" disabled={busy} onClick={() => select()}>
            Novo patrocinador
          </button>
          <label>
            Pesquisar patrocinadores
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {sorted.map((p) => (
            <button
              className={styles.item}
              key={p._id}
              aria-current={draft.id === p._id}
              onClick={() => select(p)}
            >
              <strong>{p.name}</strong>
              <small>
                {p.published ? "Publicado" : "Privado · por publicar"}
              </small>
            </button>
          ))}
          {!sorted.length && <p>Ainda não há patrocinadores nesta lista.</p>}
        </aside>
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void save().catch(() => {});
          }}
        >
          <h3>{draft.id ? "Editar patrocinador" : "Novo patrocinador"}</h3>
          {conflict && (
            <div role="alert" className="inset stack">
              <p>
                Outro administrador alterou este patrocinador. O teu rascunho
                está preservado.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Descartar o rascunho e carregar a versão atual?",
                    )
                  )
                    setDirty(false);
                }}
              >
                Carregar versão atual
              </button>
            </div>
          )}
          <label>
            Nome do patrocinador
            <input
              required
              minLength={2}
              maxLength={120}
              value={draft.name}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <label>
            Descrição do patrocinador
            <textarea
              maxLength={2000}
              value={draft.description}
              onChange={(e) => change({ description: e.target.value })}
            />
          </label>
          <label>
            Website do patrocinador
            <input
              type="url"
              placeholder="https://…"
              maxLength={500}
              value={draft.website}
              onChange={(e) => change({ website: e.target.value })}
            />
          </label>
          <label>
            URL do logótipo
            <input
              type="url"
              placeholder="https://…"
              maxLength={500}
              value={draft.logo}
              onChange={(e) => change({ logo: e.target.value })}
            />
          </label>
          <small>
            Usa endereços HTTPS. Sem logótipo, são apresentadas as iniciais do
            patrocinador.
          </small>
          <label>
            Etiqueta do apoio
            <input
              placeholder="Ex.: Parceiro oficial"
              maxLength={60}
              value={draft.label}
              onChange={(e) => change({ label: e.target.value })}
            />
          </label>
          <label>
            Ordem de apresentação
            <input
              type="number"
              min={0}
              max={10000}
              value={draft.order}
              onChange={(e) => change({ order: Number(e.target.value) })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => change({ published: e.target.checked })}
            />{" "}
            Publicado para jogadores
          </label>
          <small>
            Desmarca para retirar da página pública. As associações a prémios e
            o histórico são preservados.
          </small>
          <button
            className="primary"
            disabled={
              busy || !dirty || conflict || draft.name.trim().length < 2
            }
          >
            Guardar patrocinador
          </button>
          <span className="muted" role="status">
            {dirty
              ? "Alterações por guardar"
              : current
                ? `Guardado · versão ${current.version}`
                : "Novo patrocinador privado"}
          </span>
          {current && (
            <>
              <h3>Prémios associados</h3>
              {state.settings[0].prizes
                .filter((p) => p.sponsorId === current._id)
                .map((p, i) => (
                  <Link key={i} href="/premios">
                    {p.title}
                  </Link>
                ))}
              {!state.settings[0].prizes.some(
                (p) => p.sponsorId === current._id,
              ) && (
                <p>
                  Sem prémios associados. Seleciona este patrocinador ao editar
                  um prémio.
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </section>
  );
}

export function PrizeSponsor({
  state,
  sponsorId,
}: {
  state: View;
  sponsorId?: string;
}) {
  const sponsor = (state.sponsors ?? []).find((p) => p._id === sponsorId);
  if (!sponsor) return null;
  if (!sponsor.published)
    return state.actor.role === "admin" ? (
      <small>Apoio: {sponsor.name} · por publicar</small>
    ) : null;
  return (
    <Link href={`/patrocinios#sponsor-${sponsor._id}`}>
      Apoio: {sponsor.name} →
    </Link>
  );
}
