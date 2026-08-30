# Analyst public-spec execution wave

**Executed:** 2026-07-15
**Scope:** separate public-spec implementation from external qualification,
starting with A2A Agent Cards and interoperability

## Corrected execution rule

An external dependency limits the qualification score; it does not stop
implementation of public contracts, fail-closed adapters, conformance tooling,
operator UX, persistence, or test harnesses. The scorecard currently contains
31 sub-4.0 rows with no external dependency and 29 externally dependent rows.
The latter remain buildable up to the point where a real customer, partner,
hardware environment, commercial approval, or production exercise is required.

## Asynchronous operations recovery implementation

Row 107 now reaches the strict 4.0 software floor. Periscan adds reviewed
tenant operating targets, a live control room over persisted jobs and signed
runner tasks, tenant-scoped stale-work reconciliation, one terminal decision
per failure, and a hash-linked recovery ledger. Running jobs terminalize only
after the reviewed timeout; runner tasks terminalize only after signed expiry.
Affected active runs fail with an explicit operational reason.

Recovery has no replay shortcut. `PrepareRecovery` requires every source scope
to remain verified and creates a new Draft mission with no copied policy
decision, run, job, or runner task. `AcceptTerminal` records that no recovery is
needed. Both paths are admin-only, tenant-isolated, audited, and immutable
through product behavior plus a database update trigger.

The contextual guide was exercised in the seeded demo through reviewed target
configuration, no-op reconciliation, failed-job recovery, ledger verification,
and the linked mission detail. The resulting mission showed Draft, an unlinked
policy gate, and zero runs. The focused UI had no document overflow at 1280px
or 390px; the broad legacy inventory is collapsed but still available.

Row 107 moves from 3.50 to 4.00: product 4, function 4, UI/UX 4, operations 4.
The overall evidence score becomes **1,703/2,200 (77.4%)**, with 58 rows at the
strict floor and 93 Strong/Leading. Production multi-node failure, soak,
externally reviewed SLO/support evidence, and 10,000+ concurrency remain
unproven and unclaimed.

## Governed business-impact implementation

Row 12 is now complete to the strict 4.0 software floor. Periscan adds four
numeric-free scenario prompt sets, required source owner/reference/date/note,
non-mutating FAIR-inspired PERT/ALE preview, immutable numbered submissions,
administrator approval or rejection, one active approved version, supersession,
SHA-256 integrity verification, tenant audit events, database content
immutability, and RLS-backed isolation. The legacy direct-update endpoint now
returns `410`, so the product has no API path that silently changes active
financial assumptions.

The Attack Paths UI replaces the form-heavy first-view editor with a restrained
Business impact desk. The live demo guide produced a $307,500 preview, proved
that pending review did not activate it, then showed approval, source count,
review reference, digest, and verified ledger state. The approved experience
remained usable without horizontal overflow at 1280px and 390px.

Row 12 moves from 3.50 to 4.00: product 4, function 4, UI/UX 4, and operations 4. The overall evidence score becomes **1,701/2,200 (77.3%)**, with 57 rows at
the strict 4.0 floor and 93 Strong/Leading rows. No credit is added for actuarial
truth, full FAIR assessment, customer calibration, independent usability, or
production support/SLO evidence. Those remain the honest 5.0 qualification gap.

## A2A implementation

Periscan now evaluates Agent Cards against the public A2A 1.0 structure and
persists the result on the reviewed tenant endpoint. The evaluator records:

- required human-readable identity;
- ordered interface URL, binding, and protocol-version declarations;
- production HTTPS posture, with loopback HTTP accepted only in development;
- default input and output media types;
- skill IDs, names, descriptions, and tags;
- an explicit capabilities object;
- security requirements referencing declared schemes;
- card digest, agent version, preferred interface, and signature presence.

The report deliberately records core operations as `NotRun`. Discovery does
not invoke `SendMessage`, `GetTask`, `CancelTask`, streaming, or partner agent
work. The trust console shows structural failures and warnings before a tenant
imports a capability, and states that a separately approved scope-bound
interoperability run is still required.

## Verification

- API and web TypeScript checks passed.
- The new evaluator unit suite passed 2/2 tests, including incomplete fields
  and unsafe public HTTP transport.
- Migration `20260715200000_add_a2a_card_conformance` deployed successfully.
- The database-backed interoperability acceptance suite passed 2/2 tests. It
  proves review-before-discovery, persisted conformance, public binding/version
  selection, explicit non-import, and `NotRun` operation state.

## Score effect

Rows 35–37 improve from 3.50 to 3.75 because the operator experience now makes
public conformance, failure reasons, preferred protocol, and unqualified live
behavior visible and reviewable. Product/function remain 4, UI/UX becomes 4,
and operations remains 3 until an external agent implementation passes the
approved live conformance run. The overall evidence-based score moves from
1,644/2,200 (74.7) to **1,647/2,200 (74.9)**. This does not move any row across
the strict 4.0 floor and does not fabricate partner qualification.

## AWS Marketplace SaaS implementation

The application side of row 95 is now implemented from AWS's public SaaS
contracts:

- the public registration callback consumes `x-amzn-marketplace-token`, calls
  `ResolveCustomer`, validates the configured product code, and preserves the
  returned customer AWS account and License ARN for concurrent agreements;
- a one-hour, one-use hashed claim token transfers the purchase into the
  authenticated tenant without exposing AWS credentials;
- paginated `GetEntitlements` checks store typed dimensions, values, expiry,
  and License ARN; cancelled, empty, expired, false, and zero entitlements fail
  closed and remove Marketplace-derived plan access;
- `BatchMeterUsage` receives the previous completed UTC hour from configured
  Periscan meter-to-AWS dimension mappings; database uniqueness prevents a
  second submission for terminal subscription/dimension/hour results;
- AWS success, not-subscribed, duplicate, unprocessed, and failure states are
  persisted with audit context and surfaced through Billing;
- the UI and contextual help distinguish `IntegrationReady`, `Limited`, and
  independently proven `Public` availability.

The new migration deployed successfully. API and web typechecks, Billing
component test, and database-backed Marketplace acceptance test passed. The
acceptance path proves registration redirect, tenant claim, entitlement-to-plan
mapping, masked identifiers, metering, duplicate-hour suppression, and
fail-closed cancellation using the real production service contract with a
controlled provider double.

Row 95 moves from 0.75 to 3.00: product 3, function 3, UI/UX 4, and operations 2. No points are awarded for seller approval, a limited-listing live test,
CloudTrail/invoice reconciliation, subscription-event qualification, or public
availability. The overall evidence score becomes **1,656/2,200 (75.3)**; the
strict-floor and Strong/Leading row counts remain 50 and 89.

## NVIDIA confidential-GPU attestation implementation

Public NVIDIA documentation showed that the previous generic RS256
`measurement`/`noLog` approximation did not represent NVIDIA's product. It has
been replaced with a detached EAT 2.0/3.0 profile that:

- issues tenant/workload/provider-bound five-minute challenges, stores only the
  nonce hash, and atomically consumes each challenge once;
- parses JSON-encoded detached EAT bundles and verifies an ES384 NVAT
  relying-party signature on the overall result and every GPU token;
- checks issuer, nonce, issue/expiry time, overall result, `submods` device
  binding, report signature/nonce, architecture, driver and vBIOS RIM
  signatures, runtime measurement comparison, secure boot, debug state, and
  optional H100/model allowlists;
- persists normalized device count, models, claims version, boot/debug state,
  outcome and findings while retaining only a SHA-256 hash of the raw bundle;
- provides an operator challenge/copy/paste/verify flow and a production
  runbook, without claiming hardware possession or NRAS qualification.

The public-spec verifier unit suite passed 4/4, the operator help-flow test
passed, and the database-backed acceptance test passed 2/2 while proving EAT
verification, normalized persistence, and replay rejection. Migrations
`20260715220000_add_attestation_claim_details` and
`20260715230000_add_attestation_challenges` deployed successfully.

Rows 44 and 45 move to 3.00 (product 3, function 3, UI/UX 4, operations 2).
No points are awarded for real H100 execution, supported driver/NVAT operation,
NRAS enrollment, or production key ceremony. The score becomes
**1,672/2,200 (76.0%)**; strict-floor and Strong/Leading counts remain 50 and 89.

## OSS proof-engine implementation

Public project contracts also supported an immediate, safe uplift in web and
software-supply-chain validation:

- OWASP ZAP 2.17.0 is now a Current, live-capable passive baseline module. The
  Docker profile uses a non-root user, read-only root filesystem, dropped
  capabilities, bounded CPU/memory/time, passive rules, and verified-scope
  networking. A short-lived named output volume replaces host bind mounts.
- Syft 1.46.0 now generates CycloneDX inventories from an authorized repository
  archive staged through the Docker API. Network access is disabled, the
  evidence volume is read-only, common generated/vendor directories are
  excluded, and Periscan retains normalized components and the SBOM digest
  instead of raw scanner output.
- Cosign 3.0.6 now verifies an artifact, legacy JSON bundle, and explicitly
  trusted customer public key in an offline `private-infrastructure` profile.
  The module hashes all three inputs, returns a verified result for the signed
  artifact, and emits a repository rejection signal for a mismatch. It makes no
  transparency-log or hardware-attestation claim.

The runtime staging path was tested against a Colima Docker daemon that could
not see the repository's external-volume host paths. Inputs now travel through
`docker cp` into disposable named volumes, removing that portability defect
without broadening filesystem or network access.

`pnpm tools:qualify:proof` passed against the production adapters. Syft found
720 components in the real repository, Cosign accepted the signed artifact and
rejected a different artifact with one signal, and ZAP returned two normalized
passive alerts from an ephemeral local web application. Module typecheck and
the 171-test module suite also passed. The full database-backed `pnpm verify`
gate then passed, including 94 Playwright journeys, 25 security-boundary tests,
169 acceptance tests, the 53-route production build, all 130 migrations, license
inventory, dependency audit, and enum drift. The operator flow and failure
boundaries are recorded in `docs/OSS_PROOF_ENGINE_RUNBOOK.md`.

Row 18 moves from 3.00 to 3.50 (product 4, function 4, UI/UX 3, operations 3).
Row 25 moves from 4.25 to 4.50 (product 5, function 5, UI/UX 4, operations 4).
No points are added to hardware Execution Integrity: an artifact signature is
software provenance, not a TEE quote. The evidence score becomes
**1,675/2,200 (76.1%)**; the strict-floor count remains 50 and the
Strong/Leading count becomes 90.

## Agent trust OSS implementation

The previously planned public OSS adapters are now current product coverage:

- The Apache-2.0 official A2A TCK is pinned to `1.0.0.alpha2`. Periscan copies
  the reviewed checkout into a short-lived workspace, exposes only an
  allowlisted subprocess environment, sends traffic only after endpoint review,
  successful structural discovery, verified hostname scope, policy approval,
  an authorization reason, and explicit traffic acknowledgement, and persists
  normalized requirement/transport results plus the source-report SHA-256.
- Compatibility is stricter than the upstream aggregate: every reported MUST
  requirement must be `PASS`; `NOT TESTED` remains an explicit gap even when an
  upstream percentage excludes it.
- Veraison implements its published challenge-response session: 201 session
  creation with a 32-byte nonce, same-origin `Location`, exact accepted media
  type, bounded evidence, 200/202 response handling, bounded polling, nonce and
  expiry verification, optional scalar dotted-claim expectations, result and
  evidence hashes, normalized findings, remote cleanup, and safe same-evidence
  retry while processing. Raw evidence is not persisted.

`pnpm tools:qualify:agent-trust` invoked the actual pinned TCK against a
controlled, deliberately incomplete A2A service and produced 129 normalized
requirements, 99 failed or untested MUSTs, 57.7% upstream MUST compatibility,
and `compatible: false`. The database-backed acceptance flow separately proves
policy/scope gating, a normalized positive TCK proof through the executor
contract, and Veraison 201 → 202 → GET complete → DELETE behavior. Component,
contract, type, and live-browser checks cover the operator prerequisites and
help text.

The final repository-wide `pnpm verify` gate passed with the 53-route
production build, 94 Playwright journeys, 25 security-boundary tests, 131
acceptance files / 170 tests, and all 131 migrations, in addition to workspace,
license, dependency, enum-drift, PRD, and analyst-score gates.

Rows 35–37 move from 3.75 to 4.00 by raising operations from 3 to 4. Row 44
moves from 3.00 to 3.50, and row 47 moves from 2.75 to 3.50. No points are
awarded for a partner endpoint that has not passed the governed TCK or for TEE
hardware that did not produce real evidence. The evidence score becomes
**1,683/2,200 (76.5%)**; 53 rows meet the strict 4.0 floor and 90 remain
Strong/Leading.

## W3C AgentDID and VC relying-party implementation

Analyst row 51 is now backed by product behavior rather than an AgentDID
roadmap label. Periscan implements the stable W3C DID Core 1.0, Verifiable
Credentials Data Model 2.0, and VC JOSE/COSE relying-party boundary for
`did:web`:

- tenant admin approval binds a verified scope and policy decision to one
  approved, structurally conformant A2A endpoint, its reviewed capabilities,
  exact issuer and subject DIDs, allowed credential types, audience, and
  endpoint origin;
- DID documents are resolved through the outbound SSRF boundary and reduced to
  identity, URL, resolution time, and SHA-256. Raw documents are not retained;
- compact `vc+jwt` verifies the issuer's `assertionMethod` public JWK with an
  ES256/ES384/EdDSA allowlist, plus VC 2.0 context/type, issuer, subject,
  audience, endpoint origin, SPIFFE workload, matching JWT/VC validity, and a
  non-empty reviewed capability subset;
- unsupported credential-status methods, private JWK fields, excess
  capability, stale validity, DID mismatch, or bad signature fail closed and
  remain visible as normalized findings;
- endpoint policy can require the verified credential on every signed receipt;
  document rotation and tenant revocation invalidate active credentials.

The focused database-backed lab passed a real ES256 credential, bound it to a
signed A2A receipt, rejected a validly signed excess-capability credential,
rotated the issuer key, and observed automatic credential revocation. Unit,
contract, component, help, type, schema, and migration checks cover the same
boundary. Partner-operated DNS/TLS, issuer policy, wallet lifecycle, and agent
endpoint interoperability still require external evidence.

The final repository-wide `pnpm verify` gate passed with 75 web files / 252
tests, 25 API files / 330 tests, 22 shared files / 132 tests, 7 module files /
175 tests, the 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 132 acceptance files / 171 tests, and all 132
migrations, in addition to license, dependency, enum-drift, PRD, and analyst
score gates.

Row 51 moves from 2.75 to 3.75 (product 4, function 4, UI/UX 4, operations 3).
The evidence score becomes **1,687/2,200 (76.7%)**; the strict-floor count
remains 53 and the Strong/Leading count becomes 91.

## Signed OCI extension developer program

Analyst row 110 now has an end-to-end in-product developer and review lifecycle
instead of only a compatibility contract:

- tenant projects record package identity, bounded purpose, repository,
  support ownership, and SPDX-format license metadata;
- the SDK endpoint emits five deterministic, individually SHA-256-hashed files
  for a typed adapter, anti-fabrication test, canonical local signer, explicit
  execution contract, and build/submission guide;
- immutable semantic versions retain the normalized signed contract,
  compatibility report, image/contract/public-key digests, capabilities,
  allowlist, and support provenance;
- human certification/rejection is separate from compatibility, failed
  releases cannot bypass review, one tenant catalog version activates
  atomically, and upgrade, rollback, and revocation preserve the ledger;
- the release-rail UI and inline guide expose certainty, prerequisites,
  ownership, active digest, denial, and recovery. Project creation and scaffold
  generation were exercised from the rendered guide on desktop and at 390px,
  with no horizontal overflow or console errors.

The database enforces `executionAuthorized = false`, and every response repeats
that boundary. Catalog activation therefore never creates runner authority.
Arbitrary Python/source upload remains prohibited; executable third-party code
still requires a separately reviewed module binding and the normal scope,
policy, license/security, runner, and evidence-path controls.

The database-backed acceptance proof uses a real RSA signature, activates two
versions, retains a deliberately incompatible digest release, rejects its
certification bypass, rolls back, revokes the active release, verifies the
complete audit trail and tenant isolation, and proves that no persisted release
has runtime authority.

The final repository-wide `pnpm verify` gate passed with 76 web files / 253
tests, 25 API files / 331 tests, 23 shared files / 134 tests, 7 module files /
176 tests, the 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 133 acceptance files / 172 tests, and all 134
migrations, in addition to license, dependency, enum-drift, PRD, and analyst
score gates.

Row 110 moves from 3.50 to 4.00 (product 4, function 4, UI/UX 4, operations 4).
The evidence score becomes **1,689/2,200 (76.8%)**; 54 rows now meet the strict
4.0 floor and 91 remain Strong/Leading.

## Continuous subscription operations

Analyst row 93 now has an application-owned continuous direct-agreement
lifecycle rather than a package flag and a list of externally gated commercial
functions:

- a tenant can create one reviewed term only after an active trial is resolved;
- deterministic renewal checkpoints and a current next action make the
  decision window operational;
- approval creates a future immutable period without changing the current
  package early, while decline preserves entitlement through the current term;
- a 1–90 day referenced grace exception preserves entitlement and blocks
  conflicting renewal/cancellation changes until resolution;
- typed end-of-term cancellation deletes a future period but never removes
  current access early, and it can be revoked before reconciliation;
- due reconciliation closes the current period with real usage, either applies
  the approved next package or ends access fail closed; and
- every transition is tenant-audited and appended to a hash-linked lifecycle
  ledger whose integrity is verified on read.

The database-backed acceptance path proves the positive lifecycle, premature
reconciliation denial, duplicate prevention, grace preservation, cancellation
recovery, package transition, final entitlement removal, audit/event
completeness, tamper detection, and tenant isolation. The Billing guide was
also followed successfully in the live page on desktop and at 390px with no
horizontal overflow or console errors.

Payment charging, invoices, tax, settlement, procurement, and dunning remain
explicitly `NotConfigured`; this implementation does not invent provider
events. Row 93 moves from 2.75 to 4.00 (product 4, function 4, UI/UX 4,
operations 4). The evidence score becomes **1,694/2,200 (77.0%)**; 55 rows meet
the strict 4.0 floor and 92 are Strong/Leading.

The final repository-wide `pnpm verify` gate passed with 77 web files / 254
tests, 25 API files / 332 tests, 24 shared files / 137 tests, 7 module files /
176 tests, the 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 134 acceptance files / 173 tests, and all 136
migrations, in addition to license, dependency, enum-drift, PRD, and analyst
score gates.

## Governed localization release operations

Analyst row 96 now has a reviewed product operation rather than a persisted
locale preference alone:

- exact en-US, es-ES, fr-FR, de-DE, and ja-JP product-shell and Snapshot-report
  catalogs are centralized behind one versioned contract;
- each locale exposes a SHA-256 digest, per-surface key counts, translated
  counts, fallback counts, and activation readiness;
- administrators preview locale and IANA-timezone date, number, and
  relative-time formatting without changing tenant state;
- activation requires support ownership, a review reference, and a reason,
  updates locale/timezone atomically, appends an immutable release, and emits a
  dedicated audit event with prior policy and semantic-invariant metadata;
- the UI refreshes navigation and HTML language in place, localizes governed
  report headings and locale-aware financial formatting, and exposes a
  permanent activation ledger; and
- rollback is a new reviewed activation, preserving the previous release and
  configured data region.

The database-backed acceptance path proves honest default state, all five
complete catalogs, invalid-timezone and missing-review denial, non-mutating
Japanese preview, Japanese activation, English/UTC recovery, audit metadata,
stable evidence/claim semantics, and tenant isolation. The Admin guide was
also followed literally in the rendered product through localized Snapshot
generation and recovery. Desktop and 390px had no horizontal overflow and no
browser-console errors.

Page bodies, inline help, customer-authored evidence, regulatory/tax/legal and
procurement content, data residency, and cross-border authorization remain
outside this presentation release. Row 96 moves from 2.75 to 4.00 (product 4,
function 4, UI/UX 4, operations 4). The evidence score becomes
**1,699/2,200 (77.2%)**; 56 rows meet the strict 4.0 floor and 93 are
Strong/Leading. Reaching 5.0 still requires legally reviewed long-tail regional
content, live regional support, and customer qualification.

The final repository-wide `pnpm verify` gate passed with 78 web files / 255
tests, 25 API files / 332 tests, 25 shared files / 141 tests, 7 module files /
176 tests, the 53-route production build, 94 Playwright journeys, 25
security-boundary tests, 134 acceptance files / 173 tests, and all 138
migrations, in addition to license, dependency, enum-drift, PRD, and analyst
score gates.
