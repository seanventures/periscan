# Panel audit — SOC Blue Team Lead

**Date:** 2026-07-29  
**Persona:** SOC Blue Team Lead (detections, control effectiveness, findings queue, remediations, continuous validation, runner fleet, SIEM/ITSM handoff)  
**Mode:** Read-only code + product-surface audit (no product edits)  
**Git baseline:** see `SURFACE_INVENTORY.md` (beb95c49 family; panel-audit dir WIP)

---

## Executive verdict

Periscan is **not a SIEM and not a ticketing system**. It is a **validation-and-proof control plane** that can sit beside a SOC: pull control telemetry, score detection coverage by ATT&CK technique, queue **validated** results (not raw alerts), force re-test before “Fixed,” and push remediation tickets outward.

**Operational usability today (honest SOC view):**

| Workstream | Usable for real ops? | Grade | One-line |
|---|---|---|---|
| Findings queue (`/findings`) | **Yes — with caveats** | B+ | Real API-backed triage (disposition, bulk, CSV, saved views); not an alert queue; dedup/grouping still weak |
| Detections / control effectiveness (`/controls`) | **Partial** | B− | Telemetry correlation + coverage snapshots are real; **live stimulus→telemetry injection** still gated/partial |
| Signal activity (`/signal-activity`) | **Yes for gated automation** | B | Non-queueing evaluate → approve → draft mission; good safety, not auto-response |
| Threat Center (`/threat-center`) | **Yes for intel→plan** | B | Advisory import / CISA KEV ingest → exposure assess → **plan only, never auto-runs** |
| Schedules (`/schedules`) | **Yes** | B+ | CRUD + blackouts + system sweep (`runDueSchedules`); Continuous / Control / FixVerification mission types |
| Remediations (`/remediation`) | **Yes for closure discipline** | A− | “Fixed” requires verification event; ticket create/sync real for workflow connectors |
| Runners (`/runners`) | **Yes for in-network proof** | B+ | Outbound signed-task poll, kill switch, measured/discover tasks; staleness is UI-derived |
| SIEM integration | **Read / observe, Beta** | B | CrowdStrike/Splunk/etc. have live clients + contract tests; many SIEM mocks stamp technique context only |
| Ticketing / ITSM | **Yes for primary path** | B | Jira default + PSA path via `sendWorkflowEvent`; ServiceNow catalogued live as SOAR/ITSM |
| Webhooks outbound | **Yes** | B | Signed delivery queue; `remediation.created`, `snapshot.ready`, etc. |

**Bottom line for a Blue Team Lead:**  
You can run a **proof-oriented blue loop** (validate → disposition → remediate → re-verify → report) with honest empty states and safety rails. You **cannot** replace Splunk/Sentinel as the detection bus, auto-fire SOAR playbooks on every IOC, or treat the demo seed as production detection proof. Catalog breadth (267 platforms) is marketing surface; **ops depends on the ~126 dedicated live clients**, only a **subset contract-tested**, all still labeled **Beta**, with live vendor smoke manual (`docs/CONNECTOR_LIVE_SMOKE.md` covers a short list).

---

## Day-in-life map (what I open at 08:00)

| SOC intent | Product surface | Primary API |
|---|---|---|
| “What’s actually validated exposure?” | `/findings` (nav: **Exposure**) | `GET/POST /api/v1/findings`, `…/transition`, `…/approve-risk` |
| “Did EDR/SIEM fire on the technique we exercised?” | `/controls` | `GET /api/v1/control-rule-coverage`, control sources, validation stimuli |
| “What signals want a validation draft?” | `/signal-activity` | signal-trigger evaluate / activity / approve |
| “New CVE/advisory — are we exposed?” | `/threat-center`, `/threat-feed` | `/api/v1/threat-advisories*`, feed ingest |
| “Are continuous / control / fix rechecks running?” | `/schedules`, `/validation-ops` | `/api/v1/schedules*`, system scheduler sweep |
| “Close the ticket only if re-proof holds” | `/remediation`, `/remediation/[id]` | remediations CRUD, verify, create-ticket, sync-ticket |
| “Is the in-network agent alive?” | `/runners` | runners fleet, poll, tasks, kill-switch |
| “Where do we push work / pull telemetry?” | `/integrations` | integrations + connector catalog |

Related but secondary for pure blue ops: `/attack-paths`, `/evidence`, `/reports`, `/missions`, `/audit`, `/policies`.

---

## Surface-by-surface assessment

### 1. Findings queue — `/findings` (`findings-workbench-v2.tsx`)

**What it is (product truth):** labeled **Validated Results**, not a raw scanner/alert inbox. Explicit help copy: raw scanner output stays out of this queue.

**Operationally usable**

- Loads real `api.listFindings()` with ~45s poll (`LiveUpdatePill`).
- Filters: severity, status, disposition; **saved views** (`priority-unowned`, `new-untriaged`, `reopened`) with URL persistence + copy link.
- Bulk disposition (Acknowledged / Escalated / AcceptedRisk / FalsePositive / Suppressed) via `transitionFinding`; AcceptedRisk **requires owner + expiry** — correct risk-acceptance hygiene.
- CSV export for filtered set; links into attack paths / remediations / evidence language in the model.
- Priority scoring and validation-state badges (including exploitability / objective states) surface proof vocabulary instead of CVSS-only noise.

**Demo theater / residual risk**

- Historical gap audit still flagged **duplicate operational objects** in demo/report paths (`CORE_PRODUCT_GAP_AUDIT_2026-07-16.md` P0 on findings dedup). Codebase still builds findings from correlation rather than a mature fingerprint→occurrence model operators expect from ServiceNow/VulnMgmt queues.
- Client-side filter/paginate only (PAGE_SIZE 25) — fine for lab/demo tenants; not a multi-tenant SOC volume queue (no server-side search facets, assignment SLA clocks, or shift handoff).
- Disposition is **not** the same as SIEM case management; there is no bi-directional “close Splunk notable when dispositioned.”

**SOC lead call:** **Usable as the validated-work queue** after connectors + validations produce evidence. **Not usable** as the primary alert triage console.

---

### 2. Detections & control effectiveness — `/controls` (`controls-workbench.tsx`)

**What it is:** “Do your controls actually fire?” — expected behavior vs observed ControlObservation signals, per MITRE technique, plus tuning recommendations and control-source registry.

**Operationally usable**

- Coverage summary from `getControlRuleCoverage`: blocked / covered / logged-only / needs-tuning / missed / no-evidence, with history snapshots when persisted.
- Control sources registered from integrations; readiness depends on **verified scope** with BASLite+ ceiling and **active runners**.
- Classifier discipline (documented in analyst matrix): **logged is not auto-promoted to detected**.
- Live path: connectors with `observeControl` (e.g. CrowdStrike technique-filtered detects, Splunk search) used from control-ai / stimuli services; `fixtureOutcome` rejected outside dev/fixture mode.
- Live-smoke runbook exists for real vendor credentials (CrowdStrike, Splunk, SentinelOne, Cortex XDR, Panorama, Tenable) — read-only, verified-scope required.

**Demo theater / residual risk**

- Analyst readiness still marks **control validation injection loop Partial**: dry-run / telemetry query is Met; **authorized live injection** of adversary activity remains policy-gated (`control_live_execution_disabled` class of gates). Blue teams that need “we fired Atomic/BAS and watched Sentinel miss” get a governed partial, not a full BAS product.
- Several SIEM connectors in mock mode only emit **placeholder ControlObservation** with optional technique stamp (`siem-technique-context.test.ts` for Elastic, Datadog SIEM, Chronicle, Sumo, InsightIDR, QRadar, Sentinel) — good for coverage plumbing tests, **not** production detection proof.
- All catalog integrations remain **Beta**; production certification is not claimed.
- Coverage ring can look “green” on demo/fixture observations if operators do not inspect evidence basis and control-source health.

**SOC lead call:** **Usable for control-effectiveness scoring against real telemetry once SIEM/EDR is connected and control validations run.** Treat mockMode and unmeasured “No evidence” honestly. Do not sell this as continuous detection engineering without live observe + scheduled ControlValidation.

---

### 3. Signal activity — `/signal-activity` (`signal-activity-stream.tsx`)

**What it is:** Signal-driven validation **readiness and activity stream**, not an alert stream.

**Operationally usable**

- Evaluates rules against real tenant facts: verified scopes, connected integrations, control sources, runners, signal envelopes, policy audit events.
- Summary metrics: needs approval, requires verified scope / integration / runner, not configured.
- **Approve** creates **policy decision + draft mission only** — explicitly non-queueing auto-execution. Routing destinations can be configured; webhooks/workflow delivery available after approval.
- Clear empty/auth error states.

**Demo theater / residual risk**

- Trigger rules are a fixed product set (`SIGNAL_TRIGGER_RULES`), not customer-authored Sigma-style content.
- Approving a ready trigger is **not** equivalent to auto-containment or SOAR enrichment; SOC playbooks still live elsewhere.
- Activity is derived from evaluation, not a durable high-volume event bus with retention tiers.

**SOC lead call:** **Usable as a governed “what should we validate next?” console.** Not a detection pipeline.

---

### 4. Threat Center — `/threat-center` (`threat-center-workbench-v2.tsx` + `services/threat-center.ts`)

**What it is:** Import/ingest advisory → extract CVE/IoC/TTP → assess exposure against **tenant evidence** → readiness report + **validation plan** (product copy: plan never runs alone).

**Operationally usable**

- Manual import with raw content stored as evidence artifacts (raw + normalized, with explicit warning that indicators are not validation proof).
- CISA KEV-style feed ingest path with idempotent skip of already-imported external IDs.
- Exposure assessment correlates indicators to evidence-backed validation runs.
- Readiness statuses (Ready / MissingSignals / RequiresApproval / NotConfigured) drive next actions (connect integrations, etc.).
- Export readiness report (HTML path present).
- Companion `/threat-feed` for catalog/alerts surfaces.

**Demo theater / residual risk**

- No automatic mission launch on import — correct for safety, slower for “CVE dropped, revalidate in 15 minutes” without an operator + schedule.
- Impact confidence and affected asset counts only as good as prior graph/evidence; empty tenant → honest missing signals, not invented hits.
- Not a full TIP (no bi-directional MISP-style sharing, no automated blocklists to firewall/EDR).

**SOC lead call:** **Usable for threat-informed validation planning.** Pair with schedules/missions for execution.

---

### 5. Schedules — `/schedules` (`schedules-workbench-v2.tsx`)

**What it is:** Recurring mission schedules with frequency, timezone, blackout windows, scope selection.

**Operationally usable**

- Mission types include **ContinuousValidation**, **ControlValidation**, **FixVerification**, ValidationSnapshot, AIAppValidation — the continuous blue program spine.
- Create/list/pause/resume/run-now backed by `/api/v1/schedules*`.
- Platform **system scheduler** ticks due schedules (and fix re-verify / integration sync) — not “hope someone hits run-due.”
- Blackout windows (e.g. weekends / overnight) match change-window culture.

**Demo theater / residual risk**

- Schedule success still depends on policy, verified scope, integrations, and runners; a green schedule with kill-switched runners is theater if ops does not watch runner health.
- No full enterprise calendar integration (ServiceNow change windows) beyond blackouts stored on schedule config.

**SOC lead call:** **Usable for CTEM-style continuous validation** when prerequisites are healthy.

---

### 6. Remediations — `/remediation` + detail (`remediation-workbench.tsx`, `remediation-detail.tsx`)

**What it is:** Fix plans with **proof-gated closure**. Product promise: Fixed only when re-validation says so.

**Operationally usable**

- Queue with open / verification-pending / resolved summary; overdue view; CSV export including ticket system/id and measured revalidation flag.
- Detail: mark ready → verify → verification event timeline; ticket sync does **not** treat external close as Fixed (ClosedWithoutEvidence class behavior documented in PRD coverage / tests).
- Ticket create: resolves workflow integration (default Jira Cloud; explicit integrationId for PSA/RMM path), uses connector `sendWorkflowEvent`, audits `remediation.ticket.created`, emits webhooks on remediation create.
- Governed remediation actions and IaC workspace exist for advanced remops (policy-bound).
- Trends and reverify-due APIs support continuous recheck.

**Demo theater / residual risk**

- Retest module selection remains **family/keyword-based**, not always the exact original module set — heuristic exposures can correctly stay **Inconclusive** rather than falsely Fixed (good honesty, bad for teams that want every close measured).
- Ticket deep links in workflow payload are app-relative; full ITSM CMDB linkage is not a full ITIL suite.
- Mock ticket modes can create “tickets” without a real Jira project — require non-mock integrations for production ops.

**SOC lead call:** **This is one of the strongest blue surfaces.** Closure discipline is productized correctly. Wire real ITSM before relying on ticket fields in SLAs.

---

### 7. Runners — `/runners` (`runners-workbench.tsx` + Go/TS agents)

**What it is:** Customer-network agent fleet: registration tokens, outbound HTTPS signed-task poll, measured/discover tasks, kill switch, transport-policy decisions.

**Operationally usable**

- List runners, status, transport decisions (Primary / SupportedLater / Disallowed).
- Issue deploy token + documented image/deploy modes (Docker/K8s/systemd/Windows).
- Dispatch measured modules against **verified scopes**; discover modules for recon.
- Task lifecycle visible (Queued → Leased → Running → Completed / Denied* / Expired…).
- UI computes **staleness** when server still says Active but `lastSeenAt` is old (`RUNNER_STALE_AFTER_MS` = 15m) — honest operator signal.
- Fleet/policy/kill-switch APIs for control-room ops; async operations control room documents job/task reconciliation limits (top 200).

**Demo theater / residual risk**

- Module allowlist is deliberately narrow for safety; full offensive/BAS live kit remains gated (Agents.md / SECURITY_BOUNDARIES).
- Result provenance has improved (signing E2E called Met in readiness assessment); still require ops to verify `resultSignatureVerifiedAt` in evidence when arguing exploitability to leadership.
- Not a full EDR agent — no continuous host telemetry collection.

**SOC lead call:** **Usable as the in-network proof executor.** Pair health with schedules. Kill switch is a real SOC safety control — practice it.

---

### 8. SIEM / detection stack integration

**Catalog reality** (`docs/INTEGRATIONS.md`, generated):

- SIEM **live Beta** examples: Splunk Cloud, Elastic Security, Microsoft Sentinel, Datadog Cloud SIEM, Google SecOps, IBM QRadar, Rapid7 InsightIDR, Sumo Logic.
- EDR/XDR **live Beta** examples: CrowdStrike Falcon, SentinelOne, Microsoft Defender XDR, Cortex XDR/XSIAM, Carbon Black, Sophos, Trend Vision One, etc.
- **141 Planned / NotConnectable** catalog rows must not be configured as production sources (marketplace design-partner path).

**What “integrated” means here**

1. **Read inventory / health** (sync health tests for Elastic, Sentinel, etc.).  
2. **Observe control response** for a technique under validation (`observeControl` / ControlObservation signals).  
3. **Normalize to Signal Fabric** — not full SIEM rule lifecycle management (no write of correlation searches, no notable close-out API for every vendor).

**Ops requirements before trusting coverage rings**

- Non-mock credentials; verified scope; control source registered; control validation mission/stimulus executed.  
- Prefer connectors with **contract tests** + live smoke when available.  
- Treat “Logged only” as a real detection-engineering ticket, not a pass.

---

### 9. Ticketing / SOAR / chatops

| Path | Status | Notes |
|---|---|---|
| Jira Cloud (default remediation ticket) | **Operational path** | `resolveWorkflowIntegration` defaults to Atlassian Jira Cloud; `createWorkflowTicket` via connector |
| PSA/RMM (Syncro, HaloPSA, Autotask, ConnectWise Manage) | **Supported via workflow connector key** | Generalized create-ticket path in app tests / remediation service |
| ServiceNow / Linear / GitHub Issues / Opsgenie / PagerDuty / Slack / Teams | **Catalog live Beta as SOAR/ITSM** | Depth varies; Slack/Teams are **transport labels**, not approval authorities (model-intervention design) |
| Tenant webhooks | **Operational** | Signed deliveries; worker queue; dead-letter audit |
| External ticket close | **Honest** | Sync can mark ClosedWithoutEvidence; still needs Periscan verify for Fixed |

**SOC lead call:** Plan on **Jira (or one PSA) + webhooks** as day-1 mobilization. Do not assume every ITSM logo on the marketplace has equal remops depth.

---

## Usable vs demo theater (summary table)

| Capability | Real-first proof | Theater risk if misused |
|---|---|---|
| Findings dispositions & bulk | API + role checks | Treating validated queue as SIEM alert volume |
| Control coverage snapshots | Prisma snapshots + ControlObservation | Mock SIEM placeholders driving “coverage %” |
| Live EDR technique observe | CrowdStrike/Splunk-class live clients | Demo seed mockMode |
| Stimulus / BAS-lite injection | Gated; Partial per analyst assessment | Claiming continuous BAS without flip + runner |
| Signal trigger approve | Draft mission only | Assuming auto-execution |
| Threat advisory import | Evidence artifacts + exposure assess | Indicators alone as “we’re hit” |
| Schedules + system sweep | Real scheduler service | Schedule without runner/scope health |
| Remediation Fixed | VerificationEvent + anti-fab tests | Ticket Done = Fixed |
| Runner measured tasks | Signed poll + allowlist modules | Active badge with stale lastSeen |
| Connector catalog logos | 126 live / 141 planned split | Configuring Planned as connected |

---

## What I would run in a blue-team pilot (first 30 days)

1. **Connect one EDR + one SIEM** (prefer CrowdStrike + Splunk or Falcon + Sentinel) with **non-mock** creds; register control sources.  
2. **Deploy one internal runner**, verify heartbeat & kill switch, dispatch one measured check against a **verified lab scope**.  
3. Run a **ControlValidation** mission (dry-run telemetry observe first); review `/controls` for logged-only / missed / no-evidence.  
4. Open `/findings` only after correlation; practice bulk disposition and risk acceptance with expiry.  
5. Create remediations for top paths; **create Jira tickets**; fix in lab; **verify** and confirm Fixed only after measured retest.  
6. Schedule **Weekly ControlValidation + FixVerification** with blackouts; watch `/schedules` and `/runners`.  
7. Import one real advisory in Threat Center; confirm plan + missing signals — do not auto-launch.  
8. Wire **tenant webhooks** to the SOC chat/on-call bus for `remediation.created` / snapshot events.

Skip for pilot: full 267-vendor shopping list, SharpHound/Caldera/Atomic live (blocked by policy), treating demo workspace as audit evidence.

---

## Gaps that block “SOC-ready A”

1. **Closed injection→telemetry loop** still Partial — control effectiveness is strongest as observe-from-vendor, not full continuous BAS.  
2. **Findings dedup / occurrence model** incomplete for high-volume multi-source noise.  
3. **SIEM depth uneven** — placeholder mock observations for several SIEMs; not all have CrowdStrike/Splunk-class live observe.  
4. **No native case management** — dispositions ≠ IR case; bi-directional SIEM case sync limited.  
5. **ITSM depth** concentrated on Jira/workflow event path; ServiceNow logo ≠ proven remops parity without live smoke.  
6. **Scale** of findings/jobs UI is tenant-demo oriented (client filter, job/task caps in control room).  
7. **Live vendor certification** remains manual Beta smoke, not continuous production certification.

---

## Evidence anchors (code / docs)

| Area | Paths |
|---|---|
| Findings UI/API | `apps/web/src/components/findings-workbench-v2.tsx`, `apps/api/src/services/findings.ts`, `apps/api/src/app.ts` `/api/v1/findings*` |
| Controls UI/API | `apps/web/src/components/controls-workbench.tsx`, `apps/api/src/services/control-ai.ts`, `control-stimuli.ts` |
| Signal activity | `apps/web/src/components/signal-activity-stream.tsx`, `apps/api/src/services/signal-triggers.ts` |
| Threat center | `apps/web/src/components/threat-center-workbench-v2.tsx`, `apps/api/src/services/threat-center.ts` |
| Schedules | `apps/web/src/components/schedules-workbench-v2.tsx`, `apps/api/src/services/schedules.ts`, `apps/api/src/system-scheduler.ts` |
| Remediation + tickets | `apps/web/src/components/remediation-*.tsx`, `apps/api/src/services/remediation.ts`, `createWorkflowTicket` in `runtime-services.ts` |
| Runners | `apps/web/src/components/runners-workbench.tsx`, `apps/api/src/app.ts` `/api/v1/runners*`, `apps/runner`, `apps/runner-agent` |
| Connectors / SIEM | `packages/connectors/src/*`, `docs/INTEGRATIONS.md`, `docs/CONNECTOR_LIVE_SMOKE.md` |
| Webhooks | `packages/webhooks/src/*`, `apps/worker` |
| Honesty / readiness | `docs/ANALYST_READINESS_ASSESSMENT.md`, `docs/ANALYST_CAPABILITY_MATRIX.md`, `docs/SECURITY_BOUNDARIES.md`, `docs/qa/CORE_PRODUCT_GAP_AUDIT_2026-07-16.md` |
| Nav contract | `apps/web/src/lib/app-navigation.ts` |

---

## Persona scorecard

| Question | Answer |
|---|---|
| Can my analysts live in this instead of the SIEM? | **No** — live **beside** the SIEM for validation proof. |
| Can I measure detection efficacy by ATT&CK technique? | **Yes, with connected control sources and real observations** (injection loop still Partial). |
| Can I prevent “ticket closed = fixed”? | **Yes** — product enforces verification events. |
| Can I continuous-validate on a schedule? | **Yes** — schedules + system sweep + FixVerification. |
| Can I mobilize to ITSM? | **Yes for Jira/workflow path**; certify your vendor before SLA reliance. |
| Is the marketplace trustworthy for procurement? | **Only after filtering Planned vs live Beta** and running smoke for chosen connectors. |
| Demo seed as audit evidence? | **No** — demo/mock is for UX narrative; real-first rule applies. |

**Overall blue-team operational readiness:** **B / B+** as a **validation & control-effectiveness proof plane** with strong remediations and safety. **C+** if evaluated as a primary SOC detection/response platform (wrong product category).

---

## Sign-off

- **Persona:** SOC Blue Team Lead  
- **Audit type:** Product surface + API/service/connector evidence review  
- **Action for product:** Keep proof language honest; finish live control-injection where policy allows; deepen SIEM observe parity; ship findings fingerprinting; certify top 5 SIEM/ITSM pairs with live smoke SLAs.  
- **Action for customer blue team:** Pilot with one SIEM + one EDR + one runner + Jira; ignore logo count; require measured Fixed for any risk closed in the board pack.
