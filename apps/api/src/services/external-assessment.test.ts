import { describe, expect, it, vi } from "vitest";

import {
  EXTERNAL_ASSESSMENT_PRODUCT_COPY,
  EXTERNAL_ASSESSMENT_START_JOBS
} from "@periscan/shared";

import { AppServiceError } from "../runtime-services.js";
import { createExternalAssessmentServices } from "./external-assessment.js";
import type {
  AppServices,
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SCOPE_ID = "33333333-3333-4333-8333-333333333333";
const POLICY_ID = "55555555-5555-4555-8555-555555555555";
const MISSION_ID = "66666666-6666-4666-8666-666666666666";
const SCHEDULE_ID = "77777777-7777-4777-8777-777777777777";

const ownerContext = {
  membership: { role: "Owner" },
  tenant: { tenantId: TENANT_ID },
  user: { userId: USER_ID }
} as unknown as AuthenticatedContext;

function verifiedDomainScope() {
  return {
    scopeId: SCOPE_ID,
    scopeType: "Domain",
    tenantId: TENANT_ID,
    value: "example.com",
    verificationStatus: "Verified"
  };
}

function createServices(overrides?: {
  createMission?: ReturnType<typeof vi.fn>;
  createSchedule?: ReturnType<typeof vi.fn>;
  previewPolicyDecision?: ReturnType<typeof vi.fn>;
  scope?: Record<string, unknown> | null;
  startMission?: ReturnType<typeof vi.fn>;
}) {
  const startMission =
    overrides?.startMission ??
    vi.fn(async (_context, _missionId, input: { moduleIds: string[] }) => ({
      jobsQueued: input.moduleIds.length,
      mission: { missionId: MISSION_ID, status: "Queued" },
      runs: input.moduleIds.map((moduleId) => ({ moduleId, status: "Queued" }))
    }));
  const createMission =
    overrides?.createMission ??
    vi.fn(async () => ({ missionId: MISSION_ID, status: "Draft" }));
  const previewPolicyDecision =
    overrides?.previewPolicyDecision ??
    vi.fn(
      async (_context, _scopeId, input: { executionEnvironment: string }) => ({
        executionEnvironment: input.executionEnvironment,
        outcome: "Allowed",
        policyDecisionId: POLICY_ID,
        rationale: "ok"
      })
    );
  const createSchedule =
    overrides?.createSchedule ??
    vi.fn(async () => ({ scheduleId: SCHEDULE_ID }));

  const prisma = {
    scope: {
      findFirst: vi.fn(async () =>
        overrides && "scope" in overrides
          ? overrides.scope
          : verifiedDomainScope()
      )
    }
  };

  const services = createExternalAssessmentServices({
    prisma
  } as unknown as RuntimeServiceDeps);

  Object.assign(services, {
    createMission,
    createSchedule,
    previewPolicyDecision,
    startMission
  });

  return {
    createMission,
    createSchedule,
    previewPolicyDecision,
    services: services as AppServices,
    startMission
  };
}

describe("external assessment service", () => {
  it("compiles internet-facing profile with jobsQueued 0 and honest copy", async () => {
    const { createMission, services, startMission } = createServices();

    const compiled = await services.compileExternalAssessment(ownerContext, {
      profileId: "internet-facing"
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.assessment.jobsQueued).toBe(0);
    expect(compiled.assessment.startsJobs).toBe(false);
    expect(compiled.assessment.productCopy).toBe(
      EXTERNAL_ASSESSMENT_PRODUCT_COPY
    );
    expect(compiled.assessment.tools.map((tool) => tool.toolId)).toEqual([
      "subfinder",
      "httpx",
      "dnsx",
      "nuclei",
      "tlsx"
    ]);
    expect(startMission).not.toHaveBeenCalled();
    expect(createMission).not.toHaveBeenCalled();
  });

  it("starts allowlisted profile by queuing ExternalPoA and ControlPlane jobs only", async () => {
    const { createMission, previewPolicyDecision, services, startMission } =
      createServices();

    const started = await services.startExternalAssessment(ownerContext, {
      consent: true,
      profileId: "internet-facing",
      scopeId: SCOPE_ID
    });

    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.jobsQueued).toBeGreaterThan(0);
    expect(started.runnerTasksQueued).toBe(0);
    expect(started.liveAtomic).toBe(false);
    expect(started.productCopy).toBe(EXTERNAL_ASSESSMENT_PRODUCT_COPY);
    expect(
      started.jobs.every(
        (job) =>
          job.executionEnvironment === "ExternalPoA" ||
          job.executionEnvironment === "ControlPlane"
      )
    ).toBe(true);
    expect(started.jobs.map((job) => job.moduleId).sort()).toEqual(
      [...EXTERNAL_ASSESSMENT_START_JOBS.map((job) => job.moduleId)].sort()
    );
    expect(started.jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          executionEnvironment: "ExternalPoA",
          moduleId: "nuclei.external_exposure_safe"
        })
      ])
    );
    expect(createMission).toHaveBeenCalled();
    expect(startMission).toHaveBeenCalled();
    expect(previewPolicyDecision).toHaveBeenCalled();
    const environments = previewPolicyDecision.mock.calls.map(
      (call) =>
        (call[2] as { executionEnvironment: string }).executionEnvironment
    );
    expect(environments).toEqual(
      expect.arrayContaining(["ExternalPoA", "ControlPlane"])
    );
    expect(environments).not.toContain("InternalRunner");
  });

  it("does not queue when consent is missing, scope is unverified, or profile is denied", async () => {
    const missingConsent = createServices();
    await expect(
      missingConsent.services.startExternalAssessment(ownerContext, {
        profileId: "internet-facing",
        scopeId: SCOPE_ID
      } as never)
    ).rejects.toBeInstanceOf(AppServiceError);
    expect(missingConsent.startMission).not.toHaveBeenCalled();

    const unverified = createServices({
      scope: {
        ...verifiedDomainScope(),
        verificationStatus: "Unverified"
      }
    });
    const unverifiedStart = await unverified.services.startExternalAssessment(
      ownerContext,
      {
        consent: true,
        profileId: "internet-facing",
        scopeId: SCOPE_ID
      }
    );
    expect(unverifiedStart.ok).toBe(false);
    if (!unverifiedStart.ok) {
      expect(unverifiedStart.code).toBe("verified_domain_required");
      expect(unverifiedStart.jobsQueued).toBe(0);
    }
    expect(unverified.startMission).not.toHaveBeenCalled();

    const denied = createServices();
    for (const profileId of ["fuzzing", "dos", "sqlmap", "nikto"]) {
      const started = await denied.services.startExternalAssessment(
        ownerContext,
        {
          consent: true,
          profileId,
          scopeId: SCOPE_ID
        }
      );
      expect(started.ok).toBe(false);
      if (!started.ok) {
        expect(started.jobsQueued).toBe(0);
        expect(started.startsJobs).toBe(false);
      }
    }
    expect(denied.startMission).not.toHaveBeenCalled();
    expect(denied.createMission).not.toHaveBeenCalled();
  });

  it("maps empty tool output to zero Measured findings and redacts secrets", async () => {
    const { services } = createServices();

    const empty = await services.ingestExternalAssessmentResults(ownerContext, {
      moduleId: "nuclei.external_exposure_safe",
      stdout: "",
      toolId: "nuclei"
    });
    expect(empty.findings).toHaveLength(0);
    expect(empty.evidenceBasis).toBe("Measured");

    const redacted = await services.ingestExternalAssessmentResults(
      ownerContext,
      {
        moduleId: "recon.http_probe",
        stdout:
          "https://example.com Authorization: Bearer super-secret-token-value\n",
        toolId: "httpx"
      }
    );
    expect(redacted.findings).toHaveLength(1);
    expect(redacted.findings[0]?.evidenceBasis).toBe("Measured");
    expect(redacted.findings[0]?.excerpt).not.toMatch(
      /super-secret-token-value/
    );
    expect(redacted.findings[0]?.excerpt).toMatch(/\[REDACTED\]/);
  });

  it("attaches a ContinuousValidation schedule without always-on BAS or runner fleet", async () => {
    const { createSchedule, services, startMission } = createServices();

    const attached = await services.attachExternalAssessmentToSchedule(
      ownerContext,
      {
        profileId: "internet-facing",
        scopeId: SCOPE_ID
      }
    );

    expect(attached.ok).toBe(true);
    if (!attached.ok) {
      return;
    }
    expect(attached.schedule.missionType).toBe("ContinuousValidation");
    expect(attached.schedule.alwaysOnBas).toBe(false);
    expect(attached.schedule.jobsQueued).toBe(0);
    expect(attached.persisted?.scheduleId).toBe(SCHEDULE_ID);
    expect(createSchedule).toHaveBeenCalledTimes(1);
    const scheduleInput = createSchedule.mock.calls[0]?.[1] as {
      config?: { moduleIds?: string[] };
      missionType?: string;
    };
    expect(scheduleInput.missionType).toBe("ContinuousValidation");
    expect(scheduleInput.config?.moduleIds).toContain(
      "nuclei.external_exposure_safe"
    );
    expect(startMission).not.toHaveBeenCalled();
  });
});
