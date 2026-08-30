#!/usr/bin/env bash
# Start API + worker + web with lab demo defaults (foreground via concurrently).
# Prefer running panes separately for long demos; this is the single-command form.
#
#   ./scripts/control-plane-dev.sh
#   # or from repo: pnpm lab:dev
set -euo pipefail
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults

# If :3000 is already bound (common SSH forward) and the operator did not
# pick a port, move web to 3010 so lab:dev can start.
if [[ "${PERISCAN_WEB_PORT}" == "3000" ]] && command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    export PERISCAN_WEB_PORT=3010
    export PERISCAN_WEB_URL="http://127.0.0.1:3010"
    echo "[lab:dev] :3000 is in use — web will bind PERISCAN_WEB_PORT=3010"
  fi
fi

cd "$REPO_ROOT"

export DATABASE_URL
export PERISCAN_DEV_MODE=true
export PERISCAN_JWT_SECRET
export PERISCAN_LAB_MODE=1
export PERISCAN_COOKIE_SECURE=false
export PERISCAN_DATA_REGION
export REDIS_URL
export PERISCAN_API_URL
export NEXT_PUBLIC_PERISCAN_API_URL="${NEXT_PUBLIC_PERISCAN_API_URL:-$PERISCAN_API_URL}"
# Task envelope artifact/result URLs must be reachable from Docker runners.
# host.docker.internal maps to the API process on the host (see lab compose extra_hosts).
export PERISCAN_RUNNER_CONTROL_PLANE_URL="${PERISCAN_RUNNER_CONTROL_PLANE_URL:-http://host.docker.internal:3001}"
export PERISCAN_PUBLIC_API_URL="${PERISCAN_PUBLIC_API_URL:-$PERISCAN_RUNNER_CONTROL_PLANE_URL}"

echo "[lab:dev] DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "[lab:dev] PERISCAN_LAB_MODE=1  API=$PERISCAN_API_URL  WEB=$PERISCAN_WEB_URL"
echo "[lab:dev] runner callbacks via $PERISCAN_RUNNER_CONTROL_PLANE_URL"
echo "[lab:dev] starting api + worker + web (Ctrl-C stops all)"
echo

exec pnpm exec concurrently -n api,worker,web -c blue,yellow,green \
  "pnpm --filter @periscan/api dev" \
  "pnpm --filter @periscan/worker dev" \
  "pnpm --filter @periscan/web dev"
