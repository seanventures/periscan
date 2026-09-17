import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type * as EvidencePackage from "@periscan/evidence";

import {
  type AuthenticatedContext,
  buildVerificationResult,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const retestHooks = vi.hoisted(() => ({
  outcome: "no_secret_exposure_observed" as string | null,
  validationState: "Fixed" as string | null,
  apply: async (_runId: string) => {
    void _runId;
  }
}));

vi.mock("@periscan/worker", () => ({
  PrismaMissionExecutionStore: class {
    constructor() {}
  },
  createMissionExecutionProcessor: () => ({
    process: async (payload: { runId: string }) => {
      await retestHooks.apply(payload.runId);
    }
  })
}));

vi.mock("@periscan/evidence", async (importOriginal) => {
  const actual = await importOriginal<typeof EvidencePackage>();
  return {
    ...actual,
    createPrismaEvidenceService: () => ({
      putEvidenceArtifact: async () => ({
        artifact: { evidenceId: "99999999-9999-4999-8999-999999999999" }
      })
    })
  };
});

import { createRemediationServices } from "./remediation.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const evidenceId = "55555555-5555-4555-8555-555555555555";
const fingerprint =
  "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01";
const verificationArtifactId = "99999999-9999-4999-8999-999999999999";

function ownerContext() {
  return {
    membership: { role: "Owner", tenantId, userId },
    tenant: { tenantId },
    user: { userId }
  } as unknown as AuthenticatedContext;
}

function originatingRetest(input: {
  evidenceIds?: string[];
  outcome: string | null;
  validationState: string | null;
}) {
  return {
    evidenceIds: input.evidenceIds ?? [evidenceId],
    outcome: input.outcome,
    validationState: input.validationState
  };
}

describe("Community Gitleaks pathless verification", () => {
  describe("buildVerificationResult", () => {
    it("sets RemediationTask.status Fixed after a measured no_secret_exposure_observed retest even when relatedPathId is null", () => {
      const verificationResult = buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        originatingModuleRetest: originatingRetest({
          outcome: "no_secret_exposure_observed",
          validationState: "Fixed"
        }),
        previousPath: null
      });

      expect(verificationResult.outcome).toBe("Fixed");
      expect(verificationResult.newState).toBe("Fixed");
    });

    it("sets RemediationTask.status Fixed when the originating retest is a clean Validated observation (PERISCAN-571 / 545)", () => {
      const verificationResult = buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        originatingModuleRetest: originatingRetest({
          outcome: "no_secret_exposure_observed",
          validationState: "Validated"
        }),
        previousPath: null
      });

      expect(verificationResult.outcome).toBe("Fixed");
      expect(verificationResult.newState).toBe("Fixed");
    });

    it("does not mark Fixed when the originating Gitleaks retest still observes a leak", () => {
      const verificationResult = buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        originatingModuleRetest: originatingRetest({
          outcome: "secret_exposure_observed",
          validationState: "Validated"
        }),
        previousPath: null
      });

      expect(verificationResult.outcome).toBe("StillExposed");
      expect(verificationResult.newState).toBe("StillExposed");
    });

    it("does not mark Fixed without originating evidence even if the retest is a clear negative", () => {
      const verificationResult = buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        originatingModuleRetest: originatingRetest({
          evidenceIds: [],
          outcome: "no_secret_exposure_observed",
          validationState: "Fixed"
        }),
        previousPath: null
      });

      expect(verificationResult.outcome).toBe("Inconclusive");
    });

    it("does not mark Fixed when no real retest ran", () => {
      const verificationResult = buildVerificationResult({
        currentDraft: null,
        executedRealRetest: false,
        originatingModuleRetest: originatingRetest({
          outcome: "no_secret_exposure_observed",
          validationState: "Fixed"
        }),
        previousPath: null
      });

      expect(verificationResult.outcome).toBe("Inconclusive");
    });

    it("still requires a Measured path when no originating-module retest is supplied", () => {
      const verificationResult = buildVerificationResult({
        currentDraft: null,
        executedRealRetest: true,
        previousPath: null
      });

      expect(verificationResult.outcome).toBe("Inconclusive");
    });
  });

  describe("verifyRemediation", () => {
    it("persists RemediationTask.status Fixed for an evidence-backed Community Gitleaks finding after a successful measured retest with relatedPathId null", async () => {
      const { services, remediationId } = createVerifyHarness({
        evidenceIds: [evidenceId],
        relatedPathId: null,
        retestOutcome: "no_secret_exposure_observed",
        retestValidationState: "Fixed"
      });

      const result = await services.verifyRemediation!(
        ownerContext(),
        remediationId
      );

      expect(result.remediation.relatedPathId).toBeNull();
      expect(result.remediation.evidenceIds).toEqual(
        expect.arrayContaining([evidenceId, verificationArtifactId])
      );
      expect(result.verificationEvent.measuredRevalidation).toBe(true);
      expect(result.verificationEvent.outcome).toBe("Fixed");
      expect(result.remediation.status).toBe("Fixed");
      expect(result.run.moduleId).toBe("gitleaks.repo_secrets");
      expect(result.run.outcome).toBe("no_secret_exposure_observed");
    });

    it("persists RemediationTask.status Fixed when the measured retest is Validated no_secret_exposure_observed (PERISCAN-571)", async () => {
      const { services, remediationId } = createVerifyHarness({
        evidenceIds: [evidenceId],
        relatedPathId: null,
        retestOutcome: "no_secret_exposure_observed",
        retestValidationState: "Validated"
      });

      const result = await services.verifyRemediation!(
        ownerContext(),
        remediationId
      );

      expect(result.verificationEvent.measuredRevalidation).toBe(true);
      expect(result.verificationEvent.outcome).toBe("Fixed");
      expect(result.remediation.status).toBe("Fixed");
      expect(result.run.outcome).toBe("no_secret_exposure_observed");
    });

    it("does not persist Fixed when the measured Gitleaks retest still observes the leak", async () => {
      const { services, remediationId } = createVerifyHarness({
        evidenceIds: [evidenceId],
        relatedPathId: null,
        retestOutcome: "secret_exposure_observed",
        retestValidationState: "Validated"
      });

      const result = await services.verifyRemediation!(
        ownerContext(),
        remediationId
      );

      expect(result.remediation.relatedPathId).toBeNull();
      expect(result.verificationEvent.measuredRevalidation).toBe(true);
      expect(result.remediation.status).toBe("StillExposed");
      expect(result.run.outcome).toBe("secret_exposure_observed");
    });

    it("stamps Fixed from a clean Validated retest even when lab/devMode is on (PERISCAN-573)", async () => {
      const { prisma, services, remediationId } = createVerifyHarness({
        devMode: true,
        evidenceIds: [evidenceId],
        relatedPathId: null,
        retestOutcome: "no_secret_exposure_observed",
        retestValidationState: "Validated"
      });

      const result = await services.verifyRemediation!(
        ownerContext(),
        remediationId
      );

      const gitleaksTargets = prisma.validationRun.create.mock.calls
        .map(
          (call: [{ data: { moduleId?: string; target?: Record<string, unknown> } }]) =>
            call[0].data
        )
        .filter((data) => data.moduleId === "gitleaks.repo_secrets")
        .map((data) => data.target ?? {});

      expect(gitleaksTargets.length).toBeGreaterThan(0);
      for (const target of gitleaksTargets) {
        expect(target.repositoryPath).toBe("/tmp/ga-proof-loop");
        expect(target.fixtureMode).toBeUndefined();
        expect(target.fixtureReportPath).toBeUndefined();
      }
      expect(result.verificationEvent.measuredRevalidation).toBe(true);
      expect(result.verificationEvent.outcome).toBe("Fixed");
      expect(result.remediation.status).toBe("Fixed");
      expect(result.run.outcome).toBe("no_secret_exposure_observed");
      expect(result.run.validationState).toBe("Validated");
    });
  });
});

function createVerifyHarness(input: {
  devMode?: boolean;
  evidenceIds: string[];
  relatedPathId: string | null;
  retestOutcome: string | null;
  retestValidationState: string | null;
}) {
  const now = new Date("2026-09-02T00:00:00.000Z");
  const remediationId = randomUUID();
  const scopeId = randomUUID();
  const remediations = new Map<string, Record<string, unknown>>();
  const runs = new Map<string, Record<string, unknown>>();
  const jobs = new Map<string, Record<string, unknown>>();
  const missions = new Map<string, Record<string, unknown>>();
  const events = new Map<string, Record<string, unknown>>();

  remediations.set(remediationId, {
    createdAt: now,
    dueAt: null,
    evidenceIds: input.evidenceIds,
    lastVerifiedAt: null,
    nextVerificationAt: null,
    owner: "Security engineering",
    recommendedAction: "Rotate the exposed secret.",
    relatedExposureId: null,
    relatedFindingFingerprint: fingerprint,
    relatedPathId: input.relatedPathId,
    remediationId,
    status: "Open",
    technicalSteps: ["Rotate", "Revoke", "Retest"],
    tenantId,
    ticketId: null,
    ticketSystem: null,
    updatedAt: now,
    verificationMethod: "Rerun gitleaks.repo_secrets.",
    verificationRequired: true
  });

  retestHooks.outcome = input.retestOutcome;
  retestHooks.validationState = input.retestValidationState;
  retestHooks.apply = async (runId: string) => {
    const run = runs.get(runId);
    if (!run) return;
    const target =
      run.target && typeof run.target === "object" && !Array.isArray(run.target)
        ? (run.target as Record<string, unknown>)
        : {};
    // Lab fixture report always contains a canned leak. Honor that so a
    // verify path that retargets onto the fixture cannot fake a clean retest.
    const usesFixture =
      target.fixtureMode === true ||
      typeof target.fixtureReportPath === "string";
    run.completedAt = now;
    run.outcome = usesFixture
      ? "secret_exposure_observed"
      : retestHooks.outcome;
    run.status = "Completed";
    run.updatedAt = now;
    run.validationState = usesFixture ? "Validated" : retestHooks.validationState;
  };

  const prisma = {
    $transaction: async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    attackPath: {
      findFirst: vi.fn(async () => null)
    },
    auditEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ...data,
        createdAt: now
      }))
    },
    evidenceArtifact: {
      findMany: vi.fn(async () => [])
    },
    job: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const job = {
          createdAt: now,
          jobId: randomUUID(),
          updatedAt: now,
          ...data
        };
        jobs.set(job.jobId as string, job);
        return job;
      }),
      update: vi.fn(
        async ({
          data,
          where
        }: {
          data: Record<string, unknown>;
          where: { jobId: string };
        }) => {
          const next = { ...jobs.get(where.jobId), ...data };
          jobs.set(where.jobId, next);
          return next;
        }
      )
    },
    policyDecision: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        approvalState: data.approvalState,
        createdAt: now,
        outcome: data.outcome,
        policyDecisionId: randomUUID(),
        rationale: data.rationale,
        ...data
      }))
    },
    remediationTask: {
      findFirst: vi.fn(async ({ where }: { where: { remediationId: string } }) =>
        remediations.get(where.remediationId) ?? null
      ),
      update: vi.fn(
        async ({
          data,
          where
        }: {
          data: Record<string, unknown>;
          where: { remediationId: string };
        }) => {
          const next = {
            ...remediations.get(where.remediationId),
            ...data,
            updatedAt: now
          };
          remediations.set(where.remediationId, next);
          return next;
        }
      )
    },
    scope: {
      findFirst: vi.fn(async () => ({
        createdAt: now,
        maxSafetyLevel: "BASLite",
        scopeId,
        scopeType: "Repository",
        tenantId,
        value: "/tmp/ga-proof-loop",
        verificationStatus: "Verified"
      }))
    },
    signalEnvelope: {
      findMany: vi.fn(async () => [])
    },
    validationMission: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const mission = {
          completedAt: null,
          createdAt: now,
          missionId: randomUUID(),
          startedAt: now,
          updatedAt: now,
          ...data
        };
        missions.set(mission.missionId as string, mission);
        return mission;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { missionId: string } }) => {
        const mission = missions.get(where.missionId);
        if (!mission) throw new Error("mission missing");
        return mission;
      }),
      update: vi.fn(
        async ({
          data,
          where
        }: {
          data: Record<string, unknown>;
          where: { missionId: string };
        }) => {
          const next = { ...missions.get(where.missionId), ...data };
          missions.set(where.missionId, next);
          return next;
        }
      )
    },
    validationRun: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const run = {
          completedAt: null,
          createdAt: now,
          errorSummary: null,
          runId: randomUUID(),
          startedAt: now,
          techniqueIds: [],
          updatedAt: now,
          ...data
        };
        runs.set(run.runId as string, run);
        return run;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const evidenceFilter = where.evidenceIds as
          | { hasSome?: string[] }
          | undefined;
        if (evidenceFilter?.hasSome) {
          return [{ moduleId: "gitleaks.repo_secrets" }];
        }
        const runFilter = where.runId as { in?: string[] } | undefined;
        if (runFilter?.in) {
          return runFilter.in
            .map((runId) => runs.get(runId))
            .filter((run): run is Record<string, unknown> => Boolean(run));
        }
        return [...runs.values()];
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { runId: string } }) => {
        const run = runs.get(where.runId);
        if (!run) throw new Error("run missing");
        return run;
      }),
      update: vi.fn(
        async ({
          data,
          where
        }: {
          data: Record<string, unknown>;
          where: { runId: string };
        }) => {
          const next = { ...runs.get(where.runId), ...data, updatedAt: now };
          runs.set(where.runId, next);
          return next;
        }
      )
    },
    verificationEvent: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const event = {
          createdAt: now,
          updatedAt: now,
          verificationId: randomUUID(),
          ...data
        };
        events.set(event.verificationId as string, event);
        return event;
      })
    }
  };

  const services = createRemediationServices({
    devMode: input.devMode ?? false,
    emitTenantWebhook: vi.fn(async () => undefined),
    missionQueue: {
      enqueueValidationJob: vi.fn(async () => undefined)
    },
    prisma
  } as unknown as RuntimeServiceDeps);

  return { prisma, remediationId, services };
}
