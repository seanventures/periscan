# Panel P09 — Einstein (first principles, ontology elegance)

**Date:** 2026-07-29  
**Persona:** Einstein — first principles, coordinate economy, unifying laws  
**Mode:** Docs-only audit (no product code changes)  
**Repo:** `/Volumes/DataSSD1/test/periscan`  
**Contract:** `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md`  
**Previous panel:** `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md`  
**Prior Einstein note (non-exhaustive):** `docs/qa/panel-audit-2026-07-29/09-einstein.md`

---

## 1. Verdict (lens score)

| Lens | Score | 5.0 definition |
|------|-------|----------------|
| **Ontology elegance / information-model coherence** | **2.8 / 5** | Every product-visible noun answers exactly one physical question; every state machine is partitioned by *kind of question*; every number has one composition law; new features strengthen one of five laws without inventing a parallel coordinate system. |

**One-line verdict:** The proof-loop spine is elegant physics trapped in a Swiss-army enum and a feature-zoo coordinate multiverse.

**Agree with previous panel (Einstein B−/C, Palantir 3.7, Jobs zoo, Horowitz freeze surface):** Yes — ontology debt and surface zoo are the same disease at two layers. This report deepens the *model* half with actionable partition work, not more features.

---

## 2. Five laws → 5.0 coherence

From code (`claim-language.ts`, `edge-receipts.ts`, disposition rules, `resolveScopeSafetyEnvelope`) the product already discovered the right independent principles. 5.0 means these are **non-negotiable schema/API acceptance criteria**, not blog principles:

| Law | Statement | Where honored today | Where violated |
|-----|-----------|---------------------|----------------|
| **L1 Authorization** | No validation without verified Scope | Policy + scope verification | Asset inventory not bound to authorized set |
| **L2 Grounding** | No conclusion without `evidenceIds` or explicit Missing/NotConfigured | Edge receipts, claim language | Living-map $$ fixtures; some ValidationState prerequisites as if measured |
| **L3 Weakest link** | Path claim = min(edge measurement) | `deriveAttackPathClaim`, `weakestEvidenceBasis` | Path `validationState` can overclaim until projection remaps |
| **L4 Closure** | Fixed only via VerificationEvent | FindingDisposition cannot Fixed | Fixed lives in ValidationState, RiskBand, FindingStatus, RemediationStatus with different truth |
| **L5 Language** | Severity = priority; claim = certainty; never conflate | Claim-aware risk summaries | ValidationState over-union; RiskBand includes Fixed; exploitability dual enums |

**Path to 5.0:** retire redundant coordinates until every new table/enum must answer *which law does this strengthen?* Reject top-level entities that restate Asset, Signal, Path, Finding, or Evidence under a new brand.

---

## 3. Elegant core (do not break)

Protect these as sacred physics:

1. **Claim language** — `packages/shared/src/claim-language.ts` (`deriveAttackPathClaim`, `buildAttackPathRiskSummary`): certainty never upgraded by severity/impact.
2. **PathEdgeReceipt + hopKey** — `packages/evidence/src/edge-receipts.ts`: measurement as immutable hop physics.
3. **EvidenceArtifact + evidenceIds** — content-addressed ground truth; raw scanner out of primary UX.
4. **FindingDisposition cannot Fixed** — `FindingDispositionSchema` comments + transition rules; business judgment ≠ verification.
5. **Scope safety envelope** — `resolveScopeSafetyEnvelope` / OT hard-limit to PassiveReadOnly.
6. **Terrain graph vs path instance split** — GraphNode/Edge vs AttackPath + PathEdgeReceipt (space vs world-line).
7. **ValidatedFinding as projection** (when treated as a *view*) — `buildValidatedFindings` + disposition overlay table.
8. **ControlEffectivenessState** module intent — `packages/shared/src/control-effectiveness.ts` documents one denominator (Slice 5); keep that direction.

---

## 4. Findings (machine-parseable)

### FINDING | P09-1 | P0 | improvement | findings | ValidationState is a theory-of-everything enum
- **Persona:** Einstein
- **Evidence:** `packages/shared/src/domain.ts` `ValidationStateSchema` (25 values: Discovered…RequiresInternalRunner); mirrored in `packages/db/prisma/schema.prisma` `enum ValidationState`. Parallel specialized enums: `ControlStateSchema`, `RemediationStatusSchema`, `VerificationOutcomeSchema`, `ExploitabilityStateSchema`, `ValidatedFindingStatusSchema`, claim kinds in `claim-language.ts`.
- **Problem:** One enum collapses path certainty, control response, remediation outcome, and config readiness. Specialized enums re-partition the same meanings → dual accounting.
- **Impact:** Implementers map endlessly; claim language must *correct* path state when measurement is incomplete; operators cannot trust a single “state” badge without knowing *which question* it answers. Blocks L3/L5 coherence.
- **Recommendation:** Partition into four closed enums (do not drop values overnight — adapter maps): (1) **PathOutcome** Discovered|Reachable|Validated|Exploitable|Blocked|Inconclusive; (2) **ControlObservation** (align ControlEffectivenessState); (3) **RemediationLifecycle**; (4) **ReadinessPrerequisite** NeedsApproval|RequiresIntegration|RequiresVerifiedScope|… . Deprecate ValidationState on AttackPath in favor of PathOutcome + EvidenceBasis; keep a transitional union DTO for one release if needed.
- **Effort:** XL
- **Zoo-related:** yes
- **Previous-panel-link:** theme (Einstein B−/C ontology); U-02 vocabulary collapse is the UX twin

### FINDING | P09-2 | P0 | bug | findings | Path validationState can overclaim; projection silently remaps
- **Persona:** Einstein
- **Evidence:** `apps/api/src/runtime-services.ts` `buildValidatedFindings` (~7915–7933): if path is `Exploitable`/`Validated`/`Reachable` but claim flags fail, finding `validationState` becomes `Discovered`. Path row itself may still store the stronger state.
- **Problem:** Two truth values for the same path — stored workflow state vs claim-corrected projection. Excellent honesty *as a band-aid* proves ValidationState is not a closed theory (L3).
- **Impact:** APIs that read AttackPath.validationState without claim language overclaim; findings and paths disagree; reports must always call `deriveAttackPathClaim` or drift.
- **Recommendation:** Persist claim-safe path outcome (or recompute and refuse writes that set Exploitable without fullyMeasured). Make `deriveAttackPathClaim` the only writer of customer-visible certainty; store raw module hints separately if needed.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-06 correlation/Measured receipts; Slice 3

### FINDING | P09-3 | P1 | improvement | findings | Finding identity couples triage to graph UUID
- **Persona:** Einstein
- **Evidence:** `buildValidatedFindings` comment + assignment: `// Keep findingId = pathId so disposition overlays keyed by pathId still match.` / `findingId: path.pathId`. Fingerprint/groupKey exist (`computePathFindingMaterial`) and merge in `packages/evidence/src/finding-fingerprint.ts`, but disposition PK is `finding_dispositions.findingId` (string, not FK to a Finding table). Signal findings use `signalId`.
- **Problem:** ValidatedFinding is a projection without a first-class identity table; stable cause identity (fingerprint) is secondary to path UUID. Disposition, tickets, and history can orphan when paths re-correlate.
- **Impact:** Occurrences, root-cause collapse, and SLA ownership cannot be system-of-record on fingerprint alone; UI treating `/findings` as SoR conflicts with “finding is a view.”
- **Recommendation:** Document findings as **projection + disposition overlay**. Long-term: disposition keyed by `fingerprint` (with optional pathId/signalId links); short-term: stop equating findingId with pathId in new code paths; surface fingerprint as primary id in API docs.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-11 fingerprints/occurrence; Slice 4

### FINDING | P09-4 | P1 | bug | findings | occurrenceCount / merge semantics incomplete at emit time
- **Persona:** Einstein
- **Evidence:** Path and signal branches in `buildValidatedFindings` set `occurrenceCount: 1` before grouping; schema marks fingerprint/occurrence optional for legacy (`ValidatedFindingSchema` comments). Merge logic exists in `finding-fingerprint.ts` and tests (`runtime-services.test.ts`) but emitters default to single-observation.
- **Problem:** Optional identity fields + default 1 = two ontologies of “a finding” (raw projection row vs grouped operational finding).
- **Impact:** Operators and SOC personas (U-11) cannot rely on occurrence as first-class; dedup is post-hoc not structural.
- **Recommendation:** Make fingerprint + groupKey required on new emissions; run merge inside `listValidatedFindings` as the only public shape; never expose pre-merge rows without `occurrenceCount`.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P09-5 | P1 | improvement | other | Scope vs Asset: authorization and inventory lack a durable join
- **Persona:** Einstein
- **Evidence:** Prisma `Scope` (`scopes`) has verification lifecycle, assetClass, maxSafetyLevel — no Asset children. Prisma `Asset` has type/identifiers/criticality — no `scopeId`. Ownership is `AssetOwnershipReview` + projected surface (`getAssetOwnershipSurface` in `apps/api/src/services/data-fabric.ts`). AIApplication/Engagement bind to scope; inventory assets do not.
- **Problem:** L1 needs “authorized targets.” Inventory answers “what exists.” Without an authorized-asset set (or explicit Scope↔Asset binding), operators hold two mental models of “what we own.”
- **Impact:** Slice 6 “Assets & Scope home” cannot become one workspace; policy may authorize domains while graph assets float unbound.
- **Recommendation:** Add durable binding (table or JSON authorized keys on Scope) with lifecycle: discovered-in-scope | authorized | rejected. Ownership review remains judgment; binding is physics. Prefer one UI: Assets & Scope.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** Slice 6; practitioner “authorized targets home”

### FINDING | P09-6 | P1 | improvement | other | Inventory multiverse: Asset vs AssetInventoryEntry vs ScopeAssetClass vs tags
- **Persona:** Einstein
- **Evidence:** Prisma `Asset` + `AssetSourceObservation`; `AssetInventoryEntrySchema` / `CampaignMemoryEntry` / `TerrainQueryInput` / `LivingMapDelta` in `domain.ts`; `queryForTerrain` + `computeLivingMapDelta` in `packages/evidence/src/graph.ts` (fixture $$ = riskScore×1250); Track-B comments mid-schema; `AssetCoverageTagSchema` includes both **K8s** and **Kubernetes**; `ScopeAssetClassSchema` and `AssetTypeSchema` are separate taxonomies.
- **Problem:** Living-map inventory is a second product narrative (CAASM/EASM terrain) not reduced to Asset+GraphNode queries. Synonym tags encode entropy.
- **Impact:** Feature zoo at the model layer: new “terrain” APIs instead of deepening Asset. Crown-jewel $$ is fixture physics that can be mistaken for FAIR valuation.
- **Recommendation:** Make living map a **query projection** over Asset + GraphNode + source observations. Collapse K8s→Kubernetes (or inverse). Deprecate AssetInventoryEntry as a persisted concept; keep only as DTO of a query. Label any $$ multiplier as fixture/demo unless tied to AssetValuationVersion.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-16 Labs/swarm demotion; Palantir “kill swarm theater”

### FINDING | P09-7 | P1 | improvement | other | Threat dual stack without subsumption law
- **Persona:** Einstein
- **Evidence:** Tenant workflow: `ThreatAdvisory` → Package / MissingSignal / ImpactAssessment / ValidationPlan / ReadinessReport (`schema.prisma` ~1952+). Global catalog: `ThreatIntelItem` + Provenance + `TenantThreatAlert` (~4259+; comments “unlike ThreatAdvisory”). Web client exposes both list APIs (`periscan-api-client.ts`).
- **Problem:** Two threat ontologies both produce “things that affect findings/paths” without a single rule: feed item → optional advisory workflow → missing signals → path priority.
- **Impact:** Fragmented Threat Center vs Threat Feed vs signal-activity (U-23); operators cannot answer “is this KEV in my readiness loop?”
- **Recommendation:** Document and implement subsumption: **ThreatIntelItem (global particle) → TenantThreatAlert (relevance) → ThreatAdvisory (curated workflow) → MissingSignal/ValidationPlan**. One nav object “Threats” with feed vs program tabs. Prefer linking advisory.externalId to intel.canonicalKey.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-23

### FINDING | P09-8 | P1 | improvement | engines | Control language quadruple (edges, ControlState, Verdict, Effectiveness)
- **Persona:** Einstein
- **Evidence:** `EdgeRelationshipSchema` DETECTED_BY/BLOCKED_BY/MISSED_BY; `ControlStateSchema` (Detected|Blocked|…|NeedsTuning); `ControlValidationVerdictSchema` (Prevented|Detected|TelemetryOnly|…); `ControlEffectivenessStateSchema` (NotTested…Missed) with documented maps in `control-effectiveness.ts`; `control-stimuli.ts` `verdictFromOutcome` / `validationStateForVerdict` maps observer outcomes → verdict → **ValidationState** again.
- **Problem:** Four languages for control outcomes; bridges inventable in multiple places. Slice 5 intent (one denominator) not yet the only particle.
- **Impact:** Control effectiveness dashboards, path edges, and stimuli can disagree; correlation must re-translate; competitive SCV story dilutes.
- **Recommendation:** **ControlEffectivenessState is the only product-visible control atom.** Map: verdict→effectiveness (existing doc); edge relationship→effectiveness (one pure function); retire ControlState from new APIs; ValidationState must not store control outcomes long-term (P09-1).
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** Slice 5; Blue team control plane

### FINDING | P09-9 | P1 | improvement | findings | Risk score multiverse without composition law
- **Persona:** Einstein
- **Evidence:** Path: `calculateRiskScore` (`packages/evidence/src/risk.ts`) with large contribution tables over ValidationState, ControlState, reachability, exploitability, remediation, verification, business impact. Finding: path findings use `pathAssessment.risk.score`; signal findings invent parallel factors (confidence×100 + severity uplift) in `buildValidatedFindings` (~8148–8171). NHI: local `riskScore`/`riskLevel` (`non-human-identities.ts`). Asset: FAIR-inspired `estimateFinancialExposure` + `AssetValuationVersion`. Living map: `computeCrownJewelRiskImpact` / `applyCrownJewelImpactToRiskInput` (fixture $1250 scale). RiskBand includes **Fixed**.
- **Problem:** Multiple “risk numbers” without a law: *finding priority is path risk adjusted by missing signals and disposition* (or equivalent). Signal and path formulas are different physics.
- **Impact:** Operators see several scores; executive dashboards can mix FAIR $, NHI, and path bands; Fixed as a band conflates L4 closure with L5 severity (toBand carefully avoids Fixed-from-zero — good — but Fixed remains a band).
- **Recommendation:** Publish composition law in shared package: `priorityScore = f(pathRisk | signalRiskBase, missingSignalImpact, disposition)`. One primary number per UX surface. Separate **money** (FAIR) from **priority** (0–100) from **certainty** (claim). Remove Fixed from RiskBand; use remediation/verification status for closure.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none (deepens Einstein prior §5.4)

### FINDING | P09-10 | P1 | improvement | other | Mission / Scenario / Pillar / sourceMotion quadruple taxonomy
- **Persona:** Einstein
- **Evidence:** `MissionTypeSchema` (ValidationSnapshot, ExposureValidation, … ContinuousValidation); `ScenarioTypeSchema` (Exposure/Control/AIApp/Fix/AttackPath); `ValidationPillarSchema` (ASV_EASM, APV, SCV, DRV, CSV, EXV) + PILLAR_LABELS; `ValidatedFindingSourceMotionSchema` (BAS, APT, EXV, AIApp, Cloud, Secrets, FixVerification). Path findings hardcode `sourceMotion: "APT"` in `buildValidatedFindings`.
- **Problem:** Four orthogonal-looking axes that actually restate “why did we run / how do we package.” Hardcoded APT collapses path diversity into one motion label.
- **Impact:** Program taxonomy (pillars) bleeds into operational typing; filters and reports overcount; competitive ASV matrix becomes third mission type system.
- **Recommendation:** **One operational type** for runs (MissionType or ScenarioType — pick one). Pillars = tags on packs/modules only. sourceMotion = derived tag for findings from module category, never hardcode APT for all paths. Map EXV pillar ↔ ExposureValidation explicitly in docs.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-02; Gartner/Forrester packaging vs execution

### FINDING | P09-11 | P1 | improvement | nav | ProofLoopStage vs CTEMStage vs marketing loop — three clocks
- **Persona:** Einstein
- **Evidence:** `ProofLoopStageSchema` (Connect…Repeat, 8 stages) used by `proof-loop-context.tsx` / workflow feedback; `CTEMStageSchema` (Scope…Verify, 6) used by `CTEMProgramSummarySchema` / executive overview; product synthesis hero sentence is a third vocabulary.
- **Problem:** Same causal proof loop in three coordinate systems (U-02). Model-level: stages are packaging, not new physics — but they appear as first-class enums driving UI state machines.
- **Impact:** Dashboard radar, nav, and help disagree; onboarding milestones add a fourth clock (activation milestones).
- **Recommendation:** One canonical stage enum (prefer product Proof Loop or CTEM — pick and map the other as alias). Store only aliases in UI copy tables, not dual schemas forever.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

### FINDING | P09-12 | P0 | improvement | remediation | “Fixed” multiverse — one word, many truth conditions
- **Persona:** Einstein
- **Evidence:** `Fixed` in ValidationState, RemediationStatus, VerificationOutcome, RiskBand, ValidatedFindingStatus; disposition comments forbid analyst Fixed; `calculateRiskScore` early-return on `verificationStatus === "Fixed"`; ExposureStatus also includes Fixed.
- **Problem:** L4 requires one truth condition: VerificationEvent (or verification outcome Fixed with evidence). Same token elsewhere is residual status, band, or aspiration.
- **Impact:** Highest honesty risk in the ontology; CISO/Gartner distrust if any surface says Fixed without retest.
- **Recommendation:** Reserve **Fixed** exclusively for verification-gated fields. Rename residual path/exposure states to `VerifiedClosed` / `StillOpen` language; RiskBand drops Fixed (P09-9); finding status Fixed only when linked verification exists (enforce in builder).
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** excellence theme “Fixed only after retest” — protect by closing loopholes

### FINDING | P09-13 | P2 | improvement | api | RelatedEntityType as universal type system (platform sprawl)
- **Persona:** Einstein
- **Evidence:** `RelatedEntityTypeSchema` / Prisma enum: TenantWebhook, ModelProvider, ModelSession, ModelToolRequest, ThirdPartyTool* (many), Engagement, ScenarioBundle, AssetValuationVersion, … alongside Asset/AttackPath/Evidence.
- **Problem:** Platform and marketplace entities enter the graph/evidence “related entity” coordinate system. Everything-can-be-a-node is not a type theory.
- **Impact:** Graph semantics dilute; audit links and risk entities share one enum → model explosion as features land.
- **Recommendation:** Split **RiskRelatedEntityType** (Asset, Identity, Exposure, Path, ControlSource, Scope, …) from **PlatformRelatedEntityType** (webhooks, model gateway, tool promotion). GraphNode.relatedEntityType only risk subset.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16 Autonomous/MCP on rail; Palantir ontology fund

### FINDING | P09-14 | P2 | improvement | other | GraphNode.nodeType free string vs PathNode.entityType enum
- **Persona:** Einstein
- **Evidence:** Prisma `GraphNode.nodeType String`; `relatedEntityType` optional enum. PathNode uses `RelatedEntityType`. Correlation may mark hypothesis nodes without minting Assets (correct Real-First).
- **Problem:** Two ways to be vague: free strings + huge enum. Hypothesis nodes look like assets in the graph without being inventory.
- **Impact:** Queries and UI group unreliably; entity resolution harder.
- **Recommendation:** Constrain nodeType to a small closed set (Asset, Identity, Control, Exposure, Hypothesis, EvidenceAnchor) orthogonal to relatedEntityType. Keep hypothesis flag first-class.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P09-15 | P2 | improvement | findings | Exploitability dual enums + control states mapped to exploitability
- **Persona:** Einstein
- **Evidence:** `ExploitabilityStateSchema` (Unknown|NotReachable|Reachable|Validated|Exploitable|Blocked|Inconclusive); `RiskExploitabilitySchema` (Unknown|NotExploitable|ProofObserved|Exploitable); `mapValidationStateToExploitability` maps Detected/Logged/Alerted → **Validated** exploitability.
- **Problem:** Control telemetry states become exploitability language; Risk* and Finding* exploitability are different particles.
- **Impact:** L5 violation — certainty/control/outcome mixed into “exploitability.”
- **Recommendation:** One exploitability enum for product. Control observations never map to Validated exploitability; only path measurement claims do. Risk input uses the same enum or a strict adapter.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P09-16 | P2 | improvement | api | Enum accretion without partition laws (~100+ z.enums in domain.ts)
- **Persona:** Einstein
- **Evidence:** `domain.ts` opens with TenantType, UserStatus, MembershipRole, ProductPersona, ProductOutcome, ProofLoopStage, … and continues through billing, model gateway, async ops, etc. Grep shows **≥149** `z.enum` constructions in this single file alone.
- **Problem:** Necessary platform enums mixed with risk ontology in one mega-module. Accretion without *partition by question kind* is how ValidationState happened.
- **Impact:** Cognitive load for every schema PR; accidental cross-use of status tokens (Fixed, Validated, Open).
- **Recommendation:** Split packages/modules: `domain/risk.ts`, `domain/execution.ts`, `domain/platform.ts`, `domain/billing.ts`. Add CONTRIBUTING rule: new status enums must declare which Law they serve and which existing enum they do **not** duplicate.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** theme feature zoo as model explosion

### FINDING | P09-17 | P1 | innovation | other | Codify Five Laws as schema/API acceptance gates
- **Persona:** Einstein
- **Evidence:** Principles scattered in PRD/architecture comments, claim-language module, disposition comments, Agents.md Real-First; **not** a machine-checkable gate. Previous Einstein §7 laws remain advisory.
- **Problem:** Without enforceable laws, Track-B comments mid-schema continue to grow parallel APIs (`queryForTerrain`, campaign memory).
- **Impact:** Ontology debt recurs every feature wave; panel keeps rediscovering the same spine.
- **Recommendation:** Add `docs/ONTOLOGY_LAWS.md` (or Agents.md section) with the five laws + PR checklist: (1) no new top-level entity restating Asset/Signal/Path/Finding/Evidence; (2) no new “state” enum overlapping ValidationState without partition plan; (3) Fixed only via verification; (4) every score cites composition law; (5) pillars/tags not new mission types. Optional: lint test that FindingDisposition schema never includes Fixed (already true — extend to RiskBand).
- **Effort:** S–M
- **Zoo-related:** yes
- **Previous-panel-link:** Wave A packaging freeze; Horowitz “freeze surface”

### FINDING | P09-18 | P2 | improvement | other | Identity multiverse — Identity vs NHI vs graph Identity with local risk atom
- **Persona:** Einstein
- **Evidence:** Prisma/domain `Identity`; `NonHumanIdentity` with own riskScore/riskLevel/flags; SignalCategory Identity; RelatedEntityType both Identity and NonHumanIdentity.
- **Problem:** NHI risk scoring is a parallel risk atom not composed into path risk (P09-9).
- **Impact:** Identity hygiene numbers never meet path priority; dual inventory for humans vs machines without a shared “principal” abstraction.
- **Recommendation:** Shared Principal inventory view (type: human|service|workload|key); NHI risk becomes a factor *input* to path/finding priority when the principal is on a path — not a competing dashboard number without composition.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P09-19 | P2 | feature | other | Exposure as third lifecycle peer of Path and Finding
- **Persona:** Einstein
- **Evidence:** Prisma `Exposure` with own status (Open/Accepted/Mitigated/Fixed/Archived) and validationState; RemediationTask can link path and/or exposure; findings project mainly from paths + signals.
- **Problem:** Exposure is a legitimate “condition on an asset” particle but its lifecycle rhymes with remediation/finding without a reduction rule.
- **Impact:** Operators ask: is the unit of work the exposure, the path, or the finding?
- **Recommendation:** Document reduction: **Exposure = asset-scoped condition; Path = multi-node narrative; Finding = prioritized work queue projection.** Remediations attach to fingerprint (cause), with optional exposureId/pathId. Avoid third triage queue UI.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03 nav destinations

### FINDING | P09-20 | P1 | improvement | nav | Feature zoo is model explosion projected into IA
- **Persona:** Einstein
- **Evidence:** Previous synthesis U-03 (~35–50 destinations, dual nav `primary-nav` vs `app-navigation`); surfaces re-present spine: snapshots, validation-ops, external-validation, continuous validation, data-fabric, threat-center, threat-feed, signal-activity, control-effectiveness, campaigns/living map. Dual nav noted in `primary-nav.tsx` comments keeping legacy separate.
- **Problem:** Each feature wave added a workbench without collapsing to jobs of work. Model tags (pillar, motion, terrain) justified new routes.
- **Impact:** Same physics under many names; packaging fails ICP first session.
- **Recommendation:** Nav = **jobs** only: Authorize (Scope+Assets), Validate (Missions/Schedules/Runners), Understand (Paths+Findings+Controls), Act (Remediation), Prove (Evidence+Reports). Everything else Labs/Admin. Delete dual nav config. This is the IA projection of ontology unification — not a separate product problem.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03; Jobs; Horowitz; Wave A items 3–5

---

## 5. Top 5 moves to reach 5.0 (ontology)

1. **Partition ValidationState** (P09-1, P09-2, P09-12) — closed enums by question kind; claim language becomes writer of certainty, not corrective filter.
2. **Finding identity = fingerprint; disposition on cause** (P09-3, P09-4) — projection stays a view; operational SoR is stable.
3. **Scope↔Asset authorized binding** (P09-5) + kill living-map second inventory (P09-6) — one space for “what we own.”
4. **One risk composition law + Fixed reserved for verification** (P09-9, P09-12) — numbers and closure words become physics again.
5. **ControlEffectivenessState only + Threat subsumption** (P09-8, P09-7) + **Five Laws gate** (P09-17) — stop parallel control/threat coordinate systems; block new zoo at PR time.

---

## 6. Feature-zoo / IA notes (cut · merge · rename · demote)

| Action | Item | Rationale |
|--------|------|-----------|
| **Merge** | Threat Center + Threat Feed + Tenant alerts | One Threats object; feed vs program tabs (P09-7) |
| **Merge** | Assets + Scope + Ownership + Data fabric inventory | Authorized inventory home (P09-5/6) |
| **Merge** | Validation ops / Continuous validation / External validation workbenches | One Validate job with modes |
| **Merge** | ProofLoopStage + CTEMStage | One clock + aliases (P09-11) |
| **Rename** | Living map / Cyber terrain | “Inventory graph” or demote to Labs until = Asset query |
| **Demote** | Pillars as mission types | Tags on packs only (P09-10) |
| **Demote** | Model gateway / Swarm / MCP / Autonomous | Labs until loop inevitable (prior U-16) |
| **Cut** | Dual nav configs | Single PRIMARY_NAV (P09-20) |
| **Cut** | K8s synonym tag | Collapse coverage tags (P09-6) |
| **Cut** | AssetInventoryEntry as parallel schema | Projection only |
| **Keep first-class** | Scope, Evidence, Signal, Graph, AttackPath+Receipts, Remediation, VerificationEvent, Finding projection | Spine |

---

## 7. What is already excellent (do not break)

- Weakest-hop claim language and Measured-requires-evidence-ids discipline  
- Disposition cannot assert Fixed  
- Evidence chain integrity + redaction without rewriting history  
- Outbound signed runner + denied-never-queued policy plane (execution orthogonal to risk ontology — keep separation)  
- Entity resolution strong/weak identifier discipline  
- Correlation hypothesis nodes (avoid fake Assets)  
- Control-effectiveness module design *direction* (one denominator)  
- Real-First rule and connector Planned ≠ connectable honesty  
- API-first Zod contracts as single serialization theory  

---

## 8. Minimal unifying diagram (target ontology)

```text
        ┌──────────── Scope (authorization + safety) ────────────┐
        │              authorized Asset bindings                   │
        ▼                                                         ▼
   Integration / Runner ──► Module run ──► EvidenceArtifact
                                    │
                                    ▼
                            SignalEnvelope
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                 Asset          Control         Exposure
              (inventory)   (Effectiveness)   (condition)
                    │               │               │
                    └───────► GraphNode/Edge ◄──────┘
                                    │
                                    ▼
                              AttackPath + PathEdgeReceipt
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ValidatedFinding   RemediationTask   EvidencePack
           (fingerprint view)   (work + verify)    (export)
                                    │
                                    ▼
                            VerificationEvent ──► only Fixed
```

ThreatIntelItem feeds TenantThreatAlert → optional ThreatAdvisory workflow → MissingSignal adjusts finding priority — **not** a second finding system.

---

## 9. Scorecard vs previous panel

| Prior (panel-audit-2026-07-29) | This exhaustive pass |
|--------------------------------|----------------------|
| B− spine · C full ontology | **2.8/5** explicit on 5.0 definition |
| Narrative smells table | **20 findings** machine-parseable |
| Five laws proposed | Laws linked to **code violations + PR gate** (P09-17) |
| Agree synthesis | U-02, U-03, U-11, U-16, U-23, Slices 3–6 confirmed as ontology work, not only UI |

**Dissent / refinement:** Dual nav and feature zoo are not “just IA” — they are **symptoms of unpartitioned enums and parallel inventories**. Fixing nav without partitioning ValidationState and risk numbers will re-grow the zoo.

---

## 10. Closing

Nature is simple; the number of **independent principles** should be few. Periscan discovered five. The repository’s elegance is highest exactly where those principles are enforced in code. Everywhere else is coordinate clutter: one enum as Swiss army knife, Fixed as a free token, inventory/threat/control side-models that never reduce to the spine, and feature routes that rebrand the same world-line.

Unification is not a rewrite. It is **retiring redundant coordinates** so every new feature answers: *which law does this strengthen?*

**Panel recommendation:** Adopt the Top 5 moves; treat P09-1/2/12 as P0 model honesty work parallel to Slice 3 measured paths; freeze new RelatedEntityType and ValidationState values until partition lands.

---

*End of P09 Einstein exhaustive audit — 2026-07-29. Output only: this file.*
