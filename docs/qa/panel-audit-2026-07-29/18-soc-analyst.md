# Panel audit — Tier-1/2 SOC Analyst

**Date:** 2026-07-29  
**Persona:** Tier-1 / Tier-2 SOC analyst (triage, investigation, false-positive handling)  
**Mode:** Source-level review of product surfaces (no live browser session in this pass)  
**Primary surfaces:** `/findings`, `/evidence`, `/attack-paths` + `/attack-paths/[id]`, `/threat-feed`, with pivots to Command Center, `/threat-center`, `/remediation`, `/signal-activity`  
**Repo anchors:** `apps/web/src/components/findings-workbench-v2.tsx`, `evidence-ledger.tsx`, `attack-path-detail.tsx`, `threat-feed-workbench.tsx`, `dashboard-command-center.tsx`; `apps/api/src/runtime-services.ts` (`buildValidatedFindings`); `packages/evidence/src/finding-fingerprint.ts`; `packages/shared/src/domain.ts` disposition contracts  

---

## Executive summary (SOC lens)

Periscan is **not a classic SIEM alert wall**. For a Tier-1/2 analyst it behaves as a **validated-results queue**: findings are derived from attack paths and signal envelopes, ranked by priority score, and layered with human dispositions that **cannot mark Fixed**. That design is the right anti–alert-fatigue foundation for a CTEM / continuous-validation product.

Where the product is strong for SOC work:

- **Triage vocabulary is honest** — validation state, exploitability, evidence basis, and disposition are separated; UI copy explicitly says disposition never proves Fixed.
- **Investigation pivots exist** — finding → path · evidence ID · remediation; path detail → hop receipts · evidence ledger · measure hop (safe).
- **False-positive / suppress / accept-risk are first-class** with notes, audit on disposition change, and dual-control for AcceptedRisk.
- **Threat feed** scopes “your alerts” to tenant correlation (scope/CVE match) rather than dumping the full world catalog into the needs-you queue.

Where fatigue and investigation friction remain:

1. **Backend grouping metadata is invisible in the findings UI** (`fingerprint`, `occurrenceCount`, `rootCauseSummary`, first/last seen) — analysts cannot tell “same root cause, N observations” from the queue row.
2. **Client-side only filters on a full `listFindings()` pull** — no server-side pagination for large tenants; title-only search; severity chips are counts, not one-click “Critical only” shortcuts beyond the dropdown.
3. **FalsePositive / Suppressed items stay in the default priority-sorted queue** unless the analyst filters disposition — easy to re-triage noise.
4. **Evidence deep-links work by query string**, but evidence rows do not map a `Finding` entity type to `/findings`, and threat-center evidence chips are non-clickable IDs.
5. **Threat catalog items are mostly informational** — limited action path from a world CVE/IOC into a finding, path, or mission without going through correlated tenant alerts.

**Persona fit score (source review):** **B+ / strong partial** for evidence-native triage; not yet an SIEM-grade alert ops console (and should not pretend to be).

---

## Persona jobs-to-be-done

| JTBD | What “good” looks like | Periscan status |
| ---- | ---------------------- | --------------- |
| **Reduce alert fatigue** | High-signal queue; noise suppressible; duplicates collapsed; urgency ranked | Strong signal derivation + fingerprint grouping **server-side**; UI under-exposes grouping; FP/suppress do not de-rank by default |
| **Triage fast (Tier-1)** | Saved views, bulk actions, clear next step, copyable queue links | Saved views, URL sync, bulk disposition, CSV export, 25/page — good |
| **Judge finding quality (Tier-2)** | Why priority, path proof, evidence, missing signals, claim honesty | Expanded row covers priority reason, factors, path proof, evidence links, missing-signal callout |
| **Investigate to evidence / path** | One or two clicks to artifact + graph hop | Finding → path & `ev·` links; path detail → ledger + receipts |
| **Handle FP / accept risk** | Reversible, audited, not confused with Fixed | Disposition model + AcceptedRisk dual-control + governance strip |
| **Watch external threat pressure** | Tenant-relevant alerts, KEV filter, feed health | Threat-feed alerts + catalog + feed status; Command Center queues new alerts |

---

## Surface walkthrough

### 1. Command Center → work queue (`dashboard-command-center.tsx`)

**Analyst value**

- `summarizeNeedsYou` rolls up: New unddispositioned findings, Pending risk approvals, New threat alerts, remediations in `VerificationPending`.
- Fallback queue items deep-link to `/findings`, `/threat-feed`, `/remediation?status=VerificationPending`.
- Change lens links include `?status=New`, `?view=reopened`, and a “missing signal” query hook.

**Fatigue notes**

- Queue is **work-typed**, not a flood of individual CVEs — good for SOC shift handoff.
- Urgency labels (`Now` / `Soon`) are useful but not severity-weighted across mixed work types; a single Critical finding and a risk-approval share the same queue grammar.

**Gaps**

- Threat alerts and findings are separate buckets; no single chronological “investigations feed.”
- Local fallback when work-queue API fails is honest but may under/over count vs server program queue.

---

### 2. Validated Results / Findings (`/findings` → `findings-workbench-v2.tsx`)

#### Queue design (alert fatigue)

| Control | Behavior | SOC assessment |
| ------- | -------- | -------------- |
| Priority sort | `priorityScore` desc | Correct default for triage |
| Live refresh | 45s poll + `LiveUpdatePill` | Adequate for non-streaming ops; not real-time SOC |
| Severity distribution | Counts with badges | Situational awareness; not interactive filters |
| Saved views | All · Priority unowned (≥70, no owner) · New untriaged · Reopened | Matches help copy and handoff links |
| URL state | `view`, `q`, `severity`, `status`, `disposition` + Copy view link | Excellent for shift notes / ticket paste |
| Pagination | 25 rows client-side | Fine for lab; risk at scale with full list load |
| Bulk select | Page-level select + sticky bulk disposition | Tier-1 speed win |
| Export CSV | Filtered set with evidence_count, disposition, expiry | Good for offline review / SOAR export |

**Server-side quality that fights fatigue** (`buildValidatedFindings` + `finding-fingerprint.ts`):

- Findings derived from paths + signals (not raw scanner dumps).
- Path-primary absorb of contributing signals.
- Fingerprint grouping so repeated observations become occurrences.
- Claim language never upgraded by grouping.
- Disposition **cannot** set Fixed (schema + UI copy + service design).

**UI gap (high impact):**  
`fingerprint`, `occurrenceCount`, `rootCauseSummary`, `firstSeenAt`, `lastSeenAt` are on the DTO / build path but **not rendered** in `findings-workbench-v2`. An analyst cannot see “seen 12×” or root-cause grouping without API inspection. That undercuts the main anti-dupe investment for the human operator.

#### Finding quality (what Tier-2 reads in the expanded row)

When expanded, a row surfaces:

- **Proof loop context** (stage Understand/Act, evidence count, freshness, next action).
- **Analyst disposition** control with InfoPopover: handling decision ≠ measured Fixed.
- **Fix workflow** — create remediation from linked path (owner + SLA) or open existing task.
- **Impact / remediation** narrative text.
- **Why this priority** — exploitability, control effectiveness, path context, business context.
- **Scoring factors** via `RiskFactorBreakdown` + formula string.
- **Path proof** — entry → objective, intermediate steps, blast radius, choke points, objective state (Unknown when not fully measured — honest).
- **Missing signal impact** callout with link to `/integrations`.
- **Attack path links** (`/attack-paths/{id}`), remediation count, **evidence chips** → `/evidence?evidenceId=…`.

**Quality strengths**

- Exploitability and validation state badges separate from severity.
- In-network flag shown in row meta when runner-measured.
- Priority reasons distinguish fully measured vs incomplete hop measurement (path findings).
- Empty state points to run a Validation Snapshot — not sample data.

**Quality / clarity frictions**

- Signal-sourced titles like `BAS <subcategory>` are terse; weak for ticket titles without expansion.
- Search is **title-only** in the client filter (`f.title`), while API `filterValidatedFindings` can search title+impact+remediation — UI underuses API search richness (and still loads all findings).
- Mobile hides badge strip until expand — OK, but severity/status less glanceable on small screens.
- Remediation create takes **first** `relatedPathIds[0]` only when multiple paths exist.
- No explicit “duplicate of …” / related-group members UI despite grouping.

#### False positive & disposition handling

| Disposition | Analyst effect | Governance |
| ----------- | -------------- | ---------- |
| Acknowledged | Recorded handling | Note optional; audited |
| Escalated | Recorded handling | Note optional; audited |
| FalsePositive | Marked FP | Note optional; **does not auto-hide from All** |
| Suppressed | Marked suppressed | Same; tone `blocked` in UI |
| AcceptedRisk | Exception with owner + expiry | Pending until **different** tenant member approves; Expired reopens triage narrative |

**SOC strengths**

- Explicit dual-control for risk acceptance; self-approver blocked in UI messaging.
- Risk-acceptance governance panel lists Pending / Approved / Expired counts and five soonest expiries.
- Clear / reverse disposition supported (`disposition: null`).
- Bulk AcceptedRisk enforces owner + expiry.
- Role gate on API: disposition changes require editor-capable role (`transitionFinding`).

**SOC gaps**

- No dedicated “hide FP/Suppressed from active queue” default view (analysts must filter disposition ≠ those values or use New · untriaged).
- No SLA / snooze on FalsePositive (only AcceptedRisk has expiry).
- No mandatory note for FP (quality of audit trail depends on analyst discipline).
- Disposition owner is only enforced for AcceptedRisk — Escalated has no forced assignee in the disposition model (remediation route is separate).
- InfoPopover mentions “duplicate” in prose, but there is no `Duplicate` disposition enum.

#### Triage speed checklist (Tier-1 shift)

| Step | Support |
| ---- | ------- |
| Land on untriaged | View **New · untriaged** or CC link |
| Rank | Priority score default sort |
| Decide | Expand → disposition Save |
| Bulk noise | Select page → bulk FP/Suppress |
| Escalate to fix | Route to remediation / Escalated |
| Share queue | Copy view link |
| Offline | Export CSV |

**Verdict:** Tier-1 can clear a moderate queue efficiently. Scale and reappearance of FP/Suppressed in “All” are the main fatigue risks.

---

### 3. Attack path list & detail (`/attack-paths`, `attack-path-detail.tsx`)

#### List workbench

- Sort by risk score; filter validation state and evidence basis; search by name.
- Financial exposure rollup when assumptions exist — useful for prioritization context, clearly assumption-based.
- Choke-point optimizer entry for “break many paths at once” (Tier-2 / purple-team adjacent).

#### Detail (investigation backbone)

**Honest measurement model (excellent for SOC credibility):**

- Path Measured only when **every hop** has independent measured evidence; launch alone never upgrades.
- Hop eligibility: Eligible, NeedsApproval, AlreadyMeasured, NeedsScope/Runner/Integration, NoSafeModule — with blocked hints and deep-links.
- `Measure hop (safe)` creates policy decision + approval-required mission; UI states it does not mark Measured.
- Weakest-edge certainty summary + plan status badges.
- Edge receipts timeline and path-scoped evidence list with ledger links.
- Path breakers prioritized (P1…); risk factor breakdown; export JSON for case notes.
- Financial exposure panel labeled assumption-based; refuses invented dollars when missing.

**Investigation pivots**

| From | To |
| ---- | -- |
| Finding path· link | Path detail |
| Path evidence `ev·` | `/evidence?evidenceId=` |
| Panel header | Full Evidence ledger |
| Validate this path | Mission approval flow |
| Blocked hop | Scope / runners / integrations |

**Gaps for SOC**

- Interactive “attack replay” language in product help is richer than a pure hop-list UI; hop cards are plan-centric, not a time-sequenced detection story for blue-team storytelling.
- No inline finding list on path detail (“which findings cite this path”) — analyst must remember reverse pivot.
- `/scopes` is referenced for NeedScope; confirm route availability in deployed nav (help and hop hints assume it).
- Graph height fixed (~300px); large paths may need export/JSON for full review.

---

### 4. Evidence ledger (`/evidence` → `evidence-ledger.tsx`)

**SOC value**

- Tenant evidence artifacts: type, sensitivity, redaction, related entity, SHA-256, relative time.
- **Verify chain** for hash-linked integrity; per-artifact Verify integrity; Download with integrity pass/fail messaging (fail is loud, does not silently drop content).
- Redact with confirm-phrase (destructive, irreversible) — correct for sensitive case data handling.
- Deep-link: page accepts `?evidenceId=` as `initialQuery` so finding/path chips land on a pre-filtered ledger.

**Entity pivot map**

```
AttackPath → /attack-paths/{id}
RemediationTask → /remediation
EvidencePack → /reports
ValidationMission → /missions
ThreatAdvisory → /threat-center
… (+ runners, integrations, registries, AI apps, controls)
```

**Gaps**

- **No `Finding` / signal entity route** in `ENTITY_ROUTE` — if an artifact’s `relatedEntityType` is finding/signal-like and not in the map, pivot is text-only.
- Search is client-side over full `listEvidence()` — same scale caveat as findings.
- No preview of normalized content in-row (download-first investigation).
- No “cited by findings” reverse index on the ledger.

**Integrity culture:** Pass/fail chain language and legacy unchained honesty are Tier-2 / IR-friendly; rare in commercial scanners.

---

### 5. Threat feed (`/threat-feed` → `threat-feed-workbench.tsx`)

**Intent (page copy):** Public intel catalog, deduped, polled by source cadence; workspace refresh ~60s while visible; **not** a streaming SIEM.

| Section | Behavior | SOC assessment |
| ------- | -------- | -------------- |
| Your threat alerts | Tenant-correlated matches; severity; match type; Acknowledge / Dismiss / Undo | Primary fatigue control — only correlated noise |
| Feed sources | Status (`ok*`, `skipped_no_key`, `error`), cadence, key link to `/admin` | Ops health for intel pipeline |
| Latest world threats | Search, kind, severity, **KEV only**, page 25 | Research / hunting, not auto-queue |

**Strengths**

- Open-alert count badge; muted non-New rows.
- Double-click guard on alert mutation; errors do not silent-refetch success.
- KEV filter for prioritization against CISA KEV-style pressure.
- Honest empty: “No world threats currently correlate to your verified scope…”

**Gaps (investigation)**

- Catalog rows: no deep-link to CVE detail page, tenant findings, or “create mission.”
- Alerts show matched value but not a one-click jump to the affected asset/finding.
- No bulk acknowledge/dismiss for alert storms.
- Threat Center is separate (`/threat-center`) with advisories, virtual analyst, and non-clickable evidence chips — dual “threat” surfaces can confuse Tier-1 onboarding (“which one is my queue?”).

---

### 6. Adjacent surfaces (brief)

| Surface | SOC relevance |
| ------- | ------------- |
| `/threat-center` | Advisory validation / pillar workflows; heavier than feed; evidence chips not ledger-linked |
| `/remediation` | Post-triage ownership and verify; Fixed requires measured revalidation |
| `/signal-activity` | Trigger approvals / activity — more ops than classic SOC alert triage |
| `/missions` | Approval-gated validation execution after path/findings decisions |
| Product help (`product-help.ts` “Triage a finding”) | Aligns with UI: Priority · unowned, New · untriaged, path proof, evidence before disposition |

---

## Alert fatigue — synthesis

**What reduces fatigue**

1. Validated/derived findings instead of raw tool spam in primary UX.  
2. Fingerprint + path-primary absorb (server).  
3. Priority scoring with transparent factors.  
4. Saved views for untriaged / reopened / unowned priority.  
5. Tenant-scoped threat alerts, not full catalog as alerts.  
6. Disposition + suppress/FP vocabulary without rewriting evidence.  
7. Command Center needs-you aggregation.

**What reintroduces fatigue**

1. Grouped occurrences not visible → looks like N distinct risks when collapsed identity is opaque, or conversely opacity when count matters.  
2. FP/Suppressed remain in default All sort.  
3. Full-list client filtering at volume.  
4. Terse signal titles.  
5. Split threat surfaces without a single “my open investigations” timeline.  
6. Bulk disposition without bulk “hide from active queue until re-open.”  

---

## Investigation pivot map (happy path)

```
Command Center (New findings / Risk approvals / Threat alerts)
        │
        ├─► /findings?view=new-untriaged
        │         │ expand row
        │         ├─► Why priority + scoring factors
        │         ├─► Path proof
        │         ├─► /attack-paths/{pathId}
        │         │         ├─► hop measurement / receipts
        │         │         └─► /evidence?evidenceId=
        │         ├─► /evidence?evidenceId= (chips)
        │         └─► /remediation/{id} or create task
        │
        └─► /threat-feed (Acknowledge / Dismiss)
                  └─► (weak) manual correlation to findings/catalog
```

**Broken / soft links to fix for SOC velocity**

- Catalog threat item → tenant finding/asset.  
- Threat alert → finding/path/asset deep-link.  
- Evidence related entity type Finding → `/findings` (filter or expand).  
- Path detail → related findings list.  
- Threat-center evidence chips → ledger.

---

## False-positive handling — verdict

| Criterion | Status |
| --------- | ------ |
| Can mark FP without claiming Fixed | **Pass** |
| Audited disposition change | **Pass** (API audit `finding.disposition_changed`) |
| Reversible | **Pass** (Clear) |
| Suppress path for noise | **Pass** (Suppressed disposition) |
| Exception path with expiry + dual control | **Pass** (AcceptedRisk) |
| FP reason taxonomy / playbook codes | **Missing** (free-text note only) |
| Auto-exclude FP from active triage view | **Missing** (manual filter) |
| Feedback loop to modules/connectors (“don’t raise again”) | **Not evident** on these surfaces |
| Duplicate disposition | **Missing** (grouping is implicit fingerprint only) |

---

## Scoring (persona rubric)

Scores are **source-review confidence**, 0–5 (5 = ready for daily SOC shift use on this concern).

| Dimension | Score | Notes |
| --------- | ----: | ----- |
| Alert fatigue design | 3.5 | Solid architecture; UI hides grouping; FP stay in All |
| Finding quality / transparency | 4.5 | Priority reason, factors, path proof, claim honesty |
| Triage speed (Tier-1) | 4.0 | Views, bulk, URL, CSV; title-only search; scale TBD |
| Investigation pivots | 4.0 | Path + evidence strong; threat/catalog weak |
| False-positive / exception handling | 4.0 | Model strong; operational defaults weaker |
| External threat correlation | 3.5 | Alerts good; catalog actionability weak |
| Evidence integrity for case work | 4.5 | Chain + hash verify + redaction |
| Overall SOC analyst fit | **4.0** | Best as “validated exposure triage,” not SIEM L1 |

---

## Priority recommendations (SOC-shaped)

### P0 — high leverage, product-aligned

1. **Surface grouping in the findings queue**  
   Show `occurrenceCount`, first/last seen, and a short `rootCauseSummary` (or groupKey) on the row and expanded detail. Optional “N related observations” expander. Do **not** invent claim language.

2. **Active queue default excludes FP + Suppressed**  
   Either change “All” semantics for triage to “Open / active handling” or add a first-class **Active** saved view that is the default landing from Command Center and help.

3. **Threat alert → investigation deep-links**  
   From each tenant threat alert, link matched asset/finding/path when correlation data exists; otherwise explicit “no tenant finding yet.”

### P1 — triage quality of life

4. **Mandatory or strongly prompted note for FalsePositive / Suppressed** (min length or reason codes: OutOfScope, DuplicateTool, Benign, Lab, etc.).  
5. **Server-backed list filters / pagination** for findings and evidence (use existing `filterValidatedFindings` query params from the client).  
6. **Expand client search** to impact + remediation (match API) and optional CVE/tag fields when present.  
7. **Evidence `ENTITY_ROUTE` for Finding** (and signal if used) + make threat-center evidence chips links.  
8. **Path detail: related findings** list reverse-pivot.

### P2 — maturity

9. Bulk acknowledge/dismiss on threat alerts.  
10. Catalog item actions: “Search findings for this CVE,” “Open threat center advisory,” copy IOC.  
11. Snooze / revisit date for Suppressed (lighter than AcceptedRisk governance).  
12. Show fingerprint id (short) for support/debug without cluttering primary title.

---

## Test / acceptance hooks already nearby

- E2E: `tests/e2e/critical-journey-ui.spec.ts` — signup → measured finding → disposition.  
- API: disposition transition, AcceptedRisk owner/expiry, approve-risk dual control in services/tests.  
- Grouping: `runtime-services.test.ts` fingerprint / absorb cases; `finding-fingerprint.test.ts`.  
- Web: `findings-workbench-v2.test.tsx`, `evidence-ledger.test.tsx`, `attack-path-detail.test.tsx`, `threat-feed-workbench.test.tsx`.

Suggested SOC-focused acceptance cases to add:

1. Grouped multi-occurrence finding shows count ≥ 2 in UI after two fingerprint-equivalent signals.  
2. FalsePositive does not appear in default Active queue but remains filterable and exportable.  
3. Evidence chip from finding lands ledger with matching `evidenceId` visible without manual paste.  
4. Threat alert Acknowledge clears Command Center open-alert count on next refresh.  
5. AcceptedRisk cannot be approved by the same user who requested it.

---

## Do-not-regress (SOC-critical product rules)

- Disposition must never set Fixed / must never rewrite validation evidence.  
- Launch hop / verify path must not claim Measured without receipts + evidence IDs.  
- Grouping must never upgrade exploitability / validationState / evidenceBasis.  
- Raw scanner output stays out of primary findings UX.  
- Denied tasks must never queue; risk Fixed only via verification event (remediation path).  
- Real-first: empty and not-configured states over fixture “demo alerts” in tenant product views.

---

## Bottom line for the panel

As a Tier-1/2 SOC analyst, I would **trust Periscan to prioritize and explain validated exposure** better than a traditional findings dump, and I would use **findings → path → evidence → remediation** as my daily investigation spine. I would still burn time on:

- re-seeing suppressed noise in All,  
- not knowing how many times a fingerprint re-fired,  
- and hunting from world threat catalog without a tenant pivot.

Close those three, and the surface set is shift-ready for evidence-native triage. Threat-feed remains a **correlation inbox**, not a replacement for SIEM/XDR real-time ops — which matches product honesty in the page description.

---

## Sources reviewed (non-exhaustive)

| Path | Role |
| ---- | ---- |
| `apps/web/app/findings/page.tsx` | Route → workbench v2 |
| `apps/web/src/components/findings-workbench-v2.tsx` | Queue, disposition, bulk, pivots |
| `apps/web/src/components/evidence-ledger.tsx` | Ledger, verify, entity routes |
| `apps/web/src/components/attack-path-detail.tsx` | Hop measure, receipts, evidence |
| `apps/web/src/components/attack-paths-workbench.tsx` | Path list prioritization |
| `apps/web/src/components/threat-feed-workbench.tsx` | Alerts + catalog + feeds |
| `apps/web/app/threat-feed/page.tsx` | Feed positioning copy |
| `apps/web/src/components/dashboard-command-center.tsx` | Needs-you / queue |
| `apps/web/src/components/threat-center-workbench.tsx` | Adjacent threat surface |
| `apps/api/src/runtime-services.ts` | `buildValidatedFindings`, filters |
| `apps/api/src/services/findings.ts` | list/transition/approve, path evidence |
| `packages/evidence/src/finding-fingerprint.ts` | Dedup / absorb rules |
| `packages/shared/src/domain.ts` | Disposition & ValidatedFinding schema |
| `apps/web/src/lib/product-help.ts` | In-product triage guidance |
| `docs/qa/panel-audit-2026-07-29/SURFACE_INVENTORY.md` | Route inventory snapshot |

*End of SOC analyst panel audit — 2026-07-29.*
