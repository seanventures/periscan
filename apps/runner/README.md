# Periscan Internal Runner

The internal runner is a Go outbound-only client for policy-approved internal validation tasks. It registers with Periscan Cloud, polls for signed task envelopes, verifies task signatures locally, enforces scope constraints before execution, runs only allowlisted passive/non-invasive internal checks, and submits evidence-backed results over HTTPS.

**Supported Customer Runner (enterprise packaging):** Go `apps/runner` is the production LTS customer package (one image family `periscan-runner`, one deploy guide under `deploy/`, smoke via `pnpm test:runner`). The TypeScript `apps/runner-agent` is an AgentLocal capability companion on the same control plane — not a second enterprise runner SKU. See [docs/SUPPORTED_CUSTOMER_RUNNER.md](../../docs/SUPPORTED_CUSTOMER_RUNNER.md).

**Community InternalRunner OSS does not run in this Go binary.** Community runner-lane engines (`nmap`, `syft`, `subfinder`, `httpx`, `dnsx`, `naabu`, Amass *passive*, `cdxgen`, `tlsx`, …) execute on Node [`apps/runner-agent`](../runner-agent/README.md) via `executeModuleById`. This package implements only the four passive checks listed below. Enrolling only `apps/runner` does not run that pack. Missing agent binaries are `tool_unavailable`, not fabricated findings. Community edition is not a LICENSE flip.

Current design source of truth:

- [RUNNER_ARCHITECTURE.md](../../RUNNER_ARCHITECTURE.md)

Transport direction:

- outbound HTTPS on `443`
- mTLS client certificate plus bearer-token authentication over TLS
- signed task envelopes with per-tenant signing key IDs
- long-poll control channel first
- no reverse SSH, arbitrary shell, unrestricted tunnel, or inbound listener in the current runner design

Implemented cloud API contract:

- `POST /api/v1/runners/registration-tokens`
- `POST /api/v1/runners/register`
- `GET /api/v1/runners`
- `GET /api/v1/runners/:id`
- `POST /api/v1/runners/:id/revoke`
- `POST /api/v1/runners/:id/heartbeat`
- `POST /api/v1/runners/:id/credentials/rotate`
- `POST /api/v1/runners/:id/poll`
- `POST /api/v1/runners/:id/tasks/reachability`
- `POST /api/v1/runners/:id/tasks/check`
- `POST /api/v1/runners/:id/tasks/:taskId/accept`
- `POST /api/v1/runners/:id/tasks/:taskId/reject`
- `POST /api/v1/runners/:id/tasks/:taskId/artifacts`
- `POST /api/v1/runners/:id/tasks/:taskId/result`

Go runner task modules:

- `runner.reachability_check`
- `runner.dns_resolution_check`
- `runner.tls_certificate_check`
- `runner.http_health_check`

// Track C (Exploitation & Kill-Chain): Runner supports ONLY safe versions
// (AgentLocal safe profiles, dry-run/fixture, no live destructive).
// Catalog-only sims (grype/semgrep/killchain planner packs) are non-executable
// planning metadata — never 50k+/hyperattack marketing or live offense.

Runner-agent task dispatch endpoints:

- `POST /api/v1/runners/:id/tasks/measured`
- `POST /api/v1/runners/:id/tasks/discover`

Those endpoints create policy-gated, signed tasks for the TypeScript
`apps/runner-agent` (`periscan.*` measured modules, safe `recon.*` discovery
modules, and Community InternalRunner OSS such as nmap, syft, and subfinder).
They are part of the same runner control-plane API but are not Go runner binary modules.
Community Validate also queues the same OSS as signed InternalRunner tasks on
startMission; the Go binary still cannot execute them. See
[apps/runner-agent/README.md](../runner-agent/README.md).

Implemented runner-side controls:

- rejects runner ID, tenant ID, and signing key ID mismatches
- rejects expired tasks
- rejects missing or invalid Ed25519 task signatures
- rejects non-`InternalRunner` execution environments
- rejects modules outside the local allowlist
- rejects hosts, DNS suffixes, CIDRs, and ports outside the signed scope envelope
- supports `PERISCAN_RUNNER_KILL_SWITCH=true`
- emits normalized reachability evidence manifests and local audit hashes
- uploads normalized evidence to the signed task artifact URL before submitting results when an upload URL is present

Runtime commands:

```sh
go run . register \
  --api http://127.0.0.1:3001 \
  --registration-token "$PERISCAN_REGISTRATION_TOKEN"

# Optional outbound proxy for restrictive firewalls
export PERISCAN_RUNNER_PROXY_URL="http://proxy.internal:3128"

export PERISCAN_RUNNER_TENANT_ID="$(jq -r '.credentials.tenantId' /tmp/periscan-runner-register.json)"
export PERISCAN_RUNNER_MTLS_CA_FILE="/etc/periscan/runner-ca.pem"
export PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE="/etc/periscan/runner-client.pem"
export PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE="/etc/periscan/runner-client.key"
export PERISCAN_TASK_SIGNING_KEY_ID="$(jq -r '.credentials.taskSigningKeyId' /tmp/periscan-runner-register.json)"
export PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM="$(jq -r '.credentials.taskSigningPublicKeyPem' /tmp/periscan-runner-register.json)"

go run . poll-once \
  --api http://127.0.0.1:3001 \
  --runner-id "$PERISCAN_RUNNER_ID" \
  --auth-token "$PERISCAN_RUNNER_AUTH_TOKEN" \
  --mtls-ca-file "$PERISCAN_RUNNER_MTLS_CA_FILE" \
  --mtls-cert-file "$PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE" \
  --mtls-key-file "$PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE" \
  --tenant-id "$PERISCAN_RUNNER_TENANT_ID" \
  --task-signing-key-id "$PERISCAN_TASK_SIGNING_KEY_ID" \
  --task-signing-public-key "$PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM"

# Long-running mode for container/VM deployment.
go run . poll \
  --api https://api.periscan.cloud \
  --runner-id "$PERISCAN_RUNNER_ID" \
  --auth-token "$PERISCAN_RUNNER_AUTH_TOKEN" \
  --mtls-ca-file "$PERISCAN_RUNNER_MTLS_CA_FILE" \
  --mtls-cert-file "$PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE" \
  --mtls-key-file "$PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE" \
  --task-signing-public-key "$PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM"
```

Container packaging:

```sh
pnpm runner:docker:build

docker run --rm \
  -e PERISCAN_CONTROL_PLANE_URL=https://api.periscan.cloud \
  -e PERISCAN_RUNNER_ID="$PERISCAN_RUNNER_ID" \
  -e PERISCAN_RUNNER_AUTH_TOKEN="$PERISCAN_RUNNER_AUTH_TOKEN" \
  -e PERISCAN_RUNNER_MTLS_CA_FILE="$PERISCAN_RUNNER_MTLS_CA_FILE" \
  -e PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE="$PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE" \
  -e PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE="$PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE" \
  -e PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM="$PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM" \
  ghcr.io/seanheiney/periscan-runner:latest poll

docker compose -f apps/runner/deploy/docker-compose.runner.yml up -d
```

Local validation:

Use the repo script. CI installs the Go version declared in `go.mod` (`1.22`) before running this gate. Local validation uses Go `1.22+` when available and otherwise validates in Docker with a copy-based workflow that works even when bind mounts are unavailable. If Docker is available, it also builds the production runner image, verifies it runs as non-root, and checks the binary entrypoint:

```sh
pnpm test:runner
pnpm test:runner:lab
pnpm test:runner:deploy
```

`pnpm test:runner:lab` validates the first-customer safe-module path against local
loopback fixtures: signed in-scope reachability, DNS resolution, TLS certificate
inspection, and HTTP health tasks execute locally and upload normalized evidence
through the task artifact callback without touching external targets.

Customer deployment examples live in [apps/runner/deploy/README.md](/Volumes/DataSSD1/test/periscan/apps/runner/deploy/README.md). They cover Docker Compose, Kubernetes, systemd, GHCR image publishing, outbound proxy support, Supabase/control-plane separation, kill switch usage, and post-deploy reachability/artifact validation. Customer network validation still requires issued runner credentials and verified internal scope.
