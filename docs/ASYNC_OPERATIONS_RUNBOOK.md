# Asynchronous Operations Runbook

> **Naming honesty (P20-9):** OpenAPI tag is `async-operations-reconciliation`.
> This is **operator reconciliation for stalled queue/runner work**, not a
> general Azure/AWS-style async jobs fabric. For proof-loop completion use:
>
> - `GET /api/v1/missions/:id/runs/:runId/wait?timeoutMs=` (P20-3 long-poll)
> - Webhooks: `mission.started|completed|failed`, `remediation.verified`, …
> - `GET /api/v1/lab/capabilities` for engine automation non-goals

Periscan's queue control room is the tenant-scoped operating surface for persisted validation jobs and signed runner tasks. It detects work that crossed a reviewed boundary, records reconciliation, and prepares recovery without direct replay.

## Safety boundary

- Reconciliation can mark a `Running` validation job `Failed` only after the tenant's reviewed running timeout.
- Reconciliation can mark an active runner task `Expired` only after the task's signed `expiresAt` boundary.
- Affected non-terminal validation runs become `Failed`; work from another tenant is never selected.
- `PrepareRecovery` creates a new `Draft` mission from the source mission's still-verified scope and safety intent.
- The draft has `policyDecisionId = null`, no run, no job, and no runner task. It cannot execute until the ordinary policy and start workflow succeeds.
- `AcceptTerminal` records that no recovery is needed. Each failed workload accepts only one terminal decision.
- There is no direct replay endpoint.

These are customer-reviewed operating targets, not externally audited availability SLOs. This implementation does not claim production soak, multi-node failure qualification, or 10,000 concurrent workloads.

## Operator procedure

1. Open **Validation Ops → Reviewed operating targets**.
2. Name the support owner and escalation channel. Record the queue-age target, running timeout, runner-lease warning, and a durable runbook or change reference.
3. Read **Operating state**, **Stalled**, and **Waiting**. Select a workload to inspect its persisted status, age, mission, run, attempt count, expiry, and error.
4. For stale work, open **Reconciliation boundary**, enter an incident/change reference and reason, and choose **Reconcile stale work**.
5. For a failed terminal workload, choose either **Prepare recovery draft** or **Accept terminal outcome**. Preparing recovery requires every source scope to remain `Verified`.
6. Open the linked recovery mission and confirm `Draft`, `Policy decision: Not linked`, and `Runs (0)` before beginning fresh policy review.
7. Confirm the **Recovery ledger** shows the new event with `hash verified`.

## Operating states

| UI state          | Meaning                                                    | Permitted next step                                 |
| ----------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| `OnTime`          | Queued inside its reviewed target                          | Monitor                                             |
| `WaitingTooLong`  | Pickup exceeded the reviewed queue-age target              | Monitor and investigate capacity; do not replay     |
| `Running`         | Active and inside its terminal boundary                    | Monitor                                             |
| `Stalled`         | Running job exceeded timeout or signed runner task expired | Reconcile                                           |
| `TerminalFailure` | Failed, rejected, expired, or denied                       | Prepare a recovery draft or accept terminal outcome |
| `TerminalSuccess` | Completed successfully                                     | None                                                |
| `Cancelled`       | Cancelled by an authorized workflow                        | None                                                |

The control room renders the 200 most recent jobs and 200 most recent runner tasks. The operating limitation is displayed in-product so that the view is not misread as a high-concurrency qualification result.

## API

| Method | Route                                         | Behavior                                                                                 |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/async-operations/workspace`          | Reads reviewed policy, queue health, work items, limitations, and verified ledger events |
| `PUT`  | `/api/v1/async-operations/policy`             | Admin-only reviewed target upsert plus audit and ledger event                            |
| `POST` | `/api/v1/async-operations/reconcile`          | Admin-only tenant-scoped stale-work terminalization plus exact counts                    |
| `POST` | `/api/v1/async-operations/recovery-decisions` | Admin-only fresh-draft preparation or terminal acceptance                                |

The public OpenAPI document uses the same shared Zod contracts as route parsing and response validation.

## Evidence and audit

`async_operations_events` is append-only through the product service. Every event records tenant sequence, actor, reference, reason, result, workload identity, optional recovery mission, previous hash, and SHA-256 event hash. A database trigger rejects content updates. Forced RLS is enabled on policy and event tables.

Audit actions are:

- `async_operations.policy_configured`
- `async_operations.reconciled`
- `async_operations.recovery_prepared`
- `async_operations.terminal_accepted`

## Qualification

The release gate covers:

- shared schema validation;
- admin-only API behavior and OpenAPI payload mapping;
- real-Postgres job and runner-task reconciliation;
- cross-tenant isolation and active RLS enforcement;
- still-verified source-scope enforcement;
- no copied policy decision and no queued work on recovery;
- duplicate terminal-decision rejection;
- audit ordering and immutable-ledger tamper rejection;
- component interaction, route-specific help, responsive overflow, and live demo behavior.

Run the focused acceptance exercise with:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL=$DATABASE_URL
pnpm exec vitest run tests/acceptance/async-operations-recovery-flow.test.ts --testTimeout=60000
```

Run all release gates with `pnpm verify`.
