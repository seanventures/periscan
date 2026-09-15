import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import { describe, expect, it, vi } from "vitest";

import { createPrismaClient } from "../../packages/db/src/client.js";
import * as helpers from "./helpers.js";

describe("acceptance/helpers (P3 acc hardening)", () => {
  it("uniqueEmail generates distinct emails matching pattern with prefix", () => {
    const e1 = helpers.uniqueEmail("acc-test");
    const e2 = helpers.uniqueEmail("acc-test");
    expect(e1).toMatch(/^acc-test-[0-9a-f-]+@periscan\.test$/);
    expect(e2).toMatch(/^acc-test-[0-9a-f-]+@periscan\.test$/);
    expect(e1).not.toBe(e2);
  });

  it("authHeaders and authCookies return the session cookie map (tolerant alias)", () => {
    const headers = helpers.authHeaders("sess-xyz");
    expect(headers).toEqual({ periscan_session: "sess-xyz" });
    expect(helpers.authCookies("sess-xyz")).toEqual(headers);
  });

  it("safeRequestedAction returns safe defaults and merges overrides (table-like)", () => {
    const base = helpers.safeRequestedAction();
    expect(base.credentialTheft).toBe(false);
    expect(base.destructive).toBe(false);
    const withOverride = helpers.safeRequestedAction({ destructive: true });
    expect(withOverride.destructive).toBe(true);
    expect(withOverride.persistence).toBe(false);
  });

  it("probeDatabaseConnection throws clear multi-line Error with exact 'To run' steps on failure (uses provided prisma)", async () => {
    const failingPrisma = {
      $queryRaw: vi
        .fn()
        .mockRejectedValueOnce(
          new Error("Authentication failed against database server")
        )
    } as any;

    let err: Error | undefined;
    try {
      await helpers.probeDatabaseConnection(failingPrisma);
    } catch (error: unknown) {
      err = error instanceof Error ? error : new Error(String(error));
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain(
      "Acceptance tests require a reachable periscan postgres with matching credentials."
    );
    expect(err!.message).toContain("To run:");
    expect(err!.message).toContain(
      "docker compose -f infra/docker-compose/docker-compose.yml up -d"
    );
    expect(err!.message).toContain(
      "stop or remap the conflicting Postgres listener on 5432"
    );
    expect(err!.message).toContain(
      "export PERISCAN_POSTGRES_PUBLISHED_PORT=5434"
    );
    expect(err!.message).toContain(
      "export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan"
    );
    expect(err!.message).toContain("pnpm test:acceptance");
    expect(err!.message).toContain("Original error:");
    expect(err!.message).toContain("Authentication failed");
    // ensure it used the passed prisma instance (mock called)
    expect(failingPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("performSignup builds payload with tenantType when provided (for MSSP coverage)", async () => {
    const mockApp = {
      inject: vi.fn().mockResolvedValue({
        statusCode: 201,
        cookies: [{ name: "periscan_session", value: "mock-cookie" }]
      })
    };
    const res = await helpers.performSignup(
      mockApp as any,
      "mssp-prefix",
      "MSSP Test",
      "MSSP"
    );
    expect(mockApp.inject).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          tenantType: "MSSP",
          tenantName: "MSSP Test"
        })
      })
    );
    expect(res.cookie).toBe("mock-cookie");
  });

  it("cleanupTestDataByEmailPrefix deletes by tenantId, never audit_events metadata/email", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const userId = "22222222-2222-4222-8222-222222222222";
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([{ relname: "audit_events" }]),
      tenant: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }
    };
    const mockPrisma = {
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx)
      ),
      tenant: {
        findMany: vi.fn().mockResolvedValue([{ tenantId }])
      },
      user: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ memberships: [{ tenantId }], userId }])
      }
    } as any;

    await expect(
      helpers.cleanupTestDataByEmailPrefix(mockPrisma, ["acc-"])
    ).resolves.toBeUndefined();

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { startsWith: "acc-" } }
      })
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalled();
    const unsafeSql = String(tx.$executeRawUnsafe.mock.calls[0][0]);
    expect(unsafeSql).toMatch(
      /DELETE FROM "audit_events" WHERE tenant_id = ANY\(\$1::uuid\[\]\)/
    );
    expect(unsafeSql).not.toMatch(/metadata|email/i);
    expect(tx.$executeRawUnsafe.mock.calls[0][1]).toEqual([tenantId]);
    expect(tx.tenant.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: { in: [tenantId] } }
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: [userId] } }
    });
  });

  it("closeHttpServer finishes while a keep-alive client is still open", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ok");
    });
    server.keepAliveTimeout = 30_000;
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP bind");
    }
    const response = await fetch(`http://127.0.0.1:${address.port}/`);
    expect(response.status).toBe(200);
    await response.text();
    const started = Date.now();
    await helpers.closeHttpServer(server);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("disconnectPrismaClient swallows engine-not-connected errors", async () => {
    const prisma = {
      $disconnect: vi
        .fn()
        .mockRejectedValue(new Error("Engine is not yet connected"))
    } as any;
    await expect(
      helpers.disconnectPrismaClient(prisma)
    ).resolves.toBeUndefined();
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("cleanupTestDataByEmailPrefix is best-effort and does not throw on err", async () => {
    const mockPrisma = {
      user: {
        findMany: vi.fn().mockRejectedValue(new Error("constraint"))
      }
    } as any;
    await expect(
      helpers.cleanupTestDataByEmailPrefix(mockPrisma, ["acc-"])
    ).resolves.toBeUndefined();
  });
});

describe("acceptance/helpers cleanup against lab DB", () => {
  it("cleanup by email prefix finishes in under 2s without scanning audit_events", async () => {
    const prisma = createPrismaClient();
    const prefix = `acc-cleanup-speed-${randomUUID().slice(0, 8)}`;
    const email = `${prefix}@periscan.test`;
    let tenantId: string | undefined;
    try {
      await helpers.probeDatabaseConnection(prisma);
      const tenant = await prisma.tenant.create({
        data: {
          dataRegion: "us-east-1",
          name: `${prefix} Tenant`,
          type: "Organization"
        }
      });
      tenantId = tenant.tenantId;
      const user = await prisma.user.create({
        data: {
          email,
          name: "Cleanup Speed Probe",
          status: "Active"
        }
      });
      await prisma.membership.create({
        data: {
          role: "Owner",
          tenantId: tenant.tenantId,
          userId: user.userId
        }
      });
      await prisma.auditEvent.create({
        data: {
          action: "signup",
          actorType: "User",
          entityType: "Tenant",
          metadata: { email },
          tenantId: tenant.tenantId,
          userId: user.userId
        }
      });
      const scope = await prisma.scope.create({
        data: {
          scopeType: "Domain",
          tenantId: tenant.tenantId,
          value: `${prefix}.example.com`,
          verificationStatus: "Verified"
        }
      });
      const policy = await prisma.policyDecision.create({
        data: {
          approvedBy: user.userId,
          executionEnvironment: "ControlPlane",
          missionType: "ValidationSnapshot",
          outcome: "Allowed",
          rationale: "cleanup-speed",
          requestedAction: {},
          safetyLevel: "PassiveReadOnly",
          scopeId: scope.scopeId,
          target: {},
          tenantId: tenant.tenantId,
          userId: user.userId
        }
      });
      await prisma.validationMission.create({
        data: {
          missionType: "ValidationSnapshot",
          policyDecisionId: policy.policyDecisionId,
          requestedBy: user.userId,
          safetyLevel: "PassiveReadOnly",
          scopeId: scope.scopeId,
          scopeIds: [scope.scopeId],
          status: "Queued",
          tenantId: tenant.tenantId
        }
      });

      const started = Date.now();
      await helpers.cleanupTestDataByEmailPrefix(prisma, [prefix]);
      const elapsedMs = Date.now() - started;
      expect(elapsedMs).toBeLessThan(2000);

      expect(
        await prisma.user.count({ where: { email: { startsWith: prefix } } })
      ).toBe(0);
      expect(
        await prisma.tenant.count({ where: { tenantId: tenant.tenantId } })
      ).toBe(0);
      expect(
        await prisma.auditEvent.count({
          where: { tenantId: tenant.tenantId }
        })
      ).toBe(0);
    } finally {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
        if (tenantId) {
          await tx.auditEvent.deleteMany({ where: { tenantId } });
          await tx.validationMission.deleteMany({ where: { tenantId } });
          await tx.policyDecision.deleteMany({ where: { tenantId } });
          await tx.scope.deleteMany({ where: { tenantId } });
          await tx.tenant.deleteMany({ where: { tenantId } });
        }
        await tx.user.deleteMany({
          where: { email: { startsWith: prefix } }
        });
      });
      await prisma.$disconnect();
    }
  }, 15_000);
});
