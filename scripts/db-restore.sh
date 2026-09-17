#!/usr/bin/env bash
# Periscan database restore (WS2 ops).
#
# DESTRUCTIVE: restores a custom-format pg_dump (from db-backup.sh) into the
# database at PERISCAN_RESTORE_URL, dropping and recreating objects first
# (--clean --if-exists). Guarded by an explicit confirmation to prevent
# accidentally clobbering a live database.
#
#   PERISCAN_RESTORE_URL=postgres://user:pass@host:5432/db \
#   PERISCAN_RESTORE_CONFIRM=yes \
#     bash scripts/db-restore.sh .backups/periscan-<stamp>.dump
#
# For a NON-destructive, tested restore drill (dump live -> restore into a
# throwaway DB -> assert row-count parity), use scripts/db-restore-drill.sh.
set -euo pipefail

dump="${1:?usage: db-restore.sh <dump-file>}"
: "${PERISCAN_RESTORE_URL:?PERISCAN_RESTORE_URL is required (target database)}"

if [[ ! -f "$dump" ]]; then
  echo "error: dump file not found: $dump" >&2
  exit 1
fi

if [[ "${PERISCAN_RESTORE_CONFIRM:-}" != "yes" ]]; then
  echo "REFUSING to restore over $PERISCAN_RESTORE_URL." >&2
  echo "This DROPS and recreates objects. Re-run with PERISCAN_RESTORE_CONFIRM=yes." >&2
  exit 2
fi

echo "==> restoring $dump -> $PERISCAN_RESTORE_URL"
# --clean --if-exists: drop existing objects first so the restore is idempotent.
# --no-owner: don't require the restoring role to match the dump's owner.
# --exit-on-error keeps a partial/inconsistent restore from being reported clean.
pg_restore \
  --clean --if-exists --no-owner --exit-on-error \
  --dbname="$PERISCAN_RESTORE_URL" \
  "$dump"

echo "==> restore complete"
