import { applicationVersion, releaseNotes } from "@/lib/release-notes";
export default function AdminChangelog() {
  return (
    <section className="panel stack" aria-labelledby="release-title">
      <div className="row between wrap">
        <div>
          <div className="eyebrow muted">HISTÓRICO DA APLICAÇÃO</div>
          <h2 id="release-title">Versões e alterações</h2>
        </div>
        <span className="badge gold">Versão atual · {applicationVersion}</span>
      </div>
      <p className="muted">
        O que mudou em cada versão da aplicação. O histórico de jogos e decisões
        da liga continua na Auditoria.
      </p>
      {releaseNotes.map((release, i) => (
        <details className="inset" key={release.version} open={i === 0}>
          <summary
            className="row between wrap"
            style={{ cursor: "pointer", minHeight: 44 }}
          >
            <strong>
              v{release.version} · {release.title}
            </strong>
            <small className="muted">
              {new Date(`${release.date}T12:00:00Z`).toLocaleDateString(
                "pt-PT",
                { timeZone: "Europe/Lisbon" },
              )}
            </small>
          </summary>
          <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
            {release.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
