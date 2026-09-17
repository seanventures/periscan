# Subscription operations runbook

## Supported product boundary

Periscan provides a tenant-scoped lifecycle ledger for continuous direct
agreements. It records reviewed entitlement terms, renewal decisions, bounded
grace exceptions, end-of-term cancellations, period usage, and entitlement
changes. The workflow is available to Owner, Admin, MSSPOwner, and ClientAdmin
roles.

Periscan does **not** charge a card, collect money, calculate tax, issue an
invoice, attest settlement, or complete procurement. The workspace always
reports the payment processor as `NotConfigured`; those commercial operations
remain outside Periscan until a reviewed provider is implemented and
qualified. Only record an agreement or exception after its source approval
exists.

## Start a continuous term

Open **Billing → Renewal continuity**.

1. Confirm that any active trial has already been converted or cancelled.
2. Select the approved Periscan package.
3. Enter the approved agreement or order-form reference.
4. Enter the support owner responsible for the term.
5. Choose an end date between 7 and 730 days from now.
6. Set the renewal lead time and choose **Start term ledger**.

Periscan creates one open period, activates the selected package entitlement,
and appends `Started` to the lifecycle ledger. A tenant can have only one
continuous lifecycle. An existing or ended lifecycle is not silently replaced.

## Review and record renewal

The renewal rail derives checkpoints from the configured lead time plus the
30-day, 7-day, and term-boundary milestones. Each checkpoint is shown as
Upcoming, Due, Complete, or Overdue, and the workspace states the next required
action.

To approve a renewal:

1. Review the agreement, package, term length, support ownership, and reason.
2. Enter the next approved agreement reference.
3. Select the next package and a term of 1–36 months.
4. Choose **Approve next term**.

Approval creates a scheduled immutable period beginning exactly at the current
term boundary. It does not change the current package early. A later approved
decision can replace the scheduled period before the boundary.

To decline renewal, enter the reviewed reason and choose **Decline renewal**.
Periscan removes any scheduled future period, marks the lifecycle
`NonRenewing`, and preserves the current entitlement until the recorded end
date.

## Reconcile a due boundary

Choose **Apply due boundary** only when the UI enables it:

- for an approved renewal, the scheduled period must have reached its start;
- for a non-renewing term, the open period must have ended; or
- for an unresolved grace exception, its deadline and the term deadline must
  have passed.

An approved renewal closes the completed period with a real usage snapshot,
opens the scheduled period, applies its package, and resets the next renewal
decision to `Unreviewed`. A due non-renewal or expired-grace reconciliation
closes the period with the same usage evidence, marks the lifecycle `Ended`,
and removes the active package entitlement. An early reconciliation fails with
`subscription_reconciliation_not_due` and changes no state.

## Handle a bounded grace exception

Use grace only for a reviewed commercial exception such as a delayed approved
procurement or invoice record.

1. Enter the external exception reference.
2. Set a deadline from 1–90 days.
3. Record a specific reason and choose **Start bounded grace**.

The lifecycle becomes `GracePeriod`, while the current entitlement remains
unchanged. Renewal and cancellation decisions are blocked until the exception
is resolved. When the source issue is closed, enter the resolution reference
and choose **Resolve grace**. Periscan returns the lifecycle to `Active` or
`NonRenewing` according to the recorded renewal/cancellation decision.

## Schedule or recover cancellation

Cancellation is always scheduled for the current term boundary; this workflow
has no immediate-access-removal action.

1. Enter the approved cancellation reference and reason.
2. Choose **Schedule cancellation at term end**.
3. In the confirmation, type `CANCEL AT TERM END` exactly.

Periscan removes any approved next term, records `NonRenewing`, and leaves the
open period and entitlement active. Before reconciliation, choose **Revoke
cancellation** with a reviewed reason to restore `Active` and reopen the renewal
decision. If the term has been reconciled to `Ended`, its history is immutable;
a new reviewed commercial agreement requires a new lifecycle capability rather
than rewriting this ledger.

## Integrity, audit, and recovery

- Every lifecycle transition appends a numbered event whose SHA-256 hash binds
  its contents and the previous event hash. **Ledger mismatch** means an event
  no longer verifies; stop commercial changes and investigate database and
  audit history.
- Period rows are retained as Scheduled, Open, or Closed. Closed-period usage
  snapshots are preserved instead of recalculated on later reads.
- All mutations emit tenant audit actions. Denied, early, conflicting, or
  cross-tenant operations do not create entitlement state.
- Retry a failed request only after reading the refreshed workspace. The
  service rejects duplicate lifecycle creation, missing recovery state, active
  grace conflicts, and operations against an ended lifecycle.
- The AWS Marketplace workflow is separate. Do not treat a direct-agreement
  reference as Marketplace buyer registration or settlement evidence.

## API operations

| Operation               | Endpoint                                              |
| ----------------------- | ----------------------------------------------------- |
| Read workspace          | GET /api/v1/billing/subscription                      |
| Start lifecycle         | POST /api/v1/billing/subscription                     |
| Approve/decline renewal | POST /api/v1/billing/subscription/renewal             |
| Start grace             | POST /api/v1/billing/subscription/grace               |
| Resolve grace           | POST /api/v1/billing/subscription/grace/resolve       |
| Schedule cancellation   | POST /api/v1/billing/subscription/cancellation        |
| Revoke cancellation     | POST /api/v1/billing/subscription/cancellation/revoke |
| Reconcile due boundary  | POST /api/v1/billing/subscription/reconcile           |

## Qualification

Run the focused real-PostgreSQL lifecycle proof:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"
pnpm exec vitest run --dir tests/acceptance \
  -t "renews, preserves grace access" \
  --reporter=verbose --hideSkippedTests --testTimeout=60000
```

This acceptance path proves honest empty state, duplicate prevention, renewal
scheduling, early-reconciliation denial, grace entitlement preservation,
grace resolution, cancellation recovery, real period usage closure, package
transition, fail-closed entitlement removal, event and audit completeness,
tamper detection, and tenant isolation.

The rendered product guide was also exercised against the local application.
It created a direct term, approved its next term, showed the new period and
linked event immediately, preserved the explicit payment/provider boundary,
and produced no browser console errors. The Billing workspace had no horizontal
overflow at either 1280px or 390px.

Before release, run the complete gate:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"
pnpm verify
```

The 2026-07-15 release gate passed with 77 web files / 254 tests, 25 API files /
332 tests, 24 shared files / 137 tests, 7 module files / 176 tests, the 53-route
production build, 94 Playwright journeys, 25 security tests, 134 acceptance
files / 173 tests, and all 136 migrations. License, dependency, enum-drift,
PRD, and analyst-score gates also passed.
