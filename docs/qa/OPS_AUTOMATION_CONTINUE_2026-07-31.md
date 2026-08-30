# Ops + automation ICP residual continue — 2026-07-31 (PERISCAN-13)

**Agent:** ops residual + ICP automation leftovers  
**Goal:** Boring automation contract honesty for VP Eng / automation ICP and ops prep evidence — **without inventing load/soak numbers**.

---

## 1. What shipped this session

| # | Residual | Ship | Evidence |
|---|----------|------|----------|
| 1 | List envelope honesty (P20-2) | **Confirmed closed** — no contract change | Runtime honors `?limit=` on `listAttackPaths` / `listRemediations` (default 50, max 200, bare `{ items }`); `listFindings` keeps offset `page` envelope. OAS + coverage + inject tests already pin honesty. Comments cite P20-2. |
| 2 | Load/soak prep (no fake SLAs) | **Shipped prep harness** | `scripts/ops-soak-prep.sh` + `docs/qa/OPS_SOAK_PREP.md` — health/ready/OpenAPI/(optional) `/me` only; artifact always `productionScaleClaimValidated: false`, `loadOrSoakCompleted: false`, `slaClaims: []` |
| 3 | Webhook event-catalog + typed payloads test gap | **HTTP acceptance closed** | `tests/acceptance/api-key-webhook-admin-least-privilege-flow.test.ts` asserts catalog 9 events + `eventDataSummaries` + header contract + no secrets; unit coverage remains in `packages/webhooks/src/event-payloads.test.ts` |
| 4 | `webhook:admin` → not Admin (ICP-P1-9) | **HTTP acceptance closed** (unit already existed) | Same test: `/me` role `Viewer`; catalog + list webhooks 200; list API keys 403; audit list 403 `api_key_capability_denied`; create mission 403 |

### Tests run (local)

```text
DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm exec vitest run \
  tests/acceptance/api-key-webhook-admin-least-privilege-flow.test.ts \
  packages/webhooks/src/event-payloads.test.ts
→ 2 files, 6 tests passed
```

Unit map (already on tip, re-asserted by acceptance):

- `apps/api/src/runtime-services.test.ts` — `apiKeyRoleForScopes(["webhook:admin"]) === "Viewer"`
- `apps/api/src/app.test.ts` — event-catalog inject + path/remediation `?limit=` slice
- `apps/api/src/openapi-coverage.test.ts` — bare `{ items }` for paths/remediations; offset page for findings

---

## 2. Contract truth table (automation consumers)

| operationId | Envelope | Query | Notes |
|-------------|----------|-------|-------|
| `listFindings` | `{ items, page: { hasMore, limit, offset } }` | `limit`, `offset`, filters | Offset-paginated; clients must use `page.hasMore` |
| `listAttackPaths` | `{ items }` only | optional `limit` (def 50, max 200) | **Limit-capped, not paginated** (P20-2 honesty) |
| `listRemediations` | `{ items }` only | optional `limit` (def 50, max 200) | Same as paths |
| `getWebhookEventCatalog` | catalog DTO | — | 9 event types + progressive `eventDataSummaries` + HMAC header names; admin / `webhook:admin` |
| API key `webhook:admin` alone | role = **Viewer** | — | Capability gate for webhooks; **not** full Admin |

Docs already aligned: `docs/CHANGELOG-API.md` 0.3.x residual, `docs/API_UI_INTEGRATION.md` Pagination + scopes.

---

## 3. Forbidden / honesty floors (unchanged)

- **No fake soak numbers** in `docs/qa/analyst-scorecard.json` or release memos.
- Prep script **must not** be cited as soak completion or ops row 107 capacity proof.
- Do **not** invent offset `page` envelopes on paths/remediations without a real product pagination design (would break bare-`items` clients).
- Do **not** re-elevate `webhook:admin` → Admin in `apiKeyRoleForScopes`.

---

## 4. How to use the soak prep (ops)

```bash
# API must already be running
BASE_URL=http://127.0.0.1:3001 \
  RESULT_PATH=/tmp/periscan-soak-prep.json \
  bash scripts/ops-soak-prep.sh

# Optional identity probe (no signup, no mutations)
BASE_URL=… PERISCAN_API_KEY=psk_… bash scripts/ops-soak-prep.sh
```

Next steps **after** prep is green (still not claimed here):

1. Local measured baseline: `node scripts/perf-baseline.mjs` with env-labeled `PERISCAN_PERF_RESULT_PATH` (keeps `productionScaleClaimValidated: false`).
2. Design-partner soak only with a real attachable report per `docs/trust/EXTERNAL_VALIDATION.md`.

---

## 5. Residual still open (out of scope this ship)

| Residual | Why not this session |
|----------|----------------------|
| True offset/cursor pagination product for paths/remediations/evidence | Breaking/additive product work; honesty path is already limit-capped bare `{ items }` |
| Bulk findings HTTP (`POST …/findings/bulk`) | Explicitly unmounted per CHANGELOG 0.3.x residual |
| Production multi-node soak / customer SLO numbers | Needs production-like topology + attachable report — not inventable |
| Broader capability matrix on every mutate path | Partial enforcement remains; this ship pins the webhook:admin blast-radius regression |

---

## 6. Scorecard impact

**No scorecard bump.** This is contract + regression evidence for automation ICP trust and ops *prep* readiness. Load/soak rows stay honesty-locked until a real environment-scoped artifact exists.

---

## 7. Commits (this branch)

Local commit message on `overnight-loop`:

```text
test+ops(automation): webhook:admin least privilege + soak prep honesty
```

Files in that commit:

- `tests/acceptance/api-key-webhook-admin-least-privilege-flow.test.ts`
- `scripts/ops-soak-prep.sh`
- `docs/qa/OPS_SOAK_PREP.md`
- `docs/qa/OPS_AUTOMATION_CONTINUE_2026-07-31.md` (this memo)
- `docs/API_UI_INTEGRATION.md` (list-envelope polish)

Resolve hash with `git log -1 --oneline --grep='webhook:admin least privilege'`.
