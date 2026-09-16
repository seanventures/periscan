# Model Tool Intervention Runbook

## Purpose and boundary

Model tool interventions let a tenant administrator decide a policy-paused
tool request without turning a chat message into authorization. Periscan binds
the exact tenant, request, session, scope, policy snapshot, input commitment,
and expiry into a signed one-time handoff. The decision can resume the request
to `Approved` or cancel it; resuming never executes the tool.

Slack, Teams, Copy link, and Other are transport labels. Periscan returns a
signed URL for an operator to place in an approved channel; this release does
not send a Slack or Teams message. A reply, reaction, screenshot, forwarded
request ID, or plain `approve` message has no decision authority.

## Operator procedure

1. Open **Autonomous → Frontier Gateway → Interventions** and select a request
   marked **RequiresApproval**.
2. Review its exact authorization envelope: tool, reason, session purpose and
   mode, policy profile and decision, verified scope count, and input
   commitment.
3. Choose the expected transport label and an expiry of 5, 15, 30, or 60
   minutes, then choose **Issue review link**. Issuing a replacement link
   supersedes an earlier pending link for the same request.
4. Copy the one-time URL from the success panel and move it through the approved
   channel. The raw token exists only in that response and URL; Periscan stores
   its SHA-256 fingerprint.
5. Open the URL while signed in as a tenant administrator. Confirm **Signed
   envelope verified**, recheck every bound field and the expiry, and enter a
   decision reason plus review reference.
6. Choose **Resume request** to move the request to `Approved`, or **Cancel
   request** to make it non-executable. The link can decide only once.
7. Refresh **Interventions** and **Decision log**. Confirm the sealed
   intervention state and `InterventionResumed` plus `ToolAllowed`, or
   `InterventionCancelled` plus `ToolDenied`.

The seeded demo produces one real `RequiresApproval` request and no validation
execution. Run `pnpm seed:demo`, sign in with the emitted demo credentials, and
open the emitted `/model-gateway` path. Rerunning the seed restores the ready
demo after a completed review.

## API and persistence contract

- `GET /api/v1/model-gateway/interventions` returns tenant-scoped queue and
  sealed-review state without raw tokens.
- `POST /api/v1/model-gateway/tool-requests/:toolRequestId/intervention-link`
  issues the one-time signed handoff.
- `POST /api/v1/model-gateway/interventions/:interventionId/inspect` verifies
  the signed token and live authorization envelope.
- `POST /api/v1/model-gateway/interventions/:interventionId/decision` seals one
  `Resume` or `Cancel` decision in the same database transaction as the request
  status change and audit events.

The URL stores the token in its fragment so it is not sent in ordinary HTTP
request targets. The database stores only the fingerprint and immutable bound
envelope. Forced tenant row-level security, tenant-admin authorization,
database checks, and an immutable-envelope trigger protect the record.

## Failure and recovery

- **Clipboard denied:** copy the visible one-time URL manually; do not recreate
  it from a request ID or audit event.
- **Expired or superseded:** return to the live request and issue a fresh link.
  The previous link remains unusable.
- **Envelope changed:** stop and review the current request, scope, and policy.
  Never bypass the failed inspection.
- **Tampered or replayed token:** preserve the rejection event for review and
  issue a fresh link only if the live request still requires approval.
- **Decision API unavailable:** do not send an approval message. Retain the
  paused request and retry the signed decision after service recovery.
- **Resume selected:** verify `Approved`, then use the separate governed tool
  execution path if execution is still intended and authorized.

## Qualification

Run the focused checks:

```bash
pnpm --filter @periscan/shared test -- src/model-tool-interventions.test.ts
pnpm --filter @periscan/web test -- src/components/frontier-gateway-console.test.tsx src/lib/product-help.test.ts
DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm exec vitest run tests/acceptance/model-gateway-intervention-flow.test.ts --testTimeout=60000
pnpm analyst:score:check
```

Then run the complete release gate with the same database URLs:

```bash
pnpm verify
```

The acceptance proof covers raw-token non-persistence, message-only rejection,
tamper denial, tenant authorization, exact-envelope inspection, resume without
execution, cancellation, expiry, supersession, replay denial, and lifecycle
audit. The live product-guide walkthrough must issue a bounded link, reopen it,
verify the envelope, seal a decision, inspect the paired audit events, restore
the demo, and finish with a clean browser error console.

## Analyst evidence boundary

This closes analyst requirement 42 at 4.0. A 5.0 still requires independent
multi-customer usability evidence, externally reviewed support/SLO operation,
and qualified enterprise transport delivery. Slack and Teams remain honest
operator-selected transports, not configured message-delivery integrations and
never sources of approval authority.
