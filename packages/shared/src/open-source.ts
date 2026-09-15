import { z } from "zod";

import {
  EvidenceArtifactTypeSchema,
  MissionTypeSchema,
  RunModeSchema,
  SafetyLevelSchema,
  ScopeTypeSchema,
  SensitivityLevelSchema
} from "./domain";
import { RunnerTaskCreationResultSchema } from "./runner";

export const OpenSourceToolIdSchema = z.enum([
  "gitleaks",
  "nuclei",
  "nuclei-templates",
  "trivy",
  "osv-scanner",
  "prowler",
  "promptfoo",
  "pyrit",
  "garak",
  "opencti",
  "sigma",
  "ocsf",
  "atomic-red-team",
  "invoke-atomicredteam",
  "bloodhound-ce",
  "sharphound",
  "caldera",
  "nmap",
  "testssl",
  "sqlmap",
  "subfinder",
  "httpx",
  "dnsx",
  "ffuf",
  "zaproxy",
  "nikto",
  "whatweb",
  "netexec",
  "scoutsuite",
  "metasploit",
  "kerbrute",
  "grype",
  "syft",
  "cosign",
  "semgrep",
  "ollama",
  "proxmark3",
  "hackrf",
  "ansible",
  "terraform",
  "ffmpeg",
  "ctf-pack",
  "openapi-generator",
  "a2a-tck",
  // Internal content/attack packs surfaced via marketplace for pillars/emerging (safe profiles)
  "periscan-ot-ics-pack",
  "detect-secrets",
  "bandit",
  "checkov",
  "pip-audit",
  "sslyze",
  "tlsx",
  "naabu",
  "dockle",
  "gosec",
  "kube-linter",
  "terrascan",
  "kics",
  "kube-score",
  "kube-bench",
  "conftest",
  "cdxgen",
  "git-secrets",
  "secretlint",
  "retirejs",
  "govulncheck",
  "cargo-audit",
  "yara",
  "amass",
  "falco",
  "kubescape",
  "slsa-verifier",
  "brakeman",
  "horusec",
  "dependency-check",
  "talisman",
  "kingfisher",
  "polaris",
  "kubeaudit",
  "dive",
  "clair",
  "cloudlist",
  "parliament",
  "katana",
  "assetfinder",
  "gau",
  "crowdsec",
  "zeek",
  "tfsec",
  "cfn-nag",
  "cfn-lint",
  "tflint",
  "kyverno",
  "notation",
  "in-toto",
  "bundler-audit",
  "sobelow",
  "nancy",
  "popeye",
  "tracee",
  "tetragon",
  "inspec",
  "ghidra",
  "binwalk",
  "mitmproxy",
  "zmap",
  "zgrab",
  "ssllabs-scan",
  "tcpdump",
  "capa",
  "cartography",
  "helm",
  "kustomize",
  "osv-scalibr",
  "whispers",
  "security-code-scan",
  "insider",
  "uncover",
  "jaeles",
  "arjun",
  "gobuster",
  "feroxbuster",
  "cloudfox",
  "kube-hunter",
  "trufflehog",
  "hadolint",
  "osquery",
  "wazuh",
  "suricata",
  "rustscan",
  "wapiti",
  "sslscan",
  "lynis",
  "openvas",
  "tshark",
  "fail2ban",
  "clamav",
  "vuls",
  "spiderfoot",
  "cloudsploit",
  "findomain",
  "cve-bin-tool",
  "nodejsscan",
  "radare2",
  "ossec",
  "volatility3",
  "recon-ng",
  "theharvester",
  "dirsearch"
]);

export const OpenSourceToolStageSchema = z.enum([
  "Current",
  "CurrentMvp",
  "NearTerm",
  "LaterPhase"
]);

export const OpenSourceToolCategorySchema = z.enum([
  "Secrets",
  "ExternalExposure",
  "CloudPosture",
  "Dependency",
  "AIValidation",
  "ControlValidation",
  "IdentityPathing",
  "AdvancedAdversarial",
  "ContentPack",
  "NetworkRecon",
  "WebAppScan",
  // Mandatory 6 Pillars + emerging for "add more and more as they evolve" via marketplace
  "ASV_EASM",
  "AttackPath",
  "DetectionRule",
  "CloudSecurity",
  "ExposureValidation",
  "AttackPack",
  "PillarPack",
  "SSPM",
  "OTICS",
  "SupplyChain",
  "IdentityValidation",
  "Physical",
  "IaC"
]);

export const OpenSourceToolRuntimeSchema = z.enum([
  "binary",
  "docker",
  "npx",
  "pip",
  "git"
]);

export const OpenSourceToolPolicyStatusSchema = z.enum([
  "Enabled",
  "Deferred",
  "RequiresLegalReview"
]);

export const OpenSourceCapabilityStatusSchema = z.enum([
  "Implemented",
  "FixtureOnly",
  "Planned",
  "Deferred",
  "BlockedLegalReview"
]);

export const OpenSourceCapabilityInterfaceKindSchema = z.enum([
  "ValidationModule",
  "ExecutionHarness",
  "ContentPack",
  "Collector",
  "PathEngine",
  "KnowledgePack"
]);

export const OpenSourceCapabilityExecutionModeSchema = z.enum([
  "ControlPlane",
  "ExternalPoA",
  "InternalRunner",
  "ContentPack",
  "ExternalService"
]);

export const OpenSourceToolReadinessSchema = z.enum([
  "Implemented",
  "Partial",
  "Planned",
  "Blocked"
]);

export const OpenSourceExecutionReadinessSchema = z.enum([
  "Ready",
  "FixtureOnly",
  "Unavailable",
  "Deferred",
  "Blocked"
]);

const OpenSourceRuntimeReadinessFieldsSchema = z.object({
  executionReadiness: OpenSourceExecutionReadinessSchema.nullish(),
  lastCheckedAt: z.string().datetime().nullish(),
  runtimeAvailable: z.boolean().nullish(),
  runtimeKind: OpenSourceToolRuntimeSchema.nullish(),
  runtimeReason: z.string().min(1).nullish()
});

export const OpenSourceToolDefinitionSchema = z.object({
  binaryName: z.string().min(1).nullish(),
  category: OpenSourceToolCategorySchema,
  defaultVersion: z.string().min(1),
  displayName: z.string().min(1),
  dockerImage: z.string().min(1).nullish(),
  docsUrl: z.url(),
  /**
   * Engine Lab Phase 0–2 integrity pin (sha256:… or bare hex). Prefer this
   * over inventing digests; omit when unknown.
   */
  expectedIntegrity: z.string().min(1).nullish(),
  gitRepo: z.url().nullish(),
  /**
   * Optional SHA-256 (hex) of the reviewed default pin artifact when known.
   * Engine Lab Phase 0 integrity field — omit rather than invent digests.
   */
  integrityDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/iu)
    .nullish(),
  /** Docker image digest alias (sha256:…) used by install verify theater. */
  imageDigest: z.string().min(1).nullish(),
  license: z.string().min(1),
  /**
   * Upstream license text URL (SPDX page or LICENSE file). Required for Engine
   * Lab legal ceremony when tools need accept-before-install.
   */
  licenseUrl: z.url().nullish(),
  moduleIds: z.array(z.string().min(1)),
  notes: z.string().min(1),
  npmPackage: z.string().min(1).nullish(),
  phase: OpenSourceToolStageSchema,
  pipPackage: z.string().min(1).nullish(),
  policyStatus: OpenSourceToolPolicyStatusSchema,
  releaseArtifact: z.string().min(1).nullish(),
  runtimePreference: z.array(OpenSourceToolRuntimeSchema).min(1),
  toolId: OpenSourceToolIdSchema,
  upstreamHomepage: z.url().nullish(),
  /** Alias of licenseUrl for Engine Lab acceptance UI / auditor export. */
  upstreamLicenseUrl: z.url().nullish(),
  userLicenseAcceptanceRequired: z.boolean().optional()
});

export const OpenSourceCapabilitySchema =
  OpenSourceRuntimeReadinessFieldsSchema.extend({
    apiRoutes: z.array(z.string().min(1)).min(1),
    capabilityId: z.string().min(1),
    description: z.string().min(1),
    evidenceTypes: z.array(EvidenceArtifactTypeSchema),
    executionMode: OpenSourceCapabilityExecutionModeSchema,
    featureTags: z.array(z.string().min(1)).default([]),
    inputSchemaRef: z.string().min(1),
    interfaceKind: OpenSourceCapabilityInterfaceKindSchema,
    missionTypes: z.array(MissionTypeSchema),
    moduleId: z.string().min(1).nullish(),
    name: z.string().min(1),
    outputSchemaRef: z.string().min(1),
    phase: OpenSourceToolStageSchema,
    requiredIntegrations: z.array(z.string().min(1)).default([]),
    requiredScopes: z.array(ScopeTypeSchema).default([]),
    safetyLevels: z.array(SafetyLevelSchema),
    status: OpenSourceCapabilityStatusSchema,
    toolId: OpenSourceToolIdSchema
  });

export const OpenSourceCapabilityCountsSchema = z.object({
  blocked: z.number().int().nonnegative(),
  deferred: z.number().int().nonnegative(),
  fixtureOnly: z.number().int().nonnegative(),
  implemented: z.number().int().nonnegative(),
  planned: z.number().int().nonnegative(),
  total: z.number().int().nonnegative()
});

export const OpenSourceToolCatalogEntrySchema =
  OpenSourceRuntimeReadinessFieldsSchema.extend({
    capabilities: z.array(OpenSourceCapabilitySchema),
    capabilityCounts: OpenSourceCapabilityCountsSchema,
    readiness: OpenSourceToolReadinessSchema,
    tool: OpenSourceToolDefinitionSchema
  });

export const OpenSourceCatalogSummarySchema = z.object({
  blockedTools: z.number().int().nonnegative(),
  deferredTools: z.number().int().nonnegative(),
  totalCapabilities: z.number().int().nonnegative(),
  totalTools: z.number().int().nonnegative()
});

export const ToolGovernanceStatusSchema = z.enum([
  "Enabled",
  "Disabled",
  "LegalReviewRequired",
  "Blocked"
]);

export const ToolGovernanceSourceSchema = z.enum(["Default", "TenantOverride"]);

export const ToolInstallStatusSchema = z.enum([
  "NotInstalled",
  "Checking",
  "Available",
  "Missing",
  "Installing",
  "Installed",
  "Failed",
  "Skipped"
]);

export const ToolInstallJobActionSchema = z.enum([
  "Check",
  "Install",
  "Uninstall"
]);

export const ToolInstallJobStatusSchema = z.enum([
  "Queued",
  "Running",
  "Completed",
  "Failed",
  "Denied"
]);

export const ToolUpdateRecommendationStatusSchema = z.enum([
  "UpToDate",
  "UpdateAvailable",
  "Blocked",
  "Applied",
  "Dismissed"
]);

export const ToolUpstreamVersionCheckStatusSchema = z.enum([
  "UpToDate",
  "CandidateAvailable",
  "Unavailable",
  "Blocked",
  "Deferred"
]);

export const ToolUpstreamSourceKindSchema = z.enum([
  "ConfiguredOverride",
  "GitHubRelease",
  "GitHubTag",
  "NpmRegistry",
  "PypiRegistry",
  "CatalogOnly"
]);

export const ToolActivitySourceSchema = z.enum([
  "AuditEvent",
  "InstallJob",
  "RunnerTask",
  "ValidationRun",
  "UpstreamVersionCheck",
  "UpdateRecommendation",
  "Candidate",
  "ImplementationWorkOrder",
  "PromotionPackage",
  "PromotionCertification"
]);

export const ToolActivityCategorySchema = z.enum([
  "Governance",
  "Runtime",
  "Execution",
  "Update",
  "Onboarding",
  "Audit"
]);

export const ToolRunnerEligibilityStatusSchema = z.enum([
  "Ready",
  "ControlPlaneOnly",
  "RequiresRunner",
  "RequiresVerifiedScope",
  "RequiresRuntime",
  "RequiresEnablement",
  "RequiresApproval",
  "FixtureOnly",
  "NeedsImplementation",
  "Blocked"
]);

export const ToolRuntimeInstallationSchema = z.object({
  installedAt: z.string().datetime().nullish(),
  installedVersion: z.string().min(1).nullish(),
  installStatus: ToolInstallStatusSchema,
  lastCheckedAt: z.string().datetime().nullish(),
  runtimeAvailable: z.boolean(),
  runtimeKind: OpenSourceToolRuntimeSchema.nullish(),
  runtimeReason: z.string().min(1),
  toolId: OpenSourceToolIdSchema
});

export const ToolGovernancePolicySchema = z.object({
  allowedRuntimes: z.array(OpenSourceToolRuntimeSchema).min(1),
  disabledReason: z.string().min(1).nullish(),
  enabled: z.boolean(),
  legalReviewStatus: z.string().min(1),
  pinnedGitRef: z.string().min(1).nullish(),
  pinnedImageRef: z.string().min(1).nullish(),
  pinnedVersion: z.string().min(1),
  source: ToolGovernanceSourceSchema,
  status: ToolGovernanceStatusSchema,
  tenantId: z.string().uuid().nullish(),
  toolId: OpenSourceToolIdSchema,
  updatedAt: z.string().datetime()
});

export const ToolInstallJobSchema = z.object({
  action: ToolInstallJobActionSchema,
  completedAt: z.string().datetime().nullish(),
  createdAt: z.string().datetime(),
  jobId: z.string().uuid(),
  outputRedacted: z.string().min(1).nullish(),
  reason: z.string().min(1).nullish(),
  requestedBy: z.string().uuid().nullish(),
  runtimeKind: OpenSourceToolRuntimeSchema.nullish(),
  startedAt: z.string().datetime().nullish(),
  status: ToolInstallJobStatusSchema,
  tenantId: z.string().uuid().nullish(),
  toolId: OpenSourceToolIdSchema
});

export const ThirdPartyToolUpdateRecommendationSchema = z.object({
  appliedAt: z.string().datetime().nullish(),
  appliedBy: z.string().uuid().nullish(),
  createdAt: z.string().datetime(),
  currentInstalledVersion: z.string().min(1).nullish(),
  currentPinnedVersion: z.string().min(1),
  dismissedAt: z.string().datetime().nullish(),
  dismissedBy: z.string().uuid().nullish(),
  generatedAt: z.string().datetime(),
  generatedBy: z.string().uuid().nullish(),
  installJobId: z.string().uuid().nullish(),
  policyBlocked: z.boolean(),
  reason: z.string().min(1),
  recommendationId: z.string().uuid(),
  requiredActions: z.array(z.string().min(1)).default([]),
  reviewedVersion: z.string().min(1),
  runtimeKind: OpenSourceToolRuntimeSchema.nullish(),
  source: z.literal("ReviewedCatalog"),
  status: ToolUpdateRecommendationStatusSchema,
  tenantId: z.string().uuid(),
  toolId: OpenSourceToolIdSchema,
  updatedAt: z.string().datetime()
});

export const ApplyThirdPartyToolUpdateRequestSchema = z.object({
  queueInstall: z.boolean().default(false),
  reason: z.string().min(1).max(500).optional(),
  runtimeKind: OpenSourceToolRuntimeSchema.optional()
});

export const DismissThirdPartyToolUpdateRequestSchema = z.object({
  reason: z.string().min(1).max(500).optional()
});

export const ThirdPartyToolUpstreamVersionCheckSchema = z.object({
  catalogVersion: z.string().min(1),
  checkedAt: z.string().datetime(),
  checkedBy: z.string().uuid().nullish(),
  checkId: z.string().uuid(),
  discoveredVersion: z.string().min(1).nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().min(1),
  requiredActions: z.array(z.string().min(1)).default([]),
  sourceKind: ToolUpstreamSourceKindSchema,
  sourceUrl: z.url().nullish(),
  status: ToolUpstreamVersionCheckStatusSchema,
  tenantId: z.string().uuid(),
  toolId: OpenSourceToolIdSchema,
  updateAvailable: z.boolean()
});

export const ThirdPartyToolRefreshDueRequestSchema = z.object({
  includeDeferred: z.boolean().default(false),
  includeDisabled: z.boolean().default(false),
  includeLegalReview: z.boolean().default(false),
  maxTools: z.number().int().min(1).max(100).default(25),
  minHoursSinceLastCheck: z.number().int().min(1).max(720).default(24)
});

export const ThirdPartyToolRefreshDueItemStatusSchema = z.enum([
  "Checked",
  "NotDue",
  "Skipped",
  "Failed"
]);

export const ThirdPartyToolRefreshDueItemSchema = z.object({
  checkedAt: z.string().datetime().nullish(),
  displayName: z.string().min(1),
  lastCheckedAt: z.string().datetime().nullish(),
  reason: z.string().min(1),
  requiredActions: z.array(z.string().min(1)).default([]),
  status: ThirdPartyToolRefreshDueItemStatusSchema,
  toolId: OpenSourceToolIdSchema,
  updateRecommendation: ThirdPartyToolUpdateRecommendationSchema.nullish(),
  upstreamCheck: ThirdPartyToolUpstreamVersionCheckSchema.nullish()
});

export const ThirdPartyToolRefreshDueResponseSchema = z.object({
  checkedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  maxTools: z.number().int().positive(),
  minHoursSinceLastCheck: z.number().int().positive(),
  skippedCount: z.number().int().nonnegative(),
  tenantId: z.string().uuid(),
  tools: z.array(ThirdPartyToolRefreshDueItemSchema)
});

export const ThirdPartyToolActivityEventSchema = z.object({
  activityId: z.string().min(1),
  actorUserId: z.string().uuid().nullish(),
  category: ToolActivityCategorySchema,
  entityId: z.string().min(1).nullish(),
  entityType: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime(),
  source: ToolActivitySourceSchema,
  status: z.string().min(1),
  summary: z.string().min(1),
  tenantId: z.string().uuid().nullish(),
  title: z.string().min(1),
  toolId: OpenSourceToolIdSchema
});

export const ToolRunnerCapabilityEligibilitySchema = z.object({
  capabilityId: z.string().min(1),
  dispatchRoute: z.string().min(1).nullish(),
  dispatchable: z.boolean(),
  executionMode: OpenSourceCapabilityExecutionModeSchema,
  moduleId: z.string().min(1).nullish(),
  name: z.string().min(1),
  reasons: z.array(z.string().min(1)).default([]),
  requiredActions: z.array(z.string().min(1)).default([]),
  requiredScopes: z.array(ScopeTypeSchema).default([]),
  safetyLevels: z.array(SafetyLevelSchema).default([]),
  status: ToolRunnerEligibilityStatusSchema
});

export const ThirdPartyToolRunnerEligibilitySchema = z.object({
  activeRunnerCount: z.number().int().nonnegative(),
  capabilities: z.array(ToolRunnerCapabilityEligibilitySchema).default([]),
  eligible: z.boolean(),
  generatedAt: z.string().datetime(),
  governanceStatus: ToolGovernanceStatusSchema,
  reasons: z.array(z.string().min(1)).default([]),
  requiredActions: z.array(z.string().min(1)).default([]),
  runtimeAvailable: z.boolean(),
  runtimeKind: OpenSourceToolRuntimeSchema.nullish(),
  serverAllowlistedModuleIds: z.array(z.string().min(1)).default([]),
  status: ToolRunnerEligibilityStatusSchema,
  tenantId: z.string().uuid(),
  toolId: OpenSourceToolIdSchema,
  verifiedScopeCount: z.number().int().nonnegative()
});

export const ThirdPartyToolRunnerDispatchRequestSchema = z.object({
  capabilityId: z.string().min(1),
  path: z.string().min(1).max(512).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  rateLimitPerMinute: z.number().int().min(1).max(120).default(30),
  runnerId: z.string().uuid(),
  scheme: z.enum(["http", "https"]).optional(),
  scopeId: z.string().uuid(),
  target: z.string().min(1),
  timeoutSeconds: z.number().int().min(1).max(600).default(30),
  topPorts: z.number().int().min(1).max(1000).optional()
});

export const ThirdPartyToolRunnerDispatchResponseSchema = z.object({
  capability: ToolRunnerCapabilityEligibilitySchema,
  dispatchRoute: z.string().min(1),
  result: RunnerTaskCreationResultSchema,
  toolId: OpenSourceToolIdSchema
});

export const ThirdPartyToolSchema = z.object({
  governance: ToolGovernancePolicySchema,
  recentJobs: z.array(ToolInstallJobSchema).default([]),
  runtimeInstallation: ToolRuntimeInstallationSchema,
  tool: OpenSourceToolCatalogEntrySchema
});

export const ThirdPartyToolInstallRequestSchema = z.object({
  runtimeKind: OpenSourceToolRuntimeSchema.optional()
});

export const ThirdPartyToolEnableRequestSchema = z.object({
  reason: z.string().min(1).max(500).optional()
});

export const ThirdPartyToolDisableRequestSchema = z.object({
  reason: z.string().min(1).max(500)
});

export const ToolLicenseAcceptanceSchema = z.object({
  acceptanceId: z.string().uuid(),
  acceptedAt: z.string().datetime(),
  acceptedBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  spdx: z.string().min(1),
  tenantId: z.string().uuid(),
  textHash: z.string().regex(/^[a-f0-9]{64}$/iu),
  toolId: OpenSourceToolIdSchema,
  version: z.string().min(1)
});

export const AcceptToolLicenseRequestSchema = z.object({
  /**
   * Explicit authorization affirmation required to record acceptance.
   * Must be true; false/omitted is rejected by Zod.
   */
  authorized: z.literal(true),
  /**
   * Optional SPDX identifier. Defaults to the reviewed catalog license for the tool.
   */
  spdx: z.string().min(1).optional(),
  /**
   * Optional SHA-256 hex of the license text ceremony payload.
   * Defaults to a deterministic hash of toolId|version|spdx|docsUrl.
   */
  textHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/iu)
    .optional(),
  toolId: OpenSourceToolIdSchema,
  /**
   * Optional pin version. Defaults to the catalog defaultVersion / tenant pin.
   */
  version: z.string().min(1).optional()
});

export const ListToolLicenseAcceptancesQuerySchema = z.object({
  toolId: OpenSourceToolIdSchema.optional()
});

/**
 * Non-executing install plan preview for Engine Lab UI theater.
 * Never executes package-manager, Docker, git, or shell commands.
 */
export const ThirdPartyToolInstallPlanSchema = z.object({
  displayCommand: z.string().min(1),
  docsUrl: z.url(),
  installable: z.boolean(),
  /**
   * Optional pin integrity digest when the catalog publishes one.
   * Absent means digest verification is not yet asserted for this pin.
   */
  integrityDigest: z.string().min(1).nullish(),
  /**
   * Alias of integrityDigest / imageDigest / expectedIntegrity for UI/tests (P15-2).
   */
  integrityPin: z.string().min(1).nullish(),
  /** True when a catalog integrity pin is present for this tool pin. */
  integrityPinPresent: z.boolean().default(false),
  licenseAccepted: z.boolean(),
  /** Upstream license text URL when known (Engine Lab Phase 0). */
  licenseUrl: z.url().nullish(),
  noOp: z.boolean().default(false),
  /** Product honesty: restricted-license engines are never baked into default images. */
  notRedistributedByDefault: z.literal(true),
  reason: z.string().min(1).nullish(),
  requiresLicenseAcceptance: z.boolean(),
  runtimeKind: OpenSourceToolRuntimeSchema.nullish(),
  spdx: z.string().min(1),
  toolId: OpenSourceToolIdSchema,
  /** Alias of licenseUrl for auditor/UI consumers (P15-2). */
  upstreamLicenseUrl: z.url().nullish(),
  version: z.string().min(1)
});

export const ThirdPartyToolLicenseSummarySchema = z.object({
  blockedLegalReview: z.array(OpenSourceToolIdSchema),
  generatedAt: z.string().datetime(),
  licenses: z
    .array(
      z.object({
        license: z.string().min(1),
        toolIds: z.array(OpenSourceToolIdSchema)
      })
    )
    .default([]),
  totalTools: z.number().int().nonnegative()
});

export const ThirdPartyToolCoverageDispositionSchema = z.enum([
  "Executable",
  "ContentOrImportOnly",
  "Blocked",
  "Deferred",
  "NeedsImplementation"
]);

export const ThirdPartyToolCoverageAuditItemSchema = z.object({
  capabilityCounts: OpenSourceCapabilityCountsSchema,
  capabilityIds: z.array(z.string().min(1)).default([]),
  category: OpenSourceToolCategorySchema,
  displayName: z.string().min(1),
  disposition: ThirdPartyToolCoverageDispositionSchema,
  executionReadiness: OpenSourceExecutionReadinessSchema.nullish(),
  missingModuleIds: z.array(z.string().min(1)).default([]),
  moduleIdsDeclared: z.array(z.string().min(1)).default([]),
  moduleIdsPresent: z.array(z.string().min(1)).default([]),
  phase: OpenSourceToolStageSchema,
  policyStatus: OpenSourceToolPolicyStatusSchema,
  readiness: OpenSourceToolReadinessSchema,
  requiredActions: z.array(z.string().min(1)).default([]),
  runtimeAvailable: z.boolean().nullish(),
  runtimeKind: OpenSourceToolRuntimeSchema.nullish(),
  runtimeReason: z.string().min(1).nullish(),
  safetyNotes: z.array(z.string().min(1)).default([]),
  toolId: OpenSourceToolIdSchema
});

export const ThirdPartyToolCoverageAuditSchema = z.object({
  blockedTools: z.number().int().nonnegative(),
  contentOrImportOnlyTools: z.number().int().nonnegative(),
  coverageComplete: z.boolean(),
  deferredTools: z.number().int().nonnegative(),
  doesNotDispatchRunnerTasks: z.literal(true),
  doesNotEnable: z.literal(true),
  doesNotExecute: z.literal(true),
  doesNotInstall: z.literal(true),
  doesNotQueueMissions: z.literal(true),
  executableTools: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  needsImplementationTools: z.number().int().nonnegative(),
  requiredActions: z.array(z.string().min(1)).default([]),
  tenantId: z.string().uuid(),
  tools: z.array(ThirdPartyToolCoverageAuditItemSchema),
  totalTools: z.number().int().nonnegative()
});

export const ToolIntakeDecisionSchema = z.enum([
  "AcceptedForCatalogReview",
  "RequiresChanges",
  "Rejected"
]);

export const ToolIntakeCheckStatusSchema = z.enum(["Pass", "Warn", "Fail"]);

export const ToolIntakeRiskLevelSchema = z.enum([
  "Info",
  "Low",
  "Medium",
  "High",
  "Blocked"
]);

export const ToolIntakeManifestRequestSchema = z.object({
  binaryName: z.string().min(1).max(120).nullish(),
  canExecuteCode: z.boolean().default(false),
  canExfiltrateData: z.boolean().default(false),
  canModifyTarget: z.boolean().default(false),
  category: OpenSourceToolCategorySchema,
  customerVisibleDescription: z.string().min(20).max(1000),
  dataSensitivity: SensitivityLevelSchema.default("Moderate"),
  defaultVersion: z.string().min(1).max(120),
  destructivePotential: z
    .enum(["None", "Low", "Moderate", "High"])
    .default("None"),
  displayName: z.string().min(2).max(120),
  dockerImage: z.string().min(1).max(240).nullish(),
  docsUrl: z.url(),
  evidenceTypes: z.array(EvidenceArtifactTypeSchema).min(1),
  executionMode: OpenSourceCapabilityExecutionModeSchema,
  gitRepo: z.url().nullish(),
  intendedUse: z.string().min(20).max(1500),
  license: z.string().min(1).max(120),
  maintainer: z
    .string()
    .min(2)
    .max(120)
    .default("Periscan Security Engineering"),
  moduleId: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_.-]*[a-z0-9]$/)
    .max(120),
  name: z.string().min(2).max(120),
  networkAccessRequired: z.boolean().default(false),
  npmPackage: z.string().min(1).max(160).nullish(),
  pipPackage: z.string().min(1).max(160).nullish(),
  proposedCapabilities: z.array(z.string().min(3).max(120)).min(1),
  requiredIntegrations: z.array(z.string().min(1).max(120)).default([]),
  requiredPermissions: z.array(z.string().min(1).max(200)).default([]),
  requiredScopes: z.array(ScopeTypeSchema).default([]),
  runMode: RunModeSchema.nullish(),
  runtimePreference: z.array(OpenSourceToolRuntimeSchema).min(1),
  safetyLevel: SafetyLevelSchema,
  sourceUrl: z.url().nullish(),
  supportedMissionTypes: z.array(MissionTypeSchema).min(1),
  toolId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
  writesToTarget: z.boolean().default(false)
});

export const ToolIntakeCheckSchema = z.object({
  checkId: z.string().min(1),
  message: z.string().min(1),
  remediation: z.string().min(1).nullish(),
  severity: ToolIntakeRiskLevelSchema,
  status: ToolIntakeCheckStatusSchema,
  title: z.string().min(1)
});

export const ToolIntakeGovernanceRecommendationSchema = z.object({
  allowedRuntimes: z.array(OpenSourceToolRuntimeSchema),
  approvalRequired: z.boolean(),
  defaultEnabled: z.boolean(),
  installableRuntimes: z.array(OpenSourceToolRuntimeSchema),
  legalReviewRequired: z.boolean(),
  liveExecutionAllowed: z.boolean(),
  policyStatus: OpenSourceToolPolicyStatusSchema,
  reason: z.string().min(1),
  requiresInternalRunner: z.boolean(),
  runnerCompatible: z.boolean(),
  runnerExecutionMode: OpenSourceCapabilityExecutionModeSchema.nullish()
});

export const ToolIntakeModuleScaffoldSchema = z.object({
  manifestStatus: z.enum(["ReviewRequired", "Blocked"]),
  moduleId: z.string().min(1),
  requiredFiles: z.array(z.string().min(1)),
  requiredTests: z.array(z.string().min(1))
});

export const ToolIntakeValidationReportSchema = z.object({
  checks: z.array(ToolIntakeCheckSchema),
  decision: ToolIntakeDecisionSchema,
  duplicateOf: z.string().min(1).nullish(),
  generatedAt: z.string().datetime(),
  governance: ToolIntakeGovernanceRecommendationSchema,
  moduleScaffold: ToolIntakeModuleScaffoldSchema,
  normalizedToolId: z.string().min(1),
  requiredActions: z.array(z.string().min(1)),
  summary: z.string().min(1)
});

export const ToolIntakeCandidateStatusSchema = ToolIntakeDecisionSchema;

export const ToolCandidateReviewStatusSchema = z.enum([
  "NotReviewed",
  "NeedsChanges",
  "AcceptedForImplementation",
  "Rejected",
  "PromotedToCatalog"
]);

export const ReviewThirdPartyToolCandidateRequestSchema = z.object({
  implementationOwner: z.string().min(1).max(160).nullish(),
  notes: z.string().min(1).max(2000).nullish(),
  reviewStatus: z.enum([
    "NeedsChanges",
    "AcceptedForImplementation",
    "Rejected",
    "PromotedToCatalog"
  ])
});

export const ThirdPartyToolCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  category: OpenSourceToolCategorySchema,
  createdAt: z.string().datetime(),
  displayName: z.string().min(2),
  implementationOwner: z.string().min(1).nullable(),
  manifest: ToolIntakeManifestRequestSchema,
  requestedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewNotes: z.string().min(1).nullable(),
  reviewStatus: ToolCandidateReviewStatusSchema,
  status: ToolIntakeCandidateStatusSchema,
  tenantId: z.string().uuid(),
  toolId: z.string().min(1),
  updatedAt: z.string().datetime(),
  validationReport: ToolIntakeValidationReportSchema
});

export const ThirdPartyToolCandidateImportRequestSchema = z.object({
  importLabel: z.string().min(1).max(160).nullish(),
  manifests: z.array(z.unknown()).min(1).max(50)
});

export const ThirdPartyToolCandidateImportItemStatusSchema = z.enum([
  "Submitted",
  "Rejected",
  "RequiresChanges",
  "Failed"
]);

export const ThirdPartyToolCandidateImportItemSchema = z.object({
  candidate: ThirdPartyToolCandidateSchema.nullable(),
  decision: ToolIntakeDecisionSchema.nullable(),
  displayName: z.string().min(1).nullable(),
  errors: z.array(z.string().min(1)).default([]),
  index: z.number().int().nonnegative(),
  status: ThirdPartyToolCandidateImportItemStatusSchema,
  toolId: z.string().min(1).nullable(),
  validationReport: ToolIntakeValidationReportSchema.nullable()
});

export const ThirdPartyToolCandidateImportResponseSchema = z.object({
  failedCount: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
  importLabel: z.string().min(1).nullable(),
  items: z.array(ThirdPartyToolCandidateImportItemSchema),
  submittedCount: z.number().int().nonnegative(),
  tenantId: z.string().uuid(),
  totalCount: z.number().int().nonnegative()
});

export const ToolCandidateReadinessStatusSchema = z.enum([
  "ReadyForGovernance",
  "NeedsImplementation",
  "Blocked"
]);

export const ToolCandidateReadinessCheckStatusSchema = z.enum([
  "Satisfied",
  "Missing",
  "ActionRequired",
  "Blocked"
]);

export const ToolCandidateReadinessCheckSchema = z.object({
  checkId: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  requiredAction: z.string().min(1).nullish(),
  status: ToolCandidateReadinessCheckStatusSchema,
  summary: z.string().min(1),
  title: z.string().min(1)
});

export const ThirdPartyToolCandidateReadinessSchema = z.object({
  candidateId: z.string().uuid(),
  catalogEntryPresent: z.boolean(),
  checks: z.array(ToolCandidateReadinessCheckSchema),
  displayName: z.string().min(2),
  generatedAt: z.string().datetime(),
  governancePolicyAvailable: z.boolean(),
  moduleManifestPresent: z.boolean(),
  readyForGovernance: z.boolean(),
  requiredActions: z.array(z.string().min(1)),
  status: ToolCandidateReadinessStatusSchema,
  tenantId: z.string().uuid(),
  toolId: z.string().min(1)
});

export const ThirdPartyToolCandidateReadinessSummarySchema = z.object({
  blockedCount: z.number().int().nonnegative(),
  doesNotEnable: z.literal(true),
  doesNotExecute: z.literal(true),
  doesNotInstall: z.literal(true),
  doesNotQueueMissions: z.literal(true),
  doesNotWriteCatalog: z.literal(true),
  generatedAt: z.string().datetime(),
  intakeStatusCounts: z.object({
    AcceptedForCatalogReview: z.number().int().nonnegative(),
    Rejected: z.number().int().nonnegative(),
    RequiresChanges: z.number().int().nonnegative()
  }),
  items: z
    .array(
      z.object({
        candidate: ThirdPartyToolCandidateSchema,
        readiness: ThirdPartyToolCandidateReadinessSchema
      })
    )
    .default([]),
  needsImplementationCount: z.number().int().nonnegative(),
  readyForGovernanceCount: z.number().int().nonnegative(),
  requiredActions: z.array(z.string().min(1)).default([]),
  reviewStatusCounts: z.object({
    AcceptedForImplementation: z.number().int().nonnegative(),
    NeedsChanges: z.number().int().nonnegative(),
    NotReviewed: z.number().int().nonnegative(),
    PromotedToCatalog: z.number().int().nonnegative(),
    Rejected: z.number().int().nonnegative()
  }),
  tenantId: z.string().uuid(),
  totalCandidates: z.number().int().nonnegative()
});

export const ToolImplementationWorkOrderStatusSchema = z.enum([
  "Draft",
  "Blocked",
  "ReadyForImplementation"
]);

export const ToolImplementationWorkOrderTaskStatusSchema = z.enum([
  "NotStarted",
  "Blocked",
  "Ready"
]);

export const ToolImplementationWorkOrderTaskCategorySchema = z.enum([
  "CatalogMetadata",
  "ModuleManifest",
  "Parser",
  "Fixture",
  "Policy",
  "Runner",
  "Evidence",
  "Documentation",
  "License"
]);

export const ToolImplementationWorkOrderTaskSchema = z.object({
  blocksExecution: z.boolean(),
  category: ToolImplementationWorkOrderTaskCategorySchema,
  description: z.string().min(1),
  requiredEvidence: z.array(z.string().min(1)),
  status: ToolImplementationWorkOrderTaskStatusSchema,
  taskId: z.string().min(1),
  title: z.string().min(1)
});

export const ToolImplementationScaffoldFileSchema = z.object({
  contentPreview: z.string().min(1),
  path: z.string().min(1),
  purpose: z.string().min(1),
  templateKind: z.enum([
    "CatalogEntry",
    "ModuleManifest",
    "ParserFixture",
    "PolicyTest",
    "LicenseNotice",
    "Docs"
  ])
});

export const ThirdPartyToolImplementationWorkOrderSchema = z.object({
  candidateId: z.string().uuid(),
  createdAt: z.string().datetime(),
  displayName: z.string().min(2),
  generatedBy: z.string().uuid().nullable(),
  readinessStatus: ToolCandidateReadinessStatusSchema,
  requiredActions: z.array(z.string().min(1)),
  reviewStatus: ToolCandidateReviewStatusSchema,
  scaffoldFiles: z.array(ToolImplementationScaffoldFileSchema),
  status: ToolImplementationWorkOrderStatusSchema,
  summary: z.string().min(1),
  tasks: z.array(ToolImplementationWorkOrderTaskSchema),
  tenantId: z.string().uuid(),
  toolId: z.string().min(1),
  updatedAt: z.string().datetime(),
  workOrderId: z.string().uuid()
});

export const ToolImplementationBundleStatusSchema = z.enum([
  "ReadyForDownload",
  "Blocked"
]);

export const ToolImplementationBundleFileSchema = z.object({
  content: z.string().min(1),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  path: z.string().min(1),
  purpose: z.string().min(1),
  templateKind: z.enum([
    "CatalogEntry",
    "ModuleManifest",
    "ParserFixture",
    "PolicyTest",
    "LicenseNotice",
    "Docs"
  ])
});

export const ThirdPartyToolImplementationBundleSchema = z.object({
  bundleId: z.string().min(1),
  candidateId: z.string().uuid(),
  commands: z.array(z.string().min(1)),
  displayName: z.string().min(2),
  doesNotExecute: z.literal(true),
  files: z.array(ToolImplementationBundleFileSchema),
  generatedAt: z.string().datetime(),
  readinessStatus: ToolCandidateReadinessStatusSchema,
  requiredActions: z.array(z.string().min(1)),
  reviewStatus: ToolCandidateReviewStatusSchema,
  safetyNotes: z.array(z.string().min(1)),
  status: ToolImplementationBundleStatusSchema,
  summary: z.string().min(1),
  tenantId: z.string().uuid(),
  toolId: z.string().min(1),
  workOrderId: z.string().uuid()
});

export const ToolPromotionPackageStatusSchema = z.enum([
  "ReadyForGovernance",
  "Blocked",
  "Superseded"
]);

export const ToolPromotionHandoffStatusSchema = z.enum([
  "ReadyForGovernanceAction",
  "NeedsRuntimeAction",
  "NeedsRunnerPrerequisite",
  "ReadyForPolicyApproval",
  "Blocked"
]);

export const ToolPromotionHandoffActionKindSchema = z.enum([
  "EnableTool",
  "CheckRuntime",
  "InstallRuntime",
  "CheckRunnerEligibility",
  "DispatchRunnerCapability",
  "StartMission"
]);

export const ToolPromotionHandoffActionStatusSchema = z.enum([
  "Ready",
  "NeedsAction",
  "Blocked",
  "NotApplicable",
  "AlreadySatisfied"
]);

export const ThirdPartyToolPromotionPackageSchema = z.object({
  capabilityIds: z.array(z.string().min(1)),
  candidateId: z.string().uuid(),
  catalogSnapshot: OpenSourceToolCatalogEntrySchema,
  createdAt: z.string().datetime(),
  displayName: z.string().min(2),
  governanceSnapshot: ToolGovernancePolicySchema,
  implementationOwner: z.string().min(1).nullable(),
  moduleIds: z.array(z.string().min(1)),
  promotedAt: z.string().datetime(),
  promotedBy: z.string().uuid().nullable(),
  promotionPackageId: z.string().uuid(),
  readinessReport: ThirdPartyToolCandidateReadinessSchema,
  requiredEvidence: z.array(z.string().min(1)),
  reviewStatus: ToolCandidateReviewStatusSchema,
  runtimeInstallation: ToolRuntimeInstallationSchema,
  safetyNotes: z.array(z.string().min(1)),
  status: ToolPromotionPackageStatusSchema,
  summary: z.string().min(1),
  tenantId: z.string().uuid(),
  toolId: OpenSourceToolIdSchema,
  updatedAt: z.string().datetime()
});

export const ToolPromotionHandoffActionSchema = z.object({
  actionId: z.string().min(1),
  apiMethod: z.enum(["GET", "POST"]).nullable(),
  apiPath: z.string().min(1).nullable(),
  blockedBy: z.array(z.string().min(1)).default([]),
  createsExecution: z.boolean(),
  kind: ToolPromotionHandoffActionKindSchema,
  policyGateRequired: z.boolean(),
  reasons: z.array(z.string().min(1)).default([]),
  requiredActions: z.array(z.string().min(1)).default([]),
  status: ToolPromotionHandoffActionStatusSchema,
  summary: z.string().min(1),
  title: z.string().min(1)
});

export const ThirdPartyToolPromotionHandoffSchema = z.object({
  actions: z.array(ToolPromotionHandoffActionSchema),
  candidateId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  governanceEnabled: z.boolean(),
  governanceStatus: ToolGovernanceStatusSchema,
  promotionPackageId: z.string().uuid(),
  runnerEligibility: ThirdPartyToolRunnerEligibilitySchema.nullable(),
  runtimeAvailable: z.boolean(),
  runtimeStatus: ToolInstallStatusSchema,
  status: ToolPromotionHandoffStatusSchema,
  summary: z.string().min(1),
  tenantId: z.string().uuid(),
  toolId: OpenSourceToolIdSchema
});

export const ToolPromotionCertificationStatusSchema = z.enum([
  "CertifiedForUse",
  "NeedsAction",
  "Blocked"
]);

export const ToolPromotionCertificationCheckStatusSchema = z.enum([
  "Passed",
  "NeedsAction",
  "Blocked",
  "NotApplicable"
]);

export const ToolPromotionCertificationCheckCategorySchema = z.enum([
  "Catalog",
  "Module",
  "Governance",
  "Runtime",
  "Runner",
  "Evidence",
  "Policy",
  "Safety"
]);

export const ToolPromotionCertificationCheckSchema = z.object({
  category: ToolPromotionCertificationCheckCategorySchema,
  checkId: z.string().min(1),
  evidence: z.array(z.string().min(1)).default([]),
  requiredActions: z.array(z.string().min(1)).default([]),
  status: ToolPromotionCertificationCheckStatusSchema,
  summary: z.string().min(1),
  title: z.string().min(1)
});

export const ThirdPartyToolPromotionCertificationSchema = z.object({
  candidateId: z.string().uuid(),
  certificationId: z.string().min(1),
  certifiedForGovernance: z.boolean(),
  certifiedForMissionStart: z.boolean(),
  certifiedForRuntimeManagement: z.boolean(),
  certifiedForRunnerDispatch: z.boolean(),
  checks: z.array(ToolPromotionCertificationCheckSchema),
  displayName: z.string().min(2),
  doesNotDispatchRunnerTasks: z.literal(true),
  doesNotEnable: z.literal(true),
  doesNotExecute: z.literal(true),
  doesNotInstall: z.literal(true),
  doesNotQueueMissions: z.literal(true),
  createdAt: z.string().datetime().nullish(),
  generatedAt: z.string().datetime(),
  generatedBy: z.string().uuid().nullish(),
  governanceStatus: ToolGovernanceStatusSchema,
  packageStatus: ToolPromotionPackageStatusSchema,
  promotionPackageId: z.string().uuid(),
  readinessStatus: ToolCandidateReadinessStatusSchema,
  requiredActions: z.array(z.string().min(1)).default([]),
  runnerStatus: ToolRunnerEligibilityStatusSchema,
  runtimeStatus: ToolInstallStatusSchema,
  safetyNotes: z.array(z.string().min(1)).default([]),
  status: ToolPromotionCertificationStatusSchema,
  summary: z.string().min(1),
  tenantId: z.string().uuid(),
  toolId: OpenSourceToolIdSchema
});

export type OpenSourceToolId = z.infer<typeof OpenSourceToolIdSchema>;
export type OpenSourceToolDefinition = z.infer<
  typeof OpenSourceToolDefinitionSchema
>;
export type OpenSourceToolRuntime = z.infer<typeof OpenSourceToolRuntimeSchema>;
export type OpenSourceToolCategory = z.infer<
  typeof OpenSourceToolCategorySchema
>;
export type OpenSourceToolPolicyStatus = z.infer<
  typeof OpenSourceToolPolicyStatusSchema
>;
export type OpenSourceExecutionReadiness = z.infer<
  typeof OpenSourceExecutionReadinessSchema
>;
export type OpenSourceCapability = z.infer<typeof OpenSourceCapabilitySchema>;
export type OpenSourceToolCatalogEntry = z.infer<
  typeof OpenSourceToolCatalogEntrySchema
>;
export type OpenSourceCatalogSummary = z.infer<
  typeof OpenSourceCatalogSummarySchema
>;
export type ToolGovernanceStatus = z.infer<typeof ToolGovernanceStatusSchema>;
export type ToolInstallStatus = z.infer<typeof ToolInstallStatusSchema>;
export type ToolRuntimeInstallation = z.infer<
  typeof ToolRuntimeInstallationSchema
>;
export type ToolGovernancePolicy = z.infer<typeof ToolGovernancePolicySchema>;
export type ToolInstallJob = z.infer<typeof ToolInstallJobSchema>;
export type ToolUpdateRecommendationStatus = z.infer<
  typeof ToolUpdateRecommendationStatusSchema
>;
export type ToolUpstreamVersionCheckStatus = z.infer<
  typeof ToolUpstreamVersionCheckStatusSchema
>;
export type ToolUpstreamSourceKind = z.infer<
  typeof ToolUpstreamSourceKindSchema
>;
export type ThirdPartyToolUpdateRecommendation = z.infer<
  typeof ThirdPartyToolUpdateRecommendationSchema
>;
export type ApplyThirdPartyToolUpdateRequest = z.infer<
  typeof ApplyThirdPartyToolUpdateRequestSchema
>;
export type DismissThirdPartyToolUpdateRequest = z.infer<
  typeof DismissThirdPartyToolUpdateRequestSchema
>;
export type ThirdPartyToolUpstreamVersionCheck = z.infer<
  typeof ThirdPartyToolUpstreamVersionCheckSchema
>;
export type ThirdPartyToolRefreshDueRequest = z.infer<
  typeof ThirdPartyToolRefreshDueRequestSchema
>;
export type ThirdPartyToolRefreshDueItemStatus = z.infer<
  typeof ThirdPartyToolRefreshDueItemStatusSchema
>;
export type ThirdPartyToolRefreshDueItem = z.infer<
  typeof ThirdPartyToolRefreshDueItemSchema
>;
export type ThirdPartyToolRefreshDueResponse = z.infer<
  typeof ThirdPartyToolRefreshDueResponseSchema
>;
export type ToolActivitySource = z.infer<typeof ToolActivitySourceSchema>;
export type ToolActivityCategory = z.infer<typeof ToolActivityCategorySchema>;
export type ThirdPartyToolActivityEvent = z.infer<
  typeof ThirdPartyToolActivityEventSchema
>;
export type ToolRunnerEligibilityStatus = z.infer<
  typeof ToolRunnerEligibilityStatusSchema
>;
export type ToolRunnerCapabilityEligibility = z.infer<
  typeof ToolRunnerCapabilityEligibilitySchema
>;
export type ThirdPartyToolRunnerEligibility = z.infer<
  typeof ThirdPartyToolRunnerEligibilitySchema
>;
export type ThirdPartyToolRunnerDispatchRequest = z.infer<
  typeof ThirdPartyToolRunnerDispatchRequestSchema
>;
export type ThirdPartyToolRunnerDispatchRequestInput = z.input<
  typeof ThirdPartyToolRunnerDispatchRequestSchema
>;
export type ThirdPartyToolRunnerDispatchResponse = z.infer<
  typeof ThirdPartyToolRunnerDispatchResponseSchema
>;
export type ThirdPartyTool = z.infer<typeof ThirdPartyToolSchema>;
export type ThirdPartyToolInstallRequest = z.infer<
  typeof ThirdPartyToolInstallRequestSchema
>;
export type ThirdPartyToolEnableRequest = z.infer<
  typeof ThirdPartyToolEnableRequestSchema
>;
export type ThirdPartyToolDisableRequest = z.infer<
  typeof ThirdPartyToolDisableRequestSchema
>;
export type ToolLicenseAcceptance = z.infer<typeof ToolLicenseAcceptanceSchema>;
export type AcceptToolLicenseRequest = z.infer<
  typeof AcceptToolLicenseRequestSchema
>;
export type AcceptToolLicenseRequestInput = z.input<
  typeof AcceptToolLicenseRequestSchema
>;
export type ListToolLicenseAcceptancesQuery = z.infer<
  typeof ListToolLicenseAcceptancesQuerySchema
>;
export type ThirdPartyToolInstallPlan = z.infer<
  typeof ThirdPartyToolInstallPlanSchema
>;
export type ThirdPartyToolLicenseSummary = z.infer<
  typeof ThirdPartyToolLicenseSummarySchema
>;
export type ThirdPartyToolCoverageDisposition = z.infer<
  typeof ThirdPartyToolCoverageDispositionSchema
>;
export type ThirdPartyToolCoverageAuditItem = z.infer<
  typeof ThirdPartyToolCoverageAuditItemSchema
>;
export type ThirdPartyToolCoverageAudit = z.infer<
  typeof ThirdPartyToolCoverageAuditSchema
>;
export type ToolIntakeManifestRequest = z.infer<
  typeof ToolIntakeManifestRequestSchema
>;
export type ToolIntakeValidationReport = z.infer<
  typeof ToolIntakeValidationReportSchema
>;
export type ToolIntakeCandidateStatus = z.infer<
  typeof ToolIntakeCandidateStatusSchema
>;
export type ToolCandidateReviewStatus = z.infer<
  typeof ToolCandidateReviewStatusSchema
>;
export type ReviewThirdPartyToolCandidateRequest = z.infer<
  typeof ReviewThirdPartyToolCandidateRequestSchema
>;
export type ThirdPartyToolCandidate = z.infer<
  typeof ThirdPartyToolCandidateSchema
>;
export type ThirdPartyToolCandidateImportRequest = z.infer<
  typeof ThirdPartyToolCandidateImportRequestSchema
>;
export type ThirdPartyToolCandidateImportResponse = z.infer<
  typeof ThirdPartyToolCandidateImportResponseSchema
>;
export type ToolCandidateReadinessStatus = z.infer<
  typeof ToolCandidateReadinessStatusSchema
>;
export type ToolCandidateReadinessCheck = z.infer<
  typeof ToolCandidateReadinessCheckSchema
>;
export type ThirdPartyToolCandidateReadiness = z.infer<
  typeof ThirdPartyToolCandidateReadinessSchema
>;
export type ThirdPartyToolCandidateReadinessSummary = z.infer<
  typeof ThirdPartyToolCandidateReadinessSummarySchema
>;
export type ToolImplementationWorkOrderStatus = z.infer<
  typeof ToolImplementationWorkOrderStatusSchema
>;
export type ToolImplementationWorkOrderTask = z.infer<
  typeof ToolImplementationWorkOrderTaskSchema
>;
export type ToolImplementationScaffoldFile = z.infer<
  typeof ToolImplementationScaffoldFileSchema
>;
export type ThirdPartyToolImplementationWorkOrder = z.infer<
  typeof ThirdPartyToolImplementationWorkOrderSchema
>;
export type ToolImplementationBundleStatus = z.infer<
  typeof ToolImplementationBundleStatusSchema
>;
export type ToolImplementationBundleFile = z.infer<
  typeof ToolImplementationBundleFileSchema
>;
export type ThirdPartyToolImplementationBundle = z.infer<
  typeof ThirdPartyToolImplementationBundleSchema
>;
export type ToolPromotionPackageStatus = z.infer<
  typeof ToolPromotionPackageStatusSchema
>;
export type ThirdPartyToolPromotionPackage = z.infer<
  typeof ThirdPartyToolPromotionPackageSchema
>;
export type ToolPromotionHandoffStatus = z.infer<
  typeof ToolPromotionHandoffStatusSchema
>;
export type ToolPromotionHandoffActionKind = z.infer<
  typeof ToolPromotionHandoffActionKindSchema
>;
export type ToolPromotionHandoffActionStatus = z.infer<
  typeof ToolPromotionHandoffActionStatusSchema
>;
export type ToolPromotionHandoffAction = z.infer<
  typeof ToolPromotionHandoffActionSchema
>;
export type ThirdPartyToolPromotionHandoff = z.infer<
  typeof ThirdPartyToolPromotionHandoffSchema
>;
export type ToolPromotionCertificationStatus = z.infer<
  typeof ToolPromotionCertificationStatusSchema
>;
export type ToolPromotionCertificationCheckStatus = z.infer<
  typeof ToolPromotionCertificationCheckStatusSchema
>;
export type ToolPromotionCertificationCheckCategory = z.infer<
  typeof ToolPromotionCertificationCheckCategorySchema
>;
export type ToolPromotionCertificationCheck = z.infer<
  typeof ToolPromotionCertificationCheckSchema
>;
export type ThirdPartyToolPromotionCertification = z.infer<
  typeof ThirdPartyToolPromotionCertificationSchema
>;
