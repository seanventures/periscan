# Periscan Runner-Agent Deployment Examples

Customer-managed examples for the **TypeScript runner-agent** — labeled **Agent (in-network)** in product UI. Optional lab / AgentLocal companion for measured (`periscan.*`) and safe recon modules, plus a SOCKS handler for a future ServiceViaProxy product path. Same safety boundary as the Go runner: outbound HTTPS polling, signed task envelopes, local scope enforcement, no inbound listener, no reverse SSH.

**Community InternalRunner OSS (`nmap`, `syft`, `subfinder`, …) runs on this Node agent, not Go `apps/runner`.** See the [package README](../README.md). Community edition is not a LICENSE flip.

> **Supported Customer Runner (P10-2 / P10-3):** Production LTS is Go `apps/runner` (`ghcr.io/seanheiney/periscan-runner`). This Agent (in-network) image (`ghcr.io/seanheiney/periscan-runner-agent`) is **optional** for sites that need AgentLocal modules — not a second enterprise SKU or “the” LTS runner. Prefer `apps/runner/deploy/` for baseline private-network enrollment.

## Product honesty (P10)

| Capability | Status |
| --- | --- |
| Docker / systemd / Kubernetes deploy examples | **Available** (this tree) |
| WindowsService packaging | **Planned** — enum only; no MSI/WinSW |
| ServiceViaProxy control-plane multiplex | **NotAvailable** — local SOCKS SEAM only |
| mTLS client certs + bearer + signed tasks | **Available** (enable `PERISCAN_RUNNER_REQUIRE_MTLS` in production) |
| Corporate proxy | Set `PERISCAN_RUNNER_PROXY_URL` / standard `HTTPS_PROXY` |

## Network And Secrets

- Allow outbound HTTPS `tcp/443` to the Periscan control plane.
- Allow DNS resolution from the runner host or pod.
- Use `PERISCAN_RUNNER_PROXY_URL` when egress must traverse an HTTP or HTTPS proxy.
- Do not publish ports, create inbound firewall rules, or introduce reverse SSH/VPN remote-access channels.
- Store issued runner ID, bearer auth token, mTLS material, and task-signing public key in customer secret management.

## Docker Compose

```sh
export PERISCAN_CONTROL_PLANE_URL=https://api.periscan.cloud
export PERISCAN_RUNNER_ID=replace-with-issued-runner-id
export PERISCAN_RUNNER_AUTH_TOKEN=replace-with-issued-runner-auth-token
export PERISCAN_RUNNER_MTLS_CA_SOURCE_FILE=/path/to/runner-ca.pem
export PERISCAN_RUNNER_MTLS_CLIENT_CERT_SOURCE_FILE=/path/to/runner-client.pem
export PERISCAN_RUNNER_MTLS_CLIENT_KEY_SOURCE_FILE=/path/to/runner-client.key
export PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM="$(cat task-signing-public-key.pem)"

docker compose -f apps/runner-agent/deploy/docker-compose.runner-agent.yml config
docker compose -f apps/runner-agent/deploy/docker-compose.runner-agent.yml up -d
```

## Kubernetes

Use [k8s/runner-agent-deployment.yaml](k8s/runner-agent-deployment.yaml) as a starting point.

```sh
kubectl apply --dry-run=client --validate=false -f apps/runner-agent/deploy/k8s/runner-agent-deployment.yaml
kubectl apply -f apps/runner-agent/deploy/k8s/runner-agent-deployment.yaml
```

The manifest defines a `Secret`, one `Deployment`, and an egress-only `NetworkPolicy`. It defines no `Service`, `Ingress`, host port, or container port. Defaults: non-root (`65532`), read-only root FS, dropped capabilities, automountServiceAccountToken false.

## systemd

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin periscan-runner-agent
sudo install -o root -g root -m 0755 periscan-runner-agent /usr/local/bin/periscan-runner-agent
sudo mkdir -p /etc/periscan
sudo install -o root -g root -m 0600 apps/runner-agent/deploy/systemd/runner-agent.env.example /etc/periscan/runner-agent.env
sudo install -o root -g root -m 0644 apps/runner-agent/deploy/systemd/periscan-runner-agent.service /etc/systemd/system/periscan-runner-agent.service
sudo systemctl daemon-reload
sudo systemctl enable --now periscan-runner-agent
```

Edit `/etc/periscan/runner-agent.env` with issued values before starting. Logs: `journalctl -u periscan-runner-agent`.

## Post-Deploy Validation

1. Confirm the runner appears `Active` through `GET /api/v1/runners`.
2. Create or select verified internal scope for the customer target.
3. Request a policy-approved AgentLocal / measured task for that exact scope.
4. Confirm in-scope tasks complete with normalized evidence.
5. Confirm out-of-scope targets reject locally and create audit evidence.

## Static Validation

```sh
pnpm test:runner:deploy
```

Deploy artifact checks cover both Go runner and runner-agent trees (outbound-only, non-root, proxy/kill-switch, mTLS file paths).
