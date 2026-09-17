# Codex Agent Note - Recommended Tech Stack Source Coverage

- Branch: `codex/prd-tech-stack-source-coverage`.
- Release checkpoint before slice: `main` pushed to `f2e507e2`; GitHub release
  `v0.1.339` created.
- Requirement IDs: `SRC-5-TECH-STACK`, `PRD-TECH-001`, `PRD-TECH-002`,
  `PRD-TECH-003`, `PRD-TECH-004`, `PRD-TECH-005`, `PRD-TECH-006`,
  `PRD-TECH-007`.
- Scope: source-audit hardening plus real stack boundary fixes. Added
  `@periscan/risk`, TanStack Query provider wiring, `infra/terraform`, and
  `tests/modules/prd-tech-stack-coverage.test.ts`.
- Runner transport note: true default runner mTLS remains intentionally visible
  as `PRD-RUNNER-003` Partial; this slice does not close it.
- Validation: `pnpm test:modules -- prd-tech-stack-coverage prd-audit-gate`
  PASS (33 files / 123 tests); `pnpm --filter @periscan/risk test` PASS;
  `pnpm --filter @periscan/web test -- query-provider` PASS; `pnpm prd:audit`
  PASS in non-completion mode; `pnpm typecheck` PASS; `pnpm lint` PASS;
  `git diff --check` PASS.
