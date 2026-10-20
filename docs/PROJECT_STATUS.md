# Fight Club — project handoff

Last updated: 20 October 2026 (Europe/Lisbon).
This is a saved snapshot, not a substitute for checking Git and live service state.

## Workspace and repository

- Project: `/home/andre/Desktop/Personal/Works/neiva`.
- Stack: Next.js 16.4.1, React 19, TypeScript, MongoDB with transactions / replica set.
- GitHub: `git@github.com:AndreTorneiro6/fight_club.git`, branch `main`.
- Latest application commit at handoff: `f8286bb` — Make admin player actions a compact icon list.
- Previous feature commit: `d11ecaf` — membership and individual court payments, simpler admin navigation.
- GitHub and local application code were synchronized. This handoff is committed separately.
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
- Overview prioritizes registrations, club court confirmations, results and disputes. General league statistics are in a disclosure.
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
- Choose a date to load the whole day automatically. Select 1 hora or 1h30; default is 1h30. Slots cover local midnight to midnight, including Portugal's clock changes.
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
- Latest suite: 83 unit/integration tests passing.
- Payments/admin update: 14 browser checks passed across isolated runs; latest compact-action change also passed the existing desktop/mobile league-flow browser test.
- Useful browser specs: admin-payments, admin-tools, guides, registration-ranking, ranking-teams, weekly-teams, court-availability, league.
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
