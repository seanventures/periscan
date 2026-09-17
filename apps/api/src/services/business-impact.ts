import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import { estimateFinancialExposure } from "@periscan/evidence";
import {
  AssetValuationInputSchema,
  AssetValuationSchema,
  AssetValuationVersionSchema,
  BUSINESS_IMPACT_SCENARIOS,
  BusinessImpactPreviewSchema,
  BusinessImpactScenarioSchema,
  BusinessImpactWorkspaceSchema,
  SubmitAssetValuationVersionInputSchema,
  type AssetValuationVersion,
  type BusinessImpactPreview,
  type BusinessImpactScenario,
  type BusinessImpactWorkspace,
  type ReviewAssetValuationVersionInput,
  type SubmitAssetValuationVersionInput
} from "@periscan/shared";

import {
  AppServiceError,
  SCOPE_EDITOR_ROLES,
  TENANT_ADMIN_ROLES,
  requireRole,
  serializeAsset,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type BusinessImpactServices = Pick<
  AppServices,
  | "getBusinessImpactWorkspace"
  | "previewAssetValuation"
  | "reviewAssetValuationVersion"
  | "submitAssetValuationVersion"
>;

type ValuationVersionRecord = Prisma.AssetValuationVersionGetPayload<{
  include: { asset: true };
}>;

const SCENARIOS = BUSINESS_IMPACT_SCENARIOS.map((scenario) =>
  BusinessImpactScenarioSchema.parse(scenario)
);

function scenarioById(
  scenarioId: SubmitAssetValuationVersionInput["scenarioId"]
): BusinessImpactScenario {
  const scenario = SCENARIOS.find((entry) => entry.scenarioId === scenarioId);
  if (!scenario) {
    throw new AppServiceError(
      "Business-impact scenario not found.",
      400,
      "business_impact_scenario_not_found"
    );
  }
  return scenario;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  }
  return value;
}

export function businessImpactInputDigest(
  input: SubmitAssetValuationVersionInput
): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function baseValuation(input: SubmitAssetValuationVersionInput) {
  return AssetValuationInputSchema.parse(input);
}

function estimateForInput(input: {
  assetId: string;
  assetName: string;
  submitted: SubmitAssetValuationVersionInput;
  updatedAt: string;
  updatedBy: string;
}) {
  return estimateFinancialExposure({
    assetId: input.assetId,
    assetName: input.assetName,
    valuation: AssetValuationSchema.parse({
      ...baseValuation(input.submitted),
      updatedAt: input.updatedAt,
      updatedBy: input.updatedBy
    })
  });
}

function submittedInputFromRecord(
  record: ValuationVersionRecord
): SubmitAssetValuationVersionInput {
  return SubmitAssetValuationVersionInputSchema.parse({
    ...AssetValuationInputSchema.parse(record.valuation),
    changeReason: record.changeReason,
    scenarioId: record.scenarioId,
    sources: record.sourceProvenance
  });
}

function serializeVersion(
  record: ValuationVersionRecord
): AssetValuationVersion {
  const input = submittedInputFromRecord(record);
  return AssetValuationVersionSchema.parse({
    annualizedLossExposureUsd: record.annualizedLossExposureUsd,
    assetId: record.assetId,
    assetName: record.asset.name,
    changeReason: record.changeReason,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    input,
    inputDigest: record.inputDigest,
    integrityVerified: businessImpactInputDigest(input) === record.inputDigest,
    reviewNote: record.reviewNote,
    reviewReference: record.reviewReference,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewedBy: record.reviewedBy,
    scenario: scenarioById(input.scenarioId),
    sequence: record.sequence,
    status: record.status,
    supersededAt: record.supersededAt?.toISOString() ?? null,
    tenantId: record.tenantId,
    valuationVersionId: record.assetValuationVersionId
  });
}

async function findTenantAsset(
  prisma: PrismaClient,
  tenantId: string,
  assetId: string
) {
  const asset = await prisma.asset.findFirst({ where: { assetId, tenantId } });
  if (!asset) {
    throw new AppServiceError("Asset not found.", 404, "asset_not_found");
  }
  return asset;
}

async function loadWorkspace(
  prisma: PrismaClient,
  tenantId: string
): Promise<BusinessImpactWorkspace> {
  const assets = await prisma.asset.findMany({
    include: {
      valuationVersions: {
        include: { asset: true },
        orderBy: { sequence: "desc" }
      }
    },
    orderBy: [{ businessCriticality: "desc" }, { name: "asc" }],
    where: { tenantId }
  });
  let approvedAssetCount = 0;
  let assumptionBasedAnnualizedExposureUsd = 0;
  let failedIntegrityCount = 0;
  let pendingReviewCount = 0;
  let valuedAssetCount = 0;

  const entries = assets.map((asset) => {
    const versions = asset.valuationVersions.map(serializeVersion);
    const approved = versions.find((version) => version.status === "Approved");
    const currentValuation = AssetValuationSchema.safeParse(asset.valuation);
    const currentExposure = currentValuation.success
      ? estimateFinancialExposure({
          assetId: asset.assetId,
          assetName: asset.name,
          valuation: currentValuation.data
        })
      : null;
    if (approved) approvedAssetCount += 1;
    if (currentExposure) {
      valuedAssetCount += 1;
      assumptionBasedAnnualizedExposureUsd +=
        currentExposure.annualizedLossExposureUsd;
    }
    pendingReviewCount += versions.filter(
      (version) => version.status === "PendingReview"
    ).length;
    failedIntegrityCount += versions.filter(
      (version) => !version.integrityVerified
    ).length;

    return {
      asset: serializeAsset(asset),
      currentApprovedVersionId: approved?.valuationVersionId ?? null,
      currentExposure,
      versions
    };
  });

  return BusinessImpactWorkspaceSchema.parse({
    assets: entries,
    generatedAt: new Date().toISOString(),
    limitations: [
      "All dollar values are customer assumptions for planning; they are not measured loss history, an actuarial opinion, or a full FAIR assessment.",
      "Scenario prompts contain no benchmark dollar values. Frequency and magnitude must come from named tenant sources.",
      "Only an approved version changes current path exposure. Rejected and pending versions remain visible but inactive."
    ],
    methodology: "FAIR-inspired PERT range estimate",
    scenarios: SCENARIOS,
    summary: {
      approvedAssetCount,
      assumptionBasedAnnualizedExposureUsd,
      failedIntegrityCount,
      pendingReviewCount,
      valuedAssetCount
    }
  });
}

export function createBusinessImpactServices(
  deps: RuntimeServiceDeps
): BusinessImpactServices {
  const { prisma } = deps;

  return {
    async getBusinessImpactWorkspace(context) {
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async previewAssetValuation(context, assetId, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "preview asset financial assumptions"
      );
      const input = SubmitAssetValuationVersionInputSchema.parse(rawInput);
      const asset = await findTenantAsset(
        prisma,
        context.tenant.tenantId,
        assetId
      );
      const generatedAt = new Date().toISOString();
      return BusinessImpactPreviewSchema.parse({
        assetId,
        estimate: estimateForInput({
          assetId,
          assetName: asset.name,
          submitted: input,
          updatedAt: generatedAt,
          updatedBy: context.user.userId
        }),
        generatedAt,
        input,
        scenario: scenarioById(input.scenarioId)
      }) as BusinessImpactPreview;
    },

    async submitAssetValuationVersion(context, assetId, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "submit asset financial assumptions"
      );
      const input = SubmitAssetValuationVersionInputSchema.parse(rawInput);
      const asset = await findTenantAsset(
        prisma,
        context.tenant.tenantId,
        assetId
      );
      scenarioById(input.scenarioId);
      const createdAt = new Date();
      const estimate = estimateForInput({
        assetId,
        assetName: asset.name,
        submitted: input,
        updatedAt: createdAt.toISOString(),
        updatedBy: context.user.userId
      });
      const record = await prisma.$transaction(async (tx) => {
        const latest = await tx.assetValuationVersion.findFirst({
          orderBy: { sequence: "desc" },
          select: { sequence: true },
          where: { assetId, tenantId: context.tenant.tenantId }
        });
        const created = await tx.assetValuationVersion.create({
          data: {
            annualizedLossExposureUsd: estimate.annualizedLossExposureUsd,
            assetId,
            changeReason: input.changeReason,
            createdAt,
            createdBy: context.user.userId,
            inputDigest: businessImpactInputDigest(input),
            scenarioId: input.scenarioId,
            sequence: (latest?.sequence ?? 0) + 1,
            sourceProvenance: input.sources as unknown as Prisma.InputJsonValue,
            status: "PendingReview",
            tenantId: context.tenant.tenantId,
            valuation: baseValuation(input) as unknown as Prisma.InputJsonValue
          },
          include: { asset: true }
        });
        await writeAuditEvent(tx, {
          action: "asset.valuation_submitted",
          actorType: "User",
          entityId: created.assetValuationVersionId,
          entityType: "AssetValuationVersion",
          metadata: {
            assetId,
            inputDigest: created.inputDigest,
            scenarioId: created.scenarioId,
            sequence: created.sequence,
            sourceCount: input.sources.length
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return created;
      });
      return serializeVersion(record);
    },

    async reviewAssetValuationVersion(
      context,
      assetId,
      valuationVersionId,
      input: ReviewAssetValuationVersionInput
    ) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "review asset financial assumptions"
      );
      const reviewedAt = new Date();
      const record = await prisma.$transaction(async (tx) => {
        const current = await tx.assetValuationVersion.findFirst({
          include: { asset: true },
          where: {
            assetId,
            assetValuationVersionId: valuationVersionId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!current) {
          throw new AppServiceError(
            "Asset valuation version not found.",
            404,
            "asset_valuation_version_not_found"
          );
        }
        if (current.status !== "PendingReview") {
          throw new AppServiceError(
            "Only a pending valuation version can be reviewed.",
            409,
            "asset_valuation_version_not_pending"
          );
        }
        const submitted = submittedInputFromRecord(current);
        if (businessImpactInputDigest(submitted) !== current.inputDigest) {
          throw new AppServiceError(
            "Valuation input integrity verification failed.",
            409,
            "asset_valuation_integrity_failed"
          );
        }

        if (input.decision === "Approve") {
          await tx.assetValuationVersion.updateMany({
            data: { status: "Superseded", supersededAt: reviewedAt },
            where: {
              assetId,
              status: "Approved",
              tenantId: context.tenant.tenantId
            }
          });
          await tx.asset.update({
            data: {
              valuation: {
                ...baseValuation(submitted),
                updatedAt: reviewedAt.toISOString(),
                updatedBy: context.user.userId
              } as unknown as Prisma.InputJsonValue
            },
            where: { assetId }
          });
        }
        const updated = await tx.assetValuationVersion.update({
          data: {
            reviewNote: input.reviewNote,
            reviewReference: input.reviewReference,
            reviewedAt,
            reviewedBy: context.user.userId,
            status: input.decision === "Approve" ? "Approved" : "Rejected"
          },
          include: { asset: true },
          where: { assetValuationVersionId: valuationVersionId }
        });
        await writeAuditEvent(tx, {
          action: "asset.valuation_reviewed",
          actorType: "User",
          entityId: valuationVersionId,
          entityType: "AssetValuationVersion",
          metadata: {
            assetId,
            decision: input.decision,
            inputDigest: current.inputDigest,
            reviewReference: input.reviewReference,
            sequence: current.sequence
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        if (input.decision === "Approve") {
          await writeAuditEvent(tx, {
            action: "asset.valuation_updated",
            actorType: "User",
            entityId: assetId,
            entityType: "Asset",
            metadata: {
              businessServiceName: submitted.businessServiceName,
              inputDigest: current.inputDigest,
              reviewReference: input.reviewReference,
              valuationVersionId
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });
        }
        return updated;
      });
      return serializeVersion(record);
    }
  };
}
