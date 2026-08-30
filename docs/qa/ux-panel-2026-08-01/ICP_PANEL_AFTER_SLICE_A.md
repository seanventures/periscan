# ICP re-panel after continuous-loop Slice A (2026-08-01)

**Method:** Code + acceptance E2E evidence re-panel against `docs/qa/ux-panel-2026-07-31/ICP_STUDY_PROTOCOL.md`.  
**Not** live browser Layer 1. **Not** invented market presence / Type II / peer logos / BAS peer parity / certification.  
**Branch tip:** `overnight-loop` @ `e868c538`  
  (`docs(qa): continuous loop Slice A — rescore 71.6→73.6 (E2E-backed)`)  
**Analyst scorecard after Slice A:** **73.6** (1383 pts; strict ≥4.0 rows **45**; Strong+Leading **74**) — see `docs/qa/SLICE_A_RESCORE_2026-08-01.md`, `docs/qa/CONTINUOUS_LOOP_STATE.json`, `docs/qa/analyst-scorecard.json`.

**Prior ICP boards (same protocol):**

| Board | Pilot panel mean | Tip family |
|-------|-----------------:|------------|
| Study (baseline) | ~3.5 | post UX-W1…W17 |
| After features | ~4.2 | mute + MSSP + Executive wave |
| Toward-5 / Swarm E | ~4.5–4.7 | residual polish |
| Independent BOARD V2 | **~4.9** | `b39d6e27` micro-pass |
| **This panel (Slice A)** | **~4.9** | E2E S1–S6 + rescore 73.6 |

---

## What Slice A actually changed for ICP

Slice A is **product-path E2E completeness + honesty-preserving analyst rescore**, not a UX craft micro-pass. Prior BOARD already sat near the pilot ceiling (~4.9). This panel asks: *does acceptance-backed multi-hop / FFV / controls / compliance / SSO / ASV / platform change any persona job or purchase score?*

| Swarm | E2E proof | ICP profiles most helped |
|-------|-----------|--------------------------|
| **S1** | Multi-hop → FullyMeasured → claim-safe export; Find-Fix-Verify closed loop; hop auto-apply UI | P01, P03, P08, P09, P10 |
| **S2** | DRV marker, DNS canary (`measured:false` without live), SCV observe, inject hard-disabled | P02, P08 |
| **S3** | Compliance snapshot → Met/Partial/Unmet → govern → export disclaimer; catalog expand (still partial) | P06, P03, P10 |
| **S4** | SSO OIDC + SAML session; SCIM **501 / NotConfigured** honesty | P04, P03 |
| **S5** | ASV/EASM discover under verified scope; CSV fix-verify; connector Production gate fail-closed (**0 Production**) | P01, P09, P04 |
| **S6** | Webhooks lifecycle HMAC; ITSM ≠ Fixed; runner lease; CV `priorDiffs`; MSSP isolation | P05, P07, P02 |

### Explicit non-ships (honesty floors still intact)

| Residual | Effect on this panel |
|----------|----------------------|
| `publicReferenceCount = 0` | **P03/P10 `por_purchase` capped ≤ 2.9** (scored **2.8 / 2.9**) |
| SCIM / JIT **NotConfigured** (501) | Enterprise diligence residual; does **not** unlock PoR |
| Vendor SOC 2 Type II **NotConfigured** | Procurement checklist stays amber |
| Live inject / Wave D / full BAS | P08 purchase remains AEV framing only |
| Live multi-hop on enrolled runner + real range | FullyMeasured is **acceptance-backed**, not default demo-tenant lab |
| Live Layer 1 browser + Lighthouse | A11y / delight absolute 5.0 cells still capped |
| Connector catalog **0 Production** | Correct fail-closed; no invented partner readiness |
| Compliance catalogs still partial | P06 not GRC SoR / not cert |

---

## Strict scoring rules (this panel)

1. **Mean column uses `pilot_purchase`.** `por_purchase` is honesty-only and is **not** averaged into panel mean.  
2. **P03 / P10 `por_purchase` ≤ 2.9 while `publicReferenceCount = 0`.**  
3. **Do not invent panel mean 5.0** while SCIM / Type II / public SLA / live L1 residuals remain.  
4. **P08 purchase** = AEV / continuous-measure only — never BAS peer.  
5. **Operator 5.0 cells only where UI + acceptance (or unit) truly support** the JTBD.  
6. **No score inflation from analyst 73.6 alone** — analyst matrix ≠ ICP buyer panel. Modest Task/Trust lifts only where S1–S6 closed a persona residual.  
7. Prior BOARD already scored craft near-ceiling; **do not re-award the same UI micro-pass as new 5.0s**.

---

## Full 10-profile scoreboard (1–5) — pilot means

**Purchase is split:**

- **`pilot_purchase`** — scoped paid pilot / SE champion / design-partner week.  
- **`por_purchase`** — multi-year platform-of-record / sole board SoR / full client-book MSSP contract.

| ID | Profile | Task | Clarity | Trust | Delight | A11y | pilot_purchase | por_purchase | Mean (pilot) | Δ vs BOARD (~4.9) | Δ vs study (~3.5) |
|----|---------|:----:|:-------:|:-----:|:-------:|:----:|:--------------:|:------------:|:------------:|:-----------------:|:-----------------:|
| P01 | SE | **5.0** | **5.0** | **5.0** | **4.9** | **4.9** | **5.0** | 4.4 | **5.0** | 0.0 | +1.2 |
| P02 | SOC L2 | **5.0** | **5.0** | **5.0** | 4.8 | 4.8 | 4.9 | 3.9 | **4.9** | 0.0 | +1.1 |
| P03 | CISO | **5.0** | 4.9 | **5.0** | 4.7 | 4.6 | **5.0** | **2.8**† | **4.9** | +0.1 | +1.8 |
| P04 | VP Eng | **5.0** | **5.0** | **5.0** | 4.8 | 4.7 | 4.9 | 3.9 | **4.9** | 0.0 | +1.3 |
| P05 | MSSP | **5.0** | **5.0** | **5.0** | 4.8 | 4.7 | **5.0** | 4.0 | **4.9** | 0.0 | +1.9 |
| P06 | GRC | **5.0** | 4.9 | 4.9 | 4.8 | 4.8 | 4.8 | 3.3 | **4.9** | +0.1 | +1.8 |
| P07 | Automation | **5.0** | **5.0** | **5.0** | 4.8 | **4.9** | **5.0** | 4.3 | **5.0** | 0.0 | +1.2 |
| P08 | Red team | 4.9 | 4.9 | **5.0** | 4.8 | 4.7 | 4.6†† | 1.5††† | **4.9** | +0.1 | +1.2 |
| P09 | Mid-market | 4.9 | 4.9 | 4.9 | 4.9 | 4.8 | 4.9 | 3.7 | **4.9** | 0.0 | +1.4 |
| P10 | Board | **5.0** | 4.9 | 4.9 | 4.7 | 4.6 | 4.9 | **2.9**† | **4.9** | +0.1 | +1.7 |
| | **Panel mean** | **5.0** | **4.9** | **5.0** | **4.8** | **4.8** | **4.9** | **~3.5** | **~4.9** | **~+0.0** | **+1.4** |

† **P03/P10 `por_purchase` honesty-capped by zero public refs** + enterprise packaging residuals (SCIM / vendor Type II / pen-test NotConfigured). Scored **2.8 / 2.9** (≤ 2.9 floor). **Do not market PoR.**  
†† AEV / continuous-measure complement (not BAS peer).  
††† BAS peer replacement — refuse floor only; excluded from pilot mean.

### Dimension means (pilot-framing)

| Dimension | Mean | vs BOARD |
|-----------|:----:|:--------:|
| Task | **5.0** | +0.1 (S1 FullyMeasured + FFV + S3 pack E2E) |
| Clarity | **4.9** | 0.0 |
| Trust | **5.0** | 0.0 (already ceiling; S1–S6 reaffirm) |
| Delight | **4.8** | 0.0 (no live L1 craft pass) |
| A11y | **4.8** | 0.0 (no live L1 axe/Lighthouse) |
| pilot_purchase | **4.9** | 0.0 |
| **Overall (pilot)** | **~4.9** | **~0.0** (ceiling hold + selective Task/buyer lifts) |
| por_purchase (reported only) | **~3.5** | +0.1 (SSO/MSSP isolation E2E; **not** PoR unlock) |

### Operator cluster (P01 / P02 / P05 / P07 / P09)

| Cluster | Pilot mean | Mean 5.0? |
|---------|:----------:|:---------:|
| P01 SE | **5.0** | **Yes** |
| P02 SOC L2 | **4.9** | No — pilot honesty &lt;5.0 (not SIEM SoR) |
| P05 MSSP | **4.9** | No — live multi-tenant L1 not run (A11y 4.7) |
| P07 Automation | **5.0** | **Yes** |
| P09 Mid-market | **4.9** | No — phone L1 residual |
| **Operator cluster mean** | **4.9** | **2 of 5 at 5.0** |

**Operator all ≥ 4.9:** **met** (unchanged).  
**Do not invent a third operator mean 5.0** without live L1.

---

## What moved (and what deliberately did not)

### Moved (evidence-backed)

| Change | Evidence | Score effect |
|--------|----------|--------------|
| FullyMeasured multi-hop + claim-safe export | `E2E_SWARM_S1_MULTI_HOP_FFV.md`; `multi-hop-fully-measured-report-flow.test.ts` | P01 Trust/Task reaffirmed 5.0; **P03 Task → 5.0**; **P10 Task → 5.0**; SE `por` 4.3→**4.4** (platform eng still later) |
| Find-Fix-Verify (ticket never Fixed) | S1 FFV + S6 ITSM acceptance | P01/P02/P05 Trust reaffirmed; Fixed law remains unfair advantage |
| Hop auto-apply UI | `HopLaunchResultCard` + auto-apply acceptance | P01 Delight held at 4.9 (less manual receipt thrash) |
| Control-plane honesty E2E | S2 DRV / DNS / observe / inject refuse | **P08 Task/Clarity → 4.9**; Trust stays 5.0; pilot **4.6** (AEV only) |
| Compliance catalog expand + export E2E | S3 | **P06 Task → 5.0**, Delight **4.8**, pilot **4.8**; still not cert / not SoR |
| SSO full path E2E | S4 OIDC + SAML | **P04 Trust → 5.0**; SCIM remains NotConfigured (no PoR unlock) |
| ASV discover under verified scope | S5 | P09 Task held; connector 0 Production honesty |
| Webhooks + runners + MSSP isolation E2E | S6 | P07 mean 5.0 held; **P05 por 3.9→4.0** (isolation proven; full channel PMF still not claimed) |

### Did **not** move (correct)

| Residual | Why |
|----------|-----|
| Panel mean 5.0 | Half the panel still 4.9; L1 + GTM blocks |
| P03/P10 `por_purchase` | **refs=0** → capped **2.8 / 2.9** |
| P08 as BAS peer | Safety refuse; `por` **1.5** |
| P02 as SOC SoR | Proof layer next to SIEM only |
| P06 as GRC SoR / cert path | Partial catalogs + disclaimer law |
| A11y/Delight absolute 5.0 cells | Live L1 + Lighthouse not re-run |
| Market presence | Still Fail at zero public refs |

---

## Per-profile justification (Slice A)

### P01 — SE (Alex) · mean **5.0**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | JTBD 1–4: measure every hop → FullyMeasured acceptance; FFV closed; auto-apply safety net |
| Clarity | 5.0 | Measure hops primary; Needs you + dual-pane (prior board) |
| Trust | 5.0 | Claim-safe FullyMeasured labels + Fixed-only-via-verification acceptance |
| Delight | 4.9 | Auto-applied hop receipts reduce thrash; phone storm still P2-dense |
| A11y | 4.9 | Prior dual-pane keyboard/axe; no live Lighthouse this slice |
| pilot | 5.0 | Champion yes — proof loop now acceptance-backed end-to-end |
| por | 4.4 | Platform eng later; +0.1 from multi-hop E2E completeness |

### P02 — SOC L2 (Jordan) · mean **4.9**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Shift triage + ContinuousValidation `priorDiffs` honesty + disposition |
| Clarity | 5.0 | Start triage + continuous health strip (prior) |
| Trust | 5.0 | **Polled …** honesty; ITSM close ≠ Fixed (S6) |
| Delight | 4.8 | No new shift craft this slice |
| A11y | 4.8 | Dual-monitor L1 not re-run |
| pilot | 4.9 | Daily proof layer next to SIEM — deliberately &lt;5.0 SoR framing |
| por | 3.9 | Not SOC SoR |

### P03 — CISO (Sam) · mean **4.9** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Board narrative + **FullyMeasured multi-hop export** + pilot checklist at refs=0 |
| Clarity | 4.9 | SecurityLeader → `/executive`; Build board pack |
| Trust | 5.0 | Zero-ref banner + procurement checklist never invents Type II; SSO path real |
| Delight | 4.7 | One-screen + print; no craft wave this slice |
| A11y | 4.6 | Print CSS; tablet boardroom L1 not run |
| pilot | 5.0 | **Scoped paid pilot packaging complete enough to champion** with S1 proof story |
| por | **2.8** | **Capped** — refs=0 + SCIM/Type II/pen-test NotConfigured |

### P04 — VP Eng (Riley) · mean **4.9**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | FirstMeasured TTV strip + runner-optional honesty + SSO provisioned path |
| Clarity | 5.0 | Single first-run spine; Labs off default demo path |
| Trust | 5.0 | SSO E2E + SCIM honesty 501 (no fake provisioning) + NotConfigured commercial surfaces |
| Delight | 4.8 | Calm progress |
| A11y | 4.7 | GetStarted axe residual without live L1 |
| pilot | 4.9 | Eng budget pilot yes |
| por | 3.9 | No unrestricted platform program; SCIM residual |

### P05 — MSSP (Morgan) · mean **4.9**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Enter-client + batch open + create; **isolation acceptance (S6)** |
| Clarity | 5.0 | Working as chrome |
| Trust | 5.0 | Tenant-bound findings invisible to parent/sibling (S6) |
| Delight | 4.8 | Empty portfolio create expand |
| A11y | 4.7 | Live multi-tenant L1 not run — blocks mean 5.0 |
| pilot | 5.0 | Enter-client book ops pilot |
| por | 4.0 | Isolation E2E +0.1; full channel PMF **not** claimed |

### P06 — GRC (Casey) · mean **4.9** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Snapshot → Met/Partial/Unmet → govern → export disclaimer (S3 E2E) |
| Clarity | 4.9 | Reports → Compliance; sticky export |
| Trust | 4.9 | Not cert / not audit opinion; Met only with evidence kinds |
| Delight | 4.8 | Catalog expanded (DORA/NIS2/PCI still **partial**) — not absolute 5.0 |
| A11y | 4.8 | Status focus rings + empty landmark (prior) |
| pilot | 4.8 | Constrained audit-support packs |
| por | 3.3 | Not GRC SoR / not cert (+0.1 from pack E2E completeness only) |

### P07 — Automation (Avery) · mean **5.0**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | OpenAPI + event catalog + **webhook lifecycle HMAC rotate/redrive (S6)** + runner lease |
| Clarity | 5.0 | automation-readme + schema fields + least-privilege banner |
| Trust | 5.0 | No fictional rate/SLA; webhook:admin least privilege |
| Delight | 4.8 | curl + rotate/redrive |
| A11y | 4.9 | Section `aria-labelledby` (prior board) |
| pilot | 5.0 | Integrate yes |
| por | 4.3 | Boring contracts maturing (+0.1 lifecycle E2E) |

### P08 — Red team (Quinn) · mean **4.9** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.9 | Path measure + DRV marker + DNS canary E2E; **not** live inject |
| Clarity | 4.9 | ProofStageStrip + calm inject-disabled banner |
| Trust | 5.0 | BAS refuse + estimate-only counterfactual + benign_marker_only claims |
| Delight | 4.8 | Inject refuse as product strength (info tone) |
| A11y | 4.7 | Expanded axe + reduced-motion; no live L1 |
| pilot | 4.6 | AEV / continuous measure (+0.1 from S2 closed loops) |
| por | 1.5 | BAS peer replacement refuse |

### P09 — Mid-market (Jamie) · mean **4.9**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.9 | First-run + Monday + FFV + ASV under verified scope |
| Clarity | 4.9 | One spine + filter collapse |
| Trust | 4.9 | Claim-safe + Fixed law |
| Delight | 4.9 | Monday density + single empty remediation CTA |
| A11y | 4.8 | 44px sticky disposition; phone L1 not re-run |
| pilot | 4.9 | Design-partner week |
| por | 3.7 | Not replace full Monday stack |

### P10 — Board advisor (Dana) · mean **4.9** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Board narrative + print + pack + **claim-safe FullyMeasured path language in export** |
| Clarity | 4.9 | Leadership posture primary |
| Trust | 4.9 | Pilot banner + no logos at refs=0 |
| Delight | 4.7 | Print boardroom palette |
| A11y | 4.6 | Print CSS; tablet L1 not run |
| pilot | 4.9 | Conditional board appendix after pilot |
| por | **2.9** | **Capped** — sole board SoR blocked by refs=0 |

---

## Champion / purchase matrix (Slice A)

| ID | Pilot decision | PoR decision |
|----|----------------|--------------|
| P01 | **Yes — champion** (5.0 mean / pilot) | Platform eng later (por 4.4) |
| P02 | **Yes daily** as proof layer next to SIEM | Not SOC SoR |
| P03 | **Yes scoped paid pilot** (5.0 pilot packaging) | **No PoR** (refs=0 → **2.8**) |
| P04 | **Yes pilot eng budget** (SSO path real) | No unrestricted platform yet |
| P05 | **Yes enter-client book ops pilot** | Full channel PMF not claimed (por 4.0) |
| P06 | **Yes constrained audit packs** | Not GRC SoR / not cert |
| P07 | **Yes integrate** REST + webhooks + runners (**5.0 mean**) | Boring contracts maturing |
| P08 | **Yes as AEV** | **No as BAS peer** (1.5) |
| P09 | **Yes design-partner week** | Not replace Monday stack yet |
| P10 | **Conditional board appendix / pilot pack** | **No sole board SoR** (refs=0 → **2.9**) |

---

## Residual findings (still real after Slice A)

| ID | Severity | Owner | Note |
|----|----------|-------|------|
| ICP-P0-3 | Program / GTM | GTM | CISO/board PoR blocked by **zero refs** + packaging — product honesty correct |
| ICP-P1-13 | Honest partial | Product | Compliance catalogs thicker (S3) but still partial — caps absolute GRC 5.0 |
| ICP-P2-5 | Polish | Product | Phone storm tables still dense |
| — | QA | QA | **Live Layer 1** browser + Lighthouse not re-run this panel |
| — | Lab | SE / lab | FullyMeasured multi-hop not **default demo tenant** on live range (acceptance ≠ seed demo) |
| — | Enterprise | Packaging | SCIM inbound, vendor Type II, pen-test summary **NotConfigured** |
| — | Connectors | Partnerships | **0 Production** catalog — correct fail-closed |
| — | Framing | Product | Not SIEM SoR / not full BAS (correct refuse) |

---

## Panel not 5.0 — remaining blockers

### Code / lab shippable (product can close without customer logos)

| Block | Effect |
|-------|--------|
| Live L1 browser + axe/Lighthouse re-panel | Unlocks absolute a11y/delight 5.0 cells; third operator mean 5.0 candidate |
| Seed / demo tenant with FullyMeasured multi-hop by default | Buyer walk residual; SE demo delight |
| Thicker compliance catalogs without inventing Met | P06 mean 5.0 candidate |
| Live multi-tenant enter-client L1 | P05 A11y → mean 5.0 candidate |
| Enrolled runner multi-hop on measured lab range | Closes “acceptance-only FullyMeasured” residual |

### GTM / packaging (not forceable in UI)

| Block | Effect |
|-------|--------|
| `publicReferenceCount = 0` | P03/P10 **por_purchase ≤ 2.9** (2.8 / 2.9); sole board SoR refuse |
| SCIM / JIT NotConfigured | Diligence residual on enterprise pilot kickoff |
| Vendor SOC 2 Type II NotConfigured | Procurement checklist stays amber |
| No public SLA / pen-test summary path | Buyer diligence residual |
| Not SIEM SoR / not full BAS | Correct framing floors for P02 / P08 |

---

## Honest summary for dispatch

| Signal | Value |
|--------|-------|
| **Analyst scorecard (Slice A)** | **73.6** (was 71.6) |
| **Panel mean (pilot-framing)** | **~4.9 / 5** |
| **Operator cluster mean** | **4.9 / 5** (all ≥ 4.9) |
| **Profiles mean = 5.0** | **2** — **P01 + P07** (unchanged count) |
| **P03 pilot / por** | **5.0 / 2.8** (pilot packaging up; **por capped by refs=0**) |
| **P10 pilot / por** | **4.9 / 2.9** (**por capped by refs=0**) |
| **P08 BAS peer por** | **1.5** (refuse) |
| **BOARD → Slice A panel** | ~4.9 → **~4.9** (ceiling hold; Task dim +0.1; buyer pilot packaging up for P03/P10) |
| **Study → Slice A** | ~3.5 → **~4.9** (+1.4) |
| **Panel mean = 5.0?** | **No** |
| **Any invented refs / Type II / Production connectors / live inject?** | **No** |

### Why panel mean stayed ~4.9 (one line)

Prior BOARD already priced UI craft near the pilot ceiling; Slice A **closed acceptance-backed proof loops** (FullyMeasured multi-hop, FFV, SSO, compliance pack, webhooks, MSSP isolation) that lift **Task** and **CISO/Board pilot packaging**, but **zero public refs, SCIM/Type II residuals, and no live L1** correctly keep overall pilot mean at **~4.9** and **PoR purchase honesty-capped**.

### Relationship: analyst 73.6 vs ICP ~4.9

| Lens | What it measures | Slice A read |
|------|------------------|--------------|
| Analyst 94-row ASV/CTEM | Matrix readiness across product/function/ux/ops | **73.6** — E2E-backed rescore, honesty caps held |
| ICP 10-profile pilot panel | Buyer/operator job + purchase confidence | **~4.9** — near pilot ceiling; **not** PoR-ready |

Do **not** cite analyst 73.6 as “ICP 5.0” or as PoR readiness.

---

## Artifacts

| Path | Role |
|------|------|
| `docs/qa/ux-panel-2026-08-01/ICP_PANEL_AFTER_SLICE_A.md` | **This panel** |
| `docs/qa/ux-panel-2026-07-31/ICP_STUDY_PROTOCOL.md` | Profiles + rubric |
| `docs/qa/ux-panel-2026-07-31/ICP_RESCORE_5_BOARD.md` | Prior independent board (~4.9) |
| `docs/qa/SLICE_A_RESCORE_2026-08-01.md` | Analyst rescore 71.6→73.6 |
| `docs/qa/CONTINUOUS_LOOP_STATE.json` | Loop state (slice A, score 73.6) |
| `docs/qa/E2E_FEATURE_SWARM_2026-07-31.md` | S1–S6 journey index |
| `docs/qa/E2E_SWARM_S1_MULTI_HOP_FFV.md` … `S6` | Per-swarm acceptance proof |

---

*Slice A ICP re-panel complete. Pilot-framing panel **~4.9**. Operator cluster **4.9**. Means **5.0: P01 + P07**. P03/P10 por **2.8 / 2.9** (refs=0). No invented 5.0s. Trust remains the unfair advantage; PoR still requires real references.*
