// Read-only model smoke test: no proposals are saved or applied.
import { database, readState } from "../lib/db";
import { askLocalAssistant, assistantContext } from "../lib/admin-assistant";
const started = Date.now();
try {
  const state = await readState((await database()).db);
  const mode = process.argv[2];
  const target =
    mode === "--proposal"
      ? state.players.find(
          (p) =>
            p.status === "active" &&
            !p.awaitingApproval &&
            !p.registrationRejectedAt &&
            !p.membershipPayment?.paid &&
            state.players.filter((other) => other.name === p.name).length === 1,
        )
      : undefined;
  if (mode === "--proposal" && !target)
    throw new Error("No eligible unambiguous test target.");
  const message = target
    ? `Marca a quota de ${target.name}, jogador número ${target.number}, como paga.`
    : mode === "--ideas"
      ? "Indica duas ideias curtas para dinamizar a liga."
      : (mode ??
        "Resume o estado da liga em duas frases. Usa os totais de summary.");
  const answer = await askLocalAssistant(state, [
    { role: "user", content: message },
  ]);
  if (
    target &&
    (answer.draft?.command.type !== "admin.payment.set" ||
      answer.draft.command.playerId !== target._id ||
      !answer.draft.command.paid)
  )
    throw new Error(
      `Model did not prepare the requested exact-player membership proposal: ${JSON.stringify({ reply: answer.reply, proposal: answer.draft?.summary ?? null })}`,
    );
  console.log(
    JSON.stringify({
      seconds: Math.round((Date.now() - started) / 1000),
      summary: assistantContext(state).summary,
      reply: answer.reply,
      proposal: answer.draft?.summary ?? null,
      applied: false,
    }),
  );
  process.exit(0);
} catch (e) {
  console.error(
    e instanceof Error ? e.message : "Local assistant check failed.",
  );
  process.exit(1);
}
