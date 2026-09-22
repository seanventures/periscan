# Full BAS / AEV delivery matrix

Full BAS and AEV are authorized Periscan product objectives. This matrix is the
implementation backlog under [BAS_AEV_PROGRAM.md](BAS_AEV_PROGRAM.md), Plane
PERISCAN-583. Start qualification in disposable local labs. A feature is ready
for customer execution only when its adapter, policy, runner and evidence
paths pass the named acceptance requirements.

## Shared foundation and next implementation

The repository has immutable tenant-scoped Atomic/Caldera content registration,
metadata preview, authenticated scenario APIs, policy decisions and audit,
verified scopes, signed outbound runner tasks, control observation, bounded
marker workflows, evidence, path certainty and verification-based remediation.
The Atomic T1082 local lab harness has a real execution and cleanup receipt.
These are foundations; production execution of the four requested engine
families still needs the adapter work below.

**Next delivery:** PERISCAN-585 campaign compiler. Bind immutable scenario
versions and typed inputs to tenant, verified scope version, runner, policy
and approval digest. Implement transactional start/idempotency, expiring leases,
stop/cancel, per-step cleanup state and durable receipts before expanding
production execution. Test cross-tenant access, stale approval, changed inputs,
expired scope, duplicate start, lost runner, cancellation races and denied work
not queueing. Reuse mission/run/evidence contracts and signed polling transport.

## Feature coverage and acceptance

| Feature | Foundation in repository | Required delivery and acceptance | Plane |
| --- | --- | --- | --- |
| Content lifecycle | Atomic/Caldera preview and immutable source hashes | Trusted pin verification, review/promotion, typed inputs, dependencies, content update diff, deprecation and rollback; unreviewed content cannot execute | 585 |
| Campaign authoring | Scenario catalog and mission planning | ATT&CK/outcome selection, dependency graph, bounded sequencing, exact preview, approval invalidation and reproducible campaign rerun | 585 |
| Execution orchestration | Policy, audit, signed runner jobs | Transactional queue eligibility, quotas, isolation, leases/replay protection, rate limits, stop/cancel, retries and verified cleanup | 585, 591 |
| Endpoint BAS | Atomic imports; local T1082 hostname receipt | Reviewed Atomic/Invoke-AtomicRedTeam tests across declared Windows/Linux/macOS versions, prerequisites, bounded effects, signed receipts, cancellation and cleanup | 586 |
| Adversary emulation | Caldera plan import | Private pinned Caldera API adapter, reviewed ability sets, approved campaign bounds, operation lifecycle, stop and result normalization | 587 |
| Identity AEV | BloodHound-compatible graph import | SharpHound collection profiles with scoped identities/targets, license disposition, bounded collection and redaction; graph edges remain hypotheses until independently measured | 588 |
| Exploitability validation | Metasploit plan/fixture module | Reviewed non-destructive checks with typed options and exact pins; vulnerability presence, check support and measured exploitability remain distinct | 589 |
| Network and segmentation | Reachability/DNS/TLS/HTTP probes and hop receipts | Approved multi-segment scenario chains, source/destination scope, runner placement and weakest-hop certainty; verify each claimed traversal | 585, 589, 591 |
| Detection engineering | SIEM/EDR observation, Sigma metadata, marker emit/observe | Run/asset/rule correlation, observer health and time windows; separate executed, prevented, logged, alerted and routed outcomes; Inconclusive for unavailable telemetry | 590 |
| Web/API and cloud validation | Existing Nuclei/ZAP/Prowler and exposure integrations | Versioned web/API scenarios and Stratus evaluation in disposable accounts, least privilege, synthetic targets/data, resource budgets and verified cleanup | 589, 591 |
| Containers and workloads | Container/IaC/SBOM posture and inventory | Selected workload scenarios on disposable clusters, bounded namespace/account scope, telemetry correlation and resource cleanup | 591 |
| Email, DNS and egress controls | Existing bounded canary workflows | Synthetic markers and owned recipients/domains, delivery/routing evidence and control verdicts; no real data transfer or credential harvesting | 590, 591 |
| Impact validation | Reversible marker and canary patterns | Non-destructive synthetic impact tests with explicit limits, cleanup and detection receipts; customer data and credentials are protected | 586, 590, 591 |
| Path validation and prioritization | Asset/signal/path graph and measured hop receipts | Evidence-backed chained objectives, fresh exposure context, affected assets, control failures and explainable priority; a successful tool exit does not prove compromise | 588, 589, 590 |
| Remediation and regression | Findings, remediation tasks and VerificationEvents | Versioned scenario retest, before/after evidence, verified Fixed/reopened outcomes and change-triggered regression campaigns | 585, 590 |
| Coverage and reporting | ATT&CK map, control observations and evidence exports | Navigator layers, supported-scenario denominator, freshness, platform/vector gaps, per-rule trends and evidence-linked exports; imported content is not executed coverage | 590, 591 |
| Operator workspace and API | Controls/scenarios, missions, registry and reports | Campaign builder, approval preview, execution timeline, stop/cancel, cleanup exceptions, detection tuning and retest comparison from persisted API data | 590 |
| Continuous operation and MSSP | Scheduling, tenant governance and audit foundations | Maintenance windows, per-tenant quotas/RBAC, secrets, approval expiry, support matrix, scale/upgrade/rollback drills and authorized pilot evidence | 591 |

## Readiness semantics

Each adapter/scenario must publish its source pin and status: imported,
unreviewed, lab-qualified, pilot-qualified or production-qualified. Availability,
execution completion, detection outcome and cleanup are separate facts. The
BAS scenario API uses `qualification_required` for unqualified live adapters;
`startable: false`, policy denial and zero queued jobs remain accurate until
an implementation passes qualification.

The current module-level `PERISCAN_LIVE_OFFENSIVE` / `sowId` preflight does not
implement an Atomic executor. Passing it alone does not bypass the policy
service's live-pack denial or make an imported test executable. Replace those
runtime exclusions only together with reviewed adapters, plan-bound policy,
signed execution and measured evidence. A customer authorization record follows
[BAS_EXECUTION_AUTHORIZATION.md](competitive/BAS_EXECUTION_AUTHORIZATION.md).

## Development and release checks

Run `pnpm bas:scope:check` for contradictory guidance, plus the shared, policy,
module, service/API and runner tests affected by each feature. Run tenant/RLS
integration tests for persistence changes. The complete release gate is
`pnpm verify`; report any failures with exact evidence in Plane. PERISCAN-592
tracks the previously observed web release-gate failures and must be rechecked
against the candidate release.

Qualification requires real disposable-lab receipts followed by authorized
pilot evidence, platform-specific support records, dependency/license review,
parser/output bounds and redaction, tenant isolation, policy/replay/expiry
negatives, observer outages, cancellation/cleanup drills and performance
budgets. Development is authorized across this matrix; release claims follow
measured coverage.
