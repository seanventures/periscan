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
  export PERISCAN_API_PORT="${PERISCAN_API_PORT:-3001}"
  export PERISCAN_API_URL="${PERISCAN_API_URL:-http://127.0.0.1:${PERISCAN_API_PORT}}"
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

# True when something already listens on TCP $1 (IPv4 or IPv6).
lab_tcp_listen_in_use() {
  local port="${1:?lab_tcp_listen_in_use requires a port}"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import socket, sys
p = int(sys.argv[1])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.bind(("0.0.0.0", p))
except OSError:
    raise SystemExit(0)
s.close()
raise SystemExit(1)' "${port}"
    return $?
  fi
  return 1
}

# Echo the first free TCP port at or above $1, skipping any extra args.
lab_pick_free_tcp_port() {
  local port="${1:?lab_pick_free_tcp_port requires a starting port}"
  shift
  local -a skip=()
  if (($# > 0)); then
    skip=("$@")
  fi
  local i=0 candidate taken s
  candidate="$port"
  while (( i < 50 )); do
    taken=0
    if lab_tcp_listen_in_use "$candidate"; then
      taken=1
    elif ((${#skip[@]} > 0)); then
      for s in "${skip[@]}"; do
        if [[ -n "$s" && "$s" == "$candidate" ]]; then
          taken=1
          break
        fi
      done
    fi
    if (( taken == 0 )); then
      echo "$candidate"
      return 0
    fi
    candidate=$((candidate + 1))
    i=$((i + 1))
  done
  echo "error: no free TCP port near ${port}" >&2
  return 1
}

# If default :3000/:3001 are taken, bind the next free ports and rewrite URLs.
# Worker does not listen on TCP — only API/web need a remap.
lab_remap_dev_listen_ports() {
  local web_preferred="${PERISCAN_WEB_PORT:-3000}"
  local api_preferred="${PERISCAN_API_PORT:-3001}"
  local web_start="$web_preferred"

  # Historical hop: busy :3000 → try 3010 first so we do not steal :3001 (API).
  if [[ "$web_preferred" == "3000" ]] && lab_tcp_listen_in_use 3000; then
    web_start=3010
  fi

  export PERISCAN_WEB_PORT
  PERISCAN_WEB_PORT="$(lab_pick_free_tcp_port "$web_start")"
  export PERISCAN_API_PORT
  PERISCAN_API_PORT="$(lab_pick_free_tcp_port "$api_preferred" "$PERISCAN_WEB_PORT")"

  if [[ "$PERISCAN_WEB_PORT" != "$web_preferred" ]]; then
    echo "[lab:dev] :${web_preferred} is in use — web will bind PERISCAN_WEB_PORT=${PERISCAN_WEB_PORT}"
  fi
  if [[ "$PERISCAN_API_PORT" != "$api_preferred" ]]; then
    echo "[lab:dev] :${api_preferred} is in use — API will bind PERISCAN_API_PORT=${PERISCAN_API_PORT}"
  fi

  export PERISCAN_WEB_URL="http://127.0.0.1:${PERISCAN_WEB_PORT}"
  export PERISCAN_API_URL="http://127.0.0.1:${PERISCAN_API_PORT}"
}

lab_compose_running_host_port() {
  local compose_file="${1:-}"
  local service="${2:-}"
  local container_port="${3:-}"
  local name published
  if [[ -z "$compose_file" || ! -f "$compose_file" ]]; then
    return 1
  fi
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  name="$(docker compose -f "$compose_file" ps --format '{{.Name}}' "$service" 2>/dev/null | head -n 1 || true)"
  if [[ -z "$name" ]]; then
    return 1
  fi
  published="$(docker inspect "$name" \
    --format '{{(index (index .NetworkSettings.Ports "'"${container_port}"'/tcp") 0).HostPort}}' \
    2>/dev/null || true)"
  if [[ -n "$published" ]]; then
    echo "$published"
    return 0
  fi
  return 1
}

# Choose published Postgres/Redis/MinIO ports for THIS clone's compose file.
# Never treat a neighbor bind (e.g. workspace :5434) as ours.
lab_select_deps_publish_ports() {
  local compose_file="${1:-}"
  local preferred_pg="${PERISCAN_POSTGRES_PUBLISHED_PORT:-5434}"
  local preferred_redis="${PERISCAN_REDIS_PUBLISHED_PORT:-6379}"
  local preferred_minio="${PERISCAN_MINIO_PUBLISHED_PORT:-9000}"
  local preferred_console="${PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT:-9001}"
  local existing_pg=""

  if existing_pg="$(lab_compose_running_host_port "$compose_file" postgres 5432)"; then
    export PERISCAN_POSTGRES_PUBLISHED_PORT="$existing_pg"
    echo "[first-hour] this clone's postgres already published on :${existing_pg}"
  else
    export PERISCAN_POSTGRES_PUBLISHED_PORT
    PERISCAN_POSTGRES_PUBLISHED_PORT="$(lab_pick_free_tcp_port "$preferred_pg")"
    if [[ "$PERISCAN_POSTGRES_PUBLISHED_PORT" != "$preferred_pg" ]]; then
      echo "[first-hour] :${preferred_pg} busy — Postgres publish ${PERISCAN_POSTGRES_PUBLISHED_PORT}"
    fi
  fi

  local existing_redis=""
  if existing_redis="$(lab_compose_running_host_port "$compose_file" redis 6379)"; then
    export PERISCAN_REDIS_PUBLISHED_PORT="$existing_redis"
  else
    export PERISCAN_REDIS_PUBLISHED_PORT
    PERISCAN_REDIS_PUBLISHED_PORT="$(lab_pick_free_tcp_port "$preferred_redis" "$PERISCAN_POSTGRES_PUBLISHED_PORT")"
    if [[ "$PERISCAN_REDIS_PUBLISHED_PORT" != "$preferred_redis" ]]; then
      echo "[first-hour] :${preferred_redis} busy — Redis publish ${PERISCAN_REDIS_PUBLISHED_PORT}"
    fi
  fi

  local existing_minio=""
  if existing_minio="$(lab_compose_running_host_port "$compose_file" minio 9000)"; then
    export PERISCAN_MINIO_PUBLISHED_PORT="$existing_minio"
  else
    export PERISCAN_MINIO_PUBLISHED_PORT
    PERISCAN_MINIO_PUBLISHED_PORT="$(lab_pick_free_tcp_port "$preferred_minio" "$PERISCAN_POSTGRES_PUBLISHED_PORT" "$PERISCAN_REDIS_PUBLISHED_PORT")"
    if [[ "$PERISCAN_MINIO_PUBLISHED_PORT" != "$preferred_minio" ]]; then
      echo "[first-hour] :${preferred_minio} busy — MinIO publish ${PERISCAN_MINIO_PUBLISHED_PORT}"
    fi
  fi

  local existing_console=""
  if existing_console="$(lab_compose_running_host_port "$compose_file" minio 9001)"; then
    export PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT="$existing_console"
  else
    export PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT
    PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT="$(lab_pick_free_tcp_port "$preferred_console" "$PERISCAN_POSTGRES_PUBLISHED_PORT" "$PERISCAN_REDIS_PUBLISHED_PORT" "$PERISCAN_MINIO_PUBLISHED_PORT")"
    if [[ "$PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT" != "$preferred_console" ]]; then
      echo "[first-hour] :${preferred_console} busy — MinIO console publish ${PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT}"
    fi
  fi

  export REDIS_URL="redis://127.0.0.1:${PERISCAN_REDIS_PUBLISHED_PORT}"
  export DATABASE_URL="postgresql://periscan:periscan@127.0.0.1:${PERISCAN_POSTGRES_PUBLISHED_PORT}/periscan"
}
