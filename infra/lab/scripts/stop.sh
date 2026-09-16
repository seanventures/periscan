#!/usr/bin/env bash
# Stop lab demo stack: compose range + local API/worker/web on default ports.
# Does not stop Colima, Postgres, Redis, or unrelated projects.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[lab stop] compose (incl. runners)"
docker compose --profile runners down 2>/dev/null || docker compose down 2>/dev/null || true

# Kill by port ownership (avoids pkill self-match hazards)
kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "[lab stop] freeing :$port → $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  else
    echo "[lab stop] :$port free"
  fi
}

kill_port 3000
kill_port 3001
# worker has no dedicated port — best-effort via parent of 3001 already gone

echo "[lab stop] done"
echo "  restart: pnpm lab:up && pnpm lab:dev && pnpm lab:demo-up"
