import { describe, expect, it, vi } from "vitest";

import type {
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";
import {
  createFindingsServices,
  filterFindingsByMissionEvidence,
  loadTenantMissionEvidenceIds
} from "./findings.js";

describe("filterFindingsByMissionEvidence", () => {
  const missionEvidence = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherEvidence = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const extraEvidence = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("returns no findings when the mission has no evidence yet", () => {
    const findings = [
      { evidenceIds: [missionEvidence], findingId: "in-scope" },
      { evidenceIds: [otherEvidence], findingId: "other" }
    ];

    expect(filterFindingsByMissionEvidence(findings, [])).toEqual([]);
  });

  it("keeps a finding only when it shares evidence with the mission runs", () => {
    const inScope = {
      evidenceIds: [otherEvidence, missionEvidence],
      findingId: "in-scope"
    };
    const disjoint = {
      evidenceIds: [otherEvidence],
      findingId: "disjoint"
    };
    const empty = { evidenceIds: [], findingId: "empty" };

    expect(
      filterFindingsByMissionEvidence(
        [inScope, disjoint, empty],
        [missionEvidence, extraEvidence]
      )
    ).toEqual([inScope]);
  });
});

describe("loadTenantMissionEvidenceIds", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const missionId = "22222222-2222-4222-8222-222222222222";

  it("unions tenant-scoped validation-run evidence ids", async () => {
    const findMany = async (args: {
      select?: { evidenceIds?: boolean };
      where?: { missionId?: string; tenantId?: string };
    }) => {
      expect(args.where).toEqual({ missionId, tenantId });
      expect(args.select).toEqual({ evidenceIds: true });
      return [
        { evidenceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
        {
          evidenceIds: [
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
          ]
        }
      ];
    };

    await expect(
      loadTenantMissionEvidenceIds(
        { validationRun: { findMany } },
        { missionId, tenantId }
      )
    ).resolves.toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ]);
  });

  it("returns an empty list when the mission has no run evidence", async () => {
    await expect(
      loadTenantMissionEvidenceIds(
        {
          validationRun: {
            findMany: async () => [{ evidenceIds: [] }, { evidenceIds: [] }]
          }
        },
        { missionId, tenantId }
      )
    ).resolves.toEqual([]);
  });
});

describe("listValidatedFindings mission evidence intersection", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const missionId = "22222222-2222-4222-8222-222222222222";
  const missionEvidence = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherEvidence = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const inScopeId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const disjointId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const emptyId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  const inScopeAsset = "12121212-1212-4121-8121-121212121212";
  const disjointAsset = "13131313-1313-4131-8131-131313131313";
  const emptyAsset = "14141414-1414-4141-8141-141414141414";

  const context = {
    membership: { role: "Owner", tenantId },
    tenant: { tenantId },
    user: { userId: "33333333-3333-4333-8333-333333333333" }
  } as unknown as AuthenticatedContext;

  const now = new Date("2026-08-15T12:00:00.000Z");

  function secretSignal(input: {
    evidenceIds: string[];
    relatedAssetId: string;
    signalId: string;
    sourceVendor: string;
  }) {
    return {
      confidence: 0.9,
      createdAt: now,
      evidenceIds: input.evidenceIds,
      freshness: "Fresh",
      rawPayloadPointer: null,
      redactionStatus: "Redacted" as const,
      relatedAssetIds: [input.relatedAssetId],
      relatedControlIds: [] as string[],
      relatedEvidenceIds: [] as string[],
      relatedIdentityIds: [] as string[],
      relatedPathIds: [] as string[],
      sensitivityLevel: "Moderate" as const,
      signalCategory: "Repository" as const,
      signalId: input.signalId,
      signalSubcategory: "SecretScanCandidate",
      sourceIntegrationId: null,
      sourceType: "connector.sync",
      sourceVendor: input.sourceVendor,
      tenantId,
      techniqueIds: [] as string[],
      timestampIngested: now,
      timestampObserved: now,
      updatedAt: now
    };
  }

  const signals = [
    secretSignal({
      evidenceIds: [otherEvidence, missionEvidence],
      relatedAssetId: inScopeAsset,
      signalId: inScopeId,
      sourceVendor: "InScopeVendor"
    }),
    secretSignal({
      evidenceIds: [otherEvidence],
      relatedAssetId: disjointAsset,
      signalId: disjointId,
      sourceVendor: "DisjointVendor"
    }),
    secretSignal({
      evidenceIds: [],
      relatedAssetId: emptyAsset,
      signalId: emptyId,
      sourceVendor: "EmptyVendor"
    })
  ];

  function buildServices(missionRuns: Array<{ evidenceIds: string[] }>) {
    return createFindingsServices({
      emitTenantWebhook: vi.fn(),
      prisma: {
        attackPath: { findMany: vi.fn(async () => []) },
        evidencePack: { findMany: vi.fn(async () => []) },
        findingDisposition: { findMany: vi.fn(async () => []) },
        missionSchedule: { findMany: vi.fn(async () => []) },
        missingSignal: { findMany: vi.fn(async () => []) },
        remediationTask: { findMany: vi.fn(async () => []) },
        signalEnvelope: { findMany: vi.fn(async () => signals) },
        validationRun: {
          findMany: vi.fn(
            async (args: {
              where?: { missionId?: string; tenantId?: string };
            }) => {
              if (
                args.where?.missionId === missionId &&
                args.where?.tenantId === tenantId
              ) {
                return missionRuns;
              }
              return [{ evidenceIds: [otherEvidence] }];
            }
          )
        }
      }
    } as unknown as RuntimeServiceDeps);
  }

  it("excludes findings whose evidenceIds do not intersect mission evidence", async () => {
    const services = buildServices([{ evidenceIds: [missionEvidence] }]);

    const unfiltered = await services.listValidatedFindings(context);
    expect(unfiltered.map((finding) => finding.findingId).sort()).toEqual(
      [disjointId, emptyId, inScopeId].sort()
    );

    const scoped = await services.listValidatedFindings(context, { missionId });
    expect(scoped.map((finding) => finding.findingId)).toEqual([inScopeId]);
    expect(scoped[0]?.evidenceIds).toEqual(
      expect.arrayContaining([missionEvidence])
    );
  });

  it("returns no findings when the mission has no evidence", async () => {
    const services = buildServices([{ evidenceIds: [] }, { evidenceIds: [] }]);

    const unfiltered = await services.listValidatedFindings(context);
    expect(unfiltered).toHaveLength(3);

    await expect(
      services.listValidatedFindings(context, { missionId })
    ).resolves.toEqual([]);
  });
});
