#!/usr/bin/env bash
# Run the measured closed-loop e2e on a macOS (Docker Desktop) host.
#
# It exists because NODE_EXTRA_CA_CERTS — which lets global fetch trust the range's
# CA-signed leaf on app.range.test — is read by Node ONCE at startup, so it must be
# set before vitest launches. This wrapper stages the range under $HOME (dodging the
# /Volumes bind-mount caveat), brings up the EXPOSED profile so the CA is generated,
# extracts the CA to the host, then runs the test with the env it needs. The test
# self-manages the exposed→hardened flip and teardown from there.
#
# Usage:  DATABASE_URL=... bash tests/e2e-measured/run-macos.sh
#
# The HTTP/TLS subset (cert + http health/cors/cookie/redirect) is proven end-to-end.
# The 3 DNS modules are Linux-only here (host→container UDP is unreliable on Docker
# Desktop); the CI workflow (.github/workflows/measured-loop.yml) proves all 10.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RANGE_SRC="$REPO_ROOT/infra/test-range"
RANGE_DIR="${RANGE_DIR:-$HOME/.periscan-measured-range}"

export DATABASE_URL="${DATABASE_URL:-postgresql://periscan:periscan@127.0.0.1:5434/periscan}"

echo "[measured-loop] staging range at $RANGE_DIR"
mkdir -p "$RANGE_DIR"
cp -R "$RANGE_SRC/." "$RANGE_DIR/"

echo "[measured-loop] bringing up EXPOSED profile (generates the local CA)"
( cd "$RANGE_DIR" && RANGE_PROFILE=exposed docker compose up -d )

# Wait for the one-shot cert generator to finish and nginx to serve.
CA_FILE="$RANGE_DIR/range-ca.crt"
echo "[measured-loop] extracting range CA -> $CA_FILE"
for _ in $(seq 1 30); do
  if docker cp periscan-test-range-nginx-1:/etc/nginx/certs/ca.crt "$CA_FILE" 2>/dev/null; then
    break
  fi
  sleep 1
done
test -s "$CA_FILE" || { echo "[measured-loop] ERROR: could not extract range CA"; exit 1; }

export NODE_EXTRA_CA_CERTS="$CA_FILE"
export RANGE_DIR
export RUN_MEASURED_E2E=1
export PERISCAN_DEV_MODE=true
export PERISCAN_DATA_REGION="${PERISCAN_DATA_REGION:-us-east-1}"
export PERISCAN_JWT_SECRET="${PERISCAN_JWT_SECRET:-measured-loop-secret}"
# Keep the range up across the run; the test flips profiles and tears down itself.

echo "[measured-loop] running vitest (HTTP/TLS subset live; DNS modules Linux-only)"
cd "$REPO_ROOT"
pnpm exec vitest run tests/e2e-measured --testTimeout=180000
