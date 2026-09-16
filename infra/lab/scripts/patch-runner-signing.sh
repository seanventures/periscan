#!/usr/bin/env bash
# Patch already-enrolled lab runners with Ed25519 result-signing keys.
# Use when runners were registered before enroll-runners.sh generated keys.
#
# Does NOT re-register (registration tokens are one-shot). Updates:
#   1) Postgres runners.result_signing_public_key_pem
#   2) .lab-runner-creds/{plant,hq}/result-signing-*.pem
#   3) Docker named volumes + recreate runner containers
#
# Prerequisites: lab postgres on :5434 (or DATABASE_URL), docker, enrolled creds.
set -euo pipefail
# shellcheck source=env.sh
source "$(cd "$(dirname "$0")" && pwd)/env.sh"
lab_env_defaults

ROOT="$LAB_ROOT"
CREDS_DIR="${ROOT}/.lab-runner-creds"
ENV_FILE="${ROOT}/.lab-runner.env"
cd "$ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[patch-sign] missing $ENV_FILE — run seed-tenant + enroll first" >&2
  exit 1
fi
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

patch_side() {
  local name="$1" runner_id="$2"
  local side_dir priv pub

  if [[ -z "$runner_id" || "$runner_id" == "null" ]]; then
    echo "[patch-sign] skip $name — no runner id"
    return 0
  fi
  side_dir="${CREDS_DIR}/${name}"
  mkdir -p "$side_dir"
  priv="${side_dir}/result-signing-private.pem"
  pub="${side_dir}/result-signing-public.pem"

  if [[ ! -f "$priv" || ! -f "$pub" ]]; then
    openssl genpkey -algorithm Ed25519 -out "$priv"
    openssl pkey -in "$priv" -pubout -out "$pub"
    # Non-root runner process in compose must read this (lab-only).
    chmod 644 "$priv" "$pub"
    echo "[patch-sign] generated keys for $name"
  else
    echo "[patch-sign] reusing existing keys for $name"
  fi

  local pub_pem
  pub_pem=$(cat "$pub")
  # Escape single quotes for SQL
  local pub_sql
  pub_sql=$(printf "%s" "$pub_pem" | sed "s/'/''/g")

  docker exec "$(lab_postgres_container)" psql -U periscan -d periscan -v ON_ERROR_STOP=1 -c \
    "UPDATE runners SET result_signing_public_key_pem = '${pub_sql}', updated_at = NOW() WHERE runner_id = '${runner_id}';" \
    >/dev/null
  echo "[patch-sign] DB updated $name ($runner_id)"
}

patch_side plant "${PLANT_RUNNER_ID:-}"
patch_side hq "${HQ_RUNNER_ID:-}"

# Reload volumes + restart runners when image present
if docker image inspect "${PERISCAN_RUNNER_IMAGE:-periscan-runner:test}" >/dev/null 2>&1; then
  PROJECT=$(docker compose config --format json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('name','periscan-lab'))" 2>/dev/null || echo periscan-lab)
  load_creds_volume() {
    local side="$1" vol="$2"
    docker volume create "$vol" >/dev/null
    tar -C "${CREDS_DIR}/${side}" -cf - . | docker run --rm -i \
      -v "${vol}:/runner-creds" alpine:3.20 \
      sh -c 'rm -rf /runner-creds/*; tar -C /runner-creds -xf -; chmod a+r /runner-creds/* 2>/dev/null; ls -la /runner-creds'
  }
  load_creds_volume plant "${PROJECT}_runner_plant_creds"
  load_creds_volume hq "${PROJECT}_runner_hq_creds"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  docker compose --profile runners up -d --force-recreate runner-plant runner-hq
  sleep 2
  docker compose --profile runners ps
  echo "[patch-sign] runners recreated with result-signing private key env"
else
  echo "[patch-sign] runner image missing — keys written to creds only"
fi

echo "[patch-sign] done — re-run: pnpm lab:hybrid-plant"
