# Periscan analyst-gap build plan — end to end

This historical build log now follows the canonical 94-requirement ASV/CTEM
boundary in `ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`. Security leaders, hands-on
security teams, and MSSPs that need defensible proof are the release ICP.
Adjacent inference, GPU, and marketplace requirements no longer receive a
product wave or analyst-score credit.

## Product north star

**Weekly tenants completing a measured Validate → Remediate → Re-validate
proof loop.**

Every new capability must preserve six invariants:

1. Customer-authorized, verified scope only.
2. A policy decision and audit event before every execution.
3. Measured, heuristic, inferred, simulated, imported, and unconfigured states
   remain visibly distinct.
4. Denied work is never queued; kill switches stop future execution.
5. “Fixed” requires a fresh measured verification event.
6. Raw scanner output and model prose never become product truth without
   normalization, provenance, and evidence linkage.

## Priority sequence

| Wave                                            | Outcome                                                                                         | Primary audit features                   | Exit evidence                                                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **W0 — Release proof**                          | Qualify the current proof loop with the ICP and close visible release risks.                    | 12, 13, 32, 80–91                        | Production build/visual pass; dedicated MSSP demo tenant; 5 design-partner sessions; evidence-citation evaluation; first-session and proof-loop baselines.                    |
| **W1 — Measure controls and paths**             | Turn the biggest “validation” claims from inference into measurement.                           | 3–8, 14–15, 17, 66, 69, 75, 77           | Safe stimulus → control observation → verdict; measured multi-hop edge; graph-wide path breaker; signed evidence; kill/timeout/cleanup tests.                                 |
| **W2 — Dynamic safe BAS**                       | Compile approved scenarios into deterministic, evidence-gated execution graphs.                 | 1, 9–11, 16, 18–27, 29–33, 42–43, 68, 79 | Versioned scenario bundle; preview/approval; deterministic DAG; evidence-gated branch/replan; isolated-range execution; no unsupported live offensive module.                 |
| **W3 — AI application validation**              | Run real, bounded AI-security harnesses and prove AI kill-switch behavior.                      | 59–65, 81–82                             | Isolated Promptfoo/PyRIT/Garak worker; direct/indirect injection, jailbreak, RAG/tool tests; corpus/version evidence; scheduled kill-switch drill; measured compliance trace. |
| **W4 — Governed RemOps and depth integrations** | Preview, approve, execute, roll back, and revalidate a small set of high-value fixes.           | 67, 70–78                                | Action manifest; exact diff; approval; connector receipt; rollback; forced re-test; vCenter and XSIAM-specific read paths; bidirectional ticket state.                        |
| **W5 — Enterprise/MSSP breadth**                | Fill high-value coverage and procurement gaps without expanding unsafe execution.               | 2, 25–28, 53, 80–94, 96–98               | Native NHI/SSPM/SSCS/OT passive packs; isolation proof pack; trial lifecycle; localization and branding governance.                                                           |
| **W6 — Agent interoperability and trust**       | Add replayable security orchestration, runner integrity, and external agent trust where needed. | 29–44, 47–54, 57, 98, 107, 110           | Durable workflow/event ledger; checkpoint replay; MCP client; optional A2A; workload identity; signed artifacts; generic attestation; reviewed SDK boundary.                  |

W0–W6 implementation status is historical evidence, not proof that the 94 core
requirements are release-ready. The fresh core audit and canonical scorecard
govern the remaining work.

### Latest executed improvement wave — 2026-07-15

Completed:

- Repaired guided-demo focus restoration, scroll context, reduced-motion
  behavior, progress semantics, and responsive evidence metadata.
- Added dedicated passive macOS and Linux endpoint detection-analytics modules
  with verified-live-source, platform, marker, and completed-observation-window
  prerequisites for a `Missed` verdict.
- Added passive Kubernetes CIS posture normalization for kube-bench, API,
  connector, and supplied controls. Failed controls create evidence; a clean
  supplied report remains unverified.
- Added endpoint/Kubernetes readiness packs, live registry discovery, contextual
  product help, and a verified-scope mission handoff.
- Added a persistence-backed EASM ownership-confidence surface that derives
  exact verified scope, inherited-domain ownership, and unattributed candidates
  from real scopes, assets, and observations with lifecycle, source, evidence,
  and provenance context.
- Added a signed-runner macOS/Linux benign-marker emitter with no shell,
  filesystem, network, persistence, credential, or exploit capability, plus a
  guided dispatch UI and strict platform-bound receipt contract.
- Added a measured Kubernetes path fusion that requires independent
  authoritative public-exposure and live failed-CIS evidence on the same
  persisted asset; the result remains `Validated`, never `Exploitable`.
- Added lifecycle-aware first-session navigation for New and Activating tenants
  with a reversible persisted full-product escape.
- Reconciled the generated license inventory and re-ran the release gate with
  isolated Postgres on the documented port: lint/typecheck, 203 unit files /
  1,393 tests, 53-route production build, 94 browser journeys, 25 security
  tests, 129 acceptance files / 166 tests, all 125 migrations, and the 203/203
  PRD audit pass.

Next highest-value depth, in order:

1. Extend the EASM ownership surface with certificate-transparency, WHOIS, and
   cloud-account pivots plus candidate review; do not auto-promote candidates
   to owned scope.
2. Qualify the endpoint marker and observation contract against selected live
   customer EDR/SIEM sources and publish source-specific readiness evidence.
3. Build an isolated, non-destructive Kubernetes breakout-resistance range with
   explicit safety ceilings; retain the current exposure × CIS proof as
   `Validated`, not exploitability proof.
4. Add task presets and progressive disclosure to runner and agent-workflow
   operations, then run the design-partner first-session protocol.

## W0 — Release proof and UI qualification

### Product work

- Keep Command Center → Attack Path → Control → Remediation → Revalidation →
  Proof as the primary journey; move secondary configuration behind contextual
  drawers.
- Move established asset-valuation assumptions out of the top of the Attack
  Paths list so prioritized paths remain above the fold.
- Seed an isolated MSSP demo tenant with several client states and validate the
  portfolio, client switch, batch triage, branding, and tenant boundaries.
- Make the grounded analyst available from path/snapshot/remediation views and
  require evidence IDs for factual claims.
- Complete the existing design-partner protocol in
  `docs/qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`.

### Definition of done

- Production build and full browser suite pass at desktop, 320–390 px, 200%
  zoom, keyboard-only, and reduced motion.
- At least 4/5 participants distinguish measured from heuristic and reach the
  next safe action without coaching.
- Grounded-analyst evaluation has 100% evidence citation for tenant facts and
  zero policy/scope escapes.
- No sample, imported, inferred, planned, or unconfigured state looks measured.

## W1 — Control Digital Twin and measured path engine

### 1. Safe stimulus contract

Add a shared `ValidationStimulus` contract with stimulus type, ATT&CK technique,
synthetic marker, expected control sources, scope, safety ceiling, rate/byte
limits, TTL, cleanup behavior, and correlation window. Persist each stimulus,
policy decision, dispatch receipt, observation window, matched control events,
and final verdict.

Initial stimulus families:

- Owned-domain URL-filter canary.
- Harmless process/file/network markers for Windows, macOS, and Linux in an
  isolated/customer-authorized range.
- Synthetic SIEM events for Sigma/DRV correlation.
- Synthetic-token DNS callback with a strict byte ceiling.

The runner executes only allowlisted, signed modules. Atomic live execution,
SharpHound collection, destructive actions, real malware, credential theft,
and persistence remain disabled.

### 2. Control verdict engine

For each stimulus, calculate separate `Prevented`, `Detected`, `TelemetryOnly`,
`Missed`, `Inconclusive`, and `NotObservedBeforeTimeout` outcomes. A verdict must
link the stimulus receipt, control observation, timestamps, ATT&CK technique,
source health, query/correlation method, and evidence hashes.

### 3. Measured multi-hop APV

Create a lab/customer-range path where each edge is a safe measurement—for
example DNS resolution → TCP reachability → authenticated benign endpoint
behavior—without exploitation. Persist edge evidence independently and derive
the path certainty from its weakest edge.

### 4. Path Breaker Optimizer

Build graph-wide dominator/min-cut/set-cover analysis over current attack paths.
Rank fix candidates by paths broken, validated loss exposure affected, control
coverage, implementation cost, blast radius, and evidence certainty. The UI
must show “why this breaks N paths,” competing fixes, assumptions, and which
claims are measured versus modeled.

### End-to-end acceptance

- API: create/preview/approve/dispatch/observe/get stimulus and verdict.
- Persistence: tenant-scoped immutable execution/evidence references and
  idempotent observation correlation.
- Runner: signature, nonce, expiry, allowlist, local scope, timeout, cleanup,
  result signature, and kill acknowledgement.
- UI: readiness checklist, live progress, correlation timeline, missed-control
  explanation, evidence drawer, and re-run.
- Tests: success, miss, timeout, duplicate event, stale event, connector down,
  runner revoked, kill during execution, tenant isolation, policy denial, and
  cleanup failure.

## W2 — Dynamic safe BAS and orchestration

### Scenario object and library

Create a versioned `ScenarioBundle` with ATT&CK mappings, prerequisites, typed
inputs, allowed scope types, graph steps, safe modules, expected observations,
branch predicates, maximum iterations, safety/legal classification, source,
signature, SBOM, and deprecation/freshness state.

Promote threat intelligence into a scenario only through a reviewed mapping;
feed presence alone never creates executable content.

### Conversational compiler

The analyst produces a draft scenario—not executable prose. The compiler:

1. Extracts intent and selects only registered capabilities.
2. Produces a deterministic DAG and typed inputs.
3. Validates scope, policy, module readiness, rate limits, and expected evidence.
4. Shows a human-readable preview and exact branch/stop conditions.
5. Requires approval where policy demands it.
6. Records the compiled artifact hash used for execution.

### Evidence-gated adaptation

Dynamic routing selects among pre-approved branches using fresh measured state.
It cannot invent a tool, raise its safety ceiling, expand scope, or modify
policy. Failed branches consume an explicit iteration budget and stop in a
reviewable state.

### Initial safe packs

- EASM ownership expansion with confidence and human verification.
- Authenticated but non-destructive web/API posture.
- Cloud/K8s configuration and exposure paths.
- Ransomware detection canary using disposable synthetic files—no encryption.
- Synthetic identity lab with no real credential collection.
- OT/ICS passive reachability and segmentation only.

### End-to-end acceptance

- Scenario import/signing/versioning and revocation.
- Natural language → deterministic draft snapshot tests.
- Preview hash equals execution hash.
- Branch choices cite measured predicates.
- Resume, cancel, timeout, kill, partial failure, and connector/runner loss.
- No denied/unapproved/off-scope task reaches a queue.

## W3 — AI Security Validation Lab

### Architecture

Run Promptfoo, PyRIT, and Garak in isolated workers against customer-authorized
AI application endpoints. Use versioned benign/adversarial test corpora, strict
request budgets, endpoint allowlists, redaction, secrets references, no training
data retention, and safe output handling.

Support separate results for direct prompt injection, indirect document
injection, jailbreak/guardrail bypass, RAG authorization, unsafe tool invocation,
data leakage, system prompt exposure, and rate/abuse controls. For RAG tests,
use disposable synthetic documents/vector namespaces and prove cleanup.

“Model weight extraction” is answered with non-exfiltrating leakage/rate-limit
canaries and architecture review; Periscan does not attempt to steal weights.

### UI

- AI app readiness and data-handling contract.
- Suite/corpus version and test budget.
- Attack/response timeline with redacted excerpts.
- Per-control finding, confidence, evidence, and retest.
- EU AI Act/ISO 42001 trace with scope and limitation language.
- Kill-switch drill card showing request, acknowledgement, last task, and proof
  that nothing executed afterward.

### Acceptance

- Harness worker success/failure/timeout/rate-limit and kill tests.
- Prompt/output redaction and retention tests.
- Direct/indirect injection and RAG cleanup fixtures plus one authorized local
  endpoint E2E.
- Evidence trace and compliance mapping tests.

## W4 — Governed RemOps and deep integrations

### Action manifest

No connector gets a generic `executeFix`. Every action declares target type,
preconditions, permissions, exact read and write operations, expected diff,
blast radius, rollback, approval roles, idempotency key, verification scenario,
and evidence produced.

The first actions should be narrow and reversible:

- Open a Terraform/Ansible/Git repository PR with an exact generated diff.
- Add/update a ticket with evidence and synchronize closure state.
- Apply one allowlisted control tuning action in a lab/customer-authorized
  integration with preview and rollback.

Build read-only VMware vCenter inventory/topology first. Deepen Cortex XDR under
its current name; add XSIAM-specific APIs only when they are actually supported.

### State machine

`Draft → Previewed → AwaitingApproval → Approved → Executing → Applied →
Revalidating → ProvenFixed | StillExposed | RolledBack | Failed`.

Only `ProvenFixed` closes a remediation. An applied configuration change without
fresh evidence remains Awaiting Verification.

### Acceptance

- Least-privilege credential and permission probes.
- Exact-diff approval and mutation receipt.
- Duplicate/idempotent request, partial apply, stale preview, permission loss,
  rollback, connector timeout, and post-change revalidation.
- Tenant isolation and audit export.

## W5 — Enterprise and MSSP expansion

### Implemented result (2026-07-15)

- Added a tenant-scoped, secret-free non-human identity inventory with
  ownership, privilege, last-use, rotation, expiry, public exposure,
  cross-environment resource edges, deterministic risk, API/UI, audit, and
  tenant-isolation acceptance coverage.
- Expanded native SSCS evaluation to measure pipeline policy, OIDC trust,
  artifact signing, provenance, and SLSA policy independently. Missing domains
  remain visibly unmeasured.
- Added a real read-only Salesforce OAuth/REST Query connector alongside the
  existing Microsoft Entra, Google Workspace, Okta, GitHub, GitLab, and Jenkins
  dedicated connectors. Added a tenant-specific Enterprise breadth readiness
  surface that distinguishes Operational, Configurable, and Externally gated.
- Kept OT/ICS active protocol interaction excluded and exposed partner-lab
  qualification as an external dependency. Kept licensed breach-corpus matching
  distinct from the existing Intel 471 finished-intelligence connector. Kept
  human-expert validation gated on an approved partner and governed evidence
  handoff.
- Added versioned compliance governance, control owners, evidence requests,
  expiring exceptions, reviewer sign-off, and append-only history.
- Added a live tenant-isolation/data-protection proof pack that inspects RLS,
  forced RLS, tenant policies, evidence-chain integrity, region, encryption
  configuration, credential protection, and active report shares.
- Added one-time time-boxed trial entitlements, fail-closed expiry, prior-plan
  restoration, retention scheduling, cancellation, and approval-bound
  conversion without claiming a payment processor.
- Added persisted tenant locale policy for en-US, es-ES, fr-FR, de-DE, and
  ja-JP; localized primary navigation and report-template chrome while keeping
  evidence identifiers, verdict values, module outcomes, and claim semantics
  stable. The help instructions were exercised in the running product and the
  QA tenant was restored to en-US.
- Marketplace procurement remains intentionally disabled until pricing, tax,
  support, legal, and data-processing approvals exist.

### NHI sprawl graph

Normalize service accounts, OAuth clients/tokens, API keys, workload roles,
certificates, repositories, owners, privileges, last use, rotation, and resource
access. Rank orphaned, over-privileged, public, stale, and cross-environment
identities. Evidence comes from connectors and redacted secret metadata; never
store reusable plaintext credentials.

### Native breadth packs

- Microsoft 365, Google Workspace, Salesforce, and IdP SSPM posture.
- GitHub Actions/GitLab/Jenkins policy, OIDC trust, artifact signing, provenance,
  and SLSA evidence.
- OT/ICS passive exposure/segmentation packs qualified in a partner lab.
- Dark-web credential status from a licensed provider using privacy-preserving
  matching and rotation verification.

### Compliance and commercial operations

- Version and review the full framework catalog; add control owners, evidence
  requests, exceptions, sign-off, and change history.
- Add a dedicated tenant-isolation/data-protection proof pack.
- Implement time-boxed trial entitlements, expiry, abuse controls, conversion,
  and deletion/retention policy.
- Add payment/procurement integration only after pricing, tax, support, and data
  processing obligations are approved.
- Localize navigation/content/report templates; keep evidence identifiers and
  claim semantics stable across locales.

## W6 — Security-agent interoperability, diagnostics, and execution integrity

This wave does not block the ASV release.

### Implemented result (2026-07-15)

- Added immutable, tenant-isolated workflow definitions, runs, hash-chained
  events, redacted context/model/tool/policy/evidence references, cost/latency
  fields, checkpoints, integrity verification, and fork-only replay. Replay is
  denied when input, policy, evidence, expiry, or event-chain validity changes.
- The workflow composer now creates the durable DAG and recorder with each new
  model session. Operators can inspect live events, seal a checkpoint, and fork
  verified history from the product UI.
- Added default-deny outbound MCP and A2A endpoint registration, HTTPS/private
  address guards, tenant review, bounded capability discovery, schema hashes,
  explicit import allowlists, revocation, and no automatic capability import.
- Added typed/idempotent A2A Task, Message, and Artifact objects, validated
  lifecycle transitions, authenticated SSE state snapshots, SPIFFE-bound signed
  receipts, one-time nonces, audience/TTL enforcement, payload digests, and
  evidence references.
- Added configured-trust-anchor verification for generic runner/workload
  execution-integrity receipts. Measurement, workload, region, nonce,
  freshness, expiry, and allowed-policy binding are checked; absent roots return
  `NotConfigured`, and ordinary OCI signatures are never presented as
  hardware-rooted proof.
- Added a schema-first signed OCI extension contract and compatibility harness
  for signature/digest, capability, network, resource, typed-output, and
  redaction checks. Compatibility does not authorize execution; catalog,
  dependency/license, and security review remain mandatory, and arbitrary
  uploaded Python remains prohibited.

### Durable workflow and flight recorder

Persist versioned workflow definitions, step state, redacted prompt/response
references, model/provider version, context manifest, tool request/result,
policy decision, transition, evidence IDs, cost/latency metadata, and checkpoint
hashes as append-only events. Checkpoint replay must fork into a new run and
reuse only upstream results whose inputs, policy, and evidence are still valid.

### Protocols and identity

- Governed outbound MCP client with server allowlists and tool import review.
- Optional A2A Agent Cards, Tasks, Messages, Artifacts, SSE lifecycle, and
  tenant trust policy.
- SPIFFE/SPIRE-style workload identity and short-lived sender-constrained
  credentials first; DID/VC interoperability second.
- Signed message/artifact receipts, nonce/expiry, revocation, and provenance.

### Execution-integrity assurance

Verify supported workload-attestation receipts when a customer configures a
trust root. Validate workload measurement, runtime configuration, freshness,
region, and policy; attach the result to proof packs. Do not claim
hardware-rooted execution from ordinary container signatures or demo data.

### Extension SDK

Ship a schema-first SDK and signed OCI execution contract. Every custom tool
passes intake, dependency/license review, capability declarations, resource
limits, network/scope allowlists, output schema validation, redaction, and a
compatibility harness. Arbitrary uploaded Python execution remains prohibited.

## Cross-wave data and API principles

- Add public shared schemas before app-local DTOs.
- All writes are idempotent or carry explicit idempotency keys.
- Every list is tenant scoped, filtered, bounded, and paginated.
- Every external object stores source, external ID, observed/synced time,
  freshness, and redaction/sensitivity.
- Evidence references are immutable; corrections append events rather than
  rewriting history.
- UI readiness is derived from real integration, scope, runner, policy, and
  entitlement state.
- OpenAPI, audit export, and UI are three views of the same API behavior.

## Test program

Every wave must add:

- Unit tests for schemas, scoring, parsers, state machines, and graph logic.
- Connector/module contract tests for success, empty, pagination, error,
  redaction, secret leakage, and rate limiting.
- Acceptance tests for tenant isolation, role denial, policy denial, approval,
  expiry, replay, kill switch, audit, persistence, and evidence linkage.
- One real local-lab E2E for each new measured claim.
- Browser tests for success, empty, unconfigured, loading, error, forbidden,
  mobile, keyboard, zoom, and WCAG A/AA automated checks.
- Anti-fabrication tests that reject unsupported `Measured`, `Exploitable`,
  `Fixed`, compliance, and financial claims.
- Performance and failure-injection baselines before any scale/SLO claim.

## Innovation scorecard

Periscan should evaluate progress by proof quality, not route or feature count:

- Share of priority paths whose edges are measured.
- Share of control verdicts produced by an executed stimulus.
- Median time from validated exposure to owned path-breaking action.
- Share of remediations with a fresh measured re-test.
- Reopened risks found by continuous validation.
- Evidence citation rate and unsupported-claim rate for the analyst.
- Paths broken per remediation and validated exposure affected.
- Control/compliance claims with fresh direct evidence.
- MSSP clients with current proof and no overdue action.
- Denied, killed, out-of-scope, cleanup-failed, and unacknowledged executions.

## Recommended staffing shape

The first four waves can run with three durable workstreams sharing one product
and safety contract:

- **Validation engine:** modules, runner, graph, correlation, evidence, lab.
- **Product workflow:** API contracts, command center, path/control/remediation,
  proof, grounded analyst.
- **Trust and integrations:** policy, approvals, audit, connector depth,
  compliance, tenant isolation, release/load gates.

Do not create separate mini-products for every analyst row. Expose each
capability as a proof-loop pack with the same readiness, execution, evidence,
remediation, revalidation, and reporting model.
