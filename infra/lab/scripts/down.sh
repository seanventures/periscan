#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose --profile runners down -v --remove-orphans 2>/dev/null || docker compose down -v --remove-orphans
echo "[lab] down"
