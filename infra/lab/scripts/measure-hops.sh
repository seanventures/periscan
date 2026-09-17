#!/usr/bin/env bash
# Multi-hop measure helper (Phase 2→DoD).
#
# 1. Prefer PERISCAN_LAB_PATH_ID or pathId from .lab-state.json
# 2. Else list attack-paths and pick first multi-hop (>=2 edges)
# 3. For each unmeasured edge: POST .../edges/:id/validate with safe hop module
# 4. Poll measurement-state (missions may need worker to complete)
#
# Never forges receipts without runs. Launch alone is not FullyMeasured.
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
lab_auth_init
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
TOKEN="${PERISCAN_API_TOKEN:-}"
STATE_FILE="${PERISCAN_LAB_STATE_FILE:-$ROOT/.lab-state.json}"
MODULE_ID="${PERISCAN_LAB_HOP_MODULE:-periscan.http_health_check}"
# Alternate safe modules: periscan.tcp_reachability, periscan.tls_certificate_check
REPORT_DIR="${PERISCAN_LAB_REPORT_DIR:-$ROOT/../../docs/qa/lab-runs}"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${REPORT_DIR}/${STAMP}-measure-hops.json"
POLL_SECONDS="${PERISCAN_LAB_MEASURE_POLL_SECONDS:-5}"
POLL_TRIES="${PERISCAN_LAB_MEASURE_POLL_TRIES:-12}"

if [[ -z "$TOKEN" ]]; then
  cat <<EOF
[measure-hops] need PERISCAN_API_TOKEN.

  After seed-tenant.sh (scopes + optional github/aws sync for multi-hop paths):
    export PERISCAN_API_URL=http://127.0.0.1:3001
    export PERISCAN_API_TOKEN='periscan_session=...'
    ./scripts/measure-hops.sh

  FullyMeasured requires hop probes to complete with evidence + auto-applied
  receipts (or worker processing). Launch alone is not Measured.
EOF
  exit 1
fi

AUTH=("${AUTH_HEADER[@]}")

PATH_ID="${PERISCAN_LAB_PATH_ID:-}"
if [[ -z "$PATH_ID" && -f "$STATE_FILE" ]]; then
  PATH_ID=$(python3 -c "import json;print(json.load(open('${STATE_FILE}')).get('pathId') or '')" 2>/dev/null || true)
fi

SCOPE_ID="${PERISCAN_LAB_SCOPE_ID:-}"
if [[ -z "$SCOPE_ID" && -f "$STATE_FILE" ]]; then
  SCOPE_ID=$(python3 -c "
import json
ids=json.load(open('${STATE_FILE}')).get('scopeIds') or {}
print(ids.get('edge') or ids.get('app') or next((v for v in ids.values() if v), '') or '')
" 2>/dev/null || true)
fi

echo "[measure-hops] list attack-paths"
PATHS=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/attack-paths" || true)
if [[ -z "$PATHS" ]]; then
  echo "[measure-hops] failed to list attack-paths"
  exit 1
fi

if [[ -z "$PATH_ID" ]]; then
  PATH_ID=$(echo "$PATHS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d.get('items') or []
best=None
for it in items:
  p=it.get('attackPath') or it
  edges=p.get('pathEdges') or []
  if len(edges)>=2:
    best=p.get('pathId'); break
if not best and items:
  p=items[0].get('attackPath') or items[0]
  best=p.get('pathId')
print(best or '')
")
fi

if [[ -z "$PATH_ID" ]]; then
  echo "[measure-hops] no attack paths — seed via seed-tenant.sh multi-hop (github+aws mock sync) or correlate findings first"
  export OUT PATH_ID="" FULLY=false LAUNCHED=0
  python3 - <<'PY'
import json,os
doc={"schema":"periscan-lab-measure-hops-v1","pathId":None,"fullyMeasured":False,"launched":0,"notes":["no paths"]}
open(os.environ["OUT"],"w").write(json.dumps(doc,indent=2)+"\n")
print(json.dumps(doc,indent=2))
PY
  exit 1
fi

echo "[measure-hops] pathId=${PATH_ID}"

if [[ -z "$SCOPE_ID" ]]; then
  # try first verified domain from path detail or scopes list
  SCOPE_ID=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/scopes" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items=d if isinstance(d,list) else d.get('items') or d.get('scopes') or []
for s in items:
  if s.get('verificationStatus')=='Verified' or s.get('status')=='Verified':
    print(s.get('scopeId') or ''); break
" 2>/dev/null || true)
fi

if [[ -z "$SCOPE_ID" ]]; then
  echo "[measure-hops] need verified scopeId (PERISCAN_LAB_SCOPE_ID)"
  exit 1
fi

DETAIL=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/attack-paths/${PATH_ID}" || true)
EDGE_IDS=$(echo "$DETAIL" | python3 -c "
import sys,json
d=json.load(sys.stdin)
p=d.get('attackPath') or d
edges=p.get('pathEdges') or []
for e in edges:
  basis=e.get('evidenceBasis') or ''
  ids=e.get('evidenceIds') or []
  if basis!='Measured' or not ids:
    print(e.get('pathEdgeId'))
" 2>/dev/null || true)

LAUNCHED=0
NOTES=()
if [[ -z "$EDGE_IDS" ]]; then
  echo "[measure-hops] no unmeasured edges (or path shape unexpected) — checking measurement-state"
  NOTES+=("no_unmeasured_edges_or_parse")
else
  while IFS= read -r edgeId; do
    [[ -n "$edgeId" ]] || continue
    echo "  launch validate edge=${edgeId} module=${MODULE_ID}"
    BODY=$(PATH_ID="$PATH_ID" EDGE_ID="$edgeId" SCOPE_ID="$SCOPE_ID" MODULE_ID="$MODULE_ID" python3 - <<'PY'
import json,os
print(json.dumps({
  "pathId": os.environ["PATH_ID"],
  "pathEdgeId": os.environ["EDGE_ID"],
  "moduleId": os.environ["MODULE_ID"],
  "scopeId": os.environ["SCOPE_ID"],
  "missionType": "ExposureValidation",
  "safetyLevel": "ActiveNonInvasive",
  "reason": "lab measure-hops safe hop probe"
}))
PY
)
    RESP=$(curl -sS "${AUTH[@]}" -X POST \
      "${API}/api/v1/attack-paths/${PATH_ID}/edges/${edgeId}/validate" \
      -d "$BODY" || true)
    STATUS=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status') or d.get('error') or d.get('code') or 'unknown')" 2>/dev/null || echo parse_error)
    QUEUED=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('queued'))" 2>/dev/null || echo "")
    echo "    status=${STATUS} queued=${QUEUED}"
    LAUNCHED=$((LAUNCHED + 1))
    if echo "$RESP" | grep -qi 'Denied'; then
      NOTES+=("edge ${edgeId} denied")
    fi
  done <<< "$EDGE_IDS"
fi

FULLY=false
MS=""
for try in $(seq 1 "$POLL_TRIES"); do
  MS=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/attack-paths/${PATH_ID}/measurement-state" || true)
  if echo "$MS" | grep -q '"fullyMeasured"[[:space:]]*:[[:space:]]*true'; then
    FULLY=true
    echo "[measure-hops] fullyMeasured=true (try ${try})"
    break
  fi
  echo "  poll ${try}/${POLL_TRIES} fullyMeasured not yet (worker may still run)"
  sleep "$POLL_SECONDS"
done

# Persist pathId into state if present
if [[ -f "$STATE_FILE" ]]; then
  PATH_ID="$PATH_ID" STATE_FILE="$STATE_FILE" python3 - <<'PY'
import json,os
p=os.environ["STATE_FILE"]
d=json.load(open(p))
d["pathId"]=os.environ["PATH_ID"]
open(p,"w").write(json.dumps(d,indent=2)+"\n")
print(f"[measure-hops] updated pathId in {p}")
PY
fi

export OUT PATH_ID FULLY LAUNCHED MODULE_ID
export NOTES_JOINED="$(IFS='|'; echo "${NOTES[*]-}")"
export MS_SNIP="$(echo "$MS" | head -c 800)"
python3 - <<'PY'
import json,os
ms=None
try:
  ms=json.loads(os.environ.get("MS_SNIP") or "null")
except Exception:
  ms={"raw": os.environ.get("MS_SNIP")}
doc={
  "schema":"periscan-lab-measure-hops-v1",
  "phase":2,
  "pathId": os.environ.get("PATH_ID"),
  "moduleId": os.environ.get("MODULE_ID"),
  "launched": int(os.environ.get("LAUNCHED") or 0),
  "fullyMeasured": os.environ.get("FULLY")=="true",
  "measurementState": ms,
  "notes": [n for n in os.environ.get("NOTES_JOINED","").split("|") if n],
  "claimSafety": "Launch alone never FullyMeasured; requires hop receipts with evidence IDs",
}
open(os.environ["OUT"],"w").write(json.dumps(doc,indent=2)+"\n")
print(json.dumps(doc,indent=2))
print(f"[measure-hops] wrote {os.environ['OUT']}")
PY

if [[ "${PERISCAN_LAB_STRICT:-0}" == "1" && "$FULLY" != "true" ]]; then
  echo "[measure-hops] STRICT: fullyMeasured false"
  exit 1
fi

if [[ "$FULLY" == "true" ]]; then
  echo "[measure-hops] OK fullyMeasured"
  exit 0
fi
echo "[measure-hops] launched=${LAUNCHED}; fullyMeasured not yet — ensure worker processes jobs / plant runner for in-network hops"
exit 0
