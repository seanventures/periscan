# 16 — Accessibility / Inclusive Design (WCAG) Audit

**Date:** 2026-07-29  
**Scope:** Periscan web product shell, shared UI kit, representative workbenches, existing a11y gates, and prior design/UX QA notes.  
**Method:** Static code review of landmarks, keyboard/focus patterns, contrast tokens, dialogs, graphs/charts, and automated test coverage. No product code changes; no live browser axe run in this pass.  
**Standards referenced:** WCAG 2.1/2.2 A–AA (esp. 1.3.1, 1.4.1, 1.4.3, 1.4.11, 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7, 2.5.5, 4.1.2, 4.1.3).

**Related inventory:** [SURFACE_INVENTORY.md](./SURFACE_INVENTORY.md)  
**Prior evidence:** `design-qa.md`, `docs/qa/CORE_PRODUCT_GAP_AUDIT_2026-07-16.md`, `docs/qa/ux-validation-2026-07-13.md`, `docs/USER_STORIES.md` (a11y polish stories), Playwright specs under `tests/e2e/`.

---

## Executive summary

Periscan has a **real accessibility foundation**, not a checkbox afterthought:

- Root skip link → `#main-content`
- Labeled primary `nav`, breadcrumb `nav`, sticky `header`, and shell `main`
- Route-level Playwright + axe-core gates on primary nav routes, dynamic mission/snapshot paths, and product help
- Shared primitives with solid patterns: `Button` (`aria-busy`), Radix `Tabs`, `ConfirmDialog` (labeled dialog + Escape), `StatusPill`/`Badge` text labels, chart/graph **data fallbacks** (`sr-only` tables / node lists)
- Auth and bare routes own their own `main` + `id="main-content"` correctly when chrome is absent

The highest-severity structural defect is still present: **`PageShell` (and some report/demo views) nest a second `<main>` inside `AppShell`’s `<main>`**. Prior gap audit (2026-07-16) already flagged this; the code path remains. Automated axe **WCAG-tagged** scans do **not** fail on it because duplicate-main landmark rules are tagged *best-practice*, not `wcag2a`/`wcag2aa`—so green CI does not clear the finding.

Secondary risks cluster around **incomplete modal focus management** (command palette, help drawer, confirm dialog, mobile nav, account menu), **uneven focus-visible treatment** on shell chrome and many raw inputs, **small/ambiguous touch targets**, and **contrast risk on micro-labels** (`text-subtle` at ~9–11px mono). Status semantics are generally text-backed (good for 1.4.1).

| Dimension | Score (1–5) | Notes |
|---|---|---|
| Landmarks / skip | 3 | Skip + shell landmarks good; nested `main` undermines clarity |
| Keyboard / focus | 3 | Core nav works; overlays incomplete; focus rings inconsistent |
| Name / role / value | 3.5 | Strong on kit; workbenches mixed (`aria-label` vs `<label>`) |
| Contrast / visual | 3 | Dark theme mostly intentional; subtle microcopy & thin focus borders risk AA |
| Non-text alternatives | 4 | Charts/graphs have text fallbacks; canvas decorative when paired with buttons |
| Automated coverage | 3.5 | Real axe gate; misses best-practice landmarks, expanded states, modals except help |
| **Overall a11y readiness** | **3.2** | Pilot-usable; not AA-complete for regulated F1000 procurement |

---

## What was reviewed

| Area | Primary files |
|---|---|
| Root layout / skip link | `apps/web/app/layout.tsx`, `apps/web/app/globals.css` (`.skip-link`, `.sr-only`) |
| Product shell | `apps/web/src/components/app-shell.tsx` |
| Breadcrumbs | `apps/web/src/components/app-breadcrumbs.tsx` |
| Page primitive | `apps/web/src/ui/page.tsx` (+ `page.test.tsx` **requires** `main`) |
| Dialogs / overlays | `confirm-dialog.tsx`, `command-palette.tsx`, `product-help-drawer.tsx` |
| Kit a11y patterns | `button.tsx`, `tabs.tsx`, `feedback.tsx`, `badge.tsx`, `status-pill.tsx`, `chart.tsx`, `attack-path-graph.tsx`, `info-popover.tsx`, `brandmark.tsx` |
| Tokens | `apps/web/app/tailwind.css` (`text-ink` / `muted` / `subtle`, brand, risk) |
| Auth / bare | `auth-form.tsx`, `access-recovery-form.tsx`, `welcome-experience.tsx`, `email-verification.tsx` |
| Nested-main consumers | All `PageShell` pages/workbenches; `snapshot-report-view.tsx`; bare `demo-workspace.tsx` |
| A11y / shell e2e | `tests/e2e/web-accessibility.spec.ts`, `tests/e2e/web-app-shell.spec.ts`, `tests/e2e/demo-mode.spec.ts` |
| Prior QA | `design-qa.md`, `docs/qa/CORE_PRODUCT_GAP_AUDIT_2026-07-16.md`, `docs/qa/ux-validation-2026-07-13.md` |

---

## Strengths (keep)

### 1. Document language and skip navigation

```24:44:apps/web/app/layout.tsx
    <html lang="en">
      ...
      <body className="font-sans antialiased">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <PeriscanQueryProvider>
          <AppShell>{children}</AppShell>
        </PeriscanQueryProvider>
      </body>
```

- `lang="en"` on `<html>`.
- Skip link is focusable, high-contrast (`#7ad4d2` on dark), fixed z-index; shell `main` has `id="main-content"` and `tabIndex={-1}` so programmatic focus can land.
- E2E (`web-app-shell.spec.ts`) asserts Tab focuses skip link and `href="#main-content"`.

### 2. Shell landmark structure (when not nested)

Authenticated chrome exposes:

| Landmark | Implementation |
|---|---|
| Banner | `<header>` command bar |
| Complementary | Desktop rail `<aside>`; mobile drawer `<aside>` |
| Navigation (Primary) | `<nav aria-label="Primary">` with `aria-current="page"`, collapsible groups `aria-expanded` |
| Navigation (Breadcrumb) | `<nav aria-label="Breadcrumb">` + `aria-current="page"` |
| Main | Shell `<main id="main-content" class="product-main">` |

Brand link has `aria-label="Periscan — Dashboard"`; logo `Brandmark` uses real `alt`. Help control has `aria-haspopup="dialog"` + `aria-expanded`. Account control has `aria-haspopup="menu"` + `aria-expanded` + `aria-label`.

### 3. Shared kit patterns

- **Radix Tabs** — keyboard roving focus + `focus-visible:ring-2 ring-brand`.
- **Button** — `focus-visible` ring with offset; `aria-busy` when loading; decorative spinner `aria-hidden`.
- **InlineError / ErrorState** — `role="alert"` / `role="status"` (4.1.3 live regions for action feedback).
- **StatusPill / StateBadge** — text labels, not color alone; often `role="status"`.
- **DistributionChart** — visual chart + always-present data table (visible or `sr-only` when canvas mounts).
- **AttackPathGraph** — Cytoscape canvas + ordered node list + edge list fallback (`sr-only` when interactive ready).
- **Orchestration flow** — decorative `canvas aria-hidden`; nodes are real `<button aria-pressed>`.
- **ConfirmDialog** — `role="dialog"`, `aria-modal`, labelled/described, Escape, initial focus, typed phrase for irreversible actions.
- **Auth forms** — real `<label>` via `Field` + `htmlFor` / `id` pairing.

### 4. Automated regression gates

`tests/e2e/web-accessibility.spec.ts`:

- Every `APP_NAV_ITEMS` href + `/welcome`, `/getting-started`, `/demo/workspace`
- Dynamic `/missions/:id`, `/snapshots/:id`, `/snapshots/:id/report`
- Product help dialog open on `/missions`
- Tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`
- Shell tests: skip link, single `aria-current="page"`, breadcrumb current page, help expand/collapse
- Demo mode axe in `demo-mode.spec.ts`
- CI referenced in README / `PRODUCTION_READINESS.md` / module workflow tests

Unit tests exercise roles on kit pieces (`page.test.tsx`, `ui.test.tsx`, `info-popover.test.tsx`, breadcrumbs/navigation tests).

### 5. Prior design QA

`design-qa.md` records intact landmarks, logo alt, labeled help dialog, brand-blue focus treatment, and green browser suite including mission a11y. Treat that as **regression baseline for reviewed states**, not full WCAG AA certification of every expanded workbench.

---

## Findings

Severity: **P0** adoption-halting · **P1** AA / assistive-tech clarity · **P2** consistency / edge · **P3** polish.

### P1 — Nested `main` landmarks (still open)

**WCAG:** 1.3.1 Info and Relationships; landmark best practice; confuses 2.4.1 bypass blocks.

**Mechanism:**

1. `AppShell` always wraps authenticated pages in `<main id="main-content" className="product-main">`.
2. `PageShell` **also** renders `<main>`:

```11:22:apps/web/src/ui/page.tsx
export function PageShell({ className, children, ...rest }: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-none px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
        className
      )}
      {...rest}
    >
      <div className="flex flex-col gap-6">{children}</div>
    </main>
  );
}
```

3. Unit test **locks the wrong contract**: `page.test.tsx` expects `getByRole("main")` from `PageShell` alone.

**Known consumers (nested when under shell):**

| Surface | Path |
|---|---|
| Account security | `/account-security` |
| ATT&CK techniques | `/attack-techniques` |
| Policies | `/policies` |
| Validation Ops | `/validation-ops` |
| Engagements | `/engagements` |
| Signal activity | `/signal-activity` |
| Threat feed | `/threat-feed` |
| External validation | `/external-validation` |
| Data fabric workbench | `/data-fabric` |
| Non-human identities | `/non-human-identities` |

**Additional nested / competing mains:**

| Surface | Issue |
|---|---|
| `snapshot-report-view.tsx` | Own `<main className="report-page">` under shell `main` (covered by a11y dynamic routes) |
| Bare routes (`auth-form`, welcome, recovery, verify-email) | Correct: own `main#main-content` while shell is bare |
| `demo-workspace.tsx` | Own `<main>` without `id="main-content"`; skip link still targets `#main-content` → **broken skip target on guided demo** when shell is bare for `/demo` |

Prior: `docs/qa/CORE_PRODUCT_GAP_AUDIT_2026-07-16.md` § “Ten authenticated routes contain nested `main` landmarks”; recommendation #10 still unfixed for `PageShell`.

**Why CI stays green:** axe `landmark-no-duplicate-main` / `landmark-main-is-top-level` are typically **best-practice**, not in the WCAG tag set used by `web-accessibility.spec.ts`.

**Fix (recommended):**

1. Change `PageShell` to `<div className=…>` (or `<section>`) — not `main`.
2. Update `page.test.tsx` to assert layout container, not a second main.
3. Strip inner `<main>` from `snapshot-report-view` when rendered inside shell; use a `div`/section with `aria-busy`.
4. On bare demo/workspace: set `id="main-content" tabIndex={-1}` on the single main.
5. Add an axe run (or custom Playwright assert) for **exactly one** `main` per route, independent of WCAG tags.

---

### P1 — Modal / overlay keyboard and focus incomplete

| Overlay | Escape | Initial focus | Focus trap | Restore focus | Notes |
|---|---|---|---|---|---|
| Product help drawer | Yes | Close button | **No** | **No** | Backdrop is a full-screen button (good hit target); Tab can leave dialog into page |
| Command palette | Yes (on input) | Search input | **No** | **No** | `role="dialog"` + `aria-modal` but no inert background; listbox pattern incomplete |
| ConfirmDialog | Yes | Confirm or phrase input | **No** | **No** | Destructive without phrase focuses **Confirm** first (risky) |
| Mobile nav drawer | **No** | **No** | **No** | N/A | No `aria-modal`; focus can remain on background |
| Account menu | **No** | **No** | **No** | N/A | `role="menu"` without arrow-key model or focus containment |

**WCAG:** 2.1.2 No Keyboard Trap (inverse: content must be operable without trap bugs), 2.4.3 Focus Order, 4.1.2 Name/Role/Value (dialog expectations).

**Command palette specifics (`command-palette.tsx`):**

- `role="listbox"` with `role="option"` + `aria-selected`, but focus stays on the text field; no `aria-activedescendant` linking the active option.
- Option icons sometimes render SVG **without** `aria-hidden` (nav icons).
- Wrapper fragments place non-`li` group headers inside the listbox structure (invalid listbox children).

**Fix:** Shared focus-trap utility (or Radix Dialog/Popover) for all overlays; return focus to trigger; for destructive confirm, focus Cancel first unless phrase-gated; implement combobox or listbox+activedescendant correctly for palette; mobile drawer: Escape, focus first link, `aria-modal`/`inert` on background.

---

### P1 — Focus visibility inconsistent (2.4.7 / 1.4.11)

**Good:** Shared `Button`, many workbench controls with `focus-visible:ring-2 focus-visible:ring-brand`, tabs, help close, guided-nav toggle.

**Weak / missing focus-visible ring:**

- Mobile “Open navigation” control (border only, no ring utility)
- Command-palette launcher in the header (`outline` not restored on keyboard focus)
- Account avatar (`size-7` circle, no ring classes)
- Primary nav group toggles (hover color only)
- Many raw inputs across workbenches: `outline-none focus:border-brand` or `focus:border-line-strong` — border color change alone often fails **3:1 non-text contrast** for focus indication against dark navy borders (`#23386b` → `#3c96ff` is better; → `#line-strong` is weaker)

`#main-content:focus { outline: none; }` is acceptable if skip-focus is intentional and users move into content, but there is no visible focus ring when the main is focused via skip.

**Fix:** Global utility or kit class for interactive chrome: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg`. Prefer ring over border-only for inputs. Do not remove outline without a replacement.

---

### P2 — Contrast and density risks (1.4.3 / 1.4.11)

Tokens (`apps/web/app/tailwind.css` / `globals.css`):

| Token | Hex | Typical use |
|---|---|---|
| `ink` | `#eaf0fb` | Body / titles on void — strong |
| `muted` | `#9fb2d6` | Descriptions — likely AA on void/surface |
| `subtle` | `#758db5` | Mono micro-labels, nav group titles, meta rows |
| surfaces | `#05070f`–`#12203f` | Dark console |

Static estimate: `subtle` on pure void is roughly mid‑5:1 range (borderline **AA normal text** depending on exact background). Risk increases when:

- `text-subtle` sits on `bg-surface-strong` / elevated panels
- Labels are **9–10.5px mono uppercase** (nav groups, metric captions) — even if contrast computes, legibility for low vision fails in practice
- Status chips use low-alpha fills (`bg-success/8` + `text-success`) — usually OK on dark; verify **warning** `#ffcf4d` and **inconclusive** greys on non-void panels
- Disabled primary buttons: `disabled:text-subtle` on `#0c1220` — may fall under disabled exception but still hard to parse

**Color-only:** Severity/status generally include text (`StatusPill`, `StateBadge`). Health dot in command bar is paired with “systems nominal” / “degraded” text — good. Prefer never shipping status as dot-only.

**Fix:** Raise `subtle` toward `#8fa4c4`+ for text-at-small-sizes; enforce min 12px for essential meta; run automated contrast (axe `color-contrast` is in WCAG tags — re-run after expanded interactive states). Manually check warning/amber on navy headers.

---

### P2 — Target size and mobile drawer (2.5.5 / 2.5.8)

- Account control is **`size-7` (28px)** — under 24×24 minimum (2.5.8 AA) / far under 44×44 enhanced.
- Nav group chevrons and dense mono rows are compact by design.
- Mobile hamburger is ~icon + padding; verify ≥24px hit box.
- Mobile drawer: overlay click closes; no Escape; background page remains focusable/scrollable → keyboard and SR users can “leave” the drawer invisibly.

USER_STORIES explicitly ask for ≥44px touch targets on &lt;360px viewports — not fully enforced in shell chrome.

---

### P2 — Form labeling inconsistency

Auth and kit dialogs use proper labels. Many workbenches use **placeholder + `aria-label`** without visible `<label>` (filters, admin, AI apps, subscription rail). That can meet 4.1.2 but fails **visible label** expectations (3.3.2 Labels or Instructions) when the placeholder disappears on type.

Prefer: visible label (can be visually adjacent mono caption) + `htmlFor`/`id`, with `aria-label` only as supplement.

---

### P2 — Live regions / loading announcement gaps

- `LoadingSkeleton` is **`aria-hidden`** with no companion `role="status"` “Loading…” — screen readers may hear silence or stale content during fetch.
- Some pages use `aria-busy` (e.g. report view); shell-level routes often do not.
- Action feedback via `InlineError` is the right pattern where adopted; silent catches (called out in 2026-07-13 UX audit) remain an **a11y + trust** issue when failures are not announced.

---

### P2 — Coverage gaps in automated a11y tests

| Covered | Not covered / weak |
|---|---|
| Static primary nav routes (default paint) | Expanded findings rows, open disposition panels, multi-step wizards |
| Help dialog open | Command palette, ConfirmDialog, account menu, mobile drawer |
| Dynamic mission / snapshot IDs | Auth bare routes (`/login`, `/signup`, `/reset-password`) axe |
| WCAG A/AA tags | Best-practice landmark uniqueness; keyboard-only paths; reduced-motion |
| Shell skip + aria-current | Focus order through full primary action → rail → content |

Axe default load also misses content that appears only after client data hydration if analysis races before content—worth asserting a stable landmark/heading before `analyze()`.

---

### P3 — Secondary issues

1. **Command bar search control** has visible text but no `aria-haspopup="dialog"` (help has it; palette launcher does not).
2. **Tenant switcher** chevron implies a menu but navigates to `/mssp` as a link — potentially surprising (3.2.2); not strictly a failure if named clearly.
3. **InfoPopover** uses `role="tooltip"` while toggled like a disclosure; `aria-describedby` always points at content even when closed (`sr-only`) — workable but non-ideal; prefer `role="dialog"` or disclosure pattern for click-to-toggle.
4. **`prefers-reduced-motion`:** skeletons use `motion-safe:animate-pulse`; some custom animations use `motion-safe:` — good partial support; verify canvas/radar animations.
5. **Localization:** `translateUiText` on nav/help improves i18n path; `lang` stays `en` on `<html>` even if locale changes — future gap.
6. **Design-qa mobile gap:** prior notes that phone-sized visual/a11y capture was incomplete for design-system pass; shell has `md` breakpoints but a11y of mobile drawer is under-tested.
7. **Nested landmark history:** HANDOFF notes runner control room nested landmark was removed after green gate — same discipline not yet applied to `PageShell`.

---

## Landmark map (intended vs actual)

### Intended (authenticated product)

```
body
├── a.skip-link → #main-content
└── .periscan-app-shell
    ├── aside (desktop rail)
    │   └── nav[aria-label=Primary]
    ├── header (command bar)
    ├── main#main-content.product-main
    │   ├── nav[aria-label=Breadcrumb]
    │   └── page content (div/section only)
    ├── dialog Command palette (when open)
    └── dialog Product help (when open)
```

### Actual on PageShell routes

```
main#main-content.product-main
└── main   ← nested; skip lands on outer; SR “main” ambiguous
    └── page content
```

### Bare auth / welcome

```
main#main-content   ← correct single main
```

### Guided demo (`/demo/workspace` bare)

```
main[data-demo-mode]   ← no id="main-content"; skip link target missing
```

---

## Keyboard path smoke checklist (manual / future e2e)

Use after any shell or dialog change:

1. **Tab** → Skip visible → Enter → focus `#main-content` (verify ring or intentional none + next Tab into content).
2. Desktop: Tab through help, palette launcher, account; open each with Enter/Space; **Escape** closes; focus returns to trigger.
3. **⌘/Ctrl+K** opens palette; arrows move highlight; Enter navigates; Escape closes; Tab does not reach inert page (once trap added).
4. Mobile &lt;md: Open nav; Escape closes; focus not lost behind overlay.
5. Primary nav: expand/collapse group with keyboard; active link has `aria-current="page"` only once.
6. Destructive confirm: Tab order Cancel before Confirm (or phrase field first).
7. Findings expand row: `aria-expanded` toggles; focus remains on control.
8. Attack path graph: SR can read node list even when canvas present.

---

## Component scorecard (sampled)

| Component | Landmarks / roles | Keyboard | Focus visible | Notes |
|---|---|---|---|---|
| `AppShell` | Strong | Partial | Uneven chrome | Nested main from children; mobile drawer weak |
| `PageShell` | **Wrong element** | N/A | N/A | Should not be `main` |
| `AppBreadcrumbs` | Good | Good | Via links | Current page not a link (correct) |
| `CommandPalette` | Dialog + partial listbox | Partial | Input only | No trap / activedescendant |
| `ProductHelpDrawer` | Dialog labeled | Escape + close | Close has ring | No trap / restore |
| `ConfirmDialog` | Full labeling | Escape | Buttons via kit | No trap; confirm-first risk |
| `Tabs` (Radix) | Good | Good | Good | Preferred pattern |
| `Button` | Good | Good | Good | Prefer over raw buttons |
| `DistributionChart` | figure + table | N/A (static) | N/A | Excellent fallback |
| `AttackPathGraph` | figure + lists | Canvas limited | N/A | Text fallback present |
| `OrchestrationFlowMap` | group + buttons | Good | Good | Canvas decorative |
| `AuthForm` | main + labels | Good | Border focus | Solid bare-route model |
| `Findings` rows | expanded button | Good | Needs ring check | Checkbox labeled |
| `StatusPill` / badges | status text | N/A | N/A | Color not sole channel |

---

## Alignment with prior QA

| Source | A11y takeaway | Status in code 2026-07-29 |
|---|---|---|
| `design-qa.md` | Landmarks intact, help dialog labeled, brand focus, axe green on reviewed flows | Largely true for shell + kit; does not clear nested `PageShell` main |
| Core product gap audit 2026-07-16 | Nested main on ten routes; axe not sufficient for nested/expanded | **Still open** for `PageShell` + report main |
| UX validation 2026-07-13 | Persona Accessibility mean **3.2** | Unchanged order of magnitude |
| USER_STORIES a11y polish | Labels, live status, focus-visible, skip, touch targets | Partially implemented; gaps above |
| HANDOFF runner room | Nested landmark removed after gate | Good precedent; apply to `PageShell` |

---

## Recommended fix order

1. **P1 landmarks (S):** `PageShell` → non-`main`; fix snapshot report + demo `id="main-content"`; flip unit test; assert single `main` in Playwright.
2. **P1 overlays (M):** Shared modal primitive with focus trap, Escape, restore focus; apply to help, palette, confirm, mobile nav, account menu.
3. **P1 focus-visible (S):** Shell chrome + global input focus ring convention; drop border-only focus as sole indicator.
4. **P2 contrast / type (S):** Token bump for `subtle` text; min size for critical meta; re-run axe color-contrast on dense workbenches.
5. **P2 forms / loading (S–M):** Visible labels on filters; `role="status"` loading copy alongside skeletons.
6. **P2 test expansion (M):** Axe after open palette/help/confirm; keyboard journeys; mobile drawer; bare auth routes; optional best-practice landmark rules.

---

## Acceptance criteria (definition of done for a11y slice)

- [ ] Exactly one `main` landmark on every authenticated and bare route; skip link always targets it.
- [ ] No nested `main`; `PageShell` is a layout container.
- [ ] All dialogs/drawers: Escape, focus trap, labelled name, restore focus to trigger.
- [ ] Interactive shell controls show a ≥3:1 focus indicator under keyboard.
- [ ] Primary status never color-only; loading and errors announced.
- [ ] Playwright: single-main assert + axe WCAG A/AA on primary routes **and** open help/palette; optional `best-practice` landmark rules in a separate non-blocking or blocking job.
- [ ] Manual keyboard pass checklist green on dashboard, findings expand, missions, help, palette.

---

## Evidence limits

- This pass is **code + prior-doc review**, not a live VoiceOver/NVDA session or fresh Playwright axe run on 2026-07-29 HEAD.
- Contrast values are token-based estimates, not APCA/WCAG lab measurements per rendered pair.
- Expanded multi-panel workbench states and third-party nivo/cytoscape internals were sampled via wrappers only.
- Product code was not modified.

---

## Bottom line

Periscan’s accessibility **investment is real** (skip link, labeled navigation, breadcrumb currency, Radix tabs, text status, chart/graph fallbacks, and a CI axe gate). That investment is undermined by a **still-shipping nested `main` primitive**, **incomplete modal focus management**, and **uneven focus/contrast discipline** outside the shared button kit. Treat route-level green axe as **necessary but not sufficient**—especially while landmark-duplicate rules sit outside the WCAG tag filter.

**Panel score (Accessibility persona):** **3.2 / 5** — same band as the 2026-07-13 multi-persona mean; not a regression story, but not closed either. Closing P1 landmarks + overlay focus would move the product into a credible **AA pilot** posture for the shell and primary nav surfaces.
