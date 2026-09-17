#!/usr/bin/env bash
# Wave spine product API walkthrough against a lab-seeded tenant.
# Verifies each Operate-rail surface returns real data (or honest empty).
#
# Usage:
#   set -a; source .lab-demo.env; set +a
#   ./scripts/walk-spine.sh
set -euo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:${PATH:-}"
PYTHON="${PYTHON:-python3}"
command -v "$PYTHON" >/dev/null || PYTHON="$(command -v python3 || command -v python || true)"
if [[ -z "$PYTHON" ]]; then
  echo "[walk-spine] python3 not found on PATH=$PATH" >&2
  exit 1
fi
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
lab_auth_init

ROOT="$LAB_ROOT"
REPORT_DIR="${PERISCAN_LAB_REPORT_DIR}"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${REPORT_DIR}/${STAMP}-walk-spine.json"

if [[ -z "${TOKEN:-}" ]]; then
  if [[ -f "${PERISCAN_LAB_DEMO_ENV}" ]]; then
    # shellcheck disable=SC1090
    set -a; source "${PERISCAN_LAB_DEMO_ENV}"; set +a
    lab_auth_init
  fi
fi
if [[ -z "${TOKEN:-}" ]]; then
  echo "[walk-spine] need PERISCAN_API_TOKEN (source .lab-demo.env)"
  exit 1
fi

AUTH=("${AUTH_HEADER[@]}")
API="${PERISCAN_API_URL}"
STATE_FILE="${PERISCAN_LAB_STATE_FILE}"
PATH_ID="${PERISCAN_LAB_PATH_ID:-}"
CS_ID="${PERISCAN_LAB_CONTROL_SOURCE_ID:-}"
if [[ -z "$PATH_ID" && -f "$STATE_FILE" ]]; then
  PATH_ID=$("$PYTHON" -c "import json;print(json.load(open('${STATE_FILE}')).get('pathId') or '')" 2>/dev/null || true)
fi
if [[ -z "$CS_ID" && -f "$STATE_FILE" ]]; then
  CS_ID=$("$PYTHON" -c "import json;print(json.load(open('${STATE_FILE}')).get('controlSourceId') or '')" 2>/dev/null || true)
fi

fail=0
RESULTS='[]'

check() {
  local id="$1" method="$2" path="$3"
  shift 3
  local tmp code body ok=false note=""
  tmp=$(mktemp)
  code=$(curl -sS -o "$tmp" -w "%{http_code}" "${AUTH[@]}" -X "$method" "${API}${path}" "$@" || echo 000)
  body=$(head -c 4000 "$tmp")
  rm -f "$tmp"
  if [[ "$code" =~ ^2 ]]; then
    ok=true
    echo "  ok  $id  $method $path → $code"
  else
    fail=1
    note="status=$code"
    echo "  FAIL $id  $method $path → $code ${body:0:120}"
  fi
  # NOTE: never export env var named PATH (clobbers $PATH for python).
  RESULTS=$(RESULTS="$RESULTS" ID="$id" METHOD="$method" API_PATH="$path" CODE="$code" OK="$ok" NOTE="$note" BODY="$body" "$PYTHON" - <<'PY'
import json, os
r=json.loads(os.environ["RESULTS"])
body=os.environ.get("BODY") or ""
# light parse
keys=None
count=None
try:
  d=json.loads(body)
  if isinstance(d, dict):
    keys=list(d.keys())[:12]
    for k in ("items","scopes","checks","findings","runners"):
      if isinstance(d.get(k), list):
        count=len(d[k])
        break
  elif isinstance(d, list):
    count=len(d)
except Exception:
  pass
r.append({
  "id": os.environ["ID"],
  "method": os.environ["METHOD"],
  "path": os.environ["API_PATH"],
  "status": int(os.environ.get("CODE") or 0),
  "ok": os.environ.get("OK")=="true",
  "note": os.environ.get("NOTE") or None,
  "keys": keys,
  "count": count,
})
print(json.dumps(r))
PY
)
}

echo "[walk-spine] Wave product API checks against ${API}"

# 1 Home / activation
check activation GET /api/v1/experience/activation
check me GET /api/v1/me

# 2 Integrations honesty
check integrations GET /api/v1/integrations

# 3 Scopes
check scopes GET /api/v1/scopes

# 4 Missions
check missions GET /api/v1/missions

# 5 Attack paths + measurement
check attack_paths GET /api/v1/attack-paths
if [[ -n "$PATH_ID" ]]; then
  check path_detail GET "/api/v1/attack-paths/${PATH_ID}"
  check path_measurement GET "/api/v1/attack-paths/${PATH_ID}/measurement-state"
  check path_receipts GET "/api/v1/attack-paths/${PATH_ID}/edge-receipts"
fi

# 6 Findings
check findings GET /api/v1/findings

# 7 Remediation
check remediations GET /api/v1/remediations

# 8 Evidence / reports / control sources
check evidence GET /api/v1/evidence
check reports GET /api/v1/reports
check control_sources GET /api/v1/control-sources
if [[ -n "$CS_ID" ]]; then
  check control_source_detail GET "/api/v1/control-sources/${CS_ID}"
fi

# Runners fleet (affinity demo)
check runners GET /api/v1/runners

# Schedules (optional continuous)
check schedules GET /api/v1/schedules

export OUT RESULTS FAIL="$fail" PATH_ID CS_ID
"$PYTHON" - <<'PY'
import json, os
results=json.loads(os.environ.get("RESULTS") or "[]")
passed=sum(1 for r in results if r.get("ok"))
failed=sum(1 for r in results if not r.get("ok"))
doc={
  "schema":"periscan-lab-walk-spine-v1",
  "pass": failed==0,
  "passed": passed,
  "failed": failed,
  "pathId": os.environ.get("PATH_ID") or None,
  "controlSourceId": os.environ.get("CS_ID") or None,
  "checks": results,
  "waveSpineUi": [
    "/dashboard","/integrations","/scopes","/missions",
    "/attack-paths","/findings","/remediation","/evidence","/reports"
  ],
  "claimSafety": "API 2xx with real/empty data only; never invent FullyMeasured in this script",
}
open(os.environ["OUT"],"w").write(json.dumps(doc, indent=2)+"\n")
print(json.dumps(doc, indent=2))
print(f"[walk-spine] wrote {os.environ['OUT']}")
print(f"[walk-spine] {passed} passed, {failed} failed")
if failed:
  raise SystemExit(1)
PY

echo "[walk-spine] OK — open UI routes listed above for the room"
