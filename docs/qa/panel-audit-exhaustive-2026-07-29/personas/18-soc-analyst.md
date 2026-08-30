# Panel P18 — Tier-1 / Tier-2 SOC Analyst (exhaustive)

**Date:** 2026-07-29  
**Persona:** Tier-1 / Tier-2 SOC analyst — triage, investigation, FP handling, shift handoff  
**Mode:** Source-level adversarial review (code over docs); docs only  
**Primary surfaces:** `/findings`, `/evidence`, `/attack-paths` + detail, `/threat-feed`, `/threat-center`, Command Center, primary rail  
**Repo anchors:**  
- `apps/web/src/components/findings-workbench-v2.tsx`  
- `apps/web/src/components/evidence-ledger.tsx`  
- `apps/web/src/components/threat-feed-workbench.tsx`  
- `apps/web/src/components/threat-center-workbench.tsx`  
- `apps/web/src/components/dashboard-command-center.tsx`  
- `apps/web/src/components/attack-path-detail.tsx`  
- `apps/web/src/lib/primary-nav.tsx`  
- `packages/evidence/src/finding-fingerprint.ts`  
- `packages/shared/src/domain.ts` (`ValidatedFindingSchema`)  
- `apps/api/src/runtime-services.ts` (`buildValidatedFindings`, `filterValidatedFindings`)  
- `apps/api/src/services/findings.ts`  

**Contract:** `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md`  
**Previous panel:** `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` (U-11, U-23, U-16, Wave A #8)

---

## 1. Verdict (SOC lens)

| Score | Definition of 5.0 |
| ----: | ----------------- |
| **3.6 / 5** | A Tier-1/2 can open Monday’s shift on **one Active queue**, see **occurrence & root-cause** at a glance, **bulk-noise** FP/suppress without re-seeing them, pivot **finding → path → evidence → rem** in ≤3 clicks with **bidirectional** links, deep-link **threat alerts** into tenant work, and never hunt across a feature zoo for the investigation spine. |

**Why not higher:** Backend fingerprint/occurrence/grouping is real (Slice 4), but the **operator surface hides it**. Default “All” reintroduces FP/suppress noise. Threat surfaces are split and weakly actionable. Nav and badge density tax attention that should stay on the proof loop. Prior panel scored ~4.0 as a triage queue; this exhaustive pass is harsher on **shift-ready alert ops**, not on claim honesty.

**Posture:** Use as **validated-exposure triage** (not SIEM L1). Design-partner ready for purple/CTEM; **not** shift-ready for a 24×7 SOC queue at volume until Active default + occurrence UI + threat pivots land.

---

## 2. Top 5 moves to reach 5.0

1. **Surface Slice 4 in the queue row** — `occurrenceCount`, short `rootCauseSummary`, first/last seen; optional short fingerprint for support. Do not invent claims.  
2. **Active triage default** — exclude FalsePositive + Suppressed (+ optional settled AcceptedRisk Approved) from landing view; Command Center + help link there.  
3. **Fix “Priority · unowned” semantics** — use `finding.ownerId` / remediation ownership, not `disposition?.ownerId` (AcceptedRisk-only).  
4. **Investigation spine completeness** — evidence `Finding` entity route; path detail reverse findings; threat-center chips → `/evidence?evidenceId=`; threat alert → scope/findings when correlation exists.  
5. **Shrink analyst-day surface** — demote Swarm/MCP/Workflows/ATT&CK/dual Threat* from the daily rail; keep Findings · Paths · Evidence · Remediation · Threat alerts (one inbox) · Dashboard.

---

## 3. Feature-zoo / IA notes (SOC day)

| Action | Target | Why (analyst day) |
| ------ | ------ | ----------------- |
| **Cut / Labs** | Agent Swarm, MCP Server, Agent Workflows, Operators, Model Gateway | Zero value on a triage shift; steal attention from the proof loop (agree U-16 / Jobs / Horowitz) |
| **Merge** | Threat Center + Threat Feed → one **Threat** workbench with tabs: *Your alerts* · *Advisories* · *World catalog* · *Feed health* | U-23: dual “threat” destinations confuse Tier-1 “where is my queue?” |
| **Merge / demote** | Signal Activity vs Validation Ops | Ops noise next to investigate; keep under Operate for platform eng, not SOC primary |
| **Rename** | “Validated Results” / Findings | Keep; ensure dashboard copy always says **Findings** not scanner “alerts” |
| **Demote** | ATT&CK catalog, AI Apps, Machine Identities, External Validation, Compliance, Executive | Secondary after Active queue is empty |
| **Keep primary** | Dashboard · Findings · Attack Paths · Evidence · Remediation · Schedules · Runners · Integrations · Reports | Matches Wave A #3 persona rail |
| **Do not cut** | Disposition ≠ Fixed, dual-control AcceptedRisk, evidence chain verify, path hop receipts, tenant-scoped threat alerts | Anti–false-closure and integrity culture |

---

## 4. What is already excellent (do not break)

1. **Findings are derived, not raw scanner spam** — primary UX is validated exposure; raw output stays out of the operator queue (workbench + help copy).  
2. **Disposition never proves Fixed** — schema, service, and UI InfoPopover agree; Fixed only via verification (remediation path).  
3. **Fingerprint grouping + path-primary absorb server-side** — `packages/evidence/src/finding-fingerprint.ts`, `buildValidatedFindings` tests stamp occurrence / root cause.  
4. **Tier-1 speed primitives** — saved views, URL sync + Copy view link, page bulk disposition, CSV export, 25/page, 45s live poll.  
5. **Expanded row transparency** — priority reason, risk factors, path proof, missing-signal callout, path + evidence chips.  
6. **AcceptedRisk dual-control** + governance strip (Pending / Approved / Expired, soonest expiries).  
7. **Threat feed honesty** — tenant-correlated alerts only in “your alerts”; world catalog is research, not auto-queue; feed health + KEV filter.  
8. **Evidence integrity culture** — chain verify, per-artifact integrity, loud download fail, redaction confirm-phrase.  
9. **Command Center needs-you** — New unddispositioned findings, pending risk approvals, new threat alerts, VerificationPending remediations.  
10. **Remediation Fixed honesty** — ticket sync cannot close measured Fixed without revalidation (detail copy).

---

## Findings (machine-parseable)

### FINDING | P18-1 | P0 | bug | findings | occurrenceCount / fingerprint / rootCause invisible in findings UI
- **Persona:** Tier-1/2 SOC Analyst
- **Evidence:** `ValidatedFindingSchema` documents `fingerprint`, `groupKey`, `rootCauseSummary`, `firstSeenAt`, `lastSeenAt`, `occurrenceCount`, `affectedAssetCount` (`packages/shared/src/domain.ts` ~3655–3668). API `buildValidatedFindings` stamps them (`apps/api/src/runtime-services.ts`, tests in `runtime-services.test.ts`). `FindingRow` meta only shows `priorityScore · sourceMotion · evidenceIds.length · in-network` (`findings-workbench-v2.tsx` ~767–771); no occurrence/root-cause/fingerprint in row or detail. CSV export columns omit them (~298–320).
- **Problem:** Slice 4 anti-dupe investment is invisible to the human who triages. Analyst cannot distinguish “one root cause, 12 observations” from a singleton, or share a stable group id in tickets/shift notes.
- **Impact:** Alert fatigue returns as opaque volume; re-triage of the same cause; support cannot map UI rows to fingerprint groups without API dumps. Undercuts Wave A #8 / U-11.
- **Recommendation:** On collapsed row: badge `×N` when `occurrenceCount > 1`, first/last seen in mono meta, one-line `rootCauseSummary` in expand. Optional truncated fingerprint (8 hex) with copy. Add columns to CSV. Never upgrade claim language from grouping.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P18-2 | P0 | improvement | findings | Default All queue keeps FalsePositive and Suppressed in priority sort
- **Persona:** Tier-1 SOC Analyst
- **Evidence:** Saved views are All · Priority unowned · New untriaged · Reopened only (`findings-workbench-v2.tsx` ~389–395). Disposition filter defaults `"all"` (~106). No Active view. `FalsePositive` / `Suppressed` only drop out if analyst sets disposition filter manually.
- **Problem:** After bulk FP/suppress, noise reappears in the default priority-sorted “All” list every shift/refresh.
- **Impact:** Classic alert fatigue — disposition work does not reduce daily visual load. Tier-1 re-opens closed noise.
- **Recommendation:** Add **Active** saved view (status not Fixed/settled; disposition ∉ {FalsePositive, Suppressed}; optional hide Approved AcceptedRisk). Make Active the default landing and Command Center “New findings” deep-link target. Keep All as explicit “include closed noise.”
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P18-3 | P0 | bug | findings | Priority · unowned uses disposition.ownerId (AcceptedRisk-only), ignores finding.ownerId / remediation owner
- **Persona:** Tier-1 SOC Analyst
- **Evidence:** Filter: `priorityScore >= 70 && !f.disposition?.ownerId` (`findings-workbench-v2.tsx` ~152–155). Disposition `ownerId` is only set when choice is `AcceptedRisk` (~1192–1193). Schema projects operational `ownerId` / `ownerDisplay` / `slaDueAt` from remediation (`domain.ts` ~3669–3675). Web has **zero** reads of `finding.ownerId` / `ownerDisplay` / `slaDueAt` (grep empty under `apps/web`).
- **Problem:** “Priority · unowned” marks high-priority findings that already have remediation owners as unowned, while AcceptedRisk-owned rows vanish from the view even if still high priority.
- **Impact:** False work queue — analysts chase already-owned remediations; real unowned exposure mixed with false unowned. Handoff views lie.
- **Recommendation:** Unowned = `priorityScore >= 70` and no remediation owner (`!finding.ownerId && !finding.ownerDisplay` or no open related remediation). Surface owner/SLA chips on the row from projected fields. Align product-help “Priority · unowned” copy.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P18-4 | P1 | improvement | findings | Badge soup on every row — five concurrent state languages
- **Persona:** Tier-1 SOC Analyst
- **Evidence:** Collapsed row badges: exploitability + severity + validationState + status + optional disposition (`findings-workbench-v2.tsx` ~774–804). Separate from priority mono line.
- **Problem:** Severity, exploitability, validation state, workflow status, and disposition are all valid, but five pills compete for glance triage.
- **Impact:** Slow scan rate; mobile hides strip until expand (~855–871) so phone triage is worse; cognitive load before reading title.
- **Recommendation:** Collapsed: severity + one “proof” chip (validation/exploit condensed) + disposition if set. Move full strip to expand. Make severity distribution chips **clickable filters** (today they are non-interactive spans ~363–378).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-15 (severity map inconsistency theme; here density)

### FINDING | P18-5 | P1 | improvement | findings | Client-only filter over full listFindings(); title-only search; API filter unused
- **Persona:** Tier-1 SOC Analyst (scale / MSSP)
- **Evidence:** Workbench: `api.listFindings()` with no query (`findings-workbench-v2.tsx` ~98); client filter title-only (~157). API client supports `severity`, `status`, `disposition`, `search`, `limit`, `offset`, etc. (`periscan-api-client.ts` ~4614–4629). Server `filterValidatedFindings` searches `title + impact + remediation` (`runtime-services.ts` ~7791–7798).
- **Problem:** Large tenants download full derived set; search misses impact/remediation text that API already supports.
- **Impact:** Latency, memory, incomplete hunt (“I know the CVE text was in impact”). Pagination is cosmetic over full pull.
- **Recommendation:** Pass active filters to `listFindings`; expand search to match API; document limit/offset in UI; consider cursor when volume grows.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-6 | P1 | feature | findings | No mandatory FP/Suppress reason taxonomy; InfoPopover mentions “duplicate” without Duplicate disposition
- **Persona:** Tier-2 SOC Analyst / QA of triage quality
- **Evidence:** Dispositions enum: Acknowledged, Escalated, AcceptedRisk, FalsePositive, Suppressed only (`findings-workbench-v2.tsx` ~77–83). Note is optional (`note.trim() || undefined` ~1192). InfoPopover: “escalated, **duplicate**, or accepted risk” (~1240–1242) but no Duplicate value. Bulk note also optional (~275).
- **Problem:** FP audit trail depends on free-text discipline; “duplicate” language without a disposition or fingerprint link confuses playbooks.
- **Impact:** Weak metrics on why noise was closed; no feedback loop to modules/connectors; inconsistent shift quality.
- **Recommendation:** Require note or reason code for FalsePositive/Suppressed (OutOfScope, DuplicateObservation, Benign, Lab, ToolNoise, Other). Prefer fingerprint-linked “same root cause” over a Duplicate enum if grouping is authoritative. Align InfoPopover copy with enum.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-7 | P1 | improvement | findings | Bulk triage is disposition-only; no bulk rem route / hide-until / select-filtered-all
- **Persona:** Tier-1 SOC Analyst
- **Evidence:** Sticky bulk bar applies only `transitionFinding` disposition fields (~255–279). Select toggles **visible page** only (~243–252). No bulk create remediation, bulk acknowledge-threat equivalent, no “select all N filtered.”
- **Problem:** Storm of similar noise: page-by-page select + disposition only. Escalation storms need rem ownership not just Escalated flag (Escalated has no forced assignee).
- **Impact:** Incomplete Tier-1 velocity for real alert storms; Escalated becomes a dead-letter state without owner.
- **Recommendation:** Select-all-filtered (with cap + confirm); bulk Escalated → optional owner note; bulk “Active hide” as disposition FP/Suppress with reason; keep AcceptedRisk dual-control fields as today.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-8 | P1 | bug | evidence | ENTITY_ROUTE missing Finding (and signal); reverse pivot from ledger is text-only
- **Persona:** Tier-2 investigator
- **Evidence:** `ENTITY_ROUTE` maps AttackPath, RemediationTask, EvidencePack, ValidationMission, AIApplication, ControlSource, ThreatAdvisory, Runner, RunnerTask, Integration, ThirdPartyTool — **no Finding** (`evidence-ledger.tsx` ~40–52). Findings deep-link **to** ledger via `?evidenceId=` works (`app/evidence/page.tsx`, chips ~994–1001).
- **Problem:** When an artifact’s `relatedEntityType` is finding-like, operator cannot jump to the findings queue filtered to that id.
- **Impact:** One-way investigation spine; IR case notes stuck on hash-only identity.
- **Recommendation:** Map `Finding` → `/findings?q=` or future `/findings?findingId=`; expand finding when API supports get-by-id deep link. Add signal envelope route if used as related type.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-9 | P1 | bug | evidence | Threat Center evidence chips are non-clickable full UUIDs
- **Persona:** Tier-2 investigator
- **Evidence:** `EvidenceChips` renders `<span>` with raw `evidenceId`, no `Link` (`threat-center-workbench.tsx` ~105–121). Findings workbench uses `href=/evidence?evidenceId=…` with short `ev·` labels.
- **Problem:** Same product, two evidence UX standards; threat advisory investigation dead-ends on opaque IDs.
- **Impact:** Extra copy-paste into Evidence search; abandons integrity tools next door.
- **Recommendation:** Reuse findings chip pattern: short id + link to ledger query. Prefer shared `EvidenceIdChip` component.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-23

### FINDING | P18-10 | P1 | feature | other | Threat alert → investigation deep-links missing (scope/finding/path)
- **Persona:** Tier-1 SOC Analyst
- **Evidence:** `TenantThreatAlertSchema` has `matchedValue`, `matchedScopeId`, `matchType`, embedded `item` (`packages/shared/src/threat-intel.ts` ~440–451). Threat feed UI shows matched value as `<code>` only; **no** use of `matchedScopeId`, no link to findings/paths (`threat-feed-workbench.tsx` ~327–331). Actions: Acknowledge / Dismiss / Undo only (~335–372). No bulk ack.
- **Problem:** Correlated intel becomes a dead-end after read; Command Center counts “new alerts” but investigation does not start from the alert.
- **Impact:** Dual-queue fatigue (alerts + findings) without a pivot; dismiss without understanding tenant impact.
- **Recommendation:** Link `matchedScopeId` → Assets/Scope or authorized target; “Search findings for matched value”; if catalog CVE, prefill findings search. Bulk Acknowledge/Dismiss for storms. Explicit empty: “No tenant finding yet.”
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-23

### FINDING | P18-11 | P1 | improvement | nav | Dual threat surfaces + Autonomus/Intel zoo on primary rail
- **Persona:** Tier-1 SOC Analyst (day-1 orientation)
- **Evidence:** Primary nav Intel: Threat Center + Threat Feed + ATT&CK (`primary-nav.tsx` ~516–536). Autonomous group: Swarm, Workflows, Operators, Engagements, MCP (~439–472). Investigate group already has 8 items including AI Apps, NHI, External Validation (~368–418). Legacy `app-navigation.ts` still lists swarm/signal-activity/threat-*.
- **Problem:** Analyst landing path is not “open Active findings”; it is choose among 30+ destinations, two threat products, and AI theater.
- **Impact:** Time-to-first-triage; wrong surface for L1 (Threat Center advisory depth vs Feed alerts). Agrees U-03 / U-16 / U-23.
- **Recommendation:** Persona rail: one **Threat** entry (alerts default). Labs for Swarm/MCP/Workflows. Collapse ATT&CK under help/catalog. Single nav source.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P18-12 | P1 | feature | paths | Attack path detail has no reverse list of citing findings
- **Persona:** Tier-2 investigator
- **Evidence:** Findings detail links `relatedPathIds` → `/attack-paths/{id}` (`findings-workbench-v2.tsx` ~965–977). `attack-path-detail.tsx` has no `listFindings` / related-findings section (grep no matches). Investigation is one-way pathward.
- **Problem:** From a path, analyst cannot see which queue items cite this graph without returning to findings and filtering mentally.
- **Impact:** Broken investigation spine for multi-finding paths; choke-point work disconnected from disposition state.
- **Recommendation:** Path detail panel: “Findings citing this path” via client filter on `relatedPathIds` or API `assetId`/path filter if added. Show disposition + priority.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-13 | P1 | improvement | findings | Remediation meta is count → /remediation list; multi-path create uses only first relatedPathIds[0]
- **Persona:** Tier-2 SOC Analyst
- **Evidence:** Meta remediations: `value={count}` `href="/remediation"` not per-id (`findings-workbench-v2.tsx` ~981–986). Create task: `pathId = finding.relatedPathIds[0]` (~1035–1050). ProofLoop nextAction uses first remediation id only (~847–850).
- **Problem:** Multi-path findings under-disclose rem tasks; routing always binds first path even if second is the choke.
- **Impact:** Wrong fix workflow; ticket attached to non-critical path; investigator clicks list and hunts.
- **Recommendation:** List each `relatedRemediationIds` as links to `/remediation/{id}`. Path picker when `relatedPathIds.length > 1`. Prefer path with highest risk / choke annotation when auto-selecting.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-12 (ticket on rem detail theme; handoff completeness)

### FINDING | P18-14 | P2 | improvement | findings | CSV / SOAR export omits fingerprint, occurrence, root cause, assets
- **Persona:** Tier-1 SOC / automation handoff
- **Evidence:** CSV headers: finding_id, title, severity, priority, status, validation_state, disposition, approval_state, expires_at, evidence_count only (`findings-workbench-v2.tsx` ~298–320).
- **Problem:** Offline review and SOAR ingest cannot join on fingerprint or weight by occurrence.
- **Impact:** Re-implements grouping outside Periscan; loses the main anti-dupe key.
- **Recommendation:** Add fingerprint, occurrence_count, root_cause_summary, first_seen, last_seen, related_path_ids, owner_display, sla_due_at.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P18-15 | P2 | feature | other | No single chronological “investigations / case” feed across findings + threat alerts + risk approvals
- **Persona:** Tier-1 shift lead
- **Evidence:** Command Center `summarizeNeedsYou` buckets counts by type (`dashboard-command-center.tsx` ~84–108); queue items deep-link to separate routes. No unified timeline of analyst actions (disposition changes, alert ack, rem verify) on one SOC “shift log.”
- **Problem:** Handoff is multi-surface: Findings + Threat Feed + Remediation + risk governance strip.
- **Impact:** Missed aging items; no single “what happened on night shift” story.
- **Recommendation:** Needs-you expandable list with mixed work types sorted by urgency (Critical finding > Pending risk > New alert), each with deep link. Longer-term: investigation timeline from audit events (`finding.disposition_changed`, threat alert status).
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-23

### FINDING | P18-16 | P2 | feature | findings | No snooze / revisit for Suppressed; only AcceptedRisk has expiry governance
- **Persona:** Tier-2 SOC Analyst
- **Evidence:** Expiry + approval only in AcceptedRisk UI branches (`findings-workbench-v2.tsx` ~561–586, ~1188–1193, ~1254+). Suppressed is permanent until Clear.
- **Problem:** Temporary lab noise or change-window suppress has no auto-reopen.
- **Impact:** Forgotten suppressions hide real regressions after window ends; or analysts refuse Suppress and leave noise active.
- **Recommendation:** Optional `revisitAt` for Suppressed (lighter than dual-control risk accept); expire → disposition clear + status signal Reopened/NeedsReview narrative without claiming Fixed.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-17 | P2 | improvement | findings | Signal-sourced titles remain terse; weak ticket titles without expand
- **Persona:** Tier-1 SOC Analyst
- **Evidence:** Row shows `finding.title` truncate only (~767). Server builds signal titles from category/subcategory patterns in `buildValidatedFindings` (signal branch in `runtime-services.ts`). Expanded impact/remediation exist but not in collapsed row or CSV-first workflows.
- **Problem:** Queue scan reads “BAS …” style labels without asset or root-cause line.
- **Impact:** Wrong bulk select; weak paste into chat/tickets before expand.
- **Recommendation:** Secondary line: rootCauseSummary or first related asset + occurrence. Prefer title enrichment at build time when assets known.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-18 | P2 | innovation | findings | Disposition and module feedback loop absent — FP never trains “don’t raise again”
- **Persona:** Tier-2 SOC / detection eng hybrid
- **Evidence:** `transitionFinding` persists analyst overlay + audit (services/findings.ts); no UI/API path from FalsePositive to connector allowlist, module suppress rule, or fingerprint mute. Grouping reuses fingerprint but disposition overlay is per findingId lifecycle of derived set.
- **Problem:** Same root cause can reappear as “new” operational noise after rebuild if overlay keys don’t survive identity; no “mute this fingerprint for 30d” control.
- **Impact:** Repeat fatigue; detection eng cannot close the loop from SOC disposition.
- **Recommendation:** Persist disposition by **fingerprint** (with care — comments in runtime-services warn not to re-key casually ~7812–7813). Add “Mute fingerprint until…” for Suppressed. Export FP reasons for module owners. Do not auto-upgrade claims.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-11

### FINDING | P18-19 | P2 | improvement | performance | Non-streaming polls (45s findings / 60s dashboard & threat) without “new since last visit” markers
- **Persona:** Tier-1 SOC Analyst
- **Evidence:** Findings `refetchIntervalMs: 45_000` (`findings-workbench-v2.tsx` ~98–99). Dashboard/threat live ~60s (`dashboard-command-center.tsx` ~112; threat-feed visibility refresh). LiveUpdatePill shows freshness only.
- **Problem:** Acceptable for CTEM validation ops; weak for “something just fired” shift muscle memory. No delta highlight for new rows since last poll.
- **Impact:** Missed mid-shift arrivals unless staring at counts; not a SIEM replacement (product is honest — reinforce that).
- **Recommendation:** Keep non-streaming honesty in copy; add “N new since HH:MM” chip when findingIds appear; optional focus mode sort by lastSeenAt when occurrence fields are visible.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P18-20 | P3 | request | other | World catalog actions: search findings by CVE / copy IOC / open advisory
- **Persona:** Tier-2 hunter (secondary job)
- **Evidence:** Catalog section: search, kind, severity, KEV, page 25 (`threat-feed-workbench.tsx` filters ~94–98, sections later in file). Rows informational; no “create mission,” no findings search deep-link, no IOC copy helper.
- **Problem:** Hunting from world intel requires manual multi-app pivots.
- **Impact:** Threat feed underused for proactive validation; pressure to open Threat Center instead (zoo).
- **Recommendation:** Per catalog row: Copy ID/CVE, “Search findings,” “Open in Threat Center” if advisory exists, optional “Request validation mission” gated by policy.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-23

---

## Alert fatigue — synthesis (this pass)

| Reduces fatigue | Reintroduces fatigue |
| --------------- | -------------------- |
| Derived findings, not raw tools | Grouping metadata hidden (P18-1) |
| Priority score + factors | FP/Suppress stay in All (P18-2) |
| Saved views + URL handoff | Unowned view wrong owner field (P18-3) |
| Tenant-scoped threat alerts | Alert without tenant pivot (P18-10) |
| Bulk disposition sticky bar | No Active default; badge soup (P18-4) |
| CC needs-you buckets | Dual threat + AI rail (P18-11) |

---

## Investigation spine (happy path vs gaps)

```
Command Center (needs-you)
  ├─ Findings [?view=new-untriaged] ── expand
  │     ├─ Path proof + path· links ──► Attack path detail
  │     │                                  ├─ hop receipts / measure
  │     │                                  ├─ evidence ledger links
  │     │                                  └─ ✗ no reverse findings (P18-12)
  │     ├─ ev· chips ──► /evidence?evidenceId=  (works)
  │     └─ remediation open/create (first path only — P18-13)
  ├─ Threat feed alerts ── Ack/Dismiss
  │     └─ ✗ weak tenant pivot (P18-10)
  └─ Threat center advisories
        └─ evidence chips ✗ not linked (P18-9)
Evidence ledger ── entity pivot
  └─ ✗ Finding type missing (P18-8)
```

---

## Disposition model — SOC scorecard

| Criterion | Status |
| --------- | ------ |
| FP without claiming Fixed | Pass |
| Audited change | Pass (service audit) |
| Reversible Clear | Pass |
| Suppress | Pass (no auto-hide) |
| AcceptedRisk dual-control + expiry | Pass |
| FP reason taxonomy | Missing (P18-6) |
| Active queue excludes noise | Missing (P18-2) |
| Fingerprint mute / module feedback | Missing (P18-18) |
| Duplicate disposition | Missing (copy-only) |
| Escalated forced owner | Missing |

---

## Scoring (exhaustive rubric)

| Dimension | Score | Notes |
| --------- | ----: | ----- |
| Alert fatigue design | 3.0 | Architecture strong; operator defaults weak |
| Finding quality / transparency | 4.4 | Expand row excellent; collapsed incomplete |
| Triage speed (Tier-1) | 3.8 | Bulk/views good; Active/unowned bugs hurt |
| Investigation pivots | 3.5 | Path/evidence out strong; reverse + threat weak |
| FP / exception handling | 3.7 | Model strong; ops defaults + taxonomy weak |
| External threat correlation | 3.2 | Alerts good; actionability poor; dual surface |
| Evidence integrity for case work | 4.5 | Chain/hash/redact — protect |
| Feature-zoo tax on analyst day | 2.5 | Primary rail fights the job |
| Overall SOC fit | **3.6** | Validated-exposure triage; not shift SIEM |

---

## Suggested acceptance tests (SOC)

1. Multi-occurrence same fingerprint → UI shows count ≥ 2 and shared rootCauseSummary.  
2. Mark FalsePositive → disappears from default Active view; still in All + CSV.  
3. Finding with remediation owner + priority ≥ 70 → **not** in Priority · unowned.  
4. Evidence chip from findings and threat-center both land ledger on matching evidenceId.  
5. Threat alert with matchedScopeId exposes link to scope/assets.  
6. Path detail lists ≥1 finding when findings.relatedPathIds contains path.  
7. Bulk FP requires reason code or min note length.  
8. CSV includes fingerprint and occurrence_count.

---

## Do-not-regress (SOC-critical)

- Disposition must never set Fixed / rewrite validation evidence.  
- Grouping must never upgrade exploitability / validationState / evidenceBasis.  
- Raw scanner output stays out of primary findings UX.  
- Denied tasks never queue; rem Fixed only via verification event.  
- Real-first: no fixture “demo alerts” in tenant product views.  
- Threat feed must not become an unscoped world-CVE wall in needs-you.

---

## Dissent / agreement with previous panel

| Theme | Stance |
| ----- | ------ |
| U-11 occurrence/fingerprint UI | **Agree strongly** — reconfirmed still absent in v2 workbench; elevate to P0 for SOC |
| U-23 threat fragmentation | **Agree** — split Feed/Center + dead evidence chips |
| U-16 AI/swarm on primary rail | **Agree** — pure fatigue for L1/L2 day |
| Wave A #8 Active + occurrence | **Agree** — still the highest ROI SOC pair |
| Prior ~4.0 score as triage queue | **Dissent slightly downward (3.6)** — unowned view bug + Active default + hidden occurrence mean not shift-ready without those fixes |
| “Not a SIEM” (Blue panel) | **Agree** — do not build streaming alert wall; build inevitable validated-exposure queue |

---

## Bottom line

As a Tier-1/2 SOC analyst I **trust Periscan’s honesty** (disposition ≠ Fixed, derived findings, path proof, evidence integrity) more than most scanners. I would **not yet trust it as my primary shift queue** until:

1. occurrence/root-cause are visible,  
2. Active excludes FP/suppress by default,  
3. Priority · unowned uses real owners,  
4. threat alerts and evidence chips complete the investigation spine,  
5. the rail stops advertising swarm theater next to Findings.

Close P18-1…P18-3 and the spine gaps (P18-8…P18-12), and this product becomes a best-in-class **validated exposure triage console** for CTEM — still complementing, not replacing, SIEM/XDR.

---

## Sources reviewed

| Path | Role |
| ---- | ---- |
| `apps/web/src/components/findings-workbench-v2.tsx` | Queue, bulk, disposition, pivots |
| `apps/web/src/components/evidence-ledger.tsx` | ENTITY_ROUTE, verify, deep-link |
| `apps/web/src/components/threat-feed-workbench.tsx` | Alerts, catalog, feeds |
| `apps/web/src/components/threat-center-workbench.tsx` | EvidenceChips |
| `apps/web/src/components/dashboard-command-center.tsx` | needs-you |
| `apps/web/src/lib/primary-nav.tsx` | Rail zoo |
| `apps/web/src/lib/periscan-api-client.ts` | listFindings query params |
| `packages/shared/src/domain.ts` | ValidatedFinding + filters |
| `packages/shared/src/threat-intel.ts` | TenantThreatAlert |
| `packages/evidence/src/finding-fingerprint.ts` | Grouping |
| `apps/api/src/runtime-services.ts` | build + filter findings |
| `apps/api/src/services/findings.ts` | list/transition |
| `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` | U-themes |
| `docs/qa/panel-audit-2026-07-29/18-soc-analyst.md` | Prior SOC pass |

*End of exhaustive SOC analyst panel — P18 — 2026-07-29.*
