import type { Actor, Session, User } from "./types";

/** Account privileges stay on User; the session selects the effective workspace. */
export function workspaceActor(
  user: Pick<User, "_id" | "role">,
  session: Pick<Session, "_id" | "workspace">,
  playerId: string,
): Actor {
  const workspace = user.role === "admin" ? session.workspace : "player";
  return {
    userId: user._id,
    playerId,
    accountRole: user.role,
    role: workspace === "admin" && user.role === "admin" ? "admin" : "player",
    workspace,
    workspaceSelectionRequired: user.role === "admin" && !workspace,
    sessionId: session._id,
  };
}
export function publicActor(actor: Actor): Actor {
  const { sessionId: _sessionId, ...visible } = actor;
  return visible;
}
