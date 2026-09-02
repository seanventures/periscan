#!/usr/bin/env bash
set -euo pipefail

# DevX: one-cmd full non-snap async proof loop (api + web + worker + redis + postgres fixture).
# Run from periscan root. Brings up minimal stack for real non-snap scheduled runs.
# Usage: ./scripts/full-dev-non-snap.sh

echo "=== Periscan full dev non-snap stack ==="
echo "Starting postgres/redis (if not running) + api/web/worker concurrently."
echo "After start: create non-snap via /schedules or /missions, run, watch worker logs for attach/Ready + CTEM/billing."

# Ensure .env or defaults for 5432 etc are ok (assumes prior setup).

# Start infra if needed (idempotent).
PERISCAN_POSTGRES_PUBLISHED_PORT=5432 docker-compose -f infra/docker-compose/docker-compose.yml up -d postgres redis || true

# Concurrent dev (api + web + worker).
# Requires concurrently or use tmux; here use pnpm dev + worker in bg for simplicity.
echo "Launching api+web (concurrent) + worker in background..."
pnpm --filter @periscan/api dev &
API_PID=$!
pnpm --filter @periscan/web dev &
WEB_PID=$!

# Worker (processor + model if needed).
echo "Launching worker..."
node --loader ts-node/esm apps/worker/src/index.ts || pnpm --filter @periscan/worker dev || true &

echo "Stack up. Visit http://localhost:3000 (home), /schedules for pickers."
echo "Create non-snap (Control/AI/Fix), run, watch for lastDiff, CTEM, Verdict, billing, pack."
echo "Ctrl-C to stop (pids: api $API_PID web $WEB_PID)."
wait
