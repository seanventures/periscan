import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

type CodeConnectorCase = {
  authType: string;
  connectorKey: string;
  config: Record<string, unknown>;
  expectedAssetCount: number;
  expectedPermissions: string[];
  expectedSignalCategories: string[];
  expectedSignalSubcategories: string[];
  nonSecretFields: Record<string, unknown>;
  product: string;
  secretFields: Record<string, string>;
  vendor: string;
};

const CONNECTOR_CASES: CodeConnectorCase[] = [
  {
    authType: "pat",
    config: {
      accessToken: "gitlab-acceptance-token",
      apiBaseUrl: "https://gitlab.example.com/api/v4",
      connectorKey: "gitlab",
      groupPath: "periscan-fixtures",
      projectPaths: ["periscan-fixtures/gitlab-api"]
    },
    connectorKey: "gitlab",
    expectedAssetCount: 2,
    expectedPermissions: ["read_api", "read_repository"],
    expectedSignalCategories: ["Repository"],
    expectedSignalSubcategories: [
      "Repository",
      "BranchProtection",
      "RepoPermission"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://gitlab.example.com/api/v4",
      groupPath: "periscan-fixtures",
      projectPaths: ["periscan-fixtures/gitlab-api"]
    },
    product: "GitLab",
    secretFields: {
      accessToken: "gitlab-acceptance-token"
    },
    vendor: "GitLab"
  },
  {
    authType: "appPassword",
    config: {
      appPassword: "bitbucket-acceptance-password",
      connectorKey: "bitbucket",
      repositorySlugs: ["bitbucket-api"],
      username: "periscan-bot",
      workspace: "periscan-fixtures"
    },
    connectorKey: "bitbucket",
    expectedAssetCount: 2,
    expectedPermissions: ["repository:read"],
    expectedSignalCategories: ["Repository"],
    expectedSignalSubcategories: [
      "Repository",
      "BranchProtection",
      "RepoPermission"
    ],
    nonSecretFields: {
      repositorySlugs: ["bitbucket-api"],
      username: "periscan-bot",
      workspace: "periscan-fixtures"
    },
    product: "Bitbucket Cloud",
    secretFields: {
      appPassword: "bitbucket-acceptance-password"
    },
    vendor: "Atlassian"
  },
  {
    authType: "pat",
    config: {
      connectorKey: "azure-devops",
      organization: "periscan-fixtures",
      pat: "azure-devops-acceptance-pat",
      projects: ["Periscan"]
    },
    connectorKey: "azure-devops",
    expectedAssetCount: 2,
    expectedPermissions: ["Code: Read", "Project and Team: Read"],
    expectedSignalCategories: ["Repository"],
    expectedSignalSubcategories: [
      "Repository",
      "BranchProtection",
      "RepoPermission"
    ],
    nonSecretFields: {
      organization: "periscan-fixtures",
      projects: ["Periscan"]
    },
    product: "Azure DevOps",
    secretFields: {
      pat: "azure-devops-acceptance-pat"
    },
    vendor: "Microsoft"
  },
  {
    authType: "apiToken",
    config: {
      connectorKey: "buildkite",
      organization: "periscan-fixtures",
      pipelineSlugs: ["periscan-api"],
      token: "buildkite-acceptance-token"
    },
    connectorKey: "buildkite",
    expectedAssetCount: 2,
    expectedPermissions: ["read_pipelines"],
    expectedSignalCategories: ["Asset", "Repository", "ControlObservation"],
    expectedSignalSubcategories: [
      "CICDPipeline",
      "PipelineRepositoryLinked",
      "PipelineControlContext"
    ],
    nonSecretFields: {
      organization: "periscan-fixtures",
      pipelineSlugs: ["periscan-api"]
    },
    product: "Buildkite",
    secretFields: {
      token: "buildkite-acceptance-token"
    },
    vendor: "Buildkite"
  },
  {
    authType: "apiToken",
    config: {
      connectorKey: "circleci",
      projectSlugs: ["gh/periscan-fixtures/api"],
      token: "circleci-acceptance-token"
    },
    connectorKey: "circleci",
    expectedAssetCount: 2,
    expectedPermissions: [
      "Personal API token with read access to configured projects"
    ],
    expectedSignalCategories: ["Asset", "Repository", "ControlObservation"],
    expectedSignalSubcategories: [
      "CICDPipeline",
      "PipelineRepositoryLinked",
      "PipelineControlContext"
    ],
    nonSecretFields: {
      projectSlugs: ["gh/periscan-fixtures/api"]
    },
    product: "CircleCI",
    secretFields: {
      token: "circleci-acceptance-token"
    },
    vendor: "CircleCI"
  },
  {
    authType: "apiToken",
    config: {
      apiBaseUrl: "https://jenkins.example.com",
      apiToken: "jenkins-acceptance-token",
      connectorKey: "jenkins",
      includeLastBuild: true,
      jobNames: ["periscan-api"],
      maxJobs: 10,
      username: "jenkins-bot"
    },
    connectorKey: "jenkins",
    expectedAssetCount: 2,
    expectedPermissions: ["Overall/Read", "Job/Read"],
    expectedSignalCategories: ["Asset", "Repository", "ControlObservation"],
    expectedSignalSubcategories: [
      "CICDPipeline",
      "PipelineRepositoryMissing",
      "PipelineLastBuildSucceeded",
      "PipelineControlContext"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://jenkins.example.com",
      includeLastBuild: true,
      jobNames: ["periscan-api"],
      maxJobs: 10,
      username: "jenkins-bot"
    },
    product: "Jenkins",
    secretFields: {
      apiToken: "jenkins-acceptance-token"
    },
    vendor: "Jenkins"
  },
  {
    authType: "accessToken",
    config: {
      connectorKey: "docker-hub",
      namespace: "periscan-fixtures",
      repositories: ["periscan-api"],
      token: "docker-hub-acceptance-token"
    },
    connectorKey: "docker-hub",
    expectedAssetCount: 2,
    expectedPermissions: ["Repository read metadata"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "ContainerImageRepository",
      "PrivateContainerRepository",
      "ContainerImageTag"
    ],
    nonSecretFields: {
      namespace: "periscan-fixtures",
      repositories: ["periscan-api"]
    },
    product: "Docker Hub",
    secretFields: {
      token: "docker-hub-acceptance-token"
    },
    vendor: "Docker"
  },
  {
    authType: "pat",
    config: {
      connectorKey: "github-container-registry",
      owner: "periscan-fixtures",
      ownerType: "org",
      packages: ["periscan-api"],
      token: "ghcr-acceptance-token"
    },
    connectorKey: "github-container-registry",
    expectedAssetCount: 2,
    expectedPermissions: ["GitHub Packages read metadata", "read:packages"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "ContainerImageRepository",
      "PrivateContainerRepository",
      "PublicContainerRepository",
      "ContainerImageVersion",
      "ContainerImageTag"
    ],
    nonSecretFields: {
      owner: "periscan-fixtures",
      ownerType: "org",
      packages: ["periscan-api"]
    },
    product: "GitHub Container Registry",
    secretFields: {
      token: "ghcr-acceptance-token"
    },
    vendor: "GitHub"
  },
  {
    authType: "staticCredentials",
    config: {
      accessKeyId: "AKIAACCEPTANCEECR",
      connectorKey: "aws-ecr",
      region: "us-east-1",
      repositories: ["periscan-api"],
      secretAccessKey: "aws-ecr-acceptance-secret",
      sessionToken: "aws-ecr-acceptance-session"
    },
    connectorKey: "aws-ecr",
    expectedAssetCount: 2,
    expectedPermissions: [
      "ecr:DescribeRepositories",
      "ecr:DescribeImages",
      "sts:AssumeRole",
      "sts:GetCallerIdentity"
    ],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "ContainerImageRepository",
      "PrivateContainerRepository",
      "ContainerImageScanOnPushEnabled",
      "ContainerImageScanOnPushDisabled",
      "ContainerImageImmutableTags",
      "ContainerImageMutableTags",
      "ContainerImageDigest",
      "ContainerImageTag"
    ],
    nonSecretFields: {
      region: "us-east-1",
      repositories: ["periscan-api"]
    },
    product: "Elastic Container Registry",
    secretFields: {
      accessKeyId: "AKIAACCEPTANCEECR",
      secretAccessKey: "aws-ecr-acceptance-secret",
      sessionToken: "aws-ecr-acceptance-session"
    },
    vendor: "AWS"
  }
];

describe("Code/DevSecOps connector acceptance", () => {
  it("creates, encrypts, syncs, audits, and tenant-isolates Code/DevSecOps connectors through public APIs", async () => {
    const prisma = createPrismaClient();
    await probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie, response: signup } = await performSignup(
        app,
        "code-devsecops-connectors",
        "Code DevSecOps Connector Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const integrationIds: string[] = [];

      for (const connectorCase of CONNECTOR_CASES) {
        const created = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            authType: connectorCase.authType,
            config: connectorCase.config,
            connectorKey: connectorCase.connectorKey,
            mockMode: true
          },
          url: "/api/v1/integrations"
        });

        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({
          authType: connectorCase.authType,
          category: "Code",
          product: connectorCase.product,
          status: "Connected",
          vendor: connectorCase.vendor
        });
        expect(created.json().config).toMatchObject({
          connectorKey: connectorCase.connectorKey,
          mockMode: true,
          ...connectorCase.nonSecretFields
        });
        for (const [field, plaintext] of Object.entries(
          connectorCase.secretFields
        )) {
          expect(created.json().config[field]).toBe("[redacted]");
          expect(JSON.stringify(created.json())).not.toContain(plaintext);
        }

        const integrationId = created.json().integrationId as string;
        integrationIds.push(integrationId);

        const storedIntegration = await prisma.integration.findFirstOrThrow({
          where: { integrationId, tenantId }
        });
        const storedConfig = storedIntegration.config as Record<
          string,
          unknown
        >;
        for (const [field, plaintext] of Object.entries(
          connectorCase.secretFields
        )) {
          expect(storedConfig[field]).not.toBe(plaintext);
          expect(String(storedConfig[field])).toMatch(/^v1\./u);
          expect(JSON.stringify(storedConfig)).not.toContain(plaintext);
        }
        for (const [field, value] of Object.entries(
          connectorCase.nonSecretFields
        )) {
          expect(storedConfig[field]).toEqual(value);
        }

        const health = await app.inject({
          cookies: authCookies(cookie),
          method: "GET",
          url: `/api/v1/integrations/${integrationId}/health`
        });
        expect(health.statusCode).toBe(200);
        expect(health.json().health.status).toBe("Healthy");
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(health.json())).not.toContain(plaintext);
        }

        const synced = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });
        expect(synced.statusCode).toBe(200);
        expect(synced.json().assetCount).toBe(connectorCase.expectedAssetCount);
        expect(synced.json().health.status).toBe("Healthy");
        expect(synced.json().signalCount).toBeGreaterThan(0);
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(synced.json())).not.toContain(plaintext);
        }

        const signals = await prisma.signalEnvelope.findMany({
          where: { sourceIntegrationId: integrationId, tenantId }
        });
        expect(signals.length).toBeGreaterThan(0);
        expect(signals.map((signal) => signal.signalCategory)).toEqual(
          expect.arrayContaining(connectorCase.expectedSignalCategories)
        );
        expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
          expect.arrayContaining(connectorCase.expectedSignalSubcategories)
        );
        expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
          true
        );
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(signals)).not.toContain(plaintext);
        }

        const evidence = await prisma.evidenceArtifact.findMany({
          where: {
            relatedEntityId: integrationId,
            relatedEntityType: "Integration",
            tenantId
          }
        });
        expect(evidence.length).toBe(1);
        expect(evidence[0]).toMatchObject({
          artifactType: "NormalizedEvidence"
        });

        const trustSafety = await app.inject({
          cookies: authCookies(cookie),
          method: "GET",
          url: "/api/v1/tenants/current/trust-safety"
        });
        expect(trustSafety.statusCode).toBe(200);
        const connected = trustSafety
          .json()
          .connectedIntegrations.find(
            (item: { integrationId: string }) =>
              item.integrationId === integrationId
          );
        expect(connected).toMatchObject({
          category: "Code",
          healthStatus: "Healthy",
          lastSyncAt: expect.any(String),
          product: connectorCase.product,
          status: "Connected",
          vendor: connectorCase.vendor
        });
        expect(connected.permissionsUsed).toEqual(
          expect.arrayContaining(connectorCase.expectedPermissions)
        );
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(trustSafety.json())).not.toContain(plaintext);
        }

        const auditEvents = await prisma.auditEvent.findMany({
          orderBy: { createdAt: "asc" },
          where: {
            entityId: integrationId,
            tenantId
          }
        });
        expect(auditEvents.map((event) => event.action)).toEqual(
          expect.arrayContaining([
            "integration_connected",
            "integration_synced"
          ])
        );
        expect(
          auditEvents.find((event) => event.action === "integration_synced")
            ?.metadata
        ).toMatchObject({
          assetCount: connectorCase.expectedAssetCount,
          connectorKey: connectorCase.connectorKey,
          healthStatus: "Healthy",
          status: "Succeeded"
        });
        expect(
          (
            auditEvents.find((event) => event.action === "integration_synced")
              ?.metadata as { signalCount?: number } | undefined
          )?.signalCount
        ).toBeGreaterThan(0);
      }

      const { cookie: otherCookie } = await performSignup(
        app,
        "code-devsecops-connectors-other",
        "Code DevSecOps Connector Other Tenant"
      );

      for (const integrationId of integrationIds) {
        const crossTenantRead = await app.inject({
          cookies: authCookies(otherCookie),
          method: "GET",
          url: `/api/v1/integrations/${integrationId}`
        });
        expect(crossTenantRead.statusCode).toBe(404);

        const crossTenantSync = await app.inject({
          cookies: authCookies(otherCookie),
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });
        expect(crossTenantSync.statusCode).toBe(404);
      }
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
