#!/bin/bash
set -Eeuo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_INTERVAL_HOURS:=24}"
: "${BACKUP_RETENTION_DAYS:=14}"

[[ "$BACKUP_INTERVAL_HOURS" =~ ^[1-9][0-9]*$ ]] || {
  echo "BACKUP_INTERVAL_HOURS must be a positive integer" >&2
  exit 2
}
[[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || {
  echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 2
}

umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

backup_options=()
[[ -z "${MONGODB_BACKUP_URI:-}" ]] || backup_options+=(--oplog)

while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  name="fight-club-${stamp}.archive.gz"
  temp="$BACKUP_DIR/.${name}.tmp"

  if mongodump --uri="${MONGODB_BACKUP_URI:-$MONGODB_URI}" --archive="$temp" --gzip "${backup_options[@]}"; then
    chmod 600 "$temp"
    mv "$temp" "$BACKUP_DIR/$name"
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'fight-club-*.archive.gz' \
      -mtime "+$BACKUP_RETENTION_DAYS" -delete
    echo "Backup completed: $name"
    sleep "$((BACKUP_INTERVAL_HOURS * 3600))"
  else
    rm -f "$temp"
    echo "Backup failed; retrying in one hour." >&2
    sleep 3600
  fi
done
