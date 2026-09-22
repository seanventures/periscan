# Sales / demo guardrails for offensive & simulation modules (P05-18)

> **BAS/AEV program:** [../BAS_AEV_PROGRAM.md](../BAS_AEV_PROGRAM.md) — qualified open-source simulation, emulation and evidence-backed validation (PERISCAN-583).

Companion to [DEMO_AND_SE_RULES.md](./DEMO_AND_SE_RULES.md) and
[CLAIM_DENY_LIST.md](./CLAIM_DENY_LIST.md).

## Product-enforced rules

1. **Demo tenant watermark** — Findings on the public demo tenant
   (`PUBLIC_DEMO_TENANT_ID`) are titled with
   `DEMO FIXTURE — NOT CUSTOMER PROOF` via `applyDemoFixtureWatermark`.
2. **Catalog-only sims** — Modules tagged `catalog-only` / `planning-only` /
   `simulation` (or planning-only execution modes) are **hidden from production
   launch pickers** via `shouldShowModuleInCustomerCatalog`. Demo workspaces may
   still show them for narrative, with watermarked outcomes.
3. **Fixture/sim proof states** — Modules must use
   `validationStateForFixtureOrSimulation` / `fixtureOrSimulationEvidenceAttributes`
   so sim output cannot mint Validated / Exploitable / Fixed / StillExposed as
   customer proof (`packages/modules`).

## SE one-pager: qualified scope and unsupported claims

| Build / demo | Unsupported or excluded behavior |
|---|---|
| Governed continuous validation + measured re-test | Claiming complete BAS coverage from fixtures or unqualified scenarios |
| Safe external observations (headers, fingerprint, public metadata) | Automated pentest / autonomous red team |
| Control observe (EDR/SIEM telemetry) with honest Missed/Logged-only | Continuous inject BAS without policy-bound stimulus path |
| Fix verification Fixed only on measured retest | Ticket Done = Fixed |
| Simulation modules as **labeled fixtures** | “Validated” screenshots from demo seed as audit evidence |
| Kill switch + denied-task never queued | Live SharpHound / Caldera / Atomic without approval rails |

## Demo script discipline

1. Open `/shift` or `/dashboard` Needs you — not Swarm / MCP / Model Gateway.
2. Scope → Validate → Finding → Remediate → Re-verify → Evidence.
3. If an SE opens a simulation module, the watermark must remain visible on any
   derived finding. If it is missing, **stop the demo** and file a product bug.

## Governed BAS execution

Demonstrate only qualified scenarios on verified authorized scope. Use the
[BAS execution authorization](BAS_EXECUTION_AUTHORIZATION.md) record to bind
content pins, inputs, target scope, runtime, policy/approval, time window,
resource bounds, cancellation and cleanup. Development follows the
[BAS/AEV program](../BAS_AEV_PROGRAM.md).

Current generic live control inject is unavailable until its implementation
ships. Show import-only content as authoring and measured marker/observer
results as the specific capability they prove. No fixture outcome establishes
live adapter execution or broad coverage.

## Non-goals (document for prospects)

- Periscan is **not** a SIEM case console and does **not** bi-directionally close
  Splunk notables / Sentinel incidents on disposition (optional outbound
  `finding.disposition_changed` webhook only; see P06-16).
- Signal triggers are a **fixed catalog with parameters**, not customer Sigma.
- Current adapters must report their real readiness and supported coverage.
