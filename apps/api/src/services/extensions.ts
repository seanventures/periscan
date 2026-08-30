import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import {
  evaluateExtensionCompatibility,
  generateExtensionScaffold
} from "@periscan/modules";
import {
  ExtensionCompatibilityReportSchema,
  ExtensionDeveloperWorkspaceSchema,
  ExtensionExecutionContractSchema,
  ExtensionProjectSchema,
  ExtensionReleaseSchema,
  type ExtensionProject,
  type ExtensionRelease,
  type MembershipRole
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const EXTENSION_ADMIN_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);
const EXTENSION_DEVELOPER_ROLES = new Set<MembershipRole>([
  ...EXTENSION_ADMIN_ROLES,
  "SecurityEngineer"
]);

function serializeProject(record: {
  activeReleaseId: string | null;
  createdAt: Date;
  createdBy: string;
  description: string;
  displayName: string;
  extensionProjectId: string;
  licenseSpdx: string;
  packageName: string;
  repositoryUrl: string;
  status: string;
  supportUrl: string;
  tenantId: string;
  updatedAt: Date;
}): ExtensionProject {
  return ExtensionProjectSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializeRelease(record: {
  activatedAt: Date | null;
  activatedBy: string | null;
  activationReason: string | null;
  capabilities: string[];
  certifiedAt: Date | null;
  certifiedBy: string | null;
  certificationReason: string | null;
  compatible: boolean;
  compatibilityReport: Prisma.JsonValue;
  contract: Prisma.JsonValue;
  contractDigest: string;
  createdAt: Date;
  createdBy: string;
  executionAuthorized: boolean;
  extensionProjectId: string;
  extensionReleaseId: string;
  imageDigest: string;
  imageReference: string;
  networkAllowlist: string[];
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  signerIdentity: string;
  signerPublicKeySha256: string;
  status: string;
  tenantId: string;
  updatedAt: Date;
  version: string;
}): ExtensionRelease {
  return ExtensionReleaseSchema.parse({
    ...record,
    activatedAt: record.activatedAt?.toISOString() ?? null,
    certifiedAt: record.certifiedAt?.toISOString() ?? null,
    compatibilityReport: ExtensionCompatibilityReportSchema.parse(
      record.compatibilityReport
    ),
    contract: ExtensionExecutionContractSchema.parse(record.contract),
    createdAt: record.createdAt.toISOString(),
    executionAuthorized: false,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString()
  });
}

export function createExtensionServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "activateExtensionRelease"
  | "createExtensionProject"
  | "getExtensionDeveloperWorkspace"
  | "getExtensionScaffold"
  | "reviewExtensionRelease"
  | "revokeExtensionRelease"
  | "rollbackExtensionProject"
  | "submitExtensionRelease"
> {
  const { prisma } = deps;

  return {
    async getExtensionDeveloperWorkspace(context) {
      const [projects, releases] = await Promise.all([
        prisma.extensionProject.findMany({
          orderBy: { updatedAt: "desc" },
          where: { tenantId: context.tenant.tenantId }
        }),
        prisma.extensionRelease.findMany({
          orderBy: { createdAt: "desc" },
          where: { tenantId: context.tenant.tenantId }
        })
      ]);
      return ExtensionDeveloperWorkspaceSchema.parse({
        generatedAt: new Date().toISOString(),
        projects: projects.map(serializeProject),
        releases: releases.map(serializeRelease),
        summary: {
          activeCatalogReleases: releases.filter(
            (release) => release.status === "CatalogActive"
          ).length,
          certifiedReleases: releases.filter((release) =>
            ["Certified", "CatalogActive", "Superseded"].includes(
              release.status
            )
          ).length,
          compatibilityFailures: releases.filter(
            (release) => release.status === "CompatibilityFailed"
          ).length,
          projects: projects.length,
          revokedReleases: releases.filter(
            (release) => release.status === "Revoked"
          ).length,
          runtimeExecutionAuthorized: 0
        }
      });
    },

    async createExtensionProject(context, input) {
      requireRole(
        context.membership.role,
        EXTENSION_DEVELOPER_ROLES,
        "create extension projects"
      );
      const existing = await prisma.extensionProject.findFirst({
        where: {
          packageName: input.packageName,
          tenantId: context.tenant.tenantId
        }
      });
      if (existing) {
        throw new AppServiceError(
          "An extension project already uses this package name.",
          409,
          "extension_package_name_exists"
        );
      }
      const project = await prisma.extensionProject.create({
        data: {
          createdBy: context.user.userId,
          description: input.description,
          displayName: input.displayName,
          licenseSpdx: input.licenseSpdx,
          packageName: input.packageName,
          repositoryUrl: input.repositoryUrl,
          supportUrl: input.supportUrl,
          tenantId: context.tenant.tenantId
        }
      });
      await writeAuditEvent(prisma, {
        action: "extension.project_created",
        actorType: "User",
        entityId: project.extensionProjectId,
        entityType: "ThirdPartyTool",
        metadata: {
          licenseSpdx: project.licenseSpdx,
          packageName: project.packageName,
          runtimeExecutionAuthorized: false
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeProject(project);
    },

    async getExtensionScaffold(context, projectId) {
      requireRole(
        context.membership.role,
        EXTENSION_DEVELOPER_ROLES,
        "generate extension scaffolds"
      );
      const project = await prisma.extensionProject.findFirst({
        where: {
          extensionProjectId: projectId,
          status: "Active",
          tenantId: context.tenant.tenantId
        }
      });
      if (!project) {
        throw new AppServiceError(
          "Active extension project not found.",
          404,
          "extension_project_not_found"
        );
      }
      return generateExtensionScaffold(serializeProject(project));
    },

    async submitExtensionRelease(context, projectId, input) {
      requireRole(
        context.membership.role,
        EXTENSION_DEVELOPER_ROLES,
        "submit extension releases"
      );
      const project = await prisma.extensionProject.findFirst({
        where: {
          extensionProjectId: projectId,
          status: "Active",
          tenantId: context.tenant.tenantId
        }
      });
      if (!project) {
        throw new AppServiceError(
          "Active extension project not found.",
          404,
          "extension_project_not_found"
        );
      }
      if (input.contract.packageName !== project.packageName) {
        throw new AppServiceError(
          "The signed contract package name does not match the extension project.",
          400,
          "extension_package_name_mismatch"
        );
      }
      const existingVersion = await prisma.extensionRelease.findFirst({
        where: {
          extensionProjectId: projectId,
          version: input.version
        }
      });
      if (existingVersion) {
        throw new AppServiceError(
          "This immutable extension version has already been submitted.",
          409,
          "extension_version_exists"
        );
      }
      const report = evaluateExtensionCompatibility(input.contract);
      const duplicateDigest = await prisma.extensionRelease.findFirst({
        where: {
          contractDigest: report.contractDigest,
          tenantId: context.tenant.tenantId
        }
      });
      if (duplicateDigest) return serializeRelease(duplicateDigest);
      const release = await prisma.extensionRelease.create({
        data: {
          capabilities: input.contract.capabilities,
          compatibilityReport: report as Prisma.InputJsonValue,
          compatible: report.compatible,
          contract: input.contract as Prisma.InputJsonValue,
          contractDigest: report.contractDigest,
          createdBy: context.user.userId,
          extensionProjectId: projectId,
          imageDigest: input.contract.imageDigest,
          imageReference: input.contract.imageReference,
          networkAllowlist: input.contract.networkAllowlist,
          signerIdentity: input.contract.signerIdentity,
          signerPublicKeySha256: createHash("sha256")
            .update(input.contract.signerPublicKeyPem)
            .digest("hex"),
          status: report.compatible ? "Compatible" : "CompatibilityFailed",
          tenantId: context.tenant.tenantId,
          version: input.version
        }
      });
      await writeAuditEvent(prisma, {
        action: "extension.release_submitted",
        actorType: "User",
        entityId: release.extensionReleaseId,
        entityType: "ThirdPartyTool",
        metadata: {
          compatible: report.compatible,
          contractDigest: report.contractDigest,
          executionAuthorized: false,
          extensionProjectId: projectId,
          version: input.version
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeRelease(release);
    },

    async reviewExtensionRelease(context, releaseId, input) {
      requireRole(
        context.membership.role,
        EXTENSION_ADMIN_ROLES,
        "review extension releases"
      );
      const release = await prisma.extensionRelease.findFirst({
        where: {
          extensionReleaseId: releaseId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!release) {
        throw new AppServiceError(
          "Extension release not found.",
          404,
          "extension_release_not_found"
        );
      }
      if (release.status !== "Compatible") {
        throw new AppServiceError(
          "Only a compatible, unreviewed release can receive a certification decision.",
          409,
          "extension_release_not_reviewable"
        );
      }
      const report = ExtensionCompatibilityReportSchema.parse(
        release.compatibilityReport
      );
      if (input.decision === "Certify" && !report.compatible) {
        throw new AppServiceError(
          "A failed compatibility report cannot be certified.",
          409,
          "extension_compatibility_required"
        );
      }
      const reviewedAt = new Date();
      const reviewed = await prisma.extensionRelease.update({
        data: {
          certificationReason: input.reason,
          certifiedAt: input.decision === "Certify" ? reviewedAt : null,
          certifiedBy:
            input.decision === "Certify" ? context.user.userId : null,
          status: input.decision === "Certify" ? "Certified" : "Rejected"
        },
        where: { extensionReleaseId: releaseId }
      });
      await writeAuditEvent(prisma, {
        action: "extension.release_reviewed",
        actorType: "User",
        entityId: releaseId,
        entityType: "ThirdPartyTool",
        metadata: {
          decision: input.decision,
          executionAuthorized: false,
          reason: input.reason,
          version: release.version
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeRelease(reviewed);
    },

    async activateExtensionRelease(context, releaseId, input) {
      requireRole(
        context.membership.role,
        EXTENSION_ADMIN_ROLES,
        "activate extension catalog releases"
      );
      const release = await prisma.extensionRelease.findFirst({
        where: {
          extensionReleaseId: releaseId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!release) {
        throw new AppServiceError(
          "Extension release not found.",
          404,
          "extension_release_not_found"
        );
      }
      if (release.status !== "Certified" || !release.certifiedAt) {
        throw new AppServiceError(
          "Only a certified release can become the tenant's active catalog version.",
          409,
          "extension_certification_required"
        );
      }
      const activatedAt = new Date();
      const activated = await prisma.$transaction(async (tx) => {
        const project = await tx.extensionProject.findFirst({
          where: {
            extensionProjectId: release.extensionProjectId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!project) {
          throw new AppServiceError(
            "Extension project not found.",
            404,
            "extension_project_not_found"
          );
        }
        if (project.activeReleaseId) {
          await tx.extensionRelease.updateMany({
            data: { status: "Superseded" },
            where: {
              extensionReleaseId: project.activeReleaseId,
              status: "CatalogActive",
              tenantId: context.tenant.tenantId
            }
          });
        }
        const updated = await tx.extensionRelease.update({
          data: {
            activatedAt,
            activatedBy: context.user.userId,
            activationReason: input.reason,
            status: "CatalogActive"
          },
          where: { extensionReleaseId: releaseId }
        });
        await tx.extensionProject.update({
          data: { activeReleaseId: releaseId },
          where: { extensionProjectId: release.extensionProjectId }
        });
        return updated;
      });
      await writeAuditEvent(prisma, {
        action: "extension.release_activated",
        actorType: "User",
        entityId: releaseId,
        entityType: "ThirdPartyTool",
        metadata: {
          executionAuthorized: false,
          operation: "Activate",
          reason: input.reason,
          version: release.version
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeRelease(activated);
    },

    async rollbackExtensionProject(context, projectId, input) {
      requireRole(
        context.membership.role,
        EXTENSION_ADMIN_ROLES,
        "roll back extension catalog releases"
      );
      const [project, target] = await Promise.all([
        prisma.extensionProject.findFirst({
          where: {
            extensionProjectId: projectId,
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.extensionRelease.findFirst({
          where: {
            extensionProjectId: projectId,
            extensionReleaseId: input.targetReleaseId,
            tenantId: context.tenant.tenantId
          }
        })
      ]);
      if (!project || !target) {
        throw new AppServiceError(
          "Extension project or rollback release not found.",
          404,
          "extension_rollback_target_not_found"
        );
      }
      if (
        !project.activeReleaseId ||
        project.activeReleaseId === target.extensionReleaseId ||
        target.status !== "Superseded" ||
        !target.certifiedAt
      ) {
        throw new AppServiceError(
          "Rollback requires a different previously certified, superseded release.",
          409,
          "extension_rollback_not_allowed"
        );
      }
      const rolledBackAt = new Date();
      const rolledBack = await prisma.$transaction(async (tx) => {
        await tx.extensionRelease.updateMany({
          data: { status: "Superseded" },
          where: {
            extensionReleaseId: project.activeReleaseId!,
            status: "CatalogActive",
            tenantId: context.tenant.tenantId
          }
        });
        const updated = await tx.extensionRelease.update({
          data: {
            activatedAt: rolledBackAt,
            activatedBy: context.user.userId,
            activationReason: input.reason,
            status: "CatalogActive"
          },
          where: { extensionReleaseId: target.extensionReleaseId }
        });
        await tx.extensionProject.update({
          data: { activeReleaseId: target.extensionReleaseId },
          where: { extensionProjectId: projectId }
        });
        return updated;
      });
      await writeAuditEvent(prisma, {
        action: "extension.release_activated",
        actorType: "User",
        entityId: target.extensionReleaseId,
        entityType: "ThirdPartyTool",
        metadata: {
          executionAuthorized: false,
          fromReleaseId: project.activeReleaseId,
          operation: "Rollback",
          reason: input.reason,
          version: target.version
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeRelease(rolledBack);
    },

    async revokeExtensionRelease(context, releaseId, input) {
      requireRole(
        context.membership.role,
        EXTENSION_ADMIN_ROLES,
        "revoke extension releases"
      );
      const release = await prisma.extensionRelease.findFirst({
        where: {
          extensionReleaseId: releaseId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!release) {
        throw new AppServiceError(
          "Extension release not found.",
          404,
          "extension_release_not_found"
        );
      }
      if (release.status === "Revoked") return serializeRelease(release);
      const revokedAt = new Date();
      const revoked = await prisma.$transaction(async (tx) => {
        const updated = await tx.extensionRelease.update({
          data: {
            revokedAt,
            revokedBy: context.user.userId,
            revocationReason: input.reason,
            status: "Revoked"
          },
          where: { extensionReleaseId: releaseId }
        });
        await tx.extensionProject.updateMany({
          data: { activeReleaseId: null },
          where: {
            activeReleaseId: releaseId,
            extensionProjectId: release.extensionProjectId,
            tenantId: context.tenant.tenantId
          }
        });
        return updated;
      });
      await writeAuditEvent(prisma, {
        action: "extension.release_revoked",
        actorType: "User",
        entityId: releaseId,
        entityType: "ThirdPartyTool",
        metadata: {
          executionAuthorized: false,
          reason: input.reason,
          version: release.version
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeRelease(revoked);
    }
  };
}
