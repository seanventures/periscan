# Panel P04 — Enterprise CISO (5,000 employees)

**Date:** 2026-07-29  
**Persona:** CISO / Head of Cybersecurity, ~5k-employee enterprise (regulated industry mix: financial services + SaaS product + hybrid cloud)  
**Lens:** Buy criteria, evidence defensibility, compliance theater, score inflation, board reports, audit/SIEM, multi-tenant isolation, platform pen-test, SLA/commercial, residual overclaim, feature-zoo risk to trust, measured-path gaps, MSSP blast radius, trust & safety  
**Method:** Code/docs-grounded adversarial read of proof-loop, claims, isolation, webhooks/audit, compliance packs, enterprise packaging, nav surface, and prior panel synthesis  
**Scope root:** `/Volumes/DataSSD1/test/periscan`  
**Contract:** `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md`  
**Prior panel:** `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md`

---

## Verdict

| Dimension | Score (1–5) | Notes |
|-----------|-------------|--------|
| **Overall CISO buy readiness** | **2.0 / 5** | Honesty architecture is real; enterprise packaging and flagship measured multi-hop are not. |
| Evidence defensibility (Fixed / Measured / policy floor) | 4.0 | Best asset in category; residual correlation / hop-journey risk must stay green. |
| Compliance / audit support | 2.5 | Attestation language is careful; control catalogs are thin; risk of theater if sold as audit replacement. |
| Enterprise control plane (IdP, MFA policy, SCIM, SLA) | 2.0 | SSO exists; SCIM/JIT, force-MFA, status page, commercial SLA do not meet 5k PoR bar. |
| Multi-tenant / MSSP trust | 3.0 | Isolation matrix + write-RLS strong; default-read RLS not backstopped; convention residual remains. |
| Platform security attestation (pen-test, trust pack) | 2.0 | Threat model excellent; external pen-test still open; trust pack env-driven. |
| Product packaging / feature zoo risk | 1.5 | Primary rail + dual nav present Autonomous/Swarm/MCP before loop is inevitable. |
| Board / SIEM / continuous assurance use | 2.5 | Executive packs and audit export exist; SIEM webhook surface thin and partly fictitious. |

### What **5.0** means for this CISO

A **5.0** product is one I can put on the **risk committee agenda as platform-of-record** for continuous exposure validation—not as a lab toy next to Tenable/Wiz. Concretely:

1. **Measured multi-hop is the default journey** — every edge on a path I hand to the board has a durable receipt; no `Leading` claim for Attack Path Validation until per-edge Measured is operator-routine (Slice 3 closed and re-scored blind).  
2. **Claim language is frozen** — Fixed only after measured retest; no scorecard, sales deck, or compliance pack can say Leading/Validated/Proven without linked evidence IDs and a dated rescore.  
3. **Enterprise control plane complete** — enforced SSO + optional force-MFA for all humans; SCIM or documented sales-assisted provisioning SLA; role mapping from IdP groups; break-glass runbook.  
4. **Defense-in-depth multi-tenant** — RLS (or equivalent) on reads *and* writes by default; isolation matrix is a CI coverage gate for every new route; MSSP parent cannot silently become data plane for sibling clients.  
5. **Audit/SIEM truth** — every subscribed webhook event actually emits; `remediation.verified` and `policy.denied` land in my SIEM with signatures; audit export completeness is contractual.  
6. **Independent platform pen-test** (annual) + published summary process; runner mTLS and result signing **default-on** in production.  
7. **Trust pack** — subprocessors, DPA/BAA path, data-region map, retention, status page, RTO/RPO, support SLA—not env placeholders.  
8. **IA discipline** — primary rail ≤ ~10 items for enterprise persona; Autonomous/Swarm/MCP demoted until proof loop is boring; dual nav eliminated.  
9. **At least one peer design-partner reference** willing to describe measured Fixed and audit handoff under NDA to my board.

Until then, maximum commercial posture is **paid design-partner / controlled pilot**, not multi-year PoR.

---

## Buy / no-buy

| Decision | Posture |
|----------|---------|
| **Platform-of-record (5k CTEM / continuous assurance)** | **NO-BUY** |
| **Paid pilot / design partner (single BU, scoped scopes, success criteria)** | **CONDITIONAL YES** — only after hard gates below |
| **Replace annual pen-test / BAS / CNAPP / RBVM** | **NO** — complement only (agree prior panel U-26–U-29) |
| **Feed board risk pack as sole source of truth** | **NO** until Slice 3 + score governance + reference |

### Hard gates before I sign even a pilot SOW

| Gate | Why |
|------|-----|
| Slice 3 measured paths operator-complete (plan → hop measure → durable receipt → path recompute) | Flagship claim; scorecard row 3 still `Leading` while docs say multi-hop Partial |
| Blind rescore freezes inflated Leading rows | Sales truth = legal risk for me if I overstate to my board |
| Auth recovery routes public + `?next=` honored | Ops reliability / access continuity |
| Webhook catalog truth (`policy.denied` emit or remove; add `remediation.verified`) | SIEM integration contract |
| Module license dual-truth fixed | Supply-chain / legal review |
| Written pen-test schedule + trust-pack completeness for our data region | Vendor risk questionnaire |
| Primary rail collapsed; Autonomous behind Labs | Reduces mis-scope and shadow-AI risk |

### What I would pilot (if gates met)

- One business unit, verified external + internal runner scope only  
- Success metric: **N paths with fully Measured edges** + **M remediations Fixed with measured revalidation evidence IDs** handed to GRC  
- No MSSP child sprawl, no live Caldera/Atomic/SharpHound, no “autonomous swarm” in production

---

## Findings

### FINDING | P04-1 | P0 | bug | evidence | Scorecard rates Attack Path Validation Leading while multi-hop Measured remains Partial
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `docs/qa/analyst-scorecard.json` id 3 “Attack Path Validation” → `verdict: "Leading"`, `currentScore: 4.25`; `docs/ANALYST_READINESS_ASSESSMENT.md` must #3 “Attack paths carry per-edge measured reachability” → **Partial (unblocked)**; `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md` Slice 3 status **Next** (edge receipts / measured recompute not complete); prior panel U-07.
- **Problem:** Internal “Leading” on the flagship capability conflicts with the product’s own readiness admission that multi-hop per-edge Measured is incomplete. A CISO who trusts the scorecard overstates posture to the board.
- **Impact:** Legal/reputational risk if I cite Periscan scores in risk committee materials; destroys trust when an auditor asks for edge receipts and gets hypotheses.
- **Recommendation:** Immediately reclassify row 3 (and any other path/SCV rows) to Strong/Partial until Slice 3 exit criteria are green; freeze sales decks to scorecard + blind rescore date; make score gate fail on Leading without linked measured-path E2E evidence.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P04-2 | P0 | bug | paths | Measured multi-hop proof loop is not yet the default operator journey
- **Persona:** Enterprise CISO (5k)
- **Evidence:** Slice 3 still “Next” in `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`; readiness musts 3/4/7 Partial in `docs/ANALYST_READINESS_ASSESSMENT.md`; prior panel U-05 hop measure CTA Eligible vs NeedsApproval residual; U-06 correlation Measured without receipts residual.
- **Problem:** My buy thesis is “see the path, measure the cheapest link, prove Fixed.” If hop measure CTAs deadlock or correlation can stamp Measured without durable hop receipts, the product is a path *browser*, not a proof system.
- **Impact:** Pilot fails executive demo; residual overclaim if any surface still implies full-path Validated from partial edges.
- **Recommendation:** Treat Slice 3 as the only P0 product epic for enterprise pilots: durable `hopKey`, receipts never lost on re-correlate, Measure hop end-to-end without dead CTAs, anti-fab tests for “no Measured without receipt.”
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-05, U-06; theme Slice 3

### FINDING | P04-3 | P0 | improvement | compliance | Compliance attestation packs are thin catalogs sold adjacent to “Attestation” naming
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `packages/reports/src/compliance-catalog.ts` — frameworks such as ISO27001, SOC2, PCI, DORA map only ~3–4 representative controls each (e.g. DORA Art. 6 / 24–27 / 17–19 / 12; PCI Req. 11.3/11.4/10); reports carefully say “Measured support only. This report does not assert certification…” (`packages/reports/src/index.ts`); prior panel U-24.
- **Problem:** Naming (`*Attestation`, “SOC 2 Support Pack”, DORA TLPT control IDs) will be heard by boards/GRC as certification coverage. Catalog depth is representative, not program-complete. That is classic **compliance theater** if GTM oversells it.
- **Impact:** External auditor rejects pack as insufficient; internal GRC over-relies and under-invests in real control testing; CISO accountability for misrepresentation.
- **Recommendation:** Rename customer-facing packs to “Measured control evidence for &lt;framework&gt; (partial)” unless control coverage ≥ agreed minimum; publish coverage % per framework; never map TLPT/pen-test articles to unmeasured multi-hop; keep auditor-judgment disclaimer non-dismissible in PDF/HTML.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-24

### FINDING | P04-4 | P0 | improvement | auth | Enterprise IdP lifecycle incomplete (no SCIM/JIT, no force-MFA policy)
- **Persona:** Enterprise CISO (5k)
- **Evidence:** SSO OIDC/SAML documented ready (`docs/PRODUCTION_READINESS.md`); SCIM in product is **CyberArk connector identity inventory** (`packages/connectors`, tests around CyberArk SCIM)—not SCIM *provisioning of Periscan users*; no force-MFA tenant policy surface found (MFA is per-user enroll + `mfa_required` after password when enrolled); prior panel U-19; PRD Phase 8 still lists SCIM as enterprise exit criteria.
- **Problem:** At 5k employees I will not run long-lived local passwords + manual invites for a security platform holding path/evidence gold. Without SCIM/JIT and force-MFA, access reviews and joiner/mover/leaver fail my IAM standard.
- **Impact:** Vendor security questionnaire fail; IAM team blocks production SSO cutover; orphaned accounts after offboarding.
- **Recommendation:** Either ship SCIM 2.0 (or Okta/AAD group→role JIT) with deprovision SLA, or publish a sales-assisted provisioning SLA with quarterly access cert; add tenant policy `requireMfaForAllHumanUsers` / SSO-only mode enforced server-side.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-19

### FINDING | P04-5 | P0 | bug | security | Auth recovery routes not public — account continuity broken
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `apps/web/middleware.ts` `PUBLIC_PREFIXES` = `/login`, `/signup`, `/demo`, `/api`, `/brand`, `/_next`, `/favicon` only — **no** `/reset-password`, `/accept-invite`, `/verify-email`; unauthenticated users redirected to login with `?next=`; prior panel U-01.
- **Problem:** Invite accept and password reset are operational security controls. If gated behind session, first-time and recovery paths fail—operators invent shadow workarounds (shared passwords, tickets out of band).
- **Impact:** Onboarding delay, support load, insecure interim access patterns; pilot ops risk.
- **Recommendation:** Add recovery/invite/verify paths to public allow-list; honor `?next=` after login (U-10); E2E tests unauthenticated happy path.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-01, U-10

### FINDING | P04-6 | P1 | bug | api | Webhook catalog promises `policy.denied` but never emits it; SIEM contract incomplete
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `packages/shared/src/domain.ts` `WebhookEventTypeSchema` includes `policy.denied`; create/test paths allow subscription (`apps/api/src/app.test.ts`); `emitWebhookEvent` / `emitTenantWebhook` call sites emit `mission.completed`/`mission.failed` (worker), `snapshot.ready`, `remediation.created` — **grep shows no production emit of `policy.denied`**; no `remediation.verified` event type at all; prior panel U-08, U-21.
- **Problem:** My SOC integrates security tools via webhooks into SIEM. A subscribed-but-never-fired policy-deny event creates a **false sense of continuous assurance**—exactly the failure mode auditors probe.
- **Impact:** Silent policy denials never reach detection engineering; false confidence in “we would have seen denials.”
- **Recommendation:** Emit `policy.denied` on every evaluatePolicy Denied decision (with redacted payload + decision id), or remove from enum; add `remediation.verified` with outcome + evidence IDs; contract tests that every enum value has an emit path.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-08, U-21

### FINDING | P04-7 | P1 | improvement | security | Multi-tenant isolation is strong but not default-read RLS — residual leak class
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `docs/THREAT_MODEL.md` §1 residual: isolation by convention + tests; `packages/db/src/client.ts` documents RLS extension **deliberately scoped to transactions (writes), NOT every query** — reads rely on hand-written `where: { tenantId }`; isolation matrix `tests/acceptance/tenant-isolation-matrix.test.ts`; write backstop tests exist (`tests/security/rls-tenant-isolation.test.ts`); prior panel U-20.
- **Problem:** For a multi-tenant SaaS holding my attack paths and evidence, “author remembered tenantId on every new read” is not an acceptable residual at PoR scale—especially with high feature velocity (feature zoo).
- **Impact:** One new route without filter is a silent cross-tenant disclosure; board-level data-breach scenario.
- **Recommendation:** Extend isolation matrix as CI coverage gate for every new tenant-scoped route; prefer `runWithTenantRls` for multi-query handlers; roadmap default-read RLS with connection-pool safe design; never market “RLS everywhere” until reads are bound.
- **Effort:** L
- **Zoo-related:** yes (velocity amplifies convention risk)
- **Previous-panel-link:** U-20

### FINDING | P04-8 | P1 | improvement | security | Runner mTLS and result signing remain opt-in — provenance not production-default
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `docs/THREAT_MODEL.md` residual: mTLS only when `PERISCAN_RUNNER_REQUIRE_MTLS==="true"`; result signing opt-in if no key registered; Ed25519 design itself is excellent when enabled; infra README mentions outbound HTTPS + mTLS as target pattern.
- **Problem:** In-network runners are the highest-trust component in my environment. Bearer-token-only long-lived auth without mandatory mTLS/result signing fails my third-party remote-execution standard.
- **Impact:** Compromised token injects forged measurements → false Fixed/Exploitable → bad board decisions.
- **Recommendation:** Production profile: mTLS required, result signing required for all new runners, rotation SLA documented, kill switch tested quarterly; refuse Enterprise package without these defaults.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-20; theme runner provenance

### FINDING | P04-9 | P1 | request | security | No independent platform pen-test — vendor risk gate open
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `docs/ANALYST_READINESS_ASSESSMENT.md`: security posture **A blocked on an external pen test**; `docs/THREAT_MODEL.md` recommendations include commissioning external PT with multi-tenant emphasis; excellent internal isolation matrix and threat model do **not** replace independent attestation.
- **Problem:** I cannot approve a SaaS that runs scoped validation inside my network without a third-party PT summary (even under NDA).
- **Impact:** Security questionnaire / procurement fail; legal will not sign DPA without residual-risk acceptance.
- **Recommendation:** Commission annual independent pen-test (auth, multi-tenant, runner, SSRF, model gateway); publish process + summary letter; track findings to close.
- **Effort:** L (mostly external)
- **Zoo-related:** no
- **Previous-panel-link:** theme enterprise buyer / security eng

### FINDING | P04-10 | P1 | feature | ops | No customer-facing SLA, status page, or support RTO/RPO contract surface
- **Persona:** Enterprise CISO (5k)
- **Evidence:** Billing/subscription explicitly `paymentProcessorStatus: NotConfigured` (`docs/PRODUCTION_READINESS.md`, `docs/SUBSCRIPTION_OPERATIONS_RUNBOOK.md`); API process `uptimeSeconds` metrics exist (`apps/api/src/app.ts`) but no public status product; production readiness lists log aggregation/incident contact as **deployment-managed**; prior panel U-19.
- **Problem:** Continuous validation is operationally load-bearing. Without uptime SLA, status page, and incident comms, I cannot depend on Periscan for board-cycle assurance or MSSP client SLAs.
- **Impact:** Cannot list as critical control; insurance / customer questionnaires fail; pilot only.
- **Recommendation:** Publish status page + support tiers (P1 response hours); document RTO/RPO for control plane and evidence store; commercial MSA annex before PoR.
- **Effort:** M (process) + L (ops maturity)
- **Zoo-related:** no
- **Previous-panel-link:** U-19

### FINDING | P04-11 | P1 | improvement | reports | Board / executive packs risk overclaim if fed heuristic paths
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `ExecutiveRiskSummary` pack type (`packages/reports/src/index.ts`) — “Board and executive summary focused on business impact…” with high-level evidence IDs and **technical appendix omitted**; executive trends API `/api/v1/tenants/current/executive-trends`; claim-language centralization claimed complete in Slice 1 (`ANALYST_94…` plan) but multi-hop still heuristic-heavy.
- **Problem:** Board packs that omit technical appendix are exactly where inflated language does the most damage. If any residual risk-band-driven copy survives, executives see “validated critical paths” without Measured receipts.
- **Impact:** Board misdecision; CISO credibility loss; regulator asks for proof and pack cannot defend.
- **Recommendation:** Executive pack must show Measured/Heuristic counts, fullyMeasured path ratio, and “do not treat as certification” banner; block Executive export when zero Measured paths unless explicit “hypothesis mode” watermark; regression tests for board HTML/PDF claim language.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme claim language / Slice 1 residual

### FINDING | P04-12 | P1 | improvement | nav | Feature zoo undermines trust — Autonomous/Swarm/MCP on primary rail before proof loop is boring
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `apps/web/src/lib/primary-nav.tsx` group **Autonomous**: Agent Swarm, Agent Workflows, Operators, Engagements, MCP Server; dual nav `app-navigation.ts` still lists Swarm/MCP/Model Gateway/Threat surfaces; ~35–50 destinations (prior U-03); kill-switch/anomaly layers for model gateway still stubbed per threat model residual.
- **Problem:** Feature zoo is not just UX clutter—it is a **governance risk**. Security tools with AI action surfaces expand attack surface and encourage shadow use of incomplete safety layers. I will not greenlight Swarm/MCP for 5k-user production while the hero loop still has Slice 3 gaps.
- **Impact:** Scope creep in pilot; shadow AI tools; auditor questions on AI governance; trust dilution (“if they ship half-finished AI, is Fixed honest?”).
- **Recommendation:** Demote Autonomous/* to Labs until Fixed/Measured loop is inevitable; single nav source; persona rail for CISO/enterprise (~Dashboard, Paths, Findings, Remediation, Evidence, Reports, Schedules, Runners, Integrations, Admin).
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03, U-16

### FINDING | P04-13 | P1 | bug | security | Module license dual-truth creates supply-chain / legal residual
- **Persona:** Enterprise CISO (5k)
- **Evidence:** Many modules declare `license: "Proprietary"` in `packages/modules/src/index.ts` while OSS tool catalog carries real SPDX licenses (prior panel U-04 / OSS advocate); enterprise legal reviews third-party scanning stack for AGPL/copyleft contamination.
- **Problem:** Wrong license metadata is a compliance defect. I cannot approve tools into my environment on false Proprietary labels.
- **Impact:** Legal hold on pilot; forced module disable; OSS policy violation risk.
- **Recommendation:** Single SPDX source of truth; license inventory gate in `pnpm verify`; customer-visible SBOM/module license export.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P04-14 | P1 | improvement | mssp | MSSP multi-tenant architecture exists but enterprise cross-client blast-radius packaging is incomplete
- **Persona:** Enterprise CISO (5k) evaluating optional MSSP / multi-BU parent model
- **Evidence:** Parent/child tenants, portfolio, white-label reports referenced in production readiness and `services/tenant.ts` (`buildMSSPClientPortfolio`, `parentTenantId`, MSSP roles); isolation matrix tests entitlements; PRD Phase 8 exit criteria include MSSP + SCIM + advanced RBAC; analyst screenshots historically showed MSSP portfolio blockers in QA.
- **Problem:** Architecture for MSSP is real, but without SCIM, SLA, status, and default-read isolation hardening, I will not put multiple BUs or managed clients under one parent. Cross-client leakage is an existential vendor risk.
- **Impact:** MSSP/BU portfolio NO-BUY; forces separate tenants without shared ops.
- **Recommendation:** Explicit MSSP security whitepaper: data plane isolation proof, role matrix, no cross-client list leakage tests as release gate; sales-assisted multi-client only after pen-test includes MSSP scenarios.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme MSSP architecture (protect) + U-19/U-20

### FINDING | P04-15 | P1 | improvement | trust-safety | Trust & Safety surface is deployment-env driven — not a complete enterprise trust pack
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `GET /api/v1/tenants/current/trust-safety` builds subprocessors from env (`configuredSubprocessors`), BAA from `PERISCAN_BAA_REFERENCE_URL`, encryption/retention often `DeploymentManaged` (`apps/api/src/runtime-services.ts`); first-customer checklist still tells operators to confirm Trust & Safety page shows configured controls (`docs/PRODUCTION_READINESS.md`).
- **Problem:** My vendor risk process needs fixed subprocessors list, DPA, regions, retention, encryption, pen-test letter, and status—not “whatever the deployer exported this week.” Empty subprocessors in default is honest but not procurement-ready.
- **Impact:** Security questionnaire stalls; legal redlines expand; pilot delayed.
- **Recommendation:** Ship versioned Trust Center (public): subprocessors, DPA request path, regions, retention defaults, runner security model, last pen-test date; tenant UI links immutable document versions.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Wave C trust pack theme

### FINDING | P04-16 | P2 | improvement | evidence | Audit export is admin-only JSON/CSV — not SIEM-native continuous assurance
- **Persona:** Enterprise CISO (5k)
- **Evidence:** Audit export to evidence store as JSON/CSV with truncation completeness (`apps/api/src/services/tenant.ts` `AUDIT_EXPORT_MAX_EVENTS`, completeness flags); webhooks thin catalog; Splunk/SentinelOne connectors are **inbound signal** sources, not outbound audit-stream SIEM sinks.
- **Problem:** Pull-based truncated exports are necessary but insufficient. Continuous control monitoring expects push (webhook/syslog/OCSF) of policy, verification, and access events.
- **Impact:** GRC manual toil; gaps between exports; harder to prove continuous monitoring of the validation platform itself.
- **Recommendation:** Document max export window; add signed webhook events for verification + policy + auth-sensitive actions; optional OCSF/CEF mapping; SIEM sink connector (Splunk HEC / Sentinel) as first-class outbound.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-21; Blue team “not a SIEM” (agree: remain validation plane, but emit to SIEM)

### FINDING | P04-17 | P2 | improvement | remediation | Owner/SLA fields exist in schema but operational SLA discipline is not enterprise-grade
- **Persona:** Enterprise CISO (5k)
- **Evidence:** Domain models include remediation `owner`, `dueAt`, finding `slaDueAt` projections (`packages/shared/src/domain.ts` PERISCAN-7 comments); runtime tests for one remediation per fingerprint (`runtime-services.test.ts`); prior panel findings UI still weak on occurrence/fingerprint (U-11); ticket create missing on remediation detail (U-12).
- **Problem:** Board asks “who owns the open critical Measured exposure and when is it due?” If UI and ticket handoff are incomplete, owner/SLA is schema theater.
- **Impact:** Cannot run risk treatment program of record; metrics lag; ClosedWithoutEvidence tickets may go unseen.
- **Recommendation:** Findings default Active queue with fingerprint/occurrence; remediation detail ticket create; SLA aging widgets on Executive; alert webhook when Measured critical exceeds SLA.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11, U-12; Slice 4

### FINDING | P04-18 | P2 | bug | ai-agents | Model-gateway “advanced safety” stubs must not be sold as enterprise AI governance
- **Persona:** Enterprise CISO (5k)
- **Evidence:** `docs/THREAT_MODEL.md` §3 residual: `getKillSwitchStatus` always `{active:false}`, behavioral anomaly regex heuristic, blast radius synthetic, compliance preset hardcoded; real controls are allow/block lists, mode gate, safety ceiling, redaction.
- **Problem:** Marketing “Autonomous” + kill switch language without real kill-switch behavior is trust-destroying if discovered in diligence.
- **Impact:** AI governance questionnaire fail; forces disable of model gateway entirely.
- **Recommendation:** Remove or hard-label stub safety APIs as NotImplemented in product UI; implement real kill switch or hide Autonomous rail; never claim anomaly/blast-radius as production controls until tested.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16; Security eng residual

### FINDING | P04-19 | P2 | request | gtm | No customer references — cannot complete peer diligence for PoR
- **Persona:** Enterprise CISO (5k)
- **Evidence:** Prior panel U-25 / Forrester: no customer references → Wave/MQ market presence fail; product positioned design-partner.
- **Problem:** At 5k scale I require at least one peer reference call on measured Fixed, multi-tenant, and runner ops—not only vendor demos.
- **Impact:** PoR procurement impossible even if tech gates pass.
- **Recommendation:** Land 2–3 design partners with reference rights under NDA; document first-session ICP protocol outcomes.
- **Effort:** XL (GTM)
- **Zoo-related:** no
- **Previous-panel-link:** U-25

### FINDING | P04-20 | P2 | improvement | evidence | ClosedWithoutEvidence and Fixed honesty are excellent — protect and surface to executives
- **Persona:** Enterprise CISO (5k)
- **Evidence:** Ticket-close-without-verify → `ClosedWithoutEvidence` with audit (`docs/ACCEPTANCE_CRITERIA.md`, remediation services); reports caveat unmeasured closures (`packages/reports/src/index.ts`); anti-fabrication suite (`docs/ANALYST_READINESS_ASSESSMENT.md` must #6 Met).
- **Problem:** Not a defect—**under-surfaced excellence**. Executive views may bury ClosedWithoutEvidence in favor of green Fixed counts if not carefully designed.
- **Impact:** If under-surfaced, ops may optimize for ticket close rates and reintroduce false closure culture.
- **Recommendation:** Executive and board packs must count ClosedWithoutEvidence separately from Fixed; dashboard “Needs you” should promote unverified ticket closes.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme “what is excellent — protect forever”

---

## Top 5 moves to reach 5.0 (CISO lens)

1. **Close Slice 3** — durable per-edge Measured receipts as the only path to path-level Validated/Exploitable language; kill hop CTA deadlocks.  
2. **Score & GTM truth freeze** — blind rescore; no Leading without evidence; sales and board packs share claim contract.  
3. **Enterprise control plane** — force-MFA/SSO-only, SCIM or provisioning SLA, public auth recovery, runner mTLS+signing default-on.  
4. **Audit/SIEM truth + pen-test** — emit every webhook type; add remediation.verified; independent platform PT; versioned Trust Center.  
5. **Collapse the zoo** — one primary rail; Autonomous/MCP/Swarm in Labs; dual nav deleted; protect Fixed/Measured/ClosedWithoutEvidence honesty forever.

---

## Feature-zoo / IA notes (CISO)

| Action | Items |
|--------|--------|
| **Keep primary (enterprise persona)** | Dashboard · Executive · Attack Paths · Findings · Remediation · Evidence · Reports · Schedules · Runners · Integrations · Compliance · Admin/Audit |
| **Demote to Labs / Settings** | Agent Swarm, MCP Server, Model Gateway, Autonomous Engagements, Operators (until kill-switch real and loop boring) |
| **Merge** | Threat Center / Threat Feed / Signal activity / Validation Ops → one “Operations” workspace; dual `primary-nav` vs `app-navigation` → single source |
| **Rename** | “Attestation” packs → “Measured evidence support (partial)”; “Validated” anywhere without Measured basis → ban |
| **Cut from pilot scope** | Live Caldera/Atomic/SharpHound, full BAS library parity, self-serve payments, multi-client MSSP until isolation pen-test |
| **Do not break** | Measured vs Heuristic claim contract; Fixed only after retest; ClosedWithoutEvidence; denied-never-queued; outbound signed runner; Planned ≠ connectable; labeled demo sample |

---

## What is already excellent (do not break)

1. **Proof-not-claims architecture** — Measured vs Heuristic, weakest-hop, Fixed after retest, ClosedWithoutEvidence for ticket-close-without-verify.  
2. **Safety floor** — verified scope, policy gate, denied never queued, outbound-only runner, Ed25519 task/result signing design, kill switch concepts.  
3. **Anti-fabrication test gate** and real-first product rule (fixtures labeled; demo sample isolated).  
4. **Honest commercial boundary** — payment processor NotConfigured rather than fake checkout.  
5. **Compliance report disclaimers** that refuse certification claims (when packs are used carefully).  
6. **Tenant isolation matrix** and write-path RLS backstop (with residuals documented honestly in threat model).  
7. **External validation workbench** (Slice 2) as a real authorized loop.  
8. **Connector Planned ≠ connectable** honesty after Slice 1.  
9. **Threat model as living document** that admits residuals—rare and valuable.  
10. **API-first evidence IDs** suitable for auditor handoff when data is Measured.

---

## Alignment with previous panel

| Theme | Stance |
|-------|--------|
| NO-BUY as 5k PoR; paid pilot only | **Affirm** (this document’s buy decision) |
| Honesty architecture trapped in feature zoo | **Affirm** — zoo is a trust risk, not just UX |
| Slice 3 measured paths = CISO gate | **Affirm — P0** |
| Score inflation U-07 | **Affirm — treat as legal/comms risk** |
| Enterprise packaging U-19 | **Affirm** |
| Not a SIEM (Blue team) | **Affirm** — but must **emit to** SIEM truthfully |
| Complement not replace BAS/CNAPP/RBVM/PT | **Affirm** |
| Protect Fixed/Measured forever | **Affirm** — add ClosedWithoutEvidence visibility |

---

## Bottom line

Periscan has the **rare honesty spine** I want in a continuous validation platform—and currently lacks the **enterprise packaging, measured multi-hop completeness, score governance, SIEM webhook truth, and independent security attestation** required to be platform-of-record for a 5,000-employee program.

**Buy decision: NO-BUY as PoR. CONDITIONAL paid pilot only after hard gates.**  
**Verdict: 2.0 / 5.0** on the CISO lens defined above.
