import type { Actor, Player, State } from "./types";
export interface TeamSpace {
  _id: string;
  playerIds: string[];
  youtubeUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface TeamMessage {
  _id: string;
  teamId: string;
  playerId: string;
  requestId: string;
  text: string;
  createdAt: string;
}
export function teamSpaceId(playerIds: string[]) {
  return [...playerIds].sort().map(encodeURIComponent).join(":");
}
export function currentTeam(players: Player[], playerId: string) {
  const p = players.find((p) => p._id === playerId);
  const partner = players.find((other) => other._id === p?.partnerId);
  if (
    !p ||
    !partner ||
    p._id === partner._id ||
    partner.partnerId !== p._id ||
    !p.divisionId ||
    p.divisionId !== partner.divisionId ||
    [p, partner].some(
      (member) =>
        member.spectator ||
        member.status === "removed" ||
        member.awaitingApproval ||
        member.registrationRejectedAt,
    )
  )
    return;
  return [p, partner].sort((a, b) => a._id.localeCompare(b._id));
}
/** Admins receive song metadata, never another team's private messages. */
export function filterTeamSpaceView(s: State, actor: Actor) {
  const members =
    actor.role === "spectator"
      ? undefined
      : currentTeam(s.players, actor.playerId);
  const ownId = members ? teamSpaceId(members.map((p) => p._id)) : undefined;
  s.teamSpaces = (s.teamSpaces ?? []).filter(
    (space) => actor.role === "admin" || space._id === ownId,
  );
  s.teamMessages = (s.teamMessages ?? []).filter(
    (message) => message.teamId === ownId,
  );
}
