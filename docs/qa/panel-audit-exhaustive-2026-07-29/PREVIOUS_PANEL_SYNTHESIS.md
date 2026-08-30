# 20-Persona Full Product Panel — Executive Synthesis

**Date:** 2026-07-29  
**Scope:** Full product surface audit (UI, UX, security, market, GTM, competitive, a11y, API)  
**Method:** 20 parallel agentic reviewers, code/docs-grounded, read-only  
**Product scorecard (internal):** 79.1/100 · target 95.9 · 94 ASV/CTEM rows  
**Live:** https://app.periscan.com  

Reports directory: `docs/qa/panel-audit-2026-07-29/`  
(Some individual persona files were written by agents; this synthesis is the single source of panel consensus.)

---

## One-line verdict

**Periscan has a rare, defensible honesty architecture and a real proof-loop core — trapped inside a feature zoo that is not yet enterprise buy-ready or Wave-includable.**

Ship as **design-partner / controlled pilot**, not as platform-of-record for a 5k-employee CTEM program.

---

## Panel roster & scores

| # | Persona | Verdict / score | Buy / use posture |
|---|---------|-----------------|-------------------|
| 01 | UI Engineer | **3/5** | One chrome, kill dual systems |
| 02 | UX Researcher | **3/5** | Unify loop vocabulary; fix recovery routes |
| 03 | Security Engineer | **B+ / conditional pass** | Design-partner OK; harden mTLS/SSRF/RLS |
| 04 | CISO (5k emp) | **NO-BUY** as PoR | Paid pilot only after hard gates |
| 05 | Red Teamer | **Replace: No · Complement: Yes** | Continuous proof, not RT |
| 06 | Blue Team Lead | **B/B+ as validation plane** | Not a SIEM |
| 07 | Steve Jobs | **Delight 4/10 · Zoo** | Cut to one hero sentence |
| 08 | Ben Horowitz | **Wartime honesty, peacetime GTM shell** | Freeze surface, sell wedge |
| 09 | Einstein | **B− spine · C full ontology** | Unify taxonomies |
| 10 | Cisco CTO | **B− enterprise readiness** | Hybrid runner strong; scale unproven |
| 11 | Palantir CTO | **3.7/5** | Fund ontology, kill swarm theater |
| 12 | Gartner Analyst | **Visionary · Execute ~2.9** | AEV/CTEM proof, not full BAS |
| 13 | Forrester Wave | **Contender ~3.0 · Wave: No** | Refs + measured path first |
| 14 | Security Practitioner | **~3.3/5** | Monday rail + ticket on rem detail |
| 15 | OSS Advocate | **~7.3/10** | Fix module license dual-truth P0 |
| 16 | Accessibility | **~3.2/5** | Nested main, focus traps |
| 17 | Enterprise Buyer | **~3.1/5 RFP** | SCIM/SLA/SOC pack gaps |
| 18 | SOC Analyst | **~4.0/5 as triage queue** | Surface fingerprints/occurrence |
| 19 | Competitive Intel | **Complement, don't replace** | Co-exist Wiz/Tenable/MS |
| 20 | API Platform Eng | **~3.9/5** | Headless possible; webhook gaps |

**Consensus readiness band:** design-partner / Contender tech · **not** Leader · **not** Wave-includable · **not** 5k PoR buy.

---

## What is excellent (protect forever)

These themes appeared across security, blue team, red team, Jobs, Einstein, Gartner, API:

1. **Proof not claims** — Measured vs Heuristic, weakest-hop, Fixed only after retest  
2. **Safety floor** — verified scope, denied-never-queued, outbound signed runner, kill switch  
3. **External validation workbench** (Slice 2) — real authorized loop  
4. **Needs you / work queue** direction on dashboard  
5. **API-first breadth** + OpenAPI operationId discipline  
6. **MSSP multi-tenant architecture**  
7. **Connector honesty** after Slice 1 (Planned ≠ connectable)  
8. **Empty-tenant Get Started** (no wall of zeros)  
9. **Demo labeled sample** (not sold as customer proof)  
10. **Anti-fabrication** (swarm/kill-chain random metrics removed)

---

## Critical findings outside the known Slice 3–10 plan

These are **unknown unknowns or under-scoped** relative to the existing 95+ plan.

### P0 — Trust / ship blockers

| ID | Finding | Source personas | Why outside known plan |
|----|---------|-----------------|------------------------|
| U-01 | **Auth recovery routes not public** (`/reset-password`, `/accept-invite`, `/verify-email` gated by middleware) | UX | Ops/auth, not ASV score rows |
| U-02 | **Three competing proof-loop vocabularies** (product stages vs CTEM radar vs marketing tagline) | UX, Jobs, Practitioner | IA, not score plan |
| U-03 | **~35–50 nav destinations / dual nav configs** (`primary-nav` vs `app-navigation`) | UI, Jobs, Practitioner, UX | Product packaging |
| U-04 | **Module license dual-truth** — many modules `Proprietary` while tool catalog has real OSS licenses → wrong license risk | OSS | Compliance/legal |
| U-05 | **Hop measure CTA dead vs plan** (Eligible vs NeedsApproval mismatch) | Prior QA panel, UI | Slice 3 residual |
| U-06 | **Correlation stamping Measured without receipts** / receipt durability | Prior QA + Slice 3 residual | In flight; must stay green |
| U-07 | **Scorecard inflation vs code matrix** (Leading rows that are Partial/Scaffold) | CISO, Gartner, Competitive | Score governance |
| U-08 | **`policy.denied` webhook subscribed but never emitted** | API | Integration truth |

### P1 — Completeness / experience / competitiveness

| ID | Finding | Personas |
|----|---------|----------|
| U-09 | Dual first-run: 3-step GetStarted vs 9-milestone Getting Started (latter off primary nav) | UX, Practitioner |
| U-10 | Login ignores `?next=` deep links | UX |
| U-11 | Findings UI ignores fingerprints / occurrenceCount / root-cause | SOC, UI, Practitioner |
| U-12 | Ticket create missing on remediation detail (exists on snapshot) | Practitioner, Blue |
| U-13 | Nested `<main>` + incomplete focus traps / uneven focus rings | A11y, UI |
| U-14 | Dual design systems (legacy globals vs Tailwind kit) | UI |
| U-15 | Severity color maps disagree across pages | UI |
| U-16 | Autonomus/Swarm/MCP/Model Gateway on primary rail before proof loop is inevitable | Jobs, Horowitz, Palantir |
| U-17 | Fixture modules returning `Validated` (e.g. physical sims) | Red team |
| U-18 | Module certification report stale (~40 vs ~71 modules) | Red team |
| U-19 | No SCIM/JIT, group→role, force-MFA policy, status page, live billing | Enterprise buyer, CISO |
| U-20 | RLS on writes not default reads; mTLS optional; external DNS rebinding residual | Security eng |
| U-21 | Webhook catalog thin (no remediation.verified); pagination docs lie | API |
| U-22 | Signal fingerprint missing correlationKeys at build time → false merge | Prior QA |
| U-23 | Threat center/feed/signal/validation-ops fragmentation | Jobs, Blue, SOC |
| U-24 | Compliance packs thin + score claims Leading | CISO, Competitive |
| U-25 | No customer references → Wave/MQ market presence fail | Forrester, Gartner |

### P2 — Competitive & market

| ID | Finding |
|----|---------|
| U-26 | Not BAS library peer (Cymulate/AttackIQ) — must own AEV/proof narrative |
| U-27 | Not cloud graph peer (Wiz) — co-sell/integrate |
| U-28 | Not RBVM peer (Tenable) — validation layer on top |
| U-29 | Not auto-pentest peer (Pentera) — refuse live kill-chain |
| U-30 | Nuclei SaaS cheaper for pure external scan — compete on workflow/proof |
| U-31 | Microsoft platform gravity — complement, don't replace |

---

## Known plan alignment (Slices) — still correct

Panel consensus **validates** the existing plan; do not abandon it:

| Slice | Panel confirmation |
|-------|-------------------|
| 3 Measured paths | **P0 competitive + CISO gate** — still the flagship gap |
| 4 Findings ops | Dedup/fingerprint/UI occurrence — SOC + Practitioner |
| 5 Control effectiveness | Blue + AttackIQ competitive pressure |
| 6 Assets & Scope | Practitioner "authorized targets home" |
| 7 Evidence explorer | CISO auditor grade |
| 8 Continuous validation ops | Practitioner schedules depth |
| 9 Scaffold rows 2/16/21/22/26/28 | Red team: keep gated, partner |
| 10 Release qual + blind rescore | Gartner/Forrester/CISO hard gate |

---

## The single product essence (Jobs + PRD)

> **See the path. Break the cheapest link. Re-run. Hand someone proof it is closed.**  
> Only say what you measured. Only close what you re-tested. Only run where authorized.

Everything that does not accelerate that loop is **Labs / settings / later**.

---

## Recommended backlog (merged, ordered for next 30–60 days)

### Wave A — Trust & packaging (outside pure score rows, highest ROI)

1. **Public auth recovery routes** + honor `?next=` after login  
2. **One proof-loop vocabulary** across radar, nav, help, marketing  
3. **Persona primary rail** (~8–10 items): Dashboard · Missions · Paths · Findings · Remediation · Schedules · Runners · Integrations · Reports · Evidence (+ Admin)  
4. **Hide Autonomous/MCP/Swarm** behind Labs until loop is boring  
5. **Single nav source**; delete dual config  
6. **Module license metadata fix** (match catalog SPDX)  
7. **Kill Eligible/NeedsApproval hop CTA deadlock**  
8. **Findings UI: fingerprint, occurrenceCount, Active queue default**  
9. **Create ticket on remediation detail**  
10. **Webhook truth:** emit or remove `policy.denied`; add `remediation.verified`

### Wave B — Core score plan (continue)

11. Slice 3 residual: correlation never stamps Measured without receipts; hopKey durable (in flight)  
12. Slice 4 #7: one remediation per fingerprint + owner/SLA  
13. Slice 5 control effectiveness single model wired across surfaces  
14. Slice 6 Assets & Scope primary workspace  
15. Slice 7 Evidence explorer (claim → artifact → integrity)

### Wave C — Enterprise / market gates (pilot → buy)

16. SCIM decision or sales-assisted provisioning SLA  
17. Trust pack: subprocessors, DPA path, pen-test summary process  
18. Runner mTLS default-on for prod; external post-resolve SSRF  
19. Five ICP first-session studies (protocol already exists)  
20. Blind independent rescore of 94 rows; freeze inflated Leading claims  
21. Customer reference design partners before Wave/MQ pursuits

### Explicitly do **not** prioritize (panel consensus)

- Full BAS library parity (Cymulate/AttackIQ)  
- Live Caldera/Atomic/SharpHound/Metasploit production  
- CNAPP parity with Wiz  
- Self-serve payment processor before invoice design partners  
- More AI/swarm surfaces before hero loop  
- Expanding connector catalog without GA depth on top-N stack

---

## Competitive position (one slide)

| Category | Position |
|----------|----------|
| AEV / CTEM **proof layer** | **Home** — own it |
| Full multi-vector BAS | Partial / honest substitute |
| Cloud CNAPP graph | Integrate (Wiz), don't replace |
| RBVM | Integrate (Tenable), don't replace |
| Auto-pentest | Complement human RT + safety floor |
| External template SaaS | Wrap Nuclei, compete on proof workflow |
| Microsoft-native CTEM | Complement cross-stack / MSSP |

**Hypothetical MQ:** Visionary tech, lagging Ability to Execute.  
**Wave:** Contender product, **not includable** without references.

---

## Joy / usability / completeness summary

| Dimension | Panel consensus |
|-----------|-----------------|
| Functionality (core loop) | Present, uneven measured depth |
| Completeness | Wide surface, shallow many cages |
| Experience | Strong microcopy; weak IA |
| Joy | ~4/10 — respect without rapture |
| Usability (Monday morning) | Needs you good; nav kills it |
| Competitiveness | Wins honesty; loses library demos |
| Feature gaps | Paths, inject-BAS, findings ops, enterprise GTM |
| Incomplete features | Recovery auth, hop CTA, rem ticket, a11y, licenses |

---

## Ship / no-ship gates before next customer push

| Gate | Status needed |
|------|---------------|
| Claim language + Fixed honesty green | Keep forever |
| Hop measure journey works end-to-end | Required for Slice 3 story |
| Correlation does not wipe measured hops | Required |
| Auth recovery works unauthenticated | Required for any self-serve |
| Primary rail ≤ ~12 items for New tenants | Required for ICP |
| Module licenses accurate | Required for OSS credibility |
| No Leading score without evidence | Required before sales decks |
| `pnpm verify` green | Required |

---

## Files in this audit package

| File | Status |
|------|--------|
| `SURFACE_INVENTORY.md` | Written |
| `01-ui-engineer.md` | Written |
| `06-blue-teamer.md` | Written |
| `08-ben-horowitz.md` | Written |
| `09-einstein.md` | Written |
| `11-palantir-cto.md` | Written |
| `13-forrester-analyst.md` | Written |
| `15-oss-advocate.md` | Written |
| `16-accessibility.md` | Written |
| `18-soc-analyst.md` | Written |
| `00-EXECUTIVE-SYNTHESIS.md` | **This file** |
| 02–05, 07, 10, 12, 14, 17, 19, 20 | Full text returned by agents; re-persist on demand from session transcripts if needed |

---

## Bottom line for the next push

**Do not push more product surface.**  

Push **fixes that make the existing heart inevitable**:

1. Auth recovery + deep links  
2. Nav / loop vocabulary collapse  
3. Hop measure CTA + receipt durability  
4. Findings occurrence UI + rem ticket handoff  
5. License metadata honesty  
6. Webhook truth  

Then continue **Slice 3–5** for score and competitive path/SCV pressure — with a standing QA panel on every PR (UI + UX + Security + Practitioner).

**CISO/Gartner/Forrester will not move until measured multi-hop is the default journey, score inflation is fixed, and at least one real design-partner reference exists.**
