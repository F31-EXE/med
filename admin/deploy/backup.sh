#!/usr/bin/env bash
set -euo pipefail
DIR=/home/med/backups
UPLOADS=$(grep -E '^UPLOADS_DIR=' /home/med/app/admin/server/.env | cut -d= -f2- | tr -d '"')
DB=$(grep -E '^DATABASE_URL=' /home/med/app/admin/server/.env | cut -d= -f2- | tr -d '"' | sed 's/?.*//')
STAMP=$(date +%F)
mkdir -p "$DIR"
pg_dump "$DB" | gzip > "$DIR/db-$STAMP.sql.gz"
tar -czf "$DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
find "$DIR" -type f -mtime +14 -delete
