# Connector Live Smoke Runbook

Operator runbook for verifying **real (non-mock) connector integrations** against
live vendor APIs in a disposable scratch tenant. This is the manual, off-CI
companion to the connector recorded-fixture contract tests: the contract tests
prove the connector handles a recorded vendor payload correctly; this runbook
proves the connector still authenticates and reads against the _live_ vendor API
today.

Covered connectors: `crowdstrike`, `splunk`, `sentinelone`, `palo-cortex-xdr`,
`palo-panorama`, `tenable`.

---

## 1. Purpose and safety

This procedure is **read-only validation only**. Every connector in scope is a
read connector: it authenticates, lists/searches, and returns normalized
evidence. It never writes, isolates, blocks, scans, remediates, or changes any
vendor configuration. See `SECURITY_BOUNDARIES.md` and `AGENTS.md` "Safety
Rules" — the same boundaries apply to this manual procedure:

- **Verified scope is required before validation starts.** Only run against an
  environment you are authorized to read. The control-validation path enforces a
  verified tenant scope (see §3.7); do not work around it.
- **Never run against a production tenant or production vendor credentials
  without explicit written authorization.** Use a scratch tenant and, where the
  vendor supports it, a scoped read-only API credential against a non-production
  or sandbox vendor environment.
- **No destructive actions, no persistence, no data exfiltration.** These
  connectors are read-only by design; do not extend them to do otherwise for a
  smoke run.
- **Secrets handling.** Vendor secrets (client secrets, API keys, tokens,
  secret keys, PAN-OS keys) are passed in the integration `config` at create
  time. Treat them like production secrets:
  - Pass them via shell variables sourced from a secret manager, never inline in
    shared shell history or committed files.
  - Periscan never returns secret-marked fields on read (`GET .../integrations/:id`
    serializes the record without re-emitting secret values), and connector
    error details are written to surface _status/class_, not credential
    material — keep it that way.
  - Revoke the scratch credential at the vendor side after the run (§5).
- **Audit.** Creating an integration writes an `integration.connected` audit
  event; a control validation runs through the standard mission/policy machinery
  and produces a validation run plus evidence. Do not bypass these.

---

## 2. Prerequisites

### 2.1 Running stack + scratch tenant

1. Bring up local dependencies and the app per `AGENTS.md`:

   ```bash
   export PERISCAN_POSTGRES_PUBLISHED_PORT=5434   # dodge a local 5432 conflict
   docker compose -f infra/docker-compose/docker-compose.yml up -d
   pnpm dev
   ```

   The API listens on `http://127.0.0.1:3001`. The Postgres internal hostname in
   compose is always `postgres`; only the _published_ port is remapped to 5434.
   If acceptance/verify hits DB auth early, set
   `DATABASE_URL` (or `PERISCAN_TEST_DATABASE_URL`) to a `...:5434...` URL — see
   `.env.example`.

2. Create (or reuse) a **scratch tenant** and a session/API credential. Sign up,
   then mint an API key for that tenant:

   ```bash
   API=http://127.0.0.1:3001

   # Sign up (returns a session cookie) — adapt to your existing tenant if you have one.
   curl -s -c cookies.txt -X POST "$API/api/v1/auth/signup" \
     -H 'content-type: application/json' \
     -d '{"email":"smoke@example.test","password":"<password>","tenantName":"connector-smoke-scratch"}'

   # Mint a tenant-scoped API key (psk_...) for the rest of the run.
   curl -s -b cookies.txt -X POST "$API/api/v1/tenants/current/api-keys" \
     -H 'content-type: application/json' -d '{"label":"connector-smoke"}'
   ```

   All subsequent calls authenticate with that key:

   ```bash
   export PSK="psk_xxxxxxxx"   # the key value returned above
   AUTH=(-H "authorization: Bearer $PSK")
   ```

   > API keys are bound to a single tenant and are recognized only when the
   > `Authorization: Bearer` value starts with `psk_`. A browser session cookie
   > works too, but a key is cleaner for scripted curl.

3. **Verify a scope** in the scratch tenant. Control validation (§3.7, observer
   path) requires at least one `Verified` scope in the tenant (a
   `ControlSource`-type verified scope is preferred). Create and verify a scope
   before running a control validation; health and sync do not require it.

### 2.2 Environment for credential encryption

Integration `config` (including secret fields) is stored on the integration
record. Provision the integration-credential encryption key the same way the
model gateway key is provisioned in `.env.example`:

```bash
export PERISCAN_INTEGRATION_CREDENTIAL_KEY="<base64-32-byte-key>"   # AES-256-GCM, 32 bytes
```

> Note: production refuses to encrypt connector credentials without
> `PERISCAN_INTEGRATION_CREDENTIAL_KEY`; it does not fall back to the session or
> model-provider key. In a local scratch run, the value is never logged and never
> returned on read regardless. Never commit it.

---

## 3. Per-vendor verification

Each section lists the exact auth fields (from the connector manifest in
`packages/connectors/src/index.ts`), the minimal read-only vendor permission,
and the create → health → sync → (observer) validate steps.

### Common create/health/sync pattern

Create an integration with the right `connectorKey`, `authType` (the manifest
auth-method `kind`), and a `config` containing exactly the manifest fields:

```bash
# Returns 201 with the integration; capture its id.
ID=$(curl -s "${AUTH[@]}" -X POST "$API/api/v1/integrations" \
  -H 'content-type: application/json' \
  -d "$CREATE_BODY" | python3 -c 'import sys,json;print(json.load(sys.stdin)["integrationId"])')

# Health check: runs the manifest healthCheckMethod against the live API.
curl -s "${AUTH[@]}" "$API/api/v1/integrations/$ID/health"

# Sync: pulls normalized signals/evidence from the live API.
curl -s "${AUTH[@]}" -X POST "$API/api/v1/integrations/$ID/sync"
```

A healthy health-check response carries `health.status` of `Healthy`
(`Unknown` before the first check; `Unhealthy`/`Degraded` on failure) plus the
resolved `manifest`. Do **not** set `mockMode` and do **not** select the `mock`
auth method — that is the point of a live smoke.

For the **observer** connectors (CrowdStrike, Splunk, SentinelOne, Cortex XDR,
Panorama), also run a control validation (§3.7) to exercise `observeControl`.

---

### 3.1 CrowdStrike Falcon — `crowdstrike`

- **Auth method (`authType`):** `oauth2ClientCredentials` (manifest label
  "Falcon OAuth2 Client Credentials").
- **Config fields:**
  - `clientId` — Falcon API client ID _(required)_
  - `clientSecret` — Falcon API client secret _(required, secret)_
  - `baseUrl` — Falcon API base URL _(optional; defaults to
    `https://api.crowdstrike.com`; use your cloud's host, e.g.
    `https://api.us-2.crowdstrike.com`)_
  - `detectionFilter` — read-only FQL detection filter _(optional)_
- **Minimal vendor scopes:** `detections:read`, `hosts:read` on the Falcon API
  client. No write/RTR/containment scopes.
- **Health:** Falcon OAuth2 token verification (`POST /oauth2/token`).

```bash
CREATE_BODY=$(cat <<JSON
{"connectorKey":"crowdstrike","authType":"oauth2ClientCredentials",
 "config":{"clientId":"$CS_CLIENT_ID","clientSecret":"$CS_CLIENT_SECRET",
           "baseUrl":"https://api.us-2.crowdstrike.com"}}
JSON
)
```

Healthy result: health `status: "Healthy"` with a Falcon detection-summary
detail; sync returns Falcon detection/prevention signals.

---

### 3.2 Splunk — `splunk`

- **Auth method (`authType`):** `apiToken` (manifest label "Splunk API Token").
- **Config fields:**
  - `baseUrl` — Splunk REST base URL _(required)_, e.g.
    `https://<host>:8089`
  - `token` — Splunk API/REST token (Bearer) _(required, secret)_
  - `index` — default index to search _(optional)_
  - `searchQuery` — explicit read-only SPL to run _(optional)_
  - `earliestTime` / `latestTime` — search time bounds _(optional; default
    `-24h` / `now`)_
- **Minimal vendor scope:** `search:read` (a role/token allowed to run searches
  over the target index). No admin/edit capabilities.
- **Health:** `GET /services/server/info`.

```bash
CREATE_BODY=$(cat <<JSON
{"connectorKey":"splunk","authType":"apiToken",
 "config":{"baseUrl":"https://splunk.example.test:8089","token":"$SPLUNK_TOKEN",
           "index":"main","earliestTime":"-24h","latestTime":"now"}}
JSON
)
```

Healthy result: health `status: "Healthy"`. The observer runs a read-only
search (`POST /services/search/jobs/export`, `... | head 1`) and classifies
`Logged` vs `NoEvidence`.

---

### 3.3 Palo Alto Cortex XDR — `palo-cortex-xdr`

- **Auth method (`authType`):** `apiToken` (manifest label "Cortex XDR API Key").
- **Config fields:**
  - `baseUrl` — Cortex XDR API base URL _(required)_, the tenant FQDN
    (e.g. `https://api-<tenant>.xdr.<region>.paloaltonetworks.com`)
  - `apiKey` — Cortex XDR **standard** API key _(required, secret)_
  - `xdrAuthId` — the API Key **ID** for that key _(required)_
  - `creationTimeGte` / `modificationTimeGte` — epoch-ms lower bounds _(optional)_
  - `incidentStatuses` — list of statuses to filter _(optional)_
  - `alertSources` — list of alert sources to filter _(optional)_
- **Minimal vendor permission:** Cortex XDR **incidents read** (standard API key
  role limited to incident read). Periscan does not update incidents, isolate
  endpoints, run scripts, manage policy, or take any response action.
- **Health:** Cortex XDR incidents read-only search.

```bash
CREATE_BODY=$(cat <<JSON
{"connectorKey":"palo-cortex-xdr","authType":"apiToken",
 "config":{"baseUrl":"https://api-tenant.xdr.us.paloaltonetworks.com",
           "apiKey":"$CORTEX_API_KEY","xdrAuthId":"$CORTEX_KEY_ID"}}
JSON
)
```

Healthy result: health `status: "Healthy"`. The observer reads incidents and
classifies `Detected`/`Blocked`/`Missed`/`NoEvidence`.

---

### 3.4 Palo Alto Panorama / PAN-OS — `palo-panorama`

- **Auth method (`authType`):** `apiKey` (manifest label "PAN-OS API Key").
- **Config fields:**
  - `baseUrl` — Panorama API base URL _(required)_, e.g.
    `https://panorama.example.test` (connector appends `/api/`)
  - `apiKey` — PAN-OS XML API key _(required, secret)_
  - `logType` — `threat` (default), `traffic`, or `url` _(optional)_
  - `query` — read-only log query filter _(optional)_
  - `limit` — max log entries (1–50) _(optional)_
- **Minimal vendor permission:** PAN-OS XML API **log read** (an admin role /
  API key with logs/report read access). Periscan does not run operational
  commands, commit, modify policy, update objects, or change configuration.
- **Health:** PAN-OS XML API read-only log retrieval.

```bash
CREATE_BODY=$(cat <<JSON
{"connectorKey":"palo-panorama","authType":"apiKey",
 "config":{"baseUrl":"https://panorama.example.test","apiKey":"$PANOS_API_KEY",
           "logType":"threat","limit":10}}
JSON
)
```

Healthy result: health `status: "Healthy"`. The observer retrieves
traffic/threat/URL logs and classifies the firewall verdict
(`Detected`/`Blocked`/`Missed`/`NoEvidence`).

---

### 3.5 SentinelOne Singularity — `sentinelone`

- **Auth method (`authType`):** `apiToken` (manifest label "SentinelOne API
  Token").
- **Config fields:**
  - `baseUrl` — SentinelOne management console URL _(required)_, e.g.
    `https://<your-instance>.sentinelone.net`
  - `apiToken` — SentinelOne API token (Bearer) _(required, secret)_
  - `query` — read-only threats query filter _(optional)_
  - `siteIds` / `accountIds` / `groupIds` — scope the threats query to specific
    sites/accounts/groups _(optional)_
- **Minimal vendor permission:** Threats **read** (a Viewer / read-only API
  token). Periscan does not mitigate, isolate, kill, or change agent/policy
  configuration.
- **Health:** SentinelOne threats API read.

```bash
CREATE_BODY=$(cat <<JSON
{"connectorKey":"sentinelone","authType":"apiToken",
 "config":{"baseUrl":"https://example.sentinelone.net","apiToken":"$S1_API_TOKEN"}}
JSON
)
```

Healthy result: health `status: "Healthy"`. Sync imports normalized endpoint
threat signals (with extracted MITRE technique ids + host hints); the observer
reads recent threats and classifies the endpoint verdict
(`Detected`/`Blocked`/`Missed`/`NoEvidence`).

---

### 3.6 Tenable Vulnerability Management — `tenable`

- **Auth method (`authType`):** `apiKeys` (manifest label "Tenable API Keys").
- **Config fields:**
  - `accessKey` — Tenable access key _(required, secret)_
  - `secretKey` — Tenable secret key _(required, secret)_
  - `apiBaseUrl` — API base URL _(optional; defaults to
    `https://cloud.tenable.com`)_
  - `assetLimit` — max assets (1–500, default 100) _(optional)_
  - `vulnerabilityLimit` — max vulnerabilities (1–500, default 100) _(optional)_
- **Minimal vendor scopes:** `workbenches:read`, `assets:read`,
  `vulnerabilities:read`. Periscan does not start scans, export raw findings, or
  change Tenable configuration.
- **Health:** Tenable Workbenches read-only asset summary.

```bash
CREATE_BODY=$(cat <<JSON
{"connectorKey":"tenable","authType":"apiKeys",
 "config":{"accessKey":"$TENABLE_ACCESS_KEY","secretKey":"$TENABLE_SECRET_KEY",
           "assetLimit":50,"vulnerabilityLimit":50}}
JSON
)
```

Healthy result: health `status: "Healthy"`. Sync imports normalized asset and
vulnerability (exposure) signals — Tenable is an exposure/asset connector, not a
control observer, so there is **no** control-validation step for it.

---

### 3.7 Control validation (observer connectors only)

For the five observer connectors (CrowdStrike, Splunk, SentinelOne, Cortex XDR,
Panorama), exercise the live `observeControl` path:

1. Create a **control source** bound to the integration:

   ```bash
   CS_ID=$(curl -s "${AUTH[@]}" -X POST "$API/api/v1/control-sources" \
     -H 'content-type: application/json' \
     -d "{\"integrationId\":\"$ID\",\"controlType\":\"EDR\",
          \"provider\":\"<vendor>\",\"expectedBehaviors\":[\"Detected\"]}" \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["controlSourceId"])')
   ```

2. Run a **dry-run** validation. The control-plane API only accepts dry-run
   here (`executionMode: "DryRun"`); `LiveRunner`/`dryRun:false` is rejected with
   `control_live_execution_disabled` (inject loop not available — dry-run is
   telemetry-only observation, not a closed inject-measure claim; Atomic remains
   dry-run scenario import, not live inject BAS). Dry-run still
   calls the connector's live `observeControl`, attaches the observed verdict as
   an evidence-linked `ControlObservation` signal, and updates the control
   source's health.

   ```bash
   curl -s "${AUTH[@]}" -X POST "$API/api/v1/control-sources/$CS_ID/validate" \
     -H 'content-type: application/json' \
     -d '{"executionMode":"DryRun","techniqueId":"T1059","fixtureOutcome":"Detected"}'
   ```

   This requires a `Verified` tenant scope (§2.1). A healthy run returns a
   validation run whose `validationState` reflects the live observer verdict
   (`Detected`/`Blocked`/`Logged`/`Alerted`/`Missed`) and whose `evidence`
   includes a `NormalizedEvidence` artifact with the connector's
   `sourceType`/`detail`. The control source's `healthStatus` becomes `Healthy`
   unless the verdict was `Missed`/`NoEvidence`/`NeedsTuning` (→ `Degraded`).

---

## 4. Troubleshooting

Connector HTTP calls go through `connectorFetch`
(`packages/connectors/src/http.ts`), which times out per attempt (15s default),
retries transient failures with exponential backoff, and honors `Retry-After` on 429. Non-recoverable failures surface as a typed `ConnectorHttpError` with a
coarse `kind`. Map symptoms to that taxonomy:

| Symptom in health/sync/validate detail                                                           | `ConnectorHttpError.kind`        | Cause / fix                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Falcon OAuth returned status 401/403`, `... returned status 401`, observer authorization failed | `client` (4xx, **not retried**)  | Bad/expired credential, wrong key ID, or missing read scope. Re-mint the vendor credential with the minimal read scopes in §3. 4xx other than 429 is handed back to the connector, which reports the status in its detail. |
| `rate limited (HTTP 429)`                                                                        | `rate_limited`                   | Vendor throttling. `connectorFetch` already retries honoring `Retry-After` (clamped to 30s); if it still fails, slow the run or lower `limit`/`assetLimit`/`vulnerabilityLimit`.                                           |
| `server error (HTTP 5xx)`                                                                        | `server` (retried, then thrown)  | Vendor-side outage or a wrong `baseUrl` hitting an unexpected service. Verify the base URL/region host.                                                                                                                    |
| `network error: ...`                                                                             | `network` (retried, then thrown) | DNS, TLS, or connectivity failure — often a typo in `baseUrl`, an unreachable on-prem host (Splunk `:8089`, Panorama), or egress firewall. Confirm the host is reachable from the API process.                             |
| `request timed out after 15000ms`                                                                | `timeout` (**never retried**)    | Slow or hung vendor endpoint. Re-run; if persistent, check the host and any proxy.                                                                                                                                         |
| `... returned no matching ... evidence` / `NoEvidence` outcome                                   | n/a (HTTP succeeded)             | Auth worked but the query matched nothing. For an observer smoke this is acceptable — it proves connectivity; widen the time window (`earliestTime`) or filter to confirm.                                                 |
| `verified_scope_required` on validate                                                            | n/a (Periscan policy)            | The tenant has no `Verified` scope. Create/verify a scope (§2.1).                                                                                                                                                          |
| `control_live_execution_disabled` on validate                                                    | n/a (Periscan policy)            | You sent `LiveRunner` or `dryRun:false`. Inject loop not available on control plane; dry-run is telemetry-only observation (not closed inject-measure). Atomic is dry-run import only (not live inject BAS). Next step: use `executionMode:"DryRun"` / Observe telemetry, or an approved endpoint benign-marker mission — never treat this as live Atomic/BAS inject. |
| `connector_not_connectable` on create                                                            | n/a                              | Connector availability is `Planned` or not connectable; not in scope for a live smoke.                                                                                                                                     |

Connector error details intentionally carry the status/class, not credential
material — never paste a raw secret into an issue when reporting one of these.

---

## 5. Cleanup

Delete the scratch integration (cascades the control source / signals tied to
the scratch tenant data you created) and revoke the vendor credential:

```bash
# Delete the scratch integration (204 No Content).
curl -s "${AUTH[@]}" -X DELETE "$API/api/v1/integrations/$ID" -o /dev/null -w '%{http_code}\n'
```

Then:

- Revoke / delete the vendor-side scratch credential (Falcon API client, Splunk
  token, Cortex XDR API key, PAN-OS key, Tenable access/secret key pair).
- Remove the `PSK` API key from the scratch tenant if it is no longer needed.
- Clear local secret shell variables and `cookies.txt`.
- If the scratch tenant itself is disposable, tear it down per your tenant
  lifecycle process.
