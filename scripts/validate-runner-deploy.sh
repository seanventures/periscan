#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/apps/runner/deploy/docker-compose.runner.yml"
K8S_FILE="$ROOT_DIR/apps/runner/deploy/k8s/runner-deployment.yaml"
SYSTEMD_FILE="$ROOT_DIR/apps/runner/deploy/systemd/periscan-runner.service"
ENV_EXAMPLE="$ROOT_DIR/apps/runner/deploy/systemd/runner.env.example"
DEPLOY_README="$ROOT_DIR/apps/runner/deploy/README.md"
RUNNER_README="$ROOT_DIR/apps/runner/README.md"
# P10-12: runner-agent must ship the same class of deploy artifacts as Go runner.
AGENT_COMPOSE_FILE="$ROOT_DIR/apps/runner-agent/deploy/docker-compose.runner-agent.yml"
AGENT_K8S_FILE="$ROOT_DIR/apps/runner-agent/deploy/k8s/runner-agent-deployment.yaml"
AGENT_SYSTEMD_FILE="$ROOT_DIR/apps/runner-agent/deploy/systemd/periscan-runner-agent.service"
AGENT_ENV_EXAMPLE="$ROOT_DIR/apps/runner-agent/deploy/systemd/runner-agent.env.example"
AGENT_DEPLOY_README="$ROOT_DIR/apps/runner-agent/deploy/README.md"
ROADMAP_FILE="$ROOT_DIR/docs/ROADMAP.md"
SELF_CONTAINED_RUNNER_PRD="$ROOT_DIR/docs/PRD_SELF_CONTAINED_RUNNER.md"
PUBLISH_WORKFLOW="$ROOT_DIR/.github/workflows/runner-publish.yml"
SHARED_DOMAIN="$ROOT_DIR/packages/shared/src/domain.ts"
SHARED_RUNNER="$ROOT_DIR/packages/shared/src/runner.ts"

require_file() {
  local path="$1"
  if [ ! -f "$path" ]; then
    echo "missing required deployment artifact: $path" >&2
    exit 1
  fi
}

require_contains() {
  local path="$1"
  local pattern="$2"
  if ! grep -Eq "$pattern" "$path"; then
    echo "expected $path to contain pattern: $pattern" >&2
    exit 1
  fi
}

require_absent() {
  local path="$1"
  local pattern="$2"
  if grep -Eq "$pattern" "$path"; then
    echo "expected $path not to contain pattern: $pattern" >&2
    exit 1
  fi
}

require_document_count_at_least() {
  local path="$1"
  local minimum="$2"
  local count
  count="$(grep -Ec '^apiVersion:' "$path")"
  if [ "$count" -lt "$minimum" ]; then
    echo "expected $path to contain at least $minimum Kubernetes documents, found $count" >&2
    exit 1
  fi
}

require_file "$COMPOSE_FILE"
require_file "$K8S_FILE"
require_file "$SYSTEMD_FILE"
require_file "$ENV_EXAMPLE"
require_file "$DEPLOY_README"
require_file "$RUNNER_README"
require_file "$AGENT_COMPOSE_FILE"
require_file "$AGENT_K8S_FILE"
require_file "$AGENT_SYSTEMD_FILE"
require_file "$AGENT_ENV_EXAMPLE"
require_file "$AGENT_DEPLOY_README"
require_file "$ROADMAP_FILE"
require_file "$SELF_CONTAINED_RUNNER_PRD"
require_file "$PUBLISH_WORKFLOW"
require_file "$SHARED_DOMAIN"
require_file "$SHARED_RUNNER"

require_contains "$COMPOSE_FILE" "read_only: true"
require_contains "$COMPOSE_FILE" "no-new-privileges:true"
require_contains "$COMPOSE_FILE" "cap_drop:"
require_contains "$COMPOSE_FILE" "PERISCAN_RUNNER_PROXY_URL"
require_contains "$COMPOSE_FILE" "PERISCAN_RUNNER_KILL_SWITCH"
require_contains "$COMPOSE_FILE" "PERISCAN_RUNNER_MTLS_CA_FILE"
require_contains "$COMPOSE_FILE" "PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE"
require_contains "$COMPOSE_FILE" "PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE"
require_contains "$COMPOSE_FILE" "periscan_runner_client_key"
require_absent "$COMPOSE_FILE" "PERISCAN_RUNNER_(CA_CERTIFICATE|CERTIFICATE|KEY)_PEM"
require_absent "$COMPOSE_FILE" "^[[:space:]]*ports:"

require_contains "$K8S_FILE" "kind: Deployment"
require_contains "$K8S_FILE" "kind: NetworkPolicy"
require_document_count_at_least "$K8S_FILE" 3
require_contains "$K8S_FILE" "automountServiceAccountToken: false"
require_contains "$K8S_FILE" "runAsNonRoot: true"
require_contains "$K8S_FILE" "runAsUser: 65532"
require_contains "$K8S_FILE" "allowPrivilegeEscalation: false"
require_contains "$K8S_FILE" "readOnlyRootFilesystem: true"
require_contains "$K8S_FILE" "drop:"
require_contains "$K8S_FILE" "PERISCAN_RUNNER_KILL_SWITCH"
require_contains "$K8S_FILE" "PERISCAN_RUNNER_MTLS_CA_FILE"
require_contains "$K8S_FILE" "PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE"
require_contains "$K8S_FILE" "PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE"
require_contains "$K8S_FILE" "periscan-runner-mtls"
require_absent "$K8S_FILE" "PERISCAN_RUNNER_(CA_CERTIFICATE|CERTIFICATE|KEY)_PEM"
require_absent "$K8S_FILE" "containerPort:"
require_absent "$K8S_FILE" "hostPort:"
require_absent "$K8S_FILE" "kind: Service"
require_absent "$K8S_FILE" "kind: Ingress"

require_contains "$SYSTEMD_FILE" "NoNewPrivileges=(true|yes)"
require_contains "$SYSTEMD_FILE" "ProtectSystem=strict"
require_contains "$SYSTEMD_FILE" "RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX"
require_contains "$SYSTEMD_FILE" "EnvironmentFile=-?/etc/periscan/runner.env"
require_contains "$SYSTEMD_FILE" "ExecStart=/usr/local/bin/periscan-runner poll"
require_contains "$SYSTEMD_FILE" "Restart=always"

require_contains "$ENV_EXAMPLE" "PERISCAN_CONTROL_PLANE_URL"
require_contains "$ENV_EXAMPLE" "PERISCAN_RUNNER_ID"
require_contains "$ENV_EXAMPLE" "PERISCAN_RUNNER_AUTH_TOKEN"
require_contains "$ENV_EXAMPLE" "PERISCAN_RUNNER_MTLS_CA_FILE"
require_contains "$ENV_EXAMPLE" "PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE"
require_contains "$ENV_EXAMPLE" "PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE"
require_contains "$ENV_EXAMPLE" "PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM"
require_contains "$ENV_EXAMPLE" "PERISCAN_RUNNER_PROXY_URL"
require_contains "$ENV_EXAMPLE" "PERISCAN_RUNNER_KILL_SWITCH"
require_absent "$ENV_EXAMPLE" "PERISCAN_RUNNER_(CA_CERTIFICATE|CERTIFICATE|KEY)_PEM"

require_contains "$PUBLISH_WORKFLOW" "ghcr.io/seanheiney/periscan-runner"
require_contains "$PUBLISH_WORKFLOW" "docker/build-push-action"

require_contains "$DEPLOY_README" "outbound HTTPS"
require_contains "$DEPLOY_README" "Kubernetes"
require_contains "$DEPLOY_README" "systemd"
require_contains "$DEPLOY_README" "Supabase"
require_contains "$DEPLOY_README" "Post-Deploy Validation"
require_contains "$DEPLOY_README" "k8s/runner-deployment.yaml"
require_contains "$DEPLOY_README" "mTLS client certificate plus bearer token over TLS"
require_contains "$DEPLOY_README" "runner.reachability_check"
require_contains "$DEPLOY_README" "runner.dns_resolution_check"
require_contains "$DEPLOY_README" "runner.tls_certificate_check"
require_contains "$DEPLOY_README" "runner.http_health_check"
require_absent "$DEPLOY_README" "periscan-runner-deploy"
require_absent "$DEPLOY_README" "optional mTLS material"

require_contains "$RUNNER_README" "runner.reachability_check"
require_contains "$RUNNER_README" "runner.dns_resolution_check"
require_contains "$RUNNER_README" "runner.tls_certificate_check"
require_contains "$RUNNER_README" "runner.http_health_check"
require_contains "$RUNNER_README" "POST /api/v1/runners/:id/tasks/check"
require_contains "$RUNNER_README" "Runner-agent task dispatch endpoints"
require_contains "$RUNNER_README" "not Go runner binary modules"
require_contains "$RUNNER_README" "no reverse SSH"

require_contains "$ROADMAP_FILE" "The Go runner executes"
require_contains "$ROADMAP_FILE" "TypeScript runner-agent handles policy-gated AgentLocal"
require_absent "$ROADMAP_FILE" "module-execution framework seam"

require_contains "$SELF_CONTAINED_RUNNER_PRD" "Historical / superseded safety proposal"
require_contains "$SELF_CONTAINED_RUNNER_PRD" "Reverse SSH, arbitrary shells, unrestricted tunnels, and inbound runner listeners remain disallowed"
require_contains "$SELF_CONTAINED_RUNNER_PRD" "SharpHound collection remains blocked pending legal review"
require_contains "$SELF_CONTAINED_RUNNER_PRD" "Caldera live execution and Atomic live execution remain disabled by default"
require_contains "$SELF_CONTAINED_RUNNER_PRD" "Future restricted logical channel"
require_absent "$SELF_CONTAINED_RUNNER_PRD" "agent's reverse tunnel"
require_absent "$SELF_CONTAINED_RUNNER_PRD" "Reverse tunnel:"
require_absent "$SELF_CONTAINED_RUNNER_PRD" "reverse tunnel \\+"

require_contains "$SHARED_DOMAIN" "restricted signed logical channel"
require_contains "$SHARED_DOMAIN" "ServiceViaProxy: \"NotAvailable\""
require_absent "$SHARED_DOMAIN" "scoped reverse tunnel"
require_absent "$SHARED_DOMAIN" "agent's reverse tunnel"

# P10-3 Windows packaging honesty
require_contains "$SHARED_RUNNER" "WindowsService: \"Planned\""

# P10-12 runner-agent deploy safety parity
require_contains "$AGENT_COMPOSE_FILE" "read_only: true"
require_contains "$AGENT_COMPOSE_FILE" "no-new-privileges:true"
require_contains "$AGENT_COMPOSE_FILE" "cap_drop:"
require_contains "$AGENT_COMPOSE_FILE" "PERISCAN_RUNNER_PROXY_URL"
require_contains "$AGENT_COMPOSE_FILE" "PERISCAN_RUNNER_KILL_SWITCH"
require_contains "$AGENT_COMPOSE_FILE" "PERISCAN_RUNNER_MTLS_CA_FILE"
require_absent "$AGENT_COMPOSE_FILE" "^[[:space:]]*ports:"
require_contains "$AGENT_K8S_FILE" "kind: Deployment"
require_contains "$AGENT_K8S_FILE" "kind: NetworkPolicy"
require_document_count_at_least "$AGENT_K8S_FILE" 3
require_contains "$AGENT_K8S_FILE" "automountServiceAccountToken: false"
require_contains "$AGENT_DEPLOY_README" "outbound HTTPS"
require_contains "$AGENT_DEPLOY_README" "WindowsService packaging"
require_contains "$AGENT_DEPLOY_README" "ServiceViaProxy"
require_contains "$AGENT_DEPLOY_README" "NotAvailable"

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    tmp_dir="$(mktemp -d)"
    trap 'rm -rf "$tmp_dir"' EXIT
    printf '%s\n' "-----BEGIN CERTIFICATE----- test -----END CERTIFICATE-----" >"$tmp_dir/runner-ca.pem"
    printf '%s\n' "-----BEGIN CERTIFICATE----- test -----END CERTIFICATE-----" >"$tmp_dir/runner-client.pem"
    printf '%s\n' "-----BEGIN RSA PRIVATE KEY----- test -----END RSA PRIVATE KEY-----" >"$tmp_dir/runner-client.key"
    PERISCAN_CONTROL_PLANE_URL=https://api.periscan.cloud \
      PERISCAN_RUNNER_ID=test-runner \
      PERISCAN_RUNNER_AUTH_TOKEN=test-token \
      PERISCAN_RUNNER_MTLS_CA_SOURCE_FILE="$tmp_dir/runner-ca.pem" \
      PERISCAN_RUNNER_MTLS_CLIENT_CERT_SOURCE_FILE="$tmp_dir/runner-client.pem" \
      PERISCAN_RUNNER_MTLS_CLIENT_KEY_SOURCE_FILE="$tmp_dir/runner-client.key" \
      PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY----- test -----END PUBLIC KEY-----" \
      docker compose -f "$COMPOSE_FILE" config >/dev/null
  else
    echo "docker compose unavailable; skipped compose config validation"
  fi
else
  echo "docker unavailable; skipped compose config validation"
fi

if command -v kubectl >/dev/null 2>&1; then
  if ! kubectl apply --dry-run=client --validate=false -f "$K8S_FILE" >/dev/null 2>&1; then
    echo "kubectl client dry-run could not complete without cluster discovery; offline Kubernetes artifact checks passed"
  fi
else
  echo "kubectl unavailable; skipped Kubernetes dry-run validation"
fi

if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze verify "$SYSTEMD_FILE" >/dev/null
else
  echo "systemd-analyze unavailable; skipped systemd unit validation"
fi

echo "runner deployment artifacts validated"
