#!/bin/sh
# Generate a local test CA and the leaf certificates the range serves.
# Idempotent: if the CA already exists we leave everything in place.
#
#   ca.crt / ca.key             - the range's local test root CA
#   app.crt / app.key           - CA-signed leaf, SAN covers all range hosts,
#                                 valid ~2 years (so `fetch`/undici trusts it)
#   cert-valid.crt / .key       - CA-signed leaf for cert.range.test (hardened)
#   cert-expired.crt / .key     - CA-signed, notAfter in the PAST (exposed);
#                                 tls_certificate_check reports it EXPIRED
#
# Uses `openssl ca -startdate/-enddate` to backdate the expired cert (portable).
set -eu

CERTS=/certs
cd "$CERTS"

if [ -f "$CERTS/ca.crt" ] && [ -f "$CERTS/app.crt" ] && [ -f "$CERTS/cert-expired.crt" ]; then
  echo "[gen-certs] certs already present; skipping."
  exit 0
fi

command -v openssl >/dev/null 2>&1 || apk add --no-cache openssl

SAN="DNS:app.range.test,DNS:cert.range.test,DNS:valid.range.test,DNS:dangling.range.test,DNS:localhost,IP:127.0.0.1"

echo "[gen-certs] generating local test CA..."
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ca.key -out ca.crt -days 3650 \
  -subj "/O=Periscan Test Range/CN=Periscan Test Range Root CA"

echo "[gen-certs] generating CA-signed leaf for app/cert (valid ~2y)..."
openssl req -newkey rsa:2048 -nodes -keyout app.key -out app.csr \
  -subj "/O=Periscan Test Range/CN=app.range.test"
openssl x509 -req -in app.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out app.crt -days 730 -copy_extensions copy \
  -extfile /dev/stdin <<EOF
subjectAltName = ${SAN}
EOF

# Hardened cert.range.test uses the same CA-signed material.
cp app.crt cert-valid.crt
cp app.key cert-valid.key

echo "[gen-certs] generating EXPIRED CA-signed leaf for cert.range.test (exposed)..."
# Backdate notBefore/notAfter into the past with `openssl ca` (-startdate/-enddate
# are portable across OpenSSL 1.x/3.x; `req -x509 -not_after` is not).
# tls_certificate_check checks expiry first -> Validated (tls_certificate_expired).
mkdir -p ca-db/newcerts
: > ca-db/index.txt
[ -f ca-db/serial ] || echo 1000 > ca-db/serial
cat > ca-db/ca.cnf <<CNF
[ca]
default_ca = CA_default
[CA_default]
dir             = ${CERTS}/ca-db
database        = \$dir/index.txt
new_certs_dir   = \$dir/newcerts
serial          = \$dir/serial
certificate     = ${CERTS}/ca.crt
private_key     = ${CERTS}/ca.key
default_md      = sha256
policy          = policy_any
[policy_any]
organizationName = optional
commonName       = supplied
[v3_ext]
subjectAltName = DNS:cert.range.test
CNF
openssl req -newkey rsa:2048 -nodes -keyout cert-expired.key -out cert-expired.csr \
  -subj "/O=Periscan Test Range/CN=cert.range.test"
openssl ca -batch -config ca-db/ca.cnf \
  -startdate 200101000000Z -enddate 200201000000Z \
  -extfile ca-db/ca.cnf -extensions v3_ext \
  -in cert-expired.csr -out cert-expired.crt

rm -f app.csr cert-expired.csr
chmod 644 "$CERTS"/*.crt "$CERTS"/*.key 2>/dev/null || true
echo "[gen-certs] done. CA at ${CERTS}/ca.crt"
