# Sales / demo guardrails for offensive & simulation modules (P05-18)

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

## SE one-pager: build vs never-build

| Build / demo | Never build or claim in demo |
|---|---|
| Governed continuous validation + measured re-test | Full multi-vector BAS library (malware, phishing, live ransomware) |
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

## Wave D closed inject — SOW-only (default off)

Optional **lab** closed inject→measure (SCV demo stimulus path) is **Wave D** and
is **not** default product behavior.

| Rule | Requirement |
|---|---|
| **SOW required** | Written customer or design-partner SOW that names inject scope, allowlisted stimuli, kill switch, and success criteria. No SOW → no inject work. |
| **Dual approval** | Tenant policy flag **and** operator approval; dry-run default. Denied inject tasks never queue. |
| **Default product** | Observe-only control validation (telemetry correlation). Closed inject remains hard-disabled (`control_live_execution_disabled`) until SOW + dual gate. |
| **Never in Wave D** | Live ransomware, spray, SharpHound, Caldera live, Atomic live library, real exfil. |
| **Claim language** | Do **not** sell “full BAS inject library” or multi-vector inject parity. Message: one governed inject loop with receipts (lab/SOW) ≠ scenario-library BAS. |
| **Matrix** | SCV stays Partial (observe) or “Partial (lab inject optional)” — never Leading until customer-proof inject is real and matrix Fully-E2E. |

**SOW template (required fields + never list + SE refuse script):**  
[WAVE_D_INJECT_SOW_TEMPLATE.md](./WAVE_D_INJECT_SOW_TEMPLATE.md) — written contract only; does **not** enable product inject.

Full plan: [FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md](../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md) § Wave D.  
Strategy: [COMPETITIVE_FEATURE_STRATEGY.md](./COMPETITIVE_FEATURE_STRATEGY.md) (Wave D = Prove lab / Refuse default).  
Safety floor: [SECURITY_BOUNDARIES.md](../../SECURITY_BOUNDARIES.md) § Wave D optional lab inject — SOW + dual gate.

## Non-goals (document for prospects)

- Periscan is **not** a SIEM case console and does **not** bi-directionally close
  Splunk notables / Sentinel incidents on disposition (optional outbound
  `finding.disposition_changed` webhook only; see P06-16).
- Signal triggers are a **fixed catalog with parameters**, not customer Sigma.
- Wave D inject is **SOW-only lab**; default product is not a competitive inject BAS.
