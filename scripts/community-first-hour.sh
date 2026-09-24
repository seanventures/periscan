#!/usr/bin/env bash
# Community first-hour for a stranger clone: toolchain + local deps + migrate.
#
# This is NOT:
#   - pnpm verify          (too heavy for first hour)
#   - pnpm seed:demo       (fixture tenant, not measured proof)
#   - pnpm lab:up          (physical lab compose; too slow for this script)
#
# Usage: bash scripts/community-first-hour.sh
# Requires: Node (see .nvmrc), Corepack, Docker with the compose plugin.
# Do not `docker compose up` at the repo root — that file is production.
#
# Postgres/Redis/MinIO publish ports honor PERISCAN_*_PUBLISHED_PORT, then the
# next free port. A neighbor bind on :5434 is never treated as this clone.
# PERISCAN_FIRST_HOUR_DRY_RUN=1 prints chosen ports and exits before compose.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PNPM_VERSION="9.15.0"
COMPOSE_FILE="infra/docker-compose/docker-compose.yml"

# shellcheck source=../infra/lab/scripts/env.sh
source "${ROOT_DIR}/infra/lab/scripts/env.sh"

fail() {
  echo "error: $*" >&2
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  fail "Docker is missing. Install Docker Desktop (or Engine + compose plugin) and retry."
fi

if ! docker compose version >/dev/null 2>&1; then
  fail "docker compose plugin is missing. This script uses 'docker compose', not root compose.yaml."
fi

ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    return 0
  fi
  if ! command -v corepack >/dev/null 2>&1; then
    fail "pnpm and corepack are missing. Install Node 24 (see .nvmrc) so Corepack can provide pnpm@${PNPM_VERSION}."
  fi
  echo "==> enabling Corepack / pnpm@${PNPM_VERSION}"
  corepack enable
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
}

lab_select_deps_publish_ports "$COMPOSE_FILE"

if [[ "${PERISCAN_FIRST_HOUR_DRY_RUN:-}" == "1" ]]; then
  echo "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-periscan-deps}"
  echo "PERISCAN_POSTGRES_PUBLISHED_PORT=${PERISCAN_POSTGRES_PUBLISHED_PORT}"
  echo "PERISCAN_REDIS_PUBLISHED_PORT=${PERISCAN_REDIS_PUBLISHED_PORT}"
  echo "PERISCAN_MINIO_PUBLISHED_PORT=${PERISCAN_MINIO_PUBLISHED_PORT}"
  echo "PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT=${PERISCAN_MINIO_CONSOLE_PUBLISHED_PORT}"
  echo "DATABASE_URL=${DATABASE_URL}"
  echo "REDIS_URL=${REDIS_URL}"
  echo "COMPOSE=up"
  exit 0
fi

ensure_pnpm

if [[ -d "${ROOT_DIR}/node_modules" ]]; then
  echo "==> node_modules present — skipping pnpm install"
else
  if command -v corepack >/dev/null 2>&1; then
    echo "==> Corepack pnpm@${PNPM_VERSION}"
    corepack enable
    corepack prepare "pnpm@${PNPM_VERSION}" --activate
  fi
  echo "==> pnpm install"
  pnpm install
fi

echo "==> docker compose up (${COMPOSE_FILE} — Postgres/Redis/MinIO)"
echo "    Postgres :${PERISCAN_POSTGRES_PUBLISHED_PORT}  Redis :${PERISCAN_REDIS_PUBLISHED_PORT}"
docker compose -f "$COMPOSE_FILE" up -d --wait

echo "==> prisma generate + migrate deploy"
pnpm --filter @periscan/db db:generate
pnpm --filter @periscan/db db:migrate:deploy

cat <<EOF

Deps and schema are ready. In this (or a new) shell:

  export PERISCAN_POSTGRES_PUBLISHED_PORT=${PERISCAN_POSTGRES_PUBLISHED_PORT}
  export DATABASE_URL=${DATABASE_URL}
  export REDIS_URL=${REDIS_URL}

If the worker logs "missing mission context", stale BullMQ jobs are in Redis:

  bash infra/lab/scripts/drain-validation-queue.sh --force

Then start the apps — pick one:

  pnpm lab:dev        # API + worker + web; LAB_MODE=1; remaps :3001/:3000 if busy
  pnpm dev:worker     # API + web + worker without lab compose
                      # (plain \`pnpm dev\` has no worker and cannot finish Community runs)

Then in another terminal, operator TUI against PERISCAN_API_URL (lab:dev prints it):

  export PERISCAN_API_URL=http://127.0.0.1:3001
  pnpm tui

Community pack is the Validate UI after you authorize a verified scope.
pnpm lab:demo-up is hops / range-walk seed — not the Community pack.

Do not treat pnpm seed:demo as measured proof.
Do not run docker compose up at the repo root.
This script does not run pnpm verify or pnpm lab:up.

EOF
