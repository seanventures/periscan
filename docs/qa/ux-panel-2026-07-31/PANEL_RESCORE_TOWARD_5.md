# Panel re-score toward 5.0 — after UX residual waves W1–W9

**Date:** 2026-07-31  
**Tip SHA:** `faf897f1` (`origin/main`)  
**Baseline:** punch-list scoreboard in `PUNCHLIST_200_FUTURE_FORWARD.md` — **overall 2.9 / 5**  
**Method:** same six dimensions and design lenses (Jobs / Ive / Horowitz / Andreessen / Musk + craft). Scores are **grounded in code that actually shipped** on `main` (W1–W9 commits), not intent docs or unmerged worktrees.  
**Honesty rule:** do not claim 5.0 if not earned. Celebrity lenses are constraint sets; ICPs remain security engineers, CISOs, SOC, MSSP operators.

---

## 1. Scoreboard — baseline 2.9 vs now

| Dimension | Baseline (punch list) | **Now (post W1–W9)** | Δ | 5.0? |
|-----------|----------------------:|---------------------:|--:|:----:|
| Task success | 3.1 | **3.9** | +0.8 | No |
| Clarity | 2.6 | **3.6** | +1.0 | No |
| Trust | 3.4 | **4.3** | +0.9 | No |
| Delight | 2.4 | **3.3** | +0.9 | No |
| Accessibility | 3.0 | **3.7** | +0.7 | No |
| Future readiness | 2.8 | **3.8** | +1.0 | No |
| **Overall (mean)** | **2.9** | **3.8** | **+0.9** | **No** |

**Verdict:** Material lift. Product moved from “honest foundation, not inevitable” toward “competent proof instrument with residual zoo and craft debt.” **No dimension is a true 5.0.** Trust is the ceiling (~4.3); Delight remains the floor (~3.3).

---

## 2. What shipped (code evidence by wave)

| Wave | Commit | High-leverage landings | Primary files / tests |
|------|--------|------------------------|------------------------|
| **W1** | `0f43babf` | Operate ≤10; Schedule→Setup; claim-safe path list/detail; singular first-run CTA; empty Home no command-center flash; `data-proof-os-spine` | `primary-nav.tsx`, `get-started.tsx`, `attack-path-detail.tsx`, `attack-paths-workbench.tsx`, `dashboard-command-center.tsx` |
| **W2** | `c75b93ea` | Threats hub alias; palette Operate→Setup→Admin→Labs weight; density tokens + border steps; hide rail map on New maturity | `app/threats/page.tsx`, `command-palette.tsx`, `globals.css`, `primary-nav.tsx` |
| **W3** | `24b14a3b` | LiveUpdatePill data-age; `?` keyboard map; focus / reduced-motion polish; disposition `role=status` | `live-update-pill.tsx`, `keyboard-map.ts`, `findings-workbench.tsx`, `product-help-drawer.tsx` |
| **W4** | `108f996d` | Webhook contract + catalog; copy-as-curl; API version on reference; runners ops instrument; MCP honesty | `admin-console.tsx`, `api-reference-console.tsx`, `mcp-console.tsx`, `runner-fleet-control-room.tsx` |
| **W5** | `914cc062` (+ shell reconcile `24845ba9`) | Claim-guard HUD; weakest-link spotlight; proof timeline; Monday mode; SOC dark cockpit | `claim-guard-hud.tsx`, `attack-path-detail.tsx`, `dashboard-command-center.tsx`, `app-shell.tsx` |
| **W6** | `7d05ef06` | `/labs` portal first Labs rail item; findings fingerprint/occurrence + Active default; Validation Ops demoted to Continuous deep-link | `labs-portal.tsx`, `findings-workbench.tsx`, `continuous-validation-hub.tsx`, `primary-nav.tsx` |
| **W7** | `ad5a0594` | `ps-table` compact/comfortable; mobile Operate-first + More; EmptyState primary+secondary on findings/paths; loading skeleton alignment | `globals.css`, `app-shell.tsx`, `feedback.tsx`, findings/paths workbenches |
| **W8** | `566a65ab` | `PROOF_STAGE_LABELS` strip on path + findings; measure hop busy/disabled a11y; Heuristic/Measured/Imported first-class badges | `proof-stage-strip.tsx`, `product-help.ts`, `state-badge.tsx`, `attack-path-detail.tsx` |
| **W9** | `faf897f1` | Shell `data-density` toggle; counterfactual drawer (breaker text only); hop evidence constellation weight; reports integrity note | `app-shell.tsx`, `attack-path-detail.tsx`, `reports-workbench.tsx`, `globals.css` |

**Tip after residual waves:** `faf897f1` — *fix(web): UX-W9 adaptive density + counterfactual + integrity note*.

---

## 3. Dimension writeups (lenses + evidence + why not 5.0)

### 3.1 Task success — **3.9** (Jobs / Porter / Horowitz)

**Lenses:** One hero job completes without theater; Monday operator can finish measure → cheapest break → re-verify.

**Confirmed wins**

- **Operate spine capped at 10** destinations (`/dashboard` … `/reports`); Schedule moved to Setup — `apps/web/src/lib/primary-nav.tsx` (Operate items array; UX-W1 comment). Shell marks Operate with `data-proof-os-spine="true"`.
- **Singular first-run CTA** shared by GetStarted + rail — `first-run-primary-action.ts`, `get-started.tsx` (`data-testid="get-started-primary-cta"`).
- **Path hero instruments:** claim-safe projection (`data-claim-safe-state`), weakest-link spotlight + measure CTA (`weakest-link-spotlight`), hop measure busy/disabled a11y (W8).
- **Findings triage:** Active default; mono-truncated fingerprint + occurrence (W6) — `findings-workbench.tsx`.
- **Monday mode** collapses Home to Needs-you + primary CTA + top path (W5) — `MONDAY_MODE_STORAGE_KEY` in `dashboard-command-center.tsx`.

**Why not 5.0**

- **~63 routes / ~37 PRIMARY_NAV hrefs** remain; Labs still lists **10** children after the portal (portal is *first* entry, not *only* entry — punch #3 partial).
- **No list|detail split views** (punch #133) — still full navigation between queue and detail.
- First measured proof still multi-surface (Connect → Scope → Validate → Paths); estimator / abandoned-flow recovery incomplete.
- Setup remains fat (9 items) for “daily task” personas.

**Path to 5.0:** Collapse Labs rail to **portal-only** (children summoned from `/labs`); ship split views on Paths/Findings; one-session first-proof with time estimator and mid-flow resume.

---

### 3.2 Clarity — **3.6** (Jobs / Musk / Gould Stewart)

**Lenses:** One vocabulary; one nav truth; latency of understanding measured in seconds.

**Confirmed wins**

- **Single nav source of truth:** `app-navigation.ts` is an explicit thin projection of `PRIMARY_NAV` (dual-nav kill as independent catalog).
- **Operator proof vocabulary:** `PROOF_STAGE_LABELS` / `PROOF_LOOP_HELP` in `product-help.ts`; same labels on radar, map, path/findings stage strip (W8) — CTEM program stages documented as *separate* model.
- **Threats join:** `/threats` → `/threat-center` hub (W2); Validation Ops demoted to Continuous “Live validation ops (Labs)” deep-link (W6).
- **Palette weighting:** Operate → Setup → Admin → Labs last (`command-palette.tsx`).
- **Mobile Operate-first:** Labs/Admin/Setup behind More (W7) — `app-shell.tsx`.

**Why not 5.0**

- Expanded rail still reads as **org chart + booth mall** (Operate/Setup/Labs/Admin) once “Show Labs & more” is on.
- Persona rails / Executive / Compliance placement still inconsistent with “prove daily.”
- Breadcrumbs still weak as loop-stage encoding; Objects / Data fabric / dual Getting-started residual remain.
- Three *program* languages still coexist carefully (proof loop vs CTEM program vs marketing tagline in docs) — better fenced in code comments, still a buyer-demo tax if mis-mounted.

**Path to 5.0:** Rail = **7 hero screens** only (punch #200); everything else summoned; single empty-tenant board; breadcrumbs encode Connect→Prove stage.

---

### 3.3 Trust — **4.3** (Monteiro / Horowitz / Norman) — *closest to excellence; still not 5.0*

**Lenses:** Only say what you measured; Fixed only via re-test; no dark patterns.

**Confirmed wins**

- **Claim-guard HUD** persistent chrome — `claim-guard-hud.tsx` (`CLAIM_GUARD_COPY` Measured / Heuristic / Imported).
- **Path claim-safe state** never upgrades to Validated from launch alone — `attack-path-detail.tsx` (`data-claim-safe-state`, comments on primary action).
- **Fixed multiverse law** shared + enforced — `packages/shared/src/fix-verification.ts` (+ architecture walk tests).
- **EvidenceBasis first-class chips** — `state-badge.tsx` (Measured solid; Heuristic/Imported outline, never dressed as Measured).
- **Counterfactual honesty** — W9 drawer labeled “Estimate / heuristic only”; breaker text only, no invented residual scores.
- **Export integrity note** — `reports-workbench.tsx` `data-testid="export-integrity-note"`.
- **Power-tool honesty** — MCP console honesty jump; webhook contract browser; copy-as-curl (W4).

**Why not 5.0 (and why we refuse to call it 5)**

- Claim vocabulary is **strong on path/findings/shell**, not yet **product-wide** (exec scorecards provenance chips, operators evidence-id citations, every Labs “never claim” drawer — punch 70/74/83 residual).
- Integrity note is **copy + chain verify affordance**, not a full cryptographic watermark system on every PDF export (punch #82 / #199 partial).
- Demo vs live ribbon / market zero-refs are improved historically but still need continuous visual channel discipline under demo seeds.
- Trust **as craft** still leaves some critical safety facts in InfoPopovers vs always-on chrome.

**If Trust ever hits 5.0, required evidence would be:** claim-safe projection + Fixed-only-via-verification + always-on claim HUD on **every** customer-facing surface (including exports, exec, MSSP, operators) with visual regression + SR labels; zero residual “Validated” raw strings in UI fixtures outside negative tests.

---

### 3.4 Delight — **3.3** (Ive / Zhuo / Porter)

**Lenses:** Restraint, material honesty, joy of competence without confetti cheese.

**Confirmed wins**

- Instrumental moments that *feel* product: Monday mode, weakest-link frame, proof timeline (measured events only), SOC dark cockpit, density toggle.
- Empty findings/paths gain primary+secondary CTAs (W7); loading skeletons align to table rows (`ps-table`).
- Border / density token steps started (`--border-hairline` … `--border-input`, `data-density`).

**Why not 5.0**

- Overall still **ops-console competence**, rarely joy — punch baseline “Delight 2.4” lifted but craft uneven across workbenches.
- Metric cards / forms / button hierarchy not fully unified; uppercase mono label shout residual.
- Signature material language incomplete (one bezel surface only aspirational; motion language partial).
- No cheesy futurism (good) — but also no fully resolved calm “Proof OS” aesthetic end-to-end.

**Path to 5.0:** One type scale + card elevation + form language; table DS everywhere; empty-state pattern global; one signature instrument surface (path measure) polished to Ive restraint.

---

### 3.5 Accessibility — **3.7** (Au / Dye / WCAG)

**Confirmed wins**

- Keyboard map `?` — `keyboard-map.ts` + help drawer (W3).
- Focus-visible rings, reduced-motion, disposition live region status (W3).
- Measure hop busy/disabled + list→detail back affordance (W8).
- LiveUpdatePill shows **data age** (latency honesty doubles as a11y feedback).
- Mobile drawer Operate-first reduces cognitive load for small screens (W7).

**Why not 5.0**

- Full void-text contrast audit not complete product-wide (punch #161).
- Listbox/combobox filter patterns, table sort a11y, chart text alternatives incomplete (#163–168).
- Touch ≥44px / 200% zoom integrity not proven product-wide.
- Screen-reader claim-safe labels not universal beyond key path/findings chrome.

**Path to 5.0:** Automated a11y CI gate on shell + hero workbenches; complete filter listbox patterns; chart alt tables; verified focus order through all shell overlays.

---

### 3.6 Future readiness — **3.8** (Musk / Maeda / Andreessen)

**Confirmed wins (non-cheesy instruments actually in tree)**

| Instrument | Punch | Evidence |
|------------|------:|----------|
| Claim-guard HUD | 191 | `claim-guard-hud.tsx` |
| Weakest-link spotlight | 190 | `attack-path-detail.tsx` `#weakest-link` |
| Proof timeline | 189 | `data-testid="proof-timeline"` |
| Monday mode | 198 | `dashboard-command-center.tsx` |
| SOC dark cockpit | 196 | `SOC_DARK_STORAGE_KEY`, body class `soc-dark-cockpit` |
| Adaptive density | 192 | shell `data-density` + `periscan-density` (toggle; not yet auto role+viewport) |
| Counterfactual drawer | 195 | `counterfactual-drawer` estimate-only |
| Evidence constellation | 194 | hop badge weight by evidence count |
| Export integrity note | 199 | `export-integrity-note` |
| API-first power craft | 176–185 | curl, webhooks catalog, API version |

**Why not 5.0**

- **Proof OS shell (#200)** is marked (`data-proof-os-spine`) but product is **not** yet “7 hero screens; everything else summoned.” Labs/Setup/Admin still listed destinations.
- Density is **manual toggle**, not invisible adaptive from role + screen size.
- Split views, collaboration presence, true spatial hop stack gestures, full PDF integrity watermark still out.
- Substrate (evidence, claims, policy) remains stronger than presentation — still readable as 2024 ops console with 2026 instruments bolted on the hero path.

**Path to 5.0:** Summoned IA (portal-only secondary); auto density; path canvas as single signature instrument; integrity watermark on all exports; split-view power mode.

---

## 4. Confirmed wins from waves (synthesis)

1. **Hero spine exists and is coded, not only documented** — Operate ≤10 + first-run singular CTA + claim-safe path detail.  
2. **Honesty is product chrome** — Claim-guard HUD, basis badges, Fixed-via-verification law, counterfactual estimate labels.  
3. **IA surgery started** — dual nav collapsed to projection; Threats hub; Validation Ops demoted; Labs portal directory; mobile Operate-first.  
4. **Operator Monday path** — Monday mode + Active findings default + fingerprint/occurrence + weakest-link CTA.  
5. **A11y / latency honesty** — `?` map, data-age pill, measure busy states, focus/reduced-motion polish.  
6. **Power-user craft** — webhooks catalog, copy-as-curl, runners instrument, MCP honesty.  
7. **Future instruments without cheese** — timeline, spotlight, SOC dark, density, constellation, integrity note — no particles/mascots/sparkle.  
8. **Tests landed with waves** — primary-nav, path detail, claim-guard, monday-mode, labs-portal, keyboard-map, live-update-pill, findings, reports integrity, etc.

---

## 5. Remaining P0 / P1 to hit true 5.0 across the board

### P0 (blocks “inevitable product” claim)

| ID | Item | Punch / notes |
|----|------|----------------|
| P0-A | **Labs rail collapse to portal-only** (children not peer list) | #3 partial — portal added, 9 children still on rail |
| P0-B | **Proof OS shell: ≤7 Operate/hero destinations; secondary summoned** | #200 — spine marked, not enforced product-wide |
| P0-C | **Product-wide claim vocabulary + SR labels** (exec, operators, Labs, exports) | #63, #174, #85 |
| P0-D | **Contrast + focus-order audit of shell overlays + hero workbenches** | #161–162 |
| P0-E | **List\|detail split views** for Paths and Findings without full nav tax | #133 |

### P1 (weekly operator tax / clarity)

| ID | Item | Punch / notes |
|----|------|----------------|
| P1-A | Setup fat cut + persona rails consistent | #6, #10, #11 |
| P1-B | Findings root-cause / bulk disposition honesty polish | #134 residual depth, #136 |
| P1-C | Remediation three-beat UX (plan → apply → revalidate) + ticket deep-link | #139–140 |
| P1-D | Table DS everywhere (remediations, evidence, missions) | #101 partial (`ps-table` on findings) |
| P1-E | Global empty-state + error “what to do” pattern | #48, #50 |
| P1-F | Auto density from role + viewport (not only toggle) | #192 partial |
| P1-G | Breadcrumbs encode proof stage; deep routes keep loop context | #8, #24 |
| P1-H | Full export integrity watermark (PDF matches in-app claims) | #199 partial |
| P1-I | Filter listbox/combobox + table sort a11y | #163, #167 |
| P1-J | First-proof time estimator + abandoned mid-flow recovery | #39, #60 |

### Explicit non-goals (still rejected)

Particle backgrounds, AI mascots, fake living-map globes without measured data, gamified close points, Leading/AI badges without claim language — **held** across W1–W9.

---

## 6. Did any dimension hit 5.0?

**No.**

| Dimension | 5.0 claim? | Why withheld |
|-----------|:----------:|--------------|
| Task success | No | Zoo residual; no split views; Labs not portal-only |
| Clarity | No | Multi-group rail when expanded; Setup fat |
| Trust | No | Strongest (4.3) but not product-wide + export/SR complete |
| Delight | No | Craft uneven; console feel remains |
| Accessibility | No | Partial polish, not WCAG-complete hero set |
| Future readiness | No | Instruments shipped; Proof OS IA not finished |

Calling Trust 5.0 would be **score inflation** against the punch-list honesty bar and `docs/qa/BLIND_RESCORE_RELEASE_QUAL.md` spirit.

---

## 7. Trajectory

```
2.9  ──W1–W5──►  ~3.5 (estimated mid)  ──W6–W9 residual──►  3.8
                                                                  │
                                                    P0-A..E + craft │
                                                                  ▼
                                                         true 5.0 board
```

**Recommended next wave package (toward 5.0):**

1. **UX-W10 — Proof OS IA freeze:** portal-only Labs; Operate ≤7; summoned Admin/Setup.  
2. **UX-W11 — Split-view hero workbenches** + table DS completion.  
3. **UX-W12 — Claim-language product-wide + export watermark + a11y CI gate.**

Until those land with tests, marketing/demo language should say: **honest AEV/CTEM proof layer with strong claim hygiene**, not “finished UX” or “5.0 product.”

---

## 8. References

- Baseline: [`PUNCHLIST_200_FUTURE_FORWARD.md`](./PUNCHLIST_200_FUTURE_FORWARD.md)  
- Wave log: [`UX_WAVES_EXECUTION_STATUS.md`](./UX_WAVES_EXECUTION_STATUS.md)  
- Commits: `0f43babf`, `c75b93ea`, `24b14a3b`, `108f996d`, `914cc062`, `24845ba9`, `7d05ef06`, `ad5a0594`, `566a65ab`, `faf897f1`  
- Plane: PERISCAN-472..479; rescore issue **PERISCAN-480** (`6c993072-391c-482e-a9ee-e7ce914f4501`)
