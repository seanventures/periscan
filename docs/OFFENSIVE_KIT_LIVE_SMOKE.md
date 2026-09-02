# Controlled Tooling Smoke Runbook

This runbook validates Periscan's tool-bearing images, signed-task runner path,
and governance rails without treating live offensive execution as enabled.

Current first-customer boundary:

- Allowed: image build/smoke, OSS runtime readiness checks, outbound runner
  enrollment/polling, passive or active-non-invasive signed tasks against
  verified scope, redacted evidence upload, and policy-denial proof.
- Not production-enabled by this runbook: reverse SSH, arbitrary tunnels,
  unrestricted ServiceViaProxy transport, credential spray, Kerberos
  enumeration, live SQL injection probing, Metasploit execution, SharpHound
  collection, Caldera live execution, Atomic live execution, Responder, Impacket,
  Pacu, or any other adversarial action.

Binding references:

- `SECURITY_BOUNDARIES.md`
- `docs/RUNNER_SPEC.md`
- `docs/DEPLOY.md`
- `docs/OPEN_SOURCE_VALIDATION_ENGINES.md`
- `docs/EXPORT_CONTROL_AND_AUTHORIZED_USE.md`

## 1. Safety Preconditions

All smoke testing must use a scratch tenant or explicitly approved lab tenant.
Before any task is submitted:

- The target scope must be verified in Periscan.
- The runner must be enrolled with customer-issued credentials and outbound
  HTTPS egress to the control plane.
- The runner local module allowlist must stay limited to passive/non-invasive
  modules unless a separate approved PRD/legal/security gate changes the policy.
- The kill switch and runner revocation path must be known before testing.
- CI must never run live offensive tools. CI may only run fixture, parser,
  policy, image-smoke, and deployment-artifact checks.

If a disabled capability is requested, the correct result is a denied or planned
state with an audit event and no queued live job.

## 2. Stage A - Image Build And Runtime Resolution

This stage touches no customer targets.

### 2.1 Scan Executor

```bash
# Default stage (`runtime`): permissive toolkit only — no GPL redistribution.
docker build -f infra/docker/scan-executor.Dockerfile -t periscan-scan-executor .
docker run --rm periscan-scan-executor bash infra/docker/scan-executor-smoke.sh
```

Then verify current OSS readiness metadata:

```bash
pnpm tools:check -- --phase=Current
```

Expected result: current, policy-allowed tools report available through the
configured runtime. Legal-review or blocked tools remain blocked/unavailable by
policy and must not be treated as failures. Smoke also asserts that
testssl.sh/sqlmap/nikto/whatweb/scout are **absent** from the default image.

Optional lab-only image (conveys GPL tools; not production SaaS):

```bash
docker build --target runtime-legal-review \
  -f infra/docker/scan-executor.Dockerfile \
  -t periscan-scan-executor:legal-review .
docker run --rm periscan-scan-executor:legal-review \
  bash infra/docker/scan-executor-smoke.sh
```

See `docs/DEPLOY.md` "Legal-review tools (Engine Lab opt-in)".

### 2.2 Runner Agent

```bash
docker build -f apps/runner-agent/Dockerfile -t periscan-runner-agent .
docker run --rm periscan-runner-agent bash apps/runner-agent/runner-agent-smoke.sh
```

Expected result: the image starts with the signed-task runner-agent code and no
inbound listener. The image smoke does not prove or enable offensive execution.

## 3. Stage B - Runner Enrollment And Passive Signed Task

1. Enroll the runner from `/runners` or the runner enrollment API.
2. Deploy the runner with:
   - control-plane base URL,
   - runner identity and private key,
   - task-signing public key,
   - passive/non-invasive module allowlist,
   - `PERISCAN_RUNNER_KILL_SWITCH=false`.
3. Confirm the runner polls `POST /api/v1/runners/:id/poll` over outbound HTTPS
   and exposes no inbound service.
4. Dispatch one passive or active-non-invasive signed task, such as DNS, TLS,
   HTTP health, or reachability against verified scope.
5. Confirm the runner verifies the signature, enforces local scope constraints,
   executes the allowlisted module, uploads evidence, and submits a result.

Expected result: signed evidence and audit records exist for the passive task.
No tunnel or live offensive action is required or implied.

## 4. Stage C - Governance Denial Proof

Run these checks before any customer pilot and after any policy change.

| Scenario                                                                       | Expected result                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Unverified scope requests any validation                                       | Denied before queueing; audit event written.                 |
| Verified scope requests disabled Caldera live execution                        | Denied by policy; no job queued.                             |
| Verified scope requests SharpHound collection                                  | Denied/legal-review blocked; no job queued.                  |
| Verified scope requests Atomic live execution (`dryRun:false`)                 | Denied by module constraints before queueing; no job queued. |
| Runner receives non-allowlisted offensive module                               | Denied by local runner policy; executor not called.          |
| Runner receives unsigned, expired, mismatched-runner, or mismatched-scope task | Denied by local verification; executor not called.           |
| Kill switch active                                                             | No task execution; server and local denial/audit path used.  |

Expected result: product-visible status says `Denied`, `RequiresApproval`,
`RequiresVerifiedScope`, `DeniedByPolicy`, or `DeniedByLocalPolicy` as
appropriate. It must never show a disabled live action as executed.

## 5. Stage D - Optional Future Lab Work

The following activities are intentionally outside the first-customer production
smoke and must not be run unless a later approved PRD/legal/security gate,
customer authorization, and release gate explicitly enable them:

- ServiceViaProxy over a restricted logical channel.
- `web.sqli_probe` live SQL-injection probing.
- `identity.cred_spray` or Kerberos user enumeration.
- `exploit.metasploit_check` execution.
- SharpHound collection.
- Caldera live adversary emulation.
- Atomic live execution.
- Impacket, Responder, Pacu, or similar high-impact tooling.

Until that approval exists, keep these capabilities represented as blocked,
planned, fixture/import-only, or denied-by-policy according to the module and OSS
catalog metadata.

## 6. Pass Criteria

A clean current smoke is:

- Scan-executor image builds and passes its in-image smoke.
- Runner-agent image builds and passes its in-image smoke.
- `pnpm tools:check -- --phase=Current` reports expected current readiness.
- A runner enrolls, polls outbound, executes one allowed passive/non-invasive
  signed task, and returns redacted evidence.
- Governance-denial checks prove disabled live/high-impact paths do not queue or
  execute.
- The kill switch and runner revocation path stop execution.
- Evidence IDs and audit event IDs are recorded with the smoke notes.

Do not report a high-impact or live adversarial capability as verified unless it
was enabled through a later approved policy/legal/security release and executed
against authorized scope with evidence.
