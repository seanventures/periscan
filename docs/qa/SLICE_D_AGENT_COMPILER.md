# Continuous loop Slice D — Hybrid Compiler / Multi-Agent / Conversational deepen

**Date:** 2026-08-02  
**Branch:** `main` (tip after this slice)  
**Matrix rows:** #29 Multi-Agent Orchestration Engine, #30 Hybrid Execution Compiler, #33 Conversational Threat Builder  
**Builds on:** [SLICE_B_AGENT_COMPILER.md](./SLICE_B_AGENT_COMPILER.md)

## Goals shipped

| Goal | Delivery | Honesty |
|------|----------|---------|
| Hybrid compiler (#30) E2E passive path | Acceptance: `compile(queueTasks:true)` → runner **poll** → **accept** → artifact upload → **Ed25519-signed result** completes `periscan.dns_resolution_check`. Documented queue path below. | `honesty.fullyE2EMeasuredSurface: false`; status **Partial**; mock-runner/control-plane complete, not Strong product surface / live APT. |
| Multi-agent (#29) Draft missions | `assemble-passive-multi-agent` now persists a **Draft** `ValidationMission` (no tasks queued, no auto-start). Honesty: `draftMissionsOnly: true`. UI ops panel states Draft-only. | `multiAgentOffensiveSwarmSupported: false`; not BAS swarm. |
| Conversational (#33) → hybrid input | `POST /api/v1/mission-drafts/conversational/to-hybrid-compile-input` + shared `missionDraftToHybridCompileInput`. Returns compile input with `draftExecutable: false` / `basExecutableFromDraft: false`. Model Gateway UI convert button. | Draft remains non-executable BAS; conversion never enables live APT/Atomic. |

## Real path (compile → signed task → mock runner complete)

1. Operator provides verified scope + active runner + target host + allowlisted `moduleIds` (or intent).  
2. `POST /api/v1/hybrid-compiler/compile` with `queueTasks: true` → policy decision + mission (Queued) + per-step Ed25519-signed `RunnerTaskEnvelope` + `RunnerTask` rows.  
3. **Mock runner path (acceptance):**  
   - `POST /api/v1/runners/:id/poll` leases the task  
   - `POST …/tasks/:taskId/accept`  
   - `POST …/tasks/:taskId/artifacts` (NormalizedEvidence)  
   - `POST …/tasks/:taskId/result` with result-signing key → **Completed**  
4. Without a real runner binary, this is the control-plane + mock runner completion path. Live Go/agent runner poll against a lab host remains optional ops qualification — **do not score Fully-E2E / Strong**.

### Queue path document

| Mode | Behavior |
|------|----------|
| `queueTasks: false` (default) | Compile-only: signed envelopes returned; mission **Draft**; no `RunnerTask` rows. |
| `queueTasks: true` | Mission **Queued**; `RunnerTask` status Queued; runner poll/accept/result completes passive modules. |
| Multi-agent assemble | Always **Draft** mission; never queues tasks. Operator must explicitly hybrid-compile (and opt into queue) to dispatch. |
| Conversational draft | Never executable; convert → compile input (default `queueTasks: false`). |

## APIs

- `POST /api/v1/hybrid-compiler/compile`  
- `POST /api/v1/hybrid-compiler/assemble-passive-multi-agent` → `{ missionId, missionStatus: "Draft", honesty.draftMissionsOnly: true, … }`  
- `POST /api/v1/mission-drafts/conversational`  
- `POST /api/v1/mission-drafts/conversational/to-hybrid-compile-input` → `{ draftExecutable: false, compileInput, … }`  

## Code map

| Area | Path |
|------|------|
| Shared contracts + convert | `packages/shared/src/hybrid-execution-compiler.ts` |
| Service | `apps/api/src/services/hybrid-execution-compiler.ts` |
| Routes | `apps/api/src/app.ts` |
| UI draft + convert | `apps/web/src/components/model-gateway-workbench.tsx` |
| Multi-agent honesty | `apps/web/src/components/autonomous-operations.tsx` |
| Client | `apps/web/src/lib/periscan-api-client.ts` |
| Acceptance | `tests/acceptance/hybrid-compiler-flow.test.ts` |

## Tests

- `packages/shared/src/hybrid-execution-compiler.test.ts` (draft convert, Draft multi-agent)  
- `apps/api/src/services/hybrid-execution-compiler.test.ts`  
- `tests/acceptance/hybrid-compiler-flow.test.ts` (poll→complete mock runner + convert + Draft mission)  
- `apps/web/src/components/model-gateway-workbench.test.tsx` (convert UI)

## Forbidden (unchanged)

- Strong/Leading scorecard claims on 29/30/33.  
- Live APT / Atomic / multi-agent offensive swarm.  
- Auto-start multi-agent assembly without explicit hybrid compile + policy.  
- Treating conversational drafts as executable BAS.

## Scorecard delta recommendations (do **not** auto-raise to Strong/Leading)

Cap: **Partial mid-3s maximum**. Never Strong/Leading.

| ID | After Slice B (suggested) | Suggested after Slice D | Rationale |
|---:|--------------------------:|------------------------:|-----------|
| 29 | 2.5–2.75 Partial | **2.75–3.0 Partial** (e.g. P3 F3 U3 O2–O3) | Draft mission persistence + multi-step role assembly + UI honesty; still not measured multi-agent mission orchestration E2E across roles with chained results. |
| 30 | 3.0–3.25 Partial | **3.25–3.5 Partial** (e.g. P3 F3–F4 U3 O3) | Mock-runner complete path for passive allowlisted module proves control-plane E2E; not Fully-E2E lab runner product surface / multi-module hybrid graph. |
| 33 | 2.5–2.75 Partial | **2.75–3.0 Partial** (e.g. P3 F3 U3 O2–O3) | Real convert-to-compile-input path + UI; still not NL→live scenario generation as BAS. |

**Points delta estimate (conservative midpoints vs pre-Slice-B baselines if not yet rescored):**  
- 29: ~2.0 → 2.875 ≈ +3.5 pts  
- 30: ~2.5 → 3.375 ≈ +3.5 pts  
- 33: ~2.0 → 2.875 ≈ +3.5 pts  
**≈ +10.5 points** on the 94-row sum only after gate floors updated with test evidence — **never Strong/Leading**.

If Slice B deltas already applied, incremental Slice D only:

| ID | From (B) | To (D mid) | Δ pts (×4 dims avg) |
|---:|---------:|-----------:|--------------------:|
| 29 | 2.625 | 2.875 | ~+1.0 |
| 30 | 3.125 | 3.375 | ~+1.0 |
| 33 | 2.625 | 2.875 | ~+1.0 |
| **Sum** | | | **~+3.0** (~+0.16 on 0–100 score) |

## Not claimed

- Full multi-agent orchestration engine / 10+ offensive swarm  
- Hybrid compiler Fully-E2E measured product surface (Strong)  
- Conversational builder → live BAS scenario execution  
- Atomic / Caldera / SharpHound / ransomware live
