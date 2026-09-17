import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";
import {
  NonHumanIdentityInventorySchema,
  NonHumanIdentitySchema,
  type NonHumanIdentity,
  type NonHumanIdentityInventory,
  type NonHumanIdentityRiskFlag,
  type NonHumanIdentityRiskLevel,
  type RegisterNonHumanIdentityInput
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type NonHumanIdentityServices = Pick<
  AppServices,
  "listNonHumanIdentities" | "registerNonHumanIdentity"
>;

const DAY_MS = 24 * 60 * 60 * 1_000;
const STALE_DAYS = 90;

export function assessNonHumanIdentityRisk(
  input: Pick<
    RegisterNonHumanIdentityInput,
    | "environment"
    | "expiresAt"
    | "lastUsedAt"
    | "owner"
    | "privileges"
    | "publicExposure"
    | "resourceAccess"
    | "rotatedAt"
  >,
  now = new Date()
): {
  flags: NonHumanIdentityRiskFlag[];
  level: NonHumanIdentityRiskLevel;
  rationales: string[];
  score: number;
} {
  const flags: NonHumanIdentityRiskFlag[] = [];
  const rationales: string[] = [];
  let score = 0;
  const add = (
    flag: NonHumanIdentityRiskFlag,
    points: number,
    rationale: string
  ) => {
    if (!flags.includes(flag)) flags.push(flag);
    score += points;
    rationales.push(rationale);
  };

  if (!input.owner) {
    add("Orphaned", 25, "No accountable owner is recorded.");
  }

  const elevatedPrivilege = (input.privileges ?? []).some((privilege) =>
    /(^|[.:/_-])(admin|owner|root|write|manage|\*)([.:/_-]|$)/iu.test(privilege)
  );
  if (elevatedPrivilege) {
    add(
      "OverPrivileged",
      20,
      "At least one privilege grants administrative, ownership, management, wildcard, or write access."
    );
  }

  if (input.publicExposure) {
    add("PubliclyExposed", 25, "The identity is usable from a public endpoint.");
  }

  if (!input.lastUsedAt) {
    add("UnknownLastUse", 8, "The source did not provide a last-used timestamp.");
  } else if (now.getTime() - new Date(input.lastUsedAt).getTime() > STALE_DAYS * DAY_MS) {
    add("Stale", 20, `The identity has not been used for more than ${STALE_DAYS} days.`);
  }

  if (!input.rotatedAt) {
    add("UnknownRotation", 7, "The source did not provide a rotation timestamp.");
  } else if (now.getTime() - new Date(input.rotatedAt).getTime() > STALE_DAYS * DAY_MS) {
    add("RotationOverdue", 15, `The credential has not been rotated for more than ${STALE_DAYS} days.`);
  }

  if (input.expiresAt && new Date(input.expiresAt).getTime() < now.getTime()) {
    add("Expired", 30, "The recorded expiration time has passed.");
  }

  const accessEnvironments = new Set(
    (input.resourceAccess ?? [])
      .map((access) => access.environment?.toLocaleLowerCase())
      .filter((environment): environment is string => Boolean(environment))
  );
  const declaredEnvironment = input.environment?.toLocaleLowerCase();
  if (
    accessEnvironments.size > 1 ||
    (declaredEnvironment &&
      [...accessEnvironments].some(
        (environment) => environment !== declaredEnvironment
      ))
  ) {
    add(
      "CrossEnvironment",
      15,
      "The identity reaches resources across more than one declared environment."
    );
  }

  score = Math.min(score, 100);
  const level: NonHumanIdentityRiskLevel =
    score >= 75
      ? "Critical"
      : score >= 50
        ? "High"
        : score >= 25
          ? "Medium"
          : "Low";
  return { flags, level, rationales, score };
}

function serializeNonHumanIdentity(record: {
  credentialFingerprint: string | null;
  createdAt: Date;
  displayName: string;
  environment: string | null;
  evidenceIds: unknown;
  expiresAt: Date | null;
  externalIdHash: string;
  identityType: string;
  lastUsedAt: Date | null;
  nonHumanIdentityId: string;
  owner: string | null;
  privileges: unknown;
  provider: string;
  publicExposure: boolean;
  repository: string | null;
  resourceAccess: unknown;
  riskFlags: unknown;
  riskLevel: string;
  riskRationales: unknown;
  riskScore: number;
  rotatedAt: Date | null;
  sourceIntegrationId: string | null;
  tenantId: string;
  updatedAt: Date;
}): NonHumanIdentity {
  return NonHumanIdentitySchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    rotatedAt: record.rotatedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString()
  });
}

function summarize(identities: NonHumanIdentity[]): NonHumanIdentityInventory {
  const has = (identity: NonHumanIdentity, flag: NonHumanIdentityRiskFlag) =>
    identity.riskFlags.includes(flag);
  return NonHumanIdentityInventorySchema.parse({
    identities,
    summary: {
      critical: identities.filter((identity) => identity.riskLevel === "Critical")
        .length,
      high: identities.filter((identity) => identity.riskLevel === "High").length,
      orphaned: identities.filter((identity) => has(identity, "Orphaned")).length,
      overPrivileged: identities.filter((identity) =>
        has(identity, "OverPrivileged")
      ).length,
      publiclyExposed: identities.filter((identity) =>
        has(identity, "PubliclyExposed")
      ).length,
      stale: identities.filter((identity) => has(identity, "Stale")).length,
      total: identities.length
    }
  });
}

export function createNonHumanIdentityServices(
  deps: RuntimeServiceDeps
): NonHumanIdentityServices {
  const { prisma } = deps;

  return {
    async listNonHumanIdentities(context) {
      const records = await prisma.nonHumanIdentity.findMany({
        orderBy: [{ riskScore: "desc" }, { updatedAt: "desc" }],
        where: { tenantId: context.tenant.tenantId }
      });
      return summarize(records.map(serializeNonHumanIdentity));
    },

    async registerNonHumanIdentity(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "register non-human identities"
      );
      if (input.sourceIntegrationId) {
        const integration = await prisma.integration.findFirst({
          select: { integrationId: true },
          where: {
            integrationId: input.sourceIntegrationId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!integration) {
          throw new AppServiceError(
            "Source integration not found for this tenant.",
            404,
            "non_human_identity_integration_not_found"
          );
        }
      }

      const provider = input.provider.trim();
      const externalIdHash = createHash("sha256")
        .update(
          `${context.tenant.tenantId}\u0000${provider.toLocaleLowerCase()}\u0000${input.externalId.trim()}`
        )
        .digest("hex");
      const risk = assessNonHumanIdentityRisk(input);
      const data = {
        credentialFingerprint: input.credentialFingerprint ?? null,
        displayName: input.displayName,
        environment: input.environment ?? null,
        evidenceIds: input.evidenceIds as Prisma.InputJsonValue,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        identityType: input.identityType,
        lastUsedAt: input.lastUsedAt ? new Date(input.lastUsedAt) : null,
        owner: input.owner ?? null,
        privileges: [...new Set(input.privileges ?? [])].sort() as Prisma.InputJsonValue,
        provider,
        publicExposure: input.publicExposure,
        repository: input.repository ?? null,
        resourceAccess: (input.resourceAccess ?? []) as Prisma.InputJsonValue,
        riskFlags: risk.flags as Prisma.InputJsonValue,
        riskLevel: risk.level,
        riskRationales: risk.rationales as Prisma.InputJsonValue,
        riskScore: risk.score,
        rotatedAt: input.rotatedAt ? new Date(input.rotatedAt) : null,
        sourceIntegrationId: input.sourceIntegrationId ?? null
      };

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.nonHumanIdentity.findFirst({
          select: { nonHumanIdentityId: true },
          where: {
            externalIdHash,
            provider,
            tenantId: context.tenant.tenantId
          }
        });
        const record = existing
          ? await tx.nonHumanIdentity.update({
              data,
              where: { nonHumanIdentityId: existing.nonHumanIdentityId }
            })
          : await tx.nonHumanIdentity.create({
              data: {
                ...data,
                externalIdHash,
                tenantId: context.tenant.tenantId
              }
            });
        await writeAuditEvent(tx, {
          action: existing
            ? "non_human_identity.updated"
            : "non_human_identity.registered",
          actorType: "User",
          entityId: record.nonHumanIdentityId,
          entityType: "NonHumanIdentity",
          metadata: {
            identityType: record.identityType,
            provider: record.provider,
            riskFlags: risk.flags,
            riskLevel: risk.level,
            riskScore: risk.score,
            secretStored: false
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return record;
      });
      return serializeNonHumanIdentity(result);
    }
  };
}
