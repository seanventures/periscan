#!/usr/bin/env bash
# Local-lab only: wipe BullMQ validation-missions keys so hop jobs can run.
# Does NOT touch other Redis key prefixes.
#
#   PERISCAN_LAB_DRAIN_QUEUE=1 ./scripts/drain-validation-queue.sh
#   ./scripts/drain-validation-queue.sh --force
set -euo pipefail

if [[ "${PERISCAN_LAB_DRAIN_QUEUE:-0}" != "1" && "${1:-}" != "--force" ]]; then
  cat <<EOF
[drain] refuses without explicit consent.

  Removes Redis keys matching bull:validation-missions* on the lab Redis
  (docker-compose-redis-1 or redis-cli @ REDIS_URL). Stale jobs with missing
  mission context block hop FullyMeasured work.

  Run:
    PERISCAN_LAB_DRAIN_QUEUE=1 $0
    # or
    $0 --force
EOF
  exit 1
fi

REDIS_CLI=(redis-cli)
if ! command -v redis-cli >/dev/null 2>&1; then
  if docker ps --format '{{.Names}}' | grep -q '^docker-compose-redis-1$'; then
    REDIS_CLI=(docker exec docker-compose-redis-1 redis-cli)
  elif docker ps --format '{{.Names}}' | grep -q redis; then
    NAME=$(docker ps --format '{{.Names}}' | grep redis | head -1)
    REDIS_CLI=(docker exec "$NAME" redis-cli)
  else
    echo "[drain] redis-cli not found and no redis container" >&2
    exit 1
  fi
fi

echo "[drain] using: ${REDIS_CLI[*]}"
BEFORE=$("${REDIS_CLI[@]}" --scan --pattern 'bull:validation-missions*' | wc -l | tr -d ' ')
echo "[drain] keys before: ${BEFORE}"

DELETED=$("${REDIS_CLI[@]}" EVAL "
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
" 0)

AFTER=$("${REDIS_CLI[@]}" --scan --pattern 'bull:validation-missions*' | wc -l | tr -d ' ')
echo "[drain] deleted=${DELETED} keys after=${AFTER}"
if [[ "$AFTER" != "0" ]]; then
  echo "[drain] WARN: residual keys remain" >&2
  exit 1
fi
echo "[drain] OK — re-launch hop validates (measure-hops.sh) then start worker"
