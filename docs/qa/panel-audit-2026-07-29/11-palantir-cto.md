# Panel audit — Palantir CTO lens

**Date:** 2026-07-29  
**Persona:** Palantir-style CTO (ontology, mission control, forward-deployed fusion, operational OS)  
**Repo:** `/Volumes/DataSSD1/test/periscan`  
**Surface inventory:** `docs/qa/panel-audit-2026-07-29/SURFACE_INVENTORY.md`  
**Scope (read-only):** data fabric, missions, swarm / operators, signal activity, evidence packages & graph — product code not modified.

---

## Executive judgment

Periscan is **not** a Palantir Foundry clone, and it should not pretend to be. What it has built—when viewed as a **security mission OS**—is more interesting than a feature checklist:

1. A **typed object model** (Zod + Prisma) that is closer to an ontology of *authorized validation work* than to a generic SIEM event lake.
2. A **mission control spine** (scope → policy decision → mission → run/job → evidence → pack) that is real, tenant-scoped, and approval-gated.
3. An **evidence graph as partial operational OS**—nodes, edges, paths, hop receipts, measured-vs-heuristic claim language—with honesty machinery that Foundry-style deployments would recognize as *epistemic discipline*.
4. A **fusion surface that is honest about partial fusion**: connectors + signal envelopes + asset resolution + correlation, without inventing a universal object graph that does not exist in the data.

The product also carries a **semantic debt** that would fail a forward-deployed ontology review on day one: marketing-shaped labels (“Agent Swarm”, “living map”, “50k+ templates”, terrain/swarm KB stubs) sit beside a deliberately honest measured core. Palantir’s standard is brutal here: **one object type, one meaning, one lineage story**. Periscan’s best work already obeys that; its competitive/completion scaffolding does not.

**Headline score (persona rubric, 0–5):**

| Dimension | Score | One-line |
|---|---:|---|
| Ontology / data fabric coherence | **3.5** | Strong object types + quality/lineage surfaces; no single navigable ontology, no import fabric, node types still free-string. |
| Mission system as control plane | **4.0** | Best-in-class for a CTEM product: policy-bound missions, draft-from-signal, durable runs. Nav naming still confuses “mission” vs “snapshot”. |
| Swarm / operators as force multipliers | **3.0** | Operators = real deterministic recommenders; swarm UI = radar over real sessions/missions (good) but not a multi-agent ontology or durable agent objects. |
| Evidence graph as operational OS | **4.0** | Graph + paths + receipts + claim language are the product’s spine; “living map / terrain” extensions are fixture stubs and must stay quarantined. |
| Multi-source fusion honesty | **4.5** | Measured/Heuristic, resolution status, ownership confidence, quality states, no-fabricate rules—this is the Palantir-grade differentiator. |
| **Overall mission OS readiness** | **3.7** | Ready as a **governed validation OS for authorized scope**; not ready as a general enterprise ontology or autonomous swarm platform. |

---

## 1. Ontology / data fabric coherence

### What “ontology” means here

In a Palantir deployment, the ontology is the contract between operators and the world: **object types, link types, properties, actions, and the rules for when an object may be written**. Periscan’s analogue is:

| Layer | Where it lives | Role |
|---|---|---|
| Public contracts | `packages/shared/src/domain.ts` | Zod schemas: `Asset`, `SignalEnvelope`, `ValidationMission`, `GraphNode/Edge`, `AttackPath`, `EvidencePack`, `DataFabricQualitySurface`, … |
| Persistence | `packages/db/prisma/schema.prisma` | Tenant-scoped tables; integrations, assets, observations, signals, missions, graph, packs |
| Resolution / fusion | `packages/evidence` (`entity-resolution`, `correlation`, `graph`, `edge-receipts`) | Identity match, path drafts, hop certainty |
| Product surfaces | `/data-fabric`, `/integrations`, `/evidence`, `/attack-paths`, `/signal-activity` | Operator-facing views of the same objects |

That stack is **API-first and shared-contract-first** (`docs/ARCHITECTURE.md`), which is the right institutional shape. Forward-deployed teams can reason from schemas, not from UI copy.

### What is actually good

**1. First-class object types for the mission domain**

Missions, runs, policy decisions, scopes, integrations, signal envelopes, evidence artifacts (with chain metadata), attack paths with per-edge `evidenceBasis`, remediations, and evidence packs are not JSON blobs loosely dumped into a “events” table. They are typed, tenant-scoped, and linked through IDs. This is closer to Foundry object types than to “dashboard metrics.”

**2. Data fabric as quality + ownership + lineage—not a fake fabric**

`/data-fabric` (`apps/web/src/components/data-fabric-workbench.tsx`) is backed by real services in `apps/api/src/services/data-fabric.ts`:

- **Source quality surface** — per-integration state machine: `Qualified | Degraded | Stale | PendingFirstSync | Disconnected`, with freshness budgets derived from sync frequency, counts of asset observations and signals, and issue strings operators can act on.
- **Asset ownership surface** — internet-facing / scoped assets attributed via verified domain/subdomain roots; confidence and basis text; human review dispositions for unattributed candidates (without inventing ownership).
- **Asset lineage** — last-N source observations with resolution status (`Matched`, `Created`, `ConflictMatched`, `AmbiguousCreated`), conflict fields, confidence, evidence IDs.

This is **fusion honesty as product UX**: the fabric tells you when sources are stale, disconnected, or empty—not a green “synced” lie.

**3. Entity resolution with explicit ambiguity**

`packages/evidence/src/entity-resolution.ts` separates strong vs weak identifiers, refuses to collapse siblings on region/account context, and can return `AmbiguousCreated` rather than force a merge. That is ontology hygiene: **do not mint false identity**.

**4. RelatedEntityType as a partial type system**

Graph nodes and evidence artifacts can bind to a large enum of related entity types (`ValidationMission`, `AttackPath`, `EvidencePack`, `Integration`, …). Evidence ledger routes only entities that have real pages. That is a practical “action → object” map, even if incomplete.

### Where coherence breaks

**A. Free-string graph node types**

`GraphNode.nodeType` is `z.string().min(1)` / Prisma `String`, not a closed ontology enum. Object *kinds* on the graph are therefore convention-driven. Palantir review: **link types are closed (`EdgeRelationship`); node types should be too**, or every free string becomes a permanent interoperability tax.

**B. No single “ontology browser”**

Operators navigate by product surface (findings, paths, fabric, evidence, threats)—not by object type catalog. There is no unified object explorer (Foundry Object Explorer analogue). Cross-links exist but are route-local (`EvidenceLedger`’s `ENTITY_ROUTE` map). Forward-deployed: you will re-teach the map every engagement.

**C. Dual truths in the same package**

`packages/evidence/src/graph.ts` contains both:

- Production graph service (upsert node/edge, attack paths, path finding, evidence linking).
- **Fixture terrain / living-map / swarm-KB helpers** (`seedDiscoveryAssetsForASVEASM`, `queryForTerrain`, `computeLivingMapDelta` with dollar-impact heuristics and synthetic campaign IDs).

Competitive matrix already labels living map as a stub. Ontology rule: **stubs must not share package surface area with production graph APIs without hard quarantine**. Otherwise FDEs and agents will wire the wrong layer.

**D. Fabric is connector-pull, not open ingest**

PRD and competitive matrix agree: no customer scan-file importers (`.nessus`, CSV, SARIF). Fusion is live-API-per-connector. That is a deliberate scope, but it caps “data fabric” claims. Palantir customers expect **bring-your-own-source normalization** into the same object types.

**E. Nav vs object naming**

- Route `/missions` nav label: **“Validation Snapshot”** (`app-navigation.ts`).
- Page title / mission detail: **validation mission**.
- Mission types include `ValidationSnapshot` as *one of several* mission types.

Operators will not form a stable mental model of “mission” until labels match object types. Ontology failure mode: same word, three meanings.

### Verdict — fabric

**Partial, high-quality partial.** Treat data fabric as **source qualification + identity + ownership**—not as a completed enterprise ontology. Close the free-string node types and quarantine terrain stubs before expanding fabric marketing.

---

## 2. Mission system (mission control)

### The spine (real)

Architecture (`docs/ARCHITECTURE.md`) states the correct control loop:

1. Scope verified  
2. Integration / runner capability  
3. **Policy decision**  
4. Mission  
5. Worker or runner executes module  
6. Evidence stored  
7. Signals / graph / findings / remediations / packs  

Persistence matches: `ValidationMission` requires scopes, safety level, status lifecycle (`Draft` → `Queued` → `Running` → terminal states including `DeniedByPolicy` / `RequiresApproval`), optional `policyDecisionId`, evidence ID array. Runs and jobs hang off missions; worker reconciles status and upserts evidence-graph nodes for runs/signals.

This is **mission control**, not a ticket queue. Policy is not a side check—it is on the write path.

### How missions enter the system

| Ingress | Behavior | Honesty |
|---|---|---|
| Validation Snapshot flow (`/missions`) | Snapshot-centric UX; creates snapshot-class work | Real pack/report path via `EvidencePack` |
| Operator approve | `approveOperatorRecommendation` → policy preview → `createMission` | Requires verified scope; not self-executing |
| Signal trigger approve | Creates **Draft** mission + policy decision; **does not auto-queue** | UI and API language are explicit: draft only |
| Schedules / revalidation | System sweep, measured retest loops | Competitive matrix: Fully-E2E for scheduling & revalidation |
| Model gateway tools | Action tools reuse mission/approval machinery | Model thinks; Periscan controls |

Signal activity page copy is correctly conservative: *“Approving a ready trigger creates a policy decision and a draft mission only.”* That is Palantir-grade action design: **propose → authorize → execute**, never silent agency.

### Mission detail as operational record

`MissionDetail` loads mission + runs + audit search, polls every 6s, exposes cancel, and maps status into a “proof loop” stage (Authorize / Validate / Understand). Evidence basis is derived from whether runs carry evidence IDs—not from decorative status.

### Gaps (mission system)

1. **Primary nav buries “missions” under “Validation Snapshot.”** List/detail exist (`/missions`, `/missions/[id]`), but the product still presents snapshot as the hero mission type. Multi-type mission OS needs a mission queue first-class (status, type, policy, scope, evidence count)—not only snapshot flow.
2. **Operator recommendations are not durable objects.** There is no `OperatorRecommendation` Prisma model; recommendations are generated on read (`generateOperatorRecommendations`). Approvals create missions but recommendation history is ephemeral/deterministic-id only. Ontology gap: **no object = no audit lineage of proposals over time** (mission audit partially covers outcomes, not the recommendation corpus).
3. **Mission-as-object vs mission-as-page.** Orchestration flow maps and validation-ops surfaces exist elsewhere; the graph can hold `ValidationMission` related entities, but there is no first-class “mission graph neighborhood” default view.

### Verdict — missions

**Strong mission control for authorized validation.** The policy-mission-run-evidence chain is the product’s institutional backbone. Fix naming, promote multi-type mission ops UI, and persist recommendations if operators are to become ontology-grade actors.

---

## 3. Swarm and operators

### Operators (real, bounded force)

`packages/operators` defines closed operator types:

- RedTeam, BlueTeam, Exposure, Remediation, Evidence, AIAppSecurity  

Each profile has purpose, capabilities, default safety level, and supported mission types. Recommendations:

- Cite **evidence IDs** (min 1).
- Carry a **mission plan** (environment, modules, safety, scope, requested actions with safe defaults).
- Status `Proposed | Approved | NotActionable`.
- Uncertainty band.
- Deterministic recommendation IDs from content hash (stable, not random theater).

UI (`/operators`): evidence-backed proposals; approve path creates policy + mission; never self-executing. Summaries via `generateEvidenceGroundedSummary` refuse claims without artifacts and force evidence-cited claim lines (even if the prose is metadata-level, not narrative intelligence).

This is the correct **specialist agent** pattern for a regulated security product: specialists propose; humans and policy execute.

### Swarm surface (honest radar, overloaded brand)

`/swarm` → `AutonomousOperations`:

- Pulls **real** model sessions, missions, engagements, signal-trigger activity.
- Metrics are counts of real statuses (active sessions + running missions, awaiting approval, engagement count, trigger activity count).
- Radar blips link to real routes (`/missions/:id`, `/engagements`, `/model-gateway`).
- Empty state is honest: “No autonomous agents active.”
- 6s refresh is ops-console cadence, not fake motion.

Copy still sells “The swarm, on the scope” and “Every blip is a real agent at work.” That is **metaphorically true** (sessions + missions as agents) and **ontologically false** (no Agent object type, no swarm membership, no multi-agent plan graph, no shared working memory object). Nav label **“Agent Swarm”** overclaims relative to implementation.

Competitive matrix and `PRD.md` are explicit: `Math.random` swarm/kill-chain metrics and 50k+ template stubs are **completion blockers / must quarantine**. Living-map swarm KB strings in `graph.ts` are fixture language, not product truth.

### Model gateway vs swarm

Architecture positions Frontier Gateway correctly: BYO model, redacted context, PEP on tools, approval-gated action tools, no new path to customer systems. That is **governed cognition**, not a swarm. Do not collapse gateway sessions into “swarm agents” without distinct object types and provenance.

### Verdict — swarm / operators

- **Operators:** ship-grade recommenders; promote to durable ontology objects next.  
- **Swarm UI:** acceptable **mission control radar** if renamed and de-marketed.  
- **Swarm-as-platform (PRD competitive track):** scaffold / fixture; keep out of customer-visible claims.

---

## 4. Evidence graph as operational OS

### Why this is the OS

In Palantir terms, the operational OS is where decisions attach to objects that persist, link, and explain themselves. Periscan’s candidate OS is:

```
SignalEnvelope / Module result
        ↓
EvidenceArtifact (sha256, optional chain)
        ↓
GraphNode / GraphEdge (+ evidenceIds)
        ↓
AttackPath (pathNodes, pathEdges with per-hop basis, pathBreakers)
        ↓
PathEdgeReceipt (hopKey-stable measured upgrades)
        ↓
Risk / Remediation / VerificationEvent / EvidencePack
```

Key design choices that pass CTO review:

1. **Weakest-link certainty** — path is Measured only if every hop is Measured with evidence IDs (`edge-receipts.ts`, claim language). Severity/confidence **cannot** upgrade certainty (`claim-language.ts` comment and logic).
2. **Claim kinds** — `HeuristicHypothesis`, `PartiallyMeasuredHypothesis`, `MeasuredPath`, `MeasuredReachable`, `MeasuredValidated`, `MeasuredExploitable` with explicit canClaim\* flags. This is ontology-enforced speech acts: the UI is not free to say “exploitable” without state + measurement.
3. **HopKey receipts** — stable hop identity across correlation refresh so measured work is not lost when path IDs rewrite. That is operational memory done right.
4. **Correlation drafts mark hypothesis nodes** — `correlation.ts` forbids minting placeholder Asset rows for hypothesis reachability; binds to real assets when known. Real-First Rule enforced in the fusion engine, not only in docs.
5. **Evidence ledger + chain verification** — artifacts as first-class; chain report statuses; redaction metadata without breaking ingest commitment.
6. **Evidence packs** — audience-scoped packs, redaction levels, storage URI, analyst notes, report shares; reports package (`packages/reports`) from normalized evidence; raw scanner dumps kept out of primary UX by design.

### What “operational OS” still lacks

| Missing OS capability | Today |
|---|---|
| Write-back actions as first-class ontology actions | Missions/remediations exist; not a general Action type with pre/post object snapshots |
| Global graph exploration | Path/neighbor APIs exist; no universal graph workspace as home screen |
| Continuous living map of all terrain | Stub / fixture; real inventory is scope + connector + recon modules |
| Pack ↔ path ↔ mission neighborhood as one canvas | Cross-links and proof-loop components; not a single object workspace |
| Compliance control objects mapped to packs | Pack types exist; framework mapping largely scaffold (competitive matrix) |

### Verdict — evidence graph

**The evidence graph + claim language is the product’s Palantir-shaped heart.** Protect it. Do not dilute it with living-map dollar stubs or swarm template counts in the same conceptual layer. Lead demos from path claim → hop evidence → pack, not from radar chrome.

---

## 5. Multi-source fusion honesty

### Fusion path that is real

1. **Connectors** emit / sync into integrations; asset source observations and signal envelopes attach with provenance (`sourceIntegrationId`, optional `sourceRunnerId` for in-network measurement).
2. **Entity resolution** merges or creates assets with confidence and conflict fields—not silent overwrite.
3. **Signal fabric** categories feed correlation → attack path drafts with explicit heuristic default.
4. **Data fabric quality** scores whether fusion inputs are fresh enough to trust.
5. **Ownership** fuses exposure inventory with verified scope roots; unattributed candidates require human disposition.
6. **Operators / triggers** only propose work when evidence and readiness gaps allow; missing scope/integration/runner surfaces as evaluation status, not a silent skip.
7. **Evidence-grounded summaries** refuse empty evidence sets.

Competitive matrix: unified data fabric = **Partial** (real correlation + real Tenable/Wiz-class ingestion; no scan-file import; fixture fallbacks on inventory clients). That is the correct self-score.

### Honesty mechanisms (load-bearing)

| Mechanism | Effect |
|---|---|
| `evidenceBasis` Measured vs Heuristic | Speech control for paths and edges |
| `deriveAttackPathClaim` | Weakest hop wins; no severity upgrade |
| Resolution status + conflict fields | Identity uncertainty is visible |
| Data fabric quality states | Source trust is visible |
| Ownership confidence + basis strings | Attribution is explainable |
| Signal trigger evaluation statuses | Readiness gaps named (`RequiresVerifiedScope`, etc.) |
| Draft-only mission from triggers | No silent execution |
| Operator `NotActionable` without scope | No fake plans |
| Real-First / no fabricate in worker | Control-plane refuses to invent InternalRunner results |
| PRD ban on fabricated swarm metrics | Institutional prohibition |

### Fusion failures / residual risks

1. **Fixture terrain helpers** can be mistaken for fused inventory if called from product paths—keep call sites audited.
2. **Heuristic correlation volume** will dominate early tenants; UI must keep Measured minority highly visible or operators will treat the graph as truth rather than hypothesis workspace.
3. **Cross-source identity** is hostname/id-key driven; multi-cloud multi-tool identity fusion is still partial (as expected).
4. **Business-impact $ dimensions** in risk are often unpopulated—do not present as fused financial ontology.
5. **Scan-file / offline fusion** missing—limits air-gapped and MSSP import workflows.

### Verdict — fusion honesty

**Best-in-class for the category.** This is the dimension where Periscan should market and where FDEs should lead: **we know what we know, and we label the rest**.

---

## 6. Signal activity as event bus for the OS

`/signal-activity` is not a vanity stream. It evaluates CVE / asset-change / policy-change / missed-detection rules against **tenant-scoped** signals, integrations, scopes, control sources, runners, and audit events. Outputs:

- Rule catalog  
- Per-trigger evaluation (status, reason, recommended modules/mission type, matched signal IDs, evidence IDs)  
- Activity stream of non-queueing evaluations  
- Approval → policy decision + **Draft** mission + optional routing  

This is the correct shape of an **event-conditioned mission factory**: fuse → evaluate readiness → human gate → durable draft. Palantir analogue: ontology action triggered from alert object, never auto-write without policy.

**Gap:** activity appears derived from evaluation responses rather than a fully independent durable event store (confirm for long-horizon audit UX). Operators need immutable “why was this proposed at T0?” after signals age out.

---

## 7. Evidence packages as delivery objects

Evidence packs are durable objects (`EvidencePack` model): pack type, audience, redaction level, status, evidence ID set, storage, analyst notes, share tokens. Snapshot reports, control/AI/fix verification report types, HTML/PDF rebuild paths exist under snapshot services. Packs bind graph/report delivery to evidence IDs rather than free narrative.

**Strengths:** redaction and audience; capability gating (`EvidencePacks`); audit on finalize/share; sample/demo isolation as product rule.

**Gaps:** compliance pack types without control-mapping matrix remain **renderers, not attestations**—honest if labeled, dangerous if sold as certification OS. Proof-loop packs UI (`/packs`) should always terminate in pack + evidence IDs, never in decorative completion.

---

## 8. Coherence map (surfaces → ontology)

| Surface | Primary objects | Fusion honesty | Mission link | OS role |
|---|---|---|---|---|
| `/data-fabric` | Integration, Asset, AssetSourceObservation, OwnershipReview | Quality + lineage + ownership | Indirect (scope readiness) | Source trust plane |
| `/missions`, `/missions/[id]` | ValidationMission, ValidationRun, PolicyDecision | Evidence basis from runs | Core | Mission control |
| `/swarm` | ModelSession, Mission, Engagement, SignalTriggerActivity | Counts real status | View over missions | Radar (rename) |
| `/operators` | OperatorProfile (static), Recommendation (ephemeral), Mission | Evidence-required plans | Approve → mission | Specialist proposers |
| `/signal-activity` | SignalEnvelope, TriggerEvaluation, Draft Mission | Readiness statuses | Approve → draft | Event → mission factory |
| `/evidence` | EvidenceArtifact, chain reports | Hash/chain/redaction | Links to missions/paths/packs | Proof ledger |
| `/attack-paths` | AttackPath, edges, receipts | Claim language | Path → validation missions | Terrain of hypotheses + measures |
| `/reports`, packs | EvidencePack | Evidence-ID grounded | Snapshot / verification missions | Delivery objects |
| Integrations / runners | Integration, Runner, tasks | Connected vs not-configured | Execution environments | Sensor / actuator plane |

---

## 9. What a Palantir-style CTO would fund next

Ordered by ontology leverage, not feature fashion:

1. **Close the ontology**  
   - Enumerate `nodeType` (or versioned type registry).  
   - Persist `OperatorRecommendation` (and optionally `SignalTriggerEvaluation` snapshots) as objects with status history.  
   - Align nav: “Missions” for the queue; “Validation Snapshot” as a mission type / pack flow—not the reverse.

2. **Mission control home**  
   Multi-type mission workbench first-class (filters by status/type/scope/policy); radar becomes a widget of that home, not a separate “swarm product.”

3. **Object workspace**  
   One canvas: selected object (path, mission, asset, pack) + neighbors + evidence + available governed actions. Evidence ledger routes are a start; finish the map.

4. **Quarantine competitive stubs**  
   Living-map/terrain/swarm-KB fixtures and kill-chain template counts: dev-only or test-only modules; never product-visible numbers. Enforce with tests that customer API responses cannot contain `simulated:true` metrics without explicit simulation flags.

5. **Open the fabric for import**  
   `.nessus` / SARIF / CSV → same `SignalEnvelope` / observation types as live connectors. Fusion without open ingest stays “connector hub,” not fabric.

6. **Promote measured edges**  
   Keep funding hop receipts + runner probes over more heuristic patterns. Ontology value compounds when Measured fraction grows.

7. **Do not fund “swarm superiority” theater**  
   Fund operator durability, gateway tool audit quality, and signal→draft→start SLOs instead.

---

## 10. Risks for forward-deployed deployments

| Risk | Why it bites on-site | Mitigation |
|---|---|---|
| Label inflation (Swarm, living map) | Customers demo the metaphor; production has empty radar + heuristic paths | Rename; lead with Measured paths + packs |
| Heuristic-heavy graph | SOC treats hypotheses as confirmed | Default UI sort/filter by claim kind; training |
| Free-string node types | Custom modules invent incompatible types | Registry + lint |
| Ephemeral recommendations | “What did the operator propose last month?” unanswerable | Persist recommendations |
| Dual packages of truth in `evidence` | Engineers wire stub terrain into prod | Split package or `fixtures/` export only |
| Compliance pack overclaim | Legal/audit customers | Keep “does not assert certification” and finish control mapping before selling |
| Scope-gated world | Customers expect internet-wide ASM | Sell as authorized-scope validation OS (accurate) |

---

## 11. Final assessment

Periscan’s core is a **governed, evidence-linked mission OS for customer-authorized security validation**, with fusion and speech-act discipline that most CTEM vendors lack. That is the Palantir-relevant story:

- Ontology-ish object model for validation work  
- Mission control with policy as hard gate  
- Evidence graph as the system of record for *what was proven*  
- Operators and signals as proposal layers, not autonomous authority  
- Fabric quality that admits degradation  

It is **not** yet a general enterprise ontology platform, not a multi-agent swarm, and not a continuous living cyber terrain map. Those words appear in competitive completion artifacts and must be treated as **scaffolding debt**, not product identity.

**Ship posture under this persona:**  
Lead with **missions, measured paths, evidence packs, data fabric quality, and policy gates**. Rebrand swarm to mission radar. Persist operator proposals. Enumerate graph types. Import scan files. Starve the stub layer.

**One sentence for the board:**  
*Periscan is building the hard part of a security ontology—honest fusion and proof-linked missions—and must not spend that trust on swarm theater.*

---

## Appendix A — Primary code anchors

| Concern | Paths |
|---|---|
| Data fabric service | `apps/api/src/services/data-fabric.ts` |
| Data fabric UI | `apps/web/src/components/data-fabric-workbench.tsx`, `apps/web/app/data-fabric/page.tsx` |
| Domain ontology (schemas) | `packages/shared/src/domain.ts` |
| Claim language | `packages/shared/src/claim-language.ts` |
| Entity resolution | `packages/evidence/src/entity-resolution.ts` |
| Correlation / path drafts | `packages/evidence/src/correlation.ts` |
| Graph service + stubs | `packages/evidence/src/graph.ts` |
| Edge receipts / weakest basis | `packages/evidence/src/edge-receipts.ts` |
| Operators package | `packages/operators/src/index.ts` |
| Operators UI | `apps/web/src/components/operators-workbench.tsx` |
| Signal + operator services | `apps/api/src/services/signal-triggers.ts` |
| Signal activity UI | `apps/web/src/components/signal-activity-stream.tsx` |
| Swarm / autonomous ops UI | `apps/web/src/components/autonomous-operations.tsx`, `apps/web/app/swarm/page.tsx` |
| Mission detail | `apps/web/src/components/mission-detail.tsx` |
| Evidence ledger | `apps/web/src/components/evidence-ledger.tsx` |
| Evidence packs / snapshots | `apps/api/src/services/snapshots.ts`, Prisma `EvidencePack` |
| Nav contract | `apps/web/src/lib/app-navigation.ts` |
| Architecture / real-first | `docs/ARCHITECTURE.md`, `Agents.md`, `PRD.md` |
| Honest competitive scores | `docs/COMPETITIVE_COVERAGE_MATRIX.md` |

## Appendix B — Scoring notes

Scores are persona judgment from static code and docs review on 2026-07-29, not a live tenant walkthrough. Runtime empty states (no integrations, no signals) are expected and correctly handled by `NotConfigured` patterns; they do not reduce fusion honesty scores. They do reduce “mission OS fullness” until a tenant has multi-source evidence.

---

*End of panel audit — Palantir CTO.*
