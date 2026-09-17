# PRD Audit Protocol

This protocol exists because a PRD requirement can remain incomplete even when
the current implementation status, traceability addenda, and test suite all look
green. Completion reviews must start from source requirements, not from the
latest execution history.

## Failure Analysis

The missed Third-Party Tool Governance capability exposed four process defects:

- The audit relied too heavily on `docs/TRACEABILITY_MATRIX.md`,
  `.ai/status.md`, and recent passing validation runs. Those files are execution
  history, not a complete source-of-truth decomposition.
- Requirements were tracked as broad labels such as
  `PRD-ThirdPartyToolGovernance`, but the individual verbs were not all
  atomized. "See activity" and "certify current readiness" were tracked before
  "persist certification history" became a separate completion gate.
- The first source-first ledger was still a seed ledger focused on the latest
  missed third-party-tool requirement. It did not index every major PRD source
  section, so it could prevent one class of overclaim while still leaving other
  PRD sections invisible to completion review.
- Passing tests proved the implemented surface behaved correctly. They did not
  prove every PRD noun, verb, API route, durable state, audit event, and safety
  boundary had been independently checked.
- The Fix Verification audit exposed a more specific variant: a required state
  can exist in enums, risk summaries, and reports while no production workflow
  actually produces it. Section 3.6's `Closed Without Evidence` outcome existed
  broadly, but external ticket-close sync moved remediations to
  `VerificationPending` until a source-derived test forced the production
  transition and audit event to be checked.
- The Evidence Packs and Operators audits exposed the same root defect in a
  different form: broad report/operator tests proved that a category of feature
  existed, but did not mechanically compare the PRD's exact pack names,
  operator names, verbs, and behavioral rules against public contracts. Section
  3.7 had a customer-facing label drift, and section 3.8 allowed proofless
  operator recommendations until source-derived regression tests parsed the PRD
  subsection directly.
- The First Sellable MVP audit exposed a packaging and demo-data variant:
  section 19 said MVP users can optionally register an AI app and receive a
  report with top 3-5 validated paths. Broad Snapshot/E2E/report coverage
  existed, but no source-derived test checked the default package entitlement
  for `AI app registry` or the deterministic report's top-path count. The
  result was a green product surface that still denied an MVP onboarding step
  and showed only two top paths.
- Focused tests can pass while full-suite or accumulated-state validation still
  fails. The continuous-validation sweep timeout on 2026-06-28 passed as three
  isolated files but failed inside `pnpm verify` because shared acceptance data
  contained hundreds of unrelated due tenants. Completion audits must therefore
  validate changed workflows under the same full-suite conditions used for
  release gates.
- "Complete" was used too broadly. A slice can be complete, or a tested scope
  can be complete, while the full PRD still has partial, unknown, or blocked
  requirements.

## Source-First Audit Rule

For any completion claim, audit these sources first:

- `PRD.md`
- `docs/PERISCAN_FULL_PRODUCT_PRD.md`
- `docs/ROADMAP.md`
- `docs/SECURITY_BOUNDARIES.md`
- `docs/OPEN_SOURCE_POLICY.md`
- `docs/OPEN_SOURCE_VALIDATION_ENGINES.md`

Status docs, traceability addenda, `.ai` files, and test results may confirm
implementation, but they cannot define the requirement set.

Before reading implementation status, confirm that
`docs/PRD_SOURCE_COVERAGE_LEDGER.md` includes the relevant PRD source section.
If a section is missing, add it before making any implementation or completion
claim. If a section is present but marked `SectionIndexed` or
`NeedsImplementationAudit`, the section has not yet met the completion standard.

## Requirement Atomization

Every PRD requirement must be split into atomic rows with:

- actor or system owner
- action verb
- object or API surface
- durable state, if any
- policy, RBAC, tenant isolation, and safety gates
- evidence, redaction, audit, and activity behavior
- UI behavior, if product-visible
- required tests
- residual gap or blocker

If a source sentence contains multiple verbs, each verb needs its own row. For
example, "see, manage, enable/disable, download/install/use, log activity, and
systematically expand tools" is not one requirement. It is a lifecycle with
separate catalog, governance, runtime, runner, activity, intake, certification,
history, and refresh requirements.

## Completion Standard

Completion reviews require accumulated-state validation where changed behavior
can interact with existing tenant data, shared schedulers, background workers,
or the release acceptance database.

A requirement can be marked `Implemented` only when the row has:

- source citation or stable PRD label
- implementation files
- public API contract when the capability is product-facing
- database or storage persistence when state must survive requests
- audit events for security-relevant actions
- tenant isolation and RBAC coverage where tenant data or admin actions exist
- policy/safety enforcement before queueing or execution
- UI wired to the API when the UI exposes the feature
- unit/integration/security/acceptance tests appropriate for the feature
- validation commands and results
- evidence that release-level validation, not only focused tests, passed after
  the final source/code/test/docs change when the row affects shared runtime
  behavior, scheduler behavior, persistence, security boundaries, or public API
  contracts

A row must remain `Partial`, `NotStarted`, `Unknown`, or `Blocked` if any of
those items are missing. Passing `pnpm verify` is necessary evidence, not a
substitute for source coverage.

## Completion Claim Policy

Do not claim "all features complete", "full product complete", or
"production-ready" unless:

- the source-first ledger has zero `Partial`, `NotStarted`, and `Unknown` rows
- every `Blocked` row has an explicit external blocker and safe fallback
- full validation has passed after the last code, schema, test, and docs change
- the final report lists residual customer/deployment risks separately from
  implementation gaps

Until then, use scoped language such as "implemented and validated for this
slice" or "ready for the tested first-customer scope."

Run `pnpm prd:audit` during normal verification to print the current
source-led audit state and fail if the audit artifacts or completion-report
mode regress. Run `pnpm prd:audit:strict` before any final full-product
completion claim; strict mode fails unless the completion report is a
full-product completion report and while any source section remains
`SectionIndexed` or `NeedsImplementationAudit`, or any requirement atom remains
`Partial`, `NotStarted`, or `Unknown`.

## Required Audit Workflow

1. Read the source PRD/spec files before reading status docs.
2. Extract all nouns, verbs, API endpoints, durable-state claims, safety rules,
   and acceptance criteria from the relevant source section.
3. Add or update the source section row in
   `docs/PRD_SOURCE_COVERAGE_LEDGER.md`.
4. Add or update rows in `docs/PRD_REQUIREMENT_LEDGER.md`.
5. For each row, map implementation files, tests, and current status.
6. Add a source-derived regression test for the section when possible. The test
   should parse the relevant PRD subsection directly and compare its explicit
   bullets, names, outcomes, endpoints, or requirements against public
   contracts, API behavior, report output, and safety gates.
7. Search the codebase for missing verbs, stale placeholder language, mock-only
   product paths, and UI-only state.
8. Run focused tests for changed behavior.
9. Run broader validation when product behavior, contracts, migrations,
   scheduler behavior, shared test-state handling, or security boundaries
   changed. Treat accumulated-state and concurrency failures as product/test
   harness defects until they are explained and fixed.
10. Update traceability and status docs with scoped wording only.

## Regression Gate

`tests/modules/coordination-docs.test.ts` enforces that this protocol,
`docs/PRD_SOURCE_COVERAGE_LEDGER.md`, and the atomic source-first ledger stay
present. Future PRD audits should expand those ledgers instead of replacing
them with newest-first execution history.

`scripts/prd-audit-gate.ts` is the executable release guard for this protocol.
The default check is included in `pnpm verify`; strict mode is intentionally
separate so day-to-day implementation can continue while the ledgers still show
known incomplete source-audit rows.

For third-party validation tools, completion audits must also use
`GET /api/v1/third-party-tools/coverage-audit`. A reviewed catalog is not
complete until every current tool is classified as `Executable`,
`ContentOrImportOnly`, `Deferred`, or `Blocked`, with zero
`NeedsImplementation` rows. The route is read-only and explicitly does not
enable, install, execute, queue missions, or dispatch runner tasks.
