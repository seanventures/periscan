#!/usr/bin/env bash
# Hybrid compiler (#30) against enrolled **plant** lab runner — Partial ops depth.
# Does NOT claim Strong / fullyE2EMeasuredSurface / live APT.
#
# Prerequisites:
#   pnpm lab:up && pnpm lab:dev && pnpm lab:enroll-runners (or demo-up)
#   PERISCAN_LAB_MODE=1, API on :3001
#
# Outputs: docs/qa/lab-runs/*-hybrid-plant.json
set -euo pipefail
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
mkdir -p "${PERISCAN_LAB_REPORT_DIR}"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="${PERISCAN_LAB_REPORT_DIR}/${STAMP}-hybrid-plant.json"

CREDS="${LAB_ROOT}/.lab-runner-creds/plant"
if [[ ! -f "${CREDS}/runner-id" ]]; then
  echo "[hybrid-plant] plant runner not enrolled — run: pnpm lab:enroll-runners" >&2
  echo "{\"ok\":false,\"error\":\"plant_runner_missing\",\"hint\":\"pnpm lab:demo-up or lab:enroll-runners\"}" | tee "$OUT"
  exit 2
fi

# Load demo/lab auth after plant check (do not auto-signup here).
if [[ -z "${PERISCAN_API_TOKEN:-}${TOKEN:-}" && -f "${PERISCAN_LAB_DEMO_ENV}" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1090
  source "${PERISCAN_LAB_DEMO_ENV}"
  set +a
fi
lab_auth_init
if [[ -z "${PERISCAN_API_TOKEN:-}${TOKEN:-}" ]]; then
  echo "[hybrid-plant] no auth — set PERISCAN_API_TOKEN or run lab:demo-up to create ${PERISCAN_LAB_DEMO_ENV}" >&2
  echo "{\"ok\":false,\"error\":\"auth_missing\"}" | tee "$OUT"
  exit 2
fi

PLANT_RUNNER_ID=$(cat "${CREDS}/runner-id")
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
if ! curl -fsS -m 3 "${API}/api/v1/health" >/dev/null 2>&1; then
  echo "[hybrid-plant] API not reachable at ${API} — start: pnpm lab:dev" >&2
  echo "{\"ok\":false,\"error\":\"api_down\",\"api\":\"${API}\"}" | tee "$OUT"
  exit 2
fi

# Prefer lab edge host when LAB_MODE maps range DNS; else fixture-friendly host.
TARGET_HOST="${PERISCAN_LAB_HYBRID_HOST:-edge.lab.range.test}"
SCOPE_VALUE="${PERISCAN_LAB_HYBRID_SCOPE:-lab.range.test}"

echo "[hybrid-plant] plant=${PLANT_RUNNER_ID} target=${TARGET_HOST}"

# Ensure scope exists (idempotent create+verify when possible).
# Note: LAB_HTTP_CODE is set by lab_curl in the current shell only when not captured
# via $(); write body to a temp file so status remains visible.
SCOPE_TMP=$(mktemp)
lab_curl POST "${API}/api/v1/scopes" -d "{\"scopeType\":\"Domain\",\"value\":\"${SCOPE_VALUE}\"}" >"$SCOPE_TMP" || true
SCOPE_HTTP="${LAB_HTTP_CODE:-0}"
SCOPE_ID=$(python3 -c "import json; d=json.load(open('$SCOPE_TMP')); print(d.get('scopeId',''))" 2>/dev/null || true)
rm -f "$SCOPE_TMP"
if [[ -z "$SCOPE_ID" || "$SCOPE_HTTP" == "409" || "$SCOPE_HTTP" == "400" ]]; then
  LIST_TMP=$(mktemp)
  lab_curl GET "${API}/api/v1/scopes" >"$LIST_TMP" || true
  SCOPE_ID=$(python3 -c "
import json
d=json.load(open('$LIST_TMP'))
items=d.get('items') or d.get('scopes') or []
for s in items:
  v=s.get('value') or s.get('scope',{}).get('value')
  sid=s.get('scopeId') or s.get('scope',{}).get('scopeId')
  if v=='${SCOPE_VALUE}' or (isinstance(s.get('scope'),dict) and s['scope'].get('value')=='${SCOPE_VALUE}'):
    print(sid or s.get('scopeId','')); break
" 2>/dev/null || true)
  rm -f "$LIST_TMP"
fi

if [[ -z "$SCOPE_ID" ]]; then
  echo "[hybrid-plant] could not resolve scope for ${SCOPE_VALUE} (HTTP ${SCOPE_HTTP})" >&2
  echo "{\"ok\":false,\"error\":\"scope_missing\",\"http\":${SCOPE_HTTP}}" | tee "$OUT"
  exit 3
fi

lab_curl POST "${API}/api/v1/scopes/${SCOPE_ID}/verify" -d '{"devModeManual":true}' >/dev/null || true

# Body matches CompileHybridExecutionInputSchema — no missionType/safetyLevel.
COMPILE_BODY=$(cat <<EOF
{
  "scopeId": "${SCOPE_ID}",
  "runnerId": "${PLANT_RUNNER_ID}",
  "targetHost": "${TARGET_HOST}",
  "moduleIds": ["periscan.dns_resolution_check"],
  "queueTasks": true,
  "intent": "lab plant hybrid passive dns proof"
}
EOF
)

COMPILE_TMP=$(mktemp)
lab_curl POST "${API}/api/v1/hybrid-compiler/compile" -d "$COMPILE_BODY" >"$COMPILE_TMP"
COMPILE_HTTP="${LAB_HTTP_CODE:-0}"
echo "[hybrid-plant] compile HTTP ${COMPILE_HTTP}"
MISSION_ID=$(python3 -c "import json; d=json.load(open('$COMPILE_TMP')); print(d.get('missionId',''))" 2>/dev/null || true)
QUEUED=$(python3 -c "import json; d=json.load(open('$COMPILE_TMP')); print(d.get('queuedTaskCount',0))" 2>/dev/null || true)
HONESTY=$(python3 -c "import json; d=json.load(open('$COMPILE_TMP')); print(d.get('honesty',{}).get('fullyE2EMeasuredSurface', True))" 2>/dev/null || true)

if [[ "${COMPILE_HTTP}" != "200" && "${COMPILE_HTTP}" != "201" ]]; then
  cat "$COMPILE_TMP" | tee "$OUT"
  rm -f "$COMPILE_TMP"
  exit 4
fi
rm -f "$COMPILE_TMP"

# Wait briefly for plant runner to poll (operator must have runner-plant Up).
STATUS="unknown"
for i in $(seq 1 30); do
  if [[ -n "$MISSION_ID" ]]; then
    MJ_TMP=$(mktemp)
    lab_curl GET "${API}/api/v1/missions/${MISSION_ID}" >"$MJ_TMP" || true
    STATUS=$(python3 -c "import json; d=json.load(open('$MJ_TMP')); print((d.get('mission') or d).get('status','?'))" 2>/dev/null || echo "?")
    rm -f "$MJ_TMP"
    if [[ "$STATUS" == "Completed" || "$STATUS" == "Failed" || "$STATUS" == "DeniedByPolicy" ]]; then
      break
    fi
  fi
  sleep 2
done

python3 - "$OUT" "$STAMP" "$PLANT_RUNNER_ID" "$SCOPE_ID" "$TARGET_HOST" "$MISSION_ID" "$QUEUED" "$STATUS" <<'PY'
import json, sys
out, stamp, plant, scope, host, mission, queued, status = sys.argv[1:9]
payload = {
  "ok": True,
  "stamp": stamp,
  "plantRunnerId": plant,
  "scopeId": scope,
  "targetHost": host,
  "missionId": mission,
  "queuedTaskCount": int(queued or 0),
  "missionStatus": status,
  "honesty": {
    "fullyE2EMeasuredSurface": False,
    "status": "Partial",
    "note": "Plant runner path for passive allowlisted module only — not Strong BAS hybrid.",
  },
}
Path = __import__("pathlib").Path
Path(out).write_text(json.dumps(payload, indent=2) + "\n")
print(json.dumps(payload, indent=2))
PY

echo "[hybrid-plant] wrote $OUT status=${STATUS} (Partial only — do not score Strong)"
