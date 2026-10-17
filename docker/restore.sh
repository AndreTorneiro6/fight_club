#!/bin/bash
set -Eeuo pipefail

: "${MONGODB_URI:?MONGODB_URI is required}"
archive="${1:?Usage: restore.sh /backups/<archive>.archive.gz}"
[[ -r "$archive" ]] || {
  echo "Backup archive is not readable: $archive" >&2
  exit 2
}

echo "This will replace Fight Club data in MongoDB with the selected backup."
read -r -p 'Type RESTORE to continue: ' confirmation
[[ "$confirmation" == RESTORE ]] || {
  echo "Restore cancelled."
  exit 1
}

mongorestore --uri="$MONGODB_URI" --archive="$archive" --gzip --drop
echo "Restore completed."
