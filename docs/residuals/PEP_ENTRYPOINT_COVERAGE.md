# PEP entrypoint coverage (Wave6)

**Companion to:** P03-20 / issue #107 (policy enforcement on execution paths).  
**Date:** 2026-07-29  
**Scope:** API and service-layer producers that can **queue, dispatch, or run** validation/runner/model-tool work.  
**Not in scope:** pure reads, auth, billing, report generation without module execution, fixture-only test helpers.

## Definitions

| Term | Meaning in this audit |
| --- | --- |
| **PEP** | Policy Enforcement Point: `evaluatePolicy` (`@periscan/policy`) and/or `evaluatePolicyDecisionGate` (API runtime) before execution is queued or performed. Model-gateway tools use a separate gateway PEP (`createGatewayToolRequest` / tool status). |
| **Dual-gate** | (1) stored decision gate via `evaluatePolicyDecisionGate`, then (2) live re-check of scope verification + `evaluatePolicy` so revoked scopes / tightened tenant flips cannot ride a stale Allowed outcome. |
| **Through PEP** | Denied or non-startable outcomes never queue jobs, create runner tasks, or dispatch external stimuli. |
| **Partial** | Policy is evaluated at create/preview, but execution re-entry lacks full dual-gate, or execution is only draft (no queue). |
| **N/A** | Not a validation/runner execution path (governance, inventory, read-only MCP, etc.). |

**Honesty residual (unchanged):** There is still **no** single unavoidable `executeValidationIntent` chokepoint or architecture lint that forbids direct `missionQueue` / `runnerTask.create` producers. Coverage is **per-entrypoint dual-gate or fresh `evaluatePolicy`**, not a universal interceptor. See `docs/residuals/P03-20-pep-interceptor-honesty.md`.

---

## Summary

| Category | Count | PEP status |
| --- | --- | --- |
| Mission create / start / queue | 3 | **Yes** (start = dual-gate) |
| Inline module execution helpers | 1 helper, 6 callers | **Yes** (fresh `evaluatePolicy`) |
| Schedules | 3 | **Yes** (run = dual-gate + live re-eval) |
| Runner task dispatch | 5 (+ third-party wrapper) | **Yes** (fresh `evaluatePolicy`) |
| Control stimuli | 2 | **Yes** (create via preview; dispatch dual-gate **fixed this wave**) |
| Attack-path / edge | 2 exec + 1 receipt | **Yes** / N/A receipt |
| Remediation verify | 2 | **Yes** |
| Signal / operator | 2 | **Yes** (draft mission; no auto-queue) |
| Model gateway tools | 2 | **Yes** (gateway PEP + action re-preview) |
| Engagements / scenarios | 2 | **Yes** (via `executeInlineValidation`) |
| Snapshots / posture | 3 | **Yes** (inline PEP; optional decision binding) |
| Agent trust TCK / A2A | 1 | **Yes** (`evaluatePolicy` authorize) |
| MCP | all tools | **N/A** (read-only by design) |
| Third-party install/enable | 2 | **N/A** (no module queue) |

**Hard bypass of PEP (queue/run without any policy):** **None found** on product API paths.

**Residual architecture gaps (not closed here):**

1. No single `executeValidationIntent` producer chokepoint / lint (P03-20).
2. Multiple independent dual-gate implementations (startMission, runSchedule, stimulus dispatch) — drift risk.
3. Model action tools that return `queued: true` after `createMission` only still do **not** call `startMission` (honesty; no ungoverned execution).

---

## Entrypoint matrix

### 1. Core mission / validation queue

| Entrypoint | Route / operationId | Service | PEP? | Mechanism | Notes |
| --- | --- | --- | --- | --- | --- |
| Preview policy | (service; used by many) | `previewPolicyDecision` | **Yes** | `evaluatePolicy` + persist + audit | Decision mint only |
| Create mission | `POST /api/v1/missions` · `createMission` | `validation.createMission` | **Yes** (binding) | Requires `policyDecisionId`; binding checks; does not queue | Draft only |
| Start mission | `POST /api/v1/missions/:id/start` · `startMission` | `validation.startMission` | **Yes** | Dual-gate: DecisionGate + live verified scope + live `evaluatePolicy` + DecisionGate; denied → no `enqueueValidationJob` | Canonical queue path |
| Approve / deny decision | `POST .../approvals/:id/{approve,deny}` | `approvePolicyDecision` / `denyPolicyDecision` | **Yes** | Mutates approval only; execution still requires start | — |

### 2. Inline execution (`executeInlineValidation`)

Shared helper: `apps/api/src/runtime-services.ts` → `evaluatePolicy` → deny if not `Allowed` → `executeModuleById`. Fresh decision every call.

| Entrypoint | Route / operationId | PEP? | Notes |
| --- | --- | --- | --- |
| `executeInlineValidation` helper | (internal) | **Yes** | Chokepoint for many inline callers |
| Run engagement | `POST /api/v1/engagements` · `runEngagement` | **Yes** | Per-step `executeInlineValidation` + module start constraints |
| Execute scenario | `POST /api/v1/scenarios/:id/execute` · `executeScenarioBundle` | **Yes** | Delegates to `runEngagement` |
| Scope posture checks | `POST .../scopes/:id/posture-checks` · `runScopePostureChecks` | **Yes** | Via inline helper |
| Due posture sweep | `runDuePostureChecks` (scheduler) | **Yes** | Via inline helper |
| Snapshot measured posture | inside `createSnapshot` | **Yes** | Via inline helper before pack write |
| AI app / control validate | control-ai service methods | **Yes** | Via inline helper |

### 3. Schedules

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Create schedule | `POST /api/v1/schedules` · `createSchedule` | **Yes** | `evaluatePolicy` per scope; may leave pending decisions |
| Run schedule now | `POST /api/v1/schedules/:id/run` · `runSchedule` | **Yes** | Dual-gate + live re-eval; non-snapshot enqueues job only when startable |
| Due schedules | `POST .../schedules/run-due` · `runDueSchedules` | **Yes** | Calls `runSchedule` |
| Light external scan | `POST /api/v1/light-external-scans` · `createLightExternalScan` | **Yes*** | Creates scope + schedule; schedule create PEP. *Uses `devModeManual` verify (dev-only). |

### 4. Internal runner tasks

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Reachability task | `createRunnerReachabilityTask` | **Yes** | Fresh `evaluatePolicy`; only `Allowed` creates `runnerTask` |
| Check task | `createRunnerCheckTask` | **Yes** | Same |
| Measured task | `createRunnerMeasuredTask` | **Yes** | Same |
| Discover task | `createRunnerDiscoverTask` | **Yes** | Same |
| Third-party runner dispatch | `POST .../third-party-tools/:id/runner-dispatch` · `dispatchThirdPartyToolRunnerTask` | **Yes** | Eligibility allowlist then one of the createRunner* paths |

### 5. Control stimuli (external canary)

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Create stimulus | `createValidationStimulus` | **Yes** | `previewPolicyDecision` + `createMission`; status Ready / RequiresApproval / Denied |
| Dispatch stimulus | `dispatchValidationStimulus` | **Yes** | DecisionGate + **live dual-gate** (scope + `evaluatePolicy` recheck) + external validation guard; then HTTP canary |

**Wave6 fix:** dispatch previously used only DecisionGate + external guard. It now re-checks verified scope and live `evaluatePolicy` before dispatch (aligned with `startMission`).

### 6. Attack path / edge measurement

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Request path verification | `POST .../attack-paths/:id/verify` | **Yes** (partial exec) | Preview + createMission; **does not queue** (`queued: false`, RequiresApproval) |
| Launch edge validation | `POST .../edges/:edgeId/validate` · `launchPathEdgeValidation` | **Yes** | Preview; Denied never missions; Allowed → `startMission` (dual-gate) |
| Apply edge receipt | `POST .../edges/:edgeId/receipts` | **N/A exec** | Measurement claim; requires linked run/mission; no module dispatch |

### 7. Remediation / fix verification

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Verify remediation | `POST .../remediations/:id/verify` · `verifyRemediation` | **Yes** | Per-module `evaluatePolicy`; any non-Allowed → throw; no queue |
| Due re-verifications | `runDueReverifications` | **Yes** | Calls `verifyRemediation` |

### 8. Signal triggers / operators

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Approve signal trigger | `approveSignalTrigger` | **Yes** | `evaluatePolicy` + draft mission; **no start/queue** |
| Approve operator recommendation | `approveOperatorRecommendation` | **Yes** | Preview + createMission; no auto-start |

### 9. Model gateway

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Create tool request | `createModelToolRequest` | **Yes** | Gateway PEP (`createGatewayToolRequest`) → Allowed / RequiresApproval / Denied |
| Execute tool request | `executeModelToolRequest` | **Yes** | Status must be Allowed/Approved; action tools re-`previewPolicyDecision`; denied → no mission start queue via startMission |
| Enqueue model turn | `enqueueModelSessionTurn` | **Yes*** | Session/tool loop uses gateway PEP on each tool request (*turn worker path) |
| Approve/deny/cancel tool | tool request APIs | **Yes** | Status transitions only |

### 10. Agent trust / workflows

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| A2A TCK / trust validations | `runA2ATck` et al. | **Yes** | `authorizeTrustValidation` → `evaluatePolicy` |
| Agent workflow run create/events | workflow APIs | **N/A / Partial** | Records policyDecisionIds for quality; does not queue validation jobs itself |

### 11. MCP

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| MCP tools | `mcpJsonRpc` / `listMcpTools` | **N/A** | Explicitly **read-only**; no start/dispatch/verify tools in registry |

### 12. Third-party tool governance (non-execution)

| Entrypoint | PEP for validation exec? | Notes |
| --- | --- | --- |
| `installThirdPartyTool` / `enableThirdPartyTool` | **N/A** | Governance/runtime install; missions still need mission PEP |
| Certification / handoff reports | **N/A** | Read-only; flags `policyGateRequired` on suggested next actions |

### 13. Snapshots

| Entrypoint | Route / operationId | PEP? | Mechanism |
| --- | --- | --- | --- |
| Create snapshot | `createSnapshot` | **Yes** | Optional bound decision: DecisionGate + verified scope; posture modules via inline PEP |
| Async recovery mission draft | async-operations | **Yes** (fail-closed) | Recovery mission `policyDecisionId = null`; cannot start without ordinary policy path |

---

## Dual-gate maturity

| Producer | DecisionGate | Live `evaluatePolicy` | Fresh mint only |
| --- | --- | --- | --- |
| `startMission` | Yes | Yes | — |
| `runSchedule` | Yes | Yes | — |
| `dispatchValidationStimulus` | Yes | Yes (Wave6) | — |
| `createSnapshot` (bound) | Yes | Scope re-verify only | — |
| `executeInlineValidation` / runner create* / verifyRemediation | — | — | Yes (fresh mint; deny if not Allowed) |
| `launchPathEdgeValidation` | via `startMission` | via `startMission` | preview mint |

---

## Gaps found this audit

| Gap | Severity | Action |
| --- | --- | --- |
| Stimulus dispatch lacked live dual-gate after DecisionGate | Medium | **Fixed** in `apps/api/src/services/control-stimuli.ts` |
| No universal `executeValidationIntent` interceptor | Architecture (XL) | Document only — P03-20 |
| Model action tools report `queued: true` without `startMission` | Honesty / residual | Document only; not an ungoverned execute path |
| Multiple dual-gate copies (drift risk) | Low | Document only |

---

## How to claim this honestly

**Do claim:** All known product API paths that queue validation jobs, create runner tasks, dispatch control canaries, or run inline modules evaluate policy (`evaluatePolicy` and/or DecisionGate) and fail closed on deny.

**Do not claim:** “Unavoidable PEP interceptor for every execution entrypoint” or “single chokepoint with architecture lint.”

---

## Primary code references

| Area | Path |
| --- | --- |
| Policy engine | `packages/policy/src/index.ts` (`evaluatePolicy`) |
| Decision gate | `apps/api/src/runtime-services.ts` (`evaluatePolicyDecisionGate`) |
| Mission start dual-gate | `apps/api/src/services/validation.ts` (`startMission`) |
| Inline PEP | `apps/api/src/runtime-services.ts` (`executeInlineValidation`) |
| Schedule dual-gate | `apps/api/src/services/schedules.ts` (`runSchedule`) |
| Runner tasks | `apps/api/src/services/runner.ts` |
| Stimulus dual-gate | `apps/api/src/services/control-stimuli.ts` |
| Gateway PEP | `packages/model-gateway/src/engine/policy-enforcement.ts` |
| P03-20 residual | `docs/residuals/P03-20-pep-interceptor-honesty.md` |
