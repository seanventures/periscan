#!/usr/bin/env bash
# Full lab demo-site bring-up for Wave / board demos.
#
# Starts (or assumes) lab range + control plane product paths:
#   physical lab → session → seed → canary → posture → measure hops →
#   optional runners → golden artifact → prints login + spine URLs
#
# Prerequisites:
#   - docker (lab compose)
#   - API + worker running with PERISCAN_LAB_MODE=1 (this script can wait)
#   - postgres + redis (infra compose)
#
# Usage:
#   ./scripts/demo-up.sh
#   PERISCAN_LAB_SKIP_RUNNERS=1 ./scripts/demo-up.sh
#   PERISCAN_LAB_RUN_FIXED=1 ./scripts/demo-up.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=env.sh
source "$ROOT/scripts/env.sh"
lab_env_defaults
cd "$ROOT"

mkdir -p "$PERISCAN_LAB_REPORT_DIR" "$ROOT/certs" 2>/dev/null || true
STAMP="$(date -u +%Y%m%d-%H%M%S)"
LOG="${PERISCAN_LAB_REPORT_DIR}/${STAMP}-demo-up.log"
exec > >(tee -a "$LOG") 2>&1

echo "============================================================"
echo " Periscan LAB DEMO SITE  (${STAMP})"
echo "============================================================"
echo "REPO_ROOT=$REPO_ROOT"
echo "API=$PERISCAN_API_URL  WEB=$PERISCAN_WEB_URL  SIEM=$PERISCAN_LAB_SIEM_URL"
echo "DATABASE_URL=${DATABASE_URL%%@*}@***  LAB_MODE=$PERISCAN_LAB_MODE"

# --- 1. Lab range ---
echo
echo "[demo-up] 1/8 physical lab"
if ! curl -fsS "${PERISCAN_LAB_SIEM_URL}/health" >/dev/null 2>&1; then
  ./scripts/up.sh
else
  echo "[demo-up] lab already healthy"
fi
./scripts/smoke.sh

# --- 2. Queue hygiene ---
echo
echo "[demo-up] 2/8 validation queue hygiene"
if [[ "${PERISCAN_LAB_DRAIN_QUEUE:-1}" == "1" ]]; then
  PERISCAN_LAB_DRAIN_QUEUE=1 ./scripts/drain-validation-queue.sh || true
fi

# --- 3. Control plane ---
echo
echo "[demo-up] 3/8 control plane"
if ! lab_wait_api 5; then
  cat <<EOF
[demo-up] API not reachable at ${PERISCAN_API_URL}

Start in another terminal (from repo root):

  export DATABASE_URL='${DATABASE_URL}'
  export PERISCAN_DEV_MODE=true PERISCAN_JWT_SECRET='${PERISCAN_JWT_SECRET}'
  export REDIS_URL='${REDIS_URL}' PERISCAN_LAB_MODE=1 PERISCAN_COOKIE_SECURE=false
  pnpm --filter @periscan/api dev
  pnpm --filter @periscan/worker dev   # required for FullyMeasured
  pnpm --filter @periscan/web dev      # demo UI on :3000

Then re-run: ./scripts/demo-up.sh
EOF
  exit 1
fi
# Worker is best-effort detect (no health endpoint) — warn only
echo "[demo-up] ensure worker is running (hop FullyMeasured needs it)"

# --- 4. Session + seed ---
echo
echo "[demo-up] 4/8 tenant seed"
# shellcheck disable=SC1091
eval "$(./scripts/lab-session.sh)"
export PERISCAN_LAB_TENANT_ID
# billing bump early
if [[ -n "${PERISCAN_LAB_TENANT_ID:-}" ]]; then
  docker exec "$(lab_postgres_container)" psql -U periscan -d periscan -c \
    "UPDATE tenants SET billing_package_key='ControlValidation' WHERE tenant_id='${PERISCAN_LAB_TENANT_ID}';" \
    >/dev/null 2>&1 || true
fi
./scripts/seed-tenant.sh

# --- 5. Canary + posture + measure ---
echo
echo "[demo-up] 5/8 canary + posture + multi-hop measure"
./scripts/canary-loop.sh
./scripts/posture-lab.sh || echo "[demo-up] posture soft-fail (continue)"
export PERISCAN_LAB_MEASURE_POLL_TRIES="${PERISCAN_LAB_MEASURE_POLL_TRIES:-20}"
export PERISCAN_LAB_MEASURE_POLL_SECONDS="${PERISCAN_LAB_MEASURE_POLL_SECONDS:-2}"
./scripts/measure-hops.sh || echo "[demo-up] measure-hops incomplete (worker?)"

# --- 6. Runners ---
echo
echo "[demo-up] 6/8 runners"
if [[ "${PERISCAN_LAB_SKIP_RUNNERS:-0}" == "1" ]]; then
  echo "[demo-up] skip runners (PERISCAN_LAB_SKIP_RUNNERS=1)"
else
  PERISCAN_LAB_START_RUNNERS="${PERISCAN_LAB_START_RUNNERS:-1}" \
    ./scripts/enroll-runners.sh || echo "[demo-up] enroll soft-fail (image/token?)"
  ./scripts/affinity-fire.sh || true
fi

# --- 7. Optional fixed loop ---
echo
echo "[demo-up] 7/8 fixed loop"
if [[ "${PERISCAN_LAB_RUN_FIXED:-0}" == "1" ]]; then
  ./scripts/fixed-loop.sh || echo "[demo-up] fixed-loop soft-fail"
else
  echo "[demo-up] skip fixed-loop (set PERISCAN_LAB_RUN_FIXED=1 to enable)"
fi

# --- 8. Golden + demo credentials ---
echo
echo "[demo-up] 8/8 golden + credentials file"
export PERISCAN_LAB_SKIP_MEASURE=1  # already measured
./scripts/golden-path.sh || true

echo
echo "[demo-up] 8b Wave spine API walk"
./scripts/walk-spine.sh || echo "[demo-up] walk-spine soft-fail (see notes)"

# Measurement snapshot
FULLY="unknown"
PATH_ID=""
CS_ID=""
if [[ -f "$PERISCAN_LAB_STATE_FILE" ]]; then
  PATH_ID=$(python3 -c "import json;print(json.load(open('${PERISCAN_LAB_STATE_FILE}')).get('pathId') or '')")
  CS_ID=$(python3 -c "import json;print(json.load(open('${PERISCAN_LAB_STATE_FILE}')).get('controlSourceId') or '')")
fi
if [[ -n "$PATH_ID" && -n "${PERISCAN_API_TOKEN:-}" ]]; then
  # shellcheck source=lab-auth.sh
  source "$ROOT/scripts/lab-auth.sh"
  lab_auth_init
  MS=$(curl -fsS "${AUTH_HEADER[@]}" "${PERISCAN_API_URL}/api/v1/attack-paths/${PATH_ID}/measurement-state" || true)
  FULLY=$(echo "$MS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('fullyMeasured'))" 2>/dev/null || echo unknown)
fi

# Persist demo env for operators / UI
{
  echo "# Lab demo site credentials — DO NOT COMMIT"
  echo "# Generated ${STAMP}"
  echo "export PERISCAN_API_URL='${PERISCAN_API_URL}'"
  echo "export PERISCAN_WEB_URL='${PERISCAN_WEB_URL}'"
  echo "export PERISCAN_LAB_MODE=1"
  echo "export PERISCAN_API_TOKEN='${PERISCAN_API_TOKEN}'"
  echo "export PERISCAN_CSRF_TOKEN='${PERISCAN_CSRF_TOKEN}'"
  echo "export PERISCAN_LAB_TENANT_ID='${PERISCAN_LAB_TENANT_ID:-}'"
  echo "export PERISCAN_LAB_EMAIL='${PERISCAN_LAB_EMAIL:-}'"
  echo "export PERISCAN_LAB_PATH_ID='${PATH_ID}'"
  echo "export PERISCAN_LAB_CONTROL_SOURCE_ID='${CS_ID}'"
  echo "export DATABASE_URL='${DATABASE_URL}'"
  echo "export REDIS_URL='${REDIS_URL}'"
} > "$PERISCAN_LAB_DEMO_ENV"
chmod 600 "$PERISCAN_LAB_DEMO_ENV" 2>/dev/null || true

SUMMARY="${PERISCAN_LAB_REPORT_DIR}/${STAMP}-demo-up-summary.json"
FULLY="$FULLY" PATH_ID="$PATH_ID" CS_ID="$CS_ID" \
TENANT="${PERISCAN_LAB_TENANT_ID:-}" EMAIL="${PERISCAN_LAB_EMAIL:-}" \
API="$PERISCAN_API_URL" WEB="$PERISCAN_WEB_URL" SIEM="$PERISCAN_LAB_SIEM_URL" \
DEMO_ENV="$PERISCAN_LAB_DEMO_ENV" STAMP="$STAMP" SUMMARY="$SUMMARY" \
python3 - <<'PY'
import json, os
fm = os.environ.get("FULLY", "")
if fm in ("True", "true"):
    fully = True
elif fm in ("False", "false"):
    fully = False
else:
    fully = None
doc = {
    "schema": "periscan-lab-demo-up-v1",
    "stamp": os.environ["STAMP"],
    "fullyMeasured": fully,
    "pathId": os.environ.get("PATH_ID") or None,
    "controlSourceId": os.environ.get("CS_ID") or None,
    "tenantId": os.environ.get("TENANT") or None,
    "email": os.environ.get("EMAIL") or None,
    "password": "periscan-lab-password-ok",
    "api": os.environ.get("API"),
    "web": os.environ.get("WEB"),
    "siem": os.environ.get("SIEM"),
    "demoEnvFile": os.environ.get("DEMO_ENV"),
    "claimSafety": "Heuristic must never be presented as Measured; Fixed only via re-measure",
    "waveSpine": [
        "/dashboard",
        "/integrations",
        "/scopes",
        "/missions",
        "/attack-paths",
        "/findings",
        "/remediation",
        "/evidence",
        "/reports",
    ],
}
path = os.environ["SUMMARY"]
open(path, "w").write(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
print(f"[demo-up] wrote {path}")
PY

if [[ "${PERISCAN_LAB_STRICT:-}" == "1" && "${FULLY}" != "true" && "${FULLY}" != "True" ]]; then
  echo "[demo-up] STRICT: fullyMeasured is '${FULLY}' — not READY" >&2
  exit 1
fi

echo
echo "============================================================"
if [[ "${FULLY}" == "true" || "${FULLY}" == "True" ]]; then
  echo " DEMO SITE READY"
else
  echo " DEMO SITE PARTIAL (fullyMeasured=${FULLY} — not a measured proof)"
fi
echo "============================================================"
echo " Log:          $LOG"
echo " Summary:      $SUMMARY"
echo " Credentials:  $PERISCAN_LAB_DEMO_ENV"
echo " Tenant email: ${PERISCAN_LAB_EMAIL:-n/a}  (password: periscan-lab-password-ok)"
echo " fullyMeasured: ${FULLY}"
echo " pathId:       ${PATH_ID:-n/a}"
echo
echo " UI (Wave spine):"
echo "   ${PERISCAN_WEB_URL}/dashboard"
echo "   ${PERISCAN_WEB_URL}/scopes"
echo "   ${PERISCAN_WEB_URL}/attack-paths"
echo "   ${PERISCAN_WEB_URL}/findings"
echo "   ${PERISCAN_WEB_URL}/remediation"
echo
echo " Lab hosts:"
echo "   http://127.0.0.1:8081  (edge)  http://127.0.0.1:8082 (app)  http://127.0.0.1:8083 (data)"
echo "   SIEM http://127.0.0.1:9200"
echo
echo " Re-load session env:"
echo "   set -a; source $PERISCAN_LAB_DEMO_ENV; set +a"
echo " Optional Fixed flip:"
echo "   PERISCAN_LAB_RUN_FIXED=1 ./scripts/fixed-loop.sh"
echo "============================================================"
