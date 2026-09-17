#!/bin/sh
# Lab CA + multi-tier leaf certs for lab.range.test hosts.
# Idempotent if ca.crt already present.
set -eu
CERTS=/certs
cd "$CERTS"

if [ -f "$CERTS/ca.crt" ] && [ -f "$CERTS/lab.crt" ]; then
  echo "[lab gen-certs] certs already present; skipping."
  exit 0
fi

command -v openssl >/dev/null 2>&1 || apk add --no-cache openssl

SAN="DNS:edge.lab.range.test,DNS:app.lab.range.test,DNS:data.lab.range.test,DNS:siem.lab.range.test,DNS:marker.lab.range.test,DNS:localhost,IP:127.0.0.1"

echo "[lab gen-certs] generating CA..."
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ca.key -out ca.crt -days 3650 \
  -subj "/O=Periscan Lab/CN=Periscan Lab Root CA"

echo "[lab gen-certs] generating leaf..."
openssl req -newkey rsa:2048 -nodes -keyout lab.key -out lab.csr \
  -subj "/O=Periscan Lab/CN=app.lab.range.test"
openssl x509 -req -in lab.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out lab.crt -days 730 \
  -extfile /dev/stdin <<EOF
subjectAltName = ${SAN}
EOF
rm -f lab.csr
chmod 644 "$CERTS"/*.crt "$CERTS"/*.key 2>/dev/null || true
echo "[lab gen-certs] done."
