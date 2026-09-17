// Minimal local configuration for the in-network runner agent. The agent has no
// local intelligence or UI — it only needs to reach the control plane, prove its
// identity, verify signed tasks, and know its allowlist + kill switch. Everything
// else (what to run, against what, with what authorization) comes from the SaaS
// inside each signed task envelope.

export interface RunnerAgentConfig {
  certificateExpiresAt: string | null;
  controlPlaneUrl: string;
  runnerId: string;
  tenantId: string;
  authToken: string;
  signingPublicKeyPem: string;
  signingKeyId: string | null;
  // The agent's own Ed25519 result-signing PRIVATE key (PKCS#8 PEM), whose
  // public half is registered with the control plane. Present → every result is
  // signed over its localAuditSha256 and the server verifies it. Null → legacy
  // unsigned mode (server accepts until the runner is upgraded with a key).
  resultSigningPrivateKeyPem: string | null;
  /**
   * Optional corporate forward-proxy URL for control-plane HTTPS (P10-14).
   * Mirrors Go runner `PERISCAN_RUNNER_PROXY_URL` / HTTPS_PROXY / HTTP_PROXY.
   * When set, Node process env is aligned so undici/fetch and child tools that
   * honor standard proxy env vars route control-plane traffic through the SWG.
   */
  proxyUrl: string | null;
  allowlistedModuleIds: Set<string>;
  allowedSafetyLevels: Set<string>;
  killSwitch: boolean;
  pollIntervalSeconds: number;
  version: string;
}

// Safe in-network modules the agent runs by default. Community runner-lane
// engines (syft + recon/nmap) must stay here. First-party periscan.dns/tls/
// http/tcp stay on the ControlPlane worker and are not required on this list.
// Offensive AgentLocal tools stay off the default; enabling them requires
// PERISCAN_RUNNER_ALLOWLISTED_MODULES plus a matching safety-level policy.
export const DEFAULT_ALLOWLISTED_MODULE_IDS = [
  "runner.reachability_check",
  "runner.dns_resolution_check",
  "runner.tls_certificate_check",
  "runner.http_health_check",
  "periscan.endpoint_benign_marker_emit",
  "recon.host_discovery",
  "recon.service_inventory",
  "recon.subdomain_enum",
  "recon.http_probe",
  "recon.dns_probe",
  // Safe OSS engines (executeModuleById). Offensive IDs stay off this default.
  "gitleaks.repo_secrets",
  "trivy.repo_dependency_scan",
  "trivy.container_scan",
  "osv.repo_dependency_scan",
  "grype.repo_vulnerability_scan",
  "syft.sbom_generate",
  "sigstore.cosign_verify_blob",
  "web.zap_baseline",
  "tlsx.tls_probe",
  "naabu.port_inventory",
  "amass.passive_enum",
  "cdxgen.sbom_generate",
  "trivy.repo_misconfig",
  "detect_secrets.repo_secrets",
  "bandit.python_sast",
  "checkov.iac_posture",
  "pip_audit.python_advisories",
  "sslyze.tls_posture",
  "dockle.dockerfile_cis",
  "gosec.go_sast",
  "kube_linter.manifest_posture",
  "terrascan.iac_posture",
  "kics.iac_posture",
  "kube_score.manifest_score",
  "kube_bench.cis_cluster",
  "conftest.policy_test",
  "git_secrets.repo_secrets",
  "secretlint.repo_secrets",
  "retirejs.js_advisories",
  "govulncheck.go_advisories",
  "cargo_audit.rust_advisories",
  "yara.repo_rules",
  "falco.rules_validate",
  "kubescape.repo_posture",
  "slsa_verifier.provenance",
  "katana.web_crawl",
  "cloudlist.cloud_assets",
  "lynis.host_audit",
  "rustscan.port_inventory"
  // ot_ics.safe_baseline excluded: no live runner payload yet (fixture scaffold).
];

const DEFAULT_ALLOWED_SAFETY_LEVELS = ["PassiveReadOnly", "ActiveNonInvasive"];

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function loadRunnerAgentConfig(
  env: NodeJS.ProcessEnv = process.env
): RunnerAgentConfig {
  const controlPlaneUrl =
    env.PERISCAN_CONTROL_PLANE_URL ?? env.PERISCAN_CONTROL_PLANE_URL_DEFAULT;
  if (!controlPlaneUrl) {
    throw new Error("PERISCAN_CONTROL_PLANE_URL is required.");
  }
  const runnerId = env.PERISCAN_RUNNER_ID;
  if (!runnerId) {
    throw new Error("PERISCAN_RUNNER_ID is required.");
  }
  const authToken = env.PERISCAN_RUNNER_AUTH_TOKEN;
  if (!authToken) {
    throw new Error("PERISCAN_RUNNER_AUTH_TOKEN is required.");
  }
  const signingPublicKeyPem = env.PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM;
  if (!signingPublicKeyPem) {
    throw new Error("PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM is required.");
  }

  const allowlisted = parseList(env.PERISCAN_RUNNER_ALLOWLISTED_MODULES);
  const safetyLevels = parseList(env.PERISCAN_RUNNER_ALLOWED_SAFETY_LEVELS);
  const pollIntervalSeconds = Number.parseInt(
    env.PERISCAN_RUNNER_POLL_INTERVAL_SECONDS ?? "",
    10
  );

  // Parity with Go runner loadConfig (P10-14): first-class proxy, then ambient env.
  const proxyUrl =
    env.PERISCAN_RUNNER_PROXY_URL?.trim() ||
    env.HTTPS_PROXY?.trim() ||
    env.HTTP_PROXY?.trim() ||
    null;

  // Align standard proxy env so Node fetch / undici and child processes honor
  // the same corporate SWG path as the explicit config field.
  if (proxyUrl) {
    env.HTTPS_PROXY = env.HTTPS_PROXY || proxyUrl;
    env.HTTP_PROXY = env.HTTP_PROXY || proxyUrl;
    env.https_proxy = env.https_proxy || proxyUrl;
    env.http_proxy = env.http_proxy || proxyUrl;
  }

  return {
    allowedSafetyLevels: new Set(
      safetyLevels.length > 0 ? safetyLevels : DEFAULT_ALLOWED_SAFETY_LEVELS
    ),
    allowlistedModuleIds: new Set(
      allowlisted.length > 0 ? allowlisted : DEFAULT_ALLOWLISTED_MODULE_IDS
    ),
    authToken,
    certificateExpiresAt: env.PERISCAN_RUNNER_CERTIFICATE_EXPIRES_AT ?? null,
    controlPlaneUrl: controlPlaneUrl.replace(/\/+$/u, ""),
    resultSigningPrivateKeyPem:
      env.PERISCAN_RESULT_SIGNING_PRIVATE_KEY_PEM ?? null,
    killSwitch: parseBoolean(env.PERISCAN_RUNNER_KILL_SWITCH),
    pollIntervalSeconds:
      Number.isFinite(pollIntervalSeconds) && pollIntervalSeconds > 0
        ? pollIntervalSeconds
        : 30,
    proxyUrl,
    runnerId,
    signingKeyId: env.PERISCAN_TASK_SIGNING_KEY_ID ?? null,
    signingPublicKeyPem,
    tenantId: env.PERISCAN_RUNNER_TENANT_ID ?? env.PERISCAN_TENANT_ID ?? "",
    version: env.PERISCAN_RUNNER_VERSION ?? "0.1.0"
  };
}
