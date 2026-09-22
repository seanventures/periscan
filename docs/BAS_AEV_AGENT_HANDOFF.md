# BAS / AEV coding-agent handoff

Owner direction, 2026-09-17: build full BAS and AEV around Periscan using
Atomic Red Team / Invoke-AtomicRedTeam, Caldera, SharpHound/BloodHound,
Metasploit and complementary OSS. Development is authorized. Start qualification
in disposable local labs. This applies to Grok and every other coding agent.

## Continue implementation

1. Read [BAS_AEV_PROGRAM.md](BAS_AEV_PROGRAM.md) and the
   [feature matrix](BAS_AEV_FEATURE_MATRIX.md); track work in Plane PERISCAN-583
   and its delivery issues. No additional product-scope approval is needed.
2. Finish PERISCAN-585 campaign compilation: immutable content versions, typed
   inputs, scope/policy/approval binding, idempotent start, leases, stop/cancel,
   per-step cleanup and durable receipts. Reuse existing missions and runners.
3. Qualify the execution adapters in PERISCAN-586–589, then detection/correlation
   and operator workflows in 590, and additional vectors/production in 591.
4. Treat `Blocked`, `Disabled`, `liveSupported: false`, import-only and
   `qualification_required` as current runtime readiness states. Implement the
   adapter, tests and evidence needed to replace those gates. Those states do
   not prohibit development and do not require another product-scope decision.
5. A missing external credential, integration or customer approval blocks its
   dependent execution step. Continue independent implementation and local-lab
   qualification; record the precise dependency in Plane. PERISCAN-592 records
   existing release-test failures to repair before production qualification.

## Execute within the approved scope

Development authorization does not fabricate an executable adapter or approve
arbitrary customer targets. Preserve verified scope, per-run policy/audit,
tenant isolation, signed outbound runner tasks, finite execution, cancellation,
cleanup and measured evidence. Use the local-lab runbook for real qualification.
Customer-data destruction, real exfiltration, credential theft, persistence,
evasion and uncontrolled exploit chaining remain excluded. Fixed requires a
measured verification event.

## Resuming an existing Grok session

Refresh the checkout from `main` and reread `AGENTS.md` plus this handoff. Use the
current program for implementation decisions and current evidence for shipped
claims. Historical QA captures and earlier session summaries describe older
states; they do not set the present BAS/AEV development scope. Repository edits
cannot change a model's external instructions, permissions or cached context.
