import { describe, expect, it } from "vitest";

import {
  OpenSourceCapabilitySchema,
  OpenSourceToolCatalogEntrySchema,
  OpenSourceToolDefinitionSchema,
  ApplyThirdPartyToolUpdateRequestSchema,
  DismissThirdPartyToolUpdateRequestSchema,
  ReviewThirdPartyToolCandidateRequestSchema,
  ThirdPartyToolCandidateImportRequestSchema,
  ThirdPartyToolCandidateImportResponseSchema,
  ThirdPartyToolCandidateSchema,
  ThirdPartyToolImplementationWorkOrderSchema,
  ThirdPartyToolImplementationBundleSchema,
  ThirdPartyToolPromotionCertificationSchema,
  ThirdPartyToolPromotionHandoffSchema,
  ThirdPartyToolPromotionPackageSchema,
  ThirdPartyToolActivityEventSchema,
  ThirdPartyToolCandidateReadinessSchema,
  ThirdPartyToolCandidateReadinessSummarySchema,
  ThirdPartyToolRunnerDispatchRequestSchema,
  ThirdPartyToolRunnerDispatchResponseSchema,
  ThirdPartyToolRunnerEligibilitySchema,
  ThirdPartyToolRefreshDueRequestSchema,
  ThirdPartyToolRefreshDueResponseSchema,
  ThirdPartyToolCoverageAuditSchema,
  ThirdPartyToolUpstreamVersionCheckSchema,
  ThirdPartyToolUpdateRecommendationSchema,
  ThirdPartyToolSchema,
  AcceptToolLicenseRequestSchema,
  ToolLicenseAcceptanceSchema,
  ListToolLicenseAcceptancesQuerySchema,
  ThirdPartyToolInstallPlanSchema,
  ToolIntakeManifestRequestSchema,
  ToolIntakeValidationReportSchema,
  ToolGovernancePolicySchema,
  ToolInstallJobSchema,
  ToolRuntimeInstallationSchema
} from "./open-source.js";

describe("open source schemas", () => {
  it("parses a tool definition", () => {
    expect(
      OpenSourceToolDefinitionSchema.parse({
        binaryName: "gitleaks",
        category: "Secrets",
        defaultVersion: "v8.30.0",
        displayName: "Gitleaks",
        dockerImage: "ghcr.io/gitleaks/gitleaks",
        docsUrl: "https://github.com/gitleaks/gitleaks",
        gitRepo: "https://github.com/gitleaks/gitleaks.git",
        license: "MIT",
        moduleIds: ["gitleaks.repo_secrets"],
        notes: "Repository secret scanning engine.",
        npmPackage: null,
        phase: "Current",
        pipPackage: null,
        policyStatus: "Enabled",
        runtimePreference: ["binary", "docker"],
        toolId: "gitleaks"
      }).toolId
    ).toBe("gitleaks");
  });

  it("accepts Engine Lab Phase 0 integrity and upstream license fields", () => {
    const digest = `sha256:${"a".repeat(64)}`;
    const tool = OpenSourceToolDefinitionSchema.parse({
      binaryName: "semgrep",
      category: "WebAppScan",
      defaultVersion: "1.45.0",
      displayName: "Semgrep",
      dockerImage: "semgrep/semgrep",
      docsUrl: "https://semgrep.dev/docs/",
      expectedIntegrity: digest,
      gitRepo: "https://github.com/semgrep/semgrep.git",
      imageDigest: digest,
      license: "LGPL-2.1",
      moduleIds: ["semgrep.code_exploit_scan"],
      notes: "SAST engine",
      npmPackage: null,
      phase: "Current",
      pipPackage: null,
      policyStatus: "RequiresLegalReview",
      releaseArtifact: "https://github.com/semgrep/semgrep/releases/latest",
      runtimePreference: ["docker", "binary"],
      toolId: "semgrep",
      upstreamHomepage: "https://semgrep.dev/",
      upstreamLicenseUrl: "https://github.com/semgrep/semgrep/blob/develop/LICENSE",
      userLicenseAcceptanceRequired: true
    });
    expect(tool.expectedIntegrity).toBe(digest);
    expect(tool.imageDigest).toBe(digest);
    expect(tool.upstreamLicenseUrl).toContain("LICENSE");
    expect(tool.userLicenseAcceptanceRequired).toBe(true);
  });

  it("parses a capability interface", () => {
    expect(
      OpenSourceCapabilitySchema.parse({
        apiRoutes: [
          "/api/v1/open-source-tools",
          "/api/v1/modules",
          "/api/v1/missions"
        ],
        capabilityId: "gitleaks.repo-secrets",
        description: "Scans authorized repositories for secrets.",
        evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
        executionMode: "ControlPlane",
        featureTags: ["repository", "secrets"],
        inputSchemaRef: "GitleaksTargetSchema",
        interfaceKind: "ValidationModule",
        missionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        moduleId: "gitleaks.repo_secrets",
        name: "Repository Secret Scan",
        outputSchemaRef: "ModuleOutputSchema",
        phase: "Current",
        requiredIntegrations: ["github"],
        requiredScopes: ["Repository"],
        safetyLevels: ["PassiveReadOnly"],
        status: "Implemented",
        toolId: "gitleaks"
      }).capabilityId
    ).toBe("gitleaks.repo-secrets");
  });

  it("parses a catalog entry with counts and readiness", () => {
    expect(
      OpenSourceToolCatalogEntrySchema.parse({
        capabilities: [],
        capabilityCounts: {
          blocked: 0,
          deferred: 0,
          fixtureOnly: 0,
          implemented: 1,
          planned: 0,
          total: 1
        },
        readiness: "Implemented",
        tool: {
          binaryName: "gitleaks",
          category: "Secrets",
          defaultVersion: "v8.30.0",
          displayName: "Gitleaks",
          dockerImage: "ghcr.io/gitleaks/gitleaks",
          docsUrl: "https://github.com/gitleaks/gitleaks",
          gitRepo: "https://github.com/gitleaks/gitleaks.git",
          license: "MIT",
          moduleIds: ["gitleaks.repo_secrets"],
          notes: "Repository secret scanning engine.",
          npmPackage: null,
          phase: "Current",
          pipPackage: null,
          policyStatus: "Enabled",
          runtimePreference: ["binary", "docker"],
          toolId: "gitleaks"
        }
      }).readiness
    ).toBe("Implemented");
  });

  it("parses third-party tool governance contracts", () => {
    const updatedAt = "2026-06-27T12:00:00.000Z";
    const toolId = "gitleaks";

    const governance = ToolGovernancePolicySchema.parse({
      allowedRuntimes: ["binary", "docker"],
      disabledReason: null,
      enabled: true,
      legalReviewStatus: "Approved",
      pinnedGitRef: "v8.30.0",
      pinnedImageRef: "ghcr.io/gitleaks/gitleaks:v8.30.0",
      pinnedVersion: "v8.30.0",
      source: "TenantOverride",
      status: "Enabled",
      tenantId: "00000000-0000-4000-8000-000000000001",
      toolId,
      updatedAt
    });
    const runtimeInstallation = ToolRuntimeInstallationSchema.parse({
      installedAt: null,
      installedVersion: null,
      installStatus: "Available",
      lastCheckedAt: updatedAt,
      runtimeAvailable: true,
      runtimeKind: "binary",
      runtimeReason: "Runtime is available.",
      toolId
    });
    const job = ToolInstallJobSchema.parse({
      action: "Check",
      completedAt: updatedAt,
      createdAt: updatedAt,
      jobId: "00000000-0000-4000-8000-000000000002",
      outputRedacted: "ok",
      reason: "checked",
      requestedBy: "00000000-0000-4000-8000-000000000003",
      runtimeKind: "binary",
      startedAt: updatedAt,
      status: "Completed",
      tenantId: "00000000-0000-4000-8000-000000000001",
      toolId
    });

    expect(
      ThirdPartyToolSchema.parse({
        governance,
        recentJobs: [job],
        runtimeInstallation,
        tool: {
          capabilities: [],
          capabilityCounts: {
            blocked: 0,
            deferred: 0,
            fixtureOnly: 0,
            implemented: 1,
            planned: 0,
            total: 1
          },
          executionReadiness: "Ready",
          readiness: "Implemented",
          runtimeAvailable: true,
          runtimeKind: "binary",
          runtimeReason: "Runtime is available.",
          tool: {
            binaryName: "gitleaks",
            category: "Secrets",
            defaultVersion: "v8.30.0",
            displayName: "Gitleaks",
            dockerImage: "ghcr.io/gitleaks/gitleaks",
            docsUrl: "https://github.com/gitleaks/gitleaks",
            gitRepo: "https://github.com/gitleaks/gitleaks.git",
            license: "MIT",
            moduleIds: ["gitleaks.repo_secrets"],
            notes: "Repository secret scanning engine.",
            npmPackage: null,
            phase: "Current",
            pipPackage: null,
            policyStatus: "Enabled",
            runtimePreference: ["binary", "docker"],
            toolId
          }
        }
      }).governance.status
    ).toBe("Enabled");
  });

  it("parses third-party tool coverage audit contracts", () => {
    const generatedAt = "2026-06-27T12:00:00.000Z";

    expect(
      ThirdPartyToolCoverageAuditSchema.parse({
        blockedTools: 1,
        contentOrImportOnlyTools: 1,
        coverageComplete: true,
        deferredTools: 1,
        doesNotDispatchRunnerTasks: true,
        doesNotEnable: true,
        doesNotExecute: true,
        doesNotInstall: true,
        doesNotQueueMissions: true,
        executableTools: 1,
        generatedAt,
        needsImplementationTools: 0,
        requiredActions: [
          "Keep blocked/legal-review tools disabled until legal review clears."
        ],
        tenantId: "00000000-0000-4000-8000-000000000001",
        tools: [
          {
            capabilityCounts: {
              blocked: 0,
              deferred: 0,
              fixtureOnly: 0,
              implemented: 1,
              planned: 0,
              total: 1
            },
            capabilityIds: ["gitleaks.repo-secrets"],
            category: "Secrets",
            displayName: "Gitleaks",
            disposition: "Executable",
            executionReadiness: "Ready",
            missingModuleIds: [],
            moduleIdsDeclared: ["gitleaks.repo_secrets"],
            moduleIdsPresent: ["gitleaks.repo_secrets"],
            phase: "Current",
            policyStatus: "Enabled",
            readiness: "Implemented",
            requiredActions: [],
            runtimeAvailable: true,
            runtimeKind: "binary",
            runtimeReason: "Runtime is available.",
            safetyNotes: [
              "Coverage audit is read-only and does not execute the tool."
            ],
            toolId: "gitleaks"
          }
        ],
        totalTools: 4
      }).coverageComplete
    ).toBe(true);
  });

  it("parses third-party tool update recommendation contracts", () => {
    const timestamp = "2026-06-27T12:00:00.000Z";
    const tenantId = "00000000-0000-4000-8000-000000000001";
    const userId = "00000000-0000-4000-8000-000000000003";

    expect(
      ThirdPartyToolUpdateRecommendationSchema.parse({
        appliedAt: null,
        appliedBy: null,
        createdAt: timestamp,
        currentInstalledVersion: "v8.29.0",
        currentPinnedVersion: "v8.29.0",
        dismissedAt: null,
        dismissedBy: null,
        generatedAt: timestamp,
        generatedBy: userId,
        installJobId: null,
        policyBlocked: false,
        reason:
          "Reviewed catalog version v8.30.0 differs from pinned version v8.29.0.",
        recommendationId: "00000000-0000-4000-8000-000000000004",
        requiredActions: [
          "Review release notes",
          "Queue an install job before enabling runtime use"
        ],
        reviewedVersion: "v8.30.0",
        runtimeKind: "docker",
        source: "ReviewedCatalog",
        status: "UpdateAvailable",
        tenantId,
        toolId: "gitleaks",
        updatedAt: timestamp
      }).status
    ).toBe("UpdateAvailable");

    expect(
      ApplyThirdPartyToolUpdateRequestSchema.parse({
        queueInstall: true,
        runtimeKind: "docker"
      }).queueInstall
    ).toBe(true);
    expect(
      DismissThirdPartyToolUpdateRequestSchema.parse({
        reason: "Hold for next maintenance window."
      }).reason
    ).toBe("Hold for next maintenance window.");
  });

  it("parses third-party tool upstream version check contracts", () => {
    expect(
      ThirdPartyToolUpstreamVersionCheckSchema.parse({
        catalogVersion: "v8.30.0",
        checkedAt: "2026-06-27T12:00:00.000Z",
        checkedBy: "00000000-0000-4000-8000-000000000003",
        checkId: "00000000-0000-4000-8000-000000000005",
        discoveredVersion: "v8.31.0",
        metadata: {
          reviewRequired: true
        },
        reason:
          "Trusted upstream version v8.31.0 differs from reviewed catalog version v8.30.0.",
        requiredActions: [
          "Review upstream release notes before updating the reviewed catalog.",
          "Create or update the catalog entry, module fixture, parser test, license notice, and runtime pin in code."
        ],
        sourceKind: "GitHubRelease",
        sourceUrl: "https://github.com/gitleaks/gitleaks/releases/latest",
        status: "CandidateAvailable",
        tenantId: "00000000-0000-4000-8000-000000000001",
        toolId: "gitleaks",
        updateAvailable: true
      }).status
    ).toBe("CandidateAvailable");
  });

  it("parses third-party tool due refresh contracts", () => {
    const timestamp = "2026-06-27T12:00:00.000Z";
    const tenantId = "00000000-0000-4000-8000-000000000001";
    const userId = "00000000-0000-4000-8000-000000000003";
    const upstreamCheck = ThirdPartyToolUpstreamVersionCheckSchema.parse({
      catalogVersion: "v8.30.0",
      checkedAt: timestamp,
      checkedBy: userId,
      checkId: "00000000-0000-4000-8000-000000000005",
      discoveredVersion: "v8.31.0",
      metadata: {
        reviewRequired: true
      },
      reason:
        "Trusted upstream version v8.31.0 differs from reviewed catalog version v8.30.0.",
      requiredActions: ["Review upstream release notes."],
      sourceKind: "GitHubRelease",
      sourceUrl: "https://github.com/gitleaks/gitleaks/releases/latest",
      status: "CandidateAvailable",
      tenantId,
      toolId: "gitleaks",
      updateAvailable: true
    });
    const updateRecommendation = ThirdPartyToolUpdateRecommendationSchema.parse(
      {
        appliedAt: null,
        appliedBy: null,
        createdAt: timestamp,
        currentInstalledVersion: null,
        currentPinnedVersion: "v8.29.0",
        dismissedAt: null,
        dismissedBy: null,
        generatedAt: timestamp,
        generatedBy: userId,
        installJobId: null,
        policyBlocked: false,
        reason:
          "Reviewed catalog version v8.30.0 differs from pinned version v8.29.0.",
        recommendationId: "00000000-0000-4000-8000-000000000006",
        requiredActions: ["Apply the reviewed pin."],
        reviewedVersion: "v8.30.0",
        runtimeKind: "docker",
        source: "ReviewedCatalog",
        status: "UpdateAvailable",
        tenantId,
        toolId: "gitleaks",
        updatedAt: timestamp
      }
    );

    expect(ThirdPartyToolRefreshDueRequestSchema.parse({}).maxTools).toBe(25);
    expect(
      ThirdPartyToolRefreshDueResponseSchema.parse({
        checkedCount: 1,
        failedCount: 0,
        generatedAt: timestamp,
        maxTools: 25,
        minHoursSinceLastCheck: 24,
        skippedCount: 1,
        tenantId,
        tools: [
          {
            checkedAt: timestamp,
            displayName: "Gitleaks",
            lastCheckedAt: null,
            reason: "Tool refresh completed.",
            requiredActions: ["Review update recommendation."],
            status: "Checked",
            toolId: "gitleaks",
            updateRecommendation,
            upstreamCheck
          },
          {
            checkedAt: null,
            displayName: "SharpHound",
            lastCheckedAt: null,
            reason: "Tool requires legal review.",
            requiredActions: ["Complete legal review."],
            status: "Skipped",
            toolId: "sharphound",
            updateRecommendation: null,
            upstreamCheck: null
          }
        ]
      }).tools
    ).toHaveLength(2);
  });

  it("parses third-party tool candidate readiness summary contracts", () => {
    const timestamp = "2026-06-28T12:00:00.000Z";
    const tenantId = "00000000-0000-4000-8000-000000000001";
    const candidate = ThirdPartyToolCandidateSchema.parse({
      candidateId: "00000000-0000-4000-8000-000000000031",
      category: "Dependency",
      createdAt: timestamp,
      displayName: "Example Scanner",
      implementationOwner: null,
      manifest: {
        category: "Dependency",
        customerVisibleDescription:
          "Safely imports dependency advisory evidence for tenant-owned repositories.",
        defaultVersion: "1.2.3",
        displayName: "Example Scanner",
        dockerImage: "ghcr.io/example/scanner",
        docsUrl: "https://github.com/example/scanner",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "ControlPlane",
        gitRepo: "https://github.com/example/scanner.git",
        intendedUse:
          "Parse approved manifests and produce normalized evidence without changing customer systems.",
        license: "Apache-2.0",
        moduleId: "example.scanner_import",
        name: "Example Scanner Import",
        proposedCapabilities: ["Dependency advisory import"],
        requiredScopes: ["Repository"],
        runtimePreference: ["docker", "git"],
        safetyLevel: "PassiveReadOnly",
        supportedMissionTypes: ["ValidationSnapshot"],
        toolId: "example-scanner"
      },
      requestedBy: "00000000-0000-4000-8000-000000000003",
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      reviewStatus: "NotReviewed",
      status: "AcceptedForCatalogReview",
      tenantId,
      toolId: "example-scanner",
      updatedAt: timestamp,
      validationReport: {
        checks: [
          {
            checkId: "license",
            message: "Apache-2.0 is acceptable.",
            remediation: null,
            severity: "Low",
            status: "Pass",
            title: "License"
          }
        ],
        decision: "AcceptedForCatalogReview",
        duplicateOf: null,
        generatedAt: timestamp,
        governance: {
          allowedRuntimes: ["docker", "git"],
          approvalRequired: false,
          defaultEnabled: false,
          installableRuntimes: ["docker", "git"],
          legalReviewRequired: false,
          liveExecutionAllowed: false,
          policyStatus: "Enabled",
          reason: "Safe passive import.",
          requiresInternalRunner: false,
          runnerCompatible: false,
          runnerExecutionMode: null
        },
        moduleScaffold: {
          manifestStatus: "ReviewRequired",
          moduleId: "example.scanner_import",
          requiredFiles: ["packages/modules/src/example-scanner.ts"],
          requiredTests: ["tests/modules/example-scanner.test.ts"]
        },
        normalizedToolId: "example-scanner",
        requiredActions: ["Open a reviewed code change."],
        summary: "Example Scanner passed automated intake checks."
      }
    });

    expect(
      ThirdPartyToolCandidateReadinessSummarySchema.parse({
        blockedCount: 0,
        doesNotEnable: true,
        doesNotExecute: true,
        doesNotInstall: true,
        doesNotQueueMissions: true,
        doesNotWriteCatalog: true,
        generatedAt: timestamp,
        intakeStatusCounts: {
          AcceptedForCatalogReview: 1,
          Rejected: 0,
          RequiresChanges: 0
        },
        items: [
          {
            candidate,
            readiness: {
              candidateId: candidate.candidateId,
              catalogEntryPresent: false,
              checks: [
                {
                  checkId: "catalog-entry",
                  evidence: [],
                  requiredAction: "Add a reviewed catalog entry.",
                  status: "Missing",
                  summary: "No reviewed catalog entry exists.",
                  title: "Catalog entry"
                }
              ],
              displayName: candidate.displayName,
              generatedAt: timestamp,
              governancePolicyAvailable: false,
              moduleManifestPresent: false,
              readyForGovernance: false,
              requiredActions: ["Add a reviewed catalog entry."],
              status: "NeedsImplementation",
              tenantId,
              toolId: candidate.toolId
            }
          }
        ],
        needsImplementationCount: 1,
        readyForGovernanceCount: 0,
        requiredActions: ["Add a reviewed catalog entry."],
        reviewStatusCounts: {
          AcceptedForImplementation: 0,
          NeedsChanges: 0,
          NotReviewed: 1,
          PromotedToCatalog: 0,
          Rejected: 0
        },
        tenantId,
        totalCandidates: 1
      }).doesNotExecute
    ).toBe(true);
  });

  it("parses third-party tool activity events", () => {
    const timestamp = "2026-06-27T12:00:00.000Z";

    expect(
      ThirdPartyToolActivityEventSchema.parse({
        activityId: "audit:00000000-0000-4000-8000-000000000006",
        actorUserId: "00000000-0000-4000-8000-000000000003",
        category: "Governance",
        entityId: "00000000-0000-4000-8000-000000000006",
        entityType: "AuditEvent",
        metadata: {
          action: "third_party_tool.enabled",
          toolId: "gitleaks"
        },
        occurredAt: timestamp,
        source: "AuditEvent",
        status: "third_party_tool.enabled",
        summary: "Gitleaks was enabled for the tenant.",
        tenantId: "00000000-0000-4000-8000-000000000001",
        title: "Tool enabled",
        toolId: "gitleaks"
      }).source
    ).toBe("AuditEvent");

    expect(
      ThirdPartyToolActivityEventSchema.parse({
        activityId: "runner-task:00000000-0000-4000-8000-000000000007",
        actorUserId: null,
        category: "Execution",
        entityId: "00000000-0000-4000-8000-000000000007",
        entityType: "RunnerTask",
        metadata: {
          moduleId: "recon.host_discovery",
          runnerId: "00000000-0000-4000-8000-000000000008",
          taskType: "discover"
        },
        occurredAt: timestamp,
        source: "RunnerTask",
        status: "Queued",
        summary: "Runner task recon.host_discovery is Queued.",
        tenantId: "00000000-0000-4000-8000-000000000001",
        title: "Runner task",
        toolId: "nmap"
      }).source
    ).toBe("RunnerTask");
  });

  it("parses third-party tool runner eligibility reports", () => {
    const timestamp = "2026-06-27T12:00:00.000Z";

    expect(
      ThirdPartyToolRunnerEligibilitySchema.parse({
        activeRunnerCount: 1,
        capabilities: [
          {
            capabilityId: "nmap.host-discovery",
            dispatchRoute: "/api/v1/runners/:runnerId/tasks/discover",
            dispatchable: true,
            executionMode: "InternalRunner",
            moduleId: "recon.host_discovery",
            name: "Internal Host Discovery",
            reasons: ["Module is server-allowlisted for runner dispatch."],
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
        runtimeKind: "docker",
        serverAllowlistedModuleIds: [
          "recon.host_discovery",
          "recon.service_inventory"
        ],
        status: "Ready",
        tenantId: "00000000-0000-4000-8000-000000000001",
        toolId: "nmap",
        verifiedScopeCount: 1
      }).status
    ).toBe("Ready");
  });

  it("parses third-party tool runner dispatch contracts", () => {
    const timestamp = "2026-06-27T12:00:00.000Z";
    const request = ThirdPartyToolRunnerDispatchRequestSchema.parse({
      capabilityId: "nmap.service-inventory",
      runnerId: "00000000-0000-4000-8000-000000000002",
      scopeId: "00000000-0000-4000-8000-000000000003",
      target: "10.0.0.0/24",
      timeoutSeconds: 60,
      topPorts: 100
    });

    expect(request.rateLimitPerMinute).toBe(30);

    expect(
      ThirdPartyToolRunnerDispatchResponseSchema.parse({
        capability: {
          capabilityId: "nmap.service-inventory",
          dispatchRoute: "/api/v1/runners/:runnerId/tasks/discover",
          dispatchable: true,
          executionMode: "InternalRunner",
          moduleId: "recon.service_inventory",
          name: "Internal Service Inventory",
          reasons: ["Capability is server-allowlisted for runner dispatch."],
          requiredActions: [],
          requiredScopes: ["IPRange", "InternalNetwork"],
          safetyLevels: ["ActiveNonInvasive"],
          status: "Ready"
        },
        dispatchRoute: "/api/v1/runners/:runnerId/tasks/discover",
        result: {
          envelope: {
            artifactUpload: {
              artifactUploadUrl: "https://runner.periscan.test/tasks/artifacts",
              maxArtifactBytes: 1000000,
              resultCallbackUrl: "https://runner.periscan.test/tasks/result"
            },
            executionEnvironment: "InternalRunner",
            expiresAt: timestamp,
            inputs: {},
            issuedAt: timestamp,
            missionId: "00000000-0000-4000-8000-000000000004",
            moduleId: "recon.service_inventory",
            runId: "00000000-0000-4000-8000-000000000005",
            runnerId: "00000000-0000-4000-8000-000000000002",
            safetyLevel: "ActiveNonInvasive",
            scopeConstraints: {
              approvedCidrs: ["10.0.0.0/24"],
              approvedDnsSuffixes: [],
              approvedHostnames: [],
              approvedPorts: [],
              forbidInternetEgress: true
            },
            scopeId: "00000000-0000-4000-8000-000000000003",
            signature: {
              algorithm: "EdDSA",
              digestSha256: "digest123",
              keyId: "runner-key",
              nonce: "00000000-0000-4000-8000-000000000006",
              signature: "abc123"
            },
            target: { targetHost: "10.0.0.0/24" },
            taskId: "00000000-0000-4000-8000-000000000007",
            tenantId: "00000000-0000-4000-8000-000000000001"
          },
          mission: {
            createdAt: timestamp,
            evidenceIds: [],
            missionId: "00000000-0000-4000-8000-000000000004",
            missionType: "ExposureValidation",
            policyDecisionId: "00000000-0000-4000-8000-000000000008",
            policyProfile: "runner-discover",
            requestedBy: "00000000-0000-4000-8000-000000000009",
            safetyLevel: "ActiveNonInvasive",
            scopeId: "00000000-0000-4000-8000-000000000003",
            scopeIds: ["00000000-0000-4000-8000-000000000003"],
            startedAt: timestamp,
            status: "Queued",
            tenantId: "00000000-0000-4000-8000-000000000001",
            updatedAt: timestamp
          },
          run: {
            completedAt: null,
            createdAt: timestamp,
            errorSummary: null,
            evidenceIds: [],
            missionId: "00000000-0000-4000-8000-000000000004",
            moduleId: "recon.service_inventory",
            outcome: null,
            policyDecisionId: "00000000-0000-4000-8000-000000000008",
            runnerId: "00000000-0000-4000-8000-000000000002",
            runId: "00000000-0000-4000-8000-000000000005",
            safetyLevel: "ActiveNonInvasive",
            scopeId: "00000000-0000-4000-8000-000000000003",
            startedAt: null,
            status: "Queued",
            target: { targetHost: "10.0.0.0/24" },
            tenantId: "00000000-0000-4000-8000-000000000001",
            updatedAt: timestamp,
            validationState: null
          },
          task: {
            acceptedAt: null,
            completedAt: null,
            createdAt: timestamp,
            envelope: {
              artifactUpload: {
                artifactUploadUrl:
                  "https://runner.periscan.test/tasks/artifacts",
                maxArtifactBytes: 1000000,
                resultCallbackUrl: "https://runner.periscan.test/tasks/result"
              },
              executionEnvironment: "InternalRunner",
              expiresAt: timestamp,
              inputs: {},
              issuedAt: timestamp,
              missionId: "00000000-0000-4000-8000-000000000004",
              moduleId: "recon.service_inventory",
              runId: "00000000-0000-4000-8000-000000000005",
              runnerId: "00000000-0000-4000-8000-000000000002",
              safetyLevel: "ActiveNonInvasive",
              scopeConstraints: {
                approvedCidrs: ["10.0.0.0/24"],
                approvedDnsSuffixes: [],
                approvedHostnames: [],
                approvedPorts: [],
                forbidInternetEgress: true
              },
              scopeId: "00000000-0000-4000-8000-000000000003",
              signature: {
                algorithm: "EdDSA",
                digestSha256: "digest123",
                keyId: "runner-key",
                nonce: "00000000-0000-4000-8000-000000000006",
                signature: "abc123"
              },
              target: { targetHost: "10.0.0.0/24" },
              taskId: "00000000-0000-4000-8000-000000000007",
              tenantId: "00000000-0000-4000-8000-000000000001"
            },
            errorSummary: null,
            expiresAt: timestamp,
            inputPayloadHash: null,
            inputs: {},
            issuedAt: timestamp,
            leasedAt: null,
            localAuditHash: null,
            missionId: "00000000-0000-4000-8000-000000000004",
            moduleId: "recon.service_inventory",
            moduleVersion: null,
            normalizedOutput: null,
            redactedEvidenceIds: [],
            rejectedReason: null,
            resourceUsage: null,
            result: null,
            runId: "00000000-0000-4000-8000-000000000005",
            runnerId: "00000000-0000-4000-8000-000000000002",
            safetyLevel: "ActiveNonInvasive",
            scopeConstraints: {
              approvedCidrs: ["10.0.0.0/24"],
              approvedDnsSuffixes: [],
              approvedHostnames: [],
              approvedPorts: [],
              forbidInternetEgress: true
            },
            scopeId: "00000000-0000-4000-8000-000000000003",
            status: "Queued",
            target: { targetHost: "10.0.0.0/24" },
            taskId: "00000000-0000-4000-8000-000000000007",
            taskType: "recon.service_inventory",
            tenantId: "00000000-0000-4000-8000-000000000001",
            updatedAt: timestamp
          }
        },
        toolId: "nmap"
      }).dispatchRoute
    ).toBe("/api/v1/runners/:runnerId/tasks/discover");
  });

  it("parses tool intake request and validation report contracts", () => {
    const request = ToolIntakeManifestRequestSchema.parse({
      category: "Dependency",
      customerVisibleDescription:
        "Safely imports dependency advisory evidence for tenant-owned repositories.",
      defaultVersion: "1.2.3",
      displayName: "Example Scanner",
      dockerImage: "ghcr.io/example/scanner",
      docsUrl: "https://github.com/example/scanner",
      evidenceTypes: ["NormalizedEvidence"],
      executionMode: "ControlPlane",
      gitRepo: "https://github.com/example/scanner.git",
      intendedUse:
        "Parse approved manifests and produce normalized evidence without changing customer systems.",
      license: "Apache-2.0",
      moduleId: "example.scanner_import",
      name: "Example Scanner Import",
      proposedCapabilities: ["Dependency advisory import"],
      requiredScopes: ["Repository"],
      runMode: "ServiceDirect",
      runtimePreference: ["docker", "git"],
      safetyLevel: "PassiveReadOnly",
      supportedMissionTypes: ["ValidationSnapshot"],
      toolId: "example-scanner"
    });

    expect(request.toolId).toBe("example-scanner");
    expect(request.writesToTarget).toBe(false);

    const validationReport = ToolIntakeValidationReportSchema.parse({
      checks: [
        {
          checkId: "license-policy",
          message: "License allowed.",
          remediation: null,
          severity: "Info",
          status: "Pass",
          title: "License"
        }
      ],
      decision: "AcceptedForCatalogReview",
      duplicateOf: null,
      generatedAt: "2026-06-27T12:00:00.000Z",
      governance: {
        allowedRuntimes: ["docker", "git"],
        approvalRequired: false,
        defaultEnabled: true,
        installableRuntimes: ["docker", "git"],
        legalReviewRequired: false,
        liveExecutionAllowed: true,
        policyStatus: "Enabled",
        reason: "Ready for review.",
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
      summary: "Ready for reviewed catalog implementation."
    });

    expect(validationReport.decision).toBe("AcceptedForCatalogReview");

    const candidate = ThirdPartyToolCandidateSchema.parse({
      candidateId: "11111111-1111-4111-8111-111111111111",
      category: request.category,
      createdAt: "2026-06-27T12:00:00.000Z",
      displayName: request.displayName,
      implementationOwner: null,
      manifest: request,
      requestedBy: "22222222-2222-4222-8222-222222222222",
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      reviewStatus: "NotReviewed",
      status: validationReport.decision,
      tenantId: "33333333-3333-4333-8333-333333333333",
      toolId: request.toolId,
      updatedAt: "2026-06-27T12:00:00.000Z",
      validationReport
    });

    expect(candidate.status).toBe("AcceptedForCatalogReview");
    expect(
      ThirdPartyToolCandidateImportRequestSchema.parse({
        importLabel: "June tool backlog",
        manifests: [request]
      }).manifests
    ).toHaveLength(1);
    expect(
      ThirdPartyToolCandidateImportResponseSchema.parse({
        failedCount: 1,
        generatedAt: "2026-06-27T12:00:00.000Z",
        importLabel: "June tool backlog",
        items: [
          {
            candidate,
            decision: validationReport.decision,
            displayName: candidate.displayName,
            errors: [],
            index: 0,
            status: "Submitted",
            toolId: candidate.toolId,
            validationReport
          },
          {
            candidate: null,
            decision: null,
            displayName: null,
            errors: ["toolId: Required"],
            index: 1,
            status: "Failed",
            toolId: null,
            validationReport: null
          }
        ],
        submittedCount: 1,
        tenantId: candidate.tenantId,
        totalCount: 2
      }).items
    ).toHaveLength(2);
    expect(
      ReviewThirdPartyToolCandidateRequestSchema.parse({
        implementationOwner: "Platform Engineering",
        notes: "Accepted for module implementation after intake review.",
        reviewStatus: "AcceptedForImplementation"
      }).reviewStatus
    ).toBe("AcceptedForImplementation");
    expect(
      ThirdPartyToolCandidateReadinessSchema.parse({
        candidateId: candidate.candidateId,
        catalogEntryPresent: false,
        checks: [
          {
            checkId: "catalog-entry",
            evidence: [
              "Candidate tool ID example-scanner is not in the reviewed catalog."
            ],
            requiredAction:
              "Add a reviewed catalog entry before the tool can be governed.",
            status: "Missing",
            summary: "No reviewed catalog entry exists yet.",
            title: "Reviewed catalog entry"
          }
        ],
        displayName: candidate.displayName,
        generatedAt: "2026-06-27T12:00:00.000Z",
        governancePolicyAvailable: false,
        moduleManifestPresent: false,
        readyForGovernance: false,
        requiredActions: [
          "Add a reviewed catalog entry before the tool can be governed."
        ],
        status: "NeedsImplementation",
        tenantId: candidate.tenantId,
        toolId: candidate.toolId
      }).status
    ).toBe("NeedsImplementation");
    expect(
      ThirdPartyToolImplementationWorkOrderSchema.parse({
        candidateId: candidate.candidateId,
        createdAt: "2026-06-27T12:00:00.000Z",
        displayName: candidate.displayName,
        generatedBy: "22222222-2222-4222-8222-222222222222",
        readinessStatus: "NeedsImplementation",
        requiredActions: [
          "Add a reviewed catalog entry before the tool can be governed."
        ],
        reviewStatus: "AcceptedForImplementation",
        scaffoldFiles: [
          {
            contentPreview: "moduleId: example.scanner_import",
            path: "packages/modules/src/example-scanner.ts",
            purpose: "Validation module wrapper",
            templateKind: "ModuleManifest"
          }
        ],
        status: "Draft",
        summary: "Implementation work order for Example Scanner.",
        tasks: [
          {
            blocksExecution: true,
            category: "ModuleManifest",
            description: "Create module manifest and execution wrapper.",
            requiredEvidence: ["module manifest test"],
            status: "NotStarted",
            taskId: "module-manifest",
            title: "Create module manifest"
          }
        ],
        tenantId: candidate.tenantId,
        toolId: candidate.toolId,
        updatedAt: "2026-06-27T12:00:00.000Z",
        workOrderId: "44444444-4444-4444-8444-444444444444"
      }).status
    ).toBe("Draft");
    expect(
      ThirdPartyToolImplementationBundleSchema.parse({
        bundleId:
          "tool-implementation-bundle:44444444-4444-4444-8444-444444444444",
        candidateId: candidate.candidateId,
        commands: [
          "pnpm --filter @periscan/modules test -- example.scanner_import"
        ],
        displayName: candidate.displayName,
        doesNotExecute: true,
        files: [
          {
            content: "moduleId: example.scanner_import",
            contentSha256:
              "1f0bd8726f91b40509d320086d3d4925d0867459e3bf4e036c8c538f3efaf180",
            path: "packages/modules/src/example-scanner.ts",
            purpose: "Validation module wrapper",
            templateKind: "ModuleManifest"
          }
        ],
        generatedAt: "2026-06-27T12:00:00.000Z",
        readinessStatus: "NeedsImplementation",
        requiredActions: [
          "Add a reviewed catalog entry before the tool can be governed."
        ],
        reviewStatus: "AcceptedForImplementation",
        safetyNotes: [
          "Implementation bundles are scaffold artifacts only and do not install, enable, queue, dispatch, or execute tools."
        ],
        status: "ReadyForDownload",
        summary: "Implementation bundle for Example Scanner.",
        tenantId: candidate.tenantId,
        toolId: candidate.toolId,
        workOrderId: "44444444-4444-4444-8444-444444444444"
      }).status
    ).toBe("ReadyForDownload");
    expect(
      ThirdPartyToolPromotionPackageSchema.parse({
        capabilityIds: ["gitleaks.repo-secrets"],
        candidateId: candidate.candidateId,
        catalogSnapshot: {
          capabilities: [
            {
              apiRoutes: ["/api/v1/modules"],
              capabilityId: "gitleaks.repo-secrets",
              description: "Scans authorized repositories for secrets.",
              evidenceTypes: ["NormalizedEvidence"],
              executionMode: "ControlPlane",
              featureTags: [],
              inputSchemaRef: "GitleaksTargetSchema",
              interfaceKind: "ValidationModule",
              missionTypes: ["ValidationSnapshot"],
              moduleId: "gitleaks.repo_secrets",
              name: "Repository Secret Scan",
              outputSchemaRef: "ModuleOutputSchema",
              phase: "Current",
              requiredIntegrations: ["github"],
              requiredScopes: ["Repository"],
              safetyLevels: ["PassiveReadOnly"],
              status: "Implemented",
              toolId: "gitleaks"
            }
          ],
          capabilityCounts: {
            blocked: 0,
            deferred: 0,
            fixtureOnly: 0,
            implemented: 1,
            planned: 0,
            total: 1
          },
          readiness: "Implemented",
          runtimeAvailable: true,
          runtimeKind: "docker",
          runtimeReason: "Docker image is available.",
          tool: {
            binaryName: "gitleaks",
            category: "Secrets",
            defaultVersion: "v8.30.0",
            displayName: "Gitleaks",
            dockerImage: "ghcr.io/gitleaks/gitleaks",
            docsUrl: "https://github.com/gitleaks/gitleaks",
            gitRepo: "https://github.com/gitleaks/gitleaks.git",
            license: "MIT",
            moduleIds: ["gitleaks.repo_secrets"],
            notes: "Repository secret scanning engine.",
            npmPackage: null,
            phase: "Current",
            pipPackage: null,
            policyStatus: "Enabled",
            runtimePreference: ["docker", "git"],
            toolId: "gitleaks"
          }
        },
        createdAt: "2026-06-27T12:00:00.000Z",
        displayName: "Gitleaks",
        governanceSnapshot: {
          allowedRuntimes: ["docker", "git"],
          disabledReason: null,
          enabled: true,
          legalReviewStatus: "Approved",
          pinnedGitRef: "v8.30.0",
          pinnedImageRef: "ghcr.io/gitleaks/gitleaks:v8.30.0",
          pinnedVersion: "v8.30.0",
          source: "Default",
          status: "Enabled",
          tenantId: candidate.tenantId,
          toolId: "gitleaks",
          updatedAt: "2026-06-27T12:00:00.000Z"
        },
        implementationOwner: "Platform Engineering",
        moduleIds: ["gitleaks.repo_secrets"],
        promotedAt: "2026-06-27T12:00:00.000Z",
        promotedBy: "22222222-2222-4222-8222-222222222222",
        promotionPackageId: "55555555-5555-4555-8555-555555555555",
        readinessReport: {
          candidateId: candidate.candidateId,
          catalogEntryPresent: true,
          checks: [
            {
              checkId: "catalog-entry",
              evidence: ["Reviewed catalog entry exists for gitleaks."],
              requiredAction: null,
              status: "Satisfied",
              summary: "The tool is present in the reviewed OSS catalog.",
              title: "Reviewed catalog entry"
            }
          ],
          displayName: "Gitleaks",
          generatedAt: "2026-06-27T12:00:00.000Z",
          governancePolicyAvailable: true,
          moduleManifestPresent: true,
          readyForGovernance: true,
          requiredActions: [],
          status: "ReadyForGovernance",
          tenantId: candidate.tenantId,
          toolId: "gitleaks"
        },
        requiredEvidence: [
          "Reviewed catalog entry exists for the tool.",
          "Registered module manifest declares the promoted tool ID."
        ],
        reviewStatus: "PromotedToCatalog",
        runtimeInstallation: {
          installedAt: null,
          installedVersion: null,
          installStatus: "Available",
          lastCheckedAt: "2026-06-27T12:00:00.000Z",
          runtimeAvailable: true,
          runtimeKind: "docker",
          runtimeReason: "Docker image is available.",
          toolId: "gitleaks"
        },
        safetyNotes: ["Promotion packages do not execute tools."],
        status: "ReadyForGovernance",
        summary: "Gitleaks has reviewed promotion evidence.",
        tenantId: candidate.tenantId,
        toolId: "gitleaks",
        updatedAt: "2026-06-27T12:00:00.000Z"
      }).status
    ).toBe("ReadyForGovernance");
    expect(
      ThirdPartyToolPromotionHandoffSchema.parse({
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
              "Mission start remains subject to verified scope and policy decision."
            ],
            requiredActions: [
              "Create or start a mission using the reviewed module."
            ],
            status: "Ready",
            summary: "Use the existing mission APIs under policy.",
            title: "Start policy-gated validation mission"
          }
        ],
        candidateId: candidate.candidateId,
        generatedAt: "2026-06-27T12:00:00.000Z",
        governanceEnabled: true,
        governanceStatus: "Enabled",
        promotionPackageId: "44444444-4444-4444-8444-444444444444",
        runnerEligibility: null,
        runtimeAvailable: true,
        runtimeStatus: "Available",
        status: "ReadyForPolicyApproval",
        summary:
          "Gitleaks is ready for explicit policy-gated mission or runner approval.",
        tenantId: candidate.tenantId,
        toolId: "gitleaks"
      }).status
    ).toBe("ReadyForPolicyApproval");
    expect(
      ThirdPartyToolPromotionCertificationSchema.parse({
        candidateId: candidate.candidateId,
        certificationId:
          "tool-promotion-certification:55555555-5555-4555-8555-555555555555",
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
            evidence: ["Execution actions remain policy-gated."],
            requiredActions: [],
            status: "Passed",
            summary: "No execution action bypasses policy gates.",
            title: "Execution policy gates"
          }
        ],
        createdAt: "2026-06-27T12:00:00.000Z",
        displayName: "Gitleaks",
        doesNotDispatchRunnerTasks: true,
        doesNotEnable: true,
        doesNotExecute: true,
        doesNotInstall: true,
        doesNotQueueMissions: true,
        generatedAt: "2026-06-27T12:00:00.000Z",
        generatedBy: "11111111-1111-4111-8111-111111111111",
        governanceStatus: "Enabled",
        packageStatus: "ReadyForGovernance",
        promotionPackageId: "55555555-5555-4555-8555-555555555555",
        readinessStatus: "ReadyForGovernance",
        requiredActions: [],
        runnerStatus: "ControlPlaneOnly",
        runtimeStatus: "Available",
        safetyNotes: [
          "Certification reports are read-only and do not execute tools."
        ],
        status: "CertifiedForUse",
        summary:
          "Gitleaks is certified for policy-gated use from current governance state.",
        tenantId: candidate.tenantId,
        toolId: "gitleaks"
      }).status
    ).toBe("CertifiedForUse");
  });

  it("parses tool license acceptance ceremony payloads", () => {
    const acceptance = ToolLicenseAcceptanceSchema.parse({
      acceptanceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      acceptedAt: "2026-07-29T12:00:00.000Z",
      acceptedBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      createdAt: "2026-07-29T12:00:00.000Z",
      spdx: "LGPL-2.1",
      tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      textHash: "a".repeat(64),
      toolId: "semgrep",
      version: "1.45.0"
    });
    expect(acceptance.toolId).toBe("semgrep");
    expect(acceptance.textHash).toHaveLength(64);

    expect(
      AcceptToolLicenseRequestSchema.parse({
        authorized: true,
        toolId: "semgrep"
      }).toolId
    ).toBe("semgrep");

    expect(() =>
      AcceptToolLicenseRequestSchema.parse({
        authorized: false,
        toolId: "semgrep"
      })
    ).toThrow();

    expect(
      ListToolLicenseAcceptancesQuerySchema.parse({ toolId: "semgrep" }).toolId
    ).toBe("semgrep");
    expect(ListToolLicenseAcceptancesQuerySchema.parse({}).toolId).toBeUndefined();

    const plan = ThirdPartyToolInstallPlanSchema.parse({
      displayCommand: "docker pull semgrep/semgrep:1.45.0",
      docsUrl: "https://semgrep.dev/docs/",
      installable: true,
      licenseAccepted: false,
      noOp: false,
      notRedistributedByDefault: true,
      reason: null,
      requiresLicenseAcceptance: true,
      runtimeKind: "docker",
      spdx: "LGPL-2.1",
      toolId: "semgrep",
      version: "1.45.0"
    });
    expect(plan.notRedistributedByDefault).toBe(true);
    expect(plan.requiresLicenseAcceptance).toBe(true);
  });
});
