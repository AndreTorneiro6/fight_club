# Local admin assistant

Admin → Configuração → Assistente runs through Ollama on the same Raspberry Pi.
No cloud API/key or subscription is used. The runtime has `OLLAMA_NO_CLOUD=1`,
no published ports and only the internal Docker data network (no outbound route).
Initial installation downloads the official binary/model using a separate,
short-lived container with outbound access. Prompts are not sent during setup.

The Pi 4 has 8 GB RAM. The CPU-only runtime uses three cores, a configured 3 GB memory limit,
one loaded model and one generation at a time. Default: `qwen3:0.6b`, 8K context,
thinking disabled. Chat requests time out after four minutes; Cancel stops the
request. Small CPU models can be slow and inaccurate. The current Pi kernel does not expose
Docker memory accounting/limits: the configured memory ceiling is not enforced
until memory cgroups are enabled during a separately scheduled host restart.
The model/context/single-request limits remain in place; monitor host RAM.

## Install on the ARM64 production host

From the repository directory, with the existing production configuration:

```sh
bash scripts/install-local-ai.sh
docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml build app
docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml --profile local-ai up -d --no-deps ollama app worker
```

The installer verifies the official release SHA-256, extracts only the CPU runtime
and licences to ignored `.local-ai/runtime`, and keeps weights under ignored
`.local-ai/models`. Preserve these directories across deployments. Optional
`OLLAMA_ARCHIVE` points to an already-downloaded release archive. Runtime release
is pinned to 0.40.7. The model download tag should be updated deliberately after
checking output quality and available resources.

Normal app-only rebuild/restart commands remain valid; the running Ollama
container is preserved. To start Ollama after an explicit stop, include
`--profile local-ai up -d --no-deps ollama`. Never use `down -v` to deploy.

Read-only production check (no league changes or saved proposals):

```sh
docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml exec -T app node --import tsx scripts/check-local-ai.ts
```

## Actions and data

Only authenticated administrators can use the endpoints. The model receives a
fresh, bounded snapshot with player names, categories, status, partners, membership
payment status, team rankings, challenge totals and rules. It does not receive
emails, phone numbers, authentication records, chat messages or credentials.

Explicit supported requests with complete names or #registration numbers are
resolved deterministically before inference; ambiguous matches require clarification.
These requests remain available while the other admin is generating a reply.
Supported proposals: membership status, associate two partners, move a team to
another team's position. Other requests are conversational or point to the panel.
No shell, remote browsing, code execution, player deletion or automatic messaging
is exposed. Both duplicate profiles previously discussed remain untouched.

Every proposal needs explicit confirmation, expires after ten minutes, belongs
to its administrator and can be applied once. Confirmation runs the validated
engine inside the shared MongoDB transaction, preserves normal audit/history,
and rejects proposals if the player/ranking state changed in the meantime.
League realtime updates notify both administrators as usual.

Conversations live in browser session storage, separately per administrator,
with the latest eight messages retained when switching sections. They are not
shared between administrators. Proposals are not restored from browser storage;
ask again after leaving the section. Nova conversa clears the retained chat.

## Verification

Unit checks cover sanitization, team positions, local-only endpoints, untrusted
model output, stale-state rejection, admin authorization and engine audit.
The browser integration uses a local stub model with the actual authenticated
backend and MongoDB transaction, covering preview, confirmation, single use,
section changes and mobile layout:

```sh
OLLAMA_BASE_URL=http://127.0.0.1:11439 npx playwright test e2e/admin-assistant.spec.ts
```

Official references: https://docs.ollama.com/api/chat,
https://docs.ollama.com/faq, https://ollama.com/library/qwen3:0.6b.

The small local model completed a cold league query in approximately 3m17s.
Cached follow-ups can be quicker, but changed data can require another cold prompt.
Precomputed totals are provided because this model cannot reliably count rows.
Treat generated explanations as suggestions and verify facts in the league UI.
The larger 1.7B model exceeded the four-minute budget on this Pi during setup.
