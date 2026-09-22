import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createEnterpriseSiteRecord,
  getEnterpriseSiteRecord,
  listEnterpriseSiteRecords,
  updateEnterpriseSiteRecord
} from "./enterprise-sites.js";

type SiteRecord = {
  adDomains: string[];
  cidrs: string[];
  createdAt: Date;
  name: string;
  runnerIds: string[];
  siteId: string;
  tenantId: string;
  updatedAt: Date;
};

function createInMemoryEnterpriseSiteClient() {
  const sites = new Map<string, SiteRecord>();

  return {
    enterpriseSite: {
      create: async ({
        data
      }: {
        data: {
          adDomains?: string[];
          cidrs?: string[];
          name: string;
          runnerIds?: string[];
          siteId?: string;
          tenantId: string;
        };
      }) => {
        const now = new Date();
        const record: SiteRecord = {
          adDomains: data.adDomains ?? [],
          cidrs: data.cidrs ?? [],
          createdAt: now,
          name: data.name,
          runnerIds: data.runnerIds ?? [],
          siteId: data.siteId ?? randomUUID(),
          tenantId: data.tenantId,
          updatedAt: now
        };
        sites.set(record.siteId, record);
        return record;
      },
      findFirst: async ({
        where
      }: {
        where: { siteId: string; tenantId: string };
      }) =>
        [...sites.values()].find(
          (site) =>
            site.siteId === where.siteId && site.tenantId === where.tenantId
        ) ?? null,
      findMany: async ({
        orderBy,
        where
      }: {
        orderBy: { createdAt: "asc" | "desc" };
        where: { tenantId: string };
      }) =>
        [...sites.values()]
          .filter((site) => site.tenantId === where.tenantId)
          .sort((left, right) =>
            orderBy.createdAt === "asc"
              ? left.createdAt.getTime() - right.createdAt.getTime()
              : right.createdAt.getTime() - left.createdAt.getTime()
          ),
      update: async ({
        data,
        where
      }: {
        data: Partial<
          Pick<SiteRecord, "adDomains" | "cidrs" | "name" | "runnerIds">
        >;
        where: { siteId: string };
      }) => {
        const current = sites.get(where.siteId);
        if (!current) {
          throw new Error("enterprise site not found");
        }
        const next: SiteRecord = {
          ...current,
          ...data,
          updatedAt: new Date()
        };
        sites.set(where.siteId, next);
        return next;
      }
    }
  };
}

const RUNNER_ID = "22222222-2222-4222-8222-222222222222";

describe("enterprise site persistence", () => {
  it("lists an honest empty catalog until a tenant creates a site", async () => {
    const prisma = createInMemoryEnterpriseSiteClient() as never;
    const tenantId = randomUUID();

    expect(await listEnterpriseSiteRecords(prisma, tenantId)).toEqual([]);

    const created = await createEnterpriseSiteRecord(prisma, {
      adDomains: ["corp.contoso.local"],
      cidrs: ["10.8.0.0/16"],
      name: "Chicago DC",
      runnerIds: [RUNNER_ID],
      tenantId
    });

    expect(created.name).toBe("Chicago DC");
    expect(created.cidrs).toEqual(["10.8.0.0/16"]);
    expect(created.adDomains).toEqual(["corp.contoso.local"]);
    expect(created.runnerIds).toEqual([RUNNER_ID]);
    expect(JSON.stringify(created)).not.toMatch(/Headquarters|US-East/i);

    const listed = await listEnterpriseSiteRecords(prisma, tenantId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.siteId).toBe(created.siteId);
  });

  it("updates a site in the owning tenant and returns null for a foreign tenant id", async () => {
    const prisma = createInMemoryEnterpriseSiteClient() as never;
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const created = await createEnterpriseSiteRecord(prisma, {
      adDomains: [],
      cidrs: ["10.8.0.0/16"],
      name: "Chicago DC",
      runnerIds: [],
      tenantId
    });

    const updated = await updateEnterpriseSiteRecord(prisma, {
      cidrs: ["10.8.1.0/24"],
      siteId: created.siteId,
      tenantId
    });
    expect(updated?.cidrs).toEqual(["10.8.1.0/24"]);
    expect(updated?.name).toBe("Chicago DC");

    expect(
      await getEnterpriseSiteRecord(prisma, {
        siteId: created.siteId,
        tenantId: otherTenantId
      })
    ).toBeNull();
    expect(
      await updateEnterpriseSiteRecord(prisma, {
        name: "Stolen",
        siteId: created.siteId,
        tenantId: otherTenantId
      })
    ).toBeNull();
    expect(await listEnterpriseSiteRecords(prisma, otherTenantId)).toEqual([]);
  });
});
