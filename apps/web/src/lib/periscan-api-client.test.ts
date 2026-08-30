import { afterEach, describe, expect, it, vi } from "vitest";

import { HEALTH_ROUTE } from "@periscan/shared";

import { PeriscanApiClient } from "./periscan-api-client";
import type { PeriscanApiClientError } from "./periscan-api-client";
import {
  clearWorkingTenant,
  setWorkingTenant
} from "./working-tenant";

describe("PeriscanApiClient", () => {
  afterEach(() => {
    clearWorkingTenant();
  });

  it("calls the versioned public health route", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        service: "api",
        status: "ok",
        timestamp: "2026-06-01T00:00:00.000Z"
      })
    });

    const client = new PeriscanApiClient(fetchImpl as typeof fetch);
    const payload = await client.getHealth();

    expect(fetchImpl).toHaveBeenCalledWith(HEALTH_ROUTE, {
      cache: "no-store",
      credentials: "include",
      headers: {}
    });
    expect(payload.status).toBe("ok");
  });

  it("raises typed API client errors", async () => {
    const client = new PeriscanApiClient(
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          error: "Upstream API unavailable"
        })
      }) as typeof fetch
    );

    await expect(client.getHealth()).rejects.toEqual(
      expect.objectContaining<Partial<PeriscanApiClientError>>({
        message: "Upstream API unavailable",
        status: 503
      })
    );
  });

  it("supports password recovery and invitation activation routes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: "Account access updated." })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await client.requestPasswordReset("owner@example.com");
    await client.confirmPasswordReset({
      password: "a-secure-password",
      token: "reset-token"
    });
    await client.acceptInvite({
      password: "a-secure-password",
      token: "invite-token"
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/auth/password-reset/request",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/v1/auth/accept-invite",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("starts SSO and saves a tenant OIDC configuration", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const config = {
      authorizationEndpoint: "https://idp.example.com/authorize",
      clientId: "periscan",
      clientSecretSet: true,
      createdAt: timestamp,
      createdBy: null,
      defaultMappedRole: null,
      emailDomainAllowlist: ["example.com"],
      enforced: false,
      issuerUrl: "https://idp.example.com",
      jwksUri: "https://idp.example.com/jwks",
      providerType: "OIDC",
      redirectUri: "https://periscan.example/api/v1/auth/sso/callback",
      roleClaimName: "groups",
      roleMappings: [{ claimValue: "periscan-admins", role: "Admin" as const }],
      samlIdpCertificateSet: false,
      samlNameIdFormat: null,
      scopes: ["openid", "email"],
      status: "Enabled",
      tenantId,
      tokenEndpoint: "https://idp.example.com/token",
      updatedAt: timestamp,
      updatedBy: null
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => config
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          authorizationUrl: "https://idp.example.com/authorize?state=opaque",
          expiresAt: "2026-06-01T00:10:00.000Z",
          providerType: "OIDC",
          redirectUri: "https://periscan.example/api/v1/auth/sso/callback",
          tenantId
        })
      });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const saved = await client.updateSsoConfig({
      authorizationEndpoint: config.authorizationEndpoint,
      clientId: config.clientId,
      clientSecret: "write-only-secret",
      emailDomainAllowlist: config.emailDomainAllowlist,
      enabled: true,
      enforced: false,
      issuerUrl: config.issuerUrl,
      jwksUri: config.jwksUri,
      providerType: "OIDC",
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      tokenEndpoint: config.tokenEndpoint
    });
    const started = await client.startSsoLogin({ tenantId });

    expect(saved.clientSecretSet).toBe(true);
    expect(started.authorizationUrl).toContain("idp.example.com");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/tenants/current/sso",
      expect.objectContaining({ method: "PUT" })
    );
  });

  it("validates evidence chain and artifact verification responses", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const evidenceId = "22222222-2222-4222-8222-222222222222";
    const verifiedAt = "2026-07-14T12:00:00.000Z";
    const method = {
      algorithm: "SHA-256",
      authority: "Periscan evidence service",
      description:
        "Tenant-scoped hash-chain verification. This is a tamper-evident commitment, not an external digital signature.",
      signaturePresent: false
    };
    const link = {
      chainHash: "chain-hash",
      chainSeq: "1",
      evidenceId,
      prevChainHash: null,
      reason: null,
      status: "Verified",
      valid: true
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          brokenAtSeq: null,
          chainedArtifacts: 1,
          checked: 1,
          legacyUnchainedArtifacts: 0,
          links: [link],
          method,
          reason: null,
          tenantId,
          totalArtifacts: 1,
          valid: true,
          verifiedAt
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chain: link,
          content: {
            commitment: "Ingest",
            computedSha256: "recorded-hash",
            recordedSha256: "recorded-hash",
            valid: true
          },
          evidenceId,
          method,
          reason: null,
          status: "Verified",
          tenantId,
          valid: true,
          verifiedAt
        })
      });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await expect(client.verifyEvidenceChain()).resolves.toMatchObject({
      checked: 1,
      valid: true
    });
    await expect(
      client.verifyEvidenceIntegrity(evidenceId)
    ).resolves.toMatchObject({ evidenceId, status: "Verified", valid: true });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/evidence/verify-chain",
      { cache: "no-store",
        credentials: "include", headers: {} }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `/api/v1/evidence/${evidenceId}/verify`,
      { cache: "no-store",
        credentials: "include", headers: {} }
    );
  });

  it("validates proposed third-party tool intake manifests", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        checks: [
          {
            checkId: "license-policy",
            message: "Apache-2.0 is acceptable.",
            remediation: null,
            severity: "Info",
            status: "Pass",
            title: "License is acceptable"
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
          reason: "Candidate can proceed to reviewed implementation.",
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
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const result = await client.validateThirdPartyToolIntake({
      binaryName: null,
      canExecuteCode: false,
      canExfiltrateData: false,
      canModifyTarget: false,
      category: "Dependency",
      customerVisibleDescription:
        "Safely imports dependency advisory evidence for tenant-owned repositories.",
      dataSensitivity: "Moderate",
      defaultVersion: "1.2.3",
      destructivePotential: "None",
      displayName: "Example Scanner",
      dockerImage: "ghcr.io/example/scanner",
      docsUrl: "https://github.com/example/scanner",
      evidenceTypes: ["NormalizedEvidence"],
      executionMode: "ControlPlane",
      gitRepo: "https://github.com/example/scanner.git",
      intendedUse:
        "Parse approved manifests and produce normalized evidence without changing customer systems.",
      license: "Apache-2.0",
      maintainer: "Periscan Security Engineering",
      moduleId: "example.scanner_import",
      name: "Example Scanner Import",
      networkAccessRequired: false,
      npmPackage: null,
      pipPackage: null,
      proposedCapabilities: ["Dependency advisory import"],
      requiredIntegrations: ["github"],
      requiredPermissions: ["read-only metadata"],
      requiredScopes: ["Repository"],
      runMode: "ServiceDirect",
      runtimePreference: ["docker", "git"],
      safetyLevel: "PassiveReadOnly",
      sourceUrl: "https://github.com/example/scanner",
      supportedMissionTypes: ["ValidationSnapshot"],
      toolId: "example-scanner",
      writesToTarget: false
    });

    expect(result.decision).toBe("AcceptedForCatalogReview");
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/intake/validate",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(
      JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string)
        .toolId
    ).toBe("example-scanner");
  });

  it("submits and lists third-party tool intake candidates", async () => {
    const manifest = {
      binaryName: null,
      canExecuteCode: false,
      canExfiltrateData: false,
      canModifyTarget: false,
      category: "Dependency" as const,
      customerVisibleDescription:
        "Safely imports dependency advisory evidence for tenant-owned repositories.",
      dataSensitivity: "Moderate" as const,
      defaultVersion: "1.2.3",
      destructivePotential: "None" as const,
      displayName: "Example Scanner",
      dockerImage: "ghcr.io/example/scanner",
      docsUrl: "https://github.com/example/scanner",
      evidenceTypes: ["NormalizedEvidence" as const],
      executionMode: "ControlPlane" as const,
      gitRepo: "https://github.com/example/scanner.git",
      intendedUse:
        "Parse approved manifests and produce normalized evidence without changing customer systems.",
      license: "Apache-2.0",
      maintainer: "Periscan Security Engineering",
      moduleId: "example.scanner_import",
      name: "Example Scanner Import",
      networkAccessRequired: false,
      npmPackage: null,
      pipPackage: null,
      proposedCapabilities: ["Dependency advisory import"],
      requiredIntegrations: ["github"],
      requiredPermissions: ["read-only metadata"],
      requiredScopes: ["Repository" as const],
      runMode: "ServiceDirect" as const,
      runtimePreference: ["docker" as const, "git" as const],
      safetyLevel: "PassiveReadOnly" as const,
      sourceUrl: "https://github.com/example/scanner",
      supportedMissionTypes: ["ValidationSnapshot" as const],
      toolId: "example-scanner",
      writesToTarget: false
    };
    const validationReport = {
      checks: [
        {
          checkId: "license-policy",
          message: "Apache-2.0 is acceptable.",
          remediation: null,
          severity: "Info",
          status: "Pass",
          title: "License is acceptable"
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
        reason: "Candidate can proceed to reviewed implementation.",
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
    const candidate = {
      candidateId: "11111111-1111-4111-8111-111111111111",
      category: "Dependency",
      createdAt: "2026-06-27T12:00:00.000Z",
      displayName: "Example Scanner",
      implementationOwner: null,
      manifest,
      requestedBy: "22222222-2222-4222-8222-222222222222",
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      reviewStatus: "NotReviewed",
      status: "AcceptedForCatalogReview",
      tenantId: "33333333-3333-4333-8333-333333333333",
      toolId: "example-scanner",
      updatedAt: "2026-06-27T12:00:00.000Z",
      validationReport
    };
    const workOrder = {
      candidateId: candidate.candidateId,
      createdAt: "2026-06-27T12:40:00.000Z",
      displayName: "Example Scanner",
      generatedBy: "22222222-2222-4222-8222-222222222222",
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
          requiredEvidence: ["Module manifest example.scanner_import exists"],
          status: "NotStarted",
          taskId: "module-manifest",
          title: "Create module manifest and tool binding"
        }
      ],
      tenantId: candidate.tenantId,
      toolId: "example-scanner",
      updatedAt: "2026-06-27T12:40:00.000Z",
      workOrderId: "44444444-4444-4444-8444-444444444444"
    };
    const implementationBundle = {
      bundleId: `tool-implementation-bundle:${workOrder.workOrderId}`,
      candidateId: candidate.candidateId,
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
        }
      ],
      generatedAt: "2026-06-27T12:41:00.000Z",
      readinessStatus: "NeedsImplementation",
      requiredActions: workOrder.requiredActions,
      reviewStatus: "AcceptedForImplementation",
      safetyNotes: [
        "Implementation bundles are scaffold artifacts only and do not install, enable, queue, dispatch, or execute tools."
      ],
      status: "ReadyForDownload",
      summary:
        "Example Scanner implementation bundle contains 1 scaffold file.",
      tenantId: candidate.tenantId,
      toolId: "example-scanner",
      workOrderId: workOrder.workOrderId
    };
    const updateRecommendation = {
      appliedAt: null,
      appliedBy: null,
      createdAt: "2026-06-27T12:50:00.000Z",
      currentInstalledVersion: "v8.29.0",
      currentPinnedVersion: "v8.29.0",
      dismissedAt: null,
      dismissedBy: null,
      generatedAt: "2026-06-27T12:50:00.000Z",
      generatedBy: "22222222-2222-4222-8222-222222222222",
      installJobId: null,
      policyBlocked: false,
      reason:
        "Reviewed catalog version v8.30.0 differs from pinned version v8.29.0.",
      recommendationId: "55555555-5555-4555-8555-555555555555",
      requiredActions: [
        "Review upstream release notes for the catalog version.",
        "Apply the reviewed pin and queue an install job before runtime use."
      ],
      reviewedVersion: "v8.30.0",
      runtimeKind: "docker",
      source: "ReviewedCatalog",
      status: "UpdateAvailable",
      tenantId: candidate.tenantId,
      toolId: "gitleaks",
      updatedAt: "2026-06-27T12:50:00.000Z"
    };
    const upstreamCheck = {
      catalogVersion: "v8.30.0",
      checkedAt: "2026-06-27T13:00:00.000Z",
      checkedBy: "22222222-2222-4222-8222-222222222222",
      checkId: "88888888-8888-4888-8888-888888888888",
      discoveredVersion: "v8.31.0",
      metadata: {
        reviewRequired: true
      },
      reason:
        "Trusted upstream version v8.31.0 differs from reviewed catalog version v8.30.0.",
      requiredActions: [
        "Review upstream release notes before updating the reviewed catalog."
      ],
      sourceKind: "GitHubRelease",
      sourceUrl: "https://github.com/gitleaks/gitleaks/releases/latest",
      status: "CandidateAvailable",
      tenantId: candidate.tenantId,
      toolId: "gitleaks",
      updateAvailable: true
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => candidate
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          failedCount: 0,
          generatedAt: "2026-06-27T12:05:00.000Z",
          importLabel: "June backlog import",
          items: [
            {
              candidate,
              decision: "AcceptedForCatalogReview",
              displayName: "Example Scanner",
              errors: [],
              index: 0,
              status: "Submitted",
              toolId: "example-scanner",
              validationReport
            }
          ],
          submittedCount: 1,
          tenantId: candidate.tenantId,
          totalCount: 1
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [candidate] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidateId: candidate.candidateId,
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
            }
          ],
          displayName: "Example Scanner",
          generatedAt: "2026-06-27T12:00:00.000Z",
          governancePolicyAvailable: false,
          moduleManifestPresent: false,
          readyForGovernance: false,
          requiredActions: [
            "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool."
          ],
          status: "NeedsImplementation",
          tenantId: candidate.tenantId,
          toolId: "example-scanner"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...candidate,
          implementationOwner: "Platform Engineering",
          reviewedAt: "2026-06-27T12:30:00.000Z",
          reviewedBy: "22222222-2222-4222-8222-222222222222",
          reviewNotes: "Accepted for implementation planning.",
          reviewStatus: "AcceptedForImplementation",
          updatedAt: "2026-06-27T12:30:00.000Z"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => workOrder
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [workOrder] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => implementationBundle
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => updateRecommendation
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [updateRecommendation] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => upstreamCheck
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [upstreamCheck] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          checkedCount: 1,
          failedCount: 0,
          generatedAt: "2026-06-27T13:30:00.000Z",
          maxTools: 5,
          minHoursSinceLastCheck: 24,
          skippedCount: 0,
          tenantId: candidate.tenantId,
          tools: [
            {
              checkedAt: "2026-06-27T13:30:00.000Z",
              displayName: "Gitleaks",
              lastCheckedAt: null,
              reason:
                "Refresh created a trusted upstream check and reviewed-version recommendation.",
              requiredActions: ["Review upstream release notes."],
              status: "Checked",
              toolId: "gitleaks",
              updateRecommendation,
              upstreamCheck
            }
          ]
        })
      });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await expect(
      client.submitThirdPartyToolCandidate(manifest)
    ).resolves.toEqual(
      expect.objectContaining({
        status: "AcceptedForCatalogReview",
        toolId: "example-scanner"
      })
    );
    await expect(
      client.importThirdPartyToolCandidates({
        importLabel: "June backlog import",
        manifests: [manifest]
      })
    ).resolves.toEqual(
      expect.objectContaining({
        failedCount: 0,
        submittedCount: 1,
        totalCount: 1
      })
    );
    await expect(client.listThirdPartyToolCandidates()).resolves.toHaveLength(
      1
    );
    await expect(
      client.getThirdPartyToolCandidateReadiness(candidate.candidateId)
    ).resolves.toEqual(
      expect.objectContaining({
        readyForGovernance: false,
        status: "NeedsImplementation"
      })
    );
    await expect(
      client.reviewThirdPartyToolCandidate(candidate.candidateId, {
        implementationOwner: "Platform Engineering",
        notes: "Accepted for implementation planning.",
        reviewStatus: "AcceptedForImplementation"
      })
    ).resolves.toEqual(
      expect.objectContaining({
        implementationOwner: "Platform Engineering",
        reviewStatus: "AcceptedForImplementation"
      })
    );
    await expect(
      client.generateThirdPartyToolImplementationWorkOrder(
        candidate.candidateId
      )
    ).resolves.toEqual(
      expect.objectContaining({
        status: "Draft",
        toolId: "example-scanner",
        workOrderId: workOrder.workOrderId
      })
    );
    await expect(
      client.listThirdPartyToolImplementationWorkOrders(candidate.candidateId)
    ).resolves.toEqual([
      expect.objectContaining({ workOrderId: workOrder.workOrderId })
    ]);
    await expect(
      client.getThirdPartyToolImplementationBundle(
        candidate.candidateId,
        workOrder.workOrderId
      )
    ).resolves.toEqual(
      expect.objectContaining({
        doesNotExecute: true,
        status: "ReadyForDownload",
        workOrderId: workOrder.workOrderId
      })
    );
    await expect(
      client.checkThirdPartyToolUpdateRecommendation("gitleaks")
    ).resolves.toEqual(
      expect.objectContaining({
        recommendationId: updateRecommendation.recommendationId,
        status: "UpdateAvailable"
      })
    );
    await expect(
      client.listThirdPartyToolUpdateRecommendations("gitleaks")
    ).resolves.toEqual([
      expect.objectContaining({
        recommendationId: updateRecommendation.recommendationId
      })
    ]);
    await expect(
      client.checkThirdPartyToolUpstreamVersion("gitleaks")
    ).resolves.toEqual(
      expect.objectContaining({
        checkId: upstreamCheck.checkId,
        status: "CandidateAvailable"
      })
    );
    await expect(
      client.listThirdPartyToolUpstreamVersionChecks("gitleaks")
    ).resolves.toEqual([
      expect.objectContaining({
        checkId: upstreamCheck.checkId
      })
    ]);
    await expect(
      client.refreshDueThirdPartyTools({
        maxTools: 5,
        minHoursSinceLastCheck: 24
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkedCount: 1,
        tools: [
          expect.objectContaining({
            status: "Checked",
            toolId: "gitleaks"
          })
        ]
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/third-party-tools/intake/candidates",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/v1/third-party-tools/intake/candidates/import",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/v1/third-party-tools/intake/candidates",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      `/api/v1/third-party-tools/intake/candidates/${candidate.candidateId}/readiness`,
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      `/api/v1/third-party-tools/intake/candidates/${candidate.candidateId}/review`,
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      `/api/v1/third-party-tools/intake/candidates/${candidate.candidateId}/work-orders`,
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      `/api/v1/third-party-tools/intake/candidates/${candidate.candidateId}/work-orders`,
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      8,
      `/api/v1/third-party-tools/intake/candidates/${candidate.candidateId}/work-orders/${workOrder.workOrderId}/implementation-bundle`,
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      9,
      "/api/v1/third-party-tools/gitleaks/update-recommendations/check",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      10,
      "/api/v1/third-party-tools/gitleaks/update-recommendations",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      11,
      "/api/v1/third-party-tools/gitleaks/upstream-version-checks/check",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      12,
      "/api/v1/third-party-tools/gitleaks/upstream-version-checks",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      13,
      "/api/v1/third-party-tools/refresh-due",
      expect.objectContaining({
        method: "POST"
      })
    );
  });

  it("reads third-party tool candidate readiness summaries", async () => {
    const candidate = {
      candidateId: "11111111-1111-4111-8111-111111111111",
      category: "Dependency",
      createdAt: "2026-06-28T12:00:00.000Z",
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
      requestedBy: "22222222-2222-4222-8222-222222222222",
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      reviewStatus: "NotReviewed",
      status: "AcceptedForCatalogReview",
      tenantId: "33333333-3333-4333-8333-333333333333",
      toolId: "example-scanner",
      updatedAt: "2026-06-28T12:00:00.000Z",
      validationReport: {
        checks: [
          {
            checkId: "license-policy",
            message: "Apache-2.0 is acceptable.",
            remediation: null,
            severity: "Info",
            status: "Pass",
            title: "License is acceptable"
          }
        ],
        decision: "AcceptedForCatalogReview",
        duplicateOf: null,
        generatedAt: "2026-06-28T12:00:00.000Z",
        governance: {
          allowedRuntimes: ["docker", "git"],
          approvalRequired: false,
          defaultEnabled: true,
          installableRuntimes: ["docker", "git"],
          legalReviewRequired: false,
          liveExecutionAllowed: true,
          policyStatus: "Enabled",
          reason: "Candidate can proceed to reviewed implementation.",
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
      }
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        blockedCount: 0,
        doesNotEnable: true,
        doesNotExecute: true,
        doesNotInstall: true,
        doesNotQueueMissions: true,
        doesNotWriteCatalog: true,
        generatedAt: "2026-06-28T12:01:00.000Z",
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
                  requiredAction:
                    "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool.",
                  status: "Missing",
                  summary: "No reviewed catalog entry exists yet.",
                  title: "Reviewed catalog entry"
                }
              ],
              displayName: "Example Scanner",
              generatedAt: "2026-06-28T12:01:00.000Z",
              governancePolicyAvailable: false,
              moduleManifestPresent: false,
              readyForGovernance: false,
              requiredActions: [
                "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool."
              ],
              status: "NeedsImplementation",
              tenantId: candidate.tenantId,
              toolId: "example-scanner"
            }
          }
        ],
        needsImplementationCount: 1,
        readyForGovernanceCount: 0,
        requiredActions: [
          "Add a reviewed OSS tool catalog entry before tenant governance can manage this tool."
        ],
        reviewStatusCounts: {
          AcceptedForImplementation: 0,
          NeedsChanges: 0,
          NotReviewed: 1,
          PromotedToCatalog: 0,
          Rejected: 0
        },
        tenantId: candidate.tenantId,
        totalCandidates: 1
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await expect(
      client.getThirdPartyToolCandidateReadinessSummary()
    ).resolves.toEqual(
      expect.objectContaining({
        doesNotExecute: true,
        needsImplementationCount: 1,
        totalCandidates: 1
      })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/intake/candidates/readiness-summary",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
  });

  it("lists third-party tool activity through the API", async () => {
    const activity = {
      activityId: "install-job:66666666-6666-4666-8666-666666666666",
      actorUserId: "22222222-2222-4222-8222-222222222222",
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
      tenantId: "11111111-1111-4111-8111-111111111111",
      title: "Check job Completed",
      toolId: "gitleaks"
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [activity] })
    });

    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await expect(
      client.listThirdPartyToolActivity("gitleaks")
    ).resolves.toEqual([
      expect.objectContaining({
        activityId: activity.activityId,
        source: "InstallJob",
        toolId: "gitleaks"
      })
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/gitleaks/activity?limit=25",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
  });

  it("reads third-party tool runner eligibility through the API", async () => {
    const eligibility = {
      activeRunnerCount: 1,
      capabilities: [
        {
          capabilityId: "nmap-host-discovery",
          dispatchRoute: "/api/v1/runners/:runnerId/tasks/discover",
          dispatchable: true,
          executionMode: "InternalRunner",
          moduleId: "recon.host_discovery",
          name: "Host discovery",
          reasons: [],
          requiredActions: [],
          requiredScopes: ["IPRange"],
          safetyLevels: ["ActiveNonInvasive"],
          status: "Ready"
        }
      ],
      eligible: true,
      generatedAt: "2026-06-27T14:00:00.000Z",
      governanceStatus: "Enabled",
      reasons: [],
      requiredActions: [],
      runtimeAvailable: true,
      runtimeKind: "docker",
      serverAllowlistedModuleIds: ["recon.host_discovery"],
      status: "Ready",
      tenantId: "11111111-1111-4111-8111-111111111111",
      toolId: "nmap",
      verifiedScopeCount: 1
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => eligibility
    });

    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await expect(
      client.getThirdPartyToolRunnerEligibility("nmap")
    ).resolves.toEqual(
      expect.objectContaining({
        eligible: true,
        status: "Ready",
        toolId: "nmap"
      })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/nmap/runner-eligibility",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
  });

  it("reads the third-party tool coverage audit through the API", async () => {
    const audit = {
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
      generatedAt: "2026-06-27T14:00:00.000Z",
      needsImplementationTools: 0,
      requiredActions: [],
      tenantId: "11111111-1111-4111-8111-111111111111",
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
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => audit
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await expect(client.getThirdPartyToolCoverageAudit()).resolves.toEqual(
      expect.objectContaining({
        doesNotExecute: true,
        needsImplementationTools: 0,
        tenantId: audit.tenantId
      })
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/coverage-audit",
      expect.objectContaining({
        cache: "no-store",
        credentials: "include",
      })
    );
  });

  it("verifies scopes without using the dev-mode bypass by default", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const scopeId = "33333333-3333-4333-8333-333333333333";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        createdAt: timestamp,
        createdBy: "22222222-2222-4222-8222-222222222222",
        scopeId,
        scopeType: "Domain",
        tenantId: "11111111-1111-4111-8111-111111111111",
        updatedAt: timestamp,
        value: "example.com",
        verificationMethod: "DNS_TXT",
        verificationStatus: "Verified",
        verificationToken: "periscan-token",
        verifiedAt: timestamp,
        verifiedBy: "22222222-2222-4222-8222-222222222222"
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await client.verifyScope(scopeId);
    await client.verifyScope(scopeId, { devModeManual: true });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `/api/v1/scopes/${scopeId}/verify`,
      {
        body: "{}",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST"
      }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `/api/v1/scopes/${scopeId}/verify`,
      {
        body: JSON.stringify({ devModeManual: true }),
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST"
      }
    );
  });

  it("reads validation operations resources from public API routes", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const scopeId = "22222222-2222-4222-8222-222222222222";
    const integrationId = "33333333-3333-4333-8333-333333333333";
    const evidenceId = "44444444-4444-4444-8444-444444444444";
    const relatedId = "55555555-5555-4555-8555-555555555555";
    const reportId = "66666666-6666-4666-8666-666666666666";
    const aiAppId = "77777777-7777-4777-8777-777777777777";
    const controlSourceId = "88888888-8888-4888-8888-888888888888";
    const runnerId = "99999999-9999-4999-8999-999999999999";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              artifactType: "NormalizedEvidence",
              createdAt: timestamp,
              evidenceId,
              redactionStatus: "Redacted",
              relatedEntityId: relatedId,
              relatedEntityType: "AttackPath",
              sensitivityLevel: "Moderate",
              sha256: "abc123",
              storageUri: "s3://periscan/evidence.json",
              tenantId,
              updatedAt: timestamp
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              audience: "Security Team",
              createdAt: timestamp,
              evidenceIds: [evidenceId],
              evidencePackId: reportId,
              packType: "ValidationSnapshotReport",
              redactionLevel: "Moderate",
              status: "Ready",
              storageUri: "s3://periscan/report.html",
              tenantId,
              title: "Validation Snapshot",
              updatedAt: timestamp
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              aiAppId,
              appType: "RAG",
              authMethod: "Test account",
              createdAt: timestamp,
              dataSourcesDescription: "Knowledge base",
              endpointUrl: "https://ai.example.com/chat",
              guardrailsDescription: "Policy guardrails",
              lastValidatedAt: null,
              name: "Support Copilot",
              owner: "AI Platform",
              ragEnabled: true,
              scopeId,
              tenantId,
              toolsEnabled: true,
              updatedAt: timestamp
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              controlSourceId,
              controlType: "SIEM",
              createdAt: timestamp,
              expectedBehaviors: ["Logged"],
              healthStatus: "Healthy",
              integrationId,
              lastValidatedAt: null,
              provider: "Splunk",
              telemetryStatus: "Healthy",
              tenantId,
              updatedAt: timestamp
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              arch: "amd64",
              certificateExpiresAt: null,
              createdAt: timestamp,
              createdBy: null,
              deploymentMode: "Docker",
              hostname: "runner-1",
              labels: ["prod"],
              lastSeenAt: timestamp,
              name: "Production Runner",
              networkProfile: {
                additionalEgressNotes: null,
                dnsResolutionRequired: true,
                explicitProxyUrl: null,
                gatewayHostnames: ["api.periscan.test"],
                httpConnectProxySupported: true,
                outboundHttpsPorts: [443]
              },
              os: "linux",
              revokedAt: null,
              runnerId,
              status: "Active",
              tenantId,
              transportMode: "LongPollHttps",
              updatedAt: timestamp,
              version: "0.1.0"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generatedAt: timestamp,
          snapshotId: null,
          source: "LiveTenantStateBaseline",
          stages: [
            "Scope",
            "Discover",
            "Prioritize",
            "Validate",
            "Mobilize",
            "Verify"
          ].map((stage) => ({
            evidenceCount: 0,
            openItemCount: 0,
            stage,
            status: "NotStarted",
            trend: "Stable"
          })),
          tenantId,
          topRiskBand: "Informational"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              description: "Validation runs executed.",
              label: "Validation runs",
              meterName: "ValidationRuns",
              unit: "runs"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              apiAccess: "Included",
              audiences: ["Security teams"],
              description: "Focused evidence-backed Validation Snapshot.",
              includedCapabilities: ["Validation Snapshot"],
              includedMeterNames: ["ValidationRuns", "EvidencePacks"],
              label: "Validation Snapshot",
              packageKey: "ValidationSnapshot",
              paymentProcessorStatus: "NotConfigured",
              publicPricingLanguage: "Pay for what you validate.",
              status: "Available",
              supportedOutcomes: ["Evidence-backed report"]
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          billingAccountId: null,
          meteringPeriodEnd: "2026-07-01T00:00:00.000Z",
          meteringPeriodStart: timestamp,
          meters: [
            {
              description: "Validation runs executed.",
              label: "Validation runs",
              measuredAt: timestamp,
              meterName: "ValidationRuns",
              quantity: 1,
              unit: "runs"
            }
          ],
          tenantId
        })
      });

    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    expect((await client.listEvidence())[0]?.evidenceId).toBe(evidenceId);
    expect((await client.listReports())[0]?.evidencePackId).toBe(reportId);
    expect((await client.listAIApplications())[0]?.aiAppId).toBe(aiAppId);
    expect((await client.listControlSources())[0]?.controlSourceId).toBe(
      controlSourceId
    );
    expect((await client.listRunners())[0]?.runnerId).toBe(runnerId);
    const ctemProgram = await client.getCTEMProgram();
    expect(ctemProgram.stages).toHaveLength(6);
    expect(ctemProgram.source).toBe("LiveTenantStateBaseline");
    expect((await client.getBillingMeters())[0]?.meterName).toBe(
      "ValidationRuns"
    );
    expect((await client.getBillingPackages())[0]?.packageKey).toBe(
      "ValidationSnapshot"
    );
    expect((await client.getBillingUsage()).meters[0]?.quantity).toBe(1);
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "/api/v1/evidence", {
      cache: "no-store",
      credentials: "include",
      headers: {}
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(8, "/api/v1/billing/packages", {
      cache: "no-store",
      credentials: "include",
      headers: {}
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(9, "/api/v1/billing/usage", {
      cache: "no-store",
      credentials: "include",
      headers: {}
    });
  });

  it("creates and parses validation snapshots", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        aiAppRisks: [],
        controlObservations: [],
        createdAt: "2026-06-01T00:00:00.000Z",
        evidenceIds: ["88888888-8888-4888-8888-888888888888"],
        evidencePack: {
          audience: "Security Team",
          createdAt: "2026-06-01T00:00:00.000Z",
          evidenceIds: ["88888888-8888-4888-8888-888888888888"],
          evidencePackId: "18181818-1818-4818-8818-181818181818",
          packType: "ValidationSnapshotReport",
          redactionLevel: "Moderate",
          status: "Ready",
          storageUri: "file:///tmp/snapshot.html",
          tenantId: "11111111-1111-4111-8111-111111111111",
          title: "Validation Snapshot",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        integrationIds: [],
        metrics: {
          aiRiskCount: 0,
          controlObservationCount: 0,
          correlatedThreatAdvisoryCount: 0,
          highRiskPathCount: 0,
          integrationCount: 0,
          openThreatAdvisoryCount: 0,
          remediationCount: 0,
          staleVerificationCount: 0,
          topPathCount: 0,
          verifiedScopeCount: 1
        },
        missionId: null,
        remediationPriorities: [],
        scopeIds: ["33333333-3333-4333-8333-333333333333"],
        snapshotId: "19191919-1919-4919-8919-191919191919",
        summary: {
          headline: "Periscan generated a validation snapshot.",
          overview: "No high-priority paths were found.",
          topRiskBand: "Informational"
        },
        tenantId: "11111111-1111-4111-8111-111111111111",
        topAttackPaths: [],
        updatedAt: "2026-06-01T00:00:00.000Z",
        verificationPlan: []
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);
    const snapshot = await client.createSnapshot({
      audience: "Security Team",
      maxTopItems: 5,
      policyDecisionId: "29292929-2929-4929-8929-292929292929",
      scopeId: "33333333-3333-4333-8333-333333333333"
    });

    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/snapshots", {
      body: JSON.stringify({
        audience: "Security Team",
        maxTopItems: 5,
        policyDecisionId: "29292929-2929-4929-8929-292929292929",
        scopeId: "33333333-3333-4333-8333-333333333333"
      }),
      cache: "no-store",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    expect(snapshot.evidencePack.packType).toBe("ValidationSnapshotReport");
  });

  it("lists, creates, and acts on mission schedules through the API client (all mission types)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        scheduleId: "sched-1",
        missionType: "AIAppValidation",
        frequency: "Daily",
        status: "Active"
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await client.listSchedules();
    await client.createSchedule({
      frequency: "Daily",
      missionType: "ControlValidation"
    });
    await client.getSchedule("sched-1");
    await client.runSchedule("sched-1");
    await client.pauseSchedule("sched-1");
    await client.resumeSchedule("sched-1");

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/schedules",
      expect.any(Object)
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/schedules",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("passes an optional reports list limit through the public API client", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await client.listReports({ limit: 2 });

    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/reports?limit=2", {
      cache: "no-store",
      credentials: "include",
      headers: {}
    });
  });

  it("creates a selected attestation pack and preserves PDF bytes", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const pack = {
      audience: "Auditor",
      createdAt: timestamp,
      evidenceIds: ["33333333-3333-4333-8333-333333333333"],
      evidencePackId: "22222222-2222-4222-8222-222222222222",
      packType: "HIPAAAttestation",
      redactionLevel: "Moderate",
      status: "Ready",
      storageUri: "memory://hipaa.html",
      tenantId: "11111111-1111-4111-8111-111111111111",
      title: "HIPAA measured control trace",
      updatedAt: timestamp
    };
    const bytes = new Uint8Array([37, 80, 68, 70]).buffer;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => pack,
        ok: true,
        status: 201
      })
      .mockResolvedValueOnce({
        arrayBuffer: async () => bytes,
        headers: new Headers({
          "content-disposition": 'attachment; filename="hipaa.pdf"',
          "content-type": "application/pdf"
        }),
        ok: true,
        status: 200
      });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const created = await client.createReport({
      audience: "Auditor",
      packType: "HIPAAAttestation",
      snapshotId: "44444444-4444-4444-8444-444444444444"
    });
    const exported = await client.exportReport(created.evidencePackId, {
      format: "pdf"
    });

    expect(created.packType).toBe("HIPAAAttestation");
    expect(exported.content).toBe(bytes);
    expect(exported.filename).toBe("hipaa.pdf");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/reports",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("creates, lists, and revokes governed report share links", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const reportId = "22222222-2222-4222-8222-222222222222";
    const reportShareId = "55555555-5555-4555-8555-555555555555";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const grant = {
      accessCount: 0,
      createdAt: timestamp,
      expiresAt: "2026-06-08T00:00:00.000Z",
      lastAccessedAt: null,
      reportId,
      reportShareId,
      revokedAt: null,
      tenantId
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          ...grant,
          token: "signed-share-token",
          url: "/api/v1/public/reports/share/signed-share-token"
        }),
        ok: true,
        status: 201
      })
      .mockResolvedValueOnce({
        json: async () => ({ items: [grant] }),
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        json: async () => ({ ...grant, revokedAt: timestamp }),
        ok: true,
        status: 200
      });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const created = await client.createReportShareLink(reportId);
    const listed = await client.listReportShareLinks(reportId);
    const revoked = await client.revokeReportShareLink(reportId, reportShareId);

    expect(created.reportShareId).toBe(reportShareId);
    expect(listed).toEqual([grant]);
    expect(revoked.revokedAt).toBe(timestamp);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      `/api/v1/reports/${reportId}/share-links/${reportShareId}`,
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("imports and reads threat advisories through API-first routes", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const advisoryId = "12121212-1212-4212-8212-121212121212";
    const evidenceId = "13131313-1313-4313-8313-131313131313";
    const packageId = "14141414-1414-4414-8414-141414141414";
    const missingSignalId = "15151515-1515-4515-8515-151515151515";
    const impactId = "16161616-1616-4616-8616-161616161616";
    const planId = "17171717-1717-4717-8717-171717171717";
    const planItemId = "18181818-1818-4818-8818-181818181818";
    const reportId = "19191919-1919-4919-8919-191919191919";
    const detailPayload = {
      advisory: {
        createdAt: timestamp,
        cveIds: ["CVE-2026-12345"],
        evidenceIds: [evidenceId],
        iocValues: ["203.0.113.10"],
        publishedAt: null,
        rawEvidenceId: evidenceId,
        receivedAt: timestamp,
        sourceName: "Manual Source",
        sourceUrl: null,
        status: "PlanReady",
        summary: "Manual threat advisory.",
        techniqueIds: ["T1059"],
        tenantId,
        threatAdvisoryId: advisoryId,
        title: "Manual advisory",
        updatedAt: timestamp
      },
      impactAssessment: {
        advisoryImpactAssessmentId: impactId,
        affectedAssetIds: [],
        affectedFindingIds: [],
        confidence: 0.5,
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        missingSignalIds: [missingSignalId],
        summary: "Missing signals reduce confidence.",
        tenantId,
        threatAdvisoryId: advisoryId,
        updatedAt: timestamp
      },
      missingSignals: [
        {
          createdAt: timestamp,
          missingSignalId,
          reason: "No verified scope exists.",
          relatedEntityId: advisoryId,
          relatedEntityType: "ThreatAdvisory",
          requiredIntegrationCategory: null,
          signalType: "verified_scope",
          status: "RequiresVerifiedScope",
          tenantId,
          updatedAt: timestamp
        }
      ],
      package: {
        createdAt: timestamp,
        cveIds: ["CVE-2026-12345"],
        evidenceIds: [evidenceId],
        iocValues: ["203.0.113.10"],
        summary: "Extracted advisory package.",
        techniqueIds: ["T1059"],
        tenantId,
        threatAdvisoryId: advisoryId,
        threatPackageId: packageId,
        title: "Manual advisory",
        updatedAt: timestamp
      },
      rawEvidenceId: evidenceId,
      readinessReport: {
        advisoryReadinessReportId: reportId,
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        evidencePackId: null,
        missingSignalIds: [missingSignalId],
        readinessStatus: "MissingSignals",
        summary: "Readiness is blocked by missing signals.",
        tenantId,
        threatAdvisoryId: advisoryId,
        updatedAt: timestamp
      },
      validationPlan: {
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        planItems: [
          {
            createdAt: timestamp,
            evidenceIds: [evidenceId],
            missingSignalIds: [missingSignalId],
            missionType: "ExposureValidation",
            rationale: "Scope must be verified first.",
            requiredIntegrationCategories: [],
            requiredScopeTypes: ["Domain"],
            safetyLevel: "PassiveReadOnly",
            status: "RequiresVerifiedScope",
            tenantId,
            threatValidationPlanId: planId,
            threatValidationPlanItemId: planItemId,
            title: "Assess advisory relevance",
            updatedAt: timestamp
          }
        ],
        status: "RequiresVerifiedScope",
        summary: "Non-executing advisory validation plan.",
        tenantId,
        threatAdvisoryId: advisoryId,
        threatValidationPlanId: planId,
        updatedAt: timestamp
      }
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [detailPayload.advisory]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => detailPayload
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => detailPayload
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => detailPayload.readinessReport
      })
      .mockResolvedValueOnce({
        headers: new Headers({
          "content-disposition":
            'attachment; filename="advisory-readiness.html"',
          "content-type": "text/html; charset=utf-8"
        }),
        ok: true,
        text: async () => "<html>readiness</html>"
      });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const list = await client.listThreatAdvisories();
    const imported = await client.importThreatAdvisory({
      rawContent: "CVE-2026-12345 uses T1059",
      sourceName: "Manual Source",
      summary: "Manual threat advisory.",
      title: "Manual advisory"
    });
    const detail = await client.getThreatAdvisory(advisoryId);
    const readiness = await client.getThreatAdvisoryReadinessReport(advisoryId);
    const exported = await client.exportThreatAdvisoryReadinessReport(
      advisoryId,
      {
        format: "html"
      }
    );

    expect(list[0]?.threatAdvisoryId).toBe(advisoryId);
    expect(imported.missingSignals[0]?.status).toBe("RequiresVerifiedScope");
    expect(detail.validationPlan.planItems[0]?.status).toBe(
      "RequiresVerifiedScope"
    );
    expect(readiness.readinessStatus).toBe("MissingSignals");
    expect(exported).toMatchObject({
      content: "<html>readiness</html>",
      contentType: "text/html; charset=utf-8",
      filename: "advisory-readiness.html",
      format: "html"
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "/api/v1/threat-advisories", {
      cache: "no-store",
      credentials: "include",
      headers: {}
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "/api/v1/threat-advisories", {
      body: JSON.stringify({
        rawContent: "CVE-2026-12345 uses T1059",
        sourceName: "Manual Source",
        summary: "Manual threat advisory.",
        title: "Manual advisory"
      }),
      cache: "no-store",
      credentials: "include",
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      `/api/v1/threat-advisories/${advisoryId}`,
      {
        cache: "no-store",
        credentials: "include",
        headers: {}
      }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      `/api/v1/threat-advisories/${advisoryId}/readiness-report`,
      {
        cache: "no-store",
        credentials: "include",
        headers: {}
      }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      `/api/v1/threat-advisories/${advisoryId}/readiness-report/export`,
      {
        body: JSON.stringify({
          format: "html"
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
  });

  it("reads the MSSP client portfolio from the tenant API", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const parentTenantId = "11111111-1111-4111-8111-111111111111";
    const clientTenantId = "22222222-2222-4222-8222-222222222222";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clients: [
          {
            branding: {
              createdAt: timestamp,
              logoUrl: null,
              organizationName: "Client Security",
              primaryColor: "#0F766E",
              reportFooter: "Prepared for Client Security.",
              supportEmail: "security@client.test",
              tenantId: clientTenantId,
              updatedAt: timestamp,
              whiteLabelEnabled: true
            },
            coverage: {
              aiApplications: 0,
              connectedIntegrations: 1,
              controlSources: 0,
              healthyIntegrations: 1,
              missingProofInputs: 0,
              runners: 0,
              totalScopes: 1,
              unhealthyIntegrations: 0,
              verifiedScopes: 1
            },
            latestActivity: {
              latestEvidencePackAt: timestamp,
              latestReportId: "33333333-3333-4333-8333-333333333333",
              latestSnapshotAt: timestamp,
              latestSnapshotId: "44444444-4444-4444-8444-444444444444",
              latestValidationRunAt: timestamp
            },
            readinessStatus: "Active",
            risk: {
              criticalPaths: 0,
              fixedPaths: 1,
              highPaths: 0,
              lowPaths: 0,
              mediumPaths: 0,
              openRemediations: 0,
              verificationPending: 0
            },
            tenant: {
              billingAccountId: "acct-demo",
              createdAt: timestamp,
              dataRegion: "us-east-1",
              name: "Client Security",
              parentTenantId,
              tenantId: clientTenantId,
              type: "Client",
              updatedAt: timestamp
            },
            usage: {
              billingAccountId: "acct-demo",
              meteringPeriodEnd: "2026-07-01T00:00:00.000Z",
              meteringPeriodStart: timestamp,
              meters: [
                {
                  description: "Validation runs executed.",
                  label: "Validation runs",
                  measuredAt: timestamp,
                  meterName: "ValidationRuns",
                  quantity: 1,
                  unit: "runs"
                }
              ],
              tenantId: clientTenantId
            }
          }
        ],
        generatedAt: timestamp,
        parentTenant: {
          billingAccountId: "acct-demo",
          createdAt: timestamp,
          dataRegion: "us-east-1",
          name: "Parent MSSP",
          parentTenantId: null,
          tenantId: parentTenantId,
          type: "MSSP",
          updatedAt: timestamp
        },
        totals: {
          activeClients: 1,
          attentionClients: 0,
          clientTenants: 1,
          evidencePacks: 1,
          missingProofInputs: 0,
          needsIntegrationClients: 0,
          needsScopeClients: 0,
          needsValidationClients: 0,
          openRemediations: 0,
          shortTermAssessments: 0,
          validationRuns: 1,
          verifiedScopes: 1
        }
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);
    const portfolio = await client.getClientPortfolio();

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/tenants/current/client-portfolio",
      {
        cache: "no-store",
        credentials: "include",
        headers: {}
      }
    );
    expect(portfolio.clients[0]?.readinessStatus).toBe("Active");
    expect(portfolio.totals.clientTenants).toBe(1);
  });

  it("sends x-periscan-tenant-id from working tenant (parent for portfolio)", async () => {
    const clientId = "44444444-4444-4444-8444-444444444444";
    const parentId = "11111111-1111-4111-8111-111111111111";
    setWorkingTenant({
      tenantId: clientId,
      name: "Customer One",
      homeTenantId: parentId,
      homeTenantName: "Parent MSSP"
    });

    const meFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        membership: {
          membershipId: "55555555-5555-4555-8555-555555555555",
          role: "MSSPOwner",
          tenantId: clientId,
          userId: "66666666-6666-4666-8666-666666666666",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        tenant: {
          tenantId: clientId,
          name: "Customer One",
          type: "Client",
          dataRegion: "us-east-1",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        user: {
          userId: "66666666-6666-4666-8666-666666666666",
          email: "ops@example.com",
          name: "Ops",
          status: "Active",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        }
      })
    });
    const meClient = new PeriscanApiClient(meFetch as typeof fetch);
    await meClient.getMe();
    expect(meFetch).toHaveBeenCalledWith(
      "/api/v1/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-periscan-tenant-id": clientId
        })
      })
    );

    const portfolioFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clients: [],
        generatedAt: "2026-06-01T00:00:00.000Z",
        parentTenant: {
          tenantId: parentId,
          name: "Parent MSSP",
          type: "MSSP",
          dataRegion: "us-east-1",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T00:00:00.000Z"
        },
        totals: {
          activeClients: 0,
          attentionClients: 0,
          clientTenants: 0,
          evidencePacks: 0,
          missingProofInputs: 0,
          needsIntegrationClients: 0,
          needsScopeClients: 0,
          needsValidationClients: 0,
          openRemediations: 0,
          shortTermAssessments: 0,
          validationRuns: 0,
          verifiedScopes: 0
        }
      })
    });
    const portfolioClient = new PeriscanApiClient(portfolioFetch as typeof fetch);
    await portfolioClient.getClientPortfolio();
    expect(portfolioFetch).toHaveBeenCalledWith(
      "/api/v1/tenants/current/client-portfolio",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-periscan-tenant-id": parentId
        })
      })
    );
  });

  it("reads and updates design partner workflow state through the API", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          analystEvidence: {
            modeEnabled: true,
            measuredAt: "2026-06-01T00:00:00.000Z",
            checklist: {
              onboardingComplete: 0,
              onboardingTotal: 1,
              integrationComplete: 0,
              integrationTotal: 1
            },
            proofLoop: {
              maturity: "New",
              completedMilestones: 1,
              totalMilestones: 9,
              measuredResultAt: null,
              revalidatedAt: null,
              proofDeliveredAt: null
            },
            counts: {
              verifiedScopes: 0,
              connectedIntegrations: 0,
              completedRunsWithEvidence: 0,
              verificationEvents: 0,
              exportedOrSharedPacks: 0
            },
            honesty: {
              marketPresenceEligible: false,
              publicReferenceCount: 0,
              waveMarketPresenceGate: "Fail",
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              referencePackStatus: "Empty",
              banner: "Zero customer references — Wave market presence not met",
              sessionLearningEvidenceInProduct: "ChecklistOnly",
              disclaimer:
                "Tenant checklist and proof-loop counts are not customer references."
            }
          },
          integrationChecklist: [],
          latestAnalystNote: null,
          onboardingChecklist: [],
          sessionLearning: {
            message:
              "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
            sessionCount: 0,
            sessions: [],
            sessionsGateMet: false,
            sessionsRequired: 5,
            sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
            waveMarketPresenceReady: false
          },
          settings: {
            createdAt: "2026-06-01T00:00:00.000Z",
            enabled: true,
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z"
          },
          snapshotRequest: {
            latestReportId: null,
            latestSnapshotId: null,
            previewPath: null,
            requestedAt: null,
            status: "NotRequested"
          },
          tenantId: "11111111-1111-4111-8111-111111111111"
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          createdAt: "2026-06-01T00:00:00.000Z",
          enabled: false,
          tenantId: "11111111-1111-4111-8111-111111111111",
          updatedAt: "2026-06-01T00:00:00.000Z"
        })
      });

    const client = new PeriscanApiClient(fetchImpl as typeof fetch);
    const workspace = await client.getDesignPartnerWorkspace();
    const settings = await client.updateDesignPartnerSettings({
      enabled: false
    });

    expect(workspace.settings.enabled).toBe(true);
    expect(settings.enabled).toBe(false);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/tenants/current/design-partner",
      {
        cache: "no-store",
        credentials: "include",
        headers: {}
      }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/v1/tenants/current/design-partner",
      {
        body: JSON.stringify({
          enabled: false
        }),
        cache: "no-store",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        method: "PUT"
      }
    );
  });

  it("reads trust and safety summaries, filtered audit events, and disconnects integrations", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          auditLogPath: "/api/v1/audit-events",
          connectedIntegrations: [],
          dataGovernance: {
            availableRegions: [
              { id: "us-east-1", label: "United States · East" }
            ],
            baaReferenceUrl: null,
            baaStatus: "NotConfigured",
            dataCategoriesProcessed: [
              "Account identity (email, display name)",
              "Tenant membership and role assignments",
              "Authorized scope metadata and verification state",
              "Validation findings, attack paths, and remediation records",
              "Evidence metadata and redacted artifacts",
              "Integration configuration (credentials encrypted at rest when keys are set)",
              "Security audit events",
            ],
            dataSubjectRequestProcess:
              "Data subject access, export, and deletion requests are sales-assisted until a published DPA is linked.",
            dpaReferenceUrl: null,
            dpaStatus: "NotConfigured",
            encryptionAtRestDetails: "Deployment-managed.",
            encryptionAtRestStatus: "DeploymentManaged",
            routingStatus: "SingleRegion",
            selectedRegion: "us-east-1",
            selectedRegionStorageConfigured: true,
            subprocessors: [],
          subprocessorsHonesty:
            "Empty list means subprocessor disclosure is NotConfigured — not that Periscan has zero subprocessors.",
          subprocessorsStatus: "NotConfigured"

          },
          evidenceRetention: {
            artifactStorage: "S3-compatible object storage (MinIO locally)",
            notes:
              "Evidence retention is deployment-managed. Configure object-storage lifecycle and backup policy before production.",
            redactionEnabled: true,
            retentionPeriodDays: null,
            retentionPolicyStatus: "DeploymentManaged",
            tenantScopedAccess: true
          },
          identityProvisioning: {
            planeStatus: "Partial",
            planeStatusDetail:
              "Partial IdP plane: SSO/MFA/role map ship; SCIM/JIT NotConfigured.",
            orderFormDoc: "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md",
            residualDoc: "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
            advancedRbac: {
              availableRoles: [
                "Owner",
                "Admin",
                "SecurityEngineer",
                "Viewer",
                "MSSPOwner",
                "ClientAdmin"
              ],
              customRolesSupported: false,
              detail:
                "Baseline multi-role RBAC only. Custom roles are not shipped.",
              status: "BaselineRolesOnly"
            },
            jitProvisioning: {
              defaultRoleIfEnabled: "Viewer",
              detail: "JIT membership on first SSO is NotConfigured.",
              requiresDomainAllowlist: true,
              status: "NotConfigured"
            },
            scimInbound: {
              discoveryPath: "/api/v1/scim/v2/ServiceProviderConfig",
              detail:
                "Inbound SCIM 2.0 provisioning is NotConfigured and not shipped.",
              inventoryConnectorsNote:
                "CyberArk Identity SCIM is read-only inventory only.",
              status: "NotConfigured"
            }
          },
          enterpriseCommercial: {
            auditStreaming: {
              continuousStreamStatus: "NotConfigured",
              detail: "Pull-export only.",
              exportPath: "/api/v1/audit-events",
              maxExportEvents: 5000,
              status: "PullExportOnly",
              webhookCatalogNote: "Selected product events only."
            },
            multiRegionResidency: {
              detail: "Deployment-dependent.",
              status: "SingleRegionDeploymentDependent"
            },
            paymentSettlement: {
              detail: "Ledger without bank.",
              status: "NotConfigured"
            },
            publicSlaStatusPage: {
              detail: "No public status page.",
              status: "NotConfigured"
            },
            rfpDefaultScope: {
              detail: "Proof loop default.",
              excludedLabsSurfaces: ["MCP Server"],
              includedSurfaces: ["Validation Snapshot"]
            },
            vendorSoc2Attestation: {
              detail: "Not vendor Type II.",
              status: "NotClaimed"
            }
          },
          marketPresence: {
            banner: "Zero customer references — Wave market presence not met",
            disclaimer:
              "Product alone never grants Wave or MQ market presence.",
            marketPresenceEligible: false,
            mqMarketPresenceGate: "Fail",
            peerDiligenceGate: "Fail",
            publicCaseStudyCount: 0,
            publicLogoCount: 0,
            publicReferenceCount: 0,
            productionDesignPartnerReferenceCount: 0,
            referencePack: {
              inventoryEmpty: true,
              kpis: {
                icpSessionsCompleted: 0,
                icpSessionsTarget: 5,
                paidInvoiceConversions: 0,
                publicCaseStudies: 0,
                publicLogos: 0,
                referenceableProductionTenants: 0,
                signedReferenceCallPermissions: 0
              },
              gates: [
                {
                  gateId: "G0",
                  label: "Honest pre-commercial posture",
                  status: "RequiredNow",
                  notes: "Zero references = market presence fail."
                }
              ],
              packStatus: "Empty",
              sourceDoc: "docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md"
            },
            signedReferencePermissionCount: 0,
            waveMarketPresenceGate: "Fail"
          },
          operationalReadiness: {
            controls: [
              {
                controlId: "database-backup-cadence",
                notes:
                  "Set a human-readable backup cadence such as hourly, daily, or managed-by-provider.",
                status: "DeploymentManaged",
                title: "Database backup cadence",
                value: null
              }
            ],
            environment: "local-development",
            notes:
              "Some production operational controls are deployment-managed.",
            overallStatus: "DeploymentManaged"
          },
          runnerSecurityModel: {
            gatewayHostnames: ["runner.periscan.cloud"],
            inboundFirewallRuleRequired: false,
            killSwitchAvailable: true,
            localAuditLogsRequired: true,
            outboundOnly: true,
            scopeEnforcementRequired: true,
            taskSigningRequired: true,
            transport:
              "Outbound HTTPS long polling via https://runner.periscan.cloud"
          },
          vendorAssurance: {
            customerEvidencePacksNote:
              "Product SOC 2 packs are customer evidence support only, not vendor Type II.",
            detail:
              "Periscan does not currently publish a vendor SOC 2 Type II report.",
            soc2TypeIiStatus: "None"
          },
          tenantId: "11111111-1111-4111-8111-111111111111",
          validationSafetyPrinciples: [
            {
              description:
                "Periscan requires validated customer-authorized scope before validation is queued.",
              principleId: "verified-scope",
              title: "Verified scope required"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              action: "integration.connected",
              actorType: "User",
              auditEventId: "55555555-5555-4555-8555-555555555555",
              createdAt: "2026-06-01T00:00:00.000Z",
              entityId: "44444444-4444-4444-8444-444444444444",
              entityType: "Integration",
              metadata: {},
              tenantId: "11111111-1111-4111-8111-111111111111",
              userId: "33333333-3333-4333-8333-333333333333"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null
      });

    const client = new PeriscanApiClient(fetchImpl as typeof fetch);
    const summary = await client.getTrustSafetySummary();
    const auditEvents = await client.listAuditEvents({
      action: "integration.connected",
      from: "2026-06-01T00:00:00.000Z",
      limit: 10,
      userId: "33333333-3333-4333-8333-333333333333"
    });

    await client.deleteIntegration("44444444-4444-4444-8444-444444444444");

    expect(summary.auditLogPath).toBe("/api/v1/audit-events");
    expect(summary.operationalReadiness.controls[0]?.controlId).toBe(
      "database-backup-cadence"
    );
    expect(auditEvents[0]?.action).toBe("integration.connected");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/tenants/current/trust-safety",
      {
        cache: "no-store",
        credentials: "include",
        headers: {}
      }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/v1/audit-events?action=integration.connected&from=2026-06-01T00%3A00%3A00.000Z&limit=10&userId=33333333-3333-4333-8333-333333333333",
      {
        cache: "no-store",
        credentials: "include",
        headers: {}
      }
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/v1/integrations/44444444-4444-4444-8444-444444444444",
      {
        cache: "no-store",
        credentials: "include",
        headers: {},
        method: "DELETE"
      }
    );
  });

  it("drives the model gateway control plane through versioned routes", async () => {
    const timestamp = "2026-06-01T00:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const modelProviderId = "22222222-2222-4222-8222-222222222222";
    const userId = "33333333-3333-4333-8333-333333333333";
    const toolRequestId = "44444444-4444-4444-8444-444444444444";
    const modelSessionId = "55555555-5555-4555-8555-555555555555";

    const provider = {
      allowedUseCases: [],
      authMethod: "bearer",
      createdAt: timestamp,
      createdBy: userId,
      dataResidency: null,
      deploymentType: "Cloud",
      endpointUrl: "https://api.openai.com/v1",
      hasCredential: true,
      lastTestedAt: null,
      modelProviderId,
      providerName: "Customer OpenAI",
      providerType: "OpenAICompatible",
      servingCapabilities: {},
      status: "Active",
      tenantId,
      updatedAt: timestamp
    };

    const toolRequest = {
      approvedAt: timestamp,
      approvedBy: userId,
      completedAt: null,
      createdAt: timestamp,
      denialReason: null,
      inputPayloadHash: "abc123",
      inputPayloadRedacted: {},
      modelSessionId,
      policyDecisionId: null,
      requestReason: "Validate the top exposure",
      requestedByModel: true,
      result: null,
      scopeIds: [],
      status: "Approved",
      tenantId,
      toolName: "request_exposure_validation",
      toolRequestId,
      updatedAt: timestamp
    };

    const killSwitch = {
      activatedAt: timestamp,
      blockedToolRequests: 2,
      terminatedSessions: 1,
      tenantId
    };

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [provider] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => provider
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => toolRequest
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => killSwitch
      });

    const client = new PeriscanApiClient(fetchImpl as unknown as typeof fetch);

    const providers = await client.listModelProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]?.hasCredential).toBe(true);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/v1/model-gateway/providers",
      { cache: "no-store",
        credentials: "include", headers: {} }
    );

    const created = await client.createModelProvider({
      allowedUseCases: [],
      apiKey: "sk-secret",
      authMethod: "bearer",
      deploymentType: "Cloud",
      endpointUrl: "https://api.openai.com/v1",
      providerName: "Customer OpenAI",
      providerType: "OpenAICompatible"
    });
    expect(created.modelProviderId).toBe(modelProviderId);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/v1/model-gateway/providers",
      expect.objectContaining({ method: "POST" })
    );

    const approved = await client.approveModelToolRequest(toolRequestId);
    expect(approved.status).toBe("Approved");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      `/api/v1/model-gateway/tool-requests/${toolRequestId}/approve`,
      expect.objectContaining({ method: "POST" })
    );

    const result = await client.activateModelGatewayKillSwitch({
      enabled: true,
      reason: "Operator drill"
    });
    expect(result.terminatedSessions).toBe(1);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "/api/v1/model-gateway/kill-switch",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("dispatches an allowlisted measured runner task via POST and returns the task", async () => {
    const ts = "2026-06-01T00:00:00.000Z";
    const runnerId = "22222222-2222-4222-8222-222222222222";
    const scopeId = "33333333-3333-4333-8333-333333333333";
    const taskId = "44444444-4444-4444-8444-444444444444";
    const runId = "55555555-5555-4555-8555-555555555555";
    const missionId = "66666666-6666-4666-8666-666666666666";
    const tenantId = "77777777-7777-4777-8777-777777777777";
    const scopeConstraints = {
      approvedCidrs: [],
      approvedDnsSuffixes: [],
      approvedHostnames: ["gateway-01.corp.internal"],
      approvedPorts: [443],
      forbidInternetEgress: false
    };
    const envelope = {
      artifactUpload: {
        artifactUploadUrl: "https://cp.periscan.test/artifacts",
        maxArtifactBytes: 1000000,
        resultCallbackUrl: "https://cp.periscan.test/result"
      },
      executionEnvironment: "InternalRunner",
      expiresAt: ts,
      inputs: { port: 443 },
      issuedAt: ts,
      missionId,
      moduleId: "periscan.tls_protocol_audit",
      runId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      signature: {
        algorithm: "EdDSA",
        digestSha256: "digest",
        keyId: "key-1",
        nonce: "nonce-1",
        signature: "sig-1"
      },
      target: { hostname: "gateway-01.corp.internal" },
      taskId,
      tenantId
    };
    const task = {
      createdAt: ts,
      envelope,
      expiresAt: ts,
      inputs: { port: 443 },
      issuedAt: ts,
      missionId,
      moduleId: "periscan.tls_protocol_audit",
      redactedEvidenceIds: [],
      runId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      status: "Queued",
      target: { hostname: "gateway-01.corp.internal" },
      taskId,
      taskType: "periscan.tls_protocol_audit",
      tenantId,
      updatedAt: ts
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ task }) });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const dispatched = await client.createRunnerMeasuredTask(runnerId, {
      moduleId: "periscan.tls_protocol_audit",
      port: 443,
      scopeId,
      targetHost: "gateway-01.corp.internal"
    });

    expect(dispatched.moduleId).toBe("periscan.tls_protocol_audit");
    expect(dispatched.taskId).toBe(taskId);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/runners/${runnerId}/tasks/measured`,
      expect.objectContaining({
        body: JSON.stringify({
          moduleId: "periscan.tls_protocol_audit",
          port: 443,
          scopeId,
          targetHost: "gateway-01.corp.internal"
        }),
        method: "POST"
      })
    );
  });

  it("dispatches an allowlisted discovery runner task via POST and returns the task", async () => {
    const ts = "2026-06-01T00:00:00.000Z";
    const runnerId = "22222222-2222-4222-8222-222222222222";
    const scopeId = "33333333-3333-4333-8333-333333333333";
    const taskId = "44444444-4444-4444-8444-444444444444";
    const runId = "55555555-5555-4555-8555-555555555555";
    const missionId = "66666666-6666-4666-8666-666666666666";
    const tenantId = "77777777-7777-4777-8777-777777777777";
    const scopeConstraints = {
      approvedCidrs: ["10.0.0.0/24"],
      approvedDnsSuffixes: [],
      approvedHostnames: [],
      approvedPorts: [],
      forbidInternetEgress: false
    };
    const envelope = {
      artifactUpload: {
        artifactUploadUrl: "https://cp.periscan.test/artifacts",
        maxArtifactBytes: 1000000,
        resultCallbackUrl: "https://cp.periscan.test/result"
      },
      executionEnvironment: "InternalRunner",
      expiresAt: ts,
      inputs: {},
      issuedAt: ts,
      missionId,
      moduleId: "recon.host_discovery",
      runId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      signature: {
        algorithm: "EdDSA",
        digestSha256: "digest",
        keyId: "key-1",
        nonce: "nonce-1",
        signature: "sig-1"
      },
      target: { targets: "10.0.0.0/24" },
      taskId,
      tenantId
    };
    const task = {
      createdAt: ts,
      envelope,
      expiresAt: ts,
      inputs: {},
      issuedAt: ts,
      missionId,
      moduleId: "recon.host_discovery",
      redactedEvidenceIds: [],
      runId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      status: "Queued",
      target: { targets: "10.0.0.0/24" },
      taskId,
      taskType: "recon.host_discovery",
      tenantId,
      updatedAt: ts
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ task }) });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const dispatched = await client.createRunnerDiscoverTask(runnerId, {
      moduleId: "recon.host_discovery",
      scopeId,
      target: "10.0.0.0/24"
    });

    expect(dispatched.moduleId).toBe("recon.host_discovery");
    expect(dispatched.taskId).toBe(taskId);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/runners/${runnerId}/tasks/discover`,
      expect.objectContaining({
        body: JSON.stringify({
          moduleId: "recon.host_discovery",
          scopeId,
          target: "10.0.0.0/24"
        }),
        method: "POST"
      })
    );
  });

  it("dispatches a governed third-party tool runner task via POST", async () => {
    const ts = "2026-06-01T00:00:00.000Z";
    const runnerId = "22222222-2222-4222-8222-222222222222";
    const scopeId = "33333333-3333-4333-8333-333333333333";
    const taskId = "44444444-4444-4444-8444-444444444444";
    const runId = "55555555-5555-4555-8555-555555555555";
    const missionId = "66666666-6666-4666-8666-666666666666";
    const tenantId = "77777777-7777-4777-8777-777777777777";
    const policyDecisionId = "88888888-8888-4888-8888-888888888888";
    const scopeConstraints = {
      approvedCidrs: ["10.0.0.0/24"],
      approvedDnsSuffixes: [],
      approvedHostnames: [],
      approvedPorts: [],
      forbidInternetEgress: true
    };
    const envelope = {
      artifactUpload: {
        artifactUploadUrl: "https://cp.periscan.test/artifacts",
        maxArtifactBytes: 1000000,
        resultCallbackUrl: "https://cp.periscan.test/result"
      },
      executionEnvironment: "InternalRunner",
      expiresAt: ts,
      inputs: {},
      issuedAt: ts,
      missionId,
      moduleId: "recon.host_discovery",
      runId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      signature: {
        algorithm: "EdDSA",
        digestSha256: "digest",
        keyId: "key-1",
        nonce: "nonce-1",
        signature: "sig-1"
      },
      target: { targets: "10.0.0.0/24" },
      taskId,
      tenantId
    };
    const task = {
      createdAt: ts,
      envelope,
      expiresAt: ts,
      inputs: {},
      issuedAt: ts,
      missionId,
      moduleId: "recon.host_discovery",
      redactedEvidenceIds: [],
      runId,
      runnerId,
      safetyLevel: "ActiveNonInvasive",
      scopeConstraints,
      scopeId,
      status: "Queued",
      target: { targets: "10.0.0.0/24" },
      taskId,
      taskType: "recon.host_discovery",
      tenantId,
      updatedAt: ts
    };
    const result = {
      envelope,
      mission: {
        completedAt: null,
        createdAt: ts,
        evidenceIds: [],
        missionId,
        missionType: "ExposureValidation",
        policyDecisionId,
        policyProfile: "runner-discover",
        requestedBy: "99999999-9999-4999-8999-999999999999",
        safetyLevel: "ActiveNonInvasive",
        scopeId,
        scopeIds: [scopeId],
        startedAt: ts,
        status: "Queued",
        tenantId,
        updatedAt: ts
      },
      run: {
        completedAt: null,
        createdAt: ts,
        errorSummary: null,
        evidenceIds: [],
        missionId,
        moduleId: "recon.host_discovery",
        outcome: null,
        policyDecisionId,
        runId,
        runnerId,
        safetyLevel: "ActiveNonInvasive",
        scopeId,
        startedAt: null,
        status: "Queued",
        target: { targets: "10.0.0.0/24" },
        tenantId,
        updatedAt: ts,
        validationState: null
      },
      task
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        capability: {
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
        },
        dispatchRoute: "/api/v1/runners/:runnerId/tasks/discover",
        result,
        toolId: "nmap"
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const dispatched = await client.dispatchThirdPartyToolRunnerTask("nmap", {
      capabilityId: "nmap.host-discovery",
      runnerId,
      scopeId,
      target: "10.0.0.0/24"
    });

    expect(dispatched.toolId).toBe("nmap");
    expect(dispatched.result.task.taskId).toBe(taskId);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/third-party-tools/nmap/runner-dispatch",
      expect.objectContaining({
        body: JSON.stringify({
          capabilityId: "nmap.host-discovery",
          rateLimitPerMinute: 30,
          runnerId,
          scopeId,
          target: "10.0.0.0/24",
          timeoutSeconds: 30
        }),
        method: "POST"
      })
    );
  });

  it("reads and generates third-party tool promotion packages", async () => {
    const ts = "2026-06-27T12:00:00.000Z";
    const candidateId = "11111111-1111-4111-8111-111111111111";
    const promotionPackage = {
      capabilityIds: ["gitleaks.repo-secrets"],
      candidateId,
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
      createdAt: ts,
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
        tenantId: "22222222-2222-4222-8222-222222222222",
        toolId: "gitleaks",
        updatedAt: ts
      },
      implementationOwner: "Platform Engineering",
      moduleIds: ["gitleaks.repo_secrets"],
      promotedAt: ts,
      promotedBy: "33333333-3333-4333-8333-333333333333",
      promotionPackageId: "44444444-4444-4444-8444-444444444444",
      readinessReport: {
        candidateId,
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
        generatedAt: ts,
        governancePolicyAvailable: true,
        moduleManifestPresent: true,
        readyForGovernance: true,
        requiredActions: [],
        status: "ReadyForGovernance",
        tenantId: "22222222-2222-4222-8222-222222222222",
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
        lastCheckedAt: ts,
        runtimeAvailable: true,
        runtimeKind: "docker",
        runtimeReason: "Docker image is available.",
        toolId: "gitleaks"
      },
      safetyNotes: ["Promotion packages do not execute tools."],
      status: "ReadyForGovernance",
      summary: "Gitleaks has reviewed promotion evidence.",
      tenantId: "22222222-2222-4222-8222-222222222222",
      toolId: "gitleaks",
      updatedAt: ts
    };
    const promotionHandoff = {
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
      candidateId,
      generatedAt: ts,
      governanceEnabled: true,
      governanceStatus: "Enabled",
      promotionPackageId: promotionPackage.promotionPackageId,
      runnerEligibility: null,
      runtimeAvailable: true,
      runtimeStatus: "Available",
      status: "ReadyForPolicyApproval",
      summary:
        "Gitleaks is ready for explicit policy-gated mission or runner approval.",
      tenantId: promotionPackage.tenantId,
      toolId: "gitleaks"
    };
    const promotionCertification = {
      candidateId,
      certificationId: `tool-promotion-certification:${promotionPackage.promotionPackageId}`,
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
      generatedAt: ts,
      governanceStatus: "Enabled",
      packageStatus: "ReadyForGovernance",
      promotionPackageId: promotionPackage.promotionPackageId,
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
      tenantId: promotionPackage.tenantId,
      toolId: "gitleaks"
    };
    const savedPromotionCertification = {
      ...promotionCertification,
      certificationId: "77777777-7777-4777-8777-777777777777",
      createdAt: ts,
      generatedBy: "22222222-2222-4222-8222-222222222222"
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [promotionPackage] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => promotionPackage
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => promotionHandoff
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => promotionCertification
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [savedPromotionCertification] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => savedPromotionCertification
      });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const listed =
      await client.listThirdPartyToolPromotionPackages(candidateId);
    const generated =
      await client.generateThirdPartyToolPromotionPackage(candidateId);
    const handoff = await client.getThirdPartyToolPromotionHandoff(
      candidateId,
      promotionPackage.promotionPackageId
    );
    const certification = await client.getThirdPartyToolPromotionCertification(
      candidateId,
      promotionPackage.promotionPackageId
    );
    const certificationHistory =
      await client.listThirdPartyToolPromotionCertifications(
        candidateId,
        promotionPackage.promotionPackageId
      );
    const generatedCertification =
      await client.generateThirdPartyToolPromotionCertification(
        candidateId,
        promotionPackage.promotionPackageId
      );

    expect(listed[0]?.toolId).toBe("gitleaks");
    expect(generated.status).toBe("ReadyForGovernance");
    expect(handoff.status).toBe("ReadyForPolicyApproval");
    expect(handoff.actions.some((action) => action.createsExecution)).toBe(
      true
    );
    expect(certification.status).toBe("CertifiedForUse");
    expect(certification.doesNotExecute).toBe(true);
    expect(certificationHistory[0]?.certificationId).toBe(
      savedPromotionCertification.certificationId
    );
    expect(generatedCertification.generatedBy).toBe(
      "22222222-2222-4222-8222-222222222222"
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `/api/v1/third-party-tools/intake/candidates/${candidateId}/promotion-packages`,
      expect.objectContaining({ cache: "no-store",
        credentials: "include", headers: {} })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `/api/v1/third-party-tools/intake/candidates/${candidateId}/promotion-packages`,
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      `/api/v1/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackage.promotionPackageId}/governance-handoff`,
      expect.objectContaining({ cache: "no-store",
        credentials: "include", headers: {} })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      `/api/v1/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackage.promotionPackageId}/certification-report`,
      expect.objectContaining({ cache: "no-store",
        credentials: "include", headers: {} })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      `/api/v1/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackage.promotionPackageId}/certifications`,
      expect.objectContaining({ cache: "no-store",
        credentials: "include", headers: {} })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      `/api/v1/third-party-tools/intake/candidates/${candidateId}/promotion-packages/${promotionPackage.promotionPackageId}/certifications`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("posts BYO scan-file import to data-fabric scan-import (P19-r4)", async () => {
    const importedAt = "2026-07-15T12:00:00.000Z";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        disclaimer: "Imported only — not Measured.",
        evidenceBasis: "Imported",
        findingCount: 1,
        format: "csv",
        importedAt,
        label: "lab.csv",
        signalCount: 1,
        signalIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const result = await client.importScanFile({
      content: "Host,Severity,Name\nweb-01,High,X",
      format: "csv",
      label: "lab.csv"
    });

    expect(result.evidenceBasis).toBe("Imported");
    expect(result.signalCount).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/data-fabric/scan-import",
      expect.objectContaining({ method: "POST" })
    );
    const init = fetchImpl.mock.calls[0]?.[1] as { body?: string };
    expect(JSON.parse(init.body ?? "{}")).toEqual({
      content: "Host,Severity,Name\nweb-01,High,X",
      format: "csv",
      label: "lab.csv"
    });
  });

  it("posts Wave B detection-marker-proof for a control source", async () => {
    const controlSourceId = "44444444-4444-4444-8444-444444444444";
    const missionId = "77777777-7777-4777-8777-777777777777";
    const runId = "99999999-9999-4999-8999-999999999999";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const scopeId = "22222222-2222-4222-8222-222222222222";
    const now = "2026-07-29T12:00:00.000Z";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        closedLoop: true,
        drvClaimClass: "benign_marker_only",
        fullAttackLibrary: false,
        markerId: "periscan-client-wave-b-1",
        mission: {
          completedAt: now,
          createdAt: now,
          evidenceIds: [],
          missionId,
          missionType: "ControlValidation",
          policyDecisionId: null,
          policyProfile: null,
          requestedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          safetyLevel: "BASLite",
          scopeId,
          scopeIds: [scopeId],
          startedAt: now,
          status: "Completed",
          tenantId,
          updatedAt: now
        },
        outcome: "detection_marker_emit_observe_detected",
        runs: [
          {
            completedAt: now,
            createdAt: now,
            errorSummary: null,
            evidenceIds: [],
            missionId,
            moduleId: "periscan.detection_marker_emit_observe",
            outcome: "detection_marker_emit_observe_detected",
            policyDecisionId: null,
            runId,
            runnerId: null,
            safetyLevel: "BASLite",
            scopeId,
            startedAt: now,
            status: "Completed",
            target: { markerId: "periscan-client-wave-b-1" },
            techniqueIds: ["T1059"],
            tenantId,
            updatedAt: now,
            validationState: "Detected"
          }
        ],
        summary:
          "Closed benign-marker loop: periscan-client-wave-b-1 emitted and observed (DRV marker class only — not full ATT&CK BAS).",
        validationState: "Detected"
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const result = await client.runDetectionMarkerProof(controlSourceId, {
      injectMockObservation: true,
      markerId: "periscan-client-wave-b-1",
      performEmit: true,
      techniqueId: "T1059"
    });

    expect(result.drvClaimClass).toBe("benign_marker_only");
    expect(result.fullAttackLibrary).toBe(false);
    expect(result.closedLoop).toBe(true);
    expect(result.markerId).toBe("periscan-client-wave-b-1");
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/control-sources/${controlSourceId}/detection-marker-proof`,
      expect.objectContaining({ method: "POST" })
    );
    const init = fetchImpl.mock.calls[0]?.[1] as { body?: string };
    expect(JSON.parse(init.body ?? "{}")).toEqual({
      injectMockObservation: true,
      markerId: "periscan-client-wave-b-1",
      performEmit: true,
      techniqueId: "T1059"
    });
  });

  it("posts Phase C dns-exfil-canary-proof for a control source", async () => {
    const controlSourceId = "44444444-4444-4444-8444-444444444444";
    const missionId = "77777777-7777-4777-8777-777777777777";
    const runId = "99999999-9999-4999-8999-999999999999";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const scopeId = "22222222-2222-4222-8222-222222222222";
    const now = "2026-07-29T12:00:00.000Z";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        canaryFqdn: "periscan-dns-client-1.corp.example.com",
        canaryLabel: "periscan-dns-client-1",
        closedLoop: true,
        exfilClaimClass: "benign_marker_only",
        fullExfilLibrary: false,
        markerId: "periscan-dns-client-1",
        measured: false,
        mission: {
          completedAt: now,
          createdAt: now,
          evidenceIds: [],
          missionId,
          missionType: "ControlValidation",
          policyDecisionId: null,
          policyProfile: null,
          requestedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          safetyLevel: "BASLite",
          scopeId,
          scopeIds: [scopeId],
          startedAt: now,
          status: "Completed",
          tenantId,
          updatedAt: now
        },
        outcome: "dns_exfil_detected",
        realDataExfiltrated: false,
        runs: [
          {
            completedAt: now,
            createdAt: now,
            errorSummary: null,
            evidenceIds: [],
            missionId,
            moduleId: "periscan.dns_exfil_canary",
            outcome: "dns_exfil_detected",
            policyDecisionId: null,
            runId,
            runnerId: null,
            safetyLevel: "BASLite",
            scopeId,
            startedAt: now,
            status: "Completed",
            target: { markerId: "periscan-dns-client-1" },
            techniqueIds: ["T1048"],
            tenantId,
            updatedAt: now,
            validationState: "Detected"
          }
        ],
        summary:
          "DNS-exfil detection canary periscan-dns-client-1 observed (benign marker only — no real data exfiltrated).",
        validationState: "Detected"
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const result = await client.runDnsExfilCanaryProof(controlSourceId, {
      injectMockObservation: true,
      markerId: "periscan-dns-client-1",
      techniqueId: "T1048"
    });

    expect(result.exfilClaimClass).toBe("benign_marker_only");
    expect(result.realDataExfiltrated).toBe(false);
    expect(result.measured).toBe(false);
    expect(result.fullExfilLibrary).toBe(false);
    expect(result.markerId).toBe("periscan-dns-client-1");
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/control-sources/${controlSourceId}/dns-exfil-canary-proof`,
      expect.objectContaining({ method: "POST" })
    );
    const init = fetchImpl.mock.calls[0]?.[1] as { body?: string };
    expect(JSON.parse(init.body ?? "{}")).toEqual({
      injectMockObservation: true,
      markerId: "periscan-dns-client-1",
      techniqueId: "T1048"
    });
  });

  it("Wave E: autoRevalidate posts preferred path; autoMitigate aliases it", async () => {
    const remediationId = "22222222-2222-4222-8222-222222222222";
    const payload = {
      actionApplied: false as const,
      autoExecuted: false,
      closedLoop: "verdict->planner->mark-ready->revalidate->evidence",
      plan: { objective: "x", steps: [], source: "operator", generatedAt: "2026-07-29T00:00:00.000Z" },
      verification: {}
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const preferred = await client.autoRevalidate(remediationId);
    expect(preferred.actionApplied).toBe(false);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/remediations/${remediationId}/auto-revalidate`,
      expect.objectContaining({ method: "POST" })
    );

    fetchImpl.mockClear();
    const legacy = await client.autoMitigate(remediationId);
    expect(legacy.actionApplied).toBe(false);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/remediations/${remediationId}/auto-revalidate`,
      expect.objectContaining({ method: "POST" })
    );
    // Client never prefers the deprecated path name.
    expect(fetchImpl.mock.calls[0]?.[0]).not.toContain("auto-mitigate");
  });

  it("listFindingsPage forwards missionId on the findings query string", async () => {
    const missionId = "22222222-2222-4222-8222-222222222222";
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        page: { hasMore: false, limit: 50, offset: 0 }
      })
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    const page = await client.listFindingsPage({
      limit: 50,
      missionId,
      status: "New"
    });

    expect(page.items).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/findings?status=New&missionId=${missionId}&limit=50`,
      {
        cache: "no-store",
        credentials: "include",
        headers: {}
      }
    );
  });

  it("fetchFindingsSarif downloads GET /api/v1/findings.sarif", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T15:00:00.000Z"));
    const body = JSON.stringify({ version: "2.1.0", runs: [] });
    const fetchImpl = vi.fn().mockResolvedValue({
      headers: new Headers({
        "content-type": "application/sarif+json"
      }),
      ok: true,
      status: 200,
      text: async () => body
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    try {
      const payload = await client.fetchFindingsSarif();

      expect(payload.content).toBe(body);
      expect(payload.contentType).toContain("application/sarif+json");
      expect(payload.filename).toBe("periscan-findings-2026-08-30.sarif");
      expect(fetchImpl).toHaveBeenCalledWith("/api/v1/findings.sarif", {
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/sarif+json, application/json"
        }
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fetchFindingsSarif forwards optional missionId", async () => {
    const missionId = "22222222-2222-4222-8222-222222222222";
    const fetchImpl = vi.fn().mockResolvedValue({
      headers: new Headers({
        "content-type": "application/sarif+json"
      }),
      ok: true,
      status: 200,
      text: async () => "{}"
    });
    const client = new PeriscanApiClient(fetchImpl as typeof fetch);

    await client.fetchFindingsSarif({ missionId });

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/findings.sarif?missionId=${missionId}`,
      {
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/sarif+json, application/json"
        }
      }
    );
  });

  it("fetchFindingsSarif raises typed errors", async () => {
    const client = new PeriscanApiClient(
      vi.fn().mockResolvedValue({
        json: async () => ({ error: "Session expired" }),
        ok: false,
        status: 401
      }) as typeof fetch
    );

    await expect(client.fetchFindingsSarif()).rejects.toEqual(
      expect.objectContaining<Partial<PeriscanApiClientError>>({
        message: "Session expired",
        status: 401
      })
    );
  });
});
