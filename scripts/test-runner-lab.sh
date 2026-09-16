#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER_DIR="$ROOT_DIR/apps/runner"
TEST_NAME="TestRunnerLocalLab"

if command -v go >/dev/null 2>&1; then
  cd "$RUNNER_DIR"
  test -z "$(gofmt -l main.go main_test.go)"
  go test -run "$TEST_NAME" ./...
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Go is not installed and Docker is unavailable; cannot validate runner local lab." >&2
  exit 1
fi

CONTAINER_ID="$(docker create -w /work golang:1.22-alpine sh -c "export PATH=/usr/local/go/bin:\$PATH; test -z \"\$(gofmt -l main.go main_test.go)\" && go test -run $TEST_NAME ./...")"
cleanup() {
  docker rm "$CONTAINER_ID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker cp "$RUNNER_DIR/." "$CONTAINER_ID":/work
docker start -a "$CONTAINER_ID"
