# Persona

**Senior UI Engineer** — design-system consistency, page chrome, density, responsive risk, empty/error states, navigation IA, and copy↔control honesty across the live product shell and key workbenches.

**Scope audited (static code review, 2026-07-29):**

- `docs/qa/panel-audit-2026-07-29/SURFACE_INVENTORY.md`, `docs/qa/HANDOFF.md` (top)
- Shell: `apps/web/app/layout.tsx`, `app-shell.tsx`, `primary-nav.tsx`, `app-navigation.ts`, `globals.css`, `tailwind.css`, `src/ui/*`
- Key routes/components: dashboard, findings, attack-paths, external-validation, controls, schedules, getting-started, runners (+ sample peers: evidence, reports, integrations, model-gateway)

**Method note:** Read-only inventory of structure, primitives, and component patterns. No live browser pass in this persona file; responsive/overflow claims are structural risk from markup (fixed min-heights, wide tables, dual chrome).

---

# Verdict (1-5 product readiness)

## **3 / 5 — Credible console, not yet a coherent product skin**

**Why 3:** The post–design-system shell is real and opinionated in the right ways: dark security-console tokens, `Panel`/`PageHeader`/`Button`/`StateBadge`/`NotConfigured`/`ErrorState`/`ConfirmDialog`, route-aware help, persona/lifecycle-gated nav, first-run `GetStarted`, and several task-complete workbenches (findings bulk triage, schedules with TZ/blackout, external validation 4-stage loop, runner control room). Empty/error patterns on the *migrated* surfaces are generally honest and CTA-bearing.

**Why not 4+:** The product still runs **two visual systems at once** (legacy `globals.css` `.panel` / `.primary-button` / unscoped `main` vs Tailwind kit), **two page-header contracts**, **duplicate workbench implementations** (v1 files still tested while routes mount v2), and an **overstuffed IA** (~35 primary destinations) with reused icons and label drift. Severity color semantics disagree across pages. A buyer who walks five “core” screens will feel quality; a buyer who walks the full rail will feel a lab of parallel experiments.

**Customer-love bar:** Needs one chrome, one empty/error kit, one severity map, a tighter daily nav, and retirement of orphaned UIs—not more surfaces.

---

# Top 10 findings

| # | Severity | Area | Gap | Why it matters |
|---|----------|------|-----|----------------|
| 1 | **P1** | Visual system | **Dual design systems still co-live.** Tailwind kit (`tailwind.css` tokens, `src/ui/*`) powers most workbenches; `globals.css` still styles `.panel`, `.hero`, `.primary-button`, `.status-pill`, and a global `main { max-width: 960px }` (overridden only by `.product-main`). Preflight is intentionally off. Snapshot report, public demo, API reference, and other surfaces still speak legacy classes. | Operators get two radii, two panel headers (loud blue `PanelHeader` gradient vs flat legacy panels), two button treatments. Feels unfinished under sales demos that leave “core” paths. |
| 2 | **P1** | Page chrome | **Inconsistent page shells.** Most key pages hand-roll `max-w-7xl` / `max-w-5xl` + ad-hoc eyebrow/title blocks (dashboard, findings, attack-paths, controls, schedules). Others use `PageShell` + `PageHeader` (external-validation, data-fabric, engagements, policies). `PageShell` renders a nested `<main>` inside `AppShell`’s already-present `#main-content` main. | Nested landmarks break skip-link / screen-reader “main” assumptions; spacing/type rhythm drifts page-to-page; hard to apply global density or responsive padding once. |
| 3 | **P1** | Navigation IA | **Primary rail is a product catalog, not a daily tool.** `PRIMARY_NAV` has 7 groups and ~35 items (Prove → Govern). Autonomous + Intel + Govern are advanced but still present; icon reuse is heavy (control icon for Controls / Compliance / Policies / Machine Identities; snapshot for Validation Snapshot / Packs / Validation Ops; finding icon for Executive *and* Findings). Legacy `APP_NAV_SECTIONS` still exists with divergent labels (“Exposure” vs “Findings”, External Validation under “Reference”). Getting Started is **not** in the rail—only the account menu. `/model-gateway` exists but is **not** in `PRIMARY_NAV` (command palette / deep link only depending on wiring). | New tenants and demo buyers drown. Persona/lifecycle filters help but “Show all navigation” re-opens the flood. Label/icon collisions slow recognition. Dual nav configs will drift again. |
| 4 | **P1** | Architecture / maintainability UI debt | **Orphan and dual workbenches.** Routes mount `findings-workbench-v2`, `schedules-workbench-v2`, `threat-center-workbench-v2`, `runner-fleet-control-room`, while `findings-workbench.tsx`, `schedules-workbench.tsx`, `threat-center-workbench.tsx`, `runners-workbench.tsx`, `runners-console.tsx`, `model-gateway-workbench.tsx`, dual MSSP/integration marketplaces, and dual trust-safety dashboards remain in tree with tests. Dashboard first-run uses `get-started.tsx`; route `/getting-started` uses `getting-started-guide.tsx` (two onboarding stories). | UI “truth” is whichever file the page imports. Fixes land on the wrong surface; demos can cite tests for dead UI. Cognitive load for every UI change is 2×. |
| 5 | **P1** | Semantic color | **Severity/risk tones are not a single map.** Findings/reports treat High as `missed` (red); dashboard + executive charts map High → `var(--color-approval)` (amber); agent behavior / NHI map High → `blocked` (blue). Critical/High often share red in badge maps, collapsing two levels. | Operators learn “red = High” on findings and “amber = High” on the command center. Undermines the careful validation-state palette (validated/blocked/missed/fixed) that is otherwise a strength. |
| 6 | **P2** | Empty states | **Three empty-state dialects.** Kit exports `EmptyState` (centered, dashed) but production almost always uses `NotConfigured` (left-aligned, forced eyebrow “No signal yet”) or raw centered `<p className="text-subtle">No X yet.</p>` without CTA (controls coverage list, many secondary lists). Schedules empty has message but **no action link**. | “No signal yet” on a pure list empty (e.g. no schedules) is copy overreach. Filter-empty vs never-configured vs not-entitled should look different; today they often don’t. |
| 7 | **P2** | Copy ↔ control honesty | **Chrome promises controls it doesn’t implement.** Tenant chip in the command bar looks like a switcher (color swatch + chevron) but is a plain `Link` to `/mssp`. Findings page H1 is **“Validated Results”** while nav, breadcrumbs, help, and metadata say **Findings**. Schedules live under nav group **Remediate** though copy is continuous validation (ops, not fix). Panel headers often look more “actionable” than the body affords. | Small dishonesties compound; buyers already evaluating evidence honesty notice UI chrome fibs. |
| 8 | **P2** | Density / hierarchy | **Command center and runner room are dense by default; advanced panels stack without progressive disclosure.** Dashboard fans out many live resources + change lens + metrics + queue + charts. Runner control room forces `min-h-[640px]` dual-pane grid (`lg:grid-cols-[390px_…]`). Controls page stacks coverage ring, stimuli, source registry, *and* full technique list. Findings filter row + views + bulk bar + expandable rows is powerful but tall on mobile. | Power users get a SOC console; first-hour users get cognitive fatigue. Density isn’t wrong—lack of default collapse/priority is. |
| 9 | **P2** | Responsive risk | **Structural overflow hazards remain on secondary tables and ops rooms.** Examples: NHI table `min-w-[1080px]` + `whitespace-nowrap` timestamps; runner inspector grid with fixed rail width; wide mono IDs and multi-badge rows across workbenches; external-validation 4-stage strip is `md:grid-cols-4` (stacks on small, good) but stage labels + mono IDs still crowd. Handoff claims 390 px passes on some slices; inventory has many surfaces not under that bar. | Horizontal scroll inside nested cards or clipped CTAs destroy trust on tablet/phone field demos. |
| 10 | **P3** | Incomplete / partial load UX | **Partial API failure is often silent.** External validation workspace loads evidence/paths/remediations with `.catch(() => [])`, so a 500 on evidence yields an empty “Prove” stage with no degraded banner. Similar soft-fail patterns appear in other multi-fetch workbenches. Loading/error for the *primary* resource is good; *supporting* rails can look “empty” when they are broken. | Honest empty states are a brand pillar; silent partial empty looks like “no data” and trains operators to mistrust the product. |

---

# Incomplete features observed

*(UI-visible incompleteness or fragmentation—not a full product backlog rehash. July 13 panel items that appear closed in code are noted.)*

### Closed or substantially improved since 2026-07-13 (UI view)

- Findings: bulk select, disposition, owner/expiry for AcceptedRisk, CSV export, saved views / URL sync (`findings-workbench-v2.tsx`).
- Schedules: local time, timezone, blackout windows, edit/delete path present in v2 (was a top P1).
- Attack paths: financial / business-impact workbench and USD exposure presentation.
- External Validation: task-complete workbench (scope → preflight → launch → evidence → remediation/retest)—matches HANDOFF Slice 2 narrative.
- Evidence: ConfirmDialog + InlineError patterns present (silent-fail era partially remediated on this surface).
- Shell: Help drawer, command palette, breadcrumbs, persona/lifecycle nav, design tokens.

### Still incomplete / fragmented in UI

| Surface | Incomplete UI observation |
|---------|---------------------------|
| **Design system adoption** | Kit exists; migration incomplete. Legacy CSS + Tailwind dual-path; `EmptyState` barely used; no shared form field primitive (repeated `FIELD_CLASS` / ad-hoc selects). |
| **Onboarding** | Two experiences: dashboard `GetStarted` vs `/getting-started` milestone guide; not linked in primary nav. |
| **Model Gateway / Frontier** | Route mounts `FrontierGatewayConsole`; fuller `model-gateway-workbench` remains orphaned—risk of read-heavy console vs write-capable sibling (historical panel finding). Not in primary nav. |
| **Controls** | Coverage empty uses bare text; technique rows historically under-surface evidence drill-through (expand/link depth still weaker than findings). |
| **Integrations** | Marketplace still a major trust surface; dual filenames (`integrations-marketplace` / `integration-marketplace`) signal unfinished consolidation. |
| **Reports / API reference / demo / snapshot report** | Still largely legacy class vocabulary—visually “other product.” |
| **Runners** | Live route is control room; older runners workbench/console still in tree. Empty fleet state is good; dense dual-pane is desktop-first. |
| **Nav discoverability** | Getting started, welcome, demo workspace, model-gateway, some governance tools unevenly promoted. |
| **Iconography** | No icon set—inline SVGs with collisions; no empty-state illustration system. |
| **Localization** | Shell wraps with locale provider; most workbench copy remains hard-coded English with partial `translateUiText` only on chrome. |

### Outside Slice 3–10 (but UI-relevant)

Slice plan focus (measured path closure, operational findings, control effectiveness, assets/scope, evidence exploration, continuous validation, BAS, release qual) does **not** explicitly budget design-system consolidation, nav IA cut, orphan deletion, or severity token unification—those will keep eroding “product readiness” even as analyst rows climb.

---

# Unknown unknowns (outside known Slice 3–10 plan)

1. **Keyboard / focus matrix on nested dialogs + bulk bars + help drawer + palette** — ConfirmDialog and bulk action bars exist; no evidence of a global focus-trap / `aria-modal` audit across all write surfaces.
2. **Motion and reduced-motion** — skeletons honor `motion-safe`; onboarding pulse classes and glow CTAs may still animate for vestibular-sensitive users.
3. **Chart accessibility** — distribution charts on dashboard/controls need verified data-table fallbacks everywhere (findings v1 tests mentioned them; not verified product-wide).
4. **Print / PDF preview fidelity** vs dark console theme when reports open in-app.
5. **Tenant switcher multi-tenant UX** — link-to-MSSP is a stub for true portfolio switch; real MSSP operators may need a different chrome entirely.
6. **Command palette data search** — placeholder says “search your data”; if it only jumps routes, copy overpromises.
7. **Breadcrumb vs page H1 collisions** — breadcrumbs use nav labels (“Findings”) while H1 says “Validated Results.”
8. **Dark-only product** — `color-scheme: dark` only; no high-contrast or light executive mode for board projection.
9. **Table virtualization** — client-side full lists with pagination only on some surfaces; large tenants may jank without UI plan coverage.
10. **Component visual regression** — heavy unit tests, unclear screenshot/regression for shell density at 390 / 768 / 1280.

---

# Must-do before customer love

1. **One chrome contract**  
   - Every authenticated page: single outer content wrapper (no nested `<main>`), shared `PageHeader` (eyebrow, title, description, actions, optional `LiveUpdatePill`).  
   - Finish or quarantine legacy `.panel` / `.primary-button` pages behind a documented “legacy report” skin—or migrate them.

2. **One empty/error/action kit**  
   - Standardize: `LoadingSkeleton` · `ErrorState` · `NotConfigured` (setup) · `EmptyState` (true empty list) · filter-empty one-liner · `InlineError` + `ConfirmDialog` on every write.  
   - Ban silent `.catch(() => [])` without a degraded indicator on multi-fetch workbenches.

3. **Delete or quarantine orphans**  
   - One findings workbench, one schedules workbench, one runners surface, one threat center, one trust-safety, one integrations marketplace, one MSSP portfolio. Point tests at the route-mounted component only.

4. **Nav diet for love, full map for power**  
   - Default daily rail: Dashboard, Missions, Findings, Attack Paths, Controls, Remediation, Evidence, Reports, Integrations, Runners, Schedules (+ Getting Started).  
   - Park Autonomous / Intel / deep Govern behind “Advanced” or maturity-gated groups with unique icons. Align labels with H1s (“Findings” everywhere).

5. **Canonical severity + validation tokens**  
   - Single exported map: Critical / High / Medium / Low / Informational → tone + chart color. Never conflate High with validation “Missed” red without a second encoding (icon/label).

6. **Responsive hardening pass on sales-demo paths**  
   - Dashboard, findings, attack-paths, external-validation, controls, schedules, runners, getting-started at 390 / 768 / 1280: no horizontal page scroll, dual-pane collapses cleanly, tables scroll inside cards with sticky first column where needed.

7. **Copy honesty sweep**  
   - Remove faux-dropdown chrome; fix group membership (Schedules under Operate/Prove, not Remediate); ensure CTAs match capability (no “scan” without QR, no “switcher” without switch).

8. **Keep the good**  
   - Preserve validation-state vocabulary, measured-vs-heuristic badges, NotConfigured honesty, help drawer, first-run gate that hides a wall of zeros, external-validation stage model. Those are the UI differentiators; consistency should amplify them, not invent a new aesthetic.

---

## Score intuition (UI-only)

| Dimension | Score (1–5) | Note |
|-----------|-------------|------|
| Visual system | 3 | Strong kit, incomplete adoption |
| IA / nav | 2.5 | Too many peers, icon/label collision |
| Task-complete core flows | 3.5–4 | Findings, schedules, external val, runners improved |
| Empty/error honesty | 3.5 | Good primitives, uneven use |
| Density / responsive | 3 | Desktop SOC-native; mobile structural risk |
| Copy ↔ control | 3 | Mostly careful product language; chrome fibs remain |

**Bottom line:** Periscan’s UI is past “prototype gray boxes” and into “real security console,” but customer love requires **consolidation**, not more panels. Ship one system, one nav story, one severity language—then the Slice 3–10 substance will *look* as trustworthy as the evidence model claims to be.
)