import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { CreateRemediationInputSchema } from "@periscan/shared";

import type {
  AppServiceError,
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";
import { createRemediationServices } from "./remediation.js";
import { createValidationServices } from "./validation.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const missionId = "33333333-3333-4333-8333-333333333333";
const pathId = "44444444-4444-4444-8444-444444444444";
const evidenceId = "55555555-5555-4555-8555-555555555555";
const fingerprint =
  "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01";

function ownerContext() {
  return {
    membership: { role: "Owner", tenantId, userId },
    tenant: { tenantId },
    user: { userId }
  } as unknown as AuthenticatedContext;
}

function createdTask(data: Record<string, unknown>) {
  const now = new Date("2026-08-30T00:00:00.000Z");
  return {
    createdAt: now,
    lastVerifiedAt: null,
    nextVerificationAt: null,
    remediationId: randomUUID(),
    ticketId: null,
    ticketSystem: null,
    updatedAt: now,
    ...data
  };
}

function remediationPrisma(options?: { rejectMissingPathFk?: boolean }) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (options?.rejectMissingPathFk && data.relatedPathId) {
      const error = new Error(
        "Foreign key constraint violated on the constraint: `remediation_tasks_related_path_id_fkey`"
      ) as Error & { code: string };
      error.code = "P2003";
      throw error;
    }
    return createdTask(data);
  });
  return {
    create,
    prisma: {
      attackPath: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => [])
      },
      auditEvent: { create: vi.fn(async () => ({})) },
      remediationTask: {
        create,
        findFirst: vi.fn(async () => null)
      },
      signalEnvelope: { findMany: vi.fn(async () => []) },
      tenant: { findUnique: vi.fn(async () => null) },
      validationMission: {
        findFirst: vi.fn(async () => ({ missionId, tenantId }))
      }
    }
  };
}

function createRemediationService(prisma: object) {
  return createRemediationServices({
    emitTenantWebhook: vi.fn(async () => undefined),
    prisma
  } as unknown as RuntimeServiceDeps);
}

function validationPrisma(existingPaths: Array<{ pathId: string }> = []) {
  return {
    attackPath: {
      findFirst: vi.fn(async () => existingPaths[0] ?? null),
      findMany: vi.fn(async () => existingPaths)
    },
    validationMission: {
      findFirst: vi.fn(async () => ({ missionId, tenantId }))
    }
  };
}

describe("CreateRemediationInputSchema evidenceIds", () => {
  it("accepts evidenceIds with findingFingerprint so verify can retest original modules", () => {
    const parsed = CreateRemediationInputSchema.parse({
      evidenceIds: [evidenceId],
      findingFingerprint: fingerprint
    });
    expect(parsed.evidenceIds).toEqual([evidenceId]);
    expect(parsed.findingFingerprint).toBe(fingerprint);
    expect(parsed.pathId).toBeUndefined();
  });

  it("accepts evidenceIds together with pathId", () => {
    const parsed = CreateRemediationInputSchema.parse({
      evidenceIds: [evidenceId],
      findingFingerprint: fingerprint,
      pathId
    });
    expect(parsed.evidenceIds).toEqual([evidenceId]);
    expect(parsed.pathId).toBe(pathId);
  });
});

describe("createCommunityMissionRemediations", () => {
  it("passes findingFingerprint, relatedPathIds[0], and evidenceIds into createRemediation", async () => {
    const createRemediation = vi.fn(async () =>
      createdTask({ relatedFindingFingerprint: fingerprint })
    );
    const listValidatedFindings = vi.fn(async () => [
      {
        evidenceIds: [evidenceId],
        fingerprint,
        relatedPathIds: [pathId]
      }
    ]);
    const services = createValidationServices({
      prisma: validationPrisma([{ pathId }])
    } as never);
    Object.assign(services, { createRemediation, listValidatedFindings });

    const result = await services.createCommunityMissionRemediations(
      ownerContext(),
      missionId
    );

    expect(listValidatedFindings).toHaveBeenCalledWith(ownerContext(), {
      limit: 100,
      missionId
    });
    expect(createRemediation).toHaveBeenCalledWith(ownerContext(), {
      evidenceIds: [evidenceId],
      findingFingerprint: fingerprint,
      pathId
    });
    expect(result.createdCount).toBe(1);
    expect(result.missionId).toBe(missionId);
    expect(result.remediationIds).toHaveLength(1);
  });

  it("omits pathId when the finding has no relatedPathIds", async () => {
    const createRemediation = vi.fn(async () =>
      createdTask({ relatedFindingFingerprint: fingerprint })
    );
    const services = createValidationServices({
      prisma: validationPrisma()
    } as never);
    Object.assign(services, {
      createRemediation,
      listValidatedFindings: vi.fn(async () => [
        {
          evidenceIds: [evidenceId],
          fingerprint,
          relatedPathIds: []
        }
      ])
    });

    await services.createCommunityMissionRemediations(ownerContext(), missionId);

    expect(createRemediation).toHaveBeenCalledWith(ownerContext(), {
      evidenceIds: [evidenceId],
      findingFingerprint: fingerprint
    });
    expect(createRemediation.mock.calls[0]?.[1]).not.toHaveProperty("pathId");
  });

  it("skips findings without a fingerprint", async () => {
    const createRemediation = vi.fn();
    const services = createValidationServices({
      prisma: validationPrisma([{ pathId }])
    } as never);
    Object.assign(services, {
      createRemediation,
      listValidatedFindings: vi.fn(async () => [
        { evidenceIds: [evidenceId], relatedPathIds: [pathId] }
      ])
    });

    const result = await services.createCommunityMissionRemediations(
      ownerContext(),
      missionId
    );

    expect(createRemediation).not.toHaveBeenCalled();
    expect(result.createdCount).toBe(0);
    expect(result.remediationIds).toEqual([]);
  });

  it("does not 500 for a pathless Gitleaks finding whose relatedPathIds UUID has no AttackPath row", async () => {
    const gitleaksSyntheticPathId = "c0ffeeee-0000-5aaa-8bbb-00000000abcd";
    const { create, prisma } = remediationPrisma({
      rejectMissingPathFk: true
    });
    const services = Object.assign(
      createValidationServices({ prisma } as never),
      createRemediationService(prisma),
      {
        listValidatedFindings: vi.fn(async () => [
          {
            evidenceIds: [evidenceId],
            fingerprint,
            relatedPathIds: [gitleaksSyntheticPathId]
          }
        ])
      }
    );

    const result = await services.createCommunityMissionRemediations(
      ownerContext(),
      missionId
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evidenceIds: [evidenceId],
        relatedFindingFingerprint: fingerprint,
        relatedPathId: null,
        status: "Open"
      })
    });
    expect(create.mock.calls[0]?.[0]?.data).not.toEqual(
      expect.objectContaining({ relatedPathId: gitleaksSyntheticPathId })
    );
    expect(result.createdCount).toBe(1);
    expect(result.missionId).toBe(missionId);
    expect(result.remediationIds).toHaveLength(1);
  });
});

describe("createRemediation fingerprint vs path-linked evidence", () => {
  it("persists evidenceIds on fingerprint-only create so verify can look up original modules", async () => {
    const { create, prisma } = remediationPrisma();
    const services = createRemediationService(prisma);

    const remediation = await services.createRemediation!(ownerContext(), {
      evidenceIds: [evidenceId],
      findingFingerprint: fingerprint
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evidenceIds: [evidenceId],
        relatedFindingFingerprint: fingerprint,
        relatedPathId: null
      })
    });
    expect(remediation.evidenceIds).toEqual([evidenceId]);
    expect(remediation.relatedPathId).toBeNull();
  });

  it("stores relatedPathId and evidenceIds when pathId is set but no correlated path exists", async () => {
    const { create, prisma } = remediationPrisma();
    const services = createRemediationService(prisma);

    const remediation = await services.createRemediation!(ownerContext(), {
      evidenceIds: [evidenceId],
      findingFingerprint: fingerprint,
      pathId
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        evidenceIds: [evidenceId],
        relatedFindingFingerprint: fingerprint,
        relatedPathId: pathId
      })
    });
    expect(remediation.evidenceIds).toEqual([evidenceId]);
    expect(remediation.relatedPathId).toBe(pathId);
    expect(remediation.recommendedAction).toContain("Own and remediate");
  });

  it("still 404s when pathId is unknown and no fingerprint is provided", async () => {
    const { create, prisma } = remediationPrisma();
    const services = createRemediationService(prisma);

    await expect(
      services.createRemediation!(ownerContext(), { pathId })
    ).rejects.toMatchObject({
      code: "attack_path_not_found",
      statusCode: 404
    } satisfies Partial<AppServiceError>);
    expect(create).not.toHaveBeenCalled();
  });
});
