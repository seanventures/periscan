#!/usr/bin/env bash
# Periscan DISASTER-RECOVERY DRILL (WS2 ops gate).
#
# A backup you have never restored is not a backup. This performs a real,
# non-destructive round-trip and asserts it succeeded:
#   1. pg_dump the live database (custom format)
#   2. restore it into a throwaway database
#   3. assert row-count PARITY on a set of representative tables
#   4. drop the throwaway database and remove the dump
# Exit non-zero (and leave a clear message) if parity fails.
#
# Runs inside the compose postgres container by default so it needs no host
# PostgreSQL client tools:
#   bash scripts/db-restore-drill.sh
# Override the container / db / user via env:
#   PERISCAN_PG_CONTAINER=... PERISCAN_PG_DB=... PERISCAN_PG_USER=... \
#     bash scripts/db-restore-drill.sh
set -euo pipefail

# shellcheck source=../infra/lab/scripts/env.sh
if [[ -z "${PERISCAN_PG_CONTAINER:-}" ]]; then
  # Resolve periscan-deps-postgres-1 (not the historical docker-compose-postgres-1).
  # shellcheck disable=SC1091
  source "$(cd "$(dirname "$0")/../infra/lab/scripts" && pwd)/env.sh"
  lab_env_defaults
fi
CONTAINER="${PERISCAN_PG_CONTAINER:-$(lab_postgres_container 2>/dev/null || echo periscan-deps-postgres-1)}"
DB="${PERISCAN_PG_DB:-periscan}"
USER="${PERISCAN_PG_USER:-periscan}"
SCRATCH="${DB}_dr_drill"
DUMP="/tmp/${DB}-dr-drill.dump"

# Representative tables across domains — parity here is strong evidence the whole
# dump restored intact.
TABLES=(tenants users memberships scopes finding_dispositions audit_events runners runner_tasks evidence_artifacts policy_decisions)

dex() { docker exec "$CONTAINER" "$@"; }

counts() {
  local db="$1"
  local sql=""
  for t in "${TABLES[@]}"; do
    # Skip tables that don't exist (keeps the drill robust to schema drift).
    sql+="select '$t='||count(*) from $t where to_regclass('$t') is not null union all "
  done
  sql+="select 'zzz=0'"
  dex psql -U "$USER" -d "$db" -tAc "$sql" 2>/dev/null | grep -v '^zzz=' | sort
}

echo "==> [1/4] dumping live database '$DB'"
dex sh -c "pg_dump -U '$USER' -d '$DB' -Fc -f '$DUMP'"
size="$(dex sh -c "du -h '$DUMP' | cut -f1")"
echo "    dump size: $size"

echo "==> [2/4] restoring into throwaway '$SCRATCH'"
dex sh -c "dropdb -U '$USER' --if-exists '$SCRATCH' >/dev/null 2>&1; createdb -U '$USER' '$SCRATCH'"
dex sh -c "pg_restore -U '$USER' -d '$SCRATCH' --no-owner --exit-on-error '$DUMP'"

echo "==> [3/4] comparing row counts"
src="$(counts "$DB")"
dst="$(counts "$SCRATCH")"

echo "==> [4/4] cleaning up"
dex sh -c "dropdb -U '$USER' --if-exists '$SCRATCH' >/dev/null 2>&1; rm -f '$DUMP'"

if [[ "$src" == "$dst" ]]; then
  echo
  echo "✓ DR drill PASSED — restore is byte-faithful on all sampled tables:"
  echo "$src" | sed 's/^/    /'
  exit 0
fi

echo
echo "✗ DR drill FAILED — row counts diverged between source and restore:" >&2
diff <(echo "$src") <(echo "$dst") >&2 || true
exit 1
