#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

find "$ROOT_DIR/apps" "$ROOT_DIR/packages" \
  -type d \
  \( -name dist -o -name .next \) \
  -prune \
  -print \
  -exec rm -rf {} +
