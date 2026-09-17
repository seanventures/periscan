#!/usr/bin/env bash
# Golden-path lab gate (Phase 2).
# Exit 0 when physical smoke + canary pass; API asserts when configured.
# STRICT=1 fails if canary/export or (when path id set) fullyMeasured is false.
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
lab_auth_init
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT_DIR="${PERISCAN_LAB_REPORT_DIR:-$ROOT/../../docs/qa/lab-runs}"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${REPORT_DIR}/${STAMP}-golden.json"
STATE_FILE="${PERISCAN_LAB_STATE_FILE:-$ROOT/.lab-state.json}"

echo "[golden] physical smoke"
./scripts/smoke.sh

echo "[golden] canary loop (physical + optional product)"
./scripts/canary-loop.sh

API="${PERISCAN_API_URL:-}"
TOKEN="${PERISCAN_API_TOKEN:-}"
FULLY=""
FIXED=""
CANARY="physical_ok"
AFFINITY=""
POSTURE=""
CONTROL_SOURCE=""
NOTES=()
PHASE=2

if [[ -f "$STATE_FILE" ]]; then
  CONTROL_SOURCE=$(python3 -c "import json;print(json.load(open('${STATE_FILE}')).get('controlSourceId') or '')" 2>/dev/null || true)
  if [[ -z "${PERISCAN_LAB_PATH_ID:-}" ]]; then
    export PERISCAN_LAB_PATH_ID=$(python3 -c "import json;print(json.load(open('${STATE_FILE}')).get('pathId') or '')" 2>/dev/null || true)
  fi
  if [[ -z "${PERISCAN_LAB_CONTROL_SOURCE_ID:-}" && -n "$CONTROL_SOURCE" ]]; then
    export PERISCAN_LAB_CONTROL_SOURCE_ID="$CONTROL_SOURCE"
  fi
fi

if [[ -n "$API" && -n "$TOKEN" ]]; then
  echo "[golden] API assertions (best-effort — set PERISCAN_LAB_STRICT=1 to fail hard)"
  AUTH=("${AUTH_HEADER[@]}")

  # LiveSafe posture on lab scopes when seed state present
  if [[ -f "$STATE_FILE" ]]; then
    echo "[golden] posture-lab (LiveSafe)"
    if ./scripts/posture-lab.sh; then
      POSTURE=ok
    else
      POSTURE=failed
      NOTES+=("posture-lab failed — check DNS/CA for lab hosts")
    fi
  fi

  # Best-effort hop measure (launch + poll); does not invent FullyMeasured
  if [[ "${PERISCAN_LAB_SKIP_MEASURE:-0}" != "1" ]]; then
    echo "[golden] measure-hops (safe launch + poll)"
    ./scripts/measure-hops.sh || NOTES+=("measure-hops non-zero")
    if [[ -f "$STATE_FILE" && -z "${PERISCAN_LAB_PATH_ID:-}" ]]; then
      export PERISCAN_LAB_PATH_ID=$(python3 -c "import json;print(json.load(open('${STATE_FILE}')).get('pathId') or '')" 2>/dev/null || true)
    fi
  fi

  if [[ -n "${PERISCAN_LAB_PATH_ID:-}" ]]; then
    MS=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/attack-paths/${PERISCAN_LAB_PATH_ID}/measurement-state" || true)
    echo "$MS" | head -c 400 || true
    if echo "$MS" | grep -q '"fullyMeasured"[[:space:]]*:[[:space:]]*true'; then
      FULLY=true
    else
      FULLY=false
      NOTES+=("path not fullyMeasured — hop missions need worker/runner completion + receipts")
    fi
  else
    NOTES+=("set PERISCAN_LAB_PATH_ID (or seed pathId) to assert fullyMeasured")
    FULLY=null
  fi

  if [[ -n "${PERISCAN_LAB_CONTROL_SOURCE_ID:-$CONTROL_SOURCE}" ]]; then
    CANARY=product_attempted
  else
    CANARY=physical_only
    NOTES+=("run seed-tenant.sh for product canary wiring")
  fi

  RUNNERS=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/runners" || true)
  if echo "$RUNNERS" | grep -qi plant; then
    AFFINITY=plant_seen
  else
    AFFINITY=null
    NOTES+=("no plant runner registered yet — export tokens from seed and compose --profile runners")
  fi
else
  NOTES+=("API not configured — physical smoke + canary only (Phase 2 physical gate)")
  FULLY=null
  FIXED=null
  CANARY=physical_ok
  AFFINITY=null
  POSTURE=null
fi

export GOLDEN_OUT="$OUT"
export GOLDEN_FULLY="$FULLY"
export GOLDEN_FIXED="$FIXED"
export GOLDEN_CANARY="$CANARY"
export GOLDEN_AFFINITY="$AFFINITY"
export GOLDEN_POSTURE="${POSTURE:-null}"
export GOLDEN_PHASE="$PHASE"
export GOLDEN_CS="${PERISCAN_LAB_CONTROL_SOURCE_ID:-$CONTROL_SOURCE}"
export GOLDEN_PATH="${PERISCAN_LAB_PATH_ID:-}"
export GOLDEN_NOTES="$(IFS='|'; echo "${NOTES[*]-}")"

python3 - <<'PY'
import json, os
out = os.environ["GOLDEN_OUT"]
fully = os.environ.get("GOLDEN_FULLY", "null")
fixed = os.environ.get("GOLDEN_FIXED", "null")
canary = os.environ.get("GOLDEN_CANARY", "")
affinity = os.environ.get("GOLDEN_AFFINITY", "null")
posture = os.environ.get("GOLDEN_POSTURE", "null")
notes = [n for n in os.environ.get("GOLDEN_NOTES", "").split("|") if n]
doc = {
  "schema": "periscan-lab-golden-v1",
  "phase": int(os.environ.get("GOLDEN_PHASE", "2")),
  "physicalSmoke": "ok",
  "canaryPhysical": "ok",
  "postureLiveSafe": None if posture == "null" else posture,
  "fullyMeasured": None if fully == "null" else fully == "true",
  "fixedAfterHarden": None if fixed == "null" else fixed == "true",
  "canary": canary,
  "affinity": None if affinity == "null" else affinity,
  "controlSourceId": os.environ.get("GOLDEN_CS") or None,
  "pathId": os.environ.get("GOLDEN_PATH") or None,
  "hosts": {
    "edge": "https://edge.lab.range.test:8443 or http://127.0.0.1:8081",
    "app": "https://app.lab.range.test:8444 or http://127.0.0.1:8082",
    "data": "http://127.0.0.1:8083",
    "siem": "http://127.0.0.1:9200",
    "dns": "127.0.0.1:5355",
    "splunkExport": "POST /services/search/jobs/export on mocksiem",
  },
  "claimSafety": "Heuristic must never be presented as Measured without hop receipts; canary is benign_marker_only",
  "next": [
    "seed-tenant.sh with API token → live Splunk→mocksiem control source",
    "Measure hops edge→app→data with plant runner (FullyMeasured)",
    "LAB_PROFILE=hardened docker compose up -d --build; verify Fixed",
    "Schedule plant affinity fire",
    "Slice E rescore only after green golden artifacts",
  ],
  "notes": notes,
}
open(out, "w").write(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
print(f"[golden] wrote {out}")
PY

echo
echo "[golden] Phase 2 physical gate: smoke + canary export OK."
echo "[golden] Full lab DoD (FullyMeasured + Fixed + product canary measured + affinity) needs API seed + runners."
if [[ "${PERISCAN_LAB_STRICT:-0}" == "1" ]]; then
  if [[ "$FULLY" != "true" && -n "${PERISCAN_LAB_PATH_ID:-}" ]]; then
    echo "[golden] STRICT: fullyMeasured not proven"
    exit 1
  fi
fi
exit 0
