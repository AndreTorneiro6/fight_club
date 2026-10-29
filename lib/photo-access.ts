import type { ClientSession, Db } from "mongodb";
import type { Actor, Player } from "./types";
import { ensure } from "./rules";

export async function canReadPhoto(
  db: Db,
  actor: Actor,
  id: string,
  owner: string,
) {
  if (actor.userId === owner || actor.role === "admin") return true;
  return !!(await db.collection<Player>("players").findOne({
    photo: `/api/photos/${id}`,
    status: "active",
    awaitingApproval: { $ne: true },
    registrationRejectedAt: { $exists: false },
  }));
}

export async function validateProfilePhoto(
  db: Db,
  session: ClientSession,
  actor: Actor,
  previous: string,
  next: string,
) {
  if (!next || next === previous) return;
  const id = next.match(/^\/api\/photos\/([a-f\d-]+)$/)?.[1];
  ensure(id, "Carrega uma fotografia tua para o perfil.", 403);
  ensure(
    await db
      .collection("photos")
      .findOne(
        { _id: id as never, owner: actor.userId },
        { session, projection: { _id: 1 } },
      ),
    "Fotografia indisponível para este perfil.",
    403,
  );
}
