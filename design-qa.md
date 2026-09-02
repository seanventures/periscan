# Periscan design-system QA

## Dual design systems [P01-1]

**Status (2026-07-29):** Tailwind kit wins. Legacy product chrome in
`apps/web/app/globals.css` (`.panel`, `.primary-button`, `.status-pill`, …) is
**deprecated** and remapped to the same kit tokens (`--border-panel`,
`--signal-blue`, semantic status colors). New UI must import from
`apps/web/src/ui` (`Panel`, `PanelHeader`, `Button` / `buttonClassName`,
`StatusPill`, `Badge`) and `apps/web/app/tailwind.css` tokens.

High-traffic surfaces migrated off legacy classes in this pass: engagement
workbench, validation-ops coverage pills, runners task-status map, API
reference view, attack-path depth, public demo report CTAs/status. Remaining
legacy class consumers (e.g. registry-center, snapshot-report-view,
integration-marketplace) should migrate next; do not add new `.panel` /
`.primary-button` / `.status-pill` usage. Re-enable Tailwind preflight only
after those shims are gone (see comment in `tailwind.css`).

## Comparison target

- Source visual truth: `/Users/sean/Downloads/Periscan Design System.dc.html`
- Source package: `/Users/sean/Downloads/Design system from screenshots.zip`
- Supplied logo: `/Users/sean/Downloads/p_logo_02.jpg`
- Browser-rendered source capture: `docs/qa/design-system-2026-07-14/source-reference.png`
- Browser-rendered implementation: `docs/qa/design-system-2026-07-14/dashboard-desktop.png`
- Additional implementation states:
  - `docs/qa/design-system-2026-07-14/help-drawer.png`
  - `docs/qa/design-system-2026-07-14/findings-desktop.png`
  - `docs/qa/design-system-2026-07-14/demo-attack-path.png`
- Viewport: 1280 × 720 CSS pixels at device scale factor 2
- State: authenticated demo tenant, dark theme, dashboard data loaded; help drawer open for the focused panel comparison; deterministic demo at step 2; findings queue loaded.

The source is a design-system specimen rather than a matching product route, so the comparison evaluates the supplied visual grammar—brand asset, palette, type hierarchy, borders, radii, density, modal/panel treatment, and status language—without claiming pixel identity between different information architectures.

## Evidence

- Full-view comparison: `docs/qa/design-system-2026-07-14/full-view-comparison.png`
- Focused region comparison: `docs/qa/design-system-2026-07-14/focused-panel-comparison.png`

The focused comparison was required because header gradients, one-pixel borders, body surfaces, close/action chrome, and small-label typography were not legible enough in the full-view comparison.

## Required fidelity surfaces

- Fonts and typography: implementation uses the specified Space Grotesk display face, IBM Plex Sans body face, and IBM Plex Mono data/label face. Visible headings, micro-labels, values, line heights, wrapping, and weight hierarchy match the source intent.
- Spacing and layout rhythm: the 236 px rail, flat data regions, low-radius 4–8 px controls and panels, hairline separators, and restrained elevation reproduce the source density. Dashboard and findings views measure 1271 px content width inside a 1271 px browser client area with no horizontal overflow.
- Colors and tokens: void/base/panel surfaces, `#3c96ff` primary action color, `#2fe0b0` verified state, red/yellow risk states, `#1e3568` panel borders, and the `#213aa8` to `#16276f` signature header gradient are visibly aligned with the supplied system.
- Image quality and asset fidelity: the application uses the supplied official light Periscan lockup, preserved byte-for-byte in `apps/web/public/brand/periscan-logo-light.svg`; no reconstructed wordmark or CSS-drawn logo remains on reviewed surfaces. The raster source is sharp at its 144–156 px rendered width and has no visible transparency halo.
- Copy and content: product copy remains task-oriented and coherent in standalone context. Status language is text/dot based, sample content stays clearly labeled as deterministic demo data, and the help panel describes actions available on the current route.
- Icons and controls: existing stroke icons remain optically aligned with their labels; focus rings, hover borders, active rail state, help drawer close control, demo step selection, filters, and primary actions are visibly complete.
- Accessibility: semantic controls and landmarks remained intact, the official logo has accessible alt text, help is a labeled dialog, focus treatment uses brand blue, and the focused web tests cover the changed shared components. The supplied target is desktop-first and contains no mobile specimen. The in-app browser's temporary viewport override did not expose a different CSS viewport during this session, so a phone-sized visual capture remains a test gap; existing `md`/`sm` responsive shell behavior was preserved rather than redesigned from an invented target.

## Primary interactions tested

- Opened and closed the route-aware product help drawer using its labeled controls.
- Selected the unique `2 Attack path` step in demo mode and confirmed `aria-current="step"` moved to that control and the content changed to “Follow entry to impact.”
- Navigated from the dashboard to the populated findings queue and inspected filters, statuses, dense rows, and overflow.
- Checked the loaded dashboard for alert states and horizontal overflow.
- Checked browser console warning/error output. No application errors were present; the only entries were expected Next.js Fast Refresh full-reload warnings while editing shared modules in development.

## Findings

No actionable P0, P1, or P2 differences remain in the reviewed states.

### P3 follow-up polish

- If brand supplies a native vector master, replace the byte-preserving raster wrapper to improve sharpness at unusually large marketing sizes. This does not affect the current product-shell scale.
- Add a real-device/mobile visual regression capture once the browser environment exposes a working responsive viewport override; do not invent a mobile composition that is absent from the supplied design system.

## Comparison history

### Iteration 1 — fixed P2 horizontal overflow

- Earlier finding: a broad `.product-main table` bridge rule also matched two `sr-only` accessibility tables on the dashboard. Each hidden table inherited viewport width from an offset position, expanding the document from a 1271 px client width to a 1920 px scroll width.
- Earlier evidence: `docs/qa/design-system-2026-07-14/dashboard-overflow-before.png` plus the browser measurement `scrollWidth: 1920`, `clientWidth: 1271`.
- Fix: scope all visual table bridge selectors in `apps/web/app/globals.css` to `table:not(.sr-only)`.
- Post-fix evidence: `docs/qa/design-system-2026-07-14/dashboard-desktop.png`, `docs/qa/design-system-2026-07-14/findings-desktop.png`, and the browser measurement `scrollWidth: 1271`, `clientWidth: 1271`.
- Result: the P2 issue is resolved and no replacement overflow or clipped persistent controls were observed.

## Implementation checklist

- [x] Official supplied Periscan logo used in the product shell and demo.
- [x] Supplied palette, type system, radii, borders, gradients, and status semantics mapped to shared tokens.
- [x] Shared buttons, cards, panels, metrics, tabs, badges, dialogs, shell, help, and demo surfaces updated.
- [x] Dashboard, help, findings, and demo states browser-rendered and inspected.
- [x] Core interactions and browser console checked.
- [x] Focused type, lint, and component tests passed.

## Agentic validation-flow mapping

### Comparison target

- Source concept: `/Users/sean/Downloads/periscan Design system from screenshots.zip`
- Browser-rendered source state: `docs/qa/agentic-validation-2026-07-14/source-validation-flow.png`
- Browser-rendered Periscan implementation: `docs/qa/agentic-validation-2026-07-14/mission-flow-desktop.png`
- Responsive implementation: `docs/qa/agentic-validation-2026-07-14/mission-flow-mobile.png`
- Desktop viewport: approximately 1280 × 720 CSS pixels; mobile viewport: 390 × 844 CSS pixels.
- Product state: authenticated demo tenant, persisted completed `ExposureValidation` mission, linked policy decision, one control-plane module run, two retained evidence receipts, and mission-scoped audit records.

The source is a visual concept, not a Periscan product specification. The implementation therefore preserves its useful vocabulary—flat live metrics, connected handoffs, restrained signal motion, blue-gradient execution panels, status color semantics, and a timestamped ledger—while the records and workflow are determined by the real Periscan domain model.

### Mapping decision

- Concept agents become actual policy, mission, module/runner, evidence, and outcome records.
- Concept handoff counts become real run and evidence counts.
- Concept validation log becomes a persisted execution ledger assembled from mission, run, evidence, and audit timestamps.
- Blue is reserved for queued or active work; teal for verified, completed, retained, or linked proof; amber for approval; red for denial or failure.
- Active handoffs animate only while their actual mission, run, or model-session state is active. Completed paths remain visible without suggesting continued execution.
- The model-session variant maps redacted context, policy, model tool requests, returned evidence, and gateway audit events; it renders only when those real session records exist.

### Evidence

- Full-view same-input comparison: `docs/qa/agentic-validation-2026-07-14/full-view-comparison.png`
- Focused same-input comparison: `docs/qa/agentic-validation-2026-07-14/focused-flow-comparison.png`
- Responsive measurements: `docs/qa/agentic-validation-2026-07-14/mobile-layout-audit.json`

The focused comparison confirms that the source and implementation share the intended density, dark navy surfaces, one-pixel borders, low-radius panels, blue gradient headers, flat metrics, connected nodes, and right-side activity ledger. Differences in node names, counts, topology, timestamps, and actions are intentional because Periscan shows persisted customer-authorized validation records rather than reproducing the concept's fabricated recon/exploit scenario.

### Interactions and responsive behavior tested

- Selected the real DNS/email security validation node and confirmed `aria-pressed` moved to that record and the inspector displayed its persisted run ID.
- Confirmed mission data refreshes without fabricating activity and links to mission-filtered evidence and audit views.
- Confirmed the mobile flow becomes a one-column lifecycle in domain order while preserving full record labels and touch targets.
- Measured `scrollWidth: 381` and `clientWidth: 381` at the 390 px browser viewport, with all five lifecycle nodes rendered at 315 px wide and no document-level horizontal overflow.
- Confirmed the dynamic mission route has no WCAG A/AA axe violations in the release browser suite.

### Comparison history

#### Iteration 1 — fixed record legibility

- Earlier finding: five-column cells constrained node cards to roughly 80–100 px, truncating real mission and module labels.
- Fix: allow measured 128–168 px record cards, increase graph side padding, wrap labels to two lines, and convert camel-case mission types to readable labels.
- Result: policy, mission, outcome, module, and evidence records are legible at the reviewed desktop and mobile sizes.

#### Iteration 2 — fixed relationship rendering

- Earlier finding: completed handoff lines could disappear after the `ResizeObserver` reset the canvas because non-active maps rendered only once.
- Fix: schedule a redraw on every measured resize and retain higher-contrast dashed completed paths while reserving motion for real active links.
- Result: all persisted relationships remain visible and the map no longer implies active work for a completed mission.

### Release verification

- `pnpm verify` passed after the final fixes.
- Workspace lint, type checking, unit tests, and production build passed; web component coverage is 67 files / 233 tests.
- Runner and local runner-lab tests passed.
- License inventory/policy, Prisma validation/migrations, enum drift, dependency severity, and PRD audit gates passed; the PRD ledger reports 203/203 implemented.
- Browser suite passed 90/90, including dynamic mission accessibility and mobile overflow checks.
- Security boundary suite passed 25/25.
- Acceptance suite passed 149/149 across 113 files.

No actionable P0, P1, or P2 visual, interaction, accessibility, or product-mapping differences remain in the reviewed states.

final result: passed
