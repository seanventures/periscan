# Codex Master Instruction Source Coverage

- Branch: `codex/prd-codex-master-source-coverage`
- Requirement: `SRC-20-CODEX-MASTER-INSTRUCTION` / `PRD-CODEXMASTER-001` through `PRD-CODEXMASTER-006`
- Scope: source-audit PRD section 20 Codex Master Instruction. No runtime behavior changed.

## Completed

- Added `tests/modules/prd-codex-master-instruction-coverage.test.ts`.
- Updated `docs/PRD_SOURCE_COVERAGE_LEDGER.md` to mark `SRC-20-CODEX-MASTER-INSTRUCTION` as `EvidenceMapped`.
- Added `PRD-CODEXMASTER-001` through `PRD-CODEXMASTER-006` to `docs/PRD_REQUIREMENT_LEDGER.md`.
- Updated `docs/TRACEABILITY_MATRIX.md`, `docs/USER_STORIES.md`, and `docs/ACCEPTANCE_CRITERIA.md`.
- Updated coordination docs in `.ai/status.md`, `.ai/codex-handoff.md`, `.ai/requirements-traceability.md`, `.ai/gap-backlog.md`, and `.ai/activity-log.md`.

## Validation

- `pnpm exec vitest run tests/modules/prd-codex-master-instruction-coverage.test.ts --reporter=dot` PASS (1 file / 6 tests).

## Residual Gaps

- `SRC-21-CODEX-TICKETS` remains the only source row still `SectionIndexed`.
- `PRD-RUNNER-003` remains intentionally `Partial` for the long-form default mTLS/certificate divergence.
- `PRD-COMPLETE-001` remains `Partial` until every source row and partial atom is resolved and strict audit passes.
