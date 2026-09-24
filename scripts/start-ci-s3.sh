#!/usr/bin/env bash
# Ephemeral S3-compatible store for hosted release tests. This container has no
# persistent volume and is never used for customer evidence or local upgrades.
set -euo pipefail

name="${PERISCAN_CI_S3_CONTAINER_NAME:-periscan-ci-s3}"
port="${PERISCAN_CI_S3_PORT:-9000}"
image="chrislusf/seaweedfs:4.47@sha256:ce9e796f1fe6f06968f4c04bdaf8f678dad9c8acdfef3d244133d71bfa6bf882"
config='{"identities":[{"name":"periscan-ci","credentials":[{"accessKey":"periscan","secretKey":"periscan123"}],"actions":["Admin","Read","List","Tagging","Write"]}]}'

if ! [[ "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
  echo "Invalid PERISCAN_CI_S3_PORT: $port" >&2
  exit 1
fi
if docker container inspect "$name" >/dev/null 2>&1; then
  echo "Refusing to replace existing Docker container: $name" >&2
  exit 1
fi

docker run --pull=always --rm -d \
  --name "$name" \
  --publish "127.0.0.1:${port}:9000" \
  --env "S3_CONFIG=$config" \
  --health-cmd 'nc -z 127.0.0.1 9000' \
  --health-interval 2s \
  --health-timeout 2s \
  --health-retries 20 \
  --entrypoint /bin/sh \
  "$image" \
  -c 'printf "%s" "$S3_CONFIG" > /tmp/s3.json; exec weed server -s3 -s3.port=9000 -dir=/data -s3.config=/tmp/s3.json -ip.bind=0.0.0.0' \
  >/dev/null

for _ in {1..60}; do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    echo "Ephemeral S3 store ready on 127.0.0.1:$port"
    exit 0
  fi
  if ! docker ps --filter "name=^/${name}$" --format '{{.Names}}' | grep -qx "$name"; then
    echo "Ephemeral S3 store exited before readiness." >&2
    exit 1
  fi
  sleep 1
done

docker logs "$name" 2>&1 | tail -n 20 >&2
echo "Ephemeral S3 store did not become healthy." >&2
exit 1
