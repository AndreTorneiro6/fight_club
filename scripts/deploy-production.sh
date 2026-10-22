#!/usr/bin/env bash
# Executed on the Pi by the dedicated repo-scoped GitHub Actions runner.
set -Eeuo pipefail
umask 077
[[ "${GITHUB_REF:-}" == refs/heads/deploy ]] || { echo 'Only the deploy branch can update production.' >&2; exit 64; }
revision="${GITHUB_SHA:-}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid Git revision.' >&2; exit 64; }
source_dir="$(realpath "${1:?Pass the checked-out GitHub workspace.}")"
[[ "$(git -C "$source_dir" rev-parse HEAD)" == "$revision" ]] || { echo 'Checkout differs from the validated commit.' >&2; exit 65; }
git -C "$source_dir" diff --quiet HEAD -- || { echo 'The checked-out source has uncommitted changes.' >&2; exit 65; }
project_dir="${FIGHT_CLUB_DEPLOY_DIR:-/home/andre/Desktop/WBGLabs/fight-club}"
project_dir="$(realpath "$project_dir")"
[[ "$source_dir" != "$project_dir" ]] || { echo 'Use an isolated runner checkout, not the live production directory.' >&2; exit 65; }
cd "$project_dir"
exec 9> .deploy.lock
flock -w 600 9
compose=(docker compose --env-file .env.production -f compose.production.yaml -f compose.pi.yaml)
image="fightclub:git-$revision"
docker build --build-arg APP_URL=https://fight-club.wbglabs.io \
  --label "org.opencontainers.image.revision=$revision" --tag "$image" "$source_dir"
[[ "$(docker image inspect "$image" --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')" == "$revision" ]] || { echo 'Built image has the wrong revision.' >&2; exit 65; }
previous_image="$(docker inspect fight-club-app-1 --format '{{.Image}}')"
previous_worker="$(docker inspect fight-club-worker-1 --format '{{.Image}}')"
[[ "$previous_image" == "$previous_worker" ]] || { echo 'App and worker differ; review before deploying.' >&2; exit 65; }
docker image tag "$previous_image" fightclub:previous-deployment
backup_name="fight-club-before-actions-${revision}.archive.gz"
docker exec fight-club-backup-1 bash -c 'umask 077; mongodump --quiet --uri="$MONGODB_URI" --archive="/backups/$1" --gzip' -- "$backup_name"
snapshot_dir="$(mktemp -d)"
trap 'rm -rf "$snapshot_dir"' EXIT
cp -p .env.production "$snapshot_dir/previous.env"
for marker in .deployed-revision .deployed-image; do
  if [[ -f "$marker" ]]; then cp -p "$marker" "$snapshot_dir/$marker"; fi
done
healthy() {
  local attempt state
  for attempt in {1..30}; do
    state="$(docker inspect fight-club-app-1 --format '{{.State.Health.Status}}' 2>/dev/null || true)"
    if [[ "$state" == healthy ]] && [[ "$(docker inspect fight-club-worker-1 --format '{{.State.Running}}' 2>/dev/null || true)" == true ]] && [[ "$(docker inspect fight-club-worker-1 --format '{{.RestartCount}}' 2>/dev/null || true)" == 0 ]]; then return 0; fi
    sleep 4
  done
  return 1
}
rollback() {
  trap - ERR HUP INT TERM
  echo 'Deployment failed; restoring the previous app and worker image.' >&2
  cp -p "$snapshot_dir/previous.env" .env.production
  for marker in .deployed-revision .deployed-image; do
    if [[ -f "$snapshot_dir/$marker" ]]; then cp -p "$snapshot_dir/$marker" "$marker"; else rm -f "$marker"; fi
  done
  FIGHT_CLUB_APP_IMAGE=fightclub:previous-deployment "${compose[@]}" up -d --no-deps app worker
  healthy || echo 'Rollback needs operator review.' >&2
  exit 1
}
trap rollback ERR HUP INT TERM
FIGHT_CLUB_APP_IMAGE="$image" "${compose[@]}" up -d --no-deps app worker
healthy
# Persist only the selected image, preserving the production environment settings.
python3 - "$image" "$revision" <<'PY'
from pathlib import Path
import os, stat, sys, tempfile
path = Path('.env.production')
lines = path.read_text().splitlines(keepends=True)
value = 'FIGHT_CLUB_APP_IMAGE=' + sys.argv[1] + '\n'
found = False
for index, line in enumerate(lines):
    if line.startswith('FIGHT_CLUB_APP_IMAGE='):
        lines[index] = value
        found = True
if not found:
    if lines and not lines[-1].endswith('\n'): lines[-1] += '\n'
    lines.append(value)
fd, temporary = tempfile.mkstemp(dir='.', prefix='.deploy-env-')
try:
    with os.fdopen(fd, 'w') as stream:
        stream.write(''.join(lines))
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, stat.S_IMODE(path.stat().st_mode))
    os.replace(temporary, path)
finally:
    if os.path.exists(temporary): os.unlink(temporary)
Path('.deployed-revision').write_text(sys.argv[2] + '\n')
Path('.deployed-image').write_text(sys.argv[1] + '\n')
PY
trap - ERR HUP INT TERM
printf 'Deployed validated revision %s directly on the Pi\n' "$revision"
