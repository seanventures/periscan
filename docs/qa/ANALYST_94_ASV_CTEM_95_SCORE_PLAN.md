# Periscan plan: 94 ASV/CTEM requirements and a 95+ analyst score

**Canonical scope date:** 2026-07-16
**Current evidence score:** 1,347/1,880 (**71.6/100**) — honesty residual 2026-07-30 (A8 matrix-alignment demote: residual Leading on Partial/Scaffold/Missing + SCV→Partial inject-off; prior P12-7/8/12/13 caps retained)
**Target evidence score:** 1,802/1,880 (**95.9/100**)
**Current floor:** 27/94 requirements score at least 4.0
**External claim freeze:** Do **not** export or sell internal “Leading” language for rows the competitive matrix marks Partial/Scaffold/Missing. Remaining Leading rows (**6**) are only matrix Fully-E2E-aligned allowlist: ids **11, 13, 24, 69, 90, 91** (EXV, risk dashboards, scheduling, measured revalidation, MSSP multi-tenancy, CISO/board risk dashboards).

> **P12-16 — dual scoreboard:** The 71.6 → 95.9 path is an **internal engineering
> evidence index only**. It is **not** Magic Quadrant / Wave progress.
> `analyst-scorecard.json` `scoreGovernance.isMagicQuadrantProgress=false` and
> `isForresterWaveProgress=false` are machine-enforced by
> `scripts/analyst-score-gate.mjs`. External claims gate on CoV/AtE narrative +
> design-partner references (**currently zero named refs — do not fabricate**) +
> measured-edge ratio + Production connectors
> (`docs/COMPETITIVE_COVERAGE_MATRIX.md`). Do not treat 95.9 as “Leaders ready.”

This is the only active analyst-score plan. It replaces the mixed 110-row
matrix. Original row IDs remain stable so code, tests, and evidence links do not
need ambiguous renumbering.

## Product north star

Periscan helps an authorized security team repeatedly complete one defensible
loop:

**Discover exposure → validate a path or control → remediate → revalidate →
deliver evidence.**

Every scored capability must contribute directly to that loop, its safe
operation, or its enterprise adoption by the CTEM buyer.

## Scope boundary

The primary scorecard contains 94 requirements. Sixteen rows from the source
matrix were removed because they describe AI-inference infrastructure,
vendor-specific GPU operation, commercial distribution, or other adjacent
platform concerns rather than ASV/CTEM outcomes.

The removal is enforced by `scripts/analyst-score-gate.mjs`; an excluded row
cannot silently re-enter the core scorecard. Existing shared code is not deleted
when it also supports evidence grounding, governed agents, tenant isolation, or
safe runner operation, but it earns no primary roadmap priority by satisfying an
excluded requirement.

## Completion contract

A requirement receives score only from current evidence. A roadmap item,
configuration screen, demo fixture, simulated connector, public-spec wrapper,
or unsupported product claim earns no completion credit.

Every row scoring 4.0 or better must have:

1. a real API and persisted tenant-scoped state;
2. a task-complete product workflow or an honest not-configured state;
3. safety and authorization enforcement appropriate to the action;
4. evidence provenance and explicit measured/inferred/imported state;
5. unit or contract tests plus an end-to-end acceptance path;
6. operator help that has been followed and validated;
7. an accountable owner and current operational evidence.

Words such as **validated**, **measured**, **reachable**, **exploitable**,
**proven**, and **fixed** must be emitted from recorded evidence state, never
from severity or risk score alone.

## Execution order

### Delivery status

| Slice                                          | Status                | Current evidence                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Restore product truth                      | Complete (2026-07-16) | Shared weakest-hop claim derivation is enforced in risk, findings, dashboards, demo, HTML/PDF reports, and path badges; measured closure is required for verified-fix metrics; 141 catalog-only connectors are Planned/NotConnectable and expose a design-partner path instead of credential setup.                                                                                    |
| 2 — Complete the external-validation workbench | Complete (2026-07-26) | The API-backed workbench now binds a verified target, safe profile, exact policy preview, bounded External PoA execution, live state, normalized evidence, remediation correlation, and fresh re-test. A dedicated attempt ledger excludes unrelated internal-runner missions. Help was followed in component and live desktop/mobile validation; no unproven demo target was scanned. |
| 3 — Close measured attack paths                | Next                  | Edge-level planning, persisted edge receipts, measured-path recomputation, and before/after breaker evidence remain the next core proof-loop slice.                                                                                                                                                                                                                                    |

**Agentic multi-wave plan (2026-07-30):** execute Slice 3+ as **Wave A** inside
[`FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md`](./FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md)
(Waves A–L). That plan maps the full 110-feature matrix to parallel agent
dispatch, safety floors, and prove/integrate/refuse strategy
([`docs/competitive/COMPETITIVE_FEATURE_STRATEGY.md`](../competitive/COMPETITIVE_FEATURE_STRATEGY.md)).
Do not start Wave D (optional lab inject) without explicit human SOW approval.

Honesty rescore (2026-07-29 wave2 + **2026-07-30 A8 closeout**): demoted
inflated Leading rows that conflicted with
`docs/COMPETITIVE_COVERAGE_MATRIX.md` (choke Partial; dynamic paths /
multi-agent / conversational builder / compliance attestation Scaffold; IaC push
absent → Partial; AI control / prompt-injection / data fabric Partial; SSCS
Partial; marketplace commercial NotConfigured → Scaffold; vCenter read-only →
Strong + matrix Partial; **SCV Strong → Partial** while inject hard-disabled;
plus APV/DRV already demoted). Score is now **1,347/1,880 (71.6)**. Completing a
delivery slice still does not auto-raise scores — raise only with measured
evidence and a fresh gate-passing rescore.

### Slice 1 — Restore product truth

- Centralize claim-language derivation across paths, findings, dashboards,
  reports, compliance, and remediation.
- Prevent heuristic, discovered, or partially measured paths from being called
  validated.
- Reclassify connectors without live vendor behavior as Planned and not
  connectable.
- Add regression tests for every primary claim surface.

**Exit:** no primary UI or report can overstate evidence, connector readiness,
control coverage, or fix verification.

### Slice 2 — Complete the external-validation workbench

- Select a verified target and authorization record.
- Choose a safe profile and preview scope/policy decisions.
- Assign an eligible runner or bounded platform executor.
- Show queued, live, timed-out, denied, and completed activity.
- Review normalized results and evidence, create remediation, and re-test.

**Exit:** an operator can complete the external exposure proof loop without
leaving the product or relying on a reference-only catalog.

### Slice 3 — Close measured attack paths

- Generate an edge-level validation plan from each path hypothesis.
- Show prerequisites, modules, policy decisions, execution eligibility, and
  missing telemetry before launch.
- Persist edge receipts and recompute the path state from those receipts.
- Show before/after paths and the smallest evidence-backed breaker.

**Exit:** the normal journey moves from hypothesis to measured edges and never
upgrades unrelated edges by association.

### Slice 4 — Make findings operational

- Add stable fingerprints, root-cause grouping, occurrence history,
  first/last-seen, affected assets, owner, SLA, and merged evidence.
- Ensure repeated observations update an occurrence rather than create an
  indistinguishable work item.
- Maintain one remediation relationship per grouped cause and preserve
  verification history.

**Exit:** the queue represents unique security work, not duplicated scanner
events.

### Slice 5 — Reconcile control effectiveness

- Use one denominator and state model across Controls, Dashboard, Findings,
  Reports, and Schedules.
- Distinguish NotTested, NoEvidence, Inconclusive, TelemetryOnly, Detected,
  Prevented, and Missed.
- Add source readiness, expected behavior, scenario coverage, regression, and
  missed-detection drill history.

**Exit:** every control number is explainable from the same underlying tests and
observations.

### Slice 6 — Promote Assets & Scope

- Make the canonical asset inventory and source lineage a primary workspace.
- Add ownership-review queues for internet-facing candidates.
- Keep discovery candidates separate from verified authorized scope.
- Expose freshness, attribution, conflicting source identity, and scope impact.

**Exit:** operators can establish what Periscan knows, owns, and is authorized
to test before starting validation.

### Slice 7 — Build an evidence explorer

- Add artifact preview, normalized content, provenance, linked claims,
  collection method, integrity result, redaction lineage, and ledger position.
- Deep-link every claim and report statement to its evidence.
- Keep sensitive raw scanner output out of primary UX while preserving
  controlled inspection.

**Exit:** an analyst can independently verify why Periscan made a claim.

### Slice 8 — Operate continuous validation

- Add validation pack, owner, policy profile, runner pool, retries, concurrency,
  blackout behavior, notifications, drift thresholds, and next-run preview.
- Show run history and recovery decisions before and after schedule creation.
- Treat denied or stale work as a fresh policy decision, never silent replay.

**Exit:** recurring validation is observable, recoverable, and governed.

### Slice 9 — Finish safe BAS and specialist coverage

- Complete the remaining bounded lab or partner paths for credential exposure,
  OT/ICS, harmless ransomware detection, synthetic identity abuse, and human
  validation.
- Preserve explicit safety substitutions: no credential theft, persistence,
  destructive actions, real exfiltration, or uncontrolled exploit chains.

**Exit:** low-scoring rows 2, 16, 21, 22, 26, and 28 have real qualified
answers or remain explicitly partner-gated without fake UI readiness.

### Slice 10 — Release qualification

- Validate the full ICP journey at desktop, mobile, zoom, keyboard-only, and
  reduced-motion settings.
- Run customer-source connector qualifications, multi-node runner failure
  drills, tenant-isolation proof, and production-like load/soak exercises.
- Perform a blind evidence rescore by someone who did not build the feature.
- **Honest gap map (2026-07-30):** `docs/qa/SLICE10_PATH_TO_95.md` — row-by-row
  delta from **1,347/1,880 (71.6%)** to 95% (+439 pts). Lab/partner/customer
  qualification is majority mass; code polish alone cannot invent 95.
- Gate floors documented in `scripts/analyst-score-gate.mjs` (current honesty
  lock 1347; Done only at ≥1786 with blind rescore).

**Exit:** at least 90% journey success, no serious accessibility findings, no
false-clean or false-validated claims, and a current evidence score of at least
95/100. **Not Done while score remains 71.6.**

## Score governance

- `docs/qa/analyst-scorecard.json` is the machine-readable source of truth.
- `scoreGovernance.isMagicQuadrantProgress=false` /
  `isForresterWaveProgress=false` — **P12-16** dual scoreboard (internal
  engineering index only; never sell as MQ/Wave progress).
- `scoreGovernance.marketPresence.namedCustomerReferences=0` — do not fabricate
  refs/ARR/marketplace (P08-2 / P12-6 / P13-1).
- `pnpm analyst:score:check` enforces the 94-row boundary, original ID set,
  evidence paths, row math, dependencies, owner roles, aggregate totals,
  Leading Fully-E2E allowlist, and SCV inject-off cap.
- Score regression and expired evidence block release.
- Product-visible readiness is derived from real persistence, integrations,
  local labs, validation modules, evidence, or honest empty states.
- Optional platform capabilities do not appear in first-run guidance or consume
  a core ASV/CTEM delivery slice.

## Current priority metrics

- measured-edge ratio and complete measured-path ratio;
- percentage of claims with directly inspectable evidence;
- duplicate finding rate and grouped-occurrence accuracy;
- control-technique coverage and missed-detection regression rate;
- verified-scope and asset-ownership completion;
- time to first validation, smallest fix, revalidation, and proof delivery;
- runner availability, task latency, denial correctness, and recovery success;
- qualified live connector count, sync freshness, and schema-drift recovery;
- remediation ownership, SLA attainment, and verified closure rate.
