#!/usr/bin/env bash
# Physical smoke — no control plane required.
set -euo pipefail

fail=0

ok() { echo "  ok  $1"; }
bad() { echo "  FAIL $1"; fail=1; }

run_check() {
  local name="$1"
  shift
  if "$@"; then
    ok "$name"
  else
    bad "$name"
  fi
}

echo "[lab smoke] mocksiem"
if curl -fsS http://127.0.0.1:9200/health | grep -q '"status":"ok"'; then
  ok "siem health"
else
  bad "siem health"
fi

echo "[lab smoke] ingest + search"
curl -fsS -X POST http://127.0.0.1:9200/v1/events \
  -H 'content-type: application/json' \
  -d '{"marker":"periscan-lab-canary","host":"marker.lab.range.test"}' >/dev/null
if curl -fsS 'http://127.0.0.1:9200/v1/events?marker=periscan-lab-canary' | grep -q periscan-lab-canary; then
  ok "siem search"
else
  bad "siem search"
fi

echo "[lab smoke] edge/app/data HTTP"
if curl -fsS -H 'Host: edge.lab.range.test' http://127.0.0.1:8081/health | grep -q edge-ok; then
  ok "edge health"
else
  bad "edge health"
fi
if curl -fsS -H 'Host: app.lab.range.test' http://127.0.0.1:8082/health | grep -q app-ok; then
  ok "app health"
else
  bad "app health"
fi
if curl -fsS -H 'Host: data.lab.range.test' http://127.0.0.1:8083/health | grep -q data-ok; then
  ok "data health"
else
  bad "data health"
fi

if curl -fsS -H 'Host: data.lab.range.test' http://127.0.0.1:8083/api/records 2>/dev/null | grep -q records; then
  ok "data records open (exposed)"
else
  code=$(curl -sS -o /dev/null -w "%{http_code}" -H 'Host: data.lab.range.test' http://127.0.0.1:8083/api/records || echo 000)
  if [[ "$code" == "401" ]]; then
    ok "data records require auth (hardened)"
  else
    bad "data records posture (code=$code)"
  fi
fi

echo "[lab smoke] DNS (CoreDNS — may fail on macOS UDP publish)"
if out=$(dig @127.0.0.1 -p 5355 edge.lab.range.test +short +time=2 2>/dev/null) && [[ -n "$out" ]]; then
  ok "dns edge A ($out)"
else
  echo "  skip dns (dig failed — see README platform notes)"
fi

if [[ "$fail" -ne 0 ]]; then
  echo "[lab smoke] FAILED"
  exit 1
fi
echo "[lab smoke] OK"
