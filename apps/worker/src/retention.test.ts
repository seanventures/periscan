import type { EvidenceService } from "@periscan/evidence";
import { describe, expect, it, vi } from "vitest";

import {
  getObjectStorageRetentionDays,
  runEvidenceRetentionPurge
} from "./retention.js";

function stubEvidenceService(): EvidenceService {
  return {
    createEvidenceMetadata: vi.fn(),
    getEvidenceArtifact: vi.fn(),
    linkEvidenceToEntity: vi.fn(),
    purgeExpiredEvidence: vi.fn(async () => ({
      evidenceIds: ["evidence-1"],
      purgedByTenant: { "tenant-1": 1 },
      purgedCount: 1
    })),
    putEvidenceArtifact: vi.fn()
  } as unknown as EvidenceService;
}

describe("evidence retention purge", () => {
  it("parses a positive retention window and rejects invalid values", () => {
    expect(
      getObjectStorageRetentionDays({
        PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "365"
      })
    ).toBe(365);
    expect(
      getObjectStorageRetentionDays({
        PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "0"
      })
    ).toBeNull();
    expect(getObjectStorageRetentionDays({})).toBeNull();
  });

  it("skips purging when retention is platform-managed", async () => {
    const evidenceService = stubEvidenceService();

    const result = await runEvidenceRetentionPurge({
      env: {},
      evidenceService
    });

    expect(result.skipped).toBe(true);
    expect(evidenceService.purgeExpiredEvidence).not.toHaveBeenCalled();
  });

  it("purges evidence older than the configured retention cutoff", async () => {
    const evidenceService = stubEvidenceService();
    const now = new Date("2026-06-06T00:00:00.000Z");

    const result = await runEvidenceRetentionPurge({
      env: {
        PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "30"
      },
      evidenceService,
      now,
      recordAudit: vi.fn()
    });

    expect(result.skipped).toBe(false);
    expect(result.purgedCount).toBe(1);
    expect(evidenceService.purgeExpiredEvidence).toHaveBeenCalledWith({
      limit: undefined,
      olderThan: new Date("2026-05-07T00:00:00.000Z")
    });
  });

  it("emits an auditable purge record when evidence is deleted", async () => {
    const evidenceService = stubEvidenceService();
    const recordPurge = vi.fn();

    await runEvidenceRetentionPurge({
      env: { PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "30" },
      evidenceService,
      now: new Date("2026-06-06T00:00:00.000Z"),
      recordAudit: vi.fn(),
      recordPurge
    });

    expect(recordPurge).toHaveBeenCalledTimes(1);
    expect(recordPurge).toHaveBeenCalledWith({
      evidenceIds: ["evidence-1"],
      olderThan: "2026-05-07T00:00:00.000Z",
      purgedByTenant: { "tenant-1": 1 },
      purgedCount: 1,
      retentionDays: 30
    });
  });

  it("writes one first-class audit record per affected tenant", async () => {
    const recordAudit = vi.fn();

    await runEvidenceRetentionPurge({
      env: { PERISCAN_OBJECT_STORAGE_RETENTION_DAYS: "30" },
      evidenceService: stubEvidenceService(),
      now: new Date("2026-06-06T00:00:00.000Z"),
      recordAudit
    });

    // Per-tenant attribution (from purgedByTenant) becomes one queryable
    // AuditEvent per tenant, carrying the count + retention window.
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit).toHaveBeenCalledWith([
      {
        olderThan: "2026-05-07T00:00:00.000Z",
        purgedCount: 1,
        retentionDays: 30,
        tenantId: "tenant-1"
      }
    ]);
  });

  it("does not record a purge when retention is platform-managed (nothing deleted)", async () => {
    const recordPurge = vi.fn();
    const recordAudit = vi.fn();

    await runEvidenceRetentionPurge({
      env: {},
      evidenceService: stubEvidenceService(),
      recordAudit,
      recordPurge
    });

    expect(recordPurge).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });
});
