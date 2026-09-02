import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const EMAIL_PREFIX = "oss-engine-dispatch";

describe("OSS engine mission dispatch (PERISCAN-498)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [EMAIL_PREFIX]);
      await prisma.$disconnect();
    }
  }, 30_000);

  it("InternalRunner recon does not queue a worker job without a runner", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            throw new Error("worker must not receive InternalRunner jobs");
          }
        },
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "IPRange",
          value: "10.0.0.0/24"
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verify = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      const policy = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction({
            requiresInternalRunner: true
          }),
          safetyLevel: "ActiveNonInvasive",
          target: { targets: "10.0.0.0/24" }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(policy.statusCode).toBe(201);

      const mission = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: policy.json().policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(mission.statusCode).toBe(201);

      const start = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          moduleIds: ["recon.host_discovery"],
          target: { targets: "10.0.0.0/24" }
        },
        url: `/api/v1/missions/${mission.json().missionId}/start`
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().jobsQueued).toBe(0);
      const run = start.json().runs[0];
      expect(run.moduleId).toBe("recon.host_discovery");
      expect(run.status).toBe("Failed");
      expect(String(run.errorSummary ?? "")).toMatch(/internal runner/i);
    } finally {
      await app.close();
    }
  });

  it("ControlPlane Gitleaks still queues a worker job", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const queued: string[] = [];

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob(payload) {
            queued.push(payload.runId);
          }
        },
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Repository",
          value: "https://github.com/example/demo"
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const policy = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionEnvironment: "ControlPlane",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "PassiveReadOnly",
          target: {
            fixtureMode: true,
            repositoryPath: "/tmp/demo"
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(policy.statusCode).toBe(201);

      const mission = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: policy.json().policyDecisionId,
          safetyLevel: "PassiveReadOnly",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(mission.statusCode).toBe(201);

      const start = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          moduleIds: ["gitleaks.repo_secrets"],
          target: {
            fixtureMode: true,
            repositoryName: "demo",
            repositoryPath: "/tmp/demo"
          }
        },
        url: `/api/v1/missions/${mission.json().missionId}/start`
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().jobsQueued).toBeGreaterThanOrEqual(1);
      expect(queued.length).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
    }
  });

  it("unknown runnerId fails InternalRunner honestly and does not mint a task", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            throw new Error("worker must not receive InternalRunner jobs");
          }
        },
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Unknown Runner Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = response.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "IPRange",
          value: "10.0.0.0/24"
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      const verify = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      const policy = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction({
            requiresInternalRunner: true
          }),
          safetyLevel: "ActiveNonInvasive",
          target: { targets: "10.0.0.0/24" }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(policy.statusCode).toBe(201);

      const mission = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: policy.json().policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(mission.statusCode).toBe(201);

      const start = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          moduleIds: ["recon.host_discovery"],
          runnerId: randomUUID(),
          target: { targets: "10.0.0.0/24" }
        },
        url: `/api/v1/missions/${mission.json().missionId}/start`
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().jobsQueued).toBe(0);
      const run = start.json().runs[0];
      expect(run.moduleId).toBe("recon.host_discovery");
      expect(run.status).toBe("Failed");
      expect(String(run.errorSummary ?? "")).toMatch(/internal runner/i);
      expect(
        await prisma.runnerTask.count({
          where: { tenantId }
        })
      ).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("enrolled runner still cannot dispatch a non-allowlisted InternalRunner module", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            throw new Error("worker must not receive InternalRunner jobs");
          }
        },
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Allowlist Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = response.json().tenant.tenantId as string;

      await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "hash",
          capabilities: {},
          deploymentMode: "Docker",
          hostname: "enrolled-runner",
          labels: [],
          name: "Enrolled Runner",
          networkProfile: {},
          os: "linux",
          status: "Active",
          tenantId,
          transportMode: "LongPollHttps",
          version: "1.0.0"
        }
      });

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "InternalNetwork",
          value: "10.0.0.0/24"
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const policy = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction({
            requiresInternalRunner: true
          }),
          safetyLevel: "ActiveNonInvasive",
          target: {
            ports: [443],
            targetHost: "app-01.corp.example.internal",
            timeoutSeconds: 5
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(policy.statusCode).toBe(201);

      const mission = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: policy.json().policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(mission.statusCode).toBe(201);

      const start = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          moduleIds: ["runner.reachability_check"],
          target: {
            ports: [443],
            targetHost: "app-01.corp.example.internal",
            timeoutSeconds: 5
          }
        },
        url: `/api/v1/missions/${mission.json().missionId}/start`
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().jobsQueued).toBe(0);
      const run = start.json().runs[0];
      expect(run.moduleId).toBe("runner.reachability_check");
      expect(run.status).toBe("Failed");
      expect(String(run.errorSummary ?? "")).toMatch(/allowlist/i);
      expect(
        await prisma.runnerTask.count({
          where: { tenantId }
        })
      ).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("mixed ControlPlane Gitleaks + InternalRunner recon still queues only the worker job", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const queued: string[] = [];

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob(payload) {
            queued.push(payload.runId);
          }
        },
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Mixed Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Repository",
          value: "https://github.com/example/demo"
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const policy = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionEnvironment: "ControlPlane",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: {
            fixtureMode: true,
            repositoryPath: "/tmp/demo"
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(policy.statusCode).toBe(201);

      const mission = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: policy.json().policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(mission.statusCode).toBe(201);

      const start = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          moduleIds: ["gitleaks.repo_secrets", "recon.host_discovery"],
          target: {
            fixtureMode: true,
            repositoryName: "demo",
            repositoryPath: "/tmp/demo",
            targets: "10.0.0.0/24"
          }
        },
        url: `/api/v1/missions/${mission.json().missionId}/start`
      });
      expect(start.statusCode).toBe(200);
      const runs = start.json().runs as Array<{
        errorSummary?: string | null;
        moduleId: string;
        status: string;
      }>;
      const gitleaks = runs.find(
        (run) => run.moduleId === "gitleaks.repo_secrets"
      );
      const recon = runs.find((run) => run.moduleId === "recon.host_discovery");
      expect(gitleaks?.status).toBe("Queued");
      expect(recon?.status).toBe("Failed");
      expect(String(recon?.errorSummary ?? "")).toMatch(/internal runner/i);
      expect(queued.length).toBe(1);
      expect(start.json().jobsQueued).toBe(1);
    } finally {
      await app.close();
    }
  });
});
