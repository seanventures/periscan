#!/usr/bin/env bash
# OpenClaw-style one-paste installer for Periscan Community (PERISCAN-576).
#
# Curl target (this file at repo root):
#   curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
# Safer: download, inspect, then `bash install.sh`.
# Pipe help: curl ... | bash -s -- --help
#
# Reuse, do not fork:
#   scripts/periscan.sh
#   scripts/community-first-hour.sh  (via periscan.sh install)
#   infra/lab/scripts/env.sh         (lab_select_deps_publish_ports, 557 remap)
#
# Local deps file: infra/docker-compose/docker-compose.yml
# Never `docker compose up` at the repo root (compose.yaml is not Community deps).
# Never wipe a neighbor Redis. Never live offensive packs.
set -euo pipefail

CLONE_URL="https://github.com/seanventures/periscan.git"
COMPOSE_FILE="infra/docker-compose/docker-compose.yml"
PNPM_VERSION="9.15.0"
NODE_MAJOR_MIN=24
DOCKER_DESKTOP_URL="https://docs.docker.com/get-docker/"
DEFAULT_HOME="${PERISCAN_HOME:-${HOME}/periscan}"

PERISCAN_SH="scripts/periscan.sh"
FIRST_HOUR="scripts/community-first-hour.sh"
ENV_SH="infra/lab/scripts/env.sh"
DRAIN_SH="infra/lab/scripts/drain-validation-queue.sh"

DRY_RUN=0
CMD=""

usage() {
  cat <<EOF
Usage: bash install.sh [command] [flags]

Commands:
  install   (default) ensure toolchain, clone if needed, install + start + health
  doctor    health checks + repair (compose, migrate, restart, clone-owned drain)
  repair    alias for doctor
  health    check only (no compose/start)
  help      show this help

Flags:
  --dry-run   print the plan; no clone, compose, or start
  --help      show this help

One paste:
  curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
  curl ... | bash -s -- --help
  bash install.sh --dry-run

Already cloned:
  bash scripts/periscan.sh install
  bash scripts/periscan.sh start

Local deps: ${COMPOSE_FILE}
Clone: ${CLONE_URL} (default dest ${DEFAULT_HOME})
Docker: ${DOCKER_DESKTOP_URL}
Authorize a local clone path in the UI — not github.com/org/repo.
EOF
}

fail() {
  echo "error: $*" >&2
  exit 1
}

is_dry_run() {
  [[ "$DRY_RUN" == "1" || "${PERISCAN_INSTALL_DRY_RUN:-}" == "1" || "${PERISCAN_PERISCAN_SH_DRY_RUN:-}" == "1" || "${PERISCAN_FIRST_HOUR_DRY_RUN:-}" == "1" ]]
}

export_dry_run() {
  if is_dry_run; then
    export PERISCAN_INSTALL_DRY_RUN=1
    export PERISCAN_PERISCAN_SH_DRY_RUN=1
    export PERISCAN_FIRST_HOUR_DRY_RUN=1
    export PERISCAN_LAB_DEV_DRY_RUN=1
  fi
}

is_checkout() {
  local dir="${1:-}"
  [[ -n "$dir" && -f "${dir}/${PERISCAN_SH}" && -f "${dir}/${COMPOSE_FILE}" && -f "${dir}/package.json" ]]
}

self_dir() {
  local src="${BASH_SOURCE[0]:-}"
  if [[ -n "$src" && "$src" != "bash" && -f "$src" ]]; then
    (cd "$(dirname "$src")" && pwd)
  fi
}

find_checkout() {
  local dir=""
  dir="$(self_dir || true)"
  if is_checkout "$dir"; then
    echo "$dir"
    return 0
  fi
  if is_checkout "$PWD"; then
    echo "$PWD"
    return 0
  fi
  if is_checkout "$DEFAULT_HOME"; then
    echo "$DEFAULT_HOME"
    return 0
  fi
  return 1
}

detect_os() {
  local os
  os="$(uname -s 2>/dev/null || echo unknown)"
  echo "os: ${os}"
  case "$os" in
    Darwin|Linux) ;;
    MINGW*|MSYS*|CYGWIN*)
      fail "Windows is not a direct install target. Use WSL2, then rerun."
      ;;
    *)
      if is_dry_run; then
        echo "plan: unsupported OS ${os} (would exit 1)"
      else
        fail "Unsupported OS: ${os}. Community install supports macOS and Linux."
      fi
      ;;
  esac
}

node_major() {
  node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo "0"
}

ensure_git() {
  if command -v git >/dev/null 2>&1; then
    echo "check: git $(git --version | awk '{print $3; exit}')"
    return 0
  fi
  echo "check: git MISSING"
  if is_dry_run; then
    echo "plan: install git"
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    echo "==> brew install git"
    brew install git
    return 0
  fi
  fail "git is required. Install: xcode-select --install   # or: brew install git"
}

ensure_node() {
  local major="0"
  if command -v node >/dev/null 2>&1; then
    major="$(node_major)"
    if [[ "$major" -ge "$NODE_MAJOR_MIN" ]]; then
      echo "check: node $(node -v) (major>=${NODE_MAJOR_MIN})"
      return 0
    fi
    echo "check: node $(node -v) NEED>=${NODE_MAJOR_MIN}"
  else
    echo "check: node MISSING (need major>=${NODE_MAJOR_MIN})"
  fi
  if is_dry_run; then
    echo "plan: install Node ${NODE_MAJOR_MIN} (see .nvmrc)"
    return 0
  fi
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR}/nvm.sh"
    nvm install "$NODE_MAJOR_MIN"
    nvm use "$NODE_MAJOR_MIN"
  elif command -v fnm >/dev/null 2>&1; then
    fnm install "$NODE_MAJOR_MIN"
    fnm use "$NODE_MAJOR_MIN"
  elif [[ "$(uname -s)" == "Darwin" ]] && command -v brew >/dev/null 2>&1; then
    echo "==> brew install node@${NODE_MAJOR_MIN}"
    brew install "node@${NODE_MAJOR_MIN}" || brew install node
  else
    fail "Node ${NODE_MAJOR_MIN} is required (see .nvmrc). Install from https://nodejs.org"
  fi
  major="$(node_major)"
  if [[ "$major" -lt "$NODE_MAJOR_MIN" ]]; then
    fail "Node ${NODE_MAJOR_MIN} is required. This shell has $(node -v 2>/dev/null || echo missing)."
  fi
  echo "check: node $(node -v) (major>=${NODE_MAJOR_MIN})"
}

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "check: pnpm $(pnpm -v 2>/dev/null || echo ok)"
    return 0
  fi
  if command -v corepack >/dev/null 2>&1; then
    echo "check: pnpm via corepack (not on PATH yet)"
    if is_dry_run; then
      echo "plan: corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate"
      return 0
    fi
    echo "==> enabling Corepack / pnpm@${PNPM_VERSION}"
    corepack enable
    corepack prepare "pnpm@${PNPM_VERSION}" --activate
    echo "check: pnpm $(pnpm -v 2>/dev/null || echo ok)"
    return 0
  fi
  echo "check: pnpm MISSING"
  if is_dry_run; then
    echo "plan: enable Corepack after Node ${NODE_MAJOR_MIN} is installed"
    return 0
  fi
  fail "pnpm ${PNPM_VERSION} is required. Enable Corepack: corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate"
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    echo "check: docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo present)"
    if docker compose version >/dev/null 2>&1; then
      echo "check: compose plugin $(docker compose version --short 2>/dev/null || echo ok)"
      return 0
    fi
    echo "check: compose plugin MISSING"
    if is_dry_run; then
      echo "plan: install Docker Desktop (compose plugin) ${DOCKER_DESKTOP_URL}"
      return 0
    fi
    fail "docker compose plugin is missing. This script uses 'docker compose', not root compose.yaml. Install Docker Desktop: ${DOCKER_DESKTOP_URL}"
  fi
  echo "check: docker MISSING"
  echo "check: compose plugin MISSING"
  if is_dry_run; then
    echo "plan: install Docker Desktop ${DOCKER_DESKTOP_URL}"
    return 0
  fi
  fail "Docker is missing. Install Docker Desktop: ${DOCKER_DESKTOP_URL}"
}

ensure_checkout() {
  local found=""
  if found="$(find_checkout)"; then
    ROOT="$found"
    echo "checkout: $ROOT"
    return 0
  fi
  echo "clone URL: ${CLONE_URL}"
  if is_dry_run; then
    echo "plan: git clone ${CLONE_URL} ${DEFAULT_HOME}"
    ROOT="$DEFAULT_HOME"
    return 0
  fi
  ensure_git
  if [[ -e "$DEFAULT_HOME" ]]; then
    fail "${DEFAULT_HOME} exists but is not a Periscan checkout. Set PERISCAN_HOME or run from a clone."
  fi
  echo "==> git clone ${CLONE_URL} ${DEFAULT_HOME}"
  git clone "$CLONE_URL" "$DEFAULT_HOME"
  ROOT="$DEFAULT_HOME"
  if ! is_checkout "$ROOT"; then
    fail "clone at ${ROOT} is missing ${PERISCAN_SH} or ${COMPOSE_FILE}"
  fi
}

STATE_ENV_REL=".periscan/community.env"

load_clone_state() {
  local state="${ROOT:-}/${STATE_ENV_REL}"
  if [[ -z "${ROOT:-}" || ! -f "$state" ]]; then
    return 0
  fi
  set -a
  # shellcheck disable=SC1090
  source "$state"
  set +a
}

clone_has_saved_listen_ports() {
  [[ -n "${ROOT:-}" && -f "${ROOT}/${STATE_ENV_REL}" && -n "${PERISCAN_API_PORT:-}" ]]
}

api_health_url() {
  echo "${PERISCAN_API_URL:-http://127.0.0.1:${PERISCAN_API_PORT:-3001}}/api/v1/health"
}

api_ok() {
  local url
  url="$(api_health_url)"
  curl -fsS -m 2 "$url" >/dev/null 2>&1
}

clone_owns_listen_port() {
  local port="${1:-}" pid cwd
  if [[ -z "$port" || -z "${ROOT:-}" ]]; then
    return 1
  fi
  if ! command -v lsof >/dev/null 2>&1; then
    return 1
  fi
  while read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | awk '/^n/ { print substr($0, 2); exit }' || true)"
    if [[ -n "$cwd" && "$cwd" == "$ROOT"* ]]; then
      return 0
    fi
  done < <(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null || true)
  return 1
}

# Keep this clone's already-chosen API/web. Remap only when starting fresh
# and a foreign process owns the default (or the saved port).
keep_this_clone_listen_ports() {
  if ! clone_has_saved_listen_ports; then
    return 1
  fi
  if [[ "${CMD:-}" == "health" ]] || is_dry_run; then
    return 0
  fi
  if api_ok; then
    return 0
  fi
  if declare -F lab_tcp_listen_in_use >/dev/null 2>&1 && ! lab_tcp_listen_in_use "${PERISCAN_API_PORT}"; then
    return 0
  fi
  if clone_owns_listen_port "${PERISCAN_API_PORT}"; then
    return 0
  fi
  return 1
}

restore_clone_listen_ports() {
  local api="${1:-}" web="${2:-}" api_url="${3:-}" web_url="${4:-}"
  local db="${5:-}" db_port="${6:-}" redis="${7:-}" redis_port="${8:-}"
  if [[ -n "$api" ]]; then
    export PERISCAN_API_PORT="$api"
    export PERISCAN_API_URL="${api_url:-http://127.0.0.1:${api}}"
  fi
  if [[ -n "$web" ]]; then
    export PERISCAN_WEB_PORT="$web"
    export PERISCAN_WEB_URL="${web_url:-http://127.0.0.1:${web}}"
  fi
  if [[ -n "$db" ]]; then
    export DATABASE_URL="$db"
  fi
  if [[ -n "$db_port" ]]; then
    export PERISCAN_POSTGRES_PUBLISHED_PORT="$db_port"
  fi
  if [[ -n "$redis" ]]; then
    export REDIS_URL="$redis"
  fi
  if [[ -n "$redis_port" ]]; then
    export PERISCAN_REDIS_PUBLISHED_PORT="$redis_port"
  fi
}

load_lab_env() {
  if [[ -z "${ROOT:-}" || ! -f "${ROOT}/${ENV_SH}" ]]; then
    return 0
  fi
  cd "$ROOT"
  # shellcheck source=infra/lab/scripts/env.sh
  source "${ROOT}/${ENV_SH}"
  load_clone_state
  local saved_api="${PERISCAN_API_PORT:-}"
  local saved_web="${PERISCAN_WEB_PORT:-}"
  local saved_api_url="${PERISCAN_API_URL:-}"
  local saved_web_url="${PERISCAN_WEB_URL:-}"
  local saved_db="${DATABASE_URL:-}"
  local saved_db_port="${PERISCAN_POSTGRES_PUBLISHED_PORT:-}"
  local saved_redis="${REDIS_URL:-}"
  local saved_redis_port="${PERISCAN_REDIS_PUBLISHED_PORT:-}"
  local keep=0
  if keep_this_clone_listen_ports; then
    keep=1
  fi
  if [[ "$keep" == "1" ]]; then
    if [[ -z "$saved_db_port" || -z "$saved_db" ]] && [[ -f "${ROOT}/${COMPOSE_FILE}" ]]; then
      lab_select_deps_publish_ports "$COMPOSE_FILE"
    fi
    lab_env_defaults
    restore_clone_listen_ports \
      "$saved_api" "$saved_web" "$saved_api_url" "$saved_web_url" \
      "$saved_db" "$saved_db_port" "$saved_redis" "$saved_redis_port"
    return 0
  fi
  if [[ -f "${ROOT}/${COMPOSE_FILE}" ]]; then
    lab_select_deps_publish_ports "$COMPOSE_FILE"
    lab_env_defaults
    restore_clone_listen_ports "" "" "" "" \
      "$saved_db" "$saved_db_port" "$saved_redis" "$saved_redis_port"
    lab_remap_dev_listen_ports
  fi
}

check_compose_file() {
  echo "check: compose file ${COMPOSE_FILE} (never root compose.yaml)"
  if [[ -n "${ROOT:-}" && -f "${ROOT}/${COMPOSE_FILE}" ]]; then
    echo "check: compose file present at ${ROOT}/${COMPOSE_FILE}"
  elif is_dry_run; then
    echo "check: compose file will exist after clone of ${CLONE_URL}"
  else
    fail "missing ${COMPOSE_FILE} under ${ROOT:-unknown}"
  fi
}

wait_api() {
  local tries="${1:-45}" i url
  url="$(api_health_url)"
  for i in $(seq 1 "$tries"); do
    if curl -fsS -m 2 "$url" >/dev/null 2>&1; then
      echo "API health ok ($url)"
      return 0
    fi
    sleep 1
  done
  echo "API health not ok after ${tries}s ($url)" >&2
  return 1
}

print_report() {
  local node_v="missing" docker_v="missing" db_port api_url web_url health="down"
  if command -v node >/dev/null 2>&1; then
    node_v="$(node -v)"
  fi
  if command -v docker >/dev/null 2>&1; then
    docker_v="ok"
  fi
  db_port="${PERISCAN_POSTGRES_PUBLISHED_PORT:-unknown}"
  api_url="${PERISCAN_API_URL:-http://127.0.0.1:${PERISCAN_API_PORT:-3001}}"
  web_url="${PERISCAN_WEB_URL:-http://127.0.0.1:${PERISCAN_WEB_PORT:-3000}}"
  if is_dry_run; then
    health="dry-run"
  elif api_ok; then
    health="ok"
  fi
  echo "node: ${node_v}"
  echo "docker: ${docker_v}"
  echo "DATABASE_URL port: ${db_port}"
  echo "API: ${api_url} health=${health}"
  echo "web: ${web_url}"
}

start_apps() {
  if is_dry_run; then
    echo "plan: bash ${PERISCAN_SH} start"
    return 0
  fi
  mkdir -p "${ROOT}/.periscan"
  echo "==> bash ${PERISCAN_SH} start (background; logs ${ROOT}/.periscan/lab-dev.log)"
  # periscan.sh start execs lab:dev; keep this process free for health.
  bash "${ROOT}/${PERISCAN_SH}" start >>"${ROOT}/.periscan/lab-dev.log" 2>&1 &
}

run_periscan_install() {
  if is_dry_run; then
    echo "plan: bash ${PERISCAN_SH} install  # reuses ${FIRST_HOUR}"
    echo "plan: compose file ${COMPOSE_FILE}"
    return 0
  fi
  echo "==> bash ${PERISCAN_SH} install"
  bash "${ROOT}/${PERISCAN_SH}" install
}

redis_publish_port() {
  if declare -F lab_compose_running_host_port >/dev/null 2>&1; then
    lab_compose_running_host_port "$COMPOSE_FILE" redis 6379 || true
  fi
}

redis_url_port() {
  local url="${REDIS_URL:-}"
  url="${url##*:}"
  url="${url%%/*}"
  echo "$url"
}

maybe_drain_queue() {
  local published url_port
  echo "drain: never wipe neighbor Redis; only this clone's published port"
  if is_dry_run; then
    echo "plan: drain bull:validation-missions* only if REDIS_URL is this clone's published port"
    echo "plan: skip ${DRAIN_SH} when workspace :6379 is not this compose publish"
    return 0
  fi
  published="$(redis_publish_port)"
  url_port="$(redis_url_port)"
  if [[ -z "${published:-}" ]]; then
    echo "drain skipped: this clone's redis is not published (not running ${DRAIN_SH})"
    return 0
  fi
  if [[ -z "${url_port:-}" || "$url_port" != "$published" ]]; then
    echo "drain skipped: REDIS_URL port ${url_port:-none} is not this clone's :${published}"
    return 0
  fi
  echo "==> drain this clone redis :${published} keys bull:validation-missions* (not ${DRAIN_SH} default :6379)"
  if ! docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli EVAL "
local cursor = '0'
local deleted = 0
repeat
  local result = redis.call('SCAN', cursor, 'MATCH', 'bull:validation-missions*', 'COUNT', 500)
  cursor = result[1]
  local keys = result[2]
  if #keys > 0 then
    deleted = deleted + redis.call('DEL', unpack(keys))
  end
until cursor == '0'
return deleted
" 0; then
    echo "drain skipped: compose exec redis failed for this clone"
  fi
}

cmd_install() {
  export_dry_run
  detect_os
  echo "clone URL: ${CLONE_URL}"
  echo "compose file: ${COMPOSE_FILE}"
  ensure_git
  ensure_node
  ensure_docker
  ensure_pnpm
  ensure_checkout
  check_compose_file
  load_lab_env
  if is_dry_run; then
    echo "plan: bash ${PERISCAN_SH} install  # reuses ${FIRST_HOUR}"
    echo "plan: bash ${PERISCAN_SH} start"
    echo "plan: health $(api_health_url)"
    print_report
    return 0
  fi
  run_periscan_install
  load_lab_env
  if ! api_ok; then
    start_apps
    wait_api 45 || true
  fi
  print_report
  if ! api_ok; then
    fail "API health not ok. Run: bash install.sh doctor"
  fi
}

cmd_doctor() {
  export_dry_run
  detect_os
  echo "clone URL: ${CLONE_URL}"
  echo "compose file: ${COMPOSE_FILE}"
  ensure_git
  ensure_node
  ensure_docker
  ensure_pnpm
  ensure_checkout
  check_compose_file
  load_lab_env
  if is_dry_run; then
    echo "plan: repair via bash ${PERISCAN_SH} install (compose ${COMPOSE_FILE}, ${FIRST_HOUR})"
    echo "plan: use ${STATE_ENV_REL} API/web/DATABASE_URL if already chosen; remap busy defaults only when starting fresh (foreign process, do not kill other apps)"
    echo "plan: restart ${PERISCAN_SH} start if API health not ok"
    maybe_drain_queue
    print_report
    return 0
  fi
  run_periscan_install
  load_lab_env
  if ! api_ok; then
    start_apps
    wait_api 45 || true
  fi
  maybe_drain_queue
  print_report
}

cmd_health() {
  export_dry_run
  detect_os
  ensure_git
  ensure_node
  ensure_docker
  ensure_pnpm
  if found="$(find_checkout)"; then
    ROOT="$found"
    echo "checkout: $ROOT"
  else
    echo "checkout: none"
  fi
  check_compose_file
  load_lab_env
  if is_dry_run; then
    echo "plan: health only (no compose/start)"
    print_report
    return 0
  fi
  print_report
  if ! api_ok; then
    exit 1
  fi
}

parse_args() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --) ;;
      --dry-run)
        DRY_RUN=1
        ;;
      --help|-h)
        CMD="help"
        ;;
      help|doctor|health|install|repair)
        if [[ -n "$CMD" && "$CMD" != "help" && "$CMD" != "$arg" ]]; then
          fail "unknown extra command: ${arg} (already ${CMD})"
        fi
        if [[ "$CMD" != "help" ]]; then
          CMD="$arg"
        fi
        ;;
      --*)
        echo "error: unknown flag: ${arg}" >&2
        usage >&2
        exit 1
        ;;
      *)
        echo "error: unknown command: ${arg}" >&2
        usage >&2
        exit 1
        ;;
    esac
  done
  CMD="${CMD:-install}"
  if [[ "$CMD" == "repair" ]]; then
    CMD="doctor"
  fi
}

parse_args "$@"
case "$CMD" in
  help) usage ;;
  install) cmd_install ;;
  doctor) cmd_doctor ;;
  health) cmd_health ;;
  *)
    echo "error: unknown command: ${CMD}" >&2
    usage >&2
    exit 1
    ;;
esac
