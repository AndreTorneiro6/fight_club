# Fight Club — project handoff

Last updated: 21 October 2026 (Europe/Lisbon).
This is a saved snapshot, not a substitute for checking Git and live service state.

## Changes — 21 October 2026

- Implemented (deployment status below): ranking displays consecutive team positions and one win/loss record per team, counting completed matches once (including legacy participation by either partner). Stored player positions and records are unchanged. Admin team ordering also shows team results instead of internal player slots.
- Admin overview league statistics are permanently visible, with spacing after the priority tasks.
- TanStack Table v8 powers search, pagination, selectable page sizes and filtered row counts in Jogadores and activity tables. Per the follow-up request, ranking has no filtering or pagination and shows one trend per team, comparing consecutive current/previous team positions. The compact home ranking remains a five-entry preview. The court availability time grid has no table pagination.
- Jogadores is sorted alphabetically using Portuguese collation.
- Validation: typecheck, 84 tests and production build pass; enhanced ranking browser test passes, covering alphabetical players, pagination/search, team numbering/results, a single team trend, absence of ranking filters/pagination, and desktop/mobile ranking behavior.
- Playtomic follow-up: court slots now run from 07:00 to midnight in Lisbon; date selection uses the native calendar again (Portuguese language hint; date appearance follows browser/device locale); refresh aligns with the controls on desktop and spans the width on mobile. Typecheck, 84 tests, build and court-availability desktop/mobile browser test pass.
- Admin → Rankings now offers Exportar ranking para WhatsApp: preview and download a branded 1080×1600 PNG of the selected division, twelve teams per image, with consecutive positions and shared win/loss records. Native file sharing is available when supported, with download retained if sharing fails. No automated WhatsApp messages. Browser test covers PNG dimensions, file sharing/failure, changing divisions and mobile layout.
- Deployed all changes above on 21 October 2026 using selective rsync and Compose image rebuild/restart (app and worker). Production `/api/health` returns `{"ok":true}`, app is healthy, worker is running, and running-container source hashes match local final source. Public login browser smoke check passes without browser errors; new export code is present in served assets. Environment settings and database were preserved.

## Email uniqueness follow-up — 21 October 2026

- Email addresses are trimmed and lowercased before validation in signup, login, admin player editing/import and account setup. Existing legacy formatting is also considered when checking uniqueness.
- Public signup rejects addresses already used by an account or a player profile, including profiles without accounts. Only emailed invitation setup can attach an account to an existing player; general signup cannot claim that profile.
- Admin creation/edit/import also checks addresses reserved by authentication accounts without a player profile. Checks run in the shared league transaction; concurrent signup variants create exactly one account/profile. Existing MongoDB unique indexes remain in place.
- Conflicts return HTTP 409 with “Este email já está registado. Inicia sessão ou recupera a palavra-passe.”
- Validation: typecheck, 86 tests and production build pass. The browser test verifies duplicate signup feedback and emailed invitation setup preserving the existing profile/category.
- Email protection deployed and verified on 21 October 2026; running-container hashes match local source, app is healthy and worker is running.

## Calendar picker follow-up — 21 October 2026

- Restored the native calendar input for Dia para consultar, preserving the 30-day range, automatic availability refresh, slots from 07:00 and adjusted button layout.
- The input carries `lang="pt-PT"`; native date rendering is controlled by the browser/device locale. No date dropdown remains.
- Restored native calendar deployed on 21 October 2026. Typecheck, tests, build and desktop/mobile availability browser check pass.

## Half-hour availability starts — 21 October 2026

- Investigated a mismatch for today, 21 October: official bookings and the local match database both showed Campo 1 unoccupied from 19:30–21:00. Neighboring Playtomic bookings ended at 19:30 and began at 21:00 (Lisbon time).
- Root cause: fixed non-overlapping 90-minute grid showed 19:00–20:30 and 20:30–22:00, both occupied, and omitted 19:30–21:00.
- Court windows now start every 30 minutes while retaining the selected 60/90-minute duration. Only complete windows ending by midnight are shown; no shortened final slots. Starts begin at 07:00. The native date picker and button layout remain.
- Validation: typecheck, 87 tests and build pass. Unit regression covers exact 19:30–21:00 availability between adjacent bookings; browser regression verifies the corresponding booking link, other occupied/unknown courts, refresh, calendar picker and mobile layout.
- Deployed and verified on 21 October 2026: running code generates the 19:30–21:00 window, and fresh official Playtomic/local match queries show Campo 1 free in that window. Public health is OK; app healthy, worker running; runtime source hashes match local source.

## Player removal follow-up — 21 October 2026

- Admin → Jogadores → Mais ações now includes Remover jogador for approved, non-removed players. Confirmation explains removal from the ranking and preservation of games/history.
- Uses existing `admin.player.save` with `status: "removed"`, through the engine/transaction. Existing guards reject removal with active challenges or frozen ranking. Partners are unlinked, ranking positions compacted, and audit/history retained. Player/account records and email reservation remain; this is removal from the league rather than account erasure.
- Pending registrations retain the separate refusal workflow. Removed players remain visible to admins and can use the existing Reativar action.
- Validation: typecheck, 87 tests and production build pass. New browser test covers cancelling/confirming removal, preserved history, partner unlinking and exclusion from ranking.
- Removal option deployed on 21 October 2026. Its initial deployment was interrupted at the user’s pause, leaving created app/worker containers stopped. Resumed them when the user requested feature work again; health returned OK.

## Permanent deletion option — 21 October 2026

- User paused duplicate-account cleanup, then requested the deletion feature only. Neither real duplicate account has been changed; do not interpret the earlier preference to keep the first candidate as permission to resume cleanup.
- Admin → Jogadores → Mais ações includes Eliminar jogador e conta, including pending/rejected/removed profiles. The dialog displays the exact name/email and requires typing ELIMINAR. The current administrator cannot delete their own account.
- New validated `admin.player.delete` engine command protects players referenced by challenges/team snapshots, results, titles, messages or archived rankings. Those players retain the separate Remover jogador workflow. Frozen ranking also blocks deletion.
- Deletion unlinks partners, compacts rankings, removes availability/exceptions/weekly assignments/notifications and preserves audit/history with a player snapshot. The same MongoDB transaction deletes the linked login account, sessions, invitation/reset tokens, photos, push subscriptions and queued deliveries; email can then be registered again.
- Fixed a mobile overflow from the hidden import input inheriting toolbar widths.
- Validation: typecheck, 90 tests, production build and both player-deletion/player-removal browser checks pass. Browser deletion used two isolated demo accounts and verifies the selected account is gone, its session is revoked, the other account remains, and mobile layout fits.
- Feature deployed on 21 October 2026. Public health is OK; app healthy, worker running; runtime source hashes match local source; public login browser smoke check serves the deletion option without browser errors. Read-only production verification confirms both duplicate profiles and accounts still exist with no deletion audit for either. No live account deletion was performed.

## Live updates — 21 October 2026

- Added authenticated `/api/league/events` SSE driven by MongoDB change streams over league collections plus account/session changes. Events contain only invalidation signals and the build ID; actual data still comes from the authenticated `/api/league` view. Transaction event bursts are batched; locks/rate limits/delivery-worker bookkeeping do not trigger refresh loops.
- All signed-in screens now use one league-wide live stream, including chat. The older challenge-events endpoint remains available. Connection status is visible in the header. Reconnect handles network/HTTP failures; foreground/online refresh and the existing 30-second fallback remain. Streams close/re-authenticate every two minutes and clean up on disconnect.
- Refresh replaces data without a full navigation: active admin sections, filters, page size/page index and unsaved player form text are preserved. Partner selectors use controlled drafts; untouched rule forms follow server changes while unsaved rule edits remain. Pagination clamps only if the last page disappears; typing a search resets to the first page.
- A changed production BUILD_ID shows Nova versão disponível / Recarregar aplicação; no forced reload discards an open form. Existing tabs need one manual reload to load this initial live-update implementation; later deployments are detected on reconnection.
- Court availability refreshes when local court/match data changes, every minute while visible, and when returning online/to the tab. External Playtomic bookings are polled, not pushed.
- Validation: typecheck, all 90 tests and production build pass. Browser checks pass for two independent admin sessions (payments, registration/deletion counts, team ranking changes within five seconds, no page navigation, filters/pagination/drafts retained), HTTP-failure recovery, version prompt/explicit reload, court availability, existing desktop/mobile league/chat flow, and automatic player approval without pressing refresh (five relevant browser checks). The legacy league test now searches the paginated players table for its created fixture.
- Deployed on 21 October 2026. Public health is OK, app healthy, worker running, and runtime source hashes match local source. Read-only verification established the production change-stream cursor and build ID. Public browser smoke check serves the live-update/reload code without browser errors; anonymous requests to the stream return 401. No production account changes were made; duplicate-account cleanup remains paused.

## Workspace and repository

- Project: `/home/andre/Desktop/Personal/Works/neiva`.
- Stack: Next.js 16.4.1, React 19, TypeScript, MongoDB with transactions / replica set.
- GitHub: `git@github.com:AndreTorneiro6/fight_club.git`, branch `main`.
- This handoff accompanies the feature commit covering team rankings/export, admin tables and account deletion, email uniqueness, court availability and live updates. Consult `git log` and `git status` for the current commit and synchronization state.
- Previous HEAD: `b5d144d` — Save project handoff and startup context for future sessions.
- Earlier application baseline: `f8286bb` — Make admin player actions a compact icon list.
- The untracked `WhatsApp Unknown 2026-10-19 at 09.33.54.zip` is a user upload. Leave it alone; it was intentionally excluded from commits.
- The nested `fight-club/` and reference ZIP are the original Lovable reference, not the application to edit.
- Local `.env.production` and the server's `.env.production` contain credentials and are ignored by Git. Do not include their contents in notes or commits.

## Current product behavior

### Accounts and players

- Branding is Fight Club; the production domain is `fight-club.wbglabs.io`.
- Public registrations require the player to choose Ouro, Prata or Bronze and await admin approval.
- Valid invitation links preserve automatic approval, after the required account/email setup. A category already assigned by the club is preserved.
- Admin → Jogadores filters: Aprovadas, Pendentes, Recusadas, with totals. Division and player-status filters also have counts for the selected registration status.
- Rejected accounts can be approved again and are automatically removed after 48 hours.
- Player actions are compact vertical icon rows. Editar and Suspender/Reativar remain compact when Mais ações opens. The latter contains ranking freeze, history and account invitation/recovery actions.
- Password fields have show/hide controls.

### Teams, ranking and weekly competition

- Partners are assigned reciprocally with stable partner IDs; one selection updates both players.
- Ranking and weekly attack/defense controls show one entry per team. Players without partners remain individual entries.
- Admin can drag teams to change ranking position; keyboard/mobile controls are also available. Ranking changes go through the engine, audit and history.
- Admin assigns weekly attack/defense. Players cannot assign their own roles.
- Selecting a role locks the selection until Remover seleção is used. A team already involved in a challenge cannot clear/change that week's role.
- First-ranked team in a division cannot attack; last-ranked team cannot defend. Enforced in UI, weekly save/publication and new challenge validation. Boundaries use team ranking, not individual partner slots.
- The previous published week's role appears as Semana anterior: Ataque/Defesa where available.
- One match per team per week. Calendars show one week, not a month.
- Vacation freezes ranking. Vacation players can still be challenged and play after returning. Admin can manage freezing too.

### Matches and posters

- Participants confirm the proposed time; the club confirms the court before final scheduling when configured.
- Admin can edit matches/results and delete a match with its related data; audits are preserved. Later ranking changes can require manual review after deleting/correcting old results.
- Admin can generate matchday posters from the Fight Night reference design, filtered by week, day, division and results. Export is PNG, 1080×1920, three matches per page.
- Team snapshots on challenges preserve team names/members for historical posters and court-payment shares.

### Payments

- Admin → Pagamentos separates Quotas from Campos.
- Membership: manual Paid/Unpaid per player, also editable in the Jogadores table.
- Court: manual Paid/Unpaid for each individual participant's share. Marking one share paid leaves every other share and the membership unchanged.
- These are status records, not charges, payment collection, currency calculations or recurring resets. No automatic membership-period reset was requested.
- Data: `Player.membershipPayment`; `Challenge.courtPayments`, with timestamp and acting administrator.
- Command: `admin.payment.set`, kind `membership` or `court`, validated in `lib/engine.ts` and persisted transactionally.
- Changes are audited, duplicate same-status writes are idempotent, and non-admin views omit payment metadata.
- Court shares use saved match team members. Legacy completed matches without team snapshots do not acquire a newly assigned partner's share.

### Admin UX and guidance

- Admin navigation groups tools into Pessoas, Competição and Configuração.
- Convites is the invitation-link section; pending approvals are under Jogadores or the overview shortcut.
- Overview prioritizes registrations, club court confirmations, results and disputes. General league statistics are permanently visible below the priority tasks (local update above).
- Club-confirmation shortcut lists all matches needing club confirmation, including matches outside the current agenda week.
- In-app player/admin guides include replayable animations and interactive first-visit practice.
- The admin practice walkthrough now includes independently marking a membership and one court share paid; practice never writes league data.
- First-visit completion is stored per player and role in localStorage. Users can replay the walkthrough from Help.

## Playtomic: connected and working

- Official API credentials are configured locally and on production. Client ID and secret were initially swapped, corrected and authenticated successfully.
- `PLAYTOMIC_CLIENT_ID`, `PLAYTOMIC_CLIENT_SECRET`, `PLAYTOMIC_VENUE_ID` are set in the environment. No credentials belong in the browser.
- Neiva Padel Club venue: `fb5f8880-d2e1-409a-9253-23076fa5fa00` (public identifier).
- All four existing local courts have Playtomic resource IDs stored in MongoDB. Campo 1 corresponds to the sponsor-named LUSOMODULOS court; the others correspond to Padel 2, 3 and 4.
- Availability is visible in Jogos, Admin → Campos and challenge details (including the admin confirmation workflow).
- Choose a date to load the whole day automatically. Select 1 hora or 1h30; default is 1h30. Slots cover 07:00 to midnight in Portugal, including clock changes.
- Occupancy combines local league matches and Playtomic bookings. Missing/provider-failed information remains unknown rather than free. Past slots have no booking links.
- Reservar no Playtomic opens the club page; it does not preselect or create a booking. The official Third Party API is read-only and cannot create/change/cancel reservations.
- Relevant code: `lib/playtomic.ts`, `lib/court-day.ts`, `app/api/courts/availability/route.ts`, `components/court-availability.tsx`.
- Official API references: https://third-party.playtomic.io/ and https://helpmanager.playtomic.com/hc/en-gb/articles/38836515997073-Playtomic-API-Complete-Guide.

## Production operations

- App: https://fight-club.wbglabs.io ; health: `/api/health`.
- Last verified: app healthy and the screen-clock monitor reporting Fight Club online.
- Host/user: `andre@fight-club.wbglabs.io`.
- SSH needs the known-host alias (the old fight-night hostname no longer resolves):

```sh
ssh -o BatchMode=yes -o HostKeyAlias=fight-night.wbglabs.io andre@fight-club.wbglabs.io
```

- Remote project: `/home/andre/Desktop/WBGLabs/fight-club`.
- Deployment has used selective rsync then Compose rebuild/restart. Remote Git HEAD can lag the deployed source; check before trying to pull/reset it.
- Preserve production environment settings. Do not replace the full server `.env.production` with the local file just to update one integration.

```sh
# Run locally from the project; replace the example paths with actual changed files.
rsync -avR -e 'ssh -o BatchMode=yes -o HostKeyAlias=fight-night.wbglabs.io' \
  components/application.tsx app/globals.css \
  andre@fight-club.wbglabs.io:/home/andre/Desktop/WBGLabs/fight-club/

# Run on the server from its project directory.
docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml build app
docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml up -d --no-deps app worker
```

- App/worker containers: `fight-club-app-1`, `fight-club-worker-1`.
- Pi build usually takes roughly 2–3 minutes. Brief 404s after restart occur while Traefik waits for Docker health checks.
- Screen-clock: `/home/andre/.local/share/screen-clock/server.py`, user service `screen-clock.service`, status `http://127.0.0.1:8765/api/apps` on the Pi. Its status cache can show degraded briefly after a restart; wait for refresh.

## Verification and engineering constraints

- Read `AGENTS.md` and relevant local Next.js docs before editing. This repository explicitly requires consulting `node_modules/next/dist/docs/`.
- League writes must use the validated engine and MongoDB transactions. Preserve audit/history.
- Required substantive-change checks: `npm run typecheck`, `npm test`, `npm run build`.
- Latest suite: 90 unit/integration tests passing.
- Payments/admin update: 14 browser checks passed across isolated runs; latest compact-action change also passed the existing desktop/mobile league-flow browser test.
- Useful browser specs: admin-payments, admin-tools, guides, registration-ranking, ranking-teams, ranking-export, email-uniqueness, player-removal, player-deletion, live-updates, weekly-teams, court-availability, league.
- Playwright starts an isolated production demo on port 3100. Do not rebuild local `.next` while that browser test server is running.
- Large combined browser runs can hit authentication rate limits. Run spec groups in separate demo invocations instead of weakening production limits.
- Old legacy browser assertions were updated for the weekly calendar, required category/privacy selection, admin install support and notification heading. The invitation test opens Mais ações before Convidar.
- Do not test by marking real production payments or making real court bookings. Payment browser tests use isolated demo data.

## Outstanding or external limitations

- No unfinished implementation request at handoff.
- Email spam diagnosis is documented in `EMAIL-DELIVERY.md`: SMTP/TLS worked; SPF was missing on atlasapp.pt and DMARC was strict at the time checked. DNS correction and a recipient's authentication headers still need verification; this chat did not confirm a DNS fix.
- Playtomic cannot make reservations through the supplied official read-only API; booking completes on Playtomic.
- Push/install behavior depends on device permission and installation; setup guidance is in the app. No unresolved push diagnosis is currently active.

## Continuing in a new chat

Open this workspace and read this file plus `AGENTS.md`. Check Git and live health for changes since the snapshot, then continue from the user's new request. The user prefers completed implementation and clear, concise updates. Reuse existing authorization within its actual scope; this note does not authorize unrelated future actions.
