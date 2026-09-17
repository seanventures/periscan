#!/usr/bin/env bash
# Periscan ops soak *prep* — safe health + auth probes only.
#
# Purpose
#   Establish that a target control plane answers liveness, readiness, OpenAPI,
#   and (optionally) an authenticated read before any load/soak run. This is
#   PREP evidence for ops scorecards — not a performance qualification and not
#   a production SLA.
#
# Honesty
#   - Does NOT print or invent p50/p95/p99, RPS, or concurrency capacity.
#   - Does NOT set productionScaleClaimValidated or claim soak completion.
#   - For measured local baselines see scripts/perf-baseline.mjs +
#     docs/qa/PERFORMANCE_QUALIFICATION_2026-07-15.md (those artifacts are
#     environment-scoped and keep productionScaleClaimValidated=false).
#
# Usage
#   BASE_URL=http://127.0.0.1:3001 bash scripts/ops-soak-prep.sh
#   BASE_URL=https://api.example.com PERISCAN_API_KEY=psk_… bash scripts/ops-soak-prep.sh
#   BASE_URL=… RESULT_PATH=/tmp/periscan-soak-prep.json bash scripts/ops-soak-prep.sh
#
# Env
#   BASE_URL           API base (default http://127.0.0.1:3001)
#   PERISCAN_API_KEY   optional Bearer key for GET /api/v1/me (no signup)
#   PREP_TIMEOUT       per-request timeout seconds (default 10)
#   RESULT_PATH        optional JSON artifact path
#   SKIP_AUTH          set to 1 to skip authenticated probe even if key set

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
BASE_URL="${BASE_URL%/}"
PREP_TIMEOUT="${PREP_TIMEOUT:-10}"
RESULT_PATH="${RESULT_PATH:-}"
SKIP_AUTH="${SKIP_AUTH:-0}"
API_KEY="${PERISCAN_API_KEY:-}"

pass=0
fail=0
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# TSV rows: label \t expected \t actual \t ok \t elapsed_ms
probe_tsv="$(mktemp -t periscan-soak-prep.XXXXXX)"
trap 'rm -f "$probe_tsv"' EXIT

now_ms() {
  python3 -c 'import time; print(int(time.time()*1000))' 2>/dev/null || echo 0
}

probe() {
  local label="$1"
  local expected="$2"
  local method="$3"
  local url="$4"
  shift 4
  local start_ms end_ms elapsed code
  start_ms="$(now_ms)"
  code="$(curl -sS -o /dev/null -w '%{http_code}' \
    --max-time "$PREP_TIMEOUT" \
    -X "$method" "$url" "$@" 2>/dev/null)" || code="000"
  end_ms="$(now_ms)"
  if [[ "$start_ms" != "0" && "$end_ms" != "0" ]]; then
    elapsed=$((end_ms - start_ms))
  else
    elapsed=0
  fi

  local ok="false"
  if [[ "$code" == "$expected" ]]; then
    ok="true"
    pass=$((pass + 1))
    echo "  ok   $label -> $code (${elapsed}ms)"
  else
    fail=$((fail + 1))
    echo "  FAIL $label -> $code (expected $expected, ${elapsed}ms)" >&2
  fi
  printf '%s\t%s\t%s\t%s\t%s\n' "$label" "$expected" "$code" "$ok" "$elapsed" >>"$probe_tsv"
}

echo "==> Periscan ops soak PREP against $BASE_URL"
echo "    (health + optional auth only; no load, no SLA claims)"

probe "GET /api/v1/health" 200 GET "$BASE_URL/api/v1/health"
probe "GET /api/v1/health/ready" 200 GET "$BASE_URL/api/v1/health/ready"
probe "GET /openapi.json" 200 GET "$BASE_URL/openapi.json"

if [[ "$SKIP_AUTH" == "1" ]]; then
  echo "  skip authenticated /me (SKIP_AUTH=1)"
elif [[ -n "$API_KEY" ]]; then
  probe "GET /api/v1/me (Bearer API key)" 200 GET "$BASE_URL/api/v1/me" \
    -H "authorization: Bearer ${API_KEY}"
else
  echo "  skip authenticated /me (set PERISCAN_API_KEY to include)"
fi

finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ -n "$RESULT_PATH" ]]; then
  python3 - "$RESULT_PATH" "$BASE_URL" "$started_at" "$finished_at" "$pass" "$fail" "$probe_tsv" <<'PY'
import json, sys
path, base, started, finished, pass_c, fail_c, tsv = sys.argv[1:8]
probes = []
with open(tsv, encoding="utf-8") as fh:
    for line in fh:
        line = line.rstrip("\n")
        if not line:
            continue
        label, expected, actual, ok, elapsed = line.split("\t")
        def status_value(raw: str):
            # Keep transport failures as "000"; coerce normal HTTP codes to int.
            if raw.isdigit() and len(raw) == 3 and raw != "000":
                return int(raw)
            return raw

        probes.append({
            "label": label,
            "expectedStatus": status_value(expected),
            "actualStatus": status_value(actual),
            "ok": ok == "true",
            "elapsedMs": int(elapsed),
        })
artifact = {
    "artifactType": "ops-soak-prep",
    "productionScaleClaimValidated": False,
    "loadOrSoakCompleted": False,
    "slaClaims": [],
    "baseUrl": base,
    "startedAt": started,
    "finishedAt": finished,
    "passCount": int(pass_c),
    "failCount": int(fail_c),
    "probes": probes,
}
with open(path, "w", encoding="utf-8") as out:
    json.dump(artifact, out, indent=2)
    out.write("\n")
print(f"  wrote prep artifact: {path}")
PY
fi

echo "==> prep result: pass=$pass fail=$fail (not a soak score)"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
exit 0
