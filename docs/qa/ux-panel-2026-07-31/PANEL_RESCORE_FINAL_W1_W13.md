# Panel re-score final — after UX-W1…W13 (toward 5.0)

**Date:** 2026-07-31  
**Tip:** `64713e6c` (W10 Labs portal-only; includes W11–W13 on history)  
**Baseline punch list:** overall **2.9 / 5**  
**Prior mid-wave rescore (W1–W9):** overall **3.8 / 5**  
**Method:** Same six dimensions + design lenses as `PUNCHLIST_200_FUTURE_FORWARD.md`. Grounded in code on `main`. **Honesty: do not invent 5.0.**

---

## 1. Scoreboard

| Dimension | Baseline | After W1–W9 | **After W1–W13** | Δ from baseline | True 5.0? |
|-----------|---------:|------------:|-----------------:|----------------:|:---------:|
| Task success | 3.1 | 3.9 | **4.4** | +1.3 | **No** |
| Clarity | 2.6 | 3.6 | **4.3** | +1.7 | **No** |
| Trust | 3.4 | 4.3 | **4.6** | +1.2 | **No** (closest) |
| Delight | 2.4 | 3.3 | **3.8** | +1.4 | **No** |
| Accessibility | 3.0 | 3.7 | **4.1** | +1.1 | **No** |
| Future readiness | 2.8 | 3.8 | **4.2** | +1.4 | **No** |
| **Overall (mean)** | **2.9** | **3.8** | **4.2** | **+1.3** | **No** |

### Why not 5.0 across the board (required honesty)

A **true 5.0** means: first-time SE finishes hero loop without help; rail has no zoo; every claim is claim-safe product-wide with SR; a11y AA on all chrome; future instruments feel inevitable not toggled experiments; multi-day SOC shift delight without fatigue.

**Remaining structural gaps:**

| Blocker | Why it caps score |
|---------|-------------------|
| Setup still fat | ~9 Setup destinations for daily personas |
| No true dual-pane | Siblings strip ≠ full list\|detail workspace |
| Delight still ops-console | Calm progress lines ≠ rapture; craft uneven on secondary surfaces |
| A11y not VPAT-complete | Focus/contrast improved; no full audit + CI axe gate |
| Future instruments optional | Monday/SOC/density are modes, not the default product essence |
| Hero loop multi-surface | Still Connect → Scope → Validate → Paths across pages |
| Real-user proof missing | No ICP telemetry / design-partner usability study in this rescore |

**Closest to 5.0:** Trust (**4.6**) — claim-safe display product-wide (W11), claim-guard HUD, Fixed-only culture, zero-refs honesty.

---

## 2. Wave evidence (W1–W13)

| Wave | Commit (family) | What moved the score |
|------|-----------------|----------------------|
| W1 | `0f43babf` | Operate ≤10, claim-safe path hero, first-run spine |
| W2 | `c75b93ea` | Threats hub, palette weight, density tokens |
| W3 | `24b14a3b` | Data-age, keyboard map, live regions, contrast |
| W4 | `108f996d` | Webhooks/API/runners power craft |
| W5 | `914cc062` | Claim-guard, weakest-link, Monday, SOC dark |
| W6 | `7d05ef06` | Labs portal, findings fingerprint, ops demote |
| W7 | `ad5a0594` | Tables, mobile Operate-first, empty states |
| W8 | `566a65ab` | Proof stage strip, measure a11y, basis badges |
| W9 | `faf897f1` | Density toggle, counterfactual, constellation, export integrity |
| **W10** | **`64713e6c`** | **Labs portal-only rail** — #3 complete; Proof OS Operate = 10 |
| **W11** | **`34a913f4`** | **Product-wide claim-safe** findings/dashboard/exec/reports + SR |
| **W12** | **`72739d35`** | Path siblings strip, command-bar focus, Active chip |
| **W13** | **`55d746b6`** | Calm progress, measure complete status, CTA hierarchy |

Focused regression (post-W10 tip): **73** unit tests green across nav/labs/claim/path/findings.

---

## 3. Dimension notes (post W10–W13)

### Task success **4.4**
Labs no longer competes as a peer zoo on the rail (portal-only). Path siblings + measure a11y + fingerprint queue accelerate Monday work. **Not 5.0:** still multi-page first proof; no full dual-pane workspace.

### Clarity **4.3**
Single Labs door + Operate spine + shared `PROOF_STAGE_LABELS` + claim-safe projection kill “Validated lies.” **Not 5.0:** Setup still dense; secondary workbenches retain specialist chrome.

### Trust **4.6**
Claim-safe product-wide + SR remapped labels + claim-guard HUD + integrity export note + counterfactual labeled estimate-only. **Not 5.0:** needs continuous claim regression visual CI; some PDF/edge surfaces not fully audited this pass.

### Delight **3.8**
Calm progress lines, quieter tracking, CTA hierarchy, instruments that feel purpose-built. **Not 5.0:** still an ops console with modes; not yet “inevitable product” joy.

### Accessibility **4.1**
Focus rings on command bar, measure busy/disabled, keyboard map, live regions, contrast bumps. **Not 5.0:** no full axe suite / VPAT / graph keyboard model.

### Future readiness **4.2**
Proof instruments (timeline, weakest-link, constellation, density, Monday, SOC dark) without cheese. **Not 5.0:** instruments are progressive enhancement, not the only shell.

---

## 4. Path to true 5.0 (next program)

| Priority | Work | Unlocks |
|----------|------|---------|
| P0 | Full dual-pane Paths + Findings workspaces | Task success 5.0 |
| P0 | Axe CI + focus audit on all PRIMARY_NAV destinations | A11y 5.0 |
| P0 | Claim-safe visual regression snapshots product-wide | Trust 5.0 |
| P1 | Collapse Setup to Connect/Scope/Runners/Engines for Operating | Clarity 5.0 |
| P1 | Default Monday-mode-like Home for Operating maturity | Delight + Future |
| P1 | One-session first-proof wizard with resume | Task success |
| P2 | Real ICP panel (not lenses) + design-partner sessions | External 5.0 validity |

---

## 5. Cheese rejection (still held)

No particle nets, AI mascots, glassmorphism stacks, fake 3D globes, gamified points, or Leading claim inflation.

---

## 6. Plane

- PERISCAN-479 W6 residual — Done (with W6–W13 landings)  
- PERISCAN-480 re-score — Done (3.8 then **4.2** final)  
- Do **not** close market-presence / customer-ref issues as UX Done  

---

## 7. Bottom line

**2.9 → 4.2 overall** after parallel UX-W1…W13.  
**Not 5.0 across the board** — claiming that would violate real-first honesty.  
Trust is within striking distance; Delight and full dual-pane workspaces are the long poles.
