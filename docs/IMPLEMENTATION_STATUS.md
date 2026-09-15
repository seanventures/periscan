# Implementation Status

## Current Addendum — 2026-08-03 Slice F catch-up rescore

Continuous-loop **Slice F** raised the internal engineering index from **78.9 → 79.2**
(1484 → **1489**/1880) with **catch-up only** — no new product: IaC #70 → 4.0 Strong
(Slice B PR path), assessment licensing #92 → 4.0 (Slice D catalog E2E), hybrid
compiler #30 → 3.5 Partial (Slice D mock-runner; not Strong), agent-based #17 → 4.25
(lab dual runners). Strict floors **80/94**, Strong+Leading **81**. Gate floors in
`scripts/analyst-score-gate.mjs`. Memo: `docs/qa/SLICE_F_RESCORE_2026-08-03.md`.

**Still cannot claim 95 or MQ/Wave:** partner packs, inject-off SCV, market refs=0,
choke/compliance score caps, bulk 4.0 Strong without new measured depth.

## Current Addendum — 2026-08-03 Slice E analyst rescore (lab-backed)

Continuous-loop **Slice E** raised the internal engineering index from **78.2 → 78.9**
(1471 → **1484**/1880) using only lab-demo evidence: FullyMeasured multi-hop, DRV/DNS
canaries vs mocksiem, dual runners + affinity, fixed-loop revalidation, Wave spine
17/17. Two rows reach average **5.0 Leading** on the allowlist (24 scheduling, 69
revalidation). Superseded by Slice F floors above. Memo: `docs/qa/SLICE_E_RESCORE_2026-08-03.md`.

## Current Addendum — 2026-08-02 continuous-loop lab demo site

The continuous-loop lab (`infra/lab`) is **engineering-closed** as a full demo
site: multi-tier edge/app/data, mocksiem with Splunk-export observe, product DRV
canary closed loop, multi-hop `fullyMeasured:true` via worker hop auto-apply and
`PERISCAN_LAB_MODE=1` host-port mapping, dual plant/hq runners polling with
physical affinity (plant reaches data; hq isolated), harden physical 401, and a
Wave spine API walk (17/17). Operator package: `pnpm lab:up`, `pnpm lab:dev`,
`pnpm lab:demo-up`, `pnpm lab:walk-spine`; guide `docs/DEMO_LAB_SITE.md`; closeout
`docs/qa/LAB_DEMO_SITE_CLOSEOUT_2026-08-02.md`.

**Not closed:** Phase 3 cloud/k8s, design-partner weekly dogfood process, public
customer references, ICP re-panel after lab demo (Slices E/F scored; do not invent
panel mean 5.0 / MQ).

## Current Addendum — 2026-07-26 external-validation workbench

The primary External Validation route is now a task-complete, API-backed
workbench rather than a safe-profile reference catalog. An operator can choose
a verified scope and exact hostname, select an allowlisted safe profile, run a
policy preflight bound to that target and profile, launch the bounded
`nuclei.external_exposure_safe` module through the External PoA executor, and
observe queued, running, denied, timed-out, failed, and completed state. The
result workspace exposes normalized evidence metadata and hashes without raw
scanner output, correlates evidence to an attack path before enabling
remediation creation, and requires a fresh policy decision for re-test.

`GET /api/v1/external-validation/attempts` provides the tenant-scoped attempt
ledger. It includes persisted External PoA policy decisions, including denied
attempts with no validation run, and genuine external-module runs while
excluding unrelated `ExposureValidation` missions assigned to internal
runners. Shared schemas now type mission-start results and complete
external-validation attempt records across API and web.

The route-specific help guide was followed against the rendered product. Live
desktop and 390 px checks proved scope/profile selection, exact policy
preflight, decision receipt, launch gating, activity display, help content, and
responsive layout. The seeded `demo.example.com` target was deliberately not
scanned because demo data is not proof of real-world authorization; component
and API regression tests exercise launch and state transitions without
weakening that safety boundary.

The final database-backed `pnpm verify` gate passes: 85 web files / 270 tests,
29 API files / 342 tests, 32 shared files / 162 tests, 41 connector files / 293
tests, 7 module files / 176 tests, a clean 53-route production build, 94
Playwright journeys, 26 security-boundary tests, 137 acceptance files / 176
tests, and all 146 migrations. The external workbench, help resolver, API route,
mission-start contract, completed workflow, and timeout state have dedicated
regression coverage. The canonical analyst score remains unchanged until a
fresh row-by-row evidence rescore.

During the release gate, newly published high-severity dependency advisories
were detected and treated as blockers. Next.js, Fastify, Swagger, and supporting
tooling were advanced to patched releases; narrow lockfile overrides now keep
Sharp, PostCSS, fast-uri, find-my-way, brace-expansion, shell-quote, and esbuild
on fixed versions. The regenerated dependency inventory reports no known
vulnerabilities in either the all-dependency or production audit and preserves
the third-party license manifest.

## Current Addendum — 2026-07-16 ASV/CTEM scope reset

The active analyst program is now the 94-requirement ASV/CTEM core matrix.
Sixteen GPU, inference-serving, token-economics, marketplace, and adjacent
platform rows have been removed from the canonical scorecard and active build
plan. Original source IDs remain stable for traceability. The analyst gate now
fails unless the exact approved 94-row set is present and reconciles to
1,487/1,880 (**79.1/100**) current and 1,802/1,880 (**95.9/100**) target.

Primary product guidance now sends operators from the first proof loop to
Assets & Scope, continuous validation schedules, and runner health. Assets &
Scope is in primary navigation; Frontier Gateway is no longer a primary
destination. Existing shared model or attestation code remains only where it
supports evidence grounding, safe agent orchestration, tenant isolation, or
execution integrity. It earns no core score or roadmap priority from an
excluded requirement.

The canonical execution plan is
`docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`; the fresh product-gap audit is
`docs/qa/CORE_PRODUCT_GAP_AUDIT_2026-07-16.md`.

## Current Addendum — 2026-07-16 confidential-compute assurance operations

Analyst row 44 now has an end-to-end relying-party lifecycle for hardware-rooted
workload qualification. A tenant administrator seals an immutable requirement
against a verified scope, exact workload and provider, allowed policy decision,
freshness and validity budgets, optional measurement/region/media-type claims,
and named support ownership. The evaluator consumes one exact accepted
Veraison attestation and deterministically records `Qualified` or `Rejected`
with frozen raw/result hashes, checked time, findings, reason, and reference.
Qualified receipts expire automatically at the earlier of policy validity and
verifier expiry; revocation is append-only. Duplicate receipt reuse, tenant
mismatch, stale/future/expired evidence, incomplete sessions, changed claims,
debug state, or missing secure boot fail closed.

The Agent Workflows trust surface now leads with one Requirement → Hardware
evidence → Decision → Freshness chain. It exposes the exact scope, workload,
provider, evidence-age ceiling, optional claim expectations, owner/escalation,
matching receipt, decision findings, hash, and bounded expiry while retaining
the lower-level Veraison collector for evidence acquisition. The decision
button remains unavailable until a matching real receipt exists. Contextual and
inline help describe the six-step procedure and explicitly separate a
requirement, OCI signature, demo row, or controlled test from customer hardware
proof.

The demo seed creates a real requirement for an AMD SEV-SNP workload and no
attestation, so it honestly remains `AwaitingEvidence`. A controlled Veraison
acceptance server proves challenge/receipt qualification, deterministic
secure-boot rejection, duplicate-receipt denial, revocation, audit, tenant
isolation, and database update immutability. Live desktop and 390 px validation
proved the unavailable state, disabled action, help text, six-step inline
guide, and zero horizontal overflow; it also exposed and corrected duplicated
ordered-list numbering. The operating and recovery procedure is in
`docs/CONFIDENTIAL_COMPUTE_ASSURANCE_RUNBOOK.md`.

Row 44 moves from 3.50 to 4.00 (product 4, function 4, UI/UX 4, operations 4).
The evidence score becomes **1,708/2,200 (77.6%)**; 62 rows meet the strict 4.0
floor and 94 are Strong/Leading. Real customer hardware, provisioned trust
anchors/endorsements, an authorized attester, independent multi-customer
usability, and externally reviewed support/SLO operation remain unproven and
unclaimed.

The final database-backed `pnpm verify` gate passes on this tree: 83 web files /
265 tests, 28 API files / 337 tests, 30 shared files / 155 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 26
security-boundary tests, 137 acceptance files / 176 tests, and all 145
migrations. License, dependency, enum-drift, PRD, and 110-row analyst-score
gates also pass.

## Current Addendum — 2026-07-16 bounded scenario feedback operations

Analyst row 43 now has an end-to-end, operator-controlled feedback lifecycle
for signed dynamic scenarios. Compilation binds a one-to-twenty-cycle maximum
into the scenario hash. After approval, each execution must present that exact
hash and expected persisted cycle count; one atomic compare-and-reserve step
prevents stale or concurrent reuse. The resulting engagement is attributed to
the exact feedback cycle, and its ordered step results expose the fresh,
persisted facts used by the next branch decision.

Cycle start, completion, failure, exhaustion, and administrator stop are
durable scenario state. Failed reserved attempts consume budget and preserve a
bounded error; stopped and exhausted loops are terminal. Changed integrity,
stale counters, duplicate cycle attribution, and invalid database state fail
closed. Tenant audit events cover every transition, and forced RLS plus check
constraints protect the new lifecycle fields. This remains bounded validation
orchestration, not self-modifying or unbounded autonomy.

The Engagements workspace now provides a focused feedback control with signed
budget selection, live status, cycle rail, remaining attempts, evidence count,
branch-predicate facts, failure visibility, explicit next-decision reason and
reference, and terminal stop/exhaustion states. The contextual guide was
followed literally against the real seeded demo: cycle 1/3 created four evidence
records, step 2 showed the exact persisted step-1 facts it evaluated, and a
reasoned stop removed all further actions. Browser validation also exposed and
fixed a mobile overflow; the final 381 px view matched its viewport and the
console was clean. The demo was restored to approved 0/3 with no execution.
The operating and recovery procedure is in
`docs/SCENARIO_FEEDBACK_OPERATIONS_RUNBOOK.md`.

Row 43 moves from 3.75 to 4.00 (product 4, function 4, UI/UX 4, operations 4).
The evidence score becomes **1,706/2,200 (77.5%)**; 61 rows meet the strict 4.0
floor and 93 remain Strong/Leading. Independent multi-customer usability and
externally reviewed support/SLO operation remain unproven and unclaimed, so no
5.0 credit is awarded.

The final database-backed `pnpm verify` gate passes on this tree: 82 web files /
263 tests, 27 API files / 335 tests, 29 shared files / 152 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 26
security-boundary tests, 137 acceptance files / 176 tests, and all 144
migrations. License, production-dependency, enum-drift, PRD, and 110-row
analyst-score gates also pass.

## Current Addendum — 2026-07-16 programmatic human interventions

Analyst row 42 now has an end-to-end human-intervention lifecycle for
policy-paused model tool requests. A tenant administrator issues a signed,
expiring handoff whose immutable envelope binds the tenant, request, session,
policy snapshot, verified scope, input commitment, transport label, and expiry.
Only the SHA-256 token fingerprint is stored; the raw token is returned once in
a URL fragment. A signed-in administrator must inspect the live envelope before
one atomic `Resume` or `Cancel` decision. Resume moves the request to `Approved`
but never executes it, while cancel makes it non-executable.

The Frontier Gateway now opens on a focused intervention queue, exact
authorization envelope, three-step decision rail, one-time link receipt, and
sealed decision state. Slack and Teams are explicit transport labels rather
than approval authorities or claimed delivery integrations. Plain-message,
tampered, expired, superseded, changed-envelope, and replay attempts fail
closed. Tenant authorization, forced RLS, immutable-envelope database controls,
and paired lifecycle/tool audit events preserve the decision proof.

The contextual guide was followed literally in the real seeded demo: a
15-minute link was issued, its same-origin fragment and token were confirmed,
the envelope reopened as verified, a reason and review reference were entered,
and cancellation sealed the request. The refreshed decision log showed
`InterventionCancelled` and `ToolDenied`; no browser errors occurred. The demo
was reseeded to one `RequiresApproval` request with zero live links and no
validation execution. The procedure is in
`docs/MODEL_TOOL_INTERVENTION_RUNBOOK.md`.

Row 42 moves from 3.75 to 4.00 (product 4, function 4, UI/UX 4, operations 4).
The evidence score becomes **1,705/2,200 (77.5%)**; 60 rows meet the strict 4.0
floor and 93 remain Strong/Leading. Independent multi-customer usability,
externally reviewed support/SLO operation, and qualified enterprise transport
delivery remain unproven and unclaimed, so no 5.0 credit is awarded.

The final database-backed `pnpm verify` gate passes on this tree: 81 web files /
260 tests, 27 API files / 335 tests, 29 shared files / 151 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 26
security-boundary tests, 137 acceptance files / 176 tests, and all 143
migrations. License, production-dependency, enum-drift, PRD, and 110-row
analyst-score gates also pass.

## Current Addendum — 2026-07-16 historical workflow variables

Analyst row 41 now has an end-to-end Variable Lens inside the durable workflow
flight recorder. A tenant-scoped API derives cumulative state from the real
persisted input manifest and append-only event chain across Input, Context,
Policy, Evidence, Model, Tool, Transition, Performance, and Control families.
It preserves exact SHA-256 value hashes while presenting only bounded redacted
previews and explicit analysis limits.

The interface leads with recorder integrity, variable/event/latency summary,
and a change-density moment rail. Operators can compare any two recorded
moments, filter a variable family, include unchanged state deliberately, select
an exact added/changed/removed variable, and inspect its before/after preview
and proof hash without exposing raw recorder payloads. The permanent event
ledger and checkpoint/replay contract remain adjacent to the analysis.

The seeded demo creates a real hash-linked completed workflow with persisted
demo evidence references, a `.invalid` provider, and explicit no-inference
labels; it never calls a model or customer system. The contextual guide was
followed literally: the demo run and both integrity states were confirmed,
moments and Performance variables were compared, the 298 ms cumulative value
and proof were inspected, a checkpoint was sealed, and a fork reused verified
history through event 10. Desktop and 390 px had no document overflow, the
mobile control label remained fully visible, and the warning/error console was
clean. The procedure is in `docs/WORKFLOW_VARIABLE_ANALYSIS_RUNBOOK.md`.

Unit and component tests cover schema, all delta types, derivation, interaction,
and help invariants. Database-backed acceptance proves tenant isolation,
redaction disclosures, integrity-aware derivation, valid replay, and transition
to untrusted after event tampering.

Row 41 moves from 3.75 to 4.00 (product 4, function 4, UI/UX 4, operations 4).
The evidence score becomes **1,704/2,200 (77.5%)**; 59 rows meet the strict 4.0
floor and 93 remain Strong/Leading. Independent multi-customer usability,
long-history performance/retention qualification, and externally reviewed
support/SLO operation remain unproven and unclaimed, so no 5.0 credit is
awarded. Deliberately unrecorded secrets and raw prompts remain unavailable by
design.

The final database-backed `pnpm verify` gate passes on this tree: 81 web files /
259 tests, 26 API files / 333 tests, 28 shared files / 147 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 26
security-boundary tests, 136 acceptance files / 175 tests, and all 142
migrations. License, production-dependency, enum-drift, PRD, and 110-row
analyst-score gates also pass.

## Current Addendum — 2026-07-16 asynchronous operations recovery

Analyst row 107 now has a tenant-operated queue control room and recovery
lifecycle above the existing durable schedules, worker queues, signed runner
polling, leases, fair-share lanes, retries, and terminal-state machinery.
Administrators review queue-age, running-timeout, and lease-warning targets with
support ownership and an escalation reference. The workspace derives live state
from persisted `Job` and `RunnerTask` records and presents exceptions before the
broader API proof inventory.

Reconciliation is deliberately narrow: it fails only tenant jobs beyond the
reviewed running timeout and expires only active runner tasks beyond their
signed expiry, then fails affected non-terminal runs. A failed workload can be
accepted terminal or used to prepare a new `Draft` mission only while every
source scope remains verified. Recovery copies no policy decision, creates no
run/job/task, and has no direct replay path. Policy, reconciliation, recovery,
and terminal decisions are audited and appended to a tenant RLS-protected,
hash-linked ledger with database update immutability.

The route-specific help was followed literally in the seeded demo: reviewed
targets saved, a no-op reconciliation changed no work, the labeled failed demo
job produced a recovery draft, and the linked mission showed `Draft`, an
unlinked policy gate, and zero runs. The control room had no document overflow
at 1280px or 390px, and the legacy inventory is now collapsed behind an
explicit diagnostic disclosure. The operator and qualification procedure is in
`docs/ASYNC_OPERATIONS_RUNBOOK.md`.

Row 107 moves from 3.50 to 4.00 (product 4, function 4, UI/UX 4, operations 4).
The evidence score becomes **1,703/2,200 (77.4%)**; 58 rows meet the strict 4.0
floor and 93 remain Strong/Leading. Production-like multi-node failure, soak,
externally reviewed SLO attainment, and 10,000+ concurrency remain unproven and
unclaimed, so no 5.0 credit is awarded.

The final database-backed `pnpm verify` gate passes on this tree: 80 web files /
258 tests, 25 API files / 332 tests, 27 shared files / 146 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 26
security-boundary tests, 136 acceptance files / 175 tests, and all 142
migrations. License, production-dependency, enum-drift, PRD, and 110-row
analyst-score gates also pass.

## Current Addendum — 2026-07-16 governed business impact

Analyst row 12 now has an end-to-end, tenant-scoped financial-assumption
lifecycle. Periscan supplies four numeric-free scenario prompt sets, requires a
named source owner/reference/date/note, calculates a non-mutating FAIR-inspired
PERT preview, and submits immutable numbered versions for administrator review.
Only approval activates the estimate; rejection and pending review preserve the
current exposure, while a later approval supersedes rather than edits history.

The new Business impact desk keeps actual attack paths ahead of the optimizer
and collapses the editor until needed. It exposes current approved exposure,
the review queue, source count, SHA-256 digest verification, decision reference,
and the permanent ledger without representing planning assumptions as measured
loss. The contextual Attack Paths guide was followed literally in the demo:
preview produced $307,500, submission remained inactive, approval activated the
version, and the approved state remained usable at 390px with no horizontal
overflow.

The API retires direct asset-valuation mutation with `410`; tenant authorization,
row-level security, database immutability, submission/review audits, duplicate
decision denial, and cross-tenant denial are covered by the database-backed
acceptance proof. The operator and qualification procedure is in
`docs/BUSINESS_IMPACT_OPERATIONS_RUNBOOK.md`.

The workflow is still a customer planning model, not measured loss history, an
actuarial opinion, or a complete FAIR assessment. A 5.0 analyst score requires
finance/risk governance, multiple qualified customers, calibration, support/SLO
evidence, and independent usability proof.

The final database-backed `pnpm verify` gate passes on this tree: 79 web files /
256 tests, 25 API files / 332 tests, 26 shared files / 144 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 135 acceptance files / 174 tests, and all 140
migrations. License, production-dependency, enum-drift, PRD, and 110-row
analyst-score gates also pass.

## Current Addendum — 2026-07-16 governed localization releases

Analyst row 96 now has an end-to-end tenant-scoped localization release
lifecycle. Periscan ships exact, centralized en-US, es-ES, fr-FR, de-DE, and
ja-JP catalogs for product-shell navigation and Validation Snapshot report
chrome. Each catalog exposes version, SHA-256 digest, key-level coverage, and
fallback counts. Administrators can preview locale and IANA-timezone formatting
without mutation, then activate one reviewed policy with support ownership and
review provenance.

Activation atomically updates locale/timezone presentation, appends an
immutable release, emits an explicit audit event, and refreshes navigation and
HTML language in place. Recovery is another reviewed activation, so prior
history is never edited. The release desk exposes data region, content and
residency boundaries, coverage rails, exact formatting, and the permanent
ledger in one calm operational surface.

The contextual Admin guide was followed literally in the live product:
Japanese preview and activation succeeded, navigation changed in place, a new
Japanese report localized governed headings while UUID evidence and verdict
values stayed stable, and English/UTC recovery created sequence 2 while the
`us-east-1` data region and sequence 1 remained unchanged. Desktop and 390px
had zero horizontal overflow and no browser-console errors.

Long-tail page/help/customer content, regulatory, tax, legal and procurement
language, data residency, and cross-border authorization remain outside this
presentation release. The operator and qualification procedure is in
`docs/LOCALIZATION_OPERATIONS_RUNBOOK.md`.

The final database-backed `pnpm verify` gate passes on this tree: 78 web files /
255 tests, 25 API files / 332 tests, 25 shared files / 141 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 134 acceptance files / 173 tests, and all 138
migrations. License, dependency, enum-drift, PRD, and 110-row analyst score
gates also pass.

## Current Addendum — 2026-07-15 continuous subscription operations

Analyst row 93 now has an end-to-end tenant-scoped direct-agreement lifecycle.
Administrators can start one reviewed term, see deterministic renewal
checkpoints, approve or decline the next term, preserve access through a
bounded grace exception, schedule and revoke cancellation at the immutable
term boundary, and reconcile a due renewal or termination. Reconciliation
closes the completed period with real usage evidence; an ended lifecycle
removes the package entitlement fail closed.

The Billing UI presents this as a calm term and decision rail with explicit
next action, provider boundary, recovery controls, and a typed cancellation
gate. Every state mutation is audited, periods remain immutable, and the event
ledger is hash-linked and verified on read. The product guide was exercised on
desktop and at 390px: term creation and renewal approval succeeded, the ledger
updated in place, no horizontal overflow occurred, and the browser console was
clean.

Payment charging, tax, invoicing, settlement, and procurement remain
`NotConfigured`; the term ledger never represents them as complete. The
operator and qualification procedure is in
`docs/SUBSCRIPTION_OPERATIONS_RUNBOOK.md`.

The final database-backed `pnpm verify` gate passes on this tree: 77 web files /
254 tests, 25 API files / 332 tests, 24 shared files / 137 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 134 acceptance files / 173 tests, and all 136
migrations. License, dependency, enum-drift, PRD, and 110-row analyst score
gates also pass.

## Current Addendum — 2026-07-15 signed extension developer program

Analyst row 110 now has a complete tenant-scoped developer and catalog
lifecycle for signed OCI extension contracts. Operators can create a project,
generate a deterministic five-file SDK scaffold with per-file SHA-256 hashes,
submit immutable semantic versions, inspect deterministic compatibility
findings, record a human certification or rejection, activate one reviewed
catalog version, atomically upgrade or roll back, and revoke a release. Every
mutation is persisted and audited; failed compatibility cannot be certified.

The primary UI is a restrained release rail rather than another marketplace
card grid. It exposes the active digest, signer, capabilities, allowlist,
compatibility result, review reason, support ownership, recovery actions, and
the permanent **Runtime blocked** boundary. Live desktop and 390px browser
checks exercised project creation and scaffold generation from the page guide,
found no horizontal overflow, and recorded no console errors.

Catalog activation is deliberately not runner authorization. The API and a
database constraint keep `executionAuthorized` false for every release;
arbitrary source/Python upload remains prohibited. A future runnable extension
still needs a reviewed first-party module binding, license and security review,
verified customer-authorized scope, policy approval, runner eligibility, and a
supported evidence-normalization path. The full developer procedure and
qualification commands are in `docs/EXTENSION_DEVELOPER_RUNBOOK.md`.

The final database-backed `pnpm verify` gate passes on this tree: 76 web files /
253 tests, 25 API files / 331 tests, 23 shared files / 134 tests, 7 module files /
176 tests, a clean 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 133 acceptance files / 172 tests, and all 134
migrations. License, dependency, enum-drift, PRD, and 110-row analyst score
gates also pass.

## Current Addendum — 2026-07-15 W3C AgentDID delegation

Periscan now has a governed relying-party implementation for cross-organization
agent identity. A tenant admin binds a verified scope and policy decision to one
approved, structurally conformant A2A endpoint, its reviewed capability set, an
exact `did:web` agent subject, an exact trusted `did:web` issuer, allowed VC
types, audience, and endpoint origin. DID resolution is HTTPS- and SSRF-bounded
(loopback HTTP only in development), and stores document hashes and normalized
metadata rather than raw DID documents.

Short-lived W3C VC 2.0 `vc+jwt` credentials verify the issuer's DID
`assertionMethod`, public JWK, JOSE algorithm and signature, issuer, subject,
audience, endpoint origin, SPIFFE workload, matching VC/JWT validity, and an
allowed A2A capability subset. Unsupported credential-status methods and
private key material fail closed. Raw compact credentials are never persisted.
Endpoint policy can require the verified credential ID in each signed receipt;
the receipt must remain within the same credential endpoint, workload, and
validity boundary. DID document rotation automatically revokes active
credentials, and tenant revocation cascades to the profile's credentials.

The API, UI trust ledger, inline help, stable-spec runbook, unit/component
coverage, and database-backed local relying-party lab are implemented. The
focused lab passed real ES256 signing and DID resolution, receipt binding,
excess-capability rejection, rotation revocation, and tenant revocation.
Partner-operated issuer/DNS/TLS/wallet qualification remains external evidence,
so analyst row 51 is Strong at 3.75 rather than complete at 4.0.

The final database-backed `pnpm verify` gate passes on this tree: 75 web files /
252 tests, 25 API files / 330 tests, 22 shared files / 132 tests, 7 module files /
175 tests, a clean 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 132 acceptance files / 171 tests, and all 132
migrations. License, dependency, enum-drift, PRD, and 110-row analyst score
gates also pass.

## Current Addendum — 2026-07-15 agent trust OSS proof

The official A2A TCK and Veraison challenge-response protocols are implemented
as governed product workflows, not catalog placeholders. A2A qualification is
pinned, scope- and policy-bound, requires explicit active-traffic consent, runs
in a disposable workspace with an allowlisted subprocess environment, and
stores normalized hashed proof. Veraison binds a one-use remote challenge,
verifier origin, evidence media type/hash, workload, policy, scope, expected
claims, and result hashes while retaining no raw evidence.

The operator surface exposes certainty states and live progress for both flows,
and its page guide was exercised against the rendered controls. The actual
pinned TCK qualification correctly rejected a deliberately incomplete service;
the database-backed acceptance path covers positive executor proof and the
Veraison 201/202/poll/delete lifecycle. Real partner conformance, provisioned
Veraison endorsements/trust anchors, and real hardware evidence remain external
qualification requirements and are not inferred.

The post-build `pnpm verify` gate passes: 75 web files / 251 tests, 25 API
files / 327 tests, 22 shared files / 129 tests, 7 module files / 175 tests, a
clean 53-route production build, 94 Playwright journeys, 25 security-boundary
tests, 131 acceptance files / 170 tests, and all 131 migrations. License,
dependency, enum-drift, PRD, and 110-row analyst score gates also pass.

## Current Addendum — 2026-07-15 analyst-completion loop

Status: implemented for every safe product capability in the 110-row analyst
matrix. External contracts, customer credentials, commercial approvals,
hardware operation, and production-scale SLOs remain explicit configuration or
qualification gates rather than simulated product state.

The final W1–W7 completion loop added or verified:

- safe, policy-gated control stimuli; graph-wide path-breaker optimization;
  signed scenario compilation, preview/approval integrity, and evidence-gated
  branches;
- bounded live AI validation categories, non-exfiltrating model-extraction
  resistance, RAG-poisoning resistance, and a kill-switch drill that proves no
  later task was accepted;
- exact-diff governed remediation, real GitHub branch/commit/pull-request
  creation without merge authority, CI/merge refresh, rollback of unmerged
  changes, and mandatory revalidation state;
- a dedicated read-only VMware vCenter connector for datacenters, clusters,
  ESXi hosts, networks, and VMs, including session health, normalized assets and
  redacted signals;
- a tenant-scoped unified data fabric with source observations, deterministic
  entity resolution, lineage, freshness, and live UI; explainable deterministic
  agent-behavior analytics over the durable workflow event ledger;
- a live RTAP collaboration workspace with roles, notes, lead assignment,
  evidence pins restricted to the engagement, status changes, five-second
  refresh, deterministic range replay, and hash-chain integrity;
- managed-provider model operations: budgets, rate and concurrent-turn limits,
  Priority admission, safe provider routing, adapter/precision attribution,
  evidence-preserving context pruning, policy-isolated semantic caching, and
  tenant FinOps;
- a machine-readable local performance qualification artifact and documented
  claim boundary. The recorded Docker/Postgres/Redis run passed with zero
  non-2xx responses, but `productionScaleClaimValidated` remains `false`.

Enterprise breadth readiness is product-visible and real-first. Trial and
entitlement lifecycles are operational. Payment processing and AWS Marketplace
procurement remain `NotConfigured` / `ExternallyGated` until pricing, tax,
support, legal, data-processing, seller-account, and provider approvals exist.
The product does not generate fake marketplace entitlements or payment events.

The canonical database-backed `pnpm verify` gate passes on this tree: 53 web
routes build from clean artifacts; web passes 73 files / 246 tests; API passes
23 files / 320 tests; Playwright passes 93 journeys; security passes 25 tests;
acceptance passes 129 files / 166 tests; all 125 migrations are deployed; and
the enum-drift, PRD, dependency, license, runner, and local-lab gates pass. The
secondary source-to-product audit passes 39 files / 157 tests, including the
focused 3–5 Snapshot result contract and atomic risk-factor explanation. The
dependency audit reports one low-severity development-only `esbuild` advisory,
zero high-or-higher advisories, and zero production advisories at or above
moderate.

## Current Addendum — 2026-06-28

PRD section 3 Product Modules parent coverage is now source-mapped rather than
left as a broad inventory row. `tests/modules/prd-product-modules-coverage.test.ts`
parses section 3 headings and verifies every child module subsection has an
`EvidenceMapped` child source row with source-derived test evidence.

This parent row intentionally does not duplicate each child module's behavioral
audit. It proves that the section 3 inventory cannot change without forcing a
source-led update for the relevant child row. Child rows remain responsible for
the detailed Validation Snapshot, Continuous Exposure, Control Validation,
Attack-Path, AI App Validation, Fix Verification, Evidence Packs, Operators,
and Frontier Gateway requirements.

Validation evidence: `pnpm test:modules -- prd-product-modules-coverage
coordination-docs prd-audit-gate` PASS (25 files / 94 tests); `pnpm
prd:audit` PASS and now reports `SRC-3-MODULES` as `EvidenceMapped`.

## Current Addendum — 2026-06-28

PRD section 16 Reports coverage is now source-mapped instead of inferred from
Evidence Pack templates, Snapshot export routes, or broad report-generator
tests. `tests/modules/prd-reports-coverage.test.ts` parses section 16 and
verifies every Validation Snapshot Report section and audience variant against
HTML/PDF output from the report generator.

This source-first audit found three customer-facing report drifts. HTML used
the hero as a summary but did not render an explicit `Executive Summary`
section, the default report label rendered as `Periscan Validation Snapshot`
instead of `Periscan Validation Snapshot Report`, and report sections used
implementation terms `Control Observations` / `AI App Risks` instead of the PRD
labels `Control Verdicts` / `AI App Validation`. The report generator and
tests now use the PRD labels while keeping internal schema names stable.

Validation evidence: `pnpm --filter @periscan/reports test` PASS (1 file / 20
tests); `pnpm test:modules -- prd-reports-coverage
prd-evidence-packs-coverage prd-validation-snapshot-coverage
prd-product-principles-coverage prd-ai-app-validation-coverage` PASS (24 files
/ 93 tests); `pnpm test:modules -- prd-reports-coverage coordination-docs
prd-audit-gate` PASS (24 files / 93 tests); full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 3.8 Periscan Operators coverage is now source-mapped instead of
inferred from broad operator, model-gateway, signal-trigger, or evidence-summary
history. `tests/modules/prd-operators-coverage.test.ts` parses section 3.8 and
verifies every PRD-named operator, recommendation-only behavior, policy
approval gate, evidence-ID requirement, uncertainty label, no-invented-outcomes
rule, and safety-level boundary against implementation evidence.

This source-first audit found two real gaps that broad operator coverage did
not catch. Operator recommendations could be emitted from configuration counts
alone with empty `evidenceIds`, and the Blue Team Operator recognized exact
`Missed`/`NoEvidence`/`NeedsTuning` strings but missed descriptive normalized
signals such as `Missed credential-use detection`. Recommendations now require
at least one evidence ID, proofless branches are suppressed, all operator
mission plans are approval-gated, and descriptive missed/no-evidence/tuning
control labels trigger Blue Team recommendations.

Validation evidence: `pnpm test:modules -- prd-operators-coverage` PASS (23
files / 91 tests); `pnpm test:modules -- prd-operators-coverage
coordination-docs prd-audit-gate` PASS (23 files / 91 tests); `pnpm --filter
@periscan/operators test` PASS; `pnpm --filter @periscan/operators
typecheck` PASS; `pnpm --filter @periscan/api test -- app.test.ts` PASS (19
files / 302 tests); full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

The audit discipline change is deliberate: completion can no longer be claimed
from broad feature rows alone. `pnpm prd:audit` now keeps source rows separate
from requirement atoms and still reports full-product completion as blocked
until every source row is either evidence-mapped or explicitly blocked.

## Current Addendum — 2026-06-28

PRD section 3.7 Evidence Packs coverage is now source-mapped instead of
inferred from broad report-template, Snapshot export, compliance-pack, or MSSP
white-label history. `tests/modules/prd-evidence-packs-coverage.test.ts`
parses section 3.7 and verifies every Evidence Pack type, normalized evidence
rule, evidence-ID rule, redaction rule, audience variant, HTML/PDF export path,
and MSSP white-label requirement against implementation evidence.

This source-first audit found the same failure class as the earlier misses: a
broad row said Evidence Pack templates existed, but no test mechanically
compared the PRD's pack list to public contract/rendering behavior. The audit
found and fixed one customer-facing drift: the stable API/database enum remains
`AIAppValidationReport`, while rendered reports now use the PRD label
`Periscan AI Security Validation Report`.

Validation evidence: `pnpm test:modules -- prd-evidence-packs-coverage` PASS
(22 files / 87 tests); `pnpm --filter @periscan/reports test` PASS; `pnpm
--filter @periscan/shared test -- domain` PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 3.6 Fix Verification coverage is now source-mapped instead of
inferred from the existence of remediation APIs, ticket routing, verification
events, or no-fix-without-proof tests. `tests/modules/prd-fix-verification-coverage.test.ts`
parses section 3.6 and verifies every outcome, remediation linkage, ticket
status, closed-without-verification state, targeted retest, verification event,
attack-path/risk update, and evidence-pack/report behavior against
implementation evidence.

This source-first audit found the process failure that caused previous
"complete" claims to be unreliable: broad rows proved adjacent behavior, but no
test mechanically compared the PRD's `Closed Without Evidence` outcome and
closed-without-verification requirement to the ticket-sync implementation. That
gap is now closed. External ticket-close sync marks verification-required
remediations as `ClosedWithoutEvidence` and writes
`remediation.closed_without_evidence`; users or automation can still move the
item to `VerificationPending` and run an actual policy-gated verification.

Validation evidence for this addendum so far: `pnpm test:modules --
prd-fix-verification-coverage` PASS (21 files / 84 tests);
`pnpm --filter @periscan/api test -- runtime-services.test.ts -t
"resolveExternalTicketClosedRemediationStatus|buildVerificationResult
evidence-basis"` PASS; `pnpm --filter @periscan/api test -- app.test.ts -t
"supports Jira ticketing and fix verification through the API"` PASS;
`pnpm --filter @periscan/shared test -- domain` PASS; `pnpm --filter
@periscan/db run db:validate` PASS.

## Current Addendum — 2026-06-28

PRD section 3.3 Control Validation coverage is now source-mapped instead of
inferred from broad control-source, connector, and Atomic dry-run history.
`tests/modules/prd-control-validation-coverage.test.ts` parses section 3.3 and
verifies every control category, control outcome, detect/block/log/alert/route
requirement, ATT&CK scenario mapping, dry-run Atomic boundary, tuning
recommendation, evidence ID, and before/after coverage-summary behavior against
implementation evidence.

This audit did not find a product-code defect. It found that prior completion
evidence was too broad: control validation APIs and observer connectors existed,
but no regression mechanically compared the PRD's control list, outcome list,
or trend/tuning/evidence requirements to schemas and behavior.

Validation evidence for this addendum so far: `pnpm test:modules --
prd-control-validation-coverage` PASS (18 files / 68 tests).

## Current Addendum — 2026-06-28

PRD section 3.2 Continuous Exposure Validation coverage is now
source-mapped instead of inferred from schedule, CTEM, and reopened-risk
history. `tests/modules/prd-continuous-exposure-coverage.test.ts` parses
section 3.2 and verifies every coverage area, validation state, recurring
schedule requirement, drift/reopened behavior, validated-risk separation, and
CTEM stage against implementation evidence.

This audit did not find a product-code defect. It did find that the prior
completion evidence was too broad: scheduler and CTEM rows existed, but no test
mechanically compared the PRD's coverage list or CTEM stage list to real
connectors, modules, scopes, and public contracts.

Validation evidence for this addendum so far: `pnpm test:modules --
prd-continuous-exposure-coverage` PASS (17 files / 63 tests).

## Current Addendum — 2026-06-28

PRD section 2 Product Principles coverage is now evidence-mapped instead of
inferred from broad safety tests, report tests, or product prose.
`tests/modules/prd-product-principles-coverage.test.ts` parses section 2 and
verifies proof-over-findings surfaces, evidence-grounded AI workflow support,
safety-as-product rules, and the land-with-proof expansion path.

This source-first audit found a product-surface drift: the stable
`/api/v1/findings` resource was still presented in the primary web navigation
and page copy as `Findings`, which reads like the raw scanner-dashboard pattern
section 2.1 explicitly rejects. The API contract remains unchanged, but the
first-party UI now labels the route as `Validated Results` and describes the
page as an evidence-backed results/proof queue.

Validation evidence for this addendum so far: `pnpm test:modules --
prd-product-principles-coverage` PASS (16 files / 59 tests) and `pnpm
--filter @periscan/web test -- findings-workbench app-navigation` PASS (3
files / 12 tests).

## Current Addendum — 2026-06-28

PRD section 3.1 Validation Snapshot coverage is now evidence-mapped instead of
inferred from the existence of Snapshot APIs, reports, demo data, or E2E flows.
`tests/modules/prd-validation-snapshot-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 3.1 inputs, outputs, and
requirements, then verifies API-visible onboarding surfaces, normalized Snapshot
schema/report fields, optional-runner behavior, verified-scope enforcement,
HTML/PDF export support, and the evidence/remediation/verification proof loop.

This source-first audit found two real semantic gaps that broad "Snapshot
works" checks did not catch: generated top paths could previously be capped at
10 instead of the PRD's 3-5 high-value result requirement, and remediation was
generated only for Critical/High top paths rather than every displayed result.
`apps/api/src/services/snapshots.ts` and `apps/api/src/runtime-services.ts` now
cap generated top paths at 5 and create remediation for every displayed top
path.

Validation evidence for this addendum: `pnpm test:modules --
prd-validation-snapshot-coverage` PASS (15 files / 54 tests); `pnpm
test:modules -- prd-validation-snapshot-coverage coordination-docs
prd-audit-gate` PASS (15 files / 55 tests); `pnpm prd:audit` PASS; `pnpm
lint` PASS; `pnpm typecheck` PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 14 Runner coverage is now atomized instead of inferred from runner
binary existence, deployment files, or local-lab tests. `tests/modules/prd-runner-coverage.test.ts`
parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 14 deployment, security, and
flow requirements, then maps Docker/Linux/Kubernetes/Windows deployment
contracts, outbound HTTPS signed-task polling, signed envelopes, local scope
constraints, timeouts/resource ceilings, local audit/evidence upload, kill
switch behavior, and API lifecycle routes to runner implementation evidence.

The runner mTLS source divergence is resolved in the implementation: section 14
says `mTLS` and that the runner receives a certificate, and the current
authoritative `docs/RUNNER_SPEC.md` and implementation now issue tenant-scoped
runner client certificates from CSRs, persist the certificate SHA-256
fingerprint, return tenant CA/client certificate material, and preserve outbound
signed-task polling with bearer-token defense in depth. `PRD-RUNNER-003` is
recorded as `Implemented`; production TLS termination must forward the verified
certificate fingerprint to the API when `PERISCAN_RUNNER_REQUIRE_MTLS=true`
(or when unset and `NODE_ENV=production`; explicit `false` opts out).

Validation evidence for this addendum: `pnpm test:modules --
prd-runner-coverage coordination-docs prd-audit-gate` PASS (14 files / 51
tests); `pnpm prd:audit` PASS; `pnpm lint` PASS; `pnpm typecheck` PASS; full
`pnpm verify` PASS on 2026-06-28 with lint, typecheck, workspace tests,
production build, Docker-backed Go runner tests, runner lab, OSS toolchain,
license gates, Prisma generate/validate/migrate deploy, Playwright E2E 58/58,
security 22/22, dependency audits, PRD audit, and acceptance 100 files / 123
tests. The follow-up full-completion slice converts `PRD-COMPLETE-001` from a
self-referential partial row into a strict-audit gate backed by the full
completion report and release validation.

## Current Addendum — 2026-06-28

PRD audit discipline now has an executable gate instead of relying only on
reviewer behavior. `scripts/prd-audit-gate.ts` parses
`docs/PRD_SOURCE_COVERAGE_LEDGER.md` and `docs/PRD_REQUIREMENT_LEDGER.md`,
reports unresolved source sections and requirement atoms, and computes whether a
full-product completion claim is currently allowed. The normal `pnpm prd:audit`
check is now included in `pnpm verify`; it fails if audit artifacts or
completion-report mode regress. `pnpm prd:audit:strict` is reserved for final
release/completion review and now requires a full-product completion report,
zero unresolved source rows, zero unresolved requirement atoms, and full
validation evidence after the final change.

This closes the latest audit-process gap: source-first protocol docs were
present, but a human could still overlook unresolved source-ledger rows while
reading a readiness report. `docs/COMPLETION_REPORT.md` now carries the
full-PRD implementation completion claim and separately lists external
customer/deployment prerequisites.

Validation evidence for this addendum so far: `pnpm test:modules --
prd-audit-gate coordination-docs` PASS and `pnpm prd:audit` PASS.

## Current Addendum — 2026-06-28

PRD section 13 Risk Scoring coverage is now evidence-mapped instead of
inferred from risk-engine existence or risk-factor rendering. `tests/modules/prd-risk-scoring-coverage.test.ts`
parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 13 inputs, formula, and
modifiers, then verifies `RiskScoreInputSchema`, formula-level risk factors,
directional modifier behavior, and no-fix-without-verification semantics.

This audit found and fixed one real scoring drift: `Reopened` previously scored
lower than stable `Validated`; it now increases score as required by PRD
section 13.3. The shared risk input contract now also exposes optional explicit
fields for reachability, exploitability, known exploitation, threat relevance,
recurrence, remediation status, and sensitive data while preserving existing
callers.

Validation evidence for this addendum: `pnpm --filter @periscan/shared test --
domain` PASS (20 files / 129 tests); `pnpm --filter @periscan/evidence test`
PASS (4 files / 26 tests); `pnpm test:modules --
prd-risk-scoring-coverage coordination-docs` PASS (12 files / 45 tests);
shared/evidence typecheck PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 12 Evidence Graph coverage is now evidence-mapped instead of
inferred from graph table/service existence. `tests/modules/prd-evidence-graph-coverage.test.ts`
parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 12 nodes, edges, and
required questions, then verifies graph node contracts, Postgres graph tables,
shared and Prisma relationship enums, and evidence-linked graph service
behavior for reachability, identity access, secret-to-cloud-role paths, control
misses, highest-impact paths, path breakers, closed-without-proof state, and
reopened state.

Validation evidence for this addendum: `pnpm test:modules --
prd-evidence-graph-coverage` PASS (11 files / 40 tests); `pnpm test:modules --
prd-evidence-graph-coverage coordination-docs` PASS (11 files / 41 tests);
`pnpm --filter @periscan/evidence test` PASS (4 files / 24 tests); full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 11 Policy and Safety Engine coverage is now evidence-mapped instead
of inferred from broad security-boundary tests. `tests/modules/prd-policy-safety-coverage.test.ts`
parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 11 inputs, outputs, rules,
and audit requirement, then verifies central policy schemas, evaluator behavior,
requested-action flags, tenant-policy and target inputs, and policy-decision
audit persistence. The source audit found and fixed missing evaluator contract
fields for `tenantPolicy` and `target`; tenant policy is stricter-only and
cannot weaken global safety denials.

Validation evidence for this addendum so far: `pnpm --filter @periscan/policy
test` PASS (2 files / 27 tests); `pnpm test:modules --
prd-policy-safety-coverage coordination-docs` PASS (10 files / 37 tests);
focused accumulated-state scheduler acceptance files PASS (3 files / 3 tests);
`pnpm typecheck` PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

Audit process correction from this slice: full `pnpm verify` initially exposed
three continuous-validation sweep acceptance timeouts even though the files
passed in isolation. The shared acceptance DB had hundreds of unrelated due
tenants, and direct scheduler tests swept that historical work. The scheduler
now accepts explicit `tenantIds` for deterministic internal/test invocations
while production still defaults to all due tenants. `docs/PRD_AUDIT_PROTOCOL.md`
now requires accumulated-state release validation for scheduler, persistence,
shared runtime, public API, and security-boundary changes.

## Current Addendum — 2026-06-28

PRD section 10 OSS Acceleration Plan coverage is now evidence-mapped instead of
inferred from third-party tool governance history or broad module certification
totals. `tests/modules/prd-oss-plan-coverage.test.ts` parses
`docs/PERISCAN_FULL_PRODUCT_PRD.md` section 10.1 engine names and section 10.2
OSS policy bullets, then verifies reviewed toolchain metadata, capabilities,
module manifests, safety levels, license policy, module certification checks,
normalized evidence output, and primary reports excluding raw tool output.

Validation evidence for this addendum: `pnpm test:modules --
prd-oss-plan-coverage` PASS (9 files / 32 tests); focused `pnpm test:modules
-- prd-oss-plan-coverage coordination-docs` PASS (9 files / 33 tests); full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 9 Module Registry coverage is now evidence-mapped instead of
inferred from module count and OSS tool history. `tests/modules/prd-module-registry-coverage.test.ts`
parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 9 manifest fields and safety
levels, verifies each PRD manifest field exists in `ModuleManifestSchema` and
every registered module manifest, and verifies PRD safety levels 0-5 map to
`SafetyLevelSchema`.

Validation evidence for this addendum: `pnpm test:modules --
prd-module-registry-coverage` PASS (8 files / 29 tests); focused
`pnpm test:modules -- prd-module-registry-coverage coordination-docs` PASS (8
files / 30 tests); full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 8 Signal Fabric coverage is now evidence-mapped instead of inferred
from the breadth of the connector catalog. `tests/modules/prd-signal-fabric-coverage.test.ts`
parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 8 category, MVP, and V1
integration lists and verifies every PRD item maps to connector catalog entries
or explicit platform surfaces such as Domain/Subdomain scopes, the safe
external validation module, and AI application endpoint registration. The audit
found no missing Signal Fabric connector or platform surface; it records
explicit equivalence mappings for capability nouns like `CI/CD`, `container
registries`, `MDR`, `RAG systems`, `vector DBs`, `guardrails`, and `agent
frameworks`.

Validation evidence for this addendum: `pnpm test:modules --
prd-signal-fabric-coverage` PASS (7 files / 26 tests), focused
`pnpm test:modules -- prd-signal-fabric-coverage coordination-docs` PASS (7
files / 27 tests), and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-28

PRD section 6 Data Model coverage is now evidence-mapped instead of assumed
from the breadth of existing Prisma/shared schemas. `tests/modules/prd-data-model-coverage.test.ts`
parses `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 6 core entity/field lists
and verifies every entity field is represented in both `packages/shared/src/domain.ts`
and `packages/db/prisma/schema.prisma`. The same test extracts PRD scope-type
bullets and verifies shared/Prisma enum alignment. The audit found no missing
durable fields; it did identify three intentional AI app naming aliases:
`endpoint` maps to `endpointUrl`, `data_sources` maps to
`dataSourcesDescription`, and `guardrails` maps to `guardrailsDescription`.

Validation evidence for this addendum: `pnpm test:modules --
prd-data-model-coverage` PASS (6 files / 22 tests), focused
`pnpm test:modules -- prd-data-model-coverage coordination-docs` PASS (6 files
/ 23 tests), and full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

PRD section 7 API Specification coverage is now evidence-mapped instead of
assumed from broad API-first status. A source-first route audit now extracts the
baseline route inventory from `docs/PERISCAN_FULL_PRODUCT_PRD.md` section 7 and
compares it against the generated OpenAPI document in `apps/api/src/app.test.ts`.
That audit found two missing public API routes: `POST
/api/v1/missions/:id/cancel` and `POST /api/v1/attack-paths/:id/verify`. Both
are now implemented and OpenAPI-documented. Mission cancellation is
tenant-scoped, updates queued/running validation runs and jobs, writes
`mission.cancelled`, and the worker skips terminal cancelled jobs rather than
reviving them as running. Attack-path verification creates a verified-scope,
policy-gated draft verification mission with `queued: false` and
`RequiresApproval`; it does not execute validation, invent evidence, or mark
risk fixed.

Validation evidence for this addendum: `pnpm --filter @periscan/shared test --
domain` PASS; `pnpm --filter @periscan/api test -- app.test.ts` PASS (19 files
/ 300 tests); `pnpm --filter @periscan/worker test -- processor` PASS (6 files
/ 26 tests); focused shared/API/worker typecheck and lint PASS; full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

Frontier Gateway source coverage is now evidence-mapped in the source-first
audit ledgers. `docs/PRD_REQUIREMENT_LEDGER.md` splits the PRD section into
`PRD-FG-001` through `PRD-FG-010`, and a scoped-context gap found during that
audit is closed in code. `packages/model-gateway/src/engine/scope-filter.ts`
now resolves verified session scopes and filters context/tool reads to matching
assets plus linked exposures and attack paths. Context bundles, interactive
read-only tools, and queued turn-runner read-only tools no longer return
tenant-wide assets/exposures/paths to a model just because the data belongs to
the same tenant. Validation evidence: `pnpm --filter @periscan/model-gateway
test` PASS (7 files / 34 tests), `pnpm --filter @periscan/model-gateway
typecheck` PASS, `pnpm --filter @periscan/model-gateway lint` PASS, and full
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

PRD auditing now has a source-first protocol, a source coverage ledger, an
atomic requirement ledger, and a machine-checkable third-party tool coverage
audit. The miss on third-party tool certification history happened because prior
audits relied too much on newest-first execution history, broad traceability
labels, and green test results instead of decomposing the PRD into atomic verbs
and durable-state requirements. A second audit defect is also now documented:
the first requirement ledger was a seed ledger focused on the latest miss, not a
full long-form PRD section index. `docs/PRD_AUDIT_PROTOCOL.md` documents the
failure mode, completion standard, and completion-claim policy.
`docs/PRD_SOURCE_COVERAGE_LEDGER.md` now indexes the major long-form PRD
sections, `docs/PRD_REQUIREMENT_LEDGER.md` tracks detailed atoms, and
`GET /api/v1/third-party-tools/coverage-audit` now classifies every governed
OSS/security tool as executable, content/import-only, deferred, blocked, or
still needing implementation.

Validation evidence for this addendum: `pnpm test:modules -- coordination-docs`
PASS (5 files / 19 tests) for the protocol/source-coverage/ledger regression, plus focused
`@periscan/shared`, `@periscan/api`, and `@periscan/web` tests for the
third-party tool coverage audit API and client.

## Historical Addendum — 2026-06-28

Third-Party Tool Governance now includes durable promotion certification
history. `POST
/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications`
persists a tenant-scoped snapshot of the current certification report, writes
`third_party_tool.promotion_certified`, and records the snapshot in the
per-tool activity timeline. `GET .../certifications` lists saved snapshots for
API customers and replacement UIs. Snapshot creation remains non-executing: it
does not enable tools, install runtimes, queue missions, dispatch runner tasks,
or execute modules.

Validation evidence for this addendum: focused shared/db/API/web/OpenAPI/lint/typecheck
checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Historical Addendum — 2026-06-28

Third-Party Tool Governance now includes read-only promotion certification
reports for systematic tool-library expansion.
`GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certification-report`
lets tenant Owner/Admin users certify a promoted candidate package against
current catalog, module/capability, required-evidence, governance, runtime,
runner, policy, and safety gates before use. Registry Center consumes the same
API through `Load certification report`. The workflow is read-only: it does not
enable tools, install runtimes, queue missions, dispatch runner tasks, or
execute modules.

Validation evidence for this addendum: focused shared/API/web/OpenAPI/lint/typecheck
checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Historical Addendum — 2026-06-28

Third-Party Tool Governance now includes API-first candidate readiness summaries
for systematic tool-library expansion.
`GET /api/v1/third-party-tools/intake/candidates/readiness-summary` lets tenant
Owner/Admin users triage the entire tenant candidate backlog at once. The API
returns all current candidates with per-candidate readiness reports, readiness
counts, review/intake counts, top required actions, and explicit no-side-effect
markers. Registry Center consumes the same API through `Summarize readiness`.
The workflow is read-only: it does not create catalog entries, install or enable
tools, queue missions, dispatch runner tasks, or execute modules.

Validation evidence for this addendum: focused shared/API/web/OpenAPI/lint/typecheck checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` PASS with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## Historical Addendum — 2026-06-28

Third-Party Tool Governance now includes API-first candidate batch imports for
systematic library expansion.
`POST /api/v1/third-party-tools/intake/candidates/import` lets tenant
Owner/Admin users submit bounded batches of proposed tool manifests. Each item
is validated independently, malformed and duplicate entries return item-level
errors, successful entries persist into the same candidate backlog as single
submissions, and the API writes per-candidate plus batch audit metadata. The
workflow is non-executing: it does not create catalog entries, install or enable
tools, queue missions, dispatch runner tasks, or execute modules. Registry
Center consumes the same API through a batch manifest JSON import control.

Validation evidence for this addendum: focused shared/db/API/web/OpenAPI/audit
checks PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Historical Addendum — 2026-06-28

Third-Party Tool Governance now includes non-executing implementation bundle
exports for accepted tool work orders.
`GET /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle`
derives a tenant-scoped scaffold bundle from the persisted work order. The
response includes scaffold file content, SHA-256 hashes, validation commands,
required actions, safety notes, and `doesNotExecute: true`. The route writes
`third_party_tool.implementation_bundle_generated` audit metadata and remains a
planning/review artifact only: it does not write repository files, install or
enable tools, queue missions, dispatch runner tasks, or execute modules.
Registry Center consumes the same API through `Load implementation bundle`.

Validation evidence for this addendum: focused shared/db/API/web checks PASS;
API/web lint PASS; full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS after correcting the migration to alter `AuditEventAction`,
with lint, typecheck, workspace tests, production build, runner tests, runner
lab, OSS toolchain, license gates, Prisma generate/validate/migrate deploy,
Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100
files / 123 tests.

## Historical Addendum — 2026-06-28

Third-Party Tool Governance now includes a systematic due-refresh workflow for
the expanding reviewed OSS validation tool library.
`POST /api/v1/third-party-tools/refresh-due` lets tenant Owner/Admin users
batch-check due reviewed tools, creating the same persisted trusted upstream
checks and reviewed update recommendations used by the per-tool endpoints.
Disabled, deferred, and legal-review tools are skipped by default with explicit
reasons and actions. The route writes
`third_party_tool.refresh_due_checked`, publishes OpenAPI/client contracts, and
Registry Center consumes it through `Refresh due tools`. This workflow is
non-executing: it does not install, enable, queue missions, dispatch runner
tasks, or execute modules.

Full release-gate evidence for this addendum:
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22,
dependency audits, and acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-27

Third-party tool activity now includes runner task lifecycle entries.
`/api/v1/third-party-tools/:toolId/activity` aggregates persisted runner tasks
whose module IDs are bound to the requested tool, alongside audit events,
validation runs, install jobs, updates, candidates, work orders, and promotion
packages. Runner task activity exposes task status, task ID, module ID, runner
ID, scope ID, run ID, task type, and evidence count without serializing raw
targets into activity metadata.

Registry Center now includes governed internal-runner dispatch controls for
third-party tools. After an admin loads `/api/v1/third-party-tools/:toolId/runner-eligibility`,
the UI renders dispatch controls only for capabilities the API marks
`dispatchable`. Submitting the form calls
`/api/v1/third-party-tools/:toolId/runner-dispatch` with the selected capability,
runner ID, verified scope ID, target, timeout, and rate limit, then renders the
persisted task, mission, and run IDs from the signed runner task creation
response. The UI does not perform local execution or bypass server enforcement;
tenant enablement, verified scope, policy decisions, runner kill switch,
server allowlists, signed envelopes, and audit events remain centralized in the
API and runner services.

Third-Party Tool Governance now includes promotion governance handoff reports.
`/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/governance-handoff`
computes current tenant next steps from the durable promotion package, tenant
governance policy, runtime readiness, and runner eligibility. The response
classifies the promoted tool as blocked, ready for governance action, needing
runtime action, needing runner prerequisites, or ready for explicit
policy-gated execution. It lists exact next API actions and flags whether each
action creates execution or requires policy approval. Registry Center consumes
the same endpoint through `Load governance handoff`. The handoff is read-only:
it does not install, enable, queue missions, dispatch runner tasks, or execute
modules.

Third-Party Tool Governance now includes readiness-gated promotion packages for
new tool-library expansion. A candidate can only generate a promotion package
after review reaches `PromotedToCatalog` and readiness proves reviewed catalog,
module, governance, runtime, runner, legal, and safety prerequisites. The
package snapshots catalog metadata, the readiness report, tenant governance
policy, runtime installation state, module IDs, capability IDs, required
evidence, and safety notes. It is exposed through
`/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`,
rendered in Registry Center, included in the per-tool activity timeline, and
audited with `third_party_tool.promotion_package_generated`. Promotion packages
do not install, enable, queue, dispatch, or execute tools.

Registry Center now reads those existing promotion packages through the same
API contract. The candidate backlog includes a `Load promotion packages` action
that fetches `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`
and renders the latest backend package status, summary, counts, and safety notes
without generating a duplicate package.

Full release-gate evidence for this promotion-package addendum:
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, and
acceptance 100 files / 123 tests.

Third-Party Tool Governance now includes governed internal-runner dispatch.
`/api/v1/third-party-tools/:toolId/runner-eligibility` remains the read-only
readiness report, and `/api/v1/third-party-tools/:toolId/runner-dispatch`
creates signed runner tasks only for reviewed capabilities that are already
`Ready`. Dispatch delegates to the existing runner task builders so verified
scope, policy decisions, runner kill switch, signed envelopes, local allowlists,
evidence upload, and runner task history remain centralized. Server-side
discovery dispatch now matches the safe runner-agent recon allowlist for `nmap`,
`subfinder`, `httpx`, and `dnsx`. SharpHound, Caldera live execution, Atomic
live execution, credential validation, exploitation checks, and arbitrary
package/module dispatch remain blocked or non-executable.

Full release-gate evidence for this runner-dispatch addendum:
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, and
acceptance 100 files / 123 tests.

The runner-eligibility report still combines tenant tool governance, runtime
readiness, active runner count, verified compatible scopes, capability
implementation status, approval requirements, and server-side signed-task
dispatch allowlists. Registry Center consumes the same API through a per-tool
"Check runner" action and shows why a tool is `ControlPlaneOnly`,
`RequiresRunner`, `RequiresVerifiedScope`, `RequiresRuntime`,
`RequiresEnablement`, `RequiresApproval`, `NeedsImplementation`, `Blocked`, or
`Ready`.

Third-Party Tool Governance now includes a tenant-scoped activity timeline.
`/api/v1/third-party-tools/:toolId/activity` returns lifecycle events assembled
from real governance/audit data: third-party tool audit events, check/install
jobs, validation runs for module IDs bound to the tool, trusted upstream version
checks, reviewed update recommendations, intake candidates, and implementation
work orders. Registry Center consumes the same API through a per-tool "Load
activity" action. The timeline is read-only and cannot install, enable, queue,
execute, or expose credentials/raw scanner output.

Runner local-lab coverage now exercises every implemented safe Go runner module,
not only TCP reachability. `pnpm test:runner:lab` runs signed in-scope
reachability, DNS resolution, TLS certificate inspection, and HTTP health tasks
against local loopback fixtures, uploads normalized evidence through the same
artifact callback path, and verifies evidence manifests without touching
external targets. This aligns first-customer runner readiness evidence with the
implemented `runner.reachability_check`, `runner.dns_resolution_check`,
`runner.tls_certificate_check`, and `runner.http_health_check` module set.

Third-Party Tool Governance now includes trusted upstream version checks.
`/api/v1/third-party-tools/:toolId/upstream-version-checks` lets tenant
Owner/Admin users check reviewed tool source metadata for newer candidate
versions and persist tenant-scoped, auditable reports. Candidate reports include
catalog version, discovered version, trusted source kind, source URL, status,
reason, and required review actions. A `CandidateAvailable` result is not an
update, install, enablement, queue, or execution path; it becomes actionable only
after reviewed catalog/module/parser/license/runtime work lands and normal
reviewed-version update recommendations are generated.

Third-Party Tool Governance now includes reviewed-version update
recommendations. `/api/v1/third-party-tools/:toolId/update-recommendations`
lets tenant Owner/Admin users list, check, apply, and dismiss tenant-scoped
recommendations that compare tenant pins against reviewed catalog versions.
Applying a recommendation updates the tenant pin and can queue an install job,
but it never accepts arbitrary customer-supplied versions, images, repositories,
URLs, or executes tools directly. Registry Center consumes the same API and
renders the recommendation status, current pin, reviewed version, required
action, and apply control.

Third-Party Tool Governance now includes a systematic non-executing onboarding
intake for future tool-library expansion. `/api/v1/third-party-tools/intake/validate`
accepts proposed tool metadata and returns a deterministic certification report
covering duplicate IDs, license/legal posture, installable runtime metadata,
safety-boundary violations, required scope, runner compatibility, module scaffold
files/tests, and required remediation actions. The route writes
`third_party_tool.intake_validated` audit events and never installs, enables,
catalogs, queues, or executes arbitrary candidate tools. This sits ahead of the
existing reviewed catalog/module manifest workflow, tenant governance APIs, and
platform install worker.

Registry Center now exposes that intake workflow through the same `/api/v1`
contract. Tenant admins can submit proposed tool metadata, receive the API
certification report in-product, and review required actions without creating
unreviewed catalog entries, install jobs, missions, or executable tools.

Tool intake candidates are now persisted through
`/api/v1/third-party-tools/intake/candidates`. Candidate records are tenant-scoped
review backlog items containing the proposed manifest, validation report, status,
requester, timestamps, and `third_party_tool.intake_submitted` audit event. The
candidate backlog is visible in Registry Center and remains non-executing:
submitting a candidate does not install a tool, add a catalog entry, create a
module, queue a mission, or enable runner dispatch.

Candidate implementation readiness is now exposed through
`/api/v1/third-party-tools/intake/candidates/:candidateId/readiness` and Registry
Center candidate actions. The report compares each candidate against actual
reviewed catalog entries, module manifests, module/tool bindings, governance
availability, runtime metadata, runner compatibility, and legal/safety posture.
It returns `ReadyForGovernance`, `NeedsImplementation`, or `Blocked` with explicit
checks and required actions, and remains read-only: it does not promote, install,
enable, queue, or execute the proposed tool.

Candidate review is now exposed through
`/api/v1/third-party-tools/intake/candidates/:candidateId/review` and Registry
Center backlog actions. Tenant Owner/Admin users can mark a candidate
`NeedsChanges`, `AcceptedForImplementation`, `Rejected`, or readiness-gated
`PromotedToCatalog`. The API blocks accepted-review for non-accepted intake,
blocks promotion until actual catalog/module/governance/runtime/runner/legal
readiness is satisfied, writes sanitized audit metadata, and does not install,
enable, queue, or execute tools.

Candidate implementation work orders are now exposed through
`/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders` and
Registry Center candidate actions. Accepted implementation candidates can receive
tenant-scoped task/scaffold plans covering catalog metadata, module manifests,
parsers, policy gates, runner contracts, evidence/report wiring, license notices,
and docs. Work-order generation writes sanitized audit metadata and does not
write repository files, install packages, enable tools, queue missions, or
execute modules.

Focused validation evidence for the latest update-recommendation slice:
`pnpm --filter @periscan/shared test -- open-source` PASS,
`pnpm --filter @periscan/db run db:validate` PASS,
`pnpm --filter @periscan/db run db:generate` PASS,
`pnpm --filter @periscan/api test -- audit-action-contract` PASS,
`pnpm --filter @periscan/api test -- app.test.ts -t "open source tool"` PASS,
`pnpm --filter @periscan/api test -- openapi-coverage app.test.ts -t
"OpenAPI|open source tool"` PASS, `pnpm --filter @periscan/web test --
periscan-api-client registry-center` PASS, focused API/web/shared typecheck
PASS, and `pnpm lint` PASS. A focused API rerun after the unsupported-runtime
error handling patch also passed.

Full release-gate evidence for this addendum:
`DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm verify` PASS with lint, typecheck, workspace tests, production build,
runner tests, runner lab, OSS toolchain, license gates, Prisma
generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, and
acceptance 100 files / 123 tests.

## Current Addendum — 2026-06-24

Current validation evidence: full local `pnpm verify` passed on 2026-06-24
against the test Postgres on `127.0.0.1:5434` after the connector health
truthfulness slice. The run covered
lint, typecheck, workspace tests, production build, runner tests, runner lab,
OSS toolchain readiness, license checks, Prisma generate/validate/migrate
deploy, Playwright E2E 42/42, security 22/22, the high+ audit gate, production
dependency audit, and acceptance 100 files / 123 tests. The generated
`apps/web/next-env.d.ts` dev-route drift from `next build` was restored to the
tracked production route reference after the run.

Trust & Safety connected-system inventory now carries connected integration
readiness metadata from the API. `/api/v1/tenants/current/trust-safety` includes
connector key, implementation tier, execution readiness, readiness reason,
dedicated-client posture, and live-support status for each connected integration,
populated from persisted integration metadata with connector-catalog fallback.
The dashboard renders those API fields alongside health, permissions, data
categories, capabilities, and revocation instructions.

Registry Center capability cards now expose capability-level OSS execution
readiness from the API, not just aggregate tool readiness. The web surface reads
`/api/v1/open-source-capabilities` and displays each capability's
`executionReadiness`, runtime reason, safety levels, required scopes,
integrations, and evidence outputs, including `Ready`, `FixtureOnly`, and
`Blocked` states.

Connected integration records now preserve connector catalog readiness metadata
for API consumers. Integration creation stores `connectorKey`,
`implementationTier`, `dedicatedClient`, `live`, `executionReadiness`,
`executionReadinessReason`, and `requiredPermissions` in `permissionsSummary`,
so create/list/read responses remain self-describing for both dedicated live
connectors and standardized catalog connectors without leaking credentials.
Integration Marketplace connected cards now render those persisted fields in the
connected-state panel, with catalog metadata used only as fallback for older
records.
The shared `IntegrationSchema` now types those fields so OpenAPI and generated
clients can rely on supported implementation-tier and execution-readiness
values while still accepting connector-specific legacy permission details.

Alibaba Cloud is no longer a planned-only marketplace placeholder. The connector
catalog now exposes it as a connectable Beta cloud integration with mock fixtures
and signed read-only live ECS/RAM inventory using `DescribeInstances`,
`DescribeSecurityGroups`, and `ListRoles`. Sync returns normalized assets/signals
for account, ECS public exposure, security groups, and RAM roles while redacting
credential material and raw IP addresses from product-visible output.

Oracle Cloud Infrastructure is also no longer a planned-only marketplace
placeholder. The connector catalog now exposes it as a connectable Beta cloud
integration with mock fixtures and signed read-only live Core Services inventory
using `ListInstances`, VCN list, and security-list list endpoints. Sync returns
normalized assets/signals for compartment, compute, VCN, and public ingress
security-list context while redacting private signing key material and raw CIDR
blocks from product-visible output.

Generated integration directory semantics now match the real implementation
boundary. The 267-entry catalog contains 126 dedicated live clients and 141
standardized entries that are visible but Planned and non-connectable. The JSON
directory exposes `connectable`, `dedicatedClient`, implementation tier, and
execution readiness so replacement UIs cannot offer credential setup for a
catalog-only manifest.

Integration catalog tier metadata is now API-native. `/api/v1/integrations/catalog`
returns enriched connector entries with `implementationTier`, `dedicatedClient`,
`live`, `executionReadiness`, and `executionReadinessReason`; OpenAPI documents
that response contract; and the web marketplace renders implementation/readiness
from the API rather than inferring it from generated docs.

Runner task reject callbacks now use the same terminal-state predicate as result
and artifact callbacks. The previous local reject list omitted `Rejected`; a
closed task in that state can no longer be rewritten to `DeniedByLocalPolicy`.
Terminal reject attempts return `runner_task_invalid_state` and write a rejection
audit.

Runner task artifact uploads now enforce the same closed-lifecycle boundary as
runner result submission. A completed, failed, cancelled, expired, rejected, or
policy-denied task returns `runner_task_invalid_state` before evidence storage
and writes a runner rejection audit. The DB-backed measured-runner acceptance
flow proves a completed task cannot accept a late artifact and tenant evidence
counts remain unchanged.

Audit completeness now has a permanent contract guard. The API unit suite parses
the Prisma `AuditEventAction` enum and compares it with the shared
`AuditEventActionSchema` plus `AUDIT_ACTION_TO_DB`, so new audit action families
cannot land with only partial shared/API/database wiring. The focused API test
passes and does not require a database connection.

The asynchronous validation worker now has defense-in-depth against queued
fixture/mock targets. The fixture-target detector was moved into
`packages/shared` and is used by API mission/engagement guards and worker
processing. Production worker construction defaults to rejecting `fixture*` or
`mockMode` target hints before module execution, evidence writes, signal
persistence, graph projection, or module-executed audit success. Dev/test
fixture execution now requires an explicit `allowFixtureTargets` opt-in.

Frontier Gateway tool requests now validate and redact input payloads before
any `ModelToolRequest` persistence. The policy-enforcement layer rejects
undeclared properties such as fixture/mock controls, wrong types, out-of-range
values, missing required fields, and malformed UUID identifiers with
`invalid_tool_input`; valid request payloads retain a canonical integrity hash
while API/DB-visible `inputPayloadRedacted` values remove secret-like content.
Focused model-gateway unit tests, the DB-backed
`model-gateway-execution-flow` acceptance test, repo lint, and repo typecheck
pass.

Autonomous engagement APIs now share the production fixture-target guard used by
mission policy/start flows. `POST /api/v1/engagements` rejects plan-step targets
containing `fixture*` or `mockMode` keys outside API dev mode before engagement
persistence, inline validation execution, evidence writes, or queue interaction.
The focused production regression passes in `api-edge-regressions` and raises the
acceptance count to 123 tests.

Threat Center and Validation Snapshot advisory correlation now require
evidence-backed validation runs for tenant-wide exposure counts. Completed
validation runs with matching CVE/IoC/ATT&CK indicators but empty `evidenceIds`
do not contribute to `correlatedThreatAdvisoryCount`; evidence-backed matches
continue to correlate, including older ATT&CK technique matches outside the
bounded recent-run scan window. This keeps Snapshot and report metrics aligned
with the PRD proof loop.

## Current Addendum — 2026-06-19

Current `main` includes the public global threat-intelligence super-feed and
tenant alert correlation work merged in PR #28 and PR #29. The new completed
surface includes `/api/v1/threat-intel/catalog`, `/api/v1/threat-intel/feeds`,
`/api/v1/threat-intel/alerts`, `/api/v1/threat-intel/alerts/:id/status`,
`/api/v1/threat-feeds/ingest-due`, the `/threat-feed` web route, a global
deduped `ThreatIntelItem` catalog with provenance, source-state health, an
SSRF-guarded high-frequency poller, and measured per-tenant alert correlation
for verified exact domains, parent-domain/subdomain matches, IPv4 CIDR ranges,
and tracked advisory CVEs.

Commercial/private threat-feed vendor onboarding remains a business/customer
decision. The implemented public super-feed does not claim validation,
exploitability, detection, or fix status by itself; it raises tenant-scoped
readiness/awareness alerts that still require normal Periscan policy-gated
validation to become proof.

## Historical Addendum — 2026-06-23

The release branch now treats the connector expansion, validation-module
productization, Frontier Gateway, and web-state polish rows below as completed
in-repo rather than active implementation gaps. Grouped
public-API acceptance covers every currently connectable Integration Marketplace
category through create, health, sync, redaction/encryption, evidence/signal
persistence, Trust & Safety visibility, audit metadata, and cross-tenant
denial. Every primary web navigation route now has Playwright shell, breadcrumb,
mobile-overflow, and axe coverage; dynamic Snapshot report routes have peer
links, stable breadcrumbs, and Playwright shell/axe coverage. A filesystem-backed
web unit contract also prevents new static Next.js product pages from being
added without registration in the primary navigation route contract. The
verification totals in this addendum are superseded by the 2026-06-24 full
`pnpm verify` evidence above; the expanded route-specific browser gate passed
41 tests at the time.

Remaining work in those rows is external/customer-specific: live provider
credentials, provider-side setup, verified customer scopes, approved validation
windows, runner credentials/egress, commercial/private feed vendors, payment
processor choice, and legal approval for intentionally blocked advanced
adversarial/offensive collectors.

Status labels: `Done`, `In progress`, `Blocked`, `Not started`, `Needs credential`, `Needs verified target`, `Needs policy approval`, `Needs design decision`, `Needs migration review`.

| Area                   | Status | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation             | Done   | Monorepo, API, web, worker, runner, shared packages, Prisma, tests, CI gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Auth/Tenant/RBAC       | Done   | Session auth, tenant context, RBAC checks, audit events, MFA, API keys, invites, and API-first tenant OIDC/SAML SSO. Tenant admins can manage SSO config through `/api/v1/tenants/current/sso`; OIDC client secrets are encrypted/write-only; SAML IdP certificates are stored for verification but exposed only as `samlIdpCertificateSet`; OIDC authorization URL generation is available through `/api/v1/tenants/current/sso/authorization-url`; SAML service-provider metadata is available through `/api/v1/tenants/current/sso/metadata`; public SSO login starts through `/api/v1/auth/sso/start`; callbacks complete through GET/POST `/api/v1/auth/sso/callback`; OIDC ID tokens are verified against configured JWKS/issuer/audience/nonce/email-domain constraints; SAML responses are signature-validated with persisted request correlation; sessions are created only for active provisioned tenant members; enforced SSO blocks password login, password/legacy sessions cannot switch into enforced-SSO tenants, SSO sessions cannot switch into a different enforced-SSO tenant, and SSO config/login events emit audit events. Customer live use still requires configuring an authorized IdP, redirect URI, credentials/certificates, and claim conventions. **Inbound SCIM user lifecycle is NotConfigured / not shipped** (Trust Safety `identityProvisioning`, Admin SCIM panel, `/api/v1/scim/v2/*` 501 stubs); CyberArk SCIM is read-only inventory only. Advanced custom-role RBAC is BaselineRolesOnly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Scope verification     | Done   | Domain/Subdomain scopes generate `_periscan.<scope>` DNS TXT tokens and `POST /api/v1/scopes/:id/verify` performs live DNS TXT verification by default; dev manual verification remains guarded by `PERISCAN_DEV_MODE`. Policy checks still require verified scope before validation. Customer live use requires publishing the TXT record in the authoritative DNS zone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Policy engine          | Done   | Safety levels, denial/approval states, external validation guards, audit coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Signal fabric          | Done   | Connector interfaces and SignalEnvelope normalization exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Signal-driven triggers | Done   | `/api/v1/signal-triggers` exposes CVE, asset-change, policy-change, and missed-detection trigger rules, tenant-state evaluation, readiness gaps, non-queueing activity, tenant routing settings, and policy-gated approval that creates draft missions only. Web UI: `/signal-activity` (Signal activity) renders the non-queueing activity stream, readiness-gap summary, trigger rules, and a policy-gated approve action.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Integration registry   | Done   | Marketplace, explicit fixture-lab connector support, AWS static read-only inventory plus STS AssumeRole auth, AWS WAFv2 read-only web ACL posture sync, AWS ECR read-only repository/image metadata sync, Azure service-principal read-only subscription/resource/NSG inventory, Azure Front Door WAF read-only policy posture sync, Google Cloud access-token read-only project/resource/firewall inventory, Kubernetes service-account token read-only namespace/workload/service/deployment/network-policy inventory, GitHub PAT metadata sync, GitLab PAT metadata sync, Bitbucket Cloud app-password read-only repository metadata sync, Azure DevOps PAT read-only repository/policy metadata sync, Buildkite API-token read-only pipeline/repository-link metadata sync, CircleCI API-token pipeline/repository-link metadata sync, Jenkins API-token job/build-status metadata sync, Docker Hub read-only repository/tag metadata sync, GitHub Container Registry package/version metadata sync, Tenable Workbenches read-only asset/vulnerability summary sync, Rapid7 InsightVM read-only asset/vulnerability summary sync, Wiz CNAPP read-only cloud-resource/issue summary sync, Prisma Cloud read-only alert/resource summary sync, Lacework/FortiCNAPP read-only host vulnerability observation sync, Orca Security read-only alert/cloud-asset summary sync, Qualys VMDR read-only host/detection summary sync, runZero Export API read-only asset inventory sync, Assetnote ASM read-only asset/exposure summary sync, Axonius CAASM read-only asset/adapter-coverage summary sync, AbuseIPDB APIv2 read-only IP reputation checks, VirusTotal API v3 read-only IoC search, GreyNoise Community API read-only IP context, AlienVault OTX read-only indicator detail sync, Recorded Future read-only vulnerability/entity enrichment, Mandiant Advantage read-only API v4 enrichment, Microsoft Entra ID app-only Graph read-only identity inventory, Microsoft Defender for Office 365 Graph read-only email-security alert/incident observation, Okta API-token read-only identity inventory, Google Workspace Admin Directory read-only identity inventory, Cloudflare API-token read-only edge/WAF posture sync, OpenAI API-key read-only model inventory, Anthropic API-key read-only model inventory, Azure OpenAI API-key read-only deployment inventory, Azure AI Search API-key read-only index/service-stat inventory, Chroma API-key read-only collection inventory, AWS Bedrock read-only foundation model inventory, Jira Cloud API-token workflow delivery, GitHub Issues PAT workflow delivery, Linear API-key workflow delivery, PagerDuty Events API workflow delivery, Opsgenie API-key workflow delivery, ServiceNow Table API workflow delivery, ConnectWise Manage API-key PSA/ticket sync and workflow delivery, ConnectWise Automate REST read-only client/computer/alert sync, NinjaOne access-token RMM device/alert sync, HaloPSA OAuth client/ticket sync and workflow delivery, Autotask REST company/ticket sync and workflow delivery, Syncro API-token customer/asset/ticket sync and workflow delivery, Datto RMM OAuth read-only account device inventory sync, Kaseya VSA PAT read-only asset/agent inventory sync, N-able N-central API-token/JWT customer/device/active-issue sync, Slack incoming-webhook workflow destination, Microsoft Teams incoming-webhook workflow destination, Splunk API-token read-only SIEM observation, Elastic Security API-key read-only SIEM observation, Datadog Cloud SIEM API-key read-only SIEM observation, Microsoft Sentinel OAuth read-only SIEM observation, Sumo Logic Access ID/Access Key read-only SIEM observation, Rapid7 InsightIDR API-key read-only SIEM observation, IBM QRadar SEC-token read-only SIEM observation, Microsoft Defender XDR OAuth read-only Advanced Hunting EDR observation, SentinelOne API-token read-only EDR observation, Carbon Black API-key read-only EDR observation, CrowdStrike Falcon OAuth read-only EDR observation, and API response credential redaction exist. Remaining real connectors need customer credentials and setup. |
| Validation modules     | Done   | OSS-backed module manifests and fixture/live-readiness paths exist. Missing runtimes return unavailable. Tool Adapter Framework, runtime-security, license, and certification specs documented (docs/OPEN_SOURCE_VALIDATION_ENGINES.md). Certification harness `pnpm test:modules` + `pnpm modules:certify` gates 40 modules in `pnpm verify`; report at docs/generated/module-certification-report.md. The current OSS registry includes the PassiveReadOnly `opencti.threat_context_import` context-import module and `ocsf.evidence_mapping` schema-mapping module without validation-proof claims. MISP remains blocked by AGPL policy. Unified customer-agent internal tool execution is a documented founder decision (docs/agent-tasks/open-source-tools/17-customer-agent.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Evidence storage       | Done   | S3-compatible abstraction, metadata, hashing, redaction, tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Evidence graph         | Done   | Postgres-backed graph MVP, path correlation, Threat Center missing signals, and signal-trigger readiness evaluation exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Unified findings       | Done   | `/api/v1/findings` normalizes BAS, APT, EXV, AI, remediation, and evidence into one queue. Web UI: `/findings` (Findings) renders one prioritized cross-motion queue with severity/motion/status filters, path proof, missing-signal impact, and cross-links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Validation Snapshot    | Done   | API-first snapshot flow, reports, remediation, verification plan. Web UI: `/missions` (Missions) exposes mission/run status, outcomes, error summaries, technique IDs, evidence, and queue-job lookup so "run validation" is not an opaque button. Real customer output requires verified scope and credentials.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Reports                | Done   | HTML/PDF evidence packs from normalized data, sample route isolated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Remediation            | Done   | Remediation tasks plus direct POST /remediations/:id/create-ticket generalized to any workflow dest (Jira + PSA/RMM Syncro/Halo/Autotask/ConnectWise/Ninja etc via integrationId + sendWorkflowEvent); signal triggers; snapshot-workbench selector UI; acceptance/e2e for PSA direct. Real requires credentials.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Fix verification       | Done   | Verification events and targeted retest planning exist. Web UI: snapshot remediation cards expose a Verify-fix action that records a verification event and shows previous-vs-current evidence. Real module reruns require configured integrations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| AI app validation      | Done   | Registry, fixture harness, Promptfoo/PyRIT/Garak-style safe suites, OpenAI read-only model inventory signals, Anthropic read-only model inventory signals, Azure OpenAI read-only deployment inventory signals, Vertex AI read-only endpoint/Model Garden signals, Pinecone read-only vector-index signals, Weaviate read-only vector-collection schema signals, Azure AI Search read-only search-index/vector/semantic signals, Chroma read-only vector-collection signals, AWS Bedrock read-only foundation model inventory signals, and live-safe customer endpoint execution exist. Real endpoint validation requires customer-provided test endpoint, verified scope, and approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Control validation     | Done   | Control registry, dry-run scenarios, ATT&CK mappings, Cloudflare, AWS WAF, Azure Front Door WAF, and Microsoft Defender for Office 365 email-security posture/alert signals, Splunk API-token read-only SIEM observation, Elastic Security API-key read-only SIEM observation, Datadog Cloud SIEM API-key read-only SIEM observation, Microsoft Sentinel OAuth read-only SIEM observation, Sumo Logic Access ID/Access Key read-only SIEM observation, Rapid7 InsightIDR API-key read-only SIEM observation, IBM QRadar SEC-token read-only SIEM observation, Microsoft Defender XDR OAuth read-only Advanced Hunting EDR observation, SentinelOne API-token read-only EDR observation, Carbon Black API-key read-only EDR observation, CrowdStrike Falcon OAuth read-only EDR observation, rule coverage summaries, logged-only/no-evidence/missed/stale statuses, and tuning recommendations exist. Live BAS execution needs internal runner and approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Threat Center          | Done   | Manual advisory import API, Prisma persistence, raw/redacted evidence, missing signals, non-executing validation plans, readiness reports, audit events, API-backed web navigation/list/detail/import/export surfaces, retryable initial API error handling, HTML/PDF readiness report exports, real-DB acceptance proof, missing-signal impact on findings/executive trends, public super-feed ingestion, CISA KEV import, tenant recurring feed schedules, due-feed sweeps, threat-feed catalog/alerts, and verified-scope feed correlation exist. Public feeds create awareness/readiness signals only; commercial/private feed onboarding remains a customer/business decision and policy-gated validation is still required before any proof claim.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Internal runner        | Done   | Full spec in docs/RUNNER_SPEC.md. Go runner, signed tasks, scope enforcement, local module allowlist + safety-level allowlist + nonce-replay cache + server kill-switch handling, reachability task, heartbeat/poll/result/accept/reject/list/kill-switch/evidence APIs (RBAC + tenant + audit), customer kill switch enforced server-side (no dispatch/lease) and locally, credential rotation, continuous polling, non-root Docker packaging, scoped evidence artifact upload, local lab E2E, Docker Compose/Kubernetes/systemd deployment examples, GHCR publish workflow, and deployment artifact validation exist. Full customer network validation remains deployment-managed until issued runner credentials, firewall egress, and verified internal scope are available.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| MSSP/admin             | Done   | Parent/child tenants, tenant switching, trust/safety, branding, API-backed client portfolio dashboard, executive trends, and remediation velocity metrics exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Billing/metering       | Done   | Meter definitions, usage API, and API-first package catalog exist. Per-tenant package assignment (`Tenant.billingPackageKey`) with an active-package resolver (`GET /api/v1/billing/active-package`) and server-side capability-entitlement enforcement (`requireCapability` → 402 + `billing.entitlement_denied` audit on AI-application and control-source registration) are also implemented. Package catalog follows "Pay for what you validate", exposes no exact prices or checkout/payment intent fields, and reports payment processing as not configured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CI/security hardening  | Done   | `pnpm verify`, security tests, E2E, license checks, Prisma checks, structured API logs, JSON process metrics, and Prometheus-compatible process metrics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Frontier Gateway       | Done   | BYO OpenAI/Anthropic-compatible providers with AES-256-GCM credential encryption, policy profiles, sessions/modes, context broker with redaction, code-defined typed tool catalog, `/api/v1/model-gateway/*` routes with RBAC/tenant isolation/audit, `model-gateway-turns` queue + worker turn orchestrator, policy enforcement point, approval pause/resume, per-tenant kill switch and session timeout, read-only/plan tools, and approval-gated validation/remediation/reporting tools (no-fix-without-verification enforced) exist with route/unit/acceptance/security tests. Live model turns require a customer-supplied provider API key; the specialized cyber model path is a fail-closed extension point and is not customer-connectable until a concrete provider, tests, policy review, and customer-facing docs land together. Web UI is implemented: `/model-gateway` renders an API-backed workbench (providers, policy profiles, sessions with PlanOnly→HighAssurance modes, tool-request approve/reject, and an operator kill switch) wired into primary navigation with component tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Not Configured / Requires Integration

- GAP-P1-005 and GAP-P1-006 are closed: Trust & Safety and Integration Marketplace now expose API-backed integration sync and health-refresh controls, connected Marketplace cards show persisted health/last-sync state, the web API client wraps integration health/sync routes, and Workspace plus Threat Center hold loading states until auth resolution to prevent returning-user auth flash.
- GAP-P1-003 is closed for repo-owned runner deployment artifacts: Docker Compose, Kubernetes, systemd, GHCR publish workflow, consolidated deploy docs, and `pnpm test:runner:deploy` are in the release gate. Customer-specific network validation remains deployment-managed.
- Integration Marketplace now holds loading state until auth resolution, shows filter-empty state, hides fixture connector setup shortcuts unless explicit lab mode is enabled, runs API-backed integration sync immediately after successful fixture-lab or live connector setup, and exposes manual connected-card sync/health refresh controls backed by integration API routes.
- GAP-P1-004 is closed for release: Snapshot report preview, MSSP portfolio, Registry Center, Validation Ops, Integration Marketplace, Trust & Safety, Threat Center, Workspace, API Reference, and Demo report now use API-backed loading/error/empty/signed-out/retry states where applicable, with skip-to-content navigation, report-note refresh announcements, non-color-only readiness labels, responsive smoke checks, and route-level axe gates. Optional route-specific deep screen-reader/contrast review remains P2 polish.
- P2 app-shell navigation consistency is closed for the primary route surface: the root layout now uses a shared primary navigation component with active route state, exact Workspace matching, mobile overflow behavior, and Next `Link` route links for Workspace, Integrations, Validation Ops, Registries, Threat Center, MSSP, Trust & Safety, API Reference, and Demo report.
- P2 browser responsive/a11y smoke gating is closed for primary routes: Playwright starts API plus web, exercises the Next `/api/v1` proxy, verifies app-shell skip-link focus, primary navigation semantics, active route state, mobile nav reachability, and no document-level horizontal overflow at a 320px viewport across the primary product routes. CSS now includes a ≤480px pass for stacked grids/actions, 44px touch targets, reduced panel padding, full-width segmented controls, and long API/evidence path wrapping.
- P2 route-level browser accessibility gating is closed for primary routes: `tests/e2e/web-accessibility.spec.ts` runs axe WCAG A/AA checks in Playwright against Workspace, Integrations, Validation Ops, Registries, Threat Center, MSSP, Trust & Safety, API Reference, and Demo report routes as part of `pnpm test:e2e` and therefore `pnpm verify`.
- P2 component accessibility polish is closed for the release gate across Workspace, Threat Center, Integration Marketplace, MSSP portfolio, Registry Center, Validation Ops, API Reference, Trust & Safety, Snapshot report delivery, and Demo report: authentication/import/filter forms use explicit associated labels where touched, Workspace domain scope input is labeled, auth mode controls expose tab semantics/selected state, dynamic tenant/readiness/count/catalog/availability/connection/client-metric labels expose status roles, Workspace proof-loop dashboard/scope/connector/snapshot/design-partner/path/remediation badges expose named status semantics, Registry Center and Validation Ops route-summary/readiness/count/status badges expose named status semantics, Trust & Safety trust counts/readiness/audit states and Snapshot report delivery/preview badges expose named status semantics, API Reference method badges and Threat Center advisory-list statuses expose named status semantics, Demo sample metrics and sample-data boundaries expose named status semantics, and Threat Center import failures render as dismissible alerts. Optional route-specific contrast and deep screen-reader audit remains P2 polish, not a release blocker.
- P2 Integration Marketplace unavailable-state copy is closed for connector catalog cards: planned connectors now explain that the API rejects connection attempts until a tested implementation ships, and other unavailable connectors explain whether manifest policy, disabled fixture-lab shortcuts, or live credential onboarding prevents in-web setup.
- P2 Trust & Safety health-card wiring is closed: the previously unused `HealthStatusCard` now renders on Trust & Safety, calls the public `/api/v1/health` route through the shared browser API client, and exposes a named API health status for accessibility.
- P2 Trust & Safety API health error recovery is closed: the API health card now renders an assertive error alert on health-check failure and provides an in-card retry action that re-checks `/api/v1/health` without requiring a page reload.
- P2 Trust & Safety action-error UX is closed for the route: integration sync, integration disconnect, and audit-filter failures render an assertive dismissible error banner with a safe data reload action that preserves current data and does not repeat failed mutating requests.
- P2 Workspace connector discoverability is closed for navigation: the proof-loop connector setup step now links to the full Integration Marketplace and Trust & Safety health/permissions/sync view, while GitHub/AWS fixture shortcuts remain explicit lab/demo opt-in.
- P2 Snapshot report note-save error UX is closed for the design-partner note form: note-save failures no longer replace an already loaded evidence report with a report-load error state and instead render a scoped dismissible alert.
- P2 API edge regression coverage is closed for policy-decision binding and session recovery: create/start mismatches now emit auditable exact codes, approved policy targets persist into validation runs when start omits a target, malformed cookies return `401` instead of server errors, and logout clears invalid-cookie sessions.
- P2 shared state-panel accessibility is closed for the common loading/error/empty/info component: `StatusPanel` now binds its live-region role to the visible heading with `aria-labelledby`, and component tests assert named `status` and `alert` discovery.
- P2 customer API reference visibility is closed: `/api-reference` now renders the generated `/api/v1/api-reference` contract through the shared web API client, primary navigation includes the route, and component plus Playwright shell/axe gates cover the customer API access surface.
- P2 Validation Ops API-backed web surface is closed for the PRD main-navigation gap: `/validation-ops` reads attack paths, remediations, evidence, reports, AI apps, control sources, runners, CTEM program, and billing usage through typed `/api/v1` client methods; it exposes signed-out, loading, error/retry, empty, and populated states without sample data; primary navigation plus Playwright shell/axe gates include the route.
- P2 Validation Ops operational metrics exposure is closed: `/validation-ops` now also reads executive trends and tenant operational metrics through typed `/api/v1` client methods and renders policy denial rate, report exports, mission-start counts, connector sync counts, remediation velocity, and recommendations without log scraping or UI-only metrics.
- P2 deployment observability export is closed for repo-owned API metrics: `/api/v1/metrics` returns JSON process metrics and `/api/v1/metrics/prometheus` returns Prometheus text for uptime, memory, process info, and generated timestamp without UI coupling.
- P2 Snapshot report delivery exposure is closed: `/snapshots/:id` now uses typed report API client methods to export HTML/PDF evidence packs and create share links while preserving loaded report content on delivery errors.
- P2 Snapshot report delivery error recovery is closed: failed report export/share actions now keep the loaded report visible and expose a safe `Reload report preview` action that re-reads report HTML/design-partner note state without replaying the failed delivery mutation.
- P2 report share audit completeness is closed: `POST /api/v1/reports/:id/share-link` now writes `report.shared` audit events with safe metadata, and `pnpm verify` generates Prisma before typecheck so enum migrations are validated against a fresh client.
- P2 Trust & Safety audit filter parity is closed: the audit action selector now derives from the shared audit-action schema, exposing `report.shared` and future shared audit actions without duplicating UI-only action lists.
- P2 Registry Center API-backed web surface is closed for module/OSS/operator visibility: `/registries` reads module manifests, OSS tool readiness, productized capabilities, operator profiles, and operator recommendations through typed `/api/v1` client methods; it exposes signed-out, loading, error/retry, empty, and populated states without enabling blocked/deferred capabilities.
- P2 Registry Center and Validation Ops inline error recovery is closed: populated `/registries` and `/validation-ops` views preserve current API data after refresh failures and expose explicit reload actions that re-read the same API resources without replaying mutating operations.
- P2 Integration Marketplace action-error recovery is closed: connector setup failures after a successful API create preserve the connected integration state and expose a safe `Reload marketplace data` action that re-reads session/catalog/integration resources without replaying connector setup or sync mutations.
- P2 missing-signal impact is closed for MSSP portfolio readiness: tenant-scoped MissingSignal records now flow into child `coverage.missingProofInputs`, portfolio totals, and Attention readiness so partner views do not overstate readiness when Threat Center identifies missing proof inputs.
- Live SIEM observer sync health grounding is closed for Sumo Logic, IBM QRadar, Elastic Security, Datadog Cloud SIEM, Google SecOps, Rapid7 InsightIDR, and Microsoft Sentinel: non-mock sync now invokes read-only health probes instead of returning unverified `Unknown`, while preserving no fabricated live signals/assets outside control-validation observer evidence.
- Live workflow connector sync health grounding is closed for Jira, GitHub Issues, Linear, Opsgenie, and ServiceNow: non-mock sync now invokes read-only health probes instead of returning unverified `Unknown`, while preserving no fabricated live ticket/alert state outside explicit workflow delivery or future query configuration.
- Runner result submission terminal-state hardening is closed: the shared runner result contract accepts only `Completed` or `Failed`, the runner service fail-closes any invalid runtime status, and acceptance coverage proves non-terminal result payloads do not mutate validation runs, runner tasks, missions, evidence, signals, graph, or verification state.
- Runner completion evidence hardening is closed: `Completed` runner results now require at least one uploaded evidence artifact before validation or fix-verification state can update, and the TypeScript runner-agent uploads a normalized result artifact before successful result submission.
- Runner accepted-task halt hardening is closed: runner revoke, kill-switch, and poll-expiry cleanup now treat `Accepted` as an active unfinished state, and acceptance coverage proves accepted tasks are cancelled or denied before they can later attach evidence or submit results.
- Remediation ready-for-verification audit completeness is closed: `markRemediationReadyForVerification` writes a `remediation.ready_for_verification` audit event with prior status and ticket/path metadata, and the API-first MVP flow verifies it through `/api/v1/audit-events`.
- Remediation ticket audit separation is closed: workflow ticket creation now writes `remediation.ticket.created`/`remediation_ticket_created` rather than reusing remediation-task creation, and workflow acceptance tests assert the distinct routing audit metadata.

- Real GitHub, GitLab, Bitbucket, Azure DevOps, Buildkite, CircleCI, Jenkins, Docker Hub, GitHub Container Registry, Microsoft Entra ID, Microsoft Defender for Office 365, Google Gmail Security, Microsoft Defender XDR, SentinelOne, Carbon Black, Sophos Central, Trend Vision One, Palo Alto Cortex XDR, Fastly Next-Gen WAF, Akamai Kona/App & API Protector, Imperva Cloud WAF, Palo Alto Panorama, Fortinet FortiGate, Zscaler Internet Access, Okta, Google Workspace, AWS, AWS WAF, AWS ECR, Tenable, Rapid7 InsightVM, Wiz, Prisma Cloud, Qualys VMDR, runZero, AbuseIPDB, VirusTotal, GreyNoise, AlienVault OTX, Recorded Future, Mandiant Advantage, Azure, Azure Front Door WAF, Google Cloud, Kubernetes, Cloudflare, Snowflake, OpenAI, Anthropic, Azure OpenAI, Azure AI Search, Chroma, AWS Bedrock, Jira, GitHub Issues, Linear, PagerDuty, Opsgenie, ServiceNow, ConnectWise Manage, NinjaOne, HaloPSA, Autotask, Syncro, Datto RMM, Kaseya VSA, N-able N-central, Splunk, Elastic Security, Datadog Cloud SIEM, Microsoft Sentinel, Sumo Logic, Rapid7 InsightIDR, IBM QRadar, CrowdStrike, remaining VM/EAP, AI endpoint, Slack/Teams webhook delivery, and runner deployment need customer credentials or target setup.
- Elastic Security, Datadog Cloud SIEM, Sumo Logic, Rapid7 InsightIDR, and IBM QRadar read-only SIEM observation are implemented; Microsoft Defender XDR, SentinelOne, and Carbon Black read-only EDR observation are implemented; live tenant use requires customer keys with least-privilege read-only alert/signal/Search Job/Log Search/Ariel AQL/Advanced Hunting/threat-read/Alerts v7 permissions and authorized SIEM or EDR/XDR scope.
- Sophos Central read-only Intercept X alert observation is implemented; live tenant use requires customer Service Principal ReadOnly credentials, tenant/data-region context, and authorized EDR/XDR scope.
- Trend Vision One read-only Workbench alert observation is implemented; live tenant use requires a customer API token with Workbench view/filter/search access and authorized EDR/XDR scope.
- Palo Alto Networks Cortex XDR read-only incident observation is implemented; live tenant use requires a customer standard API key, API key ID, tenant API FQDN, and authorized EDR/XDR scope.
- Fastly Next-Gen WAF read-only site-event observation is implemented; live tenant use requires a customer API user, API access token, corp/site context, and authorized WAF scope.
- Akamai Kona/App & API Protector read-only SIEM security-event observation is implemented; live tenant use requires customer EdgeGrid credentials, SIEM Integration configuration ID, and authorized WAF scope.
- Imperva Cloud WAF read-only protected-site and WAF-rule posture observation is implemented; live tenant use requires customer API ID/API key credentials and authorized Cloud WAF scope.
- Palo Alto Panorama/PAN-OS read-only firewall log observation is implemented; live tenant use requires a customer PAN-OS API key, Panorama or firewall API base URL, authorized traffic/threat/URL/WildFire log access, and authorized firewall/WAF scope.
- Fortinet FortiGate/FortiOS read-only firewall policy monitor observation is implemented; live tenant use requires a customer FortiOS API token, FortiGate API base URL, authorized monitor/firewall policy read access, VDOM context, and authorized firewall/WAF scope.
- Zscaler Internet Access read-only firewall filtering policy observation is implemented; live tenant use requires customer OAuth client credentials, ZIA Cloud Service API base URL, token URL, firewall policy read API role/scope, and authorized cloud firewall scope.
- Proofpoint TAP SIEM API read-only email-security event observation is implemented; live tenant use requires customer Threat Insight service principal/secret credentials, authorized TAP SIEM API scope, and an approved one-hour-or-less event lookup window.
- Google Gmail Security read-only Alert Center phishing/malware alert observation is implemented; live tenant use requires customer OAuth access with Alert Center read-only permissions.
- Mimecast SIEM API read-only email-security MTA log observation is implemented; live tenant use requires customer Mimecast API application credentials, account-specific API base URL, Enhanced Logging, and `Gateway | Tracking | Read` permission.
- Abnormal Security read-only threat-log observation is implemented; live tenant use requires a customer Abnormal Security API token and Threats API read access.
- Google Security Operations OAuth read-only UDM search observation is implemented; live tenant use requires a customer-approved OAuth token with Chronicle API UDM search permissions and an authorized SecOps instance resource.
- DigitalOcean read-only account, Droplet, Firewall, and managed Kubernetes inventory sync is implemented; live tenant use requires a customer DigitalOcean API token and authorized scope.
- Heroku read-only account, app, formation, and domain metadata inventory sync is implemented; live tenant use requires a customer Heroku Platform API token and authorized scope.
- Databricks read-only workspace, cluster, job, SQL warehouse, and workspace-object metadata inventory sync is implemented; live tenant use requires a customer Databricks workspace URL, PAT, and authorized scope.
- Snowflake read-only account, warehouse, database, schema, user, MFA posture, and role-grant metadata sync is implemented; live tenant use requires a customer Snowflake account URL, OAuth token, metadata-readable role, and authorized scope.
- NinjaOne read-only organization, device, offline-state, and alert inventory sync is implemented; live tenant use requires a customer NinjaOne API base URL, access token, and authorized organization/device/alert scope.
- HaloPSA OAuth client/ticket sync and workflow delivery is implemented; live tenant use requires customer HaloPSA API/auth base URLs, OAuth client credentials, authorized client/ticket read scope, and ticket creation permission only for explicit workflow delivery.
- Autotask REST company/ticket sync and workflow delivery is implemented; live tenant use requires customer Autotask REST base URL, API username, secret, API integration code, authorized company/ticket query scope, and ticket creation permission only for explicit workflow delivery.
- Syncro API-token customer, RMM asset, offline-state, and ticket sync plus workflow delivery is implemented; live tenant use requires customer Syncro API base URL, bearer API token, authorized customer/customer-asset/ticket read scope, and ticket creation permission only for explicit workflow delivery.
- N-able N-central API-token/JWT customer, RMM device, offline-state, and active-issue sync is implemented; live tenant use requires customer N-central base URL, access token or JWT token, authorized customer/device/active-issue read scope, and optional org-unit allowlist. N-central remains read-only and does not create tickets, scheduled tasks, scripts, patch jobs, reboot actions, remote-control sessions, credential changes, users, rules, probes, or agents.
- Kaseya VSA PAT asset and agent inventory sync is implemented; live tenant use requires customer VSA Server URL, personal access token, verified/authorized scope, and a VSA user role/access boundary limited to asset and agent inventory reads. VSA remains read-only and does not run agent procedures, schedule jobs, deploy patches, retrieve files/logs, open remote-control sessions, delete agents, rename agents, or mutate VSA configuration.
- ConnectWise Automate REST client, computer, offline-state, and alert sync is implemented; live tenant use requires customer Automate REST API base URL, bearer token or read-only username/password, verified/authorized scope, and client/computer/alert read access. Automate remains read-only and does not run scripts, agent procedures, commands, patch jobs, remote-control sessions, file/log retrieval, ticket mutation, client/computer changes, or system configuration writes.
- Cisco Duo read-only user, group, phone, and protected-application inventory sync is implemented; live tenant use requires a customer Duo Admin API integration key/secret with read-resource permissions and authorized scope.
- OneLogin read-only user, role, and application inventory sync is implemented; live tenant use requires customer OneLogin OAuth API credentials with read-only user/app/role scopes and authorized scope.
- PingOne read-only user, group, and application inventory sync is implemented; live tenant use requires customer PingOne Worker application OAuth credentials with read-only user/group/application access and authorized scope.
- Auth0 read-only user, role, and client inventory sync is implemented; live tenant use requires customer Auth0 machine-to-machine credentials with read-only Management API users/roles/clients scopes and authorized scope.
- JumpCloud read-only user, user-group, and SSO application inventory sync is implemented; live tenant use requires customer JumpCloud Admin API key access with read-only users/user-groups/applications permissions and authorized scope.
- CyberArk Identity SCIM read-only user and group inventory sync is implemented; live tenant use requires customer CyberArk Identity SCIM bearer-token access with read-only users/groups permissions and authorized scope.
- Active Directory LDAP/LDAPS read-only user, group, computer, and service-account inventory sync is implemented; live tenant use requires customer internal network or runner access plus a read-only bind account scoped to an approved base DN.
- Vertex AI read-only endpoint and Model Garden inventory sync is implemented; live tenant use requires a customer Google OAuth access token with read-only Vertex AI list permissions.
- Pinecone read-only vector-index inventory sync is implemented; live tenant use requires a customer Pinecone API key with index-list access.
- Weaviate read-only schema and metadata sync is implemented; live tenant use requires a customer Weaviate API key with schema/meta read access.
- Azure AI Search read-only index and service-stat sync is implemented; live tenant use requires a customer Azure AI Search API key with index/service-stat read access.
- Chroma read-only collection list/count sync is implemented; live tenant use requires a customer Chroma API key with collection metadata read access.
- LangChain configuration-import inventory is implemented; tenant use requires customer-supplied application/component metadata and does not invoke chains, agents, tools, callbacks, retrievers, vector stores, embeddings, or models.
- LlamaIndex configuration-import inventory is implemented; tenant use requires customer-supplied application/component metadata and does not invoke query engines, retrievers, agents, tools, workflows, vector stores, embeddings, or models.
- Guardrails AI configuration-import inventory is implemented; tenant use requires customer-supplied guard/validator/policy metadata and does not invoke guards, validators, RAIL specs, server endpoints, prompts, LLMs, or models.
- Lakera Guard read-only project/policy metadata sync is implemented; tenant use requires a customer Lakera API key and configured project/policy IDs, and Periscan does not call `/guard`, `/guard/results`, submit prompts/outputs, or fetch runtime screening results.
- Lacework/FortiCNAPP read-only host vulnerability observation sync is implemented; live tenant use requires a customer API token and host vulnerability observation read access.
- Orca Security read-only alert and cloud-asset summary sync is implemented; live tenant use requires a customer API token and viewer/read-only alert and asset access.
- Assetnote ASM read-only asset and exposure summary sync is implemented; live tenant use requires a customer API token and read-only asset/exposure visibility.
- Axonius CAASM read-only asset and adapter-coverage summary sync is implemented; live tenant use requires customer API key/secret credentials and read-only asset visibility.
- Armis read-only asset, unmanaged-device, coverage-gap, exposure, and CVE summary sync is implemented; live tenant use requires customer API-token credentials and read-only asset/device visibility.
- Cortex Xpanse read-only external attack-surface asset, service, exposure, risk, and CVE summary sync is implemented; live tenant use requires customer API-token credentials and read-only asset/exposure visibility.
- Planned catalog entries must remain non-connectable until real connectors and tests exist.
- Live Atomic/Caldera/advanced adversarial execution remains blocked by policy.

## Next Foundation Slice

Continue remaining customer-readiness gaps outside the internal runner stream. Public threat-feed ingestion is implemented; do not add commercial/private feed vendors until a customer/business decision, source authorization, and tests exist.

## Operational Metrics API

Status: Done (2026-06-05).

`GET /api/v1/tenants/current/operational-metrics` now returns tenant-scoped mission start latency, policy denial, and connector sync timing summaries from persisted missions, policy decisions, integrations, and audit events. Connector syncs write `integration.synced` audit events with duration, health, asset count, and signal count. Mission starts include duration, jobs queued, and module count in the existing `mission.started` audit event. The endpoint is RBAC-gated for tenant administrators and covered by shared/API tests.

## Web Product Surfaces (API-Done vs Product-Done)

A chief-architect review found PRD-defining capabilities that were API-Done but lacked a web product surface. The table below tracks the API contract status separately from whether a real-data web UI exists. All surfaces consume real `/api/v1` data via `browserPeriscanApiClient` with honest loading/empty/error/unauthenticated states (no mocks in product surfaces).

| Capability             | API status | Product (web) status | Web surface                                                                                    |
| ---------------------- | ---------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| Unified findings       | Done       | Done (2026-06-06)    | `/findings` — prioritized cross-motion queue (`listFindings`/`getFinding`).                    |
| Signal-driven triggers | Done       | Done (2026-06-06)    | `/signal-activity` — activity stream, readiness gaps, policy-gated approve.                    |
| Missions / runs        | Done       | Done (2026-06-06)    | `/missions` — run status/outcomes/errors/evidence + queue-job lookup.                          |
| Fix verification       | Done       | Done (2026-06-06)    | Snapshot remediation cards — Verify-fix action with previous-vs-current evidence.              |
| Attack-path depth      | Done       | Done (2026-06-06)    | Snapshot + Validation Ops attack-path cards — confidence, steps, edge rationale, choke points. |

Contract assumption (fix verification): the web action builds against the existing `POST /api/v1/remediations/:id/verify` contract, which returns `{ attackPath, mission, remediation, run, verificationEvent }` (see `RemediationVerificationResult` in `apps/api/src/runtime-services.ts`). The UI treats `attackPath` as nullable and derives the previous-vs-current evidence diff from the pre-action remediation `evidenceIds` versus `verificationEvent.evidenceIds`. No backend code was changed.

## 2026-06-28 Source Audit Update — Attack-Path Validation

Status: `SRC-3.4-ATTACK-PATH` is now source-mapped through `tests/modules/prd-attack-path-coverage.test.ts`.

The audit found why earlier broad completion reviews were insufficient: attack-path, evidence-graph, risk, and remediation services existed, but no regression parsed PRD section 3.4 and checked every example path class and requirement against behavior. That allowed the missed-control example path and path-level ATT&CK report mapping to remain incomplete while higher-level graph/risk tests stayed green.

Closed in this slice:

- Added `missed-control-real-exposure` correlation in `packages/evidence/src/correlation.ts` so normalized `ControlObservation` missed/no-evidence signals plus real `Exposure` signals produce an evidence-linked heuristic attack path with `MISSED_BY` and `LEADS_TO` edges.
- Updated `packages/evidence/src/risk.ts` so structured `BLOCKED_BY`, `DETECTED_BY`, and `MISSED_BY` path edges become control-response risk factors before text fallback.
- Updated `packages/reports/src/index.ts` so attack-path report cards derive ATT&CK tags from linked control/AI evidence signals by evidence ID or related path ID.
- Added source-derived coverage for repo-secret/cloud/data, external reachability, AI/RAG, missed-control, and safe BloodHound-compatible identity pathing behavior.

Validation: focused source coverage, evidence, and report tests passed. Full `pnpm verify` remains required before another release-readiness claim.

## 2026-06-28 Source Audit Update — AI App Security Validation

Status: `SRC-3.5-AI-APP-VALIDATION` is now source-mapped through `tests/modules/prd-ai-app-validation-coverage.test.ts`.

The audit found why earlier broad completion reviews were insufficient: AI app registry, provider connectors, safe harness fixtures, and report templates existed, but no regression parsed PRD section 3.5 and checked every coverage bullet, outcome, and requirement. That allowed missing AI validation categories, missing test-account support, and harness-route drift to remain incomplete while broad AI app status rows stayed green.

Closed in this slice:

- Added first-class safe validation categories for `AgentOverPermissioning`, `SystemPromptExposure`, `CrossTenantRetrieval`, and `AISecurityReviewEvidence`.
- Added durable `testAccountNotes` support to Prisma, shared contracts, API input, serializer output, and API tests.
- Updated `/api/v1/ai-apps/:id/validate` to accept the Garak harness already supported by the module.
- Added AI validation baseline comparison evidence with `NoBaseline`, `Stable`, `Improved`, and `Regressed`.
- Added source-derived coverage for every PRD section 3.5 category, outcome, registration/scope/test-account requirement, safety/redaction requirement, AI App Validation Report rendering, and baseline/drift behavior.

Validation: focused source coverage, shared, modules, and API AI application tests passed. Full `DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan PERISCAN_TEST_DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan pnpm verify` passed with lint, typecheck, workspace tests, production build, runner tests, runner lab, OSS toolchain, license gates, PRD audit, Prisma generate/validate/migrate deploy, Playwright E2E 42/42, security 22/22, dependency audits, and acceptance 100 files / 123 tests.

## 2026-07-16 Runner Fleet Operations

Status: implemented and live-browser validated; the current full repository gate is recorded in `docs/qa/HANDOFF.md`.

The internal-runner surface is now a fleet operating system rather than a basic
registration list. Authenticated polls from both the TypeScript and Go agents
send version, queue state, observation time, active/last task references, and
certificate expiry when available. The control plane updates server-received
liveness and appends an immutable heartbeat sample without allowing an agent to
self-assert or clear server revocation/kill-switch state.

`GET /api/v1/runners/fleet` returns tenant-scoped derived health, liveness age,
heartbeat series, certificate/version posture, task counts and 24-hour outcome
metrics, alerts, and recent task history. `PUT /api/v1/runners/fleet/policy`
seals audited attention/offline, queue, certificate, minimum-version, support
owner, and escalation thresholds. The new Prisma models and migration enforce
tenant RLS, policy constraints, append-only heartbeat updates, and indexed
fleet reads.

`/runners` now renders the Periscan control-room design: live refresh status,
fleet metrics, exception-first runner rail, selected-runner liveness pulse,
task timeline, operator alerts, certificate/version/queue posture, host control
acknowledgements, emergency halt/release, typed revocation confirmation, policy
editing, pairing, firewall destinations, and transport decisions. The layout was
validated at desktop and 390px mobile widths. Product help was rewritten around
this exact workflow and validated in the live UI by selecting an exception,
sealing policy, engaging the kill switch, observing pending host
acknowledgement, and releasing it.

Demo seeding persists three explicitly labeled agents (healthy datacenter,
degraded/high-queue plant edge, and offline legacy segment), heartbeat history,
and completed/failed/queued task records. These are isolated demo records and
never claim customer activity. Operations and environment guidance lives in
`docs/RUNNER_FLEET_OPERATIONS_RUNBOOK.md`.

## 2026-07-16 ASV/CTEM Slice 1 — Product Truth Restored

Status: implemented and repository-gated.

Periscan now derives customer-visible attack-path claims from the weakest
recorded hop through `packages/shared/src/claim-language.ts`. A path may be
called measured reachable, validated, or exploitable only when the path and
every recorded edge are Measured and the recorded state supports the claim.
Mixed and heuristic paths show exact hop coverage and remain hypotheses. Risk,
API snapshots, findings, command-center metrics, Validation Ops, attack-path
detail/list surfaces, the guided demo, snapshot review, and HTML/PDF exports use
the same contract. Report rendering re-derives the language from persisted data
to protect exports from stale summaries.

Fix truth is also stricter: a Fixed or Mitigated workflow status alone no longer
enters the Verified fixes metric or a Revalidated finding state. Both require a
measured closure event whose outcome is Fixed or Mitigated. Dashboard control
copy separates observed misses from untested/no-evidence techniques.

Connector readiness is real-first. The generated 267-entry catalog contains 126
dedicated live/connectable integrations and 141 Planned/NotConnectable catalog
entries. Planned factories fail closed outside direct test mocks; the create
integration service checks catalog readiness before accepting configuration;
the marketplace exposes the block reason and a Design partner action.

Verification includes the 94-row analyst gate, package and API regressions,
report source coverage, connector catalog/docs coverage, production build,
runner tests, migration validation, Playwright route/accessibility coverage,
security tests, and real-Postgres acceptance flows.
