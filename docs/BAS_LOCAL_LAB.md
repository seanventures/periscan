# Disposable BAS local qualification

PERISCAN-586 local lab work is **not** customer Atomic execution. Production
module `atomic.control_validation_safe` remains dry-run/fixture
(`liveSupported: false`). `startBasScenario` still denies live Atomic and
never queues (`jobsQueued=0`). Catalog imports and content previews are not
counted as executions.

## Reviewed Linux-safe tests

The T1082 fixture is source-integrity data. T1082 itself has only two
argv-safe Linux definitions. This wave adds a third reviewed Linux-safe
discovery test from the same Atomic pin (T1124 `date`), also as a pinned
argv (never `sh -c`, never YAML-eval):

| GUID | Name | argv | Lab status |
| --- | --- | --- | --- |
| `486e88ea-4f56-470f-9b57-3f4d73f39133` | Hostname Discovery | `/bin/hostname` | Measured receipt: [qa/BAS_ATOMIC_LOCAL_LAB_2026-09-17.json](qa/BAS_ATOMIC_LOCAL_LAB_2026-09-17.json). Plan SHA-256 `dfb5a23f88acc2c3fff36ae5023b923f968afd4abf2ccc3d6b09d771c4436da6`. |
| `fcbdd43f-f4ad-42d5-98f3-0218097e2720` | Environment variables discovery | `/bin/env` | Allowlisted in the harness with the same isolation, prerequisite, cancellation, cleanup, and hashed-output receipt contract. Plan SHA-256 `ff021dfc7fb08a602d4970a0eba2e0151190e3376a1edb85ace67eeb3fea106e`. No second live-container receipt is claimed. |
| `f449c933-0891-407f-821e-7916a21a1a6f` | System Time Discovery in FreeBSD/macOS | `/bin/date` | T1124 fixture at the same source pin. Allowlisted argv with the same isolation, prerequisite, cancellation, cleanup, and hashed-output receipt contract. Plan SHA-256 `5eb5cd8fe2a6fac9ad56933f2cad9779766a39451c8622ddc4f3be03b89d5997`. No live-container receipt is claimed in this wave. T1082 List OS Information (`uname` shell + `#{output_file}`) and kernel-module pipelines remain fail-closed. |

Every other test in the fixture (WinPwn, elevation-required VM checks, kernel
module shell pipelines, catalog dry-run `Invoke-AtomicTest` YAML) **fails
closed**. Those commands are never turned into a shell line.

Detection is **NotMeasured** on all three: no SIEM/EDR observer is attached. This
establishes no exploit, control-effectiveness, or general Atomic platform
coverage claim.

A future campaign compiler can bind the adapter contract (pin, GUID, OS,
prerequisites, cleanup, expected telemetry). Bindings are `labOnly`,
`queueable: false`, and `customerLiveSupported: false`.

## Preview and run

Use a local Docker engine reachable through a Unix socket. Remote TCP/SSH
contexts are rejected. The harness never pulls images during execution.

```bash
pnpm bas:qualify:local
```

Review the displayed source pin, container image digest, isolation settings,
adapter bindings and `planSha256`. Pull the exact `plan.image` separately,
then run the approved hostname plan (the measured path):

```bash
docker pull busybox@sha256:9db7b59979c38555a39def84a31fb98b5296952f9e3afd4f6f11f05b07adfab0
pnpm bas:qualify:local -- --run \
  --approve-plan dfb5a23f88acc2c3fff36ae5023b923f968afd4abf2ccc3d6b09d771c4436da6 \
  --output /tmp/periscan-atomic-qualification.json
```

The output path must be new. It is reserved before execution, written with
owner-only permissions, and never silently replaces an earlier receipt. SIGINT
and SIGTERM request cancellation while allowing cleanup to finish.

## Execution contract

- Source is pinned to upstream commit `11ff111ace63e02825dd44ce8246800203a10ce8`.
  The whole fixture digest and selected definition are verified before execution.
- Only allowlisted argv is invoked: `/bin/hostname`, `/bin/env`, or
  `/bin/date`, with no arguments. YAML is source integrity data; commands are
  not evaluated or passed to a shell.
- Typed inputs are empty for all three reviewed tests. Extra keys fail closed
  before any container is created.
- Prerequisites: local Docker Unix socket, pinned image already present, source
  and plan digests match, scenario allowlisted.
- A unique labelled container uses the exact pinned image, no network, no host
  mounts, a read-only root filesystem, UID/GID 65534, no capabilities, and no new
  privileges. Limits: 64 MiB memory, 0.25 CPU, 16 PIDs, 15 seconds per Docker
  operation, and 8 KiB captured command output.
- The harness binds the inspected local Docker socket for subsequent operations.
  It checks the container's exit state as well as the attach command result.
- Timeout, output overflow and cancellation trigger cleanup. Cleanup checks the
  run label before removal and verifies that the container no longer exists.
  Failed cleanup makes qualification fail, even when execution succeeded.
- Receipts contain output length and SHA-256, not raw output. They include the
  local qualification policy decision, source pin, plan digest, GUID, and
  `countedAsCustomerExecution: false`. They are local unsigned qualification
  records, not signed customer evidence.

If cleanup fails, use the exact `containerName` and `runId` from the receipt to
inspect the run label and remove that lab container. A failed Docker daemon or
lost client cannot guarantee immediate cleanup; the receipt must not be treated
as passing in that state.

The source fixture retains its [upstream MIT notice](legal/ATOMIC_CONTENT_NOTICE.md).
This harness does not install or invoke Invoke-AtomicRedTeam. Production adapter
qualification still requires registry review/binding, signed runner integration,
policy and approval tests, supported-platform evidence, and observer correlation
under the [BAS/AEV program](BAS_AEV_PROGRAM.md).
