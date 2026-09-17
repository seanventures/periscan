#!/usr/bin/env bash
# Seed a local control plane for lab dogfood (Phase 2).
# Requires: API up, PERISCAN_API_URL + PERISCAN_API_TOKEN (session cookie or bearer).
#
# Creates:
#   - verified Domain scopes for edge/app/data.lab.range.test
#   - Splunk integration pointing at mocksiem (live apiToken, not mockMode)
#   - SIEM control source
#   - plant + hq runner registration tokens
#
# Writes: infra/lab/.lab-state.json and .lab-runner.env (gitignored)
set -euo pipefail
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
lab_auth_init
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# API/TOKEN/AUTH_HEADER set by lab_auth_init
SIEM_URL="${PERISCAN_LAB_SIEM_URL:-http://127.0.0.1:9200}"
STATE_FILE="${PERISCAN_LAB_STATE_FILE:-$ROOT/.lab-state.json}"

echo "[lab seed] API=${API}"
if [[ -z "$TOKEN" ]]; then
  cat <<EOF
[lab seed] No PERISCAN_API_TOKEN set — printing manual checklist:

  1. Start API with lab DNS/CA (see README).
  2. Sign in / create tenant (ControlValidation package if gated).
  3. Create verified Domain scopes:
       edge.lab.range.test
       app.lab.range.test
       data.lab.range.test
     (dev: POST …/scopes/:id/verify { "devModeManual": true })
  4. Create Splunk integration (apiToken):
       baseUrl: ${SIEM_URL}
       token: lab-token
       mockMode: false
  5. Create control source SIEM linked to that integration.
  6. Issue two runner registration tokens:
       plant: siteId=plant networkSegment=ot-dmz labels=[lab,plant]
       hq:    siteId=hq    networkSegment=corp   labels=[lab,hq]
  7. export PLANT_TOKEN HQ_TOKEN (registration tokens) and:
       docker compose --profile runners up -d
  8. Run: ./scripts/canary-loop.sh && ./scripts/golden-path.sh
EOF
  exit 0
fi

HTTP_CODE=""
# Must not run auth_code inside $() if caller needs HTTP_CODE — use auth_exchange.
auth() {
  curl -sS "${AUTH_HEADER[@]}" "$@"
}

# Writes body to stdout; sets HTTP_CODE in this shell (call without command substitution).
# Prefer:  auth_exchange METHOD URL [curl args...]; BODY=$LAB_BODY
auth_exchange() {
  local tmp
  tmp=$(mktemp)
  HTTP_CODE=$(curl -sS -o "$tmp" -w "%{http_code}" "${AUTH_HEADER[@]}" "$@" || echo 000)
  LAB_BODY=$(cat "$tmp")
  rm -f "$tmp"
}

# Backward-compatible: prints body, but HTTP_CODE is lost if used as $(auth_code ...).
auth_code() {
  auth_exchange "$@"
  printf '%s' "$LAB_BODY"
}

echo "[lab seed] health"
curl -fsS "${API%/}/health" 2>/dev/null || curl -fsS "${API}/health" 2>/dev/null || {
  echo "[lab seed] API health failed — is the control plane running?"
  exit 1
}

# Control sources need ControlValidation (or higher) entitlement.
# Local lab: optional SQL bump via docker postgres (no product claim change).
if [[ "${PERISCAN_LAB_AUTO_BILLING:-1}" == "1" ]]; then
  TENANT_ID="${PERISCAN_LAB_TENANT_ID:-}"
  if [[ -z "$TENANT_ID" ]]; then
    ME=$(auth "${API}/api/v1/auth/me" 2>/dev/null || auth "${API}/api/v1/users/me" 2>/dev/null || true)
    TENANT_ID=$(echo "$ME" | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print(''); raise SystemExit
print(
  d.get('tenant',{}).get('tenantId')
  or d.get('defaultTenantId')
  or d.get('tenantId')
  or (d.get('memberships') or [{}])[0].get('tenantId')
  or ''
)
" 2>/dev/null || true)
  fi
  if [[ -n "$TENANT_ID" ]]; then
    if docker exec "$(lab_postgres_container)" psql -U periscan -d periscan -v ON_ERROR_STOP=1 -c \
      "UPDATE tenants SET billing_package_key='ControlValidation' WHERE tenant_id='${TENANT_ID}';" \
      >/dev/null 2>&1; then
      echo "[lab seed] billing package → ControlValidation for ${TENANT_ID} (local lab only)"
    else
      echo "[lab seed] note: could not auto-bump billing for ${TENANT_ID} (control sources may 402)"
    fi
  else
    echo "[lab seed] note: set PERISCAN_LAB_TENANT_ID for auto billing bump (export from lab-session.sh)"
  fi
fi

SCOPE_EDGE=""
SCOPE_APP=""
SCOPE_DATA=""

create_or_find_scope() {
  local host="$1"
  local body sid list
  # Status messages → stderr so $(create_or_find_scope) only captures the id.
  echo "[lab seed] scope ${host}" >&2
  auth_exchange -X POST "${API}/api/v1/scopes" -d "{\"scopeType\":\"Domain\",\"value\":\"${host}\"}"
  body="$LAB_BODY"
  if [[ "$HTTP_CODE" == "201" ]]; then
    sid=$(echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scopeId',''))")
    echo "  created ${sid}" >&2
  else
    list=$(auth "${API}/api/v1/scopes" || true)
    sid=$(HOST="$host" python3 -c "
import sys,json,os
host=os.environ['HOST']
try:
  d=json.load(sys.stdin)
except Exception:
  print(''); raise SystemExit
items=d if isinstance(d,list) else d.get('items') or d.get('scopes') or []
for s in items:
  if s.get('value')==host or s.get('scopeValue')==host:
    print(s.get('scopeId') or ''); break
else:
  print('')
" <<<"$list" 2>/dev/null || true)
    if [[ -z "$sid" ]]; then
      echo "  warn: could not create/find scope (${HTTP_CODE}): ${body:0:200}" >&2
      echo ""
      return
    fi
    echo "  found existing ${sid}" >&2
  fi
  auth_exchange -X POST "${API}/api/v1/scopes/${sid}/verify" -d '{"devModeManual":true}'
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "201" ]]; then
    echo "  verified" >&2
  else
    echo "  verify status ${HTTP_CODE}: ${LAB_BODY:0:160}" >&2
  fi
  printf '%s' "$sid"
}

SCOPE_EDGE=$(create_or_find_scope edge.lab.range.test | tail -1)
SCOPE_APP=$(create_or_find_scope app.lab.range.test | tail -1)
SCOPE_DATA=$(create_or_find_scope data.lab.range.test | tail -1)

echo "[lab seed] splunk → mocksiem ${SIEM_URL}"
INT_PAYLOAD=$(SIEM_URL="$SIEM_URL" python3 - <<'PY'
import json, os
print(json.dumps({
  "connectorKey": "splunk",
  "authType": "apiToken",
  "mockMode": False,
  "config": {
    "baseUrl": os.environ["SIEM_URL"],
    "token": "lab-token",
    "index": "main",
    "earliestTime": "-24h",
    "latestTime": "now"
  }
}))
PY
)
auth_exchange -X POST "${API}/api/v1/integrations" -d "$INT_PAYLOAD"
INT_BODY="$LAB_BODY"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "  integration create failed (${HTTP_CODE}): ${INT_BODY:0:300}"
  auth_exchange -X POST "${API}/api/v1/integrations" -d '{"connectorKey":"splunk","fixtureOutcome":"Logged","mockMode":true}'
  INT_BODY="$LAB_BODY"
  if [[ "$HTTP_CODE" != "201" ]]; then
    echo "  mock fallback also failed (${HTTP_CODE})"
    exit 1
  fi
  echo "  using mockMode=true fallback (physical SIEM still works; product liveTelemetry may be false)"
fi
INTEGRATION_ID=$(echo "$INT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('integrationId',''))")
echo "  integrationId=${INTEGRATION_ID}"

echo "[lab seed] control source SIEM"
CS_PAYLOAD=$(INTEGRATION_ID="$INTEGRATION_ID" python3 - <<'PY'
import json, os
print(json.dumps({
  "controlType": "SIEM",
  "expectedBehaviors": ["Detected", "Logged"],
  "integrationId": os.environ["INTEGRATION_ID"],
  "provider": "SplunkLab"
}))
PY
)
auth_exchange -X POST "${API}/api/v1/control-sources" -d "$CS_PAYLOAD"
CS_BODY="$LAB_BODY"
if [[ "$HTTP_CODE" != "201" ]]; then
  echo "  control source failed (${HTTP_CODE}): ${CS_BODY:0:300}"
  exit 1
fi
CONTROL_SOURCE_ID=$(echo "$CS_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('controlSourceId',''))")
echo "  controlSourceId=${CONTROL_SOURCE_ID}"

issue_runner_token() {
  local name="$1" site="$2" segment="$3"
  local body payload
  payload=$(NAME="$name" SITE="$site" SEGMENT="$segment" python3 - <<'PY'
import json, os
print(json.dumps({
  "deploymentMode": "Docker",
  "expiresInSeconds": 86400,
  "labels": ["lab", os.environ["NAME"], f"site:{os.environ['SITE']}", f"segment:{os.environ['SEGMENT']}"],
  "runnerName": f"lab-{os.environ['NAME']}",
  "siteId": os.environ["SITE"],
  "networkSegment": os.environ["SEGMENT"]
}))
PY
)
  auth_exchange -X POST "${API}/api/v1/runners/registration-tokens" -d "$payload"
  body="$LAB_BODY"
  if [[ "$HTTP_CODE" != "201" ]]; then
    echo "  token ${name} failed (${HTTP_CODE}): ${body:0:200}" >&2
    echo ""
    return
  fi
  echo "$body" | python3 -c "import sys,json; print(json.load(sys.stdin).get('registrationToken',''))"
}

echo "[lab seed] runner registration tokens"
PLANT_TOKEN=$(issue_runner_token plant plant ot-dmz)
HQ_TOKEN=$(issue_runner_token hq hq corp)
if [[ -n "$PLANT_TOKEN" ]]; then
  echo "  PLANT_TOKEN issued (export for compose runners)"
else
  echo "  plant token missing"
fi
if [[ -n "$HQ_TOKEN" ]]; then
  echo "  HQ_TOKEN issued"
else
  echo "  hq token missing"
fi

PATH_ID="${PERISCAN_LAB_PATH_ID:-}"

# Multi-hop path correlation seed (product path for measure-hops).
# Mock GitHub + AWS sync creates multi-hop heuristic paths (acceptance pattern).
# Lab FullyMeasured still requires hop receipts — never invented here.
if [[ "${PERISCAN_LAB_SEED_PATHS:-1}" == "1" ]]; then
  echo "[lab seed] multi-hop path material (github+aws mock sync)"
  auth_exchange -X POST "${API}/api/v1/integrations/github/connect" -d '{"mockMode":true}'
  GH="$LAB_BODY"
  if [[ "$HTTP_CODE" == "201" ]]; then
    GH_ID=$(echo "$GH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('integrationId',''))")
    auth_exchange -X POST "${API}/api/v1/integrations/${GH_ID}/sync" -d '{}'
    echo "  github sync ${HTTP_CODE} id=${GH_ID}"
  else
    echo "  github connect skipped (${HTTP_CODE})"
  fi
  auth_exchange -X POST "${API}/api/v1/integrations/aws/connect" -d '{"mockMode":true}'
  AWS="$LAB_BODY"
  if [[ "$HTTP_CODE" == "201" ]]; then
    AWS_ID=$(echo "$AWS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('integrationId',''))")
    auth_exchange -X POST "${API}/api/v1/integrations/${AWS_ID}/sync" -d '{}'
    echo "  aws sync ${HTTP_CODE} id=${AWS_ID}"
  else
    echo "  aws connect skipped (${HTTP_CODE})"
  fi
  if [[ -z "$PATH_ID" ]]; then
    PATHS=$(auth "${API}/api/v1/attack-paths" || true)
    PATH_ID=$(echo "$PATHS" | python3 -c "
import sys,json
try: d=json.load(sys.stdin)
except Exception: print(''); raise SystemExit
items=d.get('items') or []
for it in items:
  p=it.get('attackPath') or it
  if len(p.get('pathEdges') or [])>=2:
    print(p.get('pathId') or ''); break
else:
  if items:
    p=items[0].get('attackPath') or items[0]
    print(p.get('pathId') or '')
  else:
    print('')
" 2>/dev/null || true)
    if [[ -n "$PATH_ID" ]]; then
      echo "  multi-hop pathId=${PATH_ID} (Heuristic until measure-hops)"
    else
      echo "  no paths yet — measure-hops will retry after more signals"
    fi
  fi
fi

API="$API" SIEM_URL="$SIEM_URL" INTEGRATION_ID="$INTEGRATION_ID" CONTROL_SOURCE_ID="$CONTROL_SOURCE_ID" \
SCOPE_EDGE="$SCOPE_EDGE" SCOPE_APP="$SCOPE_APP" SCOPE_DATA="$SCOPE_DATA" PATH_ID="$PATH_ID" \
PLANT_SET=$([[ -n "$PLANT_TOKEN" ]] && echo true || echo false) \
HQ_SET=$([[ -n "$HQ_TOKEN" ]] && echo true || echo false) \
STATE_FILE="$STATE_FILE" \
python3 - <<'PY'
import json, os
state = {
  "schema": "periscan-lab-state-v1",
  "phase": 2,
  "api": os.environ.get("API"),
  "siemUrl": os.environ.get("SIEM_URL"),
  "integrationId": os.environ.get("INTEGRATION_ID"),
  "controlSourceId": os.environ.get("CONTROL_SOURCE_ID"),
  "scopeIds": {
    "edge": os.environ.get("SCOPE_EDGE") or None,
    "app": os.environ.get("SCOPE_APP") or None,
    "data": os.environ.get("SCOPE_DATA") or None,
  },
  "hosts": [
    "edge.lab.range.test",
    "app.lab.range.test",
    "data.lab.range.test"
  ],
  "multiHopPath": [
    "edge.lab.range.test",
    "app.lab.range.test",
    "data.lab.range.test"
  ],
  "pathId": os.environ.get("PATH_ID") or None,
  "runners": {
    "plantTokenSet": os.environ.get("PLANT_SET") == "true",
    "hqTokenSet": os.environ.get("HQ_SET") == "true",
    "plantSite": "plant",
    "plantSegment": "ot-dmz",
    "hqSite": "hq",
    "hqSegment": "corp",
  },
  "claimSafety": "Heuristic must never be presented as Measured without hop receipts",
}
path = os.environ["STATE_FILE"]
open(path, "w").write(json.dumps(state, indent=2) + "\n")
print(json.dumps(state, indent=2))
print(f"[lab seed] wrote {path}")
PY

ENV_OUT="${ROOT}/.lab-runner.env"
{
  echo "# Generated by seed-tenant.sh — do not commit"
  echo "CONTROL_PLANE_URL=${API}"
  echo "PLANT_TOKEN=${PLANT_TOKEN}"
  echo "HQ_TOKEN=${HQ_TOKEN}"
} > "$ENV_OUT"
echo "[lab seed] wrote ${ENV_OUT}"
echo "[lab seed] start runners: set -a; source .lab-runner.env; set +a; docker compose --profile runners up -d"
echo "[lab seed] canary: ./scripts/canary-loop.sh"
echo "[lab seed] posture: ./scripts/posture-lab.sh"
echo "[lab seed] measure hops: ./scripts/measure-hops.sh"
echo "[lab seed] golden: ./scripts/golden-path.sh"
