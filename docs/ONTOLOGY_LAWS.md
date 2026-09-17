# Ontology Five Laws (P09-17)

Machine-checkable product laws for schema, API, and packaging reviews. Source of
truth for gates: `packages/shared/src/claim-deny-list.ts` (`ONTOLOGY_LAWS`) and
shared claim language (`packages/shared/src/claim-language.ts`,
`packages/shared/src/fix-verification.ts`).

These laws block feature-zoo ontology debt: parallel entities, overlapping state
enums, Fixed-without-verification, score theater, and mission-type sprawl.

---

## The Five Laws

| ID | Law | Acceptance gate |
|----|-----|-----------------|
| **L1** | No new top-level entity that restates **Asset / Signal / Path / Finding / Evidence** without a reduction rule. | PR checklist: new Prisma models or public DTOs that re-inventory spine concepts must document reduction to the spine or stay Labs-only. |
| **L2** | No new **state** enum that overlaps `ValidationState` without an explicit partition plan. | `FindingDisposition` must never include `Fixed`. Path certainty states (`Reachable` / `Validated` / `Exploitable`) are claim-gated via `projectPathValidationState`. |
| **L3** | **Fixed only via verification** (measured re-validation). | `assertRemediationFixedOnlyViaVerification`; ticket merge/close cannot mint Fixed; webhook `remediation.verified` is the automation signal. |
| **L4** | Every score cites a **composition law**; risk severity never upgrades evidence certainty. | `deriveAttackPathClaim` + risk summary builders; reports show Measured/Heuristic counts. |
| **L5** | **Pillars/tags are not mission types**; nav jobs map to spine work. | MissionType additions require proof-loop necessity; Autonomous/MCP/swarm stay Labs until the loop is boring. |

---

## PR checklist (copy into review)

- [ ] No new public entity that duplicates Asset/Signal/Path/Finding/Evidence without reduction docs.
- [ ] No new enum value that means “Fixed”, “Validated”, or “Measured” outside existing claim/verification writers.
- [ ] Finding disposition / risk band / ticket state cannot assert Fixed.
- [ ] Any new score or dashboard number cites how it composes (and what it does **not** prove).
- [ ] New primary-nav item is a job-of-work, not a pillar tag or theater surface.
- [ ] GTM copy checked against `CLAIM_LANGUAGE_CATALOG` refuse bucket (`listRefusedClaimPhrases()`).

---

## Related contracts

- Claim deny-list (prove / integrate / refuse): `packages/shared/src/claim-deny-list.ts`
- Composition maps (P09-3…P09-20): `packages/shared/src/ontology-laws.ts`
- Competitive positioning: `docs/competitive/POSITIONING.md`
- Product-help: `apps/web/src/lib/product-help.ts` (controls, engines, reports)
- Safety floor: `SECURITY_BOUNDARIES.md`

---

## Exposure / Path / Finding reduction (P09-19)

Operators ask: is the unit of work the exposure, the path, or the finding?

| Particle | Meaning | UI role |
|----------|---------|---------|
| **Exposure** | Asset-scoped condition (what is open on an asset) | Supporting particle; **not** a third primary triage queue |
| **Path** | Multi-node narrative (how conditions chain) | Hypothesis → measure hops → breaker |
| **Finding** | Prioritized work-queue projection | **Only** primary triage queue (fingerprint SoR) |

**Remediation SoR:** attach to **fingerprint** (cause). Optional `exposureId` /
`pathId` are navigation links, not competing identities.

**Gate:** do not add Exposure as a primary-nav peer of Findings. Contract:
`EXPOSURE_PATH_FINDING_REDUCTION` / `classifyLifecycleWorkUnit` in
`packages/shared/src/ontology-laws.ts`.

---

## Principal multiverse reduction (P09-18)

| Product model | Graph projection | Principal kind |
|---------------|------------------|----------------|
| `Identity` (human/service/role/group/key) | `Identity` | `human` \| `service` \| `key` |
| `NonHumanIdentity` | `Identity` | `service` \| `workload` \| `key` |

**Shared Principal inventory** is the single identity work surface
(`type: human | service | workload | key`). NHI risk score is a **factor input**
to path/finding priority **only when the principal is on a path**
(`principalRiskPriorityFactor` / `composeFindingPriorityScoreWithPrincipal`) —
never a competing dashboard triage number without composition.
