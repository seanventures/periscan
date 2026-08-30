# P16 — Accessibility specialist (WCAG) — Exhaustive panel

**Date:** 2026-07-29  
**Persona:** Accessibility / Inclusive Design (WCAG 2.1/2.2 A–AA)  
**Scope:** Periscan web shell, shared UI kit, hop-measure proof loop, help/mobile drawers, modals, automated axe gates  
**Method:** Code-grounded static audit of `apps/web` + `tests/e2e` (no live VoiceOver/NVDA session; no product code changes)  
**Standards:** WCAG 2.1/2.2 A–AA — especially 1.3.1, 1.4.1, 1.4.3, 1.4.11, 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7, 2.5.5/2.5.8, 3.3.2, 4.1.2, 4.1.3  

**Contract:** [PROMPT_CONTRACT.md](../PROMPT_CONTRACT.md)  
**Prior consensus:** [PREVIOUS_PANEL_SYNTHESIS.md](../PREVIOUS_PANEL_SYNTHESIS.md) (U-13 nested main / focus traps; prior a11y ~3.2/5)

---

## 1. Verdict

| Scale | Score | Definition of 5.0 |
|------:|------:|-------------------|
| **Accessibility readiness** | **3.1 / 5** | One landmark model, keyboard-complete overlays, AA focus/contrast discipline on shell + primary workbenches, axe **plus** single-main + modal/keyboard journeys in CI |

**5.0 means:** Screen-reader and keyboard operators can complete the proof loop (find path → measure hop → remediate → re-verify) without mouse, without focus loss into inert chrome, without ambiguous dual `main` landmarks, and with status/errors announced. Procurement AA evidence is automated and manual checklist green.

**Why not higher:** Nested `<main>` still ships via `PageShell` and report views; help drawer / command palette / confirm / mobile drawer / account menu all lack real focus traps and focus restore; focus-visible is kit-good but shell-uneven; axe is WCAG-tagged only (misses landmark-duplicate best-practice and most expanded overlay states). Prior panel score **~3.2** is reaffirmed — **not a regression story, not closed**.

**Agreement with previous panel:** Strongly agree on **U-13** (nested main + incomplete focus traps / uneven rings). Dissent: none on severity; this pass adds hop-measure keyboard gaps, demo skip-target break, ConfirmDialog doc/implementation mismatch, dual-nav axe drift, and live-region/loading silence as first-class findings.

---

## 2. Top 5 moves to reach 5.0

1. **Landmarks (S):** Change `PageShell` from `<main>` → layout `<div>`/`section`; demote `snapshot-report-view` inner `<main>`; put `id="main-content" tabIndex={-1}` on bare demo/public mains; flip `page.test.tsx`; assert **exactly one** `main` in Playwright (independent of axe WCAG tags).
2. **Shared modal primitive (M):** One focus-trap + Escape + restore-focus + `aria-modal` + optional `inert` background for help drawer, command palette, ConfirmDialog, mobile nav drawer, account menu. Prefer Radix Dialog/Popover.
3. **Focus-visible convention (S):** Shell chrome + raw inputs adopt the `Button` ring pattern; never `outline-none` without a ≥3:1 replacement; give skip-landed `#main-content` a brief visible cue or move focus into first heading.
4. **Hop-measure keyboard path (S–M):** `aria-busy` on measure CTA; announce launch result (already `role="status"` — ensure mount focus/scroll); when disabled for scope load, expose reason; keyboard path e2e from path detail → Measure hop → result card.
5. **Axe + journey expansion (M):** Keep WCAG A/AA tags; add best-practice landmark uniqueness job; axe open palette + confirm + mobile drawer + bare auth; dual-nav: axe `PRIMARY_NAV_ITEMS` (what operators see), not only `APP_NAV_ITEMS`.

---

## 3. Feature-zoo / IA notes (a11y lens)

| Action | Target | Why |
|--------|--------|-----|
| **Merge** | `APP_NAV` vs `PRIMARY_NAV` | Dual nav → dual truth for axe route lists and “what is primary”; keyboard operators face different mental models than CI. |
| **Demote** | Autonomous / Swarm / MCP / Model Gateway to Labs | Zoo surfaces multiply unlabeled dense controls and untested expanded states; a11y debt scales with rail length (U-16). |
| **Do not cut** | Skip link, Primary `aria-current`, breadcrumb nav, Radix Tabs, chart/graph text fallbacks, hop `role="status"` result cards | These are the honest a11y investments. |
| **Rename (copy)** | ConfirmDialog JSDoc “focus is trapped” | Implementation does not trap — doc sets false confidence for reviewers. |

Zoo-related a11y cost: more destinations ⇒ more default-paint axe routes without expanded interaction coverage; more overlays without a shared dialog primitive.

---

## 4. What is already excellent (do not break)

- **Root skip link** → `#main-content` with high-contrast pill (`.skip-link` in `apps/web/app/globals.css`); shell `main` has `id="main-content"` + `tabIndex={-1}` (`app-shell.tsx`).
- **`lang="en"`** on `<html>` (`layout.tsx`).
- **Labeled landmarks when not nested:** Primary `nav`, Breadcrumb `nav`, sticky `header`, desktop `aside`, shell `main`.
- **Help control** has `aria-haspopup="dialog"` + `aria-expanded`; account has `aria-haspopup="menu"` + `aria-expanded` + name.
- **Shared `Button`:** `focus-visible:ring-2`, `aria-busy` when loading, decorative spinner `aria-hidden`.
- **Radix Tabs** keyboard roving + brand focus ring.
- **Status text, not color alone:** health “systems nominal/degraded”, `StatusPill` / `StateBadge`, hop eligibility badges with text.
- **InlineError / ErrorState** use `role="alert"` / `role="status"` (4.1.3) when adopted.
- **Chart/graph fallbacks:** DistributionChart table / AttackPathGraph node lists; orchestration canvas decorative with real buttons.
- **Auth bare routes** own a single `main#main-content` with real `<label>` fields.
- **Hop measurement honesty UI:** measured ratio `role="status"`, launch result `role="status"`, labeled “Measure hop N (safe)”, scope `<label>` when multi-scope, ordered list `aria-label="Path hop measurement plan"`.
- **Real CI axe gate** on primary routes + help dialog open (`tests/e2e/web-accessibility.spec.ts`); shell e2e for skip + single `aria-current`.
- **Partial reduced-motion:** `motion-safe:` on skeletons/drawers; radar/orchestration/demo honor `prefers-reduced-motion`.

---

## 5. Findings

### FINDING | P16-1 | P1 | bug | a11y | Nested main via PageShell under AppShell
- **Persona:** Accessibility (WCAG)
- **Evidence:** `apps/web/src/components/app-shell.tsx` wraps children in `<main id="main-content" className="product-main">`. `apps/web/src/ui/page.tsx` `PageShell` **also** renders `<main>`. Unit test `apps/web/src/ui/page.test.tsx` asserts `getByRole("main")` from PageShell alone — locks the wrong contract. All PageShell workbenches nest under shell main.
- **Problem:** Two `main` landmarks per authenticated PageShell route. Skip lands on outer main; screen readers announce ambiguous “main”. Violates landmark best practice and undermines 1.3.1 / 2.4.1 bypass clarity.
- **Impact:** AT users cannot reliably identify the page content region; assistive navigation by landmark is unreliable on majority of product routes.
- **Recommendation:** Change PageShell root to `<div>` or `<section>` (keep spacing classes). Update `page.test.tsx` to assert layout container, not second main. Add Playwright assert: `page.getByRole('main').count() === 1` on shell routes.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P16-2 | P1 | bug | a11y | Snapshot report nests a second main
- **Evidence:** `apps/web/src/components/snapshot-report-view.tsx` — `<main aria-busy={isReportBusy} className="report-page">` while still under shell `main` on `/snapshots/:id/report` (dynamic axe route in `web-accessibility.spec.ts`).
- **Problem:** Report view intentionally uses a document-like `main` without demoting when chrome is present.
- **Impact:** Same dual-main ambiguity on the proof-export surface auditors and operators actually print/share.
- **Recommendation:** Use `<article>`/`section` with `aria-busy` when rendered inside AppShell; only bare print layout may use solitary `main`.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P16-3 | P1 | bug | a11y | Bare demo main missing skip target id
- **Evidence:** Root skip always `href="#main-content"` (`layout.tsx`). Bare routes skip chrome (`BARE_ROUTES` includes `/demo`). `demo-workspace.tsx` renders `<main data-demo-mode="true">` **without** `id="main-content"`. `public-demo-report.tsx` uses `<main className="public-demo-page">` also without the id.
- **Problem:** Skip link is a no-op / wrong target on guided demo and public sample report.
- **Impact:** Keyboard users on first-touch demo cannot skip repeated chrome/header; 2.4.1 fails on public surfaces used for sales/eval.
- **Recommendation:** On every bare `main`, set `id="main-content" tabIndex={-1}` consistently with auth/welcome forms.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P16-4 | P1 | bug | a11y | Product help drawer: Escape + initial focus, no trap, no restore
- **Evidence:** `apps/web/src/components/product-help-drawer.tsx` — `role="dialog"`, `aria-modal="true"`, focuses close button on open, Escape closes. No focus cycle containment; background remains tabbable (backdrop is a button, but Tab can leave the aside into page chrome). No stored trigger ref to restore focus to “Open product help”.
- **Problem:** Incomplete dialog pattern vs 2.4.3 / 4.1.2 expectations; keyboard users can tab “under” the drawer.
- **Impact:** Focus order chaos; SR users may hear page content while dialog appears open; returning from help loses place in dense workbenches.
- **Recommendation:** Shared dialog primitive: trap focus in drawer, `inert` or `aria-hidden` on shell while open, restore focus to help trigger on close.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P16-5 | P1 | bug | a11y | ConfirmDialog claims focus trap; implements none; confirm-first risk
- **Evidence:** `apps/web/src/ui/confirm-dialog.tsx` JSDoc: “focus is trapped to the dialog”. Implementation: Escape listener + focus confirm or phrase input only — **no** Tab wrapping, no `inert` background. Non-phrase destructive flow focuses **Confirm** first (not Cancel).
- **Problem:** Doc/implementation mismatch; accidental Enter/Space on open can confirm destructive actions; Tab escapes to page.
- **Impact:** Governance actions (revoke/redact/kill-adjacent confirms) are highest-stakes UI — keyboard mishits are a safety + a11y failure.
- **Recommendation:** Real focus trap; for non-phrase destructive, initial focus on **Cancel**; keep phrase-gate focus on input; restore focus to opener.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P16-6 | P1 | bug | a11y | Command palette dialog + incomplete listbox (no trap, no activedescendant)
- **Evidence:** `apps/web/src/components/command-palette.tsx` — `role="dialog" aria-modal` on full-screen overlay; `role="listbox"` with `role="option"` + `aria-selected`; focus stays on search input; **no** `aria-activedescendant`; group headers as non-option `<p>` inside listbox (invalid children); nav option SVGs often without `aria-hidden`; Escape only on input `onKeyDown` (not document-level if focus leaves); no focus trap / restore.
- **Problem:** Combobox/listbox APIs incomplete; modal behavior incomplete; invalid listbox structure.
- **Impact:** SR may not announce active option; Tab can leave dialog; keyboard operators lose the primary global navigation tool.
- **Recommendation:** Prefer combobox pattern (`role="combobox"` + `aria-controls` listbox + `aria-activedescendant`) **or** roving tabindex on options; document Escape; trap + restore; decorative icons `aria-hidden`; group labels via `role="group"` / separate lists.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P16-7 | P1 | bug | mobile | Mobile nav drawer lacks Escape, focus management, modal semantics
- **Evidence:** `app-shell.tsx` mobile drawer: fixed overlay + `aside` with `RailNav`; backdrop `onClick` closes with `aria-hidden` only; **no** Escape handler; **no** initial focus into drawer; **no** `aria-modal` / dialog role; **no** focus trap; page behind remains focusable/scrollable. “Open navigation” button (`p-1.5`, icon 18px) has **no** `focus-visible` ring utility and no `aria-expanded`/`aria-controls` linking to drawer.
- **Problem:** Mobile keyboard and SR users cannot reliably enter/exit navigation; 2.4.3 / 4.1.2 fail on the only nav path below `md`.
- **Impact:** Phone/tablet operators (and narrow desktop) cannot complete primary navigation without touch; drawer can open while focus stays on hamburger.
- **Recommendation:** Treat as modal drawer: Escape closes; focus first nav link or close control; trap; `aria-expanded` on hamburger; label drawer `nav`/`dialog`; restore focus.
- **Effort:** M
- **Zoo-related:** yes (long rail worsens drawer length)
- **Previous-panel-link:** U-13

### FINDING | P16-8 | P1 | bug | a11y | Account menu: role=menu without keyboard menu model
- **Evidence:** `UserMenu` in `app-shell.tsx` — trigger `aria-haspopup="menu"` / `aria-expanded`; popup `role="menu"` with `role="menuitem"` links/button; **no** ArrowUp/Down, Home/End, Escape on menu; **no** focus move into menu on open; **no** focus restore; backdrop click-only dismiss.
- **Problem:** WAI-ARIA menu pattern incomplete — role promises keyboard behavior that is absent.
- **Impact:** Keyboard users open menu then Tab into page; SR may announce menu without operable arrow navigation.
- **Recommendation:** Either implement full menu keyboard model **or** drop `role="menu"` and use a disclosure/popover with normal tab order + Escape.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P16-9 | P1 | improvement | a11y | Focus-visible inconsistent on shell chrome (2.4.7 / 1.4.11)
- **Evidence:**
  - **Good:** shared `Button`, help button, guided-nav toggle, help close, many workbench CTAs using `buttonClassName`.
  - **Weak/missing:** mobile Open navigation (border only); command-palette launcher (hover border, no ring); account avatar `size-7` (no ring); primary nav **group toggles** (hover color only, no `focus-visible`); hop scope `<select>` (no focus ring classes); many raw inputs `outline-none focus:border-brand` elsewhere.
  - `#main-content:focus { outline: none; }` in `globals.css` with no replacement ring when skip activates main.
- **Problem:** Keyboard focus often invisible against dark navy chrome; border-only changes frequently fail 3:1 non-text contrast.
- **Impact:** Sighted keyboard users lose caret path through the densest part of the product (rail + command bar).
- **Recommendation:** Global interactive chrome utility matching Button rings; prefer ring over border-only for inputs/selects; optional skip-land ring on main or move focus to first `h1`.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P16-10 | P2 | improvement | design-system | text-subtle + 9–10.5px mono risk AA contrast/legibility
- **Evidence:** Tokens `--subtle` / `--color-subtle: #758db5` on void `#05070f`–`#12203f` (`globals.css`, `tailwind.css`). Used for nav group titles (`text-[9.5px]` uppercase mono), hop meta, footer microcopy, metric captions.
- **Problem:** Borderline AA normal-text contrast especially on elevated surfaces; small caps mono fails practical low-vision use even when ratio scrapes by.
- **Impact:** Eligibility, prerequisites, and hop meta — core proof language — become hard to read; 1.4.3 / 1.4.11 risk.
- **Recommendation:** Raise subtle toward `#8fa4c4`+ for text; reserve true subtle for non-essential chrome; min 12px for essential meta; re-run axe `color-contrast` on dense panels (included in WCAG tags when content is painted).
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P16-11 | P2 | bug | mobile | Touch targets under 24px / 44px on shell and kit
- **Evidence:** Account control `size-7` (28px) — under WCAG 2.2 **2.5.8** 24×24 minimum is close but fails **2.5.5** enhanced 44×44; `InfoPopover` trigger `size-5` (20px) fails 2.5.8; dense nav rows / mono group headers compact; USER_STORIES a11y polish asks ≥44px on narrow viewports (prior QA).
- **Problem:** Small hit boxes for account security exit and inline help “i” controls.
- **Impact:** Motor-impaired and mobile operators mis-tap; account menu and info tips are critical for trust surfaces.
- **Recommendation:** Min 24×24 hit area (padding if visual stays small); shell account ≥36–44px; InfoPopover hit slop.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P16-12 | P2 | improvement | a11y | Placeholder-as-label pattern on filters and forms
- **Evidence:** Examples: `findings-workbench-v2.tsx` `placeholder="Filter findings…"`; `ai-apps-workbench.tsx` multiple fields with `placeholder` + `aria-label` only (Name, Endpoint URL, Owner, Guardrails…); `admin-console.tsx` “Key name…”, webhook URL placeholders; command palette search is aria-labeled (better).
- **Problem:** Placeholder disappears on type; meets name via aria sometimes but fails **visible label** expectation (3.3.2) and confuses cognitive load.
- **Impact:** Errors harder to associate; autofill/voice users less successful on admin/AI apps setup.
- **Recommendation:** Visible caption labels + `htmlFor`/`id`; placeholder only as format hint; `aria-label` as supplement not sole name when UI is visual.
- **Effort:** M
- **Zoo-related:** yes (many workbenches copy the pattern)
- **Previous-panel-link:** none

### FINDING | P16-13 | P2 | bug | a11y | LoadingSkeleton is aria-hidden with no companion live status
- **Evidence:** `apps/web/src/ui/feedback.tsx` `LoadingSkeleton` sets `aria-hidden` only — no `role="status"` “Loading…”. Used widely (missions, findings, hop plan, reports, getting-started, etc.). Some parents set `aria-busy` (report view); most shell routes do not.
- **Problem:** During fetch, SR may hear silence or stale content (4.1.3 gap).
- **Impact:** Operators cannot tell hop plan / findings / missions are loading vs empty.
- **Recommendation:** Companion visually optional `<span role="status" className="sr-only">Loading…</span>` or parent `aria-busy="true"` + status text while skeleton shows.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P16-14 | P1 | improvement | a11y | Axe gate gaps: WCAG tags only, dual nav list, thin overlay coverage
- **Evidence:** `tests/e2e/web-accessibility.spec.ts` uses tags `wcag2a|wcag2aa|wcag21a|wcag21aa` only — **excludes** best-practice `landmark-no-duplicate-main` / `landmark-main-is-top-level` (why nested main stays green). Routes sourced from **`APP_NAV_ITEMS`** (`app-navigation.ts`), while live shell uses **`PRIMARY_NAV`** (`primary-nav.tsx`) — dual lists (U-03). Coverage includes help dialog open; **not** command palette, ConfirmDialog, account menu, mobile drawer, bare `/login|/signup|/reset-password`. Default paint only — not findings expand, hop measure, multi-step wizards.
- **Problem:** Green CI is necessary but not sufficient for AA claim or landmark correctness.
- **Impact:** False confidence for procurement and release; nested main and modal bugs never fail the gate.
- **Recommendation:** (1) single-main custom assert; (2) optional best-practice job; (3) axe against `PRIMARY_NAV_ITEMS` + critical deep links; (4) open palette/help/confirm/mobile; (5) bare auth routes; (6) wait for stable heading before analyze.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03, U-13

### FINDING | P16-15 | P1 | bug | proof-loop | Hop measure keyboard path incomplete (busy, focus, disabled reason)
- **Evidence:** `attack-path-detail.tsx` hop cards: Measure CTA is a native `<button>` with `buttonClassName` (good focus ring) and `aria-label={`Measure hop ${index + 1} (safe)`}`. When busy: label text “Requesting…” but **no** `aria-busy` (unlike shared `Button` `loading` prop). Disabled when `scopes.loading` without announced reason. Launch result `HopLaunchResultCard` has `role="status"` (good) but focus stays on button — no move/scroll to result. Blocked states show text + links (good for AT when present). Product residual U-05 Eligible/NeedsApproval deadlock is primarily functional; a11y impact is missing CTA without always-clear focusable alternative when modules empty.
- **Problem:** Core proof-loop action is mostly keyboard-reachable but loading and outcome feedback are incomplete for AT; disabled-without-reason violates 4.1.2 value/state clarity.
- **Impact:** Keyboard/SR operators cannot confidently complete “measure the cheapest hop” — the product essence from prior synthesis.
- **Recommendation:** Use `Button loading` or set `aria-busy`; `aria-disabled` + `aria-describedby` pointing at blocked message; after launch, focus result card heading or announce via assertive live region for Denied; e2e keyboard journey on hop measure; keep blocked-state links as real focusable targets.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-05 (functional) + U-13 (focus)

### FINDING | P16-16 | P2 | bug | a11y | Command palette search status not a live region; Escape scoped to input
- **Evidence:** Palette shows visual “searching…” text without `role="status"`/`aria-live`. Escape handled only in input `onKeyDown`. If Tab moves into result buttons (possible without trap), Escape may not close.
- **Problem:** Async search results and close affordance incomplete for AT (4.1.3 / 2.1.1).
- **Impact:** Operators may not hear search completion; stuck focus outside input with open modal.
- **Recommendation:** Live region for searching/results count; document-level Escape while open; trap focus so Escape always applies.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P16-17 | P2 | improvement | findings | Findings expand control lacks focus ring and aria-controls
- **Evidence:** `findings-workbench-v2.tsx` expand `<button aria-expanded={open}>` with no `focus-visible:ring-*` classes and no `aria-controls` / id on panel region. Checkbox has good `aria-label`.
- **Problem:** Keyboard focus on primary triage expand is hard to see; expanded region not programmatically associated (1.3.1 / 4.1.2).
- **Impact:** SOC keyboard triage (persona 18 adjacent) slows; expanded disposition may not be announced as controlled region.
- **Recommendation:** Focus ring on expand button; `aria-controls` → panel id; optional `aria-label` including finding title if visible text truncates.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11 (findings ops — expand is the UI vehicle)

### FINDING | P16-18 | P2 | bug | a11y | PageShell unit test and globals main styles reinforce dual-main
- **Evidence:** `page.test.tsx` requires `role="main"` from PageShell. `globals.css` sets global `main { max-width: 960px; ... }` then overrides `.product-main` — nested inner `main` from PageShell can inherit legacy max-width/padding rules inconsistently vs outer product-main.
- **Problem:** Test suite **prevents** correct fix without deliberate test change; CSS compounds layout/a11y coupling.
- **Impact:** Nested main fix is “sticky” social/process debt; layout quirks on wide workbenches.
- **Recommendation:** Change test contract first in same PR as PageShell element swap; scope legacy `main` styles to auth/public classes only.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P16-19 | P3 | improvement | a11y | InfoPopover uses role=tooltip with click toggle
- **Evidence:** `info-popover.tsx` — click toggles open; `role="tooltip"`; `aria-describedby` always points at content even when closed (`sr-only`); Escape closes only when focus on button.
- **Problem:** Tooltips are typically hover/focus ephemeral; click-to-toggle is disclosure/dialog. Content always in description may over-announce when closed depending on AT.
- **Impact:** Minor SR noise; pattern inconsistency with real dialogs.
- **Recommendation:** Use disclosure (`aria-expanded` + show/hide without tooltip role) or proper dialog; only set `aria-describedby` when open.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P16-20 | P2 | improvement | a11y | Palette launcher missing aria-haspopup; tenant chevron looks like a menu
- **Evidence:** Command bar search opener button has no `aria-haspopup="dialog"` (help has it). Tenant switcher is a `Link` to `/mssp` with chevron icon implying menu (`title="Portfolio & client tenants"`).
- **Problem:** Inconsistent dialog disclosure; chevron may violate 3.2.2 expectation of control vs navigation.
- **Impact:** SR users less prepared for modal open; tenant control may be activated expecting a listbox.
- **Recommendation:** `aria-haspopup="dialog"` on palette launcher; rename tenant control copy (“Open portfolio”) or use a real tenant switcher pattern.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

---

## 6. Overlay / keyboard matrix (this pass)

| Surface | Escape | Initial focus | Focus trap | Restore focus | Notes |
|---------|:------:|:-------------:|:----------:|:-------------:|-------|
| Product help drawer | Yes | Close | **No** | **No** | Labeled dialog; backdrop button |
| Command palette | Partial (input) | Search input | **No** | **No** | Incomplete listbox |
| ConfirmDialog | Yes | Confirm or phrase | **No** | **No** | JSDoc lies about trap |
| Mobile nav drawer | **No** | **No** | **No** | **No** | Not modal |
| Account menu | **No** | **No** | **No** | **No** | Fake menu roles |
| Hop measure CTA | N/A | N/A | N/A | N/A | Keyboard OK; busy/result weak |
| InfoPopover | On trigger | N/A | N/A | N/A | Tooltip misuse |

---

## 7. Landmark map

**Intended (authenticated):**

```
body
├── a.skip-link → #main-content
└── .periscan-app-shell
    ├── aside (desktop rail) → nav[aria-label=Primary]
    ├── header (command bar)
    ├── main#main-content.product-main
    │   ├── nav[aria-label=Breadcrumb]
    │   └── page content (div/section ONLY)
    └── dialogs (palette, help) as siblings
```

**Actual on PageShell routes:**

```
main#main-content.product-main
└── main   ← nested (P16-1)
    └── content
```

**Bare auth/welcome:** single `main#main-content` — correct.  
**Demo/public sample:** `main` without id — skip broken (P16-3).

---

## 8. Component scorecard (sampled)

| Component | Roles / landmarks | Keyboard | Focus visible | Verdict |
|-----------|-------------------|----------|---------------|---------|
| AppShell | Strong if single main | Partial | Uneven chrome | Fix drawers + rings |
| PageShell | **Wrong element** | N/A | N/A | Demote to div |
| ProductHelpDrawer | Dialog labeled | Escape + close | Close has ring | Trap + restore |
| CommandPalette | Dialog + partial listbox | Arrows/Enter partial | Input only | Combobox + trap |
| ConfirmDialog | Labeled | Escape | Via Button kit | Trap; cancel-first |
| Mobile drawer | aside only | Weak | Hamburger weak | Full modal pattern |
| UserMenu | menu roles incomplete | Weak | No ring on avatar | Disclosure or full menu |
| Button / Tabs | Strong | Strong | Strong | Prefer everywhere |
| LoadingSkeleton | aria-hidden | N/A | N/A | Add status |
| Hop measure panel | status + labels | CTA OK | Via buttonClassName | busy/result polish |
| AttackPathGraph / charts | Text fallbacks | Canvas limited | N/A | Keep fallbacks |
| Findings expand | aria-expanded | Operable | Weak | Ring + controls |
| Auth forms | main + labels | Good | Border focus | Model for bare routes |

---

## 9. Alignment with previous panel

| Theme / ID | This pass |
|------------|-----------|
| U-13 nested main + focus traps / rings | **Confirmed open** — P16-1,2,4–9,18 |
| U-05 hop measure CTA product deadlock | Functional residual; a11y path gaps as **P16-15** |
| U-03 dual nav | **P16-14** axe list drift APP vs PRIMARY |
| Prior a11y ~3.2/5 | **3.1/5** — same band; more findings, not regression |
| Protect: skip, Primary current, chart fallbacks, honesty copy | Reaffirmed §4 |

---

## 10. Acceptance criteria (a11y slice definition of done)

- [ ] Exactly one `main` on every authenticated and bare route; skip always targets it.
- [ ] `PageShell` is not `main`; unit test updated.
- [ ] Help, palette, confirm, mobile drawer, account: Escape, trap (or intentional disclosure), labelled, restore focus.
- [ ] Shell interactive controls show ≥3:1 keyboard focus indicator.
- [ ] Hop measure: keyboard e2e; `aria-busy`; result announced; disabled reasons exposed.
- [ ] Loading states announce; primary status never color-only (already mostly true).
- [ ] Playwright: single-main assert + axe WCAG A/AA on primary **PRIMARY_NAV** routes and open help/palette; optional landmark best-practice job.
- [ ] Manual keyboard checklist green: dashboard, findings expand, hop measure, help, palette, mobile drawer.

---

## 11. Evidence limits

- Static code + prior synthesis review only; no live axe run on 2026-07-29 HEAD in this agent pass.
- Contrast is token-estimated, not lab-measured per rendered pair.
- Cytoscape/nivo internals sampled via wrappers only.
- Product code not modified — docs only.

---

## Bottom line

Periscan’s accessibility **foundation is real** (skip link, labeled primary/breadcrumb nav, Radix tabs, text status, chart fallbacks, hop honesty live regions, CI axe). That foundation is **undermined by still-shipping nested `main`**, **half-built modal/drawer keyboard models**, **uneven focus-visible**, and an **axe suite that cannot see landmark-duplicate or most expanded states**. For a design-partner pilot the shell is usable for many mouse-first operators; for **AA procurement or keyboard-first SOC/GRC work** the P1 set (P16-1–9, 14–15) is the minimum gate.

**Panel score:** **3.1 / 5** — agree with previous panel U-13 priority; add hop-measure and axe dual-nav as first-class a11y backlog items alongside landmark + focus-trap work.
)
