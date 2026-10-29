#!/usr/bin/env bash
# Run by host systemd, not inside Docker.
set -Eeuo pipefail
umask 077
[[ "$EUID" == 0 ]] || { echo 'Host root access is required.' >&2; exit 77; }
project_dir="${FIGHT_CLUB_DEPLOY_DIR:-/home/andre/Desktop/WBGLabs/fight-club}"
state_dir=/var/lib/wbglabs-maintenance
install -d -m 700 "$state_dir"
exec 8>/run/lock/wbglabs-maintenance.lock
flock -n 8 || { echo 'Maintenance is already running.'; exit 0; }
# Preserve the deployment lock inode and its existing ownership.
exec 9<"$project_dir/.deploy.lock"
flock -w 7200 9
python3 /usr/local/libexec/wbglabs-container-check.py --snapshot
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="fight-club-maintenance-$stamp.archive.gz"
docker exec fight-club-backup-1 bash -c \
  'umask 077; options=(); [[ -z "${MONGODB_BACKUP_URI:-}" ]] || options+=(--oplog); mongodump --quiet --uri="${MONGODB_BACKUP_URI:-$MONGODB_URI}" --archive="/backups/$1" --gzip "${options[@]}"' \
  -- "$backup_name"
echo "Pre-maintenance database backup completed: $backup_name"
export DEBIAN_FRONTEND=noninteractive
apt-get -o DPkg::Lock::Timeout=600 update
apt-get -y -o DPkg::Lock::Timeout=600 \
  -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold \
  --no-remove --with-new-pkgs upgrade
apt-get check
dpkg_status="$(dpkg --audit)"
[[ -z "$dpkg_status" ]] || { echo "$dpkg_status" >&2; exit 1; }
date -u +%FT%TZ > "$state_dir/last-upgrade-completed"
echo 'Updates completed; rebooting to verify automatic container startup.'
sync
systemctl --no-block reboot
