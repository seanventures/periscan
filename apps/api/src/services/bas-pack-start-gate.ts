import { runWithTenantRls } from "@periscan/db";
import {
  AuthorizeBasPackInputSchema,
  AuthorizeBasPackResultSchema,
  DangerOperatorGateSchema,
  QualifyBasPackInputSchema,
  QualifyBasPackResultSchema,
  StoredBasPackQualificationSchema,
  StoredTenantBasPackAuthorizationSchema,
  listDangerCatalog,
  tenantBasPackAuthorizationDigest,
  type AuthorizeBasPackResult,
  type DangerOperatorGate,
  type QualifyBasPackResult,
  type StoredBasPackQualification,
  type StoredTenantBasPackAuthorization
} from "@periscan/shared";
import { Prisma } from "@prisma/client";

import {
  AppServiceError,
  BAS_PACK_OWNER_ROLES,
  requireRole,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

export function serializeBasPackQualification(record: {
  basPackQualificationId: string;
  labReceiptHash: string;
  pack: string;
  pinIds: string[];
  qualifiedAt: Date;
  qualifiedByUserId: string;
  tenantId: string;
}): StoredBasPackQualification {
  return StoredBasPackQualificationSchema.parse({
    basPackQualificationId: record.basPackQualificationId,
    labReceiptHash: record.labReceiptHash,
    pack: record.pack,
    pinIds: record.pinIds,
    qualifiedAt: record.qualifiedAt.toISOString(),
    qualifiedByUserId: record.qualifiedByUserId,
    tenantId: record.tenantId
  });
}

export function serializeTenantBasPackAuthorization(record: {
  approverUserId: string;
  digest: string;
  expiresAt: Date;
  pack: string;
  scopeId: string;
  tenantBasPackAuthorizationId: string;
  tenantId: string;
}): StoredTenantBasPackAuthorization {
  return StoredTenantBasPackAuthorizationSchema.parse({
    approver: record.approverUserId,
    digest: record.digest,
    expiresAt: record.expiresAt.toISOString(),
    pack: record.pack,
    scopeId: record.scopeId,
    tenantBasPackAuthorizationId: record.tenantBasPackAuthorizationId,
    tenantId: record.tenantId
  });
}

export function createBasPackStartGateServices({
  prisma
}: Pick<RuntimeServiceDeps, "prisma">): Pick<
  AppServices,
  "authorizeBasPack" | "getBasDangerOperatorGate" | "qualifyBasPack"
> {
  return {
    async getBasDangerOperatorGate(context): Promise<DangerOperatorGate> {
      const tenantId = context.tenant.tenantId;
      const now = new Date();
      return runWithTenantRls(prisma, tenantId, async (tx) => {
        const [qualifications, authorizations] = await Promise.all([
          tx.basPackQualification.findMany({
            select: { pack: true },
            where: { tenantId }
          }),
          tx.tenantBasPackAuthorization.findMany({
            select: { expiresAt: true },
            where: { expiresAt: { gt: now }, tenantId }
          })
        ]);
        return DangerOperatorGateSchema.parse({
          available: true,
          items: listDangerCatalog(),
          qualified: qualifications.length > 0,
          tenantAuthorized: authorizations.length > 0
        });
      });
    },

    async qualifyBasPack(context, rawInput): Promise<QualifyBasPackResult> {
      requireRole(
        context.membership.role,
        BAS_PACK_OWNER_ROLES,
        "qualify BAS live packs"
      );
      const input = QualifyBasPackInputSchema.parse(rawInput);
      const tenantId = context.tenant.tenantId;
      try {
        return await runWithTenantRls(prisma, tenantId, async (tx) => {
          const existing = await tx.basPackQualification.findFirst({
            where: {
              labReceiptHash: input.labReceiptHash,
              pack: input.pack,
              tenantId
            }
          });
          if (existing) {
            return QualifyBasPackResultSchema.parse({
              created: false,
              qualification: serializeBasPackQualification(existing)
            });
          }
          const created = await tx.basPackQualification.create({
            data: {
              labReceiptHash: input.labReceiptHash,
              pack: input.pack,
              pinIds: input.pinIds,
              qualifiedByUserId: context.user.userId,
              tenantId
            }
          });
          await writeAuditEvent(tx, {
            action: "bas.pack_qualified",
            actorType: "User",
            entityId: created.basPackQualificationId,
            entityType: "Scenario",
            metadata: {
              labReceiptHash: created.labReceiptHash,
              liveSupported: false,
              pack: created.pack,
              pinIds: created.pinIds
            },
            tenantId,
            userId: context.user.userId
          });
          return QualifyBasPackResultSchema.parse({
            created: true,
            qualification: serializeBasPackQualification(created)
          });
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }
        const winner = await runWithTenantRls(prisma, tenantId, (tx) =>
          tx.basPackQualification.findFirst({
            where: {
              labReceiptHash: input.labReceiptHash,
              pack: input.pack,
              tenantId
            }
          })
        );
        if (!winner) {
          throw error;
        }
        return QualifyBasPackResultSchema.parse({
          created: false,
          qualification: serializeBasPackQualification(winner)
        });
      }
    },

    async authorizeBasPack(context, rawInput): Promise<AuthorizeBasPackResult> {
      requireRole(
        context.membership.role,
        BAS_PACK_OWNER_ROLES,
        "authorize BAS live packs"
      );
      const input = AuthorizeBasPackInputSchema.parse(rawInput);
      const tenantId = context.tenant.tenantId;
      const expiresAt = new Date(input.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new AppServiceError(
          "BAS pack authorization must expire in the future.",
          400,
          "bas_pack_authorization_expired"
        );
      }
      const scope = await prisma.scope.findFirst({
        where: { scopeId: input.scopeId, tenantId }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      if (scope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Verified scope is required before a BAS live pack can be authorized.",
          400,
          "scope_not_verified"
        );
      }
      const digest = tenantBasPackAuthorizationDigest({
        approver: context.user.userId,
        expiresAt: expiresAt.toISOString(),
        pack: input.pack,
        scopeId: scope.scopeId,
        tenantId
      });
      try {
        return await runWithTenantRls(prisma, tenantId, async (tx) => {
          const existing = await tx.tenantBasPackAuthorization.findFirst({
            where: { digest, pack: input.pack, scopeId: scope.scopeId, tenantId }
          });
          if (existing) {
            return AuthorizeBasPackResultSchema.parse({
              authorization: serializeTenantBasPackAuthorization(existing),
              created: false
            });
          }
          const created = await tx.tenantBasPackAuthorization.create({
            data: {
              approverUserId: context.user.userId,
              digest,
              expiresAt,
              pack: input.pack,
              scopeId: scope.scopeId,
              tenantId
            }
          });
          await writeAuditEvent(tx, {
            action: "bas.pack_authorized",
            actorType: "User",
            entityId: created.tenantBasPackAuthorizationId,
            entityType: "Scope",
            metadata: {
              digest,
              expiresAt: created.expiresAt.toISOString(),
              liveSupported: false,
              pack: created.pack,
              scopeId: created.scopeId
            },
            tenantId,
            userId: context.user.userId
          });
          return AuthorizeBasPackResultSchema.parse({
            authorization: serializeTenantBasPackAuthorization(created),
            created: true
          });
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        ) {
          throw error;
        }
        const winner = await runWithTenantRls(prisma, tenantId, (tx) =>
          tx.tenantBasPackAuthorization.findFirst({
            where: { digest, pack: input.pack, scopeId: scope.scopeId, tenantId }
          })
        );
        if (!winner) {
          throw error;
        }
        return AuthorizeBasPackResultSchema.parse({
          authorization: serializeTenantBasPackAuthorization(winner),
          created: false
        });
      }
    }
  };
}
