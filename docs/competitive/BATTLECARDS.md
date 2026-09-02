# Competitive battlecards (one-pagers)

Use with [POSITIONING.md](./POSITIONING.md). Keep claims within
[COMPETITIVE_COVERAGE_MATRIX.md](../COMPETITIVE_COVERAGE_MATRIX.md).

---

## Product walk — BAS refuse + Wiz co-exist (honest)

Single in-product playbook that deep-links **real UI routes only**. No fake demo
data, no inject-library claims, no CNAPP replacement, no score inflation.

| | |
|---|---|
| **Help guide id** | `competitive-walk` |
| **Help title** | Competitive walk: BAS refuse + Wiz co-exist |
| **Continuous hub label** | **Sales walk (honest)** (`/continuous`) |
| **Source** | `apps/web/src/lib/product-help.ts` |

### Ordered UI routes

1. `/scopes` — Authorize verified scope (nothing measures without it)
2. `/engines` — Engine Lab honesty (Ready / Needs install / Not available; not competitive inject BAS)
3. `/controls` — Atomic dry-run only; refuse full multi-vector BAS bake-offs
4. `/findings` — Active queue (default; measured exposure, not noise)
5. `/attack-paths` — Measure path hops CTA (FullyMeasured only with edge receipts)
6. `/continuous` — Scorecard honesty note (specialist Scaffold/gated rows stay Scaffold)

**Battlecard anchors:** [A. BAS refuse](#a-category-home--aevctem-proof-vs-full-bas-libraries) + [B. Wiz co-exist](#b-wiz--never-replace-cnapp-p19-2).  
**Recipe name remains:** **Wiz → Attack Path → Remediation** (inventory context → path proof → Fixed re-verify).

---

## A. Category home — AEV/CTEM proof (vs full BAS libraries)

**Peers in a wrong bake-off:** Cymulate, AttackIQ, Picus (scenario-library demos)

| | |
|---|---|
| **Our home** | AEV / CTEM **proof layer** — measure authorized exposure, prove paths, re-measure Fixed |
| **Their home** | Large multi-vector scenario libraries (malware, phishing, DNS exfil, ransomware packs) |
| **Win** | Honesty architecture: measured vs heuristic labels; Fixed demotion; signed runner path; evidence packs |
| **Lose if** | You open with “show me your scenario catalog” or “simulate ransomware live” |
| **SE rule** | Walk away from full-BAS RFPs or partner with a BAS library vendor — do not fake parity |

**Talk track (30s):**

> We are not a scenario-library BAS product. We prove which exposures are real on
> your verified scope and whether the fix held. If you need continuous inject
> libraries for every vector, keep or buy a BAS platform — and put Periscan on
> top for path proof and Fixed honesty.

**Out of scope as success criteria:** live malware, phishing, DNS-exfil, ransomware
emulation, competitive inject-and-measure library parity.

---

## B. Wiz — never “replace CNAPP” (P19-2)

| | |
|---|---|
| **Wiz owns** | Cloud inventory, toxic combinations, DSPM-class CNAPP graph depth |
| **Periscan owns** | Validation of which paths/exposures are real; fix verification; hybrid/external proof; MSSP multi-tenant evidence |
| **Integration truth** | Real Wiz connector: authorized resources + security issues as **normalized CNAPP exposure context** (read-only; does not change Wiz or cloud config) |
| **Recipe name** | **Wiz → Attack Path → Remediation** |

**Talk track:**

> Bring Wiz inventory and issues into Periscan. We prove which path is real and
> whether the fix held. We do not replace Wiz as your CNAPP.

**Do not build / do not sell:** CNAPP parity UI, toxic-combo depth war with Wiz,
“rip out Wiz” ROI stories.

**Marketplace / deck line (allowed):**

> Imports authorized Wiz cloud resources and security issue summaries as
> normalized exposure context. Complements CNAPP — does not replace it.

---

## C. Tenable — validation on top of RBVM (P19-3)

| | |
|---|---|
| **Tenable owns** | Vulnerability system of record, scan coverage, asset vuln lifecycle |
| **Periscan owns** | Validated exploitability prioritization, path correlation, measured fix verification |
| **Integration truth** | Real Tenable VM connector (assets + vuln summaries as exposure context); scan-file importers exist in connectors (`.nessus`/CSV/SARIF) — productize API/UI path without claiming RBVM replacement |
| **Recipe name** | **Tenable finds → Periscan validates & verifies fix** |

**Talk track:**

> Tenable finds. Periscan validates which matter and re-proves the fix. Keep
> Tenable as your vulnerability management system of record.

**Do not say:** “Replace Tenable,” “you don’t need RBVM,” “we are a scanner.”

**Marketplace / deck line (allowed):**

> Imports authorized Tenable Vulnerability Management asset and vulnerability
> summaries as normalized exposure context. Validation and fix-proof sit on top
> of RBVM — they do not replace it.

---

## D. Pentera / Horizon3 — weaponize the safety floor (P19-4)

| | |
|---|---|
| **They sell** | Autonomous / continuous pentest narratives and break-in demos |
| **We sell** | Governed continuous validation with a **hard floor that never lifts** |
| **Deny-list phrase** | “Not automated pentest.” |
| **Positive phrase** | “Governed continuous validation with a hard floor that never lifts.” |

**Hard floor (feature, not apology):** no destructive tests, no real exfil, no
persistence, no credential theft, no uncontrolled exploit chaining
([SECURITY_BOUNDARIES.md](../../SECURITY_BOUNDARIES.md)).

**Win themes:**

- Every run policy-decided and audited  
- Fixed only on measured revalidation (can demote)  
- MSSP multi-tenant isolation  
- Evidence packs for customers and auditors  

**Lose if:** You demo kill-chain theater or claim live offensive kit parity
(Metasploit/Caldera/SharpHound live remain blocked by product policy).

**Talk track:**

> We deliberately do not sell automated pentest. We sell continuous, authorized
> validation you can run in production with a safety floor that never lifts —
> and proof that a fix actually closed the exposure.

---

## E. Nuclei / ProjectDiscovery — authorized workflow, not template count (P19-5)

| | |
|---|---|
| **Commodity trap** | Anyone can run Nuclei cheaper. Competing on template count is a race to the bottom. |
| **Periscan owns** | **Authorized External PoA**: verified scope → policy preview → bounded safe profiles → normalized findings → remediation → retest ledger |
| **Integration truth** | `nuclei.external_exposure_safe` is liveSupported with allowlisted profiles only (safe-baseline / fingerprint / headers / metadata). Raw template branding stays out of primary UX. |
| **Recipe name** | **Authorized External PoA** |

**Talk track:**

> We do not sell “we run Nuclei.” We sell authorized external proof of attackability
> with policy gates, bounded profiles, and Fixed only on re-measure.

**Never lead with:** template count, “scan depth,” ProjectDiscovery Cloud parity.

---

## F. Microsoft Defender — gravity; complement only (P19-6)

| | |
|---|---|
| **Defender owns** | Endpoint / email telemetry, Secure Score narratives, XDR incident plane for M365-centric estates |
| **Periscan owns** | Cross-stack path proof, external PoA, hybrid/non-MS assets, MSSP multi-client evidence, Fixed honesty |
| **Integration truth** | Real Defender XDR + Defender for Office 365 connectors (read-only Advanced Hunting / control observations). Never SIEM/XDR replacement. |
| **Demo path** | **Defender technique → control coverage → Missed / Logged-only** (observe, do not claim prevention) |

**Talk track:**

> Keep Defender for endpoint and email telemetry. Periscan proves cross-stack paths,
> external exposure, and whether the fix held — including assets Microsoft does not own.

**Never say:** “Microsoft CTEM replacement,” “rip out Defender,” “Secure Score alternative.”

---

## G. AttackIQ / Cymulate — one proven inject loop beats library theater (P19-12)

| | |
|---|---|
| **Their buying moment** | “We fired a technique and your control did/didn’t fire.” |
| **Periscan today** | Ambient telemetry correlation is real (SCV **Partial**). Closed inject→measure is hard-disabled on control-plane (`control_live_execution_disabled`). Atomic is dry-run import, not live inject BAS. |
| **Governed safe stimulus** | `POST /api/v1/control-sources/stimuli` — single-technique-family benign marker path with policy decision, rate limit, hashed evidence (not a 5,000-scenario library). |
| **Matrix** | SCV Partial · DRV Scaffold — do not claim BAS Wave inject parity |

**Talk track:**

> One governed inject loop with receipts beats five thousand simulated scenarios without
> Fixed honesty. We will not open a full multi-vector library bake-off.

**Demo rule:** Show control observation + (when enabled) one safe stimulus verdict. Walk away from malware/phishing/DNS-exfil library scorecards.

---

## H. Compliance packs — evidence attach, not certification (P19-13)

| | |
|---|---|
| **Product truth** | Matrix **Scaffold**: generic evidence-linking packs; no full control→requirement catalog |
| **Allowed claim** | “We attach measured validation evidence to framework claims.” |
| **Denied claim** | “We make you DORA / NIS2 / PCI / SOC 2 compliant.” |

**SE rule:** Demote Compliance in demos until matrix moves to Partial with real control maps. Nav hint must not imply attestation product.

---

## I. Logos / customer references / “who uses you?” (P12-6 / PERISCAN-431)

Wartime buyer diligence will ask for logos, peer references, or ARR proof.
**Current product truth: zero named customer references.** Do not invent them.

| | |
|---|---|
| **Honest status** | Public references = **0**; production partners with reference-call consent = **0 evidenced**; Wave/MQ market presence = **Fail** |
| **In-product surface** | Trust & Safety → Market presence readiness (`publicReferenceCount: 0`, MQ/Wave gates Fail) |
| **Denied** | Logo walls, “Trusted by Fortune…”, anonymized F500 fiction, demo/lab as customer proof, “Leaders-ready” from internal scorecard |
| **Allowed** | Confidential design-partner stage; labeled sample/lab proof path; schedule reference when written consent exists |

**Talk track (buyer asks for logos/refs):**

> We are in a confidential design-partner stage. We do not publish customer names
> or logos until we have a production deploy and written reference permission.
> We can show a labeled sample or lab proof path today, and we will schedule a
> reference call when partners consent. We will not invent customers for the
> evaluation.

**SE kill list until G2+G3 in the reference pack:**

- Case study one-pagers with fictional companies  
- Logo slides or “join leading enterprises” copy  
- Treating internal verify / Playwright / seed demo as peer proof  
- Paying for MQ/Wave inquiry spend while references = 0  

Source checklist: `docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md`.

---

## I. Integration depth vs breadth (P19-14)

| | |
|---|---|
| **Honesty rule** | Publish **connectable vs planned vs not-connectable** counts — never lead with raw catalog size as depth. |
| **Top-N GA depth priority** | Wiz, Tenable, CrowdStrike, Splunk/Sentinel, Jira/ServiceNow, AWS/Azure/GCP, Defender, GitHub |
| **KPI** | Operational depth on the top stack — not “N integrations” on a slide |

Marketplace UI surfaces depth badges from `connectable` + `executionReadiness`. Planned/mock never looks Ready.

---

## J. Quick phrase sheet

| Situation | Say | Never say |
|---|---|---|
| Category | AEV/CTEM proof layer | Full BAS platform |
| Wiz customer | Bring inventory; we prove path + fix | Replace CNAPP / Wiz alternative |
| Tenable customer | Validate on top of RBVM; prove Fixed | Replace Tenable / VM |
| Defender customer | Cross-stack path + external PoA; keep Defender | Rip out Defender / MS CTEM replacement |
| Nuclei / EASM | Authorized External PoA with policy + Fixed ledger | We run Nuclei / more templates |
| AttackIQ bake-off | One proven inject loop + receipts | Full BAS library parity |
| Compliance RFP | Attach measured evidence to claims | We make you DORA/PCI compliant |
| Integrations slide | Connectable vs planned depth | 100+ deep native integrations |
| Pentera bake-off | Hard floor; governed validation; Fixed honesty | Automated pentest / we break in deeper |
| BAS library RFP | Partner or walk; refuse library bake-off | Multi-vector BAS parity |
| Analyst MQ | Visionaries until AtE refs + multi-hop + SCV | Leaders without execution proof |
