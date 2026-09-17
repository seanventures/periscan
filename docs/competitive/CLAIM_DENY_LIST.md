# Claim language deny-list (GTM product contract)

**Ticket:** P19-20  
**Status:** productized shared claim language for GTM / SE / website / Wave  
**Audience:** sales, SEs, product marketing, founders, support, engineering PRs that add nav items

Capability truth remains in
[COMPETITIVE_COVERAGE_MATRIX.md](../COMPETITIVE_COVERAGE_MATRIX.md).
Category home remains in [POSITIONING.md](./POSITIONING.md).
Battlecards: [BATTLECARDS.md](./BATTLECARDS.md).

This file is the **single customer-facing “what we never claim”** contract.
Engineering claim-language for paths lives in
`packages/shared/src/claim-language.ts` and
`packages/shared/src/gtm-claim-language.ts` (machine-readable export of this list).

---

## 1. Capabilities we prove (lead with these)

| Claim | When allowed |
|---|---|
| Measured exposure on **verified authorized scope** | Scope status Verified; policy decision present |
| Path / hop **Measured vs Heuristic** labels | Data model fields, not marketing guess |
| **Fixed only after re-measurement** (and Fixed can demote) | VerificationEvent path |
| Governed continuous validation with a **hard safety floor** | Always — floor never lifts without policy change + approval |
| External PoA via **bounded authorized profiles** | External Validation workbench / safe modules |
| Co-exist recipes (Wiz, Tenable, Defender) | Connector real + recipe language only |

---

## 2. Capabilities we integrate (do not own)

| Peer plane | Periscan job | Never claim |
|---|---|---|
| CNAPP (Wiz…) | Inventory / issues in → path proof out | Replace CNAPP |
| RBVM (Tenable…) | Validate exploitability + re-prove fix | Replace vuln management |
| XDR / SIEM / EDR (Defender, Crowdstrike, Splunk…) | Telemetry / control observation | Rip-and-replace detection platform |
| ITSM (Jira, ServiceNow…) | Tickets / remediation workflow | Replace ITSM |
| Nuclei / OSS scanners | Governed adapter + evidence normalization | “We are a scanner” / template marketplace |

---

## 3. Capabilities we refuse (deny-list phrases)

Use these **exact denials** in RFP answers and decks when asked for parity:

| Denied phrase | Positive substitute |
|---|---|
| “Full BAS platform” / multi-vector BAS peer / scenario-library bake-off parity | AEV/CTEM **proof layer** on authorized scope; refuse BAS library RFPs |
| “Replace your CNAPP” / “Wiz alternative” | Bring inventory; we prove path + fix |
| “Replace Tenable / RBVM” | Validation and fix-proof **on top of** RBVM |
| “Automated pentest” / “autonomous red team” | Governed continuous validation; hard floor that never lifts |
| “Ransomware emulation” / live malware packs | Not in product; safety floor |
| “We make you DORA / NIS2 / PCI / SOC 2 compliant” | We attach measured validation evidence to framework claims |
| “False-positive-free” (global) | Only scope to a measured edge with evidence IDs |
| “Leading” on Partial/Scaffold matrix rows (decks / website / RFP) | Coverage matrix Fully-E2E only; score-gate Leading allowlist **11, 13, 24, 69, 90, 91** until blind rescore expands it |
| “100+ deep native integrations” | Publish connectable vs planned; top-N depth |
| “Microsoft CTEM replacement” / “rip out Defender” | Cross-stack path + external PoA; keep Defender telemetry |
| “We run Nuclei” as the hero claim | Authorized External PoA workflow |
| “Continuous validation” without qualifier | Scheduled + revalidation + signal-triggered (product truth) |
| “Auto-mitigate” as control push / firewall or policy push | Auto-revalidate; no config change is pushed until an approved control-push path ships |
| “We run your agents/workloads in a TEE” / confidential-enclave host | Qualify customer-supplied TEE/H100 attestation evidence (verifier, not host) |
| “Ray scaling shipped” / Ray as product runtime | Matrix #99 Absent; core async workers only — Wave K platform-adjacency freeze |
| Named customer logos / case studies / ARR / reference calls without consent | Honest design-partner stage: **zero** public refs; labeled lab proof only (P12-6 / P08-2 / P13-1) |
| “MQ / Wave Leaders-ready” or market-presence Pass while publicReferenceCount = 0 | MQ market presence **Fail** until ≥3 production partners with signed reference permission; internal scorecard ≠ MQ progress |
| Demo tenant / sample `/demo` / lab E2E as a customer reference | Sample and lab paths are non-customer; only consented production deploys fill the reference pack |

---

## 4. Product / nav gate (Autonomous & Labs)

Before promoting any Labs surface (Swarm, MCP, Model Gateway, Packs) to primary rail
or customer deck:

1. Proof loop (scope → measure → remediate → Fixed) is inevitable in demo.  
2. Claim does not contradict matrix Fully-E2E / Partial / Scaffold.  
3. SE enablement review against this deny-list.  
4. No “Leading” export from internal scorecard without matrix alignment.
   Machine allowlist (Fully-E2E-aligned only): scorecard ids **11, 13, 24, 69,
   90, 91**. Enforced by `scripts/analyst-score-gate.mjs` (P12-3 / P19-r1).
5. Internal score (`docs/qa/analyst-scorecard.json`) is **not** Magic Quadrant
   or Forrester Wave progress (`scoreGovernance.isMagicQuadrantProgress=false`,
   `isForresterWaveProgress=false` — P12-16).
6. Market presence: **zero** named customer references and **no** public
   marketplace listing until real — never invent ARR, logos, or refs
   (P08-2 / P12-6 / P13-1).

---

## 5. Trust surface

Customer-visible summary of this contract is linked from Trust & Safety
(`/trust-safety`) and from competitive docs README. Public marketing must not
exceed Fully-E2E rows in the coverage matrix.

---

## 6. Change control

- Update this file **before** website, decks, RFP library, or primary nav claim changes.
- Keep `packages/shared/src/gtm-claim-language.ts` in sync (tests enforce list shape).
- Matrix Partial/Scaffold upgrades require engineering evidence, not copy alone.
