# Periscan Measured Test Range

A local, disposable, containerized target range so Periscan's **measured** modules
produce **real, non-fixture** results (`evidenceBasis=Measured`) against a
**known, reproducible** posture — and so a hardened re-run measures as **Fixed**
(the honest closed-loop verification). Design rationale and the full module logic
are in [`docs/MEASURED_TEST_RANGE.md`](../../docs/MEASURED_TEST_RANGE.md).

Standard public images only (`nginx`, `coredns`, `alpine`). No secrets, no cloud,
no internet dependency (CoreDNS forwards upstream only for convenience).

## What it stands up

| Container | Role | Ports (host) |
|---|---|---|
| `init-certs` | one-shot: generates a local test CA + leaf certs into a volume | — |
| `nginx` | HTTP/TLS targets (`app.range.test`, `cert.range.test`) | `80`, `443` |
| `coredns` | authoritative DNS for the `range.test` zone | `5354` (udp+tcp) |

## Target → Periscan module map

| Scope (hostname) | Periscan module | exposed → | hardened → |
|---|---|---|---|
| `app.range.test` | `periscan.tls_protocol_audit` | Validated (TLS 1.0/1.1)\* | Fixed / Inconclusive |
| `app.range.test` | `periscan.http_health_check` | Validated (missing headers) | Fixed |
| `app.range.test` | `periscan.http_cors_audit` | Validated (reflected origin) | Fixed |
| `app.range.test` | `periscan.http_cookie_security` | Validated (bare cookie) | Fixed |
| `app.range.test` | `periscan.http_redirect_enforcement` | Validated (no https upgrade) | Fixed |
| `app.range.test` | `periscan.dns_caa_check` | Validated (no CAA) | Fixed |
| `app.range.test` | `periscan.dns_email_security_check` | Validated (no SPF/DMARC) | Fixed |
| `app.range.test` | `periscan.well_known_security_txt` | Inconclusive (absent, informational) | Detected (present) |
| `cert.range.test` | `periscan.tls_certificate_check` | Validated (expired cert) | Fixed (valid CA cert) |
| `dangling.range.test` | `periscan.dns_resolution_check` | Validated (dangling CNAME) | Fixed (resolves) |

\* `tls_protocol_audit` is best-effort — depends on the platform OpenSSL still
negotiating TLS 1.0/1.1. If it can't, the module reports `Inconclusive`, never a
false pass. See `docs/MEASURED_TEST_RANGE.md` §7.

## Bring it up

```sh
cd infra/test-range

# 1. Start the EXPOSED profile (default).
docker compose up -d

# 2. Map the HTTP/TLS hostnames to the local nginx (dns.lookup / getaddrinfo path).
#    (Requires sudo; remove the line when you tear the range down.)
echo "127.0.0.1 app.range.test cert.range.test dangling.range.test ghost.range.test" | sudo tee -a /etc/hosts

# 3. Run the Periscan API with its DNS resolver pointed at the range CoreDNS and
#    the range CA trusted (so undici/fetch accepts the CA-signed leaf certs).
ABS=$(cd ../.. && pwd)
NODE_OPTIONS="--import ${ABS}/infra/test-range/dns-preload.mjs" \
NODE_EXTRA_CA_CERTS="${ABS}/infra/test-range/certs/ca.crt" \
pnpm --filter @periscan/api dev
```

Quick sanity checks (optional):

```sh
curl -ksI https://app.range.test/ | head -1            # 200, no security headers (exposed)
dig @127.0.0.1 -p 5354 caa app.range.test +short       # empty (exposed) / letsencrypt (hardened)
dig @127.0.0.1 -p 5354 cname dangling.range.test +short # ghost.range.test. (exposed)
```

## Run the measured loop

For each scope hostname above:

1. Create a **Domain/Subdomain** scope with `value` = the hostname and mark it
   `Verified` (posture checks require a verified scope). Either drop the scope's
   verification token into the CoreDNS zone as
   `_periscan.<host> TXT "periscan-verification=<token>"`, or in dev set
   `verificationStatus=Verified` on the row directly.
2. Run a **live** posture check (forces the real network path even in dev):

   ```sh
   curl -X POST http://localhost:PORT/api/v1/scopes/<scopeId>/posture-check \
     -H 'content-type: application/json' -d '{"executionMode":"LiveSafe"}'
   ```

   The response is a per-module array of
   `{ moduleId, outcome, validationState, exposure, signalCount }`. The module for
   that scope's dimension returns `validationState: "Validated"` with `exposure:
   true`.

3. **Remediate** (flip the whole range to the hardened posture) and re-run:

   ```sh
   RANGE_PROFILE=hardened docker compose up -d      # same hostnames, hardened
   # re-run the same POST — the module now returns validationState: "Fixed",
   # exposure: false. The finding measures as honestly closed.
   ```

## Tear down

```sh
docker compose down -v          # -v also drops the generated certs volume
# remove the /etc/hosts line you added in step 2
```

## How it maps hosts (two DNS realities)

- **TLS + HTTP modules** (`tls.connect`, `fetch`) resolve via `dns.lookup` →
  `getaddrinfo`, which **honors `/etc/hosts`** → hence the `/etc/hosts` line.
- **DNS modules** use `node:dns/promises` `resolve*`, which **query the configured
  DNS servers and bypass `/etc/hosts`** → hence `dns-preload.mjs` pointing the
  resolver at CoreDNS on `127.0.0.1:5354`.

## Platform notes (verified 2026-07 on Docker Desktop / macOS)

The HTTP + TLS targets (7 of the 10 modules: cert, health, cors, cookie, redirect,
protocol, security.txt) work end-to-end host-side. Two Docker-Desktop-on-macOS
quirks affect the rest — **neither is a defect in the range; both are Docker
Desktop networking/file-sharing behaviors that do not occur on Linux:**

1. **Bind mounts require a Docker-shared host path.** Docker Desktop shares
   `$HOME` (and a few system dirs) with its Linux VM but **not** arbitrary paths
   like external volumes under `/Volumes/…`. If mounts show up empty inside the
   containers (nginx serves nothing, `init-certs` produces no certs), either run
   the range from a copy under `$HOME`, or add the repo's path in
   **Docker Desktop → Settings → Resources → File sharing**.

2. **Host→container UDP DNS is unreliable; the 3 DNS modules need a working UDP
   path.** Published UDP ports (CoreDNS `5354/udp`) often time out from the mac
   host, while **TCP works and container-to-container UDP works**. Node's resolver
   uses UDP first, so the DNS modules (`dns_resolution`, `dns_caa`,
   `dns_email_security`) may fail to reach CoreDNS when the API runs on the mac
   host. Options: run the range/API on **Linux** (published UDP works there); or
   run the API **inside a container joined to `periscan-test-range_default`** and
   point `RANGE_DNS_SERVER=coredns:53` (container-to-container UDP is reliable) —
   this also mirrors the eventual in-network runner topology. Verify the zone
   itself with a container-network query:
   ```sh
   docker run --rm --network periscan-test-range_default alpine:3.20 \
     sh -c 'apk add -q bind-tools; dig @coredns cname dangling.range.test +short'
   ```
