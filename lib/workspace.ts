import type { Actor, Player, Session, User, Workspace } from "./types";

/** Account privileges stay on User; the session selects the effective workspace. */
export function workspaceActor(
  user: Pick<User, "_id" | "role">,
  session: Pick<Session, "_id" | "workspace">,
  playerId: string,
  profile?: Pick<Player, "spectator">,
): Actor {
  const availableWorkspaces: Workspace[] =
    user.role === "admin"
      ? profile?.spectator
        ? ["admin", "spectator"]
        : ["admin", "player", "spectator"]
      : [profile?.spectator ? "spectator" : "player"];
  const workspace =
    user.role === "admin"
      ? session.workspace && availableWorkspaces.includes(session.workspace)
        ? session.workspace
        : undefined
      : availableWorkspaces[0];
  return {
    userId: user._id,
    playerId,
    accountRole: user.role,
    availableWorkspaces,
    role: workspace ?? "player",
    workspace,
    workspaceSelectionRequired: user.role === "admin" && !workspace,
    sessionId: session._id,
  };
}
export function publicActor(actor: Actor): Actor {
  const { sessionId: _sessionId, ...visible } = actor;
  return visible;
}
