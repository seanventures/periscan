#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER_DIR="$ROOT_DIR/apps/runner"
GO_DOCKER_IMAGE="golang:1.22-alpine"

go_supports_runner() {
  local version
  version="$(go env GOVERSION 2>/dev/null || true)"
  case "$version" in
    go1.22*|go1.23*|go1.24*|go1.25*|go1.26*|go1.27*|go1.28*|go1.29*) return 0 ;;
    *) return 1 ;;
  esac
}

if command -v go >/dev/null 2>&1 && go_supports_runner; then
  cd "$RUNNER_DIR"
  test -z "$(gofmt -l main.go main_test.go)"
  go test ./...
  go build ./...
else
  if ! command -v docker >/dev/null 2>&1; then
    echo "Go 1.22+ is not installed and Docker is unavailable; cannot validate apps/runner." >&2
    exit 1
  fi

  CONTAINER_ID="$(docker create -w /work "$GO_DOCKER_IMAGE" sh -c 'export PATH=/usr/local/go/bin:$PATH; test -z "$(gofmt -l main.go main_test.go)" && go test ./... && go build ./...')"
  cleanup() {
    docker rm "$CONTAINER_ID" >/dev/null 2>&1 || true
  }
  trap cleanup EXIT

  docker cp "$RUNNER_DIR/." "$CONTAINER_ID":/work
  docker start -a "$CONTAINER_ID"
fi

if command -v docker >/dev/null 2>&1; then
  docker build -q -t periscan-runner:test "$RUNNER_DIR" >/dev/null
  test "$(docker run --rm --entrypoint id periscan-runner:test -u)" = "65532"
  docker run --rm periscan-runner:test --help >/dev/null 2>&1
fi
