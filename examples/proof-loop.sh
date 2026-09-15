#!/usr/bin/env bash
# Periscan proof-loop automation example (P20-8)
#
# Demonstrates: auth → (optional) scope discovery → mission list → wait for a
# run (or poll) → remediations → findings bulk note.
#
# Requires:
#   PERISCAN_API_BASE   e.g. https://api.example.com  (no trailing slash)
#   PERISCAN_API_KEY    tenant API key (psk_…)
#
# Optional:
#   PERISCAN_MISSION_ID / PERISCAN_RUN_ID  — long-poll a known run
#   PERISCAN_FINDING_IDS                  — comma-separated UUIDs for bulk demo
#
# This is a customer-facing example script, not a product test harness.
# Pin your client generators to the OpenAPI info.version from GET /openapi.json.
set -euo pipefail

BASE="${PERISCAN_API_BASE:?Set PERISCAN_API_BASE}"
KEY="${PERISCAN_API_KEY:?Set PERISCAN_API_KEY}"

# Optional: set PERISCAN_IDEMPOTENCY_KEY for safe at-least-once POSTs (P20-7).
# Replays with the same key+body return the first response; different body → 409.
IDEM_HDR=()
if [[ -n "${PERISCAN_IDEMPOTENCY_KEY:-}" ]]; then
  IDEM_HDR=(-H "Idempotency-Key: ${PERISCAN_IDEMPOTENCY_KEY}")
fi

auth=(-H "Authorization: Bearer ${KEY}" -H "Content-Type: application/json" "${IDEM_HDR[@]}")

echo "== Health =="
curl -fsS "${BASE}/health" | head -c 200
echo

# ICP-P1-10: use a mounted honesty surface (OpenAPI). There is no
# /api/v1/lab/capabilities route on production — do not call non-mounted paths.
echo "== OpenAPI contract (mounted honesty; pin generators to info.version) =="
curl -fsS "${BASE}/openapi.json" | head -c 1200
echo

echo "== Open missions (cursor page) =="
curl -fsS "${auth[@]}" "${BASE}/api/v1/missions?limit=5" | head -c 800
echo

if [[ -n "${PERISCAN_MISSION_ID:-}" && -n "${PERISCAN_RUN_ID:-}" ]]; then
  echo "== Wait for mission run (P20-3; max 60s server cap) =="
  # 408 + Retry-After means still running — loop a few times for CI scripts.
  for _ in 1 2 3 4 5; do
    code=$(curl -sS -o /tmp/periscan-wait.json -w "%{http_code}" \
      "${auth[@]}" \
      "${BASE}/api/v1/missions/${PERISCAN_MISSION_ID}/runs/${PERISCAN_RUN_ID}/wait?timeoutMs=5000" \
      || true)
    echo "wait status=${code}"
    if [[ "${code}" == "200" ]]; then
      head -c 400 /tmp/periscan-wait.json
      echo
      break
    fi
    if [[ "${code}" == "404" ]]; then
      cat /tmp/periscan-wait.json
      exit 1
    fi
    sleep 1
  done
fi

echo "== Remediations (verify Fixed via remediation.verified webhook in prod) =="
curl -fsS "${auth[@]}" "${BASE}/api/v1/remediations" | head -c 600
echo

if [[ -n "${PERISCAN_FINDING_IDS:-}" ]]; then
  # Honesty (P20-11 residual): POST /api/v1/findings/bulk is NotConfigured / not
  # mounted. Loop single-finding transition instead so proof-loop matches runtime.
  echo "== Finding disposition notes via single transition (bulk HTTP not shipped) =="
  IFS=',' read -r -a ids <<< "${PERISCAN_FINDING_IDS}"
  for finding_id in "${ids[@]}"; do
    curl -fsS "${auth[@]}" -X POST "${BASE}/api/v1/findings/${finding_id}/transition" \
      -H "Content-Type: application/json" \
      -d '{"disposition":null,"note":"proof-loop.sh single transition touch"}' \
      | head -c 600
    echo
  done
fi

echo "== Done. Prefer webhooks (mission.started|completed|failed, remediation.verified, finding.disposition_changed) over busy-poll. =="
