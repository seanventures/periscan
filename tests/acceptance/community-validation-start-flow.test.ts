import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const EMAIL_PREFIX = "community-val-acc";

const DOMAIN_WORKER_MODULE_IDS = [
  "periscan.dns_resolution_check",
  "periscan.tls_certificate_check",
  "periscan.http_health_check"
] as const;

const REPO_WORKER_MODULE_IDS = [
  "gitleaks.repo_secrets",
  "trivy.repo_dependency_scan"
] as const;

type QueuedJob = { runId: string };

async function buildAcceptanceApp(queued: QueuedJob[]) {
  const prisma = createPrismaClient();
  await testHelpers.probeDatabaseConnection(prisma);
  const app = await buildApp({
    devMode: true,
    services: createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: {
        async enqueueValidationJob(payload) {
          queued.push({ runId: payload.runId });
        }
      },
      prisma,
      webhookQueue: null
    })
  });
  return { app, prisma };
}

async function signupAndAuth(
  app: Awaited<ReturnType<typeof buildApp>>,
  tenantName: string
) {
  const { cookie, response } = await testHelpers.performSignup(
    app,
    EMAIL_PREFIX,
    tenantName
  );
  return {
    auth: testHelpers.authHeaders(cookie),
    tenantId: response.json().tenant.tenantId as string
  };
}

async function createVerifiedScope(
  app: Awaited<ReturnType<typeof buildApp>>,
  auth: Record<string, string>,
  payload: { scopeType: "Domain" | "Repository"; value: string }
) {
  const scope = await app.inject({
    cookies: auth,
    method: "POST",
    payload,
    url: "/api/v1/scopes"
  });
  expect(scope.statusCode, scope.body).toBe(201);
  const scopeId = scope.json().scopeId as string;

  const verify = await app.inject({
    cookies: auth,
    method: "POST",
    payload: { devModeManual: true },
    url: `/api/v1/scopes/${scopeId}/verify`
  });
  expect(verify.statusCode, verify.body).toBe(200);
  expect(verify.json().verificationStatus).toBe("Verified");
  return { scopeId, scopeValue: payload.value };
}

async function previewValidationSnapshotPolicy(
  app: Awaited<ReturnType<typeof buildApp>>,
  auth: Record<string, string>,
  input: {
    safetyLevel: "ActiveNonInvasive" | "PassiveReadOnly";
    scopeId: string;
    target: Record<string, unknown>;
  }
) {
  const policy = await app.inject({
    cookies: auth,
    method: "POST",
    payload: {
      executionEnvironment: "ControlPlane",
      missionType: "ValidationSnapshot",
      requestedAction: testHelpers.safeRequestedAction(),
      safetyLevel: input.safetyLevel,
      target: input.target
    },
    url: `/api/v1/scopes/${input.scopeId}/policy-decisions/preview`
  });
  expect(policy.statusCode, policy.body).toBe(201);
  expect(policy.json().policyDecisionId).toBeTruthy();
  return policy.json() as {
    approvalState: string;
    outcome: string;
    policyDecisionId: string;
  };
}

describe("Community validation start queues a real mission (PERISCAN-505)", () => {
  let prisma: ReturnType<typeof createPrismaClient> | undefined;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [EMAIL_PREFIX]);
      await prisma.$disconnect();
      prisma = undefined;
    }
  }, 30_000);

  it("POST /community/validation-runs on a verified Domain creates a mission and queues worker-lane work", async () => {
    const queued: QueuedJob[] = [];
    const harness = await buildAcceptanceApp(queued);
    prisma = harness.prisma;
    const { app } = harness;

    try {
      const { auth, tenantId } = await signupAndAuth(
        app,
        `${EMAIL_PREFIX} Domain Tenant`
      );
      const hostname = `community-${randomUUID()}.example.com`;
      const { scopeId } = await createVerifiedScope(app, auth, {
        scopeType: "Domain",
        value: hostname
      });

      const suite = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/community/validation-suite?scopeId=${scopeId}`
      });
      expect(suite.statusCode, suite.body).toBe(200);
      expect(suite.json().editionId).toBe("community");
      expect(suite.json().startableModuleIds).toEqual(
        expect.arrayContaining([...DOMAIN_WORKER_MODULE_IDS])
      );
      expect(suite.json().startableModuleIds).not.toContain(
        "nuclei.external_exposure_safe"
      );

      const policy = await previewValidationSnapshotPolicy(app, auth, {
        safetyLevel: "ActiveNonInvasive",
        scopeId,
        target: { value: hostname }
      });
      expect(policy.outcome).toBe("Allowed");

      const started = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          policyDecisionId: policy.policyDecisionId,
          scopeId
        },
        url: "/api/v1/community/validation-runs"
      });
      expect(started.statusCode, started.body).toBeGreaterThanOrEqual(200);
      expect(started.statusCode).toBeLessThan(300);

      const body = started.json() as {
        editionId: string;
        jobsQueued: number;
        mission: { missionId: string; status: string };
        moduleIds: string[];
        nucleiMissionId: string | null;
        nucleiSkipReason: string | null;
        runs: Array<{ moduleId: string; status: string }>;
        scopeType: string;
      };

      expect(body.editionId).toBe("community");
      expect(body.scopeType).toBe("Domain");
      expect(body.mission.missionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(body.mission.status).not.toBe("DeniedByPolicy");
      expect(body.jobsQueued).toBeGreaterThan(0);
      expect(body.moduleIds).toEqual(
        expect.arrayContaining([...DOMAIN_WORKER_MODULE_IDS])
      );
      expect(body.moduleIds).not.toContain("nuclei.external_exposure_safe");
      expect(body.runs.map((run) => run.moduleId)).toEqual(
        expect.arrayContaining([...DOMAIN_WORKER_MODULE_IDS])
      );
      expect(
        body.runs
          .filter((run) =>
            (DOMAIN_WORKER_MODULE_IDS as readonly string[]).includes(
              run.moduleId
            )
          )
          .every((run) => run.status === "Queued")
      ).toBe(true);

      const nucleiAccounted =
        Boolean(body.nucleiMissionId) || Boolean(body.nucleiSkipReason);
      expect(nucleiAccounted).toBe(true);
      if (body.nucleiMissionId) {
        expect(body.nucleiSkipReason).toBeNull();
      } else {
        expect(body.nucleiSkipReason).toMatch(
          /Nuclei|PoA|denied|did not start/i
        );
      }

      expect(queued.length).toBe(body.jobsQueued);
      expect(queued.length).toBeGreaterThan(0);

      const mission = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/missions/${body.mission.missionId}`
      });
      expect(mission.statusCode, mission.body).toBe(200);
      expect(mission.json().missionId).toBe(body.mission.missionId);
      expect(mission.json().tenantId).toBe(tenantId);
      expect(mission.json().scopeId).toBe(scopeId);
      expect(mission.json().policyDecisionId).toBe(policy.policyDecisionId);
      expect(mission.json().missionType).toBe("ValidationSnapshot");

      const jobs = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/jobs?missionId=${body.mission.missionId}`
      });
      expect(jobs.statusCode, jobs.body).toBe(200);
      expect((jobs.json().items as unknown[]).length).toBe(body.jobsQueued);

      if (body.nucleiMissionId) {
        const nucleiJobs = await app.inject({
          cookies: auth,
          method: "GET",
          url: `/api/v1/jobs?missionId=${body.nucleiMissionId}`
        });
        expect(nucleiJobs.statusCode, nucleiJobs.body).toBe(200);
      } else {
        const deniedNucleiJobs = await app.inject({
          cookies: auth,
          method: "GET",
          url: `/api/v1/missions/${body.mission.missionId}/runs`
        });
        expect(deniedNucleiJobs.statusCode).toBe(200);
        expect(
          (deniedNucleiJobs.json().items as Array<{ moduleId: string }>).some(
            (run) => run.moduleId === "nuclei.external_exposure_safe"
          )
        ).toBe(false);
      }
    } finally {
      await app.close();
    }
  }, 60_000);

  it("does not queue Community worker jobs when the policy decision is denied", async () => {
    const queued: QueuedJob[] = [];
    const harness = await buildAcceptanceApp(queued);
    prisma = harness.prisma;
    const { app } = harness;

    try {
      const { auth } = await signupAndAuth(
        app,
        `${EMAIL_PREFIX} Denied Tenant`
      );
      const hostname = `community-denied-${randomUUID()}.example.com`;
      const { scopeId } = await createVerifiedScope(app, auth, {
        scopeType: "Domain",
        value: hostname
      });
      const policy = await previewValidationSnapshotPolicy(app, auth, {
        safetyLevel: "ActiveNonInvasive",
        scopeId,
        target: { value: hostname }
      });

      const deny = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/approvals/${policy.policyDecisionId}/deny`
      });
      expect(deny.statusCode, deny.body).toBe(200);
      expect(deny.json().approvalState).toBe("Rejected");

      const started = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          policyDecisionId: policy.policyDecisionId,
          scopeId
        },
        url: "/api/v1/community/validation-runs"
      });
      expect(started.statusCode, started.body).toBe(200);
      expect(started.json().jobsQueued).toBe(0);
      expect(started.json().mission.status).toBe("DeniedByPolicy");
      expect(started.json().mission.missionId).toBeTruthy();
      expect(queued).toEqual([]);

      const jobs = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/jobs?missionId=${started.json().mission.missionId}`
      });
      expect(jobs.statusCode).toBe(200);
      expect(jobs.json().items).toEqual([]);
    } finally {
      await app.close();
    }
  }, 60_000);

  it("POST /community/validation-runs on a verified Repository selects gitleaks and trivy", async () => {
    const queued: QueuedJob[] = [];
    const harness = await buildAcceptanceApp(queued);
    prisma = harness.prisma;
    const { app } = harness;

    try {
      const { auth } = await signupAndAuth(app, `${EMAIL_PREFIX} Repo Tenant`);
      const repositoryPath = `/tmp/periscan-community-${randomUUID()}`;
      const { scopeId } = await createVerifiedScope(app, auth, {
        scopeType: "Repository",
        value: repositoryPath
      });

      const policy = await previewValidationSnapshotPolicy(app, auth, {
        safetyLevel: "PassiveReadOnly",
        scopeId,
        target: { repositoryPath }
      });
      expect(policy.outcome).toBe("Allowed");

      const started = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          policyDecisionId: policy.policyDecisionId,
          scopeId
        },
        url: "/api/v1/community/validation-runs"
      });
      expect(started.statusCode, started.body).toBeGreaterThanOrEqual(200);
      expect(started.statusCode).toBeLessThan(300);
      expect(started.json().scopeType).toBe("Repository");
      expect(started.json().mission.missionId).toBeTruthy();
      expect(started.json().moduleIds).toEqual(
        expect.arrayContaining([...REPO_WORKER_MODULE_IDS])
      );
      expect(started.json().jobsQueued).toBeGreaterThan(0);
      expect(queued.length).toBe(started.json().jobsQueued);
      expect(started.json().nucleiMissionId).toBeNull();
      expect(started.json().nucleiSkipReason).toBeNull();
    } finally {
      await app.close();
    }
  }, 60_000);
});
