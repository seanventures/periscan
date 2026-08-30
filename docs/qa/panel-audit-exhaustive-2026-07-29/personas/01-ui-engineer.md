# Panel P01 — Senior UI Engineer

**Date:** 2026-07-29  
**Lens:** Design systems, chrome consistency, visual density, responsive layout, empty states, severity language, orphan surfaces, feature-zoo noise  
**Scope:** `apps/web` — shell, nav, kit, globals, dashboard, findings, attack-path detail, external validation, tool governance  
**Method:** Code-grounded read-only audit (no product edits)  
**Previous panel:** `PREVIOUS_PANEL_SYNTHESIS.md` (U-03, U-13–U-16, feature zoo)

---

## 1. Verdict

**3.0 / 5.0** on the UI-engineer lens.

**5.0 definition:** One design system (tokens + primitives), one chrome recipe for every authenticated page, one severity/status color map, ≤12 primary destinations for the default persona, no nested landmarks, no orphan v1/v2 twins, empty/error/loading states from a single kit, and a queue that reads in under 5 seconds at 1280px and on a phone without badge soup.

**Why 3.0:** The Tailwind kit (`apps/web/src/ui/*` + `tailwind.css`) is real, intentional, and already used on the best surfaces (dashboard, findings-v2, attack-path detail, tool governance). The product still ships a parallel legacy CSS world (`globals.css` panels/pills/buttons), dual nav configs, nested `<main>`, conflicting severity palettes, dead `/scopes` links, and ~37 primary-nav destinations with Autonomous/Intel on the same rail as Prove. Visual craft is present; visual *system* is not.

Agrees with previous panel: U-03 (nav zoo), U-13 (nested main), U-14 (dual design systems), U-15 (severity maps), U-16 (autonomous chrome noise).

---

## 2. Top 5 moves to reach 5.0

1. **Retire dual systems in one quarter:** freeze `globals.css` product classes; every authenticated route uses kit `Panel` / `Button` / `StateBadge` / page container; re-enable Tailwind preflight when legacy is gone.
2. **One page chrome primitive:** replace `PageShell`’s inner `<main>` with a non-landmark `PageContainer`; force every workbench (including max-w-7xl ad-hoc wrappers) through it so breadcrumbs + content share width/padding.
3. **Single severity + status token module:** export `severityTone` / `severityChartColor` / finding-status tones from `src/ui`; delete per-file `SEVERITY_*` maps; never paint `Validated` (open exposure) as success-green.
4. **Persona rail ≤10 items:** Prove loop only by default; demote Autonomous, Intel, MCP, Swarm, Model Gateway to Labs / command palette / admin; delete dead `app-navigation` + orphan v1 workbenches.
5. **Queue density diet:** findings row shows title + priority + **one** primary badge (severity or exploitability); rest in expanded detail / columns at `lg+`; kill 4–5 badge rails on sm+ lists.

---

## 3. Feature-zoo / IA notes

| Action | Items |
|--------|--------|
| **Keep primary** | Dashboard, Missions (Validation Snapshot), Attack Paths, Findings, Remediation, Schedules, Runners, Integrations, Reports, Evidence (+ Admin/Trust as footer) |
| **Merge** | Threat Center + Threat Feed + Signal Activity → one Intel stream; Validation Ops + Missions operational tabs; Registries/Tool Governance under Integrations |
| **Rename** | Nav “Findings” ↔ page H1 “Validated Results”; “Validation Snapshot” vs missions eyebrow “Missions”; “Assets & Scope” vs data-fabric eyebrow “Connect / Unified data fabric” |
| **Demote / Labs** | Agent Swarm, Agent Workflows, Operators, Engagements, MCP Server, Model Gateway (exists as route, not even consistent in both navs), Extension Developer Studio embedded in Tool Governance |
| **Delete / quarantine** | `app-navigation.ts` + `AppNavigation` (tests-only), orphan v1: `findings-workbench.tsx`, `schedules-workbench.tsx`, `threat-center-workbench.tsx`, `trust-safety-dashboard.tsx` (still mounted on `/policies`!), `integration-marketplace.tsx`, `mssp-portfolio-dashboard.tsx` |
| **Fix dead UI** | `/scopes` links from attack-path detail → no `app/scopes` route; point to missions / data-fabric / scope editor |

**Zoo visual noise sources:** 7 collapsible nav groups, gradient “primary action” + persona chip + maturity toggle + systems-nominal pill + Help + user menu + breadcrumbs + per-page eyebrow/H1/description + LiveUpdatePill + filter chips + multi-badge rows + ExtensionDeveloperStudio co-located with marketplace.

---

## 4. What is already excellent (do not break)

- **Empty-tenant Get Started** on dashboard when no paths/findings/snapshots — avoids wall of zeros (`dashboard-command-center.tsx`).
- **StateBadge domain primitives** — Validation / Control / Policy / RiskBand / EvidenceBasis / SafetyLevel / AttackPathClaim are the right honesty language (`state-badge.tsx`).
- **Evidence basis solid vs outline** — Measured solid, Heuristic outline.
- **Needs you / work queue** direction on command center.
- **Lifecycle + persona nav allow-lists** for New/Activating and SecurityLeader/GrcAuditor/MsspOperator (`app-shell.tsx`) — correct *direction*, incomplete packaging.
- **Skip link** to `#main-content` in root layout.
- **Command palette (⌘K)** over primary nav items.
- **Findings-v2** saved views, bulk disposition, CSV export, mobile badge reflow (`sm:hidden` stack) — solid ops direction once density is fixed.
- **External validation** safety copy and policy-gated launch UX.
- **Tool governance** honest LegalReview/Blocked gating and summary tiles.
- **Attack path claim badge** separating recorded workflow state from evidence certainty.

---

## Findings

### FINDING | P01-1 | P0 | bug | design-system | Dual design systems still co-equal (globals.css vs Tailwind kit)
- **Persona:** Senior UI Engineer
- **Evidence:** `apps/web/app/layout.tsx` imports both `./globals.css` and `./tailwind.css`. `tailwind.css` documents that preflight is **disabled** because legacy styles still own unmigrated pages. Legacy product chrome: `.panel`, `.primary-button` (teal gradient `#5ac8c4`), `.status-pill--ok/error/pending` in `globals.css`. Kit chrome: blue primary `buttonClassName` (`#3c96ff`→`#2f6bff`), `Panel` with `#1e3568` borders, `StateBadge` mono tones in `src/ui/*`. Live mix: `engagement-workbench.tsx`, `runners-workbench.tsx`, `validation-ops-dashboard.tsx`, `api-reference-view.tsx`, `integration-marketplace.tsx` still assert/use `.status-pill--*`; dashboard/findings-v2/attack-path-detail use kit.
- **Problem:** Operators experience two products: rounded-20 teal “marketing panel” pages vs sharp radius-6 blue “security console” pages. Tokens for surfaces/borders/ink exist twice (`:root` CSS vars vs `@theme` colors) with near-but-not-equal values.
- **Impact:** Undermines enterprise trust, doubles maintenance, blocks consistent focus rings/contrast, makes “one chrome” roadmap impossible. Confirms previous U-14.
- **Recommendation:** Inventory components still using `.panel`/`.primary-button`/`.status-pill`; migrate or wrap; mark `globals.css` product classes deprecated; single token source in `tailwind.css`; re-enable preflight last.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-14

### FINDING | P01-2 | P0 | bug | a11y | Nested `<main>` landmarks on PageShell routes
- **Persona:** Senior UI Engineer
- **Evidence:** `app-shell.tsx` always wraps product children in `<main id="main-content" className="product-main">`. `src/ui/page.tsx` `PageShell` renders a **second** `<main>`. Consumers: `external-validation/page.tsx`, `threat-feed/page.tsx`, `engagements/page.tsx`, `signal-activity/page.tsx`, `validation-ops/page.tsx`, `attack-techniques/page.tsx`, `account-security/page.tsx`, `policies/page.tsx`, plus workbenches `data-fabric-workbench.tsx`, `non-human-identity-workbench.tsx`. Bare auth routes also each ship their own `<main id="main-content">` (`auth-form.tsx`, `access-recovery-form.tsx`, `email-verification.tsx`) — OK when shell is bare; product routes nest.
- **Problem:** Multiple `main` landmarks break skip-link semantics and screen-reader document outline.
- **Impact:** Accessibility fail for enterprise RFP; skip link lands on outer main while focusable content lives in inner. Confirms U-13.
- **Recommendation:** Change `PageShell` to `<div role="presentation">` or `PageContainer`; keep a single main in AppShell only. Add a lint/test: `document.querySelectorAll('main').length === 1` on product pages.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P01-3 | P0 | bug | findings | Finding status `Validated` paints success-green (open exposure)
- **Persona:** Senior UI Engineer
- **Evidence:** `findings-workbench-v2.tsx` `STATUS_TONE.Validated = "validated"` → teal success via `StateBadge`. Same file uses `ValidationStateBadge` which maps ValidationState `Validated` → `"validated"` green (`state-badge.tsx`). Legacy v1 explicitly forbade this: `findings-workbench.tsx` comments that Validated is a **confirmed open** finding and must not use success tone (`findingStatusTone` → warning, not success).
- **Problem:** Operators scan green as “good / done.” Confirmed unremediated exposure reads fixed.
- **Impact:** Mis-triage; trust damage to honesty architecture; regression vs v1 intentional domain mapping.
- **Recommendation:** Finding **status** tones: Fixed/Revalidated → fixed; Validated/New/InProgress → approval or missed (attention); never success for open validated. Keep ValidationState map careful: Validated/Exploitable/Missed are negative/attention, not “validated good.” Consider renaming StateTone `validated` → `proven` or `pass` to avoid collision with domain word Validated.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-15

### FINDING | P01-4 | P1 | bug | design-system | Severity color maps disagree across dashboard charts, badges, and legacy findings
- **Persona:** Senior UI Engineer
- **Evidence:**
  - Dashboard badges: `SEVERITY_TONE` Critical/High both `"missed"`; charts `SEVERITY_COLOR` High = `var(--color-approval)` yellow, Medium = `var(--color-blocked)` blue (`dashboard-command-center.tsx`).
  - Findings-v2 badges: Critical/High both `"missed"`; Low = `"validated"` (green) (`findings-workbench-v2.tsx`).
  - Legacy findings charts: Critical=`danger`, High=`warning`, Medium=`info`, Low=`success` (`findings-workbench.tsx`).
  - Threat feed: separate `severityTone` → BadgeTone (`threat-feed-workbench.tsx`).
  - Risk band: Critical **and** High both `"missed"` (`state-badge.tsx` RISK_BAND_TONE) — no visual rank between Critical and High.
- **Problem:** Same severity word has different colors on adjacent surfaces; Critical≈High on badges; Low reads “healthy.”
- **Impact:** Executive/SOC cannot trust color encoding; training cost; confirms U-15.
- **Recommendation:** One module `severityVisual.ts` with tone + chart color + optional rank stripe; Critical distinct from High (e.g. missed vs approval or dedicated critical token); Low/Informational neutral, never success-green.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-15

### FINDING | P01-5 | P1 | bug | paths | Dead “Verify scope” href `/scopes` (no app route)
- **Persona:** Senior UI Engineer
- **Evidence:** `attack-path-detail.tsx` eligibility hint and links use `href: "/scopes"`; tests expect that href. There is **no** `apps/web/app/scopes/` page. Scope management lives under missions / snapshot flow / data-fabric surfaces.
- **Problem:** Primary recovery CTA from blocked hop measurement is a 404-class navigation dead end.
- **Impact:** Breaks hop-measure journey packaging (ties to previous hop CTA / Slice 3 story); looks unfinished.
- **Recommendation:** Point to the real scope UX (e.g. `/missions` or `/data-fabric` + hash/query); add route test that every in-app href resolves to an `app/**/page.tsx`.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-05

### FINDING | P01-6 | P1 | improvement | nav | Dual nav configs + orphan AppNavigation (feature zoo backbone)
- **Persona:** Senior UI Engineer
- **Evidence:** Live shell imports `PRIMARY_NAV` from `primary-nav.tsx` (~37 items, 7 groups). Parallel `app-navigation.ts` `APP_NAV_SECTIONS` (~40 items, different labels/groups including Model Gateway, Data fabric naming, Exposure vs Findings). `AppNavigation` component is **only** referenced by its own tests—not mounted in layout. Comments in `primary-nav.tsx` admit intentional dualism “so the old nav + its test stay untouched.”
- **Problem:** Two sources of truth for IA; labels diverge (Findings vs Exposure, MSSP vs Clients, Registries vs Tool Governance); palette/shell only use one while tests/docs may cite the other.
- **Impact:** Nav thrash for contributors; product packaging looks unowned. Confirms U-03.
- **Recommendation:** Delete `app-navigation.ts` / `AppNavigation` after migrating any unique routes into PRIMARY_NAV or Labs list; single export; breadcrumb + command palette already depend on PRIMARY_NAV—keep it that way.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P01-7 | P1 | improvement | nav | Primary rail is a feature zoo (~37 destinations; Autonomous on main track)
- **Persona:** Senior UI Engineer
- **Evidence:** `PRIMARY_NAV` groups Prove(5)+Investigate(8)+Remediate(2)+Autonomous(5)+Operate(6)+Intel(3)+Govern(8). Autonomous includes Swarm, Workflows, Operators, Engagements, MCP. Investigate includes AI Apps, Machine Identities, External Validation alongside core path/findings. Persona allow-lists help for New/Activating/SecurityLeader but SecurityEngineer (default) still gets the full zoo; “Show all navigation” undoes lifecycle filtering.
- **Problem:** First visual impression is platform sprawl, not “see path → break link → re-test.”
- **Impact:** Onboarding and sales demos lose the hero loop; matches Jobs/Horowitz/Palantir zoo consensus (U-16).
- **Recommendation:** Default rail ≤10 proof-loop items; Autonomous + Intel + secondary Govern behind Labs accordion or command palette only; lifecycle filter default on until first Fixed verified remediation.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P01-8 | P1 | improvement | findings | Badge density turns the findings queue into a chip rail
- **Persona:** Senior UI Engineer
- **Evidence:** `findings-workbench-v2.tsx` row (sm+): exploitability + severity + ValidationStateBadge + status + optional disposition — up to **5** mono uppercase badges beside truncated title; mobile moves four into expanded detail. Header also stacks severity distribution chips for every severity present. Bulk bar + saved views + three FilterSelects + CSV + risk acceptance strip above the list.
- **Problem:** Priority title is visually weaker than the badge strip; scanning for “what do I do next” loses to taxonomy soup.
- **Impact:** SOC Monday-morning usability drop; contradicts “ranked queue” product help copy.
- **Recommendation:** Collapsed row: title, priority score, **one** severity (or exploitability if worse), status text muted; secondary badges only expanded or `lg` multi-column table. Cap header severity chips to top 3 + “+N”.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-11

### FINDING | P01-9 | P1 | improvement | design-system | Inconsistent page chrome (ad-hoc max-w-7xl vs PageShell vs breadcrumb width)
- **Persona:** Senior UI Engineer
- **Evidence:**
  - Kit workbenches: `mx-auto max-w-7xl px-5 py-6` + custom eyebrow (`dashboard-command-center`, `findings-workbench-v2`, `attack-path-detail`, `tool-governance-marketplace`, `threat-center-workbench-v2`, `reports-workbench`, …).
  - PageShell: `px-4 py-6 sm:px-6 lg:px-8` + gap-6 + PageHeader with **success-green** mono eyebrow (`page.tsx`).
  - Breadcrumbs: `.app-breadcrumb` max-width **1080px** padding 14/24 (`globals.css`) while content is often 1280px (7xl) — left edge misalignment.
  - Eyebrow color: kit pages use `text-brand`; PageHeader uses `text-success`.
- **Problem:** No single vertical rhythm or alignment; breadcrumbs float on a different column width than content.
- **Impact:** Feels like assembled modules, not one product; harder to teach layout conventions.
- **Recommendation:** One `PageContainer` (width, padding) used by shell content area; breadcrumbs full-bleed within same container; standardize eyebrow to brand or section label only (not dual colors).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-14

### FINDING | P01-10 | P1 | improvement | design-system | Orphan v1/v2 component twins and dual trust surfaces
- **Persona:** Senior UI Engineer
- **Evidence:**
  - Live: `findings-workbench-v2`, `schedules-workbench-v2`, `threat-center-workbench-v2`, `trust-safety-dashboard-v2` (trust-safety page), `integrations-marketplace`, `mssp-portfolio-workbench`.
  - Dead/test-only twins: `findings-workbench.tsx`, `schedules-workbench.tsx`, `threat-center-workbench.tsx`, `integration-marketplace.tsx`, `mssp-portfolio-dashboard.tsx`.
  - **Still mounted:** `policies/page.tsx` imports **v1** `TrustSafetyDashboard` while `/trust-safety` uses v2 — two different Trust UIs.
- **Problem:** Parallel implementations diverge in tokens, empty states, and status mapping (see P01-3); policies route looks like a different product.
- **Impact:** Bug fixes land on wrong twin; visual inconsistency; test surface area without user value.
- **Recommendation:** Delete unused v1 files after snapshotting unique behaviors into v2; policies page compose kit Policy panel, not full v1 dashboard clone.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-14

### FINDING | P01-11 | P1 | improvement | mobile | Responsive gaps: filter bars, hop tables, mobile drawer chrome
- **Persona:** Senior UI Engineer
- **Evidence:** App shell: desktop rail 236px sticky; mobile hamburger + full-height drawer **without** Escape-to-close, focus trap, or `aria-modal` (contrast command palette / help drawer which handle Escape). Findings filters: wrap stack of select chips — usable but tall. Attack path detail: multi-badge header + edge plan cards with many StateBadges/SafetyLevel/EvidenceBasis per hop. Tool governance: `md:grid-cols-[…]` good, but ExtensionDeveloperStudio always above marketplace. Hardcoded hex borders in shell (`border-[#14224a]`, `#23386b`) ignore tokens.
- **Problem:** Phone path is second-class; drawer a11y incomplete; dense hop UI will horizontal-stress small viewports.
- **Impact:** Field operators on laptop-narrow / tablet struggle; a11y residual beyond nested main.
- **Recommendation:** Escape + focus trap + inert background on mobile nav; hop rows as stacked definition lists under `md`; reduce header badges to risk + claim on small screens; map borders to `border-line`.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-13

### FINDING | P01-12 | P2 | improvement | design-system | Empty states are three dialects, not one kit
- **Persona:** Senior UI Engineer
- **Evidence:** Kit `EmptyState` (`empty-state.tsx`) — dashed border, centered. Also `StatusPanel` kind empty (`status-panel.tsx`), `NotConfigured` / `MissingSignalCallout` (`feedback.tsx`), plus one-liner `<p className="text-xs text-muted">` empties in tool-governance platform packs, attack-path “No edges recorded…”, reports “No snapshots yet…”, validation-snapshot-flow scope empties. Dashboard GetStarted is excellent but unique.
- **Problem:** Some empties look like errors, some like footnotes, some like marketing cards.
- **Impact:** Operators cannot pattern-match “no data yet” vs “misconfigured” vs “failed load.”
- **Recommendation:** Mandate `EmptyState` | `NotConfigured` | `ErrorState` only; ban raw empty paragraphs in workbenches; document when GetStarted vs EmptyState.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P01-13 | P2 | bug | copy | Nav labels and page titles disagree (Findings / Validated Results / Exposure)
- **Persona:** Senior UI Engineer
- **Evidence:** Rail label “Findings” (`primary-nav.tsx`); findings-v2 H1 “Validated Results”; legacy eyebrow “Validated results”; `app-navigation` still says “Exposure”; breadcrumb resolves PRIMARY_NAV → “Findings”; metadata title “Findings — Periscan.” Missions: nav “Validation Snapshot” vs missions workbench eyebrow “Missions.” Data fabric: nav “Assets & Scope” vs PageHeader “Connect / Unified data fabric.”
- **Problem:** Wayfinding fails when breadcrumb, tab title, H1, and rail disagree.
- **Impact:** Support burden; training decks wrong; feels unpolished vs honesty core.
- **Recommendation:** Single `surfaceMeta` map: `{ href, navLabel, title, eyebrow, section }`; breadcrumb/H1/metadata consume it.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

### FINDING | P01-14 | P2 | improvement | engines | Tool governance page is a visual feature zoo (marketplace + packs + developer studio)
- **Persona:** Senior UI Engineer
- **Evidence:** `tool-governance-marketplace.tsx` stacks: Operate eyebrow, H1 “Runner package marketplace,” **ExtensionDeveloperStudio** embed, 4 summary tiles, “Evidence-producing validation modules” section (3 badges per module: status + safetyLevel + Live supported), filters, then tool cards each with GOVERNANCE_TONE + INSTALL_TONE + READINESS_TONE + POLICY_TONE + JOB_TONE maps.
- **Problem:** Three products on one scroll: OSS marketplace, platform evidence packs, extension developer studio.
- **Impact:** Operator seeking “enable nuclei” hits developer chrome first; badge noise continues.
- **Recommendation:** Split routes: `/registries` marketplace only; developer studio under Labs/admin; evidence packs as link-out to modules/missions; max 2 badges per row.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P01-15 | P2 | improvement | paths | Attack path detail chrome: badge header + multi-section density without progressive disclosure
- **Persona:** Senior UI Engineer
- **Evidence:** Header row: RiskBandBadge + score + confidence + EvidenceBasisBadge + AttackPathClaimBadge; CTAs; ProofLoopContext; graph; per-edge plan with eligibility StateBadge, EvidenceBasis, SafetyLevel, launch results with PolicyGateBadge; path breakers; receipts. Good honesty content, high simultaneous visual load.
- **Problem:** Everything important is same visual weight; Measure hop CTA competes with methodology text and badge clusters.
- **Impact:** Slice 3 hero journey harder to demo; cognitive load before first Measure click.
- **Recommendation:** Sticky “path truth” strip (claim + measured hops count + primary CTA); collapse receipts/breakers behind tabs; per-hop: one eligibility badge + Measure; details in expand.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme

### FINDING | P01-16 | P2 | improvement | onboarding | Dual first-run systems still present in chrome
- **Persona:** Senior UI Engineer
- **Evidence:** Dashboard `GetStarted` 3-step cards when program empty; user menu + separate route `/getting-started` (not in PRIMARY_NAV); welcome persona at `/welcome`; activation maturity toggle in rail; product-help drawer per route. Previous panel U-09.
- **Problem:** Multiple “start here” entry points with different step counts and visual systems.
- **Impact:** New tenants bounce between guides; nav primary action may not match GetStarted next step.
- **Recommendation:** One first-run object; rail primary CTA = same nextAction as GetStarted; Getting Started guide is deep help only, linked from GetStarted footer.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-09

### FINDING | P01-17 | P2 | bug | design-system | Legacy teal brand accent still in global chrome (breadcrumb separators, skip link, primary-button)
- **Persona:** Senior UI Engineer
- **Evidence:** Skip link and `.primary-button` use teal `#7ad4d2` / `#5ac8c4` (`globals.css`); `.app-breadcrumb li + li::before` teal separators; kit brand is azure `#3c96ff`. PanelHeader kit uses deep blue gradient (`panel.tsx`). Shell primary CTA uses azure gradient.
- **Problem:** Teal vs azure brand split mid-page (breadcrumb teal slash next to blue active nav).
- **Impact:** Brand inconsistency in every authenticated session chrome.
- **Recommendation:** Restyle breadcrumb/skip/legacy buttons to brand tokens; reserve success teal **only** for semantic success/fixed/validated-pass tones.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-14

### FINDING | P01-18 | P2 | feature | findings | Findings UI still omits fingerprint / occurrenceCount (visual ops gap)
- **Persona:** Senior UI Engineer
- **Evidence:** Grep of `findings-workbench-v2.tsx` — no `fingerprint`, `occurrenceCount`, or root-cause fields rendered. Row meta shows priority · sourceMotion · evidence count · in-network only. Previous panel U-11.
- **Problem:** Dedup story is invisible; operators cannot see “same issue N times.”
- **Impact:** Queue noise; Slice 4 incomplete in UI even if API grows.
- **Recommendation:** Show occurrence chip when `occurrenceCount > 1`; fingerprint mono truncated with copy; default saved view “Active” not only “All.”
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P01-19 | P3 | innovation | design-system | Introduce a single “Claim language strip” primitive for proof-loop pages
- **Persona:** Senior UI Engineer
- **Evidence:** ProofLoopContext appears on findings detail and attack paths; dashboard has Needs you + CTEM stages + radar vocabulary; product-help describes Connect→…→Prove; nav groups Prove/Investigate/Remediate. Three vocabularies (previous U-02) without a shared visual component.
- **Problem:** Stage labels are text-only and inconsistent in placement/typography.
- **Impact:** Missed chance to make honesty architecture *felt* in chrome, not only in copy.
- **Recommendation:** Kit primitive `ProofStageStrip` (stage, basis Measured|Heuristic, owner, next CTA) mandatory on path/finding/remediation/mission detail; same colors as StateBadge tones; hide on Labs pages.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-02

### FINDING | P01-20 | P3 | request | performance | Command center fires many parallel list polls (visual jank risk)
- **Persona:** Senior UI Engineer
- **Evidence:** `DashboardCommandCenter` mounts ~9 `useApiResource` hooks with 60s refetch (paths, findings, remediations, ctem, activity, snapshots, alerts, workQueue, session). Full list payloads to paint summary tiles.
- **Problem:** Not a pure visual bug, but UI will shimmer/reload LiveUpdate-adjacent regions under slow networks; no skeleton coordination across panels.
- **Impact:** First paint and refresh feel “busy dashboard” rather than calm command center.
- **Recommendation:** Aggregate dashboard DTO endpoint or React Query shared cache with single `isFetching` banner; staggered skeletons already partially exist—unify behind one loading gate after first paint.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

---

## Scorecard (UI lens)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Token / design system unity | 2.5/5 | Two systems, preflight off |
| Chrome consistency | 2.5/5 | PageShell vs max-w-7xl vs breadcrumb |
| Severity / status legibility | 2/5 | Validated=green; Critical≈High |
| Nav / zoo control | 2.5/5 | Allow-lists good; default rail still zoo |
| Density / scanability | 3/5 | Queue capable but badge-heavy |
| Empty / error patterns | 3/5 | GetStarted excellent; empties fragmented |
| Responsive / mobile | 3/5 | Drawer exists; incomplete a11y |
| Orphan / dead UI hygiene | 2/5 | v1 twins, `/scopes`, dual nav |
| Honesty visual language | 4/5 | StateBadge + claim badges are assets |
| **Overall** | **3.0/5** | Design-partner ready chrome, not buy-ready polish |

---

## Explicit non-goals (this persona)

- Did not re-audit API webhook truth, RLS, or license SPDX (other personas).
- Did not run visual regression screenshots in a browser; findings are code-structure grounded.
- Did not propose redesigning brand from scratch—only unifying to the kit tokens already declared in `tailwind.css`.

---

## Appendix — files inspected

| Path | Why |
|------|-----|
| `apps/web/src/lib/primary-nav.tsx` | Live IA, ~37 items |
| `apps/web/src/lib/app-navigation.ts` | Dead dual IA |
| `apps/web/src/components/app-shell.tsx` | Main landmark, rail, mobile drawer |
| `apps/web/src/components/app-breadcrumbs.tsx` | Width/label source |
| `apps/web/src/components/app-navigation.tsx` | Orphan component |
| `apps/web/app/globals.css` | Legacy system |
| `apps/web/app/tailwind.css` | Kit tokens |
| `apps/web/app/layout.tsx` | Dual CSS import, skip link |
| `apps/web/src/ui/*` | page, badge, state-badge, empty-state, button, panel, status-pill |
| `apps/web/src/components/dashboard-command-center.tsx` | Severity charts, GetStarted |
| `apps/web/src/components/findings-workbench-v2.tsx` | Live findings UI |
| `apps/web/src/components/findings-workbench.tsx` | Orphan v1 severity ethics |
| `apps/web/src/components/attack-path-detail.tsx` | Badges, `/scopes` |
| `apps/web/src/components/external-validation-profiles.tsx` + page | PageShell nesting |
| `apps/web/src/components/tool-governance-marketplace.tsx` | Marketplace density |
| `apps/web/app/policies/page.tsx` | v1 TrustSafety mount |
| `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` | Prior consensus |

---

**Bottom line:** Protect the honesty kit (`StateBadge`, claim badges, GetStarted). Stop shipping two design systems, two nav configs, and green-for-Validated. Collapse the rail to the proof loop and the findings row to one decision badge. That is the UI path from 3.0 → 5.0.
