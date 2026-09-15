# First adapter PR (in-tree)

Community edition is the **Apache-2.0** validation slice.
This page is the copy-paste path for a PassiveReadOnly, permissive-SPDX engine
that is already a catalog hole (`moduleIds: []`).

Gitleaks is the **behavior** reference (fixtures, redaction, `tool_unavailable`).
Do **not** duplicate `packages/modules/src/index.ts`. Copy a `PopularOssSpec`
(Bandit / Checkov in `packages/modules/src/community-popular-oss.ts`).

## Steps

1. Confirm the tool is not already in `OpenSourceToolIdSchema`
   (`packages/shared/src/open-source.ts`). Add the enum value first if needed.
2. Prefer a hole in `packages/modules/src/security-catalog-expansion.ts`.
3. Add catalog fields + one spec + `packages/modules/fixtures/<tool>/`.
4. Wire `COMMUNITY_VALIDATION_SUITE` only if Validate should start it.
   Wire `RUNNER_OSS_ENGINE_MODULE_IDS` only if InternalRunner.
   Append the module id in `packages/modules/src/index.test.ts`.
5. Tests must fail if `fixtureMode` invents findings.
6. `pnpm licenses:write && pnpm modules:certify` and commit generated files.
7. Slice check: `pnpm --filter @periscan/modules test && pnpm licenses:check`.
   Merge still runs `pnpm verify`.

## Do not

- Edit `LICENSE` or claim the product is open source.
- Put Semgrep / Atomic / sqlmap on Community start.
- Emit `Fixed` from an empty fixture as a substitute for a parser.
- Open a PR that only calls intake APIs or the extension runbook.

Issue form: `.github/ISSUE_TEMPLATE/engine-adapter.yml`.
Policy: [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`GOVERNANCE.md`](../GOVERNANCE.md).
