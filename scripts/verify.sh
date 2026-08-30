#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# If test-specific DB URL is exported, promote it for this shell run before
# falling back to local defaults.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${PERISCAN_TEST_DATABASE_URL:-}" ]; then
  export DATABASE_URL="$PERISCAN_TEST_DATABASE_URL"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${SUPABASE_DATABASE_URL:-}" ]; then
    export DATABASE_URL="$SUPABASE_DATABASE_URL"
  elif [ -n "${SUPABASE_DB_URL:-}" ]; then
    export DATABASE_URL="$SUPABASE_DB_URL"
  elif [ -n "${POSTGRES_URL:-}" ]; then
    export DATABASE_URL="$POSTGRES_URL"
  else
    export DATABASE_URL="postgresql://periscan:periscan@127.0.0.1:5432/periscan"
  fi
fi

cd "$ROOT_DIR"

echo "==> settled tripwire"
pnpm settled:check

echo "==> lint"
pnpm lint

echo "==> typecheck"
pnpm typecheck

echo "==> test"
pnpm test

echo "==> clean build artifacts"
pnpm clean:build

echo "==> build"
pnpm build

echo "==> runner"
pnpm test:runner

echo "==> runner local lab"
pnpm test:runner:lab

echo "==> oss toolchain check"
pnpm tools:check -- --phase=Current

echo "==> license inventory"
pnpm licenses:check

echo "==> license policy tests"
pnpm test:license

echo "==> module certification report drift"
pnpm modules:certify:check

echo "==> PRD audit gate"
pnpm prd:audit

echo "==> analyst scorecard gate"
pnpm analyst:score:check

echo "==> prisma generate"
pnpm --filter @periscan/db run db:generate

echo "==> prisma validate"
pnpm --filter @periscan/db run db:validate

echo "==> migration enum-drift gate"
# Fails fast if a schema enum value was never added by a migration (would 22P02
# on a from-scratch DB). See scripts/check-enum-drift.mjs.
pnpm db:check-drift

echo "==> prisma migrate deploy"
pnpm --filter @periscan/db run db:migrate:deploy

echo "==> e2e"
pnpm test:e2e

echo "==> security boundary"
pnpm test:security

# Dependency audit. The high-severity audit is FATAL: under `set -euo
# pipefail` a non-zero `pnpm audit` exit (i.e. a high/critical advisory) aborts
# the gate. As of this change there are no known high-severity advisories, so
# nothing is being suppressed. If an unfixable advisory ever appears, prefer a
# scoped `pnpm.overrides`/`--ignore` entry (with a tracking note) over removing
# this gate.
echo "==> dep audit (high+ severity, fatal)"
node scripts/audit-dependencies.mjs --audit-level high

# The broad production audit is advisory only. It tends to surface transitive
# low/moderate advisories with no upstream fix, so making it fatal would be too
# noisy and would block unrelated work. We still print its output for triage.
echo "==> dep audit (prod, advisory/non-fatal)"
node scripts/audit-dependencies.mjs --prod --audit-level moderate || true

echo "==> a11y / obs / dep polish notes (P2 DevOps + a11y-ci + trends-impact)"
echo "  - structured logs (mission.create/start + denies, connector.sync (w/ signalCount)/health, policy.preview) + /api/v1/metrics enabled; deeper for missions/denies/connectors in p2-trends-impact"
echo "  - a11y-ci P2: explicit labels+ids+aria-live+roles+focus+skip+toasts(retry/dismiss) in web; marketplace load/zero polish; responsive media+touch; CI note (no axe gating, e2e API-only); see ai/grok/p2-ux-a11y-ci + component tests"
echo "  - dep scan: pnpm audit run in CI (high+ severity is FATAL; --prod audit is advisory/non-fatal)"
echo "  - trends/MSSP: executive trends + client portfolio now reflect recent connector (e.g. SecurityControl Splunk/Proofpoint) signals via missingProofInputs count (closes control_telemetry gaps etc)"

echo "==> acceptance"
pnpm test:acceptance
