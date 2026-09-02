#!/usr/bin/env bash
# Register plant + hq lab runners with the control plane and start compose runners.
set -euo pipefail
# shellcheck source=lab-auth.sh
source "$(cd "$(dirname "$0")" && pwd)/lab-auth.sh"
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults
lab_auth_init

ROOT="$LAB_ROOT"
cd "$ROOT"
ENV_FILE="${ROOT}/.lab-runner.env"
STATE_FILE="${PERISCAN_LAB_STATE_FILE}"
START_COMPOSE="${PERISCAN_LAB_START_RUNNERS:-1}"
CREDS_DIR="${ROOT}/.lab-runner-creds"
mkdir -p "$CREDS_DIR"

if [[ -z "${TOKEN:-}" ]]; then
  echo "[enroll] need PERISCAN_API_TOKEN (run lab-session + seed-tenant first)"
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[enroll] missing $ENV_FILE — run seed-tenant.sh first"
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
if [[ -z "${PLANT_TOKEN:-}" || -z "${HQ_TOKEN:-}" ]]; then
  echo "[enroll] PLANT_TOKEN/HQ_TOKEN missing in $ENV_FILE"
  exit 1
fi

register_one() {
  local name="$1" reg_token="$2" site="$3" segment="$4"
  local keyf csrf_file body tmp code
  local result_priv result_pub

  if [[ "$reg_token" != prrt_* ]]; then
    echo "[enroll] $name: token is not a registration token (prrt_*) — re-run seed-tenant" >&2
    return 1
  fi

  keyf=$(mktemp)
  csrf_file=$(mktemp)
  result_priv=$(mktemp)
  result_pub=$(mktemp)
  openssl req -new -newkey rsa:2048 -nodes \
    -keyout "$keyf" -out "$csrf_file" \
    -subj "/CN=lab-${name}-runner" >/dev/null 2>&1
  # Ed25519 result-signing keypair (required for result submission).
  openssl genpkey -algorithm Ed25519 -out "$result_priv" 2>/dev/null
  openssl pkey -in "$result_priv" -pubout -out "$result_pub" 2>/dev/null
  body=$(NAME="$name" SITE="$site" SEGMENT="$segment" REG="$reg_token" \
    CSR="$(cat "$csrf_file")" RESULT_PUB="$(cat "$result_pub")" python3 - <<'PY'
import json, os
print(json.dumps({
  "arch": "amd64",
  "capabilities": {
    "supportsArtifactUpload": True,
    "supportsHttpConnectProxy": True,
    "supportsLocalReachability": True,
    "supportsLongPoll": True,
    "supportsWebSocket": False,
  },
  "csrPem": os.environ["CSR"],
  "deploymentMode": "Docker",
  "hostname": f"lab-{os.environ['NAME']}.range.internal",
  "labels": ["lab", os.environ["NAME"], f"site:{os.environ['SITE']}"],
  "networkProfile": {
    "additionalEgressNotes": "lab dual-site demo runner",
    "dnsResolutionRequired": True,
    "explicitProxyUrl": None,
    "gatewayHostnames": ["host.docker.internal"],
    "httpConnectProxySupported": True,
    "outboundHttpsPorts": [443, 3001],
  },
  "os": "linux",
  "registrationToken": os.environ["REG"],
  "resultSigningPublicKeyPem": os.environ["RESULT_PUB"],
  "runnerName": f"lab-{os.environ['NAME']}",
  "siteId": os.environ["SITE"],
  "networkSegment": os.environ["SEGMENT"],
  "version": "0.1.0-lab",
}))
PY
)
  rm -f "$keyf" "$csrf_file"

  tmp=$(mktemp)
  code=$(curl -sS -o "$tmp" -w "%{http_code}" -X POST \
    "${API}/api/v1/runners/register" \
    -H 'content-type: application/json' \
    -d "$body" || echo 000)
  if [[ "$code" != "201" ]]; then
    echo "[enroll] $name register failed ($code): $(head -c 400 "$tmp")" >&2
    rm -f "$tmp" "$result_priv" "$result_pub"
    return 1
  fi
  cp "$tmp" "${CREDS_DIR}/${name}-register.json"
  mkdir -p "${CREDS_DIR}/${name}"
  # Private half stays on the runner only (never sent to control plane).
  cp "$result_priv" "${CREDS_DIR}/${name}/result-signing-private.pem"
  cp "$result_pub" "${CREDS_DIR}/${name}/result-signing-public.pem"
  # Runner image often runs as non-root; named volumes need world-readable PEMs.
  # Lab-only secrets — not production key storage.
  chmod 644 "${CREDS_DIR}/${name}/result-signing-private.pem" "${CREDS_DIR}/${name}/result-signing-public.pem"
  NAME="$name" TMP="$tmp" CREDS_DIR="$CREDS_DIR" python3 - <<'PY'
import json, os
from pathlib import Path
name = os.environ["NAME"]
d = json.load(open(os.environ["TMP"]))
c = d.get("credentials") or d
out = Path(os.environ["CREDS_DIR"]) / name
out.mkdir(parents=True, exist_ok=True)
(out / "auth-token").write_text(c.get("runnerAuthToken") or "")
(out / "runner-id").write_text(c.get("runnerId") or "")
(out / "tenant-id").write_text(c.get("tenantId") or "")
(out / "task-signing-key-id").write_text(c.get("taskSigningKeyId") or "")
pem = c.get("taskSigningPublicKeyPem") or ""
(out / "task-signing-public.pem").write_text(pem if pem.endswith("\n") else pem + "\n")
print(f"[enroll] {name} runnerId={c.get('runnerId')} resultSigning=yes")
PY
  rm -f "$tmp" "$result_priv" "$result_pub"
}

echo "[enroll] registering plant + hq runners"
# seed may have already consumed tokens if re-run; re-seed if needed
if ! register_one plant "$PLANT_TOKEN" plant ot-dmz; then
  echo "[enroll] plant failed — registration tokens may be spent; re-run seed-tenant.sh"
  exit 1
fi
# HQ token still in env as HQ_TOKEN from seed before plant rewrote file — use original if saved
HQ_REG="${HQ_REGISTRATION_TOKEN:-$HQ_TOKEN}"
# After plant, ENV still has original HQ from source at top; but PLANT_TOKEN was reg token
# Re-source isn't needed: HQ_TOKEN was registration token at start
if ! register_one hq "${HQ_REGISTRATION_TOKEN:-$HQ_TOKEN}" hq corp; then
  # try HQ_TOKEN as originally sourced
  if [[ -f "${CREDS_DIR}/plant/runner-id" ]]; then
    echo "[enroll] hq register failed; plant ok — check second token"
  fi
  exit 1
fi

PLANT_AUTH=$(cat "${CREDS_DIR}/plant/auth-token")
HQ_AUTH=$(cat "${CREDS_DIR}/hq/auth-token")
PLANT_RUNNER_ID=$(cat "${CREDS_DIR}/plant/runner-id")
HQ_RUNNER_ID=$(cat "${CREDS_DIR}/hq/runner-id")
TENANT_ID=$(cat "${CREDS_DIR}/plant/tenant-id")

COMPOSE_CP_URL="${CONTROL_PLANE_URL:-http://host.docker.internal:3001}"
if [[ "$COMPOSE_CP_URL" == *"127.0.0.1"* ]] || [[ "$COMPOSE_CP_URL" == *"localhost"* ]]; then
  COMPOSE_CP_URL="http://host.docker.internal:3001"
fi

{
  echo "# Generated by enroll-runners.sh — do not commit"
  echo "# Task-signing PEMs live in .lab-runner-creds/{plant,hq}/ (mounted into containers)"
  echo "CONTROL_PLANE_URL=${COMPOSE_CP_URL}"
  echo "PERISCAN_RUNNER_IMAGE=${PERISCAN_RUNNER_IMAGE}"
  echo "PERISCAN_RUNNER_BOOTSTRAP_MODE=true"
  echo "PLANT_TOKEN=${PLANT_AUTH}"
  echo "HQ_TOKEN=${HQ_AUTH}"
  echo "PLANT_RUNNER_ID=${PLANT_RUNNER_ID}"
  echo "HQ_RUNNER_ID=${HQ_RUNNER_ID}"
  echo "PERISCAN_RUNNER_TENANT_ID=${TENANT_ID}"
} > "$ENV_FILE"
echo "[enroll] wrote $ENV_FILE"

if [[ -f "$STATE_FILE" ]]; then
  python3 - <<PY
import json
p="${STATE_FILE}"
d=json.load(open(p))
d.setdefault("runners", {})
d["runners"].update({
  "plantRunnerId": "${PLANT_RUNNER_ID}",
  "hqRunnerId": "${HQ_RUNNER_ID}",
  "enrolled": True,
})
open(p,"w").write(json.dumps(d, indent=2)+"\n")
print(f"[enroll] updated {p}")
PY
fi

if [[ "$START_COMPOSE" == "1" ]]; then
  if ! docker image inspect "${PERISCAN_RUNNER_IMAGE}" >/dev/null 2>&1; then
    echo "[enroll] image ${PERISCAN_RUNNER_IMAGE} not found — skip compose"
    echo "[enroll] build: docker build -t periscan-runner:local apps/runner"
    exit 0
  fi
  echo "[enroll] starting compose runners (image=${PERISCAN_RUNNER_IMAGE})"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  # Copy creds into named Docker volumes (Colima/remote Docker cannot bind-mount /Volumes).
  load_creds_volume() {
    local side="$1" vol="$2"
    docker volume create "$vol" >/dev/null
    # alpine container with docker.sock-less path: pipe tar via docker run -i
    tar -C "${CREDS_DIR}/${side}" -cf - . | docker run --rm -i \
      -v "${vol}:/runner-creds" alpine:3.20 \
      sh -c 'rm -rf /runner-creds/*; tar -C /runner-creds -xf -; ls -la /runner-creds'
  }
  # Compose project volume names are prefixed with project name
  PROJECT=$(docker compose config --format json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','periscan-lab'))" 2>/dev/null || echo periscan-lab)
  load_creds_volume plant "${PROJECT}_runner_plant_creds"
  load_creds_volume hq "${PROJECT}_runner_hq_creds"

  docker compose --profile runners up -d --force-recreate runner-plant runner-hq
  sleep 3
  docker compose --profile runners ps
  echo "[enroll] affinity: ./scripts/affinity-fire.sh"
else
  echo "[enroll] START_COMPOSE=0 — credentials written only"
fi
