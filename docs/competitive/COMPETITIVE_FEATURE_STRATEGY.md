# Competitive feature strategy — prove, integrate, or refuse

**Status:** durable GTM + product strategy (2026-07-30)  
**Pairs with:** [POSITIONING.md](./POSITIONING.md), [CLAIM_DENY_LIST.md](./CLAIM_DENY_LIST.md),  
[COMPETITIVE_COVERAGE_MATRIX.md](../COMPETITIVE_COVERAGE_MATRIX.md)  
**Execution plan:** [FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md](../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md)

When a buyer or RFP asks for a matrix row, use exactly one strategy:

| Strategy | When | Example |
| --- | --- | --- |
| **Prove** | We can make Fully-E2E or deep Partial with real evidence | Measured multi-hop, DRV marker loop, revalidation |
| **Integrate** | Peer owns system of record; we correlate | Wiz, Tenable, CrowdStrike, ServiceNow |
| **Refuse** | Safety floor, category non-home, or partner-only | Live ransomware, agentless APT, replace CNAPP |

Never invent a fourth strategy (“demo theater” / fixture metrics).

---

## 1. Prove (build waves)

Highest ROI vs Picus / XM / “CTEM proof” buyers:

1. **Measured attack paths** (matrix 3–5) — Wave A  
2. **Detection marker emit→observe** (8, 14, 15) — Wave B  
3. **Continuous EASM on verified scopes** (1) — Wave C  
4. **Optional lab inject** (6) — Wave D, dual-gated only  
5. **RemOps honesty + IaC PR depth** (67–71) — Wave E  
6. **Connector Production on design-partner keys** (72–77) — Wave F  

Protect Fully-E2E forever: **11, 13, 24, 69, 90, 91**.

---

## 2. Integrate (co-exist)

| Peer | Integrate how | Never say |
| --- | --- | --- |
| Wiz / CNAPP | Inventory + issues → paths + fix proof | “Replace Wiz” |
| Tenable / RBVM | Vuln/asset sync + import → exploitability + revalidate | “Replace Tenable” |
| CrowdStrike / Defender | Technique telemetry observe | “Replace EDR” |
| SIEM (Splunk, QRadar, Datadog, Sentinel) | Observe control/detection | “Replace SIEM” |
| ServiceNow / Jira | Tickets + optional status sync | “Full SOAR platform” |

Catalog entries without live clients stay **Planned / NotConnectable**.

---

## 3. Refuse (walk-away language)

| Ask | Refuse line | Why |
| --- | --- | --- |
| Full multi-vector BAS library bake-off | We sell AEV/CTEM proof, not scenario libraries | Category home |
| Agentless autonomous pentest | Governed continuous validation with hard floor | Safety + positioning |
| Live ransomware / spray / SharpHound | Permanently off in product | Legal/safety |
| Auto-mitigate pushes firewall rules | We **auto-revalidate**; human/IaC applies fix | Honesty |
| TEE/H100 “we run your agents in enclave” | We **qualify customer attestation evidence** | Verifier not host |
| Ray cluster scaling shipped | Core async workers only; matrix #99 Absent | Platform adjacency (Wave K) |
| Certified DORA/NIS2/PCI | Audit-support evidence packs only | Not a CAB |
| MQ Leaders this quarter | Zero named refs; internal score ≠ market | Presence |
| Leading on Partial/Scaffold | Matrix Fully-E2E only; allowlist 11,13,24,69,90,91 | Score-gate |

Full deny list: [CLAIM_DENY_LIST.md](./CLAIM_DENY_LIST.md).

---

## 4. Competitive one-liners (matrix-aligned)

| Competitor | Win theme | Lose theme if oversold |
| --- | --- | --- |
| Picus | Unified proof console + Fixed-only-via-verify + honest SCV observe | Library inject bake-off without Wave D SOW |
| Pentera / NodeZero | Safe continuous + evidence language | Agentless APT theater |
| XM Cyber | Evidence-backed path breakers + remediations | Min-cut choke science |
| CyCognito | Verified-scope external PoA + recon | Autonomous living external map |
| Cymulate / AttackIQ | Governed BAS-lite + control observation | Multi-vector malware/email packs |

---

## 5. Wave → strategy map

| Wave | Strategy | Outcome |
| --- | --- | --- |
| A–C | Prove | Core proof loop depth |
| D | Prove (lab) / Refuse (default) | Optional inject under SOW |
| E–F | Prove + Integrate | RemOps + Production connectors |
| G | Prove (partial) | Audit-support, not cert |
| H–I | Prove control plane | Agentic ops + attestation verify |
| J | Integrate commercial | Payments/Marketplace when real |
| K | Refuse score dilution | 95–110 stay optional |
| L | Prove externally | Blind rescore |

---

## 6. Sales walk (product)

Ordered honest demo: `/scopes` → `/engines` → `/controls` → `/findings` → `/attack-paths` → `/continuous`  
Help guide: `competitive-walk`. Details: [BATTLECARDS.md](./BATTLECARDS.md), [DEMO_AND_SE_RULES.md](./DEMO_AND_SE_RULES.md).
