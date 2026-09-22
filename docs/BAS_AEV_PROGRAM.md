# BAS / AEV product program

**Decision:** 2026-09-17, founder direction. **Plane:** PERISCAN-583.
**Implementation:** PERISCAN-584 framework; PERISCAN-585 content registry.
**Qualification environment:** disposable local labs first (founder direction).

Full breach and attack simulation (BAS) and adversarial exposure validation
(AEV) are explicit Periscan product objectives. Build around qualified open
source engines, measured security outcomes, and the existing proof loop.
This decision authorizes development; each customer execution still requires verified scope
and its own policy decision. A roadmap is not evidence of shipped capability.

The [full feature delivery matrix](BAS_AEV_FEATURE_MATRIX.md) maps endpoint,
identity, network, web/API, cloud, workload, detection, campaign and operating
capabilities to implementation dependencies and acceptance evidence.

Coding-agent continuation: [BAS_AEV_AGENT_HANDOFF.md](BAS_AEV_AGENT_HANDOFF.md).
Current runtime readiness states are implementation inputs, not development bans.

## Development and execution requirements

This program governs BAS/AEV implementation. Current capability records remain
authoritative for what customers can run.

- Build Atomic Red Team / Invoke-AtomicRedTeam scenario adapters, Caldera
  campaign integration, SharpHound collection with BloodHound analysis, and
  selected Metasploit validation adapters.
- Use reviewed, versioned adapter and scenario gates as implementations and
  their tests land. Do not simply delete denies
  or set `liveSupported` on an import/fixture module.
- Preserve authorization, tenant isolation, signed outbound runner polling,
  denial before queue, finite execution, cancellation, evidence provenance,
  redaction, and Fixed only after verification.
- Customer-data destruction, real data exfiltration, credential theft,
  persistent implants, evasion, and uncontrolled chaining remain excluded.
  Detection testing uses bounded approved behaviors, synthetic data, dedicated
  test identities, and reversible changes with verified cleanup.
- A library's availability or license does not certify every included action.
  Review dependencies, plugin content, licenses, privileges, and side effects
  at the selected pin. Default Community onboarding stays a qualified small
  pack; future BAS eligibility follows qualification and edition policy.

## Repository baseline

| Engine / feature | Current code | Development target |
| --- | --- | --- |
| Atomic / Invoke-AtomicRedTeam | Production module `atomic.control_validation_safe`: dry-run content/fixture path. Separate [local lab harness](BAS_LOCAL_LAB.md) has measured T1082 Hostname Discovery execution and verified cleanup. | Selected scenario execution, prerequisite checks, receipts, cleanup, detection correlation |
| Caldera | `caldera.advanced_adversarial`: imported plans / fixtures | Customer-managed isolated Caldera adapter, approved ability sets, operation lifecycle and result ingestion |
| SharpHound / BloodHound | BloodHound-compatible graph import; collector gated | Scoped directory collection, normalized graph, provenance and independently measured path edges |
| Metasploit Framework | `exploit.metasploit_check`: planning/fixture path | Reviewed non-destructive checks, typed options, bounded execution and normalized evidence |
| Control validation | Telemetry observation plus existing bounded marker workflows; generic live inject API denied | Scenario-specific inject → observe → verdict → retest with health-aware time windows |
| BAS content authoring | Authenticated Atomic/Caldera metadata preview and immutable tenant-scoped content registry | Content review, campaign selection and qualified adapter binding |

Nothing in this table enables a runtime. The content preview is an authoring
feature and produces no validation evidence, findings, or execution approval.

## Open source integration portfolio

Sources checked 2026-09-17. These are proposed roles, not blanket execution
endorsements. Validate the exact release and its licensing before packaging.

| Project | Role and integration boundary |
| --- | --- |
| [Atomic Red Team](https://github.com/redcanaryco/atomic-red-team) / [Invoke-AtomicRedTeam](https://github.com/redcanaryco/invoke-atomicredteam) | ATT&CK test definitions plus a separate executor. Preserve test GUID, upstream revision, supported OS, prerequisites, cleanup and telemetry expectations. Never run the entire library implicitly. |
| [Caldera](https://github.com/apache/caldera) | Adversary emulation platform with an API and plugin architecture. The former `mitre/caldera` URL redirects here. Use a customer-managed private deployment and explicit operation/ability allowlists; keep Periscan runner transport unchanged. |
| [SharpHound](https://github.com/SpecterOps/SharpHound) / [BloodHound CE](https://github.com/SpecterOps/BloodHound) | Directory collection and identity graph analysis. Collection is not proof of exploitation. Separate collector licensing/permissions from graph import and graph-edge verification. |
| [Metasploit Framework](https://github.com/rapid7/metasploit-framework) | Candidate validation/check modules. Certify each module's actual side effects; a method named `check` is not a safety guarantee. No arbitrary console or payload input. |
| [Stratus Red Team](https://github.com/DataDog/stratus-red-team) | Candidate cloud emulation in disposable authorized accounts. Require explicit resource budgets, selected techniques and cleanup verification before onboarding. |
| [Sigma](https://github.com/SigmaHQ/sigma) | Detection rule metadata and expected observables; separate rule coverage from observed alert fidelity. |
| [ATT&CK Navigator](https://github.com/mitre-attack/attack-navigator) | Import/export technique coverage layers, with tested/detected/blocked/stale distinctions and evidence links. |

Existing Nuclei, ZAP, Prowler, Trivy, Gitleaks, network discovery, and SIEM/EDR
connectors supply complementary exposure and observation capabilities. Reuse
them. Catalog counts and tool installs do not establish BAS/AEV completeness.

## Product experience and acceptance requirements

1. **Select outcomes and scope.** Choose control/detection validation or
   exposure/path verification; resolve real tenant assets, verified scope,
   deployment environment, maintenance window, runner and telemetry sources.
2. **Build a campaign.** Search scenarios by ATT&CK technique, OS, engine,
   prerequisites, privilege, supported version and measured readiness. Show
   exact actions, expected signals, resource limits and cleanup requirements.
   Import content as untrusted data; never evaluate embedded commands at intake.
3. **Preview and approve.** Compile a deterministic plan and digest. Bind policy
   and approvals to tenant, scope version, runner, content pin, inputs, time
   window and digest. Any material change requires a new decision. Explain
   each missing prerequisite without turning an approval into a runtime bypass.
4. **Execute predictably.** Signed outbound tasks, adapter-local allowlists,
   expiring leases, replay protection, idempotency, bounded concurrency and
   rate limits. Recheck scope/policy/kill switch before dispatch and lease.
   Stop prevents future dispatch and cancels active work where supported;
   represent delayed or failed cancellation honestly. Persist cleanup status.
5. **Measure controls.** Correlate unique run/step markers, asset, technique,
   rule and event times. Distinguish executed, prevented, detected, logged,
   alerted and routed. No alert is Missed only after a healthy observer and
   completed observation window; outages and missing evidence are Inconclusive.
6. **Validate exposure and paths.** Evidence-backed hop receipts, weakest-hop
   certainty, objective verification and remediation context. Graph discovery
   or a successful tool exit must never imply compromise or exploitability.
7. **Remediate and retest.** Re-run the same versioned scenario with recorded
   environment changes. Compare receipts, control outcomes and cleanup. Reuse
   existing Finding, Remediation and VerificationEvent state; ticket closure
   cannot mark Fixed.
8. **Operate continuously.** Schedules and approved change triggers, quotas,
   maintenance windows, MSSP isolation, content update review, rollback,
   audit export and explainable coverage trends. Stale tests age out of claims.

## Architecture and ontology

Keep Fastify, Next.js, Prisma and the pnpm workspace. Shared contracts belong
in `packages/shared`; content normalization and adapters in `packages/modules`;
tenant governance and orchestration in API services; execution in runner
modules; evidence mapping and reporting in the existing packages.

| BAS concept | Reduction to the existing model |
| --- | --- |
| Scenario | Versioned content referencing a validation module, technique IDs and typed inputs; not an Asset or Finding |
| Campaign | Orchestration over existing missions/runs; not a new inventory or an overlapping validation verdict |
| Step | Existing task/run plus scenario reference, policy decision and receipts |
| Outcome | Existing validation/control states linked to Evidence; execution lifecycle stays separate |
| Identity path | Existing Asset/Signal/Path graph with source and measured hop receipts |
| Coverage | Derived from eligible scenarios, real runs and fresh evidence; declare denominator and time window |

Reuse existing governance, approvals, schedules, secrets, RBAC, audit,
connector clients, queues and runner protocol. Introduce additive persistence
only for proven lifecycle needs, with migrations and tenant isolation tests.

## Delivery sequence

Each row is a separate Plane work item under PERISCAN-583. Adapter work depends
on common execution contracts; telemetry/report work depends on real receipts.

| Wave | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 (PERISCAN-584) | Scope reconciliation and Atomic/Caldera content preview | Contracts, parser/auth/limits tests, documentation and claim checks; no runtime side effects |
| 1 (PERISCAN-585) | Durable scenario registry and campaign compiler | Immutable pins, typed inputs, scope/policy binding, approval invalidation, idempotency, cancel/cleanup lifecycle; schema/service/API tests |
| 2 (PERISCAN-586) | Qualified Atomic execution | Small reviewed cross-platform set in local labs, prerequisites and cleanup, policy/runner negatives, signed receipts; imports never counted as executions |
| 3 (PERISCAN-587) | Caldera operations adapter | Private deployment integration, exact approved ability set, bounded lifecycle, revoke/cancel and report ingestion; integration tests against pinned Caldera |
| 4 (PERISCAN-588) | SharpHound collection and BloodHound paths | Least-privilege collection profile, bounded targets, redacted graph import, license disposition, measured path verification and lab evidence |
| 5 (PERISCAN-589) | Metasploit checks | Reviewed check allowlist, typed options, version pins, no unrestricted console, bounded lab results, explicit unsupported verdicts |
| 6 (PERISCAN-590) | Detection correlation and BAS workspace | Inject/observe receipts, observer-health gates, per-rule results, latency and tuning feedback, evidence-linked UI and retest comparisons |
| 7 (PERISCAN-591) | Additional cloud/content engines and production qualification | Stratus evaluation, ATT&CK layers, schedule/scale/isolation/cancel drills, upgrade/rollback, supported-platform matrix, runbooks and pilot evidence |

## Release bar

“World class” means reliable customer outcomes. Publish supported vectors,
platforms, scenarios, prerequisites and limitations, not an unqualified parity
claim. Release requires real lab and authorized pilot evidence for each
qualified adapter, repeated cleanup/cancellation tests, tenant isolation,
replay/expiry/policy negatives, parser redaction, outage handling and documented
performance budgets. Pin all engines and content, inventory dependencies and
licenses, scan packages, and validate upgrades before promotion.

Track time to first measured outcome, reproducibility, cleanup success,
cancellation latency, detector correlation quality, evidence completeness,
retest closure and stale coverage. Define thresholds against measured pilot
baselines before GA; do not invent benchmarks or customer references.

## Content preview API (wave 0)

`POST /api/v1/bas/content/preview` accepts `provider` (`AtomicRedTeam` or
`Caldera`), `format` (`yaml` or `json`), `sourceRevision`, and `content`.
Tenant Owner/Admin authentication is required. Content is supplied directly;
the server does not fetch URLs, read caller-selected files, install packages,
persist content, run prerequisites, or queue tasks.

The response contains a SHA-256 content digest and normalized scenario IDs,
names, ATT&CK techniques, platforms, executor names and cleanup/prerequisite
presence. Commands, payloads, facts and input defaults are not returned.
Names are untrusted source text and must be rendered as text. Revisions are
caller-declared until a future trusted-content review verifies them.
Every item is `Unreviewed` with `executable: false`. A content preview proves
parseability only; it does not certify safety, runtime availability, licensing,
or any control outcome. YAML aliases/tags and oversized or duplicate definitions
are rejected with a bounded error that does not echo source content.


## Content version registry (wave 1)

Register previewable Atomic/Caldera definitions with
`POST /api/v1/bas/content/versions`. Supply the preview input plus `sourcePath`,
a logical upstream path such as `atomics/T1082/T1082.yaml`. Paths cannot be
absolute, URLs, or contain traversal segments; they are never read from disk.
Tenant administrators can register content; authenticated tenant members can
list and read it.

The response is HTTP 200 with `{ created, version }`. An identical raw content
hash at the same tenant/provider/revision/path returns the original version
with `created: false`; different content at that identity returns HTTP 409
`bas_content_version_conflict`. Different files may share an upstream revision.
Concurrent registrations have the same semantics. Changing a version requires
a new identity; no update/delete endpoint exists.

`GET /api/v1/bas/content/versions` returns metadata summaries, with optional
`provider`, `limit` (1–50, default 25), and `cursor` (the previous page's
`nextCursor`). `GET /api/v1/bas/content/versions/:id` returns the stored preview.
Both use explicit tenant filters and tenant-bound Postgres RLS. A foreign ID
or cursor returns 404. The database application role has no update/delete
privilege on this registry.

Persistence contains normalized scenario metadata and the exact source digest,
not uploaded commands, payloads, prerequisite bodies or input defaults. New
versions and their `bas.content_registered` audit events commit together;
replays do not add duplicate audit events. Imports remain
`UserSuppliedUnverified`, `Unreviewed` and `executable: false`. Registration
creates no mission, validation run, evidence or finding. Caller-supplied
revisions do not establish verified upstream provenance.

Owner/Admin users can promote a registered version to `Reviewed` with
`POST /api/v1/bas/content/versions/:id/promote`. Promotion writes an
insert-only review record and `bas.content_promoted` audit event. It does
not set `executable`, `liveSupported`, or campaign `startable`. Unreviewed
content still cannot start. Promoted Atomic/Caldera/Metasploit content stays
unqualified until PERISCAN-586–589. Typed inputs remain on the campaign plan.
