#!/usr/bin/env bash
# Signup a fresh lab tenant and export PERISCAN_API_TOKEN + PERISCAN_CSRF_TOKEN.
# Usage:
#   eval "$(./scripts/lab-session.sh)"
#   ./scripts/seed-tenant.sh
set -euo pipefail
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
EMAIL="${PERISCAN_LAB_EMAIL:-lab-$(date +%s)@periscan.test}"
NAME="${PERISCAN_LAB_TENANT_NAME:-Lab Session Tenant}"

HDR=$(mktemp)
BODY=$(mktemp)
CODE=$(curl -sS -D "$HDR" -o "$BODY" -w "%{http_code}" -X POST "${API}/api/v1/auth/signup" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"name\":\"Lab Owner\",\"password\":\"periscan-lab-password-ok\",\"tenantName\":\"${NAME}\"}" || echo 000)

if [[ "$CODE" != "201" ]]; then
  echo "[lab-session] signup failed ${CODE}: $(head -c 200 "$BODY")" >&2
  rm -f "$HDR" "$BODY"
  exit 1
fi

SESSION=$(python3 - <<PY
from pathlib import Path
for line in Path("$HDR").read_text().splitlines():
  if line.lower().startswith("set-cookie:") and "periscan_session=" in line:
    print(line.split(":",1)[1].strip().split(";")[0].strip()); break
PY
)
CSRF=$(python3 - <<PY
from pathlib import Path
for line in Path("$HDR").read_text().splitlines():
  if line.lower().startswith("set-cookie:") and "periscan_csrf=" in line:
    print(line.split(":",1)[1].strip().split(";")[0].strip().split("=",1)[1]); break
PY
)
TENANT=$(python3 -c "import json;print(json.load(open('$BODY'))['tenant']['tenantId'])")
rm -f "$HDR" "$BODY"

if [[ -z "$SESSION" || -z "$CSRF" ]]; then
  echo "[lab-session] missing session/csrf cookies" >&2
  exit 1
fi

# Emit exports for eval
cat <<EOF
export PERISCAN_API_URL='${API}'
export PERISCAN_API_TOKEN='${SESSION}'
export PERISCAN_CSRF_TOKEN='${CSRF}'
export PERISCAN_LAB_TENANT_ID='${TENANT}'
export PERISCAN_LAB_EMAIL='${EMAIL}'
# lab-session: tenant=${TENANT} email=${EMAIL}
EOF
