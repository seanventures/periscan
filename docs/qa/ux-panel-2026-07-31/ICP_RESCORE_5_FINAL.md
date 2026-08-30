# ICP re-score FINAL — 5.0 loop close (2026-07-31)

**Method:** Code-evidence re-panel against `ICP_STUDY_PROTOCOL.md` + residual walk of prior ICP studies and Swarm A–E surfaces.  
**Not** live browser Layer 1. **Not** invented market presence / Type II / peer logos.  
**Branch tip:** `overnight-loop` @ `ca4f7449`  
  (`feat(web): ICP 5.0 swarm C — P03 CISO, P04 VP Eng, P10 Board advisor`)  
**Prior loop scoreboard:** `ICP_RESCORE_TOWARD_5_LOOP.md` (~4.5 pilot mean @ Swarm E / `397b8602` family).

### Focused tests (this pass)

```
pnpm --filter @periscan/web test -- \
  findings-workbench mssp-portfolio executive-overview a11y-smoke get-started \
  blue-shift primary-nav compliance trust-safety working-tenant monday-mode \
  live-update-pill reports-workbench admin-console-webhooks
→ 14 files / 103 tests passed
```

---

## Explicit honesty floors (do not violate)

1. **Do not claim 5.0 on `por_purchase` for P03 or P10 while `publicReferenceCount = 0`.**  
   Market presence remains **Fail** (correct). PoR / sole board SoR is honesty-capped until ≥1 real NDA-referenceable design partner exists.  
   **Floor this pass:** P03/P10 `por_purchase` **≤ 3.0** (scored **2.8 / 2.9**).
2. **Do not claim panel mean 5.0** while SCIM inbound, vendor SOC 2 Type II, public SLA remain **NotConfigured** / honest residual, and live L1 browser + Lighthouse have not re-run.
3. **Do not claim BAS peer parity** for P08. Purchase scores below are **AEV / continuous measure** framing only.
4. **Operator 5.0 cells only where code truly supports them** (wired UI + tests), not aspirational craft.
5. **Mean column uses `pilot_purchase`.** `por_purchase` is reported for honesty and is **not** averaged into the panel mean.

---

## What shipped since Swarm E rescore (~4.5)

| Swarm / commit | ICP target | Evidence |
|----------------|------------|----------|
| **P08** `397b8602` | Red team | Sticky `ProofStageStrip`; BASLite → limited safe stimulus; counterfactual estimate-only; axe smoke expand; `prefers-reduced-motion` |
| **Residual** `82a903d5` | P01 / P02 / P09 | Findings dual-pane ArrowUp/Down + Esc; phone sticky disposition + 44px bulk bar; Home Needs you; Shift **Start triage**; LiveUpdatePill **"Polled …"** (never Live/SIEM) |
| **Swarm B** `6e1f0a5a` | P05 / P06 / P07 | MSSP batch **Open first selected** + Enter card + empty Create client + mobile Working as + Leave ConfirmDialog; GRC Met/Partial/Unmet drill + captions/`scope`; Reports→Compliance; automation-readme + webhook `eventDataSummaries` schema fields |
| **Swarm C** `ca4f7449` | P03 / P04 / P10 | Executive **Board narrative** one-screen + `@media print` boardroom palette; Print board narrative; Build board pack → `/reports?pack=board`; **pilot success criteria banner** when `publicReferenceCount=0`; SecurityLeader first-run → `/executive`; Trust **procurement fill checklist** (DPA/BAA/subprocessors/pen-test/vendor SOC2 honest NotConfigured); GetStarted **TTV strip** + api-reference; Labs never on default demo path |
| **Swarm E** `65f71769` | Docs + thrash | Prior toward-5 scoreboard + findings/MSSP/compliance/executive test thrash fixes |

### Still open (score caps)

| Residual | Cap |
|----------|-----|
| Zero public customer references | **por_purchase** P03/P10 ≤ 3.0 |
| SCIM / JIT NotConfigured | Enterprise packaging / PoR |
| Vendor SOC 2 Type II NotConfigured | Buyer diligence pack |
| Compliance catalogs partial (honest thin) | GRC SoR / cert path |
| Live L1 browser + Lighthouse not re-run | A11y / delight absolute 5.0 cells |
| Not SIEM SoR / not full BAS | P02 / P08 framing |
| Phone storm tables still dense (P2) | Delight residual |

---

## Full 10-profile scoreboard (1–5)

**Purchase is split:**

- **`pilot_purchase`** — scoped paid pilot / SE champion / design-partner week.  
- **`por_purchase`** — multi-year platform-of-record / sole board SoR / full client-book MSSP contract.

**Mean column uses `pilot_purchase`** (pilot-framing overall).

| ID | Profile | Task | Clarity | Trust | Delight | A11y | pilot_purchase | por_purchase | Mean (pilot) | Δ vs study (~3.5) | Δ vs after-features (~4.2) | Δ vs Swarm E (~4.5) |
|----|---------|:----:|:-------:|:-----:|:-------:|:----:|:--------------:|:------------:|:------------:|:-----------------:|:--------------------------:|:-------------------:|
| P01 | SE | **5.0** | 4.9 | **5.0** | 4.7 | 4.8 | **5.0** | 4.3 | **4.9** | +1.1 | +0.3 | +0.1 |
| P02 | SOC L2 | **5.0** | 4.9 | **5.0** | 4.6 | 4.7 | 4.8 | 3.9 | **4.8** | +1.0 | +0.4 | +0.1 |
| P03 | CISO | 4.8 | 4.8 | **5.0** | 4.5 | 4.5 | 4.8 | **2.8**† | **4.7** | +1.6 | +0.7 | +0.4 |
| P04 | VP Eng | 4.9 | 4.8 | 4.6 | 4.5 | 4.3 | 4.7 | 3.7 | **4.6** | +1.0 | +0.4 | +0.2 |
| P05 | MSSP | **5.0** | 4.9 | 4.9 | 4.6 | 4.5 | 4.9 | 3.9 | **4.8** | +1.8 | +0.5 | +0.2 |
| P06 | GRC | 4.7 | 4.8 | 4.8 | 4.2 | 4.4 | 4.3 | 3.1 | **4.5** | +1.4 | +0.5 | +0.3 |
| P07 | Automation | **5.0** | **5.0** | 4.9 | 4.7 | 4.2 | **5.0** | 4.1 | **4.8** | +1.0 | +0.4 | +0.2 |
| P08 | Red team | 4.8 | 4.8 | **5.0** | 4.6 | 4.6 | 4.5†† | 1.5††† | **4.7** | +1.0 | +0.5 | +0.1 |
| P09 | Mid-market | 4.8 | 4.8 | 4.8 | 4.6 | 4.5 | 4.6 | 3.6 | **4.7** | +1.2 | +0.5 | +0.2 |
| P10 | Board | 4.8 | 4.8 | 4.9 | 4.6 | 4.4 | 4.7 | **2.9**† | **4.7** | +1.5 | +0.7 | +0.4 |
| | **Panel mean** | **4.9** | **4.9** | **4.9** | **4.6** | **4.5** | **4.7** | **~3.4** | **~4.7** | **+1.2** | **+0.5** | **+0.2** |

† **P03/P10 `por_purchase` honesty-capped by zero public refs** + enterprise packaging residuals (SCIM / vendor Type II / pen-test NotConfigured).  
†† AEV / continuous-measure complement (not BAS peer).  
††† BAS peer replacement — refuse floor only; excluded from pilot mean.

### Dimension means (pilot-framing)

| Dimension | Mean |
|-----------|:----:|
| Task | **4.9** |
| Clarity | **4.9** |
| Trust | **4.9** |
| Delight | **4.6** |
| A11y | **4.5** |
| pilot_purchase | **4.7** |
| **Overall (pilot)** | **~4.7** |

### Operator cluster (P01 / P02 / P05 / P07 / P09)

| Cluster | Pilot mean |
|---------|:----------:|
| P01 SE | **4.9** |
| P02 SOC L2 | **4.8** |
| P05 MSSP | **4.8** |
| P07 Automation | **4.8** |
| P09 Mid-market | **4.7** |
| **Operator cluster mean** | **4.8** |

Operator target **≥ 4.8** is **met**. Closest-to-ceiling profile is **P01 at 4.9** — not 5.0 (delight/a11y residual + no live L1).

---

## Where 5.0 is scored (and why)

| Profile × dim | Score | Code support (JTBD clean — no remaining P0/P1 for that persona job) |
|---------------|:-----:|---------------------------------------------------------------------|
| **P01 × Task** | 5.0 | Hop Measure primary, dual-pane disposition, fingerprint mute, Home triage-first, Fixed-only-via-verification refuse — SE JTBD 1–4 complete in product UI + tests |
| **P01 × Trust** | 5.0 | Claim-safe path/finding labels, hop receipts, Polled data-age, no raw Validated when partial |
| **P01 × pilot_purchase** | 5.0 | SE would champion scoped paid pilot without remaining product P0/P1 on proof loop |
| **P02 × Task** | 5.0 | Active queue + dual-pane + Start triage + continuous health strip + schedules — SOC proof-layer JTBD 2–3,6 |
| **P02 × Trust** | 5.0 | **"Polled …" honesty** — never Live / SIEM real-time theater |
| **P03 × Trust** | 5.0 | honestyTrust strip + pilot banner at refs=0 + procurement checklist never invents Type II |
| **P05 × Task** | 5.0 | Enter-client + Open first selected + Enter card + Create client empty expand + Working as chrome — ICP-P0-1/2 closed |
| **P07 × Task** | 5.0 | OpenAPI + event catalog + typed webhooks + proof-loop.sh + automation-readme — integrator JTBD complete |
| **P07 × Clarity** | 5.0 | Event data schema fields in admin + capability matrix + external automation doc |
| **P07 × pilot_purchase** | 5.0 | Would integrate REST + webhooks + runners on current contracts |
| **P08 × Trust** | 5.0 | Inject refuse, DRV Partial honesty, BASLite demotion, counterfactual estimate-only, claim-safe badge titles |

**No profile mean is 5.0.**  
**No `por_purchase` is 5.0** for any profile.  
**P03/P10 `por_purchase` must not be marketed above ~3.0** while refs = 0.

### Why no profile mean hits 5.0

Every profile retains at least one of:

- Delight residual (phone storm density, admin density, catalog thinness).  
- A11y residual without live L1 axe/Lighthouse re-panel.  
- Pilot purchase < 5.0 for buyer personas with packaging diligence still NotConfigured.  
- P08 deliberately below 5.0 on pilot (AEV framing, not BAS peer).

Panel mean **~4.7 ≠ 5.0** — deliberate honesty.

---

## Per-profile justification (final)

### P01 — SE (Alex) · mean **4.9**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Primary JTBD 1–4 wired end-to-end |
| Clarity | 4.9 | Needs you + dual-pane; rare chrome density only |
| Trust | 5.0 | Claim + Fixed laws in UI |
| Delight | 4.7 | Keyboard dual-pane + sticky disposition; phone storm still P2-dense |
| A11y | 4.8 | Arrow/Esc, 44px touch, focus rings; no live Lighthouse |
| pilot | 5.0 | Champion yes |
| por | 4.3 | Platform eng later |

### P02 — SOC L2 (Jordan) · mean **4.8**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Shift triage + continuous + disposition without SIEM theater |
| Clarity | 4.9 | Start triage CTA; Operate rail clean |
| Trust | 5.0 | Polled honesty |
| Delight | 4.6 | Shift + dual-pane polish |
| A11y | 4.7 | Keyboard dual-pane; dual-monitor L1 not re-run |
| pilot | 4.8 | Daily proof layer next to SIEM |
| por | 3.9 | Not SOC SoR |

### P03 — CISO (Sam) · mean **4.7**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.8 | Board narrative + pack + pilot criteria — leadership JTBD 5 for pilot |
| Clarity | 4.8 | SecurityLeader → `/executive`; Build board pack primary |
| Trust | 5.0 | Zero-ref banner + honestyTrust + procurement checklist |
| Delight | 4.5 | One-screen narrative + print path |
| A11y | 4.5 | Print stylesheet; tablet boardroom L1 not run |
| pilot | 4.8 | **Excellent pilot packaging** — still short of 5.0 while SCIM/Type II/pen-test residual in diligence pack |
| por | **2.8** | **Capped** — refs=0 + NotConfigured enterprise artifacts |

### P04 — VP Eng (Riley) · mean **4.6**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.9 | TTV ETA strip from activation milestones; Labs excluded from demo spine |
| Clarity | 4.8 | api-reference footer; first-run spine single language |
| Trust | 4.6 | Honest Labs / NotConfigured commercial surfaces |
| Delight | 4.5 | Calm progress; no celebration cheese |
| A11y | 4.3 | GetStarted axe smoke pass; residual craft |
| pilot | 4.7 | Eng budget pilot yes |
| por | 3.7 | No unrestricted platform program yet |

### P05 — MSSP (Morgan) · mean **4.8**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | ICP-P0 enter-client closed; batch + Enter + create |
| Clarity | 4.9 | Working as chrome always visible mobile |
| Trust | 4.9 | Tenant-bound actions; Leave confirm |
| Delight | 4.6 | Empty portfolio auto-expands create |
| A11y | 4.5 | ConfirmDialog leave; axe MSSP empty shell |
| pilot | 4.9 | Enter-client book ops pilot |
| por | 3.9 | Full channel PMF not claimed |

### P06 — GRC (Casey) · mean **4.5**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.7 | Status drill + evidence deep-links + pack export; catalogs still thin (ICP-P1-13) |
| Clarity | 4.8 | Reports → Compliance discoverability |
| Trust | 4.8 | Not cert / not audit opinion copy |
| Delight | 4.2 | Thin catalog residual |
| A11y | 4.4 | Captions + `scope=col/row` |
| pilot | 4.3 | Constrained audit-support packs |
| por | 3.1 | Not GRC SoR / not cert |

### P07 — Automation (Avery) · mean **4.8**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Integrator surface complete (OpenAPI 0.3.4 + events + keys) |
| Clarity | 5.0 | automation-readme + in-product schema examples |
| Trust | 4.9 | No fictional rate/SLA; webhook:admin least privilege |
| Delight | 4.7 | curl sample + rotate/redrive |
| A11y | 4.2 | Admin console density residual |
| pilot | 5.0 | Integrate yes |
| por | 4.1 | Boring contracts still maturing |

### P08 — Red team (Quinn) · mean **4.7**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.8 | Path measure + DRV marker; not live inject |
| Clarity | 4.8 | Chrome collapse to ProofStageStrip |
| Trust | 5.0 | BAS refuse + estimate-only counterfactual |
| Delight | 4.6 | Less dual-chrome thrash |
| A11y | 4.6 | Expanded axe smoke + reduced-motion |
| pilot | 4.5 | AEV complement |
| por | 1.5 | BAS peer replacement refuse |

### P09 — Mid-market (Jamie) · mean **4.7**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.8 | First-run + Monday mode + Needs you + phone sticky disposition |
| Clarity | 4.8 | One first-run spine |
| Trust | 4.8 | Claim-safe + Fixed law |
| Delight | 4.6 | Monday density + phone polish |
| A11y | 4.5 | 44px sticky disposition |
| pilot | 4.6 | Design-partner week |
| por | 3.6 | Not replace full Monday stack yet |

### P10 — Board advisor (Dana) · mean **4.7**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.8 | One-screen board narrative + print + board pack deep link |
| Clarity | 4.8 | Leadership posture brief primary |
| Trust | 4.9 | Pilot banner + no logos at refs=0 |
| Delight | 4.6 | Print boardroom light palette |
| A11y | 4.4 | Print CSS; tablet L1 not run |
| pilot | 4.7 | Conditional board appendix after pilot |
| por | **2.9** | **Capped** — sole board SoR blocked by refs=0 |

---

## Residual findings after final loop (still real)

| ID | Severity | Note |
|----|----------|------|
| ICP-P0-3 | Program / GTM | CISO/board PoR blocked by zero refs + packaging — product honesty correct (banner + checklist) |
| ICP-P1-13 | Honest partial | Compliance catalogs still thin (few controls/framework) |
| ICP-P2-5 | Polish | Phone storm tables still dense despite sticky disposition |
| — | QA | Live Layer 1 browser walk + Lighthouse not re-run this loop |
| — | Enterprise | SCIM inbound, vendor Type II, pen-test summary NotConfigured |
| — | GTM | First real NDA design-partner reference still required for por_purchase lift |

---

## Champion / purchase matrix (final)

| ID | Pilot decision | PoR decision |
|----|----------------|--------------|
| P01 | **Yes — champion** (5.0 pilot) | Platform eng later |
| P02 | **Yes daily** as proof layer next to SIEM | Not SOC SoR |
| P03 | **Yes scoped paid pilot** (4.8 packaging) | **No PoR** (refs=0 → 2.8) |
| P04 | **Yes pilot eng budget** | No unrestricted platform yet |
| P05 | **Yes enter-client book ops pilot** | Full channel PMF not claimed |
| P06 | **Yes constrained audit packs** | Not GRC SoR / not cert |
| P07 | **Yes integrate** REST + webhooks + runners | Boring contracts still maturing |
| P08 | **Yes as AEV** | **No as BAS peer** (1.5) |
| P09 | **Yes design-partner week** | Not replace Monday stack yet |
| P10 | **Conditional board appendix / pilot pack** | **No sole board SoR** (refs=0 → 2.9) |

---

## Path remaining toward true panel 5.0 (honest)

1. **≥1 NDA design-partner public-or-referenceable proof** → lifts P03/P10 `por_purchase` ceiling (and panel narrative).  
2. SCIM or contractual provisioning SLA + pen-test summary path + vendor Type II when real.  
3. Live Layer 1 re-panel (browser + axe/Lighthouse) to unlock a11y/delight absolute 5.0 cells.  
4. Thicker compliance catalogs without inventing Met.  
5. Routine FullyMeasured multi-hop as **default demo tenant path**.  
6. Keep refuse list — never greenwash market presence, Type II, or BAS peer.

---

## Honest summary for dispatch

| Signal | Value |
|--------|-------|
| **Panel mean (pilot-framing)** | **~4.7 / 5** |
| **Operator cluster mean** | **4.8 / 5** (target ≥4.8 **met**) |
| **Any profile mean = 5.0?** | **No** (max **P01 4.9**) |
| **Any 5.0 dimension cells?** | **Yes** — P01 Task/Trust/pilot; P02 Task/Trust; P03 Trust; P05 Task; P07 Task/Clarity/pilot; P08 Trust |
| **P03/P10 por_purchase = 5.0?** | **No — capped 2.8 / 2.9 by refs=0** |
| **P03/P10 pilot_purchase** | **4.8 / 4.7** (pilot packaging excellent, not absolute 5.0) |
| **Prior study → final** | ~3.5 → **~4.7** (+1.2) |
| **After-features → final** | ~4.2 → **~4.7** (+0.5) |
| **Swarm E → final** | ~4.5 → **~4.7** (+0.2 residual polish + leadership pilot pack) |
| **Panel mean = 5.0?** | **No** — delight **4.6**, a11y **4.5**, GTM/lab blocks remain |

### GTM / lab blocks that keep the panel off 5.0

| Block | Owner | Effect |
|-------|-------|--------|
| `publicReferenceCount = 0` | GTM / design partner | P03/P10 por ≤ 3.0; board sole-SoR refuse |
| SCIM / JIT NotConfigured | Enterprise packaging | Diligence residual on pilot kickoff |
| Vendor SOC 2 Type II NotConfigured | Trust / legal ops | Procurement checklist stays amber |
| No live L1 re-panel | QA | Caps a11y/delight absolute 5.0 |
| Thin compliance catalogs | Product / modules | Caps P06 delight + SoR |
| FullyMeasured multi-hop not demo-default | SE / lab | Buyer walk residual Partial-capable |

*Final ICP re-panel complete. Pilot-framing panel **~4.7**. Operator cluster **4.8**. Trust remains the unfair advantage. No profile mean is 5.0. PoR purchase remains honesty-capped until real references exist.*
