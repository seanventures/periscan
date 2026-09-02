# Measured Test Range

**Status:** first concrete increment of **WS1 — Measured Proof Loop**
(`docs/PRODUCTION_READINESS_PLAN.md`).

**Scaffold:** `infra/test-range/` (`docker compose up`).

**Extension (continuous-loop multi-hop / runners / mock SIEM):** see
[`docs/LAB_DESIGN_CONTINUOUS_LOOP.md`](LAB_DESIGN_CONTINUOUS_LOOP.md) and
[`infra/lab/README.md`](../infra/lab/README.md) — Phase 1–2 lab scaffold
(multi-tier, dual-site runners, mocksiem + Splunk export canaries). Full
FullyMeasured multi-hop still requires plant-runner hop measure + golden path.

---

## 1. Purpose

Periscan's product claim is *"we measured it — here's the evidence."* For that
claim to be true, the built-in measured modules must produce **real,
non-fixture** results (`evidenceBasis=Measured`) against targets whose posture is
**known and reproducible**, so we can assert:

- an exposed target measures as an **exposure** (`validationState=Validated`,
  an `Exposure`-category signal is emitted), and
- after the target is hardened, a re-run measures the same dimension as **Fixed**
  (no exposure signal) — the **honest closed-loop verification**.

Fixtures prove the parsing/branching logic; they cannot prove the *probes* work.
The test range closes that gap with deterministic, self-contained targets that
exercise the **existing** measured modules over real TLS handshakes, real HTTP
requests, and real DNS queries — no cloud, no secrets, no internet dependency.

---

## 2. The measured modules being exercised

`MEASURED_POSTURE_MODULE_IDS` (`apps/api/src/runtime-services.ts`) is the list of
built-in checks run by `runScopePostureChecks`
(`apps/api/src/services/scopes.ts`). Each runs live via `executeInlineValidation`
with `target = { hostname: scope.value }` (no port/URL override on the posture
path — see §5). Exposure vs. Fixed for each:

| Module id | Probe (live) | Measures **Validated** (exposure) when… | Measures **Fixed** when… |
|---|---|---|---|
| `periscan.tls_certificate_check` | `tls.connect(host:443)`, reads peer cert (`rejectUnauthorized:false`) | expired / not-yet-valid / self-signed / hostname-mismatch / expiring-soon | valid CA cert covering the host, not near expiry |
| `periscan.tls_protocol_audit` | pinned TLS 1.0 & 1.1 handshakes on :443 | a deprecated protocol is **negotiated** | both deprecated protocols **rejected** (else `Inconclusive`) |
| `periscan.http_health_check` | `fetch https://host` | final URL downgrades to `http://`, or a required security header (HSTS/CSP/X-Content-Type-Options/X-Frame-Options) is missing | 2xx with all four headers, no downgrade |
| `periscan.http_cookie_security` | `fetch https://host`, inspects `Set-Cookie` | a cookie is missing `Secure`/`HttpOnly`/`SameSite` | every cookie has all three (no cookies → `Inconclusive`) |
| `periscan.http_redirect_enforcement` | `fetch http://host` (no-follow) | cleartext response is not a 3xx redirect to an `https://` URL | 3xx → `https://…` |
| `periscan.http_cors_audit` | `fetch https://host` with `Origin: https://cors-probe.periscan.dev` | `Access-Control-Allow-Origin` reflects the probe origin, or `*` **with** credentials | not reflected (a bare `*` without credentials is treated as an intentional public-API pattern → Fixed) |
| `periscan.dns_resolution_check` | `dns.resolve4/6/cname(host)` | a CNAME resolves to **no** address (dangling → subdomain-takeover precondition) | resolves to ≥1 address (no address, no CNAME → `Inconclusive`) |
| `periscan.dns_caa_check` | `dns.resolveCaa(host)` | **no** CAA record (any CA may issue) | ≥1 CAA `issue`/`issuewild` authorization |
| `periscan.dns_email_security_check` | `dns.resolveTxt(host)` + `_dmarc.host` | missing SPF, `+all` SPF, missing DMARC, or DMARC `p=none` | SPF present (not `+all`) **and** DMARC `p=quarantine|reject` |
| `periscan.well_known_security_txt` | `fetch https://host/.well-known/security.txt` | *never an exposure* — informational `ControlObservation` | n/a (`Detected` when present, `Inconclusive` when absent) |

> **security.txt is informational.** A missing security.txt emits a
> `ControlObservation` signal, **not** an `Exposure`, so the posture path's
> `exposure` flag never trips on it. We still exercise both variants to prove the
> live probe, but it is not part of the exposed↔Fixed exposure loop.

---

## 3. Probe transport — the two DNS realities that shape the range

Two different resolution paths are in play, and the range accommodates both:

- **TLS + HTTP modules** use `tls.connect` (via `net`) and `fetch` (via
  `undici`), which resolve through `dns.lookup` → `getaddrinfo` → **honors
  `/etc/hosts`.** So range hostnames are mapped to `127.0.0.1` in `/etc/hosts`
  and nginx serves them on published ports 80/443 (routing by SNI /
  `server_name`).
- **DNS modules** (`resolution`, `caa`, `email`) use `node:dns/promises`
  `resolve4/6/cname/caa/txt`, which query the **configured DNS servers directly
  and bypass `/etc/hosts`.** So they need a real authoritative resolver — the
  range runs **CoreDNS** serving a `range.test` zone, and the API process points
  its resolver at it (see §5).

**TLS verification caveat (`fetch`).** `undici` validates the server certificate.
An expired / self-signed cert makes the HTTP-based modules
(`http_health/cookie/cors`) throw → `Inconclusive` ("unreachable"), *not*
`Validated`. Therefore:

- The **HTTP hosts serve a certificate signed by the range's local test CA**, and
  the API trusts that CA via `NODE_EXTRA_CA_CERTS` (see §5). `fetch` succeeds; the
  HTTP exposure is measured honestly.
- The **TLS-certificate exposure** (expired/self-signed) lives on its **own
  dedicated host** (`cert.range.test`), because `tls_certificate_check` reads the
  cert with `rejectUnauthorized:false` and does not care that it is untrusted,
  whereas the HTTP modules would break on it.

---

## 4. Target matrix

The range stands up **one nginx** (HTTP/TLS targets, multiple `server_name`
vhosts) and **one CoreDNS** (`range.test` zone). Every target has an **exposed**
and a **hardened** variant, selected by a single environment variable
`RANGE_PROFILE` (`exposed` — default — or `hardened`). Flipping the profile and
`docker compose up -d` re-serves the *same hostname* with the hardened posture —
that is the closed-loop remediation.

Three scopes drive the loop; each isolates the dimensions it can serve cleanly:

### Scope A — `app.range.test` (always CA-trusted cert so `fetch` works)

| Module | exposed → | hardened → |
|---|---|---|
| `tls_protocol_audit` | offers TLS 1.0/1.1 → **Validated** *(best-effort, see §6)* | TLS 1.2+ only → Fixed / Inconclusive |
| `http_health_check` | 200, **no** security headers → **Validated** | 200 + HSTS/CSP/XCTO/XFO → **Fixed** |
| `http_cors_audit` | `ACAO: $http_origin` (reflects probe origin) → **Validated** | no CORS header → **Fixed** |
| `http_cookie_security` | `Set-Cookie: session=…` (bare) → **Validated** | `…; Secure; HttpOnly; SameSite=Lax` → **Fixed** |
| `http_redirect_enforcement` | `http://` serves 200 → **Validated** | `http://` → 301 `https://` → **Fixed** |
| `dns_caa_check` | no CAA record → **Validated** | `CAA 0 issue "letsencrypt.org"` → **Fixed** |
| `dns_email_security_check` | no SPF/DMARC TXT → **Validated** | SPF `-all` + DMARC `p=reject` → **Fixed** |
| `well_known_security_txt` | 404 → `Inconclusive` (informational) | 200 w/ Contact → `Detected` |
| `tls_certificate_check` | valid CA cert → **Fixed** (both profiles; cert loop lives on Scope B) |
| `dns_resolution_check` | A record present → **Fixed** (both; dangling loop lives on Scope C) |

### Scope B — `cert.range.test` (TLS-certificate loop)

| Module | exposed → | hardened → |
|---|---|---|
| `tls_certificate_check` | **expired** (backdated) cert → **Validated** (`tls_certificate_expired`) | valid CA cert covering host → **Fixed** |

*(HTTP modules against `cert.range.test` in the exposed profile are `Inconclusive`
by design — `fetch` refuses the expired cert. That is expected, not a bug.)*

### Scope C — `dangling.range.test` (DNS-resolution loop, DNS-only host)

| Module | exposed → | hardened → |
|---|---|---|
| `dns_resolution_check` | `CNAME → ghost.range.test` (no A) → **Validated** (`dns_dangling_cname`) | `A 127.0.0.1` → **Fixed** |

---

## 5. Pointing Periscan at the range and running a LIVE posture check

Prerequisites once the range is up (`infra/test-range/README.md` has the copy-paste
version):

1. **`/etc/hosts`** — so `fetch`/`tls.connect` (`dns.lookup`) reach nginx:
   ```
   127.0.0.1 app.range.test cert.range.test dangling.range.test ghost.range.test
   ```
2. **API DNS resolver → CoreDNS** — so the DNS modules' `dns.resolve*` hit the
   range zone. The range ships `infra/test-range/dns-preload.mjs`, a preload that
   calls `dns.setServers(["127.0.0.1:5354"])` on the default resolver used by
   `node:dns/promises`. Run the API with:
   ```
   NODE_OPTIONS="--import /ABS/infra/test-range/dns-preload.mjs" \
   NODE_EXTRA_CA_CERTS="/ABS/infra/test-range/certs/ca.crt" \
   pnpm --filter @periscan/api dev
   ```
   CoreDNS forwards non-`range.test` queries upstream, so real DNS still works
   during the session.

   > **Docker Desktop / macOS caveat (verified):** host→container **UDP** port
   > publishing is unreliable there, so the mac host may not reach CoreDNS on
   > `127.0.0.1:5354/udp` even though TCP and container-to-container UDP both
   > work — the 3 DNS modules then can't resolve. Run on **Linux** (published UDP
   > works), or run the API **inside a container on `periscan-test-range_default`**
   > with `RANGE_DNS_SERVER=coredns:53`. The HTTP/TLS modules (the other 7) are
   > unaffected. See `infra/test-range/README.md` → *Platform notes*.
3. **A verified Domain/Subdomain scope.** `runScopePostureChecks` requires
   `scopeType ∈ {Domain, Subdomain}` and `verificationStatus === "Verified"`.
   Verification is a DNS TXT check (`_periscan.<host>` containing
   `periscan-verification=<token>` — `apps/api/src/scope-verification.ts`); the
   CoreDNS zone can carry that TXT (drop in the scope's token), or in dev set
   `verificationStatus=Verified` directly on the row.

Then run **live** (not fixture) posture checks:

```
POST /api/v1/scopes/{scopeId}/posture-check
{ "executionMode": "LiveSafe" }
```

`executionMode: "LiveSafe"` forces the real network path even in dev
(`useFixture = devMode && executionMode !== "LiveSafe"` in `scopes.ts`). In
production the checks are always live; fixture requests are rejected outside dev.
The response is a per-module array of `{ moduleId, outcome, validationState,
exposure, signalCount }`. Each module persists a `PolicyDecision` +
`ValidationRun` + `NormalizedEvidence` with `evidenceBasis=Measured` and
`attributes.measured=true`, so the finding is genuinely earned, not asserted.

### Runner (in-network) path — note for later

The posture path above runs modules in-process (`executionEnvironment:
"ControlPlane"`) — sufficient for this range since the targets are reachable from
the control plane on localhost. WS1's fuller ambition is the **runner-executed**
path (`apps/api/src/services/runner.ts`): the control plane leases a signed
`RunnerTask` envelope (`executionEnvironment: "InternalRunner"`) to a runner
inside the target network, which returns **signed** evidence the control plane
verifies (signature + provenance). This same range is the target a local runner
would validate against; standing up a runner container that polls
`pollRunnerTasks` and executes the same modules is the natural next increment.

---

## 6. Closed-loop story (the honest verification)

For each scope:

1. **Exposed run.** `RANGE_PROFILE=exposed docker compose up -d`; run the live
   posture check. The dimension's module returns `validationState=Validated` with
   an `Exposure`-category signal → a **measured finding**.
2. **Remediate.** `RANGE_PROFILE=hardened docker compose up -d` re-serves the
   *same hostname* with the hardened posture (real cert, headers, CAA record,
   SPF/DMARC, resolving A record, …).
3. **Fix-verification run.** Re-run the same live posture check. The module now
   returns `validationState=Fixed` with **no** exposure signal → the finding
   measures as honestly closed.

Because both runs are `evidenceBasis=Measured` against a target whose posture we
physically changed, the Fixed verdict is *earned by measurement*, which is exactly
the WS1 invariant: every conclusion traces to evidence.

---

## 7. Known limitation — deprecated TLS protocols

`tls_protocol_audit` needs the target to actually **negotiate** TLS 1.0/1.1.
Modern nginx builds link OpenSSL 3, which disables TLS 1.0/1.1 by default and at
`SECLEVEL≥1`. The range lowers this with a mounted `openssl-legacy.cnf`
(`MinProtocol = TLSv1`, `CipherString = DEFAULT@SECLEVEL=0`) and legacy
`ssl_ciphers`, applied via `OPENSSL_CONF`. If the platform's OpenSSL still refuses
the handshake, the module reports `Inconclusive` — **it never reports a false
pass** (by design). This is the one best-effort dimension; every other target is
deterministic.
