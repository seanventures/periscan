#!/usr/bin/env bash
# Refresh local staging from the DataSSD1 checkout (paths listed in MANIFEST).
set -euo pipefail
SRC="${PERISCAN_DATASSD1:-/Volumes/DataSSD1/test/periscan}"
DST="${PERISCAN_STAGING:-$HOME/periscan-staging}"
MANIFEST="${DST}/MANIFEST.txt"

if [[ ! -d "$SRC" ]]; then
  echo "source missing: $SRC" >&2
  exit 1
fi
mkdir -p "$DST"

if [[ ! -f "$MANIFEST" ]]; then
  echo "no MANIFEST.txt — pulling default lab overlay set"
  cat >"$MANIFEST" <<'EOF'
.gitignore
package.json
apps/worker/src/processor.ts
apps/api/src/services/findings.ts
apps/api/src/services/scopes.ts
apps/web/next.config.mjs
packages/shared/src/hybrid-execution-compiler.ts
infra/lab/
docs/DEMO_LAB_SITE.md
docs/LAB_DESIGN_CONTINUOUS_LOOP.md
docs/MEASURED_TEST_RANGE.md
docs/IMPLEMENTATION_STATUS.md
docs/qa/CONTINUOUS_LOOP_STATE.json
docs/qa/LAB_DEMO_SITE_CLOSEOUT_2026-08-02.md
docs/qa/E2E_SWARM_S1_MULTI_HOP_FFV.md
demo/DEMO_SCRIPT.md
tests/acceptance/lab-mocksiem-canary-e2e.test.ts
.github/workflows/lab-golden.yml
scripts/sync-staging-to-datassd1.sh
EOF
fi

echo "[pull] $SRC -> $DST"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^# ]] && continue
  rel="${line%/}"
  if [[ -e "$SRC/$rel" ]]; then
    mkdir -p "$DST/$(dirname "$rel")"
    rsync -a "$SRC/$rel" "$DST/$(dirname "$rel")/"
    echo "  $rel"
  else
    echo "  skip missing $rel" >&2
  fi
done <"$MANIFEST"

echo "[pull] ok"
