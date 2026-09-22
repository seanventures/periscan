# Self-contained OSS toolkit and in-network runner

The runner supports qualified BAS/AEV and validation adapters under
[BAS_AEV_PROGRAM.md](BAS_AEV_PROGRAM.md). Implementation must follow
[RUNNER_SPEC.md](RUNNER_SPEC.md), [SECURITY_BOUNDARIES.md](../SECURITY_BOUNDARIES.md)
and [RUNNER_ARCHITECTURE.md](../RUNNER_ARCHITECTURE.md).

## Architecture

The control plane owns tenant authorization, verified scope, scenario/content
versions, policy decisions, approvals, schedules, orchestration and evidence.
The customer runner polls outbound HTTPS for signed, expiring, scope-bound
tasks and returns signed results. Preserve local allowlists, replay protection,
kill switches, bounded concurrency and execution limits. No inbound management
listener, arbitrary shell, reverse SSH or unrestricted task tunnel.

## Qualified tool packaging

Package the required tool and content pins for each certified adapter. Keep
licenses and dependencies inventoried, test install/upgrade/rollback, and make
runtime availability visible. Separate collection, planning, import and
execution states. Atomic, Caldera, SharpHound/BloodHound and Metasploit adapters
are explicit delivery targets; qualify selected scenarios in authorized labs
before making them customer-executable.

## Execution contract

Every task binds tenant, verified scope/version, runner, adapter version,
scenario/content digest, typed inputs, policy decision and any approvals,
expiry, resource limits and expected evidence. Recheck gates before dispatch
and lease. Denied work never queues. The runner independently verifies the
envelope and local scope/allowlist. Revocation blocks new work and cancellation
reports actual active-task status. Persist cleanup and cleanup verification.

Normalize outputs into existing Evidence, Finding and Path contracts. Do not
expose raw scanner output as the main experience. Fixture/import outputs do
not prove execution; Fixed requires measured revalidation. Production claims
need real lab and authorized pilot receipts plus isolation, expiry, replay,
policy-denial, cleanup and cancellation tests.
