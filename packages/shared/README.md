# Shared package

This package owns shared runtime schemas, enums, and inferred types used across the Periscan monorepo.

## Core exports

- API contract primitives such as the public route prefix and OpenAPI/health routes
- Domain enums for validation state, control verdicts, remediation status, safety levels, signal categories, and integration categories
- Zod schemas and TypeScript types for tenant, scope, integration, graph, validation, remediation, reporting, and audit entities

## Current entity coverage

- Tenant, User, Membership
- Scope, Integration, Asset, Identity, ControlSource, AIApplication
- Exposure, Scenario, ValidationMission, ValidationRun, SignalEnvelope
- EvidenceArtifact, PathNode, PathEdge, PathBreaker, AttackPath
- RemediationTask, VerificationEvent, EvidencePack, AuditEvent

## Rules

- Shared domain contracts live here before they are used in API handlers, workers, or UI code.
- App packages must import these schemas and types rather than duplicating shapes locally.

### ValidationState partitions (P09-1)

`ValidationStateSchema` is a transitional union of four question kinds. Canonical
helpers live in `src/domain.ts` (re-exported from package root):

| Partition | States constant | Predicate | Discoverability alias |
| --- | --- | --- | --- |
| path certainty | `PATH_VALIDATION_STATES` | `isPathValidationState` | `isValidationStatePathOnly` |
| control observation | `CONTROL_VALIDATION_STATES` | `isControlValidationState` | `isValidationStateControlOnly` |
| remediation lifecycle | `REMEDIATION_VALIDATION_STATES` | `isRemediationValidationState` | `isValidationStateRemediationOnly` |
| readiness gates | `READINESS_VALIDATION_STATES` | `isReadinessValidationState` | `isValidationStateReadinessOnly` |

Also: `VALIDATION_STATE_PARTITIONS` map + `classifyValidationState(state)`.
Do not invent local partition sets — import from `@periscan/shared`. Claim
language (`claim-language.ts`) uses `isPathValidationState` so path certainty
never upgrades from control/remediation/readiness tokens.

### Fixed multiverse (P09-12 / P09-3)

Remediation status `Fixed` may only be written after a measured verification
event proves Fixed. Use:

- `assertRemediationFixedOnlyViaVerification` at every writer that sets
  `RemediationTask.status` to Fixed
- `REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS` — only
  `verifyRemediation` and runner `submitRunnerTaskResult` may persist Fixed
- `resolveExternalTicketClosedRemediationStatus` when external ticket sync
  observes close (→ `ClosedWithoutEvidence`, never Fixed)
- `FindingDispositionSchema` — analyst disposition deliberately cannot be Fixed

Architecture test in `src/fix-verification.test.ts` greps production sources
for free Fixed writers. See `src/fix-verification.ts` for the full law.

**RiskBand `"Fixed"` residual (presentation only):** the wire enum still
includes Fixed for charts/badges when `verificationStatus === "Fixed"`. It is
not a severity score band (`toBand` never returns Fixed) and must never write
remediation Fixed. Prefer `formatRiskBandDisplayLabel` → **"Closed (risk)"** in
UI and reports so operators do not conflate risk-band closure with remediation
status Fixed. Long-term: drop Fixed from `RiskBandSchema` in favor of a separate
`closureStatus` field.

### Path validationState claim safety (P09-2)

`AttackPath.validationState` must not overclaim Reachable / Validated /
Exploitable when hop measurement does not support the claim. Use:

- `projectPathValidationState` — explicit findings/API projection (recorded vs
  claim-safe + remap reason; never silent)
- `claimSafePathValidationState` / `claimSafePathValidationStateForWrite` —
  write clamps and risk factor derivation
- `deriveAttackPathClaim` — certainty language; never upgrades severity into
  measurement

Projection remaps overclaiming certainty states to `Discovered`. It never
upgrades Discovered/Inconclusive to Measured certainty without hop evidence.
See `src/claim-language.ts`.

### Ontology laws (P09-17 + composition)

Five Laws and composition maps live in `src/ontology-laws.ts` and
`docs/ONTOLOGY_LAWS.md`:

- Finding identity (P09-3): `resolveFindingCauseId` prefers fingerprint
- Occurrence completeness (P09-4): `isOperationalFindingIdentityComplete`
- Scope↔Asset binding contract (P09-5): `ScopeAssetBindingSchema`
- Inventory reduction (P09-6): `normalizeAssetCoverageTags`
- Threat subsumption (P09-7): `THREAT_SUBSUMPTION_ORDER`
- Risk composition (P09-9): `composeFindingPriorityScore`
- Taxonomy / clocks (P09-10/11): `deriveFindingSourceMotion`, CTEM↔ProofLoop maps
- Principal multiverse (P09-18): `principalKindFrom*`, `composeFindingPriorityScoreWithPrincipal`
- Exposure/Path/Finding reduction (P09-19): `EXPOSURE_PATH_FINDING_REDUCTION`
- Honesty trust metrics (P12-17): `buildHonestyTrustMetrics` in `honesty-trust-metrics.ts`
- External integration tiers (P12-14): `resolveExternalIntegrationTier`, top-10 cert board

Control language reduction (P09-8) lives in `src/control-effectiveness.ts`
(`mapEdgeRelationshipToControlEffectiveness`).

### Runner packaging honesty (P10-3 / P10-4)

- `RUNNER_DEPLOYMENT_MODE_PRODUCT_STATUS.WindowsService === "Planned"`
- `RUN_MODE_PRODUCT_STATUS.ServiceViaProxy === "NotAvailable"`
