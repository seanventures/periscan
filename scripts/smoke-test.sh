#!/usr/bin/env bash
# Periscan post-deploy smoke test (WS6 deploy pipeline).
#
# Exercises a freshly deployed Periscan control plane against a live BASE_URL:
#   1. GET  /api/v1/health          -> 200 (liveness)
#   2. GET  /api/v1/health/ready     -> 200 (readiness: DB, queue, evidence store)
#   3. authed round-trip:
#        POST /api/v1/auth/signup     -> 201 (creates tenant + owner, sets cookie)
#        GET  /api/v1/tenants/current -> 200 (reads back the tenant with the cookie)
#   4. (optional) GET WEB_BASE_URL/   -> 200 (web shell), when WEB_BASE_URL is set
#
# Any non-200/201 (or a missing endpoint) fails the whole run with a non-zero
# exit so a deploy gate can abort on it. Read-only except for the signup, which
# creates a throwaway tenant with a unique email; set SMOKE_SKIP_SIGNUP=1 to skip
# the authed round-trip on environments where open signup is disabled.
#
# Usage (local, against a running API):
#   BASE_URL=http://127.0.0.1:3001 bash scripts/smoke-test.sh
# With the web shell too:
#   BASE_URL=https://api.example.com WEB_BASE_URL=https://app.example.com \
#     bash scripts/smoke-test.sh
#
# Env:
#   BASE_URL          API base URL (default http://127.0.0.1:3001)
#   WEB_BASE_URL      optional web base URL; when set, GET / must return 200
#   SMOKE_SKIP_SIGNUP set to 1 to skip the signup/read authed round-trip
#   SMOKE_TIMEOUT     per-request timeout in seconds (default 10)

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
BASE_URL="${BASE_URL%/}"
WEB_BASE_URL="${WEB_BASE_URL:-}"
WEB_BASE_URL="${WEB_BASE_URL%/}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-10}"

pass=0
fail=0

# status_of METHOD URL [curl args...] -> echoes HTTP status code (000 on error)
status_of() {
  local method="$1"
  local url="$2"
  shift 2
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' \
    --max-time "$SMOKE_TIMEOUT" \
    -X "$method" "$url" "$@" 2>/dev/null)" || code="000"
  echo "${code:-000}"
}

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok   $label -> $actual"
    pass=$((pass + 1))
  else
    echo "  FAIL $label -> $actual (expected $expected)" >&2
    fail=$((fail + 1))
  fi
}

echo "==> Periscan smoke test against $BASE_URL"

# 1. liveness
check "GET /api/v1/health" 200 "$(status_of GET "$BASE_URL/api/v1/health")"

# 2. readiness (503 if a dependency is unhealthy -> treated as a failure)
check "GET /api/v1/health/ready" 200 "$(status_of GET "$BASE_URL/api/v1/health/ready")"

# 3. authed round-trip: signup -> read current tenant with the session cookie
if [[ "${SMOKE_SKIP_SIGNUP:-0}" == "1" ]]; then
  echo "  skip authed round-trip (SMOKE_SKIP_SIGNUP=1)"
else
  cookie_jar="$(mktemp -t periscan-smoke-cookies.XXXXXX)"
  trap 'rm -f "$cookie_jar"' EXIT

  stamp="$(date +%s)-${RANDOM}"
  email="smoke+${stamp}@periscan.test"
  # password must be >= 12 chars; tenantName + name are required by SignupInputSchema.
  signup_body="$(printf '{"email":"%s","name":"Smoke Test","password":"smoke-test-pw-%s","tenantName":"Smoke Test %s"}' \
    "$email" "$stamp" "$stamp")"

  signup_status="$(status_of POST "$BASE_URL/api/v1/auth/signup" \
    -H 'content-type: application/json' \
    -c "$cookie_jar" \
    --data "$signup_body")"
  check "POST /api/v1/auth/signup" 201 "$signup_status"

  read_status="$(status_of GET "$BASE_URL/api/v1/tenants/current" \
    -b "$cookie_jar")"
  check "GET /api/v1/tenants/current (authed)" 200 "$read_status"
fi

# 4. optional web shell
if [[ -n "$WEB_BASE_URL" ]]; then
  check "GET / (web shell)" 200 "$(status_of GET "$WEB_BASE_URL/")"
fi

echo "==> smoke test: $pass passed, $fail failed"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
