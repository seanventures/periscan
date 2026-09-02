# Periscan category & competitive positioning

**Status:** durable GTM contract (2026-07-29)  
**Tickets:** P12-1, P12-2, P19-1–4  
**Audience:** product, sales, SEs, founders, analyst briefings

This document defines **where Periscan sits in the market** and what language is
allowed. Capability truth remains in
[COMPETITIVE_COVERAGE_MATRIX.md](../COMPETITIVE_COVERAGE_MATRIX.md). Strategy for
closing gaps remains in
[COMPETITIVE_FEATURE_STRATEGY.md](../COMPETITIVE_FEATURE_STRATEGY.md).

---

## 1. Category home (P12-1, P19-1)

### We own

**Adversarial Exposure Validation (AEV) / CTEM proof layer.**

One sentence:

> Periscan measures which exposures are real on authorized scope, proves which
> paths matter, and only marks Fixed when a re-measurement says so.

### We do not own (and must not sell as peers)

| Category | Peers | Periscan stance |
|---|---|---|
| Full multi-vector **BAS** libraries | Cymulate, AttackIQ, Picus (library demos) | **Refuse scenario-library bake-offs.** We ship governed BAS-lite / control observation, not malware/phishing/DNS-exfil live packs. |
| **CNAPP** | Wiz, Orca, Prisma Cloud | **Co-exist.** Ingest inventory/issues; prove path + fix. Never replace CNAPP. |
| **RBVM / vuln management** | Tenable, Qualys, Rapid7 VM | **Co-exist.** Validate exploitability and re-prove fixes on top of RBVM. Never replace the vuln system of record. |
| **Automated pentest / kill-chain theater** | Pentera, Horizon3 NodeZero | **Deliberate safety floor.** Governed continuous validation, not automated pentest. |
| Human red team / purple team services | boutique RT firms | Complement with evidence packs; never claim replacement. |
| SIEM / XDR / endpoint platform | Microsoft Defender, CrowdStrike, Sentinel | Telemetry peers; never claim platform rip-and-replace. |

### Allowed category phrases

- AEV / CTEM **proof layer**
- Measured exposure validation with evidence
- Fix verification that can demote stale Fixed
- Governed continuous validation (hard safety floor)
- Better-together with Wiz / Tenable / Microsoft telemetry

### Denied category phrases

- “Full BAS platform” / “multi-vector BAS like Cymulate”
- “Replace your CNAPP” / “Wiz alternative for cloud security posture”
- “Replace Tenable / RBVM”
- “Automated pentest” / “autonomous red team” / “ransomware emulation”
- “False-positive-free” (unless strictly scoped to a measured edge with evidence)
- “Leading” on a capability the coverage matrix marks Partial/Scaffold/Missing
- “Leading choke-point / min-cut / single cheapest control across 40 paths” until graph solver ships — say **evidence-backed path breakers**
- “Auto-mitigate” implying control push (WAF/firewall) — say **auto-revalidate**
- Unqualified “always-on continuous validation” — say **scheduled + revalidation + signal-triggered**

### BAS language discipline

Internal enums may still use `BAS` / `BASLite` as **source motion and safety
level** names. External and product-visible copy must clarify:

- **BAS-lite / control validation** = policy-gated, non-destructive, often
  dry-run or passive; not competitive inject-and-measure BAS libraries.
- Live Atomic / Caldera / SharpHound / Metasploit-style execution remains
  disabled or hard-gated per `SECURITY_BOUNDARIES.md` and Agents.md.

### Red-team buyer line (P05-16)

> We continuously **prove the cheap links** on paths your scanners and humans
> found — we do not replace your annual red team or your BAS library.

Co-exist with Cymulate / AttackIQ / Pentera / Wiz / Tenable. Wave / library-peer
bake-offs only after references and measured multi-hop depth — not scenario
count.

---

## 2. Proof wedge (always lead with this)

Every competitor sells “validate your security.” Periscan’s answer is
architecture, not a slogan:

1. **Measured vs heuristic is labeled** in the data model.
2. **Fixed flips only on re-measurement** (and can demote if still exposed).
3. **Runner tasks are signed; evidence is tenant-scoped and tamper-aware.**
4. **Where we simulate, we say simulated** — no fabricated metrics.

Demo and RFP order must follow the proof loop, not a scenario catalog:

1. Verified authorized scope  
2. Measured probe / path edge  
3. Remediation + Fixed demotion honesty  
4. Evidence pack  

Details: [DEMO_AND_SE_RULES.md](./DEMO_AND_SE_RULES.md).

---

## 3. Co-exist matrix (P19-2, P19-3)

| Customer already owns | Periscan job | Never say |
|---|---|---|
| **Wiz** (CNAPP) | Ingest resources/issues → correlate paths → prove which are real → re-verify fix | “Replace Wiz / CNAPP” |
| **Tenable** (RBVM) | Ingest vulns/assets (API or scan import path) → prioritize by validated exploitability → prove Fixed | “Replace Tenable / vulnerability management” |
| **Microsoft Defender / Secure Score** | Cross-stack path proof, external PoA, hybrid/non-MS assets, MSSP multi-client evidence | “Microsoft CTEM replacement” / “rip out Defender” |
| **Nuclei / ProjectDiscovery** | Authorized External PoA (scope → policy → bounded profiles → Fixed ledger) | “We run Nuclei” / template-count war |
| **AttackIQ / Cymulate inject demos** | One governed safe stimulus + ambient control observation (SCV Partial) | Full multi-vector inject library parity |
| **BAS library (Cymulate/AttackIQ)** | Continuous measured revalidation + honesty labels on paths they cannot prove Fixed | “We’re full BAS parity” |
| **Pentera / Horizon3** | Auditability, MSSP multi-tenant, hard safety floor, Fixed honesty | “We’re automated pentest too” |

Named recipes (docs + mission packaging):

- **Wiz → Attack Path → Remediation** — inventory in, path proof out, fix re-measured  
- **Tenable finds → Periscan validates & verifies fix** — RBVM remains system of record  

Battlecard detail: [BATTLECARDS.md](./BATTLECARDS.md).

---

## 4. Safety floor is a product feature (P19-4)

Against Pentera/Horizon3, claiming parity on autonomous exploitation is both a
**losing demo** and a **safety/legal risk**.

**Positive phrase (required):**

> Governed continuous validation with a hard floor that never lifts.

**Hard floor (never lift without explicit policy change + approval):**

- No destructive actions  
- No real data exfiltration  
- No persistence on customer systems  
- No credential theft  
- No uncontrolled exploit chaining  

Source of truth: [SECURITY_BOUNDARIES.md](../../SECURITY_BOUNDARIES.md).

Competitive win conditions vs automated-pentest peers:

- Auditability and policy decisions on every run  
- Honest Fixed / StillExposed revalidation  
- MSSP multi-tenant isolation  
- Evidence packs suitable for customer and auditor consumption  

Not: kill-chain theater, ransomware packs, or “we broke in harder.”

---

## 5. Analyst / MQ placement (P12-2)

### Correct self-placement today

**Visionaries / strong Contender on Completeness of Vision** when diligence uses
honest matrices, anti-fabrication architecture, and AEV/CTEM proof framing.

**Ability to Execute is the ceiling** until:

1. Referenceable design-partner proofs (customer-discussable)  
2. Measured multi-hop path as the default demo journey  
3. Governed SCV stimulus / DRV inject-and-observe closed loops (or external claims
   renamed to Control Observation / Rule Coverage)

### Wrong investment

- More vision docs, swarm surfaces, or category theater without AtE movement  
- Exporting internal “Leading” scorecard rows where engineering matrix ≠ Fully-E2E  
- Entering pure BAS multi-vector RFPs as peer

### Leaders path (program, not a document)

Treat **referenceable measured multi-hop + SCV inject + ≥3 design-partner proofs**
as the only Leaders-band Ability-to-Execute path. Cap new Completeness-of-Vision
surfaces until those land.

### MSSP Execute wedge (underplayed previously)

Multi-tenant MSSP architecture (child tenants, isolation proof, portfolio,
white-label packs) is a real **Ability-to-Execute** wedge for channel buyers.
GTM narrative: [`../DESIGN_PARTNER/MSSP_GTM_WEDGE.md`](../DESIGN_PARTNER/MSSP_GTM_WEDGE.md).
Live commercial packaging and dogfood partner evidence remain open — do not
claim partner logos or “MSSP-ready at scale” from architecture alone.

### Blind rescore before analyst pursuit

Internal scorecard lifts are not MQ/Wave progress. Gate:
[`../DESIGN_PARTNER/BLIND_RESCORE_GATE.md`](../DESIGN_PARTNER/BLIND_RESCORE_GATE.md).

---

## 6. Peer set (honest framing)

Do **not** list Picus / Pentera / Cymulate / RidgeBot / SafeBreach / Horizon3 as
unqualified “we compete head-to-head on full BAS.”

Preferred framing:

> Periscan is an **AEV/CTEM proof layer**. Buyers may already own CNAPP (Wiz),
> RBVM (Tenable), BAS libraries, or automated-pentest tools. We co-exist: we
> measure paths, prove fixes, and refuse overclaim. Capability detail:
> coverage matrix + feature strategy.

Internal competitive research may still study those vendors; **GTM peer framing**
must follow this document.

---

## 7. Maintenance

| Change | Update |
|---|---|
| New connector (Wiz/Tenable/etc.) | Keep co-exist language; do not claim category ownership |
| New validation module | Label measured vs simulated; no “full BAS” upgrade |
| Scorecard rescore | External language must track matrix Fully-E2E only |
| Analyst inquiry | Ship this doc + battlecards + coverage matrix; no Leading claims without rescore |

Panel sources: `docs/qa/panel-audit-exhaustive-2026-07-29/personas/12-gartner-analyst.md`,
`19-competitive-intel.md`, `13-forrester-analyst.md`.
