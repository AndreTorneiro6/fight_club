# Competition, cards and predictions: additive database upgrade

The application remains Next.js with MongoDB replica-set transactions. No existing player, result, ranking, season or challenge is deleted or rewritten during startup. No existing match is retrospectively marked as officially published.

## Before activation

1. Keep the normal replica-set backup and verify it can be restored.
2. Review [the simulation](COMPETITION-SIMULATION.md), [rule decisions](COMPETITION-DESIGN.md) and [administrator workflow](COMPETITION-OPERATIONS.md).
3. Build and validate the application. Database upgrades run through the existing `database()` index initialization when the new application first connects.
4. Review the competition settings, actual partner groups and dates separately for Ouro, Prata and Bronze. Existing division capacities are left unchanged; the application derives the number of teams from current partners.
5. Activate the new competition explicitly in administration. Installing the code never activates it automatically.

## Storage changes

Optional state collections are added: `competitionConfigurations`, `competitionRounds`, `competitionSchedules`, `competitionChallenges`, `competitionAbsences`, `competitionRecoveries`, `engagementSettings`, and `predictions`. Existing installations read missing collections as empty arrays. Optional metadata on new official challenges records round/publication identity and the earliest prediction cutoff. Confirmed result records can additionally store the confirming actor.

New indexes are additive. The unique `(competitionId, divisionId, number)` round index prevents duplicate official rounds; `(roundId, revision)` prevents competing publication revisions; `(userId, challengeId)` prevents duplicate predictions. Supporting indexes cover schedules, submission order queries, absences, recoveries and prediction settlement. The existing shared league transaction lock continues to serialize critical writes; explicit expected versions reject stale administrative changes after a retry.

Historical schedules retain ranking, challenge-distance, championship-eligibility, week-type and duration snapshots. Changing future defaults does not reinterpret a published schedule. Season identity cannot be changed after a competition has rounds; create a separate competition for another season. Published versions are immutable; amendments start from the latest publication and require a reason, new approval and a separate publication.

## Permissions and notifications

Drafts and approvals are filtered from player responses before JSON serialization. The aggregate engagement endpoint exposes only public card fields, officially published match options, aggregate settled prediction points and the requesting account's predictions. Pending/rejected registrations cannot access that endpoint. Live events carry invalidation signals only.

Generation never creates official player matches or player notifications. Publication creates official match records and notification outbox entries in the same transaction. Amendments notify affected teams only. Predictions settle with confirmed result mutations in the same transaction; read projections can recompute totals without writing on GET.

## Operational cautions

After activation, retain the new code and data model while official rounds are unsettled. Rolling back to a legacy build could expose legacy immediate-result behavior to new official matches. Resolve active rounds and review a rollback with the stored snapshots before changing versions; never delete the new collections to undo an activated competition.

Tests use isolated replica sets and fictitious players. On machines whose `/tmp` is a nearly full RAM filesystem, `TMPDIR=/var/tmp npm test` keeps temporary MongoDB journals on disk; this does not change test behavior or use a live database.
