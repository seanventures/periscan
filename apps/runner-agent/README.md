# Periscan runner-agent

Node outbound-only agent on the same signed-task control plane as Go [`apps/runner`](../runner/README.md).

**Community InternalRunner OSS runs here, not in Go `apps/runner`.** Community runner-lane engines (`nmap`, `syft`, `subfinder`, `httpx`, `dnsx`, `naabu`, Amass *passive*, `cdxgen`, `tlsx`, …) execute in this process via `@periscan/modules` `executeModuleById`. The Go runner implements only four passive checks (reachability, DNS, TLS, HTTP health). Enrolling only `apps/runner` does not run that pack.

This is the AgentLocal companion — not a second enterprise SKU and not a LICENSE flip. Production LTS packaging is still Go `apps/runner`. See [docs/SUPPORTED_CUSTOMER_RUNNER.md](../../docs/SUPPORTED_CUSTOMER_RUNNER.md) and [COMMUNITY.md](../../COMMUNITY.md).

Most Community scanners (Gitleaks, Trivy, Prowler, …) still run on the ControlPlane worker. Only Community entries with `executionMode: InternalRunner` (`listCommunityRunnerLaneEntries()`) need this agent.

## What it does

- Outbound HTTPS poll, signed envelopes, local scope + module allowlist, kill switch
- Default allowlist: Community runner-lane OSS + safe recon (see `DEFAULT_ALLOWLISTED_MODULE_IDS` in `src/config.ts`)
- Missing binaries return honest `tool_unavailable` / `RequiresConfiguration` — never fabricated findings
- Offensive IDs (Atomic, Caldera, SharpHound, sqlmap, Metasploit, cred-spray) stay off the default allowlist

The default image ships nmap (NPSL — notices in `licenses/THIRD_PARTY_NOTICES.md`) plus ProjectDiscovery `subfinder` / `httpx` / `dnsx`. Other engines run only when the operator has installed and enabled them.

## Run

Customer deploy examples: [deploy/README.md](deploy/README.md) (Compose, Kubernetes, systemd). Image: `ghcr.io/seanheiney/periscan-runner-agent`.

```sh
pnpm --filter @periscan/runner-agent test
pnpm --filter @periscan/runner-agent start
```

`start` needs issued runner identity (`PERISCAN_CONTROL_PLANE_URL`, `PERISCAN_RUNNER_ID`, `PERISCAN_RUNNER_AUTH_TOKEN`, `PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM`).

## Safety

Same boundary as the Go runner: outbound HTTPS only, no inbound listener, no reverse SSH, no destructive validation. Denied tasks never execute.
