import { describe, expect, it, vi } from "vitest";

import {
  COMMUNITY_EDITION_LICENSE_NOTE,
  COMMUNITY_EDITION_VALUE_LINE,
  COMMUNITY_MISSION_POLICY_PROFILE,
  COMMUNITY_NUCLEI_DENIED_SKIP_REASON,
  COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE,
  COMMUNITY_NUCLEI_MODULE_ID,
  COMMUNITY_PROWLER_AWS_CONNECT_REASON,
  CommunityValidationCompanionSchema,
  CommunityValidationSuiteResponseSchema,
  StartCommunityValidationRequestSchema,
  buildCommunityValidationTarget,
  communityPolicyPreviewRequest,
  listCommunityValidationDeferredModules,
  listCommunityValidationStartModules
} from "@periscan/shared";

import { buildApp } from "./app.js";
import { AppServiceError } from "./runtime-services.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./security.js";
import { createValidationServices } from "./services/validation.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SCOPE_ID = "33333333-3333-4333-8333-333333333333";
const POLICY_ID = "44444444-4444-4444-8444-444444444444";
const AWS_INTEGRATION_ID = "55555555-5555-4555-8555-555555555555";
const BEDROCK_INTEGRATION_ID = "66666666-6666-4666-8666-666666666666";
const MISSION_ID = "77777777-7777-4777-8777-777777777777";
const NUCLEI_MISSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUNNER_ID = "99999999-9999-4999-8999-999999999999";
const SESSION_SECRET = "community-cloudaccount-session-secret";

const ownerContext = {
  membership: {
    membershipId: "88888888-8888-4888-8888-888888888888",
    role: "Owner",
    tenantId: TENANT_ID,
    userId: USER_ID
  },
  session: {
    authMethod: "password" as const,
    defaultTenantId: TENANT_ID,
    userId: USER_ID
  },
  tenant: {
    name: "CloudAccount Tenant",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Customer"
  },
  user: {
    email: "cloud@periscan.test",
    mfaEnabledAt: null,
    name: "Cloud Owner",
    userId: USER_ID
  }
};

function cloudAccountScope(verificationStatus: "Verified" | "Unverified") {
  return {
    scopeId: SCOPE_ID,
    scopeType: "CloudAccount",
    tenantId: TENANT_ID,
    value: "123456789012",
    verificationStatus
  };
}

function connectedAwsAccount() {
  return {
    integrationId: AWS_INTEGRATION_ID,
    product: "AWS",
    status: "Connected",
    vendor: "AWS"
  };
}

function connectedAwsBedrock() {
  return {
    integrationId: BEDROCK_INTEGRATION_ID,
    product: "AWS Bedrock",
    status: "Connected",
    vendor: "AWS"
  };
}

function createCommunityServices(input: {
  executionEnvironment?: "ControlPlane" | "InternalRunner" | "ExternalPoA";
  integrations?: Array<{
    integrationId: string;
    product: string;
    status: string;
    vendor: string;
  }>;
  runner?: { runnerId: string } | null;
  licenseAcceptances?: Array<{ toolId: string }>;
  safetyLevel?: "PassiveReadOnly" | "ActiveNonInvasive";
  scope?: {
    scopeId: string;
    scopeType: string;
    tenantId: string;
    value: string;
    verificationStatus: "Verified" | "Unverified";
  };
}) {
  const services = createValidationServices({
    prisma: {
      integration: {
        findMany: vi.fn(async () => input.integrations ?? [])
      },
      toolLicenseAcceptance: {
        findMany: vi.fn(async () => input.licenseAcceptances ?? [])
      },
      policyDecision: {
        findFirst: vi.fn(async () => ({
          executionEnvironment: input.executionEnvironment ?? "ControlPlane",
          policyDecisionId: POLICY_ID,
          safetyLevel: input.safetyLevel ?? "PassiveReadOnly",
          tenantId: TENANT_ID
        }))
      },
      runner: {
        findFirst: vi.fn(async () => input.runner ?? null)
      },
      scope: {
        findFirst: vi.fn(
          async () => input.scope ?? cloudAccountScope("Verified")
        )
      }
    }
  } as never);
  return { services };
}

function domainScope() {
  return {
    scopeId: SCOPE_ID,
    scopeType: "Domain",
    tenantId: TENANT_ID,
    value: "app.example.com",
    verificationStatus: "Verified" as const
  };
}

function repositoryScope(verificationStatus: "Verified" | "Unverified" = "Verified") {
  return {
    scopeId: SCOPE_ID,
    scopeType: "Repository",
    tenantId: TENANT_ID,
    value: "/tmp/authorized-repo",
    verificationStatus
  };
}

describe("Community validation HTTP contracts", () => {
  it("parses a Domain suite response", () => {
    const modules = listCommunityValidationStartModules({
      scopeType: "Domain"
    });
    const parsed = CommunityValidationSuiteResponseSchema.parse({
      cloudAwsAvailable: false,
      deferredModules: [],
      editionId: "community",
      includeExternalPoa: false,
      licenseNote:
        COMMUNITY_EDITION_LICENSE_NOTE,
      modules,
      runnerAvailable: false,
      scopeType: "Domain",
      startableModuleIds: modules.map((entry) => entry.moduleId),
      valueLine: COMMUNITY_EDITION_VALUE_LINE
    });
    expect(parsed.startableModuleIds.length).toBeGreaterThan(0);
    expect(parsed.startableModuleIds).not.toContain(
      "nuclei.external_exposure_safe"
    );
  });

  it("requires policyDecisionId and scopeId to start", () => {
    expect(() =>
      StartCommunityValidationRequestSchema.parse({
        scopeId: "not-a-uuid"
      })
    ).toThrow();
    const parsed = StartCommunityValidationRequestSchema.parse({
      policyDecisionId: "11111111-1111-4111-8111-111111111111",
      scopeId: "22222222-2222-4222-8222-222222222222"
    });
    expect(
      buildCommunityValidationTarget({
        entries: listCommunityValidationStartModules({
          scopeType: "Repository"
        }),
        scopeType: "Repository",
        scopeValue: "/var/repos/app"
      }).repositoryPath
    ).toBe("/var/repos/app");
    expect(parsed.includeExternalPoa).toBeUndefined();
  });

  it("parses a CloudAccount suite that defers Prowler until AWS is connected", () => {
    const modules = listCommunityValidationStartModules({
      cloudAwsAvailable: false,
      scopeType: "CloudAccount"
    });
    const deferred = listCommunityValidationDeferredModules({
      cloudAwsAvailable: false,
      scopeType: "CloudAccount"
    });
    const parsed = CommunityValidationSuiteResponseSchema.parse({
      cloudAwsAvailable: false,
      deferredModules: deferred,
      editionId: "community",
      includeExternalPoa: false,
      licenseNote:
        COMMUNITY_EDITION_LICENSE_NOTE,
      modules: listCommunityValidationStartModules({
        cloudAwsAvailable: true,
        scopeType: "CloudAccount"
      }),
      runnerAvailable: false,
      scopeType: "CloudAccount",
      startableModuleIds: modules.map((entry) => entry.moduleId),
      valueLine: COMMUNITY_EDITION_VALUE_LINE
    });
    expect(parsed.startableModuleIds).not.toContain("prowler.aws_posture");
    expect(parsed.deferredModules).toEqual([
      {
        moduleId: "prowler.aws_posture",
        reason: COMMUNITY_PROWLER_AWS_CONNECT_REASON,
        title: "Prowler AWS posture"
      },
      {
        moduleId: "cloudlist.cloud_assets",
        reason: "Enroll an internal runner to start this engine.",
        title: "cloudlist cloud assets"
      }
    ]);
  });
});

describe("Community CloudAccount suite and start services", () => {
  it("lists Prowler as startable only when a Connected AWS account integration exists", async () => {
    const connected = createCommunityServices({
      integrations: [connectedAwsBedrock(), connectedAwsAccount()]
    });
    const suite = await connected.services.getCommunityValidationSuite(
      ownerContext as never,
      { scopeId: SCOPE_ID }
    );
    expect(suite.cloudAwsAvailable).toBe(true);
    expect(suite.scopeType).toBe("CloudAccount");
    expect(suite.startableModuleIds).toEqual(["prowler.aws_posture"]);
    expect(suite.deferredModules).toEqual([
      {
        moduleId: "cloudlist.cloud_assets",
        reason: "Enroll an internal runner to start this engine.",
        title: "cloudlist cloud assets"
      }
    ]);

    const missing = createCommunityServices({ integrations: [] });
    const deferred = await missing.services.getCommunityValidationSuite(
      ownerContext as never,
      { scopeId: SCOPE_ID }
    );
    expect(deferred.cloudAwsAvailable).toBe(false);
    expect(deferred.startableModuleIds).toEqual([]);
    expect(deferred.deferredModules).toEqual([
      {
        moduleId: "prowler.aws_posture",
        reason: COMMUNITY_PROWLER_AWS_CONNECT_REASON,
        title: "Prowler AWS posture"
      },
      {
        moduleId: "cloudlist.cloud_assets",
        reason: "Enroll an internal runner to start this engine.",
        title: "cloudlist cloud assets"
      }
    ]);

    const bedrockOnly = createCommunityServices({
      integrations: [connectedAwsBedrock()]
    });
    const sibling = await bedrockOnly.services.getCommunityValidationSuite(
      ownerContext as never,
      { scopeId: SCOPE_ID }
    );
    expect(sibling.cloudAwsAvailable).toBe(false);
    expect(sibling.startableModuleIds).not.toContain("prowler.aws_posture");
    expect(sibling.deferredModules.map((row) => row.reason)).toContain(
      COMMUNITY_PROWLER_AWS_CONNECT_REASON
    );
  });

  it("starts Prowler with awsIntegrationId when AWS is connected", async () => {
    const { services } = createCommunityServices({
      integrations: [connectedAwsAccount()]
    });
    vi.spyOn(services, "createMission").mockResolvedValue({
      missionId: MISSION_ID
    } as never);
    const startMission = vi.spyOn(services, "startMission").mockResolvedValue({
      jobsQueued: 1,
      mission: { missionId: MISSION_ID, status: "Queued" },
      runs: []
    } as never);

    const started = await services.startCommunityValidation(
      ownerContext as never,
      {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      }
    );

    expect(started.moduleIds).toEqual(["prowler.aws_posture"]);
    expect(started.target).toEqual({
      awsAccountId: "123456789012",
      awsIntegrationId: AWS_INTEGRATION_ID
    });
    expect(startMission).toHaveBeenCalledWith(
      ownerContext,
      MISSION_ID,
      expect.objectContaining({
        moduleIds: ["prowler.aws_posture"],
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: AWS_INTEGRATION_ID
        }
      })
    );
  });

  it("refuses to start CloudAccount Prowler when AWS is not connected", async () => {
    const missing = createCommunityServices({ integrations: [] });
    const bedrockOnly = createCommunityServices({
      integrations: [connectedAwsBedrock()]
    });
    const startMission = vi.spyOn(missing.services, "startMission");

    await expect(
      missing.services.startCommunityValidation(ownerContext as never, {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      })
    ).rejects.toMatchObject({
      code: "community_suite_empty",
      statusCode: 400
    });
    await expect(
      bedrockOnly.services.startCommunityValidation(ownerContext as never, {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      })
    ).rejects.toMatchObject({
      code: "community_suite_empty",
      statusCode: 400
    });
    expect(startMission).not.toHaveBeenCalled();
  });

  it("refuses to start InternalRunner modules under a ControlPlane policy", async () => {
    const { services } = createCommunityServices({
      executionEnvironment: "ControlPlane",
      runner: { runnerId: RUNNER_ID },
      safetyLevel: "ActiveNonInvasive",
      scope: domainScope()
    });
    const startMission = vi.spyOn(services, "startMission");

    await expect(
      services.startCommunityValidation(ownerContext as never, {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      })
    ).rejects.toMatchObject({
      code: "community_environment_mismatch",
      statusCode: 400
    });
    expect(startMission).not.toHaveBeenCalled();
  });

  it("refuses Community start on an unverified scope", async () => {
    const { services } = createCommunityServices({
      scope: repositoryScope("Unverified")
    });
    const startMission = vi.spyOn(services, "startMission");

    await expect(
      services.startCommunityValidation(ownerContext as never, {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      })
    ).rejects.toMatchObject({
      code: "scope_not_verified",
      statusCode: 400
    });
    expect(startMission).not.toHaveBeenCalled();
  });

  it("rejects theater moduleIds and does not queue", async () => {
    const { services } = createCommunityServices({
      scope: repositoryScope()
    });
    const startMission = vi.spyOn(services, "startMission");

    await expect(
      services.startCommunityValidation(ownerContext as never, {
        moduleIds: ["caldera.advanced_adversarial"],
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      })
    ).rejects.toMatchObject({
      code: "community_module_not_allowed",
      statusCode: 400
    });
    expect(startMission).not.toHaveBeenCalled();
  });

  it("does not start copyleft engines unless includeCopyleftOptIn is set", async () => {
    const { services } = createCommunityServices({
      licenseAcceptances: [{ toolId: "semgrep" }],
      scope: repositoryScope()
    });
    vi.spyOn(services, "createMission").mockResolvedValue({
      missionId: MISSION_ID
    } as never);
    const startMission = vi.spyOn(services, "startMission").mockResolvedValue({
      jobsQueued: 1,
      mission: { missionId: MISSION_ID, status: "Queued" },
      runs: []
    } as never);

    const started = await services.startCommunityValidation(
      ownerContext as never,
      {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      }
    );

    expect(started.moduleIds).not.toContain("semgrep.repo_sast");
    expect(startMission.mock.calls[0]?.[2]?.moduleIds).not.toContain(
      "semgrep.repo_sast"
    );
  });

  it("starts licensed copyleft engines only when includeCopyleftOptIn is true", async () => {
    const { services } = createCommunityServices({
      licenseAcceptances: [{ toolId: "semgrep" }],
      scope: repositoryScope()
    });
    vi.spyOn(services, "createMission").mockResolvedValue({
      missionId: MISSION_ID
    } as never);
    const startMission = vi.spyOn(services, "startMission").mockResolvedValue({
      jobsQueued: 1,
      mission: { missionId: MISSION_ID, status: "Queued" },
      runs: []
    } as never);

    const started = await services.startCommunityValidation(
      ownerContext as never,
      {
        includeCopyleftOptIn: true,
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      }
    );

    expect(started.moduleIds).toContain("semgrep.repo_sast");
    expect(startMission.mock.calls[0]?.[2]?.moduleIds).toContain(
      "semgrep.repo_sast"
    );
  });

  it("starts runner-lane Community modules when the policy is InternalRunner", async () => {
    const { services } = createCommunityServices({
      executionEnvironment: "InternalRunner",
      runner: { runnerId: RUNNER_ID },
      safetyLevel: "ActiveNonInvasive",
      scope: domainScope()
    });
    vi.spyOn(services, "createMission").mockResolvedValue({
      missionId: MISSION_ID
    } as never);
    const startMission = vi.spyOn(services, "startMission").mockResolvedValue({
      jobsQueued: 1,
      mission: { missionId: MISSION_ID, status: "Queued" },
      runs: []
    } as never);

    const started = await services.startCommunityValidation(
      ownerContext as never,
      {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      }
    );

    expect(started.moduleIds).toEqual(
      expect.arrayContaining([
        "periscan.dns_resolution_check",
        "recon.subdomain_enum"
      ])
    );
    expect(started.moduleIds).not.toContain("nuclei.external_exposure_safe");
    expect(startMission).toHaveBeenCalledWith(
      ownerContext,
      MISSION_ID,
      expect.objectContaining({
        runnerId: RUNNER_ID
      })
    );
  });

  it("stamps community and community-nuclei policy profiles on the two missions", async () => {
    const { services } = createCommunityServices({
      executionEnvironment: "InternalRunner",
      runner: { runnerId: RUNNER_ID },
      safetyLevel: "ActiveNonInvasive",
      scope: domainScope()
    });
    const createMission = vi
      .spyOn(services, "createMission")
      .mockResolvedValueOnce({ missionId: MISSION_ID } as never)
      .mockResolvedValueOnce({ missionId: NUCLEI_MISSION_ID } as never);
    vi.spyOn(services, "startMission").mockImplementation(
      async (_context, missionId) =>
        ({
          jobsQueued: 1,
          mission: { missionId, status: "Queued" },
          runs: []
        }) as never
    );

    const started = await services.startCommunityValidation(
      ownerContext as never,
      {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      }
    );

    expect(createMission).toHaveBeenNthCalledWith(
      1,
      ownerContext,
      expect.objectContaining({
        policyProfile: COMMUNITY_MISSION_POLICY_PROFILE
      })
    );
    expect(createMission).toHaveBeenNthCalledWith(
      2,
      ownerContext,
      expect.objectContaining({
        policyProfile: COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE
      })
    );
    expect(started.nucleiMissionId).toBe(NUCLEI_MISSION_ID);
    expect(started.nucleiSkipReason).toBeNull();
  });

  it("starts Domain Nuclei as a second startMission after the primary pack", async () => {
    const { services } = createCommunityServices({
      executionEnvironment: "InternalRunner",
      runner: { runnerId: RUNNER_ID },
      safetyLevel: "ActiveNonInvasive",
      scope: domainScope()
    });
    vi.spyOn(services, "createMission")
      .mockResolvedValueOnce({ missionId: MISSION_ID } as never)
      .mockResolvedValueOnce({ missionId: NUCLEI_MISSION_ID } as never);
    const startMission = vi.spyOn(services, "startMission").mockImplementation(
      async (_context, missionId) =>
        ({
          jobsQueued: 1,
          mission: { missionId, status: "Queued" },
          runs: []
        }) as never
    );

    const started = await services.startCommunityValidation(
      ownerContext as never,
      {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      }
    );

    expect(startMission).toHaveBeenCalledTimes(2);
    expect(startMission.mock.calls[0]?.[1]).toBe(MISSION_ID);
    expect(startMission.mock.calls[0]?.[2]?.moduleIds).not.toContain(
      COMMUNITY_NUCLEI_MODULE_ID
    );
    expect(startMission).toHaveBeenNthCalledWith(
      2,
      ownerContext,
      NUCLEI_MISSION_ID,
      expect.objectContaining({
        moduleIds: [COMMUNITY_NUCLEI_MODULE_ID]
      })
    );
    expect(started.nucleiMissionId).toBe(NUCLEI_MISSION_ID);
    expect(started.moduleIds).not.toContain(COMMUNITY_NUCLEI_MODULE_ID);
  });

  it("does not start a Nuclei mission when includeExternalPoa is false", async () => {
    const { services } = createCommunityServices({
      executionEnvironment: "InternalRunner",
      runner: { runnerId: RUNNER_ID },
      safetyLevel: "ActiveNonInvasive",
      scope: domainScope()
    });
    const createMission = vi
      .spyOn(services, "createMission")
      .mockResolvedValue({ missionId: MISSION_ID } as never);
    const startMission = vi.spyOn(services, "startMission").mockResolvedValue({
      jobsQueued: 1,
      mission: { missionId: MISSION_ID, status: "Queued" },
      runs: []
    } as never);

    const started = await services.startCommunityValidation(
      ownerContext as never,
      {
        includeExternalPoa: false,
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      }
    );

    expect(createMission).toHaveBeenCalledTimes(1);
    expect(startMission).toHaveBeenCalledTimes(1);
    expect(startMission.mock.calls[0]?.[2]?.moduleIds).not.toContain(
      COMMUNITY_NUCLEI_MODULE_ID
    );
    expect(started.nucleiMissionId).toBeNull();
    expect(started.moduleIds).not.toContain(COMMUNITY_NUCLEI_MODULE_ID);
  });

  it("refuses Domain start when policy safety is PassiveReadOnly", async () => {
    const { services } = createCommunityServices({
      executionEnvironment: "InternalRunner",
      runner: { runnerId: RUNNER_ID },
      safetyLevel: "PassiveReadOnly",
      scope: domainScope()
    });
    const startMission = vi.spyOn(services, "startMission");

    await expect(
      services.startCommunityValidation(ownerContext as never, {
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      })
    ).rejects.toMatchObject({
      code: "community_safety_mismatch",
      statusCode: 400
    });
    expect(startMission).not.toHaveBeenCalled();
  });
});

describe("Community CloudAccount validation routes", () => {
  it("returns suite and start payloads for connected and not-connected AWS", async () => {
    const getCommunityValidationSuite = vi.fn();
    const startCommunityValidation = vi.fn();
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        getCommunityValidationSuite,
        startCommunityValidation
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );

      getCommunityValidationSuite.mockResolvedValueOnce({
        cloudAwsAvailable: false,
        deferredModules: [
          {
            moduleId: "prowler.aws_posture",
            reason: COMMUNITY_PROWLER_AWS_CONNECT_REASON,
            title: "Prowler AWS posture"
          }
        ],
        editionId: "community",
        includeExternalPoa: false,
        licenseNote:
          COMMUNITY_EDITION_LICENSE_NOTE,
        modules: listCommunityValidationStartModules({
          cloudAwsAvailable: true,
          scopeType: "CloudAccount"
        }),
        runnerAvailable: false,
        scopeType: "CloudAccount",
        startableModuleIds: [],
        valueLine: COMMUNITY_EDITION_VALUE_LINE
      });

      const deferredSuite = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "GET",
        url: `/api/v1/community/validation-suite?scopeId=${SCOPE_ID}`
      });
      expect(deferredSuite.statusCode).toBe(200);
      expect(deferredSuite.json()).toMatchObject({
        cloudAwsAvailable: false,
        startableModuleIds: [],
        deferredModules: [
          {
            moduleId: "prowler.aws_posture",
            reason: COMMUNITY_PROWLER_AWS_CONNECT_REASON
          }
        ]
      });

      getCommunityValidationSuite.mockResolvedValueOnce({
        cloudAwsAvailable: true,
        deferredModules: [],
        editionId: "community",
        includeExternalPoa: false,
        licenseNote:
          COMMUNITY_EDITION_LICENSE_NOTE,
        modules: listCommunityValidationStartModules({
          cloudAwsAvailable: true,
          scopeType: "CloudAccount"
        }),
        runnerAvailable: false,
        scopeType: "CloudAccount",
        startableModuleIds: ["prowler.aws_posture"],
        valueLine: COMMUNITY_EDITION_VALUE_LINE
      });

      const connectedSuite = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "GET",
        url: `/api/v1/community/validation-suite?scopeId=${SCOPE_ID}`
      });
      expect(connectedSuite.statusCode).toBe(200);
      expect(connectedSuite.json().startableModuleIds).toEqual([
        "prowler.aws_posture"
      ]);

      startCommunityValidation.mockResolvedValueOnce({
        editionId: "community",
        jobsQueued: 1,
        mission: {
          createdAt: "2026-08-15T00:00:00.000Z",
          evidenceIds: [],
          missionId: MISSION_ID,
          missionType: "ValidationSnapshot",
          policyDecisionId: POLICY_ID,
          requestedBy: USER_ID,
          safetyLevel: "PassiveReadOnly",
          scopeId: SCOPE_ID,
          scopeIds: [SCOPE_ID],
          status: "Queued",
          tenantId: TENANT_ID,
          updatedAt: "2026-08-15T00:00:00.000Z"
        },
        moduleIds: ["prowler.aws_posture"],
        nucleiMissionId: null,
        nucleiSkipReason: null,
        runs: [],
        scopeType: "CloudAccount",
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: AWS_INTEGRATION_ID
        }
      });

      const started = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          policyDecisionId: POLICY_ID,
          scopeId: SCOPE_ID
        },
        url: "/api/v1/community/validation-runs"
      });
      expect(started.statusCode).toBe(200);
      expect(started.json()).toMatchObject({
        moduleIds: ["prowler.aws_posture"],
        target: {
          awsAccountId: "123456789012",
          awsIntegrationId: AWS_INTEGRATION_ID
        }
      });

      startCommunityValidation.mockRejectedValueOnce(
        new AppServiceError(
          "No Community edition engines apply to CloudAccount scopes yet. Enroll a runner or connect AWS if this scope needs those lanes.",
          400,
          "community_suite_empty"
        )
      );
      const refused = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          policyDecisionId: POLICY_ID,
          scopeId: SCOPE_ID
        },
        url: "/api/v1/community/validation-runs"
      });
      expect(refused.statusCode).toBe(400);
      expect(refused.json()).toMatchObject({
        code: "community_suite_empty"
      });

      startCommunityValidation.mockRejectedValueOnce(
        new AppServiceError(
          "Policy environment ControlPlane cannot cover Community modules that require InternalRunner.",
          400,
          "community_environment_mismatch"
        )
      );
      const envRefused = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          policyDecisionId: POLICY_ID,
          scopeId: SCOPE_ID
        },
        url: "/api/v1/community/validation-runs"
      });
      expect(envRefused.statusCode).toBe(400);
      expect(envRefused.json()).toMatchObject({
        code: "community_environment_mismatch"
      });
    } finally {
      await app.close();
    }
  });
});

describe("Community Nuclei companion reconstruction", () => {
  const primaryCreatedAt = new Date("2026-08-15T12:00:00.000Z");

  function createCompanionServices(input: {
    mission?: {
      createdAt: Date;
      missionId: string;
      policyDecisionId: string | null;
      policyProfile: string | null;
      scopeId: string;
      tenantId: string;
    } | null;
    ownRuns?: Array<{ moduleId: string }>;
    siblingRuns?: Array<{
      createdAt: Date;
      errorSummary?: string | null;
      missionId: string;
      status?: string;
    }>;
    siblingMissions?: Array<{
      createdAt: Date;
      missionId: string;
      status?: string;
    }>;
  }) {
    const mission =
      input.mission === undefined
        ? {
            createdAt: primaryCreatedAt,
            missionId: MISSION_ID,
            policyDecisionId: POLICY_ID,
            policyProfile: COMMUNITY_MISSION_POLICY_PROFILE,
            scopeId: SCOPE_ID,
            tenantId: TENANT_ID
          }
        : input.mission;
    const services = createValidationServices({
      prisma: {
        validationMission: {
          findFirst: vi.fn(async () => mission),
          findMany: vi.fn(async () => input.siblingMissions ?? [])
        },
        validationRun: {
          findMany: vi.fn(async (args: { where?: { moduleId?: string } }) => {
            if (args.where?.moduleId === COMMUNITY_NUCLEI_MODULE_ID) {
              return input.siblingRuns ?? [];
            }
            return (
              input.ownRuns ?? [{ moduleId: "periscan.dns_resolution_check" }]
            );
          })
        }
      }
    } as never);
    return { services };
  }

  it("reconstructs the Nuclei sibling without inventing a skip reason", async () => {
    const { services } = createCompanionServices({
      ownRuns: [{ moduleId: "periscan.dns_resolution_check" }],
      siblingRuns: [
        {
          createdAt: new Date("2026-08-15T12:00:03.000Z"),
          missionId: NUCLEI_MISSION_ID
        }
      ]
    });

    const companion = await services.getCommunityValidationCompanion(
      ownerContext as never,
      MISSION_ID
    );

    expect(companion).toEqual({
      nucleiMissionId: NUCLEI_MISSION_ID,
      nucleiSkipReason: null
    });
    expect(
      CommunityValidationCompanionSchema.parse(companion).nucleiSkipReason
    ).toBeNull();
  });

  it("returns the recorded deny skip reason from a DeniedByPolicy sibling run", async () => {
    // PERISCAN-517 positive path: after the PoA deny is recorded on the
    // sibling run, the companion MUST reconstruct the skip reason. A
    // regression that always returns null would pass every negative test.
    const { services } = createCompanionServices({
      ownRuns: [{ moduleId: "periscan.dns_resolution_check" }],
      siblingRuns: [
        {
          createdAt: new Date("2026-08-15T12:00:03.000Z"),
          errorSummary: COMMUNITY_NUCLEI_DENIED_SKIP_REASON,
          missionId: NUCLEI_MISSION_ID,
          status: "DeniedByPolicy"
        }
      ]
    });

    const companion = await services.getCommunityValidationCompanion(
      ownerContext as never,
      MISSION_ID
    );

    expect(companion).toEqual({
      nucleiMissionId: NUCLEI_MISSION_ID,
      nucleiSkipReason: COMMUNITY_NUCLEI_DENIED_SKIP_REASON
    });
  });

  it("returns no companion for mixed or non-Community missions", async () => {
    const mixed = createCompanionServices({
      ownRuns: [
        { moduleId: "gitleaks.repo_secrets" },
        { moduleId: "caldera.advanced_adversarial" }
      ],
      siblingRuns: [
        {
          createdAt: new Date("2026-08-15T12:00:03.000Z"),
          missionId: NUCLEI_MISSION_ID
        }
      ]
    });
    const catalog = createCompanionServices({
      mission: {
        createdAt: primaryCreatedAt,
        missionId: MISSION_ID,
        policyDecisionId: POLICY_ID,
        policyProfile: null,
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID
      },
      ownRuns: [{ moduleId: "caldera.advanced_adversarial" }],
      siblingRuns: [
        {
          createdAt: new Date("2026-08-15T12:00:03.000Z"),
          missionId: NUCLEI_MISSION_ID
        }
      ]
    });

    await expect(
      mixed.services.getCommunityValidationCompanion(
        ownerContext as never,
        MISSION_ID
      )
    ).resolves.toEqual({
      nucleiMissionId: null,
      nucleiSkipReason: null
    });
    await expect(
      catalog.services.getCommunityValidationCompanion(
        ownerContext as never,
        MISSION_ID
      )
    ).resolves.toEqual({
      nucleiMissionId: null,
      nucleiSkipReason: null
    });
  });

  it("does not treat the Nuclei mission as its own companion", async () => {
    const { services } = createCompanionServices({
      mission: {
        createdAt: primaryCreatedAt,
        missionId: NUCLEI_MISSION_ID,
        policyDecisionId: POLICY_ID,
        policyProfile: COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE,
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID
      },
      ownRuns: [{ moduleId: COMMUNITY_NUCLEI_MODULE_ID }],
      siblingRuns: [
        {
          createdAt: primaryCreatedAt,
          missionId: NUCLEI_MISSION_ID
        }
      ]
    });

    await expect(
      services.getCommunityValidationCompanion(
        ownerContext as never,
        NUCLEI_MISSION_ID
      )
    ).resolves.toEqual({
      nucleiMissionId: null,
      nucleiSkipReason: null
    });
  });

  it("404s when the mission is not in the tenant", async () => {
    const { services } = createCompanionServices({ mission: null });

    await expect(
      services.getCommunityValidationCompanion(
        ownerContext as never,
        MISSION_ID
      )
    ).rejects.toMatchObject({
      code: "mission_not_found",
      statusCode: 404
    });
  });
});

describe("Community Nuclei companion route", () => {
  it("GET /community/validation-runs reconstructs the sibling for a mission id", async () => {
    const getCommunityValidationCompanion = vi.fn();
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        getCommunityValidationCompanion
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      getCommunityValidationCompanion.mockResolvedValueOnce({
        nucleiMissionId: NUCLEI_MISSION_ID,
        nucleiSkipReason: null
      });

      const response = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "GET",
        url: `/api/v1/community/validation-runs?missionId=${MISSION_ID}`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        nucleiMissionId: NUCLEI_MISSION_ID,
        nucleiSkipReason: null
      });
      expect(getCommunityValidationCompanion).toHaveBeenCalledWith(
        ownerContext,
        MISSION_ID
      );
    } finally {
      await app.close();
    }
  });
});

describe("Community policy preview request contract", () => {
  it("matches the Domain start set the API will actually launch", () => {
    expect(
      communityPolicyPreviewRequest({
        runnerAvailable: true,
        scopeType: "Domain"
      })
    ).toMatchObject({
      executionEnvironment: "InternalRunner",
      requestedAction: { requiresInternalRunner: true },
      safetyLevel: "ActiveNonInvasive"
    });
    expect(
      communityPolicyPreviewRequest({
        includeExternalPoa: true,
        runnerAvailable: false,
        scopeType: "Domain"
      }).executionEnvironment
    ).toBe("ControlPlane");
  });
});
