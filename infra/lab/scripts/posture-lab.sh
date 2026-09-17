#!/usr/bin/env bash
# LiveSafe posture-check against lab Domain scopes (edge/app/data).
# Requires API + PERISCAN_API_TOKEN and seed scopes (or .lab-state.json).
# Honesty: LiveSafe only — never Fixture as Measured.
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
lab_auth_init
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
TOKEN="${PERISCAN_API_TOKEN:-}"
STATE_FILE="${PERISCAN_LAB_STATE_FILE:-$ROOT/.lab-state.json}"
REPORT_DIR="${PERISCAN_LAB_REPORT_DIR:-$ROOT/../../docs/qa/lab-runs}"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${REPORT_DIR}/${STAMP}-posture.json"

if [[ -z "$TOKEN" ]]; then
  echo "[posture] need PERISCAN_API_TOKEN (and seeded scopes). Run seed-tenant.sh first."
  exit 1
fi

AUTH=("${AUTH_HEADER[@]}")

SCOPE_LINES=""
if [[ -f "$STATE_FILE" ]]; then
  SCOPE_LINES=$(python3 - <<PY
import json
d=json.load(open("${STATE_FILE}"))
ids=d.get("scopeIds") or {}
for k in ("edge","app","data"):
  v=ids.get(k)
  if v:
    print(f"{k}.lab.range.test\t{v}")
PY
)
fi

if [[ -z "$SCOPE_LINES" ]]; then
  echo "[posture] no scopeIds in state — listing scopes for lab hosts"
  LIST=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/scopes" || true)
  SCOPE_LINES=$(echo "$LIST" | python3 - <<'PY'
import sys,json
try: d=json.load(sys.stdin)
except Exception: raise SystemExit
items=d if isinstance(d,list) else d.get("items") or d.get("scopes") or []
want={"edge.lab.range.test","app.lab.range.test","data.lab.range.test"}
for s in items:
  v=s.get("value") or s.get("scopeValue") or ""
  if v in want:
    print(f"{v}\t{s.get('scopeId')}")
PY
)
fi

if [[ -z "$SCOPE_LINES" ]]; then
  echo "[posture] no lab scopes found — run seed-tenant.sh"
  exit 1
fi

fail=0
RESULTS_JSON="[]"
echo "[posture] LiveSafe posture-check"

while IFS=$'\t' read -r host sid; do
  [[ -n "$sid" ]] || continue
  echo "  → ${host} (${sid})"
  TMP=$(mktemp)
  CODE=$(curl -sS -o "$TMP" -w "%{http_code}" "${AUTH[@]}" -X POST \
    "${API}/api/v1/scopes/${sid}/posture-check" \
    -d '{"executionMode":"LiveSafe"}' || echo 000)
  RESP=$(cat "$TMP")
  rm -f "$TMP"

  if [[ "$CODE" != "200" && "$CODE" != "201" ]]; then
    echo "    FAIL status=${CODE} ${RESP:0:200}"
    fail=1
    RESULTS_JSON=$(RESULTS_JSON="$RESULTS_JSON" HOST="$host" SID="$sid" CODE="$CODE" python3 -c "
import json,os
r=json.loads(os.environ['RESULTS_JSON'])
r.append({'host':os.environ['HOST'],'scopeId':os.environ['SID'],'status':int(os.environ['CODE'] or 0),'ok':False})
print(json.dumps(r))
")
    continue
  fi
  SUMMARY=$(echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
runs=d.get('runs') or d.get('moduleResults') or d.get('items') or []
findings=d.get('findingCount') or d.get('findings') or None
print(json.dumps({
  'keys': list(d.keys())[:12],
  'runCount': len(runs) if isinstance(runs,list) else None,
  'findingCount': findings if not isinstance(findings,list) else len(findings),
  'executionMode': d.get('executionMode') or d.get('mode'),
}))
" 2>/dev/null || echo '{}')
  echo "    ok ${SUMMARY}"
  RESULTS_JSON=$(RESULTS_JSON="$RESULTS_JSON" HOST="$host" SID="$sid" CODE="$CODE" SUMMARY="$SUMMARY" python3 -c "
import json,os
r=json.loads(os.environ['RESULTS_JSON'])
try: s=json.loads(os.environ.get('SUMMARY') or '{}')
except Exception: s={}
r.append({'host':os.environ['HOST'],'scopeId':os.environ['SID'],'status':int(os.environ['CODE']),'ok':True,'summary':s})
print(json.dumps(r))
")
done <<< "$SCOPE_LINES"

export OUT RESULTS_JSON FAIL="$fail"
python3 - <<'PY'
import json,os
doc={
  "schema":"periscan-lab-posture-v1",
  "phase":2,
  "executionMode":"LiveSafe",
  "results": json.loads(os.environ.get("RESULTS_JSON") or "[]"),
  "pass": os.environ.get("FAIL")=="0",
  "claimSafety":"LiveSafe only; Fixture results must not be labeled Measured",
}
open(os.environ["OUT"],"w").write(json.dumps(doc,indent=2)+"\n")
print(json.dumps(doc,indent=2))
print(f"[posture] wrote {os.environ['OUT']}")
PY

if [[ "$fail" -ne 0 ]]; then
  echo "[posture] FAILED"
  exit 1
fi
echo "[posture] OK"
exit 0
