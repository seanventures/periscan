# Runner Fleet Operations Runbook

## Purpose and security boundary

The runner fleet provides authenticated, outbound-only execution for authorized
in-network security measurements. A runner never opens an inbound management
port and cannot accept arbitrary shell commands. The control plane leases only
signed, expiring tasks that pass tenant, verified-scope, safety-level, module
allowlist, policy, and kill-switch checks. The runner enforces the envelope and
its own local allowlists again before execution.

The fleet UI is an operating surface, not evidence that a security control
worked. A heartbeat proves authenticated liveness. A security conclusion still
requires a signed task result and governed evidence.

## Normal operating loop

1. Open `/runners` and start with **Fleet healthy** and **Needs attention**.
   The runner rail orders offline, late, and halted agents ahead of healthy
   agents.
2. Select a runner. In **Liveness signal**, check the server-received age,
   heartbeat history, queue depth, certificate time remaining, and agent
   version.
3. Read every **Operator attention** item. Inspect **Task activity** for the
   signed module, safety level, state, error summary, and redacted evidence
   count.
4. Refresh manually for an incident or leave the page open for the 15-second
   visibility-aware refresh. Background tabs do not generate continuous API
   traffic.
5. Record any investigation in the configured escalation system using the
   policy's support owner and escalation reference.

## Health derivation

Health is derived from the last authenticated server receipt, not solely from a
host-supplied timestamp.

| State        | Meaning                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Healthy      | Last server receipt is younger than `attentionAfterSeconds`.                                     |
| Attention    | Receipt is late or the runner reports `Degraded`.                                                |
| Offline      | No receipt exists, receipt is older than `offlineAfterSeconds`, or the runner reports `Offline`. |
| Halted       | The server kill switch is active.                                                                |
| Revoked      | Runner credentials have been revoked.                                                            |
| Provisioning | Enrollment exists but the runner is not operating yet.                                           |

Revoked takes precedence over halted, and halted takes precedence over
heartbeat freshness. Each poll persists an immutable heartbeat sample with
server receipt time, host observation time, queue state, version, active task
reference, last completion time, and certificate expiry when reported.

## Seal fleet policy

Open **Fleet operating policy**, then set:

- attention and offline thresholds (offline must be later);
- queue-depth and certificate-expiry warnings;
- the minimum supported semantic agent version;
- the named support owner and an external escalation reference.

Choose **Seal fleet policy**. The policy is tenant-scoped and the change writes
an audit event. Until policy is sealed, safe default thresholds are used and the
UI displays a setup alert.

## Emergency halt and release

1. Select the runner and choose **Emergency halt**.
2. Confirm the action. Server enforcement begins immediately: no new task is
   leased even before the host checks in.
3. Watch **Kill-switch host ack**. `Pending` means the control plane has halted
   work but the host has not yet observed the command. The next authenticated
   outbound poll acknowledges it.
4. Investigate the host and any active or failed task. Preserve task and
   heartbeat history.
5. Choose **Release halt** only after the operating condition is cleared. Scope,
   policy, signature, nonce, expiry, and local allowlist checks remain active.

## Revoke a runner

Revocation permanently invalidates that runner identity. Select **Revoke**, type
the exact runner name, and confirm only when compromise, decommission, or
credential retirement requires it. A revoked identity cannot be restored;
enroll a replacement. Host acknowledgement is tracked separately because a
revoked/offline host may never poll again.

## Pair and verify

1. Open **Pair and deploy a runner**, enter a unique name and deployment mode,
   then choose **Start pairing**.
2. Run the displayed one-time command only on an authorized host. Do not paste
   the token into chat, tickets, or logs.
3. Wait for first check-in, then compare the UI certificate fingerprint with the
   fingerprint printed by the host.
4. Open **Network and transport contract** and use the persisted gateway FQDN,
   port, and proxy values in the firewall request. DNS and outbound HTTPS are
   sufficient; do not open an inbound rule.

The runner should report:

```text
PERISCAN_RUNNER_ID=<issued UUID>
PERISCAN_RUNNER_AUTH_TOKEN=<issued secret>
PERISCAN_RUNNER_TENANT_ID=<issued tenant UUID>
PERISCAN_RUNNER_VERSION=<deployed semantic version>
PERISCAN_RUNNER_CERTIFICATE_EXPIRES_AT=<ISO-8601 expiry when available>
```

## Certificate and version response

- Rotate a certificate before the configured warning window closes. The agent
  reports its expiry on every poll; a missing report is shown honestly rather
  than guessed.
- Upgrade agents below the minimum version. A version warning does not itself
  execute an upgrade or bypass change control.
- If a certificate is expired or identity may be compromised, halt first, then
  rotate or revoke according to the incident decision.

## Demo mode

The demo login seeds three persisted runners with the `demo` label: a healthy
datacenter runner, a degraded/high-queue plant-edge runner with an expiring
certificate and old version, and an offline legacy-segment runner. Their
heartbeat samples and task history are persisted and explicitly marked as
demonstration data. They never represent customer agents or live execution.

## Multi-node lease recovery drill (Slice 10 Phase A)

Release qualification requires an exercised multi-node failure path, not only
single-runner reaper coverage.

**What “recovered” means**

1. A runner that goes silent while holding a **Leased** task whose `expiresAt`
   has passed is not allowed to strand a validation run forever.
2. The system-wide reaper (`expireStaleRunnerTasks`) marks overdue leased tasks
   **Expired** and fails their stranded runs with an error summary that includes
   `expired`.
3. A second healthy runner in the same tenant with a still-valid lease is
   **untouched** — reaper impact is per-task expiry, not “halt the whole fleet.”
4. An overdue lease on a still-healthy runner identity also expires (lease
   expiry is authoritative; runner identity does not privilege a stuck task).

**How to exercise**

- Automated: `pnpm exec vitest run tests/acceptance/runner-multi-node-reaper-flow.test.ts`
  and `tests/acceptance/runner-task-reaper-flow.test.ts`.
- Manual ops: halt or network-partition one runner mid-lease; wait past task
  expiry + continuous-validation sweep interval; confirm the run fails and the
  peer runner continues leasing.

**Non-claims**

This drill proves lease recovery and multi-node isolation of reaper impact. It
does **not** prove concurrent-runner soak, multi-API-replica lease failover, or
published p95 lease latency (see Scale and HA non-claims below).

## Verification checklist

- `pnpm --filter @periscan/shared test`
- `pnpm --filter @periscan/api test`
- `pnpm --filter @periscan/runner-agent test`
- `pnpm --filter @periscan/web test -- runner-fleet-control-room.test.tsx`
- `pnpm --filter @periscan/db db:validate`
- Multi-node lease recovery: `pnpm exec vitest run tests/acceptance/runner-multi-node-reaper-flow.test.ts`
- Apply migrations and run `pnpm db:seed:demo`, sign in with the documented demo
  login, follow the inline runner help, and verify `/runners` at desktop and
  mobile widths.

## Scale and HA non-claims (P10-5)

Fleet control room, heartbeat samples, and sealed operating policy are production-usable for **ops visibility**. They do **not** substitute for:

- Concurrent-runner soak (100 / 500 / 2000) with published p95 lease latency
- Multi-API-replica lease failover qualification
- Documented max runners per tenant entitlement

Until those exist, commercial capacity language must stay qualitative.
