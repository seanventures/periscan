# Continuous loop Slice B — AI Controls (rows 59 / 61 / 65)

**Date:** 2026-08-01  
**Branch:** `overnight-loop`  
**Scope:** AI Control Validation (59), Prompt Injection Emulation (61), AI Kill-Switch Validation (65) — **safe depth only**.

## Goals shipped

| # | Goal | Result |
|---|------|--------|
| 1 | **AI kill-switch** — real feature flag / gateway kill path that stops LLM tool calls with audit | Durable **tenant** flag + `PERISCAN_MODEL_GATEWAY_KILL_SWITCH` env force-on; activate terminates sessions, cancels tool requests, blocks new sessions/turns/tool execute; audit `KillSwitchActivated` + `model_kill_switch_activated` |
| 2 | **AI control validation** — measured:false honesty + deterministic pass/fail with evidence IDs | Fixture/imported harness → `measured:false` + `passFail`; bounded live canary → `measured:true` when decisive; acceptance downloads evidence content by ID |
| 3 | **Prompt injection** — safe harness only (no real jailbreak corpus) | `@periscan/policy` `evaluatePromptInjectionHarness` deny + structured audit; wired into bounded suite for PromptInjection / Indirect / Jailbreak categories |
| 4 | This memo | `docs/qa/SLICE_B_AI_CONTROLS.md` |

## Forbidden (unchanged)

- Live harmful jailbreak corpora / unrestricted injection banks  
- Inventing SOC2 certification claims  
- Live BAS / Atomic live inject / Caldera / ransomware / credential theft  

## Implementation map

| Layer | Path |
|-------|------|
| Migration | `packages/db/prisma/migrations/20260801090000_add_model_gateway_tenant_kill_switch/` |
| Tenant fields | `modelGatewayKillSwitchActive/Reason/ActivatedAt/ActivatedBy` |
| Env flag | `PERISCAN_MODEL_GATEWAY_KILL_SWITCH` (`.env.example`) |
| PEP resolve | `packages/model-gateway/src/engine/policy-enforcement.ts` → `resolveTenantModelGatewayKillSwitch` |
| Service | `apps/api/src/services/model-gateway.ts` → `activateModelGatewayKillSwitch` (`enabled` toggle) |
| AI measured honesty | `packages/modules/src/index.ts` → `ai_app.safe_validation` evidence `measured` + `passFail` |
| Prompt-injection policy | `packages/policy/src/prompt-injection.ts` (+ tests) |

### Kill-switch contract

```http
POST /api/v1/model-gateway/kill-switch
{ "reason": "…", "enabled": true }   # default enabled=true
```

| Field | Meaning |
|-------|---------|
| `enabled: true` | Set durable tenant flag; terminate sessions; cancel non-terminal tool requests; audit |
| `enabled: false` | Clear durable tenant flag only (sessions stay Terminated; create new sessions after clear) |
| `envForceActive` | Response pin when process env force-on is set (cannot clear via API) |
| Error code | `model_gateway_kill_switch_active` on create session / tool request / execute / turn while active |

Real PEP path: `resolveTenantModelGatewayKillSwitch` (tenant + env).  
`getKillSwitchStatus()` **without** known state remains an honesty **stub**.

### AI validation honesty contract

| Mode | `measured` | `passFail` |
|------|------------|------------|
| Fixture / imported harness report | `false` | pass/fail from fixture outcome severity |
| Benign endpoint probe | `false` | inconclusive path |
| Bounded live suite (decisive canary) | `true` | `pass` (held) or `fail` (canary echoed / risk) |
| Bounded live suite (Inconclusive/network) | `false` | `inconclusive` |

Evidence IDs are persisted on every validate response; content is downloadable via `GET /api/v1/evidence/:id/download`.

### Prompt-injection policy contract

- **Allow:** versioned `periscan-benign-*` corpus + `PERISCAN_CANARY_*` on safe categories only  
- **Deny + log:** `externalJailbreakCorpus`, non-benign corpus, unknown category, unsafe patterns, missing canary  
- Audit action: `prompt_injection.policy_decision` (`Allowed`/`Denied`, content fingerprint only — never full harmful corpora)  
- `jailbreakCorpusEnabled` always `false` in product  

## Tests

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL=$DATABASE_URL

pnpm --filter @periscan/policy test -- src/prompt-injection.test.ts
pnpm --filter @periscan/model-gateway test -- src/engine/policy-enforcement.test.ts
pnpm --filter @periscan/modules exec vitest run src/index.test.ts -t "bounded synthetic|fixture AI validation|disposable canary"

pnpm exec vitest run \
  tests/acceptance/model-gateway-kill-switch-flow.test.ts \
  tests/acceptance/ai-control-validation-honesty-flow.test.ts \
  --testTimeout=90000
```

| Suite | Asserts |
|-------|---------|
| `tests/acceptance/model-gateway-kill-switch-flow.test.ts` | Durable flag, terminate, audit, refuse new sessions, clear restores create |
| `tests/acceptance/ai-control-validation-honesty-flow.test.ts` | Fixture measured:false; bounded pass + measured:true + evidence IDs |
| `packages/policy/src/prompt-injection.test.ts` | Allow canary; deny external corpus / unsafe / missing canary |
| Module unit tests | measured/passFail on fixture, pass, and fail canary paths |

Also complementary: existing `tests/acceptance/ai-validation-lab-flow.test.ts` (AI-app validation kill switch).

## Recommended score deltas (do **not** invent Leading)

Apply only after this commit is on the branch tip and a rescore cites the evidence paths above.

| Row | Requirement | Current (Slice A) | Recommended after Slice B | Rationale |
|----:|-------------|------------------:|--------------------------:|-----------|
| **59** | AI Control Validation | 3.25 Partial (4/3/3/3) | **3.75 Strong** (4/4/3/4) or **4.00** floor if UX polish follows | Measured honesty + deterministic pass/fail + evidence IDs; still safe-suite only (not full adversarial corpus) |
| **61** | Prompt Injection Emulation | 3.25 Partial (4/3/3/3) | **3.75 Strong** (4/4/3/4) | Policy deny+log + safe canary gate; **not** universal PI resistance |
| **65** | AI Kill-Switch Validation | 3.00 Partial (3/3/3/3) | **4.00 Strong** (4/4/4/4) | Durable gateway flag + env force-on + audit + acceptance; AI-app kill switch already E2E |

**Honesty ceilings**

- Do **not** score 59/61 Leading (safe canary / no live jailbreak bank).  
- Do **not** claim SOC2 certification from kill-switch or AI suites.  
- Matrix “Partial” language for AI control remains correct until partner live-endpoint qualification memos exist.

### Point estimate if recommended floors applied

| Metric | Before (Slice A) | If 59→3.75, 61→3.75, 65→4.00 |
|--------|-----------------:|------------------------------:|
| Row points (×4 dims) | 1383 | **+~6 row-score pts → ~+24 dim pts** ≈ **1407** (~**74.8**/100) |
| Strict ≥4.0 rows | 45 | **46** (65 only, if 4.0) |
| Strong+Leading | 74 | **77** (59/61/65 → Strong) |

Exact gate recompute: update `docs/qa/analyst-scorecard.json` + `scripts/analyst-score-gate.mjs` floors in a follow-up rescore commit (pattern: Slice A).

## Not claimed

- 95+ external analyst readiness  
- MQ/Wave progress  
- Full jailbreak corpus emulation  
- Certification / SOC2 attestation  

## Commit stamp

| Item | Value |
|------|-------|
| Slice B AI controls (+ concurrent dynamic-path work in same tip) | `0d3028b88e8d26f0332eb7b03d401804e8fd74a3` |
| Tests green | policy + model-gateway + modules focused + 2 acceptance files |
