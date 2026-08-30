# Periscan UI release and ICP roadmap

Status: release UI implementation complete; external design-partner evidence in progress
Baseline: the 2026-07-14 release-candidate UI and its real API-backed workflows

## Implementation closeout — 2026-07-14

The implementable release scope in Phases A–D is complete. The product now
derives activation from persisted tenant state, stores role/outcome preferences
without changing authorization, exposes prerequisite diagnostics and a ranked
cross-workflow queue, carries proof-loop context through detail views, and
consolidates snapshot review, evidence-grounded analysis, replay, fix impact,
proof composition, MSSP exception triage, and capability readiness.

| Phase | Shipped evidence                                                                                                                                          | Still requires real-world evidence                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A     | Nine persisted-state milestones, persona onboarding, resumable setup diagnostics, contextual mission/report feedback, audited profile and feedback writes | Five observed design-partner sessions and measured medians from those sessions                                                    |
| B     | Ranked Needs-you queue, context strips, snapshot workspace, URL-preserved saved views, persona rail, and returning-user change lens                       | Production baseline comparison for clicks, queue coverage, completion, and denial rates                                           |
| C     | Typed evidence-citing analyst, interactive replay, fix-impact view, visible proof-composer governance, and tenant-safe MSSP batch review                  | Grounded-analyst evaluation set, timed replay study, and human proof-pack review                                                  |
| D     | One proof-loop pack catalog with real readiness checks and explicit unavailable enterprise workflows                                                      | Pack enablement only when a real backend entitlement/install lifecycle exists; benchmarks only after a privacy-safe cohort exists |

No participant result, production conversion, cohort benchmark, or human
accuracy review is claimed by this closeout. Run
[`ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](./ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)
to collect that evidence without substituting internal QA for customer
validation.

### Release gate result

The canonical database-backed `pnpm verify` gate passed on 2026-07-14. It
included lint and type checks; 61 web test files with 219 tests; 19 API test
files with 314 tests; a 49-route production build; runner and local-lab checks;
84 Playwright journeys covering authenticated WCAG A/AA, the shared shell, and
320 px overflow; 25 security-boundary tests; and 149 acceptance tests. Prisma
validated all 101 migrations with no enum drift. The dependency gate found no
production advisories and no high-or-higher advisory across the full installed
graph.

## Product decision

Periscan's release wedge should be the **security leader and hands-on security
team that must turn fragmented tool signals into defensible proof**. The buyer
needs a concise answer to six questions: what can compromise us, what controls
caught it, which path matters most, what should we fix first, did the fix work,
and what can we show leadership, a customer, or an auditor?

The primary daily user is the security engineer or analyst who runs the proof
loop. The primary buyer is the security leader. GRC/report consumers are
important downstream users. MSSP/vCISO operators are the scale wedge because
the same proof loop repeats across client tenants.

This deliberately narrows the broad platform catalog into one product promise:

> Find the path. Validate the risk. Prove it's fixed.

The UI should progressively reveal the wider platform only when the customer
needs it. Route count and feature breadth are not success metrics.

**Forced GTM rule (canonical):** see
[`../DESIGN_PARTNER/ICP_WEDGE.md`](../DESIGN_PARTNER/ICP_WEDGE.md). Full-PRD
audience lists (AI product teams, multi-BU enterprise, “feel premium for all”)
are TAM / quality bars — **not** day-one ICP. Wartime motion, reference factory
(zero refs = market presence fail), and product-copy bans on fake case studies
live under [`../DESIGN_PARTNER/`](../DESIGN_PARTNER/). Moat positioning:
[`../MOAT_TRUTH_ARCHITECTURE.md`](../MOAT_TRUTH_ARCHITECTURE.md).

## Release-candidate baseline

The release UI now has a coherent shared shell, honest loading/error/empty
states, a guided first-run flow, cross-linked evidence, findings, paths,
controls, remediation, missions and reports, real policy/scope gates, governed
account/SSO/report workflows, responsive primary routes, and authenticated
WCAG A/AA browser gates. Product-visible state remains real-first.

The remaining opportunity is not another visual reskin. It is to make the
proof loop feel inevitable: one clear next action, continuity across roles, and
insight that competitors cannot provide without Periscan's evidence graph.

## North-star journey

1. **Connect** an existing source and explain exactly what Periscan can read.
2. **Authorize** a scope and show the effective safety envelope before work can
   run.
3. **Validate** a small, high-value scenario and keep policy/approval state in
   context.
4. **Understand** the top measured path, failed or effective controls, business
   impact, confidence, and evidence basis on one screen.
5. **Act** by assigning the smallest path-breaking remediation with a target
   date and ticket destination.
6. **Verify** the fix with fresh evidence; never let a stale state appear fixed.
7. **Prove** the outcome with an audience-specific, governed evidence pack.
8. **Repeat** on a schedule or across MSSP clients, surfacing only meaningful
   change.

North-star metric: **weekly tenants completing a measured
Validate → Remediate → Re-validate proof loop**.

## Persona-specific information architecture

### Security leader

Default to outcomes: top validated risk, control misses, change over time,
financial/operational context when configured, fixes awaiting verification,
and proof ready to share. Every summary must drill into its evidence.

### Security engineer / analyst

Default to work: the unified **Needs you** queue, mission readiness, prioritized
findings, attack-path reasoning, control verdicts, remediation ownership, and
fresh verification. Preserve dense detail, keyboard navigation, filters, and
exports.

### GRC / auditor / customer reviewer

Default to proof: framework control trace, evidence integrity, validation time,
decision register, methodology/safety, governed delivery, and export. Do not
present Periscan as a certifying authority.

### MSSP / vCISO operator

Default to exceptions across tenants: clients whose readiness regressed,
approvals or fixes are stalled, reports are due, or coverage inputs are missing.
Tenant switching must retain task context and client branding must never alter
the underlying evidence.

## Delivery plan

### Phase A — release learning loop

Outcome: prove that a new design partner can reach first evidence without a
Periscan operator narrating the interface.

- Instrument the funnel from signup through source, verified scope, policy
  preview, first mission, first measured result, remediation, re-validation,
  and report share/export.
- Add a short role/outcome choice after signup. Use it only to set the landing
  view and education; never hide authorized product capability.
- Preserve the three-step onboarding for empty tenants, but add resumable
  progress, prerequisite diagnostics, and one contextual escape to help.
- Run five observed first-session tests with security leaders/engineers and at
  least two MSSP/vCISO operators. Record hesitation, wrong turns, support
  prompts, and time to first measured evidence.
- Add in-product feedback at the end of a mission and report workflow, tagged
  with route, tenant maturity, and proof-loop stage.

Exit evidence:

- Median time to verified scope and first mission is measured.
- At least 4/5 participants can explain measured vs heuristic and identify the
  next safe action without coaching.
- No participant mistakes sample, simulated, unconfigured, or pending work for
  measured proof.

### Phase B — make the proof loop the product

Outcome: reduce navigation and handoff cost during weekly operations.

- Turn **Needs you** into a first-class work queue spanning approval requests,
  incomplete scope/integration prerequisites, unowned priority findings,
  overdue remediation, failed runs, and fixes ready for re-test.
- Add a persistent proof-loop context strip on finding, path, mission,
  remediation, verification, and report detail: current stage, evidence basis,
  owner, freshness, and the next valid action.
- Create one Snapshot review workspace that composes the top path, control
  verdicts, business impact, remediation choice, and evidence drawer without
  forcing a route tour.
- Add saved views and shareable filtered URLs for analyst queues; preserve
  server-side filtering and bounded pagination.
- Let persona landing views simplify the rail. Keep the command palette as the
  complete, searchable capability map.
- Make change the default lens for returning users: new, regressed, reopened,
  newly blocked, verified fixed, and missing proof inputs since the last
  accepted baseline.

Exit evidence:

- Median clicks from prioritized result to owned remediation is at most three.
- At least 80% of approval/remediation/re-test work can be started from Needs
  you without searching the rail.
- Weekly proof-loop completion and verified-fix rate improve from the Phase A
  baseline without increasing denied or out-of-scope attempts.

### Phase C — evidence-native differentiation

Outcome: deliver insight that is only credible because it is bounded by real
evidence and policy.

- **Grounded analyst:** an always-available assistant that can explain a path,
  compare snapshots, draft a fix plan, and assemble a report only through typed
  tools. Every answer cites evidence IDs and labels inference; actions remain
  approval-gated.
- **Interactive attack replay:** a step-by-step path timeline showing entry,
  pivots, control interactions, objective, evidence, ATT&CK mapping, and the
  exact point a proposed fix breaks the chain.
- **Fix-impact workspace:** show which measured paths and business services a
  remediation could break, then require fresh validation before claiming risk
  reduction. Do not predict a verified outcome.
- **Proof composer:** build board, customer, auditor, cyber-insurance, and MSSP
  narratives from one normalized evidence set; make inclusion, redaction,
  freshness, integrity, expiry, and audience variant visible.
- **MSSP exception cockpit:** rank client tenants by regression, stale proof,
  missing inputs, remediation SLA, and report due date; support batch triage but
  keep tenant boundaries explicit.

Exit evidence:

- Grounded-analyst evaluations show 100% evidence citation for factual product
  claims and zero successful attempts to execute outside policy/scope.
- Users can identify a path breaker and its supporting evidence from replay in
  under two minutes.
- Generated proof packs pass human review for evidence traceability, audience
  fitness, redaction, and claim accuracy.

### Phase D — platform expansion without interface sprawl

Outcome: expand into continuous validation, AI apps, control/detection
validation, runners, marketplace packs, and enterprise governance while
preserving the same mental model.

- Introduce capabilities as installable/enableable proof-loop packs, not new
  disconnected dashboards.
- Use readiness checklists with explicit scope, integration, runner, policy,
  evidence, and legal/safety prerequisites.
- Add cross-program baselines and peer/industry benchmarking only when the
  cohort, normalization method, privacy threshold, and sample size are honest
  and visible.
- Add SCIM, advanced role administration, live billing, and enterprise/MSSP
  deployment workflows only with complete backend implementation and tests.

## Scorecard

### Activation

- Signup → first connected real source
- Signup → verified scope
- Signup → first measured mission
- Setup completion without human support

### Value

- Tenants with a measured top path or control verdict
- Weekly completed proof loops
- Priority findings routed to an owner
- Median time from finding to verified fix
- Reopened risk discovered by fresh validation

### Proof and trust

- Evidence packs generated and governed shares opened
- Claims with direct evidence links
- Evidence-chain verification success/failure surfaced
- Policy denial, approval, out-of-scope, and runner-kill acknowledgment rates
- Reports rejected in human accuracy review

### Retention and scale

- Weekly active analyst tenants
- Scheduled validations producing meaningful diffs
- MSSP clients with current proof and no overdue action
- Return usage by role and proof-loop stage, not raw page views

## Research and release cadence

- Weekly: review funnel drop-off, Needs-you aging, denied attempts, failed
  missions, and support transcripts.
- Every two weeks: observe at least two users completing a real workflow with
  think-aloud notes; include keyboard-only and 320–390px checks regularly.
- Monthly: security leader report review and MSSP exception-triage session.
- Before each release: run the full repository gate, authenticated WCAG A/AA
  route sweep, mobile overflow sweep, real-data empty/error/success checks, and
  a claim-language review against evidence provenance.

## Guardrails and non-goals

- Do not optimize for feature discovery at the cost of a clear next action.
- Do not put raw scanner output in the primary experience.
- Do not turn AI prose into product truth; cite evidence and distinguish
  measured, heuristic, inferred, simulated, and unconfigured states.
- Do not create fake benchmarks, breach probabilities, loss history, or risk
  reduction.
- Do not bypass verified scope, policy approval, tenant isolation, runner local
  allowlists, audit, or fresh fix verification for UX convenience.
- Do not make a planned integration, payment flow, SCIM workflow, or live
  execution capability appear usable before its real implementation and tests
  exist.

## Definition of success

The UI is successful when a first customer can enter with fragmented signals,
complete a safe measured proof loop, explain why the result matters, route and
verify the smallest meaningful fix, and share governed evidence—without a
Periscan expert translating the product and without the interface making a
claim the evidence cannot support.
