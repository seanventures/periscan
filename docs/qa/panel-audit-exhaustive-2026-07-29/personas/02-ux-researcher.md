# Persona P02 — Principal UX Researcher

**Lens:** First-run journeys, mental models, information architecture, onboarding coherence, recovery routes, cognitive load, handoffs, demo-vs-real boundary, and competing “proof loop” vocabularies.

**Scope audited (static code review, 2026-07-29):**

- Middleware & auth: `apps/web/middleware.ts`, `apps/web/src/components/auth-form.tsx`, `access-recovery-form.tsx`, `email-verification.tsx`
- First-run stack: `welcome-experience.tsx`, `get-started.tsx`, `getting-started-guide.tsx`, `dashboard-command-center.tsx`, pages `/welcome`, `/getting-started`
- Loop language: `proof-loop-context.tsx`, `proof-loop-radar.tsx`, `product-help.ts`, `product-help-drawer.tsx`, shared `ProofLoopStage` / `CTEMStage` in `packages/shared/src/domain.ts`, activation milestones in `apps/api/src/services/tenant.ts`
- Nav IA: `primary-nav.tsx`, `app-navigation.ts`, `app-shell.tsx` (lifecycle/persona filters, tenant chip, account menu), `command-palette.tsx`, `app-breadcrumbs.tsx`
- Demo boundary: `public-demo-report.tsx`, GetStarted “live sample” CTA

**Method:** Adversarial journey reconstruction from code (no live browser session in this file). Prefer code over docs. Cross-checked against `PREVIOUS_PANEL_SYNTHESIS.md` themes U-01, U-02, U-03, U-09, U-10, U-16.

---

## Verdict (1–5 on UX research lens)

### **2.5 / 5 — Honest heart, fractured first hour**

**5.0 definition for this lens:** A security engineer or security leader can, unprompted, complete *one* measurable loop (connect → authorized scope → validated path → fix → re-test → proof) in a single session without vocabulary collision, dead recovery links, dual onboarding, or a rail that looks like a product catalog. Demo and real work are impossible to confuse. Navigation matches the mental model of the loop.

**Why ~2.5:** Microcopy, empty-tenant GetStarted, Needs you queue, activation diagnostics, and evidence-honest Fixed language are unusually strong. The product *means* something. But three simultaneous loop taxonomies, two onboarding systems (3-step vs 9-milestone), gated recovery routes, ignored `?next=`, and a ~35-item dual-nav catalog prevent the heart from becoming inevitable. First-run is a research study waiting to fail on vocabulary and IA—not on missing APIs.

---

## Top 5 moves to reach 5.0

1. **Unblock recovery + deep links (P0)** — Public-prefix `/reset-password`, `/accept-invite`, `/verify-email`; honor `?next=` after login (and after invite/reset success).
2. **One loop vocabulary (P0)** — Pick product stages (`Connect → … → Prove`) as the operator model; demote CTEM six-pack to an analyst frame labeled “CTEM program map,” not “the proof loop.”
3. **One first-run spine (P0/P1)** — Merge GetStarted (3) + GettingStartedGuide (9) + Welcome into a single progressive journey; put it on the rail for `New`/`Activating`.
4. **Persona primary rail ≤ ~10 (P1)** — Daily: Dashboard · Missions · Paths · Findings · Remediation · Schedules · Runners · Integrations · Reports · Evidence (+ Admin). Labs for Autonomous/Intel/swarm.
5. **Align lifecycle allow-lists with the loop handoffs (P1)** — When measured work exists, Findings/Remediation must be first-class; command palette must respect the same scope as the rail.

---

## Feature-zoo / IA notes

| Action | Surfaces |
|--------|----------|
| **Cut / Labs** | Agent Swarm, Agent Workflows, MCP Server, Model Gateway, Operators, Engagements until proof loop is boring |
| **Merge** | Threat Center + Threat Feed + Signal Activity → one “Intel / triggers” home; Validation Ops + Schedules + Runners under Operate; dual nav configs (`primary-nav` vs `app-navigation`) → one source of truth |
| **Rename** | “Validation Snapshot” rail item → “Missions” or “Run validation” (label matches route content); “Assets & Scope” vs scope-on-missions collision; APP_NAV “Exposure” → Findings; drop dual “Dashboard” / “Command center” entries |
| **Demote** | Executive, Compliance, ATT&CK, Machine Identities, AI Apps, External Validation from default rail for New tenants (keep via Show all / persona) |
| **Promote** | Getting started (guided) on rail for incomplete activation; Findings + Remediation for Activating→Measured handoff |

---

## What is already excellent (do not break)

1. **Empty-tenant GetStarted** replaces a wall of zeros with real milestone-derived progress (`get-started.tsx` + activation API).
2. **Needs you / work queue** on the command center ranks human decisions, not vanity metrics.
3. **Proof-loop honesty** — Measured vs Heuristic, Fixed only after re-test, diagnostics that name exact blockers.
4. **Demo labeled sample** — public demo copy states deterministic sample data; activation footer says demo never completes real milestones.
5. **Route-aware product help** with guardrails and term definitions (especially integrations, missions, remediation).
6. **Lifecycle + persona nav scoping** intent (New / Activating / persona allow-lists) is the right control—implementation needs tightening, not abandonment.
7. **ProofLoopContext** strip on mission/findings/path/remediation/snapshot gives stage + next action on core workbenches.
8. **Welcome “Decide later”** and explicit “does not change permissions” copy reduce forced-wizard anxiety.

---

## Findings

### FINDING | P02-1 | P0 | bug | auth | Auth recovery routes are not public — reset / invite / verify dead-end at login
- **Persona:** Principal UX Researcher
- **Evidence:** `apps/web/middleware.ts` `PUBLIC_PREFIXES` = `/login`, `/signup`, `/demo`, `/api`, `/brand`, `/_next`, `/favicon` only. `app-shell.tsx` treats `/reset-password`, `/accept-invite`, `/verify-email` as bare (no chrome) but middleware still redirects unauthenticated hits to `/login?next=…`. Login “Forgot password?” links to `/reset-password`. API emails mint `/verify-email?token=`, `/reset-password?token=`, `/accept-invite?token=` (`apps/api/src/services/auth.ts`, `tenant.ts`).
- **Problem:** The recovery journey starts from email or the forgot-password link while logged out. Middleware intercepts before the recovery forms render.
- **Impact:** Self-serve onboarding and password recovery are product-breaking. Design partners and any production user who loses a session cannot complete invite or reset without support workarounds. Confirms previous-panel **U-01**.
- **Recommendation:** Add the three recovery prefixes to `PUBLIC_PREFIXES` (and keep them in `BARE_ROUTES`). Add an e2e: unauthenticated GET `/reset-password` and `/reset-password?token=…` must render the form, not login.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-01

### FINDING | P02-2 | P0 | bug | auth | Login ignores middleware `?next=` deep links
- **Persona:** Principal UX Researcher
- **Evidence:** Middleware sets `loginUrl.searchParams.set("next", pathname)` for protected routes (`middleware.ts` ~41–47). `auth-form.tsx` post-login routes only by persona (`/executive`, `/reports`, `/mssp`, `/dashboard`) or signup → `/welcome`; **never** reads `next` from the URL. Grep for `get("next")` / `searchParams` next-handling under `apps/web` hits only middleware.
- **Problem:** Shared links to findings, remediations, missions, or invite-adjacent deep links bounce to a persona home after authentication.
- **Impact:** Breaks analyst handoffs, ticket deep links, and “return to where you were.” Confirms **U-10**. Also interacts with P02-1: even if recovery were public, post-login return paths are unreliable.
- **Recommendation:** On successful login (and SSO return if applicable), if `next` is a same-origin relative path allow-list (not `//`, not external), `router.push(next)`; else persona home. Unit-test login with `?next=/findings`.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-10

### FINDING | P02-3 | P0 | improvement | proof-loop | Three competing proof-loop models teach three different products
- **Persona:** Principal UX Researcher
- **Evidence:**
  1. **Product stages (8):** `ProofLoopStage` = Connect → Authorize → Validate → Understand → Act → Verify → Prove → Repeat (`packages/shared/src/domain.ts`; `proof-loop-context.tsx`; `PROOF_LOOP_HELP` in `product-help.ts` — 7 steps, **omits Repeat**).
  2. **CTEM radar (6):** Scope → Discover → Prioritize → Validate → Mobilize → Verify (`proof-loop-radar.tsx` comment “six CTEM stages of the proof loop”; `CTEMStageSchema`; dashboard “CTEM stage” panel).
  3. **First-run (3):** Connect source → Add & verify scope → Run Validation Snapshot (`get-started.tsx`).
  Marketing/shell: “Find the path. Validate the risk. Prove it's fixed.” / “The Hacker On Your Side” (`auth-form.tsx`, `app-shell.tsx`).
- **Problem:** GetStarted hero shows the CTEM radar while the progress copy counts product milestones and the help drawer teaches Connect→Prove. Users cannot form a stable mental model of “where am I in the loop?”
- **Impact:** Training cost, support tickets, failed ICP first-session studies. Confirms **U-02**. Radar is beautiful ambient chrome that actively mis-teaches if labeled “proof loop.”
- **Recommendation:** (a) Canonical operator loop = 8 product stages everywhere (context strip, help, activation `stage` field, queue chips). (b) Rename radar aria/copy to “CTEM program stages” and never call it the proof loop. (c) Treat the 3 first-run steps as a *subset* labeled “First proof” with explicit mapping to stages. (d) Add Repeat to `PROOF_LOOP_HELP` or drop Repeat from the schema UI if not used.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

### FINDING | P02-4 | P1 | improvement | onboarding | Dual onboarding: 3-step GetStarted vs 9-milestone Getting Started
- **Persona:** Principal UX Researcher
- **Evidence:** Dashboard empty state mounts `GetStarted` (`dashboard-command-center.tsx` retires when any snapshot/path/finding exists). Separate route `/getting-started` mounts `GettingStartedGuide` (full 9 milestones from `getProductActivationState`). Guide is **not** in `PRIMARY_NAV`; only in legacy `APP_NAV_SECTIONS` “Reference”, account menu (`app-shell.tsx` UserMenu), and help drawer footer. GetStarted already surfaces “X of 9 proof-loop milestones” under a 3-step UI without linking to the full guide.
- **Problem:** Two onboarding products with different depth, discoverability, and retirement rules. Completing a single snapshot can hide GetStarted while the user has not finished Act/Verify/Prove.
- **Impact:** “I thought I was done” after step 3; revalidation and proof delivery never enter the first session. Confirms **U-09**.
- **Recommendation:** Single progressive checklist: steps 1–3 as primary cards; milestones 4–9 as “Complete the loop” accordion on the same surface. Primary CTA always = `activation.nextAction`. Keep `/getting-started` as deep link alias. Add rail item while `completedMilestones < totalMilestones`.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-09

### FINDING | P02-5 | P1 | improvement | onboarding | Welcome persona wizard is a third first-run layer with weak handoff
- **Persona:** Principal UX Researcher
- **Evidence:** Signup → `/welcome` (`auth-form.tsx`). `WelcomeExperience` sets persona/outcome then routes by maturity/persona; “Decide later” → `/dashboard`. Incomplete profile only yields filtered-out diagnostic `experience_profile_incomplete` in GetStarted (`get-started.tsx` strips that code). No forced return to welcome; rail shows persona chip only after completion (`app-shell.tsx`).
- **Problem:** Three sequential “starts”: Welcome (role), GetStarted (3 steps), GettingStartedGuide (9 milestones)—with soft coupling.
- **Impact:** Cognitive tax before any proof; many users skip Welcome and never get persona-scoped rail, then later hit a different landing after re-login.
- **Recommendation:** Collapse Welcome into the first screen of the unified first-run (optional 30-second role picker above the 3 steps), or auto-default SecurityEngineer and offer Welcome as “Customize view” only. Always surface a single nextAction.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-09

### FINDING | P02-6 | P1 | improvement | nav | Primary rail is a feature zoo (~35 destinations, 7 groups)
- **Persona:** Principal UX Researcher
- **Evidence:** `PRIMARY_NAV` groups Prove / Investigate / Remediate / Autonomous / Operate / Intel / Govern with ~35 items including Agent Swarm, MCP, Engagements, ATT&CK, Machine Identities, Validation Ops, Signal Activity, etc. Comments admit newcomers shouldn’t face ~28 items; lifecycle filters help but “Show all navigation” restores the catalog. Command palette lists **full** `PRIMARY_NAV_ITEMS` with no maturity/persona filter (`command-palette.tsx`).
- **Problem:** IA encodes product breadth, not the daily proof job. Autonomous sits as a peer group to Remediate.
- **Impact:** First-hour users browse instead of completing the loop; demo buyers sample MCP/Swarm and leave. Confirms **U-03**, **U-16**.
- **Recommendation:** Default rail for New/Activating/SecurityEngineer: Dashboard, Integrations, Missions, Attack Paths, Findings, Remediation, Reports, Runners, Evidence, Getting started. Move Autonomous + Intel + advanced Govern to Labs (collapsed, after maturity Measured). Palette should use the same filtered set + search-all secondary.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P02-7 | P1 | bug | nav | Dual nav configs with divergent labels and route sets
- **Persona:** Principal UX Researcher
- **Evidence:** Live shell uses `PRIMARY_NAV`. Legacy `APP_NAV_SECTIONS` still powers `app-navigation.tsx` and a **route-contract test** that requires every static page to appear in APP_NAV (`app-navigation.test.ts`). Label drift: Findings vs **Exposure**; Data fabric vs **Assets & Scope**; Dashboard **and** Command center both listed; Getting started only in APP_NAV; model-gateway in APP_NAV not PRIMARY_NAV.
- **Problem:** Two sources of truth guarantee permanent drift; tests lock the zoo into APP_NAV.
- **Impact:** Internal/docs/tests disagree with what operators see; rename work double-pays. Confirms **U-03**.
- **Recommendation:** Single `nav-config` module; shell + palette + breadcrumbs + route contract import it. Retire `AppNavigation` or mark demo-only. Update test to assert primary rail ⊆ routes, not routes ⊆ full catalog.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P02-8 | P1 | bug | nav | Activating lifecycle rail omits Findings and Remediation during the critical handoff
- **Persona:** Principal UX Researcher
- **Evidence:** `NEW_TENANT_NAV` = dashboard, integrations, runners, missions, trust-safety. `ACTIVATING_TENANT_NAV` adds controls, attack-paths, evidence, reports, schedules, validation-ops — **not** `/findings` or `/remediation` (`app-shell.tsx`). Maturity is Activating when source/scope/mission exist but no measured run yet; GetStarted step 3 and mission detail nextAction point at findings after completion (`mission-detail.tsx` “Review results” → `/findings?status=New`). Dashboard queue links findings/remediation even when rail hides them.
- **Problem:** The product teaches Understand/Act stages while the rail hides those destinations for Activating tenants (until a measured run flips maturity to Measured).
- **Impact:** Broken spatial memory: users rely on in-page links, then cannot re-find Findings in the rail. High risk in first-session studies.
- **Recommendation:** Add `/findings` and `/remediation` to ACTIVATING (and optionally NEW after first measured-capable mission). Align allow-list with ProofLoop stages Understand/Act/Verify.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-09

### FINDING | P02-9 | P1 | improvement | onboarding | Scope lives under Missions while nav also sells “Assets & Scope”
- **Persona:** Principal UX Researcher
- **Evidence:** GetStarted step 2 “Add & verify a scope” → `/missions`. Help Authorize → `/missions`. Data fabric is labeled **Assets & Scope** (`primary-nav.tsx`) and teaches ownership confidence / candidates (`product-help.ts` DATA_FABRIC_GUIDE), with explicit “never creates or verifies scope.” Activation milestone `ScopeVerified` href is `/missions`.
- **Problem:** Two “scope” homes: authorization (missions) vs asset inventory (data-fabric). Labels collide.
- **Impact:** Users open Assets & Scope expecting DNS verification and hit entity-resolution instead (or vice versa).
- **Recommendation:** Rename data-fabric nav to “Assets & ownership” (or “Asset inventory”). In GetStarted/help, say “Verify authorized scope (on Missions)” and link a dedicated scope panel anchor if one exists. Long-term: Slice 6 single Assets & Scope workspace with tabs Authorization | Inventory.
- **Effort:** S (rename/copy) / L (workspace merge)
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P02-10 | P2 | improvement | proof-loop | GetStarted progress double-counts two different scales on one bar
- **Persona:** Principal UX Researcher
- **Evidence:** `get-started.tsx` progress text: “{completed} of {steps.length} setup steps · {completedMilestones} of {totalMilestones} proof-loop milestones” under a bar that only reflects the 3 setup steps.
- **Problem:** One bar, two denominators. Users cannot tell if they are 33% or ~11% done.
- **Impact:** Premature satisfaction or unnecessary anxiety; undermines otherwise excellent real-progress design.
- **Recommendation:** Single primary bar for first-proof (3 steps). Secondary text link: “Full loop: n/9 — open guide.” Or one bar for 9 milestones with first three emphasized.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-09

### FINDING | P02-11 | P2 | improvement | onboarding | Getting-started discoverability is account-menu only on the live rail
- **Persona:** Principal UX Researcher
- **Evidence:** No `PRIMARY_NAV` item for `/getting-started`. Entry points: UserMenu “Getting started”, help drawer footer, legacy APP_NAV Reference. Command palette only indexes PRIMARY_NAV_ITEMS → **guide not in ⌘K**.
- **Problem:** The deepest, evidence-backed checklist is buried after the empty state retires.
- **Impact:** Mid-journey users (post first snapshot) lose the map for remediation and proof delivery.
- **Recommendation:** While activation incomplete, pin “Getting started” under Prove (or top of rail). Include in palette always. After Operating maturity, demote to account menu.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-09

### FINDING | P02-12 | P2 | improvement | demo | “Explore a live sample” risks demo/real conflation next to real setup
- **Persona:** Principal UX Researcher
- **Evidence:** GetStarted secondary CTA “Explore a live sample” → `/demo` (`get-started.tsx`). Public demo page correctly labels “Public sample data” (`public-demo-report.tsx`). GettingStartedGuide CTA “Practice in demo mode” → `/demo/workspace`. Login also offers demo path (`auth-form.tsx` `enterDemo`).
- **Problem:** Word “live” on a sample contradicts sample labeling. Placement equalizes demo with primary setup CTA visually.
- **Impact:** Some users explore demo, return, and assume tenant is populated—or distrust real empty states. Panel already praises labeled demo; copy friction is residual.
- **Recommendation:** Rename to “View sample report (no connection)” / “Practice with sample data.” Visually de-emphasize vs primary. On return from demo, banner: “You are back in your real workspace — sample progress does not apply.”
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P02-13 | P2 | improvement | handoffs | ProofLoopContext is strong but stage mapping is coarse and uneven
- **Persona:** Principal UX Researcher
- **Evidence:** Used on mission detail, findings v2, attack-path detail, remediation detail, snapshot review/report. Mission mapping: RequiresApproval→Authorize, Completed→Understand, else Validate (`mission-detail.tsx`)—skips finer run states. `PROOF_LOOP_HELP` has 7 links; context strip shows 8 including Repeat. Many zoo pages fall through to GENERIC_GUIDE in help (`resolveProductHelp`).
- **Problem:** Stage chrome teaches the loop only on core workbenches; elsewhere help is generic “orient on this page.”
- **Impact:** Operators bounce out of the loop into Swarm/Intel and lose the thread.
- **Recommendation:** Require ProofLoopContext (or compact stage chip + nextAction) on every workbench that can create evidence or tickets. Map stages from activation `currentStage` when entity-local state is ambiguous. Expand resolveProductHelp for controls, schedules, threat-*, swarm (even if “Labs: not part of first loop”).
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

### FINDING | P02-14 | P2 | improvement | nav | Tenant chip looks like a switcher but is a hard link to MSSP
- **Persona:** Principal UX Researcher
- **Evidence:** `TenantSwitcher` in `app-shell.tsx` renders swatch + truncated tenant name + chevron, `title="Portfolio & client tenants"`, always `href="/mssp"`. Non-MSSP personas still get the control. For New tenants, `/mssp` is outside lifecycle allow-list unless “Show all” or active route exception.
- **Problem:** Affordance = switcher; behavior = navigate to portfolio workbench (and may fight guided nav).
- **Impact:** False expectation of instant tenant switch; MSSP-centric chrome for single-tenant engineers.
- **Recommendation:** If single-tenant or non-MsspOperator: static label without chevron. If multi-tenant: real switcher. Never send SecurityEngineer New tenants to MSSP as chrome default.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P02-15 | P2 | improvement | copy | Label collisions across nav, H1, breadcrumbs, and legacy names
- **Persona:** Principal UX Researcher
- **Evidence:** PRIMARY: Findings, Assets & Scope, Validation Snapshot, Dashboard. APP_NAV: Exposure, Data fabric, Command center (+ Dashboard). Dashboard page eyebrow “Command center” / H1 “The proof loop, at a glance.” Breadcrumbs use PRIMARY labels. UI engineer panel notes findings H1 “Validated Results” vs nav Findings (prior panel).
- **Problem:** Same destinations, multiple names in one session.
- **Impact:** Search, support scripts, and mental models fragment; a11y breadcrumb vs H1 mismatch.
- **Recommendation:** Glossary freeze: one label per href in nav config; page H1 must match or include that label. Delete Exposure/Command center dual names.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P02-16 | P2 | feature | onboarding | No explicit recovery path when first validation fails mid-loop
- **Persona:** Principal UX Researcher
- **Evidence:** Activation diagnostics include `latest_run_failed` → mission href (`tenant.ts`). GetStarted shows up to 4 diagnostics. Dashboard `programStarted` becomes true if a snapshot exists even when outcomes failed/empty of useful paths—onboarding may retire into a sparse command center with NotConfigured path panels.
- **Problem:** Failure is diagnosed, but the emotional/UX recovery (“you’re still on step 3; here’s the exact fix”) is not first-class after GetStarted retires.
- **Impact:** Abandoned first sessions after a failed run; users wander Integrations instead of re-running with fixed prerequisites.
- **Recommendation:** If maturity Activating/Measured and diagnostics contain Blocking/Attention codes, keep a compact “Resume setup” banner on dashboard (not only empty-state full page) bound to `nextAction` + failed-run diagnostic.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P02-17 | P2 | improvement | cognitive-load | Command center density competes with Needs you as the hero
- **Persona:** Principal UX Researcher
- **Evidence:** After program start, dashboard loads paths, findings, remediations, CTEM, activity, snapshots, alerts, work queue, session—then renders change lens, 4 metrics, Needs you, 3 charts, priority paths, CTEM ring, further boards (`dashboard-command-center.tsx`). CTEM panel uses the 6-stage model beside metrics that speak product-loop language.
- **Problem:** Ranked work is present but not visually sole hero; CTEM + charts create parallel “what matters?” frames.
- **Impact:** Monday-morning time-to-first-decision rises; confirms panel “Needs you good; nav/density kills it.”
- **Recommendation:** Above-the-fold: Needs you + one primary metric row + nextAction from activation if incomplete. Collapse CTEM and charts behind “Program health” disclosure default-closed for SecurityEngineer; open for SecurityLeader executive path.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P02-18 | P3 | innovation | proof-loop | Make the loop a spatial product map, not only a pill strip
- **Persona:** Principal UX Researcher
- **Evidence:** ProofLoopContext is a dense horizontal pill strip (8 stages + 4 facts + CTA). Radar is decorative CTEM. Packs page exists (`/packs` “Proof-loop Packs”) as capability readiness without dashboard sprawl—good but separate.
- **Problem:** Operators never see a single interactive map that lights completed activation milestones against the same stage names as workbench context.
- **Impact:** Missed opportunity for the brand’s strongest differentiator (honest loop) to become the navigational spine.
- **Recommendation:** Replace decorative radar on first-run with an interactive stage map driven by `getProductActivationState` milestones (click stage → nextAction href). Reuse the same map component collapsed in the rail footer. Keep CTEM six-pack on Threat/Program only.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

---

## Journey scores (researcher rubric)

| Journey | Score | Notes |
|---------|-------|-------|
| Signup → first measured snapshot | 2.5/5 | GetStarted strong; vocabulary + scope IA + optional Welcome tax |
| Forgot password / invite accept | 1/5 | Middleware blocks unauthenticated recovery (P02-1) |
| Deep link → login → intended page | 1.5/5 | `next` set, never honored (P02-2) |
| First fix → re-test → proof | 2/5 | Guide exists but off-rail; GetStarted retires early |
| Daily triage (Needs you) | 4/5 | Best-in-product once data exists |
| Demo → real workspace | 3.5/5 | Labeling good; “live sample” wording + return handoff weak |
| Full rail exploration | 2/5 | Zoo + dual configs + Autonomous peer group |

---

## Dissent / agreement with previous panel

| Theme | Stance |
|-------|--------|
| U-01 recovery routes | **Agree strongly** — re-verified in middleware; still P0 |
| U-02 triple loop vocabulary | **Agree strongly** — radar comment literally equates CTEM with proof loop |
| U-03 dual/overstuffed nav | **Agree** — add Activating findings/remediation hole (P02-8) as under-called detail |
| U-09 dual first-run | **Agree** — add Welcome as third layer (P02-5) and retirement rule bug (P02-4/10) |
| U-10 `?next=` | **Agree** — still zero consumer in auth-form |
| U-16 Autonomous before loop inevitable | **Agree** — Autonomous is a top-level rail group |
| Empty-tenant GetStarted excellence | **Agree — protect** |
| Demo labeled sample | **Agree — protect**; only soften “live” wording |

---

## Research protocol note (for the next five ICP sessions)

When running `docs/qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`, force tasks that will fail today if unfixed:

1. Open a password-reset email while logged out.
2. Open `/findings?status=New` logged out, then log in — expect to land on findings.
3. Ask unprompted: “Name the stages of the proof loop” after 10 minutes on GetStarted (expect CTEM vs product mix).
4. After first snapshot, ask “Where do you finish the loop?” — measure whether they find `/getting-started` without help.
5. Click Assets & Scope and state what they believe “scope” means.

Until P02-1…P02-4 clear, session findings will dominate product-capability findings.

---

*End of P02 report. Docs only; no product code changes.*
