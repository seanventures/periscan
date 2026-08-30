# E2E Swarm S6 — Platform (webhooks, ITSM, runners, schedules, MSSP)

**Swarm:** S6 platform E2E  
**Worktree:** overnight-loop  
**Forbidden:** cross-tenant mutation; Fixed without verify  

## Scope

| Area | Operator path | Acceptance proof |
| ---- | ------------- | ---------------- |
| **Webhooks** | create → rotate secret → HMAC deliver → redrive dead letter → event-catalog | `tests/acceptance/webhook-lifecycle-flow.test.ts` (+ delivery / dead-letter / catalog least-privilege siblings) |
| **ITSM tickets** | create ticket ≠ Fixed; close ticket ≠ Fixed; verify still required | `tests/acceptance/remediation-ticket-state-flow.test.ts` |
| **Runners** | register → check-in (heartbeat) → lease (poll) → complete (signed result) | `tests/acceptance/runner-lease-complete-flow.test.ts` |
| **Schedules** | ContinuousValidation create → pause / resume / run-now → priorDiffs honesty | `tests/acceptance/schedule-continuous-validation-flow.test.ts` (+ pause-run sibling) |
| **MSSP** | create client → Open client → findings in child tenant isolation | `tests/acceptance/mssp-client-findings-isolation-flow.test.ts` (+ enterprise-foundation) |

## Laws under test

1. **HMAC webhooks** — receivers verify `x-periscan-signature: sha256=<hex>` with the one-shot secret from create/rotate. Rotate invalidates the prior secret. Dead-letter redrive resets `Pending` and re-signs with the current secret. Catalog (`GET …/webhooks/event-catalog`) lists nine event types + header contract and never returns secrets.
2. **Fixed only via verification** — ITSM create moves remediation to `InProgress` with `verificationRequired: true`. External ticket close maps to `ClosedWithoutEvidence`, never `Fixed`. Mark-ready / verify path remains the only way to Fixed.
3. **Runner lease** — poll leases `Queued` → `Leased` with PEP re-check; complete requires registered result-signing key + valid signature.
4. **priorDiffs honesty** — ContinuousValidation first fire is `NoPreviousRun`; subsequent fires compare snapshots; schedule cadence never mints remediation `Fixed`; continuous EASM note stays “allowlisted / not living map”.
5. **MSSP isolation** — Open client uses `x-periscan-tenant-id`. Findings created under the child are invisible to parent (no switch), sibling clients, and outsider orgs. Sibling transition returns 4xx (no cross-tenant mutation).

## How to run

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL=$DATABASE_URL

pnpm test:acceptance -- \
  tests/acceptance/webhook-lifecycle-flow.test.ts \
  tests/acceptance/remediation-ticket-state-flow.test.ts \
  tests/acceptance/runner-lease-complete-flow.test.ts \
  tests/acceptance/schedule-continuous-validation-flow.test.ts \
  tests/acceptance/mssp-client-findings-isolation-flow.test.ts
```

## Related product surfaces

| Surface | API / package |
| ------- | ------------- |
| Webhooks | `apps/api/src/services/webhooks.ts`, `packages/webhooks` |
| ITSM | `apps/api/src/services/remediation.ts` create/sync ticket; `packages/shared/src/fix-verification.ts` |
| Runners | `apps/api/src/services/runner.ts` heartbeat / poll / result |
| Schedules | `apps/api/src/services/schedules.ts` ContinuousValidation + priorDiffs |
| MSSP | `POST /tenants/current/clients`, `x-periscan-tenant-id` switch |

## Non-goals

- Live Jira/ServiceNow/HMAC receiver endpoints (mockMode + in-process `processWebhookDelivery`).
- Real customer network runner binary execution (control-plane lease/complete only).
- Live continuous EASM tool execution (queue/diff honesty without claiming living map).
