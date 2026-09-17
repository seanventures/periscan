#!/usr/bin/env bash
# Workflow for macOS TCC on /Volumes/DataSSD1:
#   1. Edit under ~/periscan-staging (local disk)
#   2. Run this script to copy into the DataSSD1 checkout
#
# Usage:
#   bash ~/periscan-staging/scripts/sync-staging-to-datassd1.sh
#   # or from repo after first copy:
#   bash scripts/sync-staging-to-datassd1.sh
set -euo pipefail
SRC="${PERISCAN_STAGING:-$HOME/periscan-staging}"
DST="${PERISCAN_DATASSD1:-/Volumes/DataSSD1/test/periscan}"

if [[ ! -d "$SRC" ]]; then
  echo "staging missing: $SRC" >&2
  exit 1
fi
if [[ ! -d "$DST" ]]; then
  echo "dest missing: $DST" >&2
  exit 1
fi

echo "[sync] $SRC -> $DST"
rsync -a \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  --exclude 'dist/' \
  --exclude '.write-test' \
  --exclude 'SYNC_TO_DATASSD1.sh' \
  --exclude '.DS_Store' \
  "$SRC"/ "$DST"/

echo "[sync] ok"
# Spot-check a few paths
for f in package.json infra/lab/scripts/stop.sh apps/worker/src/processor.ts; do
  if [[ -f "$DST/$f" ]]; then
    echo "  ok $f ($(wc -c < "$DST/$f" | tr -d ' ') bytes)"
  else
    echo "  MISSING $f" >&2
  fi
done
