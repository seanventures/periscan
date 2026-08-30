import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import type { RuntimeServiceDeps } from "./runtime-services.js";
import { createTenantServices } from "./services/tenant.js";

describe("last-owner demotion/removal Serializable guard", () => {
  const tenantId = randomUUID();
  const actorUserId = randomUUID();
  const ownerMembershipId = randomUUID();
  const ownerUserId = randomUUID();
  const now = new Date();

  const context = {
    membership: {
      membershipId: randomUUID(),
      role: "Owner" as const,
      tenantId,
      userId: actorUserId
    },
    tenant: { tenantId },
    user: { userId: actorUserId }
  };

  const ownerMembership = {
    createdAt: now,
    experienceProfileCompletedAt: null,
    membershipId: ownerMembershipId,
    primaryOutcome: null,
    productPersona: null,
    role: "Owner" as const,
    tenantId,
    updatedAt: now,
    userId: ownerUserId,
    user: {
      createdAt: now,
      email: "owner@periscan.test",
      emailVerifiedAt: now,
      mfaEnabledAt: null,
      name: "Owner",
      status: "Active",
      updatedAt: now,
      userId: ownerUserId
    }
  };

  function buildServices(input: { ownerCount: number }) {
    const membershipCount = vi.fn().mockResolvedValue(input.ownerCount);
    const membershipUpdate = vi.fn().mockResolvedValue({
      ...ownerMembership,
      role: "Admin",
      updatedAt: now
    });
    const membershipDelete = vi.fn().mockResolvedValue(ownerMembership);
    const auditCreate = vi.fn().mockResolvedValue({});
    const transaction = vi.fn(
      async (
        fn: (tx: unknown) => unknown,
        opts?: { isolationLevel?: string }
      ) => {
        expect(opts).toEqual({ isolationLevel: "Serializable" });
        return fn({
          auditEvent: { create: auditCreate },
          membership: {
            count: membershipCount,
            delete: membershipDelete,
            findFirst: vi.fn().mockResolvedValue(ownerMembership),
            update: membershipUpdate
          }
        });
      }
    );

    const services = createTenantServices({
      availableDataRegions: ["us-east-1"],
      dataRegion: "us-east-1",
      devMode: true,
      emailTransport: { send: vi.fn() },
      prisma: {
        $transaction: transaction
      },
      webBaseUrl: "http://localhost:3000"
    } as unknown as RuntimeServiceDeps);

    return {
      auditCreate,
      membershipCount,
      membershipDelete,
      membershipUpdate,
      services,
      transaction
    };
  }

  it("demotes a non-last Owner inside a Serializable transaction", async () => {
    const { membershipCount, membershipUpdate, services, transaction } =
      buildServices({ ownerCount: 2 });

    const result = await services.updateTenantMemberRole(
      context as never,
      ownerMembershipId,
      "Admin"
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(membershipCount).toHaveBeenCalledWith({
      where: { role: "Owner", tenantId }
    });
    expect(membershipUpdate).toHaveBeenCalledTimes(1);
    expect(result.membership.role).toBe("Admin");
  });

  it("refuses demoting the last Owner", async () => {
    const { membershipUpdate, services } = buildServices({ ownerCount: 1 });

    await expect(
      services.updateTenantMemberRole(
        context as never,
        ownerMembershipId,
        "Admin"
      )
    ).rejects.toMatchObject({
      code: "last_owner",
      statusCode: 400
    });

    expect(membershipUpdate).not.toHaveBeenCalled();
  });

  it("removes a non-last Owner inside a Serializable transaction", async () => {
    const { membershipCount, membershipDelete, services, transaction } =
      buildServices({ ownerCount: 2 });

    await services.removeTenantMember(context as never, ownerMembershipId);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(membershipCount).toHaveBeenCalledWith({
      where: { role: "Owner", tenantId }
    });
    expect(membershipDelete).toHaveBeenCalledTimes(1);
  });

  it("refuses removing the last Owner", async () => {
    const { membershipDelete, services } = buildServices({ ownerCount: 1 });

    await expect(
      services.removeTenantMember(context as never, ownerMembershipId)
    ).rejects.toMatchObject({
      code: "last_owner",
      statusCode: 400
    });

    expect(membershipDelete).not.toHaveBeenCalled();
  });
});
