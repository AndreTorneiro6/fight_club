# Fight Club Padel League

Next.js 16, React 19, TypeScript and MongoDB. Portuguese interface, responsive player/admin dashboards and the navy/gold Fight Club identity. The original Lovable export is preserved in `fight-club/` and `fight-club-source.zip`.

## Try it immediately

Requires Node.js 22+ and npm. No MongoDB account is needed for the local demo:

```bash
npm install
npm run dev:demo
```

Open **http://localhost:3000**. The runner starts a real, single-node MongoDB replica set, seeds fictitious records and launches Next.js. Its first run downloads a MongoDB binary; internet access is required. Demo data persists in ignored `.demo-data/`. Stop the runner before removing that directory to reset the demo.

| Role                              | Email                      | Password       |
| --------------------------------- | -------------------------- | -------------- |
| Administrator                     | admin@fightclub.local      | FightClub2026! |
| Player · Carlos Pereira · Ouro #7 | jogador@fightclub.local    | FightClub2026! |
| Opponent · Luís Costa · Ouro #5   | adversario@fightclub.local | FightClub2026! |

Use separate browsers or an incognito window to test both players. Never use demo accounts/data on a public production deployment.

## Use your MongoDB database

1. Create a MongoDB Atlas database, or run a local MongoDB replica set. Transactions require a replica set; a standalone `mongod` is insufficient.
2. Copy `.env.example` to `.env.local` and set `MONGODB_URI`, `MONGODB_DB`, `APP_URL` and `ADMIN_EMAIL`.
3. Set `SMTP_URL` and `EMAIL_FROM` to send email verification, recovery and invitations. Registration requires email verification outside demo mode. Without SMTP, an administrator can copy an invitation/recovery address from player management. To bootstrap the first administrator without SMTP, generate a recovery token using the local CLI below.
4. Initialize the empty league, then start Next.js:

```bash
npm run seed
npm run dev
```

The regular seed adds settings, divisions, courts and an active season. It does **not** create demo users or players. The account matching `ADMIN_EMAIL` becomes administrator after email ownership is confirmed. There is no automatic “first account wins admin” behavior.

If SMTP is not configured, register the administrator account in the app, then run `npm run recovery -- admin@yourclub.pt` on the server and open the one-use address it prints. This CLI requires local access to the database configuration.

Local MongoDB alternative:

```bash
docker compose up -d
```

Use `MONGODB_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true`. This Docker setup binds MongoDB to loopback and is intended for local development.

## What works

- Email/password registration, email verification, hashed opaque sessions in HttpOnly cookies, logout and Google OAuth for existing accounts when configured. New accounts require a club registration link and privacy acknowledgement, including accounts created from an admin email invitation.
- Profiles, avatar uploads, weekly availability with multiple windows, date exceptions and player history.
- Independent Ouro/Prata/Bronze rankings; configurable challenge limits, cooldowns and deadlines.
- Challenges, acceptance/refusal, two-player availability proposals, compatible scheduling, court conflicts and player double-booking prevention.
- Challenge-specific chat delivered in real time with authenticated Server-Sent Events backed by MongoDB change streams. Connections reconnect automatically; a 30-second general refresh remains as a fallback for league data.
- A challenge hub with received/sent/history filters, league-wide admin management, attack/defense icons and audited administrative role assignment before scheduling.
- Three or four initial calendar proposals, edited in Portugal time. A prominent “Aceitar este horário” button accepts an opponent's offer; compatible availability can also be used to propose a precise time.
- Three-party scheduling: attacker and defender consent to the same proposal, then the club (administrator) chooses a court and confirms the booking. Until then, the challenge is “A confirmar horário” and no new court reservation is created. Club confirmation is enabled by default and configurable in league rules.
- Every challenge has a visible monthly calendar, including existing challenges without proposals and read-only scheduled/completed games. Select a day to propose availability; admins can propose on behalf of either participant after acceptance, with audit records. Pending attackers can add missing proposals without recreating their challenge.
- Proposing availability on a player's behalf does not confirm that player's attendance. Administrative time proposals require both players to accept. A changed proposal gets a new ID, so an old confirmation cannot approve a replacement. Refusing a time reopens availability without a ranking penalty; club approval rechecks court/player conflicts inside the transaction. Previously confirmed games are retained; a rescheduling proposal does not release the old reservation before the replacement is confirmed.
- The challenge hub opens on active challenges for players and league-wide management for admins. Reaching the active-challenge limit shows the reason and direct links to existing challenges rather than only an empty opponent list.
- Public-to-players rule and prize pages. Administrators publish supplementary rules and prize descriptions; numerical competition rules remain in settings.
- Five device-persistent color themes, including a Fight Night palette inspired by the supplied card (black, gold, orange, red and silver). Choose with the floating palette button on any page.
- Optional set scores, opponent confirmation/dispute, transactional results/rankings and statistics.
- Admin player creation/editing, division/position changes, suspension/reactivation, removal from current competition, invitations, account recovery, complete history and CSV/XLSX import/export.
- Admin scheduling, dispute resolution, cancellation, extensions and replay. Correcting a previously confirmed result updates statistics and preserves an audit record; administrators explicitly review rankings/champions because later games may depend on the old result.
- Configurable swap/leapfrog rankings and refusal/cancellation policies; capacity and court management.
- Title Fights, champion assignment, automatic title changes, defenses and Hall of Champions.
- Seasons: create/start/pause/resume/archive, optional date pauses, archived rankings and configurable promotion/relegation. Players carry over with their current rankings; lifetime statistics remain lifetime totals and results retain season references.
- Calendar `.ics` download and installable web app manifest.

The default refusal policy is `busy_only`: a defender can refuse only when another accepted/scheduled/result-pending/disputed challenge exists. A merely pending challenge does not qualify. `reason` and `forfeit` are configurable alternatives. This uses the visible part of the supplied conversation; the pasted policy was truncated.

## Scheduled deadline processing

Commands process deadlines before validating league mutations. The interface also derives overdue/live statuses between jobs. For automatic closure and reminders even when nobody is using the app, set `CRON_SECRET` and configure a scheduler to call the following every 5–15 minutes:

```text
POST https://your-domain/api/jobs
Authorization: Bearer <CRON_SECRET>
```

Jobs persist expiration, release active challenge limits and create deduplicated in-app reminders. Automatic forfeits are not applied to expired challenges; administrators can extend or resolve them.

## Google and email

For Google OAuth, configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` with callback `https://your-domain/api/auth/google-callback`. The button is hidden until configured. Email ownership must be verified by Google before a Google account can link by email.

`SMTP_URL` is a Nodemailer transport URI. Verification/invite/reset tokens are hashed in MongoDB and expire after 24 hours. Admin “Recover access” creates a one-use password-reset address; completing it invalidates existing sessions. It never reveals a player's password.

## Architecture and consistency

- `app/`: Next.js App Router pages and API route handlers.
- `components/application.tsx`: player and admin interface, keeping the original Portuguese routes and design identity.
- `lib/engine.ts`: validated domain commands, server-only rule enforcement, audit/history generation.
- `lib/rules.ts`: shared eligibility, deadline and availability calculations. Client calculations are advisory; the server checks every mutation.
- `lib/db.ts`: connection reuse, indexes, scoped views and transactions. Every league mutation touches a shared club lock document inside the transaction, serializing concurrent ranking and booking decisions.
- `lib/auth.ts`: password hashing, email proof, sessions, rate limits and recovery.
- `lib/integrations.ts`: interfaces for future booking and payment providers; player push delivery uses Web Push.
- `tests/`: rule and real MongoDB transaction tests.
- `e2e/`: browser tests with separate player, opponent and administrator sessions.

MongoDB stores separate collections for users, sessions, tokens, players, divisions, settings, seasons, challenges, slots, messages, availability, exceptions, matches, results, notifications, notification deliveries, push subscriptions, ranking history, champions, courts, photos and audit logs. Title fights are challenges with a `titleFight` flag. All IDs are stable strings and old records are retained on transfers. Removed players remain for historical references.

For this club-sized league, mutations load league state inside a serialized transaction and write only changed documents. A large multi-club deployment should introduce per-league partitioning and targeted queries before scaling. Player views hide other players' email, phone, account IDs, private availability and chat; general league fixtures/results/rankings are visible to signed-in players.

## Validation

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

The browser suite starts an isolated MongoDB demo and production server on port 3100; run `npm run build` first. It covers login, desktop/mobile layout, challenge creation/acceptance, availability matching, scheduling, chat, administrative resolution, ranking updates, player creation and exports. The domain tests cover regular opponent-confirmed results without waiting for a real match to finish. Test screenshots/traces are saved in ignored `test-results/`.

Validation covers domain/database rules and desktop/mobile browser workflows, including cross-session live chat without refresh, theme persistence, mobile challenge management, admin publication of rules/prizes, challenge-limit explanations and the monthly-calendar scheduling flow. Local SMTP serialization, WhatsApp template requests with a mocked provider, queue retries/consent, installable-player UI and offline fallback are also covered. Real provider delivery, Google OAuth and production hosting require external configuration and were not exercised.

For live chat and live scheduling updates, the hosting/proxy must support streaming responses without buffering. MongoDB must remain a replica set; the included demo and Atlas support change streams. The stream sends only a refresh signal for challenge, availability, match and message changes, checks challenge access before opening and before each event, and reconnects every two minutes to recheck the session. Reassigning a challenge resets acceptance/proposed slots and preserves the original messages for their original audience and administrators. Legacy availability without a known author does not automatically count as the player's consent.

## Production

Deploy to a Node.js host or a Next.js-compatible platform with MongoDB Atlas access. Set the environment variables there, initialize the target database once with `npm run seed`, then:

```bash
npm run build
npm start
```

Use an HTTPS `APP_URL`; session cookies become secure automatically. The health endpoint is `/api/health`. Configure SMTP, Google if desired, the deadline scheduler and database backups. No deployment or external account provisioning is included in the local build.

### Self-host with Docker Compose, Traefik and Let's Encrypt

The repository also includes a self-hosted stack. It runs the Next.js app and notification/deadline worker, an authenticated MongoDB 4.4.18 single-node replica set, and Traefik with automatic HTTPS certificates. MongoDB is only reachable on the private Docker network; only ports 80 and 443 are published. The existing `compose.yaml` uses the same MongoDB version for local development.

#### Raspberry Pi 4 database compatibility

Use a 64-bit Raspberry Pi OS (a 32-bit OS cannot run the ARM64 MongoDB image). The Pi 4's Cortex-A72 is ARMv8-A; MongoDB's prebuilt server releases after 4.4.18 require ARMv8.2-A, so the Compose files pin MongoDB to `4.4.18`. Docker selects the ARM64 image on the Pi. The application uses the MongoDB Node.js driver 7, whose minimum supported server version is 4.4, and the league's replica-set transactions are available in 4.4.

MongoDB 4.4.18 is end-of-life. It is affected by CVE-2025-14847, so both Compose configurations explicitly disable the vulnerable zlib network compressor; this is a mitigation, not a substitute for a patched release. Because of the Pi 4 CPU limit, keep MongoDB unexposed: the production Compose file does not publish port 27017 and places it on an internal Docker network, with authentication and replica-set keyfile enabled. Restrict the Pi's host firewall to the web ports and keep the OS patched. Use a USB SSD for persistent MongoDB data rather than relying on a microSD card, and set up off-device backups. For a public-facing league, the safer option is to run the Next.js app on the Pi and use a currently supported MongoDB Atlas cluster for the database.

The production stack runs a backup sidecar using the same MongoDB image. It makes a compressed database dump as soon as MongoDB is healthy, repeats every 24 hours, retries failures hourly, and deletes backups older than 14 days. The defaults are editable with `BACKUP_INTERVAL_HOURS` and `BACKUP_RETENTION_DAYS`. Dumps are written to `BACKUP_PATH` (default `./backups`), outside the MongoDB data volume, with owner-only directory/file permissions. Check its logs with `docker compose --env-file .env.production -f compose.production.yaml logs -f backup`.

On the Pi, mount a USB SSD at a stable path (for example `/mnt/club-ssd`) and set `BACKUP_PATH=/mnt/club-ssd/fight-club-backups` in `.env.production`. Create that directory and set `BACKUP_UID` and `BACKUP_GID` in the same file to the IDs of the user who owns it (`id -u` and `id -g` on the Pi). Make sure the SSD is mounted before Docker starts; otherwise the host may write backups to the SD card's mount directory. Copy backups to a separate device or encrypted remote storage as well; a backup on the Pi cannot protect against losing the Pi or its attached disk.

Before starting the stack, create an A record for your domain pointing to the server and allow inbound TCP ports 80 and 443. Replace `fightclub.example.com` in `.env.production` with the domain you choose, and set `LETSENCRYPT_EMAIL`, `ADMIN_EMAIL` and `VAPID_SUBJECT` to addresses you control. Keep `.env.production` and `.secrets/mongo-keyfile` private; both are ignored by Git and contain generated secrets. The VAPID key pair is already generated in `.env.production` for this installation. Configure SMTP and any optional Google/WhatsApp credentials there when ready.

On the Docker host, from the project directory, run:

```sh
docker compose --env-file .env.production -f compose.production.yaml config
docker compose --env-file .env.production -f compose.production.yaml build app
docker compose --env-file .env.production -f compose.production.yaml up -d mongo
docker compose --env-file .env.production -f compose.production.yaml run --rm app npm run seed:container
docker compose --env-file .env.production -f compose.production.yaml up --build -d
```

The first start obtains the TLS certificate after DNS points to the host. Check progress with `docker compose --env-file .env.production -f compose.production.yaml logs -f traefik app mongo worker backup`. The app health endpoint is `/api/health`. The worker handles queued notifications and deadlines automatically. The backup sidecar writes logical MongoDB archives to `BACKUP_PATH`; do not copy the live MongoDB data volume as a routine backup. Back up `traefik-certs` if you want to preserve issued certificates, and store protected copies of `.env.production` and `.secrets/mongo-keyfile` separately. Losing the Mongo keyfile prevents the replica set from restarting against its existing data. Do not use `docker compose down -v` unless you intend to erase database and certificate data.

To restore an archive, first stop the app, worker, and scheduled backup so none writes during restoration. Replace the filename below with the desired archive; the restore script asks you to type `RESTORE` before it drops and recreates the archived database collections:

```sh
docker compose --env-file .env.production -f compose.production.yaml stop app worker backup
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps --entrypoint /bin/bash backup /usr/local/bin/restore.sh /backups/fight-club-YYYYMMDDTHHMMSSZ.archive.gz
docker compose --env-file .env.production -f compose.production.yaml up -d app worker backup
```

Test a restore on a separate MongoDB instance before relying on these backups. Keep a copy of `.env.production` and `.secrets/mongo-keyfile` with the backup: the dump contains league data, but the environment/keyfile are needed to operate the deployment securely.

When the real domain is set, rebuild the app so its HTTPS security headers are generated for the production origin. If you change it later, update `APP_DOMAIN` and `APP_URL` together and recreate the stack. The included `.env.production` is only a local template with generated secrets and a reserved placeholder domain; it is not configured to obtain a public certificate until you replace those values and point DNS at the server.

## External services and original data

Playtomic read-only court-occupancy checks are implemented through its official Third Party API; live results require venue credentials and each local court to be mapped to its Playtomic resource ID. Court reservations remain in this app and are confirmed by the club. Payments, sponsors and promotional codes remain future integrations. WhatsApp Business notifications use Twilio and require provider configuration (see below).

The Lovable ZIP includes source/schema/demo seed definitions, not live user records or a database export. CSV/XLSX import can bring players into this app. Migrating real historical challenges/results requires a separate database export and mapping; existing Supabase passwords/sessions are not automatically transferred. Invite players to establish access in the new app.

## App dos jogadores (Android e iPhone)

A aplicação pode ser instalada como PWA através de **Perfil → App dos jogadores → Instalar app dos jogadores**. No iPhone, usar Safari → Partilhar → Adicionar ao ecrã principal; no Android, usar Chrome → Instalar aplicação. O administrador mantém o painel web, sem convite de instalação. A PWA reutiliza a mesma autenticação e base de dados.

Estão incluídos ícones PNG (192/512 px), ícone Apple, manifest, atalhos de desafios/jogos e service worker. A instalação requer HTTPS ou localhost. O modo offline apresenta uma página de reconexão; não guarda dados privados, chat ou ações da liga em cache. É necessária internet para os jogos e chat. Isto não é um binário publicado na App Store/Google Play. Para publicação nas lojas será necessário decidir o empacotamento, configurar os projetos nativos e as contas de programador. Um domínio HTTPS permanente é necessário para uma instalação duradoura; cada túnel Pinggy novo representa uma origem diferente.

## Alertas por email e WhatsApp

Os jogadores gerem alertas push em **Perfil → Notificações no telemóvel** e os canais de email/WhatsApp em **Perfil → Email e WhatsApp**. Push é opcional e ativado por dispositivo após autorização do sistema. Email está ativo por defeito para contas verificadas. WhatsApp exige autorização explícita e número internacional (ex.: `+351912345678`). Alterar o número no perfil ou pelo administrador revoga a autorização até nova confirmação. Os alertas dentro da aplicação funcionam sempre. As contas fictícias `.local` nunca recebem mensagens externas.

As notificações push da PWA usam Web Push com chaves VAPID e não têm tarifa por mensagem. Gera as chaves com `npx web-push generate-vapid-keys` e configura `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` no alojamento. Jogadores ativam cada dispositivo no perfil. iPhone/iPad precisam de iOS/iPadOS 16.4+, da app adicionada ao ecrã principal e de autorização explícita. A notificação abre o desafio associado. As subscrições são guardadas por utilizador/dispositivo e o worker existente também envia os alertas push. Jogadores e administradores recebem alertas de novas mensagens no desafio; a resposta do administrador notifica ambos os jogadores.

O administrador recebe novos desafios, aceitação/recusa, pedidos de marcação, pedido de confirmação do campo quando ambos aceitaram, jogos marcados, cancelamentos, horários recusados, resultados submetidos/confirmados, disputas e prazos expirados. Os jogadores recebem os eventos dos seus desafios, chat e lembretes. O painel **Notificações → Entregas externas** mostra a configuração dos canais e os últimos 50 envios, apenas para administradores.

Configurar no servidor (não no navegador):

```dotenv
SMTP_URL=smtps://USER:PASSWORD@smtp.example.com:465
EMAIL_FROM=Fight Club <liga@example.com>
APP_URL=https://liga.example.com
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+...
TWILIO_WHATSAPP_CONTENT_SID=HX...
```

Os envios WhatsApp usam a API oficial do Twilio/WhatsApp Business e um template **utility** aprovado, com `{{1}}` título do evento, `{{2}}` detalhe e `{{3}}` link completo da aplicação. Exemplo de corpo a submeter para aprovação: `Fight Club Padel League. Alerta: {{1}}. Detalhes: {{2}}. Abrir na aplicação: {{3}}`. A aprovação do template e a ativação do número são efetuadas no fornecedor. As notificações iniciadas pela aplicação não dependem da janela de conversa de 24 horas. Não existe automação por WhatsApp Web.

Uma fila MongoDB (`notification_deliveries`) é criada **na mesma transação** que o evento da liga. Não há envio dentro de transações que possam repetir. Cada evento/destinatário/canal tem uma chave única; workers concorrentes usam uma reserva temporária atómica. A fila verifica novamente acesso e preferências antes de enviar. Falhas transitórias tentam novamente até cinco vezes com espera crescente; sem credenciais, o envio fica bloqueado com motivo visível. `Aceite pelo fornecedor` significa aceitação pelo serviço, não entrega/leitura no dispositivo. Um processo interrompido após a aceitação externa mas antes da gravação pode provocar repetição: fornecedores externos não partilham a transação MongoDB.

### Playtomic occupancy checks

The challenge detail screen can check court occupancy using the official, read-only Playtomic Third Party API; it does not scrape the public website. The club obtains the client ID and secret from Playtomic Manager → Settings → Developer tools and configures `PLAYTOMIC_CLIENT_ID`, `PLAYTOMIC_CLIENT_SECRET` and `PLAYTOMIC_VENUE_ID` on the server. The administrator maps each court by setting its Playtomic resource ID under **Admin → Settings → Courts**. Credentials never go to the browser. The connector caches results briefly, checks the configured venue and only reports whether a booking occupies a mapped resource; a clear slot still needs confirmation in Playtomic/the club, and this app does not reserve it. See [Playtomic API setup](https://third-party.playtomic.io/), [OAuth](https://third-party.playtomic.io/endpoints/auth/) and [bookings](https://third-party.playtomic.io/endpoints/bookings/).

Em produção, manter um worker ativo:

```sh
npm run notifications:work
```

Ou chamar `POST /api/jobs` a cada minuto, com `Authorization: Bearer <CRON_SECRET>`. A rota autentica o agendador, processa prazos/lembretes e escoa a fila. Novas ações também iniciam um lote após devolver a resposta, sem atrasar a interface. O runner de demonstração inclui o worker automaticamente. Configurar um supervisor (systemd/PM2/plataforma de alojamento) para o worker persistir após reinícios.

Sem credenciais SMTP e WhatsApp Business configuradas, a implementação está pronta mas não envia mensagens reais. Os testes usam um servidor SMTP local e um endpoint WhatsApp simulado; nunca enviam mensagens a contactos reais.

## Antes de convidar jogadores para produção

- Publica numa origem HTTPS permanente e configura `APP_URL`, `ADMIN_EMAIL` e segredos aleatórios no gestor de variáveis do alojamento. Não uses a origem de demonstração nem as contas `@fightclub.local` com jogadores reais: o runner de demonstração tem credenciais de teste conhecidas e armazena dados na base de dados local `.demo-data/`.
- Cria uma base MongoDB de produção com replica set, autenticação/rede restritas e cópias de segurança automáticas; verifica uma reposição antes de importar jogadores reais.
- Cria e valida a conta administradora com palavra-passe exclusiva. A conta deve ter um email real com SMTP ativo para confirmação e recuperação.
- Configura remetente de email e SPF/DKIM/DMARC no domínio. Configura o WhatsApp Business, template utility aprovado e consentimento dos jogadores. O link do administrador abre o WhatsApp para escolher o grupo e enviar a mensagem manualmente.
- Publica o email de contacto do clube em `PRIVACY_CONTACT_EMAIL` e revê o aviso de privacidade e a política de conservação para os dados e fornecedores efetivamente usados.
- Mantém o worker ou agendador de prazos ativo e configura alertas de erro e cópias da base de dados.
- Para consultar ocupação Playtomic, obtém credenciais aprovadas em Manager → Settings → Developer tools e mapeia cada campo pelo respetivo resource ID. Sem estes valores, a aplicação identifica Playtomic como não configurado e pede confirmação ao clube.
- Faz uma sessão real de ponta a ponta com uma conta admin e duas contas de jogador de teste antes de abrir inscrições ao grupo.

A integração Playtomic usa a API oficial de terceiros, com credenciais emitidas ao clube e acesso limitado à ocupação. Não recolhe dados por raspagem do site. [Documentação oficial da API](https://third-party.playtomic.io/).
