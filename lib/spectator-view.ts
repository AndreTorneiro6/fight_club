import { matchFrozenUntil } from "./match-freeze";
import { isTitleMatch } from "./title-matches";
import type { Actor, State } from "./types";
import { isVotingMatch } from "./match-voting-targets";

/** Public match information only, without participant coordination or league administration. */
export function filterSpectatorView(s: State, actor: Actor) {
  if (actor.role !== "spectator") return;
  // Public title fixtures may be frozen before a court/time is confirmed. Expose
  // only their return date; never expose vacations or participant coordination.
  const frozenTitles = new Map(
    s.challenges
      .filter(
        (c) =>
          ["accepted", "schedule_pending", "scheduled"].includes(c.status) &&
          (!c.competitionRoundId || !!c.officialPublication) &&
          isTitleMatch(c, s),
      )
      .map((c) => [c._id, matchFrozenUntil(s, c)] as const)
      .filter((entry): entry is readonly [string, string] => !!entry[1]),
  );
  s.challenges = s.challenges
    .filter((c) => isVotingMatch(s, c) || frozenTitles.has(c._id))
    .map((c) => ({
      ...c,
      deferredUntil: frozenTitles.get(c._id) ?? c.deferredUntil,
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
