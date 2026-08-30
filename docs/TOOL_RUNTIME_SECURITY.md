# Tool Runtime Security

How Periscan executes open-source validation tools safely. This complements
[OPEN_SOURCE_TOOL_ADAPTER_SPEC.md](OPEN_SOURCE_TOOL_ADAPTER_SPEC.md) and
[SECURITY_BOUNDARIES.md](SECURITY_BOUNDARIES.md).

## 1. Execution surfaces

| Surface         | Code                   | Runs                                                                  |
| --------------- | ---------------------- | --------------------------------------------------------------------- |
| SaaS worker     | `apps/worker` (BullMQ) | `ControlPlane` + `ExternalPoA` modules via `execFile` / `docker run`. |
| Internal runner | `apps/runner` (Go)     | Signed tasks over outbound HTTPS long-poll; today reachability only.  |

Tools are invoked through `resolveOpenSourceToolRuntime`, which selects a `binary`,
`docker`, `npx`, `pip`, or `git` runtime. Docker is preferred for untrusted tool code
because it provides process and filesystem isolation.

## 2. Controls in place today

- **Bounded execution** — every manifest declares `timeoutSeconds` (certified to
  1..3600) and `resourceLimits` (CPU units, memory MB, disk MB, max network requests).
- **No shell interpolation** — tools are launched with `execFile`/argument arrays, not
  shell strings, to avoid command injection.
- **Honest unavailability** — a missing runtime yields `ToolUnavailable` /
  `RequiresConfiguration`, never a fabricated finding.
- **Policy-gated invocation** — `evaluatePolicy` must allow the run; denied tasks are
  never queued; BASLite+ requires approval; live execution of disallowed tools is
  blocked by `evaluateModuleStartConstraints`.
- **Scope enforcement** — only verified, in-scope targets are validated.
- **Redaction before persistence** — `redactEvidenceArtifact` strips secrets/PII before
  raw output is stored, and before any model/context exposure.
- **Audit trail** — every run produces a policy decision and an audit event with the
  tool, module, scope, and outcome.
- **Kill switch** — `PERISCAN_EXTERNAL_VALIDATION_KILL_SWITCH` disables external
  validation execution globally.
- **License gate** — only allowed licenses can be enabled; AGPL/SSPL/BSL/etc. blocked,
  GPL/LGPL require legal review (see [OPEN_SOURCE_LICENSE_POLICY.md](OPEN_SOURCE_LICENSE_POLICY.md)).

## 3. Container hardening profile

When a module runs via Docker, the launcher uses
`buildHardenedDockerRunArgs` in `packages/modules/src/index.ts` instead of
hand-built `docker run` arrays. The profile applies:

- `--network none` by default for tools that do not require network, such as
  Gitleaks scanning a checked-out repository.
- Explicit `--network bridge` only for network-requiring tools such as Trivy
  advisory/image lookups, Prowler cloud API reads, Nuclei safe probes, and
  web/recon tools that must reach a verified target.
- `--read-only` root filesystem and a dedicated `/tmp` tmpfs.
- `--cap-drop ALL`, `--security-opt no-new-privileges:true`, and non-root
  user `65532:65532`.
- `--pids-limit 256`, `--memory 512m`, and `--cpus 1` as baseline ceilings.
- No host bind mounts beyond minimal read-only inputs and explicit output
  scratch directories.

Tool image tags remain version-pinned through `OPEN_SOURCE_TOOL_DEFINITIONS`
and environment overrides. Digest pinning remains recommended for production
deployments that mirror the tool images internally.

## 4. Network egress

- Default-deny egress is enforced for Docker-backed tools unless the module code
  explicitly requests `network: "bridge"`.
- The control plane policy still enforces verified scope, target allowlists, rate
  limits, and kill switches before networked modules are queued.
- External-PoA modules, including Nuclei safe profiles, may reach only verified
  in-scope targets through the mission/policy path.
- Per-destination container egress allowlisting remains a deployment-network
  responsibility until Periscan ships a dedicated tool egress proxy.

## 5. Internal-network execution

Internal-network tool execution (beyond reachability) is **not enabled**. The runner's
outbound-only signed-task transport must be preserved (full spec:
[RUNNER_SPEC.md](RUNNER_SPEC.md)). The unified customer agent IS the Internal Runner
(GAP-OSS-AGENT-01 resolved: no reverse SSH / arbitrary shell / tunnel). The runner
enforces a local module allowlist, a safety-level allowlist, nonce-replay rejection, and
a customer kill switch (server dispatch block + local signal). Any plan to run additional
OSS tools inside the customer network must extend the signed-task module framework with
per-tool allowlists, egress controls, evidence return path, and kill switch.

## 6. Verification

- `pnpm modules:certify:check` verifies timeout bounds, safety/approval invariants, and
  evidence wiring for every module.
- `pnpm --filter @periscan/modules test -- hardened` verifies the Docker hardening
  argument builder.
- `pnpm test:security` exercises security boundaries.
- `pnpm tools:check` reports runtime readiness without executing validation logic.
