# Exhaustive 20-Persona Panel — Executive Synthesis

**Date:** 2026-07-29  
**Findings:** **398** unique (parsed) · **73 P0 · 176 P1 · 129 P2 · 20 P3**  
**Types:** improvement 212 · bug 89 · feature 54 · request 23 · innovation 16 (+ misc)  
**Zoo-related:** **119**  
**Artifacts:**
- [triage/MASTER_BACKLOG.md](./triage/MASTER_BACKLOG.md) / [MASTER_BACKLOG.csv](./triage/MASTER_BACKLOG.csv)
- [FEATURE_ZOO_AND_UX_REORG_PLAN.md](./FEATURE_ZOO_AND_UX_REORG_PLAN.md)
- [PREVIOUS_FINDINGS_RESOLUTION.md](./PREVIOUS_FINDINGS_RESOLUTION.md)
- [personas/](./personas/) (20 full reports)

---

## 1. Overall product readiness (persona averages)

| Cluster | Approx score | Posture |
|---------|-------------:|---------|
| Trust / honesty architecture | 3.8–4.2 | Protect |
| Operator daily UX | 2.5–3.4 | Design partner |
| Feature zoo / IA | 2.0–2.8 | Blocker for 5.0 |
| Enterprise buy (CISO/Buyer) | 2.0–2.8 | NO-BUY PoR |
| Market (Gartner/Forrester) | Visionary / Contender · no Wave | Refs + Execute |
| Security depth | 3.4 conditional | Hard gates open |
| Competitive | 3.1 complement | Own AEV/proof |

**5.0 across the board requires:** organized product (zoo collapse) + hero loop complete + measured multi-hop default + score honesty + enterprise trust pack + design-partner references — not more features.

---

## 2. Epic triage (Plane ticket groups)

Every finding maps to one epic. Full list in MASTER_BACKLOG; epics for execution.

| Epic | Theme | P0 count (approx) | First milestones |
|------|--------|-------------------:|------------------|
| **E1** | Feature zoo & navigation | high | Rail ≤10; Labs; dual-nav kill; Findings rename |
| **E2** | Auth recovery & first-run | high | Public reset/invite/verify; `?next=`; one onboarding spine |
| **E3** | Proof-loop vocabulary & IA | med | One stage language; radar legend only |
| **E4** | Hero loop handoffs | high | Rem ticket on detail; path→rem; Active findings queue |
| **E5** | Findings operationalization | high | Fingerprint/occurrence UI; owner semantics; FP default filter |
| **E6** | Measured paths & evidence integrity | high | No Measured forge; hop→receipt; no fixture Validated |
| **E7** | Security hard gates | high | Policy re-eval; mTLS default; DNS rebind; force-MFA path |
| **E8** | Engine Lab & OSS license truth | high | Dual-truth SPDX; accept→install→verify; strip GPL from default images |
| **E9** | Design system & a11y | med | Nested main; one severity map; modal focus trap |
| **E10** | Continuous validation & runners | med | Schedule notify/history; runner readiness on Home |
| **E11** | API & webhooks truth | med | Emit/remove policy.denied; OAS security; pagination honesty |
| **E12** | Controls inject honesty | med | SCV/DRV roadmap or demote Leading scores |
| **E13** | Enterprise trust & GTM | med | Trust pack; SCIM decision; scorecard freeze; ICP refs |
| **E14** | Ontology cleanup | low–med | ValidationState partition; graph nodeType; threat merge |
| **E15** | Competitive positioning | — | Sales allow/deny lists; demo script ≤10 screens |

---

## 3. Top 25 ship-blockers (must plan now)

| # | ID samples | Action |
|---|------------|--------|
| 1 | P02-1, P04 recovery | Public auth recovery routes |
| 2 | P02-2 | Honor login `?next=` |
| 3 | P01-2, P16-1 | Single `<main>` landmark |
| 4 | P01-1 | One design system |
| 5 | P07-3, P14-10, E1 | Autonomous → Labs; rail slim |
| 6 | P02-3, P07-4 | Unify proof-loop vocabulary |
| 7 | P02-4, P02-5 | One first-run spine |
| 8 | P14-3, P06-7 | Create ticket on rem detail |
| 9 | P18-1, P18-2 | Findings fingerprint UI + Active default |
| 10 | P18-3 | Fix “unowned” view semantics |
| 11 | P03-1 | Stop client Measured forge on receipt apply |
| 12 | P03-2 | Re-evaluate policy + scope at mission start |
| 13 | P05-1 | Ban fixture → Validated |
| 14 | P05-2 | Hop measure must complete to receipt or honest non-queue |
| 15 | P04-1, P12-4 | Measured multi-hop as default demo journey |
| 16 | P15-1–4 | License dual-truth + image redistribution |
| 17 | P20-1 | Webhook policy.denied truth |
| 18 | P20-2, P20-4 | OpenAPI pagination + securitySchemes |
| 19 | P01-3 | Findings status color honesty |
| 20 | P01-5 | Fix dead `/scopes` links |
| 21 | P11-2, P11-3 | Missions nav vs snapshot-only page |
| 22 | P10-1, P03-4 | Runner mTLS default-on prod |
| 23 | P12-3, P13-2 | Scorecard vs matrix honesty pass |
| 24 | P08-9, P12-6 | Design-partner references program |
| 25 | Engine Lab plan | Ship `/engines` Phase 0–2 |

---

## 4. Feature zoo resolution (summary)

Full plan: [FEATURE_ZOO_AND_UX_REORG_PLAN.md](./FEATURE_ZOO_AND_UX_REORG_PLAN.md)

**Rule:** No new primary-nav item without removing one or putting it in Labs.

**Primary rail (10):** Home · Validate · Paths · Findings · Remediation · Evidence · Reports · Schedule · Connect · Engines  

**Labs:** Swarm · MCP · Gateway · Operators · Engagements · Workflows · Registries · multi-threat streams until Operations hub  

---

## 5. Path to 5.0 (program)

| Horizon | Outcome |
|---------|---------|
| **30 days** | E1+E2+E4+E9 P0s; scorecard freeze notes; license metadata truth |
| **60 days** | E5+E6 measured/findings; Engine Lab UI; webhook/API honesty |
| **90 days** | E7 prod security posture; E10 continuous; E13 trust pack + 1–2 design partners |
| **120 days** | Blind rescore; Wave-ready story (still may lack market presence); CISO pilot gates |

---

## 6. Already excellent (do not break)

- Measured vs Heuristic claim language; Fixed only after retest  
- Denied never queued; safety floor; signed runner tasks  
- External validation workbench (authorized, bounded)  
- Empty-tenant GetStarted; Needs you direction  
- Planned ≠ connectable connectors  
- API-first breadth + operationId discipline  
- Ticket close → ClosedWithoutEvidence (not Fixed)  

---

## 7. Ticket creation policy

| Severity | Plane |
|----------|--------|
| Epic E1–E15 | One issue each + description linking MASTER_BACKLOG |
| All P0s | Individual or batched issues under epic (min: Top 25 as discrete issues) |
| P1 | Backlog issues grouped by epic (or CSV import) |
| P2–P3 | Tracked in MASTER_BACKLOG; promote on epic pull |

Full 398 remain the system of record in-repo; Plane holds execution epics + P0 work.
