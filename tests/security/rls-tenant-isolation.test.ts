import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createPrismaClient,
  enterTenantRlsContext,
  resetTenantRlsContext,
  runWithTenantRls
} from "../../packages/db/src/index.js";

// Proves the Postgres row-level-security backstop ACTIVELY enforces at the
// database layer — not merely that the policies exist. Two mechanisms are
// exercised:
//   1. runWithTenantRls: an explicit tenant-bound transaction (reads + writes).
//   2. the RLS-extended client's $transaction override: the app's own
//      interactive transactions inherit the async-context tenant binding
//      (enterTenantRlsContext), so a cross-tenant write is rejected by the DB
//      even when the application-level filter is wrong.
describe("RLS tenant-isolation backstop actively enforces", () => {
  const prisma = createPrismaClient();
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  beforeAll(async () => {
    // Tenants themselves are not RLS-scoped; create both unbound.
    resetTenantRlsContext();
    await prisma.tenant.create({
      data: {
        dataRegion: "us-east-1",
        name: `RLS A ${tenantA}`,
        tenantId: tenantA,
        type: "Organization"
      }
    });
    await prisma.tenant.create({
      data: {
        dataRegion: "us-east-1",
        name: `RLS B ${tenantB}`,
        tenantId: tenantB,
        type: "Organization"
      }
    });
  });

  afterAll(async () => {
    resetTenantRlsContext();
    await prisma.extensionProject.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } }
    });
    await prisma.asyncOperationsPolicy.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } }
    });
    await prisma.auditEvent.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } }
    });
    await prisma.tenant.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } }
    });
    await prisma.$disconnect();
  });

  const makeAudit = (tenantId: string) => ({
    action: "signup" as const,
    actorType: "User",
    entityId: null,
    entityType: "Tenant" as const,
    metadata: { probe: "rls" },
    tenantId,
    userId: null
  });

  const makeAsyncOperationsPolicy = (tenantId: string) => ({
    escalationChannel: "#security-operations",
    queueAgeTargetSeconds: 900,
    reviewReference: "RLS-OPERATIONS-TEST",
    reviewedAt: new Date(),
    reviewedBy: randomUUID(),
    runnerLeaseWarningSeconds: 600,
    runningTimeoutSeconds: 1800,
    supportOwner: "Security Operations",
    tenantId
  });

  // Policies on this table only read `app.current_tenant_id` (not the legacy
  // `app.current_tenant` name). The runtime binder must set both GUCs.
  const makeExtensionProject = (tenantId: string) => ({
    createdBy: randomUUID(),
    description: "RLS probe extension",
    displayName: "RLS Probe",
    licenseSpdx: "MIT",
    packageName: `rls-probe-${randomUUID()}`,
    repositoryUrl: "https://example.test/rls-probe",
    supportUrl: "https://example.test/support",
    tenantId
  });

  it("runWithTenantRls rejects a write that targets another tenant (WITH CHECK)", async () => {
    // Bound to A, but the write carries B's tenant_id — the DB policy rejects it.
    await expect(
      runWithTenantRls(prisma, tenantA, (tx) =>
        tx.auditEvent.create({ data: makeAudit(tenantB) })
      )
    ).rejects.toThrow();
  });

  it("runWithTenantRls permits a correctly-scoped write and isolates reads", async () => {
    // Seed one row per tenant, unbound (owner bypasses RLS when GUC unset).
    resetTenantRlsContext();
    await prisma.auditEvent.create({ data: makeAudit(tenantA) });
    await prisma.auditEvent.create({ data: makeAudit(tenantB) });

    // A correctly-scoped write under A's binding succeeds.
    const created = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.auditEvent.create({ data: makeAudit(tenantA) })
    );
    expect(created.tenantId).toBe(tenantA);

    // A read bound to A cannot see B's rows even without a tenant_id filter.
    const visible = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.auditEvent.findMany({
        where: { metadata: { path: ["probe"], equals: "rls" } }
      })
    );
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((row) => row.tenantId === tenantA)).toBe(true);
  }, 15_000);

  it("the app client's $transaction override rejects a cross-tenant write under an ambient binding", async () => {
    // Simulate an authenticated request bound to A (as requireAuthContext does),
    // then an interactive transaction that wrongly writes B's row.
    enterTenantRlsContext(tenantA);
    try {
      await expect(
        prisma.$transaction(async (tx) =>
          tx.auditEvent.create({ data: makeAudit(tenantB) })
        )
      ).rejects.toThrow();

      // The same transaction writing A's row is accepted.
      const ok = await prisma.$transaction(async (tx) =>
        tx.auditEvent.create({ data: makeAudit(tenantA) })
      );
      expect(ok.tenantId).toBe(tenantA);
    } finally {
      resetTenantRlsContext();
    }
  });

  it("actively isolates asynchronous operations policy rows", async () => {
    await expect(
      runWithTenantRls(prisma, tenantA, (tx) =>
        tx.asyncOperationsPolicy.create({
          data: makeAsyncOperationsPolicy(tenantB)
        })
      )
    ).rejects.toThrow();

    const created = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.asyncOperationsPolicy.create({
        data: makeAsyncOperationsPolicy(tenantA)
      })
    );
    expect(created.tenantId).toBe(tenantA);

    resetTenantRlsContext();
    await prisma.asyncOperationsPolicy.create({
      data: makeAsyncOperationsPolicy(tenantB)
    });
    const visible = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.asyncOperationsPolicy.findMany()
    );
    expect(visible.map((row) => row.tenantId)).toEqual([tenantA]);
  });

  it("binds app.current_tenant_id so _id-only RLS policies accept same-tenant writes", async () => {
    // extension_projects policies compare only app.current_tenant_id. Setting
    // the legacy app.current_tenant GUC alone must not leave this write denied.
    const created = await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.extensionProject.create({
        data: makeExtensionProject(tenantA)
      })
    );
    expect(created.tenantId).toBe(tenantA);

    await expect(
      runWithTenantRls(prisma, tenantA, (tx) =>
        tx.extensionProject.create({
          data: makeExtensionProject(tenantB)
        })
      )
    ).rejects.toThrow();

    enterTenantRlsContext(tenantA);
    try {
      const viaAmbientTx = await prisma.$transaction(async (tx) =>
        tx.extensionProject.create({
          data: makeExtensionProject(tenantA)
        })
      );
      expect(viaAmbientTx.tenantId).toBe(tenantA);
    } finally {
      resetTenantRlsContext();
    }
  });
});
