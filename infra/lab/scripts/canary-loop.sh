#!/usr/bin/env bash
# Phase 2 canary loop: physical emit→observe against mocksiem, optional product proof.
#
# Physical (always, no control plane):
#   1. clear mocksiem
#   2. POST allowlisted periscan-* marker
#   3. GET search + Splunk export search must hit
#
# Product (when PERISCAN_API_URL + PERISCAN_API_TOKEN + control source id):
#   4. Pre-seed marker, call detection-marker-proof with injectMockObservation=false
#   5. Optionally dns-exfil-canary-proof the same way
#
# Honesty: never claims full BAS; realDataExfiltrated must stay false.
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
lab_auth_init
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIEM="${PERISCAN_LAB_SIEM_URL:-http://127.0.0.1:9200}"
MARKER="${PERISCAN_LAB_MARKER:-periscan-lab-canary-$(date -u +%Y%m%d%H%M%S)}"
DNS_HOST="${PERISCAN_LAB_DNS_CANARY_HOST:-lab.range.test}"
REPORT_DIR="${PERISCAN_LAB_REPORT_DIR:-$ROOT/../../docs/qa/lab-runs}"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${REPORT_DIR}/${STAMP}-canary.json"

fail=0
PHYSICAL_OK=false
SPLUNK_EXPORT_OK=false
PRODUCT_DRV=""
PRODUCT_DNS=""
PRODUCT_MEASURED_DRV=""
PRODUCT_MEASURED_DNS=""
DNS_NOTE="skipped"
NOTES=()

ok() { echo "  ok  $1"; }
bad() { echo "  FAIL $1"; fail=1; NOTES+=("$1"); }

echo "[canary] siem=${SIEM} marker=${MARKER}"

if ! curl -fsS "${SIEM}/health" | grep -q '"status":"ok"'; then
  bad "mocksiem health"
  echo "[canary] mocksiem not up — run ./scripts/up.sh first"
  exit 1
fi
ok "mocksiem health"

curl -fsS -X DELETE "${SIEM}/v1/events" >/dev/null || true

curl -fsS -X POST "${SIEM}/v1/events" \
  -H 'content-type: application/json' \
  -d "{\"marker\":\"${MARKER}\",\"host\":\"marker.lab.range.test\",\"source\":\"canary-loop\",\"techniqueId\":\"T1059\"}" \
  >/dev/null

if curl -fsS "${SIEM}/v1/events?marker=${MARKER}" | grep -q "${MARKER}"; then
  ok "lab search hit"
  PHYSICAL_OK=true
else
  bad "lab search miss"
fi

EXPORT=$(curl -fsS -X POST "${SIEM}/services/search/jobs/export" \
  -H 'content-type: application/x-www-form-urlencoded' \
  -H 'authorization: Bearer lab-token' \
  --data-urlencode "search=search index=* (\"${MARKER}\") | head 1" \
  --data-urlencode "output_mode=json" || true)

if echo "$EXPORT" | grep -qE '"result"|_raw'; then
  ok "splunk export hit"
  SPLUNK_EXPORT_OK=true
else
  bad "splunk export miss (rebuild mocksiem: docker compose build mocksiem && docker compose up -d mocksiem)"
  echo "  export body: ${EXPORT:0:200}"
fi

if command -v dig >/dev/null 2>&1; then
  if dig @127.0.0.1 -p 5355 "periscan-dns-probe.${DNS_HOST}" +short +time=2 >/dev/null 2>&1; then
    DNS_NOTE="dig_ok"
    ok "dns dig probe"
  else
    DNS_NOTE="dig_failed_or_macos_udp"
    echo "  skip dns dig (platform/UDP — see README)"
  fi
fi

API="${PERISCAN_API_URL:-}"
TOKEN="${PERISCAN_API_TOKEN:-}"
CS_ID="${PERISCAN_LAB_CONTROL_SOURCE_ID:-}"
SCOPE_ID="${PERISCAN_LAB_SCOPE_ID:-}"
STATE_FILE="${PERISCAN_LAB_STATE_FILE:-$ROOT/.lab-state.json}"

if [[ -z "$CS_ID" && -f "$STATE_FILE" ]]; then
  CS_ID=$(python3 -c "import json;print(json.load(open('${STATE_FILE}')).get('controlSourceId') or '')" 2>/dev/null || true)
fi
if [[ -z "$SCOPE_ID" && -f "$STATE_FILE" ]]; then
  SCOPE_ID=$(python3 -c "
import json
d=json.load(open('${STATE_FILE}'))
ids=d.get('scopeIds') or {}
print(ids.get('edge') or ids.get('app') or next(iter(ids.values()), '') or '')
" 2>/dev/null || true)
fi

if [[ -n "$API" && -n "$TOKEN" && -n "$CS_ID" ]]; then
  echo "[canary] product proofs against controlSource=${CS_ID}"
  # AUTH_HEADER from lab_auth_init (includes CSRF for cookie sessions)
  AUTH=("${AUTH_HEADER[@]}")

  PLATFORM="Linux"
  if [[ "$(uname -s)" == "Darwin" ]]; then PLATFORM="macOS"; fi

  DRV_BODY=$(SCOPE_ID="$SCOPE_ID" MARKER="$MARKER" PLATFORM="$PLATFORM" python3 - <<'PY'
import json, os
body = {
  "markerId": os.environ["MARKER"],
  "injectMockObservation": False,
  "performEmit": True,
  "platform": os.environ["PLATFORM"],
  "techniqueId": "T1059",
}
if os.environ.get("SCOPE_ID"):
  body["scopeId"] = os.environ["SCOPE_ID"]
print(json.dumps(body))
PY
)
  DRV_RESP=$(curl -sS "${AUTH[@]}" -X POST \
    "${API}/api/v1/control-sources/${CS_ID}/detection-marker-proof" \
    -d "$DRV_BODY" || true)
  PRODUCT_DRV=$(echo "$DRV_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('outcome') or d.get('error') or d.get('code') or 'unknown')" 2>/dev/null || echo "parse_error")
  PRODUCT_MEASURED_DRV=$(echo "$DRV_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('closedLoop')); print(d.get('validationState',''))" 2>/dev/null | tr '\n' '/' || echo "null")
  echo "  drv outcome=${PRODUCT_DRV} closedLoop/state≈${PRODUCT_MEASURED_DRV}"
  if echo "$DRV_RESP" | grep -qiE '"fullAttackLibrary"[[:space:]]*:[[:space:]]*true|"realMalware"[[:space:]]*:[[:space:]]*true'; then
    bad "drv honesty breach"
  else
    ok "drv honesty pins"
  fi

  DNS_MARKER="periscan-dns-lab-$(date -u +%H%M%S)"
  curl -fsS -X POST "${SIEM}/v1/events" \
    -H 'content-type: application/json' \
    -d "{\"marker\":\"${DNS_MARKER}\",\"host\":\"${DNS_HOST}\",\"source\":\"dns-canary\",\"techniqueId\":\"T1048\"}" \
    >/dev/null

  DNS_BODY=$(SCOPE_ID="$SCOPE_ID" DNS_MARKER="$DNS_MARKER" python3 - <<'PY'
import json, os
body = {
  "markerId": os.environ["DNS_MARKER"],
  "injectMockObservation": False,
  "techniqueId": "T1048",
}
if os.environ.get("SCOPE_ID"):
  body["scopeId"] = os.environ["SCOPE_ID"]
print(json.dumps(body))
PY
)
  DNS_RESP=$(curl -sS "${AUTH[@]}" -X POST \
    "${API}/api/v1/control-sources/${CS_ID}/dns-exfil-canary-proof" \
    -d "$DNS_BODY" || true)
  PRODUCT_DNS=$(echo "$DNS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('outcome') or d.get('error') or d.get('code') or 'unknown')" 2>/dev/null || echo "parse_error")
  PRODUCT_MEASURED_DNS=$(echo "$DNS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('measured'))" 2>/dev/null || echo "null")
  REAL_EXFIL=$(echo "$DNS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('realDataExfiltrated'))" 2>/dev/null || echo "null")
  echo "  dns outcome=${PRODUCT_DNS} measured=${PRODUCT_MEASURED_DNS} realDataExfiltrated=${REAL_EXFIL}"
  if [[ "$REAL_EXFIL" == "True" || "$REAL_EXFIL" == "true" ]]; then
    bad "dns realDataExfiltrated must be false"
  else
    ok "dns realDataExfiltrated false/absent"
  fi
else
  NOTES+=("product proofs skipped — set PERISCAN_API_URL + PERISCAN_API_TOKEN and run seed-tenant.sh")
  echo "[canary] product proofs skipped (no API token / control source)"
fi

export MARKER PHYSICAL_OK SPLUNK_EXPORT_OK DNS_NOTE PRODUCT_DRV PRODUCT_MEASURED_DRV PRODUCT_DNS PRODUCT_MEASURED_DNS
export NOTES_JOINED="$(IFS='|'; echo "${NOTES[*]-}")"
export FAIL="$fail"
export OUT

python3 - <<'PY'
import json, os
out = os.environ["OUT"]
doc = {
  "schema": "periscan-lab-canary-v1",
  "phase": 2,
  "marker": os.environ.get("MARKER", ""),
  "physicalSearch": os.environ.get("PHYSICAL_OK") == "true",
  "splunkExport": os.environ.get("SPLUNK_EXPORT_OK") == "true",
  "dnsProbe": os.environ.get("DNS_NOTE", "skipped"),
  "product": {
    "drvOutcome": os.environ.get("PRODUCT_DRV") or None,
    "drvClosedLoopHint": os.environ.get("PRODUCT_MEASURED_DRV") or None,
    "dnsOutcome": os.environ.get("PRODUCT_DNS") or None,
    "dnsMeasured": os.environ.get("PRODUCT_MEASURED_DNS") or None,
  },
  "claimSafety": {
    "drvClaimClass": "benign_marker_only",
    "fullAttackLibrary": False,
    "realDataExfiltrated": False,
  },
  "notes": [n for n in os.environ.get("NOTES_JOINED", "").split("|") if n],
  "pass": os.environ.get("FAIL", "0") == "0",
}
open(out, "w").write(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
print(f"[canary] wrote {out}")
PY

if [[ "$fail" -ne 0 ]]; then
  echo "[canary] FAILED"
  exit 1
fi
echo "[canary] OK"
exit 0
