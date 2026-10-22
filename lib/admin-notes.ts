import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Actor, State } from "./types";
import { ensure } from "./rules";

export interface AdminNote {
  _id: string;
  version: number;
  title: string;
  body: string;
  archived: boolean;
  implementationStatus?: "NOT_IMPLEMENTED" | "IN_PROGRESS" | "IMPLEMENTED";
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}
const identity = {
  noteId: z.string().min(1).max(100),
  expectedVersion: z.number().int().min(1),
};
export const adminNoteCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("admin.notes.save"),
    noteId: identity.noteId.optional(),
    expectedVersion: z.number().int().min(0),
    title: z.string().trim().min(1).max(160),
    body: z.string().max(30000),
    implementationStatus: z
      .enum(["NOT_IMPLEMENTED", "IN_PROGRESS", "IMPLEMENTED"])
      .optional(),
  }),
  z.object({
    type: z.literal("admin.notes.archive"),
    ...identity,
    archived: z.boolean(),
  }),
]);

/** Called exclusively by execute(), inside the existing MongoDB transaction. */
export function executeAdminNotes(
  state: State,
  actor: Actor,
  raw: unknown,
  timestamp = Date.now(),
) {
  ensure(
    actor.role === "admin",
    "Apenas administradores podem aceder às ideias.",
    403,
  );
  const command = adminNoteCommandSchema.parse(raw);
  const notes = state.adminNotes ?? [];
  const existing = command.noteId
    ? notes.find((note) => note._id === command.noteId)
    : undefined;
  if (command.noteId) ensure(existing, "Ideia não encontrada.", 404);
  ensure(
    (existing?.version ?? 0) === command.expectedVersion,
    "Esta ideia foi alterada por outro administrador. O teu texto foi mantido; consulta a versão atual antes de guardar.",
    409,
  );
  const now = new Date(timestamp).toISOString();
  let note: AdminNote;
  if (command.type === "admin.notes.save") {
    ensure(!existing?.archived, "Restaura a ideia antes de a editar.", 409);
    note = {
      _id: existing?._id ?? randomUUID(),
      version: (existing?.version ?? 0) + 1,
      title: command.title,
      body: command.body,
      implementationStatus:
        command.implementationStatus ??
        existing?.implementationStatus ??
        "NOT_IMPLEMENTED",
      archived: false,
      createdAt: existing?.createdAt ?? now,
      createdBy: existing?.createdBy ?? actor.userId,
      updatedAt: now,
      updatedBy: actor.userId,
    };
  } else {
    ensure(existing, "Ideia não encontrada.", 404);
    note = {
      ...existing,
      archived: command.archived,
      version: existing.version + 1,
      updatedAt: now,
      updatedBy: actor.userId,
    };
  }
  state.adminNotes = [...notes.filter((entry) => entry._id !== note._id), note];
  // Keep old text in private administrative history so edits remain recoverable.
  state.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: command.type,
    details: JSON.stringify({
      noteId: note._id,
      version: note.version,
      previous: existing ?? null,
      title: note.title,
      archived: note.archived,
      implementationStatus: note.implementationStatus,
    }),
    createdAt: now,
  });
  return { _id: note._id, version: note.version };
}
