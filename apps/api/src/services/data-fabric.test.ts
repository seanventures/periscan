import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";
import { createDataFabricServices } from "./data-fabric.js";

const tenantId = "11111111-1111-4111-8111-111111111111";

function asset(input: {
  assetId: string;
  hostname?: string;
  internetExposed: boolean;
  name: string;
}) {
  return {
    assetId: input.assetId,
    assetType: "Service" as const,
    businessCriticality: "Moderate" as const,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    environment: "production",
    firstSeenAt: new Date("2026-07-12T00:00:00.000Z"),
    identifiers: input.hostname ? { publicDnsName: input.hostname } : {},
    internetExposed: input.internetExposed,
    lastSeenAt: new Date("2026-07-14T00:00:00.000Z"),
    name: input.name,
    owner: null,
    status: "Active" as const,
    tags: [],
    tenantId,
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
    valuation: null
  };
}

describe("data fabric ownership confidence", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("attributes only exact or descendant hostnames of verified domain scope", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const assetFindMany = vi.fn().mockResolvedValue([
      asset({
        assetId: "22222222-2222-4222-8222-222222222222",
        hostname: "api.example.com",
        internetExposed: true,
        name: "Public API"
      }),
      asset({
        assetId: "33333333-3333-4333-8333-333333333333",
        hostname: "login-other.test",
        internetExposed: true,
        name: "Unreviewed login"
      }),
      asset({
        assetId: "44444444-4444-4444-8444-444444444444",
        internetExposed: false,
        name: "internal service"
      })
    ]);
    const scopeFindMany = vi.fn().mockResolvedValue([
      {
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        scopeId: "55555555-5555-4555-8555-555555555555",
        value: "example.com"
      }
    ]);
    const observationFindMany = vi.fn().mockResolvedValue([
      {
        assetId: "22222222-2222-4222-8222-222222222222",
        evidenceId: "66666666-6666-4666-8666-666666666666",
        integrationId: "77777777-7777-4777-8777-777777777777",
        observedAt: new Date("2026-07-14T00:00:00.000Z")
      }
    ]);
    const services = createDataFabricServices({
      prisma: {
        asset: { findMany: assetFindMany },
        assetOwnershipReview: { findMany: vi.fn().mockResolvedValue([]) },
        assetSourceObservation: { findMany: observationFindMany },
        scope: { findMany: scopeFindMany }
      }
    } as unknown as RuntimeServiceDeps);

    const surface = await services.getAssetOwnershipSurface({
      tenant: { tenantId }
    } as AuthenticatedContext);

    expect(surface.entries).toHaveLength(2);
    expect(surface.entries[0]).toMatchObject({
      confidence: 0.92,
      evidenceIds: ["66666666-6666-4666-8666-666666666666"],
      hostnames: ["api.example.com"],
      lifecycle: "New",
      matchedScopeValue: "example.com",
      ownershipStatus: "InheritedDomain",
      sourceCount: 1
    });
    expect(surface.entries[1]).toMatchObject({
      confidence: 0,
      matchedScopeId: null,
      ownershipStatus: "UnattributedCandidate"
    });
    expect(surface.summary).toEqual({
      attributedAssetCount: 1,
      averageAttributedConfidence: 0.92,
      internetFacingAssetCount: 2,
      unattributedCandidateCount: 1,
      verifiedRootCount: 1
    });
    expect(scopeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ verificationStatus: "Verified" })
      })
    );
  });

  it("qualifies only fresh healthy sources that produced normalized evidence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const services = createDataFabricServices({
      prisma: {
        assetSourceObservation: {
          groupBy: vi.fn().mockResolvedValue([
            {
              _count: { _all: 3 },
              _max: { observedAt: new Date("2026-07-15T11:00:00.000Z") },
              integrationId: "22222222-2222-4222-8222-222222222222"
            }
          ])
        },
        integration: {
          findMany: vi.fn().mockResolvedValue([
            {
              healthStatus: "Healthy",
              integrationId: "22222222-2222-4222-8222-222222222222",
              lastSyncAt: new Date("2026-07-15T11:00:00.000Z"),
              product: "Falcon",
              status: "Connected",
              syncFrequency: "Daily",
              vendor: "CrowdStrike"
            },
            {
              healthStatus: "Healthy",
              integrationId: "33333333-3333-4333-8333-333333333333",
              lastSyncAt: new Date("2026-07-12T00:00:00.000Z"),
              product: "Cloud",
              status: "Connected",
              syncFrequency: "Daily",
              vendor: "Wiz"
            }
          ])
        },
        signalEnvelope: { groupBy: vi.fn().mockResolvedValue([]) }
      }
    } as unknown as RuntimeServiceDeps);

    const surface = await services.getDataFabricQualitySurface({
      tenant: { tenantId }
    } as AuthenticatedContext);

    expect(surface.summary).toEqual({
      degraded: 0,
      disconnected: 0,
      pendingFirstSync: 0,
      qualified: 1,
      stale: 1,
      total: 2
    });
    expect(surface.entries[0]).toMatchObject({
      ageHours: 1,
      assetObservationCount: 3,
      label: "CrowdStrike Falcon",
      state: "Qualified"
    });
    expect(surface.entries[1]).toMatchObject({
      label: "Wiz Cloud",
      state: "Stale"
    });
    expect(surface.scanFileImport).toMatchObject({
      libraryAvailable: true,
      productPath: "ApiAvailable",
      status: "Partial",
      evidenceBasis: "Imported",
      uiUpload: true,
      formats: ["nessus", "csv", "sarif"]
    });
  });

  it("records a tenant-scoped candidate review without promoting scope", async () => {
    const candidate = asset({
      assetId: "22222222-2222-4222-8222-222222222222",
      hostname: "login-other.test",
      internetExposed: true,
      name: "Unreviewed login"
    });
    const reviewedAt = new Date("2026-07-15T12:00:00.000Z");
    const upsert = vi.fn().mockResolvedValue({
      assetId: candidate.assetId,
      assetOwnershipReviewId: "33333333-3333-4333-8333-333333333333",
      createdAt: reviewedAt,
      disposition: "NeedsVerification",
      note: "Confirm with the acquisition security owner.",
      reviewedAt,
      reviewedBy: "44444444-4444-4444-8444-444444444444",
      tenantId,
      updatedAt: reviewedAt
    });
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = {
      assetOwnershipReview: { upsert },
      auditEvent: { create: auditCreate }
    };
    const services = createDataFabricServices({
      prisma: {
        $transaction: vi.fn(async (callback) => callback(tx)),
        asset: { findFirst: vi.fn().mockResolvedValue(candidate) },
        scope: { findMany: vi.fn().mockResolvedValue([]) }
      }
    } as unknown as RuntimeServiceDeps);

    const review = await services.reviewAssetOwnershipCandidate(
      {
        membership: { role: "SecurityEngineer" },
        tenant: { tenantId },
        user: { userId: "44444444-4444-4444-8444-444444444444" }
      } as AuthenticatedContext,
      candidate.assetId,
      {
        disposition: "NeedsVerification",
        note: "Confirm with the acquisition security owner."
      }
    );

    expect(review).toMatchObject({
      assetId: candidate.assetId,
      disposition: "NeedsVerification",
      note: "Confirm with the acquisition security owner."
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          assetId: candidate.assetId,
          tenantId
        })
      })
    );
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "asset_ownership_reviewed",
        metadata: expect.objectContaining({
          assetId: candidate.assetId,
          ownershipPromoted: false
        })
      })
    });
  });
});

describe("data fabric scan import", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("imports CSV scan rows as Imported signals without claiming Measured", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const auditCreate = vi.fn().mockResolvedValue({});
    const services = createDataFabricServices({
      prisma: {
        auditEvent: { create: auditCreate },
        signalEnvelope: { createMany }
      }
    } as unknown as RuntimeServiceDeps);

    const context = {
      membership: { role: "SecurityEngineer" },
      tenant: { tenantId },
      user: { userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
    } as unknown as AuthenticatedContext;

    const result = await services.importScanFile(context, {
      content: "Host,Severity,Name,CVE\nweb-01,High,Outdated OpenSSL,CVE-2022-0778\n",
      format: "csv",
      label: "unit-test-export.csv"
    });

    expect(result.evidenceBasis).toBe("Imported");
    expect(result.signalCount).toBe(1);
    expect(result.findingCount).toBe(1);
    expect(result.disclaimer).toMatch(/Imported/i);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            signalSubcategory: "ImportedScanFinding",
            sourceType: "import.csv",
            tenantId
          })
        ])
      })
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "evidence_created",
          metadata: expect.objectContaining({
            evidenceBasis: "Imported",
            format: "csv",
            kind: "data_fabric.scan_imported"
          })
        })
      })
    );
  });
});
