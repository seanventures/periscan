# Periscan core-product gap audit

Date: 2026-07-16
Mode: Combined product-capability, UX, and visible-accessibility audit
Surface: Authenticated demo tenant at 1280×720

## Overall verdict

Periscan has a unusually broad and often well-governed technical foundation,
but the core proof loop is not yet trustworthy or complete enough for release.
The largest issue is not visual polish. It is that several primary surfaces
present inferred or unmeasured results with validated/proven language.

The retired 110-row scorecard combined ASV/CTEM requirements with an enterprise
LLM-serving product. Sixteen equally weighted rows covered NVIDIA
H100, GPU scheduling, LoRA serving, token-cache economics, semantic caching,
mixed precision, virtual keys, context pruning, model swapping, and related
runtime concerns. Those may be optional deployment capabilities, but they
should not compete with exposure discovery, measured validation, control
testing, evidence inspection, and remediation verification.

Those 16 rows have now been removed from the canonical scorecard and score gate.
That scope correction does not make the core healthy: the remaining 94 rows
average 79.1/100 against a 95.9 target. The core still needs substantive work.

## Slice 1 resolution update — 2026-07-16

Two release-blocking truth defects from this audit are closed:

- Claim language now comes from one weakest-hop contract. Risk severity cannot
  upgrade evidence certainty; heuristic or partially measured paths render as
  hypotheses even when an older workflow record says Validated or Exploitable.
  The contract is applied again at HTML/PDF export time so stale snapshots
  cannot reintroduce an overclaim.
- The 141 standardized catalog entries without vendor-specific live behavior
  are now Planned, NotConnectable, and blocked by the API. The marketplace
  offers a design-partner route instead of Configure. The 126 dedicated live
  integrations remain connectable.

Verified-fix rollups now require a measured Fixed/Mitigated verification event,
and the command center distinguishes observed control misses from untested or
no-evidence techniques. The deeper canonical control-effectiveness model is
still scheduled for Slice 5. External validation, measured per-hop path closure,
finding deduplication, and the other unresolved items below remain active work.

## Release-blocking gaps

### P0 — Truth language is not derived from evidence state

- The selected attack path is `Heuristic`, `Discovered`, and `0/2 measured`,
  but its summary says “Validated high-impact path.”
- The report headline says “Critical validated paths require action” and says
  it generated “evidence-backed paths,” even though all three displayed paths
  are heuristic and discovered.
- The risk engine chooses “Validated high-impact path” from the risk band alone.
  Report generation chooses “validated” from the Critical band alone.
- This is the highest-risk defect in a product whose differentiator is proof.

Required invariant: words such as **validated**, **measured**, **reachable**,
**exploitable**, **proven**, and **fixed** must be emitted only by a shared
claim-language function derived from the recorded evidence basis, validation
state, measured-hop completeness, and verification outcome.

### Resolved 2026-07-26 — External validation operating workflow

The primary **External Validation** navigation route now provides verified
target and authorization selection, safe-profile selection, exact policy
preflight, bounded External PoA execution, live and terminal activity states,
normalized evidence review, remediation correlation, and fresh re-test. A
dedicated tenant-scoped attempt API prevents unrelated internal-runner missions
from contaminating the workbench history.

Validated workflow: choose a verified target → select a safe profile → preview
policy → use eligible bounded execution → observe live activity → review
normalized results → create a correlated remediation/re-test.

### P0 — 141 connectors are connectable before live ingestion exists

The catalog currently contains 267 Beta connectors:

- 126 are classified as `DedicatedClient` and `live`.
- 141 are `StandardizedCatalog`.
- all 267 are `ReadyForCredentials` and connectable;
- none is Production/Certified.

The standardized factory explicitly returns no signals in non-mock mode and
says live ingestion is a future per-vendor depth follow-on. The marketplace
still offers **Configure**. This conflicts with Periscan's real-first rule and
the repository instruction that planned integrations must not become
connectable without a real implementation and tests.

Required correction: standardized manifests without live vendor behavior must
be visible but `Planned`/`NotConnectable`. “Configure” becomes “Design partner”
or “Notify me.” Production certification must be earned per connector through
credentialed contract, health, sync, normalization, error, and revocation
tests.

### P0 — Attack-path validation stops at a hypothesis

The demo contains three paths, all heuristic/discovered. The primary path has
two heuristic hops and no measured hop. The detail page has a “Validate this
path (safe)” entry, but the normal journey does not turn each hypothesis edge
into an obvious measured validation plan with prerequisites, eligible modules,
policy decision, execution progress, and edge-by-edge outcomes.

Required workflow: hypothesis → generated per-hop validation plan → policy and
scope readiness → assigned runner/control-plane execution → edge receipts →
path state recomputation → before/after evidence.

### P0 — Findings and remediation contain duplicate operational objects

The findings queue repeats identical EXV, BAS, secret, and cloud rows. Two
identical repository-secret remediation tasks and multiple duplicated findings
appear in the demo and in the report. The user sees repeated technical type
names instead of a grouped root cause with affected assets and occurrences.

Required model: stable finding fingerprint, root-cause grouping, occurrence
history, merged evidence, first/last seen, affected asset count, owner, SLA,
and one remediation relationship. Repeated observations update an occurrence;
they do not create indistinguishable work items.

### P0 — Control validation is too thin and contradicts the command center

The control page shows 0% coverage across five techniques: one `NoEvidence`
and four `NotTested`. The history is a long sequence of identical 0% snapshots.
The dashboard simultaneously says “Missed by controls: 0,” and the report
contains control verdicts. These states may be technically different, but the
product does not reconcile them for an operator.

Required correction: one canonical control-effectiveness model, explicit
denominators, source readiness, scenario coverage, observed versus expected
behavior, missed detections, regression, and a consistent roll-up used by the
dashboard, Controls, findings, and reports.

## High-impact gaps

### P1 — Core asset inventory is hidden

`/data-fabric` has valuable canonical asset, lineage, source-quality, and
ownership-review behavior, but it is absent from primary navigation. The demo
shows 13 assets, five internet-facing candidates, zero attributed candidates,
and 0% ownership confidence. This should be a first-class **Assets & Scope**
workspace, not a hidden data-fabric implementation detail.

### P1 — Evidence cannot be inspected in context

The evidence ledger is a dense table of truncated IDs. The action column is
visually clipped at the desktop audit viewport. There is no obvious artifact
detail/preview showing normalized content, provenance, linked claim, parent
chain entry, collection method, redaction transformation, and integrity result.
The page copy says to inspect an artifact before relying on it, but the visible
workflow offers Verify, Download, and Redact rather than Inspect.

### P1 — Continuous validation is only basic recurrence

The demo has zero schedules. The creation surface supports daily/weekly/monthly,
time, timezone, day, optional scope, and a blackout toggle. It does not expose
owner, proof-loop pack, policy profile, eligible runner pool, retry/failure
policy, concurrency, notification route, drift threshold, next-run preview, or
run history before creation.

### P1 — Core first-run guidance points toward adjacent platform work

After the proof loop, Getting Started highlights agent workflows, model
economics, and enterprise readiness. It omits the higher-value operational next
steps: qualify asset ownership, schedule continuous validation, establish
control coverage, configure runner redundancy, and set remediation ownership
and SLAs.

### P1 — Proof-loop context is visually broken

The shared context component tries to place an entity label, eight stage pills,
four facts, and a CTA in one desktop row. In the expanded finding, attack-path,
and remediation views it compresses the stage pills vertically, truncates facts,
and pushes the CTA into the edge of the container.

### P1 — Ten authenticated routes contain nested `main` landmarks

The application shell already supplies the page `main`. `PageShell` also
renders a `main`, creating nested main landmarks on ten routes including Data
Fabric, External Validation, Validation Ops, policies, and account security.
Automated route-level axe checks do not prove assistive-technology clarity for
these nested or expanded states.

## Requirements removed from the primary ASV/CTEM scorecard

These source-matrix rows no longer receive core score or roadmap priority:

- 45 NVIDIA H100 Confidential Computing
- 46 Memory Confidentiality
- 55 No-Log Inference Execution
- 56 Fair-Share GPU Scheduling
- 58 Billing-Grade Token Metering
- 95 AWS Marketplace Availability
- 99 Distributed Workload Scaling
- 100 LoRA Multi-Adapter Serving
- 101 Cache-Hit Attribution Metering
- 102 Mixed-Precision Token Weighting
- 103 Semantic Caching via Gateway
- 104 Virtual Key Budget Enforcement
- 105 Per-Tenant Usage Endpoints
- 106 Automated Context Pruning
- 108 Zero-Downtime Model Swapping
- 109 RTAP Mode

Hardware-rooted assurance and execution integrity can remain optional enterprise
deployment controls. Vendor-specific NVIDIA work should not be a core product
requirement or a primary navigation destination.

## Audited journey

| Step | Surface                  | Health                | Evidence                                                                                                            | Finding                                                                                                              |
| ---: | ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
|    1 | Command center           | At risk               | [01-dashboard-command-center.png](audits/core-product-gap-audit-2026-07-16/01-dashboard-command-center.png)         | Strong triage entry, but 39 actions and “0 missed” conflict with control coverage.                                   |
|    2 | Validation Snapshot      | At risk               | [02-validation-snapshot.png](audits/core-product-gap-audit-2026-07-16/02-validation-snapshot.png)                   | Single verified scope is not selected by default, so readiness initially says not verified.                          |
|    3 | Findings triage          | Blocked by quality    | [03-findings-triage.png](audits/core-product-gap-audit-2026-07-16/03-findings-triage.png)                           | Duplicate rows, implementation-style titles, redundant status badges, and compressed expanded context.               |
|    4 | Attack-path detail       | Trust blocker         | [04-attack-path-detail.png](audits/core-product-gap-audit-2026-07-16/04-attack-path-detail.png)                     | “Validated” summary for a heuristic, discovered, 0/2-measured path.                                                  |
|    5 | Control effectiveness    | Coverage blocker      | [10-control-effectiveness.png](audits/core-product-gap-audit-2026-07-16/10-control-effectiveness.png)               | 0% across five techniques and repeated zero-value history.                                                           |
|    6 | External validation      | Resolved 2026-07-26   | Original finding: [14-external-validation.png](audits/core-product-gap-audit-2026-07-16/14-external-validation.png) | Replaced by the verified-target, policy-gated, bounded-execution, live-evidence, remediation, and re-test workbench. |
|    7 | Remediation detail       | Promising, incomplete | [05-remediation-detail.png](audits/core-product-gap-audit-2026-07-16/05-remediation-detail.png)                     | Real verification discipline exists; duplicate tasks and a compressed context strip weaken operation.                |
|    8 | Evidence ledger          | At risk               | [06-evidence-ledger.png](audits/core-product-gap-audit-2026-07-16/06-evidence-ledger.png)                           | Provenance is represented but not inspectable in a human-centered artifact view.                                     |
|    9 | Proof composer           | Trust blocker         | [07-reports-delivery.png](audits/core-product-gap-audit-2026-07-16/07-reports-delivery.png)                         | Polished preview promotes heuristic/discovered paths as validated.                                                   |
|   10 | Integrations             | Trust blocker         | [08-integrations-readiness.png](audits/core-product-gap-audit-2026-07-16/08-integrations-readiness.png)             | 267 Beta connectors, including 141 configure-able standardized entries without live ingestion.                       |
|   11 | Asset and source lineage | Valuable but hidden   | [11-data-fabric.png](audits/core-product-gap-audit-2026-07-16/11-data-fabric.png)                                   | Core asset inventory exists but is absent from primary navigation and ownership is unresolved.                       |
|   12 | Continuous validation    | Incomplete            | [12-continuous-validation.png](audits/core-product-gap-audit-2026-07-16/12-continuous-validation.png)               | Basic schedule form, zero demonstrated schedules, limited operating controls.                                        |
|   13 | Validation operations    | Healthy foundation    | [13-validation-operations.png](audits/core-product-gap-audit-2026-07-16/13-validation-operations.png)               | Honest queue recovery and no-silent-replay behavior; nested landmark remains.                                        |
|   14 | Compliance trace         | Promising, incomplete | [15-compliance-evidence.png](audits/core-product-gap-audit-2026-07-16/15-compliance-evidence.png)                   | Real evidence mapping exists; the selected DORA catalog has only four unowned controls.                              |
|   15 | Getting Started          | Misprioritized        | [09-getting-started.png](audits/core-product-gap-audit-2026-07-16/09-getting-started.png)                           | Evidence-backed milestones are strong, but post-loop guidance emphasizes model infrastructure over core operations.  |

## Recommended execution order

1. **Truth invariant:** central claim-language contract; repair risk summaries,
   dashboard rollups, report headlines, and compliance inclusion tests.
2. **External validation workbench:** build the full verified-target-to-evidence
   journey on current scope, policy, runner, mission, and evidence services.
3. **Connector truth reset:** disable 141 non-live standardized connectors;
   introduce per-connector certification and visible implementation tiers.
4. **Measured path closure:** generate and execute edge-level validation plans;
   recompute path state only from recorded edge receipts.
5. **Finding identity and work management:** deduplicate, group occurrences,
   add owner/SLA/first-last-seen, and unify remediation relationships.
6. **Control-effectiveness reconciliation:** one denominator and state model
   across Controls, dashboard, findings, reports, and schedules.
7. **Assets & Scope:** promote Data Fabric into primary navigation and turn
   ownership candidates into a guided verification queue.
8. **Evidence explorer:** add artifact detail, provenance graph, linked claims,
   redaction history, chain position, and one-click contextual inspection.
9. **Continuous validation operations:** add pack/policy/runner selection,
   retry/failure/notification controls, next-run preview, and history.
10. **Shared UI semantics:** repair `ProofLoopContext`, replace nested
    `PageShell` main landmarks, and test expanded states at desktop/mobile.

## Evidence limits

- Screenshots establish visible UX and state communication, not full WCAG
  compliance.
- The audit did not submit persistent actions such as running missions,
  creating schedules, changing dispositions, generating new reports, or
  disconnecting integrations.
- Connector implementation depth was checked directly in the connector catalog
  and standardized connector factory; live customer credentials were not used.
- Hardware, partner, commercial marketplace, and production-scale claims require
  external qualification and should not be inferred from local demo behavior.
