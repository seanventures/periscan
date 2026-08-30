# Periscan automation surface (external-facing)

Thin reference for integrators. **Real-first:** only routes and events that
ship in OpenAPI and the live event catalog. No full-BAS, cert theater, or
fictional rate/SLA claims.

## OpenAPI

| Item | Value |
| --- | --- |
| Spec URL | `GET /openapi.json` (also proxied as `/api/v1` product docs via `/api-reference`) |
| Documented version | **0.4.0** (`info.version` in OpenAPI; keep in sync with `docs/CHANGELOG-API.md`) |
| Auth schemes | Bearer `psk_…` API keys; browser `periscan_session` cookie (documented, not for machine clients) |
| Changelog | [`docs/CHANGELOG-API.md`](../CHANGELOG-API.md) |

```bash
# Discover the contract without guessing
curl -sS "$PERISCAN_API_URL/openapi.json" | jq '.info.version, .paths | keys | length'
```

Proof-loop sample (local/dev): [`examples/proof-loop.sh`](../../examples/proof-loop.sh)
uses the mounted OpenAPI document — not non-mounted lab capability stubs.

## Event catalog (webhooks)

Discoverable runtime catalog (admin or `webhook:admin` capability):

```http
GET /api/v1/tenants/current/webhooks/event-catalog
Authorization: Bearer psk_…
```

Response includes:

- `eventTypes` — the nine product `WebhookEventType` values
- `headers` — signature / event / delivery / idempotency header names
- `signatureFormat` — `sha256=<hex>` over the raw body with `whsec_…`
- `bodyFields` — envelope fields common to every delivery
- `eventDataSummaries` — per-event `data` field lists for receiver codegen

### Event types (canonical)

| Event | Intent |
| --- | --- |
| `mission.started` | Validation mission queued after policy allow |
| `mission.completed` | Mission finished successfully |
| `mission.failed` | Mission failed (see `data` for code/reason) |
| `snapshot.ready` | Validation snapshot / evidence pack ready |
| `remediation.created` | Remediation ticket created |
| `remediation.verified` | Fix verification event (Fixed only via re-measure) |
| `finding.disposition_changed` | Analyst disposition set/cleared |
| `policy.denied` | Policy denied a start/hop/action |
| `schedule.failed` | Recurring schedule fire failed |

Secret material (`whsec_…`) is returned **once** on create/rotate — never listed back.

Admin UI surfaces the same catalog under **Admin → Webhooks** (receiver contract +
data field chips). Prefer the live catalog over hard-coded help copy.

## Least-privilege API key matrix

Scopes are minted under `POST /api/v1/tenants/current/api-keys`. Capability
expansion is authoritative for API keys; role mapping is the **minimum** role
needed so `requireRole` does not over-block fine-grained keys.

| Scope(s) | Mapped role | Capabilities (expanded) | Typical use |
| --- | --- | --- | --- |
| `read` | Viewer | read | Poll missions, findings, snapshots |
| `write` | SecurityEngineer | `mission:run` + `remediation:write` (+ read) | Mutating automation |
| `mission:run` | SecurityEngineer | `mission:run` | Create/start missions only |
| `remediation:write` | SecurityEngineer | `remediation:write` | Remediation verify / ticket write |
| `webhook:admin` | **Viewer** | `webhook:admin` only | Manage outbound webhooks + event-catalog |
| `audit:read` | Admin | `audit:read` | Audit list/export (admin surface) |
| `admin` | Admin | all | Coarse break-glass — prefer finer scopes |

### Hard rules (do not invent otherwise)

1. **`webhook:admin` alone does not elevate to Admin.** It cannot list API keys,
   create missions, or export audit. Capability checks deny those surfaces with
   `403 api_key_capability_denied`.
2. **`createMission` / start mission** require `mission:run` (or coarse
   `write` / `admin`) for API keys. Session users still use membership roles.
3. **Webhook admin** for API keys is capability-gated (`requireWebhookAdminAccess`);
   session users need a tenant admin role.
4. API keys bind a **single tenant** and ignore tenant-switch headers.

Acceptance coverage: `tests/acceptance/api-key-webhook-admin-least-privilege-flow.test.ts`
and unit tests on `apiKeyRoleForScopes` in `apps/api/src/runtime-services.test.ts`.

## Minimal webhook receiver sketch

```bash
# 1) Mint a least-privilege key (session cookie / owner)
curl -sS -X POST "$PERISCAN_API_URL/api/v1/tenants/current/api-keys" \
  -H "Cookie: periscan_session=…" \
  -H "Content-Type: application/json" \
  -d '{"name":"hooks-only","scopes":["webhook:admin"]}'

# 2) Read catalog (headers + data field summaries)
curl -sS -H "Authorization: Bearer $PSK" \
  "$PERISCAN_API_URL/api/v1/tenants/current/webhooks/event-catalog" | jq .

# 3) Create subscription (secret shown once)
curl -sS -X POST -H "Authorization: Bearer $PSK" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://hooks.example.com/periscan","events":["mission.completed","remediation.verified"]}' \
  "$PERISCAN_API_URL/api/v1/tenants/current/webhooks"
```

Verify `x-periscan-signature` = `sha256=<hex>` of the raw body with the one-time
`whsec_…` secret. Use delivery / idempotency headers for retries.

## Honesty boundaries

- No public soak/SLA numbers in this readme — see ops prep docs under `docs/qa/`
  for internal health probes only.
- No claim of full ATT&CK BAS, live ransomware, or formal certification via
  webhooks or API keys.
- Pagination envelopes differ by route; OpenAPI documents each `operationId`
  honestly (not one universal list envelope).

## Related

- Product OpenAPI: `GET /openapi.json`
- In-app API reference: `/api-reference`
- Admin webhooks panel: `/admin` (Webhooks section)
- Changelog: `docs/CHANGELOG-API.md`
- Safety: `SECURITY_BOUNDARIES.md`
