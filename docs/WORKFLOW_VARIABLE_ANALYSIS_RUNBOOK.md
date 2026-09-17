# Workflow Variable Analysis Runbook

## Purpose and boundary

Variable Lens compares the redacted state that Periscan actually persisted in
one durable workflow run. It derives cumulative snapshots from the run input
manifest and append-only event chain; it does not reconstruct prompts,
responses, credentials, scanner output, or any value that the recorder did not
store.

Use the result only while both **Chain verified** and **History verified** are
visible. A failed recorder-integrity check makes every derived comparison
untrusted. Replay always creates a new run and never repeats tool side effects.

## Operator procedure

1. Open **Autonomous → Agent Workflows** and choose a run under **Your agent
   workflows**.
2. In **Durable flight recorder**, confirm **Chain verified** and **History
   verified**.
3. Set **Compare from** and **Compare to**, or choose a numbered bar under
   **Recorded moments**. The bar height is the number of added, changed, and
   removed variables at that moment.
4. Filter by Input, Context, Policy, Evidence, Model, Tool, Transition,
   Performance, or Control. Enable **Include unchanged** only for full-state
   review.
5. Choose a variable and review its bounded before/after preview and SHA-256
   exact-value proof.
6. Review the permanent event ledger. **Seal checkpoint** appends a new
   checkpoint. **Fork from checkpoint** succeeds only while input, policy,
   evidence, expiry, and event-chain hashes still match.

The seeded demo run is labeled `DEMO` and explicitly records that no live model
inference was performed. It uses a `.invalid` provider endpoint and persisted
demo evidence references; seeding never calls a model or customer system.

## API and data contract

`GET /api/v1/agent-workflows/runs/:workflowRunId/variable-analysis` is
tenant-scoped and returns:

- recorder-integrity status and explicit limitations;
- baseline plus cumulative event snapshots;
- namespace counts, variable history, event count, latency, and cost;
- bounded value previews and exact SHA-256 hashes.

The API caps the interactive result at 500 current variables and the latest 200
event snapshots plus baseline. The response discloses these caps. The original
event ledger remains the permanent record.

## Failure and recovery

- **History untrusted:** stop analysis, preserve the source run, investigate
  the failed chain, and do not checkpoint or fork it.
- **No variables:** confirm the run persisted redacted manifests or references;
  unrecorded values cannot be recovered later.
- **Checkpoint stale:** refresh the run and re-evaluate current policy,
  evidence, scope, and input. Do not bypass the stale response.
- **Comparison unavailable:** retain the source run and use the permanent event
  ledger while API availability is restored.

## Qualification

Run the focused checks:

```bash
pnpm --filter @periscan/web test -- src/components/workflow-variable-lens.test.tsx src/lib/product-help.test.ts
pnpm exec vitest run packages/shared/src/agent-workflow-variable-analysis.test.ts apps/api/src/services/agent-workflow-variable-analysis.test.ts
DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm exec vitest run tests/acceptance/agent-workflow-flight-recorder-flow.test.ts --testTimeout=60000
```

Then run the complete release gate with the same database URLs:

```bash
pnpm verify
```

The acceptance proof covers tenant isolation, explicit redaction limits,
snapshot derivation, replay integrity, and the transition to untrusted after
database-level event tampering. Browser qualification follows the product guide
at desktop and 390 px, checks document overflow, and requires a clean warning
and error console.

## Analyst evidence boundary

This closes analyst requirement 41 at 4.0. A 5.0 still requires independent
multi-customer usability evidence, long-history performance/retention
qualification, and externally reviewed support/SLO operation. Deliberately
unrecorded secrets and raw prompts remain unavailable by design, not backlog.
