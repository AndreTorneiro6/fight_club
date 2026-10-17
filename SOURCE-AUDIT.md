# Fight Club source audit

Inspected the source extracted from `fight-club-source.zip` into `fight-club/`. The ZIP and application source are unchanged. This is a static review; no application or database tests have been run.

## Current architecture

- React 19, TypeScript, TanStack Start/Router and Vite; not Next.js.
- Tailwind CSS 4, Radix UI, React Query and Lucide icons.
- Supabase authentication (email/password and Lovable-mediated Google sign-in).
- PostgreSQL schema, policies and business functions in `fight-club/drizzle/migrations/0000_migration.sql`.
- Browser data access through Supabase; league mutations mostly through PostgreSQL RPC functions.
- Navy/gold theme using Bebas Neue and Manrope.

## Present in source

- Public landing page, authentication, home, division rankings, challenges and challenge details, games, profile, notifications and admin pages.
- Player profiles, weekly availability, exceptions and ranking history.
- Challenge eligibility, acceptance/refusal, proposed time windows, compatible time calculation, scheduling, optional set scores, opponent confirmation and disputes.
- Configurable swap/leapfrog ranking models, result statistics and notifications.
- Challenge-specific messages.
- Admin summaries, challenge filters, basic player creation, suspension/reactivation, position/division changes, CSV import/export, rules, division settings, dispute actions, manual court assignment and activity log.
- Tables for roles, divisions, seasons, players, league settings, courts, challenges, proposed slots, messages, availability, exceptions, notifications, ranking history and admin actions.
- Demonstration seed records. Matches and results are represented within challenges rather than separate tables.

## Incomplete or absent

- Complete admin player editor, invitations, account resets, photo uploads and dedicated player-history interface.
- Title Fights, champion history and belts; season lifecycle and promotion/relegation workflows.
- Push/email notifications, payments and booking integrations.
- Excel import; the existing importer handles CSV with simplistic delimiter splitting.
- End-to-end verification: the included test only checks matching the public root route.

## Migration concerns confirmed by static inspection

- Preserve existing components, styles, Portuguese text and route paths when moving to Next.js.
- Port SQL business functions and row-level permissions to authenticated, validated server services; changing only the database client would lose essential behavior.
- Current refusal logic accepts any non-null reason. The optional forfeit rule excludes the literal reason `Lesão`. The later requested restriction concerning another active challenge is absent.
- Expiration is displayed dynamically; stored active statuses still count toward server challenge limits. UI and server eligibility can disagree.
- Court overlap checks use a query without explicit court-level serialization; the MongoDB version needs concurrency protection for overlapping bookings.
- Admin position changes record only the selected player's history, even when other players move. Division transfers log the action but do not create ranking-history entries for all affected players.
- Basic player creation/status changes write directly to the table rather than through the audited admin functions.
- Result submission permits accepted or scheduled challenges, without requiring that the match has taken place.
- Deadline extension uses hardcoded intervals in SQL despite configurable league rules.
- Signup gives the first account admin rights; replace with explicit administrator provisioning for the migrated app.

## Next.js / MongoDB implementation sequence

1. Preserve the extracted source as the migration reference.
2. Move the existing UI/routes into Next.js and replace Lovable runtime integrations.
3. Define MongoDB collections, stable identifiers, indexes and configurable settings, retaining historical references.
4. Implement authentication and server authorization, then migrate each SQL operation to a server service with transactional ranking updates and concurrency protection.
5. Verify the two-player challenge-to-confirmed-result flow, authorization, scheduling conflicts, ranking changes and audit records.
6. Finish admin player management and implement the clarified refusal policy.

The archive contains schema and demonstration seed definitions, not an export of live users, passwords, games or league records. No environment file or MongoDB connection configuration was included. Existing live data migration requires a separate export; existing sessions cannot be preserved simply by copying the source.
