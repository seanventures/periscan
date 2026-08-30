import { describe, expect, it } from "vitest";

import {
  executeReadOnlyGatewayTool,
  type GatewayToolExecutionDeps
} from "./tool-execution.js";

function createDeps(): GatewayToolExecutionDeps {
  return {
    buildOperatorContext: async () =>
      ({
        attackPaths: [],
        controls: [],
        evidence: [],
        exposures: [],
        missingSignals: [],
        remediations: [],
        tenantId: "tenant-1"
      }) as never,
    createError: (message, statusCode, code) =>
      Object.assign(new Error(message), { code, statusCode }),
    ensureCorrelatedAttackPaths: async () => [],
    serializeEvidenceArtifact: (record) => record as never
  };
}

function createPrisma() {
  const assets = [
    {
      assetId: "asset-in",
      assetType: "Repository",
      businessCriticality: "High",
      identifiers: { url: "https://github.com/acme/in-scope" },
      internetExposed: false,
      name: "in-scope",
      status: "Active",
      tags: [],
      tenantId: "tenant-1"
    },
    {
      assetId: "asset-out",
      assetType: "Repository",
      businessCriticality: "Critical",
      identifiers: { url: "https://github.com/acme/out-of-scope" },
      internetExposed: false,
      name: "out-of-scope",
      status: "Active",
      tags: [],
      tenantId: "tenant-1"
    }
  ];
  const exposures = [
    {
      assetId: "asset-in",
      evidenceIds: ["ev-in"],
      exposureId: "exposure-in",
      exposureType: "SecretExposure",
      severity: "High",
      status: "Open",
      tenantId: "tenant-1",
      validationState: "Validated"
    },
    {
      assetId: "asset-out",
      evidenceIds: ["ev-out"],
      exposureId: "exposure-out",
      exposureType: "SecretExposure",
      severity: "Critical",
      status: "Open",
      tenantId: "tenant-1",
      validationState: "Validated"
    }
  ];
  const attackPaths = [
    {
      confidence: 0.9,
      evidenceIds: ["ev-in"],
      impactScore: 8,
      name: "Scoped path",
      pathId: "path-in",
      pathNodes: [{ entityId: "asset-in" }],
      tenantId: "tenant-1",
      validationState: "Validated"
    },
    {
      confidence: 0.95,
      evidenceIds: ["ev-out"],
      impactScore: 10,
      name: "Out-of-scope path",
      pathId: "path-out",
      pathNodes: [{ entityId: "asset-out" }],
      tenantId: "tenant-1",
      validationState: "Validated"
    }
  ];

  return {
    asset: {
      async findMany(args?: { where?: { tenantId?: string } }) {
        return assets.filter(
          (asset) => asset.tenantId === args?.where?.tenantId
        );
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
        return attackPaths.filter((path) => {
          if (path.tenantId !== args?.where?.tenantId) {
            return false;
          }
          return path.pathNodes.some((node) => entityIds.has(node.entityId));
        });
      }
    },
    evidenceArtifact: {
      async findMany() {
        return [];
      }
    },
    exposure: {
      async findMany(args?: {
        where?: { assetId?: { in?: string[] }; tenantId?: string };
      }) {
        const assetIds = new Set(args?.where?.assetId?.in ?? []);
        return exposures.filter(
          (exposure) =>
            exposure.tenantId === args?.where?.tenantId &&
            assetIds.has(exposure.assetId)
        );
      }
    },
    missingSignal: {
      async findMany() {
        return [];
      }
    },
    scope: {
      async findMany() {
        return [
          {
            scopeId: "scope-in",
            tenantId: "tenant-1",
            value: "github.com/acme/in-scope",
            verificationStatus: "Verified"
          }
        ];
      }
    },
    signalEnvelope: {
      async findMany() {
        return [];
      }
    }
  } as never;
}

describe("executeReadOnlyGatewayTool scoped reads", () => {
  it("lists only assets matching verified session scopes", async () => {
    const result = await executeReadOnlyGatewayTool({
      deps: createDeps(),
      input: { limit: 10 },
      prisma: createPrisma(),
      scopeIds: ["scope-in"],
      tenantId: "tenant-1",
      toolName: "list_assets_in_scope"
    });

    expect(result.output.assets as unknown[]).toEqual([
      expect.objectContaining({ assetId: "asset-in" })
    ]);
    expect(JSON.stringify(result.output)).not.toContain("asset-out");
  });

  it("rejects asset context for tenant assets outside the session scope", async () => {
    await expect(
      executeReadOnlyGatewayTool({
        deps: createDeps(),
        input: { assetId: "asset-out" },
        prisma: createPrisma(),
        scopeIds: ["scope-in"],
        tenantId: "tenant-1",
        toolName: "get_asset_context"
      })
    ).rejects.toMatchObject({ code: "not_found", statusCode: 404 });
  });

  it("returns only graph paths linked to scoped assets or exposures", async () => {
    const result = await executeReadOnlyGatewayTool({
      deps: createDeps(),
      input: { limit: 10 },
      prisma: createPrisma(),
      scopeIds: ["scope-in"],
      tenantId: "tenant-1",
      toolName: "query_evidence_graph"
    });

    expect(JSON.stringify(result.output)).toContain("asset-in");
    expect(JSON.stringify(result.output)).toContain("exposure-in");
    expect(result.output.pathCount).toBe(1);
    expect(JSON.stringify(result.output)).not.toContain("asset-out");
    expect(JSON.stringify(result.output)).not.toContain("exposure-out");
  });
});
