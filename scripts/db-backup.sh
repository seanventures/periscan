#!/usr/bin/env bash
# Periscan database backup (WS2 ops).
#
# Takes a consistent, compressed custom-format pg_dump of the database at
# DATABASE_URL into $PERISCAN_BACKUP_DIR (default ./.backups), timestamped, and
# prunes to the most recent $PERISCAN_BACKUP_KEEP (default 14) dumps.
#
# Custom format (-Fc) restores with db-restore.sh via pg_restore and supports
# selective/parallel restore. Requires pg_dump on PATH (PostgreSQL client tools).
#
#   DATABASE_URL=postgres://user:pass@host:5432/db bash scripts/db-backup.sh
#
# In the containerized dev env, run it inside the postgres container instead
# (project name is pinned `periscan-deps`):
#   docker exec periscan-deps-postgres-1 sh -c \
#     'pg_dump -U periscan -d periscan -Fc -f /tmp/periscan.dump'
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${PERISCAN_BACKUP_DIR:-.backups}"
KEEP="${PERISCAN_BACKUP_KEEP:-14}"

mkdir -p "$BACKUP_DIR"
# Timestamp is UTC so backups sort lexically by time regardless of host TZ.
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/periscan-$stamp.dump"

echo "==> backing up to $out"
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="$out"

size="$(du -h "$out" | cut -f1)"
echo "==> wrote $out ($size)"

# Retention: keep the most recent $KEEP dumps, delete older ones.
mapfile -t dumps < <(ls -1t "$BACKUP_DIR"/periscan-*.dump 2>/dev/null || true)
if (( ${#dumps[@]} > KEEP )); then
  for old in "${dumps[@]:KEEP}"; do
    echo "==> pruning old backup $old"
    rm -f "$old"
  done
fi

echo "==> backup complete ($(ls -1 "$BACKUP_DIR"/periscan-*.dump 2>/dev/null | wc -l | tr -d ' ') retained)"
