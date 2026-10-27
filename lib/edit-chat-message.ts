import { randomUUID } from "node:crypto";
import { ensure } from "./rules";
import type { Actor, Message, State } from "./types";

/** Called only after the engine checks access to the containing conversation. */
export function editChatMessage(
  state: State,
  actor: Actor,
  messages: Message[],
  command: {
    type: string;
    challengeId: string;
    messageId: string;
    expectedUpdatedAt: string;
    text?: string;
  },
  at: string,
) {
  const message = messages.find(
    (m) => m._id === command.messageId && m.challengeId === command.challengeId,
  );
  ensure(message, "Mensagem indisponível.", 404);
  ensure(
    message.playerId === actor.playerId,
    "Só podes alterar as tuas mensagens.",
    403,
  );
  ensure(
    (message.updatedAt ?? message.createdAt) === command.expectedUpdatedAt,
    "A mensagem mudou. Atualiza antes de tentar novamente.",
    409,
  );
  const before = structuredClone(message);
  if (command.type.endsWith(".delete")) {
    messages.splice(messages.indexOf(message), 1);
  } else {
    ensure(
      command.text?.trim() && command.text.trim().length <= 2000,
      "Mensagem inválida.",
    );
    message.text = command.text!.trim();
    message.mentions = message.mentions?.filter((m) =>
      message.text.includes(`@${m.name}`),
    );
    message.updatedAt = new Date(
      Math.max(Date.parse(at), Date.parse(command.expectedUpdatedAt) + 1),
    ).toISOString();
  }
  state.audit.push({
    _id: randomUUID(),
    userId: actor.userId,
    action: command.type,
    details: JSON.stringify({
      before,
      after: command.type.endsWith(".delete") ? null : message,
    }),
    createdAt: at,
  });
  return { ok: true };
}
