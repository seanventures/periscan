import { describe, expect, it } from "vitest";

import {
  buildModelContextBundle,
  pruneContextBundleItems,
  type ModelSessionWithPolicy
} from "./context-broker.js";
import type { GatewayPrisma } from "./audit.js";

interface FakeData {
  assets: Array<Record<string, unknown>>;
  exposures: Array<Record<string, unknown>>;
  attackPaths: Array<Record<string, unknown>>;
  evidence: Array<{ evidenceId: string; sensitivityLevel: string }>;
  scopes?: Array<{
    scopeId: string;
    tenantId: string;
    value: string;
    verificationStatus: string;
  }>;
}

function createPrisma(data: FakeData): GatewayPrisma {
  return {
    asset: {
      async findMany(args?: { where?: { tenantId?: string } }) {
        if (args?.where?.tenantId) {
          return data.assets.filter(
            (asset) => asset.tenantId === args.where?.tenantId
          );
        }
        return data.assets;
      }
    },
    attackPath: {
      async findMany(args?: {
        where?: {
          pathNodes?: { some?: { entityId?: { in?: string[] } } };
          tenantId?: string;
        };
      }) {
        const entityIds = new Set(
          args?.where?.pathNodes?.some?.entityId?.in ?? []
        );
        return data.attackPaths.filter((path) => {
          if (args?.where?.tenantId && path.tenantId !== args.where.tenantId) {
            return false;
          }
          if (entityIds.size === 0) {
            return true;
          }
          return (
            (path.pathNodes as Array<{ entityId: string }> | undefined) ?? []
          ).some((node) => entityIds.has(node.entityId));
        });
      }
    },
    evidenceArtifact: {
      async findMany(args: { where: { evidenceId: { in: string[] } } }) {
        const ids = new Set(args.where.evidenceId.in);
        return data.evidence.filter((row) => ids.has(row.evidenceId));
      }
    },
    exposure: {
      async findMany(args?: {
        where?: { assetId?: { in?: string[] }; tenantId?: string };
      }) {
        const assetIds = new Set(args?.where?.assetId?.in ?? []);
        return data.exposures.filter((exposure) => {
          if (
            args?.where?.tenantId &&
            exposure.tenantId !== args.where.tenantId
          ) {
            return false;
          }
          if (assetIds.size === 0) {
            return true;
          }
          return assetIds.has(exposure.assetId as string);
        });
      }
    },
    scope: {
      async findMany(args?: {
        where?: {
          scopeId?: { in?: string[] };
          tenantId?: string;
          verificationStatus?: string;
        };
      }) {
        const scopeIds = new Set(args?.where?.scopeId?.in ?? []);
        return (data.scopes ?? []).filter((scope) => {
          if (args?.where?.tenantId && scope.tenantId !== args.where.tenantId) {
            return false;
          }
          if (
            args?.where?.verificationStatus &&
            scope.verificationStatus !== args.where.verificationStatus
          ) {
            return false;
          }
          return scopeIds.size === 0 || scopeIds.has(scope.scopeId);
        });
      }
    }
  } as unknown as GatewayPrisma;
}

function createSession(allowSensitiveContext: boolean): ModelSessionWithPolicy {
  return {
    expiresAt: null,
    policyProfile: { allowSensitiveContext }
  } as unknown as ModelSessionWithPolicy;
}

describe("buildModelContextBundle", () => {
  it("returns an honest empty bundle for a tenant with no data", async () => {
    const built = await buildModelContextBundle({
      prisma: createPrisma({
        assets: [],
        attackPaths: [],
        evidence: [],
        exposures: []
      }),
      scopeIds: ["scope-1"],
      session: createSession(false),
      tenantId: "tenant-1"
    });

    expect(built.items).toEqual([]);
    expect(built.sensitivityLevel).toBe("Low");
    expect(built.tokenEstimate).toBe(0);
    expect(built.pruningManifest).toMatchObject({
      applied: false,
      sourceItemCount: 0,
      tokenBudget: 2000
    });
  });

  it("prunes deterministically while preserving the strongest evidence references", () => {
    const items = [
      {
        entityId: "00000000-0000-4000-8000-000000000001",
        entityType: "Asset" as const,
        evidenceIds: [],
        includedReason: "Scoped asset.",
        redactionStatus: "NotRequired" as const
      },
      {
        entityId: "00000000-0000-4000-8000-000000000002",
        entityType: "Exposure" as const,
        evidenceIds: ["00000000-0000-4000-8000-000000000011"],
        includedReason: "Validated exposure.",
        redactionStatus: "Redacted" as const
      },
      {
        entityId: "00000000-0000-4000-8000-000000000003",
        entityType: "AttackPath" as const,
        evidenceIds: [
          "00000000-0000-4000-8000-000000000012",
          "00000000-0000-4000-8000-000000000013"
        ],
        includedReason: "Validated attack path.",
        redactionStatus: "Redacted" as const
      }
    ];

    const first = pruneContextBundleItems({ items, tokenBudget: 80 });
    const replay = pruneContextBundleItems({ items, tokenBudget: 80 });

    expect(first).toEqual(replay);
    expect(first.items.map((item) => item.entityType)).toEqual([
      "Exposure",
      "AttackPath"
    ]);
    expect(first.manifest).toMatchObject({
      applied: true,
      retainedItemCount: 2,
      retainedTokenEstimate: 80,
      sourceItemCount: 3,
      sourceTokenEstimate: 120,
      tokenBudget: 80
    });
    expect(first.manifest.omittedItems).toHaveLength(1);
    expect(first.manifest.omittedItems[0]?.digest).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.manifest.retainedEvidenceIds).toEqual([
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000012",
      "00000000-0000-4000-8000-000000000013"
    ]);
  });

  it("includes in-scope entities with redacted evidence references", async () => {
    const built = await buildModelContextBundle({
      prisma: createPrisma({
        assets: [
          {
            assetId: "a1",
            assetType: "Repository",
            businessCriticality: "High",
            identifiers: { url: "https://github.com/acme/in-scope" },
            tenantId: "tenant-1"
          },
          {
            assetId: "a2",
            assetType: "Repository",
            businessCriticality: "Critical",
            identifiers: { url: "https://github.com/acme/out-of-scope" },
            tenantId: "tenant-1"
          }
        ],
        attackPaths: [
          {
            evidenceIds: ["e1"],
            impactScore: 9,
            name: "Path A",
            pathNodes: [{ entityId: "a1" }],
            pathId: "p1",
            tenantId: "tenant-1",
            validationState: "Validated"
          },
          {
            evidenceIds: ["e1"],
            impactScore: 10,
            name: "Path B",
            pathNodes: [{ entityId: "a2" }],
            pathId: "p2",
            tenantId: "tenant-1",
            validationState: "Validated"
          }
        ],
        evidence: [{ evidenceId: "e1", sensitivityLevel: "Moderate" }],
        exposures: [
          {
            assetId: "a1",
            evidenceIds: ["e1"],
            exposureId: "x1",
            severity: "High",
            tenantId: "tenant-1",
            validationState: "Validated"
          },
          {
            assetId: "a2",
            evidenceIds: ["e1"],
            exposureId: "x2",
            severity: "Critical",
            tenantId: "tenant-1",
            validationState: "Validated"
          }
        ],
        scopes: [
          {
            scopeId: "scope-1",
            tenantId: "tenant-1",
            value: "github.com/acme/in-scope",
            verificationStatus: "Verified"
          }
        ]
      }),
      scopeIds: ["scope-1"],
      session: createSession(false),
      tenantId: "tenant-1"
    });

    const exposureItem = built.items.find((item) => item.entityId === "x1");
    expect(exposureItem?.entityType).toBe("Exposure");
    expect(exposureItem?.redactionStatus).toBe("Redacted");
    expect(exposureItem?.evidenceIds).toEqual(["e1"]);
    expect(built.items.find((item) => item.entityId === "a2")).toBeUndefined();
    expect(built.items.find((item) => item.entityId === "x2")).toBeUndefined();
    expect(built.items.find((item) => item.entityId === "p2")).toBeUndefined();
    expect(built.sensitivityLevel).toBe("Moderate");
    expect(built.tokenEstimate).toBeGreaterThan(0);
  });

  it("blocks evidence whose sensitivity exceeds the policy ceiling", async () => {
    const built = await buildModelContextBundle({
      prisma: createPrisma({
        assets: [
          {
            assetId: "a1",
            identifiers: { domain: "blocked.example.com" },
            name: "blocked.example.com",
            tenantId: "tenant-1"
          }
        ],
        attackPaths: [],
        evidence: [{ evidenceId: "secret", sensitivityLevel: "Restricted" }],
        exposures: [
          {
            assetId: "a1",
            evidenceIds: ["secret"],
            exposureId: "x1",
            severity: "Critical",
            tenantId: "tenant-1",
            validationState: "Validated"
          }
        ],
        scopes: [
          {
            scopeId: "scope-1",
            tenantId: "tenant-1",
            value: "blocked.example.com",
            verificationStatus: "Verified"
          }
        ]
      }),
      scopeIds: ["scope-1"],
      session: createSession(false),
      tenantId: "tenant-1"
    });

    const exposureItem = built.items.find((item) => item.entityId === "x1");
    expect(exposureItem?.redactionStatus).toBe("Blocked");
    expect(exposureItem?.evidenceIds).toEqual([]);
    expect(exposureItem?.includedReason).toContain("Blocked".toLowerCase());
    // Sensitivity is not raised by blocked evidence.
    expect(built.sensitivityLevel).toBe("Low");
  });

  it("admits sensitive evidence when the policy allows sensitive context", async () => {
    const built = await buildModelContextBundle({
      prisma: createPrisma({
        assets: [
          {
            assetId: "a1",
            identifiers: { domain: "sensitive.example.com" },
            name: "sensitive.example.com",
            tenantId: "tenant-1"
          }
        ],
        attackPaths: [],
        evidence: [{ evidenceId: "secret", sensitivityLevel: "Restricted" }],
        exposures: [
          {
            assetId: "a1",
            evidenceIds: ["secret"],
            exposureId: "x1",
            severity: "Critical",
            tenantId: "tenant-1",
            validationState: "Validated"
          }
        ],
        scopes: [
          {
            scopeId: "scope-1",
            tenantId: "tenant-1",
            value: "sensitive.example.com",
            verificationStatus: "Verified"
          }
        ]
      }),
      scopeIds: ["scope-1"],
      session: createSession(true),
      tenantId: "tenant-1"
    });

    const exposureItem = built.items.find((item) => item.entityId === "x1");
    expect(exposureItem?.redactionStatus).toBe("Redacted");
    expect(exposureItem?.evidenceIds).toEqual(["secret"]);
    expect(built.sensitivityLevel).toBe("Restricted");
  });
});
