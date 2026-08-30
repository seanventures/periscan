# ICP independent re-panel — BOARD scoreboard V2 (2026-07-31)

**Method:** Independent code-evidence re-panel against `ICP_STUDY_PROTOCOL.md`.  
Walked residual micro-pass after prior BOARD (`ICP_RESCORE_5_BOARD.md` @ `4d4b3367` / panel ~4.8) through tip polish.  
**Not** live browser Layer 1. **Not** invented market presence / Type II / peer logos / BAS peer parity.  
**Branch tip:** `overnight-loop` @ `b39d6e27`  
  (`fix(web): ICP 5.0 residual a11y/delight/trust micro-pass`)  
**Prior boards:** prior BOARD (~4.8 pilot) · `ICP_RESCORE_5_FINAL.md` (~4.7) · `ICP_RESCORE_TOWARD_5_LOOP.md` (~4.5) · study (~3.5)

### Focused tests (this pass)

```
pnpm --filter @periscan/web test -- \
  compliance get-started controls-workbench admin-console-api-keys \
  admin-console-webhooks remediation-workbench a11y-smoke \
  findings-workbench mssp-portfolio executive-overview blue-shift \
  primary-nav trust-safety
→ 13 files / 96 tests passed
```

---

## Strict scoring rules (this board)

1. **Mean 5.0 only when** all six pilot dims (Task, Clarity, Trust, Delight, A11y, pilot_purchase) are **≥ 4.8** **and** no open P0/P1 for that persona’s primary JTBD.
2. **Operator cluster target:** all ≥ 4.9; award **mean 5.0 only if code truly supports** (wired UI + tests). Do not invent.
3. **P03 / P10 `por_purchase` ≤ 2.9 while `publicReferenceCount = 0`.**
4. **Panel mean is honest.** Never force 5.0.
5. **Mean column uses `pilot_purchase`.** `por_purchase` is honesty-only and is **not** averaged into panel mean.
6. **P08 purchase** is AEV / continuous-measure framing only — never BAS peer.
7. **Panel mean = 5.0** only if every profile mean is 5.0 **or** documented as pilot panel 5.0 excluding BAS-peer por for P08 — **not met here**.

---

## What shipped this micro-pass (code-honest)

| Target | Change | Evidence |
|--------|--------|----------|
| **P06 GRC a11y/delight** | Met/status buttons: named `aria-label`, 44px hit, `focus` + `focus-visible` ring; empty compliance `role="region"` + `aria-labelledby` landmark | `compliance-workbench.tsx` + tests |
| **P08 delight** | Controls inject-disabled banner: **calm info** (`data-tone="info"`, brand border/bg) — product strength, not amber/error | `controls-workbench.tsx` + tests |
| **P07 a11y** | Admin API keys + Outbound webhooks: `Panel` `aria-labelledby` ↔ `PanelHeader` `titleId` | `admin-console.tsx`, `panel.tsx` + tests |
| **P09 empty** | Remediation empty: **single** primary CTA (`Review findings`) — no competing secondary | `remediation-workbench.tsx` + new test |
| **P04 trust** | GetStarted: **Runner optional** honesty — cloud/source Validation Snapshot needs no internal runner | `get-started.tsx` + tests |
| **Cross** | Dual-pane / findings / executive axe shells already covered in a11y-smoke (no serious axe) | `a11y-smoke.test.tsx` 11/11 pass |

### Honesty floors still intact (verified in code + tests)

| Floor | Evidence @ tip |
|-------|----------------|
| `publicReferenceCount = 0` → Fail market presence | Executive pilot banner + Trust market-presence surface |
| SCIM / JIT **NotConfigured** | Trust identity panel + procurement checklist |
| Vendor SOC 2 Type II **NotConfigured** | Procurement fill checklist never invents Type II |
| Fixed only via verification | GetStarted one-liner + executive narrative + Trust copy |
| Not SIEM SoR / not full BAS | LiveUpdatePill **Polled …**; P08 inject refuse + estimate-only counterfactual |
| Runner not required for cloud snapshot | GetStarted `get-started-runner-optional` status |

---

## Full 10-profile scoreboard (1–5)

**Purchase is split:**

- **`pilot_purchase`** — scoped paid pilot / SE champion / design-partner week.  
- **`por_purchase`** — multi-year platform-of-record / sole board SoR / full client-book MSSP contract.

| ID | Profile | Task | Clarity | Trust | Delight | A11y | pilot_purchase | por_purchase | Mean (pilot) | Δ vs prior BOARD (~4.8) | Δ vs study (~3.5) |
|----|---------|:----:|:-------:|:-----:|:-------:|:----:|:--------------:|:------------:|:------------:|:-----------------------:|:-----------------:|
| P01 | SE | **5.0** | **5.0** | **5.0** | **4.9** | **4.9** | **5.0** | 4.3 | **5.0** | 0.0 | +1.2 |
| P02 | SOC L2 | **5.0** | **5.0** | **5.0** | 4.8 | 4.8 | 4.9 | 3.9 | **4.9** | 0.0 | +1.1 |
| P03 | CISO | 4.9 | 4.9 | **5.0** | 4.7 | 4.6 | 4.9 | **2.8**† | **4.8** | 0.0 | +1.7 |
| P04 | VP Eng | **5.0** | **5.0** | 4.9 | 4.8 | 4.7 | 4.9 | 3.8 | **4.9** | +0.1 | +1.3 |
| P05 | MSSP | **5.0** | **5.0** | **5.0** | 4.8 | 4.7 | **5.0** | 3.9 | **4.9** | 0.0 | +1.9 |
| P06 | GRC | 4.9 | 4.9 | 4.9 | 4.7 | 4.8 | 4.7 | 3.2 | **4.8** | +0.1 | +1.7 |
| P07 | Automation | **5.0** | **5.0** | **5.0** | 4.8 | **4.9** | **5.0** | 4.2 | **5.0** | +0.1 | +1.2 |
| P08 | Red team | 4.8 | 4.8 | **5.0** | 4.8 | 4.7 | 4.5†† | 1.5††† | **4.8** | +0.1 | +1.1 |
| P09 | Mid-market | 4.9 | 4.9 | 4.9 | 4.9 | 4.8 | 4.9 | 3.6 | **4.9** | +0.1 | +1.4 |
| P10 | Board | 4.9 | 4.9 | 4.9 | 4.7 | 4.6 | 4.8 | **2.9**† | **4.8** | 0.0 | +1.6 |
| | **Panel mean** | **4.9** | **4.9** | **5.0** | **4.8** | **4.8** | **4.9** | **~3.4** | **~4.9** | **+0.1** | **+1.4** |

† **P03/P10 `por_purchase` honesty-capped by zero public refs** + enterprise packaging residuals (SCIM / vendor Type II / pen-test NotConfigured). Scored **2.8 / 2.9** (≤ 2.9 floor).  
†† AEV / continuous-measure complement (not BAS peer).  
††† BAS peer replacement — refuse floor only; excluded from pilot mean.

### Dimension means (pilot-framing)

| Dimension | Mean |
|-----------|:----:|
| Task | **4.9** |
| Clarity | **4.9** |
| Trust | **5.0** |
| Delight | **4.8** |
| A11y | **4.8** |
| pilot_purchase | **4.9** |
| **Overall (pilot)** | **~4.9** |

### Operator cluster (P01 / P02 / P05 / P07 / P09)

| Cluster | Pilot mean | All dims ≥4.8? | Mean 5.0? |
|---------|:----------:|:--------------:|:---------:|
| P01 SE | **5.0** | **Yes** | **Yes** |
| P02 SOC L2 | **4.9** | Yes (pilot 4.9) | No — pilot honesty &lt;5.0 (not SIEM SoR) |
| P05 MSSP | **4.9** | **No** (A11y 4.7) | No — live multi-tenant L1 not run |
| P07 Automation | **5.0** | **Yes** | **Yes** — admin section landmarks shipped |
| P09 Mid-market | **4.9** | **Yes** | No — avg &lt;5.0; phone L1 not re-run |
| **Operator cluster mean** | **4.9** | — | **2 of 5 at 5.0** |

**Operator target “all ≥ 4.9”:** **met** (all five ≥ 4.9).  
**Operator target “≥3 profiles mean 5.0 if code supports”:** **code supports P01 + P07 only.** P02 pilot honesty, P05 multi-tenant a11y L1, P09 phone L1 residual — **do not invent a third 5.0**.

---

## Where mean / dim 5.0 is scored (and why)

| Profile × dim / mean | Score | Code support (JTBD clean — no remaining P0/P1 for that persona job) |
|----------------------|:-----:|---------------------------------------------------------------------|
| **P01 mean** | **5.0** | All six dims ≥4.8; SE JTBD 1–4 complete; residual phone storm density is **P2 only**. |
| **P07 mean** | **5.0** | Task/Clarity/Trust/pilot 5.0; Delight 4.8; **A11y 4.9** after webhooks/keys `aria-labelledby` + prior least-privilege banner. No open P0/P1 for automate-integrate JTBD. |
| **P01 × Task / Clarity / Trust / pilot** | 5.0 | Hop Measure primary, dual-pane disposition, fingerprint mute, Home triage-first, claim-safe labels, Polled data-age |
| **P02 × Task / Clarity / Trust** | 5.0 | Shift + dual-pane + Start triage + continuous health; **Polled …** never Live/SIEM theater |
| **P03 × Trust** | 5.0 | Pilot checklist from real activation; honestyTrust; procurement checklist never invents Type II |
| **P04 × Task / Clarity** | 5.0 | FirstMeasuredProofCountdown + TTV strip; **runner-optional** honesty for cloud snapshot |
| **P05 × Task / Clarity / Trust / pilot** | 5.0 | Enter-client + batch Open first + create empty expand + Working-as toast + Leave confirm; tenant-bound honesty |
| **P07 × Task / Clarity / Trust / pilot** | 5.0 | OpenAPI + event catalog + least-privilege API key + section landmarks + proof-loop.sh |
| **P08 × Trust** | 5.0 | Inject refuse (calm info banner), DRV Partial, BASLite demotion, estimate-only counterfactual |

**Profiles with mean 5.0:** **P01 + P07** (was P01 only).  
**No `por_purchase` is 5.0** for any profile.  
**P03/P10 `por_purchase` must not be marketed above ~2.9** while refs = 0.

---

## Per-profile justification (board V2)

### P01 — SE (Alex) · mean **5.0**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Primary JTBD 1–4 wired; PageHeader → Run Snapshot |
| Clarity | 5.0 | Needs you + dual-pane + paths measure/inspect CTA |
| Trust | 5.0 | Claim + Fixed laws; Polled data-age |
| Delight | 4.9 | Disposition/bulk live regions; phone storm still P2-dense |
| A11y | 4.9 | Arrow/Esc keyshortcuts + dual-pane axe smoke; no live Lighthouse |
| pilot | 5.0 | Champion yes — Success = Measured + re-validate one-liner |
| por | 4.3 | Platform eng later |

### P02 — SOC L2 (Jordan) · mean **4.9**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Shift triage + continuous + disposition without SIEM theater |
| Clarity | 5.0 | PageHeader + Start triage; Active count only when bucket present |
| Trust | 5.0 | Polled honesty |
| Delight | 4.8 | Shift chrome polish |
| A11y | 4.8 | Keyboard dual-pane + 44px; dual-monitor L1 not re-run |
| pilot | 4.9 | Daily proof layer next to SIEM (not SoR → pilot &lt; 5.0) |
| por | 3.9 | Not SOC SoR |

### P03 — CISO (Sam) · mean **4.8**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.9 | Board narrative + pilot checklist + isolation diligence CTA |
| Clarity | 4.9 | SecurityLeader → `/executive`; Build board pack |
| Trust | 5.0 | Zero-ref banner + procurement checklist + order-form bullets |
| Delight | 4.7 | One-screen + print path |
| A11y | 4.6 | Print stylesheet; tablet boardroom L1 not run |
| pilot | 4.9 | Excellent pilot packaging; SCIM/Type II residual keeps &lt; 5.0 |
| por | **2.8** | **Capped** — refs=0 + NotConfigured enterprise artifacts |

### P04 — VP Eng (Riley) · mean **4.9** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | FirstMeasuredProofCountdown + TTV from real milestones |
| Clarity | 5.0 | Single first-run spine + **runner optional** for cloud snapshot + API when source connected |
| Trust | 4.9 | Runner-optional honesty + honest Labs / NotConfigured commercial surfaces |
| Delight | 4.8 | Calm progress; no celebration cheese |
| A11y | 4.7 | GetStarted axe smoke; residual craft without live L1 |
| pilot | 4.9 | Eng budget pilot yes |
| por | 3.8 | No unrestricted platform program yet |

### P05 — MSSP (Morgan) · mean **4.9**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | Enter-client closed; batch + create + open toast |
| Clarity | 5.0 | Working as chrome always visible |
| Trust | 5.0 | Tenant-bound actions; Leave confirm |
| Delight | 4.8 | Empty portfolio auto-expands create + shell enter toast |
| A11y | 4.7 | ConfirmDialog leave; **blocks mean 5.0** (live multi-tenant L1 not run) |
| pilot | 5.0 | Enter-client book ops pilot |
| por | 3.9 | Full channel PMF not claimed |

### P06 — GRC (Casey) · mean **4.8** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.9 | Status drill + sticky Export pack + PDF hand-to-auditor |
| Clarity | 4.9 | Reports → Compliance; sticky table header |
| Trust | 4.9 | Not cert / not audit opinion; export never invents packs |
| Delight | 4.7 | Sticky export + focusable status; **thin catalog residual** (ICP-P1-13) still caps absolute 5.0 |
| A11y | 4.8 | Met/status keyboard focus rings + empty landmark + captions/scope |
| pilot | 4.7 | Constrained audit-support packs |
| por | 3.2 | Not GRC SoR / not cert |

### P07 — Automation (Avery) · mean **5.0** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 5.0 | OpenAPI + events + keys + proof-loop |
| Clarity | 5.0 | automation-readme + least-privilege banner + schema fields |
| Trust | 5.0 | No fictional rate/SLA; webhook:admin least privilege |
| Delight | 4.8 | curl sample + rotate/redrive |
| A11y | 4.9 | **Webhooks + API keys sections `aria-labelledby` headings** — density residual closed for primary integrate JTBD |
| pilot | 5.0 | Integrate yes |
| por | 4.2 | Boring contracts still maturing |

### P08 — Red team (Quinn) · mean **4.8** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.8 | Path measure + DRV marker; not live inject |
| Clarity | 4.8 | ProofStageStrip collapse |
| Trust | 5.0 | BAS refuse + estimate-only counterfactual |
| Delight | 4.8 | **Inject-disabled banner calm info** (product strength, not error red) |
| A11y | 4.7 | Expanded axe smoke + reduced-motion |
| pilot | 4.5 | AEV complement only |
| por | 1.5 | BAS peer replacement refuse |

### P09 — Mid-market (Jamie) · mean **4.9** (+0.1)

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.9 | First-run + Monday mode + Needs you + phone sticky disposition |
| Clarity | 4.9 | Filters collapse on small screens; one first-run spine |
| Trust | 4.9 | Claim-safe + Fixed law one-liner |
| Delight | 4.9 | Monday density + **empty remediation single CTA** + phone filter collapse |
| A11y | 4.8 | 44px sticky disposition; empty CTA singular; live phone L1 not re-run → not mean 5.0 |
| pilot | 4.9 | Design-partner week |
| por | 3.6 | Not replace full Monday stack yet |

### P10 — Board advisor (Dana) · mean **4.8**

| Dim | Score | Notes |
|-----|:-----:|-------|
| Task | 4.9 | One-screen board narrative + print + board pack + pilot checklist |
| Clarity | 4.9 | Leadership posture brief primary; print hides Needs-you noise |
| Trust | 4.9 | Pilot banner + no logos at refs=0 |
| Delight | 4.7 | Print boardroom light palette + honesty strip keep-together |
| A11y | 4.6 | Print CSS; tablet L1 not run |
| pilot | 4.8 | Conditional board appendix after pilot |
| por | **2.9** | **Capped** — sole board SoR blocked by refs=0 |

---

## Residual findings (still real)

| ID | Severity | Owner | Note |
|----|----------|-------|------|
| ICP-P0-3 | Program / GTM | GTM | CISO/board PoR blocked by zero refs + packaging — product honesty correct |
| ICP-P1-13 | Honest partial | Product | Compliance catalogs still thin (few controls/framework) — caps P06 delight/pilot absolute 5.0 |
| ICP-P2-5 | Polish | Product | Phone storm tables still dense despite sticky disposition + Filters collapse |
| — | QA | QA | Live Layer 1 browser walk + Lighthouse not re-run this board |
| — | Enterprise | Packaging | SCIM inbound, vendor Type II, pen-test summary **NotConfigured** |
| — | GTM | GTM | First real NDA design-partner reference still required for por_purchase lift |
| — | Framing | Product | Not SIEM SoR / not full BAS (correct refuse) |
| — | MSSP a11y | QA | Live multi-tenant enter-client L1 would unlock P05 mean 5.0 candidate |

---

## Champion / purchase matrix (board V2)

| ID | Pilot decision | PoR decision |
|----|----------------|--------------|
| P01 | **Yes — champion** (5.0 pilot / mean) | Platform eng later |
| P02 | **Yes daily** as proof layer next to SIEM | Not SOC SoR |
| P03 | **Yes scoped paid pilot** (4.9 packaging) | **No PoR** (refs=0 → 2.8) |
| P04 | **Yes pilot eng budget** (runner optional honesty) | No unrestricted platform yet |
| P05 | **Yes enter-client book ops pilot** (5.0 pilot) | Full channel PMF not claimed |
| P06 | **Yes constrained audit packs** | Not GRC SoR / not cert |
| P07 | **Yes integrate** REST + webhooks + runners (**5.0 mean**) | Boring contracts still maturing |
| P08 | **Yes as AEV** | **No as BAS peer** (1.5) |
| P09 | **Yes design-partner week** | Not replace Monday stack yet |
| P10 | **Conditional board appendix / pilot pack** | **No sole board SoR** (refs=0 → 2.9) |

---

## Panel not 5.0 — remaining blockers

### Code-shippable (product can close without GTM)

| Block | Effect | Profiles |
|-------|--------|----------|
| Live L1 browser + axe/Lighthouse re-panel | Unlocks absolute a11y/delight 5.0 cells | Panel a11y/delight ceiling, P02/P05/P09 absolute 5.0, operator 5.0 count |
| Thicker compliance catalogs without inventing Met | Caps P06 delight + pilot | P06 → mean 5.0 candidate |
| Phone storm table density (P2) residual | Caps P01 delight absolute 5.0 cell | Operator cluster polish |
| Live multi-tenant enter-client L1 | Caps P05 A11y 4.7 | P05 mean 5.0 |
| FullyMeasured multi-hop as **default demo tenant path** | Buyer walk residual Partial-capable | SE/demo delight |

### GTM / lab / packaging (not forceable in UI)

| Block | Effect |
|-------|--------|
| `publicReferenceCount = 0` | P03/P10 **por_purchase ≤ 2.9** (scored 2.8 / 2.9); sole board SoR refuse |
| SCIM / JIT NotConfigured | Diligence residual on enterprise pilot kickoff |
| Vendor SOC 2 Type II NotConfigured | Procurement checklist stays amber |
| No public SLA / pen-test summary path | Buyer diligence pack residual |
| Not SIEM SoR / not full BAS | Correct framing floors for P02 / P08 |

---

## Honest summary for dispatch

| Signal | Value |
|--------|-------|
| **Panel mean (pilot-framing)** | **~4.9 / 5** |
| **Operator cluster mean** | **4.9 / 5** |
| **Operator all ≥ 4.9?** | **Yes** |
| **Profiles mean = 5.0** | **2** — **P01 + P07** (code supports; not invented) |
| **Any 5.0 dimension cells?** | **Yes** — P01 Task/Clarity/Trust/pilot; P02 Task/Clarity/Trust; P03 Trust; P04 Task/Clarity; P05 Task/Clarity/Trust/pilot; P07 Task/Clarity/Trust/pilot; P08 Trust |
| **P03/P10 por_purchase** | **2.8 / 2.9** (≤ 2.9 floor; refs=0) |
| **P03/P10 pilot_purchase** | **4.9 / 4.8** |
| **Prior BOARD → this board** | ~4.8 → **~4.9** (+0.1 micro-pass) |
| **Study → this board** | ~3.5 → **~4.9** (+1.4) |
| **Panel mean = 5.0?** | **No** — P03/P06/P08/P10 means 4.8; P02/P04/P05/P09 4.9; only 2 profiles at mean 5.0; GTM/lab blocks remain |
| **Focused tests** | **13 files / 96 passed** @ `b39d6e27` |

### Why panel mean is not 5.0 (one line)

Operator Task/Clarity/Trust are near-ceiling and **P07 joins P01 at mean 5.0**, but **half the panel sits at 4.8–4.9** (GRC thin catalog, board/CISO packaging, red-team AEV framing, live L1 not re-run), and **PoR / zero-refs GTM blocks** correctly keep buyer por_purchase honesty-capped.

### Pilot panel excluding BAS-peer por (P08)

If marketing ever cites “pilot panel excluding BAS-peer replacement por,” **panel pilot mean remains ~4.9** — still not 5.0, because GRC/board/CISO residual and L1 gaps are independent of BAS framing.

*Independent ICP re-panel complete. Pilot-framing panel **~4.9**. Operator cluster **4.9** (all ≥4.9). Means **5.0: P01 + P07**. P03/P10 por **2.8 / 2.9**. No invented 5.0s.*
