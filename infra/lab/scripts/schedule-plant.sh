#!/usr/bin/env bash
# Create a plant-affinity schedule for continuous passive validation (demo).
# Best-effort: product schedule schemas vary; prints API response.
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
lab_auth_init

if [[ -z "${TOKEN:-}" ]]; then
  echo "[schedule-plant] need PERISCAN_API_TOKEN"
  exit 1
fi
AUTH=("${AUTH_HEADER[@]}")
STATE_FILE="${PERISCAN_LAB_STATE_FILE}"
SCOPE_ID="${PERISCAN_LAB_SCOPE_ID:-}"
if [[ -z "$SCOPE_ID" && -f "$STATE_FILE" ]]; then
  SCOPE_ID=$(python3 -c "import json;print((json.load(open('${STATE_FILE}')).get('scopeIds') or {}).get('app') or '')")
fi
if [[ -z "$SCOPE_ID" ]]; then
  echo "[schedule-plant] need app scopeId"
  exit 1
fi

# Discover schedule create payload from OpenAPI-ish trial of common shapes
BODY=$(SCOPE_ID="$SCOPE_ID" python3 - <<'PY'
import json, os
print(json.dumps({
  "name": "Lab plant continuous CV",
  "scopeId": os.environ["SCOPE_ID"],
  "missionType": "ContinuousValidation",
  "frequency": "Daily",
  "enabled": True,
  "preferredSite": "plant",
  "networkSegment": "ot-dmz",
  "labels": ["lab", "plant", "demo"],
}))
PY
)

echo "[schedule-plant] POST /api/v1/schedules"
tmp=$(mktemp)
code=$(curl -sS -o "$tmp" -w "%{http_code}" "${AUTH[@]}" -X POST \
  "${API}/api/v1/schedules" -d "$BODY" || echo 000)
echo "  status=$code"
head -c 500 "$tmp"; echo

if [[ "$code" != "201" && "$code" != "200" ]]; then
  # try alternate
  BODY2=$(SCOPE_ID="$SCOPE_ID" python3 - <<'PY'
import json, os
print(json.dumps({
  "name": "Lab plant continuous CV",
  "scopeIds": [os.environ["SCOPE_ID"]],
  "missionType": "ExposureValidation",
  "cronExpression": "0 8 * * *",
  "enabled": True,
  "siteId": "plant",
  "networkSegment": "ot-dmz",
}))
PY
)
  code=$(curl -sS -o "$tmp" -w "%{http_code}" "${AUTH[@]}" -X POST \
    "${API}/api/v1/schedules" -d "$BODY2" || echo 000)
  echo "  alt status=$code"
  head -c 500 "$tmp"; echo
fi
rm -f "$tmp"
echo "[schedule-plant] list:"
curl -fsS "${AUTH[@]}" "${API}/api/v1/schedules" | python3 -m json.tool 2>/dev/null | head -40 || true
