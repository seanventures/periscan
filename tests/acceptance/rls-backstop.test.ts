import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createPrismaClient,
  runWithTenantRls
} from "../../packages/db/src/client.js";

// Proves the Postgres row-level-security tenant-isolation BACKSTOP (migration
// 20260705080000). The point of a backstop is to catch the case the app's manual
// `where: { tenantId }` filters miss — so these tests deliberately issue queries
// with NO tenant filter and assert the database still isolates tenants when a
// request is bound via runWithTenantRls (the app.current_tenant GUC).

const prisma = createPrismaClient();

async function seedTenantWithScope(name: string) {
  const tenant = await prisma.tenant.create({
    data: { dataRegion: "us-east-1", name, type: "Organization" }
  });
  const scope = await prisma.scope.create({
    data: {
      scopeType: "Domain",
      tenantId: tenant.tenantId,
      value: `${randomUUID()}.rls.example.com`
    }
  });

  return { scopeId: scope.scopeId, tenantId: tenant.tenantId };
}

describe("RLS tenant-isolation backstop", () => {
  let a: { scopeId: string; tenantId: string };
  let b: { scopeId: string; tenantId: string };

  beforeAll(async () => {
    a = await seedTenantWithScope("rls-backstop-a");
    b = await seedTenantWithScope("rls-backstop-b");
  });

  afterAll(async () => {
    await prisma.scope.deleteMany({
      where: { tenantId: { in: [a.tenantId, b.tenantId] } }
    });
    await prisma.tenant.deleteMany({
      where: { tenantId: { in: [a.tenantId, b.tenantId] } }
    });
    await prisma.$disconnect();
  });

  it("is non-breaking: an unbound connection sees all rows (GUC unset → permit)", async () => {
    const ids = (
      await prisma.scope.findMany({
        where: { scopeId: { in: [a.scopeId, b.scopeId] } }
      })
    ).map((scope) => scope.scopeId);

    expect(ids).toContain(a.scopeId);
    expect(ids).toContain(b.scopeId);
  });

  it("blocks a forgotten-filter read from crossing tenants when bound", async () => {
    const rows = await runWithTenantRls(prisma, b.tenantId, (tx) =>
      // NOTE: intentionally NO `where: { tenantId }` — the whole point is that the
      // database isolates even when the application forgets its filter.
      tx.scope.findMany({
        where: { scopeId: { in: [a.scopeId, b.scopeId] } }
      })
    );
    const ids = rows.map((scope) => scope.scopeId);

    expect(ids).toContain(b.scopeId);
    expect(ids).not.toContain(a.scopeId);
  });

  it("rejects a cross-tenant write via the WITH CHECK policy", async () => {
    await expect(
      runWithTenantRls(prisma, b.tenantId, (tx) =>
        tx.scope.create({
          data: {
            // Bound to tenant B, but trying to write a row owned by tenant A.
            scopeType: "Domain",
            tenantId: a.tenantId,
            value: `${randomUUID()}.rls-forged.example.com`
          }
        })
      )
    ).rejects.toThrow();
  });
});
