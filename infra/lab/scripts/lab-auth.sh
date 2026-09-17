# shellcheck shell=bash
# Shared auth helpers for lab scripts (cookie CSRF double-submit + bearer).
# Source from sibling scripts: source "$(dirname "$0")/lab-auth.sh" && lab_auth_init

lab_auth_init() {
  API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
  TOKEN="${PERISCAN_API_TOKEN:-}"
  CSRF="${PERISCAN_CSRF_TOKEN:-}"
  AUTH_HEADER=()

  if [[ -z "$TOKEN" ]]; then
    return 0
  fi

  # Bearer tokens (no CSRF)
  if [[ "$TOKEN" != *=* ]]; then
    AUTH_HEADER=(-H "Authorization: Bearer ${TOKEN}" -H "content-type: application/json")
    return 0
  fi

  # Cookie auth — extract CSRF from TOKEN if embedded
  if [[ -z "$CSRF" && "$TOKEN" == *periscan_csrf=* ]]; then
    CSRF="${TOKEN#*periscan_csrf=}"
    CSRF="${CSRF%%;*}"
    CSRF="${CSRF%% *}"
  fi

  if [[ -z "$CSRF" ]]; then
    echo "[lab-auth] warning: cookie auth without CSRF — mutations will fail. Set PERISCAN_CSRF_TOKEN." >&2
  fi

  local cookie="$TOKEN"
  if [[ -n "$CSRF" && "$TOKEN" != *periscan_csrf=* ]]; then
    cookie="${TOKEN}; periscan_csrf=${CSRF}"
  fi

  AUTH_HEADER=(-H "Cookie: ${cookie}" -H "content-type: application/json")
  if [[ -n "$CSRF" ]]; then
    AUTH_HEADER+=(-H "x-csrf-token: ${CSRF}")
  fi
}

lab_curl() {
  local method="$1" url="$2"
  shift 2
  local tmp
  tmp=$(mktemp)
  if [[ $# -gt 0 ]]; then
    LAB_HTTP_CODE=$(curl -sS -o "$tmp" -w "%{http_code}" "${AUTH_HEADER[@]}" -X "$method" "$url" "$@" || echo 000)
  else
    LAB_HTTP_CODE=$(curl -sS -o "$tmp" -w "%{http_code}" "${AUTH_HEADER[@]}" -X "$method" "$url" || echo 000)
  fi
  cat "$tmp"
  rm -f "$tmp"
}
