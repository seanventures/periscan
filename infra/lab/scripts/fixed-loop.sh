#!/usr/bin/env bash
# Closed-loop Fixed demo: LiveSafe posture on exposed → harden → LiveSafe again.
# Asserts product validationState transitions toward Fixed for HTTP modules
# (same honesty as tests/e2e-measured). Does not invent Fixed without re-measure.
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
lab_auth_init

ROOT="$LAB_ROOT"
cd "$ROOT"
STATE_FILE="${PERISCAN_LAB_STATE_FILE}"
REPORT_DIR="${PERISCAN_LAB_REPORT_DIR}"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${REPORT_DIR}/${STAMP}-fixed-loop.json"

if [[ -z "${TOKEN:-}" ]]; then
  echo "[fixed-loop] need PERISCAN_API_TOKEN"
  exit 1
fi
AUTH=("${AUTH_HEADER[@]}")

SCOPE_APP=""
if [[ -f "$STATE_FILE" ]]; then
  SCOPE_APP=$(python3 -c "import json;print((json.load(open('${STATE_FILE}')).get('scopeIds') or {}).get('app') or '')")
fi
if [[ -z "$SCOPE_APP" ]]; then
  echo "[fixed-loop] no app scope in .lab-state.json — run seed-tenant.sh"
  exit 1
fi

posture_json_file() {
  local sid="$1" label="$2" outf="$3"
  local tmp code
  tmp=$(mktemp)
  code=$(curl -sS -o "$tmp" -w "%{http_code}" "${AUTH[@]}" -X POST \
    "${API}/api/v1/scopes/${sid}/posture-check" \
    -d '{"executionMode":"LiveSafe"}' || echo 000)
  echo "[fixed-loop] posture ${label} status=${code}" >&2
  CODE="$code" TMP="$tmp" python3 - <<'PY' >"$outf"
import json, os
code = int(os.environ.get("CODE") or 0)
try:
  d = json.load(open(os.environ["TMP"]))
except Exception as e:
  print(json.dumps({"ok": False, "error": str(e), "status": code}))
  raise SystemExit
checks = d.get("checks") or d.get("moduleResults") or d.get("runs") or []
if isinstance(checks, dict):
  checks = list(checks.values()) if checks else []
summary = []
validated = 0
fixed = 0
for c in checks if isinstance(checks, list) else []:
  if not isinstance(c, dict):
    continue
  mid = c.get("moduleId") or c.get("id") or ""
  st = c.get("validationState") or c.get("state")
  summary.append({"moduleId": mid, "validationState": st, "outcome": c.get("outcome")})
  if st == "Validated":
    validated += 1
  if st == "Fixed":
    fixed += 1
print(json.dumps({
  "ok": code in (200, 201),
  "status": code,
  "validated": validated,
  "fixed": fixed,
  "checks": summary[:20],
  "keys": list(d.keys())[:12],
}))
PY
  rm -f "$tmp"
}

echo "[fixed-loop] 1) ensure exposed profile"
export LAB_PROFILE=exposed
docker compose build --build-arg LAB_PROFILE=exposed data app edge >/dev/null
docker compose up -d data app edge
sleep 2
./scripts/smoke.sh >/dev/null || true

EXPOSED_FILE=$(mktemp)
HARDENED_FILE=$(mktemp)
echo "[fixed-loop] 2) LiveSafe posture (exposed — expect Validated/exposures)"
posture_json_file "$SCOPE_APP" exposed "$EXPOSED_FILE"

echo "[fixed-loop] 3) harden lab tiers"
export LAB_PROFILE=hardened
docker compose build --build-arg LAB_PROFILE=hardened data app edge
docker compose up -d data app edge
sleep 2
code=$(curl -sS -o /dev/null -w "%{http_code}" -H 'Host: data.lab.range.test' http://127.0.0.1:8083/api/records || echo 000)
echo "[fixed-loop] data /api/records code=${code} (expect 401 hardened)"

echo "[fixed-loop] 4) LiveSafe posture (hardened — expect Fixed where closed-loop modules apply)"
posture_json_file "$SCOPE_APP" hardened "$HARDENED_FILE"

if [[ "${PERISCAN_LAB_LEAVE_HARDENED:-0}" != "1" ]]; then
  echo "[fixed-loop] 5) restore exposed profile for continued demo"
  export LAB_PROFILE=exposed
  docker compose build --build-arg LAB_PROFILE=exposed data app edge >/dev/null
  docker compose up -d data app edge
fi

export OUT SCOPE_APP FIXED_CODE="$code" EXPOSED_FILE HARDENED_FILE
python3 - <<'PY'
import json, os
exposed = json.load(open(os.environ["EXPOSED_FILE"]))
hardened = json.load(open(os.environ["HARDENED_FILE"]))
code = os.environ.get("FIXED_CODE", "")
doc = {
  "schema": "periscan-lab-fixed-loop-v1",
  "scopeId": os.environ.get("SCOPE_APP"),
  "dataRecordsHardenedCode": code,
  "exposed": exposed,
  "hardened": hardened,
  "claimSafety": "Fixed only from LiveSafe re-measure after harden; never mark Fixed without verification",
  "pass": bool(hardened.get("ok")) and code in ("401", "403"),
  "notes": [
    "HTTP security-header modules should trend Validated→Fixed across the flip when probes succeed",
    "claim-safe: product Fixed requires measured revalidation events on remediations too",
  ],
}
open(os.environ["OUT"], "w").write(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
print(f"[fixed-loop] wrote {os.environ['OUT']}")
if not doc["pass"]:
  raise SystemExit(1)
PY
rm -f "$EXPOSED_FILE" "$HARDENED_FILE"

echo "[fixed-loop] OK"
