#!/usr/bin/env bash
# Run the RUNNER-executed measured closed-loop e2e on a macOS (Docker Desktop) host.
#
# This proves the IN-NETWORK RUNNER path (not the control-plane live-probe path):
# a real runner agent, given a SIGNED task from the control plane, executes
# periscan.http_cors_audit against the local test range and submits a SIGNED
# result the server verifies + persists as a MEASURED "Exploitable" finding.
#
# Why this wrapper exists (same reason as tests/e2e-measured/run-macos.sh):
# periscan.http_cors_audit probes https://<host> and the range's reflected-CORS +
# credentials exposure is served on :443, so global fetch (undici) must trust the
# range's CA. NODE_EXTRA_CA_CERTS is read by Node ONCE at startup, so it must be
# set before vitest launches. This wrapper stages the range under $HOME (dodging
# the /Volumes bind-mount caveat), brings up the EXPOSED profile so the CA is
# generated, extracts the CA to the host, then runs the test. The test self-manages
# the range bring-up wait and teardown from there.
#
# Usage:  DATABASE_URL=... bash tests/e2e-runner-measured/run-macos.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RANGE_SRC="$REPO_ROOT/infra/test-range"
RANGE_DIR="${RANGE_DIR:-$HOME/.periscan-measured-range}"

export DATABASE_URL="${DATABASE_URL:-postgresql://periscan:periscan@127.0.0.1:5434/periscan}"

echo "[runner-measured-loop] staging range at $RANGE_DIR"
mkdir -p "$RANGE_DIR"
cp -R "$RANGE_SRC/." "$RANGE_DIR/"

echo "[runner-measured-loop] bringing up EXPOSED profile (generates the local CA)"
( cd "$RANGE_DIR" && RANGE_PROFILE=exposed docker compose up -d )

# Wait for the one-shot cert generator to finish and nginx to serve.
CA_FILE="$RANGE_DIR/range-ca.crt"
echo "[runner-measured-loop] extracting range CA -> $CA_FILE"
for _ in $(seq 1 30); do
  if docker cp periscan-test-range-nginx-1:/etc/nginx/certs/ca.crt "$CA_FILE" 2>/dev/null; then
    break
  fi
  sleep 1
done
test -s "$CA_FILE" || { echo "[runner-measured-loop] ERROR: could not extract range CA"; exit 1; }

export NODE_EXTRA_CA_CERTS="$CA_FILE"
export RANGE_DIR
export RUN_MEASURED_E2E=1
export PERISCAN_DEV_MODE=true
export PERISCAN_DATA_REGION="${PERISCAN_DATA_REGION:-us-east-1}"
export PERISCAN_JWT_SECRET="${PERISCAN_JWT_SECRET:-runner-measured-loop-secret}"

echo "[runner-measured-loop] running vitest (runner-executed measured loop, HTTPS + range CA)"
cd "$REPO_ROOT"
pnpm exec vitest run tests/e2e-runner-measured --testTimeout=180000
