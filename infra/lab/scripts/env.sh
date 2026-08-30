#!/usr/bin/env bash
# Shared env defaults for lab demo site (source from other scripts).
# shellcheck shell=bash

# Resolve the deps-compose Postgres container. Project name is pinned
# `periscan-deps`, so the container is `periscan-deps-postgres-1` — not the
# historical `docker-compose-postgres-1` name.
lab_postgres_container() {
  if [[ -n "${PERISCAN_PG_CONTAINER:-}" ]]; then
    echo "$PERISCAN_PG_CONTAINER"
    return 0
  fi
  local repo_root compose_file name candidate
  repo_root="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
  compose_file="${repo_root}/infra/docker-compose/docker-compose.yml"
  if [[ -f "$compose_file" ]]; then
    name=$(docker compose -f "$compose_file" ps --format '{{.Name}}' postgres 2>/dev/null | head -n 1 || true)
    if [[ -n "$name" ]]; then
      echo "$name"
      return 0
    fi
  fi
  for candidate in periscan-deps-postgres-1 docker-compose-postgres-1; do
    if docker inspect "$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  echo "periscan-deps-postgres-1"
}

lab_postgres_published_port() {
  if [[ -n "${PERISCAN_POSTGRES_PUBLISHED_PORT:-}" ]]; then
    echo "$PERISCAN_POSTGRES_PUBLISHED_PORT"
    return 0
  fi
  local container published
  container="$(lab_postgres_container)"
  published=$(docker inspect "$container" \
    --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' 2>/dev/null || true)
  if [[ -n "$published" ]]; then
    echo "$published"
    return 0
  fi
  echo "5432"
}

lab_env_defaults() {
  export REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
  export LAB_ROOT="${LAB_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
  export PERISCAN_API_URL="${PERISCAN_API_URL:-http://127.0.0.1:${PERISCAN_API_PORT:-3001}}"
  # Honor PERISCAN_WEB_PORT when :3000 is taken (SSH tunnels, other apps).
  export PERISCAN_WEB_PORT="${PERISCAN_WEB_PORT:-3000}"
  export PERISCAN_WEB_URL="${PERISCAN_WEB_URL:-http://127.0.0.1:${PERISCAN_WEB_PORT}}"
  export PERISCAN_LAB_SIEM_URL="${PERISCAN_LAB_SIEM_URL:-http://127.0.0.1:9200}"
  export PERISCAN_LAB_MODE="${PERISCAN_LAB_MODE:-1}"
  export PERISCAN_DEV_MODE="${PERISCAN_DEV_MODE:-true}"
  export PERISCAN_JWT_SECRET="${PERISCAN_JWT_SECRET:-periscan-dev-session-secret}"
  export PERISCAN_DATA_REGION="${PERISCAN_DATA_REGION:-us-east-1}"
  export PERISCAN_COOKIE_SECURE="${PERISCAN_COOKIE_SECURE:-false}"
  export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:${PERISCAN_REDIS_PUBLISHED_PORT:-6379}}"
  export PERISCAN_PG_CONTAINER="${PERISCAN_PG_CONTAINER:-$(lab_postgres_container)}"
  # Prefer an explicit published port, then inspect the live container.
  if [[ -z "${DATABASE_URL:-}" ]]; then
    local published=""
    published="$(lab_postgres_published_port)"
    export DATABASE_URL="postgresql://periscan:periscan@127.0.0.1:${published}/periscan"
  fi
  export PERISCAN_RUNNER_IMAGE="${PERISCAN_RUNNER_IMAGE:-periscan-runner:test}"
  export CONTROL_PLANE_URL="${CONTROL_PLANE_URL:-http://host.docker.internal:3001}"
  export PERISCAN_LAB_STATE_FILE="${PERISCAN_LAB_STATE_FILE:-$LAB_ROOT/.lab-state.json}"
  export PERISCAN_LAB_DEMO_ENV="${PERISCAN_LAB_DEMO_ENV:-$LAB_ROOT/.lab-demo.env}"
  export PERISCAN_LAB_REPORT_DIR="${PERISCAN_LAB_REPORT_DIR:-$REPO_ROOT/docs/qa/lab-runs}"
}

lab_wait_http() {
  local url="$1" name="${2:-service}" tries="${3:-30}"
  local i
  for i in $(seq 1 "$tries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[lab-env] $name ok ($url)"
      return 0
    fi
    sleep 1
  done
  echo "[lab-env] $name not ready after ${tries}s: $url" >&2
  return 1
}

lab_wait_api() {
  lab_wait_http "${PERISCAN_API_URL%/}/api/v1/health" "api" "${1:-45}"
}
