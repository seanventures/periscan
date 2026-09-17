#!/usr/bin/env bash
# Thin wrapper so `bash scripts/install.sh` matches the curl-target root install.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "${ROOT}/install.sh" "$@"
