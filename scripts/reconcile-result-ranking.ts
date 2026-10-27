/** Scoped, audited repair of an already-correct official result; dry-run by default. */
import { database, readState, transaction } from "../lib/db";
import { execute } from "../lib/engine";
import type { Actor, State, User } from "../lib/types";
import { teamPosition } from "../lib/team-competition";
import { ensure } from "../lib/rules";

const arg = (name: string) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const challengeId = arg("challenge"),
  winnerId = arg("expected-winner"),
  score = arg("expected-score");
ensure(
  challengeId && winnerId && score,
  "Require --challenge, --expected-winner and --expected-score.",
);
const { client, db } = await database();
try {
  const users = await db
    .collection<User>("users")
    .find({ role: "admin", verified: true })
    .toArray();
  function plan(s: State) {
    const c = s.challenges.find((c) => c._id === challengeId),
      result = s.results.find((r) => r.challengeId === challengeId);
    ensure(
      c &&
        result &&
        c.status === "completed" &&
        result.winnerId === winnerId &&
        result.score === score &&
        c.winnerId === winnerId &&
        c.score === score &&
        result.setScores,
      "Official result changed; repair refused.",
    );
    const user = users.find((u) => u._id === result.approvedBy) ?? users[0];
    const player = s.players.find(
      (p) =>
        p.userId === user?._id &&
        p.status === "active" &&
        !p.awaitingApproval &&
        !p.registrationRejectedAt,
    );
    ensure(player?.userId, "No eligible verified administrator.");
    const actor: Actor = {
      userId: player.userId,
      playerId: player._id,
      role: "admin",
    };
    const before = {
      attacker: teamPosition(s.players, c.challengerId),
      defender: teamPosition(s.players, c.defenderId),
    };
    const beforeStats = JSON.stringify(
      s.players.map((p) => [
        p._id,
        p.wins,
        p.losses,
        p.challengesWon,
        p.challengesLost,
      ]),
    );
    const history = s.history.length;
    execute(s, actor, {
      type: "admin.result.correct",
      challengeId: c._id,
      winnerId: result.winnerId,
      setScores: result.setScores,
      note: "Reconciliação auditada do ranking após correção do vencedor; resultado oficial preservado.",
    });
    ensure(
      !result.rankingReviewRequired,
      "Ranking cannot safely be reconciled; no changes applied.",
    );
    ensure(
      beforeStats ===
        JSON.stringify(
          s.players.map((p) => [
            p._id,
            p.wins,
            p.losses,
            p.challengesWon,
            p.challengesLost,
          ]),
        ),
      "Statistics changed; repair refused.",
    );
    return {
      challengeId: c._id,
      number: c.number,
      score: result.score,
      before,
      after: {
        attacker: teamPosition(s.players, c.challengerId),
        defender: teamPosition(s.players, c.defenderId),
      },
      historyAdded: s.history.length - history,
    };
  }
  const report = process.argv.includes("--apply")
    ? await transaction((s) => plan(s))
    : plan(await readState(db));
  console.log(
    JSON.stringify({ applied: process.argv.includes("--apply"), ...report }),
  );
} finally {
  await client.close();
}
