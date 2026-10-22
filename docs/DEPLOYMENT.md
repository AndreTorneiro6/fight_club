# Deploy branch → Raspberry Pi

The application runs on the existing **Raspberry Pi 4 Model B, ARM64**. A literal Pico microcontroller cannot host this Next.js/MongoDB/Docker stack.

Production releases use the **deploy** branch. GitHub-hosted CI runs typecheck, all tests, the Next.js build and browser checks. If they pass, a dedicated self-hosted runner on the Pi checks out the same commit, builds the ARM64 image locally and restarts only app/worker. No deployment SSH key, registry credentials or GHCR service is needed. Main/PR checks never run the deployment job.

```bash
git switch deploy
# Commit the intended release, then:
git push origin deploy
```

To release work developed on main, merge main into deploy and push deploy. The release branch includes the previously tested application changes; the original Lovable reference and source WhatsApp/ZIP attachments remain outside the release inputs.

## One-time registration

The repository's existing SSH authentication can push Git but cannot register a GitHub Actions runner. Runner registration requires one-time GitHub API authorization by the repository owner/admin.

1. Run `scripts/install-actions-runner.sh` using the operator workstation's existing Pi SSH access. It downloads the official ARM64 runner with a verified SHA-256 into `/home/andre/actions-runner-fight-club`. The existing runner for the other app is left alone. No containers are restarted.
2. Authenticate GitHub CLI with the owner/admin account:

   ```bash
   gh auth login --hostname github.com --git-protocol ssh --web --scopes workflow --skip-ssh-key
   ```

3. Run `scripts/install-actions-runner.sh --register`. It obtains a short-lived registration token, sends it over the existing SSH channel without displaying or storing it in the repository, and starts the runner as an `andre` user service (`fight-club-runner.service`), with user lingering enabled so it survives logout/reboots.

The runner is named `fight-club-rpi` with label `fight-club-production`, scoped to `AndreTorneiro6/fight_club`. Its working directory is isolated from the live production directory. GitHub's runtime runner credentials stay in its private directory; no production environment or credentials are committed.

## Deployment behavior

- Only push/manual runs of `refs/heads/deploy` can reach the Pi job; PR checks use hosted machines. Workflow actions are pinned by commit hash and checkout does not persist Git credentials.
- The runner uses Docker already installed on the Pi. Builds use the isolated checked-out revision, not the live directory containing production environment/data. The script verifies the branch, SHA and clean tracked source before building.
- Deployments are serialized in GitHub and with a host lock. MongoDB is backed up before replacing app/worker. MongoDB, backup, Ollama and Traefik containers are left running.
- New app health and worker state/restart count must pass. Failures or interrupted updates restore the previous image, environment and deployment markers. Database recovery is deliberately operator-controlled; deployment never rewrites league data.
- Success updates only `FIGHT_CLUB_APP_IMAGE` in the existing `.env.production`, preserving every other setting. `.deployed-revision` and `.deployed-image` record the live release. The local image tag is `fightclub:git-<validated SHA>`.

View runs under Actions → **Validate and deploy Fight Club**. A queued deploy job means the `fight-club-production` runner is not yet registered/online. Register it once; ordinary deploy-branch pushes need no further setup or approval.

## Operations

```bash
# On the Pi, ordinary restarts retain the deployed image.
docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml up -d --no-deps app worker
```

For an emergency manual source rebuild, explicitly override the image during both build and restart with `FIGHT_CLUB_APP_IMAGE=fightclub:production`; otherwise the persisted per-commit image is intentional.

CI still consumes the repository/account's included Actions allowance for private repositories. The self-hosted deployment runs directly on the existing Pi. See GitHub's [self-hosted runner registration](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners) and [runner labels](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/use-in-a-workflow).
