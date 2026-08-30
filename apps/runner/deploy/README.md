# Periscan Runner Deployment Examples

These customer-managed examples install the internal runner without changing the PRD runner boundary: outbound HTTPS polling, signed task envelopes, local scope enforcement, no inbound listener, no reverse SSH, and no destructive validation.

## Network And Secrets

- Allow outbound HTTPS `tcp/443` to the Periscan control plane or runner gateway.
- Allow DNS resolution from the runner host or pod.
- Use `PERISCAN_RUNNER_PROXY_URL` when egress must traverse an HTTP or HTTPS proxy
  (first-class on both the Go customer runner and the Node `runner-agent`;
  falls back to `HTTPS_PROXY` / `HTTP_PROXY` — P10-14 corporate SWG parity).
  Mount private CA trust stores when the proxy performs TLS inspection.
- Do not publish ports, create inbound firewall rules, or introduce reverse SSH/VPN remote-access channels for the runner.
- Store issued runner ID, bearer auth token, runner mTLS CA/client certificate/client private key files, task-signing key ID/public key, optional outbound proxy, and kill-switch configuration in customer secret management. The default customer runner transport is mTLS client certificate plus bearer token over TLS and signed task envelopes.

## Docker Compose

```sh
export PERISCAN_CONTROL_PLANE_URL=https://api.periscan.cloud
export PERISCAN_RUNNER_ID=replace-with-issued-runner-id
export PERISCAN_RUNNER_AUTH_TOKEN=replace-with-issued-runner-auth-token
export PERISCAN_RUNNER_MTLS_CA_FILE=/run/secrets/periscan_runner_ca
export PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE=/run/secrets/periscan_runner_client_cert
export PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE=/run/secrets/periscan_runner_client_key
export PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM="$(cat task-signing-public-key.pem)"

docker compose -f apps/runner/deploy/docker-compose.runner.yml config
docker compose -f apps/runner/deploy/docker-compose.runner.yml up -d
```

## Kubernetes

Use [k8s/runner-deployment.yaml](k8s/runner-deployment.yaml) as a starting point.

```sh
kubectl apply --dry-run=client --validate=false -f apps/runner/deploy/k8s/runner-deployment.yaml
kubectl apply -f apps/runner/deploy/k8s/runner-deployment.yaml
```

The manifest defines a `Secret`, one `Deployment`, and an egress-only `NetworkPolicy`. It defines no `Service`, `Ingress`, host port, or container port.

## systemd

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin periscan-runner
sudo install -o root -g root -m 0755 periscan-runner /usr/local/bin/periscan-runner
sudo mkdir -p /etc/periscan
sudo install -o root -g root -m 0600 apps/runner/deploy/systemd/runner.env.example /etc/periscan/runner.env
sudo install -o root -g root -m 0644 apps/runner/deploy/systemd/periscan-runner.service /etc/systemd/system/periscan-runner.service
sudo systemctl daemon-reload
sudo systemctl enable --now periscan-runner
```

Edit `/etc/periscan/runner.env` with issued values before starting the service. Logs are available through `journalctl -u periscan-runner`.

## Supabase Combo

The runner is stateless and never connects to Postgres, Redis, object storage, or Supabase directly. Supabase aliases such as `SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`, and `SUPABASE_STORAGE_*` apply only to the Periscan API/control-plane deployment. The runner points at `PERISCAN_CONTROL_PLANE_URL`.

## Post-Deploy Validation

1. Confirm the runner appears `Active` through `GET /api/v1/runners`.
2. Create or select verified internal scope for the customer target.
3. Request a policy-approved internal runner task for that exact scope: `runner.reachability_check`, `runner.dns_resolution_check`, `runner.tls_certificate_check`, or `runner.http_health_check`.
4. Confirm in-scope tasks complete with normalized evidence and uploaded artifacts where present.
5. Confirm out-of-scope targets reject locally and create audit evidence.

## Static Validation

```sh
pnpm test:runner:deploy
pnpm verify
```

The static validation checks preserve the product safety contract for the deployment examples: no inbound service ports, non-root execution, dropped capabilities, no-new-privileges, proxy support, kill switch support, and documented customer validation steps.
