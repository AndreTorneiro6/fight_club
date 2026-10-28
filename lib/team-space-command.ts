import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ensure } from "./rules";
import type { Actor, State } from "./types";
import { currentTeam, teamSpaceId, type TeamSpace } from "./team-space";
const commands = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("team.song.save"),
      expectedVersion: z.number().int().min(0),
      youtubeUrl: z.string().trim().max(2048),
    })
    .strict(),
  z
    .object({
      type: z.literal("team.message.send"),
      requestId: z.string().min(1).max(100),
      text: z.string().trim().min(1).max(2000),
    })
    .strict(),
]);
export function youtubeSongUrl(raw: string) {
  if (!raw.trim()) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    ensure(false, "Indica um link válido do YouTube.");
  }
  ensure(
    url.protocol === "https:" && !url.username && !url.password && !url.port,
    "Usa um link HTTPS do YouTube.",
  );
  const host = url.hostname.toLowerCase();
  let video: string | null = null;
  if (host === "youtu.be") video = url.pathname.slice(1);
  if (
    [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "music.youtube.com",
    ].includes(host)
  ) {
    if (url.pathname === "/watch") video = url.searchParams.get("v");
    else
      video =
        /^\/(?:shorts|live|embed)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] ??
        null;
  }
  ensure(
    video && /^[\w-]{11}$/.test(video),
    "Escolhe o link de um vídeo do YouTube.",
  );
  return `https://www.youtube.com/watch?v=${video}`;
}
export function executeTeamSpace(
  s: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role !== "spectator",
    "Esta ação não está disponível no modo espetador.",
    403,
  );
  const cmd = commands.parse(raw);
  const members = currentTeam(s.players, actor.playerId);
  ensure(members, "Ainda não tens uma dupla atribuída.", 403);
  ensure(
    members.find((p) => p._id === actor.playerId)?.userId === actor.userId,
    "Só os jogadores da dupla podem atualizar este espaço.",
    403,
  );
  const teamId = teamSpaceId(members.map((p) => p._id));
  s.teamSpaces ??= [];
  s.teamMessages ??= [];
  const previous = s.teamSpaces.find((space) => space._id === teamId);
  const now = new Date(timestamp).toISOString();
  if (cmd.type === "team.message.send") {
    const replay = s.teamMessages.find(
      (m) => m.playerId === actor.playerId && m.requestId === cmd.requestId,
    );
    if (replay) {
      ensure(
        replay.teamId === teamId && replay.text === cmd.text,
        "Este envio já foi usado para outra mensagem.",
        409,
      );
      return { _id: replay._id };
    }
  }
  let next: TeamSpace = previous ?? {
    _id: teamId,
    playerIds: members.map((p) => p._id),
    youtubeUrl: "",
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (cmd.type === "team.song.save") {
    ensure(
      (previous?.version ?? 0) === cmd.expectedVersion,
      "A música foi alterada pelo teu parceiro. Consulta a versão atual antes de guardar.",
      409,
    );
    const youtubeUrl = youtubeSongUrl(cmd.youtubeUrl);
    next = {
      ...next,
      youtubeUrl,
      version: cmd.expectedVersion + 1,
      updatedAt: now,
    };
    s.audit.push({
      _id: randomUUID(),
      userId: actor.userId,
      action: cmd.type,
      createdAt: now,
      details: JSON.stringify({
        teamId,
        previousUrl: previous?.youtubeUrl ?? "",
        youtubeUrl,
        version: next.version,
      }),
    });
  } else {
    const message = {
      _id: randomUUID(),
      teamId,
      playerId: actor.playerId,
      requestId: cmd.requestId,
      text: cmd.text,
      createdAt: now,
    };
    s.teamMessages.push(message);
    if (!previous) s.teamSpaces.push(next);
    return { _id: message._id };
  }
  s.teamSpaces = [
    ...s.teamSpaces.filter((space) => space._id !== teamId),
    next,
  ];
  return { _id: teamId, version: next.version };
}
