# Panel P14 — Mid-market security practitioner (many hats)

**Date:** 2026-07-29  
**Persona:** Mid-market security practitioner — one person wears GRC-lite, vuln ops, detection validation, ticket wrangler, runner admin, and “why is the board deck wrong”  
**Mode:** Source-level product audit (code + docs; no live browser session in this pass)  
**Lens definition of 5.0:** On Monday morning I open Periscan, see a single honest inbox, fix/assign/ticket the top items, re-verify what engineering said is closed, and leave knowing schedules + runners + authorized scope will keep working without me babysitting the nav zoo.  
**Primary surfaces:** `/dashboard` (Needs you), `/findings`, `/remediation` + `/remediation/[id]`, `/schedules`, `/runners`, `/registries`, `/data-fabric`, `/missions`, `/policies`, `/executive`, primary nav  
**Repo anchors:** `apps/web/src/components/dashboard-command-center.tsx`, `remediation-detail.tsx`, `snapshot-workbench.tsx`, `schedules-workbench-v2.tsx`, `runner-fleet-control-room.tsx`, `tool-governance-marketplace.tsx`, `data-fabric-workbench.tsx`, `findings-workbench-v2.tsx`, `validation-snapshot-flow.tsx`, `get-started.tsx`, `getting-started-guide.tsx`; `apps/web/src/lib/primary-nav.tsx`, `app-navigation.ts`; `apps/api/src/services/tenant.ts` (`getProductWorkQueue`), `services/remediation.ts`; `packages/shared/src/domain.ts` (work-queue kinds, `CreateRemediationInput`)  
**Contract:** `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md`  
**Previous synthesis:** `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` (U-02, U-03, U-09, U-11, U-12, U-16; Wave A #3/#8/#9; Slice 6/8)

---

## Verdict (practitioner lens)

**3.2 / 5.0**

The product *understands* my Monday: **Needs you**, measured Fixed, outbound runners, and ticket honesty are real design choices — not marketing wallpaper. But as the only security hire (or one of two) I still spend too many minutes answering: *What do we call findings? Where do I create the Jira? Where is my authorized scope home? Is the runner actually ready to run nuclei/zap? Why are there 38 nav destinations?* That cognitive tax is death for mid-market.

**Buy/use posture:** Keep as **design-partner continuous-validation plane**. I will not make it the only system of record for tickets or asset inventory until rem detail can create tickets, scope has a real home, and the rail is ≤ ~10 items for my persona.

**5.0 definition (explicit):** One vocabulary, one Monday inbox, ticket + re-verify on the rem record, schedules with real ops knobs, runner+engine readiness legible, authorized scope workspace, nav that fits a two-hat operator.

---

## Top 5 moves to reach 5.0

1. **Ticket create on remediation detail** (mirror snapshot workbench; API already exists).  
2. **Collapse naming:** nav + page H1 + help = **Findings** (or **Exposure** — pick one; kill “Validated Results” as H1).  
3. **Persona primary rail (~8–10):** Dashboard · Missions · Paths · Findings · Remediation · Schedules · Runners · Integrations · Reports · Evidence (+ Admin). Labs for Autonomous/MCP/Swarm.  
4. **Authorized Scope home** (create/verify/list scopes + safety envelope) — stop scattering scope across missions-only and a mislabeled Assets & Scope that is data-fabric lineage.  
5. **Needs you truth + schedules ops:** one queue model (no fallback taxonomy drift); schedules editable scopes + failure notify + last-run deep link; runner page shows engine install readiness for modules I care about.

---

## Feature-zoo / IA notes

| Action | Items |
|--------|--------|
| **Keep primary** | Dashboard (Needs you), Validation Snapshot / Missions, Attack Paths, Findings, Remediation, Schedules, Runners, Integrations, Reports, Evidence |
| **Merge** | Threat Center + Threat Feed → Intel; Validation Ops + Signal Activity → ops under Schedules/Runners; Policies + Trust & Safety (already overlapping content) |
| **Rename** | `/data-fabric` nav **Assets & Scope** → either true Scope workspace **or** “Asset lineage” (do not promise Scope); page H1 **Validated Results** → match nav **Findings**; legacy **Exposure** label → delete |
| **Demote to Labs / Settings** | Agent Swarm, Agent Workflows, Operators, Engagements, MCP Server, Model Gateway, ATT&CK catalog, Extension studio chrome |
| **Cut from primary consciousness** | Dual nav configs (`primary-nav` vs `app-navigation`); dual onboarding (3-step GetStarted vs 9-milestone Getting Started off-rail); dual runner UIs if both still reachable |
| **Do not break** | Measured Fixed / ticket ≠ proof; denied-never-queued; outbound signed runner; empty-tenant GetStarted; proof-loop honesty copy |

**Zoo size (counted):** `PRIMARY_NAV` currently exposes **~38** `href` destinations across Prove / Investigate / Remediate / Autonomous / Operate / Intel / Govern. That is not a mid-market product surface — it is a platform catalog.

---

## What is already excellent (do not break)

1. **Needs you direction** — ranked work with stage + urgency, deep links, honest empty copy when the program queue is empty.  
2. **Proof language** — Fixed only after measured re-test; ticket closure called “workflow context, not proof” on rem detail.  
3. **Empty-tenant GetStarted** — no wall of zeros; real milestones from activation state.  
4. **Schedule blackouts + pause/resume/run-now** — real continuous-validation bones, not a cron toy.  
5. **Runner safety story** — outbound-only, signed tasks, kill switch, fleet health states.  
6. **API `createRemediationTicket` + PSA/RMM generalization** — backend is ahead of the rem detail UI (good problem).  
7. **Snapshot Create ticket UI** — correct pattern to clone onto rem detail.  
8. **Disposition cannot mark Fixed** — saves me from auditors and from myself.

---

## Findings (machine-parseable)

### FINDING | P14-1 | P1 | improvement | onboarding | Monday Needs you: server queue vs client fallback taxonomies disagree
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `apps/api/src/services/tenant.ts` `getProductWorkQueue` kinds = Approval, FailedRun, EvidenceIntegrity, OverdueRemediation, ReadyForRetest, UnownedFinding, Prerequisite (`packages/shared/src/domain.ts` `ProductWorkQueueKindSchema`). Client fallback in `dashboard-command-center.tsx` `summarizeNeedsYou` + fallback items = New findings, Threat alerts, Risk approvals (finding disposition Pending), Fixes to verify — **not** the same set. Empty state copy only lists server kinds.
- **Problem:** When the work-queue API works I do not see “new unddispositioned findings” or “new threat alerts” as first-class buckets; when it fails I see a *different* Monday list. Risk approvals in fallback point at `/findings`; server approvals point at `/policies?approvalState=Pending`.
- **Impact:** Monday handoff is inconsistent; I re-learn the product after every outage; high-signal New findings can hide behind “priority unowned ≥70” only.
- **Recommendation:** One canonical work-queue contract rendered both server- and client-side. Include New unddispositioned findings + correlated threat alerts as first-class kinds (or explicit sub-rows under Understand). Align approval href to the surface that actually decides (findings risk-acceptance **or** policy approvals — not both).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-09 (partial); Wave A Needs you excellence protect + deepen

### FINDING | P14-2 | P1 | bug | copy | Triple naming: Findings vs Validated Results vs Exposure
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `primary-nav.tsx` label **Findings** → `/findings`; page H1 in `findings-workbench-v2.tsx` = **Validated Results**; metadata title “Findings — Periscan”; legacy `app-navigation.ts` Core item label **Exposure** for same href; help/dashboard copy still speaks “exposure” generically.
- **Problem:** Three product names for one queue. When I Slack IT “check Exposure” they open nothing; when I say Findings the page says Validated Results.
- **Impact:** Mid-market orgs live on shared language with IT/helpdesk. Naming thrash burns trust in the tool and in me.
- **Recommendation:** Pick **Findings** (preferred for ops) or **Exposure** (preferred for CTEM marketing) — not both. H1, nav, breadcrumbs, help terms, and CSV filename stem must match. Retire legacy **Exposure** nav label with dual-config delete.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-02; Practitioner prior ~3.3 note on Exposure naming

### FINDING | P14-3 | P0 | bug | remediation | Create ticket missing on remediation detail (exists on snapshot)
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `remediation-detail.tsx` supports **sync** ticket only when `ticketId` already set; no create path. `snapshot-workbench.tsx` ~1361–1382 has destination select + **Create ticket** via `api.createRemediationTicket`. API `POST /api/v1/remediations/:id/create-ticket` + client `createRemediationTicket` exist. Without ticket, rem detail shows no ticket panel at all.
- **Problem:** My daily work starts from the rem task (owner, SLA, re-verify), not from a snapshot review. Ticket create is stranded on the snapshot workspace.
- **Impact:** I leave Periscan to open Jira/Syncro manually → lose linkage → “Fixed” in ticket ≠ re-test in Periscan. This is the #1 mid-market handoff failure. Prior panel U-12 — still open in code.
- **Recommendation:** Port snapshot ticket UI to rem detail (and rem list row actions): integration picker, create, then sync. Empty state: “Connect PSA/RMM on Integrations” with deep link. Keep honesty banner that ticket closed ≠ Fixed.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-12

### FINDING | P14-4 | P1 | feature | remediation | Path-gated remediation blocks signal-only findings
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `CreateRemediationInputSchema` requires `pathId` (`packages/shared/src/domain.ts`). `createRemediation` 404s if path missing (`services/remediation.ts`). Findings UI (`findings-workbench-v2.tsx` Fix workflow): if no `relatedPathIds[0]`, shows “No attack path is linked…”, no alternate route.
- **Problem:** Many mid-market validated results start as correlated signals/control misses before a full multi-hop path exists. I still need an owner + SLA + ticket.
- **Impact:** Work falls into email/spreadsheet; proof loop never starts; findings rot as New.
- **Recommendation:** Allow remediation from finding fingerprint (path optional), with verification method “re-run originating module / snapshot” when no path. Keep one-open-task-per-fingerprint rule. UI: “Route to remediation” always when fingerprint exists.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11 (findings ops); Slice 4

### FINDING | P14-5 | P1 | improvement | ops | Schedules lack mid-market ops knobs
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `schedules-workbench-v2.tsx` create: mission type, frequency, time, TZ, day, blackout, optional scopes. Edit: frequency/time/TZ/blackout only — **cannot change scopeIds after create** (scope count display only). No pack/module set, no runner affinity, no on-failure notify/email/webhook, no owner, no “skip if previous still running.”
- **Problem:** Continuous validation is how I sleep at night. Without failure notify + scope edit + last-run deep link, schedules become “set and forget until audit week fails.”
- **Impact:** Silent miss for a month; board “we scan weekly” claim unsupported.
- **Recommendation:** (1) Edit scopes post-create. (2) Failure → Needs you kind already exists (`FailedRun`) — surface last failure reason + mission link on schedule row. (3) Optional notify: email to owner or webhook event. (4) Optional default pack / mission template. (5) Guard concurrent run policy visible in UI.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Slice 8 continuous validation ops

### FINDING | P14-6 | P2 | improvement | nav | Schedules live under “Remediate” group
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `primary-nav.tsx` group **Remediate** contains Remediation + Schedules. Schedules page eyebrow also says “Remediate”.
- **Problem:** Recurring ValidationSnapshot / ContinuousValidation is program ops, not a fix-plan step. I look under Operate / Prove.
- **Impact:** Extra hunt time; mental model “schedules = rem re-tests only” (false — mission types include ValidationSnapshot, AIAppValidation, etc.).
- **Recommendation:** Move Schedules under Prove or Operate next to Runners/Validation Ops; rename eyebrow to “Operate · Continuous validation.”
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P14-7 | P1 | improvement | runners | Runner readiness ≠ engine install readiness
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `/runners` → `RunnerFleetControlRoom` (fleet health, pairing, thresholds). Engine install lives on `/registries` → `ToolGovernanceMarketplace` (install/enable legal states). Snapshot readiness tile “Governed tools” counts **enabled** tools (`validation-snapshot-flow.tsx`), not “installed on the runner that will execute.”
- **Problem:** Mid-market me installs a runner Friday, enables nuclei Monday, still doesn’t know if the **host package** is Installed vs NotInstalled vs Missing until I dig Registries.
- **Impact:** Failed runs blamed on “Periscan” when the engine was never on the box; trust loss with engineering.
- **Recommendation:** Runner detail: matrix of required engines for allowlisted modules with installStatus. Snapshot readiness: “Installed & enabled on selected runner” not just tenant-enabled count. Link Install CTA to `/registries` with toolId query.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none (engines install focus)

### FINDING | P14-8 | P1 | feature | onboarding | No authorized-scope home; Assets & Scope is data fabric
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Nav label **Assets & Scope** → `/data-fabric` (`primary-nav.tsx`). Page is asset lineage / ownership / source quality (`data-fabric-workbench.tsx`) — **no** `listScopes` / create / verify. Scope create/verify + `ScopeSafetyEditor` live inside Validation Snapshot flow (`validation-snapshot-flow.tsx`). GetStarted step 2 also deep-links to `/missions`.
- **Problem:** Authorized targets are the legal/safety center of the product, but have no first-class home. “Assets & Scope” overpromises scope admin.
- **Impact:** I cannot answer “what are we allowed to hit?” without starting a mission wizard. Auditors and MSP customers ask that first.
- **Recommendation:** Slice 6 as written: Scope workspace (list, verify, safety envelope, segments) as primary; data fabric as “Asset lineage” secondary. Or rename nav until Scope exists.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** Slice 6; synthesis “Assets & Scope primary workspace”

### FINDING | P14-9 | P2 | improvement | nav | Dual dashboard labels (Dashboard vs Executive vs legacy Command center)
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Live shell: **Dashboard** `/dashboard` + **Executive** `/executive` (`primary-nav.tsx`). Legacy `app-navigation.ts`: **Dashboard** `/`, **Command center** `/dashboard`, **Executive** — three labels. `/` redirects to `/dashboard` (`app/page.tsx`).
- **Problem:** Practitioners ask “command center or dashboard?” Sales decks still say Command Center (component name `DashboardCommandCenter`). Executive is a second home for leadership — fine — but Core should not imply two operator homes.
- **Impact:** Bookmarks and training docs fragment; dual-config if anything still imports legacy nav worsens it.
- **Recommendation:** One operator home name: **Dashboard**. Executive stays for leadership. Delete “Command center” label everywhere user-facing; keep component name internal.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P14-10 | P0 | improvement | nav | Feature zoo: ~38 primary destinations for a many-hat operator
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Count of `href:` entries in `PRIMARY_NAV` ≈ 38 including Autonomous (Swarm, Workflows, Operators, Engagements, MCP), dual threat surfaces, model-adjacent, etc. Dual config still present: `app-navigation.ts` sections Core/Connect/Govern/Operate/Ecosystem/Reference.
- **Problem:** I have 4–6 hours/week for the tool. Every extra primary item is a decision tax.
- **Impact:** Monday rail fails; product feels unfinished enterprise suite rather than sharp validation plane. Aligns Jobs/Horowitz/Practitioner prior panel.
- **Recommendation:** Persona rail ≤10 for default tenant; Autonomous + Intel + half of Govern behind “More / Labs / Admin.” Single nav source — delete or generate-test-only for legacy `APP_NAV_SECTIONS`.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03; U-16

### FINDING | P14-11 | P1 | improvement | engines | Engine install UX is a marketplace, not a readiness checklist
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `tool-governance-marketplace.tsx` — search/filter, per-tool Install/Enable, legal review, summary tiles. Snapshot readiness only counts enabled. Platform evidence packs section links “Run from a verified scope →” to `/missions` without install gate.
- **Problem:** Marketplace is fine for platform teams; mid-market needs “checklist to first measured external/web/path result.”
- **Impact:** I enable the wrong tool, skip legal-blocked, or never install pinned runtime.
- **Recommendation:** Guided “Engines for your first snapshot” subset (top N modules) with Install → Enable → Test path; collapse ExtensionDeveloperStudio below fold for non-builders.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P14-12 | P1 | improvement | onboarding | Dual first-run: GetStarted vs Getting Started guide
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Empty dashboard shows 3-step `GetStarted` (`dashboard-command-center.tsx`). Separate route `/getting-started` with multi-milestone `GettingStartedGuide` driven by full activation milestones — **not** on `PRIMARY_NAV`. Legacy app-nav Reference still listed Getting started.
- **Problem:** Two onboarding truths with different step counts and destinations.
- **Impact:** Support scripts disagree; I complete 3-step and still have “incomplete prerequisites” in Needs you from deeper milestones.
- **Recommendation:** One activation model. Dashboard GetStarted should deep-link “See full checklist” to milestones **or** absorb top diagnostics into the three steps. Put Getting Started in help drawer, not a second religion.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-09

### FINDING | P14-13 | P2 | bug | api | Work-queue “Policy approvals” lands on Policies = Trust & Safety shell
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Work queue item href `/policies?approvalState=Pending` (`tenant.ts`). `app/policies/page.tsx` renders `TrustSafetyDashboard` with header “Control what validation is allowed” — no obvious consumption of `approvalState` query for a pending-decision queue.
- **Problem:** Needs you says “Policy approvals waiting” then drops me into a broad trust/safety dashboard.
- **Impact:** Dead-end Monday click; pending missions stay blocked while I hunt.
- **Recommendation:** Dedicated pending-approvals panel that respects query param, or href to the surface that records the decision (mission detail / authorization record).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P14-14 | P2 | improvement | findings | Fingerprint / occurrence / root-cause invisible in queue
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Grep of `findings-workbench-v2.tsx`: no `fingerprint`, `occurrenceCount`, `rootCauseSummary`. Backend grouping exists (SOC panel + synthesis U-11).
- **Problem:** I cannot see “same root cause × N” without API. Dedup investment is invisible to the human who owns the queue.
- **Impact:** Duplicate tickets; noise fatigue; I distrust priority scores.
- **Recommendation:** Show occurrenceCount badge, lastSeen, and root-cause one-liner on row; filter “group members.” Default Active queue excluding FP/Suppressed.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P14-15 | P2 | improvement | remediation | Remediation detail loads entire rem list to resolve one id
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `remediation-detail.tsx`: `useApiResource(() => api.listRemediations())` then `.find(r => r.remediationId === id)`. Client only has `listRemediations` (no `getRemediation` in api client grep).
- **Problem:** Latency and failure mode scale with tenant rem volume; wrong empty state if list truncates later.
- **Impact:** Slow detail pages on real tenants; fragile deep links from Needs you.
- **Recommendation:** `GET /remediations/:id` + client get; keep list for workbench.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P14-16 | P2 | improvement | ops | Needs you total sums bucket counts (inflated badge)
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `getProductWorkQueue` `total: items.reduce((sum, item) => sum + item.count, 0)`. Metric card “Needs you” shows `queueTotal`.
- **Problem:** 3 overdue + 2 failed + 4 unowned = “9 open” feels like 9 separate fires; cognitively correct as work units but reads as alert flood to executives glancing the tile.
- **Impact:** Alert-fatigue optics; leadership panics on badge.
- **Recommendation:** Show `items.length` categories + secondary “N work units”; or cap display as “4 queues · 12 items.”
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P14-17 | P2 | improvement | findings | Fix workflow uses only first related path
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** `findings-workbench-v2.tsx`: `pathId = finding.relatedPathIds[0] ?? null` for createRemediation.
- **Problem:** Multi-path findings silently bind rem to an arbitrary first path.
- **Impact:** Wrong re-test target; engineer fixes the other entry point.
- **Recommendation:** Path picker when `relatedPathIds.length > 1`; show path summary (entry → objective).
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P14-18 | P2 | improvement | runners | Multiple runner UIs increase ops training cost
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Live route `/runners` → `RunnerFleetControlRoom`. Legacy/alternate components still in tree: `runners-workbench.tsx`, `runners-console.tsx`, `runner-pairing.tsx` (pairing embedded in fleet room). Stale helper `isRunnerStale` lives on workbench; fleet has its own health model (Healthy/Offline/Attention…).
- **Problem:** Docs/tests/agents may reference different runner chrome; I get conflicting “how to deploy” snippets (docker run token vs curl install script).
- **Impact:** Broken first runner = no in-network measured proof = product fails evaluation.
- **Recommendation:** One Runners surface; deprecate alternate workbenches; one install path per OS with copy-paste that matches control plane URL.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P14-19 | P2 | feature | ops | Schedules not linked into Needs you as first-class program health
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Failed runs appear via `validationRun status=Failed` in work queue. Schedule row has `lastDiff` / DiffSummary but no “schedule overdue / missed window / paused too long” kinds. Blackout deferral is documented in UI copy only.
- **Problem:** A paused schedule or missed nextRun is silent on Dashboard.
- **Impact:** Continuous validation regresses to manual; Slice 8 incomplete for operators.
- **Recommendation:** Work-queue kinds: SchedulePaused, ScheduleMissedNextRun, ScheduleLastRunFailed (with href `/schedules`).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Slice 8

### FINDING | P14-20 | P3 | improvement | design-system | Dual chrome components on operator paths
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Findings/schedules/remediation use Tailwind panel kit; parts of runners-workbench / older cards use legacy `Card`/`StatusPill` patterns. Prior UI panel: dual design systems (U-14).
- **Problem:** Inconsistent density and button placement across Monday paths slows muscle memory.
- **Impact:** Small friction × every screen = fatigue.
- **Recommendation:** Finish migration on rem/schedules/runners/findings only (not whole zoo).
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-14

### FINDING | P14-21 | P2 | request | integrations | Ticket create needs zero-click default destination
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Snapshot ticket UI requires selecting destination each time among `ticketingDestinations`. Mid-market usually has **one** Jira project or Syncro.
- **Problem:** Extra click every rem when only one PSA is connected.
- **Impact:** Skip ticket create under time pressure.
- **Recommendation:** Default to sole connected ticketing integration; remember last-used per tenant; optional default project key in integration config.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-12 (extends)

### FINDING | P14-22 | P3 | improvement | copy | Proof-loop stage vocab vs CTEM radar vs Needs you stages
- **Persona:** Mid-market security practitioner (many hats)
- **Evidence:** Help `product-help.ts` proof loop “Connect → Authorize → Validate → Understand → Act → Verify → Prove”; work-queue stages include Authorize/Validate/Understand/Act/Verify/Prove; CTEM program stages separate on dashboard.
- **Problem:** Three stage systems for one human. Prior U-02.
- **Impact:** Training deck vs product disagree; I stop reading stage chips.
- **Recommendation:** One stage enum in UI chrome; map CTEM to it in a single legend.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

---

## Cross-walk to previous panel (agree / dissent)

| Theme / ID | Stance |
|------------|--------|
| U-12 rem ticket on detail | **Agree strongly** — still missing in `remediation-detail.tsx`; P0 for me |
| U-03 / feature zoo | **Agree** — counted ~38 primary hrefs; Autonomous still on rail |
| U-02 vocabulary | **Agree** — Findings/Validated Results/Exposure is the practitioner-facing instance |
| U-09 dual first-run | **Agree** — GetStarted vs Getting Started |
| U-11 fingerprints | **Agree** — still zero UI binding |
| U-16 Autonomous early | **Agree** — demote until loop is boring |
| Slice 6 Scope home | **Agree** — Assets & Scope label is currently a lie for scope admin |
| Slice 8 schedules | **Agree + extend** — blackouts good; notify/scope-edit/missed-run still weak |
| Needs you “excellent” | **Agree with caveat** — direction excellent; taxonomy dual-path is not |
| Score ~3.3 prior | **Restate 3.2** — ticket + naming + scope home still block 4.0 |

---

## Practitioner Monday script (target vs today)

| Step | Target | Today |
|------|--------|-------|
| 1. Open app | Needs you ranked | Works when API up; taxonomy shifts on fallback |
| 2. Own top finding | Fingerprint + path + rem | Path-gated; no occurrence UI |
| 3. File ticket | From rem detail | Snapshot only |
| 4. Engineer claims done | Mark ready + re-verify | Good on rem detail |
| 5. Continuous | Schedule + notify | Schedule yes; notify/scope-edit no |
| 6. Runner health | Fleet + engines | Fleet yes; engines elsewhere |
| 7. Scope truth | Scope home | Missions wizard + mislabeled data fabric |

---

## Finding count

**22 findings** (P0: 2 · P1: 10 · P2: 8 · P3: 2) — meets exhaustive minimum (≥18).

---

## Bottom line

Periscan is **already the right kind of product** for a mid-market practitioner who refuses scanner theater. The blockers are not “more AI” or “more BAS” — they are **ticket handoff on the rem record**, **one name for the queue**, **one scope home**, **schedules that page me when they fail**, and **a nav that fits a human with many hats**. Fix those and Monday works. Leave the zoo and I keep a spreadsheet.

*End of panel audit `14-security-practitioner.md`.*
