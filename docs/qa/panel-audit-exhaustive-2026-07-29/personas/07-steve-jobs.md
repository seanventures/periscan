# Panel P07 — Steve Jobs

**Lens:** Taste, focus, joy, product essence, what to fire.  
**Date:** 2026-07-29  
**Repo:** `/Volumes/DataSSD1/test/periscan`  
**Method:** Code-first read of shell, dual nav configs, command center, first-run, autonomous theater, packs, findings naming, proof-loop vocabulary; previous panel synthesis (U-02/U-03/U-09/U-16/U-23). Docs write only.

---

## Verdict

### **2.4 / 5 — Honest heart, bloated body. Respect without rapture.**

**5.0 definition (this lens):** A first-time security engineer can *feel* the product in one sentence, complete the hero loop without consulting the rail, and leave with a grin because something hard became obvious. Zero dual systems. Zero theater that pretends to be autonomy. Every screen either accelerates *See → Break → Re-run → Prove* or is not visible. Opening the app is a moment of clarity, not an airport arrivals board.

**Why 2.4, not 3:** The previous panel scored this persona ~4/10 delight / “cut to one hero sentence.” Code confirms the same disease: **~35 primary destinations across 7 groups** in `PRIMARY_NAV`, a **second full nav contract** still tested in `APP_NAV_SECTIONS`, an **“Autonomous” group selling swarm theater**, a **dashboard that fans out nine live resources** once the program starts, and **three competing stage languages** (8-step proof loop, 6-stage CTEM radar, PRD tagline). First-run GetStarted is genuinely good — then the product opens the zoo gates.

**Agree with previous synthesis:** U-02 (vocab), U-03 (dual/swollen nav), U-09 (dual onboarding), U-16 (Autonomous on rail), U-23 (intel fragmentation). **Dissent lightly on “Needs you” as excellence without caveat:** the inbox direction is right; the rest of the terminal still screams.

---

## Product essence (one sentence — protect forever)

> **See the path. Break the cheapest link. Re-run. Hand someone proof it is closed.**  
> Only say what you measured. Only close what you re-tested. Only run where authorized.

Everything else is **Labs**, **Settings**, or **Later**.

PRD root says the same truth more tersely: *Find the path. Validate the risk. Prove it's fixed.* (`PRD.md`)

---

## Kill list

Fire these from **default primary experience** (delete, Labs-gate, merge, or demote). Aggressive cuts *are* the feature.

| # | Fire / cut | Where | Disposition |
|---|------------|--------|-------------|
| K1 | **Agent Swarm** as product surface | `/swarm`, nav “Autonomous”, copy “The swarm, on the scope” | **Labs or delete label.** Radar becomes a *widget* of Missions, not a product. |
| K2 | **Agent Workflows** on primary rail | `/workflows` | **Labs.** Compose agents after the human loop is boring. |
| K3 | **MCP Server** on primary rail | `/mcp` | **Settings / API / Labs.** Power-user egress, not hero. |
| K4 | **Engagements** as peer of Findings | `/engagements` | **Fold under Missions** or Labs until multi-step chains are the default path. |
| K5 | **Operators** as separate product | `/operators` | **Side panel / recommendations on path & finding detail**, not a destination. |
| K6 | **Proof-loop Packs** as nav peer | `/packs` | **Demote to onboarding/readiness strip** or merge into Getting Started / Integrations readiness. “Pack” is abstraction theater. |
| K7 | **Validation Ops** as peer of Missions | `/validation-ops` | **Merge into Missions + Runners + Schedules.** Third ops home is zoo. |
| K8 | **Signal Activity** as peer | `/signal-activity` | **Tab under Integrations or Dashboard activity.** |
| K9 | **Threat Center + Threat Feed + ATT&CK** as three Intel peers | `/threat-center`, `/threat-feed`, `/attack-techniques` | **One “Threats” surface** with tabs; ATT&CK catalog secondary. |
| K10 | **Executive** as daily peer for engineers | `/executive` | **Persona home only** (SecurityLeader); not Prove-group peer for everyone. |
| K11 | **Compliance** in Prove group | `/compliance` | **Govern or GRC persona**, not “Prove” next to Snapshot. |
| K12 | **Machine Identities / NHI** as Investigate peer | `/non-human-identities` | **Labs or Findings facet** until NHI is a daily driver. |
| K13 | **AI Apps** as Investigate peer by default | `/ai-apps` | **Persona/pack unlock**, not day-one rail peer of Paths. |
| K14 | **Dual nav config** | `app-navigation.ts` + `AppNavigation` | **Delete legacy.** One source: `primary-nav`. |
| K15 | **Dual onboarding** | `get-started.tsx` vs `/getting-started` guide | **One path.** 3-step hero + optional deep milestones as progressive disclosure. |
| K16 | **Dual workbench orphans** | findings/schedules/threat/runners v1 still in tree | **Delete or quarantine.** One truth per route. |
| K17 | **“Validated Results” H1** | `findings-workbench-v2.tsx` | **Rename to Findings.** Label collisions kill trust. |
| K18 | **“Validation Snapshot” vs Missions** | nav label vs route `/missions` | **Pick one word.** Prefer **Missions** in rail; “Snapshot” as artifact type. |
| K19 | **“Show all navigation”** as default escape hatch that reopens the flood | `app-shell.tsx` | Keep for power users; **never** present as the product. Mature tenants still need a slim daily rail. |
| K20 | **Model Gateway** as unnavigated half-product | `/model-gateway` (route, not in PRIMARY_NAV) | Either **Labs-complete** or invisible. Half-products are worse than absent. |
| K21 | **Living radar as empty-tenant hero *and* swarm product** | `proof-loop-radar.tsx` + `agent-radar-canvas` | **One radar metaphor max.** First-run: calm. Swarm: fire or rename. |
| K22 | **Enterprise-breadth / multi-pack abstraction layer** | packs readiness + enterprise breadth API fan-out | **Stop inventing product categories.** Prerequisites live on the thing you run. |

---

## Hero loop screens

The product should be **these seven screens** in order. Everything else is optional depth.

| # | Screen | Route (today) | Job to be done | Emotional beat |
|---|--------|---------------|----------------|----------------|
| H0 | **Welcome (optional, once)** | `/welcome` | Persona + outcome — *who am I, what win do I want* | “They built this for me.” |
| H1 | **First proof setup** | Dashboard empty → `GetStarted` | Connect → Scope → First run | “Three steps. I can finish this today.” |
| H2 | **Mission in flight** | `/missions` · `/missions/[id]` | Run bounded validation; watch status | “Something real is happening.” |
| H3 | **The path** | `/attack-paths` · `/attack-paths/[id]` | See entry → hops → weakest link; measure | “I *see* how they get in.” |
| H4 | **The queue** | `/findings` | Disposition what matters; no raw scanner dump | “I know what to do Monday.” |
| H5 | **The fix & re-test** | `/remediation` · `/remediation/[id]` | Assign, fix, **measured** re-verify | “Fixed means re-run, not a checkbox.” |
| H6 | **The proof** | `/evidence` + `/reports` (+ snapshot report) | Hand someone integrity-backed proof | “I can defend this in a room.” |

**Supporting (always available, not hero):** Integrations, Runners, Schedules, Policies/Trust, Admin.

**Never hero:** Swarm, MCP, Workflows, Packs as product, Validation Ops, dual Threat surfaces, Model Gateway.

**Demo mirror of the same loop:** `/demo` sample report already narrates path → miss → fix → proof (`demo/DEMO_SCRIPT.md`). The authenticated product should feel like that script, not a vendor booth.

---

## Top 5 moves to reach 5.0

1. **Collapse navigation to ≤10 daily destinations** with one config file; Labs for the rest. Kill `APP_NAV_SECTIONS` dual truth.  
2. **Make the hero loop inevitable** — single vocabulary, single primary CTA, dashboard = Needs you + next path + next proof (not nine fan-out boards).  
3. **Fire Autonomous theater** from the rail and rename copy until agents are real objects or mere metaphors.  
4. **Name things once** — Findings, Missions, Paths, Remediation, Evidence, Reports. No “Validated Results,” no Snapshot/Missions schizophrenia, no Exposure vs Findings.  
5. **Delight pass on H1–H6 only** — motion, empty→full transitions, one chrome, one severity map, celebration when first Fixed is *measured*. Ignore every other surface until those sing.

---

## Feature-zoo / IA notes

### What to cut
See **Kill list** K1–K22. Especially Autonomous group entire, Intel triplication, Validation Ops + Signal Activity peers, Packs as nav item.

### What to merge
| Merge into | Absorb |
|------------|--------|
| **Missions** | Validation Snapshot label, Engagements (as advanced mode), Validation Ops mission rows |
| **Findings** | “Validated Results,” Exposure (legacy nav), NHI as filter later |
| **Threats** | Threat Center + Threat Feed (+ ATT&CK catalog tab) |
| **Operate** | Integrations + Runners + Schedules + Signal activity stream |
| **Getting Started** | Packs readiness checks as milestones, not a parallel product |
| **Path detail** | Operators recommendations, hop measure, choke point |

### What to rename
| Current | Better |
|---------|--------|
| Validation Snapshot (nav) | **Missions** |
| Validated Results (H1) | **Findings** |
| Agent Swarm | **Live activity** or remove |
| Proof-loop Packs | **Capability readiness** (settings) or delete nav entry |
| Assets & Scope (`/data-fabric`) | **Scope & assets** (honest; “data fabric” is enterprise fog) |
| Machine Identities | **Non-human identities** *or* hide |
| The Hacker On Your Side (rail footer) | Keep — rare good brand line |

### What to demote
- Executive, Compliance, Billing, Audit, API Reference, Account Security → **Govern / Account**  
- AI Apps, External Validation → unlock when pack prerequisites met (not permanent Investigate peers for New tenants)  
- Autonomous entire group → **Labs**

### Over-abstraction: Packs
`ProofLoopPacks` is a **meta-product**: six “packs,” each a checklist of the same prerequisites (scope, policy, evidence, integration), nine parallel API calls to decide readiness. That is *implementation honesty* wearing a *platform costume*. Users do not buy “packs.” They buy “I ran a check and proved a fix.” Prerequisites should appear **inline on the button they want to press** (“Connect a source to run this”), not as a sibling IA concept competing with Missions.

---

## What is already excellent (do not break)

1. **Honesty architecture** — Measured vs Heuristic, Fixed only after re-test, NotConfigured, denied-never-queued posture.  
2. **Empty-tenant GetStarted** — aurora, three steps, real milestone progress, retires when program starts (`get-started.tsx`). Best emotional surface in the product.  
3. **Needs you / work queue** direction on the command center — right instinct for Monday morning.  
4. **Claim badges on paths** — AttackPathClaimBadge / EvidenceBasisBadge teach the product language.  
5. **External validation workbench** as a complete stage loop (scope → launch → evidence → retest).  
6. **Demo labeled sample** — not sold as customer proof.  
7. **Persona + lifecycle-gated nav** — the *idea* of guided rail for New/Activating is correct (execution still re-opens the zoo).  
8. **Brand line** “The Hacker On Your Side / Prove your defenses work.”  
9. **Primary action glow CTA** in the rail — one obvious next step.  
10. **Anti-fabrication stance** in PRD — protect it; swarm copy must not reintroduce vibes-as-metrics.

---

## Delight 5.0 plan (taste only)

| Stage | Experience |
|-------|------------|
| **0–60s** | Welcome or GetStarted. One sentence. One button. Radar *or* quiet type — not both stories. |
| **First hour** | H1→H2→H3 only. No Autonomous. No Intel. No Packs. |
| **First win** | One path with a weakest hop and a clear “break this” CTA. |
| **First proof** | Remediation re-test flips Fixed with measured badge; confetti is optional, *clarity is not*. |
| **Daily return** | Dashboard: Needs you (3 cards max) + top path + ready-to-verify. Period. |
| **Power** | Command palette + Labs + full Govern. Never the default rail. |

**Joy score today:** ~4/10 (previous panel) — revise to **3.5/10** under exhaustive lens: more surface inspected, more contradiction found. Path to 9/10 is **subtraction**, not features.

---

## Findings (machine-parseable)

### FINDING | P07-1 | P0 | improvement | nav | Dual navigation configs still co-exist
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** `apps/web/src/lib/primary-nav.tsx` (PRIMARY_NAV, ~35 items / 7 groups; comment admits separation “so the old nav + its test stay untouched”); `apps/web/src/lib/app-navigation.ts` (APP_NAV_SECTIONS with divergent labels: “Exposure” vs Findings, External Validation under “Reference”); shell uses PRIMARY_NAV only (`app-shell.tsx`) while `AppNavigation` + tests still maintain the legacy contract.
- **Problem:** Two maps of the product guarantee label drift and zombie IA. Product essence cannot have two constitutions.
- **Impact:** Every new surface lands twice or only once; demos and tests disagree; “Show all navigation” floods an already dual-brained catalog.
- **Recommendation:** Single source of truth (`primary-nav`). Delete `APP_NAV_SECTIONS` / `AppNavigation` or reduce to a thin re-export. Rewrite tests against the slim daily rail + Labs map.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P07-2 | P0 | improvement | nav | Primary rail is a vendor booth, not a daily tool
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** `PRIMARY_NAV` groups Prove / Investigate / Remediate / Autonomous / Operate / Intel / Govern with peers including Agent Swarm, MCP Server, Proof-loop Packs, Validation Ops, Threat Center, Threat Feed, ATT&CK, Machine Identities, Clients, API Reference, Account Security (`primary-nav.tsx` L330–591). UI engineer panel: ~35 destinations.
- **Problem:** Taste fails when every capability is a peer. Focus dies; joy never starts.
- **Impact:** ICP first session fails the “what is this?” test. Wave A synthesis already ordered persona rail ~8–10 items — code has not obeyed.
- **Recommendation:** Default daily rail ≤10: Dashboard · Missions · Paths · Findings · Remediation · Schedules · Runners · Integrations · Reports · Evidence (+ Admin/Trust). Everything else: Labs, Govern drawer, or persona unlock.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P07-3 | P0 | improvement | ai-agents | Autonomous theater on the primary rail
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Nav group “Autonomous” with Agent Swarm, Agent Workflows, Operators, Engagements, MCP (`primary-nav.tsx` L439–472). `/swarm` → `AutonomousOperations`: H1 “The swarm, on the scope”; “Every blip is a real agent at work”; metrics “Autonomous runs”; empty CTA “Build an agent workflow” (`autonomous-operations.tsx`). Blips are sessions + missions + engagements — not an Agent object type (Palantir panel).
- **Problem:** Metaphor sold as product. Jobs rule: if you have to explain that the radar is “really just missions,” you already lost.
- **Impact:** Dilutes the proof-loop brand; invites “where’s the autonomous kill chain?” sales demos Periscan must refuse; previous synthesis U-16 / “do not fund swarm theater.”
- **Recommendation:** Remove Autonomous group from default rail. Rename swarm page to “Live activity” under Missions or Labs. Ban “swarm” / “autonomous agents” in H1 until real multi-agent objects exist. Keep empty honesty; kill the marketing.
- **Effort:** S–M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P07-4 | P0 | improvement | copy | Three competing proof-loop vocabularies
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** `proof-loop-context.tsx` STAGES = Connect → Authorize → Validate → Understand → Act → Verify → Prove → Repeat (8). `proof-loop-radar.tsx` STAGES = Scope → Discover → Prioritize → Validate → Mobilize → Verify (6 CTEM). PRD: “Find the path. Validate the risk. Prove it's fixed.” Dashboard: “The proof loop, at a glance.” Work queue stages mix Understand / Authorize / Verify.
- **Problem:** One product, three stage religions. Users cannot form a mental model.
- **Impact:** Help drawer, radar, context bar, and marketing teach different stories; training cost skyrockets; “proof loop” becomes jargon sludge.
- **Recommendation:** Pick **one** 4–6 step public language (prefer essence: See → Validate → Fix → Prove → Repeat). Map CTEM internally if needed. Update radar, ProofLoopContext, dashboard, welcome outcomes, help to the same words.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-02

### FINDING | P07-5 | P1 | improvement | onboarding | Dual first-run stories
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Dashboard empty → `GetStarted` (3 steps: source, scope, snapshot) with aurora + radar (`get-started.tsx`). Separate route `/getting-started` → `getting-started-guide` (9-milestone story; not in PRIMARY_NAV; in legacy APP_NAV Reference). GetStarted footer already shows “x of 9 proof-loop milestones” alongside “3 of 3 setup steps” — two progress systems on one screen.
- **Problem:** Two teachers for one student. Progress bars that disagree are anti-delight.
- **Impact:** Cognitive tax on the *best* surface in the product; U-09.
- **Recommendation:** One onboarding spine: 3 steps hero; milestones as expandable “full program checklist.” Link Getting Started from GetStarted only. Remove dual progress display or make them nested (setup ⊂ program).
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-09

### FINDING | P07-6 | P1 | improvement | design-system | Dashboard is an airport terminal
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** `DashboardCommandCenter` loads paths, findings, remediations, CTEM, signal activity, snapshots, threat alerts, work queue, session — nine resources with 60s refresh (`dashboard-command-center.tsx` L111–133). Render stack after first-run: change lens (5 cells), 4 proof metrics, Needs you grid, 3 charts, priority paths + CTEM board, plus further boards below (file continues). Header promises “at a glance.”
- **Problem:** At a glance means *three things*, not a SOC NOC wall. Density without hierarchy is anxiety cosplay.
- **Impact:** The moment GetStarted retires, delight collapses into inventory. Monday operator loses the “Needs you” win inside chart noise.
- **Recommendation:** Post-activation dashboard default: (1) Needs you ≤4 cards, (2) Top path to break, (3) Fixes ready to verify / proof CTA. Collapse charts and CTEM behind “Program health.” Persona variants can add Executive tiles for leaders only.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** theme: Needs you good / nav kills it

### FINDING | P07-7 | P1 | bug | copy | Findings H1 says “Validated Results”
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Nav + metadata + breadcrumbs: “Findings”; H1 in `findings-workbench-v2.tsx` L339–340: “Validated Results.” Legacy nav called same route “Exposure” (`app-navigation.ts`).
- **Problem:** One concept, three names. Naming is a design decision; this is a design accident.
- **Impact:** Search, support, training, and trust erode. Looks like merged startups.
- **Recommendation:** H1 = **Findings**. Subcopy may say “evidence-backed validated exposure.” Delete “Exposure” from any remaining config.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-03 (label drift)

### FINDING | P07-8 | P1 | improvement | copy | Missions vs Validation Snapshot schizophrenia
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Route `/missions`, detail `/missions/[id]`; nav label “Validation Snapshot”; GetStarted step 3 “Run your first Validation Snapshot”; primaryAction for engineers “New validation”; PRD module “Validation Snapshot.”
- **Problem:** Snapshot is an *artifact*; mission is a *run*. Using them interchangeably muddies the hero loop (H2).
- **Impact:** Users ask “where do I start a scan?” and get three synonyms.
- **Recommendation:** Rail: **Missions**. Artifact: “Snapshot / report” after completion. Keep PRD module name in docs; UI speaks Missions → Snapshot report.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-02

### FINDING | P07-9 | P1 | improvement | other | Proof-loop Packs are over-abstraction
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Nav Operate peer “Proof-loop Packs” (`primary-nav.tsx` L484–488). `ProofLoopPacks` builds six packs (Core, AI, Control, Runner, External, MSSP), each repeating scope/policy/evidence checks; fans out 9 APIs (`proof-loop-packs.tsx`). Help: packs “do not simulate installation.”
- **Problem:** A readiness matrix dressed as a product line. “Pack” is platform-speak; customers buy outcomes.
- **Impact:** Another peer in Operate; another mental model; duplicates GetStarted / activation milestones / integration empty states.
- **Recommendation:** Kill nav entry. Surface prerequisites on Missions, External Validation, AI Apps empty states. Optionally keep `/packs` as deep-link admin readiness for MSSP — not a daily noun.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** theme: freeze surface / sell wedge (Horowitz)

### FINDING | P07-10 | P1 | improvement | nav | Investigate group is a second product catalog
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Investigate (defaultOpen: true) includes Attack Paths, Assets & Scope, Findings, Controls, AI Apps, Machine Identities, External Validation, Evidence — **8 peers** (`primary-nav.tsx` L368–419). Icon collisions: control icon reused; path icon on External Validation.
- **Problem:** Daily investigation is Paths + Findings (+ Controls). The rest are modes or later.
- **Impact:** Even “focused” groups open into a wall; New-tenant lifecycle filter helps until “Show all” or maturity upgrades.
- **Recommendation:** Investigate daily: Paths, Findings, Evidence. Controls as third if BAS is ICP. External Validation / AI Apps / NHI unlock or Labs. Assets & Scope as primary only after Slice 6 ships as *the* home — until then under Operate/setup.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P07-11 | P1 | improvement | other | Intel triad is feature zoo
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Intel group: Threat Center, Threat Feed, ATT&CK (`primary-nav.tsx` L516–537). Dashboard Needs you fallback links threat alerts to `/threat-feed` while other surfaces push Threat Center (fragmentation noted U-23).
- **Problem:** Three doors for “what’s going on out there.”
- **Impact:** Blue/SOC panels already complain; Jobs lens: zero joy, pure catalog.
- **Recommendation:** One **Threats** route with Feed | Advisories | Techniques tabs. Single deep link from Needs you.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-23

### FINDING | P07-12 | P1 | improvement | engines | Validation Ops + Signal Activity + Missions triple home
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Operate includes Validation Ops + Signal Activity alongside Integrations, Packs, Runners, Tool Governance (`primary-nav.tsx` L474–514). Missions already own runs; Runners own fleet; Schedules own recurrence (but Schedules lives under **Remediate** — wrong shelf).
- **Problem:** Operators need one “what’s running?” home. Three is a zoo enclosure.
- **Impact:** Hero loop loses H2 focus; continuous validation story scatters.
- **Recommendation:** Missions = runs. Runners = agents. Schedules under Operate (not Remediate). Demote Validation Ops / Signal Activity to tabs or Labs.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-23

### FINDING | P07-13 | P2 | improvement | copy | Schedules filed under Remediate
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** `PRIMARY_NAV` Remediate group: Remediation + Schedules (`primary-nav.tsx` L421–437). Schedules copy/hint: “Recurring validation.”
- **Problem:** Continuous validation is **Operate/Prove**, not fix-work. Shelf labels teach wrong ontology.
- **Impact:** GRC and eng personas misfile mental models; UI engineer panel already flagged.
- **Recommendation:** Move Schedules to Operate (or Prove). Remediate holds Remediation only (+ optional ticket integrations later).
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** theme: copy ↔ control honesty (UI eng)

### FINDING | P07-14 | P2 | improvement | design-system | First-run radar vs swarm radar = brand confusion
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** `ProofLoopRadar` — ambient CTEM stages, no data, first-run hero (`proof-loop-radar.tsx`). `AgentRadarCanvas` — live blips of sessions/missions on swarm page (`autonomous-operations.tsx`). Same visual family (sonar/sweep), opposite honesty contracts (decorative vs “real agents”).
- **Problem:** One metaphor, two meanings. Taste requires metaphors to be scarce and true.
- **Impact:** Empty-tenant magic bleeds into autonomy theater; users cannot trust the visual language.
- **Recommendation:** Keep *one* radar: preferably first-run only. Swarm page: list + status, no fake scope theater — or a non-radar viz.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P07-15 | P2 | feature | onboarding | Hero loop is not productized as a guided path
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** GetStarted ends at first snapshot. No in-product “tour” that sequences path → finding disposition → remediation retest → report after first mission. Welcome outcomes include “Run a proof loop” (`welcome-experience.tsx`) but landing is persona home, not a wizard. Demo script encodes the full story; authenticated app does not.
- **Problem:** Essence is a *loop*; the product ships a *catalog* after step 3.
- **Impact:** Users complete setup and stall; value moment (measured Fixed) is optional, not inevitable.
- **Recommendation:** Post-first-mission coach marks: “Open your top path” → “Disposition the finding” → “Verify the fix” → “Export proof.” Persist completion; do not invent new nav items — overlay the seven hero screens.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme: unify loop vocabulary / hero sentence

### FINDING | P07-16 | P2 | improvement | gtm | Compliance parked in Prove group
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Prove group: Dashboard, Executive, Validation Snapshot, **Compliance**, Reports (`primary-nav.tsx` L331–365). Prove should mean measured validation outcomes, not framework mapping UI.
- **Problem:** Shelf pollution. Prove becomes “stuff we show auditors” instead of “stuff we measured.”
- **Impact:** Dilutes the sharpest word in the brand.
- **Recommendation:** Compliance → Govern or GRC persona allow-list only. Prove: Dashboard, Missions, Reports (and maybe Evidence).
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P07-17 | P2 | improvement | design-system | Lifecycle nav still teaches the full zoo via “Show all”
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** `NEW_TENANT_NAV` = 5 hrefs; `ACTIVATING_TENANT_NAV` expands; button “Show all navigation” persists `periscan.nav.scope=all` (`app-shell.tsx` L119–134, L286–307). Mature tenants (`maturity` not New/Activating) see **full PRIMARY_NAV** with Prove/Investigate/Remediate defaultOpen true — Autonomous/Intel/Govern collapsed but present.
- **Problem:** Guided mode is a tutorial costume over an unchanged catalog. “Real product” = zoo.
- **Impact:** The day a customer “graduates,” joy drops. Power users can still search; default must stay human.
- **Recommendation:** Even Mature default rail stays ≤10; “Show all” reveals Labs. Persona allow-lists for Leader/GRC/MSSP are good — extend Engineer to a slim daily set, not full catalog.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P07-18 | P2 | improvement | copy | Assets & Scope labeled “Data fabric” in spirit
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Nav label “Assets & Scope” but href `/data-fabric` (`primary-nav.tsx` L378–381). Legacy section called “Data fabric.” Component `data-fabric-workbench`.
- **Problem:** Route and code name are enterprise fog; label is honest. Dual names again.
- **Impact:** URLs, support, and API talk “fabric”; humans talk scope. Jobs: the name in the URL is the product name.
- **Recommendation:** Prefer `/scope` or `/assets` route alias; rename workbench language to Scope & assets. “Fabric” is internal only if at all.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P07-19 | P2 | innovation | other | One-button “Break the cheapest link” moment missing
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Path list shows score, confidence, claim badges (`dashboard-command-center.tsx` priority paths). Detail workbench exists (`attack-path-detail.tsx`) with hop/measure complexity; prior panels note hop CTA Eligible vs NeedsApproval deadlock (U-05). No single triumphant CTA on dashboard path rows: “Break this path.”
- **Problem:** Essence says *break the cheapest link*; UI shows inventory.
- **Impact:** The emotional product — decisive action — never peaks.
- **Recommendation:** On top path card: primary CTA “Inspect weakest hop” → detail with one recommended breaker + measure/retest. Fix hop CTA deadlock first so the button never lies.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-05

### FINDING | P07-20 | P2 | improvement | design-system | Dual workbenches / orphans multiply anti-taste
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** UI eng panel: routes mount findings/schedules/threat v2 and runner control room while v1 workbenches remain tested; dual integrations marketplace filenames; dual trust-safety; dual MSSP. Tree listing under `apps/web/src/components/` confirms pairs (e.g. `findings-workbench.tsx` + `findings-workbench-v2.tsx`).
- **Problem:** Two skins for one job is the opposite of focus. Taste is subtraction.
- **Impact:** Fixes land on ghosts; demos can show the wrong decade of UI.
- **Recommendation:** Delete or `_archive/` orphans; one component per route; tests only on mounted surface.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** theme: one chrome (UI eng)

### FINDING | P07-21 | P3 | improvement | gtm | Tagline stack is good — hierarchy is not
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** Rail footer: “The Hacker On Your Side / Prove your defenses work.” Dashboard: “The proof loop, at a glance.” PRD: “Find the path…” Swarm: “The swarm, on the scope.” Welcome outcomes four different wins.
- **Problem:** Multiple excellent lines without a hierarchy become noise. Swarm line actively competes with proof line.
- **Impact:** Brand memory fragments; sales and product say different poems.
- **Recommendation:** **Master:** Prove your defenses work. **Essence (internal + hero):** See → Break → Re-run → Prove. **Kill:** swarm-as-tagline. Use “Hacker On Your Side” only in chrome footer/marketing, not as a third product definition.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme: one hero sentence

### FINDING | P07-22 | P3 | request | performance | Silent multi-fetch partial failure looks like empty peace
- **Persona:** Steve Jobs (taste, focus, joy)
- **Evidence:** UI eng: multi-fetch workbenches soft-fail supporting rails (`.catch(() => [])` patterns). Dashboard has better primary error handling but still parallel nine-resource dependency for “calm glance.”
- **Problem:** False calm is the enemy of trust — and trust is this product’s only emotion that already works.
- **Impact:** Operator believes “nothing needs me” when the queue API failed (dashboard does surface workQueue error — protect that pattern everywhere).
- **Recommendation:** Degraded banner standard on every multi-fetch board; never paint empty as success without “last updated / partial.”
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme: honesty architecture

---

## Scorecard (Jobs lens)

| Dimension | Score | Note |
|-----------|-------|------|
| Product essence clarity | 3.5 | Sentence exists; product doesn’t enforce it |
| Navigation focus | 1.5 | Zoo + dual config |
| Hero loop inevitability | 2.5 | Great GetStarted; then catalog |
| Naming discipline | 2.0 | Findings/Snapshot/Exposure/Packs chaos |
| Autonomous / theater restraint | 1.5 | Swarm on rail |
| Dashboard calm | 2.0 | Airport terminal |
| Microcopy & honesty | 4.0 | Best-in-class claim language — protect |
| First-run joy | 4.0 | GetStarted is the north star |
| **Overall delight / focus** | **2.4 / 5** | Cut to essence or stay a lab |

---

## What to fire (executive one-liner)

**Fire the zoo. Fire the swarm. Fire the second nav. Fire “packs” as a product noun. Fire every peer that is not on the hero loop. Fund only the loop until it is boring — then the rest can earn a Labs badge.**

---

## Alignment with previous panel

| Theme | Stance |
|-------|--------|
| U-02 three vocabularies | **Agree — P0 for delight** |
| U-03 dual/swollen nav | **Agree — P0; expand kill list** |
| U-09 dual onboarding | **Agree** |
| U-16 Autonomous on rail | **Agree — strongest Jobs veto** |
| U-23 intel/ops fragmentation | **Agree — merge hard** |
| Protect honesty / GetStarted / Needs you / claim badges | **Agree — do not break** |
| Wave A order (auth recovery etc.) | **Support; Jobs priority among them is nav + vocab + fire Autonomous** |
| Slice 3 measured paths | **Agree — without weakest-hop joy, essence is a poster** |

---

## Bottom line

Periscan already has the only thing most security startups never earn: **a true sentence**.  

It is currently **hiding that sentence behind thirty-five doors, a second map of the building, a radar that pretends to be a swarm, and a dashboard that is proud of how much it can display.**

**Real artists ship the cut.**

*End of panel P07 — Steve Jobs. Output: `docs/qa/panel-audit-exhaustive-2026-07-29/personas/07-steve-jobs.md`.*
