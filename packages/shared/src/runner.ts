import { z } from "zod";

import {
  EvidenceArtifactSchema,
  EvidenceArtifactTypeSchema,
  ExecutionEnvironmentSchema,
  RedactionStatusSchema,
  SafetyLevelSchema,
  SignalEnvelopeSchema,
  ValidationMissionSchema,
  ValidationRunSchema,
  ValidationStateSchema
} from "./domain";

const IdSchema = z.string().uuid();
const TimestampSchema = z.string().datetime();
const StringListSchema = z.array(z.string().min(1));
const LooseObjectSchema = z.record(z.string(), z.unknown());

export const RunnerDeploymentModeSchema = z.enum([
  "Docker",
  "SystemdService",
  "Kubernetes",
  // Wire-compat enum only. No MSI/WinSW package ships today (P10-3).
  // Product readiness is Planned — see RUNNER_DEPLOYMENT_MODE_PRODUCT_STATUS.
  "WindowsService"
]);

/**
 * P10-3 honesty: which deployment modes have real packaging vs catalog fiction.
 * - Available — Docker / systemd / Kubernetes examples exist under apps/runner
 *   and apps/runner-agent deploy trees.
 * - Planned — WindowsService remains enum-compatible but must not be sold or
 *   demo-seeded as a live install channel until a signed Windows package lands.
 */
export const RunnerDeploymentModeProductStatusSchema = z.enum([
  "Available",
  "Planned"
]);
export type RunnerDeploymentModeProductStatus = z.infer<
  typeof RunnerDeploymentModeProductStatusSchema
>;

export const RUNNER_DEPLOYMENT_MODE_PRODUCT_STATUS: Record<
  z.infer<typeof RunnerDeploymentModeSchema>,
  RunnerDeploymentModeProductStatus
> = {
  Docker: "Available",
  SystemdService: "Available",
  Kubernetes: "Available",
  WindowsService: "Planned"
};

export function isRunnerDeploymentModeAvailable(
  mode: z.infer<typeof RunnerDeploymentModeSchema>
): boolean {
  return RUNNER_DEPLOYMENT_MODE_PRODUCT_STATUS[mode] === "Available";
}

export function runnerDeploymentModeLabel(
  mode: z.infer<typeof RunnerDeploymentModeSchema>
): string {
  if (mode === "WindowsService") {
    return "Windows (Planned)";
  }
  return mode;
}

export const RunnerStatusSchema = z.enum([
  "Provisioning",
  "Active",
  "Degraded",
  "Offline",
  "Revoked",
  "KillSwitchActive"
]);

export const RunnerRegistrationTokenStatusSchema = z.enum([
  "Active",
  "Used",
  "Expired",
  "Revoked"
]);

export const RunnerTaskStatusSchema = z.enum([
  "Queued",
  "Leased",
  "Running",
  "Completed",
  "Failed",
  "Rejected",
  "Expired",
  "Cancelled",
  "Accepted",
  "DeniedByLocalPolicy",
  "DeniedByServerPolicy"
]);

/**
 * All control-channel names that may appear in transport *decision* tables
 * (including historically considered, currently Disallowed channels).
 * **Never issue ReverseSsh to a runner** — it exists only so
 * `listDefaultRunnerTransportDecisions` can record Disallowed status.
 * Customer-facing issued bindings use `IssuedRunnerControlChannelSchema`.
 */
export const RunnerControlChannelSchema = z.enum([
  "LongPollHttps",
  "WebSocketHttps",
  "ReverseSsh"
]);

/** Channels the control plane may actually issue to a runner registration. */
export const IssuedRunnerControlChannelSchema = z.enum([
  "LongPollHttps",
  "WebSocketHttps"
]);

export const RunnerTransportDecisionStatusSchema = z.enum([
  "Primary",
  "SupportedLater",
  "Disallowed"
]);

export const RunnerSignatureAlgorithmSchema = z.enum(["EdDSA", "ES256"]);

export const RunnerCapabilitiesSchema = z.object({
  supportsArtifactUpload: z.boolean(),
  supportsHttpConnectProxy: z.boolean(),
  supportsLocalReachability: z.boolean(),
  supportsLongPoll: z.boolean(),
  supportsWebSocket: z.boolean()
});

export const RunnerNetworkProfileSchema = z.object({
  additionalEgressNotes: z.string().min(1).nullish(),
  dnsResolutionRequired: z.boolean().default(true),
  explicitProxyUrl: z.url().nullish(),
  gatewayHostnames: StringListSchema.min(1),
  httpConnectProxySupported: z.boolean().default(true),
  outboundHttpsPorts: z.array(z.number().int().min(1).max(65535)).min(1)
});

export const RunnerScopeConstraintSchema = z.object({
  approvedCidrs: StringListSchema.default([]),
  approvedDnsSuffixes: StringListSchema.default([]),
  approvedHostnames: StringListSchema.default([]),
  approvedPorts: z.array(z.number().int().min(1).max(65535)).default([]),
  forbidInternetEgress: z.boolean().default(false)
});

export const RunnerTransportDecisionSchema = z.object({
  channel: RunnerControlChannelSchema,
  notes: StringListSchema.default([]),
  reason: z.string().min(1),
  status: RunnerTransportDecisionStatusSchema
});

export const RunnerRecordSchema = z.object({
  arch: z.string().min(1),
  certificateExpiresAt: TimestampSchema.nullish(),
  certificateSha256: z.string().min(64).max(64).nullish(),
  createdAt: TimestampSchema,
  createdBy: IdSchema.nullish(),
  deploymentMode: RunnerDeploymentModeSchema,
  hostname: z.string().min(1),
  killSwitchActivatedAt: TimestampSchema.nullish(),
  killSwitchActivatedBy: IdSchema.nullish(),
  killSwitchAcknowledgedAt: TimestampSchema.nullish().optional(),
  killSwitchActive: z.boolean().default(false),
  killSwitchReason: z.string().min(1).nullish(),
  labels: StringListSchema,
  lastSeenAt: TimestampSchema.nullish(),
  name: z.string().min(1),
  networkProfile: RunnerNetworkProfileSchema,
  /**
   * P10-15 multi-site routing: logical network segment (VRF / plant cell / VLAN group).
   * Null when the runner is not site-scoped (single-site tenants).
   */
  networkSegment: z.string().trim().min(1).max(128).nullish(),
  os: z.string().min(1),
  revokedAt: TimestampSchema.nullish(),
  revocationAcknowledgedAt: TimestampSchema.nullish().optional(),
  runnerId: IdSchema,
  /**
   * P10-17 Segment Runner SKU profile when enrolled as a field segment agent.
   * Null for generic hybrid runners that are not profile-bound.
   */
  segmentProfileId: z
    .enum(["campus-passive", "dc-measured", "ot-safe-baseline"])
    .nullish(),
  /**
   * P10-15 multi-site routing: customer site / plant / region id.
   * Used for lease affinity and fleet map grouping.
   */
  siteId: z.string().trim().min(1).max(128).nullish(),
  status: RunnerStatusSchema,
  tenantId: IdSchema,
  transportMode: IssuedRunnerControlChannelSchema,
  updatedAt: TimestampSchema,
  version: z.string().min(1)
});

export const RunnerRegistrationTokenRecordSchema = z.object({
  createdAt: TimestampSchema,
  createdBy: IdSchema,
  expiresAt: TimestampSchema,
  labels: StringListSchema,
  registrationTokenId: IdSchema,
  runnerName: z.string().min(1),
  status: RunnerRegistrationTokenStatusSchema,
  tenantId: IdSchema,
  updatedAt: TimestampSchema,
  usedAt: TimestampSchema.nullish()
});

export const RunnerRegistrationTokenIssueRequestSchema = z.object({
  deploymentMode: RunnerDeploymentModeSchema.default("Docker"),
  expiresInSeconds: z.number().int().min(60).max(86_400).default(3_600),
  labels: StringListSchema.default([]),
  /** Optional affinity defaults stamped onto the registered runner (P10-15). */
  networkSegment: z.string().trim().min(1).max(128).optional(),
  runnerName: z.string().min(1),
  segmentProfileId: z
    .enum(["campus-passive", "dc-measured", "ot-safe-baseline"])
    .optional(),
  siteId: z.string().trim().min(1).max(128).optional()
});

export const RunnerRegistrationTokenIssueResponseSchema = z.object({
  registrationToken: z.string().min(1),
  token: RunnerRegistrationTokenRecordSchema
});

export const RunnerRegistrationTokenClaimsSchema = z.object({
  expiresAt: TimestampSchema,
  registrationTokenId: IdSchema,
  tenantId: IdSchema
});

export const RunnerRegistrationRequestSchema = z.object({
  arch: z.string().min(1),
  capabilities: RunnerCapabilitiesSchema,
  csrPem: z.string().min(1),
  deploymentMode: RunnerDeploymentModeSchema,
  hostname: z.string().min(1),
  labels: StringListSchema.default([]),
  networkProfile: RunnerNetworkProfileSchema,
  /** Optional site/segment affinity at enroll time (P10-15 / P10-17). */
  networkSegment: z.string().trim().min(1).max(128).optional(),
  os: z.string().min(1),
  registrationToken: z.string().min(1),
  // The runner's own Ed25519 result-signing PUBLIC key (SPKI PEM). The runner
  // keeps the private key and signs every result with it; the control plane
  // verifies against this key before trusting the measurement. Optional so a
  // legacy runner can still register, but any runner that registers a key is
  // then held to a verified signature on every result (enforce-when-present).
  resultSigningPublicKeyPem: z.string().min(1).optional(),
  runnerName: z.string().min(1),
  segmentProfileId: z
    .enum(["campus-passive", "dc-measured", "ot-safe-baseline"])
    .optional(),
  siteId: z.string().trim().min(1).max(128).optional(),
  version: z.string().min(1)
});

export const RunnerIssuedCredentialSchema = z.object({
  caCertificatePem: z.string().min(1),
  certificateExpiresAt: TimestampSchema,
  controlChannel: IssuedRunnerControlChannelSchema,
  controlPlaneUrl: z.url(),
  heartbeatIntervalSeconds: z.number().int().positive(),
  mtlsCertificateSha256: z.string().min(64).max(64),
  mtlsClientCertificatePem: z.string().min(1),
  mtlsClientPrivateKeyRequired: z.literal(true).default(true),
  pollIntervalSeconds: z.number().int().positive(),
  runnerAuthToken: z.string().min(1).optional(),
  runnerId: IdSchema,
  taskSigningKeyId: z.string().min(1),
  taskSigningPublicKeyPem: z.string().min(1),
  taskResultsUrl: z.url(),
  tenantId: IdSchema,
  transportAuth: z
    .enum(["mtls-client-cert-and-bearer-over-tls", "bearer-over-tls"])
    .default("mtls-client-cert-and-bearer-over-tls")
});

export const RunnerCredentialRotationRequestSchema = z.object({
  csrPem: z.string().min(1),
  observedAt: TimestampSchema,
  runnerId: IdSchema,
  tenantId: IdSchema,
  version: z.string().min(1)
});

export const RunnerCredentialRotationResponseSchema = z.object({
  credentials: RunnerIssuedCredentialSchema,
  runner: RunnerRecordSchema
});

export const RunnerHeartbeatSchema = z.object({
  activeTaskId: IdSchema.nullish(),
  certificateExpiresAt: TimestampSchema.nullish(),
  lastTaskCompletedAt: TimestampSchema.nullish(),
  observedAt: TimestampSchema,
  queueDepth: z.number().int().nonnegative(),
  runnerId: IdSchema,
  status: RunnerStatusSchema,
  tenantId: IdSchema,
  version: z.string().min(1)
});

export const RunnerTaskSignatureSchema = z.object({
  algorithm: RunnerSignatureAlgorithmSchema,
  digestSha256: z.string().min(1),
  keyId: z.string().min(1),
  nonce: z.string().min(1),
  signature: z.string().min(1)
});

export const RunnerTaskArtifactUploadSchema = z.object({
  artifactUploadUrl: z.url(),
  maxArtifactBytes: z.number().int().positive(),
  resultCallbackUrl: z.url()
});

export const RunnerTaskEnvelopeSchema = z.object({
  artifactUpload: RunnerTaskArtifactUploadSchema,
  executionEnvironment: ExecutionEnvironmentSchema.refine(
    (value) => value === "InternalRunner",
    {
      message: "Runner tasks must execute in the InternalRunner environment."
    }
  ),
  expiresAt: TimestampSchema,
  inputs: LooseObjectSchema.default({}),
  issuedAt: TimestampSchema,
  missionId: IdSchema,
  moduleId: z.string().min(1),
  runId: IdSchema,
  runnerId: IdSchema,
  safetyLevel: SafetyLevelSchema,
  scopeConstraints: RunnerScopeConstraintSchema,
  scopeId: IdSchema,
  signature: RunnerTaskSignatureSchema,
  target: LooseObjectSchema,
  taskId: IdSchema,
  tenantId: IdSchema
});

export const RunnerPollResponseSchema = z.object({
  controlStateChangedAt: TimestampSchema.nullish().default(null),
  killSwitchActive: z.boolean().default(false),
  nextPollAfterSeconds: z.number().int().positive(),
  runnerRevoked: z.boolean().default(false),
  tasks: z.array(RunnerTaskEnvelopeSchema)
});

export const RunnerControlStateAcknowledgementSchema = z.object({
  controlState: z.enum(["KillSwitchActive", "Revoked"]),
  observedAt: TimestampSchema,
  stateChangedAt: TimestampSchema
});

export const RunnerPollRequestSchema = z.object({
  acknowledgedTaskIds: z.array(IdSchema).default([]),
  health: RunnerHeartbeatSchema.partial().optional(),
  lastSeenTaskId: IdSchema.nullish()
});

export const RunnerReachabilityTaskRequestSchema = z.object({
  /** Optional P10-2 topology hard-constraint (wrong-site runner denied). */
  networkSegment: z.string().trim().min(1).max(128).optional(),
  ports: z.array(z.number().int().min(1).max(65535)).min(1).max(32),
  rateLimitPerMinute: z.number().int().min(1).max(120).default(30),
  scopeId: IdSchema,
  /** Optional P10-2 site hard-constraint. */
  siteId: z.string().trim().min(1).max(128).optional(),
  targetHost: z.string().min(1),
  timeoutSeconds: z.number().int().min(1).max(30).default(5)
});

// Additional passive/non-invasive internal validation modules executed by the
// runner inside the customer network (C1: live internal BAS).
export const RunnerInternalCheckModuleSchema = z.enum([
  "runner.dns_resolution_check",
  "runner.tls_certificate_check",
  "runner.http_health_check"
]);
export type RunnerInternalCheckModule = z.infer<
  typeof RunnerInternalCheckModuleSchema
>;

export const RunnerCheckTaskRequestSchema = z
  .object({
    module: RunnerInternalCheckModuleSchema,
    networkSegment: z.string().trim().min(1).max(128).optional(),
    path: z.string().min(1).max(512).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(120).default(30),
    scheme: z.enum(["http", "https"]).optional(),
    scopeId: IdSchema,
    siteId: z.string().trim().min(1).max(128).optional(),
    targetHost: z.string().min(1),
    timeoutSeconds: z.number().int().min(1).max(30).default(5)
  })
  .refine(
    (value) =>
      value.module === "runner.dns_resolution_check" ||
      value.port !== undefined,
    { message: "port is required for TLS and HTTP checks.", path: ["port"] }
  );
export type RunnerCheckTaskRequest = z.infer<
  typeof RunnerCheckTaskRequestSchema
>;

// Built-in measured (periscan.*) modules that are SAFE to dispatch to the
// in-network Node runner-agent as signed tasks: all are ControlPlane,
// non-invasive, fixture+live supported, and take a {hostname} (optionally port)
// target — so they can measure INTERNAL hosts the control plane cannot reach.
// This is the allowlist a server-side runner task-builder must enforce; the
// runner-agent already dispatches any moduleId via the shared module framework,
// so the authorization boundary is this list + policy + scope, not the agent.
// Validated against the real module registry in packages/modules tests.
export const RUNNER_MEASURED_MODULE_IDS = [
  "periscan.dns_resolution_check",
  "periscan.tls_certificate_check",
  "periscan.tls_protocol_audit",
  "periscan.http_health_check",
  "periscan.http_cookie_security",
  "periscan.http_redirect_enforcement",
  "periscan.http_cors_audit",
  "periscan.tcp_reachability",
  "periscan.endpoint_benign_marker_emit"
] as const;
export type RunnerMeasuredModuleId =
  (typeof RUNNER_MEASURED_MODULE_IDS)[number];

export function isRunnerMeasuredModuleId(
  moduleId: string
): moduleId is RunnerMeasuredModuleId {
  return (RUNNER_MEASURED_MODULE_IDS as readonly string[]).includes(moduleId);
}

// Built-in non-invasive in-network DISCOVERY modules (recon.*) safe to dispatch
// to the runner-agent for host/service inventory: InternalRunner, ActiveNonInvasive,
// fixture+live supported. They take a network target (IP range / host) and feed
// the tenant's asset inventory from inside the network. Authorization boundary
// for the server-side discover task-builder; validated against the registry in
// packages/modules tests. (The runner image must bundle their tools, e.g. nmap.)
export const RUNNER_DISCOVER_MODULE_IDS = [
  "recon.host_discovery",
  "recon.service_inventory",
  "recon.subdomain_enum",
  "recon.http_probe",
  "recon.dns_probe"
  // ot_ics.safe_baseline intentionally excluded: liveSupported=false until a
  // non-disruptive runner payload exists (fixture-only scaffold).
] as const;
export type RunnerDiscoverModuleId =
  (typeof RUNNER_DISCOVER_MODULE_IDS)[number];

export function isRunnerDiscoverModuleId(
  moduleId: string
): moduleId is RunnerDiscoverModuleId {
  return (RUNNER_DISCOVER_MODULE_IDS as readonly string[]).includes(moduleId);
}

/**
 * Safe OSS engines the runner-agent may exec via executeModuleById.
 * Filesystem/image scanners (Gitleaks, Trivy, Syft, Cosign, OSV, Grype)
 * and ZAP baseline. Never include Atomic, Caldera, SharpHound, sqlmap,
 * Metasploit, or credential-spray IDs here.
 */
export const RUNNER_OSS_ENGINE_MODULE_IDS = [
  "gitleaks.repo_secrets",
  "trivy.repo_dependency_scan",
  "trivy.container_scan",
  "osv.repo_dependency_scan",
  "grype.repo_vulnerability_scan",
  "syft.sbom_generate",
  "sigstore.cosign_verify_blob",
  "web.zap_baseline",
  "trivy.repo_misconfig",
  "detect_secrets.repo_secrets",
  "bandit.python_sast",
  "checkov.iac_posture",
  "pip_audit.python_advisories",
  "sslyze.tls_posture",
  "tlsx.tls_probe",
  "naabu.port_inventory",
  "dockle.dockerfile_cis",
  "gosec.go_sast",
  "kube_linter.manifest_posture",
  "terrascan.iac_posture",
  "kics.iac_posture",
  "kube_score.manifest_score",
  "kube_bench.cis_cluster",
  "conftest.policy_test",
  "cdxgen.sbom_generate",
  "git_secrets.repo_secrets",
  "secretlint.repo_secrets",
  "retirejs.js_advisories",
  "govulncheck.go_advisories",
  "cargo_audit.rust_advisories",
  "yara.repo_rules",
  "amass.passive_enum",
  "falco.rules_validate",
  "kubescape.repo_posture",
  "slsa_verifier.provenance",
  "brakeman.ruby_sast",
  "horusec.multi_sast",
  "dependency_check.sca",
  "talisman.repo_secrets",
  "tfsec.iac_posture",
  "cfn_nag.cloudformation",
  "whispers.repo_secrets",
  "nancy.go_advisories",
  "sobelow.elixir_sast",
  "polaris.k8s_posture",
  "kubeaudit.k8s_posture",
  "popeye.cluster_sanitizer",
  "katana.web_crawl",
  "cloudlist.cloud_assets",
  "trufflehog.repo_secrets",
  "hadolint.dockerfile",
  "sslscan.tls_probe",
  "lynis.host_audit",
  "rustscan.port_inventory",
  "cve_bin_tool.binary_cves"
] as const;
export type RunnerOssEngineModuleId =
  (typeof RUNNER_OSS_ENGINE_MODULE_IDS)[number];

export function isRunnerOssEngineModuleId(
  moduleId: string
): moduleId is RunnerOssEngineModuleId {
  return (RUNNER_OSS_ENGINE_MODULE_IDS as readonly string[]).includes(moduleId);
}

/** Any module startMission may dispatch as a signed InternalRunner task. */
export function isRunnerDispatchableModuleId(moduleId: string): boolean {
  return (
    isRunnerMeasuredModuleId(moduleId) ||
    isRunnerDiscoverModuleId(moduleId) ||
    isRunnerOssEngineModuleId(moduleId)
  );
}

// Request to dispatch an allowlisted in-network DISCOVERY module to the runner
// against an internal network target. moduleId is constrained to the discover
// allowlist (authorization boundary). `target` is the network target — an IP
// range/CIDR/host for host_discovery, or a host for service_inventory; the
// server validates it falls within the verified scope. topPorts only applies to
// service_inventory (scan breadth).
export const RunnerDiscoverTaskRequestSchema = z.object({
  moduleId: z.string().min(1).refine(isRunnerDiscoverModuleId, {
    message: "moduleId is not an allowlisted runner-safe discovery module."
  }),
  networkSegment: z.string().trim().min(1).max(128).optional(),
  rateLimitPerMinute: z.number().int().min(1).max(120).default(30),
  scopeId: IdSchema,
  siteId: z.string().trim().min(1).max(128).optional(),
  target: z.string().min(1),
  timeoutSeconds: z.number().int().min(1).max(600).default(60),
  topPorts: z.number().int().min(1).max(1000).optional()
});
export type RunnerDiscoverTaskRequest = z.infer<
  typeof RunnerDiscoverTaskRequestSchema
>;

// Request to dispatch an allowlisted measured (periscan.*) module to the
// in-network runner-agent against a specific internal host. moduleId is
// constrained to the runner-safe allowlist (the authorization boundary), so a
// caller can never ask the runner to execute an arbitrary or offensive module.
// Mirrors RunnerCheckTaskRequestSchema: a port is required for host:port checks
// (TLS/HTTP); the DNS resolution check needs only a hostname.
export const RunnerMeasuredTaskRequestSchema = z
  .object({
    moduleId: z.string().min(1).refine(isRunnerMeasuredModuleId, {
      message: "moduleId is not an allowlisted runner-safe measured module."
    }),
    markerId: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/u)
      .optional(),
    networkSegment: z.string().trim().min(1).max(128).optional(),
    path: z.string().min(1).max(512).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    platform: z.enum(["macOS", "Linux"]).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(120).default(30),
    // Optional "verify in-network" intent: when set, the dispatched task is
    // associated with this remediation so its measured result can re-confirm the
    // fix from inside the network (result-ingestion records the verification).
    remediationId: IdSchema.optional(),
    scheme: z.enum(["http", "https"]).optional(),
    scopeId: IdSchema,
    siteId: z.string().trim().min(1).max(128).optional(),
    targetHost: z.string().min(1),
    timeoutSeconds: z.number().int().min(1).max(30).default(5)
  })
  .refine(
    (value) =>
      value.moduleId === "periscan.dns_resolution_check" ||
      value.moduleId === "periscan.endpoint_benign_marker_emit" ||
      value.port !== undefined,
    {
      message: "port is required for TLS and HTTP measured checks.",
      path: ["port"]
    }
  )
  .refine(
    (value) =>
      value.moduleId !== "periscan.endpoint_benign_marker_emit" ||
      (value.markerId !== undefined && value.platform !== undefined),
    {
      message:
        "markerId and platform are required for endpoint marker emission.",
      path: ["markerId"]
    }
  );
export type RunnerMeasuredTaskRequest = z.infer<
  typeof RunnerMeasuredTaskRequestSchema
>;

export const RunnerEvidenceManifestItemSchema = z.object({
  artifactType: EvidenceArtifactTypeSchema,
  evidenceId: IdSchema.optional(),
  redactionStatus: RedactionStatusSchema,
  sha256: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
});

export const RunnerTaskArtifactUploadRequestSchema = z.object({
  artifactType: EvidenceArtifactTypeSchema,
  contentBase64: z.string().min(1),
  contentType: z.string().min(1).default("application/json"),
  filename: z.string().min(1).optional(),
  sha256: z.string().min(1),
  sizeBytes: z.number().int().nonnegative()
});

export const RunnerTaskArtifactUploadResponseSchema = z.object({
  artifact: EvidenceArtifactSchema
});

export const RunnerTaskResultStatusSchema = z.enum(["Completed", "Failed"]);

export const RunnerTaskResultSchema = z.object({
  completedAt: TimestampSchema,
  errorSummary: z.string().min(1).nullish(),
  evidenceManifest: z.array(RunnerEvidenceManifestItemSchema),
  localAuditSha256: z.string().min(1),
  outcome: z.string().min(1).nullish(),
  // Ed25519 signature (base64) the runner produces over `localAuditSha256` with
  // its registered result-signing private key. The control plane verifies it
  // against the runner's registered public key, giving non-repudiable runner
  // provenance for the measurement rather than transport-auth alone.
  resultSignature: z.string().min(1).optional(),
  runId: IdSchema,
  runnerId: IdSchema,
  // Normalized signals the in-network module produced (the measured exposure
  // detections). The control plane persists these tied to the authenticated
  // runner's verified, signed task so they drive findings — the value of
  // in-network measurement. Defaults to none (e.g. reachability-only tasks).
  signals: z.array(SignalEnvelopeSchema).default([]),
  startedAt: TimestampSchema,
  status: RunnerTaskResultStatusSchema,
  taskId: IdSchema,
  tenantId: IdSchema,
  validationState: ValidationStateSchema.nullish()
});

export const RunnerTaskRecordSchema = z.object({
  acceptedAt: TimestampSchema.nullish(),
  completedAt: TimestampSchema.nullish(),
  createdAt: TimestampSchema,
  envelope: RunnerTaskEnvelopeSchema,
  errorSummary: z.string().min(1).nullish(),
  expiresAt: TimestampSchema,
  inputPayloadHash: z.string().min(1).nullish(),
  inputs: LooseObjectSchema,
  issuedAt: TimestampSchema,
  leasedAt: TimestampSchema.nullish(),
  localAuditHash: z.string().min(1).nullish(),
  missionId: IdSchema,
  moduleId: z.string().min(1),
  moduleVersion: z.string().min(1).nullish(),
  normalizedOutput: LooseObjectSchema.nullish(),
  redactedEvidenceIds: z.array(IdSchema).default([]),
  rejectedReason: z.string().min(1).nullish(),
  resourceUsage: LooseObjectSchema.nullish(),
  result: LooseObjectSchema.nullish(),
  runId: IdSchema,
  runnerId: IdSchema,
  safetyLevel: SafetyLevelSchema,
  scopeConstraints: RunnerScopeConstraintSchema,
  scopeId: IdSchema,
  status: RunnerTaskStatusSchema,
  target: LooseObjectSchema,
  taskId: IdSchema,
  taskType: z.string().min(1).nullish(),
  tenantId: IdSchema,
  updatedAt: TimestampSchema
});

export const RunnerKillSwitchRequestSchema = z.object({
  active: z.boolean(),
  reason: z.string().min(1).max(500).nullish()
});

export const RunnerKillSwitchResponseSchema = z.object({
  runner: RunnerRecordSchema
});

export const RunnerTaskListResponseSchema = z.object({
  items: z.array(RunnerTaskRecordSchema)
});

export const RunnerTaskAcceptRequestSchema = z.object({
  observedAt: TimestampSchema,
  runnerId: IdSchema,
  tenantId: IdSchema
});

export const RunnerTaskRejectRequestSchema = z.object({
  observedAt: TimestampSchema,
  reason: z.string().min(1).max(500),
  runnerId: IdSchema,
  tenantId: IdSchema
});

export const RunnerTaskTransitionResponseSchema = z.object({
  task: RunnerTaskRecordSchema
});

export const RunnerTaskCreationResultSchema = z.object({
  envelope: RunnerTaskEnvelopeSchema,
  mission: ValidationMissionSchema,
  run: ValidationRunSchema,
  task: RunnerTaskRecordSchema
});

export type RunnerDeploymentMode = z.infer<typeof RunnerDeploymentModeSchema>;
export type RunnerStatus = z.infer<typeof RunnerStatusSchema>;
export type RunnerRegistrationTokenStatus = z.infer<
  typeof RunnerRegistrationTokenStatusSchema
>;
export type RunnerTaskStatus = z.infer<typeof RunnerTaskStatusSchema>;
export type RunnerControlChannel = z.infer<typeof RunnerControlChannelSchema>;
export type RunnerCapabilities = z.infer<typeof RunnerCapabilitiesSchema>;
export type RunnerNetworkProfile = z.infer<typeof RunnerNetworkProfileSchema>;
export type RunnerScopeConstraint = z.infer<typeof RunnerScopeConstraintSchema>;
export type RunnerTransportDecision = z.infer<
  typeof RunnerTransportDecisionSchema
>;
export type RunnerRecord = z.infer<typeof RunnerRecordSchema>;
export type RunnerRegistrationTokenRecord = z.infer<
  typeof RunnerRegistrationTokenRecordSchema
>;
export type RunnerRegistrationTokenIssueRequest = z.infer<
  typeof RunnerRegistrationTokenIssueRequestSchema
>;
export type RunnerRegistrationTokenIssueResponse = z.infer<
  typeof RunnerRegistrationTokenIssueResponseSchema
>;
export type RunnerRegistrationRequest = z.infer<
  typeof RunnerRegistrationRequestSchema
>;
export type RunnerIssuedCredential = z.infer<
  typeof RunnerIssuedCredentialSchema
>;
export type RunnerCredentialRotationRequest = z.infer<
  typeof RunnerCredentialRotationRequestSchema
>;
export type RunnerCredentialRotationResponse = z.infer<
  typeof RunnerCredentialRotationResponseSchema
>;
export type RunnerHeartbeat = z.infer<typeof RunnerHeartbeatSchema>;
export type RunnerControlStateAcknowledgement = z.infer<
  typeof RunnerControlStateAcknowledgementSchema
>;
export type RunnerPollRequest = z.infer<typeof RunnerPollRequestSchema>;
export type RunnerTaskEnvelope = z.infer<typeof RunnerTaskEnvelopeSchema>;
export type RunnerReachabilityTaskRequest = z.infer<
  typeof RunnerReachabilityTaskRequestSchema
>;
export type RunnerTaskRecord = z.infer<typeof RunnerTaskRecordSchema>;
export type RunnerTaskResult = z.infer<typeof RunnerTaskResultSchema>;
export type RunnerTaskArtifactUploadRequest = z.infer<
  typeof RunnerTaskArtifactUploadRequestSchema
>;
export type RunnerTaskArtifactUploadResponse = z.infer<
  typeof RunnerTaskArtifactUploadResponseSchema
>;
export type RunnerKillSwitchRequest = z.infer<
  typeof RunnerKillSwitchRequestSchema
>;
export type RunnerKillSwitchResponse = z.infer<
  typeof RunnerKillSwitchResponseSchema
>;
export type RunnerTaskListResponse = z.infer<
  typeof RunnerTaskListResponseSchema
>;
export type RunnerTaskAcceptRequest = z.infer<
  typeof RunnerTaskAcceptRequestSchema
>;
export type RunnerTaskRejectRequest = z.infer<
  typeof RunnerTaskRejectRequestSchema
>;
export type RunnerTaskTransitionResponse = z.infer<
  typeof RunnerTaskTransitionResponseSchema
>;
export type RunnerTaskCreationResult = z.infer<
  typeof RunnerTaskCreationResultSchema
>;

const DEFAULT_RUNNER_TRANSPORT_DECISIONS = [
  {
    channel: "LongPollHttps",
    notes: [
      "Uses outbound TCP 443 only.",
      "Authenticates with an mTLS client certificate plus a runner bearer token over TLS.",
      "Works through common enterprise proxies and idle-timeout constrained firewalls.",
      "Avoids sticky sessions and can sit behind standard load balancers."
    ],
    reason:
      "Primary control channel because it is the most firewall-friendly and simplest to audit.",
    status: "Primary"
  },
  {
    channel: "WebSocketHttps",
    notes: [
      "Useful later for interactive log streaming and lower-latency control loops.",
      "Must remain optional because some customer proxies terminate or downgrade WebSockets."
    ],
    reason:
      "Supported later when the runner needs streaming behavior, but not required for baseline task execution.",
    status: "SupportedLater"
  },
  {
    channel: "ReverseSsh",
    notes: [
      "Introduces a long-lived tunnel with more operational and audit complexity.",
      "Creates unnecessary coupling between cloud availability, session lifetime, and internal reachability."
    ],
    reason:
      "Disallowed as the default product transport because Periscan should rely on outbound HTTPS with mTLS client certificates, bearer-token authentication, and signed task envelopes rather than SSH tunnels.",
    status: "Disallowed"
  }
] as const;

export function listDefaultRunnerTransportDecisions() {
  return DEFAULT_RUNNER_TRANSPORT_DECISIONS.map((item) =>
    RunnerTransportDecisionSchema.parse(item)
  );
}

export function getPrimaryRunnerControlChannel() {
  const primary = listDefaultRunnerTransportDecisions().find(
    (item) => item.status === "Primary"
  );

  if (!primary) {
    throw new Error(
      "Runner transport configuration is missing a primary channel."
    );
  }

  return primary.channel;
}
