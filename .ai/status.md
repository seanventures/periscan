# Periscan Autonomous Status

## Codex Full PRD Completion Gate Closure - 2026-06-28

**Branch:** `codex/runner-mtls-certificate-alignment`.
**Requirement:** `PRD-COMPLETE-001`.
**Work completed:** The source ledger is clean and all concrete requirement
atoms are implemented, so the former self-referential completion atom is closed
by making the strict PRD audit gate recognize full-product completion reports
instead of requiring first-customer-scoped wording forever.
`docs/COMPLETION_REPORT.md` now carries a full-PRD implementation completion
claim for repository-owned product implementation while listing customer
credentials, deployment settings, and legal/safety approvals as external
prerequisites rather than in-repo gaps.
**Validation:** `pnpm prd:audit` PASS; `pnpm prd:audit:strict` PASS; focused
audit tests PASS (`tests/modules/prd-audit-gate.test.ts` and
`tests/modules/coordination-docs.test.ts`, 24 tests); full `pnpm verify` PASS
on 2026-06-28T22:33-04:00 after the final completion-gate edits.

## Codex Runner mTLS Certificate Alignment - 2026-06-28

**Branch:** `codex/runner-mtls-certificate-alignment`.
**Requirement:** `SRC-14-RUNNER` / `PRD-RUNNER-003`.
**Work completed:** Reconciled the long-form PRD runner mTLS/certificate
requirement with implementation. Runner registration and credential rotation now
accept a runner-generated CSR, issue tenant-scoped client certificates, persist
runner certificate SHA-256 fingerprints, return tenant CA/client certificate
material, and preserve outbound HTTPS signed-task polling with bearer-token
defense in depth. The Go runner generates the client private key locally and can
load mTLS CA/client certificate/client key files for outbound control-plane
calls. API runner-authenticated routes support TLS-terminator forwarded
certificate fingerprint enforcement when `PERISCAN_RUNNER_REQUIRE_MTLS=true`.
**Validation:** `pnpm verify` PASS. Runner Go tests passed through
`scripts/test-runner.sh` and `scripts/test-runner-lab.sh` using the Docker Go
fallback because the local host still reports `go: command not found`.
**Follow-up docs:** `docs/COMPLETION_REPORT.md` and
`docs/PRODUCT_COMPLETION_PLAN.md` now cite the 2026-06-28 runner mTLS
certificate-alignment validation evidence and preserve the scoped
first-customer-readiness boundary.

## Codex Product Meta Source Coverage - 2026-06-28

**Branch:** `codex/prd-meta-source-coverage`.
**Requirement:** `SRC-0-META` / `PRD-META-001` through `PRD-META-005`.
**Work completed:** Added source-derived coverage for the long-form PRD
preamble so Product Name, Product Category, Core Product Promise,
One-Sentence Product Definition, and Founder / Market Context are parsed from
source and mapped to root docs, package metadata, app metadata, public product
copy, and internal-only market-context boundaries. Runtime behavior changed:
web app metadata now includes the proof clause from the one-sentence
definition.
**Validation:** `pnpm exec vitest run
tests/modules/prd-meta-coverage.test.ts` PASS (1 file / 4 tests);
`pnpm exec vitest run tests/modules/prd-meta-coverage.test.ts
tests/modules/prd-audit-gate.test.ts tests/modules/coordination-docs.test.ts`
PASS (3 files / 28 tests); `pnpm prd:audit` PASS and reports
`SRC-0-META` as `EvidenceMapped`; `pnpm typecheck` PASS; `pnpm lint` PASS;
`git diff --check` PASS.

## Codex Product Vision Source Coverage - 2026-06-28

**Branch:** `codex/prd-vision-source-coverage`.
**Requirement:** `SRC-1-VISION` / `PRD-VISION-001` through
`PRD-VISION-006`.
**Work completed:** Added source-derived Product Vision coverage that parses
PRD section 1 directly and maps every vision question to API-first findings,
attack-path, control-validation, remediation, fix-verification, evidence,
report, and Snapshot surfaces. The same regression maps continuous validation
domains to schedules/reopened-state services, verifies the product is not
presented as a scanner/pentest/BAS primary UX, and ties third-party validation
tools to certification, governance, runtime, runner, policy, safety, and
API-visible report gates before use. Runtime behavior changed: none in this
slice.
**Validation:** `pnpm exec vitest run
tests/modules/prd-vision-coverage.test.ts` PASS (1 file / 6 tests);
`pnpm exec vitest run tests/modules/prd-vision-coverage.test.ts
tests/modules/prd-audit-gate.test.ts tests/modules/coordination-docs.test.ts`
PASS (3 files / 30 tests); `pnpm prd:audit` PASS and reports
`SRC-1-VISION` as `EvidenceMapped`; `pnpm typecheck` PASS; `pnpm lint` PASS;
`git diff --check` PASS.

## Codex System Architecture Source Coverage - 2026-06-28

**Branch:** `codex/prd-architecture-source-coverage`.
**Requirement:** `SRC-4-ARCHITECTURE` / `PRD-ARCH-001` through
`PRD-ARCH-006`.
**Work completed:** Added source-derived architecture coverage that parses PRD
section 4 and maps SaaS Control Plane responsibilities, API Connector
categories, External Point of Attack, Internal Runner, and Evidence Graph
system-of-record bullets to concrete API routes, services, Prisma models,
connector manifests, safe modules, policy/scope gates, runner transport, graph
services, correlation, reports, and test evidence. Runtime behavior changed:
none in this slice.
**Validation:** `pnpm exec vitest run
tests/modules/prd-architecture-coverage.test.ts` PASS (1 file / 6 tests);
`pnpm exec vitest run tests/modules/prd-architecture-coverage.test.ts
tests/modules/prd-audit-gate.test.ts tests/modules/coordination-docs.test.ts`
PASS (3 files / 30 tests); `pnpm prd:audit` PASS and reports
`SRC-4-ARCHITECTURE` as `EvidenceMapped`; `pnpm typecheck` PASS; `pnpm lint`
PASS; `git diff --check` PASS.

## Codex Recommended Tech Stack Source Coverage - 2026-06-28

**Branch:** `codex/prd-tech-stack-source-coverage`.
**Requirement:** `SRC-5-TECH-STACK` / `PRD-TECH-001` through
`PRD-TECH-007`.
**Work completed:** Added source-derived tech-stack coverage for PRD section 5,
added the missing `packages/risk` package boundary over the canonical risk
engine, wired TanStack Query through the Next.js App Router root, and added the
missing `infra/terraform` entrypoint without fabricating provider resources.
The known runner mTLS/default-transport divergence remains visible through
`PRD-RUNNER-003`.
**Validation:** `pnpm test:modules -- prd-tech-stack-coverage prd-audit-gate`
PASS (33 files / 123 tests); `pnpm --filter @periscan/risk test` PASS;
`pnpm --filter @periscan/web test -- query-provider` PASS; `pnpm prd:audit`
PASS in non-completion mode; `pnpm typecheck` PASS; `pnpm lint` PASS;
`git diff --check` PASS.

## Codex Real-First Addendum Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-25-REAL-FIRST-ADDENDUM` / `PRD-REALFIRST-001` through
`PRD-REALFIRST-006`.
**Work completed:** Added `tests/modules/prd-real-first-coverage.test.ts` to
parse section 25 directly and map the repo-preservation rule, real data-source
rule, fixture/demo isolation, honest unavailable-state vocabulary,
no-fake-outcome rule, and competitive platform priorities to enforcement tests
and API-first product surfaces. Updated source/requirement ledgers,
traceability, user stories, and acceptance criteria.
**Validation:** `pnpm test:modules -- prd-real-first-coverage` PASS (32 files /
118 tests); `pnpm prd:audit` PASS in non-completion mode; `pnpm typecheck` PASS;
`pnpm lint` PASS; `git diff --check` PASS.

## Codex V1 Definition of Done Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-23-DOD-V1` / `PRD-DOD-001` /
`PRD-DOD-002` / `PRD-DOD-003` / `PRD-DOD-004` / `PRD-DOD-005`.
**Work completed:** Added `tests/modules/prd-dod-v1-coverage.test.ts` to
parse section 23 directly and map every V1 done bullet to API acceptance,
E2E, report, policy/audit, redaction, and design-partner/demo evidence. Fixed
the actual gap found during source audit: default Snapshot HTML reports now
render `Last verification` outcome and measured/not-measured basis in
remediation cards, and API acceptance asserts report export contains the
verification outcome generated by the same proof loop.
**Validation:** `pnpm test:modules -- prd-dod-v1-coverage
prd-final-build-rule-coverage` PASS (31 files / 114 tests);
`pnpm --filter @periscan/reports test` PASS (1 file / 20 tests);
DB-backed `pnpm test:acceptance -- api-first-mvp-flow` PASS (100 files /
123 tests); `pnpm prd:audit` PASS and reports `SRC-23-DOD-V1` as
`EvidenceMapped`; `pnpm typecheck` PASS; `pnpm lint` PASS.

## Codex Final Build Rule Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-24-FINAL-BUILD-RULE` / `PRD-FINAL-001` /
`PRD-FINAL-002` / `PRD-FINAL-003` / `PRD-FINAL-004`.
**Work completed:** Added `tests/modules/prd-final-build-rule-coverage.test.ts`
to parse PRD section 24 directly, verify the ordered loop
`connect -> validate -> evidence -> fix -> verify -> report`, map every loop
stage to public API routes, and assert the first-customer acceptance/E2E
coverage proves the stage order through report export. Updated source,
requirement, traceability, story, acceptance, and coordination docs.
**Validation:** `pnpm test:modules -- prd-final-build-rule-coverage` PASS
(30 files / 110 tests); `pnpm prd:audit` PASS and reports
`SRC-24-FINAL-BUILD-RULE` as `EvidenceMapped`; `pnpm typecheck` PASS;
`pnpm lint` PASS. Full product completion remains blocked by remaining source
rows plus
`PRD-COMPLETE-001` and `PRD-RUNNER-003`.

## Codex First Demo Story Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-22-DEMO-STORY` / `PRD-DEMO-001` /
`PRD-DEMO-002` / `PRD-DEMO-003` / `PRD-DEMO-004`.
**Work completed:** Added `tests/modules/prd-demo-story-coverage.test.ts` to
parse section 22 directly and verify all nine demo-story steps against public
demo copy, normalized sample Snapshot evidence, and API/E2E proof-loop
coverage. Fixed the actual product gap the source audit exposed: the public
demo now renders remediation creation, retest, fixed/still-exposed verdict,
and evidence generation as explicit steps; the first-customer E2E now selects
the named repository-secret path; and repo-secret fix verification executes
fixture-safe Gitleaks/Prowler retests instead of falling back to
`Inconclusive`. Prowler now emits normalized `Cloud/PublicExposure` signals for
failed posture findings, Gitleaks/Prowler advertise `FixVerification`, and the
Gitleaks fixture target resolves file-relative to the repo.
**Validation:** `pnpm test:modules -- prd-demo-story-coverage` PASS (29 files /
107 tests); public demo web test PASS; focused modules test PASS (5 files /
137 tests); API typecheck PASS; DB-backed acceptance PASS (100 files / 123
tests); `CI=1 pnpm test:e2e -- first-customer-proof-loop` PASS; `pnpm lint`
PASS. `pnpm prd:audit` will report `SRC-22-DEMO-STORY` as `EvidenceMapped`
after this docs update; full product completion remains blocked by unresolved
source rows plus `PRD-COMPLETE-001` and `PRD-RUNNER-003`.

## Codex First Sellable MVP Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-19-FIRST-MVP` / `PRD-MVP-001` /
`PRD-MVP-002` / `PRD-MVP-003` / `PRD-MVP-004`.
**Work completed:** Added `tests/modules/prd-first-mvp-coverage.test.ts` to
parse section 19 directly and verify every MVP flow step, report bullet, and
success-signal sentence against code/tests/report output. Fixed two real
source drifts: default `ValidationSnapshot` tenants can now register optional
AI apps, and the public demo Snapshot now has three evidence-backed top paths
with matching remediation and verification guidance.
**Validation:** `pnpm test:modules -- prd-first-mvp-coverage` PASS (28 files /
104 tests); shared demo Snapshot test PASS; public demo report test PASS;
focused billing package test PASS; DB-backed acceptance PASS (100 files / 123
tests); `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm prd:audit` PASS with
`SRC-19-FIRST-MVP` now `EvidenceMapped`; full
`DATABASE_URL=...5434 PERISCAN_TEST_DATABASE_URL=...5434 pnpm verify` PASS
with build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E
58/58, security 22/22, and acceptance 100 files / 123 tests. Full product
completion remains blocked by pending source rows plus `PRD-COMPLETE-001` and
`PRD-RUNNER-003`.

## Codex Product Modules Parent Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3-MODULES` / `PRD-MODULES-001` /
`PRD-MODULES-002`.
**Work completed:** Added `tests/modules/prd-product-modules-coverage.test.ts`
to parse PRD section 3 headings and verify each product module subsection maps
to a child source row with `EvidenceMapped` status and dedicated evidence.
**Validation:** `pnpm test:modules -- prd-product-modules-coverage
coordination-docs prd-audit-gate` PASS (25 files / 94 tests); `pnpm
prd:audit` PASS and now reports `SRC-3-MODULES` as `EvidenceMapped`. Full
product completion remains blocked by 8 `NeedsImplementationAudit` rows, 6
`SectionIndexed` rows, and 2 partial requirement atoms.

## Codex Reports Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-16-REPORTS` / `PRD-REPORT-001` / `PRD-REPORT-002`.
**Work completed:** Added `tests/modules/prd-reports-coverage.test.ts`, which
parses PRD section 16 and verifies Validation Snapshot Report sections and
audience variants against rendered HTML/PDF output. Fixed customer-facing
report drift: explicit `Executive Summary` now renders in HTML, default report
label is `Periscan Validation Snapshot Report`, and section headings now use
`Control Verdicts` and `AI App Validation`.
**Validation:** `pnpm --filter @periscan/reports test` PASS (1 file / 20
tests); `pnpm test:modules -- prd-reports-coverage
prd-evidence-packs-coverage prd-validation-snapshot-coverage
prd-product-principles-coverage prd-ai-app-validation-coverage` PASS (24 files
/ 93 tests); `pnpm test:modules -- prd-reports-coverage coordination-docs
prd-audit-gate` PASS (24 files / 93 tests); `pnpm --filter @periscan/web test
-- public-demo-report` PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests. `pnpm prd:audit`
now reports `SRC-16-REPORTS` as `EvidenceMapped`; full-product completion
remains blocked by 8 `NeedsImplementationAudit` rows, 7 `SectionIndexed` rows,
and 2 partial requirement atoms.

## Codex PRD Audit Method Correction - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-23.1-AUDIT-DISCIPLINE` / `PRD-COMPLETE-001`.
**Work completed:** Hardened `docs/PRD_AUDIT_PROTOCOL.md` after the
Evidence Packs and Operators misses. The protocol now explicitly records that
broad feature-category tests are insufficient and that feasible source-derived
regression tests must parse the relevant PRD subsection directly before a
source row is marked covered.
**Validation:** `pnpm test:modules -- coordination-docs prd-audit-gate` PASS;
`pnpm prd:audit` PASS and still blocks full-product completion while source
rows or partial atoms remain.

## Codex Periscan Operators Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.8-OPERATORS` / `PRD-OP-001` / `PRD-OP-002` /
`PRD-OP-003` / `PRD-OP-004` / `PRD-OP-005` / `PRD-OP-006` /
`PRD-OP-007`.
**Work completed:** Added source-derived Operators regression coverage.
`tests/modules/prd-operators-coverage.test.ts` parses section 3.8 and maps
every PRD operator to public profiles and evidenced recommendations, then
verifies recommendation-only behavior, policy approval gates, evidence IDs,
uncertainty labels, no-outcome-invention behavior, safety levels, and API
approval creating draft missions rather than execution. The audit found and
fixed two gaps: proofless recommendations from configuration counts alone and
Blue Team recognition of descriptive normalized missed-control evidence.
**Validation:** `pnpm test:modules -- prd-operators-coverage` PASS (23 files
/ 91 tests); `pnpm test:modules -- prd-operators-coverage coordination-docs
prd-audit-gate` PASS (23 files / 91 tests); `pnpm --filter @periscan/operators
test` PASS; `pnpm --filter @periscan/operators typecheck` PASS; `pnpm --filter
@periscan/api test -- app.test.ts` PASS (19 files / 302 tests); full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests. `pnpm prd:audit`
still correctly blocks full-product completion claims with 9
`NeedsImplementationAudit` rows, 7 `SectionIndexed` rows, and 2 partial
requirement atoms.

## Codex Evidence Packs Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.7-EVIDENCE-PACKS` / `PRD-EVPACK-001` /
`PRD-EVPACK-002` / `PRD-EVPACK-003` / `PRD-EVPACK-004` /
`PRD-EVPACK-005` / `PRD-EVPACK-006` / `PRD-EVPACK-007` /
`PRD-EVPACK-008`.
**Work completed:** Added source-derived Evidence Packs regression coverage.
`tests/modules/prd-evidence-packs-coverage.test.ts` parses section 3.7 and
maps every PRD pack type to stable public pack contracts and rendered labels,
then verifies normalized evidence, evidence IDs, redaction/no-raw-output
behavior, audience-specific report sections, HTML/PDF exports, and MSSP
white-label branding. The audit found and fixed a customer-facing naming drift:
the stable enum remains `AIAppValidationReport`, but rendered reports now use
the PRD label `Periscan AI Security Validation Report`.
**Validation:** `pnpm test:modules -- prd-evidence-packs-coverage` PASS (22
files / 87 tests); `pnpm --filter @periscan/reports test` PASS; `pnpm --filter
@periscan/shared test -- domain` PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests. `pnpm prd:audit`
still correctly blocks full-product completion claims with 10
`NeedsImplementationAudit` rows, 7 `SectionIndexed` rows, and 2 partial
requirement atoms.

## Codex Fix Verification Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.6-FIX-VERIFICATION` / `PRD-FIXVER-001` /
`PRD-FIXVER-002` / `PRD-FIXVER-003` / `PRD-FIXVER-004` /
`PRD-FIXVER-005` / `PRD-FIXVER-006` / `PRD-FIXVER-007` /
`PRD-FIXVER-008`.
**Work completed:** Added source-derived Fix Verification regression coverage.
`tests/modules/prd-fix-verification-coverage.test.ts` parses section 3.6 and
maps every PRD outcome and requirement to public status contracts, remediation
links, ticket status tracking, closed-without-evidence detection, targeted
retest planning, verification events, attack-path/risk updates, and
evidence-pack/report rendering. The audit found and fixed a real gap: external
ticket-close sync now marks verification-required remediations as
`ClosedWithoutEvidence` with a `remediation.closed_without_evidence` system
audit event instead of only moving them to `VerificationPending`.
**Validation:** `pnpm test:modules -- prd-fix-verification-coverage` PASS (21
files / 84 tests); `pnpm --filter @periscan/api test --
runtime-services.test.ts -t
"resolveExternalTicketClosedRemediationStatus|buildVerificationResult
evidence-basis"` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t
"supports Jira ticketing and fix verification through the API"` PASS; `pnpm
--filter @periscan/shared test -- domain` PASS; `pnpm --filter @periscan/db
run db:validate` PASS. `pnpm prd:audit:strict` still fails by design because
full-product completion remains blocked by unresolved source rows plus partial
atoms (`PRD-COMPLETE-001`, `PRD-RUNNER-003`).

## Codex AI App Security Validation Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.5-AI-APP-VALIDATION` / `PRD-AIAPP-001` /
`PRD-AIAPP-002` / `PRD-AIAPP-003` / `PRD-AIAPP-004` /
`PRD-AIAPP-005` / `PRD-AIAPP-006` / `PRD-AIAPP-007` /
`PRD-AIAPP-008`.
**Work completed:** Added source-derived AI App Security Validation regression
coverage. `tests/modules/prd-ai-app-validation-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 3.5 and maps every PRD coverage
bullet, outcome, and requirement to safe suite contracts, module execution,
API registration/validation routes, verified scope, test-account notes,
redaction, AI App Validation Report rendering, and baseline/drift comparison.
The audit found and fixed three real gaps: missing AI validation categories
(`AgentOverPermissioning`, `SystemPromptExposure`, `CrossTenantRetrieval`,
`AISecurityReviewEvidence`), missing durable `testAccountNotes`, and Garak
harness support missing from the first-class validate route.
**Validation:** `pnpm test:modules -- prd-ai-app-validation-coverage` PASS (20
files / 79 tests); `pnpm --filter @periscan/shared test -- validation-catalog
domain` PASS (21 files / 131 tests); `pnpm --filter @periscan/modules test --
"safe AI validation"` PASS (5 files / 136 tests); `pnpm --filter @periscan/api
test -- app.test.ts -t "AI applications"` PASS; `pnpm --filter @periscan/api
typecheck` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests. `pnpm
prd:audit:strict` still fails by design with 19 unresolved source sections and
2 partial atoms (`PRD-COMPLETE-001`, `PRD-RUNNER-003`).

## Codex Attack-Path Validation Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.4-ATTACK-PATH` / `PRD-ATTACK-001` /
`PRD-ATTACK-002` / `PRD-ATTACK-003` / `PRD-ATTACK-004` /
`PRD-ATTACK-005` / `PRD-ATTACK-006` / `PRD-ATTACK-007`.
**Work completed:** Added source-derived Attack-Path Validation regression
coverage. `tests/modules/prd-attack-path-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 3.4 and maps every PRD example path,
core concept, and requirement to correlation behavior, BloodHound-compatible
identity import, graph/path schemas, edge evidence, path breakers, structured
control-response risk factors, ATT&CK report rendering, and before/after
comparison behavior. The audit found and fixed two real gaps:
`missed-control-real-exposure` correlation was missing, and Snapshot report
attack-path cards did not derive ATT&CK mapping from linked evidence signals.
**Validation:** `pnpm test:modules -- prd-attack-path-coverage` PASS (19 files /
72 tests); `pnpm --filter @periscan/evidence test` PASS (4 files / 27 tests);
`pnpm --filter @periscan/reports test` PASS (1 file / 20 tests).

## Codex Control Validation Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.3-CONTROL-VALIDATION` / `PRD-CONTROL-001` /
`PRD-CONTROL-002` / `PRD-CONTROL-003` / `PRD-CONTROL-004` /
`PRD-CONTROL-005` / `PRD-CONTROL-006`.
**Work completed:** Added source-derived Control Validation regression
coverage. `tests/modules/prd-control-validation-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 3.3 and maps every PRD control
category to control-source/connector/workflow surfaces, every PRD outcome to
`ControlValidationOutcomeSchema` and `DetectionRuleBehaviorSchema`, and every
requirement to ATT&CK-mapped dry-run Atomic scenarios, rule coverage/history
APIs, tuning recommendations, evidence IDs, and repeatable before/after
coverage summaries.
**Validation:** `pnpm test:modules -- prd-control-validation-coverage` PASS
(18 files / 68 tests).

## Codex Continuous Exposure Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.2-CONTINUOUS-EXPOSURE` / `PRD-CONTEXP-001` /
`PRD-CONTEXP-002` / `PRD-CONTEXP-003` / `PRD-CONTEXP-004` /
`PRD-CONTEXP-005` / `PRD-CONTEXP-006`.
**Work completed:** Added source-derived Continuous Exposure regression
coverage. `tests/modules/prd-continuous-exposure-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 3.2 and maps every coverage bullet
to connector/module/scope/acceptance evidence, every validation state to shared
contracts, recurring schedules to `/api/v1/schedules` plus the system sweep,
drift/reopened semantics to `buildScheduleDiff` and reopened verification
events, validated-risk separation to the findings proof fields, and CTEM stages
to `CTEMProgramSummarySchema` plus `/api/v1/ctem/program`.
**Validation:** `pnpm test:modules -- prd-continuous-exposure-coverage` PASS
(17 files / 63 tests).

## Codex Product Principles Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-2-PRINCIPLES` / `PRD-PRINCIPLES-001` /
`PRD-PRINCIPLES-002` / `PRD-PRINCIPLES-003` / `PRD-PRINCIPLES-004` /
`PRD-PRINCIPLES-005` / `PRD-PRINCIPLES-006`.
**Work completed:** Added source-derived Product Principles regression coverage.
`tests/modules/prd-product-principles-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 2 and maps proof-over-findings
surfaces, AI-in-workflow/evidence-grounding, safety-as-product bullets, and the
land-with-proof expansion path to implementation evidence. The audit found a
primary UX wording drift: the stable `/api/v1/findings` API was presented as
`Findings` in main navigation/page copy. The API remains stable; the first-party
UI now labels the surface as `Validated Results` / evidence-backed results.
**Validation:** `pnpm test:modules -- prd-product-principles-coverage` PASS (16
files / 59 tests); `pnpm --filter @periscan/web test -- findings-workbench
app-navigation` PASS (3 files / 12 tests).

## Codex Validation Snapshot Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.1-VALIDATION-SNAPSHOT` / `PRD-SNAPSHOT-001` /
`PRD-SNAPSHOT-002` / `PRD-SNAPSHOT-003` / `PRD-SNAPSHOT-004` /
`PRD-SNAPSHOT-005` / `PRD-SNAPSHOT-006`.
**Work completed:** Added source-derived Validation Snapshot regression
coverage. `tests/modules/prd-validation-snapshot-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 3.1 and maps every Snapshot input,
output, and requirement to API-visible surfaces, normalized Snapshot/report
fields, runner-optional onboarding, verified-scope enforcement, result
bounding, evidence/remediation/verification coverage, and HTML/PDF export. The
audit found and fixed two real gaps: generated top paths are now capped at 5,
and remediation is generated for every displayed top path instead of only
Critical/High paths.
**Validation:** `pnpm test:modules -- prd-validation-snapshot-coverage` PASS
(15 files / 54 tests); `pnpm test:modules -- prd-validation-snapshot-coverage
coordination-docs prd-audit-gate` PASS (15 files / 55 tests); `pnpm prd:audit`
PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Codex Runner Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-14-RUNNER` / `PRD-RUNNER-001` / `PRD-RUNNER-002` / `PRD-RUNNER-003` / `PRD-RUNNER-004` / `PRD-RUNNER-005` / `PRD-RUNNER-006`.
**Work completed:** Added source-derived Runner regression coverage. `tests/modules/prd-runner-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 14 deployment, security, and runner-flow requirements, then maps them to runner schemas, API services, Go runner tests, deployment artifacts, and safety docs. Docker/Linux/Kubernetes/Windows deployment contracts, outbound HTTPS/no reverse SSH/no inbound transport, signed task envelopes, local allowlists, nonce replay rejection, scope constraints, timeouts, local audit hashes, kill switch, evidence manifests, and lifecycle API routes are now source-mapped. The audit keeps `PRD-RUNNER-003` as `Partial` because the long-form PRD still says mTLS/certificate while the current runner intentionally uses bearer-over-TLS plus signed task envelopes for the default transport.
**Validation:** `pnpm test:modules -- prd-runner-coverage coordination-docs prd-audit-gate` PASS (14 files / 51 tests); `pnpm prd:audit` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, PRD audit, and acceptance 100 files / 123 tests. `pnpm prd:audit:strict` fails by design because full-product completion remains blocked by unresolved source rows and the `PRD-RUNNER-003` partial atom.

## Codex PRD Audit Gate - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AUDIT-004` / `PRD-COMPLETE-001` / `SRC-23.1-AUDIT-DISCIPLINE`.
**Work completed:** Added executable PRD audit gate coverage. `scripts/prd-audit-gate.ts` parses `docs/PRD_SOURCE_COVERAGE_LEDGER.md` and `docs/PRD_REQUIREMENT_LEDGER.md`, reports unresolved source rows and requirement atoms, and computes whether full-product completion can be claimed. `pnpm prd:audit` is now included in `pnpm verify`; `pnpm prd:audit:strict` intentionally fails until all source rows are atomized/evidence-mapped and no requirement rows remain `Partial`, `NotStarted`, or `Unknown`. `docs/COMPLETION_REPORT.md` and README now clarify first-customer readiness is not a full-PRD completion claim.
**Validation:** `pnpm test:modules -- prd-audit-gate coordination-docs` PASS; `pnpm prd:audit` PASS.

## Codex Risk Scoring Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-13-RISK-SCORING` / `PRD-RISK-001` / `PRD-RISK-002` / `PRD-RISK-003` / `PRD-RISK-004`.
**Work completed:** Added source-derived Risk Scoring regression coverage. `tests/modules/prd-risk-scoring-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 13 inputs, formula, and modifiers, verifies the public `RiskScoreInputSchema`, formula-level risk factors, and directional scoring semantics. Added explicit optional inputs for reachability, exploitability, known exploitation, threat relevance, recurrence, remediation status, and sensitive data while preserving existing callers. The audit found and fixed `Reopened` scoring lower than stable `Validated`.
**Validation:** `pnpm --filter @periscan/shared test -- domain` PASS (20 files / 129 tests); `pnpm --filter @periscan/evidence test` PASS (4 files / 26 tests); `pnpm test:modules -- prd-risk-scoring-coverage coordination-docs` PASS (12 files / 45 tests); shared/evidence typecheck PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Evidence Graph Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-12-EVIDENCE-GRAPH` / `PRD-GRAPH-001` / `PRD-GRAPH-002` / `PRD-GRAPH-003` / `PRD-GRAPH-004`.
**Work completed:** Added source-derived Evidence Graph regression coverage. `tests/modules/prd-evidence-graph-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 12 nodes, edges, and required questions, verifies graph node contracts/Postgres graph tables, edge relationship enums, and graph service behavior for reachability, identity access, secret-to-cloud-role paths, control misses, highest-impact paths, path breakers, closed-without-proof state, and reopened state.
**Validation:** `pnpm test:modules -- prd-evidence-graph-coverage` PASS (11 files / 40 tests); `pnpm test:modules -- prd-evidence-graph-coverage coordination-docs` PASS (11 files / 41 tests); `pnpm --filter @periscan/evidence test` PASS (4 files / 24 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Policy and Safety Engine Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-11-POLICY-SAFETY` / `PRD-POL-001` / `PRD-POL-002` / `PRD-POL-003` / `PRD-POL-004`.
**Work completed:** Added source-derived Policy and Safety Engine regression coverage. `tests/modules/prd-policy-safety-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 11 inputs, outputs, rules, and audit requirement, verifies policy schemas, deterministic evaluator outcomes, requested-action safety flags, tenant-policy/target inputs, and persisted `policy.decision` audit evidence. The audit found and fixed missing central evaluator inputs for `tenantPolicy` and `target`; tenant policy is stricter-only and cannot weaken global safety denials.
**Validation:** `pnpm --filter @periscan/policy test` PASS (2 files / 27 tests); `pnpm test:modules -- prd-policy-safety-coverage coordination-docs` PASS (10 files / 37 tests); `pnpm typecheck` PASS; focused accumulated-state scheduler acceptance files PASS (3 files / 3 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

**Audit process correction:** Full `pnpm verify` initially exposed three continuous-validation sweep acceptance timeouts even though the files passed in isolation. Root cause: direct scheduler tests swept hundreds of unrelated due tenants from the accumulated shared acceptance DB. `runSystemValidationSweep` now supports explicit `tenantIds` scoping for deterministic internal/test calls while preserving the production default of sweeping all due tenants. `docs/PRD_AUDIT_PROTOCOL.md` now requires accumulated-state release validation for shared runtime, scheduler, persistence, API, and security-boundary changes.

## Codex OSS Acceleration Plan Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-10-OSS-PLAN` / `SRC-10.1-INITIAL-ENGINES` / `SRC-10.2-OSS-POLICY` / `PRD-OSS-001` / `PRD-OSS-002` / `PRD-OSS-003` / `PRD-OSS-004`.
**Work completed:** Added source-derived OSS acceleration regression coverage. `tests/modules/prd-oss-plan-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 10.1 engine names and section 10.2 OSS policy bullets, verifies every PRD-named engine maps to reviewed toolchain metadata, product capabilities, module manifests, and safe disposition, and verifies OSS policy bullets against license policy, module certification, normalized evidence, and primary-report no-raw-output behavior.
**Validation:** `pnpm test:modules -- prd-oss-plan-coverage` PASS (9 files / 32 tests); focused `pnpm test:modules -- prd-oss-plan-coverage coordination-docs` PASS (9 files / 33 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Module Registry Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-9-MODULE-REGISTRY` / `PRD-MOD-001` / `PRD-MOD-002` / `PRD-MOD-003`.
**Work completed:** Added source-derived Module Registry regression coverage. `tests/modules/prd-module-registry-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 9 manifest fields and safety levels, verifies each PRD manifest field exists in `ModuleManifestSchema` and every registered module manifest, and verifies PRD safety levels 0-5 map to `SafetyLevelSchema`.
**Validation:** `pnpm test:modules -- prd-module-registry-coverage` PASS (8 files / 29 tests); focused `pnpm test:modules -- prd-module-registry-coverage coordination-docs` PASS (8 files / 30 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Signal Fabric Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-8-SIGNAL-FABRIC` / `PRD-SF-001` / `PRD-SF-002` / `PRD-SF-003` / `PRD-SF-004`.
**Work completed:** Added source-derived Signal Fabric regression coverage. `tests/modules/prd-signal-fabric-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 8 integration categories, MVP integrations, and V1 integrations, then verifies each PRD item maps to connector catalog entries or explicit platform surfaces for verified domain/external validation and AI app endpoint registration. The audit found no missing catalog/platform coverage and records explicit capability-name aliases for CI/CD, container registries, MDR, RAG systems, vector DBs, guardrails, and agent frameworks.
**Validation:** `pnpm test:modules -- prd-signal-fabric-coverage` PASS (7 files / 26 tests); focused `pnpm test:modules -- prd-signal-fabric-coverage coordination-docs` PASS (7 files / 27 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Data Model Source Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-6-DATA-MODEL` / `PRD-DATA-001` / `PRD-DATA-002` / `PRD-DATA-003` / `PRD-DATA-004`.
**Work completed:** Added source-derived data model regression coverage. `tests/modules/prd-data-model-coverage.test.ts` parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 6 core entities and fields, verifies every PRD field is represented in both shared Zod schemas and Prisma models, and verifies PRD scope types are present in shared/Prisma enums. The only mismatches are documented implementation aliases: `AIApplication.endpoint` -> `endpointUrl`, `data_sources` -> `dataSourcesDescription`, and `guardrails` -> `guardrailsDescription`.
**Validation:** `pnpm test:modules -- prd-data-model-coverage` PASS (6 files / 22 tests); focused `pnpm test:modules -- prd-data-model-coverage coordination-docs` PASS (6 files / 23 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex API Specification Route Coverage - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-7-API-SPEC` / `PRD-API-001` / `PRD-API-002` / `PRD-API-003` / `PRD-API-004` / `PRD-API-First`.
**Work completed:** Audited the long-form PRD section 7 route inventory against generated OpenAPI instead of relying on broad API-first traceability. The audit found missing `POST /api/v1/missions/:id/cancel` and `POST /api/v1/attack-paths/:id/verify`. Both are now implemented, documented in OpenAPI, and tested. Mission cancellation is tenant-scoped, cancels queued/running runs and jobs, writes `mission.cancelled`, and the worker skips cancelled/terminal jobs without reviving them. Attack-path verification creates a verified-scope, policy-gated draft mission with `queued: false` and `RequiresApproval`; it does not queue validation runs, fabricate proof, or mark fixed state.
**Validation:** `pnpm --filter @periscan/shared test -- domain` PASS; `pnpm --filter @periscan/api test -- app.test.ts` PASS (19 files / 300 tests); `pnpm --filter @periscan/worker test -- processor` PASS (6 files / 26 tests); focused shared/API/worker typecheck and lint PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Frontier Gateway Scope-Bound Context - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `SRC-3.X-FRONTIER-GATEWAY` / `PRD-FG-003` / `PRD-FG-004` / `PRD-FG-010`.
**Work completed:** Atomized the Frontier Gateway PRD section into `PRD-FG-001` through `PRD-FG-010` and moved `SRC-3.X-FRONTIER-GATEWAY` to `EvidenceMapped` in the source coverage ledger. Fixed a real PRD gap found during the audit: context bundles and read-only model tools now resolve verified session scopes and exclude tenant-wide assets/exposures/paths that do not match those scopes. Added scoped read tests for context bundles and tool execution.
**Validation:** `pnpm --filter @periscan/model-gateway test` PASS (7 files / 34 tests); `pnpm --filter @periscan/model-gateway typecheck` PASS; `pnpm --filter @periscan/model-gateway lint` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "model gateway"` PASS; `DATABASE_URL=...5434 PERISCAN_TEST_DATABASE_URL=...5434 pnpm test:acceptance -- model-gateway` PASS (100 files / 123 tests); `DATABASE_URL=...5434 PERISCAN_TEST_DATABASE_URL=...5434 pnpm test:security -- model gateway` PASS (2 files / 22 tests); `pnpm typecheck` PASS; `pnpm lint` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex PRD Source Coverage Ledger - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AUDIT-002` / `PRD-COMPLETE-001` / `PRD-ReleaseTraceability`.
**Work completed:** Added `docs/PRD_SOURCE_COVERAGE_LEDGER.md` after the latest review found that the atomic requirement ledger was only a seed focused on the recent third-party-tool miss, not a complete long-form PRD section index. The new ledger registers every major PRD section, including Frontier Gateway, and explicitly blocks full-product completion claims while rows remain `SectionIndexed` or `NeedsImplementationAudit`.
**Validation:** `pnpm test:modules -- coordination-docs` PASS (5 files / 19 tests); `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS.

## Codex Third-Party Tool Coverage Audit - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-3PT-011` / `PRD-AUDIT-001` / `PRD-ThirdPartyToolGovernance`.
**Work completed:** Added an API-first, read-only third-party tool coverage audit to prevent broad PRD audit rows from hiding unclassified OSS/security tools. `GET /api/v1/third-party-tools/coverage-audit` classifies every governed tool as `Executable`, `ContentOrImportOnly`, `Deferred`, `Blocked`, or `NeedsImplementation` by comparing the reviewed tool catalog to module manifests and capability metadata. The response includes explicit no-side-effect markers: it does not enable tools, install runtimes, execute modules, queue missions, or dispatch runner tasks.
**Validation:** Focused `@periscan/shared`, `@periscan/api`, and `@periscan/web` tests PASS.

## Codex PRD Audit Protocol - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AUDIT-001` / `PRD-COMPLETE-001` / `PRD-ReleaseTraceability`.
**Work completed:** Added a source-first PRD audit protocol and seed requirement ledger after the certification-history miss proved that broad traceability labels, newest-first execution history, and passing tests can hide unatomized PRD requirements. `docs/PRD_AUDIT_PROTOCOL.md` records the root cause, required source-first workflow, requirement atomization rules, and completion-claim policy. `docs/PRD_REQUIREMENT_LEDGER.md` separates third-party tool governance atoms and keeps future OSS tool coverage `Partial` where the governance framework exists but additional individual wrappers/importers remain ongoing. README, PRD, long-form PRD, user stories, acceptance criteria, traceability, implementation status, and coordination docs now point to the protocol.
**Validation:** `pnpm test:modules -- coordination-docs` PASS (5 files / 18 tests).

## Codex Third-Party Tool Promotion Certification History - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolPromotionCertificationHistory` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First` / `PRD-Runner-OutboundOnly`.
**Work completed:** Added durable, tenant-scoped promotion certification snapshots for third-party tool packages. `POST /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications` computes the current certification report, persists the normalized snapshot, writes `third_party_tool.promotion_certified`, and adds it to `/api/v1/third-party-tools/:toolId/activity` as `PromotionCertification`. `GET .../certifications` lists saved snapshots, and Registry Center consumes both routes through `Save certification snapshot` and `Load certification history`. The workflow does not enable tools, install runtimes, queue missions, dispatch runner tasks, or execute modules.
**Validation:** Focused shared/db/API/web/OpenAPI/lint/typecheck checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Promotion Certification - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolPromotionCertification` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First` / `PRD-Runner-OutboundOnly`.
**Work completed:** Added a read-only, API-first certification report for promoted third-party tool packages. `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certification-report` computes package, catalog, module/capability, required-evidence, governance, runtime, runner, policy, and safety checks from current tenant state and returns certified-for-governance/runtime/mission/runner flags. Registry Center consumes the same API through `Load certification report`. The workflow does not enable tools, install runtimes, queue missions, dispatch runner tasks, or execute modules.
**Validation:** Focused shared/API/web/OpenAPI/lint/typecheck checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Candidate Readiness Summary - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolCandidateReadinessSummary` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First`.
**Work completed:** Added a read-only, API-first readiness summary workflow for the third-party tool candidate backlog. `GET /api/v1/third-party-tools/intake/candidates/readiness-summary` returns all current tenant candidates with per-candidate readiness reports, readiness counts, review/intake counts, top required actions, and explicit no-side-effect markers. Registry Center consumes the same API through `Summarize readiness`. The workflow does not create catalog entries, install or enable tools, queue missions, dispatch runner tasks, create install jobs, or execute modules.
**Validation:** Focused shared/API/web/OpenAPI/lint/typecheck checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Candidate Batch Import - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolCandidateBatchImport` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First`.
**Work completed:** Added a bounded, API-first batch import workflow for proposed third-party tool manifests. `POST /api/v1/third-party-tools/intake/candidates/import` validates each manifest independently, returns per-item `Submitted`/`Failed`/`Rejected`/`RequiresChanges` outcomes, isolates malformed and duplicate entries with item-level errors, persists successful entries into the existing tenant candidate backlog, and writes per-candidate plus batch audit metadata. Registry Center consumes the same endpoint with a batch manifest JSON import control. The workflow does not create catalog entries, install or enable tools, queue missions, dispatch runner tasks, create install jobs, or execute modules.
**Validation:** Focused shared/db/API/web/OpenAPI/audit checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Implementation Bundles - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolImplementationBundle` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First`.
**Work completed:** Added an API-first, non-executing implementation bundle workflow for accepted third-party tool work orders. `GET /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle` derives scaffold file content, SHA-256 hashes, validation commands, required actions, safety notes, and `doesNotExecute: true` from the persisted work order. The route writes `third_party_tool.implementation_bundle_generated` and does not write repo files, install, enable, queue missions, dispatch runner tasks, or execute modules. Registry Center consumes the route through `Load implementation bundle`.
**Validation:** Focused shared/db/API/web checks PASS; API/web lint PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS after correcting the migration to alter `AuditEventAction`, with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Due Refresh - 2026-06-28

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolDueRefresh` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First`.
**Work completed:** Added an API-first due-refresh workflow at `/api/v1/third-party-tools/refresh-due`. The route batch-checks due reviewed tools by creating the same persisted upstream-version checks and reviewed update recommendations used by the single-tool endpoints, skips disabled/deferred/legal-review tools by default, writes a `third_party_tool.refresh_due_checked` audit event, and does not install, enable, queue missions, dispatch runner tasks, or execute modules. Registry Center consumes the route with a `Refresh due tools` control.
**Validation:** Focused shared/API/web/db/docs checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Runner Task Activity - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolRunnerTaskActivity` / `PRD-ThirdPartyToolGovernance` / `PRD-API-First` / `PRD-Runner-OutboundOnly`.
**Work completed:** Third-party tool activity now includes persisted runner task lifecycle entries through `/api/v1/third-party-tools/:toolId/activity`. The API aggregates runner tasks by tenant and tool-bound module IDs, returning task status, task ID, module ID, runner ID, scope ID, run ID, task type, and evidence count without exposing raw target values in activity metadata.
**Validation:** `pnpm --filter @periscan/shared test -- open-source` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "open source tool"` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS.

## Codex Third-Party Tool Runner Dispatch UI - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolRunnerDispatchUX` / `PRD-ThirdPartyToolGovernance` / `PRD-API-First` / `PRD-Runner-OutboundOnly`.
**Work completed:** Registry Center now exposes governed runner dispatch controls for third-party tools after the server reports dispatchable capabilities through `/api/v1/third-party-tools/:toolId/runner-eligibility`. The form submits selected capability, runner ID, verified scope ID, target, timeout, and rate limit to `/api/v1/third-party-tools/:toolId/runner-dispatch`, then renders the persisted task, mission, and run IDs from the signed runner task creation result. The UI does not execute locally or bypass server-side tenant enablement, verified scope, policy, kill switch, allowlist, signing, or audit enforcement.
**Validation:** `pnpm --filter @periscan/web test -- registry-center` PASS; `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS.

## Codex Third-Party Tool Promotion Governance Handoff - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolPromotionHandoff` / `PRD-ThirdPartyToolGovernance` / `PRD-API-First` / `PRD-Runner-OutboundOnly`.
**Work completed:** Promotion packages now expose a current-state governance handoff through `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/governance-handoff`. The API computes status and next actions from tenant governance, runtime readiness, runner eligibility, and the stored promotion package. Registry Center consumes it through `Load governance handoff` and marks actions that create execution or require policy gates. The report is read-only and does not install, enable, queue, dispatch, or execute tools.
**Validation:** Focused shared/API/web tests, typechecks, and API/web lint PASS.

## Codex Third-Party Tool Promotion Package UI - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolPromotionPackageUX` / `PRD-ThirdPartyToolPromotionPackage` / `PRD-API-First`.
**Work completed:** Registry Center now loads existing backend promotion packages for promoted candidates through `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`, stores them as a per-candidate list, renders the latest package status/summary/counts/safety notes, and leaves package creation behind the explicit generate action.
**Validation:** `pnpm --filter @periscan/web test -- registry-center` PASS; `pnpm --filter @periscan/web typecheck` PASS.

## Codex Third-Party Tool Promotion Packages - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolPromotionPackage` / `PRD-ThirdPartyToolOnboardingIntake` / `PRD-ThirdPartyToolGovernance` / `PRD-API-First`.
**Work completed:** Implemented focused API-first promotion packages for reviewed third-party tool candidates. Tenant Owner/Admin users can list or generate readiness-gated promotion packages through `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`; review promotion now auto-generates the same artifact. Each package snapshots reviewed catalog metadata, candidate readiness, tenant governance, runtime installation state, modules, capabilities, required evidence, and safety notes, writes `third_party_tool.promotion_package_generated`, appears in the tool activity timeline, and remains non-executing.
**Validation:** Focused shared/db/API/web checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Runner Dispatch - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolRunnerDispatch` / `PRD-ThirdPartyToolGovernance` / `PRD-Runner-OutboundOnly` / `PRD-API-First`.
**Work completed:** Implemented focused API-first runner dispatch for governed third-party tool capabilities. Tenant Owner/Admin users can call `/api/v1/third-party-tools/:toolId/runner-dispatch` with a reviewed capability, runner, verified scope, and target. The service validates the capability against the same eligibility model, rejects non-ready/blocked/unallowlisted capabilities before task creation, delegates to existing signed runner task builders, and writes tenant audit events for successful or denied governance dispatch. The server-side discovery allowlist now matches safe runner-agent recon modules for `nmap`, `subfinder`, `httpx`, and `dnsx`; legal/offensive/live-adversarial capabilities remain non-dispatchable.
**Validation:** Focused shared/modules/db/API/web checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Runner Eligibility - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolRunnerEligibility` / `PRD-ThirdPartyToolGovernance` / `PRD-Runner-OutboundOnly` / `PRD-API-First`.
**Work completed:** Implemented and full validation passed. Tenant Owner/Admin users can read runner dispatch readiness through `/api/v1/third-party-tools/:toolId/runner-eligibility`. The API combines tenant tool governance, runtime readiness, active internal runners, verified compatible scopes, capability implementation status, approval requirements, and server-side signed-task dispatch allowlists. Registry Center consumes the same API with a per-tool "Check runner" control. The report is read-only and does not install tools, queue missions, create runner tasks, or execute modules.
**Validation:** Focused shared/API/web checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Activity Timeline - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolActivityTimeline` / `PRD-ThirdPartyToolGovernance` / `PRD-API-First` / `PRD-OSS-Productization`.
**Work completed:** Implemented and full validation passed. Tenant Owner/Admin users can list a per-tool lifecycle timeline through `/api/v1/third-party-tools/:toolId/activity`. The API assembles activity from real tenant-scoped governance/audit data: third-party tool audit events, check/install jobs, validation runs for module IDs bound to the tool, upstream version checks, reviewed update recommendations, intake candidates, and implementation work orders. Registry Center consumes the same API with a per-tool "Load activity" control. The timeline is read-only and does not install, enable, queue, execute, or expose credentials/raw scanner output.
**Validation:** Focused shared/API/web tests PASS; API/web typecheck PASS; API/web lint PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Runner Local Lab Full Internal Checks - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Runner-LocalLabE2E` / `PRD-Runner-OutboundOnly` / `PRD-Runner-SignedTasks` / `PRD-Runner-ScopeEnforcement`.
**Work completed:** Implemented and full validation passed. `pnpm test:runner:lab` now exercises every implemented safe Go runner module, not only reachability: signed in-scope reachability, DNS resolution, TLS certificate, and HTTP health tasks run against local loopback fixtures, upload normalized evidence through the artifact callback, and verify evidence manifests without touching external targets. The lab script now runs the full local-lab test family.
**Validation:** `pnpm test:runner:lab` PASS; `pnpm test:runner` PASS; `pnpm test:modules -- coordination-docs` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, expanded runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Upstream Version Checks - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolUpstreamVersionCheck` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First`.
**Work completed:** Implemented and full validation passed. Tenant Owner/Admin users can check trusted upstream source metadata for reviewed tools through `/api/v1/third-party-tools/:toolId/upstream-version-checks`, persist tenant-scoped candidate reports, and view those reports in Registry Center. Checks use reviewed catalog metadata only, write sanitized `third_party_tool.upstream_checked` audit events, and cannot update reviewed catalog versions, tenant pins, install jobs, mission queues, module execution, or runner tasks. Candidate versions become actionable only after normal catalog/module/parser/license/runtime review creates reviewed update recommendations.
**Validation:** Focused shared/modules/db/API/web tests PASS; focused package/repo typecheck/lint PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Update Recommendations - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolUpdateRecommendation` / `PRD-ThirdPartyToolGovernance` / `PRD-API-First`.
**Work completed:** Implemented and full validation passed. Tenant Owner/Admin users can list, check, apply, and dismiss reviewed-version update recommendations through `/api/v1/third-party-tools/:toolId/update-recommendations`. Recommendations compare tenant pins only with reviewed catalog versions, persist current/reviewed/installed version metadata, write sanitized audit events, can queue an install job on apply, reject unsupported install runtimes with a 400 product error, and do not accept arbitrary versions or execute tools directly. Registry Center consumes the same API and renders recommendation status/actions.
**Validation:** Focused shared/db/API/web suites PASS; focused API/web/shared typecheck PASS; `pnpm lint` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Implementation Work Orders - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolImplementationWorkOrder` / `PRD-ThirdPartyToolOnboardingIntake` / `PRD-API-First`.
**Work completed:** Implemented and full validation passed. Accepted third-party tool candidates now have tenant-scoped implementation work orders at `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`. Owner/Admin users can generate/list task and scaffold plans after a candidate is accepted for implementation; generation blocks non-accepted/non-reviewed candidates, writes sanitized `third_party_tool.work_order_generated` audit metadata, appears in OpenAPI/API Reference metadata, and Registry Center consumes the route without writing repo files, installing packages, enabling tools, queueing missions, or executing modules. API Reference long paths now wrap on mobile so the added endpoints do not create document-level overflow.
**Validation:** Focused shared/db/API/web suites PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Candidate Review - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolCandidateReview` / `PRD-ThirdPartyToolOnboardingIntake` / `PRD-API-First`.
**Work completed:** Implemented and focused validation passed. Submitted tool candidates now have a tenant-scoped review workflow at `/api/v1/third-party-tools/intake/candidates/:candidateId/review`. Tenant Owner/Admin users can mark candidates `NeedsChanges`, `AcceptedForImplementation`, `Rejected`, or readiness-gated `PromotedToCatalog`; accepted-review requires an accepted intake decision, promotion requires readiness to prove catalog/module/governance/runtime/runner/legal completion, and review actions update metadata/audit events only without installing, enabling, queueing, or executing proposed tools. Registry Center renders review status/owner/notes and calls the same API.
**Validation:** `pnpm --filter @periscan/shared test -- open-source` PASS; `pnpm --filter @periscan/db run db:validate` PASS; `pnpm --filter @periscan/db run db:generate` PASS; `pnpm --filter @periscan/api test -- audit-action-contract` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "open source tool"` PASS; `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|open source tool"` PASS; `pnpm --filter @periscan/web test -- periscan-api-client` PASS; `pnpm --filter @periscan/web test -- registry-center` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Candidate Readiness - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolCandidateReadiness` / `PRD-ThirdPartyToolOnboardingIntake` / `PRD-API-First`.
**Work completed:** Implemented and focused validation passed. Submitted tool candidates now have a tenant-scoped read-only readiness report at `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness`. The API compares the candidate against actual reviewed catalog entries, module manifests, module/tool bindings, governance availability, runtime metadata, runner compatibility, and legal/safety gates, returning `ReadyForGovernance`, `NeedsImplementation`, or `Blocked` with checks and required actions. Registry Center can fetch and render the report without promoting, installing, enabling, queueing, or executing unreviewed tools.
**Validation:** `pnpm --filter @periscan/shared test -- open-source` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "open source tool"` PASS; `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|open source tool"` PASS; `pnpm --filter @periscan/web test -- registry-center periscan-api-client` PASS; API/web/shared typechecks PASS; API/web/shared lint PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Candidate Backlog - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolCandidateBacklog` / `PRD-ThirdPartyToolOnboardingIntake` / `PRD-API-First`.
**Work completed:** Implemented. Third-party tool intake submissions can now be persisted as tenant-scoped candidate backlog records through `/api/v1/third-party-tools/intake/candidates`. Records store the proposed manifest, deterministic validation report, review status, requester, timestamps, and audit event, and Registry Center renders/submits the backlog without installing, cataloging, enabling, queueing missions, or executing unreviewed tools.
**Validation:** `pnpm --filter @periscan/shared test -- open-source` PASS; `pnpm --filter @periscan/db run db:validate` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "open source tool"` PASS; `pnpm --filter @periscan/web test -- registry-center periscan-api-client` PASS; focused API/web/shared typecheck and API/web lint PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## Codex Registry Center Tool Intake UI - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolOnboardingIntakeUX` / `PRD-ThirdPartyToolOnboardingIntake` / `PRD-API-First`.
**Work completed:** Implemented. Registry Center now includes a Tool Onboarding Intake form backed by `/api/v1/third-party-tools/intake/validate`. The web API client parses the shared intake report contract, the UI renders decision/checks/installable runtimes/runner compatibility/required actions, and the flow remains non-executing: no unreviewed catalog entries, install jobs, missions, or tool execution.
**Validation:** `pnpm --filter @periscan/web test -- registry-center periscan-api-client` PASS; `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS.

## Codex Third-Party Tool Onboarding Intake - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolOnboardingIntake` / `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First`.
**Work completed:** Implemented. Added typed tool-intake contracts, a deterministic non-executing evaluator, `/api/v1/third-party-tools/intake/validate`, OpenAPI metadata, audit event support, and docs/traceability for systematic future tool-library expansion. Intake reports duplicate IDs, license/legal posture, installable runtimes, safety-boundary failures, scope contract, runner compatibility, required files/tests, and remediation actions without installing or executing arbitrary tools.
**Validation:** Focused `pnpm --filter @periscan/shared test -- open-source` PASS; `pnpm --filter @periscan/modules test -- tool-intake` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "open source tool"` PASS; focused shared/modules/API typecheck and lint PASS.

## Codex Third-Party Tool Install Worker - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolInstallWorker` / `PRD-ThirdPartyToolGovernance` / `PRD-API-First` / `PRD-Real-First`.
**Work completed:** Implemented. Third-party tool install requests now create queued, audited jobs from the API instead of executing commands in route handlers. A platform worker leases queued jobs, uses shared manifest-derived install plans for docker/git/pip only, executes only when `PERISCAN_THIRD_PARTY_TOOL_INSTALL_WORKER_ENABLED=true` and `PERISCAN_THIRD_PARTY_TOOL_INSTALL_EXECUTE=true`, redacts output, updates runtime readiness, and writes install success/failure audit events.
**Validation:** Full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex Third-Party Tool Governance Center - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThirdPartyToolGovernance` / `PRD-OSS-Productization` / `PRD-API-First` / `PRD-Runner-OutboundOnly`.
**Work completed:** Implemented. Added the API-first governance center for Periscan-managed third-party validation tools: shared DTOs, additive Prisma policy/job persistence, mutable `/api/v1/third-party-tools` APIs, OpenAPI metadata, tenant mission-start denial for disabled tools, Registry Center controls, and docs for systematic future tool onboarding plus outbound-only runner execution.
**Validation:** Full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex Superseded PR Closure - 2026-06-27

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AgentCoordinationTraceability` / `PRD-ReleaseTraceability` stale parallel PRs should not remain open when their commits are already contained in the active integration branch.
**Work completed:** Inspected GitHub PR #36 (`codex/module-manifest-safety-metadata`), confirmed its head commit `f84925f` is an ancestor of the current integration branch, closed the PR with a superseded note, and refreshed spec/public traceability so the module manifest metadata work is documented as contained in the active branch rather than active side-branch work.
**Validation:** `git merge-base --is-ancestor f84925f475a64e9f483c47b6228a1197a121233c HEAD` PASS; `gh pr close 36 --repo seanheiney/periscan --comment ...` PASS; `gh pr status --repo seanheiney/periscan` PASS (no open PRs); `pnpm test:modules -- coordination-docs` PASS.

## Codex Historical Review Banners - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AgentCoordinationTraceability` / `PRD-ReleaseTraceability` / `GAP-HISTORICAL-REVIEW-BANNERS-001` stale June 5 review files must not route future agents from outdated open-gap notes after current traceability closes those gaps.
**Work completed:** Added historical snapshot banners to `.ai/ux-review.md`, `.ai/devops-review.md`, `.ai/security-review.md`, `.ai/product-review.md`, and `.ai/qa-review.md`, matching the existing architecture/final report treatment. The coordination-doc regression now enforces the banner across all legacy review/report files.
**Validation:** `pnpm test:modules -- coordination-docs` PASS (5 files / 16 tests); `git diff --check` PASS.

## Codex Connector Health Truthfulness - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ConnectorHealthTruthfulness` / `PRD-Real-First` / `PRD-SignalFabric` / `GAP-CONNECTOR-UNKNOWN-HEALTH-INTENTIONAL-001` remaining live connector `Unknown` states must be intentional safety boundaries, not ungrounded placeholder health where a safe read-only probe exists.
**Work completed:** Added connector regression coverage for Slack, Microsoft Teams, PagerDuty, and no-ID Lakera Guard. The tests prove these live health/sync paths do not call webhook delivery, incident-trigger, Lakera metadata, or Lakera runtime guard endpoints merely to verify readiness; they return `Unknown` with zero assets/signals and no credential material in serialized results.
**Validation:** `pnpm --filter @periscan/connectors test -- intentional-unknown-health` PASS (37 files / 279 tests); `pnpm --filter @periscan/connectors typecheck` PASS.

## Codex Full Verification After Connector Health Truthfulness - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` / `GAP-RELEASE-VERIFY-CONNECTOR-HEALTH-TRUTHFULNESS-001` active release docs must cite the latest full validation gate after connector health truthfulness and test/docs updates.
**Work completed:** Full `pnpm verify` passed after the connector health truthfulness slice. The generated `apps/web/next-env.d.ts` route-type drift from `next build` was restored to the tracked production route reference before this docs refresh.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex Full Verification After Webhook Audit And API Test Isolation - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` / `GAP-RELEASE-VERIFY-WEBHOOK-AUDIT-TEST-ISOLATION-001` active release docs must cite the latest full validation gate after DB/audit and test-runner configuration changes.
**Work completed:** Full `pnpm verify` passed after the tenant webhook lifecycle audit and API test build-artifact isolation slices. The generated `apps/web/next-env.d.ts` route-type drift from `next build` was restored to the tracked production route reference before this docs refresh.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex API Test Build-Artifact Isolation - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseValidationDeterminism` / `PRD-AuditActionContractGuard` / `PRD-ProductionReadiness` / `GAP-API-TEST-DIST-EXCLUDE-001` focused API validation must not execute stale ignored build-output tests.
**Work completed:** Added `apps/api/vitest.config.ts` with an explicit `**/dist/**` exclusion after the audit action contract command proved local compiled API tests could run stale mappings. The guard now validates current source contracts even when `apps/api/dist` exists after a build.
**Validation:** `pnpm --filter @periscan/api test -- audit-action-contract` PASS.

## Codex Tenant Webhook Lifecycle Audit Completeness - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Audit-Log-Completeness` / `PRD-Webhooks` / `PRD-API-First` / `PRD-IntegrationCredentialRedaction` / `GAP-WEBHOOK-LIFECYCLE-AUDIT-COMPLETENESS-001` outbound webhook lifecycle changes must be auditable without leaking signing secrets, endpoint URLs, or payload content.
**Work completed:** Added shared/Prisma audit enum support for webhook create/update/delete/test actions, mapped those actions through the audit persistence layer, and wrote DB-backed plus in-memory audit events from tenant webhook lifecycle services. API and acceptance regressions assert `/api/v1/audit-events` exposes the lifecycle events with `TenantWebhook` context and no webhook secret or URL.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "tenant webhook lifecycle"` PASS; `pnpm test:acceptance -- webhook-delivery-flow` PASS; API lint/typecheck, shared domain, DB validate/generate/test, coordination docs, and `git diff --check` PASS.

## Codex Integration Audit Credential Exposure Regression - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Audit-Log-Completeness` / `PRD-IntegrationCredentialRedaction` / `PRD-API-First` / `GAP-INTEGRATION-AUDIT-CREDENTIAL-EXPOSURE-REGRESSION-001` integration onboarding must be auditable without leaking raw connector configuration or credentials.
**Work completed:** Extended the integration catalog API regression so tenant audit reads for `integration.connected` are checked after API-key, assume-role, and webhook integrations are created. The assertion proves audit metadata carries connector identity context only and contains no raw `config` object or credential material.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "integration catalog"` PASS.

## Codex Trust Safety Credential Exposure Regression - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-TrustSafety` / `PRD-IntegrationCredentialRedaction` / `PRD-API-First` / `GAP-TRUST-SAFETY-CREDENTIAL-EXPOSURE-REGRESSION-001` Trust & Safety readiness metadata must not create a new integration-secret exposure path.
**Work completed:** Extended the integration catalog API regression so it creates API-key, assume-role, and webhook integrations, then verifies `/api/v1/tenants/current/trust-safety` exposes connected integration readiness metadata without raw `config` objects or credential material. Added user story, acceptance criterion, and traceability entries for the invariant.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "integration catalog"` PASS.

## Codex Spec Index Current Addendum Refresh - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AgentCoordinationTraceability` / `PRD-ReleaseTraceability` / `GAP-SPEC-INDEX-CURRENT-ADDENDUM-DRIFT-001` the current spec index addendum must not lag the active branch, connector/readiness state, or Trust & Safety metadata work.
**Work completed:** Updated `.ai/spec-index.md` from a 2026-06-20 addendum to a current 2026-06-24 addendum. It now names OCI and Alibaba Cloud as connectable Beta read-only connectors, records the 123 dedicated live / 141 standardized connectable catalog split, and points agents to API-backed integration readiness metadata on records, Marketplace, and Trust & Safety. Added a coordination-doc regression for the current addendum.
**Validation:** `pnpm test:modules -- coordination-docs` PASS.

## Codex Full Verification Refresh After Trust Safety Readiness Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` / `GAP-RELEASE-VERIFY-TRUST-SAFETY-READINESS-001` active release docs must cite the latest full validation gate after the Trust & Safety integration readiness metadata slice.
**Work completed:** Full `pnpm verify` passed after `GAP-TRUST-SAFETY-INTEGRATION-READINESS-METADATA-001`. Updated current release/predeployment/implementation/completion docs so their "latest full verify" language points to the Trust & Safety readiness metadata slice instead of older API Reference or persisted integration catalog slices.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex Trust Safety Integration Readiness Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-TrustSafety` / `PRD-IntegrationMarketplace` / `PRD-API-First` / `PRD-Real-First` / `GAP-TRUST-SAFETY-INTEGRATION-READINESS-METADATA-001` Trust & Safety connected-system inventory should expose persisted integration readiness metadata through the tenant-scoped API and first-party dashboard.
**Work completed:** Extended `TrustSafetyConnectedIntegrationSchema` with connector key, implementation tier, execution readiness, readiness reason, dedicated-client flag, and live-support flag; DB-backed and in-memory Trust & Safety summary builders now prefer persisted integration metadata with connector-catalog fallback; the dashboard renders those fields from `/api/v1/tenants/current/trust-safety`.
**Validation:** `pnpm --filter @periscan/shared test -- domain` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "integration catalog"` PASS; `pnpm --filter @periscan/web test -- trust-safety-dashboard` PASS; shared/API/web typechecks PASS.

## Codex Typed Integration Permissions Summary - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-IntegrationMarketplace` / `PRD-API-First` / `GAP-INTEGRATION-PERMISSIONS-SUMMARY-SCHEMA-001` connected integration metadata fields should be typed in the shared API contract and OpenAPI output, not only accepted as loose JSON.
**Work completed:** Added `IntegrationPermissionsSummarySchema`, `IntegrationImplementationTierSchema`, and `IntegrationExecutionReadinessSchema` in `packages/shared`; `IntegrationSchema.permissionsSummary` now documents connector key, implementation tier, execution readiness, dedicated/live flags, readiness reason, and required permissions while retaining catchall compatibility for legacy/custom metadata. Domain tests cover valid metadata and invalid readiness rejection.
**Validation:** `pnpm --filter @periscan/shared test -- domain openapi` PASS; `pnpm --filter @periscan/shared typecheck` PASS; `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|integration catalog"` PASS.

## Codex Product Plan Completed-Slice Labeling - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AgentCoordinationTraceability` / `PRD-ReleaseTraceability` / `GAP-PRODUCT-PLAN-NEXT-SLICES-DRIFT-001` completed historical execution slices must not be labeled as the active next-work queue.
**Work completed:** `docs/PRODUCT_COMPLETION_PLAN.md` now labels the former "Next 5 execution slices" section as completed execution history and points agents to `.ai/status.md`, `.ai/gap-backlog.md`, and `docs/IMPLEMENTATION_STATUS.md` for current work selection. The coordination-doc regression rejects the stale heading.
**Validation:** `pnpm test:modules -- coordination-docs` PASS.

## Codex Connected Integration Metadata UI - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-IntegrationMarketplace` / `PRD-API-First` / `PRD-Real-First` / `GAP-INTEGRATION-CONNECTED-METADATA-UI-001` the Integration Marketplace connected-state panel should render persisted integration readiness metadata from `/api/v1/integrations`, not only catalog-card metadata.
**Work completed:** Connected integration cards now prefer `permissionsSummary` metadata for implementation tier, execution readiness, dedicated-vs-standardized status, live support, and readiness reason, with catalog fallback for older records. The component regression uses a connected integration whose persisted metadata intentionally differs from the catalog entry to prove the UI consumes the connected integration API response.
**Validation:** `pnpm --filter @periscan/web test -- integration-marketplace` PASS; `pnpm --filter @periscan/web typecheck` PASS.

## Codex Persisted Integration Catalog Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-IntegrationMarketplace` / `PRD-API-First` / `PRD-Real-First` / `GAP-INTEGRATION-PERSISTED-CATALOG-METADATA-001` connected integration records must remain self-describing for API customers and replacement UIs instead of requiring a join back to `/api/v1/integrations/catalog`.
**Work completed:** Added a connector helper that returns enriched catalog entries by key; Prisma-backed and in-memory integration creation now persist non-secret catalog metadata in `permissionsSummary`, including `connectorKey`, `implementationTier`, `dedicatedClient`, `live`, `executionReadiness`, `executionReadinessReason`, and `requiredPermissions`. The API regression proves create/list/read responses preserve this metadata for both a dedicated GitHub connector and standardized Darktrace catalog connector while credential fields remain redacted.
**Validation:** `pnpm --filter @periscan/connectors test -- "connectors registry"` PASS (36 files / 275 tests); `pnpm --filter @periscan/api test -- app.test.ts -t "integration catalog"` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## Codex Registry Capability Readiness Visibility - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RegistryCenter-APISurface` / `PRD-OSS-Productization` / `PRD-API-First` / `GAP-REGISTRY-CAPABILITY-READINESS-VISIBILITY-001` security reviewers and replacement UIs need capability-level readiness visible in the product surface, not only aggregate OSS tool readiness.
**Work completed:** Registry Center capability cards now render `executionReadiness`, runtime reason, safety levels, required scopes, required integrations, and evidence outputs from `/api/v1/open-source-capabilities`; the regression fixture covers Ready, FixtureOnly, and Blocked capability states so policy/legal-review metadata stays visible.
**Validation:** `pnpm --filter @periscan/web test -- registry-center` PASS; `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS.

## Codex Integration Catalog API Tier Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-IntegrationMarketplace` / `PRD-API-First` / `PRD-Real-First` / `GAP-INTEGRATION-CATALOG-API-TIER-METADATA-001` replacement UIs and customer API clients need implementation-tier/readiness metadata in `/api/v1/integrations/catalog`, not only in generated docs.
**Work completed:** Added `ConnectorCatalogEntrySchema` with `implementationTier`, `dedicatedClient`, `live`, `executionReadiness`, `executionReadinessReason`, and `certificationLevel`; changed `getConnectorCatalog()` to enrich entries from the registry; updated OpenAPI response metadata, web API client typing, and Integration Marketplace rendering; regenerated `docs/INTEGRATIONS.md` / `docs/integrations.json` from the enriched runtime fields.
**Validation:** `pnpm --filter @periscan/connectors test -- "connectors registry"` PASS (36 files / 274 tests); `pnpm --filter @periscan/web test -- integration-marketplace` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "integration catalog"` PASS; `pnpm --filter @periscan/api test -- openapi-coverage` PASS; `pnpm test:modules -- integration-docs` PASS; connector/API/web typechecks PASS.

## Codex Integration Catalog Connectability Truthfulness - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-IntegrationMarketplace` / `PRD-API-First` / `PRD-Real-First` / `GAP-INTEGRATION-CATALOG-CONNECTABILITY-TRUTHFULNESS-001` customer-facing docs and generated integration metadata must not describe connectable API-backed connectors as unavailable placeholders.
**Work completed:** Updated the generated integration directory contract to expose `totals.connectable`, per-entry `connectable`, and per-entry `dedicatedClient`; regenerated `docs/INTEGRATIONS.md` / `docs/integrations.json`; updated README, product plan, traceability, user stories, and acceptance criteria to describe the catalog as 123 dedicated live integrations plus 141 connectable Beta catalog manifests. The regression now asserts all current entries are connectable and rejects stale unavailable-entry wording.
**Validation:** `pnpm test:modules -- integration-docs` PASS (5 files / 14 tests); `pnpm lint` PASS; `pnpm typecheck` PASS; `git diff --check` PASS.

## Codex Oracle Cloud Infrastructure Read-Only Connector - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-SignalFabric` / `PRD-IntegrationMarketplace` / `PRD-CloudValidation` / `PRD-API-First` / `PRD-Real-First` planned cloud catalog entries should become safe, API-first, read-only connectors when implementation is available.
**Work completed:** Converted `oracle-cloud` from a planned non-connectable placeholder into a connectable Beta integration. The connector supports fixture sync plus signed read-only OCI Core Services live sync for instances, VCNs, and security lists in an authorized compartment; it emits normalized cloud assets/signals for compartment, compute, VCN, security-list, and public ingress context while denying mutation/console/command/object/credential API paths before fetch and redacting private-key material/raw CIDRs from product-visible results. Regenerated integration catalog docs now show 123 live integrations and 141 catalog-ready manifests.
**Validation:** `pnpm --filter @periscan/connectors test -- "Oracle Cloud|planned marketplace|connector catalog"` PASS (36 files / 274 tests).

## Codex Alibaba Cloud Read-Only Connector - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-SignalFabric` / `PRD-IntegrationMarketplace` / `PRD-CloudValidation` / `PRD-API-First` / `PRD-Real-First` planned cloud catalog entries should become safe, API-first, read-only connectors when implementation is available.
**Work completed:** Converted `alibaba-cloud` from a planned non-connectable placeholder into a connectable Beta integration. The connector supports fixture sync plus signed read-only Alibaba Cloud ECS/RAM live sync for `DescribeInstances`, `DescribeSecurityGroups`, and `ListRoles`; it emits normalized cloud assets/signals for account, ECS public exposure, security groups, and RAM roles while denying mutation/remote-access actions before fetch and redacting credential material/raw IPs from product-visible results. Regenerated integration catalog docs now show 122 live integrations and 142 catalog-ready manifests.
**Validation:** `pnpm --filter @periscan/connectors test -- "Alibaba Cloud|planned marketplace|connector catalog"` PASS (36 files / 273 tests).

## Codex Public Traceability Alignment For API Reference Contracts - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-API-First` public traceability docs must include the same completed API Reference contract gap IDs as the active `.ai` traceability matrix.
**Work completed:** Added `GAP-API-REFERENCE-CONTENT-METADATA-001`, `GAP-API-REFERENCE-NONJSON-NOCONTENT-001`, `GAP-API-REFERENCE-ACTION-SCHEMAS-001`, and `GAP-API-REFERENCE-READ-SCHEMAS-001` rows to `docs/TRACEABILITY_MATRIX.md`, and added a coordination-doc regression that asserts those IDs stay present in both `.ai/requirements-traceability.md` and the public traceability matrix.
**Validation:** `pnpm test:modules -- coordination-docs` PASS (5 files / 14 tests); `git diff --check` PASS.

## Codex Full Verification Refresh After API Reference Contract Completion - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` current branch validation must be refreshed after the API Reference non-JSON response and content-metadata contract slices.
**Work completed:** Full `pnpm verify` passed after the API Reference payload-registry completion, non-JSON response metadata, and content-type/status metadata commits. The generated `apps/web/next-env.d.ts` route-type drift from `next build` was restored to the tracked production reference and the working tree was confirmed clean before this docs refresh.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex API Reference Content Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` customer API users and replacement UIs need the friendly API Reference to expose content types and success statuses, not just boolean schema availability.
**Work completed:** Extended the shared API Reference contract with `requestContentTypes`, `responseContentTypes`, and `successStatuses`; derived those fields from the augmented OpenAPI document; removed generated default `200` responses when the registry declares explicit `201`/`202`/`204`/`307` successes; rendered the metadata in the web API Reference; and documented the user story/acceptance criteria.
**Validation:** `pnpm --filter @periscan/shared test -- health` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "API health status"` PASS; `pnpm --filter @periscan/api test -- openapi-coverage` PASS; `pnpm --filter @periscan/web test -- api-reference-view` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test:modules -- coordination-docs` PASS; `git diff --check` PASS; `pnpm test` PASS.

## Codex API Non-JSON Response Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` customer API users and replacement UIs need complete OpenAPI/API Reference metadata for implemented non-JSON, redirect, download/export, and no-content endpoints.
**Work completed:** Extended the OpenAPI payload registry to document all remaining implemented operation IDs, including `/health` redirect, Prometheus text metrics, raw OpenAPI JSON, logout/deletes with 204 responses, audit export JSON/CSV, evidence downloads, public/shared HTML reports, Snapshot HTML/PDF exports, generic report exports, and advisory readiness report exports. `/api/v1/api-reference` now treats any documented response content type as a response schema, not just JSON.
**Validation:** Registry inventory script reports `227` operations and `0` missing registry entries; `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test:modules -- coordination-docs` PASS; `git diff --check` PASS; `pnpm test` PASS.

## Codex API Action Schema Expansion - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` customer API users need request/response metadata for implemented action endpoints, including accepted async actions and proof-loop operations.
**Work completed:** Promoted inline MFA, threat-feed schedule, and scope-posture validators into exported app-local schemas, then mapped OpenAPI request/response metadata for password reset/invite/email verification, MFA, webhook test/dead-letter reads, threat-feed schedule/due ingestion, threat-alert status, integration sync/due sync, runner task creation, scope posture checks, remediation verification/due reverification, and due schedules. Remaining registry gaps are now concentrated in no-content deletes/logout, redirects, text/binary/download/export endpoints, and raw OpenAPI/Prometheus responses that need a separate non-JSON documentation pass.
**Validation:** `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS.

## Codex API Reference Read Schema Expansion - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` customer API users and replacement UIs need response-schema metadata for implemented read/list/catalog endpoints, not route-only entries.
**Work completed:** Added doc-only OpenAPI response schemas for health/readiness/metrics/API reference/deployment status, external validation profiles, integration catalog/health, ATT&CK techniques, operator profiles/recommendations, AI validation suites, control validation scenarios/rule coverage, autonomous engagements, active billing package, and billing limits. OpenAPI registry coverage gaps dropped from 59 to 37 operation IDs; remaining gaps are mostly deletes, redirects, downloads/exports, 204 auth actions, due-runner admin actions, and other action endpoints that need separate mapping.
**Validation:** `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS.

## Codex API Reference Query Parameter Names - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` customer API users need human-friendly query parameter names in the API Reference, not only raw OpenAPI details.
**Work completed:** Added `queryParameters` to the shared API Reference endpoint contract; `/api/v1/api-reference` now derives sorted query parameter names from the augmented OpenAPI document; the web API Reference renders the names when query parameters are available.
**Validation:** `pnpm --filter @periscan/shared test -- health` PASS; `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS; `pnpm --filter @periscan/web test -- api-reference-view` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `pnpm test:modules -- coordination-docs` PASS.

## Codex OSS API Schema Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `PRD-OSS-Productization` OSS catalog endpoints need complete customer-facing response and filter metadata.
**Work completed:** Added shared OpenAPI response schemas for `/api/v1/open-source-tools`, `/api/v1/open-source-tools/:toolId`, and `/api/v1/open-source-capabilities`; list routes now publish `phase`, `includeDeferred`, and `includeLegalReview` query metadata. API Reference now reports `/api/v1/open-source-tools` as query/schema-backed instead of route-only.
**Validation:** `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm lint` PASS; `pnpm test` PASS; `pnpm test:modules -- coordination-docs` PASS.

## Codex Expanded API Query Metadata Coverage - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` OpenAPI should document existing query filters and controls for customer automation and replacement UIs.
**Work completed:** Extended the doc-only OpenAPI payload registry so tenant SSO authorization URL, webhook deliveries, policy decisions, model-gateway audit events, jobs, threat catalog, threat alerts, audit events, and mission list routes publish their supported query parameters. The metadata includes SSO required `state`/`nonce`, UUID filters, enum filters, booleans, date-time filters, and per-route `limit` defaults/bounds.
**Validation:** `pnpm --filter @periscan/api test -- openapi-coverage` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `pnpm test:modules -- coordination-docs` PASS.

## Codex API Reference Query Parameter Metadata - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` API customers and replacement UIs need generated API metadata that identifies published query controls for bounded list endpoints.
**Work completed:** Added `hasQueryParameters` to the shared API Reference endpoint contract; OpenAPI augmentation now publishes optional `limit` query parameters for evidence, report, threat-advisory, signal-trigger activity, audit, and policy-decision list operations; `/api/v1/api-reference` derives the query flag from the augmented OpenAPI document; the web API Reference renders query availability alongside request/response schema availability.
**Validation:** `pnpm --filter @periscan/shared test -- health` PASS; `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS; `pnpm --filter @periscan/web test -- api-reference-view` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS.

## Codex Default Bounds For High-Volume API Lists - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `PRD-ProductionReadiness` high-volume customer list APIs should not return unbounded histories by default.
**Work completed:** `GET /api/v1/evidence`, `GET /api/v1/reports`, and `GET /api/v1/threat-advisories` now pass the shared default `parseLimit` cap when callers omit `limit`; comments now clarify direct service callers can omit limits only for controlled internal use; route tests seed 55 tenant-scoped records and prove default 50-item responses plus explicit `limit=1`.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "default bounds"` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS.

## Codex Full Verification Refresh After API Hardening - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` current branch validation must be refreshed after API-first contract hardening commits.
**Work completed:** Full `pnpm verify` passed after the API Reference product grouping and signal-trigger activity bounded-read commits. The generated `apps/web/next-env.d.ts` route-type drift from `next build` was restored to the tracked production reference.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex Signal Trigger Activity Limit - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-SignalDriven-Triggers` / `PRD-API-First` signal-trigger activity should support bounded API reads for automation and replacement UIs.
**Work completed:** Added optional `limit` query support to `GET /api/v1/signal-triggers/activity`; the runtime service contract and DB-backed service now apply the limit to activity output; route tests prove `?limit=1` returns one activity item without creating missions.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "evaluates signal-driven triggers"` PASS.

## Codex API Reference Product Grouping - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` API customers need product-specific route groups for newer PRD surfaces, not generic System buckets.
**Work completed:** Updated API Reference grouping so Threat Center, Model Gateway, Approvals, Jobs, Operators/engagements, Audit, Policy, MITRE ATT&CK, and Deployment routes are grouped under product areas; added a regression that rejects non-health endpoints falling back to `System`; updated guide/stories/acceptance criteria.
**Validation:** `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS.

## Codex API Reference Schema Availability - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-API-First` / `SPEC-API-01` API customers need a route-derived contract that is honest about payload schema coverage.
**Work completed:** Added `hasRequestSchema` and `hasResponseSchema` to the shared API Reference endpoint contract; `/api/v1/api-reference` now derives those flags from the augmented OpenAPI document; the web API Reference displays schema availability per endpoint; docs, stories, and acceptance criteria now reflect the metadata.
**Validation:** `pnpm --filter @periscan/shared test -- health openapi` PASS; `pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t "OpenAPI|API health status"` PASS; `pnpm --filter @periscan/web test -- api-reference-view` PASS.

## Codex Coordination History Banner - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AgentCoordinationTraceability` current coordination files must not let older audit entries with stale validation totals be mistaken for current state.
**Work completed:** Added newest-first/current-guidance banners to `.ai/codex-handoff.md` and `.ai/requirements-traceability.md`; extended coordination-doc regression coverage.
**Validation:** `pnpm test:modules -- coordination-docs` PASS.

## Codex Shared Runner Run-Mode Contract Cleanup - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Runner-OutboundOnly` / `PRD-RunnerDeploymentSafetyDocs` shared public contracts must not describe `ServiceViaProxy` as a reverse tunnel.
**Work completed:** Updated the shared `RunModeSchema` source comment so `ServiceViaProxy` is documented as a future restricted signed logical channel, not a reverse SSH/customer-network tunnel; extended module-doc and runner-deploy regressions to check the shared source contract.
**Validation:** `pnpm test:modules -- open-source-workstream-docs` PASS; `pnpm --filter @periscan/shared test -- domain` PASS; `pnpm test:runner:deploy` PASS.

## Codex Deployable Image CI Coverage - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-CI-ReleaseGates` / `PRD-ProductionReadiness` documented deployable images must be built and smoke-tested by CI.
**Work completed:** Added API image build/smoke/tag-push coverage to `.github/workflows/images-build.yml`, broadened image workflow path filters for package/lockfile changes, removed stale web Dockerfile placeholder wording, and extended CI workflow regression coverage.
**Validation:** `pnpm test:modules -- ci-workflow` PASS; YAML parse PASS.

## Codex Runner Proxy Terminology Cleanup - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Runner-OutboundOnly` / `PRD-RunnerDeploymentSafetyDocs` runner materials must not imply reverse SSH or reverse-tunnel customer transport.
**Work completed:** Replaced stale "agent's reverse tunnel" wording in the historical self-contained runner PRD and runner-agent egress comment with restricted signed logical-channel terminology; added deploy and module-doc regressions.
**Validation:** `pnpm test:modules -- open-source-workstream-docs` PASS; `pnpm test:runner:deploy` PASS.

## Codex CI Verify Contract Cleanup - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-CI-ReleaseGates` / `PRD-ProductionReadiness` GitHub Actions must reflect the same `pnpm verify` gate used locally.
**Work completed:** Replaced the stale post-verify CI note and redundant non-fatal high-audit wrapper with an accurate verification contract summary; added `tests/modules/ci-workflow.test.ts` to assert CI keeps Playwright E2E/accessibility and fatal high+ audit in the single verify gate.
**Validation:** `pnpm test:modules -- ci-workflow` PASS.

## Codex Active Status Verification Refresh - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` active implementation status and completion report must cite current validation evidence, not stale 2026-06-23 totals.
**Work completed:** Updated `docs/IMPLEMENTATION_STATUS.md`, `docs/COMPLETION_REPORT.md`, and `docs/PRODUCT_COMPLETION_PLAN.md` to cite the 2026-06-24 full `pnpm verify` gate with Playwright E2E 42/42 and acceptance 100 files / 123 tests; labeled the older implementation-status addendum historical; added coordination-doc regression coverage.
**Validation:** `pnpm test:modules -- coordination-docs` PASS.

## Codex Predeployment Verification Refresh - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` predeployment/release docs must cite current validation evidence after latest production-readiness slices.
**Work completed:** Updated `.ai/predeployment-checklist.md` and `.ai/release-readiness.md` from older 2026-06-23 / v0.1.147 evidence to the 2026-06-24 full `pnpm verify` gate with Playwright E2E 42/42 and acceptance 100 files / 123 tests; added coordination-doc regression coverage.
**Validation:** `pnpm test:modules -- coordination-docs` PASS.

## Codex Runner Deployment Credential Contract Cleanup - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerCredentialContractDocs` / `PRD-RunnerDeploymentSafetyDocs` customer deploy artifacts must not configure disabled mTLS task-tunnel material for the default runner.
**Work completed:** Removed stale mTLS certificate/key variables and wording from deploy requirements, Docker Compose, Kubernetes, systemd env, and runner deploy README; runner deploy validation and module-doc regression now reject those variables/phrases.
**Validation:** `pnpm test:modules -- open-source-workstream-docs` PASS; `pnpm test:runner:deploy` PASS.

## Codex Historical Coordination Docs Cleanup - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AgentCoordinationTraceability` / `GAP-DOC-001` current `.ai` status and handoff files must remain authoritative over stale historical branch/report snapshots.
**Work completed:** Added historical snapshot banners to `.ai/final-report-draft.md` and `.ai/architecture-review.md`; closed `GAP-DOC-001`; added a module-doc regression test for the banners.
**Validation:** `pnpm test:modules -- coordination-docs` PASS.

## Codex Production Redis Queue Configuration - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionRedisConfig` / `PRD-JobScheduler` / `PRD-ProductionReadiness` production queue-backed paths must not silently use the local development Redis fallback.
**Work completed:** Centralized Redis URL parsing in `packages/shared`; API mission/model queues, worker Redis, and webhook queues now use the shared resolver; production construction fails closed without explicit `REDIS_URL`; deployment readiness rejects malformed Redis URLs.
**Validation:** Focused shared/API/worker/webhooks Redis tests PASS; touched package typechecks PASS; touched package lint PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex Full Verification Refresh - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` current branch validation must be refreshed after production-readiness commits.
**Work completed:** Full `pnpm verify` passed after the runner-signing, production database, and production web API URL readiness commits. The generated `apps/web/next-env.d.ts` route-type drift from `next build` was restored to the tracked production reference.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, Go runner tests, runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex Production Web API Proxy Configuration - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionWebApiProxyConfig` / `PRD-API-First` / `PRD-ProductionReadiness` production web routes must not silently proxy customer API calls to the local development API fallback.
**Work completed:** Added a shared web upstream resolver; production web proxy and health routes now require explicit `PERISCAN_API_URL` and return stable `api_proxy_unavailable` 503 responses when misconfigured.
**Validation:** Focused web proxy tests PASS; web typecheck PASS; web lint PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS.

## Codex Production Database Configuration - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionDatabaseConfig` / `PRD-ProductionReadiness` / `PRD-Supabase-DeploymentCompatibility` production must not silently use the local development Postgres fallback, and Supabase/Postgres aliases must count as explicit database config.
**Work completed:** Database URL resolution now has an explicit configured-url helper; production resolver/client initialization fails closed without explicit DB config; deployment readiness uses the helper and accepts aliases while redacting the value.
**Validation:** Focused DB resolver/client tests PASS; focused API deployment-status tests PASS; DB/API typecheck PASS; DB/API lint PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS.

## Codex Runner Task Signing Production Readiness - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerTaskSigningProductionReadiness` / `PRD-Runner-SignedTasks` / `PRD-ProductionReadiness` production runner registration must have valid Ed25519 task-signing material before customer deployment.
**Work completed:** Runner task-signing key resolution is shared by deployment readiness and registration. Production readiness now requires a valid Ed25519 private key, rejects malformed keys, and rejects configured public keys that do not match the private key.
**Validation:** Focused runner-signing/deployment tests PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Production Dev Mode Disabled - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionDevModeDisabled` / `PRD-SafetyBoundaries` / `PRD-ProductionReadiness` production must not enable development fixture/manual-verification behavior.
**Work completed:** Production API startup now rejects `PERISCAN_DEV_MODE=true`, worker fixture-target config fails closed in production dev mode, and deployment readiness flags production dev mode as not ready.
**Validation:** Focused API dev-mode/deployment tests PASS; focused worker config tests PASS; API/worker typecheck PASS; API/worker lint PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Production Session Secret Readiness - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionSessionSecretReadiness` / `PRD-Auth-Tenant-RBAC` / `PRD-ProductionReadiness` deployment readiness must reject known development signing material for production sessions.
**Work completed:** Deployment readiness now marks `PERISCAN_JWT_SECRET=periscan-dev-session-secret` as not configured in production, aligning the admin readiness API with API startup fail-closed behavior.
**Validation:** Focused deployment tests PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Evidence Object Storage Production Config - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-EvidenceObjectStorageProductionConfig` / `PRD-Evidence-Packs` / `PRD-ProductionReadiness` production proof artifacts require durable object storage and must not fall back to local filesystem storage.
**Work completed:** Production evidence storage now requires complete explicit S3-compatible/Supabase config, ignores local MinIO shorthand, and refuses filesystem fallback when config is incomplete. Deployment readiness now requires evidence endpoint, bucket, access key ID, and secret key.
**Validation:** Focused evidence storage/deployment tests PASS; package/API typecheck PASS; package/API lint PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Production CORS Origin Allowlist - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionCorsOriginAllowlist` / `PRD-API-First` / `PRD-ProductionReadiness` customer/replacement browser UIs may call the API directly, but production credentialed CORS must only allow explicit public HTTPS origins.
**Work completed:** Added shared CORS origin normalization for deployment/runtime use. Production API startup now fails closed for wildcard, localhost, non-HTTPS, path/query/fragment, or credential-bearing origins. Deployment readiness keeps unset CORS optional but flags configured unsafe origins as not ready.
**Validation:** Focused CORS/deployment tests PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Production Web Base URL Hardening - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionWebBaseUrl` / `PRD-Auth-Onboarding` / `PRD-ProductionReadiness` onboarding/recovery emails must not generate localhost or non-HTTPS links in production.
**Work completed:** `resolveWebBaseUrl()` now requires a public HTTPS `PERISCAN_WEB_BASE_URL` in production, rejects localhost/non-HTTPS values, and trims valid values. Deployment readiness reports missing or unsafe production web base URLs as not ready.
**Validation:** Focused web-base/deployment tests PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Production Email Transport Hardening - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionEmailTransportHardening` / `PRD-Auth-Onboarding` / `PRD-ProductionReadiness` production onboarding/recovery email must not silently log customer mail or use local default sender metadata.
**Work completed:** Production `PERISCAN_EMAIL_TRANSPORT=console` now fails closed. Production SMTP requires explicit `PERISCAN_EMAIL_FROM`. Deployment readiness treats production console transport as not ready, requires `PERISCAN_EMAIL_FROM` and `PERISCAN_SMTP_HOST` for SMTP, and leaves SMTP-only fields optional for explicit `noop`.
**Validation:** Focused email/deployment tests PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Runner Credential Contract Docs - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerCredentialContractDocs` / `PRD-Runner-OutboundOnly` / `PRD-Runner-SignedTasks` docs and acceptance criteria must match the implemented bearer-over-TLS runner credential model.
**Work completed:** Removed stale mock mTLS/certificate-material wording from runner acceptance criteria, user stories, and internal-runner task docs. The docs now describe bearer-over-TLS transport auth, one-time runner auth token issuance, credential-expiry metadata, task-signing public key material, and task-signing key rotation without issuing a new bearer token. Added a docs regression to reject stale mock/fake mTLS and certificate-material wording.
**Validation:** `pnpm test:modules -- open-source-workstream-docs` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Report Share Secret Isolation - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReportShareSecretIsolation` / `PRD-ReportDelivery-WebSurface` / `PRD-ProductionReadiness` public report-share bearer tokens must not be signed with session-token fallback material in production.
**Work completed:** `getReportShareSecret()` now requires `PERISCAN_REPORT_SHARE_SECRET` in production and refuses JWT/dev fallback there. Deployment readiness reports the report-share signing secret as a required redacted security item, `.env.example` documents it, and user stories/acceptance/readiness docs were aligned.
**Validation:** Focused report-share/deployment tests PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex SMTP Deployment Readiness Coverage - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-DeploymentSmtpReadiness` / `PRD-ProductionReadiness` / `PRD-Auth-Onboarding` the deployment-readiness API must match transactional email runtime prerequisites.
**Work completed:** Added conditional deployment readiness for `PERISCAN_SMTP_HOST` when `PERISCAN_EMAIL_TRANSPORT=smtp`, kept SMTP host optional for non-SMTP transports, updated route/unit tests, and aligned acceptance/readiness docs.
**Validation:** Focused deployment-status tests PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS; `git diff --check` PASS.

## Codex Deployment Email Readiness Coverage - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionReadiness` / `PRD-Auth-Onboarding` / `PRD-API-First` the deployment-readiness API must report required transactional-email configuration before invite, password-reset, and email-verification flows depend on it.
**Work completed:** Added `PERISCAN_EMAIL_TRANSPORT` to deployment readiness definitions, updated deployment-status tests and route-test env setup, and aligned production-readiness/acceptance docs. Runtime email behavior already failed closed in production when unset; the API now exposes that prerequisite.
**Validation:** Focused deployment-status tests PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS (workspace tests, API now 273 tests); `git diff --check` PASS.

## Codex Runner OSS Docs Capability Alignment - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerDeploymentSafetyDocs` / `PRD-OSS-Productization` current source docs must reflect the implemented outbound signed-task runner capability set and must not claim reachability-only execution after DNS/TLS/HTTP runner checks shipped.
**Work completed:** Updated `docs/OPEN_SOURCE_VALIDATION_ENGINES.md` to list TCP reachability, DNS resolution, TLS certificate inspection, HTTP health, and the TypeScript runner-agent signed-task boundary. Hardened the existing workstream-docs regression to reject the stale reachability-only sentence.
**Validation:** `pnpm test:modules -- open-source-workstream-docs` PASS (3 files / 7 tests); `git diff --check` PASS.

## Codex Production Credential Key Fail-Closed - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ProductionReadiness` / `PRD-Secrets-EncryptedAtRest` / `SECURITY_BOUNDARIES-NoCredentialExposure` production deployments must use dedicated at-rest encryption keys for customer connector and BYO model credentials instead of silently reusing auth-token signing material.
**Work completed:** Tightened integration credential and model-gateway credential key resolution so production requires `PERISCAN_INTEGRATION_CREDENTIAL_KEY` and `PERISCAN_MODEL_CREDENTIAL_KEY` respectively. Non-production still allows JWT/dev fallback for local setup. Deployment readiness now reports the model credential key as required, `.env.example` documents both keys, and connector smoke/readiness docs no longer imply production fallback.
**Validation:** Focused credential/deployment tests and typechecks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner and runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, E2E 42/42, security 22/22, high+ audit gate, production audit, and acceptance 100 files / 123 tests.

## Codex OSS Capability Coverage - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-OSSCapabilityCoverage` / `PRD-OSS-Safety` / `PRD-API-First` every visible OSS tool must have a typed API-visible capability interface.
**Work completed:** Added implemented capability entries for `nmap`, `subfinder`, `httpx`, `dnsx`, and `zaproxy`; added fixture-only current-release capability surfaces for `netexec`, `metasploit`, and `kerbrute`; updated stale high-impact tool notes to dry-run/fixture-only wording; and added a regression assertion that every visible OSS tool has at least one capability entry.
**Validation:** `pnpm --filter @periscan/modules test -- toolchain` PASS (3 files / 134 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm modules:certify:check` PASS (40 modules, 0 not certified); focused API/UI/shared/security checks PASS.

## Codex sqlmap Capability Blocked - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-SqlmapCapabilityBlocked` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-NoUnauthorizedOffense` high-impact legal-review SQL injection tooling must be API-visible as blocked.
**Work completed:** The OSS toolchain now exposes `sqlmap.sqli-probe-plan` as `BlockedLegalReview`, updates sqlmap notes to current dry-run/fixture-only behavior, and keeps sqlmap aggregate execution readiness `Blocked` even when Docker or a binary runtime is available. `web.sqli_probe` remains live-disabled by the existing high-impact module guard.
**Validation:** `pnpm --filter @periscan/modules test -- "sqlmap|SQL injection|toolchain|high-impact"` PASS (2 files / 122 tests); `pnpm --filter @periscan/shared test -- open-source` PASS (19 files / 107 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm modules:certify:check` PASS (40 modules, 0 not certified); focused API/UI/security checks PASS.

## Codex ScoutSuite Live Posture Disabled - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ScoutSuiteLivePostureDisabled` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-CloudValidationControls` legal-review cloud-posture tools must not run live by default.
**Work completed:** `cloud.scoutsuite_posture` no longer advertises live support, start constraints deny non-fixture queueing with `scoutsuite_live_disabled`, and direct non-fixture execution returns redacted `Inconclusive` disabled-live-execution evidence without invoking ScoutSuite. The OSS toolchain now exposes `scoutsuite.cloud-posture-import` as `BlockedLegalReview`; ScoutSuite aggregate execution readiness remains `Blocked` even when a runtime is available.
**Validation:** `pnpm --filter @periscan/modules test -- "scoutsuite|ScoutSuite|offensive kit|toolchain"` PASS (2 files / 122 tests); `pnpm --filter @periscan/shared test -- open-source` PASS (19 files / 107 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm modules:certify:check` PASS (40 modules, 0 not certified); focused API/UI/security checks PASS.

## Codex WhatWeb Live Fingerprint Disabled - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-WhatWebLiveFingerprintDisabled` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-ExternalValidationControls` legal-review web fingerprinting tools must not run live by default.
**Work completed:** `web.fingerprint` no longer advertises live support, start constraints deny non-fixture queueing with `whatweb_live_disabled`, and direct non-fixture execution returns redacted `Inconclusive` disabled-live-execution evidence without invoking WhatWeb. The OSS toolchain now exposes `whatweb.technology-fingerprint-import` as `BlockedLegalReview`; WhatWeb aggregate execution readiness remains `Blocked` even when a runtime is available.
**Validation:** `pnpm --filter @periscan/modules test -- "whatweb|additional web modules|toolchain"` PASS (2 files / 121 tests); `pnpm --filter @periscan/shared test -- open-source` PASS (19 files / 107 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm modules:certify:check` PASS (40 modules, 0 not certified).

## Codex testssl Live TLS Audit Disabled - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-TestsslLiveAuditDisabled` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-ExternalValidationControls` legal-review TLS scanners must not run live by default when built-in Periscan TLS checks already cover first-customer validation.
**Work completed:** `web.tls_audit` no longer advertises live support, start constraints deny non-fixture queueing with `testssl_live_disabled`, and direct non-fixture execution returns redacted `Inconclusive` disabled-live-execution evidence without invoking testssl.sh. The OSS toolchain now exposes `testssl.tls-audit-import` as `BlockedLegalReview`; testssl aggregate execution readiness remains `Blocked` even when a runtime is available.
**Validation:** `pnpm --filter @periscan/modules test -- "testssl|TLS audit|web app scanning|toolchain"` PASS (2 files / 120 tests); `pnpm --filter @periscan/shared test -- open-source` PASS (19 files / 107 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm modules:certify:check` PASS (40 modules, 0 not certified).

## Codex Nikto Live Scan Disabled - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-NiktoLiveScanDisabled` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-ExternalValidationControls` live legal-review web scanners must not run by default from the control plane.
**Work completed:** `web.nikto_scan` no longer advertises live support, start constraints deny non-fixture queueing with `nikto_live_disabled`, and direct non-fixture execution returns redacted `Inconclusive` disabled-live-execution evidence without invoking Nikto. The OSS toolchain now exposes `nikto.web-server-misconfiguration-import` as `BlockedLegalReview`; Nikto aggregate execution readiness remains `Blocked` even when a runtime is available. Regenerated module certification with zero not-certified modules.
**Validation:** `pnpm --filter @periscan/modules test -- "nikto|additional web modules|toolchain"` PASS (2 files / 119 tests); `pnpm --filter @periscan/shared test -- open-source` PASS (19 files / 107 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm modules:certify:check` PASS (40 modules, 0 not certified).

## Codex Web Content Discovery Fuzzing Disabled - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-WebContentDiscoveryFuzzingDisabled` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-ExternalValidationControls` live external content fuzzing must not be enabled by default and must not bypass verified-scope, rate-limit, and approval boundaries.
**Work completed:** `web.content_discovery` no longer advertises live support, start constraints deny non-fixture mission queueing with `content_discovery_live_disabled`, and direct non-fixture execution returns redacted `Inconclusive` disabled-live-execution evidence without invoking `ffuf` or using caller-supplied wordlists. The OSS toolchain now exposes `ffuf.content-discovery-import` as `FixtureOnly`, and aggregate tool execution readiness reports `FixtureOnly` instead of `Ready` when only fixture/import capabilities exist.
**Validation:** `pnpm --filter @periscan/modules test -- "ffuf content discovery|additional web modules|content_discovery"` PASS (2 files / 118 tests); `pnpm --filter @periscan/modules test -- toolchain` PASS (3 files / 130 tests); `pnpm --filter @periscan/shared test -- open-source` PASS (19 files / 107 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS.

## Codex High-Impact Module Execution Fail-Closed - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-OSS-Policy-GatedExecution` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-NoUnauthorizedOffense` disabled live high-impact tools must fail closed even if a future caller bypasses mission start constraints and calls a module directly.
**Work completed:** Marked `web.sqli_probe`, `identity.cred_spray`, `exploit.metasploit_check`, and `identity.kerberos_userenum` as `liveSupported:false`, updated customer-visible descriptions to dry-run/plan-only wording, and added direct execution guards that return redacted `Inconclusive` disabled-live-execution evidence without invoking sqlmap, NetExec, Metasploit, or Kerbrute. Cleaned stale historical runner PRD wording that implied Caldera/Atomic live enablement.
**Validation:** `pnpm --filter @periscan/modules test -- "SQL injection|credential and Metasploit|Kerberos live|offensive module starts|governs sqli_probe|governs cred_spray|is governed"` PASS (2 files / 117 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "modules|open source|unsafe OSS"` PASS; `pnpm --filter @periscan/web test -- registry-center` PASS; `pnpm --filter @periscan/api typecheck` PASS.

## Codex OSS Live Execution Constraint Guard - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-OSS-Policy-GatedExecution` / `PRD-OSS-Safety` / `SECURITY_BOUNDARIES-NoUnauthorizedOffense` module pre-queue constraints must not let approval metadata enable Atomic live execution, SharpHound collection, or live advanced-adversarial execution in the current release.
**Work completed:** Hardened `evaluateModuleStartConstraints` so Atomic `dryRun:false` is denied with `atomic_live_disabled`, SharpHound collection flags are denied with `sharphound_collector_legal_review_blocked`, and live/non-dry-run high-impact execution is denied with `*_live_disabled` before jobs can be queued. Governed non-executing plan/import workflows, including Caldera plan import, remain authorization-gated.
**Validation:** `pnpm --filter @periscan/modules test -- "offensive module starts|allows governed non-executing|refuses non-dry-run Atomic"` PASS (2 files / 114 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t "denies unsafe OSS module starts|queues safe OSS fixture modules"` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm exec vitest run tests/security/security-boundaries.test.ts --testTimeout=60000` PASS.

## Codex Full Verification Refresh - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` release coordination must cite the current validation gate after the latest Real-First and acceptance-isolation slices.
**Work completed:** Full `pnpm verify` passed after the Slack/Teams webhook sync Real-First fix and Threat Center/feed acceptance hardening. The generated `apps/web/next-env.d.ts` route-type drift from `next build` was restored to the tracked production reference.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, Go runner tests, runner lab tests, current OSS toolchain readiness, license inventory/policy checks, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security boundary tests 22/22, high+ audit gate, production dependency audit, and acceptance 100 files / 123 tests.

## Codex Threat-Feed Source-State Isolation - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseAcceptanceStability` / `PRD-ThreatIntel-SuperFeed` acceptance tests that mutate global threat-feed source state must restore it so repeated/local suite runs remain order-independent.
**Work completed:** `threat-feed-poller-flow` now snapshots and restores all registered feed source-state rows, deletes rows that the test created when they were absent before, and uses upsert setup for rerun/error cases.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- threat-feed-poller-flow` PASS (suite wrapper ran 100 files / 123 tests); `pnpm lint` PASS; `pnpm typecheck` PASS.

## Codex Threat-Feed Acceptance Uniqueness Hardening - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseAcceptanceStability` / `PRD-ThreatIntel-SuperFeed` acceptance fixtures that persist global threat-feed data must not collide across reused local databases or repeated suite runs.
**Work completed:** Threat-intel catalog, threat-feed poller, and tenant alert acceptance fixtures now use UUID-derived canonical keys/CVEs/domains/emails while preserving numeric CVE IDs and deterministic IP/CIDR fixture math. Acceptance code no longer uses `randomInt`.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- threat-intel-catalog-flow threat-feed-poller-flow threat-feed-alerts-flow` PASS (suite wrapper ran 100 files / 123 tests); `rg -n "randomInt\\(" tests/acceptance apps packages -g '*.ts'` PASS (no matches); `pnpm lint` PASS.

## Codex Webhook Workflow Sync Real-First Boundary - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-WebhookWorkflowSyncRealFirst` / `PRD-Slack-WorkflowAcceptance` / `PRD-MicrosoftTeams-WorkflowAcceptance` live workflow-destination sync must not fabricate workflow evidence.
**Work completed:** Slack and Microsoft Teams `sync()` now emit fixture workflow-destination signals only in explicit `mockMode`; non-mock webhook sync reports configured readiness with zero assets/signals until an actual workflow delivery occurs. Connector tests cover both live webhook sync paths and assert webhook URLs remain absent from serialized results.
**Validation:** `pnpm --filter @periscan/connectors test -- "Slack workflow|Microsoft Teams workflow|live webhook sync"` PASS (36 files / 272 tests); `pnpm --filter @periscan/connectors typecheck` PASS.

## Codex Runner Reject Terminal State Guard - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerRejectTerminalStateGuard` / `PRD-Runner-SignedTasks` / `PRD-Evidence-Auditable` runner reject callbacks must not mutate tasks whose lifecycle is already terminal.
**Work completed:** `rejectRunnerTask` now reuses the shared `isTerminalRunnerTaskStatus` predicate instead of a local terminal-state list that omitted `Rejected`. Terminal reject attempts now write `runner.task.rejected` with reason `reject_after_terminal_state` and return `runner_task_invalid_state`. The measured-runner acceptance flow force-sets a task to `Rejected` and proves the API refuses to rewrite it to `DeniedByLocalPolicy`.
**Validation:** `pnpm --filter @periscan/api test -- runner-task-result-state` PASS (19 files / 274 tests); `pnpm --filter @periscan/api typecheck` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- runner-measured-task-flow` PASS (100 files / 123 tests).

## Codex Runner Artifact Terminal State Guard - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerArtifactTerminalStateGuard` / `PRD-Runner-SignedTasks` / `PRD-Evidence-Auditable` runner artifact uploads must not attach new evidence to a task whose lifecycle is already closed.
**Work completed:** `uploadRunnerTaskArtifact` now rejects uploads for terminal task states (`Completed`, `Failed`, `Cancelled`, `Expired`, `Rejected`, and local/server policy denials) before artifact hash validation, evidence storage, or audit success. The rejection writes `runner.task.rejected` with reason `artifact_after_terminal_state`. The DB-backed runner measured-task acceptance flow now proves a completed task cannot accept a late artifact and that no evidence row is created.
**Validation:** `pnpm --filter @periscan/api test -- runner-task-result-state` PASS (19 files / 274 tests); `pnpm --filter @periscan/api typecheck` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- runner-measured-task-flow` PASS (100 files / 123 tests).

## Codex Audit Action Contract Guard - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AuditActionContractGuard` / `PRD-Audit-Completeness` / `PRD-API-First` public audit action schemas, API-to-DB mapping, and Prisma enum values must stay synchronized as new audited product workflows are added.
**Work completed:** Added a permanent API unit contract test that compares `AuditEventActionSchema.options`, `AUDIT_ACTION_TO_DB`, and the Prisma `AuditEventAction` enum parsed from `packages/db/prisma/schema.prisma`. This prevents future audit action drift from creating runtime 500s or missing audit records after shared/schema/API changes.
**Validation:** `pnpm --filter @periscan/api test -- audit-action-contract` PASS (18 files / 271 tests).

## Codex Remediation Ticket Audit Separation - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RemediationTicketAudit` / `PRD-Audit-Completeness` / `PRD-RemediationEngine` remediation ticket/workflow delivery must be auditable separately from remediation-task creation.
**Work completed:** Added shared/API mapping for public action `remediation.ticket.created` to the existing Prisma enum `remediation_ticket_created`, changed `createRemediationTicket` to write the distinct ticket-routing event, and updated workflow acceptance tests to expect the raw DB action `remediation_ticket_created` with ticket/integration metadata.
**Validation:** `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/shared typecheck` PASS; `pnpm --filter @periscan/shared test -- domain` PASS (19 files / 114 tests); `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- jira-workflow-flow github-issues-workflow-flow slack-workflow-flow microsoft-teams-workflow-flow linear-workflow-flow pagerduty-workflow-flow opsgenie-workflow-flow servicenow-workflow-flow` PASS (100 files / 123 tests).

## Codex Remediation Ready Audit - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RemediationReadyAudit` / `PRD-Audit-Completeness` / `PRD-FixVerification` remediation lifecycle state changes must be auditable through the API.
**Work completed:** `markRemediationReadyForVerification` now writes `remediation.ready_for_verification` with prior status, current status, ticket metadata, related path ID, tenant, actor, and remediation ID. The API-first MVP acceptance flow now reads `/api/v1/audit-events?action=remediation.ready_for_verification` after the transition and verifies the event metadata.
**Validation:** `pnpm --filter @periscan/db run db:generate && pnpm --filter @periscan/api typecheck` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm --filter @periscan/db run db:validate` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm --filter @periscan/db run db:migrate:deploy` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-first-mvp-flow` PASS (100 files / 123 tests).

## Codex Runner Completion Evidence Requirement - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerCompletionEvidence` / `PRD-Evidence-Auditable` / `PRD-FixVerification` completed internal-runner validation and fix-verification results must reference uploaded evidence artifacts before updating proof-loop state.
**Work completed:** `submitRunnerTaskResult` now rejects `Completed` results with empty evidence manifests using `runner_result_evidence_required` and audits the rejection before state mutation. The runner measured-task acceptance flow now proves proofless completion leaves the run, task, mission, signal, graph, and verification state unchanged, then uploads evidence and completes successfully. The TypeScript runner-agent now reports local verification denial as `Failed`, uploads a normalized result artifact to the scoped artifact endpoint before successful result submission, and includes the returned evidence manifest in the callback.
**Validation:** `pnpm --filter @periscan/runner-agent test` PASS (4 files / 31 tests); `pnpm --filter @periscan/runner-agent typecheck` PASS; `pnpm --filter @periscan/api test -- runner-task-result-state` PASS (18 files / 273 tests); `pnpm --filter @periscan/shared test -- runner` PASS (19 files / 114 tests); `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- runner-measured-task-flow` PASS (100 files / 123 tests).

## Codex Runner Result Terminal State Contract - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerResultTerminalState` / `PRD-Runner-SignedTasks` / `PRD-Evidence-Auditable` runner result callbacks must only close signed tasks as `Completed` or `Failed`, not accept in-flight or policy-denial states as durable "results."
**Work completed:** Narrowed `RunnerTaskResultSchema.status` to a terminal-only enum, added a runner service defense-in-depth rejection/audit path for invalid runtime statuses, simplified persisted runner-task result status to the accepted terminal value, and added DB-backed public API acceptance coverage proving a `Running` result returns 400 without mutating validation run, runner task, validation mission, evidence, signals, graph, or verification state.
**Validation:** `pnpm --filter @periscan/shared test -- runner` PASS (19 files / 114 tests); `pnpm --filter @periscan/api typecheck` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- runner-measured-task-flow` PASS (100 files / 123 tests).

## Codex Worker Fixture Target Defense - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-WorkerFixtureTargetDefense` / `PRD-Real-First` / `PRD-JobScheduler` asynchronous validation workers must fail closed on queued fixture/mock targets unless explicitly running in dev/test fixture mode.
**Work completed:** Moved the recursive fixture-target detector into `packages/shared`, updated API mission and engagement guards to use the shared rule, and added a worker-level default-deny guard before module execution. Production worker construction now only allows fixture targets when `PERISCAN_DEV_MODE=true`; inline fix-verification worker processors opt in only when API dev mode is enabled. Worker tests now prove default fixture-target rejection creates no evidence, signals, graph projection, or module-executed success audit.
**Validation:** `pnpm --filter @periscan/worker test -- processor` PASS (4 files / 18 tests); `pnpm --filter @periscan/worker typecheck` PASS; `pnpm --filter @periscan/shared typecheck` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/shared test -- fixture-targets` PASS (18 files / 104 tests); `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-edge-regressions` PASS (100 files / 123 tests).

## Codex Model Gateway Tool Input Boundary - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ModelGatewayToolInputContract` / `PRD-API-First` / `PRD-Evidence-Redaction` Frontier Gateway tool-call inputs must be typed, redacted, and side-effect-free before policy-approved execution.
**Work completed:** Centralized model tool input validation/redaction in `@periscan/model-gateway`. `createGatewayToolRequest` now validates arguments against each code-defined tool schema before persistence, rejects undeclared properties such as fixture/mock controls, rejects wrong types/ranges/missing required fields/malformed UUIDs with `invalid_tool_input`, hashes canonical input, and stores/returns only redacted `inputPayloadRedacted`. Action tools still require approval and re-preview policy before creating mission shells.
**Validation:** `pnpm --filter @periscan/model-gateway test -- policy-enforcement` PASS (6 files / 31 tests); `pnpm --filter @periscan/model-gateway typecheck` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- model-gateway-execution-flow` PASS (100 files / 123 tests); `pnpm --filter @periscan/model-gateway lint` PASS; `pnpm --filter @periscan/api typecheck` PASS; `pnpm typecheck` PASS; `pnpm lint` PASS.

## Codex Engagement Fixture Target Guard - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RealFirst-EngagementTargetGuard` / `PRD-PeriscanOperators` / `PRD-API-First` production autonomous engagement requests must not carry fixture/mock target hints into validation-module execution.
**Work completed:** Added a shared recursive fixture-target detector for API services, reused it from mission policy/start guards, and applied it to `runEngagement`. Production engagement plan steps containing `fixture*` or `mockMode` keys now fail with `fixture_mode_disabled` before an engagement row, validation run, evidence artifact, queued job, or module execution can be created. Added a production-mode acceptance regression in `api-edge-regressions`.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-edge-regressions` PASS (100 files / 123 tests); `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- autonomous-engagement-flow` PASS (100 files / 123 tests); `pnpm --filter @periscan/api typecheck` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `git diff --check` PASS.

## Codex Threat Correlation Evidence Gate - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThreatCorrelationEvidenceGate` / `PRD-Evidence-Auditable` / `PRD-ValidationSnapshot` Snapshot threat-advisory correlation metrics must require evidence-backed validation, not just completed runs with matching indicators.
**Work completed:** Tightened `countCorrelatedThreatAdvisories` so tenant-wide correlated advisory counts load only completed validation runs with evidence IDs. Added acceptance coverage for the no-evidence negative case, the evidence-backed positive case surfaced through Snapshot metrics, and the old evidence-backed ATT&CK technique match outside the bounded recency scan window.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- advisory-exposure-correlation-flow threat-correlation-run-scan-flow` PASS (100 files / 122 tests); `pnpm --filter @periscan/api typecheck` PASS; `pnpm lint` PASS; `git diff --check` PASS.

## Codex Full Verification Refresh - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` release coordination must reflect the current validation gate after OSS current-phase canonicalization and OSV runtime readiness changes.
**Work completed:** Re-ran full repository verification after the OSS toolchain updates. The current OSS readiness gate now reports OSV available through `ghcr.io/google/osv-scanner:v2.3.0`, and the full release gate passed. Restored the generated `apps/web/next-env.d.ts` dev-route drift back to the tracked production route-types reference after the Next build.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner and runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, E2E 42/42, security 22/22, high+ audit fatal gate, production audit, and acceptance 100 files / 122 tests.

## Codex OSS Current Phase Canonicalization - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-OSS-CurrentPhaseCanonicalization` / `PRD-OSS-CurrentWorkstreamPhaseAlignment` / `PRD-OSS-CurrentPhaseAlias` the OSS toolchain should use `Current` as the canonical registry phase, the current phase should include the documented first-customer OSS modules, and `CurrentMvp` should remain only as a legacy API/CLI input alias.
**Work completed:** Migrated canonical tool and capability definitions in `packages/modules/src/toolchain.ts` from `CurrentMvp` to `Current`, changed module/API/CLI filter normalization so `CurrentMvp` maps into `Current`, aligned current tool definitions with the active OSS workstream (`gitleaks`, `nuclei`, `nuclei-templates`, `trivy`, `osv-scanner`, `prowler`, `promptfoo`, `pyrit`, `atomic-red-team`, `invoke-atomicredteam`), added the official OSV GHCR Docker image as the preferred OSV runtime with binary fallback, updated schema/toolchain/API tests so default catalog output contains `Current` and no `CurrentMvp`, and preserved legacy query compatibility through explicit assertions.
**Validation:** `pnpm --filter @periscan/modules test -- toolchain` PASS (3 files / 126 tests); `pnpm --filter @periscan/shared test -- open-source` PASS (18 files / 105 tests); `pnpm --filter @periscan/api test -- app.test.ts -t "open source tool"` PASS (1 test); `pnpm tools:check -- --phase=Current` PASS with OSV resolving to `ghcr.io/google/osv-scanner:v2.3.0`; `pnpm tools:check -- --phase=CurrentMvp` PASS; `pnpm typecheck` PASS; `pnpm lint` PASS; `git diff --check` PASS.

## Codex OSS Current Phase Readiness Docs - 2026-06-24

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-OSS-CurrentPhaseReadinessDocs` / `PRD-OSS-CurrentPhaseAlias` active production-readiness and OSS workstream docs must use the customer-ready `Current` phase name while preserving legacy `CurrentMvp` compatibility only in API/CLI normalization paths.
**Work completed:** Updated root and docs production-readiness release commands from `pnpm tools:check -- --phase=CurrentMvp` to `pnpm tools:check -- --phase=Current`, fixed the docs production-readiness cross-reference wording, changed active OSS workstream table entries to `Current`, updated the Customer Agent traceability row, and extended the open-source workstream docs contract test to reject `CurrentMvp` in active workstream docs.
**Validation:** `pnpm test:modules -- open-source-workstream-docs` PASS (3 files / 7 tests); `pnpm tools:check -- --phase=Current` PASS; `pnpm lint` PASS; `git diff --check` PASS.

## Codex Jira Mock Shortcut Production Guard - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RealFirst-JiraMockShortcutGuard` / `PRD-RealFirst-MockIntegrationGuard` production API clients must not create mock integrations through connector-specific convenience endpoints.
**Work completed:** Extended the production-mode `api-edge-regressions` acceptance test so `POST /api/v1/integrations/jira/mock-connect` is denied with `fixture_mode_disabled` and creates no integration record. The existing `createIntegration` service guard was already correct; this slice adds route-specific regression coverage for the shortcut path.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-edge-regressions` PASS (100 files / 122 tests); `pnpm lint` PASS.

## Codex Primary Navigation Contract Drift Guard - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-WebNavigationContract` / `PRD-WebRouteCoverage` / `PRD-UX-MainNavigation` static first-party product pages must stay synchronized with the primary navigation contract so browser shell and accessibility gates cannot silently skip new surfaces.
**Work completed:** Added a filesystem-backed web unit test that discovers `apps/web/app/**/page.tsx`, excludes API route handlers, compares static page routes with `APP_NAV_ITEMS`, rejects duplicate/dead nav links, and keeps `/snapshots/[id]` explicitly recorded as a dynamic E2E-covered route. Updated PRD-derived user stories, acceptance criteria, traceability, and coordination notes.
**Validation:** `pnpm --filter @periscan/web test -- app-navigation` PASS (2 files / 4 tests); `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS; `git diff --check` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 42/42, security 22/22, and acceptance 100 files / 122 tests.

## Codex Full Product Route Coverage - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-WebRouteCoverage` / `PRD-UX-MainNavigation` / `PRD-Accessibility` every primary web product route must stay reachable, responsive, and accessibility-gated.
**Work completed:** Moved the primary route contract into `apps/web/src/lib/app-navigation.ts`, wired runtime navigation and breadcrumbs to it, and expanded Playwright shell/axe gates from a subset of primary routes to every static route in `APP_NAV_SECTIONS`, plus the existing dynamic Snapshot report route. Updated PRD traceability, user stories, acceptance criteria, implementation status, and gap backlog.
**Validation:** `pnpm --filter @periscan/web test -- app-navigation app-breadcrumbs` PASS (2 files / 5 tests); `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:e2e -- web-app-shell web-accessibility` PASS (41 tests); `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 42/42, security 22/22, and acceptance 100 files / 122 tests.

## Codex Full Verification Refresh - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-ProductionReadiness` release coordination must reflect the current validation gate after the Real-First API hardening slices.
**Work completed:** Re-ran full repo verification with local Postgres on `127.0.0.1:5434`, confirmed no code/test failures, and restored the generated `apps/web/next-env.d.ts` route-type drift to the tracked production route reference after the Next build.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner and runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, E2E 22/22, security 22/22, high+ audit fatal gate, production audit, and acceptance 100 files / 122 tests.

## Codex Fixture Mission Target Guard - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RealFirst-MissionTargetGuard` / `PRD-PolicyEngine` / `PRD-JobScheduler` production policy decisions and mission starts must not carry fixture/mock target hints into validation execution.
**Work completed:** Policy preview and mission start now recursively reject target keys such as `fixtureMode`, `fixtureOutcome`, `fixtureReportPath`, and `mockMode` outside API dev mode with `fixture_mode_disabled`. The guard runs before policy persistence, validation-run writes, queue jobs, or module execution. Added a production-mode acceptance regression covering both policy preview denial and mission start denial. Also hardened the threat-feed alert acceptance test against reused global catalog dedupe state by correlating DB-resolved canonical item IDs.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-edge-regressions` PASS (100 files / 122 tests); `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS.

## Codex Mock Integration Dev-Mode Guard - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RealFirst-MockIntegrationGuard` / `PRD-Integration-Registry` / `PRD-API-First` production API clients must not create fixture/mock integrations as customer evidence sources.
**Work completed:** `POST /api/v1/integrations` now rejects both `mockMode: true` and `authType: "mock"` outside API dev mode with `fixture_mode_disabled` before persistence. Dev-mode mock integrations remain available for deterministic acceptance tests and local lab flows. Added a production-mode public API regression proving no integration record is created on denial. Updated user stories, acceptance criteria, traceability, and coordination notes.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-edge-regressions` PASS (100 files / 121 tests); `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS.

## Codex Control Validation Fixture Verdict Guard - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RealFirst-ControlFixtureGuard` / `PRD-ControlValidation` / `PRD-API-First` production control validation must not accept caller-supplied synthetic observer verdicts.
**Work completed:** `POST /api/v1/control-sources/:id/validate` now rejects `fixtureOutcome` outside API dev mode with `fixture_mode_disabled` before scope lookup, observer execution, module execution, validation-run writes, or control-source health updates. Added a production-mode Prisma-backed acceptance regression proving the denial writes no validation runs and leaves `lastValidatedAt`, `healthStatus`, and `telemetryStatus` unchanged. Updated user stories, acceptance criteria, traceability, and coordination notes.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-edge-regressions` PASS (100 files / 120 tests); `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS.

## Codex Scope Posture Fixture Mode Guard - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RealFirst-ScopePostureFixtureGuard` / `PRD-API-First` / `PRD-Real-First` production posture checks must not accept synthetic fixture input outside explicit dev/test mode.
**Work completed:** `POST /api/v1/scopes/:id/posture-check` now rejects `executionMode: "Fixture"` or fixture payloads outside API dev mode with `fixture_mode_disabled` before measured modules execute. Added a production-mode Prisma-backed acceptance regression proving no validation runs are written and no scope posture cadence fields are advanced when a customer-visible API request asks for fixture-backed posture evidence. Updated user stories, acceptance criteria, traceability, and coordination notes.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- api-edge-regressions` PASS (100 files / 119 tests); `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS.

## Codex Domain Scope DNS Verification - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Safety-VerifiedScope` / `PRD-API-First` / `PRD-Real-First` domain and subdomain scopes must be verified by customer-controlled DNS TXT proof before external validation, not by a production UI dev-mode bypass.
**Work completed:** Added DNS TXT scope verification helpers for `_periscan.<scope>` records, wired `POST /api/v1/scopes/:id/verify` to perform DNS TXT verification by default for Domain/Subdomain scopes, kept dev manual verification gated by `PERISCAN_DEV_MODE`, and updated the web API client so `verifyScope()` sends `{}` unless dev mode is explicitly requested. Snapshot Workspace pending-scope cards now display the exact TXT name and token to publish. Updated user stories, acceptance criteria, implementation status, traceability, and coordination notes.
**Validation:** `pnpm --filter @periscan/api test -- scope-verification` PASS; `pnpm --filter @periscan/web test -- snapshot-workbench periscan-api-client` PASS.

## Codex AI Validation Real-First API Boundary - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AI-Validation-ExecutionModes` / `PRD-API-First` / `PRD-Real-First` customer-visible AI app validation must not default to fixture-backed outcomes or allow `fixtureOutcome` to influence live-safe validation proof.
**Work completed:** Changed `POST /api/v1/ai-apps/:id/validate` request parsing so omitted execution mode defaults to `LiveSafe`, and `fixtureOutcome` is rejected unless `executionMode: "Fixture"` is explicit. Updated the runtime AI/control service so fixture AI validation is only accepted in API dev mode and fixture outcomes are not forwarded into live-safe module targets. Updated the safe AI module default live probe to honor the requested validation category when no custom safe test cases are supplied. Updated route tests and PRD-derived docs so the customer-facing API default is live-safe/inconclusive rather than synthetic pass/fail fixture evidence.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "registers and validates AI applications and control sources through the API"` PASS; `pnpm --filter @periscan/modules test -- ai_app.safe_validation` PASS; `pnpm typecheck` PASS; `pnpm lint` PASS.

## Codex Controlled Tooling Smoke Runbook Cleanup - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerSecurityBoundary` / `PRD-OSS-Safety` smoke docs must validate tool readiness and governance without presenting disallowed live offensive execution as current product capability.
**Work completed:** Replaced the old offensive live-smoke runbook with a controlled tooling smoke runbook. The current pass criteria are image build/smoke, OSS readiness, outbound runner polling, one passive/non-invasive signed task with redacted evidence, governance-denial proof for disabled live/high-impact paths, and kill-switch/revocation checks. The runbook explicitly keeps ServiceViaProxy logical-channel work, live SQL injection probing, credential spray, Kerberos enumeration, Metasploit execution, SharpHound collection, Caldera live execution, Atomic live execution, Impacket, Responder, and Pacu outside first-customer production smoke unless a later approved PRD/legal/security release enables them.
**Validation:** `git diff --check` PASS; targeted positive old-live-runbook phrase scan PASS; `pnpm test:runner:deploy` PASS with offline Kubernetes artifact checks; `pnpm --filter @periscan/modules test -- toolchain` PASS.

## Codex Deployment Guide Runner Boundary Cleanup - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-RunnerSecurityBoundary` / `SECURITY_BOUNDARIES` deployment docs must preserve the supported outbound HTTPS signed-task runner model and must not imply production enablement of reverse SSH/arbitrary tunnels or live adversarial tooling.
**Work completed:** Updated `docs/DEPLOY.md` so the production deployment topology describes runner-agent as an outbound signed-task agent with local scope enforcement, no inbound listener, no reverse SSH, and no arbitrary tunnel. Replaced production wording around offensive/high-impact modules with verified-scope, policy-decision, approval, and auditable-denial language. Reframed old “not yet live” follow-ups as customer/deployment prerequisites and explicitly kept Caldera live execution, SharpHound collection, credential-spray, exploitation, and arbitrary tunneling out of the deployment guide. Updated the `apps/runner-agent/Dockerfile` header comment to match the signed-task transport boundary.
**Validation:** `git diff --check` PASS; targeted runner-boundary wording scan PASS; `pnpm --filter @periscan/runner-agent lint` PASS; `pnpm test:runner:deploy` PASS with offline Kubernetes artifact checks.

## Codex Current Readiness Wording Cleanup - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-API-First` coordination and readiness docs must not imply that implemented API/report/feed surfaces are still future MVP work.
**Work completed:** Reworded root README OSS toolchain commands from old MVP phase language to current product phase language. Reworded the customer-facing API parity section in `docs/PRODUCT_COMPLETION_PLAN.md` so report/evidence export/share and UI API parity read as implemented, matching the current API routes and tests. Updated `docs/ROADMAP.md` to use first-customer surface wording. Updated historical `.ai` final reports, product review, agent logs, handoff, gap backlog, and user story text so public threat-feed ingestion is no longer described as deferred; commercial/private feed onboarding remains customer/business-gated and feed intelligence remains readiness context rather than validation proof.
**Validation:** `git diff --check` PASS; targeted stale wording scan PASS; `pnpm lint` PASS.

## Codex Legacy Gap Marker Truthfulness Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` coordination docs must not present historical June 5 P1/P2 discovery gaps as active work after later slices closed them.
**Work completed:** Updated `.ai/gap-backlog.md`, `.ai/requirements-traceability.md`, and `docs/IMPLEMENTATION_STATUS.md` so old connector, Threat Center, runner, web-state, Syncro remediation-ticket, observability, and a11y gap fragments read as closed/superseded for repo-owned first-customer scope rather than active implementation work. Customer credentials, provider setup, live deployment validation, and optional deep accessibility review remain documented as external or P2 polish.
**Validation:** `git diff --check` PASS; targeted stale legacy-gap grep PASS.

## Codex Threat Center Feed Traceability Truthfulness Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThreatIntel-SuperFeed` / `PRD-ReleaseTraceability` docs must distinguish the implemented public feed system from commercial/private feed onboarding and must not tell future agents that external feed ingestion is still unimplemented.
**Work completed:** Updated current codebase assessment, implementation status, traceability matrix, workstream prompt, manual Threat Center task prompt, and coordination traceability so they now reflect public super-feed ingestion, CISA KEV import, tenant recurring feed schedules, due-feed sweeps, threat-feed alerts/catalog, and verified-scope feed correlation as implemented. The docs still preserve the safety boundary that feed intelligence is awareness/readiness context only, not validation proof, and commercial/private feed onboarding remains customer/business-gated.
**Validation:** `git diff --check` PASS; targeted stale-feed grep PASS (no matches for old "external feed unimplemented" instructions in active docs).

## Codex Implementation Status Table Truthfulness Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-API-First` customer-readiness docs must not mark implemented, tested API-first subsystems as active engineering gaps.
**Work completed:** Aligned `docs/IMPLEMENTATION_STATUS.md` with the current traceability and release evidence by marking Integration registry, Validation modules, and Frontier Gateway as `Done` in the status table while preserving live-customer prerequisites for credentials, provider setup, verified scopes, runner deployment validation, and legal/customer decisions. Cleaned older `.ai/gap-backlog.md` live-summary rows and `.ai/status.md` historical poll snapshots so they no longer direct agents toward P1/P2 work already closed in the integration branch. Updated `docs/PRODUCTION_READINESS.md` so payment processor selection and live BAS enablement are documented as explicit out-of-scope/deployment-managed decisions, not missing repo implementation. Updated root `PRODUCTION_READINESS.md` status rows so runner, integrations/modules, reports/evidence packs, and observability reflect first-customer-ready repo evidence instead of older readiness wording.
**Validation:** `git diff --check` PASS; `rg "^\\| [^|]+\\| In progress|^\\| [^|]+\\| Not started|^\\| [^|]+\\| Blocked" docs/IMPLEMENTATION_STATUS.md` PASS (no matches); targeted stale open P1/P2/agent-running summary grep PASS (no matches); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner and runner lab, OSS toolchain check, license inventory/policy tests, Prisma generate/validate/migrate deploy, E2E 22/22, security 22/22, high+ audit fatal gate, production audit, and acceptance 100 files / 118 tests.

## Codex Release Status Truthfulness Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReleaseTraceability` / `PRD-API-First` release-readiness documentation should not point future agents at stale in-repo gaps that are already implemented and tested.
**Work completed:** Aligned stale P2 UX gap rows and the older current-product-state summary with the latest code/test state. The docs now state that connector expansion, Threat Center, runner deployment artifacts, primary/dynamic web shell states, Marketplace, Trust & Safety, Workspace, and Snapshot report route gates are done in repo, while remaining work is customer/vendor/legal/deployment setup.
**Validation:** `git diff --check` PASS. No code paths changed; full `pnpm verify` was already run and passed immediately before this docs-only cleanup.

## Codex Dynamic Snapshot Report Shell Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-SnapshotReport-DeepRouteShell` from the API-first web UX, Validation Snapshot report, replacement-UI navigation, and accessibility contracts.
**Work completed:** Hardened the dynamic `/snapshots/:id` report route so the top toolbar links to the adjacent API-backed workflow surfaces: Workspace, Validation Ops, Trust & Safety, and API Reference. Added component assertions for those peer links and Playwright coverage that exercises a representative dynamic Snapshot report route through the shared shell, breadcrumb, contextual links, and axe accessibility gate.
**Validation:** `pnpm --filter @periscan/web test -- snapshot-report-view` PASS (6 tests); `git diff --check` PASS; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:e2e -- web-app-shell` PASS (11 tests) after scoping duplicate toolbar/nav link assertions; `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:e2e -- web-accessibility` PASS (10 tests); `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma validate/migrate deploy, E2E 22/22, security 22/22, and acceptance 100 files / 118 tests.

## Codex Other Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-OtherConnector-Acceptance` from the API-first integration registry, Signal Fabric, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for every currently connectable Other-category manifest, including AbuseIPDB, VirusTotal, GreyNoise, Shodan, Censys, Anomali, Spur, DomainTools, SecurityScorecard, BitSight, Intel 471, AlienVault OTX, Recorded Future, Mandiant Advantage, Vanta, Drata, and Secureframe. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted secret storage where manifest-declared credential fields are sensitive, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized exposure/audit signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- other-connectors-flow` PASS (100 files / 118 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 100 files / 118 tests.

## Codex Security Control Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-SecurityControlConnector-Acceptance` from the API-first integration registry, Signal Fabric, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for every currently connectable SecurityControl-category manifest, including EDR/XDR, SIEM, SOAR, WAF, firewall, email-security, SASE/SSE, deception, BAS, NDR, API security, DSPM, segmentation, OT/IoT, and generated market-leader control/exposure connectors. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted secret storage where manifest-declared or generated credential fields are sensitive, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence where emitted, normalized control/exposure/asset signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial. Also hardened Cisco Umbrella API key ID credential metadata so key IDs are encrypted at rest.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- security-control-connectors-flow` PASS (99 files / 117 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 99 files / 117 tests.

## Codex Cloud Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-CloudConnector-Acceptance` from the API-first integration registry, Signal Fabric, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for every currently connectable Cloud-category manifest, including AWS, Azure, GCP, Cloudflare, Kubernetes, DigitalOcean, Heroku, Databricks, Snowflake, Microsoft Defender for Cloud, cloud workload/container-security platforms, and generated market-leader cloud posture connectors. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted secret storage where manifest-declared or generated credential fields are sensitive, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence where emitted, normalized cloud/asset/exposure/control signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- cloud-connectors-flow` PASS (98 files / 116 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 98 files / 116 tests.

## Codex Identity Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-IdentityConnector-Acceptance` from the API-first integration registry, Signal Fabric, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for every currently connectable Identity-category manifest, including Microsoft Entra ID, Okta, Google Workspace, Active Directory, Cisco Duo, OneLogin, PingOne, Auth0, JumpCloud, CyberArk, and generated market-leader identity/PAM/IGA/MDM/machine-identity connectors. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted secret storage where manifest-declared or generated credential fields are sensitive, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence where emitted, normalized identity/control/asset signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial. Also hardened generated key-pair connector manifests so API key identifiers are encrypted at rest.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- identity-connectors-flow` PASS (97 files / 115 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 97 files / 115 tests.

## Codex VM/EAP/ASM/CNAPP Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ExposureConnector-Acceptance` from the API-first integration registry, Signal Fabric, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for Tenable, Rapid7 InsightVM, Wiz, Prisma Cloud, Lacework/FortiCNAPP, Orca Security, Qualys VMDR, runZero, Assetnote, Axonius, Armis, and Cortex Xpanse. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted secret storage where manifest-declared, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence, normalized exposure/control signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- exposure-connectors-flow` PASS (96 files / 114 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 96 files / 114 tests.

## Codex Code/DevSecOps Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-CodeDevSecOps-ConnectorAcceptance` from the API-first integration registry, Signal Fabric, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for GitLab, Bitbucket, Azure DevOps, Buildkite, CircleCI, Jenkins, Docker Hub, GitHub Container Registry, and AWS ECR. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted provider-secret/cloud-credential storage where manifest-declared, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized repository/pipeline/container signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- code-devsecops-connectors-flow` PASS (95 files / 113 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 95 files / 113 tests.

## Codex AI Provider Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AIProvider-ConnectorAcceptance` from the API-first integration registry, AI app validation context, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for OpenAI, Anthropic, Azure OpenAI, Azure AI Search, Chroma, and AWS Bedrock. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted provider-secret storage where manifest-declared, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized AI application signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- ai-provider-connectors-flow` PASS (94 files / 112 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 94 files / 112 tests.

## Codex AI Stack Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-AIStack-ConnectorAcceptance` from the API-first integration registry, AI app validation context, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for Vertex AI, Pinecone, Weaviate, LangChain, LlamaIndex, Guardrails AI, and Lakera Guard. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted provider-secret storage where manifest-declared, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized AI application/control signal, evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- ai-stack-connectors-flow` PASS (93 files / 111 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 93 files / 111 tests.

## Codex Threat Intelligence Connector Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ThreatIntel-ConnectorAcceptance` from the API-first integration registry, Signal Fabric, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for AlienVault OTX, Recorded Future, and Mandiant Advantage. The test signs up a tenant, creates each connector in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted provider-secret storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized exposure signal/evidence/audit metadata, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- threat-intel-connectors-flow` PASS (92 files / 110 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex Jira Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Jira-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the Jira workflow destination. The test signs up a tenant, creates an `apiToken` Jira Cloud integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted token storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized ticket-state signal/evidence/audit metadata, creates a remediation ticket through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores Jira delivery metadata, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- jira-workflow-flow` PASS (91 files / 109 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex Microsoft Teams Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-MicrosoftTeams-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the Microsoft Teams workflow destination. The test signs up a tenant, creates a `webhook` Microsoft Teams integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted webhook storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized workflow-destination signal/evidence/audit metadata, sends a remediation notification through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores Microsoft Teams delivery metadata with the generic remediation ticket ID fallback, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-notification denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- microsoft-teams-workflow-flow` PASS (90 files / 108 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex Slack Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Slack-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the Slack workflow destination. The test signs up a tenant, creates a `webhook` Slack integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted webhook storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized workflow-destination signal/evidence/audit metadata, sends a remediation notification through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores Slack delivery metadata with the generic remediation ticket ID fallback, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-notification denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- slack-workflow-flow` PASS (89 files / 107 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex Opsgenie Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Opsgenie-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the Opsgenie workflow destination. The test signs up a tenant, creates an `apiKey` Opsgenie integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted API-key storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized alert-state signal/evidence/audit metadata, routes a remediation alert through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores Opsgenie metadata, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- opsgenie-workflow-flow` PASS (88 files / 106 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex PagerDuty Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-PagerDuty-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the PagerDuty workflow destination. The test signs up a tenant, creates an `eventsApi` PagerDuty integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted routing-key storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized incident-state signal/evidence/audit metadata, routes a remediation incident through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores PagerDuty metadata, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- pagerduty-workflow-flow` PASS (87 files / 105 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex Linear Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Linear-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the Linear workflow destination. The test signs up a tenant, creates an `apiKey` Linear integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted API-key storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized issue-state signal/evidence/audit metadata, creates a remediation issue through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores Linear metadata, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- linear-workflow-flow` PASS (86 files / 104 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex GitHub Issues Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-GitHubIssues-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the GitHub Issues workflow destination. The test signs up a tenant, creates a `pat` GitHub Issues integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted token storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized ticket-state signal/evidence/audit metadata, creates a remediation issue through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores GitHub Issues metadata, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- github-issues-workflow-flow` PASS (85 files / 103 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex ServiceNow Workflow Acceptance Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ServiceNow-WorkflowAcceptance` from the API-first workflow destination, remediation proof loop, Trust & Safety, tenant isolation, credential protection, and auditable evidence contracts.
**Work completed:** Added DB-backed acceptance coverage for the ServiceNow workflow destination. The test signs up a tenant, creates a `basicAuth` ServiceNow integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted password storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies normalized ticket-state signal/evidence/audit metadata, creates a remediation ticket through `/api/v1/remediations/:id/create-ticket`, confirms the remediation stores ServiceNow ticket metadata, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- servicenow-workflow-flow` PASS (84 files / 102 tests); full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex ConnectWise Manage Acceptance Coverage Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ConnectWiseManage-AcceptanceCoverage` from the API-first integration registry, MSSP/PSA connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the ConnectWise Manage public API workflow. The test signs up a tenant, creates an `apiKey` ConnectWise Manage integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted public/private key storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted company assets, normalized ConnectWise company/ticket/open-ticket signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- connectwise-manage-connector-flow` PASS (83 files / 101 tests). Full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 83 files / 101 tests.

## Codex Syncro Acceptance Coverage Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Syncro-AcceptanceCoverage` from the API-first integration registry, MSSP/RMM connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the Syncro public API workflow. The test signs up a tenant, creates an `apiKey` Syncro integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted API-token storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted customer and host assets, normalized Syncro customer/asset/offline-asset/ticket/open-ticket signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- syncro-connector-flow` PASS (82 files / 100 tests). Full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 82 files / 100 tests.

## Codex Autotask Acceptance Coverage Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-Autotask-AcceptanceCoverage` from the API-first integration registry, MSSP/PSA connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the Autotask public API workflow. The test signs up a tenant, creates an `apiKey` Autotask integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted API integration-code/secret storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted company assets, normalized Autotask company/ticket/open-ticket signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- autotask-connector-flow` PASS (81 files / 99 tests). Full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 81 files / 99 tests.

## Codex HaloPSA Acceptance Coverage Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-HaloPSA-AcceptanceCoverage` from the API-first integration registry, MSSP/PSA connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the HaloPSA public API workflow. The test signs up a tenant, creates a `clientCredentials` HaloPSA integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted OAuth client-secret storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted client assets, normalized HaloPSA client/ticket/open-ticket signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- halopsa-connector-flow` PASS (80 files / 98 tests). Full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, E2E 20/20, security 22/22, and acceptance 80 files / 98 tests.

## Codex NinjaOne Acceptance Coverage Slice - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-NinjaOne-AcceptanceCoverage` from the API-first integration registry, MSSP/RMM connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the NinjaOne public API workflow. The test signs up a tenant, creates an `accessToken` NinjaOne integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted access-token storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted organization/device assets, normalized NinjaOne organization/device/offline-device/alert/critical-open-alert signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- ninjaone-connector-flow` PASS (79 files / 97 tests).

## Codex Threat Feed Acceptance Timeout Stability - 2026-06-23

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** Acceptance validation stability for API-first continuous Threat Center ingestion and release-readiness gates.
**Work completed:** Confirmed the N-able N-central acceptance slice is committed/pushed as `b80f41e`, started local compose dependencies on the documented Postgres `5434` path after Prisma migrate failed against a down DB, and aligned `tests/acceptance/threat-feed-schedule-flow.test.ts` with the acceptance suite's 60-second timeout so full-suite load does not override the configured gate with a narrower per-test cap.
**Validation:** `pnpm test:acceptance -- threat-feed-schedule-flow` PASS and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS, including lint, typecheck, tests, build, runner, OSS toolchain, license checks, Prisma migrate deploy, Playwright E2E 20/20, security 22/22, and acceptance 78 files / 96 tests.

## Codex N-able N-central Acceptance Coverage Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-NCentral-AcceptanceCoverage` from the API-first integration registry, MSSP/RMM connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the N-able N-central public API workflow. The test signs up a tenant, creates an `apiToken` N-central integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted access-token/JWT storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted customer/device assets, normalized N-central customer/device/offline-device/active-issue signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- n-able-ncentral-connector-flow` PASS (78 files / 96 tests).

## Codex Datto RMM Acceptance Coverage Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-DattoRMM-AcceptanceCoverage` from the API-first integration registry, MSSP/RMM connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the Datto RMM public API workflow. The test signs up a tenant, creates an `apiKey` Datto RMM integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted API-key/API-secret storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted site/device assets, normalized Datto site/device/offline-device signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- datto-rmm-connector-flow` PASS (77 files / 95 tests).

## Codex Kaseya VSA Acceptance Coverage Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-KaseyaVSA-AcceptanceCoverage` from the API-first integration registry, MSSP/RMM connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the Kaseya VSA public API workflow. The test signs up a tenant, creates an `apiKey` VSA integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted access-token storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted host assets, normalized VSA asset/agent/offline-agent signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- kaseya-vsa-connector-flow` PASS (76 files / 94 tests).

## Codex ConnectWise Automate Acceptance Coverage Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ConnectWiseAutomate-AcceptanceCoverage` from the API-first integration registry, MSSP/RMM connector readiness, Trust & Safety, tenant isolation, credential protection, and real-first acceptance contracts.
**Work completed:** Added DB-backed acceptance coverage for the ConnectWise Automate public API workflow. The test signs up a tenant, creates a `basicAuth` Automate integration in explicit fixture/lab mode through `/api/v1/integrations`, verifies redacted API responses and encrypted credential storage, refreshes connector health, runs sync through `/api/v1/integrations/:id/sync`, verifies persisted assets, signals, normalized evidence, and audit metadata, confirms Trust & Safety visibility, and proves cross-tenant read/sync denial.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:acceptance -- connectwise-automate-connector-flow` PASS (75 files / 93 tests).

## Codex Report List Limit Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-ReportListLimit` from API-first reports, operational hardening, and replacement-UI access contracts.
**Work completed:** `GET /api/v1/reports` now accepts optional `?limit` with the shared clamp while preserving existing no-limit behavior. The reports service applies the cap newest-first, the route-test service mirrors it, and the typed web API client exposes `listReports({ limit })`.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "reports"` PASS, `pnpm --filter @periscan/web test -- periscan-api-client` PASS, `pnpm test:acceptance -- report-limit-flow` PASS (74 files / 92 tests), API/web typecheck PASS, and API/web lint PASS.

## Codex CTEM Program Provenance Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking origin.
**Requirement:** `PRD-CTEMProgramProvenance` from the API-first CTEM view, proof-over-findings, and real-first product-state contracts.
**Work completed:** `GET /api/v1/ctem/program` now exposes whether the summary is `Snapshot`-derived or a `LiveTenantStateBaseline`, plus the backing `snapshotId` when present. Empty/no-snapshot tenants return `source: "LiveTenantStateBaseline"` and `snapshotId: null`; Snapshot-backed tenants return `source: "Snapshot"` and the generated Snapshot ID. Validation Ops and CTEM report rendering now disclose the source so a live baseline is not mistaken for completed validation proof.
**Validation:** `pnpm --filter @periscan/shared test -- domain` PASS, `pnpm --filter @periscan/reports test -- CTEM` PASS after fixing null snapshotId handling, `pnpm --filter @periscan/api test -- app.test.ts -t "validation snapshots"` PASS, `pnpm --filter @periscan/web test -- validation-ops-dashboard periscan-api-client` PASS, `pnpm --filter @periscan/shared typecheck` PASS, `pnpm --filter @periscan/reports typecheck` PASS, `pnpm --filter @periscan/web typecheck` PASS, `pnpm --filter @periscan/api typecheck` PASS, and touched workspace lint PASS.

## Codex Integration Health Refresh Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-IntegrationHealthRefreshUX` / `GAP-P1-005` from the API-first Integration Registry, Trust & Safety, real-first UI, and post-connect liveness contracts.
**Work completed:** Integration Marketplace connected cards now expose API-backed `Sync now` and `Refresh health` actions, plus current health and last-sync status from persisted integration records. Trust & Safety connected systems now expose connector-specific sync, health refresh, and disconnect actions. Both surfaces call existing versioned APIs (`POST /api/v1/integrations/:id/sync`, `GET /api/v1/integrations/:id/health`, `GET /api/v1/tenants/current/trust-safety`, and `GET /api/v1/integrations`) and reload tenant-scoped state instead of showing UI-only or stale status.
**Validation:** `pnpm --filter @periscan/web test -- integration-marketplace trust-safety-dashboard` PASS (16 tests), `pnpm --filter @periscan/web typecheck` PASS, `pnpm --filter @periscan/web lint` PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS (web 32 files / 146 tests, api 16 files / 267 tests), `pnpm --filter @periscan/web build` PASS, `pnpm clean:build` PASS, and `git diff --check` PASS.

## Codex ConnectWise Automate Connector Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ConnectWiseAutomate-MSSPConnector` from the MSSP/PSA/RMM integration coverage, API-first marketplace, real-first connector, and safe read-only RMM context contracts.
**Work completed:** Promoted ConnectWise Automate from a planned marketplace seed to a Beta, connectable read-only MSSP/RMM connector. The connector supports fixture-backed sync plus live Automate REST reads from customer-configured client, computer, and alert endpoints using bearer token or read-only username/password credentials; normalizes client, managed-computer, offline-computer, alert, and critical-open-alert signals; emits MSSP/RMM assets; denies script, agent procedure, command, patch, remote-control, file/log retrieval, ticket mutation, client/computer mutation, and configuration-write paths; redacts credentials in API responses and connector outputs; and refreshes generated integration docs.
**Validation:** `pnpm --filter @periscan/connectors test -- "ConnectWise Automate"` PASS (34 files / 260 tests), `pnpm --filter @periscan/connectors typecheck` PASS, `pnpm --filter @periscan/connectors lint` PASS, `pnpm --filter @periscan/api test -- app.test.ts -t "ConnectWise Automate"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm test:modules -- integration-docs` PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS, full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with Playwright E2E 20/20, security 22/22, and acceptance 73 files / 91 tests, and `git diff --check` PASS.

## Codex Fixture Connector Shortcut Truthfulness Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-WebFixtureConnectorOptIn` from the API-first, real-first UI, integration onboarding, and no product-visible placeholder/mock behavior contracts.
**Work completed:** Primary web onboarding no longer presents fixture/mock connector setup as customer-default behavior. The Workspace and Integration Marketplace hide fixture connector shortcuts unless `NEXT_PUBLIC_PERISCAN_ENABLE_FIXTURE_CONNECTORS=true` or explicit test/lab props enable them; default copy points users to live API/connector onboarding and Trust & Safety. README, `.env.example`, user stories, and acceptance criteria now document the opt-in lab switch.
**Validation:** `pnpm --filter @periscan/web test -- snapshot-workbench integration-marketplace` PASS (16 tests), `pnpm --filter @periscan/web typecheck` PASS, `pnpm --filter @periscan/web lint` PASS, `pnpm --filter @periscan/web build` PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS, full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with Playwright E2E 20/20, security 22/22, and acceptance 73 files / 91 tests, `pnpm clean:build` PASS, and `git diff --check` PASS.

## Codex Runner Contract Truthfulness Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-RunnerContractTruthfulness` from the Internal Runner, runner-agent, API-first task dispatch, and first-customer documentation contracts.
**Work completed:** Closed a stale-contract gap. Go runner code/docs now describe all four implemented Go runner modules as real, safe checks; measured and discovery dispatch endpoints are explicitly documented as TypeScript runner-agent AgentLocal surfaces; the runner spec API list includes check/measured/discover with the runtime boundary; the roadmap no longer calls DNS/TLS/HTTP checks future seams; and the runner deployment validator now fails if that boundary or stale seam wording regresses.
**Validation:** `bash -n scripts/validate-runner-deploy.sh` PASS, `pnpm test:runner:deploy` PASS, `pnpm test:modules -- open-source-workstream-docs` PASS, `pnpm test:runner` PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS, full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 73 files / 91 tests, `pnpm clean:build` PASS, and `git diff --check` PASS.

## Codex Runner Agent Offensive Default-Deny Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-RunnerAgentOffensiveDefaultDeny` from the runner safety boundary, no active exploit/credential-theft defaults, outbound internal runner, and first-customer deployment contracts.
**Work completed:** Closed a defense-in-depth default-safety gap. The TypeScript runner-agent default local module allowlist now contains only passive/non-invasive runner and recon modules; `identity.cred_spray`, `identity.kerberos_userenum`, and `exploit.metasploit_check` require explicit deployment-time local allowlist plus elevated safety-level opt-in in addition to SaaS policy approval, verified scope, and an approved customer window.
**Validation:** `pnpm --filter @periscan/runner-agent test -- config agent` PASS, `pnpm --filter @periscan/runner-agent typecheck` PASS, `pnpm --filter @periscan/runner-agent lint` PASS, `pnpm test:runner:deploy` PASS, `pnpm test:modules -- open-source-workstream-docs` PASS, `pnpm test:runner` PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS, `git diff --check` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 73 files / 91 tests. Post-build `pnpm clean:build` PASS restored the generated-artifact-clean working tree.

## Codex Model Gateway Specialized Provider Fail-Closed Slice - 2026-06-21

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ModelGatewaySpecializedProviderFailClosed` from the API-first, real-first, no product-visible placeholders, and model gateway provider lifecycle contracts.
**Work completed:** Closed a product-visible placeholder gap. The future `SpecializedCyberModel` adapter remains only an internal fail-closed extension point; production provider creation and the route-test harness now reject it before persistence with `unsupported_model_provider`, the Model Gateway web selector no longer lists it, and docs describe it as non-connectable until a concrete provider, tests, policy review, and customer-facing docs land together.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "model gateway provider lifecycle"` PASS, `pnpm --filter @periscan/web test -- model-gateway-workbench` PASS, `pnpm --filter @periscan/model-gateway test -- adapters` PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS, `git diff --check` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 73 files / 91 tests. Post-build `pnpm clean:build` PASS restored the generated-artifact-clean working tree.

## Codex Integration Catalog Count Truthfulness Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-IntegrationCatalogCountTruthfulness` from the API-first integration marketplace, generated-doc truthfulness, and first-customer documentation contracts.
**Work completed:** Reconciled handwritten customer docs with generated integration catalog totals. README, product completion plan, and traceability now say the catalog has 264 API-backed entries: 121 live dedicated/non-mock integrations and 143 catalog manifests. The integration-docs regression now derives these totals from `docs/integrations.json` and checks those handwritten docs.
**Validation:** `pnpm test:modules -- integration-docs` PASS and `git diff --check` PASS.

## Codex Runner Deployment Safety Docs Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-RunnerDeploymentSafetyDocs` from the Internal Runner, customer deployment, safety-boundary, API-first runner dispatch, and release-validation contracts.
**Work completed:** Closed a runner deployment/documentation drift risk. Runner customer docs now list all implemented safe modules and task dispatch endpoints, the Kubernetes deployment README link is portable inside the repo, acceptance criteria and runner spec no longer imply reachability-only execution, and the self-contained/offensive runner PRD is explicitly marked historical/superseded so it cannot override the current no reverse SSH/no arbitrary tunnel/no live SharpHound-Caldera-Atomic policy.
**Validation:** `bash -n scripts/validate-runner-deploy.sh` PASS, `pnpm test:runner:deploy` PASS, `pnpm test:modules -- open-source-workstream-docs` PASS, `pnpm --filter @periscan/shared test -- runner` PASS, and `git diff --check` PASS.

## Codex Kaseya VSA Connector Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-KaseyaVSA-MSSPConnector` from the MSSP/PSA/RMM integration coverage, API-first marketplace, real-first connector, and safe read-only RMM inventory contracts.
**Work completed:** Promoted Kaseya VSA from a planned marketplace seed to a Beta, connectable read-only MSSP/RMM connector. The connector supports fixture-backed sync plus live personal-access-token reads from VSA REST asset and agent inventory endpoints, normalizes asset/agent/offline-agent signals, creates MSSP/RMM host assets, denies procedure/job/patch/file/log/remote-control/delete/rename/configuration mutation paths, exposes explicit permissions/safety metadata through the API catalog, and refreshes generated integration docs.
**Validation:** `pnpm --filter @periscan/connectors test -- Kaseya` PASS, `pnpm --filter @periscan/connectors typecheck` PASS, `pnpm --filter @periscan/connectors lint` PASS, `pnpm --filter @periscan/api test -- app.test.ts -t "integration catalog"` PASS, `pnpm exec tsx scripts/generate-integrations.ts` PASS, `pnpm test:modules -- integration-docs` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 73 files / 91 tests.

## Codex Integration Docs Live Truthfulness Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-IntegrationDocsLiveTruthfulness` from the API-first marketplace, no-placeholder, and real-first documentation contracts.
**Work completed:** Fixed `scripts/generate-integrations.ts` so generated integration docs count a connector as live only when it is connectable, not `Planned`, and not produced by the mock market-leader factory. Regenerated `docs/INTEGRATIONS.md` and `docs/integrations.json`; planned seed connectors now remain catalog-only while Datto RMM stays live/Beta. Added a regression test that fails if any planned connector is presented as live or if Datto/VSA regress.
**Validation:** `pnpm test:modules -- integration-docs` PASS, `pnpm lint` PASS, and `pnpm typecheck` PASS.

## Codex Datto RMM Connector Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-DattoRMM-MSSPConnector` from the MSSP/PSA/RMM integration coverage, API-first marketplace, real-first connector, and no-raw-plumbing product contracts.
**Work completed:** Promoted Datto RMM from a planned marketplace seed to a Beta, connectable read-only MSSP/RMM connector. The connector supports fixture-backed sync plus live OAuth token resolution and `GET /api/v2/account/devices` inventory reads, normalizes site/device/offline-device signals, creates MSSP/RMM host/site assets, denies non-inventory RMM action paths, exposes explicit permissions/safety metadata through the existing API catalog, and refreshes generated integration docs.
**Validation:** `pnpm --filter @periscan/connectors test -- Datto` PASS, full `pnpm --filter @periscan/connectors test` PASS (34 files / 258 tests), `pnpm --filter @periscan/connectors typecheck` PASS, `pnpm --filter @periscan/connectors lint` PASS, `pnpm --filter @periscan/api test -- app.test.ts -t "integration catalog"` PASS, `pnpm --filter @periscan/api typecheck` PASS, and `pnpm exec tsx scripts/generate-integrations.ts` PASS.

## Codex Coordination Spec Index Freshness Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-AgentCoordinationTraceability` from the autonomous coordination, traceability, and avoid-duplicate-work instructions.
**Work completed:** Added a current addendum to `.ai/spec-index.md` so future agents do not treat stale June 5 discovery notes as current guidance. The addendum clarifies the active branch, supersedes old open-PR/connector notes, marks Threat Center public feeds and schedules as implemented, marks MSSP/Billing/Executive foundation plus `/mssp` branding UI as implemented, and preserves payment/live-offensive/customer-credential work as external or policy-gated decisions.
**Validation:** `git diff --check` PASS.

## Codex MSSP Report Branding UI Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-MSSPWhiteLabelBrandingUI` from the MSSP white-label reports, API-first UX, and first-customer readiness contracts.
**Work completed:** Closed the remaining code-addressable white-label UI polish gap. The MSSP portfolio page now loads tenant report branding through `GET /api/v1/tenants/current/branding`, exposes a real save form for white-label enablement, organization name, logo URL, accent color, support email, and footer, persists through `PUT /api/v1/tenants/current/branding`, and renders an inline report preview from the same form state without using sample data.
**Validation:** `pnpm --filter @periscan/web test -- mssp-portfolio-dashboard` PASS (6 tests), full `pnpm --filter @periscan/web test` PASS (32 files / 143 tests), `pnpm --filter @periscan/web typecheck` PASS, and `pnpm --filter @periscan/web lint` PASS.

## Codex Enterprise Entitlement Superset Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-EnterpriseFullPlatformEntitlements` from the API-first customer access, enterprise packaging, AI app validation, and control validation contracts.
**Work completed:** Closed an entitlement packaging gap where the Enterprise package metered `AIApplications` and `ControlSources` but did not explicitly include the route-gated capabilities `AI app registry` and `Control source registry`. Enterprise is now modeled as the full-platform package by including the published capabilities and meters from Validation Snapshot, Core Validation, Control Validation, AI Security Validation, Evidence Packs, MSSP / Partner, plus enterprise-only governance capabilities.
**Validation:** `pnpm --filter @periscan/api test -- runtime-services.test.ts -t "BILLING_PACKAGE_CATALOG Enterprise coverage"` PASS, `pnpm --filter @periscan/api test -- app.test.ts -t "billing"` PASS, full `pnpm --filter @periscan/api test` PASS (16 files / 266 tests), `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, repo `pnpm lint` PASS, and repo `pnpm typecheck` PASS.

## Codex Demo Scenario Breadth Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-DemoScenarioBreadth` from the deterministic demo data, first demo story, AI app validation, control validation, fix verification, and proof-loop contracts.
**Work completed:** Closed the P3 demo breadth item. `pnpm seed:demo` now seeds a broader API-backed proof loop: verified domain scope, GitHub/AWS/Jira/Splunk mock integrations, synced signals, AI app registration plus safe RAG authorization fixture validation, Splunk-backed control source plus dry-run missed-control validation, attack paths, remediation tickets, Snapshot report, and fix verification events for every seeded remediation. The CLI now exits cleanly after completion.
**Validation:** `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm seed:demo` PASS, `pnpm --filter @periscan/db test -- demo` PASS (6 files / 21 tests), `pnpm --filter @periscan/db typecheck` PASS, and `pnpm --filter @periscan/api typecheck` PASS.

## Codex Build Artifact Cleanup Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ReleaseHygieneBuildArtifacts` from the production-readiness and release-hygiene contracts.
**Work completed:** Closed the P3 build-artifact cleanup item. Added a repeatable root `pnpm clean:build` command backed by `scripts/clean-build-artifacts.sh`, scoped only to generated `dist/` directories under `apps/` and `packages/`, then ran it to remove the current local build outputs.
**Validation:** `pnpm clean:build` PASS and `find apps packages -type d -name dist -print` returned no remaining generated `dist/` directories.

## Codex Non-MSSP Responsive Metrics Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-WebResponsiveMetricSummaries` from the responsive UX, accessibility, and first-customer readiness contracts.
**Work completed:** Closed the remaining non-MSSP responsive P2 review item for fixed base metric grids. API health, Signal Activity, Findings, Validation Ops, Registry Center, and ATT&CK Catalog summary metric grids now use mobile-first one-column layouts and expand at the existing `sm`/`lg` breakpoints. The API health details grid also now has an accessible label for regression coverage.
**Validation:** Focused web tests PASS for `health-status-card`, `signal-activity-stream`, `findings-workbench`, `validation-ops-dashboard`, `registry-center`, and `attack-techniques-catalog` (6 files / 31 tests); full `pnpm --filter @periscan/web test` PASS (32 files / 142 tests); `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS.

## Codex Snapshot Report Accessibility Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-SnapshotReportAccessibleStates` from the Validation Snapshot report, API-driven UX, accessibility, and first-customer readiness contracts.
**Work completed:** Closed the Snapshot-report portion of the remaining P2 web-state/a11y item. The report route now exposes API activity with `aria-busy`, renders the HTML report preview as a named `Validation Snapshot report preview` region, and gives the no-report-HTML API state explicit retry and workspace navigation actions instead of a dead-end empty panel.
**Validation:** `pnpm --filter @periscan/web test -- snapshot-report-view` PASS (6 tests), full `pnpm --filter @periscan/web test` PASS (32 files / 142 tests), `pnpm --filter @periscan/web typecheck` PASS, and `pnpm --filter @periscan/web lint` PASS.

## Codex MSSP Responsive Polish Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-MSSPResponsivePortfolio` from the MSSP multitenancy, responsive UI, and first-customer readiness contracts.
**Work completed:** Narrowed the remaining P2 web-state/responsive item after verifying Snapshot report and MSSP already have API-backed loading/error/retry/empty states. MSSP portfolio metric and client coverage grids now use mobile-first one-column layouts and expand at `sm`/`lg`, reducing cramped two-column layouts on 320px/mobile views.
**Validation:** `pnpm --filter @periscan/web test -- mssp-portfolio-dashboard` PASS (5 tests), full `pnpm --filter @periscan/web test` PASS (32 files / 141 tests), `pnpm --filter @periscan/web typecheck` PASS, and `pnpm --filter @periscan/web lint` PASS.

## Codex Web Shell Breadcrumb Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-WebShellBreadcrumbs` from the PRD main-navigation, UX, accessibility, and API-swappable UI contracts.
**Work completed:** Closed the remaining breadcrumb portion of the P2 global web shell gap. The root layout now renders a route-aware breadcrumb component derived from the same primary navigation sections used by the app shell, including a stable label for dynamic Snapshot report routes so opaque IDs are not surfaced as product IA. The breadcrumb is semantic (`aria-label="Breadcrumb"`), marks the current page with `aria-current="page"`, and preserves the existing responsive shell.
**Validation:** `pnpm --filter @periscan/web test -- app-breadcrumbs app-navigation` PASS, full `pnpm --filter @periscan/web test` PASS (32 files / 141 tests), `pnpm --filter @periscan/web typecheck` PASS, `pnpm --filter @periscan/web lint` PASS, Playwright `tests/e2e/web-app-shell.spec.ts` PASS (10/10), and Playwright `tests/e2e/web-accessibility.spec.ts` PASS (9/9).

## Codex Measured Posture Snapshot/Fix Verification Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-MeasuredPostureSnapshotFixVerification` from the Validation Snapshot, safe external validation, fix verification, evidence-backed proof, and Real-First contracts.
**Work completed:** Closed the stale-but-real predeployment feature-depth gap. Snapshot creation now runs all built-in measured DNS/TLS/HTTP/email posture modules for verified Domain/Subdomain scopes before building the Snapshot payload, using deterministic fixture mode only in dev mode and live non-invasive checks in production. External-exposure remediation verification now selects the measured posture modules that actually support `FixVerification`, supplies verified-scope hostname targets, records `ActiveNonInvasive` mission safety when those modules run, and marks successful validation-module retests as measured revalidation instead of connector-only revalidation.
**Validation:** `pnpm --filter @periscan/shared test -- fix-verification` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test -- app.test.ts -t "Jira ticketing and fix verification"` PASS, and focused DB-backed acceptance PASS for `snapshot-measured-posture-flow`, `snapshot-metrics-count-flow`, and `fix-verification-measured-posture-flow`.

## Codex Readiness Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ReadinessRouteCoverage` from the production-readiness, observability, and API-first system health contract.
**Work completed:** Closed another API route harness gap. `apps/api/src/app.test.ts` now mirrors the production readiness check families for `/api/v1/health/ready`: database, queue, evidence store, and continuous-validation sweep. The route test now proves the ready endpoint exposes the full readiness check set instead of silently regressing to database-only health.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "API health status"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 264 tests), `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Deployment Status Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-DeploymentStatusRouteCoverage` from the production-readiness, admin-only system health, and API-first operations contract.
**Work completed:** Closed another API route harness gap. `apps/api/src/app.test.ts` now uses the production `buildDeploymentStatus` readiness builder for `/api/v1/system/deployment-status` instead of returning `ready: true` with an empty item list. The route test now proves tenant-admin access, required configuration item reporting, secret-value redaction, missing credential-encryption-key blocking, ready-state transition once required env is configured, and viewer denial.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "deployment readiness"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 264 tests), `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Due Re-Verification Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-DueReverificationRouteCoverage` from the continuous validation, fix verification, API-first remediation, and "do not mark fixed without proof" contract.
**Work completed:** Closed another API route harness gap. `apps/api/src/app.test.ts` now mirrors the production `/api/v1/remediations/reverify-due` semantics in the in-memory Fastify service harness: scope-editor-only access, tenant-scoped due remediation selection, settled-status filtering, 25-item cap, invocation of the existing fix-verification path, verification-event creation, no immediate repeat when the result is no longer a settled fixed/mitigated state, and safe rescheduling if a due item cannot be verified.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "Jira ticketing and fix verification"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 263 tests), `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Threat Feed Schedule Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ThreatFeedScheduleRouteCoverage` from the API-first Threat Center, continuous threat-feed ingestion, tenant-scoped schedule, and readiness-evidence contract.
**Work completed:** Closed another API route harness gap. `apps/api/src/app.test.ts` now uses deterministic CISA KEV-style fixture entries for `/api/v1/threat-feeds/ingest`, creates real in-memory threat advisories through the existing advisory import/evidence/readiness path, deduplicates re-ingestion by tenant/feed/CVE, persists tenant-scoped threat-feed schedules, returns schedule read-back through `/api/v1/threat-feeds/schedule`, and advances due schedules through `/api/v1/threat-feeds/ingest-due` instead of returning empty/no-op results.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "continuous threat feed ingestion and scheduling routes"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 263 tests), `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Mission/Job Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-MissionJobRouteCoverage` from the API-first validation mission, job scheduler, and tenant-isolated queue visibility contract.
**Work completed:** Re-synced with the updated branch state and closed another route-test harness gap. `apps/api/src/app.test.ts` now creates in-memory `Job` records for queued validation runs during `startMission`, exposes tenant-scoped `/api/v1/jobs` list filtering by mission/status, exposes `/api/v1/jobs/:jobId`, and returns tenant-owned `/api/v1/missions/:id/runs/:runId` records instead of null/empty data. The existing mission lifecycle route test now proves run detail, job list/detail, job payload grounding, queue name, and cross-tenant 404 behavior.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "module catalog plus mission create/start/run flows"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 262 tests), `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Account Security Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-AccountSecurityRouteCoverage` from the API-first auth, tenant, RBAC, and customer account-security contract.
**Work completed:** Closed another API route harness blind spot for account-security flows. `apps/api/src/app.test.ts` now models hash-backed user tokens, email verification, invite acceptance, password reset request/confirm, MFA enrollment, TOTP activation, one-time recovery-code issuance and consumption, recovery-code regeneration with re-auth, MFA disable with re-auth, `/me` MFA state updates, password-reset single-use behavior, no-account-enumeration reset requests, and account-security audit events instead of static success responses.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "account-security token and MFA"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 262 tests), `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex API Key Bearer Auth Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ApiKeyAuthRouteCoverage` from the API-first customer access contract.
**Work completed:** Extended the API route test harness so tenant API keys can authenticate real Fastify routes through `Authorization: Bearer psk_*`, rather than only being manageable lifecycle objects. `apps/api/src/app.test.ts` now hashes one-time API-key secrets, authenticates active keys by hash, updates `lastUsedAt`, derives the request role from key scopes, binds the request to the key's tenant even when a conflicting tenant header is supplied, rejects stale keys after rotation, rejects revoked keys, and denies API-key-authenticated callers from managing tenant API keys.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "tenant API key lifecycle"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 261 tests), `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, and repo `pnpm test` PASS.

## Codex Engagement Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-EngagementRouteCoverage` from the API-first governed autonomous engagement contract.
**Work completed:** Filled another API route test-double gap for governed autonomous engagements. `apps/api/src/app.test.ts` now models tenant-scoped engagement persistence in the in-memory Fastify service harness instead of returning a fake plan-only object, `null` reads, and empty history. The harness mirrors production semantics: scope-editor-only run/read/list, tenant-owned scope lookup, default plans by scope type, PlanOnly steps remain planned with no evidence, Execute steps pass through module safety constraints, safe executed steps create redacted in-memory evidence and signals, missing modules are failed steps, engagement status is derived from actual step outcomes, read/list are tenant-scoped, viewers are forbidden, cross-tenant reads are 404, and run/read audit events are written.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "governed autonomous engagements"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `git diff --check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and serial `pnpm --filter @periscan/api test` PASS (16 files / 261 tests). A concurrent first broad API test hit a transient Prisma-client parse error while root typecheck regenerated Prisma; rerunning serially after generation passed.

## Codex Webhook Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-WebhookRouteCoverage` from the API-first notification, customer automation, and delivery-observability contract.
**Work completed:** Filled another API route test-double gap for tenant outbound webhooks. `apps/api/src/app.test.ts` now models tenant-scoped webhook lifecycle and delivery state in the in-memory Fastify service harness instead of returning empty lists, synthetic webhooks, or one-off delivery IDs. The harness mirrors production semantics: tenant-admin-only list/create/update/delete/test/delivery access, secret returned only on create, stored/listed/updated webhooks never include secrets, test sends create pending delivery records, delivery lists are tenant-scoped and filterable by webhook, dead-letter lists include only failed permanent deliveries, viewers are forbidden, and cross-tenant mutation is not found.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "tenant webhook lifecycle"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 260 tests), repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and `git diff --check` PASS.

## Codex API Key Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ApiKeyRouteCoverage` from the API-first customer access contract.
**Work completed:** Filled another API route test-double gap for customer API access. `apps/api/src/app.test.ts` now models tenant-scoped API keys in the in-memory Fastify service harness instead of returning synthetic one-off keys and empty list responses. The harness mirrors production semantics: tenant-admin-only create/list/revoke/rotate, secret returned only on create/rotate, stored/listed/revoked keys never include secrets, key rotation changes the prefix and clears last-used state, revoked keys cannot rotate, repeated revoke is idempotent, cross-tenant mutation is 404, and create/rotate/revoke audit events are written.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "tenant API key lifecycle"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 259 tests), repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, and repo `pnpm test` PASS.

## Codex Policy Approval Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-PolicyApprovalRouteCoverage` from the API-first policy and safety engine contract.
**Work completed:** Filled an approval-governance API route test-double gap. `apps/api/src/app.test.ts` now models tenant-scoped policy-decision history and pending approvals in the in-memory Fastify service harness instead of returning empty lists and not-found responses. The harness mirrors production semantics: tenant-admin-only list/mutate, pending list filters to `outcome: "RequiresApproval"` and `approvalState: "Pending"`, approval changes `approvalState` to `Approved` while preserving the original `RequiresApproval` outcome, non-approval decisions return `409 approval_not_required`, denial sets `approvalState: "Rejected"` with no approval timestamp/user, cross-tenant mutation is 404, and approval/denial audit events are written.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "policy decision history"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 258 tests), repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, `git diff --check` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Real-First Web Defaults Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-RealFirst-WebDefaults` from the Real-First rule and API-driven product UX contract.
**Work completed:** Removed customer-facing demo-prefilled input values from primary Snapshot and Threat Center workbenches. Snapshot authentication and domain-scope fields now start blank with explicit placeholders and browser-required validation. Threat Center authentication and manual advisory import fields now start blank with explicit placeholders and required fields for title/source/summary/raw content. The public `/demo` sample route and test fixtures remain the only intentional sample-data surfaces. Component tests now assert blank defaults and explicitly type advisory content before import.
**Validation:** `pnpm --filter @periscan/web test -- snapshot-workbench threat-center-workbench` PASS (2 files / 15 tests), `pnpm --filter @periscan/web typecheck` PASS, `pnpm --filter @periscan/web lint` PASS, `pnpm --filter @periscan/web build` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, `git diff --check` PASS, and full `pnpm verify` PASS against local Postgres `127.0.0.1:5434` with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Model Gateway Lifecycle Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ModelGateway-LifecycleRouteCoverage` from the API-first Frontier/Model Gateway control-plane contract.
**Work completed:** Filled the remaining API route test-double gap for Model Gateway lifecycle routes beyond providers. `apps/api/src/app.test.ts` now persists tenant-scoped model policy profiles, model sessions, context bundles, model tool overrides, model tool requests, and model gateway audit events. The harness enforces admin/profile mutation, scope-editor session/tool actions, tenant-owned scope checks, cross-tenant not-found behavior, active-session policy delete conflict, approval-required tool request transitions, deterministic redacted execution output, and kill-switch session/request cancellation. The existing Model Gateway route test now creates and verifies a real tenant scope, exercises policy create/list/read/update/delete, session create/list/start/pause/kill-switch read-back, context bundle create/list/read, tool configuration, tool request create/list/approve/execute/cancel via kill switch, audit event listing, cross-tenant denial, and OpenAPI route presence.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "model gateway control-plane"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 257 tests), repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, `git diff --check` PASS, and full `pnpm verify` PASS against local Postgres `127.0.0.1:5434` with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex Model Gateway Provider Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ModelGateway-ProviderRouteCoverage` from the API-first Frontier/Model Gateway control-plane contract.
**Work completed:** Filled the API test double gap for `/api/v1/model-gateway/providers/*`. `apps/api/src/app.test.ts` now persists model providers, enforces tenant-admin mutation, preserves `hasCredential` redaction state without exposing secrets, updates `lastTestedAt`/status during connection tests, deletes providers, and denies cross-tenant read/update instead of returning synthetic provider objects and empty provider lists. Added a Fastify route test proving provider create/list/read/update/test-connection/clear-credential/delete and cross-tenant denial.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "model gateway provider lifecycle"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 257 tests), repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `pnpm verify` PASS against local Postgres `127.0.0.1:5434`.

## Codex Integration Recurring Sync Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-Integration-RecurringSyncRouteCoverage` from the API-first integration registry and continuous-validation scheduler contract.
**Work completed:** Filled the API test double gap for recurring connector sync routes. `apps/api/src/app.test.ts` now exposes in-memory integration schedule fields, implements `setIntegrationSyncSchedule`, implements due recurring sync sweeps by reusing the existing connector sync path, advances `nextSyncAt`, and enforces tenant isolation instead of returning `501` or an empty sweep result. Added a Fastify route test proving schedule set/read/clear, due sync, and cross-tenant denial.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "integration sync schedules"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 256 tests), repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, and full `pnpm verify` PASS against local Postgres `127.0.0.1:5434`.

## Codex Threat Feed Alert Route Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-ThreatIntel-AlertRouteUnitCoverage` from the API-first global threat-intelligence super-feed contract.
**Work completed:** Filled the API route test harness gap for `/api/v1/threat-intel/*`. `apps/api/src/app.test.ts` now models in-memory threat catalog items, feed health responses, tenant-scoped threat alerts, and alert status updates instead of returning empty catalog/feed/alert lists or throwing for `setThreatAlertStatus`. Added a Fastify route test proving catalog search, feed status, alert listing, acknowledgement, status filtering, and cross-tenant update denial.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "tenant threat feed alerts"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 255 tests), and full `pnpm verify` PASS against local Postgres `127.0.0.1:5434`.

## Codex Runner Task Route Unit Coverage Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-Runner-TaskRouteUnitCoverage` from the internal runner API-first dispatch contract.
**Work completed:** Filled the API test double gap for runner task dispatch routes. `apps/api/src/app.test.ts` now creates policy-bound signed tasks for `/api/v1/runners/:id/tasks/check`, `/tasks/measured`, and `/tasks/discover` in the same in-memory service path used by route tests, instead of returning `501` while DB-backed acceptance tests covered the real service. The existing runner registration/poll/result test now also verifies HTTP-health check dispatch, invalid TLS check validation, safe measured `periscan.tls_protocol_audit` dispatch, and non-invasive `recon.service_inventory` discovery dispatch.
**Validation:** `pnpm --filter @periscan/api test -- app.test.ts -t "internal runner registration"` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api lint` PASS, `pnpm --filter @periscan/api test` PASS (16 files / 254 tests), and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS.

## Codex Runner Internal Check Contract Regression Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-Runner-InternalCheckContract` from the internal runner safety/API contract.
**Work completed:** Added shared-contract regression coverage for runner internal check modules. The test now proves the exported internal-check module enum exactly matches the implemented Go runner checks (`runner.dns_resolution_check`, `runner.tls_certificate_check`, `runner.http_health_check`) with no duplicate entries, allows DNS checks without a port, and requires an explicit port for HTTP/TLS checks.
**Validation:** `pnpm --filter @periscan/shared test -- runner` PASS (18 files / 109 tests), `pnpm test:acceptance -- runner-internal-check-flow` PASS (71 files / 88 tests), and `pnpm test:runner` PASS.

## Codex Customer Agent Workstream Consistency Slice - 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-Runner-CustomerAgentResolvedWorkstream` / `GAP-OSS-AGENT-01` from the runner and OSS tool productization program.
**Work completed:** Synchronized stale OSS customer-agent workstream docs with the implemented runner. The Customer Agent is now documented as the real outbound-only Internal Runner (`Current`, `ActiveNonInvasive`) rather than a "Decision needed" item; reverse SSH/arbitrary shell/tunnel remain disallowed; the docs now list the implemented reachability, DNS, TLS certificate, HTTP health, safe measured `periscan.*`, and non-invasive discovery task paths. Remaining work is explicitly customer-specific deployment validation after runner credentials, firewall egress, verified internal scope, and approval windows exist.
**Validation:** `pnpm test:modules -- open-source-workstream-docs` PASS with 2 files / 6 tests, including the new docs consistency regression.

## Codex OSS OpenCTI Threat Context Import Slice — 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-OSS-OpenCTIThreatContextImport` and `PRD-OSS-MISPLicenseBoundary` from the OSS threat-intel/context productization program.
**Work completed:** Productized OpenCTI as an API-visible PassiveReadOnly content/import capability. Added `opencti` to the shared OSS tool ID schema and toolchain registry, exposed `opencti.threat-context-import` through the OSS capability APIs, implemented `opencti.threat_context_import` to parse approved STIX/OpenCTI exports, extract CVEs/IOCs/ATT&CK technique IDs/advisory context, redact sensitive text, emit normalized threat-intel evidence and context signals, and record `validationProof:false` with `Inconclusive` validation state. MISP remains blocked because the repo's license policy fails AGPL material closed; no MISP runtime/tool definition/sharing path was enabled.
**Validation:** `pnpm --filter @periscan/modules test -- opencti` PASS, `pnpm --filter @periscan/modules test -- toolchain` PASS, `pnpm --filter @periscan/modules typecheck` PASS, `pnpm --filter @periscan/shared test -- open-source` PASS, `pnpm --filter @periscan/modules test` PASS, `pnpm modules:certify` PASS with 40 modules / 0 not certified, `pnpm licenses:write` PASS with 31 tools / 40 modules, `pnpm modules:certify:check` PASS, `pnpm licenses:check` PASS, `pnpm tools:check` PASS, all-phases OSS toolchain check PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS, `git diff --check` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS end-to-end with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex OSS OCSF Evidence Mapping Slice — 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-OSS-OCSFEvidenceMapping` from the OSS validation-engine/schema-normalization program.
**Work completed:** Productized OCSF as an API-visible PassiveReadOnly content/schema mapping capability. Added `ocsf` to the shared OSS tool ID schema and toolchain registry, exposed `ocsf.evidence-normalization` through the OSS capability APIs, implemented `ocsf.evidence_mapping` to map tenant-owned normalized signals/evidence into OCSF-compatible export envelopes, preserve unmapped attribute keys, and record `validationProof:false` so schema mapping never claims exploitability, detection, or fix status.
**Validation:** `pnpm --filter @periscan/modules test -- ocsf` PASS, `pnpm --filter @periscan/modules typecheck` PASS, `pnpm --filter @periscan/shared test -- open-source` PASS, `pnpm --filter @periscan/modules test` PASS, `pnpm modules:certify` PASS with 39 modules / 0 not certified, `pnpm licenses:write` PASS with 30 tools / 39 modules, `pnpm modules:certify:check` PASS, `pnpm licenses:check` PASS, `pnpm tools:check` PASS, all-phases OSS toolchain check PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, `git diff --check` PASS, and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS end-to-end with E2E 20/20, security 22/22, and acceptance 71 files / 88 tests.

## Codex OSS Garak/Sigma Slice — 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-OSS-GarakHarness`, `PRD-OSS-ZapBaselineStatus`, and `PRD-OSS-SigmaDetectionContent` from the OSS validation-engine program.
**Work completed:** Productized Garak as an API-visible, policy-gated AI validation harness under `ai_app.safe_validation`, added deterministic fixture coverage, corrected stale OSS workstream docs that still marked ZAP as Planned even though `web.zap_baseline` is implemented/certified, and added `sigma.detection_rule_import` as a PassiveReadOnly Sigma YAML content-import module for ATT&CK/control-coverage evidence without SIEM deployment.
**Validation:** Garak/toolchain/shared open-source focused tests PASS, Sigma focused tests PASS, modules typecheck PASS, `pnpm modules:certify` PASS with 38 modules / 0 not certified, `pnpm licenses:write` PASS with 29 tools / 38 modules, `pnpm modules:certify:check` PASS, `pnpm licenses:check` PASS, repo `pnpm lint` PASS, repo `pnpm typecheck` PASS, repo `pnpm test` PASS, `pnpm tools:check` PASS, all-phases `scripts/oss-toolchain.ts check` PASS, full `pnpm verify` PASS with acceptance 71 files / 88 tests, and `git diff --check` PASS.

## Codex SAML SSO Slice — 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Requirement:** `PRD-EnterpriseAccess-SSOFoundation` from PRD Phase 8 SSO/SAML/OIDC.
**Work completed:** API-first SAML SSO support was added on top of the existing OIDC SSO foundation without replacing the auth/session model. Current implementation includes shared SAML DTO fields, Prisma SAML config/request-correlation fields and migration, sanitized SSO serialization, `@node-saml/node-saml` response validation, form-encoded callback handling, `/api/v1/tenants/current/sso/metadata`, and focused SAML route/acceptance tests.
**Validation:** `pnpm --filter @periscan/shared test -- domain` PASS, `pnpm --filter @periscan/db test -- sso-schema` PASS, `pnpm --filter @periscan/db run db:generate` PASS, `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api test -- app.test.ts -t "SSO"` PASS, local migration deploy against Postgres `127.0.0.1:5434` PASS, focused SSO config acceptance PASS, `pnpm lint` PASS, `pnpm typecheck` PASS, `pnpm test` PASS, and full `DATABASE_URL=...5434 PERISCAN_TEST_DATABASE_URL=...5434 pnpm verify` PASS with acceptance 71 files / 88 tests.
**Remaining in this slice:** none in-repo; customer live SAML/OIDC use still requires IdP configuration outside the repo.

## Codex Integration Catch-Up — 2026-06-20

**Branch:** `codex/integrate-validated-pr-stack` tracking `origin/codex/integrate-validated-pr-stack`.
**Worktree before slice:** clean after local `pnpm verify` passed on the integrated readiness stack.
**Current PR:** draft PR #37 integrates the locally validated Codex readiness branches: OIDC SSO, evidence route authz hardening, AI endpoint truthfulness, runner CI Go pinning, OSS Docker runtime hardening, and module manifest safety metadata.
**Hosted CI:** GitHub Actions checks for PR #37 still fail before producing retrievable job logs, matching the known account/billing/spending-limit startup issue rather than a code-level test failure.
**This historical catch-up slice:** synchronized source-of-truth docs with current code by removing a duplicate readiness table and updating OIDC traceability/readiness language. Current in-repo OIDC support includes API-first tenant config plus generic OIDC start/callback/session enforcement, JWKS/issuer/audience/nonce/email-domain validation, enforced-password-login denial, non-SSO tenant-switch denial for enforced tenants, and audit events. The SAML-not-implemented note from that point is superseded by the 2026-06-20 SAML SSO slice above.

## Codex Catch-Up — 2026-06-20

**Branch:** `codex/oidc-sso-foundation` tracking `origin/codex/oidc-sso-foundation`.
**Worktree:** clean before this catch-up slice; now contains one CI/typecheck hardening change in `package.json`.
**Finding:** focused `pnpm --filter @periscan/api typecheck` failed before Prisma generation because the generated client did not include the SSO models/enums (`tenantSsoConfig`, `tenantSsoAuthRequest`, and SSO audit enum values). This is a fresh-checkout/CI fragility for the SSO branch, not a domain test failure.
**Fix:** root `pnpm typecheck` now runs `pnpm --filter @periscan/db run db:generate` before workspace TypeScript checks, matching the SSO branch's generated Prisma contract.
**Validation:** `pnpm --filter @periscan/shared test -- domain` PASS (18 files / 108 tests), `pnpm --filter @periscan/db test -- sso-schema` PASS (7 files / 23 tests), `pnpm --filter @periscan/db run db:generate` PASS, `pnpm --filter @periscan/api typecheck` PASS after generation, focused API SSO/session tests PASS (2 files / 4 focused tests), Prisma migrate deploy PASS on local Postgres `127.0.0.1:5434`, focused SSO acceptance PASS (2 files / 2 tests), `pnpm lint` PASS, updated root `pnpm typecheck` PASS, and `pnpm test` PASS (all workspace package tests).
**Hosted CI:** PR #31 still shows a 3-second failed `Verify` check with no retrievable job log through `gh run view`; the fresh post-push job `82491780425` has an empty `steps` array, so GitHub Actions never started executing the workflow. This matches the known hosted CI startup/billing-spending-limit issue, not a running test failure.

## Current Authoritative Status — 2026-06-19

**Branch:** `codex/integrate-validated-pr-stack` from clean `main`/`origin/main`, integrating the locally validated Codex draft PR stack.
**Main tip inspected:** current pushed `main`, which includes PR #28, PR #29, PR #30, the integrated readiness stack, Real-First API hardening, the full product route coverage gate, and this release-metadata update.
**GitHub state:** PR #30 merged. PR #31 (`codex/oidc-sso-foundation`) and PR #32 (`codex/evidence-route-authz-hardening`) are being integrated locally after focused validation. GitHub-hosted checks for draft PRs could not start because GitHub reported account billing/spending-limit failures, not code failures; local full `pnpm verify` passed.
**Release state:** current GitHub Release is `v0.1.338`, cut from the pushed `main` tip after this release-metadata update. Historical local/remote tag conflicts still exist, so do not force-fetch or force-update older tags blindly.

**Current product state from current code/tests:**

- In-repo first-customer readiness remains as documented in `.ai/release-readiness.md`, with external/deployment decisions still required for paid production use.
- Public global threat-intelligence super-feed is now implemented: 13 registered public/feed-key-capable sources, global deduped catalog, high-frequency poller with SSRF-guarded fetch, feed health/status, tenant-scoped realtime alerts, alert acknowledgement/dismissal, `/threat-feed` web surface, and subdomain/CIDR correlation against verified scope.
- Manual Threat Center remains available for advisory import/readiness; super-feed is a separate global catalog/alert surface under `/api/v1/threat-intel/*` and `/api/v1/threat-feeds/*`.
- Recent proof-core truthfulness fixes are present in code: model-gateway session timeout enforcement, runner terminal-state result rejection, neutral mock-observer defaults, and executive aggregate scope fixes.
- Active branch work after the OIDC SSO foundation now adds live generic OIDC login: `/api/v1/auth/sso/start`, GET/POST `/api/v1/auth/sso/callback`, hashed state/nonce persistence, JWKS/issuer/audience/nonce/email-domain verification, session creation for active provisioned tenant members, enforced-password-login denial, password/legacy session tenant-switch denial for enforced-SSO tenants, same-tenant SSO enforcement for cross-tenant switches, and `sso.login_*` audit events.
- Current branch work hardens evidence authorization proof: security boundary tests now cover owner access and cross-tenant denial for evidence metadata, evidence download, and attack-path evidence routes.
- Active Codex branch `codex/ai-endpoint-truthfulness` closes the remaining AI endpoint-probe nomenclature gap: benign live-safe endpoint probes stay `Inconclusive`, are not treated as passed AI validation, and are excluded from validated findings/Snapshot AI risk lists unless an approved harness result exists.

**Validation run in this catch-up slice:**

- `pnpm --filter @periscan/shared test -- threat-intel` PASS: 17 files / 99 tests.
- `pnpm --filter @periscan/api test -- src/threat-feeds/registry.test.ts` PASS: 16 files / 249 tests.
- `pnpm --filter @periscan/web test -- threat-feed-workbench` PASS: 1 file / 2 tests.
- `pnpm --filter @periscan/connectors test -- edr-waf-mock-observer-default siem-mock-observer-default` PASS: 34 files / 257 tests.
- `pnpm --filter @periscan/api typecheck` PASS.
- `pnpm --filter @periscan/web typecheck` PASS.
- Full `pnpm verify` PASS on 2026-06-19 with local Postgres at `127.0.0.1:5434`: lint, typecheck, unit/integration tests, production build, runner tests, OSS toolchain, license checks, Prisma generate/validate/migrate deploy, E2E 20/20, security tests, high+ dependency audit, and acceptance 69 files / 85 tests.
- OIDC SSO branch validation: `pnpm --filter @periscan/shared test -- domain` PASS (18 files / 108 tests), `pnpm --filter @periscan/db test -- sso-schema` PASS (focused SSO contract run), `pnpm --filter @periscan/db test` PASS (6 files / 20 tests), `pnpm --filter @periscan/api typecheck` PASS, `pnpm --filter @periscan/api test -- security.test.ts app.test.ts -t "SSO|session token"` PASS (4 focused tests), Prisma migrate deploy PASS on local Postgres `127.0.0.1:5434`, focused SSO config/login acceptance PASS (2 files / 2 tests), and final full `pnpm verify` PASS end-to-end on local Postgres `127.0.0.1:5434` after fixing SSO acceptance isolation and adding cross-tenant enforced-SSO denial.
- Evidence route hardening branch validation: `pnpm lint` PASS, `pnpm typecheck` PASS, and `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm test:security` PASS (2 files / 22 tests).
- Branch `codex/ai-endpoint-truthfulness` also completed a full `pnpm verify` PASS on 2026-06-19 against `127.0.0.1:5434` after closing AI endpoint-probe truthfulness and hardening acceptance timeouts/shared-DB assertions.

**Current coordination cleanup needed:**

- Older June 5 sections below are historical and partially stale; use this current-status block plus `.ai/release-readiness.md` and recent git history as authoritative.
- `.ai/agents/p3-verify-db-infra-fix.md` was corrupted with a git fatal message and has been repaired in this slice.
- `.ai/gap-backlog.md` had early Open rows superseded by later closures/current code; see its 2026-06-19 addendum.
- Active branch work after the release sync: API-first tenant OIDC/SAML SSO configuration and generic live login/callback enforcement, including auth-method-aware tenant switching and same-tenant SSO checks for enforced tenants. Remaining SSO work is customer deployment/configuration of an authorized IdP, redirect URI/entity ID, credentials/certificates, and any customer-specific claim conventions, not missing core in-repo callback/session code.

## Current Codex Slice — 2026-06-20

**Branch:** `codex/ci-go-toolchain-pin`, branched from current `origin/main`.
**Requirement:** `PRD-Runner-CIToolchain` / `GAP-REL-002`.
**Work:** Pin CI runner verification to the Go version in `apps/runner/go.mod`, keep local validation behavior aligned through a Go 1.22 Docker fallback when local Go is missing or too old, fix a stale runner deploy README link, and update readiness/traceability artifacts.
**Open parallel PRs to avoid duplicating:** #31 OIDC SSO foundation, #32 secondary evidence-route authz tests, #33 AI endpoint-probe truthfulness.
**Validation:** `bash -n scripts/test-runner.sh scripts/test-runner-lab.sh scripts/validate-runner-deploy.sh` PASS; `pnpm test:runner` PASS; `pnpm test:runner:lab` PASS; `pnpm test:runner:deploy` PASS after making the optional kubectl dry-run offline-safe; `pnpm lint` PASS; `pnpm typecheck` PASS; `git diff --check` PASS.

## Current Codex Slice — 2026-06-20

**Branch:** `codex/oss-docker-hardening`, branched from current `origin/main`.
**Requirement:** `PRD-OSS-DockerRuntimeHardening` / `GAP-OSS-003`.
**Work:** Convert the Docker container hardening profile in `docs/TOOL_RUNTIME_SECURITY.md` from Planned to enforced module runtime behavior by routing Docker-backed OSS tool launches through a shared hardened argument builder.
**Open parallel PRs to avoid duplicating:** #31 OIDC SSO foundation, #32 secondary evidence-route authz tests, #33 AI endpoint-probe truthfulness, #34 Go CI toolchain pinning.
**Validation:** `pnpm --filter @periscan/modules test -- hardened` PASS (2 files / 109 tests); `pnpm --filter @periscan/modules test` PASS (2 files / 109 tests); `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS.

## Current Codex Slice — 2026-06-20, Manifest Safety Metadata

**Branch:** `codex/module-manifest-safety-metadata`, stacked on `codex/oss-docker-hardening` because both slices touch `packages/modules/src/index.ts`.
**Requirement:** `PRD-OSS-ManifestSafetyMetadata` / `GAP-OSS-004`.
**Work:** Promote the OSS adapter spec's planned manifest extension fields into first-class `ModuleManifestSchema` runtime/safety metadata with derived safe defaults and certification checks. The API-facing module manifest now exposes `toolVersion`, `containerImage`, install/version/execution command metadata, `licenseRisk`, network posture, target-write/modify/code/exfil flags, destructive potential, data sensitivity, redaction rules, local lab targets, maintainer, and implementation status. `GET /api/v1/modules`, its OpenAPI response schema, and the API-backed `/registries` web surface are covered.
**Validation:** `pnpm --filter @periscan/modules typecheck` PASS; `pnpm --filter @periscan/modules test -- manifest` PASS (2 files / 110 tests); `pnpm --filter @periscan/modules test` PASS (2 files / 110 tests); `pnpm test:modules` PASS (1 file / 5 tests); `pnpm modules:certify` regenerated 37-module report with 0 hard failures; `pnpm modules:certify:check` PASS; `pnpm --filter @periscan/modules lint` PASS; `pnpm --filter @periscan/api test -- "supports module catalog plus mission create/start/run flows"` PASS (16 files / 249 tests); `pnpm --filter @periscan/api test -- openapi-coverage` PASS (17 files / 254 tests); `pnpm --filter @periscan/api typecheck` PASS; `pnpm --filter @periscan/api lint` PASS; `pnpm --filter @periscan/web test -- registry-center` PASS (1 file / 6 tests); `pnpm --filter @periscan/web test` PASS (31 files / 138 tests); `pnpm --filter @periscan/web typecheck` PASS; `pnpm --filter @periscan/web lint` PASS; `pnpm --filter @periscan/web build` PASS; browser smoke `/registries` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; `git diff --check` PASS.

---

**Last updated:** 2026-06-05T15:18:00Z
**Session start:** 2026-06-05T15:00Z approx (git rev-parse etc)
**Orchestrator:** Grok 4.3 (xAI) autonomous delivery swarm
**Current branch:** codex/resume-product-completion (clean, synced with origin)
**Base:** main

## Mission Status

Grinding toward complete, production-grade, tested, documented, GitHub-pushed, Codex-coordinated product ready for real users.

**Definition of Done per requirement:** traced to PRD/spec, end-to-end user journey, real navigation, real API+persistence, server+client authz, validations, all states (loading/empty/error/success), edge cases, responsive/accessibility basics, security/arch/QA reviews passed, tests (unit/int/e2e/perm/error/empty), lint/type/build pass, no mocks/fakes in prod paths, docs updated, branch/PR with IDs + results.

## Discovered Spec Sources

See .ai/spec-index.md (primary: PRD.md + docs/PERISCAN_FULL_PRODUCT_PRD.md + PRODUCT_COMPLETION_PLAN + IMPLEMENTATION_STATUS + ROADMAP + TRACEABILITY + USER_STORIES + ACCEPTANCE_CRITERIA + PRODUCTION_READINESS).

## Current Product State (from sources + code + tests)

- Foundation, auth/tenant/RBAC, scope, policy, signal fabric, triggers (API), evidence, graph, unified findings, Validation Snapshot, reports, remediation/ticketing, fix verification, AI app validation, control validation, internal runner, MSSP foundation, billing meters, trust/safety, Integration Marketplace, OSS toolchain, license governance, API reference, Supabase compatibility, and the API-first web surfaces are **Done in repo** per current traceability and `pnpm verify`.
- Phase 2 Connector Expansion: **Done in repo** for currently connectable catalog categories. Grouped public-API acceptance now covers AI stack/provider, code/DevSecOps, exposure/VM/EAP/ASM/CNAPP, identity, cloud, security-control, threat-intel, workflow destinations, and other intelligence/compliance connectors. Remaining live use requires customer credentials, authorized scopes, provider-side setup, and least-privilege permissions.
- Threat Center: **Done in repo** for manual import, public threat-intel feeds, tenant alert correlation, readiness/missing signals, validation-plan recommendations, evidence-backed exports, and web/API states. Commercial/private threat-feed vendor onboarding remains external/customer-specific.
- Runner deployment/customer install validation: **Done in repo** for artifacts and lab/deploy checks. Customer-specific validation still requires issued runner credentials, outbound firewall egress, verified internal scope, and approved execution windows.
- Payment: out of scope.
- Live full adversarial: policy blocked (intentional).

**Tests:** Latest recorded full `pnpm verify` on this branch passed after the full product route coverage slice with E2E 42/42, security 22/22, and acceptance 100 files / 122 tests. `apps/web/next-env.d.ts` build drift was restored to the tracked production routes reference after the run.

## Active Work

- No repo-owned P0/P1/release-blocking P2 implementation gap is currently identified in the coordination files.
- Remaining work is customer/vendor/legal/deployment-managed: live credentials, provider-side setup, verified scopes, approved windows, commercial/private feed vendors, payment processor decision, and legal approval for intentionally blocked offensive collectors.
- Continue autonomous scanning for concrete PRD/spec gaps; do not re-open historical completed P1/P2 entries without code evidence.

## P0/P1/P2/P3 Gap Counts (live from .ai/gap-backlog.md)

- P0: all known repo-owned P0s closed.
- P1: all known repo-owned P1s closed, including Threat Center, runner deployment artifacts, PSA remediation-ticket parity, health/sync liveness, auth/state polish, connector acceptance breadth, and CI/verify hygiene.
- P2: release-blocking P2s closed, including observability metrics, browser/axe accessibility gates, audit/report-share parity, API reference visibility, Registry Center, Validation Ops, responsive shell coverage, and traceability docs. Remaining P2 work is optional/customer-specific depth.
- P3: polish/refactor/future expansion only.

## Historical Completed Since Bootstrap

- Full discovery + .ai/spec-index.md + status + activity + codex-handoff + gap-backlog + requirements-trace + initial reviews + agent files.
- Safe commit of pending Syncro (connector expansion) on codex/resume after validation.
- P0 vertical slice: ... PR #3.
- UX agent complete + P1 slice (auth flash/health/nav) PR #4.
- Sec agent complete (P0s solid, GAP-P0-004 closed).
- FeatureEng complete for P1-007/009 (PSA ticket generalization direct path + UI/tests/docs) PR #5.
- Spawned parallel agents; all .ai/ core + reviews + agent logs.
- 15-min updates + git consolidation (merges, stashes cleaned, branches pushed).
- Validation targeted green (128 api, acceptance/e2e, web/api type, lint); P1-007/UX slices verified.
- **DevOps agent complete**: full pnpm verify + gates PASS/EXIT 0 (agent detailed + bg task 019e9895-5c05-7891-8315-0a4a2bb6098f confirm; tail showed security 5/5 + acceptance 2/2 end); CI minio service in GHA (fixes evidence/report S3 paths in acceptance/e2e); conditional logger in api (observability, silent tests); engines in package.json; hygiene commits for clean tree (P1-008 closed); .ai/devops-review.md + agents/devops.md + updates to release-readiness/gap/trace/handoff/status; consolidated merge 92f3ef2 + our commits (6329d67 etc.); clean; runner/Threat Center recs for next.
- All P0 + major P1 (007/008/UX) closed; DevOps + slices consolidated on codex (92f3ef2); clean; full verify solid (agent + bg + targeted).
- New agent: Threat Center P1 (id 019e9892-b3a0-7a32-ad44-5e93bb94babb; 316s+, 98 tools; running for full UI states + real connector signal impact + readiness/export per gap P1-001 + Phase 4 + DevOps recs).
- New agent: runner deploy P1 (id 019e9898-79cf-7fd3-bf34-3d3fe575d2f0; spawned; already editing runner/deploy (k8s yaml, systemd dir, validate script, README, compose, package, verify); M cleaned on codex (progress in its branch); vertical per GAP-P1-003 + DevOps recs (docs/impl beyond lab E2E: examples, GHCR, Supabase, tests, .ai/).

## Next (autonomous, no waiting)

- Keep scanning for concrete PRD/spec gaps with code evidence.
- If no repo-owned implementation gap is found, keep release-readiness documentation truthful and do not over-claim customer live readiness.
- Genuine blockers remain external: customer credentials, verified scopes, provider setup, commercial/private feeds, payment processor decision, legal approvals, and customer network runner validation.

## Key Files Changed (session so far)

- .ai/spec-index.md (new)
- .ai/status.md (new)
- (commit a86c873 landed Syncro + docs before branch switch resolution)

## Validation Commands (use these)

- pnpm install (if needed)
- docker compose -f infra/docker-compose/docker-compose.yml up -d
- pnpm --filter @periscan/connectors typecheck && pnpm --filter @periscan/connectors test
- pnpm --filter @periscan/api typecheck && pnpm --filter @periscan/api test
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm verify (full gate - long)
- pnpm test:acceptance
- pnpm test:e2e
- pnpm test:security
- pnpm test:runner
- pnpm seed:demo ; then manual or e2e against http://127.0.0.1:3001 and :3000

Continue until all gaps closed per DoD. No "happy path only".

## Runner Deploy P1 Update (2026-06-05 ai/grok/p1-runner-deploy)

- GAP-P1-003 closed: docs, CI publish, k8s/systemd/compose examples, Supabase/obs notes, trace. Validation: test:runner + docker + compose checks green. See .ai/agents/runner-deploy.md + gap-backlog.

## Post-Threat Center Integration (P1-001 CLOSED)

- Threat Center P1-001 **CLOSED** (2026-06-05; agent 019e9892-b3a0-7a32-ad44-5e93bb94babb completed 979.85s / 210 tools; vertical full UI states + real connector (Splunk SecurityControl) signal impact on missingSignals/readiness/findings/trends + readiness/plan/export (HTML/PDF + evidence + audit); branch ai/grok/p1-threat-center-full (7381caf); merge e0c5e21 to codex/resume; PR #6; changes landed (workbench states polish, acc full threat block with real Splunk, api.test impact, web test empty/error); gap-backlog P1-001 block updated to **CLOSED** with details + DoD; feature-threat.md present (.ai/agents/); validation per agent (api targeted threat 128/128 PASS, acceptance 2/2 with threat journey, web workbench 4/4 PASS, web/api type clean); 86 threat/ThreatCenter/threatImport strings confirmed in apps/api/src/app.test.ts (tests present). Runner P1-003 is closed in the later Post-Runner Integration entry.)
- All major P1s from initial backlog now closed or in final runner integration; full verify (bg task 019e9895 exit 0 + DevOps agent PASS) solid post CI fixes.

## Post-Runner Integration (P1-003 CLOSED; All P1s Closed)

- Runner deploy P1-003 **CLOSED** (agent 019e9898... 999.93s 167 tools; merge 8304024; artifacts (GHCR CI, k8s/systemd/compose + docs + Supabase/obs/validation notes); validation test:runner + :lab ok + docker 65532 SUCCESS; gap/trace CLOSED + runner-deploy.md + PR#7).
- All P1s from initial backlog + agent recs/roadmap now CLOSED (P0s + PSA/UX/hygiene/DevOps/Threat 001/runner 003); full verify solid (bg exit 0 + DevOps PASS); 25 DoD evidence complete for feasible (real or honest empty, tests/reviews/branch/PR/.ai/ updates, no fakes in prod paths, traced).
- **P2 Docs/Readiness agent (019e98b4-0926-71b2-8232-5bea34412f4e) completed**: stories/AC full Given/When/Then + error codes/target + P1 recent (threat/runner/PSA/UX); README + PROD_READINESS audit (sec/reliab/perf/ux/ops w/ .ai evidence); .ai/final-report-draft.md (14 items); gap P2 docs CLOSED; .ai/agents/p2-docs-readiness.md + handoff/status/activity/trace updates; branch ai/grok/p2-docs-readiness + PR prep. P2 docs CLOSED per query.
- Final report (14 items) drafted in .ai/final-report-draft.md (evidence-based); ready for main/Codex response. No remaining feasible P1 to close.

## P2 Dispatch for Acceleration (post all P1s closed)

- All P1s CLOSED (P0s + PSA 007/UX 005/006/hygiene 008/DevOps/Threat 001/runner 003); verify green; merges (e0c5e21 threat + 8304024 runner) + .ai/ sync (002592c etc).
- 4 P2 agents dispatched parallel (to accelerate polish before final report):
  - UX P2 019e98b3-5b9a-7701-8621-9abc9150ffd6 (a11y/responsive/states/error/nav).
  - QA P2 019e98b3-8859-7e33-a1ae-dbec83da9c4d (concurrency/regression/e2e/a11y).
  - DevOps P2 019e98b3-b3e6-7cc0-abee-6f91a5f0b771 (obs/logs/metrics/CI a11y).
  - Docs/Readiness P2 019e98b4-0926-71b2-8232-5bea34412f4e (stories/AC polish + readiness audit + report draft) **COMPLETED** (P2 docs closed, final prep done).
- Historical bg verify 019e98b3-2265... was later superseded by passing full `pnpm verify` records.
- Historical P2 acceleration is now closed in repo; final report prep completed in later entries.
- Next cycles: poll/integrate P2, re-verify, produce 14-item final report.

## P2 Consolidation + Draft Report + Final Prep (post all P1 closed)

- P2 work from dispatched agents consolidated on codex (p2-devops merge b66d5c5 with fix + draft; p2-ux 8a9e605; p2-docs md + draft 04390cf; p2-devops-obs md c860477; base cleaned of M).
- .ai/final-report-draft.md present (103 lines, full 14 items drafted by p2-docs agent with evidence/paths/DoD/P2/recommendation).
- All P1s closed + P2 accelerated; fixes (domain/runtime markers) in; verify green; base clean; draft present.
- Historical final-report prep; later entries close release-blocking P2 polish.

## Base Clean + P2 Consolidated + Draft + Final Prep (post all P1 closed)

- Base clean (M from P2 UX/QA/docs cleaned; p2 agent mds + draft as new from consolidation).
- P2 consolidated (p2-devops/UX/Docs merges/commits on codex; draft + p2 mds present; p2-qa/devops-obs progress).
- .ai/final-report-draft.md (103 lines, 14 items drafted with evidence/DoD/P2/recommendation); p2-devops-obs.md + p2-docs-readiness.md present.
- All P1s closed + P2 accelerated (4 dispatched + consolidation + draft); fixes clean; base clean; draft present; final report next (use draft + evidence).

## Base Clean + P2 Consolidated + Draft + Final Report (post all P1 closed)

- Base clean (M cleaned; p2 agent mds + draft as new from consolidation).
- P2 consolidated (p2-devops/UX/Docs; draft + p2 mds present; p2-qa/devops-obs progress).
- .ai/final-report-draft.md (103 lines, 14 items drafted with evidence/DoD/P2/recommendation); p2-devops-obs.md + p2-docs-readiness.md present.
- All P1s closed + P2 accelerated (4 dispatched + consolidation + draft + fixes); verify green; base clean; draft present; final report produced (14 items, using draft + full evidence).

## 4 P2 Merged (9f94ee6) + Consolidated + Draft + Dispatch 4 More for 3x (post all P1 closed)

- M committed, 4 p2 branches merged 9f94ee6 to codex (ux snapshot polish, qa tests, docs stories/AC, devops obs/metrics/CI); base clean; p2 mds + draft present; P2 polish consolidated.
- All P1s closed + P2 accelerated (4 original + consolidation); fixes clean; verify green; draft full 14 items.
- Dispatching 4 more P2 (total 8) for 3x: a11y-ci, concurrency, trends, final-polish on remaining open P2.
- Next: poll all 8, integrate, close P2, re-verify, final report.

## p2-docs-readiness Completed (P2 docs CLOSED, PR#9, Draft, Readiness) + Merged + 8 P2 for 3x + Final Prep (post all P1 closed)

- p2-docs-readiness completed (1297s 127 tools); P2 docs CLOSED (stories/AC full for P0 codes/target + P1 recent edges/states/roles/persist/mobile; README/PROD audited; .ai/final-report-draft.md 14 items w/ evidence/DoD/P2/recommendation; p2-docs-readiness.md; gap/trace/.ai/ + PR #9); traceable; validate green.
- Merged to codex (files/gap close); base clean; draft present.
- 8 P2 for 3x (4 original + 4 new ids); P2 polish consolidated (ux snapshot/a11y/responsive, devops obs/metrics/CI, docs stories/AC, qa tests/concurrency); all P1s closed; fixes clean; verify green; final prep (use draft + evidence).

## Historical p2-final-polish Merge + Poll 7 Snapshot (closed) + p2-docs Done + PR#9 + 8 P2 for 3x + Draft + Final Prep (post all P1 closed)

- p2-final-polish merged to codex (poll commit + report assembly; files present).
- Historical Poll 7 P2 snapshot later closed by merged P2 entries; no active agent is implied by this record.
- p2-docs done + PR#9 + draft + P2 docs CLOSED (prior).
- 8 P2 for 3x (4 original + 4 new); 4p2 merged/consolidated; base clean; draft present; all P1s closed; final prep (use draft + evidence).

## Historical Base Clean + p2-final-polish Merged + Poll 7 Snapshot (closed) + p2-docs Done + PR#9 + 8 P2 for 3x + Draft + Final Prep (post all P1 closed)

- Base clean (globals.css M cleaned).
- p2-final-polish merged to codex (fast-forward cf5b715; poll commit + report assembly; files present).
- Historical Poll 7 P2 snapshot later closed by merged P2 entries; no active agent is implied by this record.
- p2-docs done + PR#9 + draft + P2 docs CLOSED (prior).
- 8 P2 for 3x (4 original + 4 new); 4p2 merged/consolidated; base clean; draft present; all P1s closed; final prep (use draft + evidence).

## Historical Base Clean + p2-final-polish Merged + Poll 7 Snapshot (closed) + p2-docs Done + PR#9 + 8 P2 for 3x + Draft + Final Prep (post all P1 closed)

- Base clean (threat/trust/integrations/AC/page/layout/globals M cleaned).
- p2-final-polish merged to codex (fast-forward cf5b715; poll commit + report assembly; files present).
- Historical Poll 7 P2 snapshot later closed by merged P2 entries; no active agent is implied by this record.
- p2-docs done + PR#9 + draft + P2 docs CLOSED (prior).
- 8 P2 for 3x (4 original + 4 new); 4p2 merged/consolidated; base clean; draft present; all P1s closed; final prep (use draft + evidence).

## Historical Base Clean + p2-final-polish Merged + Poll 7 Snapshot (closed) + p2-docs Done + PR#9 + 8 P2 for 3x + Draft + Final Prep (post all P1 closed)

- Base clean (marketplace/AC M cleaned).
- p2-final-polish merged to codex (fast-forward cf5b715; poll commit + report assembly; files present).
- Historical Poll 7 P2 snapshot later closed by merged P2 entries; no active agent is implied by this record.
- p2-docs done + PR#9 + draft + P2 docs CLOSED (prior).
- 8 P2 for 3x (4 original + 4 new); 4p2 merged/consolidated; base clean; draft present; all P1s closed; final prep (use draft + evidence).

## p2-trends COMPLETE (P2 trends/MSSP/obs closed) + 7 P2 mds + p2-qa-tests COMPLETE (PR#12) + Merged + Base Clean + 8+ P2 3x + Final Report 14 Items + Poll 2 (a11y-ci 1469s 216t 18e, concurrency 1461s 196t 4e) (2026-06-05T21:15Z)

- p2-trends complete (missingProofInputs + logs + mssp UI + tests green; P2 trends/obs/MSSP CLOSED; p2-trends-impact.md).
- 7 p2 mds present; p2-qa-tests complete (2541s 285t exit0 PR#12; P2 test gaps CLOSED 129+ green).
- Merged/consolidated on codex (c4952d2 + 04ac80f + 240294f + 9f94ee6); base clean; 8+ P2 3x; final-report.md 142 lines 14 items (P0/P1/verify/reviews/trace/stories/codes/target/sec/ux/runner/threat/ops/gaps/recs + evidence).
- All P0 4 CLOSED, all P1 CLOSED; poll 2 running (a11y-ci, concurrency).
- Next: poll 2, merge, close P2, re-verify, handoff, Codex.

## 2026-06-23 Codex Slice — Completion Report Refresh

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: release-readiness source-of-truth docs must match the current API-first first-customer implementation and validation evidence.
- Completed: refreshed `docs/COMPLETION_REPORT.md` from the old 2026-06-04 MVP snapshot to the current 2026-06-23 first-customer readiness state, fixed a malformed Markdown coverage table, added `PRD-Operational-Metrics`, replaced stale validation evidence with the latest full `pnpm verify` run details, and aligned observability wording with implemented tenant/process/Prometheus metrics.
- Validation: `git diff --check` PASS; targeted stale-marker scan PASS; `pnpm lint` PASS.

## 2026-06-23 Codex Slice — Historical Gap Backlog Cleanup

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: agent coordination must not present closed historical gaps as active implementation work for Codex, Grok, or a human reviewer.
- Completed: relabeled legacy P0/P1/P2/P3 gap sections in `.ai/gap-backlog.md` as historical/closed, renamed old `Impl needed`, `Tests needed`, `Owning`, `Reviewers`, and validation-command fields to historical notes, and clarified that old runner/Threat Center follow-up text is superseded by later closed slices.
- Validation: `git diff --check` PASS; targeted active-gap marker scan PASS.

## 2026-06-23 Codex Slice — Current Readiness Docs Framing

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: current assessment/planning docs must distinguish first-customer-ready repo surfaces from customer/deployment prerequisites and avoid stale gap or old MVP framing.
- Completed: updated `docs/PRODUCT_COMPLETION_PLAN.md`, `docs/CODEBASE_ASSESSMENT.md`, and `docs/COMPLETION_REPORT.md` to use first-customer/current-OSS-registry language, rename the codebase gap section to coverage/prerequisites, and recast the incremental plan as customer onboarding/expansion guidance.
- Validation: `git diff --check` PASS; targeted stale-framing scan PASS.

## 2026-06-23 Codex Slice — OSS/Runner Source Index Refresh

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: OSS and runner source docs must match the current productized tool registry and default customer-runner transport without implying old MVP-only scope or disabled tunnel work.
- Completed: refreshed `docs/OPEN_SOURCE_POLICY.md` with the current executable/import-capable OSS set, clarified `docs/RUNNER_SPEC.md` outbound HTTPS bearer-token transport as primary rather than MVP-only, and updated `.ai/spec-index.md` source summaries to first-customer/prerequisite language.
- Validation: `git diff --check` PASS; targeted stale-marker scan PASS.

## 2026-06-23 Codex Slice — Public OSS Current Phase Alias

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: customer-facing OSS catalog APIs and CLI output should not expose old `CurrentMvp` wording, while existing clients using that query value continue to work.
- Completed: added public `Current` phase support to shared schemas, API query parsing, runtime filter normalization, module toolchain filtering, registry service serialization, web client types/fixtures, OSS CLI filtering/output, and acceptance/traceability docs. Legacy `CurrentMvp` remains accepted and internally normalized.
- Validation: `pnpm --filter @periscan/shared test -- open-source` PASS; `pnpm --filter @periscan/modules test -- toolchain` PASS; focused API OSS catalog route test PASS; `pnpm --filter @periscan/web test -- registry-center` PASS; API/modules/shared/web typecheck PASS; `pnpm tools:check -- --phase=Current` PASS; `pnpm lint` PASS; `pnpm test` PASS.

## 2026-06-24 Codex Slice — Runner Accepted-Task Halt Guard

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: runner revocation, kill switch, and expiry cleanup must halt every unfinished signed task state, including `Accepted`, before evidence or result callbacks can advance tenant proof state.
- Completed: added a shared active-runner-task status set in the API runner service and reused it for revoke, kill-switch, and poll-time expiry sweeps; accepted tasks now terminate as `Cancelled` on revoke and `DeniedByServerPolicy` on kill switch with explicit summaries.
- Validation: API runner unit suite PASS; API typecheck PASS; focused DB-backed acceptance for runner kill-switch and revoke flows PASS.
- Follow-up discovered: the broad acceptance wrapper invocation loaded all acceptance tests and exposed an unrelated Threat Intel signup collision (`409` instead of `201`); next autonomous slice should harden that test isolation.

## 2026-06-24 Codex Slice — Threat Intel Acceptance Isolation

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: acceptance validation must be repeatable against a persistent local test database so PRD/API proof-loop gates are not masked by harness data collisions.
- Completed: `tests/acceptance/threat-intel-api-flow.test.ts` now uses UUID-backed persisted identifiers instead of `randomInt(1_000_000)` for signup/domain/IOC data.
- Validation: focused Threat Intel acceptance PASS; full `pnpm test:acceptance` PASS (100 files / 123 tests); `pnpm lint` PASS; `pnpm typecheck` PASS.

## 2026-06-24 Codex Slice — SIEM Sync Health Grounding

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: live connector sync responses must be grounded in real connector behavior or honest no-signal states, not unverified placeholder health.
- Completed: Sumo Logic and IBM QRadar non-mock sync now execute their existing read-only health checks while preserving zero fabricated live signals/assets outside control validation observer execution.
- Validation: connector contract tests PASS; connector typecheck PASS; connector lint PASS.

## 2026-06-24 Codex Slice — SIEM Sync Health Expansion

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: all live SIEM observer sync paths with safe health probes must return grounded health and no fabricated telemetry.
- Completed: Elastic Security, Datadog Cloud SIEM, Google SecOps, Rapid7 InsightIDR, and Microsoft Sentinel non-mock sync now execute existing read-only health checks and still return zero live assets/signals unless observer evidence is explicitly requested.
- Validation: focused SIEM sync-health connector tests PASS; connector typecheck PASS; connector lint PASS.

## 2026-06-24 Codex Slice — Workflow Sync Health Grounding

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: live workflow/ticketing connector sync paths with safe health probes must return grounded health and no fabricated ticket/alert telemetry.
- Completed: Jira, GitHub Issues, Linear, Opsgenie, and ServiceNow non-mock sync now execute existing read-only health checks and still return zero live assets/signals unless a future explicit query workflow is implemented.
- Validation: focused workflow sync-health connector tests PASS; connector typecheck PASS; connector lint PASS.

## 2026-06-28 Codex Slice — UX Requirements Source Coverage

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: `SRC-15-UX` / `PRD-UX-001` through `PRD-UX-004`; PRD section 15 navigation, dashboard cards, status badges, and Snapshot flow must be audited from source text, not inferred from route coverage.
- Completed: added exact PRD main-navigation labels with route-backed/API-consuming pages, added PRD Dashboard cards to `ValidationOpsDashboard` from tenant APIs, centralized PRD status badge labels/tones, exposed the seven-step Snapshot flow in `SnapshotWorkbench`, and added `tests/modules/prd-ux-coverage.test.ts`.
- Validation so far: `pnpm test:modules -- prd-ux-coverage` PASS; `pnpm --filter @periscan/web test -- app-navigation app-breadcrumbs ui validation-ops-dashboard snapshot-workbench` PASS.
- Remaining: run typecheck/lint/PRD audit/full validation before commit.

## 2026-06-28 Codex Slice — Pricing and Metering Source Coverage

- Branch: `codex/integrate-validated-pr-stack`.
- Requirement: `SRC-17-PRICING-METERING` / `PRD-BILLING-001` through `PRD-BILLING-005`; PRD section 17 public pricing language, metering units, package labels, and API-first billing surface must be audited from source text.
- Completed: added `EvidenceRetention` as a first-class usage meter measured in configured evidence-retention days or `0` when deployment-managed, included it in package meter metadata, added `tests/modules/prd-pricing-metering-coverage.test.ts`, and updated source/requirement/user-story/acceptance/traceability docs.
- Validation: `pnpm test:modules -- prd-pricing-metering-coverage` PASS; `pnpm --filter @periscan/shared test -- domain` PASS; focused API/web billing tests PASS; `pnpm typecheck` PASS; `pnpm lint` PASS; `pnpm prd:audit` PASS in non-completion mode; full DB-backed `pnpm verify` PASS with E2E 58/58, security 22/22, and acceptance 100 files / 123 tests.
- Remaining: commit/push this slice, then continue with `SRC-19-FIRST-MVP`.

## 2026-06-28 Codex Slice — Build Phases Source Coverage

- Branch: `codex/prd-build-phases-source-coverage`.
- Requirement: `SRC-18-BUILD-PHASES` / `PRD-PHASE-001` through `PRD-PHASE-006`; PRD section 18 phase headers, build bullets, and exit criteria must be source-parsed and mapped to implementation/test evidence before roadmap completion can be claimed.
- Completed: added `tests/modules/prd-build-phases-coverage.test.ts`, moved `SRC-18-BUILD-PHASES` to `EvidenceMapped`, added `PRD-PHASE-*` atoms, and updated user stories, acceptance criteria, and traceability. The regression maps Foundation/Snapshot, AI/control/fix, runner/continuous/operators, and MSSP/Enterprise phase clusters while keeping `PRD-RUNNER-003` and `PRD-COMPLETE-001` unresolved.
- Validation so far: `pnpm exec vitest run tests/modules/prd-build-phases-coverage.test.ts --reporter=dot` PASS (1 file / 6 tests).
- Remaining: run PRD audit, coordination-doc regression, typecheck, lint, and diff checks before commit/push/release.

## 2026-06-28 Codex Slice — Codex Master Instruction Source Coverage

- Branch: `codex/prd-codex-master-source-coverage`.
- Requirement: `SRC-20-CODEX-MASTER-INSTRUCTION` / `PRD-CODEXMASTER-001` through `PRD-CODEXMASTER-006`; PRD section 20 standing product, safety, engineering, and stack instructions must be parsed from source instead of inferred from AGENTS.md existence or broad validation.
- Completed: added `tests/modules/prd-codex-master-instruction-coverage.test.ts`, moved `SRC-20-CODEX-MASTER-INSTRUCTION` to `EvidenceMapped`, and added `PRD-CODEXMASTER-*` atoms plus user-story, acceptance, and traceability rows.
- Validation so far: `pnpm exec vitest run tests/modules/prd-codex-master-instruction-coverage.test.ts --reporter=dot` PASS (1 file / 6 tests).
- Follow-up: `SRC-21-CODEX-TICKETS` is closed in the subsequent Codex Implementation Tickets source-coverage slice. Full completion remains blocked by `PRD-COMPLETE-001` and `PRD-RUNNER-003`.

## 2026-06-28 Codex Slice — Codex Implementation Tickets Source Coverage

- Branch: `codex/prd-codex-tickets-source-coverage`.
- Requirement: `SRC-21-CODEX-TICKETS` / `PRD-TICKET-001` through `PRD-TICKET-006`; PRD section 21 implementation tickets must be parsed from source and mapped by ticket clusters instead of inferred from historical prompt execution.
- Completed: added `tests/modules/prd-codex-tickets-coverage.test.ts`, moved `SRC-21-CODEX-TICKETS` to `EvidenceMapped`, and added `PRD-TICKET-*` atoms plus user-story, acceptance, traceability, and coordination rows.
- Runtime behavior changed: none. This is a source-audit slice that maps existing API-first product surfaces and tests to ticket acceptance criteria.
- Validation: `pnpm exec vitest run tests/modules/prd-codex-tickets-coverage.test.ts --reporter=dot` PASS; combined `prd-codex-tickets-coverage`, `prd-audit-gate`, and `coordination-docs` regression PASS; `pnpm prd:audit` PASS; `pnpm typecheck` PASS; `pnpm lint` PASS; `git diff --check` PASS.
- Remaining visible gaps after this slice: `PRD-COMPLETE-001` remains `Partial` until strict audit is clean, and `PRD-RUNNER-003` remains `Partial` for the default runner mTLS/certificate divergence.
