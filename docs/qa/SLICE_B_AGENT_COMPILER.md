# Continuous loop Slice B — Hybrid Execution Compiler + Multi-Agent honesty

**Date:** 2026-08-01  
**Branch:** `overnight-loop`  
**Matrix rows:** #29 Multi-Agent Orchestration Engine, #30 Hybrid Execution Compiler, #33 Conversational Threat Builder  

## Goals shipped

| Goal | Delivery | Honesty |
|------|----------|---------|
| Hybrid Execution Compiler (#30) | `POST /api/v1/hybrid-compiler/compile` compiles a mission plan into **Ed25519-signed** `RunnerTaskEnvelope` payloads for **allowlisted passive measured modules only** (`RUNNER_MEASURED_MODULE_IDS`). Optional `queueTasks:true` persists Queued runner tasks. | `honesty.fullyE2EMeasuredSurface: false`; status **Partial**; not full hybrid AI/graph BAS. |
| Multi-agent (#29) | `POST /api/v1/hybrid-compiler/assemble-passive-multi-agent` builds **role-tagged** passive multi-step mission plans (dns/tls/http/canary) with policy preview. Live validation ops honesty panel deepens non-claim. | Explicit `multiAgentOffensiveSwarmSupported: false`; not BAS swarm / live APT/Atomic. |
| Conversational builder (#33) | `POST /api/v1/mission-drafts/conversational` + Model Gateway buttons produce a **typed `ConversationalMissionDraft`** (`executable: false`). | `mission_draft_not_executable_bas` — not executable BAS. |

## Real path (compile → signed task)

1. Operator intent or explicit `moduleIds` + verified scope + runner + target host.  
2. Filter: only runner-measured modules; reject offensive/unlisted; omit canary without marker fields.  
3. Policy decision + Draft (or Queued) `ValidationMission`.  
4. Per accepted step: build unsigned envelope → `signRunnerTaskEnvelope` → optional `RunnerTask` Queued.  
5. Response includes `compiledHash`, step envelopes with signatures, and non-Leading honesty block.

## APIs

- `POST /api/v1/hybrid-compiler/compile`  
- `POST /api/v1/hybrid-compiler/assemble-passive-multi-agent`  
- `POST /api/v1/mission-drafts/conversational`  

## Code map

| Area | Path |
|------|------|
| Shared contracts | `packages/shared/src/hybrid-execution-compiler.ts` |
| Service | `apps/api/src/services/hybrid-execution-compiler.ts` |
| Routes | `apps/api/src/app.ts` (`hybrid-compiler`, `mission-drafts`) |
| UI draft | `apps/web/src/components/model-gateway-workbench.tsx` |
| Multi-agent honesty | `apps/web/src/components/autonomous-operations.tsx` |
| Client | `apps/web/src/lib/periscan-api-client.ts` |

## Tests

- `packages/shared/src/hybrid-execution-compiler.test.ts`  
- `apps/api/src/services/hybrid-execution-compiler.test.ts`  
- `tests/acceptance/hybrid-compiler-flow.test.ts`  
- `apps/web/src/components/model-gateway-workbench.test.tsx` (mission draft)

## Forbidden (unchanged)

- Strong/Leading scorecard claims on 29/30/33 until measured Fully-E2E surface.  
- Live APT / Atomic / multi-agent offensive swarm theater.  
- Auto-start without policy; Fixed without verification.

## Scorecard delta recommendations (do **not** auto-raise to Strong/Leading)

| ID | Current | Suggested after Slice B | Rationale |
|---:|--------:|------------------------:|-----------|
| 29 | 2.0 Scaffold | **2.5–2.75 Partial** (e.g. P2 F3 U3 O2) | Real passive role assembly + honesty panel; still not measured multi-agent mission assembly E2E. |
| 30 | 2.5 Scaffold | **3.0–3.25 Partial** (e.g. P3 F3 U3 O3) | Real compile→signed payload path + acceptance; not Fully-E2E measured product surface end-to-end with runner poll results. |
| 33 | 2.0 Scaffold | **2.5–2.75 Partial** (e.g. P3 F2 U3 O2) | Typed mission draft object (not prefills-only); still not executable scenario generation to signed modules from NL alone. |

**Points delta estimate (if rescored conservatively at midpoints):**  
- 29: 2.0 → 2.625 ≈ +2.5 pts  
- 30: 2.5 → 3.125 ≈ +2.5 pts  
- 33: 2.0 → 2.625 ≈ +2.5 pts  
**≈ +7.5 points** on the 94-row sum (score +~0.4) — only after gate floors updated with test evidence; **never Strong/Leading**.

## Not claimed

- Full multi-agent orchestration engine / 10+ offensive swarm  
- Hybrid compiler Fully-E2E measured surface  
- Conversational builder → live BAS scenario execution  
- Atomic / Caldera / SharpHound / ransomware live
