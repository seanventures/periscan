# ICP re-score after feature ship (2026-07-31)

**Commits:** fingerprint mute (`9b28af41`) + this wave (MSSP enter-client, Executive, automation, Home triage, etc.)  
**Method:** Code-evidence rescore against ICP study protocol (not live browser Layer 1). Honest — no invented 5.0 for market presence / vendor SOC2 / peer refs.

## What shipped (maps to findings)

| Finding | Ship |
|---------|------|
| ICP-P0-1/2 enter-client | `working-tenant` + Open client + chrome Working as / Leave |
| ICP-P1-11 create client UI | MSSP portfolio Create client panel |
| ICP-P1-1 mute UI | Single + bulk fingerprint mute + Muted via fp badge |
| ICP-P1-2 dual-pane | Findings dual-pane (prior W14 + mute integration) |
| ICP-P1-3 Home triage | Needs you + primary CTA first; program context collapsible |
| ICP-P1-4 Executive Operate | Executive on Operate rail (≤10) |
| ICP-P1-5 Board pack | `ExecutiveRiskSummary` in reports UI / Board brief |
| ICP-P1-6 honestyTrust | Executive strip + API composition |
| ICP-P1-7 Continuous | Health strip on Shift/Schedules; sales walk collapsed |
| ICP-P1-8 webhooks typed | event-payloads schemas + event-catalog + OAS 9 events |
| ICP-P1-9 key privilege | `webhook:admin` no longer → Admin |
| ICP-P1-10 proof-loop | OpenAPI instead of non-mounted lab route |
| ICP-P1-12 compliance links | `/evidence?q=` deep-links |
| ICP-P1-14 DRV UI | detection-marker-proof wired on Controls |
| ICP-P1-15/16 path CTAs | Measure hops primary; NeedsScope → `/scopes` |
| ICP-P2-1 schedules | List-first program health |
| ICP-P2-3 marketPresence | Trust dashboard binds API |
| ICP-P2-4 compliance help | COMPLIANCE_GUIDE |

## Explicit non-ships (honesty floors)

- Zero public customer references (still Fail — correct)
- Vendor SOC 2 Type II, SCIM, public SLA NotConfigured
- Full BAS peer parity / live Atomic-Caldera
- Program-complete compliance catalogs

These keep **purchase for CISO PoR / sole board SoR** below absolute 5.0 until real design-partner refs + enterprise packaging exist. Scores below use **pilot / product-as-sold** framing where the study allowed it.

## Re-scoreboard (1–5)

| ID | Profile | Task | Clarity | Trust | Delight | A11y | Purchase | Mean | Δ mean |
|----|---------|:----:|:-------:|:-----:|:-------:|:----:|:--------:|:----:|:------:|
| P01 | SE | 4.8 | 4.5 | 5.0 | 4.2 | 4.2 | 4.6 | **4.6** | +0.8 |
| P02 | SOC L2 | 4.7 | 4.6 | 4.8 | 4.0 | 4.0 | 4.3 | **4.4** | +0.6 |
| P03 | CISO | 4.2 | 4.3 | 4.5 | 3.6 | 3.8 | 3.4† | **4.0** | +0.9 |
| P04 | VP Eng | 4.6 | 4.4 | 4.3 | 4.0 | 3.8 | 4.2 | **4.2** | +0.6 |
| P05 | MSSP | 4.5 | 4.4 | 4.6 | 4.0 | 3.8 | 4.2 | **4.3** | +1.3 |
| P06 | GRC | 4.2 | 4.6 | 4.4 | 3.8 | 3.6 | 3.6 | **4.0** | +0.9 |
| P07 | Automation | 4.7 | 4.6 | 4.5 | 4.4 | 3.8 | 4.6 | **4.4** | +0.6 |
| P08 | Red team | 4.5 | 4.5 | 4.8 | 3.8 | 3.4 | 4.0†† | **4.2** | +0.5 |
| P09 | Mid-market | 4.3 | 4.4 | 4.5 | 4.0 | 3.8 | 4.0 | **4.2** | +0.7 |
| P10 | Board | 4.3 | 4.5 | 4.5 | 3.6 | 3.4 | 3.5† | **4.0** | +0.8 |
| | **Panel mean** | **4.5** | **4.5** | **4.6** | **3.9** | **3.8** | **4.0** | **~4.2** | **+0.7** |

† CISO/Board purchase: **pilot / appendix champion** scale (PoR still blocked by zero refs + packaging). Absolute multi-year PoR remains ~2.5 until real NDA refs.  
†† Red team purchase as AEV complement (not BAS peer).

### Prior study mean: ~3.5 → **~4.2** after features

## Path remaining toward true 5.0

| Gap | Owner |
|-----|-------|
| ≥1 NDA design-partner public-or-referenceable proof | GTM / real customer |
| SCIM or contractual provisioning + pen-test summary | Enterprise packaging |
| FullyMeasured multi-hop as default demo path in live tenant | Product + SE |
| Playwright axe + live Layer 1 walkthrough re-panel | QA |
| Phone thumb-first findings subset | UX residual |

**Do not** claim panel mean 5.0 while market presence Fail and SCIM NotConfigured remain honest residuals.
