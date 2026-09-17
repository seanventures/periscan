#!/usr/bin/env bash
# Community install + update for a stranger clone of seanventures/periscan.
#
# Reuses scripts/community-first-hour.sh, infra/lab/scripts/env.sh
# (lab_select_deps_publish_ports), and infra/lab/scripts/control-plane-dev.sh
# (pnpm lab:dev, PERISCAN-557 API remap). Does not fork those paths.
#
# Local compose only: infra/docker-compose/docker-compose.yml
# Never `docker compose up` at the repo root. Local deps are this compose file.
# Stop deps with `compose stop` only — do not wipe volumes. Neighbor :5434 is never this clone.
#
# PERISCAN_PERISCAN_SH_DRY_RUN=1 or PERISCAN_FIRST_HOUR_DRY_RUN=1 prints
# ports and exits 0 without compose or lab:dev.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=../infra/lab/scripts/env.sh
source "${ROOT_DIR}/infra/lab/scripts/env.sh"

PNPM_VERSION="9.15.0"
COMPOSE_FILE="infra/docker-compose/docker-compose.yml"
FIRST_HOUR="${ROOT_DIR}/scripts/community-first-hour.sh"
CONTROL_PLANE_DEV="${ROOT_DIR}/infra/lab/scripts/control-plane-dev.sh"
STATE_DIR="${ROOT_DIR}/.periscan"
PIDFILE="${STATE_DIR}/lab-dev.pid"
STATE_ENV="${STATE_DIR}/community.env"

is_dry_run() {
  [[ "${PERISCAN_PERISCAN_SH_DRY_RUN:-}" == "1" || "${PERISCAN_FIRST_HOUR_DRY_RUN:-}" == "1" ]]
}

fail() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: bash scripts/periscan.sh <command>

Commands:
  install   Node/pnpm/docker checks, compose deps, migrate
  start     pnpm lab:dev (API+worker+web); print URLs/ports
  status    health of API if up; print chosen ports
  update    git pull (if git), pnpm install, migrate; print restart with start
  down      stop lab:dev children if tracked; compose stop deps
  help      show this help

Requires Node 24 (see .nvmrc), pnpm 9.15.0 (Corepack), and Docker.
Local deps file: infra/docker-compose/docker-compose.yml
Do not docker compose up at the repo root.
EOF
}

require_node() {
  if ! command -v node >/dev/null 2>&1; then
    fail "Node 24 is required (see .nvmrc). Install from https://nodejs.org or: nvm install 24"
  fi
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if (( major < 24 )); then
    fail "Node 24 is required (see .nvmrc). This shell has $(node -v). nvm install 24 && nvm use"
  fi
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    fail "Docker is missing. Install Docker Desktop (or Engine + compose plugin) and retry."
  fi
  if ! docker compose version >/dev/null 2>&1; then
    fail "docker compose plugin is missing. This script uses 'docker compose', not root compose.yaml."
  fi
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  if ! command -v corepack >/dev/null 2>&1; then
    fail "pnpm 9.15.0 is required. Enable Corepack: corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate"
  fi
  echo "==> enabling Corepack / pnpm@${PNPM_VERSION}"
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
}

write_state() {
  mkdir -p "$STATE_DIR"
  cat > "$STATE_ENV" <<EOF
PERISCAN_POSTGRES_PUBLISHED_PORT=${PERISCAN_POSTGRES_PUBLISHED_PORT:-}
PERISCAN_REDIS_PUBLISHED_PORT=${PERISCAN_REDIS_PUBLISHED_PORT:-}
PERISCAN_MINIO_PUBLISHED_PORT=${PERISCAN_MINIO_PUBLISHED_PORT:-}
PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT=${PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT:-}
DATABASE_URL=${DATABASE_URL:-}
REDIS_URL=${REDIS_URL:-}
PERISCAN_API_PORT=${PERISCAN_API_PORT:-3001}
PERISCAN_WEB_PORT=${PERISCAN_WEB_PORT:-3000}
PERISCAN_API_URL=${PERISCAN_API_URL:-http://127.0.0.1:${PERISCAN_API_PORT:-3001}}
PERISCAN_WEB_URL=${PERISCAN_WEB_URL:-http://127.0.0.1:${PERISCAN_WEB_PORT:-3000}}
EOF
}

load_state() {
  if [[ -f "$STATE_ENV" ]]; then
    # shellcheck disable=SC1090
    set -a
    # shellcheck disable=SC1091
    source "$STATE_ENV"
    set +a
  fi
}

print_ports() {
  echo "PERISCAN_POSTGRES_PUBLISHED_PORT=${PERISCAN_POSTGRES_PUBLISHED_PORT:-}"
  echo "PERISCAN_REDIS_PUBLISHED_PORT=${PERISCAN_REDIS_PUBLISHED_PORT:-}"
  echo "PERISCAN_API_PORT=${PERISCAN_API_PORT:-}"
  echo "PERISCAN_WEB_PORT=${PERISCAN_WEB_PORT:-}"
  echo "PERISCAN_API_URL=${PERISCAN_API_URL:-}"
  echo "PERISCAN_WEB_URL=${PERISCAN_WEB_URL:-}"
  echo "DATABASE_URL=${DATABASE_URL:-}"
  echo "REDIS_URL=${REDIS_URL:-}"
}

print_first_hour_next() {
  echo "Next: open the printed URL, create an account, git clone YOUR repo, paste the absolute path (not github.com/org/repo). First hour runs Gitleaks. Fixed only after a retest."
}

export_selected_deps() {
  export PERISCAN_POSTGRES_PUBLISHED_PORT PERISCAN_REDIS_PUBLISHED_PORT
  export PERISCAN_MINIO_PUBLISHED_PORT PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT
  export DATABASE_URL REDIS_URL
}

clone_owns_pid() {
  local pid="$1"
  local cwd=""
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/ { print substr($0, 2); exit }' || true)"
  [[ -n "$cwd" && "$cwd" == "$ROOT_DIR"* ]]
}

maybe_git_pull() {
  if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "not a git clone; skipping git pull"
    return 0
  fi
  if ! git symbolic-ref -q HEAD >/dev/null; then
    echo "not a git clone on a branch (detached HEAD); skipping git pull"
    return 0
  fi
  echo "==> git pull"
  git pull --ff-only
}

cmd_install() {
  require_node
  require_docker
  if is_dry_run; then
    export PERISCAN_FIRST_HOUR_DRY_RUN=1
  fi
  bash "$FIRST_HOUR"
  if ! is_dry_run; then
    lab_select_deps_publish_ports "$COMPOSE_FILE"
    export_selected_deps
    lab_env_defaults
    write_state
  fi
  echo "Next: bash scripts/periscan.sh start"
}

cmd_start() {
  require_node
  lab_select_deps_publish_ports "$COMPOSE_FILE"
  export_selected_deps
  lab_env_defaults
  lab_remap_dev_listen_ports
  export PERISCAN_API_PORT PERISCAN_WEB_PORT PERISCAN_API_URL PERISCAN_WEB_URL
  if is_dry_run; then
    echo "COMPOSE=up"
    echo "DATABASE_URL=${DATABASE_URL}"
    export PERISCAN_LAB_DEV_DRY_RUN=1
    bash "$CONTROL_PLANE_DEV"
    print_ports
    print_first_hour_next
    return 0
  fi
  ensure_pnpm
  mkdir -p "$STATE_DIR"
  write_state
  echo $$ > "$PIDFILE"
  echo "==> pnpm lab:dev (API + worker + web)"
  print_first_hour_next
  exec bash "$CONTROL_PLANE_DEV"
}

cmd_status() {
  load_state
  if [[ -z "${PERISCAN_POSTGRES_PUBLISHED_PORT:-}" || -z "${DATABASE_URL:-}" ]]; then
    lab_select_deps_publish_ports "$COMPOSE_FILE"
    export_selected_deps
  fi
  if [[ -z "${PERISCAN_API_URL:-}" ]]; then
    lab_env_defaults
    lab_remap_dev_listen_ports
  fi
  print_ports
  local health="${PERISCAN_API_URL%/}/api/v1/health"
  echo "HEALTH_URL=${health}"
  if curl -fsS -m 2 "$health" >/dev/null 2>&1; then
    echo "API=up"
  else
    echo "API=down"
  fi
  if [[ -f "$PIDFILE" ]]; then
    local pid
    pid="$(cat "$PIDFILE")"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null && clone_owns_pid "$pid"; then
      echo "LAB_DEV_PID=${pid}"
    else
      echo "LAB_DEV=not-tracked"
    fi
  else
    echo "LAB_DEV=not-tracked"
  fi
}

cmd_update() {
  require_node
  require_docker
  lab_select_deps_publish_ports "$COMPOSE_FILE"
  export_selected_deps
  if is_dry_run; then
    echo "DATABASE_URL=${DATABASE_URL}"
    echo "COMPOSE=up"
    echo "restart with start"
    return 0
  fi
  maybe_git_pull
  ensure_pnpm
  echo "==> pnpm install"
  pnpm install
  echo "==> docker compose up (${COMPOSE_FILE})"
  docker compose -f "$COMPOSE_FILE" up -d --wait
  echo "==> prisma generate + migrate deploy"
  pnpm --filter @periscan/db db:generate
  pnpm --filter @periscan/db db:migrate:deploy
  lab_env_defaults
  write_state
  echo "restart with start: bash scripts/periscan.sh start"
}

cmd_down() {
  if is_dry_run; then
    load_state
    echo "DRY_RUN=1 would stop tracked lab:dev and compose stop ${COMPOSE_FILE}"
    print_ports
    return 0
  fi
  if [[ -f "$PIDFILE" ]]; then
    local pid
    pid="$(cat "$PIDFILE")"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      if clone_owns_pid "$pid"; then
        echo "==> stopping lab:dev pid ${pid}"
        kill "$pid" 2>/dev/null || true
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
          kill -9 "$pid" 2>/dev/null || true
        fi
        pkill -P "$pid" 2>/dev/null || true
      else
        echo "tracked pid ${pid} is not this clone; not killing"
      fi
    fi
    rm -f "$PIDFILE"
  else
    echo "lab:dev not tracked (no ${PIDFILE})"
  fi
  require_docker
  echo "==> docker compose stop (${COMPOSE_FILE})"
  docker compose -f "$COMPOSE_FILE" stop
  echo "stopped. start again with: bash scripts/periscan.sh start"
}

cmd="${1:-help}"
case "$cmd" in
  install) cmd_install ;;
  start) cmd_start ;;
  status) cmd_status ;;
  update) cmd_update ;;
  down) cmd_down ;;
  help|-h|--help) usage ;;
  *)
    echo "error: unknown command: ${cmd}" >&2
    usage >&2
    exit 1
    ;;
esac
