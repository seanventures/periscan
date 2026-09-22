import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AppServiceError } from "../runtime-services.js";
import type {
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";
import {
  assertEnterpriseSiteDiscoverAllowed,
  createEnterpriseSiteServices
} from "./enterprise-sites.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RUNNER_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SITE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ownerA = {
  membership: { role: "Owner" },
  tenant: { tenantId: TENANT_A },
  user: { userId: USER_A }
} as unknown as AuthenticatedContext;

const ownerB = {
  membership: { role: "Owner" },
  tenant: { tenantId: TENANT_B },
  user: { userId: randomUUID() }
} as unknown as AuthenticatedContext;

type SiteRow = {
  adDomains: string[];
  cidrs: string[];
  createdAt: Date;
  name: string;
  runnerIds: string[];
  siteId: string;
  tenantId: string;
  updatedAt: Date;
};

function createPrisma(options?: { runners?: Array<{ runnerId: string; tenantId: string }> }) {
  const sites = new Map<string, SiteRow>();
  const runners = options?.runners ?? [{ runnerId: RUNNER_A, tenantId: TENANT_A }];

  return {
    enterpriseSite: {
      create: vi.fn(async ({ data }: { data: Omit<SiteRow, "createdAt" | "updatedAt"> }) => {
        const now = new Date();
        const row: SiteRow = { ...data, createdAt: now, updatedAt: now };
        sites.set(row.siteId, row);
        return row;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: { siteId: string; tenantId: string } }) =>
          [...sites.values()].find(
            (site) =>
              site.siteId === where.siteId && site.tenantId === where.tenantId
          ) ?? null
      ),
      findMany: vi.fn(
        async ({ where }: { where: { tenantId: string } }) =>
          [...sites.values()].filter((site) => site.tenantId === where.tenantId)
      ),
      update: vi.fn(
        async ({
          data,
          where
        }: {
          data: Partial<Pick<SiteRow, "adDomains" | "cidrs" | "name" | "runnerIds">>;
          where: { siteId: string };
        }) => {
          const current = sites.get(where.siteId);
          if (!current) {
            throw new Error("missing");
          }
          const next = { ...current, ...data, updatedAt: new Date() };
          sites.set(where.siteId, next);
          return next;
        }
      )
    },
    runner: {
      findMany: vi.fn(
        async ({
          where
        }: {
          where: { runnerId: { in: string[] }; tenantId: string };
        }) =>
          runners.filter(
            (runner) =>
              runner.tenantId === where.tenantId &&
              where.runnerId.in.includes(runner.runnerId)
          )
      )
    }
  };
}

function createServices(prisma: ReturnType<typeof createPrisma>) {
  return createEnterpriseSiteServices({
    prisma
  } as unknown as RuntimeServiceDeps);
}

describe("enterprise site services", () => {
  it("returns an honest empty list until the tenant creates a site", async () => {
    const services = createServices(createPrisma());

    expect(await services.listEnterpriseSites(ownerA)).toEqual([]);

    const created = await services.createEnterpriseSite(ownerA, {
      adDomains: ["corp.contoso.local"],
      cidrs: ["10.8.0.0/16"],
      name: "Chicago DC",
      runnerIds: [RUNNER_A]
    });

    expect(created.name).toBe("Chicago DC");
    expect(created.cidrs).toEqual(["10.8.0.0/16"]);
    expect(created.adDomains).toEqual(["corp.contoso.local"]);
    expect(created.runnerIds).toEqual([RUNNER_A]);
    expect(JSON.stringify(created)).not.toMatch(/Headquarters|US-East/i);

    const listed = await services.listEnterpriseSites(ownerA);
    expect(listed).toEqual([created]);
    expect(await services.listEnterpriseSites(ownerB)).toEqual([]);
  });

  it("patches a site in-tenant and 404s the same id for another tenant", async () => {
    const services = createServices(createPrisma());
    const created = await services.createEnterpriseSite(ownerA, {
      adDomains: ["corp.contoso.local"],
      cidrs: ["10.8.0.0/16"],
      name: "Chicago DC",
      runnerIds: [RUNNER_A]
    });

    const patched = await services.updateEnterpriseSite(ownerA, created.siteId, {
      cidrs: ["10.8.1.0/24"]
    });
    expect(patched.cidrs).toEqual(["10.8.1.0/24"]);
    expect(patched.name).toBe("Chicago DC");

    await expect(
      services.updateEnterpriseSite(ownerB, created.siteId, { name: "Stolen" })
    ).rejects.toMatchObject({
      code: "enterprise_site_not_found",
      statusCode: 404
    });
  });
});

describe("assertEnterpriseSiteDiscoverAllowed", () => {
  it("does not block hostname discover", () => {
    expect(() =>
      assertEnterpriseSiteDiscoverAllowed({
        sites: [],
        target: "inventory.corp.example.internal",
        verifiedScopes: []
      })
    ).not.toThrow();
  });

  it("refuses CIDR discover when the catalog is empty", () => {
    expect(() =>
      assertEnterpriseSiteDiscoverAllowed({
        sites: [],
        target: "10.8.1.5",
        verifiedScopes: [
          {
            scopeType: "IPRange",
            value: "10.8.0.0/16",
            verificationStatus: "Verified"
          }
        ]
      })
    ).toThrow(AppServiceError);
    try {
      assertEnterpriseSiteDiscoverAllowed({
        sites: [],
        target: "10.8.1.5",
        verifiedScopes: [
          {
            scopeType: "IPRange",
            value: "10.8.0.0/16",
            verificationStatus: "Verified"
          }
        ]
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "empty_site_catalog",
        statusCode: 400
      });
    }
  });

  it("allows CIDR discover only on verified scope AND a matching site CIDR", () => {
    const site = {
      adDomains: ["corp.contoso.local"],
      cidrs: ["10.8.0.0/16"],
      name: "Chicago DC",
      runnerIds: [RUNNER_A],
      siteId: SITE_ID
    };
    expect(() =>
      assertEnterpriseSiteDiscoverAllowed({
        sites: [site],
        target: "10.8.1.5",
        verifiedScopes: [
          {
            scopeType: "IPRange",
            value: "10.8.0.0/16",
            verificationStatus: "Verified"
          }
        ]
      })
    ).not.toThrow();

    expect(() =>
      assertEnterpriseSiteDiscoverAllowed({
        sites: [site],
        target: "172.16.4.10",
        verifiedScopes: [
          {
            scopeType: "InternalNetwork",
            value: "172.16.0.0/12",
            verificationStatus: "Verified"
          }
        ]
      })
    ).toThrow(/does not match a configured site CIDR/u);
  });
});
