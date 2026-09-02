#!/usr/bin/env bash
# Physical affinity checks for dual lab runners (plant vs hq).
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
lab_auth_init

ROOT="$LAB_ROOT"
cd "$ROOT"
REPORT_DIR="${PERISCAN_LAB_REPORT_DIR}"
mkdir -p "$REPORT_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="${REPORT_DIR}/${STAMP}-affinity.json"

PLANT_REACH="unknown"
HQ_REACH="unknown"
PLANT_LISTED=false
HQ_LISTED=false
NOTES=()

if [[ -n "${TOKEN:-}" ]]; then
  AUTH=("${AUTH_HEADER[@]}")
  RUNNERS=$(curl -fsS "${AUTH[@]}" "${API}/api/v1/runners" || true)
  if echo "$RUNNERS" | grep -qi plant; then PLANT_LISTED=true; fi
  if echo "$RUNNERS" | grep -qi hq; then HQ_LISTED=true; fi
  echo "[affinity] API runners listed plant=${PLANT_LISTED} hq=${HQ_LISTED}"
else
  NOTES+=("no API token — docker-only checks")
fi

echo "[affinity] docker compose runners"
docker compose --profile runners ps 2>/dev/null || NOTES+=("compose runners not up")

# Network isolation: plant should reach data service; hq should not (different networks).
if docker compose ps --status running 2>/dev/null | grep -q runner-plant; then
  if docker compose exec -T runner-plant wget -qO- --timeout=3 http://data:8080/health 2>/dev/null | grep -q data-ok \
    || docker compose exec -T runner-plant curl -fsS --max-time 3 http://data:8080/health 2>/dev/null | grep -q data-ok; then
    PLANT_REACH=ok
    echo "[affinity] plant → data: OK"
  else
    PLANT_REACH=fail
    echo "[affinity] plant → data: FAIL (image may lack curl/wget)"
    NOTES+=("plant data reach failed or no http client in runner image")
  fi
else
  NOTES+=("runner-plant not running")
fi

if docker compose ps --status running 2>/dev/null | grep -q runner-hq; then
  if docker compose exec -T runner-hq wget -qO- --timeout=3 http://data:8080/health 2>/dev/null | grep -q data-ok \
    || docker compose exec -T runner-hq curl -fsS --max-time 3 http://data:8080/health 2>/dev/null | grep -q data-ok; then
    HQ_REACH=unexpected_ok
    echo "[affinity] hq → data: UNEXPECTED ok (should be isolated)"
    NOTES+=("hq reached data — network isolation broken")
  else
    HQ_REACH=isolated
    echo "[affinity] hq → data: isolated (expected fail)"
  fi
else
  NOTES+=("runner-hq not running")
fi

export OUT PLANT_REACH HQ_REACH PLANT_LISTED HQ_LISTED
export NOTES_JOINED="$(IFS='|'; echo "${NOTES[*]-}")"
python3 - <<'PY'
import json, os
doc={
  "schema":"periscan-lab-affinity-v1",
  "plantListed": os.environ.get("PLANT_LISTED")=="true",
  "hqListed": os.environ.get("HQ_LISTED")=="true",
  "plantReachData": os.environ.get("PLANT_REACH"),
  "hqReachData": os.environ.get("HQ_REACH"),
  "notes": [n for n in os.environ.get("NOTES_JOINED","").split("|") if n],
  "claimSafety": "Affinity is falsified by network attachment; schedule pin is a separate product assert",
}
open(os.environ["OUT"],"w").write(json.dumps(doc, indent=2)+"\n")
print(json.dumps(doc, indent=2))
print(f"[affinity] wrote {os.environ['OUT']}")
PY

echo "[affinity] done — pin schedules preferredSite=plant in UI for lease demos"
