"use client";
import { useEffect, useRef, useState } from "react";
import type { Challenge, View } from "@/lib/types";
import { currentTeam, teamSpaceId, type TeamSpace } from "@/lib/team-space";
import { challengeMemberIds } from "@/lib/team-competition";
type Run = (command: unknown, message?: string) => Promise<unknown>;
export function TeamWorkspace({
  s,
  run,
  busy,
}: {
  s: View;
  run: Run;
  busy: boolean;
}) {
  const members =
    s.actor.role === "spectator"
      ? undefined
      : currentTeam(s.players, s.actor.playerId);
  if (!members) return null;
  const id = teamSpaceId(members.map((p) => p._id));
  const space = s.teamSpaces?.find((space) => space._id === id);
  return (
    <section className="panel stack" aria-labelledby="team-space-title">
      <div>
        <div className="eyebrow gold">A TUA DUPLA</div>
        <h2 id="team-space-title">{members.map((p) => p.name).join(" + ")}</h2>
      </div>
      <EntrySong key={id} {...{ space, run, busy }} />
      <TeamConversation key={`chat:${id}`} {...{ s, run, busy }} teamId={id} />
    </section>
  );
}
function EntrySong({
  space,
  run,
  busy,
}: {
  space?: TeamSpace;
  run: Run;
  busy: boolean;
}) {
  const [url, setUrl] = useState(space?.youtubeUrl ?? "");
  const [version, setVersion] = useState(space?.version ?? 0);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setUrl(space?.youtubeUrl ?? "");
      setVersion(space?.version ?? 0);
    }
  }, [space?.youtubeUrl, space?.version, dirty]);
  return (
    <div className="inset stack">
      <h3>Música de entrada</h3>
      <p className="muted">
        Os dois podem editar. O administrador pode abrir o vídeo para reproduzir
        a música na entrada da dupla.
      </p>
      {space?.youtubeUrl && (
        <a
          className="button"
          href={space.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir música no YouTube
        </a>
      )}
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            await run(
              {
                type: "team.song.save",
                expectedVersion: version,
                youtubeUrl: url,
              },
              "Música da dupla atualizada.",
            )
          )
            setDirty(false);
        }}
      >
        <label>
          Link do YouTube
          <input
            aria-label="Música de entrada — link do YouTube"
            type="url"
            maxLength={2048}
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setDirty(true);
            }}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </label>
        <small>Deixa vazio para remover a música.</small>
        <button disabled={busy || !dirty}>Guardar música de entrada</button>
        {dirty && version !== (space?.version ?? 0) && (
          <>
            <p role="status">
              O teu parceiro alterou a música. O teu texto foi mantido.
            </p>
            <button
              type="button"
              onClick={() => {
                setDirty(false);
                setUrl(space?.youtubeUrl ?? "");
                setVersion(space?.version ?? 0);
              }}
            >
              Usar música atual da dupla
            </button>
          </>
        )}
      </form>
    </div>
  );
}
function TeamConversation({
  s,
  teamId,
  run,
  busy,
}: {
  s: View;
  teamId: string;
  run: Run;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const attempt = useRef<{ text: string; id: string } | undefined>(undefined);
  const sending = useRef(false),
    box = useRef<HTMLDivElement>(null);
  const messages = (s.teamMessages ?? [])
    .filter((m) => m.teamId === teamId)
    .sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id),
    )
    .slice(-200);
  const tail = messages.at(-1)?._id;
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [tail]);
  return (
    <section className="stack" aria-labelledby="team-chat-title">
      <h3 id="team-chat-title">Chat da dupla</h3>
      <small className="muted">
        Privado — só os dois jogadores desta dupla podem ler e enviar mensagens.
      </small>
      <div ref={box} className="chat-box stack" aria-live="polite">
        {!messages.length && (
          <p className="muted">
            Ainda não há mensagens. Combina os próximos treinos com o teu
            parceiro.
          </p>
        )}
        {messages.map((m) => (
          <article className="inset stack" key={m._id}>
            <strong>
              {s.players.find((p) => p._id === m.playerId)?.name ?? "Jogador"}
            </strong>
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {m.text}
            </p>
            <small className="muted">
              {new Date(m.createdAt).toLocaleString("pt-PT", {
                timeZone: "Europe/Lisbon",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </small>
          </article>
        ))}
      </div>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body || sending.current) return;
          if (attempt.current?.text !== body)
            attempt.current = { text: body, id: crypto.randomUUID() };
          sending.current = true;
          try {
            if (
              await run(
                {
                  type: "team.message.send",
                  requestId: attempt.current.id,
                  text: body,
                },
                "",
              )
            ) {
              setText("");
              attempt.current = undefined;
            }
          } finally {
            sending.current = false;
          }
        }}
      >
        <label>
          Mensagem para a dupla
          <textarea
            required
            maxLength={2000}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <button disabled={busy || !text.trim()}>Enviar à dupla</button>
      </form>
    </section>
  );
}
export function AdminEntrySongs({ s, c }: { s: View; c: Challenge }) {
  if (s.actor.role !== "admin") return null;
  const songs = (["attack", "defense"] as const).flatMap((side) => {
    const ids = challengeMemberIds(c, side, s.players);
    if (ids.length !== 2) return [];
    const space = s.teamSpaces?.find((space) => space._id === teamSpaceId(ids));
    if (
      !space?.youtubeUrl ||
      !/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(
        space.youtubeUrl,
      )
    )
      return [];
    return [{ side, url: space.youtubeUrl }];
  });
  if (!songs.length) return null;
  return (
    <div
      className="inset stack"
      aria-label={`Músicas de entrada do jogo ${c.number}`}
    >
      {songs.map((song) => (
        <a
          className="button"
          key={song.side}
          href={song.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Música de entrada · {song.side === "attack" ? "Ataque" : "Defesa"} ↗
        </a>
      ))}
    </div>
  );
}
