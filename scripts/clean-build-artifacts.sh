#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Retry: a live `next dev` can recreate .next while rm is walking.
for _ in 1 2 3; do
  find "$ROOT_DIR/apps" "$ROOT_DIR/packages" \
    -type d \
    \( -name dist -o -name .next \) \
    -prune \
    -print \
    -exec rm -rf {} + 2>/dev/null || true
  leftover=$(find "$ROOT_DIR/apps" "$ROOT_DIR/packages" -type d \( -name dist -o -name .next \) 2>/dev/null | head -1 || true)
  if [[ -z "$leftover" ]]; then
    break
  fi
  sleep 1
done
