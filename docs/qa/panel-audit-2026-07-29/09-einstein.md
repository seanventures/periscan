# Panel audit — Einstein: Information model coherence

**Date:** 2026-07-29  
**Persona:** Einstein (first principles, elegance, unifying theory)  
**Scope:** Domain schemas, Prisma persistence, evidence graph, claim language, architecture docs  
**Mode:** Read-only analysis; product code untouched  

**Primary sources:**

- `/Volumes/DataSSD1/test/periscan/packages/shared/src/domain.ts`
- `/Volumes/DataSSD1/test/periscan/packages/shared/src/claim-language.ts`
- `/Volumes/DataSSD1/test/periscan/packages/evidence/src/{graph,correlation,edge-receipts,entity-resolution,risk,remediation}.ts`
- `/Volumes/DataSSD1/test/periscan/packages/db/prisma/schema.prisma`
- `/Volumes/DataSSD1/test/periscan/apps/api/src/runtime-services.ts` (`buildValidatedFindings`)
- `/Volumes/DataSSD1/test/periscan/docs/ARCHITECTURE.md`
- `/Volumes/DataSSD1/test/periscan/docs/PERISCAN_FULL_PRODUCT_PRD.md` (§2 principles, data model intent)
- Agent tasks `02-schemas-and-data-model.md`, `06-evidence-graph-risk.md`

---

## 1. Verdict in one sentence

There **is** a coherent core theory — *authorized scope → measured signal → evidence-linked graph hop → claim-bounded path → remediation that only closes on re-measurement* — but it is **surrounded by parallel taxonomies and projection layers** that multiply surface area without multiplying explanatory power.

**Score (model coherence):** **B−** for the proof-loop spine; **C** for the whole repository ontology as lived by operators and implementers.

---

## 2. The elegant core (what unifies)

From first principles, Periscan’s product equation is small:

\[
\text{Proof} = f(\text{Scope authorization},\; \text{Measurement},\; \text{Evidence},\; \text{Weakest-link certainty})
\]

Architecture and PRD state this cleanly:

1. **Scope** is created and **verified** (authorization boundary).
2. Integrations / runners provide capability.
3. A **mission** receives a **policy decision**.
4. Worker/runner executes an approved **module**.
5. **Evidence** is stored (raw/redacted; not primary UX).
6. **Signals** and **graph** entries are normalized.
7. **Findings / paths / remediations / reports** are derived from evidence.

That is a single causal chain. Several implementations honor it with unusual honesty:

| Principle | Where it lives | Why it is elegant |
| --- | --- | --- |
| Weakest hop governs path certainty | `claim-language.ts` `deriveAttackPathClaim`; `edge-receipts.ts` `weakestEvidenceBasis` | Severity/impact **never upgrade** certainty |
| Measured requires evidence IDs | `edge-receipts.resolveDraftEdgeEvidenceBasis` | Prevents “Measured by assertion” |
| Fixed requires verification event | Remediation + finding disposition rules | Disposition cannot set Fixed |
| Evidence is the ground truth atom | `EvidenceArtifact` + `evidenceIds[]` on conclusions | Real-first rule is structural |
| Scope is safety envelope | `resolveScopeSafetyEnvelope`, OT hard-limit | Authorization and safety share one root |

If the product only kept **Scope, EvidenceArtifact, SignalEnvelope, Graph{Node,Edge}, AttackPath (+ PathEdgeReceipt), RemediationTask, VerificationEvent**, and a thin **ValidatedFinding projection**, the information model would be textbook: one spacetime (tenant graph), one measurement (receipts), one language of claims.

---

## 3. The intended “spine” entities

### 3.1 Authorization & inventory

| Concept | First-class store? | Role |
| --- | --- | --- |
| **Scope** | Yes (`scopes`) | Customer-authorized target + classification + safety max + verification lifecycle |
| **Asset** | Yes (`assets`) | Discovered / resolved inventory entity with identifiers |
| **AssetSourceObservation** | Yes | Multi-source resolution trail (CAASM-ish) |
| **Identity** | Yes | Human/service identity inventory |
| **NonHumanIdentity** | Yes | Separate secret-free NHI inventory |
| **AIApplication** | Yes | Scope-bound AI target inventory |
| **Integration / ControlSource** | Yes | Capability and control telemetry sources |

**First crack:** **Scope ≠ Asset**. That duality is *necessary* (authorization vs inventory) but **undermodeled as a join**. Ownership is computed (`AssetOwnershipEntry`) rather than a durable Scope↔Asset relation. Operators therefore hold two mental models of “what we own.”

### 3.2 Observation fabric

| Concept | First-class store? | Role |
| --- | --- | --- |
| **SignalEnvelope** | Yes (`signals`) | Normalized observation with category, confidence, related IDs |
| **EvidenceArtifact** | Yes | Content-addressed blob + chain hashes |
| **MissingSignal** | Yes | Explicit negative knowledge (Threat Center) |

Signals are the right intermediate particle: not raw scanner JSON, not yet a business conclusion.

### 3.3 Graph & paths (two layers, intentional)

| Layer | Models | Role |
| --- | --- | --- |
| **Terrain graph** | `GraphNode`, `GraphEdge` | Tenant-wide, key-unique nodes; relationships like `CAN_ACCESS`, `EXPOSES`, `MISSED_BY` |
| **Path instance** | `AttackPath`, `PathNode`, `PathEdge`, `PathBreaker`, `PathEdgeReceipt` | Ordered hypothesis or measured chain with per-hop basis and immutable receipts |

This split is **physically justified**: the global graph is a space; a path is a world-line through that space. Receipts on hops are the finest elegance in the system — path state recompute without upgrading unrelated edges.

### 3.4 Action & closure

| Concept | Store | Role |
| --- | --- | --- |
| **Exposure** | Yes | Asset-linked exposure with its own `validationState` + lifecycle status |
| **RemediationTask** | Yes | Work item on path and/or exposure; ticket sync fields |
| **VerificationEvent** | Yes | Only path to honest Fixed |
| **ValidatedFinding** | **No table** — projection | Unified triage queue over paths + signals + remediations |

Findings-as-projection is coherent *if* documented as a view. It becomes a competing model when UI and APIs treat `/findings` as the system of record while `findingId` is often equal to `pathId`.

### 3.5 Execution plane (orthogonal but clean)

Mission → Run → Job / RunnerTask → PolicyDecision → AuditEvent.  
This is workflow, not risk ontology. Keep it separate; do not let mission status bleed into exploitability language (mostly avoided).

---

## 4. Competing or parallel models (where unity breaks)

### 4.1 ValidationState as a “theory of everything” enum

`ValidationStateSchema` collapses **path certainty, control outcome, remediation outcome, readiness, and configuration prerequisites** into one 25-value enum:

- Path/measurement: `Discovered`, `Reachable`, `Validated`, `Exploitable`
- Control response: `Detected`, `Blocked`, `Logged`, `Alerted`, `Routed`, `Missed`, `NoEvidence`
- Remediation/verification: `Mitigated`, `Fixed`, `PartiallyFixed`, `StillExposed`, `Reopened`, `ClosedWithoutEvidence`
- Operational readiness: `NeedsApproval`, `NeedsInternalRunner`, `NotConfigured`, `RequiresIntegration`, `RequiresVerifiedScope`, `RequiresInternalRunner`
- Catch-alls: `Inconclusive`, …

Meanwhile the product already has **specialized** enums for subsets of the same meaning:

- `ControlState` / `ControlValidationVerdict`
- `RemediationStatus` / `VerificationOutcome`
- `ExploitabilityState`
- `ValidatedFindingStatus`
- `ObjectiveState`
- Claim kinds in `AttackPathClaimKind`

**Diagnosis:** One overloaded state machine + five specialized ones = **dual accounting**. Implementers must map between them; claim language must *correct* path `validationState` when measurement basis is incomplete (see `buildValidatedFindings` remapping Exploitable/Validated/Reachable down to `Discovered` when claim flags fail). That correction is excellent honesty — and proof the single enum is not a closed theory.

### 4.2 Finding is a view; disposition is a table

- **ValidatedFinding** is assembled in `buildValidatedFindings` from attack paths, signals, remediations, missing signals.
- **FindingDisposition** is persisted as an overlay (cannot set Fixed).

That is a sound pattern (derived fact + human judgment). The cost is **identity instability**: fingerprints/groupKeys exist to collapse re-correlated paths, but `findingId = pathId` couples triage identity to graph identity. Occurrence metadata is optional/legacy-tolerant — another seam.

### 4.3 Inventory multiverse

There are at least **four** inventory notions:

1. **Asset** (Prisma canonical row)
2. **AssetInventoryEntry** / living map / terrain helpers in `graph.ts` + domain comments (coverage tags EASM/CAASM/…)
3. **Scope** classification (`ScopeAssetClass`, Purdue, segment)
4. **RelatedEntityType** laundry list (40+ types that can hang off graph nodes / evidence)

Coverage tags include both `K8s` and `Kubernetes` — a small but emblematic entropy increase. Campaign memory / living map delta APIs sit beside (not inside) the durable Asset model. Track-B “Cyber Terrain” comments in `domain.ts` read like a second product narrative grafted onto the first.

### 4.4 Identity multiverse

- `Identity` (human/service inventory)
- `NonHumanIdentity` (hashed external IDs, risk score of its own)
- Signal categories for Identity
- Graph nodes with related entity type Identity / NonHumanIdentity

NHI risk scoring is **local** to that table rather than flowing through the path risk engine — a parallel risk atom.

### 4.5 Threat dual stack

- **Threat Center:** `ThreatAdvisory` → Package / MissingSignal / ImpactAssessment / ValidationPlan / ReadinessReport (tenant-scoped curation chain)
- **Threat Intel:** `ThreatIntelItem` + provenance + `TenantThreatAlert` (explicitly “unlike ThreatAdvisory” in schema comments)

Two threat ontologies, both legitimate if one is feed fabric and one is workflow — but both produce “things that might affect findings/paths” without a single subsumption rule.

### 4.6 Control dual stack

- Signal / path edges: `DETECTED_BY`, `BLOCKED_BY`, `MISSED_BY`
- Control validation: Stimulus → Verdict (`Prevented` / `Detected` / …)
- ControlState on snapshots
- Technique coverage snapshots with JSON items

Control effectiveness is real, but **verdict language is not the same particle as path edge language**. Correlation must invent bridges.

### 4.7 Status taxonomies that rhyme

| Lifecycle | Enum |
| --- | --- |
| Exposure | Open / Accepted / Mitigated / Fixed / Archived |
| Remediation | Open / InProgress / VerificationPending / Fixed / … |
| Finding status | New / Validated / Routed / InProgress / Fixed / … |
| Mission / Run / Job | Queued / Running / Completed / … |
| Integration | Created / Connected / … |

Rhyming is not unifying. “Fixed” appears in multiple places with different truth conditions (only VerificationEvent is honest for closure).

### 4.8 Module-local “Finding” shapes

GitleaksFinding, ProwlerFinding, NucleiFinding, SafeAIHarnessFinding — correctly **pre-normalization** tool DTOs. They must die at the SignalEnvelope boundary. Complexity is fine *if* adapters are strict; complexity explodes if any leak into UX (PRD forbids this; architecture agrees).

---

## 5. Where complexity explodes without necessity

### 5.1 Enum accretion without partition

**Necessary complexity:** distinguishing Measured vs Heuristic; authorization vs observation; open work vs verified fixed.

**Unnecessary complexity:** stuffing prerequisites (`RequiresIntegration`) into the same enum as exploitability (`Exploitable`), then inventing claim-language and exploitability enums to re-split them for honesty.

**Einstein cut:** Partition state spaces by *kind of question*:

1. **Authorization** — is the target in verified scope?
2. **Measurement basis** — Heuristic | PartiallyMeasured | FullyMeasured  
3. **Path outcome** — Discovered | Reachable | Validated | Exploitable | Blocked | Inconclusive  
4. **Control outcome** — (separate)  
5. **Remediation lifecycle** — (separate)  
6. **Config readiness** — (separate; never a path claim)

Claim language already implements (2)+(3). The schema has not retired the old over-union.

### 5.2 Surface inventory vs core loop

`SURFACE_INVENTORY.md` shows **~50 web routes**. Many map to genuine roles (MSSP, billing, model-gateway, confidential compute, engagements). Others re-present the same spine under new names (snapshots, validation-ops, external-validation, continuous validation, data-fabric, threat-center, threat-feed, signal-activity).

**Necessary:** one workbench per *job* (authorize, validate, triage, remediate, prove).  
**Unnecessary:** many workbenches per *feature wave* without collapsing to one ontology navigation.

ASV/CTEM “94-row” scoring and pillar enums (ASV_EASM, APV, SCV, DRV, CSV, EXV) add a **marketing/program taxonomy** on top of MissionType / ScenarioType / sourceMotion. Pillars are useful for packaging; they become noise when they become third mission typing.

### 5.3 Graph node type is free string; path entity type is enum

`GraphNode.nodeType: string` vs `PathNode.entityType: RelatedEntityType`.  
Free strings + enormous RelatedEntityType = two ways to be vague. Hypothesis nodes in correlation (`hypothesis: true`) correctly avoid minting fake Assets — good Real-First — but increase the number of “things that look like assets in the graph.”

### 5.4 Risk score multiplicity

- Path `calculateRiskScore` + band + claim-aware summary  
- Finding `priorityScore` + `riskFactors` + `priorityReason`  
- NHI `riskScore` / `riskLevel`  
- Asset FAIR-inspired valuation / annualized loss  
- Crown-jewel / campaign memory impact on living map  

All can coexist if each answers a different question (path priority vs financial planning vs identity hygiene). Without a **single composition law** (“finding priority *is* path risk adjusted by missing signals and disposition”), operators see several “risk numbers.”

### 5.5 Documentation and schema comments as second source of truth

`domain.ts` contains long Track-B / swarm / living-map commentary mid-schema. That is not runtime, but it trains implementers to grow **parallel APIs** (`queryForTerrain`, `computeLivingMapDelta`) instead of deepening Asset + GraphNode. The agent task for schemas correctly said: *no duplicate entity where an equivalent model already exists* — the living-map inventory entry is exactly that risk.

### 5.6 Prisma model count (~120+)

Tenant isolation, runners, model-gateway, marketplace, attestations, agent workflows, subscriptions — much of this is **platform**, not risk ontology. Platform bulk is acceptable. The explosion that hurts product thinking is when **platform entities appear in RelatedEntityType** and therefore in the “everything is a graph node” story.

---

## 6. What is already first-class elegant (preserve)

1. **Claim language** — customer-visible certainty decoupled from severity; path risk summaries that refuse overclaim.  
2. **PathEdgeReceipt + hopKey** — measurement as immutable physics; re-correlation does not erase receipts.  
3. **Evidence chain** (sha256 + optional chainHash) and redaction-without-rewriting-history.  
4. **Disposition cannot Fixed** — business judgment ≠ verification.  
5. **Entity resolution** with strong/weak identifier discipline (avoids collapsing siblings).  
6. **Correlation drafts** marking heuristic paths and hypothesis nodes explicitly.  
7. **API-first control plane** with Zod shared contracts — one serialization theory, even when the ontology is fat.

---

## 7. Minimal unifying theory (recommended mental model)

Draw one diagram for all product work:

```text
        ┌──────────── Scope (authorization + safety) ────────────┐
        │                                                         │
        ▼                                                         ▼
   Integration / Runner ──► Module run ──► EvidenceArtifact
                                    │
                                    ▼
                            SignalEnvelope
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
                 Asset          Control         Exposure
              (inventory)     (observation)   (condition)
                    │               │               │
                    └───────► GraphNode/Edge ◄──────┘
                                    │
                                    ▼
                              AttackPath
                         (ordered world-line)
                     PathEdgeReceipt (measurement)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ValidatedFinding   RemediationTask   EvidencePack
              (projection)      (work + verify)    (export)
                                    │
                                    ▼
                            VerificationEvent
                              (only Fixed)
```

**Law 1 — Authorization:** No validation without verified Scope.  
**Law 2 — Grounding:** No conclusion without `evidenceIds` (or explicit MissingSignal / NotConfigured).  
**Law 3 — Weakest link:** Path claim = min(edge measurement).  
**Law 4 — Closure:** Fixed ∈ {Remediation, Finding} only via VerificationEvent.  
**Law 5 — Language:** Severity ranks *priority*; claim language ranks *certainty*; never conflate.

Everything else is packaging (pillars, packs, MSSP), platform (billing, gateway), or adapter residue (tool findings).

---

## 8. Concrete model smells (actionable, not implemented here)

| Smell | Location | Unifying fix (conceptual) |
| --- | --- | --- |
| ValidationState over-union | `domain.ts` | Split into measurement / control / remediation / readiness enums; keep adapters |
| FindingId = PathId | `buildValidatedFindings` | Stable finding identity = fingerprint; path is source link |
| Scope–Asset soft join | ownership projection | Optional durable binding table or explicit “authorized asset set” |
| AssetInventoryEntry vs Asset | graph helpers | Make living map a **query over Asset + GraphNode**, not a second schema |
| Dual threat stacks | ThreatAdvisory vs ThreatIntelItem | Document subsumption: feed → advisory workflow |
| Dual control languages | edges vs verdicts | Map verdict → edge relationship in one function only |
| RelatedEntityType bloat | shared + Prisma | Graph-related subset vs audit-related subset |
| sourceMotion vs pillars vs missionType | multiple enums | One “motion” dimension for findings; pillars as tags only |
| K8s + Kubernetes tags | AssetCoverageTag | Collapse synonyms |
| Risk numbers | risk / priority / NHI / FAIR | Document composition; one primary number per UX surface |

---

## 9. Answer to the panel questions

### Is there a coherent information model?

**Yes, at the core.** Assets (inventory), scope (authorization), signals (normalized observations), paths (ordered graph instances with hop receipts), findings (prioritized projections), evidence (content-addressed ground truth), remediations (work + verification) form a **single proof loop** consistent with PRD §2.1 and `ARCHITECTURE.md`.

### Or multiple competing models?

**Yes, in the envelope.** Competing or parallel models include:

1. Over-unified **ValidationState** vs specialized outcome enums + claim language  
2. **Findings as SOS** vs findings as view over paths  
3. **Asset** vs **living-map inventory** vs **scope classification**  
4. **Threat Center** vs **Threat Intel**  
5. **Control path edges** vs **stimulus verdicts**  
6. **Program pillars / ASV matrix** vs mission/scenario/sourceMotion  
7. **Platform graph-related-entity sprawl** vs risk ontology  

### Where does complexity explode without necessity?

- Enum and status **accretion without partition**  
- **Feature-surface multiplication** of the same spine  
- **Second inventory / terrain schema** for competitive Track-B language  
- **Multiple risk scores** without a composition law  
- Treating **RelatedEntityType** as the universal type system  
- Documentation-driven **parallel narratives** (swarm, living map, 94-row matrix) that grow types faster than they grow explanatory power  

Complexity that *is* necessary: multi-tenant isolation, policy, hop-level measurement honesty, multi-source asset resolution, and safe execution modes. Do not simplify those.

---

## 10. Closing (Einstein)

Nature is simple; the number of **independent principles** should be few. Periscan already discovered the right principles — authorization, evidence, weakest-link measurement, verification-gated closure. The repository’s elegance is highest exactly where those principles are enforced in code (`claim-language`, `edge-receipts`, disposition rules).

The rest is **coordinate-system clutter**: many names for the same vectors, one enum used as a Swiss army knife, and inventory/threat/control side-models that never fully reduce to the spine. Unification is not a rewrite; it is **retiring redundant coordinates** so every new feature is forced to answer: *which law does this strengthen?*

**Panel recommendation:** Treat the five laws in §7 as non-negotiable acceptance criteria for schema PRs. Reject new top-level entities that restate Asset, Signal, Path, Finding, or Evidence under a new brand. Prefer projections and tags over new tables when the physics is unchanged.

---

*End of Einstein panel note — 2026-07-29.*
