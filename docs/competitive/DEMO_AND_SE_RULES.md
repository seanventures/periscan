# Demo script order & SE rules

Companion to [POSITIONING.md](./POSITIONING.md) and [BATTLECARDS.md](./BATTLECARDS.md).
Product demo fixtures remain in [demo/DEMO_SCRIPT.md](../../demo/DEMO_SCRIPT.md)
(sample/fixture only). Offensive / simulation product guardrails:
[DEMO_OFFENSIVE_GUARDRAILS.md](./DEMO_OFFENSIVE_GUARDRAILS.md) (P05-18).

---

## 1. Mandatory demo spine (proof loop)

**Always in this order.** Do not open with scenario libraries, swarm, or
multi-vector theater. Full Wave screen list: `demo/DEMO_SCRIPT.md` (P13-14).

1. **Home / Needs you** — `/dashboard`  
2. **Connect honesty** — `/integrations` (Beta/Planned; no Production theater)  
3. **Verified authorized scope** — `/scopes` (policy gate / verified target; no scan without scope)  
4. **Validate** — `/missions` or external workbench  
5. **Measured probe or path edge** — `/attack-paths`; label measured vs heuristic  
6. **Finding → remediation** — `/findings` → `/remediation`  
7. **Fixed honesty** — re-verify; Fixed can demote if re-measure fails  
8. **Evidence pack** — evidence IDs, redaction, no raw scanner dump as the primary UX  

**Never open in default Wave path:** `/swarm`, `/mcp`, `/model-gateway`,
`/workflows`, `/operators`, `/engagements`, AI-apps/NHI theater.

Optional only after the spine lands:

- Wiz inventory → path → remediation recipe  
- Tenable finding → validate → re-verify fix  
- Control observation / rule coverage (honest: not full inject BAS unless stimulus path is live)
- Engines readiness checklist (`/engines`) if asked how tools install

**Sales walk (honest)** — single BAS refuse + Wiz co-exist playbook (help id
`competitive-walk`; Continuous hub panel on `/continuous`). Ordered real
routes only: `/scopes` → `/engines` → `/controls` → `/findings` →
`/attack-paths` → `/continuous` (scorecard honesty). See
[BATTLECARDS.md § Product walk](./BATTLECARDS.md#product-walk--bas-refuse--wiz-co-exist-honest).
No fake demo data, no inject claims.

---

## 2. SE walk-away / partner rules

| RFP / eval shape | Action |
|---|---|
| Full multi-vector BAS library bake-off (malware, phishing, DNS exfil, ransomware live) | **Walk or partner** with a BAS library vendor. Do not fake parity. |
| “Replace our Wiz / CNAPP” | **Reframe** to co-exist recipe; if buyer requires CNAPP rip-out, disqualify. |
| “Replace Tenable / RBVM” | **Reframe** to validation-on-top; keep Tenable as system of record. |
| “Automated pentest / autonomous red team” | **Deny-list.** Offer governed continuous validation + hard floor. |
| “Show Leading scores / FP-free” | Use coverage matrix language only; no Leading export without rescore. |
| “Show min-cut choke points / cheapest control for 40 paths” | Demo **path breakers** + approximate ranking; do not claim XM Cyber/Wiz graph science. |
| “Auto-mitigate / push the WAF rule” | Demo **auto-revalidate** (plan → re-measure). No config push until productized. |
| “Always-on continuous BAS” | Demo schedules + revalidation + signal triggers; avoid continuous without qualifier. |

---

## 3. Named recipes (use exact names in decks)

### Wiz → Attack Path → Remediation

1. Connect Wiz (read-only inventory + issues).  
2. Correlate into attack path / exposure findings.  
3. Prioritize with validation/exploitability state.  
4. Remediate → measured re-verify → evidence pack.  

**Line:** Bring Wiz inventory; we prove which path is real and whether the fix held.

### Tenable finds → Periscan validates & verifies fix

1. Connect Tenable VM (and/or authorized scan import when productized).  
2. Normalize vulns as exposure context (not raw scanner UX).  
3. Validate exploitability / path where modules support.  
4. Fix verification mission; Fixed only on re-measure.  

**Line:** Tenable finds; Periscan validates and proves the fix. RBVM stays the system of record.

---

## 4. UI / product copy checks for SEs

Before a customer-facing demo, confirm product strings do **not** claim:

- Full breach-and-attack simulation platform  
- Replace CNAPP / replace RBVM  
- Continuous multi-vector BAS with malware/email/exfil live vectors  
- Automated pentest  

Internal safety level `BASLite` is a policy ceiling, not a marketing category.

---

## 5. Analyst / executive briefing order

1. Category home: AEV/CTEM proof ([POSITIONING.md](./POSITIONING.md) §1)  
2. Honesty architecture (measured/heuristic, Fixed demotion)  
3. Co-exist matrix (Wiz, Tenable, Microsoft)  
4. Safety floor vs automated pentest  
5. Honest gaps from coverage matrix (SCV/DRV/multi-hop as Partial/Scaffold where true)  
6. Leaders path = Execute (references + multi-hop + inject loops), not more vision docs  
