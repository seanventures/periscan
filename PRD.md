# Periscan PRD

Periscan is a self-service Automated Security Validation platform.

Periscan validates exposure, controls, attack paths, AI applications, and fixes,
then turns the results into proof customers can use.

Core user outcome:

Find the path. Validate the risk. Prove it's fixed.

## Product modules

- Validation Snapshot
- Exposure Validation
- Control Validation
- Attack-Path Validation
- AI App Validation
- Fix Verification
- Evidence Packs
- Periscan Operators
- Signal Fabric
- Internal Runner
- Third-Party Tool Governance Center

## Core outcomes

- validate what is real
- prove controls work
- find attack paths
- verify fixes
- produce proof
- govern third-party validation tools through API-first, policy-gated install,
  enablement, runtime-readiness, runner-execution, and audit workflows

## Validation states

- Discovered
- Reachable
- Validated
- Exploitable
- Detected
- Blocked
- Logged
- Alerted
- Routed
- Missed
- NoEvidence
- Mitigated
- Inconclusive
- NeedsApproval
- NeedsInternalRunner
- Fixed
- PartiallyFixed
- StillExposed
- Reopened
- ClosedWithoutEvidence
- NotConfigured
- RequiresIntegration

## MVP direction

- Start with a fixture-first Validation Snapshot flow.
- Prioritize normalized evidence over raw findings.
- Require verified scope before validation.
- Make every conclusion evidence-backed and auditable.
- Make every product capability API-addressable so the UI can be replaced and customers can automate against the platform directly.
- Govern Periscan-managed third-party validation tools through API-visible policy, readiness, installation, enablement, and audit controls.
- Maintain a source-first requirement ledger before any full completion claim; a broad traceability addendum or passing test run is not proof that every PRD verb, durable state, API, policy, evidence, audit, UI, and test requirement has been implemented.

## Platform delta priorities

- Unified validated findings layer: BAS, exposure validation, attack-path validation, AI validation, and fix-verification outputs share one evidence-backed findings model with source, evidence, impact, remediation, exploitability, lifecycle status, priority rationale, and cross-links.
- BAS first-run value: guided setup and safe default scenarios should produce a short control pass/fail summary with tuning recommendations.
- Attack-path evidence: every validated path should show entry point, intermediate steps, control interactions, objective state, blast radius, and choke points.
- Explainable exposure prioritization: prioritized exposures must explain control, exploitability, path, and asset/business context.
- Action and revalidation loop: validated findings can be routed, fixed, and revalidated without losing evidence provenance.
- Detection-rule validation: control validation should expose rules that logged but did not alert, missing detections, stale rules, and tuning recommendations.
- Signal-driven triggers: CVE, asset-change, policy-change, and missed-detection triggers should launch validation and appear in an activity stream.
- Executive evidence reporting: leadership-ready reports should summarize control effectiveness, validated exposure, path risk, remediation velocity, and change over time without raw module dumps.
- Better-together UX: BAS findings, exposures, paths, controls, remediation, and evidence should cross-link as one platform workflow rather than isolated dashboards.
- Third-party tool governance: tenant admins can see approved validation tools, runtime readiness, license/legal disposition, pinned versions, install/check jobs, enablement state, and audit history; disabled or legal-review tools cannot run.
- Third-party tool activity: `/api/v1/third-party-tools/:toolId/activity` returns a tenant-scoped lifecycle timeline from real governance records, runtime jobs, validation runs, upstream checks, update recommendations, candidates, work orders, and audit events.
- Systematic tool expansion: new OSS/security tools enter through a reviewed catalog manifest, module manifest, fixture parser, safety classification, runner/control-plane execution contract, license decision, evidence mapping, and tests before becoming executable.
- Third-party tool certification: promoted candidate packages expose a read-only certification report proving catalog, module, evidence, governance, runtime, runner, policy, and safety gates from current tenant state before use.
- Third-party tool certification history: tenant admins can persist current certification snapshots through `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications`; snapshots are auditable, activity-visible governance artifacts and never enable, install, queue, dispatch, or execute tools.
- Tool onboarding intake: proposed tools are first evaluated through `/api/v1/third-party-tools/intake/validate`, which returns a deterministic certification report, required remediation actions, legal/safety posture, installable runtimes, runner compatibility, and module-scaffold requirements. Intake never installs or executes arbitrary tools.
- Registry Center tool intake UX: tenant administrators can submit proposed tool metadata from the Registry Center UI, which consumes the intake API and renders certification decisions without adding unreviewed tools to the catalog.
- Tool intake candidate backlog: accepted/rejected tool proposals are persisted through `/api/v1/third-party-tools/intake/candidates` as tenant-scoped review records with the original manifest, validation report, status, requester, and audit event. Candidate records do not make tools executable; reviewed catalog/module/runner work is still required before use.
- Tool candidate batch imports: tenant administrators can submit batches of proposed tool manifests through `/api/v1/third-party-tools/intake/candidates/import`. Each item receives an explicit submitted/failed/rejected/needs-changes result, duplicate or malformed entries are isolated, successful items enter the same candidate backlog, and the workflow writes audit events without installing, enabling, queueing, dispatching, or executing tools.
- Tool candidate readiness summary: `/api/v1/third-party-tools/intake/candidates/readiness-summary` lets admins and API customers triage the full tenant candidate backlog at once, returning per-candidate readiness reports, counts, and top required actions without creating catalog entries, installs, enablement, missions, runner tasks, or module executions.
- Tool candidate readiness: `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness` compares a proposed tool against actual reviewed catalog entries, module manifests, governance availability, runtime metadata, runner posture, and legal/safety gates. It returns missing implementation work and never promotes, installs, enables, queues, or executes the proposed tool.
- Tool candidate review: `/api/v1/third-party-tools/intake/candidates/:candidateId/review` lets tenant Owner/Admin users mark submitted candidates as `NeedsChanges`, `AcceptedForImplementation`, `Rejected`, or `PromotedToCatalog` only after readiness proves promotion is safe. Review actions update auditable metadata and do not install, enable, queue, or execute tools.
- Tool implementation work orders: `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders` turns accepted candidate reviews into tenant-scoped, auditable implementation task lists and scaffold maps. Work orders guide catalog/module/parser/policy/runner/evidence/license work without writing repo files, installing packages, enabling tools, queueing missions, or executing tools.

## Competitive positioning and capability answer

**Category home is AEV/CTEM proof — not full multi-vector BAS.** Periscan is a
measured exposure-validation and fix-verification layer that co-exists with CNAPP
(Wiz), RBVM (Tenable), optional BAS libraries, and enterprise telemetry. It does
**not** sell “replace CNAPP,” “replace RBVM,” “full BAS library parity,” or
“automated pentest.” Durable GTM language lives in
[docs/competitive/POSITIONING.md](docs/competitive/POSITIONING.md) and
[docs/competitive/BATTLECARDS.md](docs/competitive/BATTLECARDS.md).

Capability research may study ASV/CTEM and adjacent vendors (Picus, Pentera,
XM Cyber, Cymulate, RidgeBot, Tenable, Horizon3, SafeBreach, Wiz). That research
is **not** a mandate to enter head-to-head full-BAS bake-offs. Honest,
code-verified coverage of headline capabilities is tracked in
[docs/COMPETITIVE_COVERAGE_MATRIX.md](docs/COMPETITIVE_COVERAGE_MATRIX.md); the
differentiated answer to each capability is in
[docs/COMPETITIVE_FEATURE_STRATEGY.md](docs/COMPETITIVE_FEATURE_STRATEGY.md).

- The differentiator is **proof, not claims**: every verdict is measured-or-heuristic-labeled, "Fixed" flips only on a re-run measurement, runner results are Ed25519-signed and server-verified, and evidence is tamper-evident. Where the platform simulates, it must say "simulated" — never emit a fabricated number.
- **Co-exist recipes:** Wiz → Attack Path → Remediation (CNAPP inventory in; path/fix proof out). Tenable finds → Periscan validates & verifies fix (RBVM remains system of record).
- **Pentera/Horizon3 gap is deliberate:** governed continuous validation with a hard safety floor that never lifts — not automated pentest ([SECURITY_BOUNDARIES.md](SECURITY_BOUNDARIES.md)).
- **Analyst placement:** Visionaries / Contender on vision is correct until Ability to Execute moves via references, measured multi-hop default demos, and closed control-validation loops — not more vision docs ([docs/competitive/POSITIONING.md](docs/competitive/POSITIONING.md) §5).
- **No fabricated capability numbers may reach a user.** The `Math.random`-seeded "swarm"/kill-chain metrics (fabricated template/swarm counts, placeholder technique ids) must be removed or hard-quarantined as an explicit dev-only "simulation preview"; they are a completion blocker, not a feature.
- Genuinely measured-and-real today (lead with these): exposure/risk scoring + trends (EXV), measured HTTP/TLS/DNS validation loop, measured fix-verification + automated revalidation that can honestly demote a stale "Fixed", MSSP multi-tenancy + isolation, ~106 real integration clients, and the explicit exploitability/measured-vs-heuristic prioritization model.
- Close the loops competitors fake: Security Control Validation must execute a governed safe stimulus and measure detect/block (not only pull ambient telemetry); Detection Rule Validation must inject a uniquely-tagged benign marker and confirm the specific rule fired (not only inventory rules and count coverage).
- Promote attack-path edges from heuristic to measured via the runner-executed reachability→exploit probe path, and add a real graph-wide choke-point solver (centrality/min-cut) rather than per-pattern descriptive breakers.
- Compliance attestations must be backed by a real framework control-mapping matrix (DORA, NIS2, SEC, GDPR, PCI DSS, ISO 27001, EU AI Act, ISO 42001) where every asserted control links to measured validation evidence — not a generic posture renderer.
- Data fabric must accept customer scan-file imports (`.nessus`, CSV, SARIF) normalized into the same signal fabric, in addition to the existing live-API connector ingestion.

## PRD audit and completion discipline

- Completion audits must start from `PRD.md` and `docs/PERISCAN_FULL_PRODUCT_PRD.md`, not from status docs or recent execution history.
- Every major source PRD section must be registered in `docs/PRD_SOURCE_COVERAGE_LEDGER.md` before implementation status is considered.
- Every source requirement must be split into atomic rows covering actor, action, API surface, persistence, policy/RBAC/tenant isolation, evidence/redaction/audit behavior, UI behavior, tests, and residual gaps.
- A requirement remains partial if the platform has a framework but not all required durable state, API, activity/history, policy, execution, or reporting behavior.
- Do not claim the full product is complete unless the source coverage ledger has no `SectionIndexed` or `NeedsImplementationAudit` rows, the source-first requirement ledger has zero `Partial`, `NotStarted`, or `Unknown` rows, every blocker is explicit, and full validation has passed after the last change.
- Use scoped language for normal work: "implemented and validated for this slice" or "ready for the tested first-customer scope."
- Tool implementation bundles: `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle` exports non-executing scaffold content, SHA-256 hashes, validation commands, safety notes, and required actions from a work order. Bundles help platform engineers implement reviewed code changes but do not write repo files, install packages, enable tools, queue missions, dispatch runner tasks, or execute modules.
- Tool promotion packages: `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages` persists the reviewed catalog, module, governance, runtime, readiness, evidence, and safety snapshots for a promoted tool candidate. Promotion packages are non-executing artifacts; they document why a tool is ready for governed enablement and remain separate from install, enable, mission, or runner execution APIs.
- Tool upstream version checks: `/api/v1/third-party-tools/:toolId/upstream-version-checks` checks trusted upstream metadata for reviewed tools, persists tenant-scoped candidate reports, and requires catalog/module/parser/license/runtime review before any newer version can become a reviewed update recommendation.
- Tool update recommendations: `/api/v1/third-party-tools/:toolId/update-recommendations` compares tenant pins with reviewed catalog versions, persists auditable recommendations, and lets admins apply reviewed pins or queue install jobs without accepting arbitrary versions or bypassing policy.
- Tool runner eligibility: `/api/v1/third-party-tools/:toolId/runner-eligibility` reports whether a governed tool has any customer-network capability that is actually dispatchable through the outbound signed Internal Runner, using tenant enablement, runtime readiness, active runner count, verified scope, capability status, and the server-side runner allowlist.
- Tool runner dispatch: `/api/v1/third-party-tools/:toolId/runner-dispatch` lets tenant Owner/Admin users dispatch only a reviewed, eligible, server-allowlisted runner capability through existing signed-task runner APIs. The route rejects disabled, legal-review, fixture-only, approval-gated, unverified-scope, missing-runtime, and unallowlisted capabilities before any task is created.
- Runner-executed tool ecosystem: customer-network tools execute only through outbound signed-task runner workflows with local allowlists, scoped targets, resource limits, evidence upload, and activity logging.

The full long-form source remains at [docs/PERISCAN_FULL_PRODUCT_PRD.md](docs/PERISCAN_FULL_PRODUCT_PRD.md).
