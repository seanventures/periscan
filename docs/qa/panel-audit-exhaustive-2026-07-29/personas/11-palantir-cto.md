# Panel P11 — Palantir CTO (ontology, mission control, fusion)

**Date:** 2026-07-29  
**Persona:** Palantir-style CTO — object ontology, mission control plane, multi-source fusion honesty, operational OS  
**Repo:** `/Volumes/DataSSD1/test/periscan`  
**Scope:** Data fabric, free-string node types, swarm theater, operators not persisted, mission rename, object workspace, living-map stubs, evidence graph OS, multi-source honesty, feature-zoo ontology tax  
**Method:** Code-first (shared contracts, Prisma, evidence graph, operators, web routes/nav, data-fabric service, swarm UI). Docs only; no product code changes.  
**Prior panel:** Agree with synthesis score **3.7/5** and U-03/U-16 (nav zoo / Autonomous rail). Dissent on scan-file claim: **library exists, product path does not** (see P11-6).

---

## Verdict

| Dimension | Score | 5.0 definition |
|-----------|------:|----------------|
| Ontology / type system | **2.8** | Closed node + link types; single registry; typed properties; one label per object |
| Mission control plane | **3.4** | Missions first-class in nav + list UI for all types; policy → mission → run → evidence default journey |
| Fusion / data fabric | **3.8** | Quality + ownership + lineage + open ingest into same Signal/Asset types |
| Evidence graph as OS | **3.5** | Durable graph + path claim language + operator-facing object explorer (not only path detail) |
| Swarm / agent ontology | **2.2** | Either real Agent objects with provenance, or radar renamed and demoted (no agent theater) |
| Multi-source honesty | **4.4** | Measured/Heuristic, resolution status, ownership confidence, no-fabricate — already near-best |
| **Overall (mission OS readiness)** | **3.4** | Governed validation OS for authorized scope; **not** enterprise ontology platform |

**5.0 on this lens:** One navigable ontology (object types, link types, actions); every operator-facing noun maps 1:1 to a persisted type; proposals are durable objects; graph is queryable as an OS; swarm marketing is gone unless Agent is real; fabric accepts BYO sources into the same types.

**Buy posture (Palantir FDE):** Fund the ontology + mission rename + quarantine stubs. Do **not** fund more Autonomous surface area.

---

## Top 5 moves to reach 5.0

1. **Close graph `nodeType`** (versioned enum/registry) and align write-path conventions (`Signal.*` / `Asset.*` / `Exposure.*` / bare names) — P11-1.  
2. **Rename and rewire `/missions`** as real Mission Control; mount multi-type list (or kill orphan workbench); stop labeling the object “Validation Snapshot” — P11-2, P11-3.  
3. **Persist OperatorRecommendation** (and status transitions) with audit lineage; stop ephemera “Approved” responses — P11-4.  
4. **Quarantine living-map / terrain / swarm-KB stubs** out of production `packages/evidence` export surface and customer UI — P11-5, P11-12.  
5. **Wire scan-file importers to a tenant API + UI** (or demote fabric marketing); build one **object workspace** (type → instance → links → evidence) — P11-6, P11-7.

---

## Feature-zoo / IA notes (ontology tax)

| Action | Item | Why |
|--------|------|-----|
| **Rename** | Nav “Validation Snapshot” → **Missions** (or “Validation missions”) | Object type is `ValidationMission`; snapshot is one `missionType` |
| **Rename** | “Agent Swarm” → **Mission radar** / **Live ops** (Labs) | No Agent object; blips are sessions/missions/engagements |
| **Demote** | Entire **Autonomous** nav group (swarm, workflows, MCP, model-gateway primary) behind Labs until proof loop is default | U-16; ontology theater tax |
| **Merge** | Threat center + threat feed + signal activity + validation-ops feed fragments | Multiple “ops consoles” without one object graph neighborhood |
| **Merge** | Dual nav configs (`primary-nav.tsx` vs `app-navigation.ts`) | Same href, different labels (“Data fabric” vs “Assets & Scope”; “Exposure” vs “Findings”) — dual ontology |
| **Cut / quarantine** | Living Map SVG + `queryForTerrain` / `computeLivingMapDelta` / `seedDiscoveryAssetsForASVEASM` | Fixture $$ impact + synthetic campaign IDs in production packages |
| **Promote** | Data fabric quality/ownership/lineage + evidence ledger integrity + measured path edges | True fusion OS; protect forever |
| **Do not ship as Agent** | Engagements / model sessions painted as “agents” on radar | Wrong type identity |

---

## What is already excellent (do not break)

1. **Policy on the write path** for missions — draft/approve/deny, denied-never-queued discipline.  
2. **Measured vs Heuristic** path/edge claim language (`PathEdgeSchema`, weakest-hop rule comments in shared domain).  
3. **Entity resolution that refuses false identity** (`AmbiguousCreated`, strong vs weak keys in `entity-resolution.ts`).  
4. **Data fabric quality state machine** (`Qualified | Degraded | Stale | PendingFirstSync | Disconnected`) with freshness budgets and empty-evidence degradation.  
5. **Ownership without invention** — confidence + human review dispositions; not auto-owned from weak signals.  
6. **Operators as propose-only specialists** — evidence IDs required, never self-executing; deterministic recommendation IDs.  
7. **Closed `EdgeRelationship` and large closed `RelatedEntityType`** for product objects (asymmetric vs free-string graph node types — links are better than nodes).  
8. **Correlation real-first guard** — hypothesis nodes must not mint placeholder assets (`correlation.ts` comments + schema).  
9. **Evidence artifacts with chain/hash verification surface** on ledger.  
10. **Prior anti-fabrication work** (random swarm metrics removed) — keep that discipline when renaming swarm.

---

## Findings

### FINDING | P11-1 | P0 | bug | evidence | Free-string GraphNode.nodeType is an open ontology with no registry
- **Persona:** Palantir CTO
- **Evidence:** `packages/shared/src/domain.ts` `GraphNodeSchema.nodeType: z.string().min(1)`; Prisma `GraphNode.nodeType String` (`packages/db/prisma/schema.prisma`); write paths invent dotted and bare strings ad hoc — e.g. `` `Signal.${signal.signalCategory}` ``, `` `Exposure.${...}` ``, `` `Asset.${node.asset.assetType}` ``, bare `"ValidationRun"` / `"EvidenceArtifact"` in `apps/api/src/runtime-services.ts` and `apps/worker/src/processor.ts`. Coverage test deliberately maps PRD names to open `` `PRD.${prdNodeName}` `` (`tests/modules/prd-evidence-graph-coverage.test.ts`). By contrast `EdgeRelationshipSchema` is a closed enum.
- **Problem:** Object *kinds* on the operational graph are convention-only. Interoperability, analytics, UI type filters, and FDE customizations cannot rely on a stable type catalog. Link types closed + node types open = half an ontology.
- **Impact:** Permanent interoperability tax; silent type drift across worker/API/tests; impossible honest “object explorer by type.”
- **Recommendation:** Introduce versioned `GraphNodeType` enum or registry (prefix + leaf), migrate writers, validate on upsert, document allowed properties per type. Keep PRD list as mapping table, not free string escape hatch.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme (Einstein free-string / prior Palantir free-string)

### FINDING | P11-2 | P0 | bug | nav | Mission object mislabeled “Validation Snapshot” on primary rail
- **Persona:** Palantir CTO
- **Evidence:** `apps/web/src/lib/primary-nav.tsx` and `app-navigation.ts` both label `href: "/missions"` as **“Validation Snapshot”**. Page metadata title is “Validation Snapshot” (`apps/web/app/missions/page.tsx`) while detail route metadata is “Validation mission” (`missions/[id]/page.tsx`). Shared type is `ValidationMission` with `missionType` enum including `ValidationSnapshot` as one of several types (`MissionTypeSchema` in `domain.ts`).
- **Problem:** Three meanings of the same word family: route object = all missions; nav label = snapshot product; type enum = one mission class. Ontology failure mode: same noun, three referents.
- **Impact:** Operators cannot form a stable mental model of the control plane; multi-type missions (fix, control, AI, exposure) feel second-class; FDE training cost every engagement.
- **Recommendation:** Nav + page title → **Missions**. Keep “Validation Snapshot” as a *workflow/template* under Missions (or a create path), not the object name.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

### FINDING | P11-3 | P0 | bug | proof-loop | MissionsWorkbench never mounted; /missions is snapshot-only
- **Persona:** Palantir CTO
- **Evidence:** `apps/web/app/missions/page.tsx` renders only `ValidationSnapshotFlow`. `MissionsWorkbench` exists (`apps/web/src/components/missions-workbench.tsx`) with multi-type create (Control/AI/Fix) and tests (`missions-workbench.test.tsx`) but **zero app route imports** (grep: only component + tests). Snapshot flow creates `missionType: "ValidationSnapshot"` and shows a truncated “Recent missions & runs” panel only.
- **Problem:** Mission control plane is half-implemented in UI: durable multi-type mission API/workbench exists as orphan; primary surface is a single workflow productized as the whole object.
- **Impact:** Swarm radar, operators, schedules, and signal triggers can create non-snapshot missions with no first-class list/ops home — control plane fragmentation.
- **Recommendation:** Mount multi-type mission queue at `/missions` (list + filters by type/status/policy); make snapshot a “New snapshot” action. Or delete/park orphan workbench to end dual truth.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03 / theme mission rename

### FINDING | P11-4 | P0 | bug | ai-agents | Operator recommendations are not persisted objects
- **Persona:** Palantir CTO
- **Evidence:** No `OperatorRecommendation` (or similar) model in `packages/db/prisma/schema.prisma`. Generation is pure function + content-hash id (`packages/operators/src/index.ts` `deterministicRecommendationId` / `generateOperatorRecommendations`). API re-generates on list; approve path finds by id in regenerated list then returns `{ ...recommendation, status: "Approved" }` **in the response only** (`apps/api/src/services/signal-triggers.ts`) — nothing durable stores Approved. `RelatedEntityType` has no OperatorRecommendation entry.
- **Problem:** Proposals are not ontology objects. No historical corpus, no audit of what was proposed vs approved over time, no join from mission back to proposal except side-effect mission create.
- **Impact:** Cannot answer “what did the system recommend last week?”; approve status is theater after page refresh; compliance/FDE lineage gap for force-multiplier layer.
- **Recommendation:** Persist recommendation rows (tenant, operatorType, status, evidenceIds, missionPlan, createdAt, decidedAt, missionId). List from DB; approve updates row + creates mission under same transaction/audit event.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme (prior Palantir operators)

### FINDING | P11-5 | P0 | bug | evidence | Living-map / terrain / swarm-KB stubs share production evidence package surface
- **Persona:** Palantir CTO
- **Evidence:** `packages/evidence/src/graph.ts` co-exports production `createPrismaEvidenceGraphService` with fixture helpers `seedDiscoveryAssetsForASVEASM`, `queryForTerrain`, `computeLivingMapDelta`, `queryContinuousInventory`. Dollar impact `riskScore * 1250`, synthetic `campaignId: living-delta-${Date.now()}`, coverage tag soup including both `"K8s"` and `"Kubernetes"` in shared `AssetCoverageTagSchema`, marketing strings in `swarmKbFacts` / delta summaries. Same themes in `packages/shared/src/domain.ts` comments and `LivingMapDeltaSchema`. `packages/evidence/src/risk.ts` ties financial multiplier to living-map helper.
- **Problem:** Stubs in the load-bearing evidence package are an ontology contamination vector — agents, tests, and future API authors will call the wrong layer.
- **Impact:** Risk of customer-visible or score-card-visible fabricated terrain/$$ claims; confuses “real graph” with “completion track fixtures.”
- **Recommendation:** Move fixtures to `packages/evidence/src/fixtures/` or test-only module; strip from public package index; ban import from apps/api runtime. Keep production graph service pure.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16 / anti-fabrication theme

### FINDING | P11-6 | P1 | feature | integrations | Scan-file importers exist as library only — not a fabric product path
- **Persona:** Palantir CTO
- **Evidence:** `packages/connectors/src/scan-importers.ts` (+ tests) parses Nessus/CSV/SARIF → `SignalEnvelope`-shaped findings; re-exported from connectors index. **No** `apps/api` or `apps/web` references to `importScan` / `parseNessus` / scan-import routes (grep empty under apps). Competitive matrix still says Partial / no scan-file product path; prior panel overstated “no importers” — truth is **code without product wiring**.
- **Problem:** “Unified data fabric” without customer BYO ingest is a connector hub. Library-only fusion is not operator-usable.
- **Impact:** Enterprise fusion RFP fail; FDE cannot drop customer scans into the same object types as Tenable/Wiz live connectors.
- **Recommendation:** Tenant-scoped import API (upload → normalize → observations/signals with source type `Import.nessus|csv|sarif`) + data-fabric UI action; integrity hash on raw file as evidence; never fabricate assets beyond resolution rules.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none (corrects prior panel “no importers”)

### FINDING | P11-7 | P1 | feature | other | No Object Explorer / object workspace — route-local ENTITY_ROUTE maps only
- **Persona:** Palantir CTO
- **Evidence:** No graph list/query public API in `apps/api` (attack paths listed; no `/graph/nodes` explorer). Evidence ledger and audit each maintain partial `ENTITY_ROUTE` maps (`evidence-ledger.tsx`, `audit-workbench.tsx`) — incomplete and divergent (e.g. audit maps `Scope` → `/missions`; evidence omits `ValidationRun` / `Asset` / `Finding`). Data fabric is the closest asset workspace but is not a general object type catalog. `RelatedEntityType` is large; UI deep-links cover a minority.
- **Problem:** Operators navigate product cages, not the ontology. Cross-object investigation requires memorizing which page owns which type.
- **Impact:** High FDE/training cost; broken “click any related entity” promise on evidence/audit; graph remains write-side OS only.
- **Recommendation:** Single shared `entityHref(type, id)` module covering all `RelatedEntityType` with real pages or a generic `/objects/:type/:id` workspace (summary, links, evidence, audit). Add read APIs for graph neighborhood by related entity.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-23

### FINDING | P11-8 | P1 | improvement | nav | Dual nav ontologies: same href, different type labels
- **Persona:** Palantir CTO
- **Evidence:** `primary-nav.tsx`: `/data-fabric` → **“Assets & Scope”**; `/findings` → **Findings**. `app-navigation.ts`: `/data-fabric` → **“Data fabric”**; `/findings` → **“Exposure”**. Primary comment admits dual config kept so legacy tests stay untouched. Page metadata for data-fabric still “Data fabric”; workbench eyebrow “Connect / Unified data fabric” while title is “Asset identity and source lineage.”
- **Problem:** Product object names disagree by chrome. Ontology requires one preferred label per type.
- **Impact:** IA thrash; search/help/docs drift; panel U-03 remains unfixed.
- **Recommendation:** One nav source of truth; freeze labels: **Missions**, **Findings**, **Assets** (fabric as subview or secondary title), **Evidence**. Delete or generate secondary config from primary.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P11-9 | P1 | bug | ai-agents | Swarm UI ontology falsehood: sessions/missions/engagements sold as agents
- **Persona:** Palantir CTO
- **Evidence:** `apps/web/src/components/autonomous-operations.tsx` — header “The swarm, on the scope”; copy “Every blip is a real agent at work”; metrics blend model sessions + running missions + engagements + signal triggers; radar `kind: "model" | "mission" | "engagement"` with no Agent type. Nav **“Agent Swarm”** (`primary-nav.tsx`, `app-navigation.ts`). Metrics count real statuses (good honesty of counts) under dishonest type labels.
- **Problem:** Metaphor overrides ontology. Palantir standard: do not call a Mission an Agent without Agent object, membership, plan graph, and shared memory.
- **Impact:** Buyer expects multi-agent platform; security reviewers expect agent trust model; product overclaims vs model-gateway + mission spine reality.
- **Recommendation:** Rename surface to **Live validation ops** / **Mission radar**; change copy to “live sessions and missions”; demote under Labs (U-16). If Agent is required later, introduce persisted AgentRun type with provenance — do not relabel existing types.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P11-10 | P1 | bug | design-system | Customer-visible Living Map SVG is static fixture theater
- **Persona:** Palantir CTO
- **Evidence:** `apps/web/src/components/threat-center-workbench.tsx` ~1717–1748: hardcoded SVG circles (`ext.web`, `sub.ct`, `cloud/k8s`, …), comments “Stub”, “fixtures for active”, “Real data: integrate evidence graph…”. Not bound to tenant graph nodes or assets. Coverage legend lists broad inventory domains as if present.
- **Problem:** UI presents a terrain map that is not a view of the evidence graph OS.
- **Impact:** Trust damage next to honest Measured/Heuristic language; score inflation risk if treated as EASM completeness.
- **Recommendation:** Remove from default threat-center or gate behind explicit “Sample visualization” banner with zero implication of tenant data. Replace later with real graph neighborhood viz fed by GraphNode/Asset queries.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** theme living-map stub

### FINDING | P11-11 | P1 | improvement | paths | PathNode.entityType closed enum vs GraphNode.nodeType free string — dual type systems
- **Persona:** Palantir CTO
- **Evidence:** `PathNodeSchema.entityType: RelatedEntityTypeSchema` (closed product types) vs `GraphNodeSchema.nodeType: z.string()` (open). Correlation drafts use `entityType: "Asset" | "Exposure"` while persistence projects `Asset.${assetType}` / `Exposure.${exposureType}` graph nodeTypes (`runtime-services.ts`).
- **Problem:** Path layer and graph layer speak different type dialects for the same world. Operators and APIs cannot join without ad hoc mapping.
- **Impact:** Fragile correlation→graph projection; analytics and UI type filters cannot share one catalog.
- **Recommendation:** Define mapping table GraphNodeType ↔ RelatedEntityType (and path entity); enforce on write; document in shared package as ontology module.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme (Einstein dual type)

### FINDING | P11-12 | P2 | bug | other | Coverage tag ontology duplicates (K8s vs Kubernetes) and free assetType on inventory
- **Persona:** Palantir CTO
- **Evidence:** `AssetCoverageTagSchema` includes both `"K8s"` and `"Kubernetes"` (`packages/shared/src/domain.ts`). `AssetInventoryEntry.assetType` is free string while production `Asset` types elsewhere use tighter enums. Fixture seed stamps all tags on every asset (`seedDiscoveryAssetsForASVEASM`).
- **Problem:** Tag soup is not an ontology; dual tags guarantee undercount/overcount filters.
- **Impact:** Terrain/query helpers and any future living map will mis-filter; docs claim “verbatim EASM+…” coverage without typed honesty.
- **Recommendation:** Collapse aliases; bind inventory tags to real asset classification enums; never assign full tag set on fixture rows used outside tests.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P11-13 | P1 | improvement | evidence | Evidence graph is a write-side OS without operator read plane
- **Persona:** Palantir CTO
- **Evidence:** Worker/API upsert graph nodes/edges on runs/signals/correlation (`processor.ts`, `runtime-services.ts`); product UI surfaces attack-path detail and evidence ledger, not general graph browse. No OpenAPI operations for graph node list/neighborhood found beside attack-path listing.
- **Problem:** The best institutional model (typed edges, evidence IDs, related entities) is invisible as an OS. Operators only see derived cages (paths, findings).
- **Impact:** Cannot “work the graph” like Foundry object explorer; FDE debugging of fusion requires DB or tests.
- **Recommendation:** Slice 7-aligned **Evidence / Graph explorer**: pick asset or finding → neighborhood (nodes/edges) → evidence artifacts → claim language. Read APIs first; viz second.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme Slice 7

### FINDING | P11-14 | P2 | improvement | api | Graph and path properties are LooseObject bags — untyped ontology properties
- **Persona:** Palantir CTO
- **Evidence:** `GraphNodeSchema.properties` / `GraphEdgeSchema.properties` use `LooseObjectSchema` (`z.record(string, unknown)`). Critical semantics (e.g. `evidenceBasis`, `measurementMethod`) are scraped via ad hoc property readers in `packages/evidence/src/graph.ts` (`edgeEvidenceBasis`, `edgeMeasurementMethod`) rather than first-class columns on all edges (path edges have first-class `evidenceBasis`; graph edges rely on properties JSON).
- **Problem:** Foundry-grade ontologies type properties per object/link type. Loose bags allow silent schema drift and bypass shared validation.
- **Impact:** Harder multi-tenant analytics; easier to forget claim language on some write paths.
- **Recommendation:** Promote hop certainty fields to first-class on GraphEdge (mirror PathEdge); introduce per-nodeType property schemas (zod discriminated unions) validated on upsert.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P11-15 | P2 | improvement | ai-agents | Approve recommendation returns Approved without durable status — API honesty gap
- **Persona:** Palantir CTO
- **Evidence:** `approveOperatorRecommendation` response mutates `status: "Approved"` in memory (`signal-triggers.ts`); subsequent `listOperatorRecommendations` regenerates from context → typically `Proposed` again unless generation logic encodes approval (it does not persist). Operators workbench refetches list after approve (`operators-workbench.tsx`).
- **Problem:** Response schema allows `Approved` as if stateful; product cannot show historical approvals.
- **Impact:** UI flicker / re-propose loops; auditors cannot trust recommendation status field.
- **Recommendation:** Same as P11-4 persistence; until then, do not return Approved status without DB — return mission + decision only, or mark NotActionable after mission create via side table.
- **Effort:** S (with P11-4 M)
- **Zoo-related:** no
- **Previous-panel-link:** theme operators

### FINDING | P11-16 | P1 | improvement | onboarding | Data fabric is high-quality fusion UX but buried / mis-scoped vs “Assets & Scope”
- **Persona:** Palantir CTO
- **Evidence:** Real services `apps/api/src/services/data-fabric.ts` (quality, ownership, lineage, review). Workbench honest about resolution and ownership. Primary nav relabels to Assets & Scope (`primary-nav.tsx`) but route remains `/data-fabric` and does not own Scope verification (scope lives in snapshot flow / policies). CORE gap audits already noted fabric hidden.
- **Problem:** Fabric is neither full Assets home nor full Scope home — excellent fusion desk with wrong product packaging.
- **Impact:** Operators miss the best multi-source honesty surface; “Assets & Scope” promise overshoots implementation (no full scope editor here).
- **Recommendation:** Either (a) true Assets workspace: inventory + fabric tabs + link to scope verification, or (b) keep Data fabric name and demote until Slice 6 Assets & Scope is real. Do not dual-name.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-09 / Slice 6 theme

### FINDING | P11-17 | P2 | request | copy | Autonomous nav group is feature-zoo ontology tax before proof loop is inevitable
- **Persona:** Palantir CTO
- **Evidence:** `PRIMARY_NAV` group **Autonomous** lists Agent Swarm, Agent Workflows, Operators, Engagements, MCP, plus adjacent Model Gateway under ecosystem (`primary-nav.tsx`). Operators are real recommenders; others are advanced/cognition surfaces. Synthesis U-16 already flags this.
- **Problem:** Primary rail teaches the wrong ontology: agents first, missions misnamed, proof loop secondary.
- **Impact:** Design-partner sessions optimize for theater; mission OS story is diluted (Jobs/Horowitz/Palantir consensus).
- **Recommendation:** Primary rail ≤ ~10: Dashboard · Missions · Paths · Findings · Remediation · Schedules · Runners · Integrations · Reports · Evidence (+ Admin). Move Autonomous → Labs. Keep Operators under Investigate or Remediate once persisted.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P11-18 | P2 | innovation | evidence | Ship “Ontology module” in shared: type registry + action map + claim rules as first-class product IP
- **Persona:** Palantir CTO
- **Evidence:** Today contracts are strong but scattered (`domain.ts` enums, evidence graph free strings, dual ENTITY_ROUTE, operator profiles, mission types, path claim rules). PRD graph coverage tests encode node names as documentation, not runtime registry.
- **Problem:** Ontology is emergent, not a governed artifact FDEs can extend safely.
- **Impact:** Every new surface re-invents labels and links; zoo growth is the default.
- **Recommendation:** New `packages/shared/src/ontology.ts` (or package): object types, link types, allowed actions (create mission, approve, verify fix), claim predicates (when Measured is legal), UI hrefs. Generate OpenAPI tags and nav from it. This is the Palantir-shaped moat aligned with Periscan honesty — not Foundry clone UI.
- **Effort:** XL
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P11-19 | P2 | improvement | security | Multi-source honesty excellence must not be diluted by fixture terrain $$ in risk helpers
- **Persona:** Palantir CTO
- **Evidence:** Data fabric quality/ownership and entity resolution are strong (P11 excellent list). Parallel path: `computeLivingMapDelta` / risk multiplier 1250 in `graph.ts` / `risk.ts` models dollar impact from fixture crown-jewel flags. Competitive anti-fabrication narrative depends on keeping synthetic $$ out of customer-facing risk.
- **Problem:** Two epistemic systems coexist: honest fusion vs completion-track financial theater.
- **Impact:** If any UI or scorecard consumes living-map delta risk$$, multi-source honesty brand collapses.
- **Recommendation:** Policy: customer-visible financial impact only from persisted valuation versions / explicit customer-entered criticality — never from living-map stubs. Lint ban on importing terrain helpers from apps/*.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** theme multi-source honesty

### FINDING | P11-20 | P3 | bug | api | Audit ENTITY_ROUTE maps Scope → /missions (wrong object workspace)
- **Persona:** Palantir CTO
- **Evidence:** `apps/web/src/components/audit-workbench.tsx` `Scope: () => "/missions"`. Missions page is snapshot flow, not scope admin. Scope editing appears in snapshot flow / trust-safety / policies surfaces — not a dedicated scope object page.
- **Problem:** Related-entity deep link lies about object home.
- **Impact:** Audit investigation dead-ends; reinforces mission/snapshot/scope noun collapse.
- **Recommendation:** Point Scope to real scope management surface (or add `/scopes` object page); add tests that every RelatedEntityType with a route resolves to a page that loads that id.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

---

## Agreement / dissent with previous panel synthesis

| Theme | Stance |
|-------|--------|
| Overall ~3.7 mission OS | **Agree**, slightly lower (**3.4**) after confirming orphan MissionsWorkbench + free-string node types + swarm type falsehood |
| Kill swarm theater / U-16 | **Strong agree** — rename + demote |
| Free-string node types | **Agree P0** — still open |
| Operators not durable | **Agree P0** — confirmed no Prisma model; Approved not sticky |
| Mission rename | **Agree P0** — worse: list workbench unmounted |
| Living map stubs | **Agree** — both package + customer SVG |
| Scan-file importers absent | **Dissent nuance**: parsers exist; **product path** still absent (P11-6) |
| Protect measured claim language + policy spine | **Agree forever** |
| Feature zoo | **Agree** — Autonomous group is primary ontology tax |

---

## Scorecard snapshot (persona)

| Question | Answer |
|----------|--------|
| Is there a real ontology? | **Partial** — strong mission/evidence/path types; weak graph node types; dual UI labels |
| Is mission control real? | **Yes in API**; **partial in UI** (snapshot hijacks missions route) |
| Is swarm real? | **No as agents**; **yes as live ops radar over real work** |
| Is fusion honest? | **Yes** (fabric quality/ownership/resolution/claims) — protect |
| Ready as enterprise ontology OS? | **No** |
| Ready as governed validation mission OS (design partner)? | **Yes, with rename + demote Autonomous + quarantine stubs** |

---

## Bottom line

Periscan’s **epistemic core** (policy-gated missions, measured hops, resolution/ownership honesty, evidence chain) is Palantir-grade discipline in a security product. Its **semantic shell** (Agent Swarm, Living Map, free-string nodes, ephemeral operators, snapshot-as-mission, dual nav nouns) is the opposite of ontology engineering.

**Fund the type system and mission control UI. Starve the swarm brand and terrain stubs. Persist proposals. Open one object workspace.** Until then, score stays mid-3s — excellent fusion kernel, incomplete operational OS.
