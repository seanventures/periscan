#!/usr/bin/env bash
# Bring up the continuous-loop lab (Phase 1).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export LAB_PROFILE="${LAB_PROFILE:-exposed}"
echo "[lab] profile=${LAB_PROFILE} (rebuild images so profile bakes into nginx/coredns)"
# Force rebuild when profile flips (exposed ↔ hardened).
docker compose build --build-arg LAB_PROFILE="${LAB_PROFILE}" coredns edge app data mocksiem
docker compose up -d

echo
echo "[lab] waiting for health..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:9200/health" >/dev/null 2>&1; then
    echo "[lab] mocksiem ok"
    break
  fi
  sleep 1
done

echo
echo "[lab] hosts entries (may require sudo):"
echo "  127.0.0.1 edge.lab.range.test app.lab.range.test data.lab.range.test siem.lab.range.test marker.lab.range.test"
echo
echo "[lab] published ports:"
echo "  edge  http://edge.lab.range.test:8081  https://edge.lab.range.test:8443"
echo "  app   http://app.lab.range.test:8082   https://app.lab.range.test:8444"
echo "  data  http://data.lab.range.test:8083  (/health, /api/records)"
echo "  dns   127.0.0.1:5355"
echo "  siem  http://127.0.0.1:9200"
echo
echo "[lab] API DNS preload:"
echo "  ABS=\$(cd ../.. && pwd)"
echo "  NODE_OPTIONS=\"--import \${ABS}/infra/lab/dns-preload.mjs\" \\"
echo "  NODE_EXTRA_CA_CERTS=\"\${ABS}/infra/lab/../lab-certs-hint\" \\"
echo "  # CA is inside docker volume; copy with: docker compose cp init-certs:/certs/ca.crt ./certs/ca.crt"
echo
echo "[lab] smoke: ./scripts/smoke.sh"
echo "[lab] golden checklist: ./scripts/golden-path.sh"
