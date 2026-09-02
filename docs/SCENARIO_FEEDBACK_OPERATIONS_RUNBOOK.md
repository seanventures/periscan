# Scenario Feedback Operations Runbook

Status: implemented and repository-verified
Owner: Security Operations
Product surface: `/engagements`
API surface: `/api/v1/scenarios/*`

## Purpose and boundary

Periscan feedback cycles rerun one approved, signed, deterministic scenario graph against fresh observations. They are human-triggered and evidence-gated. A cycle does not add tools, mutate the graph, broaden scope, change policy, or increase its signed iteration budget.

Only verified customer-authorized scope is eligible. Every module still receives its own policy decision and audit event. Denied tasks are never queued. A bundle that is stopped or exhausted cannot be reopened; continuing requires a new compile and approval decision.

## Durable state

The `scenario_bundles` record is the control-plane source of truth:

- `maximumIterations` is sealed into the signed bundle.
- `feedbackCycleCount` is atomically reserved before execution and never exceeds the signed limit.
- `feedbackFailedCycleCount` records consumed attempts that failed after reservation.
- `feedbackLastStatus` is `Idle`, `Running`, `Completed`, `Failed`, `Stopped`, or `Exhausted`.
- last-start, completion, reason, review reference, error, stop actor, and stop decision remain persisted.
- each generated engagement carries the same `scenarioBundleId`, exact `compiledHash`, and a unique positive `feedbackCycleNumber`.

Strict tenant row-level security is enabled and forced on scenario bundles. Database constraints reject impossible cycle counts, incomplete timing fields, inconsistent stop state, and engagement cycle numbers without a scenario bundle.

## Normal operating procedure

1. Open `/engagements` and select a verified scope.
2. Enter the validation intent and choose a signed cycle budget between 1 and 20. Use the smallest number needed for the change or review window.
3. Select **Compile preview**. Inspect the modules, prerequisites, branch predicates, scope types, safety ceiling, SBOM, hash, and signature.
4. Select **Approve exact hash** only when the preview is the authorized graph.
5. In **Next decision**, record a reason and a durable review reference such as a change, incident, or assessment ID.
6. Select **Run next governed cycle**. The API compares the expected cycle count, atomically reserves one attempt, and then executes. A stale decision fails closed with `scenario_feedback_state_changed`.
7. Inspect the completed cycle in **Signed cycle rail**. For each step, confirm the status, evidence and signal counts, validation state, and exact prior-step facts used by the branch predicate.
8. Repeat only when fresh evidence is required and the signed budget remains.
9. Select **Stop loop** with a reason and review reference when no further cycle is authorized. Stopping is terminal.

## State and audit expectations

| Event                       | Required state change                                                                                | Audit action                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Cycle reserved              | count increments once; last state becomes `Running`; reason/reference/start time persist             | `scenario_feedback_cycle_started`                           |
| Cycle completes below limit | last state becomes `Completed`; completion time persists                                             | `scenario_feedback_cycle_completed` and `scenario_executed` |
| Final cycle completes       | last state becomes `Exhausted`; remaining count is zero                                              | `scenario_feedback_cycle_completed` and `scenario_executed` |
| Reserved cycle fails        | failed count increments; error and completion time persist; final failed attempt becomes `Exhausted` | `scenario_feedback_cycle_failed`                            |
| Operator stops              | last state becomes `Stopped`; actor/time/reason/reference persist                                    | `scenario_feedback_stopped`                                 |

Every reserved attempt consumes budget, including failed module execution. This prevents uncontrolled retry loops.

## Triage and recovery

### `scenario_feedback_state_changed`

Another decision changed the durable cycle count after the operator loaded the page. Refresh, inspect the new cycle and its branch evidence, and make a new deliberate decision. Do not retry the old request automatically.

### `scenario_feedback_cycle_running`

A cycle is already reserved. Inspect the API and worker logs using the request trace ID and check the associated engagement/job state. Do not stop or start another cycle until the current cycle reaches a recorded terminal state. If underlying asynchronous work is genuinely stale, use the reviewed reconciliation procedure in `ASYNC_OPERATIONS_RUNBOOK.md`; never edit the cycle count directly.

### `scenario_feedback_exhausted`

The signed limit was reached. Inspect all cycle evidence and failed attempts. If further validation is justified, compile and approve a new bundle with a new review decision. Never increase `maximumIterations` on the existing record.

### `scenario_feedback_stopped`

The operator sealed a terminal stop. Confirm the stop actor, reason, reference, and audit event. A new intent requires a new bundle and approval; do not clear stop columns.

### `scenario_bundle_integrity_failed`

Stop. Preserve the bundle, audit events, logs, and signing-key reference. Treat this as a control-plane integrity incident. Do not execute or resign the existing record. Investigate tenant signing state and database write history before compiling a replacement.

## Monitoring recommendations

Alert or queue operator review for:

- a `Running` cycle older than the tenant's reviewed running-timeout target;
- repeated `Failed` cycles for the same bundle;
- any integrity failure;
- repeated stale-state conflicts, which can indicate competing operators or automation;
- an exhausted bundle whose change or incident remains open;
- missing started/completed/failed/stopped audit actions for a durable state transition.

These are operational recommendations, not claims of an externally audited SLO. Production thresholds and escalation ownership remain tenant deployment decisions.

## Verification

Repository checks:

```bash
pnpm --filter @periscan/shared test
pnpm --filter @periscan/api test
pnpm --filter @periscan/web test
DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan \
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan \
pnpm exec vitest run tests/acceptance/scenario-compiler-flow.test.ts --testTimeout=60000
pnpm analyst:score:check
```

The acceptance flow proves exact-hash approval, fresh branch evidence, durable cycle attribution, stale-decision rejection, hard exhaustion, terminal stopping, audit actions, and persistence. The web tests prove the operator cannot run or stop without a reason and reference and that persisted branch evidence is visible.

Demo validation:

1. Run `pnpm seed:demo` with the configured local database.
2. Sign in with the demo credentials printed by the seed.
3. Open `/engagements`; the approved `DEMO —` bundle should show `0 / 3` and `Idle` without having executed during seed.
4. Open product help and follow **Operate a bounded evidence feedback loop** literally.
5. Run one cycle with a demo review reference, inspect its branch facts, then stop it with a separate reason/reference.
6. Confirm the stopped state has no run button and a subsequent execute request returns `scenario_feedback_stopped`.
7. Rerun the demo seed to restore an unexecuted demo workspace.

Do not substitute seeded fixture evidence for a production qualification claim.
