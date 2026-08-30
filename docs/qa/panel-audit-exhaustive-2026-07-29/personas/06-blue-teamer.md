# Panel P06 — SOC Blue Team Lead (Exhaustive)

**Date:** 2026-07-29  
**Persona:** SOC Blue Team Lead — detections, control effectiveness, findings queue ops, continuous validation, runner fleet, SIEM/ITSM handoff, Monday shift workflow  
**Mode:** Read-only code + product-surface audit (docs write only)  
**Repo:** `/Volumes/DataSSD1/test/periscan`  
**Contract:** `PROMPT_CONTRACT.md` · prior consensus: `PREVIOUS_PANEL_SYNTHESIS.md`  
**Prior persona note:** `docs/qa/panel-audit-2026-07-29/06-blue-teamer.md` (B/B+ as validation plane)

---

## 1. Verdict (lens score)

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Overall blue-team operational readiness** | **3.2 / 5.0** | Strong proof-gated remediation + safety floor; weak queue maturity, inject gap, and IA for the SOC job |
| Usable as SIEM / case console | 1.5 / 5 | Correctly not a SIEM; dangerous if sold that way |
| Usable as validated-exposure work queue | 3.5 / 5 | API real; UI hides fingerprint/occurrence; client-scale |
| Control effectiveness program | 3.0 / 5 | Observe path real; closed inject→telemetry still Partial |
| Continuous validation ops | 3.5 / 5 | Schedules + system sweep real; history/ops depth thin |
| ITSM / ticket handoff | 3.0 / 5 | API create-ticket real; **detail page missing create** |
| SIEM/EDR as control source | 3.0 / 5 | Top EDR/SIEM live; many mocks are technique placeholders |
| Daily Monday workflow | 2.8 / 5 | Needs-you direction good; rail/feature zoo kills focus |

### What 5.0 means on this lens

A blue-team lead can run a **closed weekly program** without leaving Periscan for the *validation* half of the job:

1. **Queue** defaults to Active/untriaged validated work; fingerprints + occurrence + owner/SLA visible; shift handoff via shared views.  
2. **Controls** support authorized stimulus (or honest “observe-only”) with inject→observe→verdict receipts, not mock-stamped coverage rings.  
3. **One intel→validate rail** (not Threat Center + Feed + Signal Activity + Validation Ops + Schedules as siblings).  
4. **Remediation detail** creates + syncs ITSM tickets; Fixed only after retest (already true).  
5. **Webhooks** emit what SOC automations subscribe to (`policy.denied`, `remediation.verified` / verification events).  
6. **Runners** show server-authoritative health (stale ≠ Active) and pair cleanly with Control/Fix schedules.  
7. **Primary rail ≤ ~10** daily-driver items; Autonomous/MCP/Swarm demoted so the SOC job is the product.

**Ship posture (agree with prior panel):** design-partner / validation plane beside SIEM+ITSM — **not** platform-of-record for 5k-employee SOC detection/response. Prior Blue score B/B+ remains fair for *category-correct* use; this exhaustive pass scores **3.2/5** on *operational completeness of the blue job*.

---

## 2. Findings (machine-parseable)

### FINDING | P06-1 | P1 | bug | findings | Findings UI never surfaces fingerprint / occurrenceCount / rootCauseSummary
- **Persona:** SOC Blue Team Lead
- **Evidence:** API `buildValidatedFindings` stamps `fingerprint`, `occurrenceCount`, `rootCauseSummary`, `groupKey` (`apps/api/src/runtime-services.ts` ~7805–8294, Slice 4 Phase C–D). Shared schema carries these fields. UI `apps/web/src/components/findings-workbench-v2.tsx` has **zero** references to `fingerprint`, `occurrenceCount`, or `rootCauseSummary` (grep clean). Operators only see title/severity/status/disposition.
- **Problem:** Backend dedup/grouping exists; the queue still looks like one-row-per-noise to analysts. Cannot answer “how many times / how many assets for this root cause?” without API spelunking.
- **Impact:** False multitasking, duplicate remediations from UI, SOC analysts cannot trust queue cardinality. Blocks “Active work item” mental model.
- **Recommendation:** Render fingerprint (short), occurrence count, affected asset count, and root-cause line on list + expand; filter/group by fingerprint; default sort keep priority then occurrence.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11 | Slice 4 Findings ops

### FINDING | P06-2 | P1 | improvement | findings | Findings workbench is client-side filter/paginate only — not SOC-scale queue ops
- **Persona:** SOC Blue Team Lead
- **Evidence:** `findings-workbench-v2.tsx` loads `api.listFindings()` fully, `PAGE_SIZE = 25`, filters severity/status/disposition/query in memory (`filtered.slice(page * PAGE_SIZE, …)`). API supports `filters.offset`/`limit` (`findings.ts` ~435–439) but UI never passes them. Refetch every 45s reloads entire derived set.
- **Problem:** Fine for design-partner tenants; fails as multi-source continuous validation grows. No server facets, no cursor, no assignment queues beyond client filters.
- **Impact:** Latency and missed work under volume; cannot run “my shift” without downloading everything.
- **Recommendation:** Wire listFindings query params (status, disposition, severity, search, limit/offset or cursor); server-side default “Active” = non-settled dispositions; keep saved-view URL params.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11 | theme findings ops

### FINDING | P06-3 | P1 | improvement | findings | No durable owner/SLA on findings except AcceptedRisk; priority-unowned is half-finished
- **Persona:** SOC Blue Team Lead
- **Evidence:** `transitionFinding` sets `ownerId` only when disposition is `AcceptedRisk` (`findings.ts` ~494–537). Saved view `priority-unowned` filters `priorityScore >= 70 && !disposition?.ownerId` (`findings-workbench-v2.tsx` ~153–154). Escalated/Acknowledged never require owner. Remediation create from finding *can* set owner/dueAt (~1044–1126) but finding itself stays unowned.
- **Problem:** SOC queue ops need assignee + due without forcing “accepted risk.” Priority-unowned view is mostly always-true for high priority.
- **Impact:** No shift handoff, no SLA clock on exposure work, bulk FP/escalation without accountability.
- **Recommendation:** Allow optional `ownerId` (+ optional `dueAt`) on any disposition; surface owner chip on list; make priority-unowned meaningful; add “My queue” saved view.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11 | Practitioner Monday rail

### FINDING | P06-4 | P2 | feature | findings | FalsePositive / Suppressed dispositions are labels only — no detection-engineering feedback loop
- **Persona:** SOC Blue Team Lead
- **Evidence:** Dispositions enum includes `FalsePositive`, `Suppressed` (`domain.ts` ~3566–3571); UI bulk/single transition supports them. Grep of `apps/api/src` services shows no FP-specific side effects (no control-source tuning ticket, no suppression rule export, no SIEM feedback, no linkage to `NeedsTuning` techniques). Disposition is stored + audited `finding.disposition_changed` only.
- **Problem:** Blue teams mark FP to clear queue noise; product does not help “why did validation produce this?” or “tune the correlator / module.”
- **Impact:** Analysts re-mark the same class next run; detection eng still lives entirely in SIEM; Periscan FP rate is invisible to program metrics.
- **Recommendation:** On FalsePositive: require reason code (module noise / scope wrong / already mitigated / correlator); optional link to control technique; emit webhook `finding.disposition_changed` already in audit — extend **webhook catalog** + dashboard FP rate by module/fingerprint; suggest Suppress-by-fingerprint for N days (policy-bound).
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P06-5 | P0 | improvement | engines | Closed control inject→telemetry loop still hard-disabled on control-plane API
- **Persona:** SOC Blue Team Lead
- **Evidence:** `control-ai.ts` ~908–912 throws `control_live_execution_disabled` when `executionMode === "LiveRunner" || dryRun === false`. Dry-run path may call `connector.observeControl` without injecting activity. `ANALYST_CAPABILITY_MATRIX.md` row “Control validation”: Met (telemetry correlation) / **Partial (injection loop)**. `control-stimuli.ts` exists for governed stimuli with approval gates, but product UX still cannot claim continuous BAS-style “we fired, they missed.”
- **Problem:** Blue team’s core question — “did EDR/SIEM fire when we exercised the technique?” — is only half answered (query historical telemetry / mock).
- **Impact:** Competitive gap vs AttackIQ/Cymulate control efficacy demos; control coverage rings can over-read observe-without-stimulus.
- **Recommendation:** Ship one **policy-bound** inject path: approved ControlValidation mission → allowlisted BASLite stimulus on verified scope → observeControl window → verdict + evidence receipts. Keep Atomic/Caldera live off. UI must label dry-run vs stimulated runs.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-23-adjacent | Slice 5 Control effectiveness

### FINDING | P06-6 | P1 | bug | integrations | Multiple SIEM mocks stamp technique-only placeholder ControlObservations — coverage theater risk
- **Persona:** SOC Blue Team Lead
- **Evidence:** `packages/connectors/src/siem-technique-context.test.ts` documents Elastic, Datadog SIEM, Chronicle, Sumo, InsightIDR, QRadar, **Microsoft Sentinel** mock `collectSignals` emitting placeholder ControlObservation that only stamps `config.techniqueId`. CrowdStrike/Splunk excluded (richer fixture mocks). Live smoke remains manual (`docs/CONNECTOR_LIVE_SMOKE.md`). Catalog still Beta.
- **Problem:** Demo/mockMode tenants can paint technique coverage without a real detect/search response.
- **Impact:** Blue leads may brief leadership on “covered techniques” from placeholders; trust erosion when live shows Missed/NoEvidence.
- **Recommendation:** UI: always show control-source health + `mockMode` badge + evidence basis on coverage tiles. Never aggregate mock observations into executive “% covered.” Prefer non-mock or “fixture-backed detect payload” for remaining SIEMs; live-smoke gate top-5 SIEM/EDR pairs.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none | Blue prior SIEM Beta note

### FINDING | P06-7 | P1 | bug | remediation | Create ticket missing on remediation detail (API + client exist; snapshot has CTA)
- **Persona:** SOC Blue Team Lead
- **Evidence:** API `POST /api/v1/remediations/:id/create-ticket` (`app.ts` ~9497). Client `createRemediationTicket` (`periscan-api-client.ts` ~3049). **Only** `snapshot-workbench.tsx` calls it (~1361 “Create ticket”). `remediation-detail.tsx` supports **sync** when `ticketId` already set (~90–109, 208–260) but **no create** when ticket absent — only displays ticket chip if present. List workbench shows ticket id in CSV path only.
- **Problem:** Analyst opens remediation from Findings/Remediation queue (primary path) and cannot mobilize to Jira/PSA without detour to snapshot.
- **Impact:** Broken Monday handoff; tickets stay tribal (Slack); Fixed loop without ITSM trail.
- **Recommendation:** Add “Create ticket” panel on detail when `!ticketId`; integration picker (default Jira Cloud); reuse `createRemediationTicket`; keep sync honesty (“external close ≠ Fixed”).
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-12

### FINDING | P06-8 | P1 | improvement | api | Webhook catalog too thin for SOC automation — `policy.denied` subscribeable but not emitted; no remediation.verified
- **Persona:** SOC Blue Team Lead
- **Evidence:** `WebhookEventTypeSchema` only: `mission.completed|failed`, `snapshot.ready`, `remediation.created`, `policy.denied` (`domain.ts` ~878–884). `emitTenantWebhook` usages include `remediation.created`, `snapshot.ready`; **no** production emit of `policy.denied` found under services (tests subscribe to it in `app.test.ts` ~24973). Audit has rich actions (`verification.run`, `finding.disposition_changed`, `remediation.ticket.created`) not mirrored as webhook types.
- **Problem:** SOC wants chat/on-call on deny, retest outcome, ticket created — must poll audit or invent workers.
- **Impact:** Integrations team builds brittle scrapers; panel U-08/U-21 confirmed.
- **Recommendation:** Either emit `policy.denied` on deny decisions or remove from catalog. Add `remediation.verified` (payload: outcome, measuredRevalidation, remediationId) and optionally `finding.disposition_changed`. Document payload contracts.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-08 | U-21

### FINDING | P06-9 | P1 | improvement | nav | Threat Center / Threat Feed / Signal Activity / Validation Ops / Schedules fragment one blue job
- **Persona:** SOC Blue Team Lead
- **Evidence:** Primary nav (`primary-nav.tsx`): Operate → Integrations, Packs, Runners, Tool Governance, **Validation Ops**, **Signal Activity**; Intel → **Threat Center**, **Threat Feed**, ATT&CK; Remediate → Remediation, **Schedules**. Separate workbenches: `threat-center-workbench-v2.tsx` (plan never runs alone), `threat-feed-workbench.tsx`, `signal-activity-stream.tsx` (fixed `SIGNAL_TRIGGER_RULES` only — 4 rules in `runtime-services.ts` ~1118–1185), `validation-ops-dashboard.tsx` (omnibus metrics dump), `schedules-workbench-v2.tsx`.
- **Problem:** Blue lead’s continuous program is one job: **intel/signal → decide validate → schedule/run → proof**. Five surfaces + dual nav history force training debt.
- **Impact:** Operators miss ready triggers; schedule without runner health; intel plan never converts to ControlValidation/FixVerification cadence.
- **Recommendation:** Merge into **Continuous Validation** hub: tabs Plan (threat+signals), Run (schedules+due), Health (runners+control sources+validation-ops metrics). Demote raw Validation Ops and Threat Feed under hub. Keep ATT&CK catalog secondary.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-23 | U-03

### FINDING | P06-10 | P2 | improvement | ops | Schedules lack run history, failure reasons, and change-window integration depth
- **Persona:** SOC Blue Team Lead
- **Evidence:** `schedules-workbench-v2.tsx` CRUD: frequency, timezone, blackouts, mission types Continuous/Control/FixVerification, pause/resume/run-now; shows `nextRunAt`/`lastRunAt` relative only (~493). `system-scheduler.ts` + `runDueSchedules` real. No per-run history UI, no last policy deny reason on card, no ServiceNow change-window import (blackouts are local config only). Tenant service comments “CTEM schedule history is best-effort” (`tenant.ts` ~503).
- **Problem:** Continuous program needs “why didn’t Tuesday’s ControlValidation fire?” without audit log archaeology.
- **Impact:** Silent skip during blackout/deny/runner kill looks like “product flaky”; auditors cannot see continuous validation proof timeline.
- **Recommendation:** Persist schedule run records (scheduledAt, outcome, missionId, deny reason, blackout skip); show last 10 on schedule detail; deep-link mission; optional webhook on schedule.failed.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Slice 8 Continuous validation ops

### FINDING | P06-11 | P2 | feature | engines | Signal triggers are a fixed four-rule catalog — not customer detection content
- **Persona:** SOC Blue Team Lead
- **Evidence:** `SIGNAL_TRIGGER_RULES` hard-coded: CVE advisory, Asset change, Policy change, Missed detection (`runtime-services.ts` ~1118–1185). Approve creates **policy decision + draft mission only** (`signal-triggers.ts` `approveSignalTrigger`). No Sigma/customer rule authoring; activity is evaluation-derived, not durable high-volume bus.
- **Problem:** Fine for safety; blue teams expect “when *our* high-sev control miss class fires, draft ControlValidation.” Cannot encode org-specific playbooks.
- **Impact:** Signal Activity stays demo-ish; real automation stays in SOAR.
- **Recommendation:** Keep non-queueing approve. Add tenant-configurable enable/disable + routing (partially present) and **parameterized thresholds** (e.g. min priority, technique allowlist) before full rule DSL. Document explicitly “not a SIEM correlation engine.”
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P06-12 | P1 | bug | runners | Runner status stays Active while UI-only staleness is the only honesty signal
- **Persona:** SOC Blue Team Lead
- **Evidence:** `runners-workbench.tsx` ~101–123: server stamps `lastSeenAt` but **does not** derive Offline from silence; `RUNNER_STALE_AFTER_MS = 15m`; `isRunnerStale` is UI-only. Schedules/system sweep still assume fleet available if not kill-switched.
- **Problem:** Dashboard can show green Active runners that have been dead for hours if operator misses stale badge.
- **Impact:** ControlValidation/FixVerification schedules fail or skip with obscure policy/runner errors; continuous program false confidence.
- **Recommendation:** Server-side status transition Active→Stale/Offline after threshold; block schedule dispatch with clear `runner_fleet_unhealthy`; surface on Validation Ops + Schedules prerequisites. Keep kill switch as separate control (already strong).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P06-13 | P2 | improvement | remediation | Fix retest module selection is keyword-family-based — measured Fixed hard for many exposures
- **Persona:** SOC Blue Team Lead
- **Evidence:** `ANALYST_CAPABILITY_MATRIX.md` ~51: retest modules from family/keyword map (`packages/shared/src/fix-verification.ts`); heuristic exposures correctly stay **Inconclusive** rather than false Fixed. `remediation.ts` tracks `executedRealRetest`, `measuredRevalidation`, excludes compare no-op.
- **Problem:** Honesty is correct; ops pain is high — many remediations never earn Measured Fixed, so board packs stay “Inconclusive after ticket done.”
- **Impact:** ITSM closed + Periscan not Fixed creates SOC/IT friction; teams may stop verifying.
- **Recommendation:** Prefer **original module set** from source mission/evidence when available; family map as fallback. UI: show “why Inconclusive” (no measured prior / module mismatch). Schedule FixVerification only when retest path can be measured.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none | protect Fixed honesty

### FINDING | P06-14 | P1 | improvement | nav | Feature zoo on primary rail crowds out the blue daily driver
- **Persona:** SOC Blue Team Lead
- **Evidence:** `PRIMARY_NAV` ~330–591: Prove (5), Investigate (8 incl. AI Apps, NHI, External Validation), Remediate (2), **Autonomous** (Swarm, Workflows, Operators, Engagements, MCP), Operate (6), Intel (3), Govern (8). Dual config still noted vs `app-navigation` (~327–328). Autonomous not `defaultOpen` but still on rail. Blue Monday set is really: Dashboard, Findings, Controls, Remediation, Schedules, Runners, Integrations, Evidence/Reports.
- **Problem:** Blue job competes with agent theater (U-16). Training a new SOC analyst on Periscan is a product tour, not a shift start.
- **Impact:** Time-to-first-disposition rises; design-partner success depends on white-glove navigation.
- **Recommendation:** Persona or “SOC program” rail preset: Dashboard · Missions · Paths · Findings · Controls · Remediation · Schedules · Runners · Integrations · Reports (+ Admin). Move Autonomous + MCP + Swarm + Model surfaces to Labs. Single nav source (U-03).
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03 | U-16 | Wave A packaging

### FINDING | P06-15 | P2 | improvement | findings | Default view is “All” not Active/untriaged — anti-pattern for shift start
- **Persona:** SOC Blue Team Lead
- **Evidence:** `savedView` initial state `"all"` (`findings-workbench-v2.tsx` ~107). Saved views exist: priority-unowned, new-untriaged, reopened — but not default. Product help calls queue “Validated Results” not alerts — still, operators open `/findings` and see settled FP/suppressed mixed with new work unless they click.
- **Problem:** SOC tools default to Open/Active; Periscan defaults to museum of all derived findings.
- **Impact:** Missed new exposures; FP pile feels like SIEM noise (wrong category but same fatigue).
- **Recommendation:** Default `new-untriaged` or disposition=none + non-terminal validation states; persist last view per user; keep All one click away.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11 Active queue default

### FINDING | P06-16 | P2 | feature | integrations | No bi-directional SIEM case / notable close path
- **Persona:** SOC Blue Team Lead
- **Evidence:** SIEM connectors emphasize `observeControl` / collectSignals / sync health (`siem-sync-health.test.ts`, live clients). Findings dispositions do not call back into Splunk notable, Sentinel incident, or CrowdStrike detection close APIs. Webhooks do not include disposition events (P06-8).
- **Problem:** Dual-homed work: disposition in Periscan, case still open in SIEM (or vice versa).
- **Impact:** MSSP/SOC double-close burden; “is this still a case?” ambiguity.
- **Recommendation:** Do **not** become a SIEM. Offer optional outbound: on Escalated → create/link case (workflow connector); on FalsePositive/Suppressed → comment-only webhook. Document non-goals for bi-directional close.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** Competitive co-exist theme

### FINDING | P06-17 | P2 | improvement | evidence | Disposition keys remain findingId not fingerprint — group absorb can orphan triage decisions
- **Persona:** SOC Blue Team Lead
- **Evidence:** Comment in `runtime-services.ts` ~7809–7814: disposition rows keyed by `findingId`; after fingerprint group, representative keeps pathId/signalId; **“do not re-key dispositions onto fingerprint without a migration (out of scope)”**.
- **Problem:** When grouping collapses members, analyst disposition on a member id may not attach to the representative queue row.
- **Impact:** Re-triage loops; “I already marked FP” reappears after correlation/group change.
- **Recommendation:** Slice 4 follow-up: migrate disposition unique key to `(tenantId, fingerprint)` or copy disposition onto representative and freeze member ids in metadata; UI shows “disposition inherited from group.”
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-11 | Slice 4

### FINDING | P06-18 | P3 | innovation | ops | Blue “shift pack” — single morning brief API + page for validated program health
- **Persona:** SOC Blue Team Lead
- **Evidence:** Data already exists piecemeal: findings list, control coverage summary, schedules last/next, runner lastSeen, remediation overdue, signal trigger evaluations, threat readiness. No single operator brief; Validation Ops is a metrics dump not a shift checklist.
- **Problem:** 08:00 start requires 6+ URLs (day-in-life map from prior blue audit still accurate).
- **Impact:** Inconsistent coverage of continuous program; junior analysts miss kill-switched runners or expired risk acceptances.
- **Recommendation:** Innovation: `/shift` or Dashboard “Blue shift” card: (1) untriaged count, (2) accepted-risk expiring 7d, (3) schedules due/failed 24h, (4) stale runners, (5) control Missed/Logged-only top techniques, (6) remediations verification-pending. One refresh, deep links only.
- **Effort:** M
- **Zoo-related:** yes (replaces sprawl with one job surface)
- **Previous-panel-link:** Practitioner Monday rail | Wave A Needs you

### FINDING | P06-19 | P2 | request | security | Practice/drill mode for kill switch + denied-task visibility in SOC runbooks
- **Persona:** SOC Blue Team Lead
- **Evidence:** Kill switch UI + audit real (`runners-workbench.tsx`, fleet control room). Policy denied tasks never queued (product principle). No first-class “safety drill” mission type or runbook export for SOC tabletop.
- **Problem:** Blue teams must practice kill switch and show auditors that denied work cannot run — currently tribal knowledge.
- **Recommendation:** Documented drill: issue kill switch, attempt schedule run-now, show denied/halted audit + UI; export evidence pack snippet “Safety control exercised.” Optional quarterly reminder on Trust & Safety.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none | protect safety floor

### FINDING | P06-20 | P1 | improvement | compliance | Control “Logged only” / Needs tuning not auto-mobilized into findings or tickets
- **Persona:** SOC Blue Team Lead
- **Evidence:** Controls workbench surfaces Logged only / Needs tuning / Missed tiles (`controls-workbench.tsx` ~140–145, classifier honesty in matrix). Missed detection **signal trigger** can draft ControlValidation (`trigger.missed_detection`). No automatic finding or remediation ticket from Logged-only class; tuning save is local expectation edit (~885–1049).
- **Problem:** Detection engineering work items still manual: screenshot coverage ring → Jira.
- **Impact:** Control efficacy insights die on the Controls page; purple-team loop incomplete.
- **Recommendation:** “Create detection-eng ticket” / remediation-style task from technique row (Logged only / Missed) via workflow connector; optional finding category ControlGap with fingerprint per technique+source.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Slice 5

---

## 3. Top 5 moves to reach 5.0

1. **Findings queue ops (P06-1, P06-2, P06-3, P06-15, P06-17)** — Surface fingerprint/occurrence; default Active/untriaged; owner on any disposition; server-side filter; disposition-on-fingerprint.  
2. **Remediation ticket handoff (P06-7) + webhook truth (P06-8)** — Create ticket on detail; emit/remove `policy.denied`; add `remediation.verified`.  
3. **Control inject honesty (P06-5, P06-6, P06-20)** — One approved stimulus path with receipts; mock never in executive coverage %; mobilize Logged/Missed to tickets.  
4. **Collapse continuous program IA (P06-9, P06-10, P06-14, P06-18)** — One Continuous Validation hub + Blue shift brief; demote Autonomous/MCP; schedule run history.  
5. **Runner health authority (P06-12)** — Server stale/offline; schedules refuse unhealthy fleet with operator-clear errors.

---

## 4. Feature-zoo / IA notes (cut · merge · rename · demote)

| Action | Surface | Rationale for blue job |
|--------|---------|------------------------|
| **Demote → Labs** | Agent Swarm, MCP Server, Agent Workflows, Operators (until proof loop boring) | U-16; not Monday SOC work |
| **Merge** | Threat Center + Threat Feed + Signal Activity | One “Intel → plan validate” rail (U-23) |
| **Merge / demote** | Validation Ops into Continuous Validation Health tab | Metrics without job framing |
| **Keep primary** | Dashboard, Findings, Controls, Remediation, Schedules, Runners, Integrations, Paths, Reports/Evidence | Blue daily driver |
| **Rename** | Findings nav “Exposure” / help “Validated Results” → pick **one** word in UI chrome | Dual vocabulary confuses triage training |
| **Keep but gate** | AI Apps, NHI, External Validation | Real products; not first-week SOC program |
| **Do not cut** | Proof-gated Fixed, kill switch, denied-never-queued, dry-run control observe | Safety + honesty floor |
| **Do not build** | Full SIEM case console, Sigma authoring, live Caldera/Atomic prod | Wrong category; safety |

**Zoo-related finding IDs:** P06-9, P06-14, P06-18.

---

## 5. What is already excellent (do not break)

1. **Fixed only after verification** — ClosedWithoutEvidence on external ticket close; measured revalidation flags; anti-fabrication tests.  
2. **AcceptedRisk hygiene** — Owner + future expiry required; approval path exists.  
3. **Logged ≠ Detected classifier** — Control coverage honesty.  
4. **fixtureOutcome rejected outside dev** — Control AI path.  
5. **Outbound signed-task runner + kill switch** — Real SOC safety control.  
6. **Signal approve non-queueing** — Draft mission only; policy decision first.  
7. **Threat Center plan never auto-runs** — Correct for safety (`threat-center-workbench-v2.tsx` copy).  
8. **Schedules with blackouts + system scheduler sweep** — Continuous spine is real.  
9. **Jira/workflow create-ticket API + PSA generalization** — Backend path proven in tests/e2e.  
10. **Validated findings model** (not raw scanner inbox) — Right product category for blue *validation* plane.  
11. **Webhook signing + delivery queue** — Foundation for SOC chatops once event catalog is truthful.  
12. **Connector Planned ≠ connectable honesty** (Slice 1) — Procurement trust.

---

## 6. Day-in-life map (updated after exhaustive pass)

| SOC intent | Surface today | Friction called out |
|------------|---------------|---------------------|
| Validated exposure queue | `/findings` | P06-1–4, P06-15, P06-17 |
| Did controls fire? | `/controls` | P06-5, P06-6, P06-20 |
| What should we validate next? | `/signal-activity` | P06-11; fragment P06-9 |
| CVE/advisory exposure | `/threat-center`, `/threat-feed` | Fragment P06-9 |
| Continuous / fix recheck | `/schedules`, `/validation-ops` | P06-10, P06-9 |
| Close only if re-proof holds | `/remediation/[id]` | **P06-7 ticket create**, P06-13 |
| In-network agent alive? | `/runners` | P06-12 |
| Push work / pull telemetry | `/integrations` | SIEM depth P06-6; ITSM depth Jira-first |

---

## 7. Agreement / dissent vs PREVIOUS_PANEL_SYNTHESIS

| Theme | Stance |
|-------|--------|
| Not a SIEM (Blue prior B/B+) | **Agree** — reinforce; score 3.2 reflects ops completeness not category fail |
| U-11 fingerprints/occurrence UI | **Agree hard** — P06-1 is P1 for this lens |
| U-12 rem ticket on detail | **Agree** — P06-7 reconfirmed in code (create only on snapshot) |
| U-23 threat/signal fragmentation | **Agree** — P06-9 expands with Validation Ops + Schedules |
| U-08/U-21 webhook truth | **Agree** — P06-8 |
| U-16 Autonomous on rail | **Agree** — P06-14 |
| Slice 5 control effectiveness | **Agree** — P06-5/P06-20 are the blue competitive pressure |
| Wave A freeze surface | **Agree** — do not add more SIEM logos; deepen top observe + ticket path |
| Jobs “one hero loop” | **Agree** — blue hero loop is validate → disposition → remediate → re-verify → ticket proof |

**Dissent (mild):** Prior Blue “B/B+” can be misread as buy-ready for SOC tooling RFP. Exhaustive pass: **conditional pilot as validation plane only**; for “SOC platform” RFP answer **no-bid**.

---

## 8. Pilot prescription (first 30 days — unchanged in spirit, tightened)

1. One EDR + one SIEM **non-mock**; register control sources; ignore catalog logo count.  
2. One internal runner; practice kill switch; watch stale badge until P06-12 ships.  
3. ControlValidation dry-run observe first; treat Logged only as detection-eng work (manual until P06-20).  
4. Findings: use New·untriaged view; bulk disposition; do not treat as SIEM.  
5. Remediations: create tickets **via snapshot or API** until P06-7; verify Fixed only after retest.  
6. Weekly ControlValidation + FixVerification schedules + blackouts; watch lastRunAt.  
7. Threat Center import one advisory → plan only → convert to schedule manually.  
8. Webhooks: subscribe `remediation.created` + `snapshot.ready`; do not trust `policy.denied` until emitted.

Skip: 267-vendor shopping, live offensive kit, demo seed as audit evidence, replacing Splunk/Sentinel.

---

## 9. Sign-off

- **Persona:** P06 SOC Blue Team Lead  
- **Findings count:** 20 (P06-1 … P06-20)  
- **Verdict:** **3.2 / 5.0** on blue operational completeness; **B as validation plane** if category-correct  
- **Output path:** `docs/qa/panel-audit-exhaustive-2026-07-29/personas/06-blue-teamer.md`  
- **Action for product:** Findings UI fingerprint + rem ticket create + control inject honesty + continuous IA collapse + webhook truth  
- **Action for customer blue team:** Pilot beside SIEM/ITSM; one runner; Jira; measured Fixed only; ignore feature zoo  

**Do not break:** proof language, Fixed gate, kill switch, non-queueing signal approve, Planned ≠ connectable.
