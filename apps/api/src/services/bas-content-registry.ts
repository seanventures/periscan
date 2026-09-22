import { runWithTenantRls } from "@periscan/db";
import { previewBasContent } from "@periscan/modules";
import {
  BasContentPreviewSchema,
  BasContentVersionSchema,
  BasContentVersionSummarySchema,
  PromoteBasContentInputSchema,
  type BasContentPreview,
  type BasContentReviewStatus,
  type BasContentVersion,
  type BasContentVersionFilter
} from "@periscan/shared";
import {
  Prisma,
  type BasContentVersion as BasContentRecord,
  type BasContentVersionReview as BasContentReviewRecord
} from "@prisma/client";
import {
  AppServiceError,
  requireRole,
  TENANT_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

type ReviewRecord = Pick<
  BasContentReviewRecord,
  "reviewStatus" | "reviewedByUserId" | "reviewedAt"
>;

function reviewFields(review: ReviewRecord | null) {
  const reviewStatus: BasContentReviewStatus =
    review?.reviewStatus === "Reviewed" ? "Reviewed" : "Unreviewed";
  return {
    reviewStatus,
    reviewedAt: review?.reviewedAt.toISOString() ?? null,
    reviewedByUserId: review?.reviewedByUserId ?? null
  };
}

function overlayPreview(
  preview: unknown,
  reviewStatus: BasContentReviewStatus
): BasContentPreview {
  const parsed = BasContentPreviewSchema.parse(preview);
  return {
    ...parsed,
    executable: false,
    evidenceProduced: false,
    scenarios: parsed.scenarios.map((scenario) => ({
      ...scenario,
      executable: false,
      reviewStatus
    }))
  };
}

function summary(
  record: Omit<BasContentRecord, "preview">,
  review: ReviewRecord | null
) {
  const reviewStatus = reviewFields(review);
  return BasContentVersionSummarySchema.parse({
    basContentVersionId: record.basContentVersionId,
    tenantId: record.tenantId,
    provider: record.provider,
    sourceRevision: record.sourceRevision,
    sourcePath: record.sourcePath,
    contentSha256: record.contentSha256,
    scenarioCount: record.scenarioCount,
    provenance: "UserSuppliedUnverified",
    executable: false,
    evidenceProduced: false,
    registeredByUserId: record.registeredByUserId,
    createdAt: record.createdAt.toISOString(),
    ...reviewStatus
  });
}

function serialize(
  record: BasContentRecord,
  review: ReviewRecord | null
): BasContentVersion {
  const fields = reviewFields(review);
  return BasContentVersionSchema.parse({
    ...summary(record, review),
    preview: overlayPreview(record.preview, fields.reviewStatus)
  });
}

function replay(
  record: BasContentRecord,
  hash: string,
  review: ReviewRecord | null
) {
  if (record.contentSha256 !== hash) {
    throw new AppServiceError(
      "This BAS provider, revision and path already have different content. Register a new revision or path.",
      409,
      "bas_content_version_conflict"
    );
  }
  return { created: false, version: serialize(record, review) };
}

async function loadReview(
  tx: Prisma.TransactionClient,
  tenantId: string,
  basContentVersionId: string
) {
  return tx.basContentVersionReview.findFirst({
    where: { tenantId, basContentVersionId }
  });
}

export function createBasContentRegistryServices({
  prisma
}: Pick<RuntimeServiceDeps, "prisma">): Pick<
  AppServices,
  | "registerBasContent"
  | "listBasContentVersions"
  | "getBasContentVersion"
  | "promoteBasContent"
> {
  return {
    async registerBasContent(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "register BAS content"
      );
      const { sourcePath, ...previewInput } = input;
      let preview;
      try {
        preview = previewBasContent(previewInput);
      } catch {
        throw new AppServiceError(
          "Invalid BAS scenario content.",
          400,
          "bas_content_invalid"
        );
      }
      const tenantId = context.tenant.tenantId;
      const identity = {
        tenantId,
        provider: preview.provider,
        sourceRevision: preview.sourceRevision,
        sourcePath
      };
      try {
        return await runWithTenantRls(prisma, tenantId, async (tx) => {
          const existing = await tx.basContentVersion.findFirst({
            where: identity
          });
          if (existing) {
            return replay(
              existing,
              preview.contentSha256,
              await loadReview(tx, tenantId, existing.basContentVersionId)
            );
          }
          const record = await tx.basContentVersion.create({
            data: {
              ...identity,
              contentSha256: preview.contentSha256,
              scenarioCount: preview.scenarios.length,
              preview: preview as Prisma.InputJsonValue,
              registeredByUserId: context.user.userId
            }
          });
          await writeAuditEvent(tx, {
            action: "bas.content_registered",
            actorType: "User",
            entityType: "Scenario",
            entityId: record.basContentVersionId,
            tenantId,
            userId: context.user.userId,
            metadata: {
              provider: preview.provider,
              contentSha256: preview.contentSha256,
              scenarioCount: preview.scenarios.length,
              provenance: preview.provenance
            }
          });
          return { created: true, version: serialize(record, null) };
        });
      } catch (error) {
        // A concurrent insert can win after the initial lookup. Read only after
        // the failed transaction rolls back; never overwrite a winning version.
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        )
          throw error;
        const winner = await runWithTenantRls(prisma, tenantId, (tx) =>
          tx.basContentVersion.findFirst({ where: identity })
        );
        if (!winner) throw error;
        const review = await runWithTenantRls(prisma, tenantId, (tx) =>
          loadReview(tx, tenantId, winner.basContentVersionId)
        );
        return replay(winner, preview.contentSha256, review);
      }
    },

    async getBasContentVersion(context, basContentVersionId) {
      const tenantId = context.tenant.tenantId;
      return runWithTenantRls(prisma, tenantId, async (tx) => {
        const record = await tx.basContentVersion.findFirst({
          where: { tenantId, basContentVersionId }
        });
        if (!record)
          throw new AppServiceError(
            "BAS content version not found.",
            404,
            "bas_content_version_not_found"
          );
        return serialize(
          record,
          await loadReview(tx, tenantId, basContentVersionId)
        );
      });
    },

    async listBasContentVersions(context, filter: BasContentVersionFilter) {
      const tenantId = context.tenant.tenantId;
      return runWithTenantRls(prisma, tenantId, async (tx) => {
        const where: Prisma.BasContentVersionWhereInput = {
          tenantId,
          provider: filter.provider
        };
        if (filter.cursor) {
          const anchor = await tx.basContentVersion.findFirst({
            where: { ...where, basContentVersionId: filter.cursor },
            select: { createdAt: true, basContentVersionId: true }
          });
          if (!anchor)
            throw new AppServiceError(
              "BAS content cursor not found.",
              404,
              "bas_content_cursor_not_found"
            );
          where.OR = [
            { createdAt: { lt: anchor.createdAt } },
            {
              createdAt: anchor.createdAt,
              basContentVersionId: { lt: anchor.basContentVersionId }
            }
          ];
        }
        const records = await tx.basContentVersion.findMany({
          where,
          omit: { preview: true },
          orderBy: [{ createdAt: "desc" }, { basContentVersionId: "desc" }],
          take: filter.limit + 1
        });
        const page = records.slice(0, filter.limit);
        const reviews = page.length
          ? await tx.basContentVersionReview.findMany({
              where: {
                tenantId,
                basContentVersionId: {
                  in: page.map((item) => item.basContentVersionId)
                }
              }
            })
          : [];
        const reviewById = new Map(
          reviews.map((review) => [review.basContentVersionId, review])
        );
        const items = page.map((record) =>
          summary(record, reviewById.get(record.basContentVersionId) ?? null)
        );
        return {
          items,
          nextCursor:
            records.length > filter.limit
              ? items.at(-1)!.basContentVersionId
              : null
        };
      });
    },

    async promoteBasContent(context, basContentVersionId, rawInput) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "promote BAS content"
      );
      PromoteBasContentInputSchema.parse(rawInput);
      const tenantId = context.tenant.tenantId;
      try {
        return await runWithTenantRls(prisma, tenantId, async (tx) => {
          const record = await tx.basContentVersion.findFirst({
            where: { tenantId, basContentVersionId }
          });
          if (!record)
            throw new AppServiceError(
              "BAS content version not found.",
              404,
              "bas_content_version_not_found"
            );
          const existing = await loadReview(tx, tenantId, basContentVersionId);
          if (existing) {
            return { created: false, version: serialize(record, existing) };
          }
          const review = await tx.basContentVersionReview.create({
            data: {
              basContentVersionId,
              reviewStatus: "Reviewed",
              reviewedByUserId: context.user.userId,
              tenantId
            }
          });
          await writeAuditEvent(tx, {
            action: "bas.content_promoted",
            actorType: "User",
            entityId: record.basContentVersionId,
            entityType: "Scenario",
            metadata: {
              contentSha256: record.contentSha256,
              executable: false,
              liveSupported: false,
              provider: record.provider,
              reviewStatus: "Reviewed",
              startable: false
            },
            tenantId,
            userId: context.user.userId
          });
          return { created: true, version: serialize(record, review) };
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        )
          throw error;
        const winner = await runWithTenantRls(prisma, tenantId, async (tx) => {
          const record = await tx.basContentVersion.findFirst({
            where: { tenantId, basContentVersionId }
          });
          const review = record
            ? await loadReview(tx, tenantId, basContentVersionId)
            : null;
          return { record, review };
        });
        if (!winner.record || !winner.review) throw error;
        return { created: false, version: serialize(winner.record, winner.review) };
      }
    }
  };
}
