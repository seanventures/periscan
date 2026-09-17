# Codex Implementation Tickets Source Coverage

- Agent: Codex
- Branch: `codex/prd-codex-tickets-source-coverage`
- Requirement: `SRC-21-CODEX-TICKETS` / `PRD-TICKET-001..006`
- Status: source coverage implemented and validated in this branch.

## Scope

PRD section 21 must be audited from source text rather than inferred from
historical Codex prompt execution. The slice adds a source-derived regression
that parses all 40 ticket numbers, titles, and acceptance blocks from
`docs/PERISCAN_FULL_PRODUCT_PRD.md`.

## Files

- `tests/modules/prd-codex-tickets-coverage.test.ts`
- `docs/PRD_SOURCE_COVERAGE_LEDGER.md`
- `docs/PRD_REQUIREMENT_LEDGER.md`
- `docs/TRACEABILITY_MATRIX.md`
- `docs/USER_STORIES.md`
- `docs/ACCEPTANCE_CRITERIA.md`
- `.ai/status.md`
- `.ai/codex-handoff.md`
- `.ai/requirements-traceability.md`
- `.ai/gap-backlog.md`
- `.ai/activity-log.md`

## Validation

- `pnpm exec vitest run tests/modules/prd-codex-tickets-coverage.test.ts --reporter=dot` PASS.
- `pnpm exec vitest run tests/modules/prd-codex-tickets-coverage.test.ts tests/modules/prd-audit-gate.test.ts tests/modules/coordination-docs.test.ts --reporter=dot` PASS.
- `pnpm prd:audit` PASS.
- `pnpm typecheck` PASS.
- `pnpm lint` PASS.
- `git diff --check` PASS.

Re-run before release if this branch changes:

```sh
pnpm exec vitest run tests/modules/prd-codex-tickets-coverage.test.ts --reporter=dot
pnpm exec vitest run tests/modules/prd-codex-tickets-coverage.test.ts tests/modules/prd-audit-gate.test.ts tests/modules/coordination-docs.test.ts --reporter=dot
pnpm prd:audit
pnpm typecheck
pnpm lint
git diff --check
```

## Residual Gaps

- `PRD-COMPLETE-001` remains `Partial` until strict audit is clean and full validation passes after the final product change.
- `PRD-RUNNER-003` remains `Partial` for the long-form PRD runner mTLS/certificate divergence.
