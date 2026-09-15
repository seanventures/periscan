#!/usr/bin/env bash
# Start API + worker + web with lab demo defaults (foreground via concurrently).
# Prefer running panes separately for long demos; this is the single-command form.
#
#   ./scripts/control-plane-dev.sh
#   # or from repo: pnpm lab:dev
#
# If :3000 / :3001 are already bound, bind the next free ports and print them.
# Worker does not listen on TCP. PERISCAN_LAB_DEV_DRY_RUN=1 prints ports and exits.
set -euo pipefail
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
lab_remap_dev_listen_ports

cd "$REPO_ROOT"

export DATABASE_URL
export PERISCAN_DEV_MODE=true
export PERISCAN_JWT_SECRET
export PERISCAN_LAB_MODE=1
export PERISCAN_COOKIE_SECURE=false
export PERISCAN_DATA_REGION
export REDIS_URL
export PERISCAN_API_PORT
export PERISCAN_API_URL
export PERISCAN_WEB_PORT
export PERISCAN_WEB_URL
export NEXT_PUBLIC_PERISCAN_API_URL="$PERISCAN_API_URL"
# Task envelope artifact/result URLs must be reachable from Docker runners.
# host.docker.internal maps to the API process on the host (see lab compose extra_hosts).
if [[ -z "${PERISCAN_RUNNER_CONTROL_PLANE_URL:-}" ]] ||
  { [[ "$PERISCAN_API_PORT" != "3001" && "$PERISCAN_RUNNER_CONTROL_PLANE_URL" == *":3001"* ]]; }; then
  export PERISCAN_RUNNER_CONTROL_PLANE_URL="http://host.docker.internal:${PERISCAN_API_PORT}"
fi
export PERISCAN_PUBLIC_API_URL="${PERISCAN_PUBLIC_API_URL:-$PERISCAN_RUNNER_CONTROL_PLANE_URL}"
if [[ "$PERISCAN_API_PORT" != "3001" && "$PERISCAN_PUBLIC_API_URL" == *":3001"* ]]; then
  export PERISCAN_PUBLIC_API_URL="$PERISCAN_RUNNER_CONTROL_PLANE_URL"
fi
export CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-$PERISCAN_RUNNER_CONTROL_PLANE_URL}"
if [[ "$PERISCAN_API_PORT" != "3001" && "$CONTROL_PLANE_URL" == *":3001"* ]]; then
  export CONTROL_PLANE_URL="$PERISCAN_RUNNER_CONTROL_PLANE_URL"
fi

echo "[lab:dev] DATABASE_URL=${DATABASE_URL%%@*}@***"
echo "[lab:dev] PERISCAN_LAB_MODE=1  API=$PERISCAN_API_URL  WEB=$PERISCAN_WEB_URL"
echo "[lab:dev] runner callbacks via $PERISCAN_RUNNER_CONTROL_PLANE_URL"

if [[ "${PERISCAN_LAB_DEV_DRY_RUN:-}" == "1" ]]; then
  echo "[lab:dev] dry-run PERISCAN_API_PORT=${PERISCAN_API_PORT} PERISCAN_WEB_PORT=${PERISCAN_WEB_PORT}"
  exit 0
fi

echo "[lab:dev] starting api + worker + web (Ctrl-C stops all)"
echo

exec pnpm exec concurrently -n api,worker,web -c blue,yellow,green \
  "pnpm --filter @periscan/api dev" \
  "pnpm --filter @periscan/worker dev" \
  "pnpm --filter @periscan/web dev"
