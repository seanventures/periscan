import { describe, expect, it, vi } from "vitest";

import { EXTERNAL_ASSESSMENT_PRODUCT_COPY } from "@periscan/shared";

import { buildApp } from "./app.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "./security.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SCOPE_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_SECRET = "external-assessment-session-secret";

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
    name: "External Assessment Tenant",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Customer"
  },
  user: {
    email: "external@periscan.test",
    mfaEnabledAt: null,
    name: "External Owner",
    userId: USER_ID
  }
};

describe("internet-facing assessment routes", () => {
  it("compiles without starting jobs and starts only allowlisted ExternalPoA/ControlPlane work", async () => {
    const compileExternalAssessment = vi.fn(async () => ({
      assessment: {
        alwaysOnBas: false,
        executable: true,
        jobsQueued: 0,
        liveAtomic: false,
        nucleiPin: "v3.8.0",
        nucleiTemplatesPin: "v10.4.4",
        productCopy: EXTERNAL_ASSESSMENT_PRODUCT_COPY,
        profileId: "internet-facing",
        startJobs: [
          {
            executionEnvironment: "ExternalPoA",
            moduleId: "nuclei.external_exposure_safe"
          }
        ],
        startsJobs: false,
        templateProfile: "safe-baseline",
        tools: [{ moduleId: "nuclei.external_exposure_safe", toolId: "nuclei" }]
      },
      ok: true
    }));
    const startExternalAssessment = vi.fn(async () => ({
      jobs: [
        {
          executionEnvironment: "ExternalPoA",
          moduleId: "nuclei.external_exposure_safe"
        },
        {
          executionEnvironment: "ControlPlane",
          moduleId: "periscan.dns_resolution_check"
        }
      ],
      jobsQueued: 2,
      liveAtomic: false,
      missionIds: ["66666666-6666-4666-8666-666666666666"],
      ok: true,
      productCopy: EXTERNAL_ASSESSMENT_PRODUCT_COPY,
      runnerTasksQueued: 0
    }));
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        compileExternalAssessment,
        startExternalAssessment
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const compiled = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { profileId: "internet-facing" },
        url: "/api/v1/external-assessments/compile"
      });
      expect(compiled.statusCode).toBe(200);
      expect(compiled.json()).toMatchObject({
        assessment: { jobsQueued: 0, startsJobs: false },
        ok: true
      });
      expect(startExternalAssessment).not.toHaveBeenCalled();

      const started = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: {
          consent: true,
          profileId: "internet-facing",
          scopeId: SCOPE_ID
        },
        url: "/api/v1/external-assessments/start"
      });
      expect(started.statusCode).toBe(200);
      expect(started.json()).toMatchObject({
        jobsQueued: 2,
        liveAtomic: false,
        ok: true,
        runnerTasksQueued: 0
      });
    } finally {
      await app.close();
    }
  });

  it("keeps light-external-scans copy as internet-facing assessment, not full ASV in a box", async () => {
    const createScope = vi.fn(async () => ({
      scopeId: SCOPE_ID,
      scopeType: "Domain",
      tenantId: TENANT_ID,
      value: "example.com",
      verificationStatus: "Unverified"
    }));
    const verifyScope = vi.fn(async () => ({
      scopeId: SCOPE_ID,
      scopeType: "Domain",
      tenantId: TENANT_ID,
      value: "example.com",
      verificationStatus: "Verified"
    }));
    const createSchedule = vi.fn(async () => ({
      scheduleId: "44444444-4444-4444-8444-444444444444"
    }));
    const compileExternalAssessment = vi.fn(async () => ({
      assessment: {
        alwaysOnBas: false,
        executable: true,
        jobsQueued: 0,
        liveAtomic: false,
        nucleiPin: "v3.8.0",
        nucleiTemplatesPin: "v10.4.4",
        productCopy: EXTERNAL_ASSESSMENT_PRODUCT_COPY,
        profileId: "internet-facing",
        startJobs: [],
        startsJobs: false,
        templateProfile: "safe-baseline",
        tools: []
      },
      ok: true
    }));
    const app = await buildApp({
      services: {
        getSessionContext: async () => ownerContext,
        createScope,
        verifyScope,
        createSchedule,
        compileExternalAssessment
      } as never,
      sessionSecret: SESSION_SECRET
    });

    try {
      const cookie = await createSessionToken(
        ownerContext.session,
        SESSION_SECRET
      );
      const created = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: cookie },
        method: "POST",
        payload: { consent: true, domain: "example.com" },
        url: "/api/v1/light-external-scans"
      });
      expect(created.statusCode).toBe(201);
      const body = created.json() as { note?: string };
      expect(body.note).toMatch(/Internet-facing assessment/i);
      expect(body.note).toMatch(/Not a full ASV platform in a box/i);
      expect(body.note).not.toMatch(/No full swarm/i);
    } finally {
      await app.close();
    }
  });
});
