import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  Membership,
  MembershipRole,
  Tenant,
  TenantType,
  User,
  UserStatus
} from "@prisma/client";

import { createCoreRepositories } from "./repositories.js";

function createInMemoryPrisma() {
  const tenants = new Map<string, Tenant>();
  const users = new Map<string, User>();
  const usersByEmail = new Map<string, User>();
  const memberships = new Map<string, Membership>();

  return {
    membership: {
      create: async ({
        data
      }: {
        data: {
          membershipId?: string;
          role: MembershipRole;
          tenantId: string;
          userId: string;
        };
      }) => {
        const record: Membership = {
          createdAt: new Date(),
          experienceProfileCompletedAt: null,
          membershipId: data.membershipId ?? randomUUID(),
          primaryOutcome: null,
          productPersona: null,
          role: data.role,
          tenantId: data.tenantId,
          updatedAt: new Date(),
          userId: data.userId
        };

        memberships.set(record.membershipId, record);

        return record;
      },
      findMany: async ({
        where
      }: {
        orderBy: {
          createdAt: "asc" | "desc";
        };
        where: {
          tenantId: string;
        };
      }) =>
        [...memberships.values()]
          .filter((membership) => membership.tenantId === where.tenantId)
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime()
          )
    },
    tenant: {
      create: async ({
        data
      }: {
        data: {
          billingAccountId: string | null;
          dataRegion: string;
          name: string;
          parentTenantId: string | null;
          tenantId?: string;
          type: TenantType;
        };
      }) => {
        const record: Tenant = {
          billingAccountId: data.billingAccountId,
          billingPackageKey: "ValidationSnapshot",
          createdAt: new Date(),
          dataRegion: data.dataRegion,
          name: data.name,
          nextThreatFeedIngestAt: null,
          preferredLocale: "en-US",
          preferredTimeZone: "UTC",
          trialActivatedBy: null,
          trialCancellationReason: null,
          trialCancelledAt: null,
          trialConversionApprovalRef: null,
          trialConvertedAt: null,
          trialDeletionScheduledAt: null,
          trialEndsAt: null,
          trialPreviousBillingPackageKey: null,
          trialRetentionDays: 30,
          trialStartedAt: null,
          trialStatus: "NotStarted",
          modelGatewayKillSwitchActive: false,
          modelGatewayKillSwitchReason: null,
          modelGatewayKillSwitchActivatedAt: null,
          modelGatewayKillSwitchActivatedBy: null,
          destructiveValidationAuthorizationRef: null,
          destructiveValidationAuthorizedAt: null,
          destructiveValidationAuthorizedBy: null,
          destructiveValidationEnabled: false,
          offensiveValidationAuthorizationRef: null,
          offensiveValidationAuthorizedAt: null,
          offensiveValidationAuthorizedBy: null,
          offensiveValidationEnabled: false,
          parentTenantId: data.parentTenantId,
          requireMfa: false,
          tenantId: data.tenantId ?? randomUUID(),
          threatFeedFrequency: null,
          type: data.type,
          updatedAt: new Date()
        };

        tenants.set(record.tenantId, record);

        return record;
      },
      findUnique: async ({
        where
      }: {
        where: {
          tenantId: string;
        };
      }) => tenants.get(where.tenantId) ?? null
    },
    user: {
      create: async ({
        data
      }: {
        data: {
          email: string;
          name: string;
          passwordHash?: string | null;
          status: UserStatus;
          userId?: string;
        };
      }) => {
        const record: User = {
          createdAt: new Date(),
          email: data.email,
          emailVerifiedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
          mfaEnabledAt: null,
          mfaSecret: null,
          name: data.name,
          passwordHash: data.passwordHash ?? null,
          sessionVersion: 0,
          status: data.status,
          updatedAt: new Date(),
          userId: data.userId ?? randomUUID()
        };

        users.set(record.userId, record);
        usersByEmail.set(record.email, record);

        return record;
      },
      findUnique: async ({
        where
      }: {
        where: {
          email: string;
        };
      }) => usersByEmail.get(where.email) ?? null
    }
  };
}

describe("createCoreRepositories", () => {
  it("can create and read tenant-scoped core entities", async () => {
    const prisma = createInMemoryPrisma();
    const repositories = createCoreRepositories(prisma as never);

    const tenant = await repositories.createTenant({
      dataRegion: "us-east-1",
      name: "Demo Tenant",
      type: "Organization"
    });
    const user = await repositories.createUser({
      email: "demo@periscan.local",
      name: "Demo User"
    });

    await repositories.createMembership({
      role: "Owner",
      tenantId: tenant.tenantId,
      userId: user.userId
    });

    expect(await repositories.findTenantById(tenant.tenantId)).toMatchObject({
      name: "Demo Tenant",
      tenantId: tenant.tenantId
    });
    expect(await repositories.findUserByEmail(user.email)).toMatchObject({
      email: "demo@periscan.local"
    });
    expect(
      await repositories.listMembershipsByTenant(tenant.tenantId)
    ).toHaveLength(1);
  });
});
