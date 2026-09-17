import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegistryCenter } from "./registry-center";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const evidenceId = "44444444-4444-4444-8444-444444444444";
const scopeId = "55555555-5555-4555-8555-555555555555";

function shortenForTest(value: string) {
  return value.slice(0, 8);
}

const authPayload = {
  membership: {
    createdAt: timestamp,
    membershipId,
    role: "Owner",
    tenantId,
    updatedAt: timestamp,
    userId
  },
  tenant: {
    billingAccountId: "acct-demo",
    createdAt: timestamp,
    dataRegion: "us-east-1",
    name: "Demo Security",
    parentTenantId: null,
    tenantId,
    type: "Organization",
    updatedAt: timestamp
  },
  user: {
    createdAt: timestamp,
    email: "owner@example.com",
    name: "Owner User",
    status: "Active",
    updatedAt: timestamp,
    userId
  }
};

const capabilityPayload = {
  apiRoutes: ["/api/v1/missions"],
  capabilityId: "gitleaks.repo_secrets",
  description: "Detect repository secret exposure safely.",
  evidenceTypes: ["NormalizedEvidence"],
  executionMode: "ControlPlane",
  executionReadiness: "Ready",
  featureTags: ["secrets"],
  inputSchemaRef: "GitleaksInput",
  interfaceKind: "ValidationModule",
  lastCheckedAt: timestamp,
  missionTypes: ["ExposureValidation"],
  moduleId: "gitleaks.repo_secrets",
  name: "Repository secret validation",
  outputSchemaRef: "SecretExposureOutput",
  phase: "Current",
  requiredIntegrations: ["GitHub"],
  requiredScopes: ["Repository"],
  runtimeAvailable: true,
  runtimeKind: "docker",
  runtimeReason: "Docker image available.",
  safetyLevels: ["PassiveReadOnly"],
  status: "Implemented",
  toolId: "gitleaks"
};

const fixtureOnlyCapabilityPayload = {
  ...capabilityPayload,
  capabilityId: "ffuf.content_discovery_import",
  description:
    "Normalizes approved content-discovery output without live fuzzing.",
  executionReadiness: "FixtureOnly",
  featureTags: ["web", "content-discovery"],
  inputSchemaRef: "ContentDiscoveryImportInput",
  lastCheckedAt: timestamp,
  moduleId: "web.content_discovery",
  name: "Content discovery import",
  outputSchemaRef: "ContentDiscoveryOutput",
  requiredIntegrations: [],
  requiredScopes: ["Domain"],
  runtimeAvailable: true,
  runtimeKind: "binary",
  runtimeReason: "Live fuzzing disabled; fixture/import mode only.",
  safetyLevels: ["ActiveNonInvasive"],
  status: "FixtureOnly",
  toolId: "ffuf"
};

const blockedCapabilityPayload = {
  ...capabilityPayload,
  capabilityId: "sqlmap.sqli_probe_plan",
  description:
    "Documents SQL injection probe planning while live sqlmap is blocked.",
  evidenceTypes: ["NormalizedEvidence"],
  executionReadiness: "Blocked",
  featureTags: ["web", "sqli", "legal-review"],
  inputSchemaRef: "SqlInjectionProbePlanInput",
  moduleId: "web.sqli_probe",
  name: "SQL injection probe plan",
  outputSchemaRef: "SqlInjectionProbePlanOutput",
  requiredIntegrations: [],
  requiredScopes: ["Domain"],
  runtimeAvailable: true,
  runtimeKind: "docker",
  runtimeReason: "Blocked pending legal and safety review.",
  safetyLevels: ["ControlledValidation"],
  status: "BlockedLegalReview",
  toolId: "sqlmap"
};

const populatedPayloads: Record<string, unknown> = {
  "/api/v1/me": authPayload,
  "/api/v1/modules": {
    items: [
      {
        approvalRequired: false,
        capabilityIds: ["gitleaks.repo_secrets"],
        capabilityName: "Secrets validation",
        canExecuteCode: false,
        canExfiltrateData: false,
        canModifyTarget: false,
        containerImage: "ghcr.io/gitleaks/gitleaks:v8.30.0",
        customerVisibleDescription:
          "Validate repository secret exposure without storing raw secrets.",
        dataSensitivity: "High",
        destructivePotential: "None",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "ControlPlane",
        executionCommandTemplate: ["gitleaks", "detect", "--redact"],
        fixtureSupported: true,
        installCheckCommand: ["docker", "image", "inspect"],
        license: "MIT",
        licenseRisk: "Allowed",
        liveSupported: true,
        localLabTargets: [],
        maintainer: "Periscan Security Engineering",
        moduleId: "gitleaks.repo_secrets",
        name: "Gitleaks repository secret validation",
        networkAccessRequired: false,
        outputSchema: "SecretExposureOutput",
        parser: "gitleaksJson",
        redactionRules: [
          "periscan.default-secret-redaction",
          "gitleaks.redact-secret"
        ],
        requiredInputs: ["repoId"],
        requiredIntegrations: ["GitHub"],
        requiredPermissions: ["repo:read"],
        requiredScopes: ["Repository"],
        resourceLimits: {
          cpuUnits: null,
          diskMb: 512,
          maxNetworkRequests: null,
          memoryMb: 512
        },
        safetyLevel: "PassiveReadOnly",
        status: "Implemented",
        supportedMissionTypes: ["ExposureValidation"],
        timeoutSeconds: 120,
        toolIds: ["gitleaks"],
        toolName: "Gitleaks",
        toolVersion: "v8.30.0",
        version: "0.1.0",
        versionCommand: ["gitleaks", "version"],
        writesToTarget: false
      }
    ]
  },
  "/api/v1/open-source-capabilities?includeDeferred=true&includeLegalReview=true&phase=all":
    {
      items: [
        capabilityPayload,
        fixtureOnlyCapabilityPayload,
        blockedCapabilityPayload
      ]
    },
  "/api/v1/open-source-tools?includeDeferred=true&includeLegalReview=true&phase=all":
    {
      items: [
        {
          capabilities: [capabilityPayload],
          capabilityCounts: {
            blocked: 0,
            deferred: 0,
            fixtureOnly: 0,
            implemented: 1,
            planned: 0,
            total: 1
          },
          executionReadiness: "Ready",
          lastCheckedAt: timestamp,
          readiness: "Implemented",
          runtimeAvailable: true,
          runtimeKind: "docker",
          runtimeReason: "Docker image available.",
          tool: {
            binaryName: "gitleaks",
            category: "Secrets",
            defaultVersion: "v8.30.0",
            displayName: "Gitleaks",
            dockerImage: "ghcr.io/gitleaks/gitleaks:v8.30.0",
            docsUrl: "https://github.com/gitleaks/gitleaks",
            gitRepo: "https://github.com/gitleaks/gitleaks",
            license: "MIT",
            moduleIds: ["gitleaks.repo_secrets"],
            notes: "Used internally for redacted secret exposure validation.",
            npmPackage: null,
            phase: "Current",
            pipPackage: null,
            policyStatus: "Enabled",
            runtimePreference: ["docker", "binary"],
            toolId: "gitleaks"
          }
        }
      ]
    },
  "/api/v1/operator-recommendations": {
    items: [
      {
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        missionPlan: {
          approvalRequired: true,
          executionEnvironment: "ControlPlane",
          missionType: "ValidationSnapshot",
          moduleIds: ["gitleaks.repo_secrets"],
          requestedAction: {
            credentialTheft: false,
            destructive: false,
            persistence: false,
            realDataExfiltration: false,
            requiresInternalRunner: false,
            requiresTimeWindow: false,
            uncontrolledExploitChaining: false
          },
          safetyLevel: "PassiveReadOnly",
          scopeId,
          target: {
            repository: "demo/repo"
          }
        },
        operatorType: "ExposureOperator",
        proposedActions: ["Run a validation snapshot"],
        rationale: "Verified repository scope has not been validated recently.",
        recommendationId: "operator-rec-1",
        requiredIntegrations: ["GitHub"],
        status: "Proposed",
        title: "Validate repository exposure",
        uncertainty: "Low"
      }
    ]
  },
  "/api/v1/operators": {
    items: [
      {
        capabilities: ["Recommend safe exposure validation missions"],
        defaultSafetyLevel: "PassiveReadOnly",
        name: "Exposure Operator",
        operatorType: "ExposureOperator",
        purpose: "Prioritize safe exposure validation plans.",
        supportedMissionTypes: ["ValidationSnapshot", "ExposureValidation"]
      }
    ]
  }
};

const gitleaksToolPayload = (
  populatedPayloads[
    "/api/v1/open-source-tools?includeDeferred=true&includeLegalReview=true&phase=all"
  ] as { items: unknown[] }
).items[0];

populatedPayloads["/api/v1/third-party-tools"] = {
  items: [
    {
      governance: {
        allowedRuntimes: ["docker", "binary"],
        disabledReason: null,
        enabled: true,
        legalReviewStatus: "Approved",
        pinnedGitRef: "v8.30.0",
        pinnedImageRef: "ghcr.io/gitleaks/gitleaks:v8.30.0",
        pinnedVersion: "v8.30.0",
        source: "TenantOverride",
        status: "Enabled",
        tenantId,
        toolId: "gitleaks",
        updatedAt: timestamp
      },
      recentJobs: [
        {
          action: "Check",
          completedAt: timestamp,
          createdAt: timestamp,
          jobId: "66666666-6666-4666-8666-666666666666",
          outputRedacted: "Docker image available.",
          reason: "Runtime checked.",
          requestedBy: userId,
          runtimeKind: "docker",
          startedAt: timestamp,
          status: "Completed",
          tenantId,
          toolId: "gitleaks"
        }
      ],
      runtimeInstallation: {
        installedAt: null,
        installedVersion: null,
        installStatus: "Available",
        lastCheckedAt: timestamp,
        runtimeAvailable: true,
        runtimeKind: "docker",
        runtimeReason: "Docker image available.",
        toolId: "gitleaks"
      },
      tool: gitleaksToolPayload
    }
  ]
};

const gitleaksUpdateRecommendationPayload = {
  appliedAt: null,
  appliedBy: null,
  createdAt: "2026-06-27T13:00:00.000Z",
  currentInstalledVersion: "v8.29.0",
  currentPinnedVersion: "v8.29.0",
  dismissedAt: null,
  dismissedBy: null,
  generatedAt: "2026-06-27T13:00:00.000Z",
  generatedBy: userId,
  installJobId: null,
  policyBlocked: false,
  reason:
    "Reviewed catalog version v8.30.0 differs from pinned version v8.29.0.",
  recommendationId: "77777777-7777-4777-8777-777777777777",
  requiredActions: [
    "Review upstream release notes for the catalog version.",
    "Apply the reviewed pin and queue an install job before runtime use."
  ],
  reviewedVersion: "v8.30.0",
  runtimeKind: "docker",
  source: "ReviewedCatalog",
  status: "UpdateAvailable",
  tenantId,
  toolId: "gitleaks",
  updatedAt: "2026-06-27T13:00:00.000Z"
};

populatedPayloads[
  "POST /api/v1/third-party-tools/gitleaks/update-recommendations/check"
] = gitleaksUpdateRecommendationPayload;

const gitleaksUpstreamCheckPayload = {
  catalogVersion: "v8.30.0",
  checkedAt: "2026-06-27T13:30:00.000Z",
  checkedBy: userId,
  checkId: "88888888-8888-4888-8888-888888888888",
  discoveredVersion: "v8.31.0",
  metadata: {
    reviewRequired: true
  },
  reason:
    "Trusted upstream version v8.31.0 differs from reviewed catalog version v8.30.0.",
  requiredActions: [
    "Review upstream release notes, license posture, and safety impact before updating the reviewed catalog.",
    "Update module fixtures, parser tests, license notices, and runtime pins before tenant recommendations can apply it."
  ],
  sourceKind: "GitHubRelease",
  sourceUrl: "https://github.com/gitleaks/gitleaks/releases/latest",
  status: "CandidateAvailable",
  tenantId,
  toolId: "gitleaks",
  updateAvailable: true
};

populatedPayloads[
  "POST /api/v1/third-party-tools/gitleaks/upstream-version-checks/check"
] = gitleaksUpstreamCheckPayload;

populatedPayloads["POST /api/v1/third-party-tools/refresh-due"] = {
  checkedCount: 1,
  failedCount: 0,
  generatedAt: "2026-06-27T14:00:00.000Z",
  maxTools: 25,
  minHoursSinceLastCheck: 24,
  skippedCount: 1,
  tenantId,
  tools: [
    {
      checkedAt: "2026-06-27T14:00:00.000Z",
      displayName: "Gitleaks",
      lastCheckedAt: null,
      reason:
        "Refresh created a trusted upstream check and reviewed-version recommendation.",
      requiredActions: [
        "Review upstream release notes, license posture, and safety impact before updating the reviewed catalog."
      ],
      status: "Checked",
      toolId: "gitleaks",
      updateRecommendation: gitleaksUpdateRecommendationPayload,
      upstreamCheck: gitleaksUpstreamCheckPayload
    },
    {
      checkedAt: null,
      displayName: "SharpHound",
      lastCheckedAt: null,
      reason: "Tool requires legal review and was excluded from due refresh.",
      requiredActions: ["Complete legal and safety review."],
      status: "Skipped",
      toolId: "sharphound",
      updateRecommendation: null,
      upstreamCheck: null
    }
  ]
};

const gitleaksActivityPayload = {
  items: [
    {
      activityId: "install-job:66666666-6666-4666-8666-666666666666",
      actorUserId: userId,
      category: "Runtime",
      entityId: "66666666-6666-4666-8666-666666666666",
      entityType: "ThirdPartyToolInstallJob",
      metadata: {
        action: "Check",
        runtimeKind: "docker"
      },
      occurredAt: "2026-06-27T13:10:00.000Z",
      source: "InstallJob",
      status: "Completed",
      summary: "Runtime checked.",
      tenantId,
      title: "Check job Completed",
      toolId: "gitleaks"
    }
  ]
};

populatedPayloads["/api/v1/third-party-tools/gitleaks/activity?limit=10"] =
  gitleaksActivityPayload;

const gitleaksRunnerEligibilityPayload = {
  activeRunnerCount: 0,
  capabilities: [
    {
      capabilityId: "gitleaks-repo-secrets",
      dispatchRoute: null,
      dispatchable: false,
      executionMode: "ControlPlane",
      moduleId: "gitleaks.repo_secrets",
      name: "Repository secret validation",
      reasons: [
        "Repository secret validation executes from the control plane, not the internal runner."
      ],
      requiredActions: [],
      requiredScopes: ["Repository"],
      safetyLevels: ["PassiveReadOnly"],
      status: "ControlPlaneOnly"
    }
  ],
  eligible: false,
  generatedAt: timestamp,
  governanceStatus: "Enabled",
  reasons: ["This tool has no InternalRunner capabilities."],
  requiredActions: [],
  runtimeAvailable: true,
  runtimeKind: "docker",
  serverAllowlistedModuleIds: [
    "runner.reachability_check",
    "runner.dns_resolution",
    "runner.tls_certificate",
    "runner.http_health_check"
  ],
  status: "ControlPlaneOnly",
  tenantId,
  toolId: "gitleaks",
  verifiedScopeCount: 0
};

populatedPayloads["/api/v1/third-party-tools/gitleaks/runner-eligibility"] =
  gitleaksRunnerEligibilityPayload;

const runnerId = "99999999-9999-4999-8999-999999999999";
const runnerTaskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const runnerMissionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const runnerRunId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const runnerPolicyDecisionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const nmapCapabilityPayload = {
  ...capabilityPayload,
  apiRoutes: [
    "/api/v1/open-source-tools",
    "/api/v1/modules",
    "/api/v1/missions",
    "/api/v1/runners"
  ],
  capabilityId: "nmap.host-discovery",
  description:
    "Runs safe in-network host discovery through the outbound internal runner.",
  executionMode: "InternalRunner",
  featureTags: ["network", "runner", "safe-recon"],
  inputSchemaRef: "ReconHostDiscoveryTargetSchema",
  moduleId: "recon.host_discovery",
  name: "Internal Host Discovery",
  outputSchemaRef: "ModuleOutputSchema",
  requiredIntegrations: [],
  requiredScopes: ["IPRange", "InternalNetwork"],
  runtimeKind: "binary",
  runtimeReason: "Nmap binary is available to the runner.",
  safetyLevels: ["ActiveNonInvasive"],
  toolId: "nmap"
};

const nmapToolPayload = {
  capabilities: [nmapCapabilityPayload],
  capabilityCounts: {
    blocked: 0,
    deferred: 0,
    fixtureOnly: 0,
    implemented: 1,
    planned: 0,
    total: 1
  },
  executionReadiness: "Ready",
  lastCheckedAt: timestamp,
  readiness: "Implemented",
  runtimeAvailable: true,
  runtimeKind: "binary",
  runtimeReason: "Nmap binary is available to the runner.",
  tool: {
    binaryName: "nmap",
    category: "NetworkRecon",
    defaultVersion: "7.95",
    displayName: "Nmap",
    dockerImage: "instrumentisto/nmap",
    docsUrl: "https://nmap.org/book/man.html",
    gitRepo: "https://github.com/nmap/nmap.git",
    license: "NPSL",
    moduleIds: ["recon.host_discovery"],
    notes: "Used internally for safe runner-mediated network recon.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "nmap"
  }
};

const nmapThirdPartyToolPayload = {
  governance: {
    allowedRuntimes: ["binary", "docker"],
    disabledReason: null,
    enabled: true,
    legalReviewStatus: "Approved",
    pinnedGitRef: null,
    pinnedImageRef: "instrumentisto/nmap:7.95",
    pinnedVersion: "7.95",
    source: "TenantOverride",
    status: "Enabled",
    tenantId,
    toolId: "nmap",
    updatedAt: timestamp
  },
  recentJobs: [],
  runtimeInstallation: {
    installedAt: timestamp,
    installedVersion: "7.95",
    installStatus: "Installed",
    lastCheckedAt: timestamp,
    runtimeAvailable: true,
    runtimeKind: "binary",
    runtimeReason: "Nmap binary is available to the runner.",
    toolId: "nmap"
  },
  tool: nmapToolPayload
};

const nmapRunnerEligibilityPayload = {
  activeRunnerCount: 1,
  capabilities: [
    {
      capabilityId: "nmap.host-discovery",
      dispatchRoute: "/api/v1/runners/:runnerId/tasks/discover",
      dispatchable: true,
      executionMode: "InternalRunner",
      moduleId: "recon.host_discovery",
      name: "Internal Host Discovery",
      reasons: ["Capability is server-allowlisted for runner dispatch."],
      requiredActions: [],
      requiredScopes: ["IPRange", "InternalNetwork"],
      safetyLevels: ["ActiveNonInvasive"],
      status: "Ready"
    }
  ],
  eligible: true,
  generatedAt: timestamp,
  governanceStatus: "Enabled",
  reasons: ["At least one capability is ready for runner dispatch."],
  requiredActions: [],
  runtimeAvailable: true,
  runtimeKind: "binary",
  serverAllowlistedModuleIds: [
    "recon.host_discovery",
    "recon.service_inventory"
  ],
  status: "Ready",
  tenantId,
  toolId: "nmap",
  verifiedScopeCount: 1
};

const runnerTaskEnvelope = {
  artifactUpload: {
    artifactUploadUrl: `https://periscan.local/api/v1/runners/${runnerId}/tasks/${runnerTaskId}/artifacts`,
    maxArtifactBytes: 1048576,
    resultCallbackUrl: `https://periscan.local/api/v1/runners/${runnerId}/tasks/${runnerTaskId}/result`
  },
  executionEnvironment: "InternalRunner",
  expiresAt: timestamp,
  inputs: {
    rateLimitPerMinute: 30,
    target: "10.24.0.0/24",
    timeoutSeconds: 60
  },
  issuedAt: timestamp,
  missionId: runnerMissionId,
  moduleId: "recon.host_discovery",
  runId: runnerRunId,
  runnerId,
  safetyLevel: "ActiveNonInvasive",
  scopeConstraints: {
    approvedCidrs: ["10.24.0.0/24"],
    approvedDnsSuffixes: [],
    approvedHostnames: [],
    approvedPorts: [],
    forbidInternetEgress: true
  },
  scopeId,
  signature: {
    algorithm: "EdDSA",
    digestSha256: "runner-dispatch-digest",
    keyId: "test-key",
    nonce: "runner-dispatch-nonce",
    signature: "runner-dispatch-signature"
  },
  target: {
    targets: "10.24.0.0/24"
  },
  taskId: runnerTaskId,
  tenantId
};

const nmapRunnerDispatchPayload = {
  capability: nmapRunnerEligibilityPayload.capabilities[0],
  dispatchRoute: "/api/v1/runners/:runnerId/tasks/discover",
  result: {
    envelope: runnerTaskEnvelope,
    mission: {
      completedAt: null,
      createdAt: timestamp,
      evidenceIds: [],
      missionId: runnerMissionId,
      missionType: "ExposureValidation",
      policyDecisionId: runnerPolicyDecisionId,
      policyProfile: "RunnerTask",
      requestedBy: userId,
      safetyLevel: "ActiveNonInvasive",
      scopeId,
      scopeIds: [scopeId],
      startedAt: null,
      status: "Queued",
      tenantId,
      updatedAt: timestamp
    },
    run: {
      completedAt: null,
      createdAt: timestamp,
      errorSummary: null,
      evidenceIds: [],
      missionId: runnerMissionId,
      moduleId: "recon.host_discovery",
      outcome: null,
      policyDecisionId: runnerPolicyDecisionId,
      runId: runnerRunId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeId,
      startedAt: null,
      status: "Queued",
      target: {
        targets: "10.24.0.0/24"
      },
      tenantId,
      updatedAt: timestamp,
      validationState: null
    },
    task: {
      acceptedAt: null,
      completedAt: null,
      createdAt: timestamp,
      envelope: runnerTaskEnvelope,
      errorSummary: null,
      expiresAt: timestamp,
      inputPayloadHash: "runner-input-hash",
      inputs: runnerTaskEnvelope.inputs,
      issuedAt: timestamp,
      leasedAt: null,
      localAuditHash: null,
      missionId: runnerMissionId,
      moduleId: "recon.host_discovery",
      moduleVersion: "0.1.0",
      normalizedOutput: null,
      redactedEvidenceIds: [],
      rejectedReason: null,
      resourceUsage: null,
      result: null,
      runId: runnerRunId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints: runnerTaskEnvelope.scopeConstraints,
      scopeId,
      status: "Queued",
      target: runnerTaskEnvelope.target,
      taskId: runnerTaskId,
      taskType: "discover",
      tenantId,
      updatedAt: timestamp
    }
  },
  toolId: "nmap"
};

const intakeReportPayload = {
  checks: [
    {
      checkId: "license-policy",
      message: "Apache-2.0 is acceptable for automated intake.",
      remediation: null,
      severity: "Info",
      status: "Pass",
      title: "License is acceptable"
    },
    {
      checkId: "runtime-installability",
      message: "Installable reviewed runtimes are available: docker, git.",
      remediation: null,
      severity: "Low",
      status: "Pass",
      title: "Runtime has install plan"
    }
  ],
  decision: "AcceptedForCatalogReview",
  duplicateOf: null,
  generatedAt: timestamp,
  governance: {
    allowedRuntimes: ["docker", "git"],
    approvalRequired: false,
    defaultEnabled: true,
    installableRuntimes: ["docker", "git"],
    legalReviewRequired: false,
    liveExecutionAllowed: true,
    policyStatus: "Enabled",
    reason: "Candidate can proceed to reviewed catalog/module implementation.",
    requiresInternalRunner: false,
    runnerCompatible: true,
    runnerExecutionMode: "ControlPlane"
  },
  moduleScaffold: {
    manifestStatus: "ReviewRequired",
    moduleId: "example.scanner_import",
    requiredFiles: ["packages/modules/src/toolchain.ts"],
    requiredTests: ["Parser fixture test"]
  },
  normalizedToolId: "example-scanner",
  requiredActions: ["Open a reviewed code change."],
  summary: "Example Scanner passed automated intake checks."
};

const intakeManifestPayload = {
  binaryName: null,
  canExecuteCode: false,
  canExfiltrateData: false,
  canModifyTarget: false,
  category: "Dependency",
  customerVisibleDescription:
    "Safely imports dependency advisory evidence for tenant-owned repositories.",
  dataSensitivity: "Moderate",
  defaultVersion: "latest",
  destructivePotential: "None",
  displayName: "Example Scanner",
  dockerImage: "ghcr.io/example/scanner",
  docsUrl: "https://github.com/example/scanner.git",
  evidenceTypes: ["NormalizedEvidence"],
  executionMode: "ControlPlane",
  gitRepo: "https://github.com/example/scanner.git",
  intendedUse:
    "Safely imports dependency advisory evidence for tenant-owned repositories.",
  license: "Apache-2.0",
  maintainer: "Periscan Security Engineering",
  moduleId: "example.scanner_import",
  name: "Example Scanner Intake",
  networkAccessRequired: false,
  npmPackage: null,
  pipPackage: null,
  proposedCapabilities: ["Example Scanner validation"],
  requiredIntegrations: ["github"],
  requiredPermissions: ["read-only metadata"],
  requiredScopes: ["Repository"],
  runMode: "ServiceDirect",
  runtimePreference: ["docker", "git"],
  safetyLevel: "PassiveReadOnly",
  sourceUrl: "https://github.com/example/scanner.git",
  supportedMissionTypes: ["ValidationSnapshot", "ExposureValidation"],
  toolId: "example-scanner",
  writesToTarget: false
};

const intakeCandidatePayload = {
  candidateId: "11111111-1111-4111-8111-111111111111",
  category: "Dependency",
  createdAt: timestamp,
  displayName: "Example Scanner",
  implementationOwner: null,
  manifest: intakeManifestPayload,
  requestedBy: userId,
  reviewedAt: null,
  reviewedBy: null,
  reviewNotes: null,
  reviewStatus: "NotReviewed",
  status: "AcceptedForCatalogReview",
  tenantId,
  toolId: "example-scanner",
  updatedAt: timestamp,
  validationReport: intakeReportPayload
};

const batchIntakeManifestPayload = {
  ...intakeManifestPayload,
  displayName: "Batch Scanner",
  moduleId: "batch.scanner_import",
  name: "Batch Scanner Intake",
  toolId: "batch-scanner"
};

const batchIntakeReportPayload = {
  ...intakeReportPayload,
  normalizedToolId: "batch-scanner",
  summary: "Batch Scanner passed automated intake checks."
};

const batchIntakeCandidatePayload = {
  ...intakeCandidatePayload,
  candidateId: "12121212-1212-4121-8121-121212121212",
  displayName: "Batch Scanner",
  manifest: batchIntakeManifestPayload,
  toolId: "batch-scanner",
  validationReport: batchIntakeReportPayload
};

const intakeCandidateImportPayload = {
  failedCount: 0,
  generatedAt: timestamp,
  importLabel: "Registry Center batch import",
  items: [
    {
      candidate: batchIntakeCandidatePayload,
      decision: "AcceptedForCatalogReview",
      displayName: "Batch Scanner",
      errors: [],
      index: 0,
      status: "Submitted",
      toolId: "batch-scanner",
      validationReport: batchIntakeReportPayload
    }
  ],
  submittedCount: 1,
  tenantId,
  totalCount: 1
};

const reviewedIntakeCandidatePayload = {
  ...intakeCandidatePayload,
  implementationOwner: "Platform Engineering",
  reviewedAt: timestamp,
  reviewedBy: userId,
  reviewNotes:
    "Accepted for reviewed implementation planning from Registry Center.",
  reviewStatus: "AcceptedForImplementation",
  updatedAt: timestamp
};

const promotedGitleaksCandidatePayload = {
  ...intakeCandidatePayload,
  candidateId: "77777777-7777-4777-8777-777777777777",
  displayName: "Gitleaks",
  implementationOwner: "Platform Engineering",
  manifest: {
    ...intakeManifestPayload,
    displayName: "Gitleaks",
    moduleId: "gitleaks.repo_secrets",
    toolId: "gitleaks"
  },
  reviewedAt: timestamp,
  reviewedBy: userId,
  reviewNotes: "Promoted after reviewed catalog and module work landed.",
  reviewStatus: "PromotedToCatalog",
  status: "AcceptedForCatalogReview",
  toolId: "gitleaks",
  validationReport: {
    ...intakeReportPayload,
    normalizedToolId: "gitleaks",
    summary: "Gitleaks passed automated intake checks."
  }
};

const intakeCandidateReadinessPayload = {
  candidateId: intakeCandidatePayload.candidateId,
  catalogEntryPresent: false,
  checks: [
    {
      checkId: "catalog-entry",
      evidence: [
        "Candidate tool ID example-scanner is not in the reviewed catalog."
      ],
      requiredAction:
        "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool.",
      status: "Missing",
      summary: "No reviewed catalog entry exists yet.",
      title: "Reviewed catalog entry"
    },
    {
      checkId: "module-manifest",
      evidence: ["Module manifest example.scanner_import is not registered."],
      requiredAction:
        "Implement and register the validation module manifest, parser, fixtures, and tests.",
      status: "Missing",
      summary: "No registered module manifest exists for this candidate.",
      title: "Module manifest"
    }
  ],
  displayName: "Example Scanner",
  generatedAt: timestamp,
  governancePolicyAvailable: false,
  moduleManifestPresent: false,
  readyForGovernance: false,
  requiredActions: [
    "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool."
  ],
  status: "NeedsImplementation",
  tenantId,
  toolId: "example-scanner"
};

const intakeCandidateReadinessSummaryPayload = {
  blockedCount: 0,
  doesNotEnable: true,
  doesNotExecute: true,
  doesNotInstall: true,
  doesNotQueueMissions: true,
  doesNotWriteCatalog: true,
  generatedAt: timestamp,
  intakeStatusCounts: {
    AcceptedForCatalogReview: 2,
    Rejected: 0,
    RequiresChanges: 0
  },
  items: [
    {
      candidate: intakeCandidatePayload,
      readiness: intakeCandidateReadinessPayload
    },
    {
      candidate: batchIntakeCandidatePayload,
      readiness: {
        ...intakeCandidateReadinessPayload,
        candidateId: batchIntakeCandidatePayload.candidateId,
        displayName: "Batch Scanner",
        toolId: "batch-scanner"
      }
    }
  ],
  needsImplementationCount: 2,
  readyForGovernanceCount: 0,
  requiredActions: [
    "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool."
  ],
  reviewStatusCounts: {
    AcceptedForImplementation: 0,
    NeedsChanges: 0,
    NotReviewed: 2,
    PromotedToCatalog: 0,
    Rejected: 0
  },
  tenantId,
  totalCandidates: 2
};

const intakeCandidateWorkOrderPayload = {
  candidateId: intakeCandidatePayload.candidateId,
  createdAt: timestamp,
  displayName: "Example Scanner",
  generatedBy: userId,
  readinessStatus: "NeedsImplementation",
  requiredActions: [
    "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool."
  ],
  reviewStatus: "AcceptedForImplementation",
  scaffoldFiles: [
    {
      contentPreview: "moduleId: example.scanner_import",
      path: "packages/modules/src/example-scanner.ts",
      purpose: "Validation module manifest, executor, and parser wrapper",
      templateKind: "ModuleManifest"
    },
    {
      contentPreview: "Example Scanner (Apache-2.0)",
      path: "licenses/THIRD_PARTY_NOTICES.md",
      purpose: "License inventory and third-party notice update",
      templateKind: "LicenseNotice"
    }
  ],
  status: "Draft",
  summary:
    "Example Scanner needs 1 implementation action(s) before governance promotion or execution.",
  tasks: [
    {
      blocksExecution: true,
      category: "ModuleManifest",
      description:
        "Implement the validation module manifest and bind it to the reviewed tool ID.",
      requiredEvidence: [
        "Module manifest example.scanner_import exists",
        "Module declares tool example-scanner"
      ],
      status: "NotStarted",
      taskId: "module-manifest",
      title: "Create module manifest and tool binding"
    },
    {
      blocksExecution: true,
      category: "Policy",
      description:
        "Add policy tests proving the module respects scope verification, approval, disabled-tool, and legal-review gates.",
      requiredEvidence: [
        "Policy denial test",
        "Disabled-tool mission denial test"
      ],
      status: "NotStarted",
      taskId: "policy-gates",
      title: "Certify policy and safety gates"
    }
  ],
  tenantId,
  toolId: "example-scanner",
  updatedAt: timestamp,
  workOrderId: "00000000-0000-4000-8000-000000000099"
};

const intakeCandidateImplementationBundlePayload = {
  bundleId: `tool-implementation-bundle:${intakeCandidateWorkOrderPayload.workOrderId}`,
  candidateId: intakeCandidatePayload.candidateId,
  commands: [
    "pnpm --filter @periscan/modules test",
    "pnpm test:modules -- module-certification"
  ],
  displayName: "Example Scanner",
  doesNotExecute: true,
  files: [
    {
      content: "moduleId: example.scanner_import",
      contentSha256:
        "1f0bd8726f91b40509d320086d3d4925d0867459e3bf4e036c8c538f3efaf180",
      path: "packages/modules/src/example-scanner.ts",
      purpose: "Validation module manifest, executor, and parser wrapper",
      templateKind: "ModuleManifest"
    },
    {
      content: "Example Scanner (Apache-2.0)",
      contentSha256:
        "b9b3f52cdbf7600d782584138a42d88e424b5c20dbb8a96ec2d1777050ccf258",
      path: "licenses/THIRD_PARTY_NOTICES.md",
      purpose: "License inventory and third-party notice update",
      templateKind: "LicenseNotice"
    }
  ],
  generatedAt: timestamp,
  readinessStatus: "NeedsImplementation",
  requiredActions: intakeCandidateWorkOrderPayload.requiredActions,
  reviewStatus: "AcceptedForImplementation",
  safetyNotes: [
    "Implementation bundles are scaffold artifacts only and do not install, enable, queue, dispatch, or execute tools."
  ],
  status: "ReadyForDownload",
  summary: "Example Scanner implementation bundle contains 2 scaffold file(s).",
  tenantId,
  toolId: "example-scanner",
  workOrderId: intakeCandidateWorkOrderPayload.workOrderId
};

const gitleaksPromotionPackagePayload = {
  capabilityIds: ["gitleaks.repo_secrets"],
  candidateId: promotedGitleaksCandidatePayload.candidateId,
  catalogSnapshot: gitleaksToolPayload,
  createdAt: timestamp,
  displayName: "Gitleaks",
  governanceSnapshot: (
    populatedPayloads["/api/v1/third-party-tools"] as {
      items: Array<{
        governance: unknown;
      }>;
    }
  ).items[0]!.governance,
  implementationOwner: "Platform Engineering",
  moduleIds: ["gitleaks.repo_secrets"],
  promotedAt: timestamp,
  promotedBy: userId,
  promotionPackageId: "88888888-8888-4888-8888-888888888888",
  readinessReport: {
    candidateId: promotedGitleaksCandidatePayload.candidateId,
    catalogEntryPresent: true,
    checks: [
      {
        checkId: "catalog-entry",
        evidence: ["Reviewed catalog entry exists for gitleaks."],
        requiredAction: null,
        status: "Satisfied",
        summary: "The tool is present in the reviewed OSS catalog.",
        title: "Reviewed catalog entry"
      },
      {
        checkId: "module-manifest",
        evidence: ["Module manifest gitleaks.repo_secrets exists."],
        requiredAction: null,
        status: "Satisfied",
        summary: "The requested module manifest is registered.",
        title: "Module manifest"
      }
    ],
    displayName: "Gitleaks",
    generatedAt: timestamp,
    governancePolicyAvailable: true,
    moduleManifestPresent: true,
    readyForGovernance: true,
    requiredActions: [],
    status: "ReadyForGovernance",
    tenantId,
    toolId: "gitleaks"
  },
  requiredEvidence: [
    "Reviewed catalog entry exists for the tool.",
    "Registered module manifest declares the promoted tool ID."
  ],
  reviewStatus: "PromotedToCatalog",
  runtimeInstallation: (
    populatedPayloads["/api/v1/third-party-tools"] as {
      items: Array<{
        runtimeInstallation: unknown;
      }>;
    }
  ).items[0]!.runtimeInstallation,
  safetyNotes: [
    "Promotion packages are non-executing governance artifacts.",
    "Actual tool execution remains gated by tenant enablement, verified scope, policy decisions, runtime readiness, and runner/task allowlists."
  ],
  status: "ReadyForGovernance",
  summary:
    "Gitleaks has reviewed catalog, module, governance, runtime, and safety evidence captured for governed enablement.",
  tenantId,
  toolId: "gitleaks",
  updatedAt: timestamp
};

const gitleaksPromotionHandoffPayload = {
  actions: [
    {
      actionId: "enable-tool",
      apiMethod: "POST",
      apiPath: "/api/v1/third-party-tools/gitleaks/enable",
      blockedBy: [],
      createsExecution: false,
      kind: "EnableTool",
      policyGateRequired: false,
      reasons: ["Tenant governance already enables this reviewed tool."],
      requiredActions: [],
      status: "AlreadySatisfied",
      summary: "Tool is enabled for this tenant.",
      title: "Enable tenant governance"
    },
    {
      actionId: "start-policy-gated-mission",
      apiMethod: "POST",
      apiPath: "/api/v1/missions",
      blockedBy: [],
      createsExecution: true,
      kind: "StartMission",
      policyGateRequired: true,
      reasons: [
        "Mission start remains subject to verified scope, policy decision, tenant tool enablement, runtime readiness, and module safety gates."
      ],
      requiredActions: [
        "Create or start a mission using the reviewed module; policy approval is still evaluated before queueing."
      ],
      status: "Ready",
      summary:
        "Use the existing mission APIs to execute reviewed modules under policy.",
      title: "Start policy-gated validation mission"
    }
  ],
  candidateId: promotedGitleaksCandidatePayload.candidateId,
  generatedAt: timestamp,
  governanceEnabled: true,
  governanceStatus: "Enabled",
  promotionPackageId: gitleaksPromotionPackagePayload.promotionPackageId,
  runnerEligibility: gitleaksRunnerEligibilityPayload,
  runtimeAvailable: true,
  runtimeStatus: "Available",
  status: "ReadyForPolicyApproval",
  summary:
    "Gitleaks is ready for explicit policy-gated mission or runner approval.",
  tenantId,
  toolId: "gitleaks"
};

const gitleaksPromotionCertificationPayload = {
  candidateId: promotedGitleaksCandidatePayload.candidateId,
  certificationId: `tool-promotion-certification:${gitleaksPromotionPackagePayload.promotionPackageId}`,
  certifiedForGovernance: true,
  certifiedForMissionStart: true,
  certifiedForRuntimeManagement: true,
  certifiedForRunnerDispatch: false,
  checks: [
    {
      category: "Catalog",
      checkId: "promotion-package",
      evidence: ["Promotion package status is ReadyForGovernance."],
      requiredActions: [],
      status: "Passed",
      summary: "Promotion package is readiness-satisfied.",
      title: "Promotion package"
    },
    {
      category: "Policy",
      checkId: "execution-policy-gates",
      evidence: ["2 execution-creating action(s) evaluated."],
      requiredActions: [],
      status: "Passed",
      summary:
        "Execution actions remain policy-gated and are not performed by this report.",
      title: "Execution policy gates"
    }
  ],
  displayName: "Gitleaks",
  doesNotDispatchRunnerTasks: true,
  doesNotEnable: true,
  doesNotExecute: true,
  doesNotInstall: true,
  doesNotQueueMissions: true,
  generatedAt: timestamp,
  governanceStatus: "Enabled",
  packageStatus: "ReadyForGovernance",
  promotionPackageId: gitleaksPromotionPackagePayload.promotionPackageId,
  readinessStatus: "ReadyForGovernance",
  requiredActions: [],
  runnerStatus: "ControlPlaneOnly",
  runtimeStatus: "Available",
  safetyNotes: [
    "Certification reports are read-only and do not enable, install, queue, dispatch, or execute tools."
  ],
  status: "CertifiedForUse",
  summary:
    "Gitleaks is certified for policy-gated use from current governance state.",
  tenantId,
  toolId: "gitleaks"
};

const gitleaksSavedPromotionCertificationPayload = {
  ...gitleaksPromotionCertificationPayload,
  certificationId: "77777777-7777-4777-8777-777777777777",
  createdAt: timestamp,
  generatedBy: userId
};

populatedPayloads["/api/v1/third-party-tools/intake/candidates"] = {
  items: []
};

function mockFetchWithPayloads(overrides: Record<string, unknown> = {}) {
  const payloads = {
    ...populatedPayloads,
    ...overrides
  };

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const route = String(input);
    const method = init?.method ?? "GET";
    const payload = payloads[`${method} ${route}`] ?? payloads[route];

    if (payload == null) {
      return {
        json: async () => ({
          error: `Unhandled route ${route}`
        }),
        ok: false,
        status: 404
      };
    }

    return {
      json: async () => payload,
      ok: true,
      status: 200
    };
  }) as unknown as typeof fetch;
}

describe("RegistryCenter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders modules, OSS readiness, capabilities, and operators from API data", async () => {
    const fetchImpl = mockFetchWithPayloads();

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Modules, OSS engines, and operators are API-governed."
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Gitleaks repository secret validation")
    ).toBeInTheDocument();
    expect(screen.getByText("Gitleaks")).toBeInTheDocument();
    expect(
      screen.getByText("Repository secret validation")
    ).toBeInTheDocument();
    expect(screen.getByText("Exposure Operator")).toBeInTheDocument();
    expect(
      screen.getByText("Validate repository exposure")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Module manifest count: 1"
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Registry metrics")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-6"
    );
    expect(
      screen.getByRole("status", {
        name: "Gitleaks repository secret validation safety level: PassiveReadOnly"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Implemented")).toBeInTheDocument();
    expect(screen.getByText("License risk: Allowed")).toBeInTheDocument();
    expect(screen.getByText("Network: Not required")).toBeInTheDocument();
    expect(screen.getByText("Destructive potential: None")).toBeInTheDocument();
    expect(screen.getByText("Data sensitivity: High")).toBeInTheDocument();
    const moduleSafetyMetadata = screen.getByRole("group", {
      name: "Gitleaks repository secret validation safety metadata"
    });
    expect(screen.getByText("Target writes")).toBeInTheDocument();
    expect(screen.getByText("Target modification")).toBeInTheDocument();
    expect(screen.getByText("Code execution")).toBeInTheDocument();
    expect(screen.getByText("Data exfiltration")).toBeInTheDocument();
    expect(within(moduleSafetyMetadata).getAllByText("No")).toHaveLength(4);
    expect(screen.getByText("Tool version")).toBeInTheDocument();
    expect(screen.getByText("v8.30.0")).toBeInTheDocument();
    expect(screen.getByText("Runtime image")).toBeInTheDocument();
    expect(
      screen.getByText("ghcr.io/gitleaks/gitleaks:v8.30.0")
    ).toBeInTheDocument();
    expect(screen.getByText("Maintainer")).toBeInTheDocument();
    expect(
      screen.getByText("Periscan Security Engineering")
    ).toBeInTheDocument();
    expect(screen.getByText("Redaction rules")).toBeInTheDocument();
    expect(
      screen.getByText(
        "periscan.default-secret-redaction, gitleaks.redact-secret"
      )
    ).toBeInTheDocument();
    // Modules-by-safety-level coverage chart (real catalog; one PassiveReadOnly).
    const safetyFigure = screen.getByRole("figure", {
      name: "Validation modules by safety level"
    });
    expect(
      within(safetyFigure).getByRole("rowheader", { name: "PassiveReadOnly" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Third-party tool count: 1"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Gitleaks governance status: Enabled"
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Available/).length).toBeGreaterThan(0);
    expect(screen.getByText("Allowed runtimes")).toBeInTheDocument();
    expect(screen.getByText("Recent jobs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check reviewed update" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check upstream" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh due tools" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument();
    // The pinned tool version is surfaced for readiness review.
    expect(screen.getByText("Pinned v8.30.0")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Capability count: 3"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Repository secret validation execution readiness: Ready"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Content discovery import execution readiness: FixtureOnly"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "SQL injection probe plan execution readiness: Blocked"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Docker image available.")).toBeInTheDocument();
    expect(
      screen.getByText("Live fuzzing disabled; fixture/import mode only.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Blocked pending legal and safety review.")
    ).toBeInTheDocument();
    expect(screen.getByText("Safety: PassiveReadOnly")).toBeInTheDocument();
    expect(screen.getAllByText("Scopes: Domain")).toHaveLength(2);
    expect(screen.getByText("Scopes: Repository")).toBeInTheDocument();
    expect(screen.getByText("Integrations: GitHub")).toBeInTheDocument();
    expect(screen.getAllByText("Integrations: None declared")).toHaveLength(2);
    expect(screen.getAllByText("Evidence: NormalizedEvidence")).toHaveLength(3);
    expect(
      screen.getByRole("status", {
        name: "Operator profile count: 1"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Validate repository exposure recommendation status: Proposed"
      })
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/open-source-tools?includeDeferred=true&includeLegalReview=true&phase=all",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools",
      expect.objectContaining({ cache: "no-store" })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Check reviewed update" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Reviewed update recommendation")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Reviewed catalog version v8.30.0 differs from pinned version v8.29.0."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Current pin v8.29.0")).toBeInTheDocument();
    expect(screen.getByText("Reviewed v8.30.0")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply reviewed update" })
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/gitleaks/update-recommendations/check",
      expect.objectContaining({ method: "POST" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Check upstream" }));

    await waitFor(() => {
      expect(screen.getByText("Trusted upstream check")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Trusted upstream version v8.31.0 differs from reviewed catalog version v8.30.0."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Catalog v8.30.0")).toBeInTheDocument();
    expect(screen.getByText("Upstream v8.31.0")).toBeInTheDocument();
    expect(screen.getByText("Source GitHubRelease")).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/gitleaks/upstream-version-checks/check",
      expect.objectContaining({ method: "POST" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Load activity" }));

    await waitFor(() => {
      expect(screen.getByText("Tool activity")).toBeInTheDocument();
    });

    expect(screen.getByText("Check job Completed")).toBeInTheDocument();
    expect(screen.getByText("Runtime checked.")).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/gitleaks/activity?limit=10",
      expect.objectContaining({ cache: "no-store" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Check runner" }));

    await waitFor(() => {
      expect(screen.getByText("Runner eligibility")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "Gitleaks runner eligibility status: ControlPlaneOnly"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("This tool has no InternalRunner capabilities.")
    ).toBeInTheDocument();
    expect(screen.getByText("Active runners")).toBeInTheDocument();
    expect(screen.getByText("Verified scopes")).toBeInTheDocument();
    expect(
      screen.getAllByText("Repository secret validation").length
    ).toBeGreaterThan(1);
    expect(
      screen.getByText(
        "gitleaks.repo_secrets · ControlPlane · No dispatch route"
      )
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/gitleaks/runner-eligibility",
      expect.objectContaining({ cache: "no-store" })
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh due tools" }));

    await waitFor(() => {
      expect(screen.getByText("Due refresh summary")).toBeInTheDocument();
    });

    expect(
      screen.getByText("1 checked · 1 skipped · 0 failed")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Refresh created a trusted upstream check and reviewed-version recommendation."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Tool requires legal review and was excluded from due refresh."
      )
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/refresh-due",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("dispatches a governed runner task through the third-party tool API", async () => {
    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/open-source-capabilities?includeDeferred=true&includeLegalReview=true&phase=all":
        {
          items: [nmapCapabilityPayload]
        },
      "/api/v1/open-source-tools?includeDeferred=true&includeLegalReview=true&phase=all":
        {
          items: [nmapToolPayload]
        },
      "/api/v1/third-party-tools": {
        items: [nmapThirdPartyToolPayload]
      },
      "/api/v1/third-party-tools/nmap/runner-eligibility":
        nmapRunnerEligibilityPayload,
      "POST /api/v1/third-party-tools/nmap/runner-dispatch":
        nmapRunnerDispatchPayload
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(screen.getByText("Nmap")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Check runner" }));

    await waitFor(() => {
      expect(
        screen.getByRole("form", {
          name: "Nmap runner dispatch form"
        })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Nmap runner ID"), {
      target: { value: runnerId }
    });
    fireEvent.change(screen.getByLabelText("Nmap scope ID"), {
      target: { value: scopeId }
    });
    fireEvent.change(screen.getByLabelText("Nmap dispatch target"), {
      target: { value: "10.24.0.0/24" }
    });
    fireEvent.change(screen.getByLabelText("Nmap dispatch timeout"), {
      target: { value: "60" }
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Dispatch runner task" })
    );

    await waitFor(() => {
      expect(screen.getByText("Runner task dispatched")).toBeInTheDocument();
    });

    expect(screen.getByText("Queued")).toBeInTheDocument();
    expect(screen.getByText(shortenForTest(runnerTaskId))).toBeInTheDocument();
    expect(
      screen.getByText(shortenForTest(runnerMissionId))
    ).toBeInTheDocument();
    expect(screen.getByText(shortenForTest(runnerRunId))).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/nmap/runner-dispatch",
      expect.objectContaining({
        body: JSON.stringify({
          capabilityId: "nmap.host-discovery",
          rateLimitPerMinute: 30,
          runnerId,
          scopeId,
          target: "10.24.0.0/24",
          timeoutSeconds: 60
        }),
        method: "POST"
      })
    );
  });

  it("validates proposed tool intake through the API and renders the report", async () => {
    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/third-party-tools/intake/validate": intakeReportPayload,
      "POST /api/v1/third-party-tools/intake/candidates":
        intakeCandidatePayload,
      "POST /api/v1/third-party-tools/intake/candidates/import":
        intakeCandidateImportPayload,
      [`POST /api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/review`]:
        reviewedIntakeCandidatePayload,
      [`/api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/readiness`]:
        intakeCandidateReadinessPayload,
      "/api/v1/third-party-tools/intake/candidates/readiness-summary":
        intakeCandidateReadinessSummaryPayload,
      [`POST /api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/work-orders`]:
        intakeCandidateWorkOrderPayload,
      [`/api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/work-orders/${intakeCandidateWorkOrderPayload.workOrderId}/implementation-bundle`]:
        intakeCandidateImplementationBundlePayload
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(screen.getByText("Tool onboarding intake")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Tool ID"), {
      target: { value: "example-scanner" }
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Example Scanner" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Validate intake" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Tool intake decision: AcceptedForCatalogReview"
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Tool intake certification report")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Example Scanner passed automated intake checks.")
    ).toBeInTheDocument();
    expect(screen.getByText("Normalized tool ID")).toBeInTheDocument();
    expect(screen.getByText("example-scanner")).toBeInTheDocument();
    expect(screen.getByText("Installable runtimes")).toBeInTheDocument();
    expect(screen.getByText("docker, git")).toBeInTheDocument();
    expect(
      screen.getByText("Open a reviewed code change.")
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/intake/validate",
      expect.objectContaining({
        method: "POST"
      })
    );
    const intakeCall = vi
      .mocked(fetchImpl)
      .mock.calls.find(
        (call) =>
          String(call[0]) === "/api/v1/third-party-tools/intake/validate"
      );
    expect(intakeCall).toBeDefined();
    expect(JSON.parse((intakeCall![1] as RequestInit).body as string)).toEqual(
      expect.objectContaining({
        displayName: "Example Scanner",
        toolId: "example-scanner"
      })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Submit candidate to backlog" })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Tool intake candidate count: 1"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Tool intake backlog")).toBeInTheDocument();
    expect(screen.getByText("Example Scanner")).toBeInTheDocument();
    expect(
      screen.getByText("example-scanner · Dependency")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Example Scanner review status: NotReviewed"
      })
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/intake/candidates",
      expect.objectContaining({
        method: "POST"
      })
    );

    fireEvent.change(
      screen.getByLabelText("Tool candidate batch manifest JSON"),
      {
        target: {
          value: JSON.stringify([batchIntakeManifestPayload])
        }
      }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Import candidate batch" })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Tool candidate batch import result: 1 submitted, 0 failed"
        })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "Tool intake candidate count: 2"
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Batch Scanner").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getByText("batch-scanner · Dependency")).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/intake/candidates/import",
      expect.objectContaining({
        body: JSON.stringify({
          importLabel: "Registry Center batch import",
          manifests: [batchIntakeManifestPayload]
        }),
        method: "POST"
      })
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Summarize readiness" })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Tool candidate readiness summary: 0 ready, 2 needs implementation, 0 blocked"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Candidate readiness summary")).toBeInTheDocument();
    expect(
      screen.getByText("2 candidate(s) triaged from persisted backlog records.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Read-only summary. No catalog entries, installs, enablement, missions, runner tasks, or module executions are created."
      )
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/intake/candidates/readiness-summary",
      expect.objectContaining({
        cache: "no-store"
      })
    );

    const exampleCandidatePanel = screen.getByLabelText(
      "Example Scanner intake candidate"
    );

    fireEvent.click(
      within(exampleCandidatePanel).getByRole("button", {
        name: "Accept for implementation"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Example Scanner review status: AcceptedForImplementation"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Platform Engineering")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Accepted for reviewed implementation planning from Registry Center."
      )
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/review`,
      expect.objectContaining({
        method: "POST"
      })
    );

    fireEvent.click(
      within(exampleCandidatePanel).getByRole("button", {
        name: "Check implementation readiness"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Example Scanner implementation readiness: NeedsImplementation"
        })
      ).toBeInTheDocument();
    });

    expect(
      within(exampleCandidatePanel).getByText("Implementation readiness")
    ).toBeInTheDocument();
    expect(
      within(exampleCandidatePanel).getByText("Reviewed catalog entry")
    ).toBeInTheDocument();
    expect(
      within(exampleCandidatePanel).getByText("Module manifest")
    ).toBeInTheDocument();
    expect(
      within(exampleCandidatePanel).getByText(
        "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool."
      )
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/readiness`,
      expect.objectContaining({
        cache: "no-store"
      })
    );

    fireEvent.click(
      within(exampleCandidatePanel).getByRole("button", {
        name: "Generate implementation work order"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Example Scanner implementation work order: Draft"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Implementation work order")).toBeInTheDocument();
    expect(
      screen.getByText("Create module manifest and tool binding")
    ).toBeInTheDocument();
    expect(
      screen.getByText("packages/modules/src/example-scanner.ts")
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/work-orders`,
      expect.objectContaining({
        method: "POST"
      })
    );

    fireEvent.click(
      within(exampleCandidatePanel).getByRole("button", {
        name: "Load implementation bundle"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "Example Scanner implementation bundle: ReadyForDownload"
        })
      ).toBeInTheDocument();
    });

    const implementationBundlePanel = screen.getByLabelText(
      "Example Scanner implementation bundle"
    );
    expect(
      within(implementationBundlePanel).getByText("Implementation bundle")
    ).toBeInTheDocument();
    expect(
      within(implementationBundlePanel).getByText(
        "Example Scanner implementation bundle contains 2 scaffold file(s)."
      )
    ).toBeInTheDocument();
    expect(
      within(implementationBundlePanel).getByText("Files")
    ).toBeInTheDocument();
    expect(
      within(implementationBundlePanel).getByText("Commands")
    ).toBeInTheDocument();
    expect(
      within(implementationBundlePanel).getByText("Executes tools")
    ).toBeInTheDocument();
    expect(
      within(implementationBundlePanel).getByText("No")
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${intakeCandidatePayload.candidateId}/work-orders/${intakeCandidateWorkOrderPayload.workOrderId}/implementation-bundle`,
      expect.objectContaining({
        cache: "no-store"
      })
    );
  });

  it("loads existing promotion packages for promoted tool candidates", async () => {
    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/third-party-tools/intake/candidates": {
        items: [promotedGitleaksCandidatePayload]
      },
      [`/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages`]:
        {
          items: [gitleaksPromotionPackagePayload]
        },
      [`/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/governance-handoff`]:
        gitleaksPromotionHandoffPayload,
      [`/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/certification-report`]:
        gitleaksPromotionCertificationPayload,
      [`POST /api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/certifications`]:
        gitleaksSavedPromotionCertificationPayload,
      [`/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/certifications`]:
        {
          items: [gitleaksSavedPromotionCertificationPayload]
        }
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(screen.getAllByText("Gitleaks").length).toBeGreaterThan(0);
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Load promotion packages" })
    );

    await waitFor(() => {
      expect(screen.getByText("Promotion package")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "Gitleaks promotion package: ReadyForGovernance"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Promotion packages are non-executing governance artifacts."
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Load governance handoff" })
    );

    await waitFor(() => {
      expect(screen.getByText("Governance handoff")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "Gitleaks promotion handoff: ReadyForPolicyApproval"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Start policy-gated validation mission")
    ).toBeInTheDocument();
    expect(screen.getByText("POST /api/v1/missions")).toBeInTheDocument();
    expect(screen.getByText("Creates execution")).toBeInTheDocument();
    expect(screen.getByText("Policy gate required")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Load certification report" })
    );

    await waitFor(() => {
      expect(screen.getByText("Certification report")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "Gitleaks promotion certification: CertifiedForUse"
      })
    ).toBeInTheDocument();
    const certificationPanel = screen.getByLabelText(
      "Gitleaks promotion certification report"
    );
    expect(
      within(certificationPanel).getByText(
        "Gitleaks is certified for policy-gated use from current governance state."
      )
    ).toBeInTheDocument();
    expect(
      within(certificationPanel).getByText("Mission start")
    ).toBeInTheDocument();
    expect(
      within(certificationPanel).getByText("Policy-gated")
    ).toBeInTheDocument();
    expect(
      within(certificationPanel).getByText("Execution policy gates")
    ).toBeInTheDocument();
    expect(
      within(certificationPanel).getByText(
        "Read-only certification. No enablement, installs, missions, runner dispatch, or module execution are performed."
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Save certification snapshot" })
    );

    await waitFor(() => {
      expect(screen.getByText("Certification history")).toBeInTheDocument();
    });

    const certificationHistoryPanel = screen.getByLabelText(
      "Gitleaks promotion certification history"
    );
    expect(
      within(certificationHistoryPanel).getByText(
        /Generated by 22222222-2222-4222-8222-222222222222/
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Load certification history" })
    );

    await waitFor(() => {
      expect(
        within(certificationHistoryPanel).getByText(
          /No installs, missions, runner dispatch, or module execution/
        )
      ).toBeInTheDocument();
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages`,
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/governance-handoff`,
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/certification-report`,
      expect.objectContaining({ cache: "no-store" })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/certifications`,
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/third-party-tools/intake/candidates/${promotedGitleaksCandidatePayload.candidateId}/promotion-packages/${gitleaksPromotionPackagePayload.promotionPackageId}/certifications`,
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("collapses a large module catalog and reveals it on demand", async () => {
    const baseModule = (
      populatedPayloads["/api/v1/modules"] as {
        items: Array<Record<string, unknown>>;
      }
    ).items[0]!;
    // 9 modules > the 8-module default cap, so the toggle must appear and the
    // 9th module stays hidden until expanded.
    const manyModules = Array.from({ length: 9 }, (_, index) => ({
      ...baseModule,
      capabilityIds: [`module-${index}`],
      moduleId: `periscan.catalog_module_${index}`,
      name: `Catalog module ${index}`
    }));

    vi.stubGlobal(
      "fetch",
      mockFetchWithPayloads({ "/api/v1/modules": { items: manyModules } })
    );

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(screen.getByText("Catalog module 0")).toBeInTheDocument();
    });

    // The 9th module is hidden behind the cap until the operator expands.
    expect(screen.queryByText("Catalog module 8")).not.toBeInTheDocument();

    const toggle = screen.getByRole("button", {
      name: "Show all 9 modules"
    });
    fireEvent.click(toggle);

    expect(screen.getByText("Catalog module 8")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show fewer modules" })
    ).toBeInTheDocument();
  });

  it("shows honest empty states when registry APIs return no items", async () => {
    const fetchImpl = mockFetchWithPayloads({
      "/api/v1/modules": { items: [] },
      "/api/v1/open-source-capabilities?includeDeferred=true&includeLegalReview=true&phase=all":
        {
          items: []
        },
      "/api/v1/open-source-tools?includeDeferred=true&includeLegalReview=true&phase=all":
        {
          items: []
        },
      "/api/v1/third-party-tools": {
        items: []
      },
      "/api/v1/operator-recommendations": { items: [] },
      "/api/v1/operators": { items: [] }
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(
        screen.getByText("No module manifests are registered.")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /No matching OSS packages in marketplace \(try reset filters or broaden search\)\./
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("No capabilities are registered.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No operator profiles are registered.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No operator recommendations are available.")
    ).toBeInTheDocument();
  });

  it("shows signed-out state without loading registry endpoints", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      json: async () => ({
        error: "Unauthorized"
      }),
      ok: false,
      status: 401
    });

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Sign in to review Periscan registries."
        })
      ).toBeInTheDocument();
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shows retryable registry errors while preserving authenticated context", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input);

      if (route === "/api/v1/me") {
        return {
          json: async () => authPayload,
          ok: true,
          status: 200
        };
      }

      if (route === "/api/v1/modules") {
        return {
          json: async () => ({
            error: "Module registry unavailable"
          }),
          ok: false,
          status: 503
        };
      }

      return {
        json: async () => populatedPayloads[route],
        ok: true,
        status: 200
      };
    }) as unknown as typeof fetch;

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Module registry unavailable"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/modules",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("keeps registry data visible and safely reloads after a refresh failure", async () => {
    let moduleRequestCount = 0;

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input);

      if (route === "/api/v1/modules") {
        moduleRequestCount += 1;

        if (moduleRequestCount === 2) {
          return {
            json: async () => ({
              error: "Module registry refresh failed"
            }),
            ok: false,
            status: 503
          };
        }
      }

      const payload = populatedPayloads[route];

      return {
        json: async () => payload,
        ok: true,
        status: 200
      };
    }) as unknown as typeof fetch;

    vi.stubGlobal("fetch", fetchImpl);

    render(<RegistryCenter />);

    await waitFor(() => {
      expect(
        screen.getByText("Gitleaks repository secret validation")
      ).toBeInTheDocument();
    });

    const readyToolsMetric = screen
      .getByText("Ready OSS tools")
      .closest(".metric");
    expect(readyToolsMetric).toHaveTextContent("1");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Refresh registries"
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Module registry refresh failed"
      );
    });

    expect(
      screen.getByText("Gitleaks repository secret validation")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reload registries"
      })
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    expect(moduleRequestCount).toBe(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/modules",
      expect.objectContaining({ cache: "no-store" })
    );
  });
});
