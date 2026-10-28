import type { Actor, State } from "./types";
import { isVotingMatch } from "./match-voting-targets";

/** A spectator sees published matches, never participant-only coordination or league administration. */
export function filterSpectatorView(s: State, actor: Actor) {
  if (actor.role !== "spectator") return;
  s.challenges = s.challenges
    .filter((c) => isVotingMatch(s, c))
    .map((c) => ({
      ...c,
      scheduleProposal: undefined,
      refusalReason: undefined,
      refusalNote: undefined,
      disputeNote: undefined,
      origin: undefined,
      courtPayments: undefined,
    }));
  const games = new Set(s.challenges.map((c) => c._id));
  s.matches = s.matches.filter((m) => games.has(m.challengeId));
  s.results = s.results.filter((r) => games.has(r.challengeId));
  s.messages = [];
  s.slots = [];
  s.availability = [];
  s.exceptions = [];
  s.weeklyRounds = [];
  s.competitionConfigurations = [];
  s.competitionRounds = [];
  s.competitionSchedules = [];
  s.competitionChallenges = [];
  s.competitionAbsences = [];
  s.competitionRecoveries = [];
  s.playerAttributes = [];
  s.predictions = [];
  s.sponsors = [];
  s.settings = s.settings.map((settings) => ({
    ...settings,
    rulesText: "",
    prizes: [],
  }));
  s.notifications = s.notifications.filter(
    (n) => n.playerId === actor.playerId && !!n.bettingNotice,
  );
  s.history = s.history.filter(
    (h) => !h.challengeId || games.has(h.challengeId),
  );
}
