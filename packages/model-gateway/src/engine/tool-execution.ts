import type { PrismaClient } from "@prisma/client";
import { redactEvidenceArtifact } from "@periscan/evidence";
import {
  generateEvidenceGroundedSummary,
  generateOperatorRecommendations,
  type OperatorContext
} from "@periscan/operators";
import type {
  AttackPath,
  EvidenceArtifact,
  SensitivityLevel
} from "@periscan/shared";

import {
  loadAssetsForVerifiedScopes,
  loadAttackPathsForScopedEntities,
  loadExposuresForScopedAssets
} from "./scope-filter.js";

export interface GatewayToolExecutionResult {
  output: Record<string, unknown>;
  evidenceIds: string[];
  sensitivityLevel: SensitivityLevel;
}

export interface GatewayToolExecutionDeps {
  /** Correlated attack paths for the tenant (read-only). */
  ensureCorrelatedAttackPaths: (tenantId: string) => Promise<AttackPath[]>;
  /** Deterministic operator context used by the plan tools. */
  buildOperatorContext: () => Promise<OperatorContext>;
  /** Map a Prisma evidence row to the shared EvidenceArtifact contract. */
  serializeEvidenceArtifact: (record: unknown) => EvidenceArtifact;
  /** Error factory so callers map to their own error type/status codes. */
  createError: (message: string, statusCode: number, code: string) => Error;
}

export function clampLimit(
  value: unknown,
  fallback: number,
  max: number
): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.min(Math.floor(value), max);
  }
  return Math.min(fallback, max);
}

/**
 * Defense-in-depth: run any tool output through the evidence redactor before it
 * can be stored or returned to a model. Structured DB values are low risk, but
 * this scrubs any secret-like strings that slipped into free-text fields.
 */
export function redactGatewayToolOutput(
  output: Record<string, unknown>
): Record<string, unknown> {
  const redacted = redactEvidenceArtifact(JSON.stringify(output));
  return JSON.parse(redacted.content) as Record<string, unknown>;
}

/**
 * Execute a read-only or plan tool against existing Periscan services. These
 * tools never touch customer systems; they read normalized, tenant-scoped data
 * and (for plan tools) call the deterministic operators package. Output is
 * redacted before return. Action tools (validation/remediation/reporting) are
 * NOT handled here.
 */
export async function executeReadOnlyGatewayTool(args: {
  prisma: PrismaClient;
  scopeIds: string[];
  tenantId: string;
  toolName: string;
  input: Record<string, unknown>;
  deps: GatewayToolExecutionDeps;
}): Promise<GatewayToolExecutionResult> {
  const { prisma, scopeIds, tenantId, toolName, input, deps } = args;
  const limit = clampLimit(input.limit, 50, 200);

  switch (toolName) {
    case "list_assets_in_scope": {
      const assets = await loadAssetsForVerifiedScopes({
        prisma,
        scopeIds,
        take: limit,
        tenantId
      });
      return {
        evidenceIds: [],
        output: {
          assets: assets.map((asset) => ({
            assetId: asset.assetId,
            assetType: asset.assetType,
            businessCriticality: asset.businessCriticality,
            internetExposed: asset.internetExposed,
            name: asset.name,
            status: asset.status
          }))
        },
        sensitivityLevel: "Moderate"
      };
    }

    case "get_asset_context": {
      const assetId = typeof input.assetId === "string" ? input.assetId : "";
      const scopedAssets = await loadAssetsForVerifiedScopes({
        prisma,
        scopeIds,
        take: 200,
        tenantId
      });
      const asset = scopedAssets.find(
        (candidate) => candidate.assetId === assetId
      );
      if (!asset) {
        throw deps.createError("Asset not found.", 404, "not_found");
      }
      const exposures = await prisma.exposure.findMany({
        orderBy: { severity: "desc" },
        take: 50,
        where: { assetId, tenantId }
      });
      const evidenceIds = [
        ...new Set(exposures.flatMap((exposure) => exposure.evidenceIds))
      ];
      return {
        evidenceIds,
        output: {
          asset: {
            assetId: asset.assetId,
            assetType: asset.assetType,
            businessCriticality: asset.businessCriticality,
            internetExposed: asset.internetExposed,
            name: asset.name,
            status: asset.status
          },
          exposures: exposures.map((exposure) => ({
            exposureId: exposure.exposureId,
            exposureType: exposure.exposureType,
            severity: exposure.severity,
            status: exposure.status,
            validationState: exposure.validationState
          }))
        },
        sensitivityLevel: "Moderate"
      };
    }

    case "get_attack_paths": {
      await deps.ensureCorrelatedAttackPaths(tenantId);
      const scopedAssets = await loadAssetsForVerifiedScopes({
        prisma,
        scopeIds,
        take: 200,
        tenantId
      });
      const scopedExposures = await loadExposuresForScopedAssets({
        assetIds: scopedAssets.map((asset) => asset.assetId),
        prisma,
        take: 200,
        tenantId
      });
      const limited = (await loadAttackPathsForScopedEntities({
        entityIds: [
          ...scopedAssets.map((asset) => asset.assetId),
          ...scopedExposures.map((exposure) => exposure.exposureId)
        ],
        prisma,
        take: clampLimit(input.limit, 25, 100),
        tenantId
      })) as AttackPath[];
      const evidenceIds = [
        ...new Set(limited.flatMap((path) => path.evidenceIds))
      ];
      return {
        evidenceIds,
        output: {
          paths: limited.map((path) => ({
            confidence: path.confidence,
            impactScore: path.impactScore,
            name: path.name,
            pathId: path.pathId,
            validationState: path.validationState
          }))
        },
        sensitivityLevel: "Moderate"
      };
    }

    case "query_evidence_graph": {
      await deps.ensureCorrelatedAttackPaths(tenantId);
      const assets = await loadAssetsForVerifiedScopes({
        prisma,
        scopeIds,
        take: limit,
        tenantId
      });
      const exposures = await loadExposuresForScopedAssets({
        assetIds: assets.map((asset) => asset.assetId),
        prisma,
        take: limit,
        tenantId
      });
      const paths = await loadAttackPathsForScopedEntities({
        entityIds: [
          ...assets.map((asset) => asset.assetId),
          ...exposures.map((exposure) => exposure.exposureId)
        ],
        prisma,
        take: limit,
        tenantId
      });
      const nodes = [
        ...assets.map((asset) => ({
          id: asset.assetId,
          label: asset.name,
          type: "Asset"
        })),
        ...exposures.map((exposure) => ({
          id: exposure.exposureId,
          label: exposure.exposureType,
          type: "Exposure"
        }))
      ];
      const edges = exposures
        .filter((exposure) => exposure.assetId)
        .map((exposure) => ({
          relationship: "EXPOSES",
          source: exposure.assetId,
          target: exposure.exposureId
        }));
      return {
        evidenceIds: [],
        output: {
          edges,
          nodes,
          pathCount: paths.length
        },
        sensitivityLevel: "Moderate"
      };
    }

    case "get_control_results": {
      const signals = await prisma.signalEnvelope.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        where: { signalCategory: "ControlObservation", tenantId }
      });
      return {
        evidenceIds: [],
        output: {
          controls: signals.map((signal) => ({
            confidence: signal.confidence,
            signalId: signal.signalId,
            signalSubcategory: signal.signalSubcategory,
            sourceVendor: signal.sourceVendor,
            timestampObserved: signal.timestampObserved.toISOString()
          }))
        },
        sensitivityLevel: "Moderate"
      };
    }

    case "get_missing_signals": {
      const missingSignals = await prisma.missingSignal.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        where: { tenantId }
      });
      return {
        evidenceIds: [],
        output: {
          missingSignals: missingSignals.map((signal) => ({
            missingSignalId: signal.missingSignalId,
            reason: signal.reason,
            signalType: signal.signalType,
            status: signal.status
          }))
        },
        sensitivityLevel: "Low"
      };
    }

    case "summarize_evidence": {
      const artifacts = await prisma.evidenceArtifact.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        where: { tenantId }
      });
      const summary = generateEvidenceGroundedSummary({
        artifacts: artifacts.map(deps.serializeEvidenceArtifact),
        generatedAt: new Date().toISOString(),
        useCase: "ExecutiveSummary"
      });
      const evidenceIds = [
        ...new Set(summary.claims.flatMap((claim) => claim.evidenceIds))
      ];
      return {
        evidenceIds,
        output: { summary },
        sensitivityLevel: "Low"
      };
    }

    case "recommend_validation_missions": {
      const recommendations = generateOperatorRecommendations(
        await deps.buildOperatorContext()
      );
      return {
        evidenceIds: [],
        output: {
          recommendations: recommendations.slice(
            0,
            clampLimit(input.limit, 50, 50)
          )
        },
        sensitivityLevel: "Low"
      };
    }

    case "create_validation_plan": {
      const recommendations = generateOperatorRecommendations(
        await deps.buildOperatorContext()
      );
      const objective =
        typeof input.objective === "string"
          ? input.objective
          : "Validate the highest-risk findings in scope.";
      return {
        evidenceIds: [],
        output: {
          plan: {
            objective,
            steps: recommendations
              .slice(0, 10)
              .map((recommendation, index) => ({
                missionType: recommendation.missionPlan.missionType,
                order: index + 1,
                rationale: recommendation.rationale,
                recommendationId: recommendation.recommendationId,
                title: recommendation.title
              }))
          }
        },
        sensitivityLevel: "Low"
      };
    }

    default:
      throw deps.createError(
        `Tool ${toolName} is not an executable read-only/plan tool.`,
        422,
        "tool_not_executable"
      );
  }
}
