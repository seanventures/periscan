#!/usr/bin/env bash
# Bring up Community api+web+worker against this clone's dependency project.
# Do not run a bare `docker compose up` at the repo root; use the local deps file.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
# shellcheck source=../infra/lab/scripts/env.sh
source "${ROOT_DIR}/infra/lab/scripts/env.sh"

DEPS_FILE="$(lab_community_deps_compose_file "$ROOT_DIR")"
export PERISCAN_DEPS_COMPOSE_FILE="$DEPS_FILE"
OVERLAY_FILE="infra/docker-compose/docker-compose.community.yml"
lab_select_deps_publish_ports "$DEPS_FILE"
PGPORT="$PERISCAN_POSTGRES_PUBLISHED_PORT"
API_PORT="${PERISCAN_API_PUBLISHED_PORT:-3001}"
WEB_PORT="${PERISCAN_WEB_PUBLISHED_PORT:-3000}"

echo "==> community overlay"
echo "    $DEPS_FILE + $OVERLAY_FILE"
docker compose -f "$DEPS_FILE" -f "$OVERLAY_FILE" up -d --build --wait

cat <<EOF

Community stack is up.

  Web  http://127.0.0.1:${WEB_PORT}
  API  http://127.0.0.1:${API_PORT}
  Health  http://127.0.0.1:${API_PORT}/api/v1/health

Host DATABASE_URL (deps published port):
  postgresql://periscan:periscan@127.0.0.1:${PGPORT}/periscan

In-network DATABASE_URL (containers):
  postgresql://periscan:periscan@postgres:5432/periscan

Worker image is scan-executor runtime (Gitleaks, Nuclei, Trivy, OSV-Scanner).
Not the GPL legal-review stage. Missing runner-agent still means nmap/syft
are tool_unavailable.

PERISCAN_DEV_MODE=true is local-only. Production forbids it.

Faster host-toolchain path (no image build): pnpm lab:dev after deps-only:
  docker compose -f ${DEPS_FILE} up -d --wait

Stop:
  docker compose -f ${DEPS_FILE} -f ${OVERLAY_FILE} down
EOF
