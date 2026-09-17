# Validation Module Certification

Every Periscan Validation Module must be **certified** before it is enabled. Certification
is automated by `scripts/module-certification.ts` and runs in CI through
`pnpm verify` (via `pnpm modules:certify:check` and `pnpm test:modules`).

## Honesty bounds (read first)

Certification answers: **“Does this module’s metadata, parser, license, safety
gates, and fixture path satisfy ship invariants?”** It does **not** answer:

| Do not infer from certification | Reality signal instead |
| --- | --- |
| Live readiness or runner payload exists | `liveSupported` on the manifest + runtime tool resolution |
| Customer-visible `Validated` / `Measured` proof | Live authorized probe with evidence IDs (fixtures must stay `Inconclusive` / non-measured) |
| Full BAS / kill-chain / ransomware / OT attack pack maturity | Competitive matrix + scorecard Scaffold rows; catalog-only sims are plan/fixture only |
| Report freshness forever | Committed `docs/generated/module-certification-report.md` must match `pnpm modules:certify` output; CI fails on drift (`modules:certify:check`) |

Staleness rule: if the report’s module count ≠ `listModuleManifests().length`, or
the generated file drifts from a fresh `buildCertificationReport()`, treat the
report as **invalid** until regenerated. Do not cite an old report as proof that
new modules are certified.

## 1. Commands

| Command                      | Effect                                                               |
| ---------------------------- | -------------------------------------------------------------------- |
| `pnpm modules:certify`       | Recompute and write `docs/generated/module-certification-report.md`. |
| `pnpm modules:certify:check` | Fail (exit 1) on any hard failure or stale report.                   |
| `pnpm test:modules`          | Vitest assertions over the certification report.                     |

The generated report ([docs/generated/module-certification-report.md](generated/module-certification-report.md))
lists per-module status, license disposition, and every check with `ok` / `WARN` / `FAIL`.

## 2. Certification checks

Hard checks (a `FAIL` makes the module **NotCertified** and breaks the build):

| Check                 | Rule                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `license`             | License disposition must not be `Blocked`.                            |
| `customer_visible`    | `customerVisibleDescription` must be present.                         |
| `parser`              | A named parser must be declared.                                      |
| `output_schema`       | A named normalized output schema must be declared.                    |
| `evidence_types`      | At least one evidence artifact type must be declared.                 |
| `mission_types`       | At least one supported mission type must be declared.                 |
| `approval_gate`       | `BASLite` / `AdvancedAdversarial` must set `approvalRequired = true`. |
| `disallowed_not_live` | `Disallowed` modules must not be `liveSupported`.                     |
| `timeout`             | `timeoutSeconds` must be within 1..3600.                              |

Soft checks (a `WARN` yields **CertifiedWithWarnings**, still shippable):

| Check         | Rule                                                   |
| ------------- | ------------------------------------------------------ |
| `permissions` | Required permissions should be declared.               |
| `fixtures`    | Fixture-based certification should exist.              |
| `runtime`     | Tool runtime should be resolvable in this environment. |

Runtime warnings are environment-specific: a module that reports a tool as unavailable
surfaces an honest `ToolUnavailable` / `RequiresConfiguration` state at runtime. It is
not a fabricated result and does not block certification.

## 3. Certification levels

| Level                   | Meaning                                                  |
| ----------------------- | -------------------------------------------------------- |
| `Certified`             | All checks pass with no warnings.                        |
| `CertifiedWithWarnings` | No hard failures; one or more soft warnings.             |
| `NotCertified`          | At least one hard failure. Cannot be enabled; breaks CI. |

## 4. Adding fixtures (recommended)

Deterministic fixtures let a module certify without live tool runtimes:

1. Add fixture input/expected output under the module's fixtures location.
2. Set `fixtureSupported = true` in the manifest.
3. Ensure `execute` returns normalized, redacted output for the fixture.
4. Re-run `pnpm modules:certify` and commit the regenerated report.

## 5. CI enforcement

`scripts/verify.sh` runs, in order: `licenses:check`, `test:license`,
`modules:certify:check`, `test:modules`. The full `pnpm verify` is the CI gate in
`.github/workflows/ci.yml`. A new tool cannot merge unless it certifies.
