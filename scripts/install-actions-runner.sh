#!/usr/bin/env bash
# Prepare the repo-scoped ARM64 runner using existing operator SSH access.
# Add --register after authenticating gh as an owner/admin of the repository.
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ssh_args=(-o BatchMode=yes -o HostKeyAlias=fight-night.wbglabs.io andre@fight-club.wbglabs.io)
ssh "${ssh_args[@]}" 'bash -s' <<'REMOTE'
set -euo pipefail
umask 077
[[ "$(uname -m)" == aarch64 ]] || { echo 'Expected the ARM64 Raspberry Pi server.' >&2; exit 1; }
runner_dir="$HOME/actions-runner-fight-club"
mkdir -p "$runner_dir"
chmod 700 "$runner_dir"
if [[ ! -f "$runner_dir/config.sh" ]]; then
  archive="$(mktemp)"
  trap 'rm -f "$archive"' EXIT
  curl --fail --silent --show-error --location \
    https://github.com/actions/runner/releases/download/v2.338.0/actions-runner-linux-arm64-2.338.0.tar.gz > "$archive"
  printf '628b4a7258487b80c1d3c221095a7ded349f5ae0175fd3dfab708d07428f041b  %s\n' "$archive" | sha256sum --check --status
  tar xzf "$archive" -C "$runner_dir"
fi
python3 - <<'PY'
from pathlib import Path
path = Path('/home/andre/Desktop/WBGLabs/fight-club/compose.production.yaml')
text = path.read_text()
old = 'image: fightclub:production'
new = 'image: ${FIGHT_CLUB_APP_IMAGE:-fightclub:production}'
if text.count(old) not in (0, 2): raise SystemExit('Review the production Compose images before installing.')
updated = text.replace(old, new)
if updated.count(new) != 2: raise SystemExit('Expected app and worker image settings.')
if updated != text: path.write_text(updated)
PY
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/fight-club-runner.service" <<'UNIT'
[Unit]
Description=Fight Club GitHub Actions runner
After=network-online.target
ConditionPathExists=/home/andre/actions-runner-fight-club/.runner

[Service]
WorkingDirectory=/home/andre/actions-runner-fight-club
ExecStart=/home/andre/actions-runner-fight-club/bin/runsvc.sh
Restart=always
RestartSec=10
KillSignal=SIGINT
TimeoutStopSec=300

[Install]
WantedBy=default.target
UNIT
loginctl enable-linger andre
systemctl --user daemon-reload
printf 'ARM64 runner prepared in %s; production containers were not restarted.\n' "$runner_dir"
REMOTE
if [[ "${1:-}" != --register ]]; then
  printf 'Next: authenticate gh, then rerun %s --register\n' "$0"
  exit 0
fi
command -v gh >/dev/null || { echo 'Install GitHub CLI and run gh auth login first.' >&2; exit 1; }
registration_token="$(gh api --method POST repos/AndreTorneiro6/fight_club/actions/runners/registration-token --jq .token)"
printf '%s\n' "$registration_token" | ssh "${ssh_args[@]}" 'bash -c '\''
set -euo pipefail
IFS= read -r registration_token
cd "$HOME/actions-runner-fight-club"
if [[ ! -f .runner ]]; then
  ./config.sh --unattended --url https://github.com/AndreTorneiro6/fight_club \
    --token "$registration_token" --name fight-club-rpi \
    --labels fight-club-production --work _work
else
  python3 -c "import json; c=json.load(open(\".runner\")); assert c.get(\"gitHubUrl\",\"\").rstrip(\"/\")==\"https://github.com/AndreTorneiro6/fight_club\", \"Runner belongs to another repository\""
fi
unset registration_token
systemctl --user enable --now fight-club-runner.service
systemctl --user is-active fight-club-runner.service
'\'''
unset registration_token
