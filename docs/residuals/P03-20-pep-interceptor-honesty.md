# P03-20 PEP interceptor — honesty residual (Wave6)

**Status:** Closed for product claim with residual honesty · Commit `[P03-20]`

## Shipped (Wave6)

- **Single PEP module:** `apps/api/src/policy-enforcement-point.ts`
  - `enforceExecutionPolicy(...)` — dual gate (stored decision + live `evaluatePolicy` recheck + verified scope)
  - `enforceFreshPolicyEvaluation(...)` — fresh outcome → allowance (runner create / fix-verification modules)
  - `enqueueWithExecutionPolicy(...)` — **only** path that may call `missionQueue.enqueueValidationJob` from producers; requires opaque `ExecutionPolicyAllowance`
- **Wired entrypoints:**
  | Entrypoint | Path |
  |---|---|
  | Mission start | `services/validation.ts` `startMission` |
  | Schedule fire | `services/schedules.ts` `runSchedule` (before any mission/run/job) |
  | Hop launch | via `startMission` after path-edge preview deny short-circuit |
  | Fix verification | `services/remediation.ts` enqueue |
  | Runner task create | `services/runner.ts` create*Task |
  | Runner task accept | `services/runner.ts` poll/lease recheck before lease |
  | Stimulus dispatch | `services/control-stimuli.ts` |
- **Architecture test:** `policy-enforcement-architecture.test.ts` forbids direct `.enqueueValidationJob(` outside `mission-queue.ts` + PEP.
- **Unit tests:** Denied / expired / unverified / binding mismatch never mint allowance; enqueue without allowance throws and never queues.

## Residual honesty (do not over-claim)

1. **Model-gateway tool PEP** remains separate (`packages/model-gateway` `policy-enforcement.ts`). It is a tool-request PEP, not the validation-queue PEP. Do not market them as one interceptor.
2. **Snapshot schedule fire** creates snapshots (not validation-queue jobs). PEP still runs dual-gate on bound decisions before `createSnapshot`; snapshot internals are not job producers.
3. **Worker re-dispatch / retry** of already-queued BullMQ jobs is not re-gated by the API PEP (jobs only exist after PEP-allowed enqueue). Server policy re-deny at runner **accept** covers the internal-runner path after queue.
4. **Allowance is not cryptographic** — it is an in-process opaque brand. Architecture tests + code review are the enforcement for new producers; there is no kernel-level interceptor on Redis.
5. **Hop launch preview** still uses `previewPolicyDecision` for create-time deny-before-mission; execution queue still requires `startMission` → PEP.

## Product language (allowed)

- “All validation-queue producers and runner task create/accept paths go through a Policy Enforcement Point; Denied decisions never receive an enqueue allowance.”
- “Architecture tests forbid direct `missionQueue.enqueueValidationJob` from service modules.”

## Product language (forbidden)

- “Unavoidable kernel/OS-level policy proxy for every byte of execution.”
- “Single PEP covers model-gateway tools and validation jobs identically.”
- “BullMQ retries re-evaluate policy on every attempt.”
