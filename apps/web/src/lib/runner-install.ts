/**
 * Pure runner install-snippet helpers for UI pairing and docs alignment.
 *
 * Product honesty (P10-3 / docs/SUPPORTED_CUSTOMER_RUNNER.md):
 * - Primary: Supported Customer Runner (Go LTS) — ghcr.io/seanheiney/periscan-runner
 * - Optional: Agent (in-network) lab/AgentLocal — ghcr.io/seanheiney/periscan-runner-agent
 * Never present the agent image as "the" LTS customer runner.
 */

/** GA install modes only — WindowsService is Planned (P10-3), not offered here. */
export const DEPLOYMENT_MODES = [
  "Docker",
  "SystemdService",
  "Kubernetes"
] as const;
export type RunnerDeploymentMode = (typeof DEPLOYMENT_MODES)[number];

/**
 * Public control-plane origin used in install snippets (UI pairing host).
 * Deploy guides often show `https://api.periscan.cloud` as the API base;
 * both resolve to the same product control plane in GA.
 */
export const RUNNER_CONTROL_PLANE = "https://app.periscan.com";

/**
 * Supported Customer Runner (Go LTS) — production primary image family.
 * Aligns with `apps/runner/deploy`, `runner-publish.yml`, and
 * `docs/SUPPORTED_CUSTOMER_RUNNER.md`.
 */
export const SUPPORTED_CUSTOMER_RUNNER_IMAGE =
  "ghcr.io/seanheiney/periscan-runner:latest";

/**
 * Agent (in-network) — optional lab / AgentLocal companion image.
 * Same control-plane contract; not the production LTS package.
 * Aligns with `apps/runner-agent/deploy` and `images-build.yml`.
 */
export const IN_NETWORK_AGENT_IMAGE =
  "ghcr.io/seanheiney/periscan-runner-agent:latest";

export type RunnerInstallPackage = "supportedCustomer" | "agentInNetwork";

export interface InstallCommandOptions {
  controlPlaneUrl?: string;
  /**
   * `supportedCustomer` (default): Go Supported Customer Runner register path.
   * `agentInNetwork`: optional Agent (in-network) deploy hint — credentials
   * after enrollment, not a second LTS product.
   */
  package?: RunnerInstallPackage;
}

/**
 * Pure install-snippet generator for runner pairing.
 * Prefer Supported Customer Runner; agent path is explicitly optional/lab.
 */
export function installCommand(
  mode: RunnerDeploymentMode,
  token: string,
  options: InstallCommandOptions = {}
): string {
  const controlPlane = options.controlPlaneUrl ?? RUNNER_CONTROL_PLANE;
  const pkg = options.package ?? "supportedCustomer";

  if (pkg === "agentInNetwork") {
    return agentInNetworkInstallHint(mode, controlPlane);
  }

  switch (mode) {
    case "Docker":
      return `docker run --rm \\
  -e PERISCAN_CONTROL_PLANE_URL=${controlPlane} \\
  -e PERISCAN_REGISTRATION_TOKEN=${token} \\
  ${SUPPORTED_CUSTOMER_RUNNER_IMAGE} register`;
    case "SystemdService":
      return `# Supported Customer Runner (Go LTS) — systemd host install
curl -fsSL ${controlPlane}/install/runner.sh | \\
  sudo PERISCAN_REGISTRATION_TOKEN=${token} \\
  PERISCAN_CONTROL_PLANE_URL=${controlPlane} sh
# Binary/image lineage: periscan-runner (apps/runner). See apps/runner/deploy/README.md.`;
    case "Kubernetes":
      return `# Supported Customer Runner (Go LTS) — Kubernetes
kubectl create secret generic periscan-runner \\
  --from-literal=token=${token} \\
  --from-literal=control-plane-url=${controlPlane} && \\
kubectl apply -f ${controlPlane}/install/runner.yaml
# Image: ${SUPPORTED_CUSTOMER_RUNNER_IMAGE}
# Manifest reference: apps/runner/deploy/k8s/runner-deployment.yaml`;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * Optional Agent (in-network) install guidance. AgentLocal companion only —
 * not marketed as the Supported Customer Runner / LTS package.
 * Does not consume the one-time registration token alone (agent needs issued
 * runner id + auth token after enrollment).
 */
export function agentInNetworkInstallHint(
  mode: RunnerDeploymentMode,
  controlPlaneUrl: string = RUNNER_CONTROL_PLANE
): string {
  const header = `# Agent (in-network) — optional lab / AgentLocal companion
# Not the Supported Customer Runner (Go LTS). Prefer ${SUPPORTED_CUSTOMER_RUNNER_IMAGE}
# for production private-network enrollment, then use this image only when you need
# AgentLocal measured/recon modules on the same control-plane contract.
# Image: ${IN_NETWORK_AGENT_IMAGE}
# Deploy examples: apps/runner-agent/deploy/`;

  switch (mode) {
    case "Docker":
      return `${header}
# After enrollment credentials exist (runner id + auth token + mTLS + signing key):
docker run -d --name periscan-runner-agent --restart unless-stopped \\
  -e PERISCAN_CONTROL_PLANE_URL=${controlPlaneUrl} \\
  -e PERISCAN_RUNNER_ID=<issued-runner-id> \\
  -e PERISCAN_RUNNER_AUTH_TOKEN=<issued-auth-token> \\
  -e PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM="<issued-public-key>" \\
  ${IN_NETWORK_AGENT_IMAGE}`;
    case "SystemdService":
      return `${header}
# systemd unit example: apps/runner-agent/deploy/systemd/periscan-runner-agent.service
# Install issued credentials into /etc/periscan/runner-agent.env before enable.`;
    case "Kubernetes":
      return `${header}
# kubectl apply -f apps/runner-agent/deploy/k8s/runner-agent-deployment.yaml
# Image default in manifest: ${IN_NETWORK_AGENT_IMAGE}`;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
