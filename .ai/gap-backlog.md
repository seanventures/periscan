# Periscan .ai Gap Backlog

## 2026-09-17 — current BAS / AEV implementation direction

Full BAS/AEV development is authorized by the owner. The current handoff is
[`docs/BAS_AEV_AGENT_HANDOFF.md`](../docs/BAS_AEV_AGENT_HANDOFF.md), with the
feature matrix and Plane PERISCAN-583–592. Continue implementation in disposable
local labs; production execution eligibility is earned per adapter/scenario.
Current runtime denials and dated release notes are not development restrictions.

## 2026-06-28 Full PRD Completion Gate Closure

- `GAP-COMPLETE-SELF-REFERENTIAL-GATE-001`: **Closed in this slice.** The
  source ledger had zero unresolved rows and the requirement ledger had only the
  self-referential `PRD-COMPLETE-001` row left as `Partial`, but the audit gate
  could not ever pass strict mode because it required the completion report to
  state it was not a full-PRD completion claim. The gate now distinguishes
  `FirstCustomerReadiness` from `FullProductCompletion`; strict mode requires
  the latter plus clean source and requirement ledgers.

## 2026-06-28 Product Meta Source Coverage

- `GAP-META-SOURCE-COVERAGE-001`: **Closed in this slice.** The PRD preamble
  was previously `SectionIndexed` and could be inferred from README/package
  existence instead of direct source parsing. `tests/modules/prd-meta-coverage.test.ts`
  now parses Product Name, Product Category, Core Product Promise,
  One-Sentence Product Definition, and Founder / Market Context, maps product
  identity to root docs/package/app metadata, and verifies founder/Frost market
  strategy stays out of public product surfaces.
- `GAP-META-PROOF-DEFINITION-COPY-001`: **Closed in this slice.** Web metadata
  listed validation domains but omitted the proof-output clause from the source
  one-sentence definition. `apps/web/app/layout.tsx`, `README.md`, and `PRD.md`
  now carry the complete validation-plus-proof definition.

## 2026-06-28 Product Vision Source Coverage

- `GAP-VISION-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 1
  coverage was previously `SectionIndexed` and could be inferred from tagline,
  Product Principles, MVP, report, or final proof-loop coverage rather than
  mechanically tied to every Product Vision source claim.
  `tests/modules/prd-vision-coverage.test.ts` now parses section 1 and maps the
  validation/proof-layer claim, six customer questions, continuous-validation
  domains, evidence-backed BAS/AEV positioning, and third-party-tool
  certification gate to concrete API, service, report, UX, and governance
  evidence.

## 2026-06-28 System Architecture Source Coverage

- `GAP-ARCHITECTURE-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section
  4 coverage was previously `SectionIndexed` and could be inferred from broad
  monorepo/runtime-service breadth rather than mechanically tied to every
  architecture component and responsibility list. `tests/modules/prd-architecture-coverage.test.ts`
  now parses section 4 and maps SaaS Control Plane, API Connectors, External
  Point of Attack, Internal Runner, and Evidence Graph bullets to concrete
  API, service, persistence, connector, module, runner, and graph/report
  evidence.

## 2026-06-28 Recommended Tech Stack Source Coverage

- `GAP-TECH-STACK-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 5
  coverage was previously inferred from broad package layout and stack notes
  rather than mechanically tied to every source bullet.
  `tests/modules/prd-tech-stack-coverage.test.ts` now parses section 5 and maps
  monorepo, frontend, backend, worker, runner, evidence store, graph, and Codex
  build-model bullets to concrete source evidence.
- `GAP-TECH-STACK-RISK-PACKAGE-001`: **Closed in this slice.** The PRD listed
  `packages/risk`, but the repo only exposed risk scoring through
  `packages/evidence`. `@periscan/risk` now provides a public package boundary
  over the canonical evidence risk engine without duplicating scoring formulas.
- `GAP-TECH-STACK-TANSTACK-QUERY-001`: **Closed in this slice.** The PRD listed
  React Query/TanStack Query, but the App Router root did not provide a query
  client. `PeriscanQueryProvider` now wires TanStack Query for current and future
  API-driven UI consumers.

## 2026-06-28 Real-First Addendum Source Coverage

- `GAP-REAL-FIRST-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section
  25 coverage was previously inferred from many historical hardening entries
  rather than mechanically tied to the source addendum. `tests/modules/prd-real-first-coverage.test.ts`
  now parses the section and maps the repo-preservation, real data-source,
  fixture/demo isolation, honest unavailable-state, no-fake-outcome, and
  platform-priority requirements to concrete code/test evidence.

## 2026-06-28 V1 Definition of Done Source Coverage

- `GAP-DOD-V1-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 23
  coverage was previously inferred from a completion report and broad MVP/E2E
  rows rather than mechanically tied to the V1 Definition of Done bullets.
  `tests/modules/prd-dod-v1-coverage.test.ts` now parses every bullet and maps
  it to API acceptance, E2E, report, policy/audit, redaction, and
  design-partner/demo evidence.
- `GAP-DOD-V1-REPORT-VERIFICATION-EVIDENCE-001`: **Closed in this slice.**
  Verification evidence was persisted and text/PDF reports included latest
  verification, but default Snapshot HTML remediation cards did not render the
  latest verification outcome. Default HTML reports now render `Last
verification` with outcome and measured/not-measured basis, and API
  acceptance asserts exported reports include the generated verification
  outcome.

## 2026-06-28 Final Build Rule Source Coverage

- `GAP-FINAL-BUILD-RULE-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD
  section 24 coverage was previously inferred from broad Snapshot, MVP,
  remediation, E2E, and report existence rather than mechanically tied to the
  ordered source loop. `tests/modules/prd-final-build-rule-coverage.test.ts`
  now parses section 24 and maps `connect -> validate -> evidence -> fix ->
verify -> report` to public API routes and first-customer acceptance/E2E
  coverage.
- `GAP-FINAL-BUILD-RULE-BROAD-COMPLETION-001`: **Closed in this slice.** The
  source row could be described as covered by product flows without proving
  ordered stage coverage. `PRD-FINAL-001` through `PRD-FINAL-004` now keep
  stage parsing, API route mapping, acceptance/E2E order, and completion
  discipline separate from the still-partial full-product completion claim.

## 2026-06-28 First Demo Story Source Coverage

- `GAP-DEMO-STORY-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section
  22 coverage was previously inferred from demo data, Snapshot reports,
  remediation APIs, and proof-loop E2E existence rather than mechanically tied
  to the nine source story steps. `tests/modules/prd-demo-story-coverage.test.ts`
  now parses section 22 and maps every step to public demo copy, normalized
  Snapshot data, and API/E2E proof-loop evidence.
- `GAP-DEMO-STORY-PUBLIC-COPY-001`: **Closed in this slice.** The public demo
  story listed six broad bullets and omitted explicit remediation creation,
  retest, fixed/still-exposed verdict, and evidence generation. The public demo
  now renders all nine source story beats.
- `GAP-DEMO-STORY-INCONCLUSIVE-VERIFICATION-001`: **Closed in this slice.**
  The first-customer E2E did not assert the terminal verification outcome and
  the repo-secret path could fall back to `Inconclusive`. The E2E now selects
  the named repository-secret path, acceptance/E2E assert `Fixed` or
  `StillExposed`, and fixture-safe Gitleaks/Prowler retests now re-correlate
  the repo-secret path to produce an honest `StillExposed` outcome when the
  fixture remains exposed.

## 2026-06-28 First Sellable MVP Source Coverage

- `GAP-FIRST-MVP-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section
  19 coverage was previously inferred from Snapshot, report, demo, and E2E
  existence rather than mechanically tied to the source MVP flow, report, and
  success-signal lists. `tests/modules/prd-first-mvp-coverage.test.ts` now
  parses section 19 and maps every source item to code/test evidence.
- `GAP-FIRST-MVP-AI-REGISTRY-ENTITLEMENT-001`: **Closed in this slice.** The
  default first-sellable `ValidationSnapshot` package denied `AI app registry`
  even though section 19 includes optional AI app registration in the MVP flow.
  The package now includes `AI app registry` and the `AIApplications` meter;
  acceptance/E2E MVP flows register an optional AI app before Snapshot.
- `GAP-FIRST-MVP-DEMO-TOP-PATH-COUNT-001`: **Closed in this slice.** The public
  demo Snapshot showed two top paths, while section 19 requires top 3-5
  validated paths. The deterministic demo Snapshot now contains three
  evidence-backed paths, each with path breakers, remediation, verification
  guidance, and report evidence IDs.

## 2026-06-28 Product Modules Parent Source Coverage

- `GAP-PRODUCT-MODULES-PARENT-COVERAGE-001`: **Closed in this slice.** PRD
  section 3 parent coverage was previously `SectionIndexed` and relied on broad
  implementation-status prose even though all child modules had individual
  source rows. `tests/modules/prd-product-modules-coverage.test.ts` now parses
  the parent section headings and verifies every child module subsection maps
  to an `EvidenceMapped` child row and source-derived test evidence.

## 2026-06-28 Reports Source Coverage

- `GAP-REPORTS-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 16
  coverage was previously inferred from Evidence Pack templates, Snapshot
  export routes, and report-generator tests rather than mechanically tied to
  the source report-section and audience-variant lists.
  `tests/modules/prd-reports-coverage.test.ts` now parses section 16 and maps
  every report section and audience variant to rendered HTML/PDF output.
- `GAP-REPORTS-SECTION-LABEL-DRIFT-001`: **Closed in this slice.** Rendered
  reports used implementation labels `Control Observations` and `AI App Risks`
  while PRD section 16 requires `Control Verdicts` and `AI App Validation`.
  Customer-facing HTML/PDF headings now use the PRD labels while preserving
  internal schema names.
- `GAP-REPORTS-EXECUTIVE-SUMMARY-SECTION-001`: **Closed in this slice.** HTML
  reports used the hero area as a summary but did not render an explicit
  `Executive Summary` section. The report generator now renders the section
  required by section 16.

## 2026-06-28 Periscan Operators Source Coverage

- `GAP-OPERATORS-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section
  3.8 coverage was previously inferred from operator APIs, model-gateway tools,
  evidence-grounded summaries, signal-trigger approvals, and registry UI
  history rather than mechanically tied to the source operator and requirement
  lists. `tests/modules/prd-operators-coverage.test.ts` now parses section 3.8
  and maps every operator, recommendation, approval, evidence-ID, uncertainty,
  no-invention, and safety-level requirement to implementation evidence.
- `GAP-OPERATORS-PROOFLESS-RECOMMENDATIONS-001`: **Closed in this slice.**
  Operator recommendations could be emitted with empty `evidenceIds` from
  tenant configuration counts alone. `OperatorRecommendationSchema` now
  requires at least one evidence ID, proofless branches are suppressed, and
  all generated operator mission plans are approval-gated.
- `GAP-OPERATORS-BLUE-TEAM-DESCRIPTIVE-GAP-001`: **Closed in this slice.** The
  Blue Team Operator recognized exact `Missed`, `NoEvidence`, and
  `NeedsTuning` subcategories but missed descriptive normalized control gaps
  such as `Missed credential-use detection`. The classifier now recognizes
  descriptive missed/no-evidence/tuning labels while still requiring evidence
  IDs.

## 2026-06-28 Evidence Packs Source Coverage

- `GAP-EVIDENCE-PACKS-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD
  section 3.7 coverage was previously inferred from report templates,
  Snapshot exports, MSSP branding paths, and broad traceability rows rather
  than mechanically tied to the source pack-type and requirement lists.
  `tests/modules/prd-evidence-packs-coverage.test.ts` now parses section 3.7
  and maps every pack type, normalized evidence rule, evidence-ID rule,
  redaction rule, audience variant, HTML/PDF export path, and MSSP white-label
  requirement to implementation evidence.
- `GAP-EVIDENCE-PACKS-AI-SECURITY-LABEL-001`: **Closed in this slice.** The
  stable API enum `AIAppValidationReport` rendered with the customer-facing
  label `Periscan AI App Validation Report`, while PRD section 3.7 requires
  `AI Security Validation Report`. The enum remains unchanged for API/database
  compatibility, and the rendered label now uses `Periscan AI Security
Validation Report`.

## 2026-06-28 Fix Verification Source Coverage

- `GAP-FIX-VERIFICATION-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 3.6 coverage was previously inferred from remediation APIs, workflow-ticket routing, verification-event schemas, no-fix-without-proof tests, and report history rather than mechanically tied to the source outcome and requirement lists. `tests/modules/prd-fix-verification-coverage.test.ts` now parses section 3.6 and maps every outcome, remediation linkage, ticket-status, closed-without-verification, targeted-retest, verification-event, attack-path/risk-update, and evidence-pack/report requirement to implementation evidence.
- `GAP-FIX-VERIFICATION-CLOSED-WITHOUT-EVIDENCE-001`: **Closed in this slice.** External ticket-close sync previously moved open Jira remediations to `VerificationPending`, which hid the distinct PRD condition "closed without verification." Verification-required externally closed remediations now become `ClosedWithoutEvidence`, write `remediation.closed_without_evidence`, and can still later move to `VerificationPending` for actual policy-gated verification.

## 2026-06-28 AI App Security Validation Source Coverage

- `GAP-AI-APP-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 3.5 coverage was previously inferred from AI app registry/routes, AI provider connectors, safe module fixtures, and report history rather than mechanically tied to the source coverage/outcome/requirement lists. `tests/modules/prd-ai-app-validation-coverage.test.ts` now parses section 3.5 and maps every category, outcome, route/scope/test-account, safety, redaction, evidence-pack, baseline/drift, and Promptfoo/PyRIT/similar harness requirement to implementation evidence.
- `GAP-AI-APP-CATEGORY-COVERAGE-001`: **Closed in this slice.** The source categories `agent over-permissioning`, `system prompt exposure`, `cross-tenant retrieval`, and `AI security review evidence` were not first-class suite categories. `packages/shared/src/validation-catalog.ts` and `packages/modules/src/index.ts` now include typed categories and technique mappings for those cases.
- `GAP-AI-APP-TEST-ACCOUNT-NOTES-001`: **Closed in this slice.** AI app registration did not persist support for customer-approved test account handling notes. Prisma, shared schemas, API input, serializer output, and API tests now include optional `testAccountNotes`.
- `GAP-AI-APP-HARNESS-ROUTE-DRIFT-001`: **Closed in this slice.** `ai_app.safe_validation` supported Garak, but `/api/v1/ai-apps/:id/validate` allowed only Promptfoo/PyRIT. The route schema now accepts `garak`.
- `GAP-AI-APP-BASELINE-DRIFT-EVIDENCE-001`: **Closed in this slice.** AI app validation had history and a GuardrailDrift suite but no reusable comparison classifier/evidence. `classifyAiValidationDrift` and `validateAIApplication` now record redacted baseline comparison evidence with `NoBaseline`, `Stable`, `Improved`, or `Regressed`.

## 2026-06-28 Attack-Path Validation Source Coverage

- `GAP-ATTACK-PATH-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 3.4 coverage was previously inferred from evidence graph, attack-path API, risk, remediation, report, and UI history rather than mechanically tied to the source example path list, concept list, and requirements. `tests/modules/prd-attack-path-coverage.test.ts` now parses section 3.4 and maps every example class, core concept, edge-evidence/control-response/ATT&CK/before-after requirement, and BloodHound CE note to implementation evidence.
- `GAP-ATTACK-PATH-MISSED-CONTROL-CORRELATION-001`: **Closed in this slice.** The source PRD example `missed control -> undetected activity -> real exposure` did not have a reusable correlation pattern. `packages/evidence/src/correlation.ts` now creates `missed-control-real-exposure` paths from normalized missed/no-evidence `ControlObservation` signals plus real `Exposure` signals, with `MISSED_BY` and `LEADS_TO` edges, evidence IDs, and a revalidation-oriented path breaker.
- `GAP-ATTACK-PATH-ATTACK-MAPPING-001`: **Closed in this slice.** Snapshot report top attack-path cards previously did not show ATT&CK mappings even when linked control/AI evidence carried technique IDs. `packages/reports/src/index.ts` now derives path-level ATT&CK tags from overlapping evidence IDs or related path IDs and renders them in HTML and text/PDF exports.
- `GAP-ATTACK-PATH-CONTROL-RESPONSE-RISK-001`: **Closed in this slice.** Risk assessment previously inferred control response only from path/node text. `packages/evidence/src/risk.ts` now treats `BLOCKED_BY`, `DETECTED_BY`, and `MISSED_BY` path edge relationships as structured control-response evidence before text fallback.

## 2026-06-28 Control Validation Source Coverage

- `GAP-CONTROL-VALIDATION-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 3.3 coverage was previously inferred from control-source APIs, observer connectors, and safe Atomic dry-run history rather than mechanically tied to the source control list, outcome list, and trend/tuning/evidence requirements. `tests/modules/prd-control-validation-coverage.test.ts` now parses section 3.3 and maps control categories, outcomes, detect/block/log/alert/route behavior, MITRE ATT&CK scenario mapping, tuning recommendations, evidence IDs, and repeatable before/after coverage summaries to implementation evidence.

## 2026-06-28 Continuous Exposure Source Coverage

- `GAP-CONTINUOUS-EXPOSURE-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 3.2 coverage was previously inferred from scheduler, CTEM, and reopened-risk traceability history rather than mechanically tied to the source coverage, state, and requirement lists. `tests/modules/prd-continuous-exposure-coverage.test.ts` now parses section 3.2 and maps coverage areas, validation states, schedules, drift/reopened detection, validated-risk separation, and CTEM stages to implementation evidence.

## 2026-06-28 Product Principles Source Coverage

- `GAP-PRODUCT-PRINCIPLES-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 2 Product Principles coverage was previously inferred from broad safety/report/UI evidence rather than mechanically tied to the source bullets. `tests/modules/prd-product-principles-coverage.test.ts` now parses section 2 and maps proof-over-findings, AI workflow grounding, safety-as-product, and the expansion path to implementation evidence.
- `GAP-PROOF-OVER-FINDINGS-PRIMARY-UX-001`: **Closed in this slice.** The stable `/api/v1/findings` API is valid, but the first-party primary navigation and page copy still labeled the user-facing proof queue as `Findings`, which looked like the raw scanner-dashboard experience PRD section 2.1 rejects. The route and API remain unchanged; navigation and page/workbench copy now present the surface as `Validated Results` and evidence-backed results.

## 2026-06-28 Validation Snapshot Source Coverage

- `GAP-VALIDATION-SNAPSHOT-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 3.1 coverage was previously inferred from Snapshot API/report/E2E existence rather than mechanically tied to the source input, output, and requirement lists. `tests/modules/prd-validation-snapshot-coverage.test.ts` now parses section 3.1 and maps inputs, outputs, runner-optional onboarding, result limits, evidence/remediation/verification coverage, and HTML/PDF export to implementation evidence.
- `GAP-VALIDATION-SNAPSHOT-RESULT-CAP-001`: **Closed in this slice.** Snapshot generation previously allowed up to 10 displayed top paths, which violated the PRD requirement for 3-5 high-value results. `apps/api/src/services/snapshots.ts` and `apps/api/src/runtime-services.ts` now cap generated displayed top paths at 5 while retaining API DTO compatibility for existing callers.
- `GAP-VALIDATION-SNAPSHOT-REMEDIATION-COVERAGE-001`: **Closed in this slice.** Snapshot remediation generation previously ran only for Critical/High displayed paths. `buildValidationSnapshotPayload` now creates remediation for every displayed top path, matching the PRD requirement that every result include evidence and remediation.

## 2026-06-28 Runner Source Coverage

- `GAP-RUNNER-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 14 coverage was previously inferable from runner binary, deployment artifacts, and local-lab tests, but not mechanically tied to the source deployment/security/flow lists. `tests/modules/prd-runner-coverage.test.ts` now parses section 14 and maps Docker/Linux/Kubernetes/Windows deployment modes, outbound HTTPS/no reverse SSH/no inbound transport, signed task envelopes, local scope enforcement, timeouts/resource ceilings, local audit/evidence upload, kill switch behavior, and API flow to implementation and tests.
- `GAP-RUNNER-MTLS-PRD-DIVERGENCE-001`: **Closed in this slice.** The long-form PRD says mTLS and runner certificate issuance, and the current authoritative runner spec/implementation now matches it: registration and credential rotation accept runner CSRs, issue tenant-scoped client certificates, return tenant CA/client certificate material, persist runner certificate SHA-256 fingerprints, keep bearer-token defense in depth, and preserve outbound signed-task polling. Production TLS termination must forward the verified client-certificate fingerprint to the API when `PERISCAN_RUNNER_REQUIRE_MTLS=true`.

## 2026-06-28 Executable PRD Audit Gate

- `GAP-PRD-AUDIT-EXECUTABLE-GATE-001`: **Closed in this slice.** The prior source-first audit protocol explained why full-product completion had been overclaimed, but it still depended on humans noticing unresolved source-ledger rows while reading status reports. `scripts/prd-audit-gate.ts` now parses `docs/PRD_SOURCE_COVERAGE_LEDGER.md` and `docs/PRD_REQUIREMENT_LEDGER.md`, reports unresolved source sections and requirement atoms, and computes full-completion eligibility. `pnpm prd:audit` runs inside `pnpm verify` and fails if audit artifacts or completion-report mode regress. `pnpm prd:audit:strict` passes only when the report is in full-product completion mode, every source section is evidence-mapped or explicitly blocked, and no requirement atoms remain `Partial`, `NotStarted`, or `Unknown`.

## 2026-06-28 Risk Scoring Source Coverage

- `GAP-RISK-SCORING-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 13 coverage was previously inferred from risk engine existence and score-factor rendering. `tests/modules/prd-risk-scoring-coverage.test.ts` now parses the section 13 input, formula, and modifier lists and verifies `RiskScoreInputSchema`, formula-level risk factors, directional modifiers, and the no-fix-without-verification rule. The audit found and fixed a real drift: `Reopened` scored lower than stable `Validated`.

## 2026-06-28 Evidence Graph Source Coverage

- `GAP-EVIDENCE-GRAPH-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 12 Evidence Graph coverage was previously inferred from graph table/service existence. `tests/modules/prd-evidence-graph-coverage.test.ts` now parses section 12 node, edge, and required-question lists and verifies graph node contracts, Prisma graph tables, edge relationship enums, and evidence-linked graph service behavior for reachability, identity access, secret-to-cloud-role paths, control misses, highest-impact paths, path breakers, closed-without-proof state, and reopened state.

## 2026-06-28 PRD Audit Accumulated-State Validation

- `GAP-PRD-AUDIT-ACCUMULATED-STATE-001`: **Closed in this slice.** Focused source-derived tests were not enough to prove release readiness when a workflow shares accumulated database state. Full `pnpm verify` found continuous-validation sweep acceptance timeouts even though the three affected tests passed in isolation; the shared test database contained hundreds of unrelated due tenants. `docs/PRD_AUDIT_PROTOCOL.md` now requires release-level validation for shared runtime, scheduler, persistence, security, and public API changes. `runSystemValidationSweep` now accepts an explicit `tenantIds` scope for deterministic internal/test calls while preserving the production default of sweeping all due tenants, and the sweep acceptance tests now scope direct scheduler invocations to tenants created by the test.

## 2026-06-28 Policy and Safety Engine Source Coverage

- `GAP-POLICY-SAFETY-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 11 coverage was previously inferred from package tests and security-boundary tests. `tests/modules/prd-policy-safety-coverage.test.ts` now parses the section 11 input, output, rule, and audit lists and verifies policy schemas, deterministic evaluator outcomes, tenant-policy/target inputs, requested-action safety flags, and persisted `policy.decision` audit evidence. The audit found and fixed missing central evaluator inputs for `tenantPolicy` and `target`.

## 2026-06-28 OSS Acceleration Plan Source Coverage

- `GAP-OSS-PLAN-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 10 coverage was previously inferred from third-party tool governance history, toolchain breadth, and module certification totals. `tests/modules/prd-oss-plan-coverage.test.ts` now parses the PRD section 10.1 engine list and 10.2 OSS policy bullets, verifies each named engine against reviewed toolchain/capability/module metadata, and maps every OSS policy bullet to license, safety, parser, normalized evidence, and report no-raw-output checks.

## 2026-06-28 Module Registry Source Coverage

- `GAP-MODULE-REGISTRY-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 9 manifest fields and safety levels were previously inferred from module tests and registry breadth. `tests/modules/prd-module-registry-coverage.test.ts` now parses the PRD section 9 manifest field and safety-level lists and verifies `ModuleManifestSchema`, all registered module manifests, and `SafetyLevelSchema`.

## 2026-06-28 Signal Fabric Source Coverage

- `GAP-SIGNAL-FABRIC-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 8 integration category, MVP integration, and V1 integration coverage was previously inferred from broad connector-catalog breadth. `tests/modules/prd-signal-fabric-coverage.test.ts` now parses the PRD section 8 lists and verifies each item is represented by connector catalog entries or explicit platform surfaces such as verified Domain/Subdomain scopes, `nuclei.external_exposure_safe`, and `AIApplicationEndpoint` registration.

## 2026-06-28 Data Model Source Coverage

- `GAP-DATA-MODEL-SOURCE-COVERAGE-001`: **Closed in this slice.** PRD section 6 core entity and field coverage was previously inferred from broad shared-schema/Prisma existence, but no test compared the PRD field list to implementation. `tests/modules/prd-data-model-coverage.test.ts` now parses the PRD section 6 entity/field/scope-type lists and verifies shared Zod schemas plus Prisma models/enums. The audit found no missing durable fields and records explicit AI app field aliases so naming decisions cannot hide missing data requirements.

## 2026-06-28 API Specification Route Coverage

- `GAP-API-SPEC-ROUTE-COVERAGE-001`: **Closed in this slice.** PRD section 7 listed API routes that were not mechanically compared to generated OpenAPI, so broad API-first traceability could hide missing endpoint verbs. The source-first route audit found missing `POST /api/v1/missions/:id/cancel` and `POST /api/v1/attack-paths/:id/verify`. Both are now implemented, OpenAPI-documented, and covered by behavior tests. The PRD section 7 route inventory is now extracted from `docs/PERISCAN_FULL_PRODUCT_PRD.md` during API tests and compared to generated OpenAPI so future route drift fails validation.

## 2026-06-28 Frontier Gateway Scope-Bound Context

- `GAP-FRONTIER-GATEWAY-SCOPED-CONTEXT-001`: **Closed in this slice.** The long-form PRD says Frontier Gateway context is built from session scopes and typed tools are limited to in-scope data. Audit found `buildModelContextBundle` and read-only tool execution accepted scope IDs but read tenant-wide assets/exposures/paths. `packages/model-gateway/src/engine/scope-filter.ts` now resolves verified scopes, matches scoped assets from normalized identifiers/name/tags, and filters exposures/attack paths through scoped assets. Context bundles and read-only tools now exclude out-of-scope tenant data by default, with tests proving no out-of-scope asset, exposure, or path reaches model-visible output.

## 2026-06-28 PRD Source Coverage Ledger

- `GAP-PRD-SOURCE-COVERAGE-LEDGER-001`: **Closed in this slice.** The previous PRD audit protocol and atomic ledger prevented one class of false completion claim, but the ledger was still a seed focused on the latest third-party-tool miss rather than a complete long-form PRD section index. `docs/PRD_SOURCE_COVERAGE_LEDGER.md` now indexes every major source PRD section, including Frontier Gateway, separates source coverage from implementation completion, and explicitly blocks full-product completion claims while sections remain `SectionIndexed` or `NeedsImplementationAudit`. The coordination-doc regression now requires this file and the major PRD section IDs.

## 2026-06-28 Third-Party Tool Coverage Audit

- `GAP-THIRD-PARTY-TOOL-COVERAGE-AUDIT-001`: **Closed in this slice.** The PRD required every planned OSS/security tool to be executable, safely content/import-only, deferred, or blocked, but audits could still infer completion from broad governance rows without a per-tool classification gate. `/api/v1/third-party-tools/coverage-audit` now compares governed tool catalog entries to module manifests and capability metadata, reports `NeedsImplementation` gaps, and explicitly marks that it does not enable, install, execute, queue missions, or dispatch runner tasks. Focused shared/API/web validation passed.

## 2026-06-28 PRD Audit Protocol

- `GAP-PRD-AUDIT-SOURCE-FIRST-001`: **Closed in this slice.** A PRD feature remained incomplete after multiple "complete" audits because the audit process relied on broad traceability labels, newest-first status docs, and green validation runs instead of source-first requirement atomization. `docs/PRD_AUDIT_PROTOCOL.md` now documents the failure mode, source-first audit workflow, completion standard, and completion-claim policy. `docs/PRD_REQUIREMENT_LEDGER.md` now separates third-party tool governance into atomic requirements, including certification history, and keeps broader future OSS tool coverage visible as `Partial` where appropriate. README, PRD, long-form PRD, user stories, acceptance criteria, public traceability, implementation status, and coordination docs now reference the protocol. `pnpm test:modules -- coordination-docs` PASS (5 files / 18 tests).

## 2026-06-28 Third-Party Tool Promotion Certification History

- `GAP-THIRD-PARTY-TOOL-PROMOTION-CERTIFICATION-HISTORY-001`: **Closed in this slice.** Promotion certification reports existed as current-state computed responses, but admins and API customers still needed a durable, auditable history of when a promoted tool package was certified. `POST /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications` now persists the normalized certification snapshot, writes `third_party_tool.promotion_certified`, and surfaces the snapshot in tool activity as `PromotionCertification`. `GET .../certifications` lists saved snapshots. Registry Center consumes the same APIs through `Save certification snapshot` and `Load certification history`. The workflow remains non-executing: it does not enable tools, install runtimes, queue missions, dispatch runner tasks, or execute modules. Focused checks and full `pnpm verify` passed for this slice.

## 2026-06-28 Third-Party Tool Promotion Certification

- `GAP-THIRD-PARTY-TOOL-PROMOTION-CERTIFICATION-001`: **Closed in this slice.** Promotion packages and governance handoff existed, but admins and API customers still needed a single certification report that proves current catalog, module/capability, evidence, governance, runtime, runner, policy, and safety prerequisites before use. `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certification-report` now returns tenant-scoped certification checks, certified-for-governance/runtime/mission/runner flags, required actions, and explicit no-side-effect markers. Registry Center consumes it through `Load certification report`. The workflow remains read-only: it does not enable tools, install runtimes, queue missions, dispatch runner tasks, or execute modules. Focused checks and full `pnpm verify` passed for this slice.

## 2026-06-28 Third-Party Tool Candidate Readiness Summary

- `GAP-THIRD-PARTY-TOOL-CANDIDATE-READINESS-SUMMARY-001`: **Closed in this slice.** Candidate batch import created a scalable intake path, but admins still had to inspect implementation readiness one candidate at a time. `GET /api/v1/third-party-tools/intake/candidates/readiness-summary` now returns a tenant-scoped backlog summary with per-candidate readiness reports, readiness counts, review/intake counts, top required actions, and explicit no-side-effect markers. Registry Center consumes it through `Summarize readiness`. The workflow remains read-only: it does not create catalog entries, install jobs, tenant enablement, missions, runner tasks, or module executions. Focused checks and full `pnpm verify` passed for this slice.

## 2026-06-28 Third-Party Tool Candidate Batch Import

- `GAP-THIRD-PARTY-TOOL-CANDIDATE-BATCH-IMPORT-001`: **Closed in this slice.** Tool intake could persist one proposed manifest at a time, but systematic library expansion needed a batch API for importing many reviewed-backlog candidates without making them executable. `/api/v1/third-party-tools/intake/candidates/import` now validates bounded batches item by item, returns explicit submitted/failed/rejected/needs-changes outcomes, isolates malformed and duplicate entries, persists successful items into the existing tenant candidate backlog, writes per-candidate and batch audit events, and Registry Center consumes the same API through a batch JSON import control. The workflow remains non-executing: it does not create catalog entries, install jobs, tenant enablement, missions, runner tasks, or module executions.

## 2026-06-28 Third-Party Tool Implementation Bundles

- `GAP-THIRD-PARTY-TOOL-IMPLEMENTATION-BUNDLE-001`: **Closed in this slice.** Accepted tool candidates already had implementation work orders, but API customers and platform engineers lacked a concrete, checksum-bearing implementation bundle derived from those work orders. `GET /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle` now returns non-executing scaffold file content, SHA-256 hashes, validation commands, required actions, safety notes, and `doesNotExecute: true`. The route writes `third_party_tool.implementation_bundle_generated`, Registry Center consumes it through `Load implementation bundle`, and it does not write repo files, install, enable, queue missions, dispatch runner tasks, or execute modules.

## 2026-06-28 Third-Party Tool Due Refresh

- `GAP-THIRD-PARTY-TOOL-DUE-REFRESH-001`: **Closed in this slice.** Per-tool upstream checks and reviewed update recommendations existed, but admins and API customers still needed a systematic library-refresh action for due reviewed tools. `/api/v1/third-party-tools/refresh-due` now creates upstream checks and reviewed update recommendations for due reviewed tools, returns checked/skipped/not-due/failed statuses, writes `third_party_tool.refresh_due_checked`, and Registry Center consumes it through `Refresh due tools`. The workflow is non-executing: it does not install, enable, queue missions, dispatch runner tasks, or execute modules. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Third-Party Tool Runner Task Activity

- `GAP-THIRD-PARTY-TOOL-RUNNER-TASK-ACTIVITY-001`: **Closed in this slice.** `/api/v1/third-party-tools/:toolId/activity` now includes persisted `RunnerTask` lifecycle entries for tenant tasks whose module IDs are bound to the requested tool. Activity entries expose status, task ID, module ID, runner ID, scope ID, run ID, task type, and evidence count while intentionally omitting raw targets from activity metadata.

## 2026-06-27 Third-Party Tool Runner Dispatch UI

- `GAP-THIRD-PARTY-TOOL-RUNNER-DISPATCH-UI-001`: **Closed in this slice.** Registry Center now exposes a real API-backed dispatch form for governed runner-ready third-party tool capabilities. The form appears only after runner eligibility reports a dispatchable capability, submits selected capability, runner ID, verified scope ID, target, timeout, and rate limit to `/api/v1/third-party-tools/:toolId/runner-dispatch`, and renders the returned persisted task, mission, and run IDs. The UI does not execute locally or bypass server-side tenant enablement, verified scope, policy decision, kill switch, allowlist, signing, or audit enforcement.

## 2026-06-27 Third-Party Tool Promotion Governance Handoff

- `GAP-THIRD-PARTY-TOOL-PROMOTION-HANDOFF-001`: **Closed in this slice.** Promotion packages now have a current-state governance handoff endpoint at `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/governance-handoff`. The report computes tenant enablement, runtime readiness, runner eligibility, exact next API actions, execution side-effect markers, and policy-gate markers from real state. Registry Center consumes the route through `Load governance handoff`. The report is read-only and does not install, enable, queue missions, dispatch runner tasks, or execute modules.

## 2026-06-27 Third-Party Tool Promotion Package UI

- `GAP-THIRD-PARTY-TOOL-PROMOTION-PACKAGE-UI-001`: **Closed in this slice.** Registry Center no longer requires generating a duplicate package to see backend promotion proof. Promoted candidates now have a `Load promotion packages` action that reads `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`, stores the returned per-candidate list, and renders the latest status, summary, module/capability/evidence counts, and safety notes.

## 2026-06-27 Third-Party Tool Promotion Packages

- `GAP-THIRD-PARTY-TOOL-PROMOTION-PACKAGE-001`: **Closed in this slice.** Readiness-gated tool-candidate promotion now creates durable tenant-scoped promotion packages through `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`. The package snapshots reviewed catalog metadata, candidate readiness, governance policy, runtime installation state, module IDs, capability IDs, required evidence, and safety notes; writes `third_party_tool.promotion_package_generated`; appears in per-tool activity; and remains non-executing. Promotion packages do not install, enable, queue missions, dispatch runner tasks, or execute modules. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Third-Party Tool Runner Dispatch

- `GAP-THIRD-PARTY-TOOL-RUNNER-DISPATCH-001`: **Closed in this slice.** Runner eligibility is no longer only a read-only report for safe reviewed recon tools. `/api/v1/third-party-tools/:toolId/runner-dispatch` now validates a requested reviewed capability against the eligibility model, rejects non-ready/blocked/unallowlisted capabilities before task creation, delegates successful execution to existing signed runner task builders, and writes tenant audit events. Server dispatch now covers the safe runner-agent `recon.*` modules for `nmap`, `subfinder`, `httpx`, and `dnsx`. SharpHound, Caldera live execution, Atomic live execution, credential validation, exploitation checks, and arbitrary package/module dispatch remain blocked or non-executable. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Third-Party Tool Runner Eligibility

- `GAP-THIRD-PARTY-TOOL-RUNNER-ELIGIBILITY-001`: **Closed in this slice.** Governed reviewed tools now expose tenant-scoped runner dispatch readiness through `/api/v1/third-party-tools/:toolId/runner-eligibility`. The API combines real tenant governance, runtime readiness, active runner count, verified compatible scope count, capability implementation status, approval requirements, and server-side signed-task dispatch allowlists. Registry Center consumes the endpoint through "Check runner" and renders status, reasons, dispatch routes, and required actions. The report is read-only and does not install tools, queue missions, create runner tasks, or execute modules. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Third-Party Tool Activity Timeline

- `GAP-THIRD-PARTY-TOOL-ACTIVITY-TIMELINE-001`: **Closed in this slice.** Governed reviewed tools now expose a tenant-scoped lifecycle timeline through `/api/v1/third-party-tools/:toolId/activity`. The API combines real activity from audit events, check/install jobs, validation runs for module IDs bound to the tool, upstream version checks, update recommendations, intake candidates, and implementation work orders. Registry Center consumes the endpoint through "Load activity" and renders recent source/category/status/timestamp/summary entries without creating UI-only logs, exposing credentials, or running tools. Focused shared/API/web validation passed.

## 2026-06-27 Runner Local Lab Full Internal Checks

- `GAP-RUNNER-LOCAL-LAB-INTERNAL-CHECKS-001`: **Closed in this slice.** Runner local-lab release evidence no longer covers only TCP reachability. `apps/runner/main_test.go` now validates signed in-scope `runner.reachability_check`, `runner.dns_resolution_check`, `runner.tls_certificate_check`, and `runner.http_health_check` tasks against loopback fixtures, artifact upload callbacks, and uploaded evidence manifests. `scripts/test-runner-lab.sh` runs the full `TestRunnerLocalLab*` family. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Third-Party Tool Upstream Version Checks

- `GAP-THIRD-PARTY-TOOL-UPSTREAM-CHECK-001`: **Closed in this slice.** Governed reviewed tools now have tenant-scoped trusted upstream version checks at `/api/v1/third-party-tools/:toolId/upstream-version-checks`. The API discovers candidate versions only from reviewed source metadata or platform-controlled overrides, persists catalog/discovered version, source kind, status, required actions, and audit metadata, and Registry Center consumes the route. Candidate reports do not update catalog versions, tenant pins, install jobs, missions, module execution, or runner tasks. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Third-Party Tool Update Recommendations

- `GAP-THIRD-PARTY-TOOL-UPDATE-RECOMMENDATION-001`: **Closed in this slice.** Governed tools now have tenant-scoped reviewed-version update recommendations at `/api/v1/third-party-tools/:toolId/update-recommendations`. The API persists update status, current/reviewed/installed versions, required actions, generated/applied/dismissed metadata, optional install-job linkage, and sanitized audit events. Registry Center consumes the route. Recommendations compare only against reviewed catalog versions and do not accept arbitrary versions, install artifacts, or execute tools directly.

## 2026-06-27 Third-Party Tool Implementation Work Orders

- `GAP-THIRD-PARTY-TOOL-IMPLEMENTATION-WORK-ORDER-001`: **Closed in this slice.** Accepted third-party tool candidates now have tenant-scoped implementation work orders through `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`. The API persists task/scaffold plans, readiness/review status, required evidence, generated-by metadata, and sanitized audit events after an accepted implementation review; Registry Center consumes the same route. Work orders remain planning-only and do not write repository files, install packages, enable tools, queue missions, or execute modules.

## 2026-06-27 Third-Party Tool Candidate Review

- `GAP-THIRD-PARTY-TOOL-CANDIDATE-REVIEW-001`: **Closed in this slice.** Submitted third-party tool candidates now have a tenant-scoped metadata-only review workflow at `/api/v1/third-party-tools/intake/candidates/:candidateId/review`. Owner/Admin users can mark candidates `NeedsChanges`, `AcceptedForImplementation`, `Rejected`, or readiness-gated `PromotedToCatalog`; the API blocks unsafe state transitions, writes sanitized audit events, and Registry Center consumes the route without installing, enabling, queueing, or executing proposed tools.

## 2026-06-27 Third-Party Tool Candidate Readiness

- `GAP-THIRD-PARTY-TOOL-CANDIDATE-READINESS-001`: **Closed in this slice.** Submitted third-party tool candidates now expose a tenant-scoped read-only readiness report through `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness`. The report compares candidate metadata against actual reviewed catalog entries, module manifests, module/tool bindings, governance availability, runtime metadata, runner compatibility, and legal/safety posture, returns `ReadyForGovernance`, `NeedsImplementation`, or `Blocked` with explicit required actions, and never promotes, installs, enables, queues, or executes unreviewed tools.

## 2026-06-27 Third-Party Tool Candidate Backlog

- `GAP-THIRD-PARTY-TOOL-CANDIDATE-BACKLOG-001`: **Closed in this slice.** Tool intake validation is no longer transient only. Tenant admins can persist proposed tool manifests as candidate backlog records through `/api/v1/third-party-tools/intake/candidates`; the API stores the original manifest, validation report, status, requester, timestamps, and `third_party_tool.intake_submitted` audit event, and Registry Center renders the backlog without installing, cataloging, enabling, queueing missions, or executing unreviewed tools. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Registry Center Tool Intake UI

- `GAP-THIRD-PARTY-TOOL-ONBOARDING-INTAKE-UI-001`: **Closed in this slice.** Registry Center now exposes the non-executing tool-intake workflow through a real `/api/v1/third-party-tools/intake/validate` form. The UI renders the returned certification decision, checks, installable runtimes, runner compatibility, and required actions without creating catalog entries, install jobs, missions, or unreviewed executable tools.

## 2026-06-27 Third-Party Tool Onboarding Intake

- `GAP-THIRD-PARTY-TOOL-ONBOARDING-INTAKE-001`: **Closed in this slice.** The tool library expansion process now has an API-first, non-executing intake gate. `/api/v1/third-party-tools/intake/validate` evaluates proposed tool manifests for duplicate IDs, license/legal posture, runtime installability, safety boundaries, required scope, runner compatibility, module scaffold files/tests, and remediation actions; it writes `third_party_tool.intake_validated` audit events and never installs, enables, catalogs, or executes arbitrary candidate tools.

## 2026-06-27 Third-Party Tool Install Worker

- `GAP-THIRD-PARTY-TOOL-INSTALL-WORKER-001`: **Closed in this slice.** Tool install API requests no longer execute commands or fake installed state. The API queues an audited install job, and the worker owns execution through a manifest-derived command planner with no shell, output redaction, runtime policy updates, and explicit worker/execute opt-in flags. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Third-Party Tool Governance Center

- `GAP-THIRD-PARTY-TOOL-GOVERNANCE-001`: **Closed in this slice.** Admins now have a mutable API-first governance surface for Periscan-managed validation tools, distinct from read-only OSS/module catalog APIs. The slice adds shared DTOs, additive DB persistence, `/api/v1/third-party-tools` routes, tenant enable/disable/check/install job handling, Registry Center controls, mission-start denial for disabled tools, and docs for systematic future tool onboarding and runner execution. Full `pnpm verify` passed with E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-27 Superseded Module Metadata PR Closure

- `GAP-SUPERSEDED-MODULE-METADATA-PR-001`: **Closed in this slice.** PR #36 (`codex/module-manifest-safety-metadata`) was still a visible parallel-agent branch/PR even though its head commit `f84925f` was already contained in `codex/integrate-validated-pr-stack`. The PR is now closed as superseded, `.ai/spec-index.md` points to the active branch/no-open-PR state, and public traceability records the module manifest metadata work as contained in the active branch rather than active side-branch work.

## 2026-06-24 Historical Review Banners

- `GAP-HISTORICAL-REVIEW-BANNERS-001`: **Closed in this slice.** June 5 UX, DevOps, security, product, and QA review files contained stale branch/open-gap context that could be mistaken for current work guidance. They now carry explicit historical snapshot banners pointing to current status/handoff/gap/release-readiness/implementation-status files, and the coordination-doc regression covers the full legacy review/report set.

## 2026-06-24 Connector Health Truthfulness

- `GAP-CONNECTOR-UNKNOWN-HEALTH-INTENTIONAL-001`: **Closed in this slice.** After grounding SIEM and workflow live sync paths with safe read-only health probes, the remaining product-visible `Unknown` connector states are now explicitly regression-covered as intentional safety boundaries. Slack and Microsoft Teams incoming webhooks do not post just to verify health; PagerDuty Events API does not trigger an incident just to verify a routing key; and Lakera Guard without project/policy IDs does not call metadata or runtime guard endpoints. All four paths return readiness-only `Unknown` sync results with zero assets/signals and no credential leakage.

## 2026-06-24 Full Verification After Connector Health Truthfulness

- `GAP-RELEASE-VERIFY-CONNECTOR-HEALTH-TRUTHFULNESS-001`: **Closed in this slice.** Full local `pnpm verify` was rerun after the connector health truthfulness slice. Active release/predeployment/implementation/completion docs now cite that latest gate. Evidence: lint/typecheck/workspace tests/build/runner/runner-lab/OSS toolchain/license/Prisma/E2E/security/audit/acceptance all passed, with Playwright E2E 42/42, security 22/22, and acceptance 100 files / 123 tests. The generated Next route-type drift was restored.

## 2026-06-24 Full Verification After Webhook Audit And API Test Isolation

- `GAP-RELEASE-VERIFY-WEBHOOK-AUDIT-TEST-ISOLATION-001`: **Closed in this slice.** Full local `pnpm verify` was rerun after the tenant webhook lifecycle audit migration and API Vitest build-artifact isolation change. Active release/predeployment/implementation/completion docs now cite that latest gate. Evidence: lint/typecheck/workspace tests/build/runner/runner-lab/OSS toolchain/license/Prisma/E2E/security/audit/acceptance all passed, with Playwright E2E 42/42, security 22/22, and acceptance 100 files / 123 tests. The generated Next route-type drift was restored.

## 2026-06-24 API Test Build-Artifact Isolation

- `GAP-API-TEST-DIST-EXCLUDE-001`: **Closed in this slice.** Focused API Vitest commands could pick up ignored compiled `apps/api/dist/*.test.js` files when a loose file filter was supplied, which caused the audit action contract guard to run stale source after the webhook audit enum addition. `apps/api/vitest.config.ts` now excludes `**/dist/**`; the exact failing command now passes against current source tests.

## 2026-06-24 Tenant Webhook Lifecycle Audit Completeness

- `GAP-WEBHOOK-LIFECYCLE-AUDIT-COMPLETENESS-001`: **Closed in this slice.** Outbound webhook create/update/delete/test actions configure tenant automation and signing state, but only dead-letter delivery handling was previously audited. This slice adds shared/DB audit action support, DB-backed and in-memory audit writes, and API/acceptance regressions proving webhook lifecycle events are tenant-scoped, identify `TenantWebhook`, and do not expose signing secrets, endpoint URLs, or payload content.

## 2026-06-24 Integration Audit Credential Exposure Regression

- `GAP-INTEGRATION-AUDIT-CREDENTIAL-EXPOSURE-REGRESSION-001`: **Closed in this slice.** The broader historical P0 secret-audit item also named audit metadata as a potential exposure path. The integration catalog API regression now fetches `integration.connected` audit events after API-key, assume-role, and webhook integration onboarding and asserts the audit payload has no raw `config` object and no credential material while preserving connector identity context.

## 2026-06-24 Trust Safety Credential Exposure Regression

- `GAP-TRUST-SAFETY-CREDENTIAL-EXPOSURE-REGRESSION-001`: **Closed in this slice.** Trust & Safety now exposes connected integration readiness metadata, which increases the importance of proving the summary remains a transparency surface rather than a configuration/secret surface. The integration catalog API regression now covers API-key, assume-role, and webhook integrations and asserts `/api/v1/tenants/current/trust-safety` includes no raw `config` object and no raw credential material while preserving readiness metadata. User stories, acceptance criteria, and public traceability were updated.

## 2026-06-24 Spec Index Current Addendum Refresh

- `GAP-SPEC-INDEX-CURRENT-ADDENDUM-DRIFT-001`: **Closed in this slice.** `.ai/spec-index.md` still labeled its authoritative addendum as 2026-06-20 and only named older connector-expansion state. The addendum now reflects the active branch, OCI/Alibaba Beta connector additions, the 123 dedicated live / 141 standardized connectable catalog split, and the API-backed integration readiness metadata now exposed by records, Marketplace, and Trust & Safety. A coordination-doc regression prevents the current addendum from drifting back to the stale branch/integration wording.

## 2026-06-24 Full Verification Refresh After Trust Safety Readiness Metadata

- `GAP-RELEASE-VERIFY-TRUST-SAFETY-READINESS-001`: **Closed in this slice.** Full local `pnpm verify` was rerun after the Trust & Safety integration readiness metadata slice. Active release/predeployment/implementation/completion docs now cite that latest gate instead of older API Reference or persisted integration catalog slices. Evidence: lint/typecheck/workspace tests/build/runner/runner-lab/OSS toolchain/license/Prisma/E2E/security/audit/acceptance all passed, with Playwright E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-24 Trust Safety Integration Readiness Metadata

- `GAP-TRUST-SAFETY-INTEGRATION-READINESS-METADATA-001`: **Closed in this slice.** Connected integration records and marketplace cards carried implementation/readiness metadata, but Trust & Safety still reduced connected systems to health, permissions, and capabilities. The shared Trust & Safety DTO, DB-backed summary builder, in-memory route service, API regression, and dashboard now expose connector key, implementation tier, execution readiness, readiness reason, dedicated-client posture, and live-support status from persisted integration metadata with catalog fallback.

## 2026-06-24 Typed Integration Permissions Summary

- `GAP-INTEGRATION-PERMISSIONS-SUMMARY-SCHEMA-001`: **Closed in this slice.** Integration records persisted connector readiness metadata in `permissionsSummary`, but shared/OpenAPI contracts still described the field as only loose JSON. `packages/shared` now exposes a typed `IntegrationPermissionsSummarySchema` with implementation tier, execution readiness, dedicated/live flags, readiness reason, connector key, and required permissions while preserving catchall compatibility.

## 2026-06-24 Product Plan Completed-Slice Labeling

- `GAP-PRODUCT-PLAN-NEXT-SLICES-DRIFT-001`: **Closed in this slice.** `docs/PRODUCT_COMPLETION_PLAN.md` still labeled five completed implementation slices as "Next 5 execution slices," which could misroute autonomous or parallel agents. The section now clearly states those slices are completion history and points current work selection to active `.ai` status/backlog and implementation-status addenda. A coordination-doc test rejects the stale heading.

## 2026-06-24 Connected Integration Metadata UI

- `GAP-INTEGRATION-CONNECTED-METADATA-UI-001`: **Closed in this slice.** After connected integration records gained persisted catalog metadata, the Integration Marketplace connected-state panel still rendered only health/sync fields and catalog-card metadata. Connected cards now show implementation tier, execution readiness, dedicated/standardized posture, live support, and readiness reason from the integration record, with catalog fallback for legacy records.

## 2026-06-24 Persisted Integration Catalog Metadata

- `GAP-INTEGRATION-PERSISTED-CATALOG-METADATA-001`: **Closed in this slice.** `/api/v1/integrations/catalog` exposed connector tier/readiness metadata, but created integration records only persisted `requiredPermissions`, so API clients had to rejoin catalog data to understand whether an already connected integration was a dedicated live client or standardized catalog connector. Integration creation now persists the non-secret catalog metadata in `permissionsSummary`; API tests cover GitHub dedicated and Darktrace standardized connectors through create/list/read responses and credential redaction.

## 2026-06-24 Registry Capability Readiness Visibility

- `GAP-REGISTRY-CAPABILITY-READINESS-VISIBILITY-001`: **Closed in this slice.** Registry Center fetched runtime-enriched OSS capabilities but rendered only capability implementation status, interface kind, and execution mode. Capability cards now show execution readiness, runtime reason, safety levels, required scopes, required integrations, and evidence outputs from `/api/v1/open-source-capabilities`; the web regression covers Ready, FixtureOnly, and Blocked capability states.

## 2026-06-24 Integration Catalog API Tier Metadata

- `GAP-INTEGRATION-CATALOG-API-TIER-METADATA-001`: **Closed in this slice.** The generated integration docs distinguished 123 dedicated live clients from 141 standardized connectable catalog manifests, but `/api/v1/integrations/catalog` still returned only raw manifest fields, forcing replacement UIs to infer tier/readiness from docs-only JSON. The connector catalog now returns `implementationTier`, `dedicatedClient`, `live`, `executionReadiness`, and `executionReadinessReason`; OpenAPI documents that enriched response; the web marketplace renders tier/readiness from API data; generated docs now consume the same runtime fields.

## 2026-06-24 Integration Catalog Connectability Truthfulness

- `GAP-INTEGRATION-CATALOG-CONNECTABILITY-TRUTHFULNESS-001`: **Closed in this slice.** Runtime connector catalog inspection showed all 264 connectors are currently connectable Beta surfaces, but README and the integration-doc regression still described the 141 standardized catalog manifests as "non-connectable entries." The generator now publishes `connectable` and `dedicatedClient` metadata, public docs call them connectable Beta catalog manifests, and tests reject stale non-connectable wording.

## 2026-06-24 Oracle Cloud Infrastructure Read-Only Connector

- `GAP-ORACLE-CLOUD-CONNECTOR-001`: **Closed in this slice.** The integration marketplace still had Oracle Cloud Infrastructure as a planned/non-connectable cloud catalog entry even though the PRD calls for broad cloud signal-fabric coverage and API-first cloud connector surfaces. `oracle-cloud` is now a connectable Beta integration with fixture-backed sync and signed read-only live OCI Core Services inventory for instances, VCNs, and security lists in an authorized compartment. Mutation, console, command, object-content, and credential API paths are denied before fetch; normalized compartment/compute/VCN/security-list/public-ingress assets and signals are emitted; and tests prove private signing keys and raw CIDR blocks are not returned in product-visible sync output.

## 2026-06-24 Alibaba Cloud Read-Only Connector

- `GAP-ALIBABA-CLOUD-CONNECTOR-001`: **Closed in this slice.** The integration marketplace still had Alibaba Cloud as a planned/non-connectable cloud catalog entry even though the PRD calls for broad cloud signal-fabric coverage and API-first connector surfaces. `alibaba-cloud` is now a connectable Beta integration with fixture-backed sync and signed read-only live ECS/RAM inventory (`DescribeInstances`, `DescribeSecurityGroups`, `ListRoles`). Mutation/remote-access action names are denied before fetch, normalized assets/signals are emitted, and tests prove credentials/raw IPs are not returned in product-visible sync output.

## 2026-06-24 Public API Reference Traceability Rows

- `GAP-PUBLIC-TRACEABILITY-API-CONTRACT-ROWS-001`: **Closed in this slice.** Active `.ai` traceability recorded the latest API Reference content, non-JSON, action-schema, and read-schema contract slices, but the public `docs/TRACEABILITY_MATRIX.md` did not list those gap IDs. The public traceability matrix now contains those four rows, and `tests/modules/coordination-docs.test.ts` prevents this release-critical traceability drift from recurring.

## 2026-06-24 Full Verification Refresh After API Reference Contract Completion

- `GAP-RELEASE-VERIFY-API-REFERENCE-CONTRACT-001`: **Closed in this slice.** Full local `pnpm verify` was rerun after the API Reference payload-registry completion, non-JSON response metadata, and content-type/status metadata commits. The latest release evidence is lint/typecheck/workspace tests/build/runner/runner-lab/OSS toolchain/license/Prisma/E2E/security/audit/acceptance all passing, with Playwright E2E 42/42, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-24 API Reference Content Metadata

- `GAP-API-REFERENCE-CONTENT-METADATA-001`: **Closed in this slice.** `/api/v1/api-reference` exposed query names and schema-availability booleans but did not list request content types, response content types, or success statuses. API customers replacing the UI still had to inspect raw OpenAPI for HTML/PDF/CSV/text/no-content/redirect handling. The shared API Reference contract, API derivation, and web reference now expose this metadata directly, and explicit non-200 success statuses no longer carry generated default 200 entries.

## 2026-06-24 API Non-JSON Response Metadata

- `GAP-API-REFERENCE-NONJSON-NOCONTENT-001`: **Closed in this slice.** The last implemented operation IDs without payload registry coverage were no-content deletes/logout, `/health` redirect, Prometheus text metrics, raw OpenAPI JSON, audit export JSON/CSV, evidence download, public/shared HTML reports, Snapshot HTML/PDF export, generic report export, and advisory readiness report export. The OpenAPI registry now documents these operations with accurate success status/content-type metadata, `/api/v1/api-reference` detects non-JSON response schemas, and the registry inventory reports zero missing implemented operation IDs.

## 2026-06-24 API Action Schema Expansion

- `GAP-API-REFERENCE-ACTION-SCHEMAS-001`: **Closed in this slice.** Implemented action endpoints for auth/MFA, webhooks, threat feeds, threat alerts, integration sync, runner task creation, scope posture checks, remediation verification, due reverification, and due schedules had stable runtime validation/response shapes but incomplete OpenAPI payload metadata. The registry now publishes the corresponding request/response schemas, including 201 runner/scope creation responses and 202 accepted-action responses. Remaining gaps are limited to no-content deletes/logout, redirects, text/binary/download/export endpoints, and raw OpenAPI/Prometheus responses that require a separate non-JSON response metadata pass.

## 2026-06-24 API Reference Read Schema Expansion

- `GAP-API-REFERENCE-READ-SCHEMAS-001`: **Closed in this slice.** Several implemented customer-facing read/list/catalog endpoints still appeared in the augmented OpenAPI/API Reference as route-only entries despite stable DTOs already existing in shared, policy, connectors, modules, or operators packages. The payload registry now publishes response schemas for health/readiness/metrics/API reference/deployment status, external validation profiles, integration catalog/health, ATT&CK techniques, operators, operator recommendations, AI validation suites, control validation scenarios/rule coverage, engagements, active billing package, and billing limits. Registry gaps dropped from 59 to 37 operation IDs; remaining gaps are tracked for action/export/delete/redirect/admin-specific slices.

## 2026-06-24 API Reference Query Parameter Names

- `GAP-API-REFERENCE-QUERY-NAMES-001`: **Closed in this slice.** `/api/v1/api-reference` exposed whether query parameters existed, but did not list parameter names. API customers replacing the UI still had to open raw OpenAPI JSON for basic filter/control discovery. The shared API Reference endpoint contract now includes `queryParameters`, the API derives sorted names from augmented OpenAPI, and the web API Reference renders those names.

## 2026-06-24 OSS API Schema Metadata

- `GAP-OSS-API-SCHEMA-METADATA-001`: **Closed in this slice.** OSS tool and capability catalog endpoints are implemented, API-backed, and used by Registry Center, but OpenAPI/API Reference still showed the tool list as route-only with no response schema or filter parameter metadata. The doc-only OpenAPI registry now publishes shared OSS response schemas for open-source tools and capabilities plus `phase`, `includeDeferred`, and `includeLegalReview` query controls.

## 2026-06-24 Expanded API Query Metadata Coverage

- `GAP-API-REFERENCE-FILTER-METADATA-001`: **Closed in this slice.** Multiple existing GET routes accepted query filters/cursors but the augmented OpenAPI document did not publish those controls. API customers could discover that a route had query parameters from `/api/v1/api-reference`, but still lacked parameter names, required flags, enum values, and bounds for tenant SSO authorization URL, webhook delivery history, policy-decision history, model-gateway audit events, jobs, threat catalog, threat alerts, audit events, and mission lists. The doc-only OpenAPI registry now publishes those parameters without changing runtime validation.

## 2026-06-24 API Reference Query Parameter Metadata

- `GAP-API-REFERENCE-QUERY-METADATA-001`: **Closed in this slice.** `/api/v1/api-reference` and the augmented OpenAPI document exposed request/response schema availability but did not show query-parameter support for bounded list controls. API customers replacing the UI could observe `limit` behavior only by reading implementation code or examples. OpenAPI now publishes optional `limit` query parameters for evidence, reports, threat advisories, signal-trigger activity, audit events, and policy-decision history; the API Reference returns `hasQueryParameters`; and the web API Reference renders that metadata.

## 2026-06-24 Default Bounds For High-Volume API Lists

- `GAP-HIGH-VOLUME-LIST-DEFAULT-LIMIT-001`: **Closed in this slice.** `GET /api/v1/evidence`, `GET /api/v1/reports`, and `GET /api/v1/threat-advisories` only capped results when callers supplied `limit`, so default customer API reads could fetch unbounded histories. The routes now apply the shared default limit of 50, explicit limits remain clamped, and the API regression seeds 55 tenant-scoped records to prove default and explicit bounds.

## 2026-06-24 Signal Trigger Activity Limit

- `GAP-SIGNAL-ACTIVITY-LIMIT-001`: **Closed in this slice.** `/api/v1/signal-triggers/activity` returned the full computed activity list with no public `limit` parameter, unlike adjacent API-first list endpoints. The route now accepts `limit`, clamps it through `parseLimit`, applies it in the service layer, and tests prove a limited read returns one activity item without queueing missions.

## 2026-06-24 API Reference Product Grouping

- `GAP-API-REFERENCE-PRODUCT-GROUPING-001`: **Closed in this slice.** `/api/v1/api-reference` could place newer PRD surfaces such as Threat Center, Model Gateway, Approvals, Jobs, Operators/engagements, Audit, Policy, MITRE ATT&CK, and Deployment into generic System/Evidence groups. The grouping function now maps these namespaces to customer-visible product areas, and the API health/API-reference route test asserts representative endpoints plus rejects unexpected non-health `System` endpoints.

## 2026-06-24 API Reference Schema Availability

- `GAP-API-REFERENCE-SCHEMA-AVAILABILITY-001`: **Closed in this slice.** `/api/v1/api-reference` exposed route groups, methods, paths, summaries, and auth mode but did not expose whether request/response payload schemas were published in OpenAPI. API customers replacing the UI had to inspect `/openapi.json` manually to know whether a route had typed payload metadata. The shared `ApiReferenceEndpoint` contract now includes `hasRequestSchema` and `hasResponseSchema`, the API derives those flags from the augmented OpenAPI document, the web API Reference renders them, and docs/stories/acceptance criteria name the behavior.

## 2026-06-24 Coordination History Banner

- `GAP-COORDINATION-HISTORY-BANNER-001`: **Closed in this slice.** `.ai/codex-handoff.md` and `.ai/requirements-traceability.md` are chronological audit logs with newest entries at the top, but older entries intentionally retain earlier validation totals. Both files now state this current-guidance rule in their preambles and point agents to `.ai/status.md` plus `docs/IMPLEMENTATION_STATUS.md` for the authoritative current state. `tests/modules/coordination-docs.test.ts` protects the banner.

## 2026-06-24 Shared Runner Run-Mode Contract Cleanup

- `GAP-RUNNER-RUNMODE-REVERSE-TUNNEL-COMMENT-001`: **Closed in this slice.** `packages/shared/src/domain.ts` still described the `ServiceViaProxy` run mode as routing through the agent's scoped reverse tunnel. That source-level contract contradicted the outbound-only runner architecture and the current docs that disallow reverse SSH/arbitrary tunnels. The comment now documents `ServiceViaProxy` as a future restricted signed logical channel, and both `tests/modules/open-source-workstream-docs.test.ts` and `scripts/validate-runner-deploy.sh` prevent the stale wording from returning.

## 2026-06-24 Deployable Image CI Coverage

- `GAP-DEPLOYABLE-IMAGE-CI-API-001`: **Closed in this slice.** `docs/DEPLOY.md` documented `apps/api/Dockerfile` as a production deploy artifact, but `.github/workflows/images-build.yml` only built scan-executor, runner-agent, and web images. The image workflow now builds, smoke-tests, and tag-pushes `ghcr.io/seanheiney/periscan-api`; image path filters include deployable app/package/lockfile changes; `tests/modules/ci-workflow.test.ts` asserts documented deployable images stay covered.

## 2026-06-24 Runner Proxy Terminology Cleanup

- `GAP-RUNNER-REVERSE-TUNNEL-TERMINOLOGY-001`: **Closed in this slice.** The superseded self-contained runner PRD and runner-agent egress comment still used "agent's reverse tunnel" language for ServiceViaProxy despite the current runner contract being outbound HTTPS signed-task polling with no reverse SSH/arbitrary tunnel. The historical PRD now uses "future restricted signed logical channel" language, the egress comment matches, and runner deploy/module-doc regressions prevent the stale reverse-tunnel phrasing from returning.

## 2026-06-24 CI Verify Contract Cleanup

- `GAP-CI-VERIFY-CONTRACT-DRIFT-001`: **Closed in this slice.** `.github/workflows/ci.yml` still had a post-verify note claiming Playwright accessibility was not automatic and a redundant high-severity audit command wrapped as non-fatal, contradicting `scripts/verify.sh`. CI now treats `pnpm verify` as the single release gate and its summary accurately lists Playwright E2E/accessibility plus fatal high+ dependency audit; `tests/modules/ci-workflow.test.ts` prevents the weaker stale contract from returning.

## 2026-06-24 Active Status Verification Refresh

- `GAP-ACTIVE-STATUS-VERIFY-DRIFT-001`: **Closed in this slice.** `docs/IMPLEMENTATION_STATUS.md` and `docs/COMPLETION_REPORT.md` still presented older 2026-06-23 validation totals as current release evidence after the latest 2026-06-24 full `pnpm verify` gate. Active docs now cite Playwright E2E 42/42 and acceptance 100 files / 123 tests, the older implementation-status addendum is labeled historical, and `tests/modules/coordination-docs.test.ts` prevents those stale totals from returning to active release docs.

## 2026-06-24 Predeployment Verification Refresh

- `GAP-PREDEPLOYMENT-VERIFY-DRIFT-001`: **Closed in this slice.** Release-readiness and predeployment checklists still cited older 2026-06-23 / v0.1.147 gate evidence and described Playwright E2E as CI-only despite the current local `pnpm verify` passing with E2E 42/42 and acceptance 100 files / 123 tests. The docs now cite the current 2026-06-24 verification gate, and `tests/modules/coordination-docs.test.ts` prevents the old evidence from returning.

## 2026-06-24 Runner Deployment Credential Contract Cleanup

- `GAP-RUNNER-DEPLOYMENT-MTLS-DRIFT-001`: **Closed in this slice.** Runner deployment requirements and deploy artifacts now match the implemented customer runner transport: outbound HTTPS mTLS client certificate plus bearer token over TLS and signed task envelopes. Docker Compose, Kubernetes, systemd env example, and runner deploy README mount or reference issued mTLS CA/client certificate/client private-key files while retaining no inbound service exposure.

## 2026-06-24 Historical Coordination Docs Cleanup

- `GAP-DOC-001`: **Closed in this slice.** Older top-level `.ai` reports from June 5 could still read as current branch/release guidance when opened directly. `.ai/final-report-draft.md` and `.ai/architecture-review.md` now carry explicit historical snapshot banners pointing agents to current authoritative status, handoff, gap, release-readiness, and implementation-status files; `tests/modules/coordination-docs.test.ts` prevents those banners from being removed.

## 2026-06-24 Production Redis Queue Configuration

- `GAP-PRODUCTION-REDIS-FALLBACK-001`: **Closed in this slice.** API mission queues, model-gateway turn queues, webhook delivery queues, and worker Redis connections could default to `127.0.0.1:6379` when `REDIS_URL` was missing, even though production readiness requires explicit Redis. Redis URL resolution is now centralized, production queue construction fails closed without `REDIS_URL`, deployment readiness rejects malformed Redis URLs, and local fallback remains documented for non-production development only.

## 2026-06-24 Production Web API Proxy Configuration

- `GAP-PRODUCTION-WEB-API-PROXY-FALLBACK-001`: **Closed in this slice.** The Next.js API proxy and health proxy defaulted to `http://127.0.0.1:3001` when `PERISCAN_API_URL` was missing, even in production. Production web routes now fail closed with a stable `api_proxy_unavailable` error instead of silently routing customer traffic to a local development API fallback.

## 2026-06-24 Production Database Configuration

- `GAP-PRODUCTION-DATABASE-FALLBACK-001`: **Closed in this slice.** `resolveDatabaseUrlFromEnv()` still allowed the local development Postgres fallback in production if no explicit database URL was configured, while deployment readiness only recognized `DATABASE_URL` and not the documented Supabase/Postgres aliases. Production database URL resolution now fails closed without explicit DB config, and deployment readiness uses the same alias contract.

## 2026-06-24 Runner Task Signing Production Readiness

- `GAP-RUNNER-TASK-SIGNING-READINESS-001`: **Closed in this slice.** Runner registration requires task-signing key material in production, but deployment readiness treated `PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM` as optional and did not validate malformed or mismatched signing material. Readiness and registration now share key resolution, production readiness requires a valid Ed25519 private key, and configured public keys must match the private key.

## 2026-06-24 Production Dev Mode Disabled

- `GAP-PRODUCTION-DEV-MODE-001`: **Closed in this slice.** Production deployments could set `PERISCAN_DEV_MODE=true`, enabling API dev manual verification/mock/fixture paths and worker fixture target allowance. Production API startup and worker config now fail closed when dev mode is enabled, and deployment readiness reports `PERISCAN_DEV_MODE=true` as not ready in production.

## 2026-06-24 Production Session Secret Readiness

- `GAP-PRODUCTION-JWT-SECRET-DEFAULT-001`: **Closed in this slice.** API startup already rejected `PERISCAN_JWT_SECRET=periscan-dev-session-secret` in production, but deployment readiness treated any non-empty JWT secret as configured. Deployment readiness now marks the dev session secret as not configured in production, matching startup fail-closed behavior.

## 2026-06-24 Evidence Object Storage Production Config

- `GAP-EVIDENCE-STORAGE-PROD-FALLBACK-001`: **Closed in this slice.** Deployment readiness only required an evidence object storage endpoint, while `createEvidenceBlobStoreFromEnv()` could fall back to local filesystem when bucket or credentials were incomplete. Production now ignores local MinIO shorthand, refuses filesystem fallback without complete explicit S3-compatible/Supabase storage config, and deployment readiness requires endpoint, bucket, access key ID, and secret key.

## 2026-06-24 Production CORS Origin Allowlist

- `GAP-PRODUCTION-CORS-ORIGINS-001`: **Closed in this slice.** `PERISCAN_CORS_ORIGINS` was opt-in but production startup accepted arbitrary configured origin strings for credentialed browser API calls. Production now fails closed for wildcard, localhost, non-HTTPS, path/query/fragment, or credential-bearing origins, normalizes public HTTPS origins, and deployment readiness reports configured unsafe CORS allowlists as not ready while keeping unset CORS optional for same-origin proxy/API-key clients.

## 2026-06-24 Production Web Base URL Hardening

- `GAP-PRODUCTION-WEB-BASE-URL-001`: **Closed in this slice.** Onboarding/recovery email links could fall back to `http://localhost:3000` in production when `PERISCAN_WEB_BASE_URL` was unset or unsafe. Production now requires a public HTTPS web base URL, rejects localhost/non-HTTPS values, and deployment readiness reports missing or unsafe values as not ready.

## 2026-06-24 Production Email Transport Hardening

- `GAP-PRODUCTION-EMAIL-CONSOLE-FROM-001`: **Closed in this slice.** Production email already refused an unset transport, but explicitly setting `PERISCAN_EMAIL_TRANSPORT=console` still logged customer email and SMTP could use the local default sender. Production now rejects console transport, requires `PERISCAN_EMAIL_FROM` for SMTP, and deployment readiness mirrors those rules.

## 2026-06-24 Runner Credential Contract Docs

- `GAP-RUNNER-CREDENTIAL-DOCS-MTLS-001`: **Closed in this slice.** Runner implementation and security tests use mTLS client certificates plus bearer-token defense in depth and signed task envelopes. Docs now describe CSR-backed client-certificate issuance, certificate fingerprints, credential-expiry metadata, task-signing public key material, and task-signing key rotation. A docs regression rejects stale mock/fake mTLS wording.

## 2026-06-24 Report Share Secret Isolation

- `GAP-REPORT-SHARE-SECRET-FALLBACK-001`: **Closed in this slice.** Public report-share links are unauthenticated bearer URLs, but production token signing could fall back to `PERISCAN_JWT_SECRET`. `getReportShareSecret()` now refuses fallback signing material in production, deployment readiness requires `PERISCAN_REPORT_SHARE_SECRET`, and `.env.example` / acceptance docs make the dedicated secret explicit.

## 2026-06-24 SMTP Deployment Readiness Coverage

- `GAP-DEPLOYMENT-SMTP-HOST-READINESS-001`: **Closed in this slice.** The email transport already required `PERISCAN_SMTP_HOST` when `PERISCAN_EMAIL_TRANSPORT=smtp`, but deployment status only checked the transport selector. Tenant admins could see `ready:true` while production SMTP email delivery would fail. Deployment status now conditionally requires `PERISCAN_SMTP_HOST` for SMTP and leaves it optional for non-SMTP transports.

## 2026-06-24 Deployment Email Readiness Coverage

- `GAP-DEPLOYMENT-EMAIL-READINESS-001`: **Closed in this slice.** Production email transport refused to default to console logging, but deployment status did not list `PERISCAN_EMAIL_TRANSPORT` as required. Tenant admins could see `ready:true` while invite/reset/verification delivery would fail at startup or runtime in production. Deployment status now includes the required transactional email transport and docs/acceptance criteria name it explicitly.

## 2026-06-24 Runner OSS Docs Capability Alignment

- `GAP-RUNNER-OSS-DOCS-STALE-001`: **Closed in this slice.** `docs/OPEN_SOURCE_VALIDATION_ENGINES.md` still said the Go runner only performs TCP reachability even though current runner docs/spec and code include DNS resolution, TLS certificate inspection, HTTP health, and runner-agent signed-task dispatch. The doc now reflects the implemented safe internal checks, and `tests/modules/open-source-workstream-docs.test.ts` rejects the stale reachability-only sentence.

## 2026-06-24 Production Credential Key Fail-Closed

- `GAP-CREDENTIAL-KEY-PROD-FALLBACK-001`: **Closed in this slice.** Production integration credential encryption could fall back to `PERISCAN_MODEL_CREDENTIAL_KEY` or `PERISCAN_JWT_SECRET`, and model-provider credential encryption could fall back to `PERISCAN_JWT_SECRET`, even though deployment readiness and docs require dedicated customer credential keys. Production now refuses fallback keys for both credential stores; deployment status includes both required keys; non-production fallback remains available for local developer setup.

## 2026-06-24 OSS Capability Coverage

- `GAP-OSS-CAPABILITY-COVERAGE-001`: **Closed in this slice.** Several visible OSS tools had module implementations but no `/api/v1/open-source-capabilities` surface (`nmap`, `subfinder`, `httpx`, `dnsx`, `zaproxy`, `netexec`, `metasploit`, `kerbrute`). This could make replacement UIs rely on tool definitions alone or misclassify high-impact disabled tools. The toolchain now exposes implemented capabilities for safe recon/ZAP modules, fixture-only capability surfaces for current-release high-impact dry-run modules, and a regression test that no visible OSS tool has zero capabilities.

## 2026-06-24 sqlmap Capability Blocked

- `GAP-SQLMAP-CAPABILITY-BLOCKED-001`: **Closed in this slice.** `web.sqli_probe` was already live-disabled at module and start-constraint boundaries, but the sqlmap OSS tool catalog had no explicit capability entry, so API consumers saw readiness as planned instead of blocked/legal-review. The toolchain now exposes `sqlmap.sqli-probe-plan` as `BlockedLegalReview`, and aggregate runtime readiness remains `Blocked` even when Docker or a binary is available.

## 2026-06-24 ScoutSuite Live Posture Disabled

- `GAP-SCOUTSUITE-LIVE-POSTURE-LEGAL-SAFETY-001`: **Closed in this slice.** `cloud.scoutsuite_posture` advertised `liveSupported:true` and could invoke live ScoutSuite cloud-posture assessment from the control plane even though the OSS tool catalog marks ScoutSuite `RequiresLegalReview`. The module now advertises `liveSupported:false`, direct non-fixture execution fails closed with redacted disabled-live-execution evidence, mission start constraints reject non-fixture queueing with `scoutsuite_live_disabled`, and the OSS/API capability layer reports `scoutsuite.cloud-posture-import` as `BlockedLegalReview`.

## 2026-06-24 WhatWeb Live Fingerprint Disabled

- `GAP-WHATWEB-LIVE-FINGERPRINT-LEGAL-SAFETY-001`: **Closed in this slice.** `web.fingerprint` advertised `liveSupported:true` and could invoke live WhatWeb fingerprints from the control plane even though the OSS tool catalog marks WhatWeb `RequiresLegalReview`. The module now advertises `liveSupported:false`, direct non-fixture execution fails closed with redacted disabled-live-execution evidence, mission start constraints reject non-fixture queueing with `whatweb_live_disabled`, and the OSS/API capability layer reports `whatweb.technology-fingerprint-import` as `BlockedLegalReview`.

## 2026-06-24 testssl Live TLS Audit Disabled

- `GAP-TESTSSL-LIVE-AUDIT-LEGAL-SAFETY-001`: **Closed in this slice.** `web.tls_audit` advertised `liveSupported:true` and could invoke live testssl.sh audits from the control plane even though the OSS tool catalog marks testssl.sh `RequiresLegalReview` and Periscan already has built-in live TLS modules for first-customer validation. The module now advertises `liveSupported:false`, direct non-fixture execution fails closed with redacted disabled-live-execution evidence, mission start constraints reject non-fixture queueing with `testssl_live_disabled`, and the OSS/API capability layer reports `testssl.tls-audit-import` as `BlockedLegalReview`.

## 2026-06-24 Nikto Live Scan Disabled

- `GAP-NIKTO-LIVE-SCAN-LEGAL-SAFETY-001`: **Closed in this slice.** `web.nikto_scan` advertised `liveSupported:true` and could invoke live Nikto scans from the control plane even though the OSS tool catalog marks Nikto `RequiresLegalReview` and external validation must be safe-by-default. The module now advertises `liveSupported:false`, direct non-fixture execution fails closed with redacted disabled-live-execution evidence, mission start constraints reject non-fixture queueing with `nikto_live_disabled`, and the OSS/API capability layer reports `nikto.web-server-misconfiguration-import` as `BlockedLegalReview`.

## 2026-06-24 Web Content Discovery Fuzzing Disabled

- `GAP-WEB-CONTENT-DISCOVERY-LIVE-FUZZING-001`: **Closed in this slice.** `web.content_discovery` used `ffuf` with a caller-selectable wordlist and 8,192-request limit from the control plane while advertising `liveSupported:true`, which conflicts with the external-validation boundary that forbids default fuzzing and requires explicit safety controls. The module now advertises `liveSupported:false`, direct non-fixture execution fails closed with redacted disabled-live-execution evidence, mission start constraints reject non-fixture queueing with `content_discovery_live_disabled`, and the OSS/API capability layer reports `ffuf.content-discovery-import` as `FixtureOnly`.

## 2026-06-24 High-Impact Module Execution Fail-Closed

- `GAP-HIGH-IMPACT-MODULE-LIVE-EXECUTION-001`: **Closed in this slice.** High-impact modules (`web.sqli_probe`, `identity.cred_spray`, `exploit.metasploit_check`, `identity.kerberos_userenum`) had pre-queue live denial after the prior slice but still advertised `liveSupported:true` and their direct `execute()` paths could invoke sqlmap, NetExec, Metasploit, or Kerbrute when called with `dryRun:false`. They now advertise `liveSupported:false`, return redacted disabled-live-execution evidence for direct non-fixture `dryRun:false` execution, and keep only dry-run/fixture behavior in the current product.

## 2026-06-24 OSS Live Execution Constraint Guard

- `GAP-OSS-LIVE-CONSTRAINT-001`: **Closed in this slice.** The module start-constraint helper could return `allowed: true` for Atomic live execution (`dryRun:false`) or SharpHound collection when caller-supplied approval metadata was present, even though the current PRD/safety boundary keeps Atomic live and SharpHound collection disabled. The helper now denies Atomic live and SharpHound collection before authorization checks, and denies live/non-dry-run high-impact execution with `*_live_disabled` in the current release. Governed non-executing plan/import paths remain authorization-gated.

## 2026-06-24 Threat-Feed Source-State Isolation

- `GAP-THREAT-FEED-SOURCE-STATE-ISOLATION-001`: **Closed in this slice.** The super-feed poller acceptance test forced and backed off global `ThreatIntelSourceState` rows without restoring them, making reused DB runs potentially order-dependent. The test now snapshots/restores all registered feed source-state rows and removes test-created rows that did not exist before.

## 2026-06-24 Threat-Feed Acceptance Uniqueness Hardening

- `GAP-THREAT-FEED-ACCEPTANCE-UNIQUENESS-001`: **Closed in this slice.** Threat-intel catalog, threat-feed poller, and threat-feed alert acceptance tests persisted global catalog rows with low-entropy `randomInt`-derived CVEs/domains/signup emails. The tests now use UUID-derived values so repeated local suite runs and reused databases do not collide.

## 2026-06-24 Webhook Workflow Sync Real-First Boundary

- `GAP-WEBHOOK-WORKFLOW-SYNC-REAL-FIRST-001`: **Closed in this slice.** Slack and Microsoft Teams incoming-webhook `sync()` emitted fixture `WorkflowDestination` signals in non-mock mode, which could make live readiness checks look like customer workflow evidence. Both connectors now return readiness-only results with zero assets/signals unless `mockMode` is explicitly true; live workflow proof remains tied to explicit delivery.

## 2026-06-24 Runner Reject Terminal State Guard

- `GAP-RUNNER-REJECT-TERMINAL-001`: **Closed in this slice.** `rejectRunnerTask` kept a local terminal-state list that did not include `Rejected`, so a task already closed as `Rejected` could be mutated to `DeniedByLocalPolicy`. The service now reuses `isTerminalRunnerTaskStatus`, audits `reject_after_terminal_state`, and DB-backed acceptance proves a `Rejected` task stays `Rejected`.

## 2026-06-24 Runner Artifact Terminal State Guard

- `GAP-RUNNER-ARTIFACT-TERMINAL-001`: **Closed in this slice.** Runner result submission already rejected callbacks for terminal task states, but the separate artifact upload endpoint could still accept a new evidence artifact for a completed/failed/cancelled/denied task. `uploadRunnerTaskArtifact` now fails closed with `runner_task_invalid_state`, writes a `runner.task.rejected` audit reason `artifact_after_terminal_state`, and does not create evidence for terminal tasks.

## 2026-06-24 Audit Action Contract Guard

- `GAP-AUDIT-ACTION-CONTRACT-001`: **Closed in this slice.** Recent audit-completeness work added new public audit actions and Prisma enum values independently, creating a risk that future action additions could update shared schemas without updating runtime mapping or database enum values. `apps/api/src/audit-action-contract.test.ts` now fails if `AuditEventActionSchema`, `AUDIT_ACTION_TO_DB`, and the Prisma `AuditEventAction` enum drift.

## 2026-06-24 Remediation Ticket Audit Separation

- `GAP-REMEDIATION-TICKET-AUDIT-001`: **Closed in this slice.** Remediation ticket/workflow delivery reused `remediation.created`, conflating fix-task creation with operational routing. The API now writes public action `remediation.ticket.created` mapped to the existing DB enum `remediation_ticket_created`; workflow acceptance tests assert the distinct ticket-routing audit action and metadata.

## 2026-06-24 Remediation Ready Audit

- `GAP-REMEDIATION-READY-AUDIT-001`: **Closed in this slice.** `POST /api/v1/remediations/:id/mark-ready-for-verification` changed proof-loop state to `VerificationPending` without an audit event. The service now writes `remediation.ready_for_verification` with prior status, current status, related path, ticket metadata, tenant, actor, and remediation ID. API-first acceptance reads the public audit log after the transition and verifies the event.

## 2026-06-24 Runner Completion Evidence Requirement

- `GAP-RUNNER-COMPLETED-EVIDENCE-001`: **Closed in this slice.** Successful runner result ingestion could previously accept `Completed` with an empty evidence manifest, letting in-network validation findings and fix-verification events update without uploaded proof. `submitRunnerTaskResult` now rejects proofless completion with `runner_result_evidence_required` and a runner rejection audit before state mutation. The TypeScript runner-agent now uploads a normalized runner-result artifact before submitting a successful result and sends local verification/scope denials as `Failed` with an error summary instead of the unsupported `Denied` status.

## 2026-06-24 Runner Result Terminal State Contract

- `GAP-RUNNER-RESULT-STATUS-001`: **Closed in this slice.** `RunnerTaskResultSchema` previously reused the broad validation-run status enum, so a runner result callback could carry `Queued`, `Running`, `DeniedByPolicy`, `RequiresApproval`, or `Cancelled` into result ingestion. The shared schema now accepts only `Completed` or `Failed`, the runner service includes a fail-closed invalid-status rejection/audit path for runtime callers, and public API acceptance proves a non-terminal `Running` result returns 400 while leaving validation run, runner task, mission, evidence, signals, graph, and fix-verification state untouched.

## 2026-06-24 Worker Fixture Target Defense

- `GAP-WORKER-FIXTURE-TARGET-001`: **Closed in this slice.** API mission and engagement services rejected production fixture/mock target hints, but the asynchronous worker itself would still execute a queued validation run whose persisted target contained `fixture*` or `mockMode` keys. The detector now lives in `packages/shared` and is used by API guards plus the worker. `createMissionExecutionProcessor` defaults to fail-closed, marks the run/mission failed, and throws before module execution, evidence creation, signal persistence, graph projection, or module-executed audit success. Production worker construction allows fixtures only with `PERISCAN_DEV_MODE=true`; dev/test processors must opt in explicitly.

## 2026-06-24 Model Gateway Tool Input Boundary

- `GAP-MODEL-GATEWAY-TOOL-INPUT-001`: **Closed in this slice.** Model gateway tool requests persisted caller/model-supplied arguments as `inputPayloadRedacted` without enforcing the tool catalog's `additionalProperties: false` / required / type/range/UUID constraints, and without actually redacting secret-like values before storage. `createGatewayToolRequest` now prepares inputs centrally: invalid or undeclared arguments fail with `invalid_tool_input` before any `ModelToolRequest` row is created, canonical input is hashed, and persisted/API-visible input payloads are redacted. Acceptance coverage proves hidden `fixtureMode` arguments are rejected with no persisted row and an accidentally pasted GitHub token in a valid rationale is absent from API/DB-visible payloads.

## 2026-06-24 Engagement Fixture Target Guard

- `GAP-ENGAGEMENT-TARGET-FIXTURE-PROD-001`: **Closed in this slice.** Production autonomous engagement plan targets could carry caller-supplied fixture/mock hints into `executeInlineValidation` because the mission target guard was local to mission policy/start services. `runEngagement` now uses the shared recursive fixture-target guard and rejects `fixture*` / `mockMode` plan target keys with `fixture_mode_disabled` before persistence, validation execution, evidence writes, or queue interaction. Acceptance coverage proves no engagement, validation run, or evidence artifact is written on denial.

## 2026-06-24 Threat Correlation Evidence Gate

- `GAP-THREAT-CORRELATION-EVIDENCE-001`: **Closed in this slice.** Tenant-wide threat-advisory correlation was documented as "correlate to validation evidence" but `countCorrelatedThreatAdvisories` loaded completed runs even when `evidenceIds` was empty. The counter now requires evidence IDs, matching per-advisory readiness/exposure assessment. Acceptance coverage proves a matching completed run without evidence does not inflate `correlatedThreatAdvisoryCount`, while evidence-backed CVE and ATT&CK technique matches still correlate, including older technique matches outside the bounded recency scan.

## 2026-06-24 OSS Current Phase Canonicalization

- `GAP-OSS-CURRENT-PHASE-CANONICAL-001`: **Closed in this slice.** The public API/CLI already serialized current OSS toolchain data as `Current`, but the registry definitions and default filters still used legacy `CurrentMvp` internally. Canonical tool and capability phases now use `Current`; module, API, and CLI filters normalize legacy `CurrentMvp` input to `Current`; tests prove default catalog output contains no `CurrentMvp` capability phases while legacy `phase=CurrentMvp` continues to return the same current tool set.
- `GAP-OSS-CURRENT-WORKSTREAM-ALIGNMENT-001`: **Closed in this slice.** The active OSS workstream marked OSV, promptfoo, PyRIT, and Atomic control-validation content as current, but `tools:list/check --phase=Current` omitted them because tool definitions still used `NearTerm`. Current tool definitions now include `gitleaks`, `nuclei`, `nuclei-templates`, `trivy`, `osv-scanner`, `prowler`, `promptfoo`, `pyrit`, `atomic-red-team`, and `invoke-atomicredteam`; Garak, OpenCTI, Sigma, OCSF, and runner-adjacent network tools remain `NearTerm`.
- `GAP-OSS-OSV-CURRENT-RUNTIME-001`: **Closed in this slice.** OSV was current after the workstream alignment but still resolved as missing because it only declared a host binary runtime. OSV now declares the official `ghcr.io/google/osv-scanner` Docker image with binary fallback, so `pnpm tools:check -- --phase=Current` reports `osv-scanner | available | docker | image=ghcr.io/google/osv-scanner:v2.3.0` when Docker is available.

## 2026-06-24 OSS Current Phase Readiness Docs

- `GAP-OSS-CURRENT-PHASE-DOC-DRIFT-001`: **Closed in this slice.** Active production-readiness docs and the OSS workstream index still referenced the legacy `CurrentMvp` phase even though the API, CLI, Registry Center, and toolchain checks now serialize the customer-ready phase as `Current`. Root/docs production-readiness commands now use `pnpm tools:check -- --phase=Current`, active OSS table entries use `Current`, the Customer Agent traceability row matches, and `tests/modules/open-source-workstream-docs.test.ts` rejects `CurrentMvp` in the active workstream index. Legacy `CurrentMvp` remains documented only as a backward-compatible API/CLI input alias.

## 2026-06-23 Jira Mock Shortcut Production Guard

- `GAP-JIRA-MOCK-SHORTCUT-PROD-001`: **Closed in this slice.** The generic production mock-integration guard already rejected fixture connector creation through `createIntegration`, but the dedicated `POST /api/v1/integrations/jira/mock-connect` shortcut was not route-specifically covered. `tests/acceptance/api-edge-regressions.test.ts` now asserts that the shortcut returns `fixture_mode_disabled` in production mode and persists no integration record.

## 2026-06-23 Primary Navigation Contract Drift Guard

- `GAP-WEB-NAV-CONTRACT-DRIFT-001`: **Closed in this slice.** The prior browser route coverage derived E2E and axe coverage from `APP_NAV_ITEMS`, but no unit contract proved every static `apps/web/app/**/page.tsx` route was registered in that navigation contract. `apps/web/src/lib/app-navigation.test.ts` now discovers static page routes, excludes API handlers, compares them with `APP_NAV_ITEMS`, rejects duplicate/dead nav links, and explicitly records `/snapshots/[id]` as dynamic E2E-covered. Focused web tests, typecheck, lint, `git diff --check`, and full `pnpm verify` pass.

## 2026-06-23 Full Product Route Coverage

- `GAP-WEB-ROUTE-COVERAGE-001`: **Closed in this slice.** Browser shell and axe release gates no longer cover only a subset of customer-visible product routes. The route contract now lives in `apps/web/src/lib/app-navigation.ts`, and `tests/e2e/web-app-shell.spec.ts` plus `tests/e2e/web-accessibility.spec.ts` derive coverage from that same contract. The focused Playwright gate passes 41 tests and verifies active route state, breadcrumbs, complete primary navigation links, mobile overflow containment, and WCAG A/AA axe coverage for every static primary route plus the dynamic Snapshot report route. Full `pnpm verify` now passes with E2E 42/42, security 22/22, and acceptance 100 files / 122 tests.

## 2026-06-23 Fixture Mission Target Guard

- `GAP-MISSION-TARGET-FIXTURE-PROD-001`: **Closed in this slice.** Production policy-preview and mission-start APIs no longer accept fixture/mock target hints that could reach module execution. The validation service recursively rejects keys like `fixtureMode`, `fixtureOutcome`, `fixtureReportPath`, and `mockMode` with `fixture_mode_disabled` before policy decisions, validation runs, jobs, or module execution are created.
- `GAP-ACCEPTANCE-THREAT-FEED-DEDUPE-001`: **Closed in this slice.** The threat-feed alert acceptance test no longer assumes global catalog rows are newly created in reused local databases; it resolves canonical item IDs from the database before correlation and uses a lower-collision CIDR fixture.

## 2026-06-23 Mock Integration Dev-Mode Guard

- `GAP-INTEGRATION-MOCK-PROD-001`: **Closed in this slice.** Production-mode `POST /api/v1/integrations` no longer creates fixture/mock integrations. The API rejects `mockMode: true` and `authType: "mock"` with `fixture_mode_disabled` before persistence; dev-mode mock integrations remain available for deterministic tests and local fixture-lab flows.

## 2026-06-23 Control Validation Fixture Verdict Guard

- `GAP-CONTROL-VALIDATION-FIXTURE-PROD-001`: **Closed in this slice.** Production-mode control validation no longer accepts caller-supplied synthetic observer verdicts. `validateControlSource` rejects `fixtureOutcome` outside API dev mode with `fixture_mode_disabled` before observer/module execution, validation-run writes, or control-source health updates; the public API acceptance regression proves the denial leaves validation runs and control-source state unchanged.

## 2026-06-23 Scope Posture Fixture Mode Guard

- `GAP-SCOPE-POSTURE-FIXTURE-PROD-001`: **Closed in this slice.** Production-mode scope posture checks no longer accept fixture execution requests or fixture payloads silently. `runScopePostureChecks` rejects `executionMode: "Fixture"` / fixture data outside API dev mode with `fixture_mode_disabled` before measured modules run, and the public API acceptance regression proves no validation runs or posture cadence updates are written on denial.

## 2026-06-23 Domain Scope DNS Verification

- `GAP-SCOPE-VERIFY-DEV-BYPASS-001`: **Closed in this slice.** The Scope verification API no longer supports only dev-mode manual verification, and the Workspace no longer calls verification with `devModeManual: true` by default. Domain/Subdomain verification now resolves `_periscan.<scope>` TXT records containing the generated tenant token; dev manual verification remains guarded by `PERISCAN_DEV_MODE`; and pending scope cards show the exact DNS TXT record before verification.

## 2026-06-23 AI Validation Real-First API Boundary

- `GAP-AI-VALIDATION-FIXTURE-DEFAULT-001`: **Closed in this slice.** The AI application validation API no longer defaults customer-visible requests to fixture-backed outcomes. Omitted execution mode now defaults to `LiveSafe`, `fixtureOutcome` is rejected unless `executionMode: "Fixture"` is explicit, fixture AI validation is rejected outside API dev mode, and live-safe module targets no longer receive synthetic fixture outcomes. Default benign endpoint probes remain `Inconclusive` and preserve requested validation category metadata.

## 2026-06-23 Controlled Tooling Smoke Runbook Cleanup

- `GAP-DOC-OFFENSIVE-SMOKE-SAFETY-001`: **Closed in this slice.** The old offensive live-smoke runbook no longer presents live offensive/adversarial execution as current first-customer smoke criteria. `docs/OFFENSIVE_KIT_LIVE_SMOKE.md` now requires image/runtime readiness, outbound runner signed-task polling, passive/non-invasive evidence, denial proof for disabled live/high-impact paths, and kill-switch checks, while keeping ServiceViaProxy logical-channel work, live SQL injection probing, credential spray, Kerberos enumeration, Metasploit, SharpHound, Caldera live, Atomic live, Impacket, Responder, and Pacu out of production smoke unless a later approved PRD/legal/security release enables them.

## 2026-06-23 Deployment Guide Runner Boundary Cleanup

- `GAP-DOC-DEPLOY-RUNNER-BOUNDARY-001`: **Closed in this slice.** The production deployment guide no longer presents reverse-tunnel/offensive-kit wording as production-live capability. `docs/DEPLOY.md` now matches the signed-task runner boundary: outbound HTTPS polling, no inbound listener, no reverse SSH/arbitrary tunnel, verified-scope and policy-decision gates, and explicit non-enablement of live Caldera, SharpHound collection, credential-spray, exploitation, or arbitrary tunneling. The runner-agent Dockerfile header comment now matches the same boundary.

## 2026-06-23 Current Readiness Wording Cleanup

- `GAP-DOC-CURRENT-READINESS-WORDING-001`: **Closed in this slice.** Root docs and historical coordination notes no longer present implemented report/share/feed surfaces as old MVP or future work. `README.md` uses current product OSS toolchain language, `docs/PRODUCT_COMPLETION_PLAN.md` marks report/evidence export/share and public API parity as implemented, `docs/ROADMAP.md` uses first-customer surface wording, and historical `.ai` notes now clarify that public feed ingestion is implemented while commercial/private feed onboarding remains customer/business-gated.

## 2026-06-23 Connector Category Acceptance Rollup

- `GAP-P1-002`: **Closed by grouped connector-category acceptance.** The active connector expansion gap is now covered for every currently connectable catalog category through DB-backed public API acceptance tests: `Code` (`tests/acceptance/code-devsecops-connectors-flow.test.ts`), `Cloud` (`tests/acceptance/cloud-connectors-flow.test.ts`), `SecurityControl` (`tests/acceptance/security-control-connectors-flow.test.ts`), `Identity` (`tests/acceptance/identity-connectors-flow.test.ts`), `Ticketing` workflow destinations (`tests/acceptance/*-workflow-flow.test.ts`), `Other` (`tests/acceptance/other-connectors-flow.test.ts`), `MSSP` (`tests/acceptance/*-connector-flow.test.ts` for PSA/RMM connectors), and `AIStack` (`tests/acceptance/ai-stack-connectors-flow.test.ts` plus `tests/acceptance/ai-provider-connectors-flow.test.ts`). The suite proves API-first create/health/sync or workflow delivery, credential redaction/encryption, normalized signals/evidence, audit events, Trust & Safety visibility, and cross-tenant denial. Real customer live use still requires customer credentials, verified scope, and external provider setup.

## 2026-06-23 Other Connector Acceptance Coverage

- `GAP-CONNECTOR-OTHER-ACCEPTANCE-001`: **Closed in this slice.** Every currently connectable Other-category manifest now has DB-backed acceptance coverage through public API routes, not only connector unit tests and app route tests. `tests/acceptance/other-connectors-flow.test.ts` signs up a tenant, dynamically creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared secret storage, refreshes health, syncs read-only threat-intelligence, security-rating, and compliance-evidence context through `/api/v1/integrations/:id/sync`, verifies normalized signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.

## 2026-06-23 Security Control Connector Acceptance Coverage

- `GAP-CONNECTOR-SECURITY-CONTROL-ACCEPTANCE-001`: **Closed in this slice.** Every currently connectable SecurityControl-category manifest now has DB-backed acceptance coverage through public API routes, not only connector unit tests and app route tests. `tests/acceptance/security-control-connectors-flow.test.ts` signs up a tenant, dynamically creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared/generated secret storage, refreshes health, syncs read-only EDR/XDR, SIEM, SOAR, WAF, firewall, email-security, SASE/SSE, deception, BAS, NDR, API-security, DSPM, segmentation, OT/IoT, exposure, and control-observer context through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence where emitted, normalized signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial. The slice also closes `GAP-CONNECTOR-CISCO-UMBRELLA-KEYID-ENCRYPTION-001` by marking Cisco Umbrella API key IDs as secret in `packages/connectors/src/index.ts`, preventing key IDs from being stored plaintext.

## 2026-06-23 Cloud Connector Acceptance Coverage

- `GAP-CONNECTOR-CLOUD-ACCEPTANCE-001`: **Closed in this slice.** Every currently connectable Cloud-category manifest now has DB-backed acceptance coverage through public API routes, not only connector unit tests and app route tests. `tests/acceptance/cloud-connectors-flow.test.ts` signs up a tenant, dynamically creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared/generated secret storage, refreshes health, syncs read-only cloud, Kubernetes, edge, workload, data-platform, posture, exposure, and control context through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence where emitted, normalized signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.

## 2026-06-23 Identity Connector Acceptance Coverage

- `GAP-CONNECTOR-IDENTITY-ACCEPTANCE-001`: **Closed in this slice.** Every currently connectable Identity-category manifest now has DB-backed acceptance coverage through public API routes, not only connector unit tests and app route tests. `tests/acceptance/identity-connectors-flow.test.ts` signs up a tenant, dynamically creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared/generated secret storage, refreshes health, syncs read-only identity/MFA/PAM/IGA/MDM/machine-identity context through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence where emitted, normalized identity/control/asset signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial. The slice also closes `GAP-CONNECTOR-GENERATED-KEYPAIR-ENCRYPTION-001` by marking generated key-pair connector API key identifiers as secret in `packages/connectors/src/market-leaders.ts`, preventing redacted API key identifiers from being stored plaintext.

## 2026-06-23 VM/EAP/ASM/CNAPP Connector Acceptance Coverage

- `GAP-CONNECTOR-EXPOSURE-SOURCE-ACCEPTANCE-001`: **Closed in this slice.** Tenable, Rapid7 InsightVM, Wiz, Prisma Cloud, Lacework/FortiCNAPP, Orca Security, Qualys VMDR, runZero, Assetnote, Axonius, Armis, and Cortex Xpanse now have DB-backed acceptance coverage through public API routes, not only connector unit tests and app route tests. `tests/acceptance/exposure-connectors-flow.test.ts` signs up a tenant, creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared secret storage, refreshes health, syncs read-only vulnerability-management/CNAPP/ASM/CAASM context through `/api/v1/integrations/:id/sync`, verifies tenant asset persistence, normalized exposure/control signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.

## 2026-06-23 Code/DevSecOps Connector Acceptance Coverage

- `GAP-CONNECTOR-CODE-DEVSECOPS-ACCEPTANCE-001`: **Closed in this slice.** GitLab, Bitbucket, Azure DevOps, Buildkite, CircleCI, Jenkins, Docker Hub, GitHub Container Registry, and AWS ECR now have DB-backed acceptance coverage through public API routes, not only connector unit tests and app route tests. `tests/acceptance/code-devsecops-connectors-flow.test.ts` signs up a tenant, creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared secret storage, refreshes health, syncs read-only repository/CI/CD/container context through `/api/v1/integrations/:id/sync`, verifies normalized repository/pipeline/container signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.

## 2026-06-23 AI Provider Connector Acceptance Coverage

- `GAP-CONNECTOR-AI-PROVIDER-ACCEPTANCE-001`: **Closed in this slice.** OpenAI, Anthropic, Azure OpenAI, Azure AI Search, Chroma, and AWS Bedrock now have DB-backed acceptance coverage through public API routes, not only connector unit tests and route-level tests. `tests/acceptance/ai-provider-connectors-flow.test.ts` signs up a tenant, creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared secret storage, refreshes health, syncs read-only AI provider/vector/search context through `/api/v1/integrations/:id/sync`, verifies normalized AI application signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.

## 2026-06-23 AI Stack Connector Acceptance Coverage

- `GAP-CONNECTOR-AI-STACK-ACCEPTANCE-001`: **Closed in this slice.** Vertex AI, Pinecone, Weaviate, LangChain, LlamaIndex, Guardrails AI, and Lakera Guard now have DB-backed acceptance coverage through public API routes, not only connector unit tests and route-level tests. `tests/acceptance/ai-stack-connectors-flow.test.ts` signs up a tenant, creates explicit fixture/lab integrations with non-mock auth types where credential encryption should be exercised, proves response redaction and encrypted manifest-declared secret storage, refreshes health, syncs read-only AI-stack context through `/api/v1/integrations/:id/sync`, verifies normalized AI application/control signal and evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.

## 2026-06-23 Threat Intelligence Connector Acceptance Coverage

- `GAP-CONNECTOR-THREAT-INTEL-ACCEPTANCE-001`: **Closed in this slice.** AlienVault OTX, Recorded Future, and Mandiant Advantage now have DB-backed acceptance coverage through public API routes, not only connector unit tests and app route tests. `tests/acceptance/threat-intel-connectors-flow.test.ts` signs up a tenant, creates explicit fixture/lab integrations with provider credentials, proves response redaction and encrypted secret storage, refreshes health, syncs read-only enrichment context through `/api/v1/integrations/:id/sync`, verifies normalized exposure signal/evidence persistence, checks `integration_connected`/`integration_synced` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration read/sync denial.

## 2026-06-23 Jira Workflow Acceptance Coverage

- `GAP-WORKFLOW-JIRA-ACCEPTANCE-001`: **Closed in this slice.** The Beta Jira workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests, app route tests, and broad E2E coverage. `tests/acceptance/jira-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Jira integration with an API token, proves response redaction and encrypted token storage, refreshes health, syncs ticket-state context through `/api/v1/integrations/:id/sync`, verifies normalized remediation signal/evidence, creates a remediation ticket through `/api/v1/remediations/:id/create-ticket`, verifies Jira delivery metadata on the remediation, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.

## 2026-06-23 Microsoft Teams Workflow Acceptance Coverage

- `GAP-WORKFLOW-MICROSOFT-TEAMS-ACCEPTANCE-001`: **Closed in this slice.** The Beta Microsoft Teams workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests and in-memory create-redaction tests. `tests/acceptance/microsoft-teams-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Microsoft Teams integration with an incoming webhook URL, proves response redaction and encrypted webhook storage, refreshes health, syncs workflow-destination context through `/api/v1/integrations/:id/sync`, verifies normalized audit signal/evidence, sends a remediation notification through `/api/v1/remediations/:id/create-ticket`, verifies Microsoft Teams delivery metadata on the remediation with the generic remediation ticket ID fallback, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-notification denial.

## 2026-06-23 Slack Workflow Acceptance Coverage

- `GAP-WORKFLOW-SLACK-ACCEPTANCE-001`: **Closed in this slice.** The Beta Slack workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests and in-memory create-redaction tests. `tests/acceptance/slack-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Slack integration with an incoming webhook URL, proves response redaction and encrypted webhook storage, refreshes health, syncs workflow-destination context through `/api/v1/integrations/:id/sync`, verifies normalized audit signal/evidence, sends a remediation notification through `/api/v1/remediations/:id/create-ticket`, verifies Slack delivery metadata on the remediation with the generic remediation ticket ID fallback, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-notification denial.

## 2026-06-23 Opsgenie Workflow Acceptance Coverage

- `GAP-WORKFLOW-OPSGENIE-ACCEPTANCE-001`: **Closed in this slice.** The Beta Opsgenie workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests and in-memory create-redaction tests. `tests/acceptance/opsgenie-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Opsgenie integration with an API key, proves response redaction and encrypted key storage, refreshes health, syncs alert-state context through `/api/v1/integrations/:id/sync`, verifies normalized remediation signal/evidence, routes a remediation alert through `/api/v1/remediations/:id/create-ticket`, verifies Opsgenie metadata on the remediation, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.

## 2026-06-23 PagerDuty Workflow Acceptance Coverage

- `GAP-WORKFLOW-PAGERDUTY-ACCEPTANCE-001`: **Closed in this slice.** The Beta PagerDuty workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests and in-memory create-redaction tests. `tests/acceptance/pagerduty-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab PagerDuty integration with an Events API routing key, proves response redaction and encrypted key storage, refreshes health, syncs incident-state context through `/api/v1/integrations/:id/sync`, verifies normalized remediation signal/evidence, routes a remediation incident through `/api/v1/remediations/:id/create-ticket`, verifies PagerDuty metadata on the remediation, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.

## 2026-06-23 Linear Workflow Acceptance Coverage

- `GAP-WORKFLOW-LINEAR-ACCEPTANCE-001`: **Closed in this slice.** The Beta Linear workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests and in-memory create-redaction tests. `tests/acceptance/linear-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Linear integration with an API key, proves response redaction and encrypted key storage, refreshes health, syncs issue-state context through `/api/v1/integrations/:id/sync`, verifies normalized remediation signal/evidence, creates a remediation issue through `/api/v1/remediations/:id/create-ticket`, verifies Linear metadata on the remediation, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.

## 2026-06-23 GitHub Issues Workflow Acceptance Coverage

- `GAP-WORKFLOW-GITHUB-ISSUES-ACCEPTANCE-001`: **Closed in this slice.** The Beta GitHub Issues workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests and in-memory create-redaction tests. `tests/acceptance/github-issues-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab GitHub Issues integration with a PAT, proves response redaction and encrypted token storage, refreshes health, syncs ticket-state context through `/api/v1/integrations/:id/sync`, verifies normalized remediation signal/evidence, creates a remediation issue through `/api/v1/remediations/:id/create-ticket`, verifies GitHub Issues metadata on the remediation, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.

## 2026-06-23 ServiceNow Workflow Acceptance Coverage

- `GAP-WORKFLOW-SERVICENOW-ACCEPTANCE-001`: **Closed in this slice.** The Beta ServiceNow workflow destination now has DB-backed acceptance coverage through public API routes, not only connector unit tests and in-memory create-redaction tests. `tests/acceptance/servicenow-workflow-flow.test.ts` signs up a tenant, creates an explicit fixture/lab ServiceNow integration with basic auth, proves response redaction and encrypted password storage, refreshes health, syncs ticket-state context through `/api/v1/integrations/:id/sync`, verifies normalized remediation signal/evidence, creates a remediation ticket through `/api/v1/remediations/:id/create-ticket`, verifies ServiceNow ticket metadata on the remediation, checks `integration_connected`/`integration_synced`/`remediation_created` audit details, confirms Trust & Safety visibility, and proves cross-tenant integration and remediation-ticket denial.

## 2026-06-23 ConnectWise Manage Acceptance Coverage

- `GAP-P1-002-CONNECTWISE-MANAGE-ACCEPTANCE-001`: **Closed in this slice.** The Beta ConnectWise Manage connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/connectwise-manage-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab ConnectWise Manage integration with API-key credentials, proves response redaction and encrypted public/private key storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted PSA company assets, normalized ConnectWise company/ticket/open-ticket signals, normalized-evidence artifact metadata, `integration_connected`/`integration_synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-23 Syncro Acceptance Coverage

- `GAP-P1-002-SYNCRO-ACCEPTANCE-001`: **Closed in this slice.** The Beta Syncro connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and the broader MVP remediation-ticket flow. `tests/acceptance/syncro-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Syncro integration with an API token, proves response redaction and encrypted API-token storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted RMM/PSA customer and host assets, normalized Syncro customer/asset/offline-asset/ticket/open-ticket signals, normalized-evidence artifact metadata, `integration_connected`/`integration_synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-23 Autotask Acceptance Coverage

- `GAP-P1-002-AUTOTASK-ACCEPTANCE-001`: **Closed in this slice.** The Beta Autotask connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/autotask-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Autotask integration with API-user credentials, proves response redaction and encrypted API integration-code/secret storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted PSA company assets, normalized Autotask company/ticket/open-ticket signals, normalized-evidence artifact metadata, `integration_connected`/`integration_synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-23 HaloPSA Acceptance Coverage

- `GAP-P1-002-HALOPSA-ACCEPTANCE-001`: **Closed in this slice.** The Beta HaloPSA connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/halopsa-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab HaloPSA integration with OAuth client credentials, proves response redaction and encrypted client-secret storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted PSA client assets, normalized HaloPSA client/ticket/open-ticket signals, normalized-evidence artifact metadata, `integration_connected`/`integration_synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-23 NinjaOne Acceptance Coverage

- `GAP-P1-002-NINJAONE-ACCEPTANCE-001`: **Closed in this slice.** The Beta NinjaOne connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/ninjaone-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab NinjaOne integration with `accessToken`, proves response redaction and encrypted access-token storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted RMM organization/device assets, normalized NinjaOne organization/device/offline-device/alert/critical-open-alert signals, normalized-evidence artifact metadata, `integration_connected`/`integration_synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-23 Threat Feed Acceptance Timeout Stability

- `GAP-ACCEPTANCE-THREAT-FEED-TIMEOUT-001`: **Closed in this slice.** Full `pnpm verify` could fail the continuous threat-feed schedule acceptance test under full-suite load because `tests/acceptance/threat-feed-schedule-flow.test.ts` hard-coded a narrower `30_000` ms timeout while the acceptance suite is configured with `--testTimeout=60000`. The test now uses `60_000` ms, preserving the same system-sweep behavior while aligning with the actual suite gate. Focused acceptance and full verify both pass with local compose dependencies running on Postgres port `5434`.

## 2026-06-21 N-able N-central Acceptance Coverage

- `GAP-P1-002-NCENTRAL-ACCEPTANCE-001`: **Closed in this slice.** The Beta N-able N-central connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/n-able-ncentral-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab N-central integration with `apiToken`, proves response redaction and encrypted access-token/JWT storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted RMM customer/device assets, normalized N-central customer/device/offline-device/active-issue signals, normalized-evidence artifact metadata, `integration.connected`/`integration.synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-21 Datto RMM Acceptance Coverage

- `GAP-P1-002-DATTO-RMM-ACCEPTANCE-001`: **Closed in this slice.** The Beta Datto RMM connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/datto-rmm-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Datto RMM integration with `apiKey`, proves response redaction and encrypted API-key/API-secret storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted RMM site/device assets, normalized Datto site/device/offline-device signals, normalized-evidence artifact metadata, `integration.connected`/`integration.synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-21 Kaseya VSA Acceptance Coverage

- `GAP-P1-002-KASEYA-VSA-ACCEPTANCE-001`: **Closed in this slice.** The Beta Kaseya VSA connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/kaseya-vsa-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab VSA integration with `apiKey`, proves response redaction and encrypted access-token storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted RMM host assets, normalized VSA asset/agent/offline-agent signals, normalized-evidence artifact metadata, `integration.connected`/`integration.synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-21 ConnectWise Automate Acceptance Coverage

- `GAP-P1-002-CONNECTWISE-AUTOMATE-ACCEPTANCE-001`: **Closed in this slice.** The Beta ConnectWise Automate connector now has DB-backed acceptance coverage through the public API, not only connector unit tests and in-memory route tests. `tests/acceptance/connectwise-automate-connector-flow.test.ts` signs up a tenant, creates an explicit fixture/lab Automate integration with `basicAuth`, proves response redaction and encrypted credential storage, refreshes health, syncs through `/api/v1/integrations/:id/sync`, verifies persisted RMM client/computer assets, normalized Automate signals, normalized-evidence artifact metadata, `integration.connected`/`integration.synced` audit details, Trust & Safety visibility, and cross-tenant read/sync denial.

## 2026-06-21 Report List Response Bounding

- `GAP-REPORT-LIST-LIMIT-001`: **Closed in this slice.** `GET /api/v1/reports` was still an unbounded tenant report history endpoint while evidence and threat advisories already had optional `?limit` support. Reports now use the same backward-compatible pattern: no limit returns all reports, supplied limits are clamped, and capped responses return newest-first tenant-scoped evidence packs. Route tests, typed web client tests, and DB acceptance coverage are in place.

## 2026-06-21 CTEM Program Provenance

- `GAP-CTEM-PROVENANCE-001`: **Closed in this slice.** CTEM summaries previously returned the same shape whether generated from an actual Validation Snapshot or synthesized from current tenant state when no Snapshot existed. `CTEMProgramSummary` now exposes `source` and `snapshotId`; `/api/v1/ctem/program` returns `LiveTenantStateBaseline` with `snapshotId: null` for no-snapshot tenants and `Snapshot` with the backing ID after Snapshot generation; Validation Ops and CTEM report rendering disclose the source so baseline state is not product-visible proof.

## 2026-06-21 Integration Health Refresh UX

- `GAP-P1-005`: **Closed in this slice with the missing refresh-health behavior.** Integration Marketplace connected cards now show persisted health and last-sync values plus API-backed `Sync now` and `Refresh health` actions. Trust & Safety connected systems now expose connector-specific `Sync`, `Refresh health`, and `Disconnect` actions. The UI calls the existing versioned integration APIs and reloads tenant-scoped state after success, so connected items do not remain product-visible stale `Unknown` / `Never synced` records when an operator explicitly checks liveness.

## 2026-06-21 ConnectWise Automate Connector Productization

- `GAP-CONNECTOR-CONNECTWISE-AUTOMATE-PLANNED-001`: **Closed in this slice.** ConnectWise Automate was still a planned/non-connectable MSSP/RMM catalog seed while adjacent RMM integrations were implemented. It is now a Beta connectable connector with fixture mode, live read-only REST client/computer/alert inventory, normalized client/computer/offline-computer/alert/critical-open-alert evidence signals, MSSP/RMM assets, mutation-path denial for Automate scripts, agent procedures, commands, patch jobs, remote-control, file/log retrieval, ticket mutation, client/computer mutation, and system configuration writes, generated integration docs, and connector/API/docs regression coverage.

## 2026-06-21 Fixture Connector Shortcut Truthfulness

- `GAP-WEB-FIXTURE-CONNECTOR-DEFAULT-001`: **Closed in this slice.** Primary customer-facing web surfaces no longer expose fixture/mock connector setup by default. `SnapshotWorkbench` and `IntegrationMarketplace` hide fixture connector shortcuts unless `NEXT_PUBLIC_PERISCAN_ENABLE_FIXTURE_CONNECTORS=true` or a test/lab prop explicitly enables them; default copy points operators to live API/connector onboarding. Component tests now cover default-hidden and explicit-lab-enabled behavior. The API-first fixture paths remain available for deterministic tests and demo seeding.
- `GAP-DOC-FIXTURE-CONNECTOR-STATUS-DRIFT-001`: **Closed in this follow-up.** `docs/IMPLEMENTATION_STATUS.md` still described default Integration Marketplace setup as mock connector setup after the product change. It now describes explicit fixture-lab setup, default hidden fixture shortcuts, and live/API onboarding consistently.

## 2026-06-21 Runner Contract Truthfulness

- `GAP-RUNNER-CONTRACT-TRUTHFULNESS-001`: **Closed in this slice.** Go runner code/docs still described DNS/TLS/HTTP checks as future seams and the runner README listed measured/discovery task dispatch without distinguishing that those endpoints target the TypeScript runner-agent AgentLocal framework. The docs/code comments now clearly separate implemented Go runner modules from runner-agent dispatch endpoints, the runner spec API surface is complete, and `pnpm test:runner:deploy` fails if stale future-seam wording or the Go/runner-agent boundary regresses.

## 2026-06-21 Runner Agent Offensive Default-Deny

- `GAP-RUNNER-AGENT-OFFENSIVE-DEFAULT-ALLOWLIST-001`: **Closed in this slice.** The TypeScript runner-agent default local allowlist included offensive AgentLocal module IDs (`identity.cred_spray`, `identity.kerberos_userenum`, `exploit.metasploit_check`) even though default safety levels denied them. Those IDs are no longer in the default local allowlist; explicit deployment-time opt-in is preserved for approved environments, and tests/docs now prove first-customer runner-agent deployments default-deny offensive modules locally.

## 2026-06-21 Model Gateway Specialized Provider Fail-Closed

- `GAP-MODEL-GATEWAY-SPECIALIZED-PROVIDER-PLACEHOLDER-001`: **Closed in this slice.** The model gateway exposed `SpecializedCyberModel` as a selectable provider type even though the adapter intentionally fails closed for a future provider. Customer creation is now blocked through the API, the web selector omits it, the internal adapter remains fail-closed, and regression coverage prevents the future-provider extension point from looking like an enabled customer feature.

## 2026-06-20 Integration Catalog Count Truthfulness

- `GAP-DOC-INTEGRATION-COUNT-TRUTHFULNESS-001`: **Closed in this slice.** README, product completion plan, and traceability still described the old 108-entry catalog even though generated integration docs expose 264 entries, 121 live integrations, and 143 catalog manifests. Handwritten docs now match `docs/integrations.json`, and `tests/modules/integration-docs.test.ts` fails if those counts drift again.

## 2026-06-20 Runner Deployment Safety Docs

- `GAP-RUNNER-DEPLOYMENT-DOC-SAFETY-001`: **Closed in this slice.** Runner deployment docs had three concrete drift risks: a stale absolute Kubernetes manifest link, runner README/acceptance wording that described only reachability despite DNS/TLS/HTTP checks being implemented, and `docs/PRD_SELF_CONTAINED_RUNNER.md` language that could be read as superseding the current live SharpHound/Caldera/Atomic prohibition. The docs now align with the outbound HTTPS signed-task runner, list all safe implemented internal checks, and `pnpm test:runner:deploy` fails if those docs regress. Remaining customer deployment validation is external/customer-specific: issued runner credentials, outbound firewall egress, verified internal scope, and approved windows.

## 2026-06-20 Kaseya VSA Connector Productization

- `GAP-CONNECTOR-KASEYA-VSA-PLANNED-001`: **Closed in this slice.** Kaseya VSA was still a planned/non-connectable MSSP/RMM catalog seed while adjacent RMM integrations were implemented. It is now a Beta connectable connector with fixture mode, personal-access-token live read-only asset/agent inventory, normalized asset/agent/offline-agent evidence signals, host assets, mutation-path denial for VSA procedures/jobs/patches/files/logs/remote-control/delete/rename/configuration changes, generated integration docs, and connector/API/docs regression coverage.

## 2026-06-20 Integration Docs Live Truthfulness

- `GAP-DOC-INTEGRATION-LIVE-TRUTHFULNESS-001`: **Closed in this slice.** The generated integration directory counted planned, non-connectable seed connectors as live because the generator only excluded market-leader mock manifests. `scripts/generate-integrations.ts` now requires connectable + non-`Planned` + non-market-leader status before showing a connector as live, preserves manifest availability in JSON, and has a module-doc regression proving planned connectors are not presented as live. Datto RMM, Kaseya VSA, and ConnectWise Automate were live/Beta in that slice; Oracle Cloud and Alibaba Cloud were planned/catalog-only at that time and are superseded by the newer read-only connector entries above.

## 2026-06-20 Datto RMM Connector Productization

- `GAP-CONNECTOR-DATTO-RMM-PLANNED-001`: **Closed in this slice.** Datto RMM was still a planned/non-connectable MSSP/RMM catalog seed while adjacent RMM integrations were implemented. It is now a Beta connectable connector with fixture mode, OAuth-backed live read-only device inventory, normalized site/device/offline-device evidence signals, host/site assets, mutation-path denial, generated integration docs, and connector tests covering live request shape, redaction, and parser edge cases.

## 2026-06-20 Coordination Spec Index Freshness

- `GAP-DOC-SPEC-INDEX-STALE-001`: **Closed in this slice.** `.ai/spec-index.md` still contained June 5 discovery guidance that said Threat Center feed ingestion was not implemented and MSSP/Billing/Executive was only foundation-level. Added a current addendum and corrected roadmap/assumption lines so future agents use the latest implementation state without erasing historical discovery context.

## 2026-06-20 MSSP Report Branding UI

- `GAP-MSSP-WHITELABEL-UI-001`: **Closed in this slice.** The API and report generator already supported tenant report branding, but the first-party web product only displayed child branding state in the portfolio. `/mssp` now includes an API-backed current-tenant branding form and preview using `GET/PUT /api/v1/tenants/current/branding`, with component coverage for read, edit, save, preview, and request payload behavior.

## 2026-06-20 Enterprise Entitlement Superset

- `GAP-ENT-ENTERPRISE-SUPERSET-001`: **Closed in this slice.** The Enterprise package previously had `AIApplications` and `ControlSources` meters but lacked the exact route-gated capabilities `AI app registry` and `Control source registry`, which could deny Enterprise tenants access to full-platform AI app and control-source API workflows. Enterprise is now an explicit superset of published package capabilities and meters, with API runtime tests guarding the invariant.

## 2026-06-20 Demo Scenario Breadth

- `GAP-DEMO-BREADTH-001`: **Closed in this slice.** `pnpm seed:demo` now covers the first-demo story beyond GitHub/AWS/Jira/Snapshot: Splunk mock integration, AI app safe validation, control-source dry-run missed validation, remediation tickets, and fix verification events for all seeded remediations. The seed remains service/API-backed and exits cleanly.

## 2026-06-20 Build Artifact Cleanup

- `GAP-RELEASE-DIST-CLEANUP-001`: **Closed in this slice.** Generated `dist/` directories under `apps/` and `packages/` are already ignored and untracked, but the repo lacked a repeatable cleanup command. Added root `pnpm clean:build` and `scripts/clean-build-artifacts.sh`, then ran it to remove all current generated `dist/` directories.

## 2026-06-20 Non-MSSP Responsive Metric Summaries

- `GAP-WEB-RESPONSIVE-METRICS-001`: **Closed in this slice.** The remaining non-MSSP responsive review found fixed base metric grids in API Health, Signal Activity, Findings, Validation Ops, Registry Center, and ATT&CK Catalog. These now start as `grid-cols-1` mobile layouts and expand at `sm`/`lg`, with component tests asserting the responsive classes.

## 2026-06-20 Snapshot Report Accessible States

- `GAP-SNAPSHOT-REPORT-A11Y-EMPTY-001`: **Closed in this slice.** The Snapshot report route no longer exposes the rendered HTML preview as an unnamed section or leaves an empty report API response as a dead-end panel. `apps/web/src/components/snapshot-report-view.tsx` now marks route-level API activity with `aria-busy`, gives the rendered report preview an accessible region name, and gives the empty report body state retry and workspace navigation actions. Component tests cover busy state, named report region, and actionable empty-state recovery.

## 2026-06-20 Readiness Route Coverage

- `GAP-READINESS-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer exposes database-only readiness while production reports database, queue, evidence-store, and continuous-validation sweep health. `apps/api/src/app.test.ts` now mirrors those check families and asserts them through `/api/v1/health/ready`.

## 2026-06-20 Deployment Status Route Coverage

- `GAP-DEPLOYMENT-STATUS-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns an always-ready empty deployment status. `apps/api/src/app.test.ts` now mirrors production `buildDeploymentStatus()` and tenant-admin authorization for `/api/v1/system/deployment-status`, proving required config items, missing required credential-encryption key, secret redaction, ready transition, and viewer denial.

## 2026-06-20 Due Re-Verification Route Coverage

- `GAP-DUE-REVERIFICATION-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns an empty no-op for due remediation re-verification. `apps/api/src/app.test.ts` now mirrors production behavior for `/api/v1/remediations/reverify-due`: scope-editor authorization, tenant-scoped due selection, settled-status filtering, 25-item cap, reuse of the existing fix-verification path, additional verification-event creation, no immediate repeat after an inconclusive/non-settled result, and failure rescheduling.

## 2026-06-20 Threat Feed Schedule Route Coverage

- `GAP-THREAT-FEED-SCHEDULE-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns empty/no-op threat-feed ingestion and schedule responses. `apps/api/src/app.test.ts` now imports deterministic CISA KEV-style feed entries through the same advisory/evidence/readiness path as manual imports, deduplicates repeated ingestion by tenant/feed/CVE, persists tenant-scoped schedule state, reads schedules back, no-ops before due time, advances due schedules, and verifies advisory/audit creation through `/api/v1/threat-feeds/ingest`, `/api/v1/threat-feeds/schedule`, and `/api/v1/threat-feeds/ingest-due`.

## 2026-06-20 Mission/Job Route Coverage

- `GAP-MISSION-JOB-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns empty job lists or null mission-run/job detail responses for public scheduler visibility routes. `apps/api/src/app.test.ts` now models tenant-scoped `Job` records for queued validation runs, `/api/v1/jobs` mission/status filtering, `/api/v1/jobs/:jobId` detail read-back, `/api/v1/missions/:id/runs/:runId` detail read-back, payload linkage to run/mission/tenant IDs, and cross-tenant 404 behavior.

## 2026-06-20 Account Security Route Coverage

- `GAP-ACCOUNT-SECURITY-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns static success objects for password reset, invite acceptance, email verification, or MFA operations. `apps/api/src/app.test.ts` now models hash-backed user tokens, single-use reset/verification/invite links, no-account-enumeration reset requests, password changes, invite activation, MFA secret activation, one-time recovery-code consumption, re-authenticated recovery-code rotation, re-authenticated MFA disable, login second-factor enforcement, and audit events.

## 2026-06-20 API Key Bearer Auth Route Coverage

- `GAP-API-KEY-AUTH-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer treats tenant API keys as lifecycle-only records while production supports Bearer API-key authentication. `apps/api/src/app.test.ts` now authenticates `Authorization: Bearer psk_*` requests through hash-backed in-memory keys, updates `lastUsedAt`, maps key scopes to the expected request role, ignores conflicting tenant headers for API-key tenancy, denies management routes to non-admin key scopes, rejects stale rotated secrets, and rejects revoked secrets.

## 2026-06-20 Engagement Route Coverage

- `GAP-ENGAGEMENT-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns a fake plan-only engagement, `null` reads, or empty engagement history for autonomous engagement routes. `apps/api/src/app.test.ts` now models tenant-scoped engagement run/read/list behavior, scope-editor authorization, tenant-owned scope lookup, default plans by scope type, non-executing PlanOnly previews, module safety constraints, evidence/signal creation for safe Execute steps, failed missing-module steps, status derivation, viewer denial, cross-tenant read denial, and engagement run/read audit events for `/api/v1/engagements` and `/api/v1/engagements/:id`.

## 2026-06-20 Webhook Route Coverage

- `GAP-WEBHOOK-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns empty webhook/delivery lists, synthetic webhooks, or one-off delivery IDs for tenant outbound-webhook routes. `apps/api/src/app.test.ts` now models tenant-scoped webhook lifecycle, admin authorization, one-time secret exposure, no stored/listed secret, update/delete behavior, test delivery creation, delivery filtering, dead-letter listing, viewer denial, and cross-tenant mutation denial for `/api/v1/tenants/current/webhooks`, `/api/v1/tenants/current/webhooks/:id/test`, `/api/v1/tenants/current/webhook-deliveries`, and `/api/v1/tenants/current/webhook-deliveries/dead-letter`.

## 2026-06-20 API Key Route Coverage

- `GAP-API-KEY-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns synthetic one-off API keys or empty API-key lists. `apps/api/src/app.test.ts` now models tenant-scoped API key create/list/revoke/rotate behavior, tenant-admin authorization, one-time secret exposure, no stored/listed secrets, revoked-key rotation conflict, cross-tenant mutation denial, and API-key audit events for `/api/v1/tenants/current/api-keys`.

## 2026-06-20 Policy Approval Route Coverage

- `GAP-POLICY-APPROVAL-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns empty pending-approval/policy-decision history lists or not-found approval/denial responses. `apps/api/src/app.test.ts` now models tenant-scoped policy decision history, pending approval filtering, tenant-admin authorization, approval/denial state transitions, approval-not-required conflict semantics, cross-tenant mutation denial, and approval audit events for `/api/v1/approvals/pending`, `/api/v1/policy-decisions`, `/api/v1/approvals/:policyDecisionId/approve`, and `/api/v1/approvals/:policyDecisionId/deny`.

## 2026-06-20 Real-First Web Defaults

- `GAP-REAL-FIRST-WEB-DEFAULTS-001`: **Closed in this slice.** Primary customer-facing Snapshot and Threat Center workbenches no longer prefill demo emails, passwords, tenant names, demo domains, or sample advisory content. The forms now start blank with explicit placeholders and required fields. Intentional sample content remains isolated to `/demo` and tests.

## 2026-06-20 Model Gateway Lifecycle Route Coverage

- `GAP-MODEL-GATEWAY-LIFECYCLE-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns empty policy/session/context-bundle/tool-request/audit lists or synthetic one-off Model Gateway lifecycle objects. `apps/api/src/app.test.ts` now models tenant-scoped policy profiles, sessions, context bundles, tool overrides, tool requests, audit events, approval and execution transitions, kill-switch cancellation, tenant-owned scope checks, and cross-tenant denial for `/api/v1/model-gateway/policies`, `/sessions`, `/context-bundles`, `/tools`, `/tool-requests`, `/audit-events`, and `/kill-switch`.

## 2026-06-20 Catch-Up Gap Update

- `GAP-MODEL-GATEWAY-PROVIDER-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns empty model-provider lists or synthetic one-off provider objects for `/api/v1/model-gateway/providers/*`. `apps/api/src/app.test.ts` now models provider persistence, tenant-admin mutation, credential redaction state, connection-test status updates, delete behavior, and cross-tenant read/update denial.
- `GAP-INTEGRATION-SCHEDULE-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns `501` for connector sync schedule configuration or an empty result for due recurring sync sweeps. `apps/api/src/app.test.ts` now models schedule fields, due filtering, existing sync-path reuse, schedule advancement, and cross-tenant denial for `/api/v1/integrations/:id/sync-schedule` and `/api/v1/integrations/sync-due`.
- `GAP-THREAT-FEED-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns empty super-feed responses or throws for threat-alert status updates. `apps/api/src/app.test.ts` now models threat catalog search, feed health, tenant-scoped alert listing, acknowledgement/dismissal, status filtering, and cross-tenant update denial for `/api/v1/threat-intel/*`.
- `GAP-RUNNER-ROUTE-UNIT-001`: **Closed in this slice.** The API route unit-test harness no longer returns `501` for runner check/measured/discover task creation. `apps/api/src/app.test.ts` now builds verified-scope, policy-bound, signed in-memory runner tasks for `/api/v1/runners/:id/tasks/check`, `/tasks/measured`, and `/tasks/discover`, and the runner route test asserts HTTP-health, safe measured TLS audit, non-invasive discovery, and TLS missing-port rejection.
- `GAP-OSS-005`: **Closed in this slice.** OpenCTI threat-intel context import is productized as `opencti.threat_context_import`, an API-visible PassiveReadOnly content/import module with deterministic STIX fixture coverage, redaction assertions, normalized evidence/context signals, and `validationProof:false` semantics. MISP remains explicitly blocked because the current license policy fails AGPL material closed; do not add a MISP tool definition or runtime without legal approval or an approved non-bundled parser scope.
- `GAP-CI-SSO-PRISMA-GENERATE`: **Closed in this slice.** On `codex/oidc-sso-foundation`, API typecheck failed before Prisma generation because the local generated client was stale for new SSO models and audit enum values. Root `pnpm typecheck` now runs `pnpm --filter @periscan/db run db:generate` before workspace TypeScript checks. Validation: focused shared/db/API SSO tests PASS, focused SSO acceptance PASS, `pnpm lint` PASS, root `pnpm typecheck` PASS, and `pnpm test` PASS.

## Historical Gap Addendum — 2026-06-19

This addendum superseded the stale early Open rows below at the time it was
written. It is retained for audit trace only. Evaluate active gaps from the
newest entries at the top of this file, `.ai/status.md`,
`.ai/codex-handoff.md`, `docs/IMPLEMENTATION_STATUS.md`, current code/tests,
and current GitHub state.

**Current 2026-06-27 in-repo status:** no open GitHub PRs, no active P0/P1
repo-owned backlog rows found by the latest scan on
`codex/integrate-validated-pr-stack`, and the in-repo product remains
first-customer ready subject to external/deployment decisions listed in
`.ai/release-readiness.md`.

**Closed/superseded gap classes:**

- Early P1 connector expansion/readiness rows are superseded by the 121+ connector implementation, direct PSA remediation workflow, super-feed PRs, and release-readiness audit.
- Early P1 runner deployment rows are superseded by runner deploy artifacts, CI runner publish workflow, lab/deploy validation scripts, and `.ai/release-readiness.md` audit corrections.
- Early P1/P2 web-state and accessibility rows are superseded by API-backed web surfaces, route accessibility gates, and later component tests.
- Early Threat Center "external feed" wording is superseded: manual advisory import/readiness remains implemented, and a separate public global super-feed is now implemented under `/api/v1/threat-intel/*` and `/api/v1/threat-feeds/*`.
- `GAP-P2-AI-ENDPOINT-PROBE-TRUTHFULNESS`: Closed on branch `codex/ai-endpoint-truthfulness`. Live-safe endpoint probes no longer emit nested `outcome:"Passed"` from a benign 2xx response, endpoint-probe signals are not promoted into validated findings or Snapshot AI risk lists, and real Promptfoo/PyRIT/Garak harness results still produce AI findings when evidence supports them.

**Historical in-repo gap status from 2026-06-19 (now closed/superseded):**

- `GAP-REL-001`: Closed in PR #30 and current release `v0.1.338` from the pushed `main` tip after this release-metadata update. Do not force-update older divergent tags blindly; historical tag conflicts remain an audit/reconciliation concern only.
- `GAP-DOC-001`: Closed in the 2026-06-24 historical coordination docs cleanup. Older `.ai` files still contain historical June 5 branch/agent status by design, and the top-level stale report files now self-label as historical snapshots that point agents to current authoritative coordination files.
- `GAP-REL-002`: Closed on branch `codex/ci-go-toolchain-pin`. CI now installs the Go version declared by `apps/runner/go.mod` before `pnpm verify`; local runner validation uses Go 1.22+ or falls back to the matching Docker image.
- `GAP-OSS-003`: Closed on branch `codex/oss-docker-hardening`. Docker-backed OSS module launches now enforce the container hardening profile previously marked Planned in `docs/TOOL_RUNTIME_SECURITY.md`.
- `GAP-OSS-004`: Closed and contained in `codex/integrate-validated-pr-stack`; superseded PR #36 head `f84925f` is an ancestor of the active branch. The OSS adapter spec's planned manifest extension fields are first-class, API-facing `ModuleManifestSchema` fields with derived safe defaults and certification checks for license risk, network posture, target mutation/exfiltration claims, destructive potential, sensitivity, and redaction rules. The API-backed `/registries` surface also renders those fields from `/api/v1/modules` for operator review.

**External/deployment decisions (not in-repo blockers):**

- Payment processor and checkout integration.
- SSO/SAML/OIDC live rollout decisions: API-first generic OIDC/SAML SSO is implemented in-repo (configuration, sanitized reads, OIDC public start/callback with JWKS/issuer/audience/nonce/email-domain checks, SAML SP metadata plus signed-response/request-correlation validation, provisioned-user sessions, enforced-password-login denial, password/legacy session tenant-switch denial, same-tenant SSO enforcement for cross-tenant switches, and audit). Remaining work is customer deployment/configuration of an authorized IdP, redirect URI/entity ID, OIDC client credentials or SAML IdP certificate, and any customer-specific claim conventions.
- Commercial/private threat-intel vendor, if required beyond the implemented public super-feed and existing read-only intel connectors.
- Legal/policy sign-off for live SharpHound/Caldera/Atomic/offensive workflows.
- Production hosting, secrets, managed Postgres/Redis/S3, TLS, customer credentials, verified scope, approval windows, and runner installation.

---

**Generated:** 2026-06-05T15:40:00Z
**Current note:** This is a historical discovery snapshot. The gap rows below
are retained for audit history and now include closed/superseded statuses where
later slices resolved them. Use the current closed summaries at the top of this
file, `.ai/status.md`, and `docs/IMPLEMENTATION_STATUS.md` for work selection.
**Source:** PRD.md, docs/PERISCAN_FULL_PRODUCT_PRD.md, PRODUCT_COMPLETION_PLAN.md, IMPLEMENTATION_STATUS.md, ROADMAP.md, TRACEABILITY_MATRIX.md, USER_STORIES.md, ACCEPTANCE_CRITERIA.md, PRODUCTION_READINESS.md, current code + tests + GitHub state (open PRs #1/#2), running services.
**Process:** Highest priority (P0) closed immediately with vertical slice (branch+fix+test+push+PR+docs). Then P1 etc. Do not stop after writing.

Gaps classified:

- P0: Blocks core use, violates PRD/spec, data loss, auth/security risk, prevents production readiness or real validation.
- P1: Historical classification for major required features that were not yet release-ready at discovery time.
- P2: Important UX/edge/accessibility/reliability/observability/test gap.
- P3: Polish, cleanup, refactor, nice-to-have.

Each: gap ID, priority, linked req IDs, affected persona/journey, why matters, files, impl needed, tests, owning agent, reviewers, validation cmd, branch/PR, status (open/in-progress/closed).

## Historical P0 Gaps (closed; retained for audit)

- **GAP-P0-001**: External validation target not persisted to runs when startMission omits input.target (relies on decision.target in guards only). Worker executes e.g. nuclei.external_exposure_safe with empty target -> policy-approved scans fail.
  - Priority: P0
  - Linked: PRD-Safety-ExternalValidation, PRD-Core-ProofLoop, SPEC-API-01 (startMission), SPEC-DATA-01 (run target), PRD-Validation-Snapshot
  - Affected: Security engineer / validation operator running ExposureValidation or ControlValidation via external PoA profiles; real customer with verified scope + Nuclei safe profile.
  - Why: Core product promise "validate what is real" broken for external; PRD requires evidence-backed, policy-gated, target-scoped execution.
  - Files: apps/api/src/runtime-services.ts (startMission run create + guards), apps/api/src/app.ts (indirect), packages/shared (schemas), worker/processor (consumes run).
  - Historical implementation note: Resolve target once from input ?? decision; use for run create, external guard, module constraints, job payload.
  - Historical test note: Regression for start without target payload (run gets decision target); e2e with policy-approved external module.
  - Historical owner: Grok (orchestrator + feature eng)
  - Historical reviewers: Security, QA, Architect
  - Historical validation command: pnpm --filter @periscan/api test ; manual: seed demo, create policy+mission for external, start without target in payload, inspect run.target via GET /missions/:id/runs and worker execution.
  - Branch/PR: ai/grok/p0-fix-policy-redact-target-auth , https://github.com/seanheiney/periscan/pull/3
  - Status: **CLOSED** (2026-06-05, fix committed+pushed+PR open; tests pass; no regression)

- **GAP-P0-002**: Policy decisions insufficiently bound at create/start (only partial scope check; no missionType/safetyLevel/exec env enforcement). Low-risk decision (e.g. PassiveReadOnly on small scope) could be reused to start higher-risk mission or modules in wrong exec env.
  - Priority: P0
  - Linked: PRD-Safety-Policy, PRD-Safety-VerifiedScope, SPEC-SEC-01, SPEC-API-01 (create/start mission), PRD-Platform-Delta-ActionRevalidation
  - Affected: All validation operators; security reviewers relying on "every validation run needs a policy decision and audit".
  - Why: Violates "policy approvals for sensitive validation", "every validation run needs a policy decision"; enables bypass of safety model.
  - Files: apps/api/src/runtime-services.ts (createMission, startMission), app.ts routes, policy package, shared domain (PolicyDecision has the fields).
  - Historical implementation note: Enforce missionType/safetyLevel match on create (when decision provided); re-validate full binding (scope+type+safety) on start before queuing; ensure Disallowed/ exec env respected (already via outcome + evaluate...).
  - Historical test note: create/start with mismatched decision -> specific 400 error codes; audit event for mismatch.
  - Historical owner: Grok
  - Historical reviewers: Security, QA
  - Validation: pnpm --filter @periscan/api test ; pnpm test:security ; inject tests for new error codes.
  - Branch/PR: same as above
  - Status: **CLOSED**

- **GAP-P0-003**: Malformed/expired session cookies cause JWT verify errors to bubble to global error handler -> 500 on protected endpoints; logout cannot clear bad cookie (user stuck).
  - Priority: P0
  - Linked: SPEC-SEC-01 (auth), PRD-Operational-Hardening, PRD-Tenant-Isolation
  - Affected: Any logged-in user with stale browser cookie (common after deploy/secret rotate).
  - Why: UX dead-end + security (errors may leak info); violates graceful failure, clear error states.
  - Files: apps/api/src/app.ts (getAuthContext, requireAuthContext, logout route), security.ts (verifySessionToken throws).
  - Historical implementation note: try/catch in getAuthContext around verify; return null (treated as unauth -> 401); logout still records if context or clears cookie anyway.
  - Historical test note: regression for bad cookie -> 401 not 500 on protected; logout succeeds.
  - Historical owner: Grok
  - Historical reviewers: Security, QA
  - Validation: api test + manual cookie tamper.
  - Branch/PR: same
  - Status: **CLOSED**

- **GAP-P0-004** (if any remaining after PR#3): Confirm no other secret exposure paths (e.g. schedule configs, internal serialize variants, trust-safety responses, audit metadata). Audit all /integrations* and /tenants* responses.
  - Status: **CLOSED** (2026-06-05 by Security agent full audit + tests: all paths use serialize/redact; schedules/trust/reports/audit never carry secrets; 20+ redaction tests + connectors; P0 fixes + GAP-P0-004 review on ai/grok/security-p0-test-fixes-and-redaction-audit).

## Historical P1 Gaps (closed or superseded)

- **GAP-P1-001**: Historical Threat Center completeness gap covering manual advisory UX states, missing-signal impact, readiness exports, and later public feed ingestion/correlation.
  - Linked: PRD-ThreatCenter, Phase 4 roadmap, docs/agent-tasks/12-threat-center.md, IMPLEMENTATION_STATUS.
  - Why: Core module for continuous validation + signal fabric; PRD requires missing-signal intelligence first-class.
  - Files likely: apps/api/src/app.ts (threat advisories routes), runtime-services (import, readiness), packages/db (threat schema), apps/web/app/threat-center/..., components, reports for readiness html/pdf.
  - Impl: Verify real navigation from /threat-center works with API data; add any missing empty states, error toasts, export buttons; ensure non-executing plans still produce evidence-backed readiness.
  - Tests: e2e first-customer-proof + specific threat-center acceptance; security boundary for import.
  - Owning: None active; repo-owned work is closed.
  - Validation: pnpm test:e2e ; manual /threat-center after seed:demo + import via API; pnpm verify
  - Status: **CLOSED** (2026-06-05; agent 019e9892-b3a0-7a32-ad44-5e93bb94babb completed 979.85s / 210 tools / 1 turn; vertical full UI states (isLoadingList/Detail + neutral panels + empty "No advisories..." + error + success with real data), real connector signal impact (SecurityControl e.g. Splunk/Proofpoint etc reduce missingSignals like "control_telemetry" via prereqs/evidence; flows to findings/trends/readiness), readiness/plan/export (HTML/PDF with evidencePackId + redaction + audit); branch ai/grok/p1-threat-center-full (commit 7381caf + merge e0c5e21 to codex); PR #6 https://github.com/seanheiney/periscan/pull/6; changes: threat-center-workbench.tsx (states polish + import/export wiring), acceptance/api-first-mvp-flow.test.ts (full threat + real Splunk block + asserts), app.test.ts (impact setup), workbench.test.tsx (empty/error); validation: api test threat PASS (128/128), acceptance 2/2 (threat journey), web workbench test 4/4 PASS, web/api type clean; feature-threat.md created (log + DoD); later slices added public feed ingestion while commercial/private feed onboarding remains customer/business-gated; DoD 1-25 all satisfied (traced, e2e real nav/API/persist/authz/states/edges/tests/reviews/no fakes/branch/PR/.ai/); see .ai/agents/feature-threat.md + subagent output for full).

- **GAP-P1-002**: Historical connector-expansion acceptance gap for newly connectable integrations after unit/redaction tests but before grouped public-API acceptance coverage.
  - Linked: Phase 2 roadmap, PRD-Integration-Registry, SPEC-INT-\*
  - Why: "Real-first rule" - product visible data must come from real integrations or honest not-configured; catalog promises "beta/implemented".
  - Files: packages/connectors/src/index.ts + .test.ts (many), apps/api (sync routes, findings), web integrations + trust-safety, docs.
  - Impl: Closed by grouped connector-category acceptance across currently connectable categories.
  - Tests: DB-backed public API acceptance suites plus `pnpm verify`.
  - Status: **CLOSED** (2026-06-23; grouped connector-category acceptance now covers every currently connectable catalog category through public APIs with credential redaction/encryption, normalized signal/evidence persistence, audit events, Trust & Safety visibility, and cross-tenant denial. Live provider use remains external/customer-specific: credentials, verified scope, and provider setup are required.)

- **GAP-P1-003**: Historical internal-runner deployment gap for customer install docs/artifacts beyond lab E2E.
  - Linked: Phase 6, PRD-Runner-\*, RUNNER_ARCHITECTURE.md , PRODUCTION_READINESS "deployment-managed"
  - Why: "usable without deploying internal" for MVP, but full platform requires runner for internal scope; PRD promises non-root Docker + compose.
  - Files: apps/runner/_ , infra/docker-compose , scripts/test-runner_, docs, web trust-safety runner section.
  - Impl: Closed for repo-owned artifacts with Docker Compose/Kubernetes/systemd examples, GHCR workflow, deploy validation scripts, runner lab checks, and Trust & Safety runner status. Customer-specific network validation remains deployment-managed.
  - Status: **CLOSED/SUPERSEDED** (2026-06-23; repo-owned runner deployment artifacts, Docker Compose/Kubernetes/systemd examples, GHCR publish workflow, consolidated deploy docs, lab/deploy validation scripts, and Trust & Safety runner status coverage are in the release gate. Remaining work is customer-specific deployment validation outside the repo: issued runner credentials, outbound firewall egress, verified internal scope, and approved windows.)

- **GAP-P1-004**: Historical API-backed web-state and accessibility gap for loading/empty/error/signed-out/recovery states across primary surfaces.
  - Linked: PRD-BetterTogetherUX, USER_STORIES, ACCEPTANCE_CRITERIA (explicit states required), UX principles.
  - Why: World-class DoD requires all 10-13 states, mobile/responsive, a11y basics, no dead ends.
  - Files: apps/web/app/_ , src/components/_ (snapshot-workbench, integration-marketplace, trust-safety-dashboard, etc.), globals.css
  - Impl: Closed as a P1 release blocker by API-backed state/recovery work, primary-route app shell coverage, Snapshot dynamic-route coverage, and route-level Playwright axe gates. Optional route-specific deep screen-reader review remains P2 polish.
  - Status: **CLOSED/SUPERSEDED AS P1** (2026-06-23; API-backed web state, route shell, primary-route Playwright accessibility, Snapshot report delivery recovery, MSSP portfolio states, Registry Center, Validation Ops, Integration Marketplace, Trust & Safety, Threat Center, and shared status-panel accessibility are covered by later slices and the full `pnpm verify` gate. Remaining route-specific contrast/deep screen-reader review is tracked as P2 polish, not a P1 release blocker.)

## Historical P2 Gaps (closed; retained for audit)

- Missing or shallow tests for new binding error codes, cookie error path, resolved target in persisted runs (add to app.test + acceptance).
- Observability: limited structured logs/metrics for mission start latency, policy deny rates, connector sync times (P2, useful for ops).
  - Status: **CLOSED** (2026-06-05 by p2-devops-obs + p2-trends-impact; added deeper logs for mission.create/start (deny warn), connector.sync (signalCount real from result), policy.preview; /metrics process; trends impact + missingProofInputs in MSSP portfolio; p2-devops-obs.md + p2-trends-impact.md; tests green; gap P2 obs/trends CLOSED).
- Some connector manifests have "Beta" or partial workflow; full ticket create end-to-end (policy approved) not exercised in e2e for every new PSA/RMM (Syncro etc).
  - Status: **CLOSED** (2026-06-05 by p2-qa-tests + prior P1-007; e2e has Syncro direct + race double-submit on create-ticket; acc PSA; api reg + redaction; see e2e insert + p2-qa-tests.md + PR#12).
- Mobile/responsive + basic a11y (labels, focus, contrast) not explicitly gated in CI (playwright can, but not run).
  - Status: **CLOSED** (2026-06-05 by p2-ux-a11y-ci + p2-qa-tests; added role/status/aria-live/htmlFor/focus/skip/error-banner+retry/dismiss in 7+ components (market/snapshot/threat/trust/mssp/report); @media 480/640 stacks/touch; viewport in e2e; CI/verify/playwright notes (no new dep/axe as e2e API-only); tests 26/26 web; p2-ux-a11y-ci.md + p2-qa-tests.md; gap P2 a11y/responsive/market/error CLOSED).
- Executive trends / MSSP portfolio may not reflect recent connector signals or missing-signal impact fully.
  - Status: **CLOSED** (2026-06-05 by p2-trends-impact; missingProofInputs in ClientPortfolioCoverageSchema + MSSP totals (shared + tests); runtime buildClientPortfolio/buildMSSPClientPortfolio reflect real count from prisma missingSignal + SecurityControl impact (recent connectors like Splunk/Proofpoint reduce via control_telemetry); mssp-portfolio-dashboard card "Missing proof inputs" + note; deeper logs; tests (api 129, shared 25, web mssp, acc enterprise) PASS; p2-trends-impact.md; gap P2 trends/obs/exec/MSSP CLOSED).
- Historical docs gap: user-stories / acceptance may not cover the exact new error codes or target resolution journey.
  - Status: **CLOSED** (2026-06-05 by p2-docs-readiness + p2-final-polish; added/polished full sections in docs/USER_STORIES.md + docs/ACCEPTANCE_CRITERIA.md (Given/When/Then for P0 binding error codes exact policy_decision_scope_mismatch / mission_type_mismatch / safety_level_mismatch + target resolution resolvedTarget persist/use/GET on omit + edges), P1 recent (threat states+impact+export w/ real Splunk, runner deploy k8s/systemd/GHCR/Supabase, PSA direct rem tickets from snapshot, UX loading/empty/error/sync/responsive/a11y/mobile/persist/roles/edges); dups trimmed; README + PROD_READINESS full audit; .ai/final-report.md 14 items; trace/gap/handoff/status/activity + .ai/agents/p2-docs-readiness.md + p2-final-polish.md. Validation: manual + pnpm targeted + grep consistency codes docs==code (runtime ~13151/13397 + app.test).)

## Historical P1 Gaps (continued UX; closed)

- **GAP-P1-005**: Integration connect flows originally initialized persisted records with healthStatus="Unknown" + lastSyncAt=null without a complete web path to run health/sync actions. This is now closed: Marketplace and Trust & Safety expose API-backed sync and health-refresh actions against `/integrations/:id/sync` and `/integrations/:id/health`.
  - Priority: P1
  - Linked: GAP-P1-004 (web states), PRD-Integration-Registry, PRD-Trust-Safety-Page, SPEC-UI-\*, IMPLEMENTATION_STATUS "Integration registry", USER_STORIES marketplace/trust, acceptance for connector flows.
  - Affected: Security engineers / MSSP operators using /integrations then /trust-safety after connector expansion; anyone expecting immediate health visibility post-connect.
  - Why: Violates "Trust & Safety shows health/sync?", real-first (data present but misleading), polished states per DoD, user empathy (connect then "Never synced" feels broken). New connectors make the gap more visible.
  - Files: apps/web/src/components/integration-marketplace.tsx (connectMock always mock, no post-sync), trust-safety-dashboard.tsx (no sync btns, relies on summary), snapshot-workbench.tsx (hardcoded connects), apps/web/src/lib/periscan-api-client.ts (missing sync/health wrappers), apps/api/src/runtime-services.ts (createIntegration sets Unknown, no initial sync; getIntegrationHealth + syncIntegration exist but uncalled from create), app.ts (routes present).
  - Historical implementation note: Add browser client methods for syncIntegration + getIntegrationHealth. Wire "Sync" button + on-success refresh in trust-safety connected list (and optionally post-connect in marketplace). Optionally auto health/sync (for mock) inside createIntegration before return. Ensure lastSyncAt + Healthy for mocks.
  - Historical test note: web component updates; api test for create now yields non-Unknown; e2e/manual: connect new connector, immediately see healthy in trust-safety; acceptance covering UI connect + health.
  - Historical owner: UX + FeatureEng
  - Historical reviewers: Product, QA
  - Validation: pnpm --filter @periscan/web test ; pnpm --filter @periscan/api test ; seed:demo + manual nav + playwright if added; pnpm verify.
  - Status: **CLOSED** (2026-06-21; refreshed by Codex after the earlier partial closure. Trust & Safety exposes connector-specific API-backed `Sync now` and `Refresh health` actions, Integration Marketplace connected cards expose persisted health/last-sync state plus manual sync and health refresh actions, browser client methods call `POST /integrations/:id/sync` and `GET /integrations/:id/health`, and component tests prove tenant state refreshes from real API reads after each action.)
- **GAP-P1-006**: Workspace (/) and Threat Center have no initial isLoading guard on getMe + load; render full auth form (with "Create tenant...") on every mount, then async swap to real workspace/content when session valid. Causes visible "auth flash" for returning users. Trust-safety + mssp avoid this with isLoading.
  - Priority: P1
  - Linked: GAP-P1-004, SPEC-UI-01, PRD-BetterTogetherUX, acceptance for auth states.
  - Affected: Any returning authenticated user reloading / or /threat-center (common in real usage).
  - Why: Jarring, unpolished, violates "all states present and good", consistent UX.
  - Files: apps/web/src/components/snapshot-workbench.tsx (useState INITIAL null, if(!auth) render auth, useEffect getMe), threat-center-workbench.tsx (same pattern + own form), vs trust-safety-dashboard.tsx / mssp-portfolio-dashboard.tsx (isLoading + set false).
  - Historical implementation note: Add isLoading state (true init), set false in both then/catch of getMe, render neutral "Restoring your session..." or loading panel while true (before deciding auth vs unauth). Hide auth panel behind loading.
  - Historical test note: Update component tests to assert no premature auth UI; e2e with cookies.
  - Status: **CLOSED** (2026-06-05; Workspace and Threat Center now hold a loading state until `/api/v1/me` resolves, preventing returning-user auth flash. Component tests assert the loading panels and post-401 auth-state transition.)

## Historical P2 Gaps (continued UX; closed)

- Deeper route cross-links, page recovery states, and browser accessibility gates.
  - Status: **CLOSED FOR RELEASE** (2026-06-23; primary routes have shared `AppNavigation`, route-aware breadcrumbs, skip-link behavior, mobile overflow checks, and axe WCAG A/AA gates. Dynamic `/snapshots/:id` now has stable breadcrumbs, peer links to Workspace/Validation Ops/Trust & Safety/API Reference, component coverage, Playwright shell coverage, and axe coverage. Remaining work is optional route-specific contrast/deep screen-reader review, not a release blocker.)
- Marketplace, Threat Center, Snapshot report, Trust & Safety, and Workspace web-state polish.
  - Status: **CLOSED FOR RELEASE** (2026-06-23; Marketplace has loading, filter-empty, fixture-lab opt-in, action-error recovery, credential/health/sync visibility, and explicit unavailable-state copy. Threat Center has API-backed loading/error/retry/unauth/import states. Snapshot report has loading, 401/404/error, empty, analyst-note, delivery-error, and dynamic route coverage. Trust & Safety renders the API health card and retryable action errors. Workspace links to the full Marketplace and Trust & Safety while fixture shortcuts stay lab/demo opt-in. Full `pnpm verify` passes with E2E 22/22 and web tests 147/147.)

## Historical P3 Gaps (continued; retained for audit)

- Polish: copy tweaks, icon consistency, report template variants, more OSS tool versions in toolchain.
- Refactor: possible duplication in target resolve (could extract helper); many similar "without exposing" tests could be table-driven.
- Cleanup: old dist/ in tree (build artifacts), some long test files.
- Nice: more demo scenarios, better error messages for policy.

## Summary Counts (live)

- P0: 4 closed this session (3 original + GAP-P0-004 secret exposure paths fully audited+closed by Security + P0 test fixes), 0 under review
- P1: all repo-owned P1 items are closed in the current integration branch, including connector acceptance breadth, runner deployment artifacts, direct PSA remediation-ticket parity, auth/state polish, health/sync liveness, and Threat Center.
- P2: release-blocking P2 items are closed in repo. Remaining P2 work is optional/customer-specific depth such as live deployment validation, route-specific screen-reader review, additional demo polish, and future connector expansion.
- P3: 4+

**Immediately actioned:** P0s via dedicated branch/PR (ai/grok/p0-fix-policy-redact-target-auth + PR#3). P0 regression test + state/type + ApiError code fixes landed by Security agent on ai/grok/security-p0-test-fixes-and-redaction-audit (full redaction/exposure audit + tests green). GAP-P0-004 closed. Later slices closed the P1/P2 items summarized above, including DevOps hygiene, CI/verify, observability, runner deployment artifacts, connector acceptance breadth, and web-state polish.

## Session PM Findings + Refined P1s (appended 2026-06-05)

**P0 Validation (closed via PR#3 + Security agent full review on ai/grok/security-p0-test-fixes-and-redaction-audit):**

- GAP-P0-001 (external target persist): Code present (resolvedTarget = input.target ?? decision.target in startMission; used in run create, guards, module constraints). Persisted to ValidationRun.target. P0 regression test covers start without target payload (uses decision) + run inspect. api test + typecheck pass post-fix.
- GAP-P0-002 (policy binding): Enforced in createMission (if decision provided: scope/missionType/safetyLevel match or 400 specific codes) + re-validate full in startMission before tx/queue/enqueue. Denied never queue jobs. Audit on mismatch. Specific codes now in ApiError responses.
- GAP-P0-003 (bad cookie): getAuthContext try/catch on verify -> return null (401 on require); logout handles. No 500 amplification.
- GAP-P0-004 (secret exposure): Full audit by Security (all /integrations* /tenants* /trust /reports /schedules /audit /remediation paths use serialize/redact or never carry secrets). 20+ "without exposing" + connector no-contain tests for Syncro+recent. Signals always redacted+pointers. Health least-priv. Workflow only on approved remediation. **CLOSED**. (P0 regression test also fixed for coverage.)
  All P0s validated in code reads + targeted runs (security + api + connectors + policy). No other P0s found. New connectors follow pattern. Dep risk (P2) noted separately.

**Challenge: Connector expansion end-to-end for newest (Syncro ticket create under policy)?**

- Sync + inventory: full (mock/live, signals to graph/findings, evidence artifact, redaction, health, catalog "Beta"/connectable, non-mock default, read-only asserts).
- Ticket create under policy: YES for signal-trigger approved "remediation events" (deliverSignalTriggerRouting calls sendWorkflowEvent only after policyDecision + draft mission created; no jobs queued; returns ticketId/metadata; audit). Matches AC "Given a Syncro workflow destination receives a policy-gated validation or remediation event... creates an authorized remediation ticket".
- BUT: Direct remediation flow (/api/v1/remediations/:id/create-ticket + createRemediationTicket) is _Jira-hardcoded only_ (resolveJira + Jira-specific create + ticketSystem="Jira"). No equivalent for Syncro/ConnectWise/Halo/Autotask/Ninja despite USER_STORIES promising "create policy-gated remediation tickets" and IMPLEMENTATION_STATUS/ROADMAP listing "workflow delivery paths" + plan mentioning "ConnectWise-backed remediation ticket".
- All states present in connector: yes (Delivered/Failed/Skipped, mock vs apiKey mode, latency, detail w/o secrets).
- Any mocked in prod paths? NO: live paths do real fetch only if !mockMode (from integration config); syncPersistedIntegration + deliver respect it; evidence always stored; redaction in shared. Fixtures only in tests or explicit mock.
- Historical note: PSA ticket creation from Snapshot remediations was not yet complete at discovery time and was later closed by GAP-P1-007.
- Validation: unit+connector tests pass (106/106); api redaction tests; no acceptance exercising Syncro ticket from remediation (only general workflow or Jira create-ticket).
- Impacted files: runtime-services (createRemediationTicket Jira only; deliverSignal... general), app.ts (remediation create-ticket route), connectors (Syncro sendWorkflowEvent impl good), web (no ticket create UI in workbench, only display).

**New/Refined P1s**

- **GAP-P1-007**: Remediation ticket creation (direct attach to RemediationTask) only supports Jira; newest PSA/RMM connectors (Syncro, HaloPSA, Autotask, ConnectWise, NinjaOne) support ticket create _only_ via signal-trigger workflow delivery (not from Snapshot -> remediation -> create ticket journey). Stories/AC claim full "create policy-gated remediation tickets" for them.
  - Priority: P1 (connector expansion "truly end-to-end" claim)
  - Linked: SPEC-INT-SYNCRO-001, SPEC-REM-01, PRD-Remediation API 7.9, USER_STORIES (Syncro etc "create policy-gated remediation tickets"), ACCEPTANCE_CRITERIA (Syncro workflow only, no direct), IMPLEMENTATION_STATUS "Remediation", ROADMAP Phase2, PRODUCT_COMPLETION_PLAN (mentions ConnectWise-backed remediation ticket).
  - Affected persona/journey: MSSP ops lead / security engineer: after Snapshot produces remediation priority for a finding -> clicks/API "create ticket" expecting Syncro (or other PSA) -> currently only Jira option or falls back to manual trigger setup. "Action and revalidation loop" broken for non-Jira PSAs in primary remediation flow.
  - Why at discovery time: Violated real-first completeness for Phase 2 expansion and the product-visible PSA remediation ticket journey; later slices closed the API/UI/persistence/test gap while preserving policy gates.
  - Files: apps/api/src/runtime-services.ts (createRemediationTicket + resolveJira hardcode; no general dispatch), apps/api/src/app.ts (create-ticket route), packages/shared/src/domain.ts (RemediationTask has ticketSystem but only "Jira" set), web snapshot-workbench (no ticket create affordance at all, only display), connectors (all PSA have sendWorkflow but no "createRemediationTicket" helper), docs/\* (inconsistencies in stories/ac/plan/status).
  - Historical implementation note: Generalize createRemediationTicket to accept/resolve any workflow-capable connector (use deliver pattern or new createRemediationTicketForConnector); update input schema to support integrationId for any; set ticketSystem from connector; add UI selector or auto based on connected; update AC/stories/trace for clarity (or deprecate direct for PSA if design is "use triggers for them").
  - Historical test note: Extend app.test for create-ticket with Syncro integrationId (mock delivery); new acceptance for Snapshot -> remediation -> Syncro ticket (policy context); update e2e if direct flow used.
  - Historical owner: FeatureEng + PM/UX decision on whether direct attach or triggers-only for PSA.
  - Historical reviewers: Product, Security (ensure still policy gated), QA.
  - Historical validation command: pnpm --filter @periscan/api test ; after: manual seed + create Syncro + Snapshot + remediation + create-ticket with Syncro integrationId (expect ticket metadata, ticketSystem="Syncro"); pnpm verify; update docs/TRACEABILITY + USER_STORIES + ACCEPTANCE_CRITERIA.
  - Branch/PR: ai/grok/p1-generalize-remediation-tickets or similar.
  - Status: **CLOSED** (2026-06-05; implemented on ai/grok/p1-psa-remediation-tickets via PR #5; generalized createRemediationTicket + UI select + tests in api/acceptance/e2e + docs; typecheck/api/accept/e2e pass; real dispatch via sendWorkflowEvent for Syncro etc.; policy/audit preserved. See feature-psa-tickets.md + PR#5).

- **GAP-P1-008**: Uncommitted changes on the "P0 just implemented" branch (ai/grok/p0-fix...): large diffs in packages/connectors/src/index.ts (+768), index.test (+209), docs/\* (AC, IMPLEMENTATION, PLAN, ROADMAP, TRACE, USER_STORIES), packages/shared/src/api-contract.ts (+ code in error), app.ts (small), and our temp fix to app.test. Git status not clean; may be intended port artifacts or prior work not committed before branch.
  - Why: Blocks clean PR#3 land/merge; "real-first" for dev process (working tree should reflect committed state for verification).
  - Files: as listed + .git.
  - Impl: Review diff (perhaps Syncro test/doc polish or P0 port extras), commit or revert selectively to clean tree; ensure pnpm verify passes on clean.
  - Validation: git status clean; pnpm verify (or targeted).
  - Status: **CLOSED** (2026-06-05 by DevOps agent; committed pending .ai/docs/web (incl P1-005 health sync consolidation) + devops fixes on ai/grok/devops-ci-verify-runner; multiple hygiene commits to clean tree; full pnpm verify green on clean; see .ai/devops-review.md + release-readiness).

- **GAP-P1-009** (refine prior GAP-P1-002): New connectors (Syncro + recent) lack acceptance/e2e coverage exercising full journey with policy-approved workflow ticket create from signal or remediation context. Current coverage unit + "without exposing" only.
  - Update: add explicit row in acceptance/api-first-mvp-flow or new test for Syncro (or table-driven for PSA).
  - Historical test note: pnpm test:acceptance ; pnpm test:e2e (extend first-customer or new).
  - Status: **CLOSED** (with P1-007; acceptance + e2e now cover PSA/Syncro ticket path from remediation context; see agent's validation + PR#5).

Refine existing:

- Historical note only: GAP-P1-001, GAP-P1-004, GAP-P1-005, and GAP-P1-006 are closed for repo-owned first-customer scope by later API, web-state, Threat Center, connector, and release-gate slices.

## DevOps / CI / Hygiene / Observability (closed by this agent)

- **GAP-P1-008-hygiene + CI-verify (sub)**: CI GHA missing minio service (despite MINIO\_\* envs in job); acceptance + e2e hit real snapshot report pack creation -> putEvidenceArtifact -> S3 config (from resolve in evidence/storage) -> connection fail to 127.0.0.1:9000 (no container). Also logger:false (no structured/ops logs), no engines in package, uncommitted hygiene. Verify assumptions broken for GHA vs local.
  - Priority: P1 (full verify gate per AGENTS/PRODUCTION_READINESS; hygiene blocks clean release).
  - Linked: scripts/verify.sh, .github/workflows/ci.yml, PRODUCTION_READINESS (full pnpm verify + prisma + e2e + acceptance), GAP-P1-008, P1-003 runner, observability notes in status.
  - Affected: all release validation, GHA PRs, first-customer proof (e2e/acc use report export + evidence artifacts).
  - Why: "full verify is the gate"; real-first for CI must match local compose (minio); observability deployment-managed but code must support logs.
  - Files: .github/workflows/ci.yml, apps/api/src/app.ts (logger), package.json, scripts/verify.sh + infra compose, packages/evidence/src/storage.ts (resolve logic), .ai/\* reviews.
  - Impl: Added minio service+health to ci.yml (copy from infra); conditional logger in buildApp (test-silent, dev/prod levels via LOG_LEVEL); engines to package.json; committed hygiene for clean tree; re-ran all gates post-fix.
  - Tests: full pnpm verify (incl acc/e2e which exercise blob), api/acc/e2e re-runs; git status clean + verify on clean.
  - Historical owner: DevOps agent.
  - Validation: pnpm verify; pnpm test:acceptance + e2e (post); GHA after push.
  - Status: **CLOSED** (2026-06-05; fixes + hygiene commits + branch ai/grok/devops-ci-verify-runner; full gates green; see .ai/devops-review.md).
- **Historical closed note**: Logger/engines/CI-minio + verify hygiene closed here; runner deploy (P1-003) and Threat Center were still next at the time of this note, but both are closed/superseded for current repo-owned first-customer scope by later slices.

## P2 / P3 additions from analysis

- Uncommitted + type error (transient, fixed) indicate need for stricter pre-PR verify in agent process.
- Docs (USER_STORIES, AC, TRACEABILITY_MATRIX, IMPLEMENTATION_STATUS, PRODUCT_COMPLETION_PLAN, ROADMAP) have minor inconsistencies post-connector spree + P0 (e.g. remediation ticket claims vs Jira-only impl); need sync with new trace rows.

## Summary Counts (live, post agents + P1-007 + DevOps + P2 Docs)

- P0: 4 closed (incl GAP-P0-004 full redaction audit by Sec); 0 open. All validated in .ai/security-review + qa + gates.
- P1: ALL CLOSED (P1-001 Threat full PR#6 + feature-threat.md; P1-003 runner deploy PR#7 + runner-deploy.md; P1-007/009 PSA tickets PR#5 + feature-psa; UX P1-005/006 PR#4; P1-008 hygiene/CI/verify by DevOps + devops-review; prior); full verify green; 25 DoD per slice.
- P2: release-blocking P2 items are closed in repo, including observability metrics, browser/axe accessibility gates, audit/report-share parity, API reference visibility, Registry Center, Validation Ops, responsive shell coverage, and docs traceability. Remaining P2 work is optional/customer-specific depth such as live deployment validation, route-specific screen-reader review, additional demo polish, and future connector expansion.
- P3: 4+ (polish, more OSS).

Update this file after every gap closure or discovery. Link to .ai/requirements-traceability.md for full row status.

## v0.1.327 — FIX (wrong-scoped aggregate / over-claimed-proof): executive "Verified fixes" metric evidence scope

**Pattern**: WRONG-SCOPED AGGREGATE + OVER-CLAIMED PROOF (proof-core truthfulness).
A focused sub-agent sweep of `apps/api/src/runtime-services.ts` surfaced a
confidently-correct mismatch between a metric's VALUE scope and its EVIDENCE scope.

**Bug**: `buildExecutiveTrendSummary` (`apps/api/src/runtime-services.ts` ~1490) emits the
`verified_fixes` executive metric with `value: fixedRemediations.length` (remediations whose
status is `Fixed` or `Mitigated`) but sourced its `evidenceIds` from
`input.verificationEvents.flatMap((event) => event.evidenceIds)` — the evidence of ALL
verification runs, regardless of outcome. So a verification run whose outcome was NOT a fix
(`Reopened`, `StillExposed`, `Inconclusive`, `ClosedWithoutEvidence`) still attached its
evidence to the "Verified fixes" metric, over-claiming the evidentiary basis of the count with
proof that does not back a fix.

**Why it's wrong**: every SIBLING metric in the same function sources its evidence from the
SAME entity set it counts — `critical_high_findings` from `criticalHighFindings`,
`open_remediations` from `openRemediations`, `evidence_packs_ready` from `readyReports`. The
`verified_fixes` metric was the lone outlier pulling evidence from a different entity collection
(`verificationEvents`) than the one it counts (`fixedRemediations`).

**Fix**: scope the metric's evidence to `fixedRemediations.flatMap((r) => r.evidenceIds)` — the
same set producing the value — matching every sibling. `RemediationTask` merges
`EvidenceLinkedSchema`, so `evidenceIds` is already present (used identically by the
`open_remediations` metric).

**Coverage**: `apps/api/src/runtime-services.test.ts` adds a `buildExecutiveTrendSummary`
describe asserting the `verified_fixes` metric counts only Fixed/Mitigated remediations (value 2)
and that its `evidenceIds` are exactly those remediations' evidence — the evidence of a `Reopened`
remediation's verification run does NOT leak into the metric. @periscan/api 226 -> 227.

**Gates**: NO-DB gates GREEN (api typecheck, repo lint, api unit 227). test:security /
test:acceptance skipped — Docker unavailable, no DB-write paths touched (pure aggregate helper).

## v0.1.329 — FIX (wrong-scoped aggregate): executive "Open remediations" metric drops PartiallyFixed

**Pattern**: WRONG-SCOPED AGGREGATE (proof-core truthfulness).
A focused sub-agent sweep + cross-check against the canonical open/resolved split
surfaced a remediation status silently dropped from every executive velocity bucket.

**Bug**: `buildExecutiveTrendSummary` (`apps/api/src/runtime-services.ts` ~1388)
computed `openRemediations` as the hardcoded allowlist `["Open", "InProgress",
"StillExposed"]`, which OMITS `PartiallyFixed`. A PartiallyFixed remediation therefore
fell into NO velocity bucket — not `openRemediations`, `fixedRemediations` (Fixed/Mitigated
only — correct, must not over-claim), `readyForVerification`, `reopenedRemediations`, nor
`closedWithoutEvidence` — yet was still included in `totalRemediations`. So the executive
"Open remediations" metric UNDER-CLAIMED open work and the velocity breakdown failed to
reconcile to the total, silently hiding partially-remediated exposure from the executive view.

**Why it's wrong**: the codebase's own canon treats PartiallyFixed as still-open active
work. `mapRemediationStatusToFindingStatus` (~4909) maps PartiallyFixed to exactly the same
finding status as `InProgress` (`ticketId ? "Routed" : "InProgress"`) with the explicit
comment "a partial fix has reduced — not eliminated — the exposure, so the finding is still
active". The shared open/resolved split (`countOpenRemediations`, domain.ts ~1834) defines
RESOLVED as Fixed/Mitigated ONLY and counts everything else — including PartiallyFixed — as
open. The executive allowlist was the lone outlier dropping it.

**Fix**: add `"PartiallyFixed"` to the `openRemediations` allowlist so it is counted as open
active work — alongside `InProgress`, which the finding-status mapper treats identically. It
correctly stays OUT of `fixedRemediations` (no over-claim of a verified fix).

**Coverage**: `apps/api/src/runtime-services.test.ts` adds a `buildExecutiveTrendSummary`
case asserting a PartiallyFixed remediation lands in the `open_remediations` metric (value +
evidenceIds) and `remediationVelocity.openRemediations`, NOT in `verified_fixes`, and that the
velocity breakdown reconciles (open 2 + fixed 1 == total 3). @periscan/api 231 -> 232.

**Gates**: NO-DB gates GREEN (api typecheck, repo lint, api unit 232). test:security /
test:acceptance skipped — Docker unavailable, pure aggregate helper, no DB paths touched.

## v0.1.330 — FIX (wrong-scoped aggregate): executive "Open remediations" metric drops Inconclusive

**Pattern**: WRONG-SCOPED AGGREGATE (proof-core truthfulness) — the same defect class
as v0.1.329 (PartiallyFixed), found by continuing the sweep across the FULL
`RemediationStatus` enum against the velocity buckets.

**Bug**: after v0.1.329 added `PartiallyFixed`, `buildExecutiveTrendSummary`
(`apps/api/src/runtime-services.ts` ~1395) computed `openRemediations` as the allowlist
`["Open", "InProgress", "PartiallyFixed", "StillExposed"]`, which still OMITS `Inconclusive`.
The 10-value enum is Open, InProgress, VerificationPending, Fixed, PartiallyFixed,
StillExposed, Mitigated, **Inconclusive**, Reopened, ClosedWithoutEvidence. The velocity
buckets are: open (the allowlist), readyForVerification (VerificationPending), fixed
(Fixed/Mitigated), reopened (Reopened), closedWithoutEvidence (ClosedWithoutEvidence). That
leaves `Inconclusive` in NO bucket at all — yet still inside `totalRemediations`. So the
executive "Open remediations" metric UNDER-CLAIMED open work and the velocity breakdown
again failed to reconcile to the total, silently hiding inconclusive (unproven-closed)
exposure from the executive view.

**Why it's wrong**: the codebase's own canon treats Inconclusive as still-open, unresolved
work. An Inconclusive verification never proved the exposure closed
(runtime-services ~6069/6082/6093: "the honest conclusion is Inconclusive, never Fixed").
`mapRemediationStatusToFindingStatus` (~4930) maps Inconclusive to the active "Inconclusive"
finding state. The shared open/resolved split (`countOpenRemediations`, domain.ts ~1836)
defines RESOLVED as Fixed/Mitigated ONLY and counts everything else — including Inconclusive
— as open. The executive allowlist was the lone outlier dropping it.

**Fix**: add `"Inconclusive"` to the `openRemediations` allowlist so it is counted as open
active work — alongside `StillExposed`/`PartiallyFixed`, both also confirmed-not-resolved.
It correctly stays OUT of `fixedRemediations` (no over-claim of a verified fix).

**Coverage**: `apps/api/src/runtime-services.test.ts` adds a `buildExecutiveTrendSummary`
case asserting an Inconclusive remediation lands in the `open_remediations` metric (value +
evidenceIds) and `remediationVelocity.openRemediations`, NOT in `verified_fixes`, and that
the velocity breakdown reconciles (open 2 + fixed 1 + ready 0 + reopened 0 + cwe 0 == total
3). @periscan/api 232 -> 233.

**Gates**: NO-DB gates GREEN (api typecheck, repo lint, api unit 233). test:security /
test:acceptance skipped — Docker unavailable, pure aggregate helper, no DB paths touched.

## v0.1.334 — FIX (set-but-not-enforced): model-gateway context-bundle build ignores the session timeout

**Pattern**: SET-BUT-NOT-ENFORCED (proof-core / decorative-control). A field
(`ModelSession.expiresAt`) is SET and enforced on most session-write paths but
skipped on one, so the timeout window does not actually bound that operation.

**Bug**: `createModelGatewayServices.createContextBundle`
(`apps/api/src/services/model-gateway.ts`) looked up the session and checked only
that it EXISTS (`if (!session)`), then went straight to `buildModelContextBundle`

then called `prisma.contextBundle.create`. It never called
`assertModelSessionLive`, so a
session that was already `Terminated`/`Expired`, or whose `expiresAt` window had
elapsed (no reaper had flipped its status yet), could still materialize a fresh
redacted context bundle of scoped tenant data and persist it. The function even
copies `expiresAt: session.expiresAt` onto the bundle — implicitly acknowledging
the session window matters — yet built the bundle anyway, so a time-expired
session keeps operating past its window. This is exactly the failure the
`assertModelSessionLive` doc comment warns about ("guarding only on status would
let a time-expired session keep submitting/executing tool calls past its window").

**Why it's wrong**: every SIBLING session-write path enforces this guard right
after the not-found check — `createModelToolRequest`, `executeModelToolRequest`,
and `pauseModelSession` all call `assertModelSessionLive`. `createContextBundle`
was the lone session-operation that omitted it, and (unlike `approveModelToolRequest`,
whose effect is re-checked by the live-guarded `executeModelToolRequest`) the
bundle it produces has no downstream session-live re-check — it is created and
persisted directly. Building a context bundle reads and redacts scoped tenant
data into the model's context window, the precise kind of session work the
timeout is meant to bound.

**Fix**: add `await assertModelSessionLive(session, "Session has ended; no new
context bundles are built.")` immediately after the not-found check, mirroring the
sibling write paths. A `Created`/`Paused`/`Active` session with no elapsed window
still passes (the pre-start bundle-build workflow is unaffected); only ended /
time-expired sessions are now rejected. Extracted the pure predicate
`isModelSessionTimedOut(session, now)` from `assertModelSessionLive`'s inline
expiry check so the timeout decision is unit-testable without a live session row
(mirroring v0.1.332's `isTerminalRunnerTaskStatus`); the guard now reuses it.

**Coverage**: `apps/api/src/model-session-timeout.test.ts` asserts
`isModelSessionTimedOut` is true for a past/exactly-now `expiresAt` (inclusive
boundary) and false for a future `expiresAt` or a null one (never-started
session). @periscan/api 236 -> 240.

**Gates**: NO-DB gates GREEN (api typecheck, repo lint, api unit 240).
test:security / test:acceptance skipped — Docker unavailable. This touches a
DB-write path (`createContextBundle`) but the change is a pre-write guard reusing
the existing `assertModelSessionLive` contract + audit-free 409 it already throws
elsewhere, and the extracted predicate is unit-tested without a DB.

## 2026-06-24 — FIX (unfinished-state omission): runner halt/revoke sweeps omit Accepted tasks

**Pattern**: UNFINISHED-STATE OMISSION (proof-core / safety halt). A lifecycle guard
handled some non-terminal runner task states but omitted another non-terminal state,
leaving a task able to survive a halt boundary.

**Bug**: `revokeRunner`, `setRunnerKillSwitch`, and poll-time own-task expiry cleanup in
`apps/api/src/services/runner.ts` treated only `Queued`, `Leased`, and `Running` tasks as
active. `Accepted` tasks were non-terminal, could still attach evidence or submit results
through later callbacks, but were not immediately cancelled/denied by runner revocation or
kill switch sweeps.

**Fix**: introduce a shared `ACTIVE_RUNNER_TASK_STATUSES` list containing `Queued`,
`Leased`, `Running`, and `Accepted`, and use it for revoke, kill-switch, and poll-time
expiry cleanup. This preserves current runner-agent behavior while ensuring accepted work
cannot outlive an authorization halt.

**Coverage**: `tests/acceptance/runner-kill-switch-flow.test.ts` creates and accepts a
reachability task before activating the kill switch, then proves the task becomes
`DeniedByServerPolicy` with the halt summary. `tests/acceptance/runner-revoke-flow.test.ts`
creates and accepts a reachability task before revocation, then proves it becomes
`Cancelled` with the revoke summary.

**Gates**: `pnpm --filter @periscan/api test -- runner-task-result-state` GREEN
(274 tests), `pnpm --filter @periscan/api typecheck` GREEN, focused DB-backed
`pnpm exec vitest run tests/acceptance/runner-kill-switch-flow.test.ts
tests/acceptance/runner-revoke-flow.test.ts --testTimeout=60000` GREEN (2 files / 2 tests).

## 2026-06-24 — FIX (acceptance-data collision): Threat Intel flow used low-entropy persisted signup data

**Pattern**: ACCEPTANCE HARNESS COLLISION. A DB-backed acceptance test used a random space
small enough to collide across repeated local runs, making full-suite validation fail even
though product behavior was correct.

**Bug**: `tests/acceptance/threat-intel-api-flow.test.ts` used `randomInt(1_000_000)` for
the persisted signup email, domain, and IOC key. Re-running the suite against a persistent
acceptance database could reuse a prior email and receive signup `409` instead of `201`.

**Fix**: switch the test suffix to `randomUUID()` while preserving the same API-first Threat
Intel feed health, catalog search, tenant alert, and acknowledgement assertions.

**Coverage**: focused Threat Intel acceptance passes, and the full DB-backed acceptance suite
now passes with 100 files / 123 tests.

## 2026-06-24 — FIX (ungrounded health): Sumo Logic and IBM QRadar live sync returned Unknown without a read-only probe

**Pattern**: UNGROUNDED HEALTH STATE. A live connector sync path exposed a product-visible
health result without contacting the configured customer system, even though a safe
read-only health check already existed.

**Bug**: non-mock Sumo Logic and IBM QRadar `sync` returned `Unknown` health and no signals.
Returning no live signals is correct, because control-verdict evidence belongs in
`observeControl`, but the health state was not grounded in the configured Search Job/Ariel
API access.

**Fix**: non-mock `sync` now calls the connector's read-only health check. Mock sync still
uses fixture signals; live sync still returns zero signals/assets unless a control
validation observer is invoked.

**Coverage**: Sumo Logic and IBM QRadar contract tests prove one read-only health request,
`Healthy`/`authorizationVerified: true`, zero fabricated live signals/assets, and credential
redaction.

**Expansion**: Elastic Security, Datadog Cloud SIEM, Google SecOps, Rapid7 InsightIDR, and
Microsoft Sentinel had the same ungrounded live-sync health pattern. Their non-mock sync
paths now run their existing safe read-only health probes and still return zero live
signals/assets outside observer execution. `siem-sync-health.test.ts` covers all five.

## 2026-06-24 — FIX (ungrounded health): workflow connector live sync skipped safe read-only health probes

**Pattern**: UNGROUNDED HEALTH STATE. Workflow/ticketing connectors with safe read-only
health probes returned `Unknown` from non-mock sync instead of verifying configured
customer access.

**Bug**: Jira, GitHub Issues, Linear, Opsgenie, and ServiceNow live `sync` skipped their
existing `/myself`, repository metadata, viewer GraphQL, account metadata, or Table API
health checks and returned `Unknown` plus no live signals. Returning no live ticket/alert
signals is correct until a customer query workflow is configured; ungrounded health is not.

**Fix**: non-mock sync now calls each connector's existing safe health check and still emits
zero live assets/signals.

**Coverage**: `workflow-sync-health.test.ts` proves one read-only health request per
connector, `Healthy`/`authorizationVerified: true`, zero fabricated live signals/assets, and
credential redaction.

## 2026-06-28 — CLOSED (source audit): PRD UX section was only route-covered, not source-mapped

**Pattern**: BROAD ROUTE COVERAGE != SOURCE REQUIREMENT COVERAGE. Prior audits saw
navigation/accessibility tests and treated section 15 as effectively covered, but the exact
PRD labels/cards/badges/flow steps were not checked.

**Gap**: `SRC-15-UX` remained `NeedsImplementationAudit`; the primary nav used implementation
labels (`Workspace`, `Missions`, `Validation Ops`), the dashboard lacked the exact PRD card
set, `Needs Review` and related status labels were not centralized, and the Snapshot flow
steps were scattered instead of visible as the PRD flow.

**Fix**: added source-derived `prd-ux-coverage` tests, PRD route aliases, exact PRD dashboard
cards backed by tenant APIs, shared PRD badge vocabulary, and a visible Snapshot flow stepper.

## 2026-06-28 — CLOSED (source audit): PRD Pricing and Metering implied retention instead of metering it

**Pattern**: ENDPOINT EXISTENCE != SOURCE REQUIREMENT COVERAGE. Prior audits saw billing
APIs, usage meters, package metadata, and entitlement gates and treated section 17 as covered,
but the exact PRD metering-unit bullets were not parsed against the exported meter catalog.

**Gap**: `SRC-17-PRICING-METERING` remained `NeedsImplementationAudit`; the PRD listed
`retention` as a metering unit, while the product only exposed retention posture through
Trust & Safety and worker purge audit events. There was no public `UsageMeterName` for
retention.

**Fix**: added source-derived `prd-pricing-metering-coverage` tests and a first-class
`EvidenceRetention` usage meter measured in deployment-configured retention days or `0` when
deployment-managed. Updated package meter metadata and traceability docs.

**Validation**: focused billing/source tests passed, and full DB-backed `pnpm verify` passed
with E2E 58/58, security 22/22, and acceptance 100 files / 123 tests.

## 2026-06-28 — CLOSED (source audit): PRD Build Phases were roadmap-indexed but not exit-criterion mapped

**Pattern**: ROADMAP HISTORY != SOURCE REQUIREMENT COVERAGE. Prior audits saw extensive
implementation history across foundation, Snapshot, runner, enterprise, and adjacent
feature areas, but section 18 itself still had only a `SectionIndexed` source row.

**Gap**: `SRC-18-BUILD-PHASES` lacked source-derived atoms for the exact phase headers,
build bullets, and exit criteria. That meant a release reviewer could claim broad roadmap
progress while missing a phase-specific exit criterion such as Phase 8 MSSP/Enterprise.

**Fix**: added `tests/modules/prd-build-phases-coverage.test.ts`, `PRD-PHASE-001` through
`PRD-PHASE-006`, and traceability/user-story/acceptance rows mapping phases 0 through 8 to
implementation and test evidence. The regression keeps `PRD-RUNNER-003` and
`PRD-COMPLETE-001` explicitly unresolved instead of hiding them.

**Validation**: focused Build Phases source coverage passed (1 file / 6 tests).

## 2026-06-28 — CLOSED (source audit): Codex Master Instruction was AGENTS-backed but not source-mapped

**Pattern**: INSTRUCTION FILE EXISTENCE != SOURCE REQUIREMENT COVERAGE. Prior audits saw
`AGENTS.md`, security tests, and broad engineering rules and treated section 20 as covered,
but the PRD's exact standing product outcome, safety bullets, engineering bullets, and stack
bullets were not mechanically parsed.

**Gap**: `SRC-20-CODEX-MASTER-INSTRUCTION` remained `SectionIndexed`; a future agent could
change AGENTS or stack docs and still pass broad tests while drifting from section 20.

**Fix**: added `tests/modules/prd-codex-master-instruction-coverage.test.ts`,
`PRD-CODEXMASTER-001` through `PRD-CODEXMASTER-006`, and traceability/user-story/acceptance
rows mapping the exact section 20 source text to product docs, safety boundaries,
engineering invariants, and stack dependencies.

**Validation**: focused Codex Master Instruction source coverage passed (1 file / 6 tests).

## 2026-06-28 — CLOSED (source audit): Codex Implementation Tickets were prompt-history-backed but not source-mapped

**Pattern**: PROMPT EXECUTION HISTORY != SOURCE REQUIREMENT COVERAGE. Prior audits saw many
implemented slices and acceptance tests, but section 21 still had only a source-index row.
That left ticket-level acceptance vulnerable to being inferred from historical task order
instead of the actual PRD ticket inventory.

**Gap**: `SRC-21-CODEX-TICKETS` lacked source-derived atoms for all 40 ticket names,
acceptance bullets, and ticket clusters. A future release reviewer could claim tickets were
complete while missing a ticket acceptance block or only proving broad platform behavior.

**Fix**: added `tests/modules/prd-codex-tickets-coverage.test.ts`, `PRD-TICKET-001` through
`PRD-TICKET-006`, and traceability/user-story/acceptance rows mapping tickets 1-40 to
implementation and test evidence. The regression keeps `PRD-RUNNER-003` and
`PRD-COMPLETE-001` explicitly unresolved instead of hiding them.

**Validation**: focused Codex tickets source coverage passed; combined PRD audit-gate and
coordination-doc regression passed; `pnpm prd:audit`, `pnpm typecheck`, `pnpm lint`, and
`git diff --check` passed.
