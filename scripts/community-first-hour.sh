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

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PNPM_VERSION="9.15.0"
PGPORT=5434
DATABASE_URL_VALUE="postgresql://periscan:periscan@127.0.0.1:${PGPORT}/periscan"

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

export PERISCAN_POSTGRES_PUBLISHED_PORT="${PGPORT}"
export DATABASE_URL="${DATABASE_URL_VALUE}"

echo "==> docker compose up (infra/docker-compose/docker-compose.yml — Postgres/Redis/MinIO)"
docker compose -f infra/docker-compose/docker-compose.yml up -d --wait

echo "==> prisma generate + migrate deploy"
pnpm --filter @periscan/db db:generate
pnpm --filter @periscan/db db:migrate:deploy

cat <<EOF

Deps and schema are ready. In this (or a new) shell:

  export PERISCAN_POSTGRES_PUBLISHED_PORT=${PGPORT}
  export DATABASE_URL=${DATABASE_URL_VALUE}

Then start the apps — pick one:

  pnpm lab:dev        # API + worker + web; LAB_MODE=1
  pnpm dev:worker     # API + web + worker without lab compose
                      # (plain \`pnpm dev\` has no worker and cannot finish Community runs)

Community pack is the Validate UI after you authorize a verified scope.
pnpm lab:demo-up is hops / range-walk seed — not the Community pack.

Do not treat pnpm seed:demo as measured proof.
Do not run docker compose up at the repo root.
This script does not run pnpm verify or pnpm lab:up.

EOF
