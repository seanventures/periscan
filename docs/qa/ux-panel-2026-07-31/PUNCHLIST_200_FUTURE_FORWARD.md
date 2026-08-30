# Periscan UI/UX Punch List — 200 items (future-forward, not cheesy)

**Date:** 2026-07-31  
**Product:** Periscan (AEV / CTEM **proof** layer)  
**Repo tip context:** post-overnight residual waves; ~61 routes, ~190 components, multi-group rail  
**Method note:** House UX validation prefers ICP-grounded reviewers over celebrity pastiche. This panel **uses named design lenses as constraint sets** (focus, craft, market, systems, velocity) and grounds every item in real routes/components from the codebase and prior exhaustive panels (feature zoo plan, Jobs/Horowitz/a11y personas). Celebrities are **not** users; **security engineers, CISOs, SOC analysts, MSSP operators** are.

---

## 0. Design lenses (15 voices)

| # | Voice | Company lineage | Lens applied here |
|--:|-------|-----------------|-------------------|
| L01 | **Steve Jobs** | Apple | One sentence product; kill list; hero loop only |
| L02 | **Jony Ive** | Apple / LoveFrom | Material honesty; restraint; tactile precision; no chrome noise |
| L03 | **Ben Horowitz** | a16z / Ops | Wartime clarity; what the operator does Monday; no theater |
| L04 | **Marc Andreessen** | a16z | Software that eats workflow; API-first surfaces that still feel human |
| L05 | **Elon Musk** | Tesla / SpaceX / xAI | Delete steps; first-principles IA; latency of understanding |
| L06 | **Alan Dye** | Apple HIG | System consistency; navigation hierarchy; SF-like rhythm |
| L07 | **Katie Dill** | Lyft / Stripe design leadership | Trust, progressive disclosure, multi-step flows that don’t strand |
| L08 | **Julie Zhuo** | Facebook design | Product sense; new-user mental models; craft of empty states |
| L09 | **John Maeda** | Kleiner / design in tech | Computational beauty; density with legibility |
| L10 | **Irene Au** | Google / Khosla | Enterprise scale UX; research rigor; permission systems |
| L11 | **Margaret Gould Stewart** | Meta / YouTube | Information architecture at scale; “time well spent” |
| L12 | **Mike Monteiro** | Mule Design | Ethics of claims; honesty as UX; refuse dark patterns |
| L13 | **Don Norman** | Cognitive design | Affordances, feedback, error recovery, mental models |
| L14 | **Luke Wroblewski** | Google / mobile | Mobile-first, form craft, input friction |
| L15 | **Joshua Porter** | Bokardo | Conversion of intent; clear primary action; remove obstacles |

**ICP JTBD (success definition):**

1. Authorize scope and run first measured validation in one session  
2. See multi-hop path and know the cheapest breaker  
3. Disposition findings without raw scanner dump  
4. Mark Fixed only after re-measure  
5. Hand leadership proof without inventing “Validated” language  
6. Schedule continuous safe checks without living-map fantasy  
7. Connect a real signal source without catalog theater  

**North star (do not dilute):**  
> See the path. Break the cheapest link. Re-run. Prove it closed.  
> Only say what you measured. Only close what you re-tested. Only run where authorized.

**Futurism without cheese:** prefer *instrumented calm* (mission control that earns its glow) over sci-fi chrome, particle soup, glassmorphism stacks, or “AI sparkle” for its own sake. Future = **predictive clarity, spatial proof, temporal integrity, adaptive density** — not neon.

---

## 1. Panel scoreboard (mean of 15 lenses)

| Dimension | Mean (1–5) | One-line synthesis |
|-----------|------------|--------------------|
| Task success | **3.1** | Hero path exists; zoo and dual systems slow completion |
| Clarity | **2.6** | Three stage languages + dense rail tax cognition |
| Trust | **3.4** | Honesty language is a real differentiator when surfaced |
| Delight | **2.4** | Competence, rarely joy; empty states improving, craft uneven |
| Accessibility | **3.0** | Progress (inert, skip, contrast); density and dual-main history still risk |
| Future readiness | **2.8** | Strong substrate (evidence, claims); presentation still 2019 ops console |

**Overall: 2.9 / 5** — honest foundation, not yet inevitable product.

---

## 2. Severity legend

| Sev | Meaning |
|-----|---------|
| **P0** | Blocks trust, first value, or accessibility of core job |
| **P1** | Major confusion / weekly operator tax |
| **P2** | Craft, consistency, secondary flows |
| **P3** | Polish / aspirational future-forward |

**Action:** `Fix` · `Overhaul` · `Add` · `Join` (merge surfaces)

---

## 3. Punch list (200)

### A. Information architecture & navigation (1–35) — Jobs / Horowitz / Gould Stewart

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 1 | P0 | Overhaul | Cap default Operate rail at **≤10** destinations; everything else Labs/Admin overflow | `primary-nav.tsx` | L01 |
| 2 | P0 | Join | Kill dual nav contracts — single source of truth | `primary-nav.tsx` vs `app-navigation.ts` | L01 |
| 3 | P0 | Overhaul | Collapse Labs default-collapsed group to **one Labs portal** entry | `/swarm` `/workflows` `/mcp` `/engagements`… | L01 |
| 4 | P1 | Join | Merge Threat Center + Threat Feed + Signal Activity into **Threats** hub with tabs | `/threat-center` `/threat-feed` `/signal-activity` | L11 |
| 5 | P1 | Join | Fold Validation Ops into Continuous + Runners | `/validation-ops` | L03 |
| 6 | P1 | Fix | Persona rails (Activating/Engineer/Leader) omit handoffs inconsistently | `activating-nav` / allow-lists | L03 |
| 7 | P1 | Overhaul | “Show all navigation” must not feel like the product | `app-shell.tsx` | L01 |
| 8 | P1 | Fix | Breadcrumbs don’t encode proof-loop stage | `app-breadcrumbs.tsx` | L13 |
| 9 | P2 | Fix | Rail group labels (Operate/Setup/Labs/Admin) read as org chart, not jobs | `primary-nav.tsx` | L07 |
| 10 | P1 | Overhaul | Executive should not peer with daily engineer Operate items for all personas | `/executive` in Setup | L03 |
| 11 | P1 | Overhaul | Compliance not in “prove daily” path for engineers | `/compliance` | L03 |
| 12 | P2 | Join | Assets ownership vs Data fabric vs Scope — one **Assets & Scope** story | `/assets` `/data-fabric` `/scopes` | L11 |
| 13 | P2 | Fix | External Validation as peer of Validate confuses external vs internal | `/external-validation` `/missions` | L13 |
| 14 | P1 | Overhaul | Objects explorer feels like second product OS | `/objects` | L01 |
| 15 | P2 | Fix | Packs as destination vs readiness strip | `/packs` | L01 |
| 16 | P2 | Fix | Registries / Engines naming dual-truth | `/registries` `/engines` | L13 |
| 17 | P1 | Join | Audit under Admin only; remove accidental deep-links that re-elevate | `/audit` | L03 |
| 18 | P2 | Fix | API Reference in Admin rail is developer, not tenant admin | `/api-reference` | L04 |
| 19 | P1 | Overhaul | Command palette indexes zoo equally — weight by persona + recent jobs | `command-palette.tsx` | L05 |
| 20 | P2 | Add | Palette sections: **Do** / **Go** / **Ask** (not flat dump) | `command-palette.tsx` | L06 |
| 21 | P1 | Fix | Mobile drawer = full zoo; need progressive Operate-first | `app-shell.tsx` | L14 |
| 22 | P2 | Fix | Sticky rail 236px wastes horizontal proof space on 13" | `app-shell.tsx` | L05 |
| 23 | P2 | Add | Collapsible rail to icon-only with tooltips (power mode) | `app-shell.tsx` | L06 |
| 24 | P1 | Fix | Deep routes (remediation detail) lose “where am I in the loop” | `remediation/[id]` | L13 |
| 25 | P2 | Fix | Shift brief placement good; still under-discovered on first run | `/shift` | L07 |
| 26 | P3 | Add | Context rail: “Current mission / path / finding” sticky chip | shell | L05 |
| 27 | P1 | Overhaul | Demo mode IA must not leak Labs theater into first impression | `/demo` | L12 |
| 28 | P2 | Fix | Welcome persona customize competes with Home first-run | `/welcome` | L08 |
| 29 | P2 | Join | Getting started dual boards residual | `/dashboard` vs `/getting-started` | L01 |
| 30 | P3 | Add | “Product map” single-page IA diagram for power users | help | L11 |
| 31 | P1 | Fix | MSSP Clients entry only for MSSP roles — verify empty affordance | `/mssp` | L10 |
| 32 | P2 | Fix | Policies vs Trust & Safety dual homes for safety toggles | `/policies` `/trust-safety` | L13 |
| 33 | P2 | Fix | Billing global banner vs Billing page narrative split | `billing-global-banner` | L07 |
| 34 | P3 | Add | Space-driven “suggested next nav” from Needs-you | Home | L05 |
| 35 | P1 | Overhaul | Remove Autonomus/Intel residual copy from any remaining strings | copy audit | L01 |

### B. Hero loop, first-run & empty states (36–60) — Jobs / Zhuo / Porter

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 36 | P0 | Overhaul | One first-run spine only; deep guide secondary | `get-started.tsx` | L01 |
| 37 | P0 | Fix | Empty Home must not flash full command center skeleton then collapse | `dashboard-command-center.tsx` | L08 |
| 38 | P1 | Fix | First CTA must be singular and persistent until done | `first-run-primary-action` | L15 |
| 39 | P1 | Add | Time-to-first-proof estimator (“~12 min remaining”) | GetStarted | L05 |
| 40 | P1 | Overhaul | Welcome must not feel like a product tour of the zoo | `welcome-experience.tsx` | L01 |
| 41 | P2 | Fix | Signup → dashboard handoff emotional beat weak | auth → Home | L08 |
| 42 | P1 | Add | Post-first-mission celebration is **measured outcome**, not confetti | missions complete | L12 |
| 43 | P2 | Fix | Empty findings still too “peaceful” without next action | `findings-workbench` | L08 |
| 44 | P1 | Fix | Empty paths: teach Measure hop, not graph theory | `attack-paths-workbench` | L13 |
| 45 | P2 | Fix | Empty integrations marketplace overwhelms | `/integrations` | L07 |
| 46 | P1 | Overhaul | Engine Lab empty: readiness checklist, not store | `/engines` | L03 |
| 47 | P2 | Fix | NotConfigured states inconsistent across Labs | many workbenches | L13 |
| 48 | P1 | Add | Global empty-state pattern with one primary + one secondary only | `empty-state.tsx` | L06 |
| 49 | P2 | Fix | Loading skeletons don’t match final layout (CLS of meaning) | workbenches | L14 |
| 50 | P1 | Fix | Error states need “what to do” not only message | `ErrorState` | L13 |
| 51 | P2 | Add | First-run progress as **timeline of integrity**, not checklist gamification | Home | L12 |
| 52 | P1 | Fix | Demo seed labeled everywhere it appears | demo surfaces | L12 |
| 53 | P2 | Fix | Accept-invite → empty tenant cold start | `/accept-invite` | L07 |
| 54 | P3 | Add | Optional “silent mode” first-run (no coach copy) for experts | settings | L05 |
| 55 | P1 | Overhaul | ProofLoopMap vs CTEM radar dual metaphors on first session | `proof-loop-map` | L01 |
| 56 | P2 | Fix | Help drawer opens generic too often | `product-help-drawer` | L07 |
| 57 | P1 | Add | Contextual “Why this next?” for primary CTA | Home / Paths | L13 |
| 58 | P2 | Fix | Getting-started milestones still feel like second product | `/getting-started` | L01 |
| 59 | P3 | Add | Session recap card: “Since last login…” measured only | Home | L04 |
| 60 | P1 | Fix | Abandoned mid-flow recovery (mission/path measure) | async ops | L13 |

### C. Trust language, claims, honesty UX (61–85) — Monteiro / Norman / Horowitz

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 61 | P0 | Fix | Never show raw `Validated` without claim-safe projection | paths/findings/reports | L12 |
| 62 | P0 | Fix | Fixed badge only with verification tooltip | remediation | L12 |
| 63 | P1 | Overhaul | Single vocabulary for proof stages in UI chrome | product-wide | L01 |
| 64 | P1 | Fix | Heuristic / Measured / Imported badges must be first-class, not footnotes | `state-badge` | L12 |
| 65 | P1 | Add | Claim certainty meter (weakest hop driven) on path cards | paths | L05 |
| 66 | P1 | Fix | Risk band “Closed (risk)” vs remediation Fixed disambiguation everywhere | severity visual | L13 |
| 67 | P1 | Fix | Auto-revalidate residual naming anywhere still mitigate-coded | remediation UI | L12 |
| 68 | P1 | Fix | DRV Partial honesty visible before marker proof run | controls | L12 |
| 69 | P2 | Fix | Market presence zero-refs banner coverage beyond Trust Safety | exec/sales | L12 |
| 70 | P1 | Add | “What we will never claim” drawer section per Labs surface | Labs | L12 |
| 71 | P2 | Fix | Compliance pack disclaimer visual weight too easy to miss | compliance | L12 |
| 72 | P1 | Fix | Scan import Imported≠Measured still easy to overread as inventory truth | data-fabric | L12 |
| 73 | P2 | Fix | Continuous EASM honesty note placement | continuous/schedules | L12 |
| 74 | P1 | Overhaul | Scorecard-like numbers on dashboards need provenance chips | executive/dashboard | L03 |
| 75 | P2 | Fix | Demo vs live visual channel (persistent ribbon) | shell | L12 |
| 76 | P1 | Add | Evidence open-from-claim as default drill-down | findings/paths | L04 |
| 77 | P2 | Fix | Audit events human-readable action titles | audit | L07 |
| 78 | P1 | Fix | Policy deny UX: explain never-queued with calm finality | policies/missions | L03 |
| 79 | P2 | Add | Trust timeline on finding: first seen → measured → disposition → verify | findings detail | L05 |
| 80 | P1 | Fix | Choke point “evidence-backed” copy vs any residual Leading science | path depth | L12 |
| 81 | P2 | Fix | InfoPopover misuse for critical safety facts (should be always-on) | various | L13 |
| 82 | P3 | Add | Cryptographic integrity visualization for evidence packs (non-cheesy hash ribbon) | evidence/reports | L04 |
| 83 | P1 | Fix | Operators recommendations must cite evidence ids | operators | L12 |
| 84 | P2 | Fix | AI Apps / model gateway safe-suite language vs “red team” marketing | ai-apps | L12 |
| 85 | P1 | Overhaul | Global claim language unit tests mirrored in visual regression snapshots | CI | L12 |

### D. Visual system: futuristic calm (86–115) — Ive / Dye / Maeda

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 86 | P1 | Overhaul | Unify design tokens: CSS vars vs Tailwind palette drift | `globals.css` + tailwind | L02 |
| 87 | P1 | Fix | Too many border blues (`#14224a` `#1e3568` `#23386b`) — 3-step border scale | UI kit | L02 |
| 88 | P1 | Overhaul | Typography: one display + one UI + one mono; kill random tracking soup | shell | L02 |
| 89 | P2 | Fix | Uppercase mono labels overused → shouty enterprise | panels | L02 |
| 90 | P1 | Fix | Card elevation system inconsistent (shadow vs border-only) | `card.tsx` | L06 |
| 91 | P2 | Fix | Brand azure vs teal semantics enforced (success only teal) | tokens | L06 |
| 92 | P1 | Overhaul | Density modes: Comfortable / Compact / Mission (ops) | settings | L05 |
| 93 | P2 | Fix | 5px corner radius consistency | controls | L02 |
| 94 | P1 | Add | Focus rings standardized product-wide | a11y | L06 |
| 95 | P2 | Fix | Icon set inconsistency (inline SVG styles vary) | `primary-nav` icons | L02 |
| 96 | P1 | Overhaul | Data viz palette: measured vs heuristic series always dual-coded | charts | L09 |
| 97 | P2 | Fix | Metric cards look BI-dashboard, not proof instrument | `metric-card` | L01 |
| 98 | P1 | Add | “Quiet dark” theme variant (lower bloom for long SOC shifts) | theme | L02 |
| 99 | P3 | Add | Optional high-contrast theme | a11y | L10 |
| 100 | P2 | Fix | Background radial glow competes with content | `globals.css` | L02 |
| 101 | P1 | Overhaul | Table design system (findings, paths, remediations) unified | workbenches | L06 |
| 102 | P2 | Fix | Badge density / stacking overflow | state badges | L09 |
| 103 | P1 | Fix | Severity color alone — always pair with text/shape | severity visual | L10 |
| 104 | P2 | Fix | Button hierarchy: primary too common | `button.tsx` | L15 |
| 105 | P1 | Overhaul | Form controls: single input language | all forms | L14 |
| 106 | P2 | Fix | Modal vs drawer vs page for similar tasks | various | L13 |
| 107 | P3 | Add | Spatial “depth of proof” visual (z layers for Measured vs Heuristic) | path detail | L09 |
| 108 | P2 | Fix | Graph canvas contrast and selection affordances | attack-path-graph | L02 |
| 109 | P1 | Overhaul | Empty chart states not zero-axis lies | charts | L12 |
| 110 | P2 | Fix | Live update pill vs polling honesty | `live-update-pill` | L05 |
| 111 | P3 | Add | Subtle instrument bezel on path measure stage only (one signature surface) | path detail | L02 |
| 112 | P2 | Fix | Print/PDF report visual system matches product tokens | packages/reports | L06 |
| 113 | P1 | Fix | Marketing-like gradients on operational CTAs | various | L02 |
| 114 | P2 | Add | Consistent 8pt spacing scale documented in Story-like catalog | docs/ui | L06 |
| 115 | P3 | Add | Motion language: 120/220ms ease, no bounce, no sparkle | motion | L02 |

### E. Motion, feedback, latency of understanding (116–130) — Musk / Porter / Norman

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 116 | P1 | Fix | Optimistic UI only when rollback is honest | dispositions | L05 |
| 117 | P1 | Add | Global progress for multi-step proof (mission → path → fix) | shell | L05 |
| 118 | P2 | Fix | Spinner without context | `spinner.tsx` | L13 |
| 119 | P1 | Fix | Long polls: show age of data + next refresh | findings/dashboard | L05 |
| 120 | P2 | Fix | Toast/status regions compete | workbenches | L13 |
| 121 | P1 | Add | Keyboard-confirm destructive with typed phrase only when needed | confirm-dialog | L13 |
| 122 | P2 | Fix | Modal animation vs `prefers-reduced-motion` | confirm-dialog | L10 |
| 123 | P1 | Overhaul | Async ops room feels engineer-only; translate for operators | async-operations | L03 |
| 124 | P2 | Fix | Debounced search without “searching” affordance | lists | L14 |
| 125 | P1 | Add | Instant filter chips on findings (Active/FP/Suppressed) sticky | findings | L15 |
| 126 | P2 | Fix | Pagination vs infinite scroll inconsistency | lists | L13 |
| 127 | P1 | Fix | Create remediation flow step count | path → remediation | L05 |
| 128 | P2 | Add | Undo window for disposition mistakes | findings | L13 |
| 129 | P3 | Add | Predictive prefetch of path detail on hover (feels instantaneous) | paths list | L05 |
| 130 | P1 | Fix | CSRF/error 403 UX for humans (not only API) | client | L13 |

### F. Core workbenches: Paths / Findings / Remediation (131–160)

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 131 | P0 | Overhaul | Path detail as **hero instrument**: graph + hop plan + claim strip one canvas | `attack-path-detail` | L01 |
| 132 | P0 | Fix | Measure path hops CTA residual keyboard/busy states | hop measure | L10 |
| 133 | P1 | Add | Split view: list | detail without full navigation | paths/findings | L05 |
| 134 | P1 | Fix | Findings queue: fingerprint / occurrence / root-cause visible | findings | L03 |
| 135 | P1 | Overhaul | Default Active filter + clear disposition workflow | findings | L03 |
| 136 | P1 | Fix | Bulk disposition still single-loop honest UI (no ghost bulk) | findings | L12 |
| 137 | P1 | Add | “Why this score” explainer panel always one click | findings | L13 |
| 138 | P1 | Fix | Cross-links path ↔ finding ↔ remediation bidirectional | details | L11 |
| 139 | P1 | Overhaul | Remediation detail: plan → apply (human) → revalidate as 3 clear beats | remediation | L03 |
| 140 | P1 | Fix | Ticket create success must deep-link external ticket | remediation | L04 |
| 141 | P2 | Fix | Path graph performance with many nodes | graph canvas | L05 |
| 142 | P1 | Add | Cheapest breaker as **one primary button** with measured gate | path depth | L01 |
| 143 | P2 | Fix | Disposition reason codes discoverability | findings | L07 |
| 144 | P1 | Fix | Suppress revisit / snooze honesty | findings | L03 |
| 145 | P2 | Add | Finding timeline vs comments (investigation thread) | findings | L04 |
| 146 | P1 | Overhaul | Evidence drawer from any claim chip | global | L04 |
| 147 | P2 | Fix | Reports generator preview before download | reports | L07 |
| 148 | P1 | Fix | Snapshot report vs live findings dual truth UX | snapshots | L12 |
| 149 | P2 | Fix | Controls marker proof result readability | controls | L07 |
| 150 | P1 | Add | Continuous hub: next scheduled fire + last measured delta | continuous | L05 |
| 151 | P2 | Fix | Schedules form density | schedules | L14 |
| 152 | P1 | Overhaul | Missions list: status that non-engineers parse | missions | L03 |
| 153 | P2 | Fix | Mission detail wait state | missions/[id] | L13 |
| 154 | P1 | Fix | External validation workbench still specialist-coded | external-validation | L07 |
| 155 | P2 | Add | Path hop measure progress as sequential instrument steps | path detail | L02 |
| 156 | P1 | Fix | Owner assignment UX for findings | findings | L03 |
| 157 | P2 | Fix | Priority score explanation | findings | L13 |
| 158 | P3 | Add | Optional 3D-less “depth lanes” for multi-hop (2.5D layers) | paths | L09 |
| 159 | P1 | Fix | Remediation list vs detail back-stack | remediation | L14 |
| 160 | P2 | Fix | Evidence list filtering by basis | evidence | L07 |

### G. Accessibility & inclusive craft (161–175) — Au / Dye / WCAG

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 161 | P0 | Fix | Color contrast audit all subtle text on void | tokens | L10 |
| 162 | P0 | Fix | Focus order through shell overlays complete | app-shell | L10 |
| 163 | P1 | Fix | Listbox/combobox patterns for filters | findings/paths | L10 |
| 164 | P1 | Fix | Live regions for async status without spam | workbenches | L10 |
| 165 | P1 | Fix | Icon-only buttons labeled | shell | L10 |
| 166 | P2 | Fix | Reduced motion coverage for all animations | global | L10 |
| 167 | P1 | Fix | Table headers + sort a11y | lists | L10 |
| 168 | P2 | Fix | Chart accessibility (text alternative tables) | charts | L10 |
| 169 | P1 | Fix | Dialog focus restore | confirm-dialog | L10 |
| 170 | P2 | Fix | Skip link targets on all bare routes | auth | L10 |
| 171 | P1 | Fix | Mobile touch targets ≥44px | shell | L14 |
| 172 | P2 | Fix | Zoom 200% layout integrity | product | L10 |
| 173 | P1 | Add | Keyboard map help (`?`) | shell | L06 |
| 174 | P2 | Fix | Screen reader claim-safe labels (not just visual remaps) | paths | L12 |
| 175 | P3 | Add | Dyslexia-friendly optional type scale | settings | L10 |

### H. Power tools, API, automation UX (176–188) — Andreessen / Maeda

| # | Sev | Action | Item | Where | Primary lens |
|--:|-----|--------|------|-------|--------------|
| 176 | P1 | Overhaul | API Reference console feels bolted on | api-reference | L04 |
| 177 | P1 | Add | Copy-as-curl from any successful mutation receipt | workbenches | L04 |
| 178 | P2 | Fix | Webhook admin: secret rotate + redrive discoverable | admin | L04 |
| 179 | P1 | Fix | MCP console honesty vs power-user need | mcp | L12 |
| 180 | P2 | Add | Webhook event catalog as interactive contract browser | admin | L04 |
| 181 | P1 | Overhaul | Model gateway UX: tool evidence first, chat second | model-gateway | L12 |
| 182 | P2 | Fix | Workflows studio flight-recorder as default tab | workflows | L05 |
| 183 | P1 | Fix | Runner health as first-class ops instrument | runners | L03 |
| 184 | P2 | Add | Idempotency-Key visible for automators in API ref | api-reference | L04 |
| 185 | P2 | Fix | OpenAPI version visible in product footer for integrators | shell | L04 |
| 186 | P1 | Add | “Automation recipe” cards that open real palette actions | Home Labs | L04 |
| 187 | P2 | Fix | Extension / packs developer lifecycle UX | packs | L04 |
| 188 | P3 | Add | Live collaboration presence (who’s viewing path) — optional MSSP | path detail | L04 |

### I. Innovative future-forward (not cheesy) (189–200)

These are **Add** items that should feel like 2027 mission software — calm, instrumented, earned.

| # | Sev | Action | Item | Design intent | Primary lens |
|--:|-----|--------|------|---------------|--------------|
| 189 | P1 | Add | **Proof Timeline** — vertical time rail of measured events only (no vanity metrics) | Temporal integrity as UI | L05 |
| 190 | P1 | Add | **Weakest-link spotlight** — auto-frame cheapest breaker on path open | Instant comprehension | L01 |
| 191 | P1 | Add | **Claim guard HUD** — corner chip: “Showing claim-safe language” always on | Trust as chrome | L12 |
| 192 | P2 | Add | **Adaptive density** from role + screen size without settings fiddling | Invisible craft | L05 |
| 193 | P2 | Add | **Mission strip audio-off haptics analog** — soft pulse only on Measured hop complete (optional, off by default) | Restraint | L02 |
| 194 | P1 | Add | **Evidence constellation** — hop nodes sized by evidence count, never by severity alone | Honest spatial | L09 |
| 195 | P2 | Add | **Counterfactual drawer** — “If this hop measured fixed, residual risk…” (model as estimate, labeled) | Future analysis without lie | L04 |
| 196 | P1 | Add | **SOC dark cockpit mode** — max contrast, min bloom, 12h-shift tuned | Wartime ops | L03 |
| 197 | P2 | Add | **Gesture path on trackpad**: pinch hop stack (desktop progressive) | Spatial modern | L06 |
| 198 | P1 | Add | **One-key Monday mode** — Home collapses to Needs-you + one path + one fix | Focus | L01 |
| 199 | P2 | Add | **Integrity watermark** on exported PDFs matching in-app claim language | Close loop | L12 |
| 200 | P1 | Add | **Future spine: “Proof OS” shell** — single left rail of 7 hero screens; everything else summoned, not listed | Product essence | L01 |

---

## 4. Priority waves to implement (agentic)

| Wave | Items | Outcome |
|------|-------|---------|
| **UX-W1** | 1–3, 36–38, 61–66, 131–135, 200 | Slim rail + claim-safe hero path |
| **UX-W2** | 4–7, 19–21, 55, 86–92, 101 | IA join + visual system unify |
| **UX-W3** | 116–130, 161–175 | Latency + a11y |
| **UX-W4** | 176–188 | Power/API craft |
| **UX-W5** | 189–199 | Future-forward instruments (non-cheesy) |

---

## 5. Explicit non-goals (cheese rejection)

- Particle backgrounds, “neural net” wallpaper, random glass blur stacks  
- AI avatar mascots, sparkle on every button  
- Fake 3D globes of “your attack surface” without measured data  
- Gamified points for closing findings  
- Leading / “AI-powered” badges without claim language  

---

## 6. References

- `docs/qa/panel-audit-exhaustive-2026-07-29/FEATURE_ZOO_AND_UX_REORG_PLAN.md`  
- `docs/qa/panel-audit-exhaustive-2026-07-29/personas/07-steve-jobs.md`  
- `docs/qa/panel-audit-exhaustive-2026-07-29/personas/08-ben-horowitz.md`  
- `docs/qa/panel-audit-exhaustive-2026-07-29/personas/16-accessibility.md`  
- `apps/web/src/lib/primary-nav.tsx` · `apps/web/src/components/app-shell.tsx` · `apps/web/app/globals.css`  
- House method: `ux-validation` skill (ICP-first; this panel maps celebrity lenses onto that rigor)

---

## 7. Tracking

File as Plane epic + optional child issues for UX-W1…W5. Do not mark Done until items ship with tests and claim-language guards.
