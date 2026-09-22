import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { EvidencePackType } from "@prisma/client";
import { createPublicDemoValidationSnapshot } from "@periscan/shared";

import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import { createTenantServices } from "./tenant.js";

describe("CTEM program non-snap scheduled packs", () => {
  const tenantId = randomUUID();
  const context = {
    membership: {
      membershipId: randomUUID(),
      role: "Owner" as const,
      tenantId,
      userId: randomUUID()
    },
    tenant: { tenantId },
    user: { userId: randomUUID() }
  };

  function buildServices(
    nonSnapPacks: Array<{
      evidenceIds: string[];
      packType: EvidencePackType;
      updatedAt: Date;
    }>
  ) {
    const prisma = {
      evidencePack: {
        findMany: vi.fn(async () => nonSnapPacks)
      }
    };

    return createTenantServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      prisma,
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);
  }

  it("adds scheduled Control and Fix packs to Snapshot Validate/Verify", async () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const validateIds = [randomUUID(), randomUUID(), randomUUID()];
    const verifyIds = [randomUUID(), randomUUID()];
    const tenant = buildServices([
      {
        evidenceIds: validateIds,
        packType: EvidencePackType.ControlValidationReport,
        updatedAt: new Date("2026-09-01T00:00:00.000Z")
      },
      {
        evidenceIds: [randomUUID(), randomUUID()],
        packType: EvidencePackType.AIAppValidationReport,
        updatedAt: new Date("2026-09-02T00:00:00.000Z")
      },
      {
        evidenceIds: verifyIds,
        packType: EvidencePackType.FixVerificationReport,
        updatedAt: new Date("2026-09-03T00:00:00.000Z")
      }
    ]);

    const summary = await tenant.getCTEMProgramSummary.call(
      {
        listSnapshots: async () => [snapshot]
      } as Pick<AppServices, "listSnapshots"> as AppServices,
      context as never
    );

    const validate = summary.stages.find((stage) => stage.stage === "Validate");
    const verify = summary.stages.find((stage) => stage.stage === "Verify");

    expect(summary.source).toBe("Snapshot");
    expect(summary.snapshotId).toBe(snapshot.snapshotId);
    expect(summary.nonSnapValidateEvidence).toBe(5);
    expect(summary.nonSnapVerifyEvidence).toBe(2);
    expect(validate?.evidenceCount).toBe(
      snapshot.metrics.controlObservationCount +
        snapshot.metrics.aiRiskCount +
        5
    );
    expect(verify?.evidenceCount).toBe(snapshot.verificationPlan.length + 2);
  });

  it("keeps Snapshot provenance without non-snap fields when no scheduled packs exist", async () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const tenant = buildServices([]);
    const snapshotOnly = await tenant.getCTEMProgramSummary.call(
      {
        listSnapshots: async () => [snapshot]
      } as Pick<AppServices, "listSnapshots"> as AppServices,
      context as never
    );

    expect(snapshotOnly.source).toBe("Snapshot");
    expect(snapshotOnly.nonSnapValidateEvidence).toBeUndefined();
    expect(snapshotOnly.nonSnapVerifyEvidence).toBeUndefined();
    expect(
      snapshotOnly.stages.find((stage) => stage.stage === "Validate")
        ?.evidenceCount
    ).toBe(
      snapshot.metrics.controlObservationCount + snapshot.metrics.aiRiskCount
    );
    expect(
      snapshotOnly.stages.find((stage) => stage.stage === "Verify")
        ?.evidenceCount
    ).toBe(snapshot.verificationPlan.length);
  });
});
