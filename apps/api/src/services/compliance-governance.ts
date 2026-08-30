import type { Prisma } from "@prisma/client";
import {
  COMPLIANCE_CATALOG,
  COMPLIANCE_CATALOG_VERSIONS,
  COMPLIANCE_PACK_DISCLAIMER,
  COMPLIANCE_PACK_TYPES
} from "@periscan/reports/compliance-catalog";
import {
  BatchComplianceGovernanceResultSchema,
  ComplianceGovernanceChangeSchema,
  ComplianceGovernanceInventorySchema,
  ComplianceGovernanceMultiFrameworkSummarySchema,
  MultiFrameworkComplianceExportResultSchema,
  type BatchComplianceGovernanceInput,
  type BatchComplianceGovernanceResult,
  type ComplianceFrameworkKey,
  type ComplianceGovernanceInventory,
  type ComplianceGovernanceMultiFrameworkSummary,
  type MultiFrameworkComplianceExportInput,
  type MultiFrameworkComplianceExportResult
} from "@periscan/shared";

import {
  AppServiceError,
  createReportPackFromSnapshot,
  loadValidationSnapshot,
  requireCapability,
  requireRole,
  TENANT_ADMIN_ROLES,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type ComplianceGovernanceServices = Pick<
  AppServices,
  | "batchUpdateComplianceGovernance"
  | "exportMultiFrameworkCompliancePacks"
  | "getComplianceGovernance"
  | "getComplianceGovernanceSummary"
  | "listComplianceGovernanceChanges"
  | "updateComplianceControlGovernance"
>;

function getFramework(framework: ComplianceFrameworkKey) {
  const catalog = COMPLIANCE_CATALOG[framework];
  const version = COMPLIANCE_CATALOG_VERSIONS[framework];
  if (!catalog || !version) {
    throw new AppServiceError(
      "Compliance framework not found.",
      404,
      "compliance_framework_not_found"
    );
  }
  return { catalog, version };
}

function allFrameworkKeys(): ComplianceFrameworkKey[] {
  return COMPLIANCE_PACK_TYPES as ComplianceFrameworkKey[];
}

function governanceState(record: {
  catalogVersion: string;
  controlId: string;
  evidenceRequest: string | null;
  exceptionExpiresAt: Date | null;
  exceptionRationale: string | null;
  framework: string;
  owner: string | null;
  reviewNotes: string | null;
  signedOffAt: Date | null;
  signedOffBy: string | null;
  signoffStatus: string;
}) {
  return {
    catalogVersion: record.catalogVersion,
    controlId: record.controlId,
    evidenceRequest: record.evidenceRequest,
    exceptionExpiresAt: record.exceptionExpiresAt?.toISOString() ?? null,
    exceptionRationale: record.exceptionRationale,
    framework: record.framework,
    owner: record.owner,
    reviewNotes: record.reviewNotes,
    signedOffAt: record.signedOffAt?.toISOString() ?? null,
    signedOffBy: record.signedOffBy,
    signoffStatus: record.signoffStatus
  };
}

async function buildInventory(
  deps: RuntimeServiceDeps,
  tenantId: string,
  framework: ComplianceFrameworkKey,
  now = new Date()
): Promise<ComplianceGovernanceInventory> {
  const { catalog, version } = getFramework(framework);
  const rows = await deps.prisma.complianceControlGovernance.findMany({
    where: { framework, tenantId }
  });
  const byControl = new Map(rows.map((row) => [row.controlId, row]));
  const controls = catalog.controls.map((control) => {
    const row = byControl.get(control.controlId);
    return {
      catalogVersion: row?.catalogVersion ?? version.catalogVersion,
      complianceControlGovernanceId:
        row?.complianceControlGovernanceId ?? null,
      controlId: control.controlId,
      controlTitle: control.title,
      createdAt: row?.createdAt.toISOString() ?? null,
      evidenceRequest: row?.evidenceRequest ?? null,
      evidencedBy: control.evidencedBy,
      exceptionActive: Boolean(
        row?.exceptionRationale &&
          row.exceptionExpiresAt &&
          row.exceptionExpiresAt.getTime() > now.getTime()
      ),
      exceptionExpiresAt: row?.exceptionExpiresAt?.toISOString() ?? null,
      exceptionRationale: row?.exceptionRationale ?? null,
      framework,
      owner: row?.owner ?? null,
      reviewNotes: row?.reviewNotes ?? null,
      signedOffAt: row?.signedOffAt?.toISOString() ?? null,
      signedOffBy: row?.signedOffBy ?? null,
      signoffStatus: row?.signoffStatus ?? "Draft",
      tenantId,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null
    };
  });
  return ComplianceGovernanceInventorySchema.parse({
    catalogLastReviewedAt: version.lastReviewedAt,
    catalogVersion: version.catalogVersion,
    controls,
    displayName: catalog.displayName,
    framework,
    summary: {
      approved: controls.filter((control) => control.signoffStatus === "Approved")
        .length,
      exceptions: controls.filter((control) => control.exceptionActive).length,
      inReview: controls.filter((control) => control.signoffStatus === "InReview")
        .length,
      owned: controls.filter((control) => Boolean(control.owner)).length,
      total: controls.length
    }
  });
}

async function buildMultiFrameworkSummary(
  deps: RuntimeServiceDeps,
  tenantId: string,
  now = new Date()
): Promise<ComplianceGovernanceMultiFrameworkSummary> {
  const frameworks = [];
  for (const framework of allFrameworkKeys()) {
    const inventory = await buildInventory(deps, tenantId, framework, now);
    frameworks.push({
      catalogVersion: inventory.catalogVersion,
      displayName: inventory.displayName,
      framework,
      partialCatalog: true as const,
      summary: inventory.summary
    });
  }
  const totals = frameworks.reduce(
    (acc, row) => ({
      approved: acc.approved + row.summary.approved,
      exceptions: acc.exceptions + row.summary.exceptions,
      frameworkCount: acc.frameworkCount + 1,
      inReview: acc.inReview + row.summary.inReview,
      owned: acc.owned + row.summary.owned,
      totalControls: acc.totalControls + row.summary.total
    }),
    {
      approved: 0,
      exceptions: 0,
      frameworkCount: 0,
      inReview: 0,
      owned: 0,
      totalControls: 0
    }
  );
  return ComplianceGovernanceMultiFrameworkSummarySchema.parse({
    frameworks,
    honestyNote:
      "Multi-framework governance is customer evidence-support sign-off only. Catalogs remain partial; Periscan does not issue certification, formal attestation, or audit opinions (scorecard #80 stays <4 until program-complete catalogs).",
    notCertification: true,
    scorecardId: 80,
    totals
  });
}

async function applyGovernanceUpdate(
  deps: RuntimeServiceDeps,
  context: Parameters<AppServices["updateComplianceControlGovernance"]>[0],
  input: {
    controlId: string;
    evidenceRequest?: string | null;
    exceptionExpiresAt?: string | null;
    exceptionRationale?: string | null;
    framework: ComplianceFrameworkKey;
    owner?: string | null;
    reviewNotes?: string | null;
    signoffStatus?: string;
  },
  now: Date
) {
  const { prisma } = deps;
  const { catalog, version } = getFramework(input.framework);
  if (!catalog.controls.some((control) => control.controlId === input.controlId)) {
    throw new AppServiceError(
      "Control ID is not present in the selected catalog version.",
      400,
      "compliance_control_not_in_catalog"
    );
  }

  let resultSignedOffAt: string | null = null;
  let resultSignoffStatus:
    | "Draft"
    | "InReview"
    | "Approved"
    | "Rejected" = "Draft";

  await prisma.$transaction(async (tx) => {
    const existing = await tx.complianceControlGovernance.findFirst({
      where: {
        controlId: input.controlId,
        framework: input.framework,
        tenantId: context.tenant.tenantId
      }
    });

    // PATCH semantics: omitted fields preserve existing values; explicit null clears.
    // Critical: Zod used to default omitted signoffStatus to "Draft", which wiped
    // Approved sign-offs (and signedOffAt/By) on owner-only / notes-only updates.
    const signoffStatus = (input.signoffStatus ??
      existing?.signoffStatus ??
      "Draft") as "Draft" | "InReview" | "Approved" | "Rejected";
    const evidenceRequest =
      input.evidenceRequest !== undefined
        ? input.evidenceRequest
        : (existing?.evidenceRequest ?? null);
    const exceptionRationale =
      input.exceptionRationale !== undefined
        ? input.exceptionRationale
        : (existing?.exceptionRationale ?? null);
    const exceptionExpiresAtRaw =
      input.exceptionExpiresAt !== undefined
        ? input.exceptionExpiresAt
        : (existing?.exceptionExpiresAt?.toISOString() ?? null);
    const owner =
      input.owner !== undefined ? input.owner : (existing?.owner ?? null);
    const reviewNotes =
      input.reviewNotes !== undefined
        ? input.reviewNotes
        : (existing?.reviewNotes ?? null);

    if (
      Boolean(exceptionRationale) !== Boolean(exceptionExpiresAtRaw)
    ) {
      throw new AppServiceError(
        "An exception requires both a rationale and an expiration time.",
        400,
        "compliance_exception_incomplete"
      );
    }
    if (
      exceptionExpiresAtRaw &&
      new Date(exceptionExpiresAtRaw).getTime() <= now.getTime()
    ) {
      throw new AppServiceError(
        "An exception expiration must be in the future.",
        400,
        "compliance_exception_expired"
      );
    }
    if (signoffStatus === "Approved" && !reviewNotes) {
      throw new AppServiceError(
        "Approved sign-off requires review notes.",
        400,
        "compliance_approved_requires_review_notes"
      );
    }
    if (signoffStatus === "Approved" && !owner) {
      throw new AppServiceError(
        "Approved sign-off requires an accountable owner.",
        400,
        "compliance_approved_requires_owner"
      );
    }

    const becomingApproved =
      signoffStatus === "Approved" && existing?.signoffStatus !== "Approved";
    const signedOffAt =
      signoffStatus === "Approved"
        ? becomingApproved
          ? now
          : (existing?.signedOffAt ?? now)
        : null;
    const signedOffBy =
      signoffStatus === "Approved"
        ? becomingApproved
          ? context.user.userId
          : (existing?.signedOffBy ?? context.user.userId)
        : null;

    const data = {
      catalogVersion: version.catalogVersion,
      evidenceRequest,
      exceptionExpiresAt: exceptionExpiresAtRaw
        ? new Date(exceptionExpiresAtRaw)
        : null,
      exceptionRationale,
      owner,
      reviewNotes,
      signedOffAt,
      signedOffBy,
      signoffStatus,
      updatedBy: context.user.userId
    };
    const record = existing
      ? await tx.complianceControlGovernance.update({
          data,
          where: {
            complianceControlGovernanceId:
              existing.complianceControlGovernanceId
          }
        })
      : await tx.complianceControlGovernance.create({
          data: {
            ...data,
            controlId: input.controlId,
            createdBy: context.user.userId,
            framework: input.framework,
            tenantId: context.tenant.tenantId
          }
        });
    const beforeState = existing ? governanceState(existing) : null;
    const afterState = governanceState(record);
    await tx.complianceGovernanceChange.create({
      data: {
        action: existing ? "Updated" : "Created",
        afterState: afterState as Prisma.InputJsonValue,
        ...(beforeState
          ? { beforeState: beforeState as Prisma.InputJsonValue }
          : {}),
        changedBy: context.user.userId,
        complianceControlGovernanceId: record.complianceControlGovernanceId,
        tenantId: context.tenant.tenantId
      }
    });
    await writeAuditEvent(tx, {
      action: "compliance.governance.updated",
      actorType: "User",
      entityId: record.complianceControlGovernanceId,
      entityType: "ComplianceControlGovernance",
      metadata: {
        catalogVersion: version.catalogVersion,
        controlId: input.controlId,
        exceptionActive: Boolean(exceptionRationale),
        framework: input.framework,
        signoffStatus
      },
      tenantId: context.tenant.tenantId,
      userId: context.user.userId
    });
    resultSignedOffAt = signedOffAt ? signedOffAt.toISOString() : null;
    resultSignoffStatus = signoffStatus;
  });
  return {
    controlId: input.controlId,
    framework: input.framework,
    signedOffAt: resultSignedOffAt,
    signoffStatus: resultSignoffStatus
  };
}

export function createComplianceGovernanceServices(
  deps: RuntimeServiceDeps
): ComplianceGovernanceServices {
  const { prisma } = deps;
  return {
    async getComplianceGovernance(context, framework) {
      return buildInventory(deps, context.tenant.tenantId, framework);
    },

    async getComplianceGovernanceSummary(context) {
      return buildMultiFrameworkSummary(deps, context.tenant.tenantId);
    },

    async updateComplianceControlGovernance(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "govern compliance controls"
      );
      const now = new Date();
      await applyGovernanceUpdate(deps, context, input, now);
      return buildInventory(deps, context.tenant.tenantId, input.framework, now);
    },

    async batchUpdateComplianceGovernance(
      context,
      input: BatchComplianceGovernanceInput
    ): Promise<BatchComplianceGovernanceResult> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "govern compliance controls"
      );
      const now = new Date();
      const results = [];
      for (const item of input.items) {
        results.push(await applyGovernanceUpdate(deps, context, item, now));
      }
      await writeAuditEvent(prisma, {
        action: "compliance.governance.updated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          batch: true,
          itemCount: input.items.length,
          notCertificationAcknowledged: input.notCertificationAcknowledged,
          frameworks: [...new Set(input.items.map((item) => item.framework))]
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      const summary = await buildMultiFrameworkSummary(
        deps,
        context.tenant.tenantId,
        now
      );
      return BatchComplianceGovernanceResultSchema.parse({
        notCertification: true,
        results,
        summary
      });
    },

    async exportMultiFrameworkCompliancePacks(
      context,
      input: MultiFrameworkComplianceExportInput
    ): Promise<MultiFrameworkComplianceExportResult> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "export multi-framework compliance packs"
      );
      await requireCapability(prisma, context, "EvidencePacks");
      const snapshot = await loadValidationSnapshot(
        prisma,
        context,
        input.snapshotId
      );
      if (!snapshot) {
        throw new AppServiceError(
          "Snapshot not found.",
          404,
          "snapshot_not_found"
        );
      }
      const frameworks = [...new Set(input.frameworks)];
      const packs = [];
      for (const framework of frameworks) {
        const { catalog, version } = getFramework(framework);
        const inventory = await buildInventory(
          deps,
          context.tenant.tenantId,
          framework
        );
        const pack = await createReportPackFromSnapshot({
          audience: input.audience ?? "Auditor",
          context,
          packType: framework,
          prisma,
          snapshot,
          title:
            input.titlePrefix != null
              ? `${input.titlePrefix} — ${catalog.displayName}`
              : `${catalog.displayName} multi-framework evidence support`
        });
        packs.push({
          catalogVersion: version.catalogVersion,
          displayName: catalog.displayName,
          evidencePackId: pack.evidencePackId,
          framework,
          governance: {
            approved: inventory.summary.approved,
            total: inventory.summary.total
          },
          packType: framework,
          partialCatalog: true as const
        });
      }
      await writeAuditEvent(prisma, {
        action: "compliance.governance.updated",
        actorType: "User",
        entityId: packs[0]?.evidencePackId ?? input.snapshotId,
        entityType: "EvidencePack",
        metadata: {
          multiFrameworkExport: true,
          frameworks,
          packCount: packs.length,
          notCertification: true,
          scorecardId: 80,
          snapshotId: input.snapshotId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return MultiFrameworkComplianceExportResultSchema.parse({
        disclaimer: COMPLIANCE_PACK_DISCLAIMER,
        notCertification: true,
        packs,
        scorecardId: 80,
        snapshotId: input.snapshotId,
        tenantId: context.tenant.tenantId
      });
    },

    async listComplianceGovernanceChanges(context, framework, controlId) {
      getFramework(framework);
      const changes = await prisma.complianceGovernanceChange.findMany({
        include: {
          governance: { select: { controlId: true, framework: true } }
        },
        orderBy: { changedAt: "desc" },
        where: {
          governance: {
            controlId: controlId ? controlId : undefined,
            framework,
            tenantId: context.tenant.tenantId
          },
          tenantId: context.tenant.tenantId
        }
      });
      return changes.map((change) =>
        ComplianceGovernanceChangeSchema.parse({
          action: change.action,
          afterState: change.afterState,
          beforeState: change.beforeState,
          changedAt: change.changedAt.toISOString(),
          changedBy: change.changedBy,
          complianceGovernanceChangeId:
            change.complianceGovernanceChangeId,
          controlId: change.governance.controlId,
          framework: change.governance.framework,
          tenantId: change.tenantId
        })
      );
    }
  };
}
