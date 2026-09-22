import { createHash, randomUUID } from "node:crypto";

import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import type { MembershipRole } from "@periscan/shared";

import {
  SCIM_TOKEN_PREFIX,
  issueScimToken,
  mapScimGroupsToMembershipRole,
  registerScimRoutes
} from "./scim.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const OWNER_USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_MEMBERSHIP = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVIDENCE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FOREIGN_USER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type UserRow = {
  createdAt: Date;
  email: string;
  name: string;
  passwordHash: string | null;
  sessionVersion: number;
  status: "Invited" | "Active" | "Disabled";
  updatedAt: Date;
  userId: string;
};

type MembershipRow = {
  createdAt: Date;
  membershipId: string;
  role: MembershipRole;
  status: "Active" | "Inactive";
  tenantId: string;
  updatedAt: Date;
  userId: string;
};

type ScimTokenRow = {
  createdAt: Date;
  createdBy: string | null;
  lastUsedAt: Date | null;
  name: string;
  revokedAt: Date | null;
  scimTokenId: string;
  tenantId: string;
  tokenHash: string;
  tokenPrefix: string;
  updatedAt: Date;
};

type ScimGroupRow = {
  createdAt: Date;
  displayName: string;
  externalId: string | null;
  members: Array<{ display?: string; value: string }>;
  scimGroupId: string;
  tenantId: string;
  updatedAt: Date;
};

type AuditRow = {
  action: string;
  actorType: string;
  entityId: string | null;
  entityType: string;
  metadata: Record<string, unknown>;
  tenantId: string | null;
  userId: string | null;
};

type EvidenceRow = {
  evidenceArtifactId: string;
  tenantId: string;
};

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function matchesWhere<T extends Record<string, unknown>>(
  row: T,
  where: Record<string, unknown> | undefined
): boolean {
  if (!where) {
    return true;
  }
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) {
      continue;
    }
    if (
      expected &&
      typeof expected === "object" &&
      !Array.isArray(expected) &&
      ("equals" in (expected as object) || "in" in (expected as object))
    ) {
      const clause = expected as { equals?: unknown; in?: unknown[] };
      if ("equals" in clause && row[key] !== clause.equals) {
        return false;
      }
      if ("in" in clause && !clause.in?.includes(row[key])) {
        return false;
      }
      continue;
    }
    if (row[key] !== expected) {
      return false;
    }
  }
  return true;
}

function createMemoryPrisma() {
  const now = new Date();
  const users = new Map<string, UserRow>([
    [
      OWNER_USER,
      {
        createdAt: now,
        email: "owner@a.example",
        name: "Owner A",
        passwordHash: "hash",
        sessionVersion: 0,
        status: "Active",
        updatedAt: now,
        userId: OWNER_USER
      }
    ],
    [
      FOREIGN_USER,
      {
        createdAt: now,
        email: "foreign@b.example",
        name: "Foreign B",
        passwordHash: null,
        sessionVersion: 0,
        status: "Active",
        updatedAt: now,
        userId: FOREIGN_USER
      }
    ]
  ]);
  const memberships = new Map<string, MembershipRow>([
    [
      OWNER_MEMBERSHIP,
      {
        createdAt: now,
        membershipId: OWNER_MEMBERSHIP,
        role: "Owner",
        status: "Active",
        tenantId: TENANT_A,
        updatedAt: now,
        userId: OWNER_USER
      }
    ],
    [
      randomUUID(),
      {
        createdAt: now,
        membershipId: randomUUID(),
        role: "Owner",
        status: "Active",
        tenantId: TENANT_B,
        updatedAt: now,
        userId: FOREIGN_USER
      }
    ]
  ]);
  const tokens = new Map<string, ScimTokenRow>();
  const groups = new Map<string, ScimGroupRow>();
  const audits: AuditRow[] = [];
  const evidence: EvidenceRow[] = [
    { evidenceArtifactId: EVIDENCE_ID, tenantId: TENANT_A }
  ];
  const ssoConfigs = new Map<
    string,
    {
      defaultMappedRole: MembershipRole | null;
      roleClaimName: string | null;
      roleMappings: Array<{ claimValue: string; role: MembershipRole }>;
      tenantId: string;
    }
  >();

  const prisma = {
    $transaction: async <T>(
      fn: (tx: typeof prisma) => Promise<T>,
      _opts?: { isolationLevel?: string }
    ) => fn(prisma),
    auditEvent: {
      create: async ({ data }: { data: AuditRow }) => {
        audits.push(data);
        return data;
      },
      findMany: async () => audits
    },
    evidenceArtifact: {
      findMany: async ({ where }: { where?: { tenantId?: string } }) =>
        evidence.filter((row) => matchesWhere(row, where))
    },
    membership: {
      count: async ({ where }: { where?: Record<string, unknown> }) =>
        [...memberships.values()].filter((row) => matchesWhere(row, where))
          .length,
      create: async ({ data }: { data: Partial<MembershipRow> }) => {
        const row: MembershipRow = {
          createdAt: new Date(),
          membershipId: data.membershipId ?? randomUUID(),
          role: (data.role as MembershipRole) ?? "Viewer",
          status: (data.status as MembershipRow["status"]) ?? "Active",
          tenantId: data.tenantId as string,
          updatedAt: new Date(),
          userId: data.userId as string
        };
        memberships.set(row.membershipId, row);
        return row;
      },
      findFirst: async ({ where }: { where?: Record<string, unknown> }) =>
        [...memberships.values()].find((row) => matchesWhere(row, where)) ??
        null,
      findMany: async ({ where }: { where?: Record<string, unknown> }) =>
        [...memberships.values()].filter((row) => matchesWhere(row, where)),
      findUnique: async ({
        where
      }: {
        where: { tenantId_userId?: { tenantId: string; userId: string } };
      }) => {
        const pair = where.tenantId_userId;
        if (!pair) {
          return null;
        }
        return (
          [...memberships.values()].find(
            (row) => row.tenantId === pair.tenantId && row.userId === pair.userId
          ) ?? null
        );
      },
      update: async ({
        data,
        where
      }: {
        data: Partial<MembershipRow>;
        where: { membershipId: string };
      }) => {
        const current = memberships.get(where.membershipId);
        if (!current) {
          throw new Error("membership not found");
        }
        const next = { ...current, ...data, updatedAt: new Date() };
        memberships.set(where.membershipId, next);
        return next;
      }
    },
    scimGroup: {
      create: async ({ data }: { data: Partial<ScimGroupRow> }) => {
        const row: ScimGroupRow = {
          createdAt: new Date(),
          displayName: data.displayName as string,
          externalId: (data.externalId as string | null | undefined) ?? null,
          members: (data.members as ScimGroupRow["members"]) ?? [],
          scimGroupId: data.scimGroupId ?? randomUUID(),
          tenantId: data.tenantId as string,
          updatedAt: new Date()
        };
        groups.set(row.scimGroupId, row);
        return row;
      },
      delete: async ({ where }: { where: { scimGroupId: string } }) => {
        const row = groups.get(where.scimGroupId);
        groups.delete(where.scimGroupId);
        return row;
      },
      findFirst: async ({ where }: { where?: Record<string, unknown> }) =>
        [...groups.values()].find((row) => matchesWhere(row, where)) ?? null,
      findMany: async ({ where }: { where?: Record<string, unknown> }) =>
        [...groups.values()].filter((row) => matchesWhere(row, where)),
      findUnique: async ({ where }: { where: { scimGroupId: string } }) =>
        groups.get(where.scimGroupId) ?? null,
      update: async ({
        data,
        where
      }: {
        data: Partial<ScimGroupRow>;
        where: { scimGroupId: string };
      }) => {
        const current = groups.get(where.scimGroupId);
        if (!current) {
          throw new Error("group not found");
        }
        const next = { ...current, ...data, updatedAt: new Date() };
        groups.set(where.scimGroupId, next);
        return next;
      }
    },
    scimToken: {
      create: async ({ data }: { data: Partial<ScimTokenRow> }) => {
        const row: ScimTokenRow = {
          createdAt: new Date(),
          createdBy: (data.createdBy as string | null | undefined) ?? null,
          lastUsedAt: null,
          name: data.name as string,
          revokedAt: null,
          scimTokenId: data.scimTokenId ?? randomUUID(),
          tenantId: data.tenantId as string,
          tokenHash: data.tokenHash as string,
          tokenPrefix: data.tokenPrefix as string,
          updatedAt: new Date()
        };
        tokens.set(row.scimTokenId, row);
        return row;
      },
      findFirst: async ({ where }: { where?: Record<string, unknown> }) =>
        [...tokens.values()].find((row) => matchesWhere(row, where)) ?? null,
      findUnique: async ({ where }: { where: { tokenHash?: string } }) =>
        [...tokens.values()].find((row) => row.tokenHash === where.tokenHash) ??
        null,
      update: async ({
        data,
        where
      }: {
        data: Partial<ScimTokenRow>;
        where: { scimTokenId: string };
      }) => {
        const current = tokens.get(where.scimTokenId);
        if (!current) {
          throw new Error("token not found");
        }
        const next = { ...current, ...data, updatedAt: new Date() };
        tokens.set(where.scimTokenId, next);
        return next;
      }
    },
    tenantSsoConfig: {
      findUnique: async ({ where }: { where: { tenantId: string } }) =>
        ssoConfigs.get(where.tenantId) ?? null
    },
    user: {
      create: async ({ data }: { data: Partial<UserRow> }) => {
        const row: UserRow = {
          createdAt: new Date(),
          email: data.email as string,
          name: data.name as string,
          passwordHash: data.passwordHash ?? null,
          sessionVersion: 0,
          status: (data.status as UserRow["status"]) ?? "Active",
          updatedAt: new Date(),
          userId: data.userId ?? randomUUID()
        };
        users.set(row.userId, row);
        return row;
      },
      findUnique: async ({
        where
      }: {
        where: { email?: string; userId?: string };
      }) => {
        if (where.userId) {
          return users.get(where.userId) ?? null;
        }
        if (where.email) {
          return (
            [...users.values()].find((row) => row.email === where.email) ?? null
          );
        }
        return null;
      },
      update: async ({
        data,
        where
      }: {
        data: Partial<UserRow>;
        where: { userId: string };
      }) => {
        const current = users.get(where.userId);
        if (!current) {
          throw new Error("user not found");
        }
        const next = { ...current, ...data, updatedAt: new Date() };
        users.set(where.userId, next);
        return next;
      }
    }
  };

  return {
    audits,
    evidence,
    groups,
    memberships,
    prisma,
    seedRoleMappings(
      tenantId: string,
      roleMappings: Array<{ claimValue: string; role: MembershipRole }>
    ) {
      ssoConfigs.set(tenantId, {
        defaultMappedRole: null,
        roleClaimName: "groups",
        roleMappings,
        tenantId
      });
    },
    tokens,
    users
  };
}

async function buildScimApp(store: ReturnType<typeof createMemoryPrisma>) {
  const app = Fastify({ logger: false });
  app.addContentTypeParser(
    "application/scim+json",
    { parseAs: "string" },
    (_request, body, done) => {
      if (!body || body.length === 0) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(String(body)) as unknown);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );
  registerScimRoutes(app, { prisma: store.prisma as never });
  await app.ready();
  return app;
}

function scimHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/scim+json"
  };
}

describe("mapScimGroupsToMembershipRole", () => {
  it("defaults to Viewer when roleMappings are empty", () => {
    expect(
      mapScimGroupsToMembershipRole({
        groupNames: ["periscan-admins"],
        roleMappings: []
      })
    ).toBe("Viewer");
  });

  it("maps IdP groups through existing roleMappings and picks highest privilege", () => {
    expect(
      mapScimGroupsToMembershipRole({
        groupNames: ["periscan-viewers", "periscan-admins"],
        roleMappings: [
          { claimValue: "periscan-viewers", role: "Viewer" },
          { claimValue: "periscan-admins", role: "Admin" }
        ]
      })
    ).toBe("Admin");
  });
});

describe("inbound SCIM 2.0 Users and Groups", () => {
  it("issues a tenant SCIM token hashed at rest and never stores the raw secret", async () => {
    const store = createMemoryPrisma();
    const issued = await issueScimToken(store.prisma as never, {
      createdBy: OWNER_USER,
      name: "okta",
      tenantId: TENANT_A
    });

    expect(issued.token.startsWith(SCIM_TOKEN_PREFIX)).toBe(true);
    expect(issued.tokenPrefix).toBe(issued.token.slice(0, 8));
    const persisted = [...store.tokens.values()][0];
    expect(persisted?.tokenHash).toBe(hashSecret(issued.token));
    expect(JSON.stringify(persisted)).not.toContain(issued.token);
  });

  it("returns 401 without a bearer token and 401 for an invalid token", async () => {
    const store = createMemoryPrisma();
    const app = await buildScimApp(store);
    try {
      const missing = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/Users"
      });
      expect(missing.statusCode).toBe(401);
      expect(missing.json()).toMatchObject({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        status: "401"
      });

      const invalid = await app.inject({
        headers: scimHeaders(`${SCIM_TOKEN_PREFIX}bogus`),
        method: "GET",
        url: "/api/v1/scim/v2/Users"
      });
      expect(invalid.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("creates, updates, and deprovisions membership without deleting evidence", async () => {
    const store = createMemoryPrisma();
    const issued = await issueScimToken(store.prisma as never, {
      createdBy: OWNER_USER,
      name: "okta",
      tenantId: TENANT_A
    });
    const app = await buildScimApp(store);

    try {
      const created = await app.inject({
        headers: scimHeaders(issued.token),
        method: "POST",
        payload: {
          active: true,
          displayName: "Alex Analyst",
          emails: [{ primary: true, value: "alex@a.example" }],
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
          userName: "alex@a.example"
        },
        url: "/api/v1/scim/v2/Users"
      });
      expect(created.statusCode).toBe(201);
      const createdBody = created.json() as {
        active: boolean;
        id: string;
        userName: string;
      };
      expect(createdBody.active).toBe(true);
      expect(createdBody.userName).toBe("alex@a.example");
      const membership = [...store.memberships.values()].find(
        (row) => row.userId === createdBody.id && row.tenantId === TENANT_A
      );
      expect(membership?.role).toBe("Viewer");
      expect(membership?.status).toBe("Active");
      expect(
        store.audits.some((event) => event.action === "user_scim_provisioned")
      ).toBe(true);

      const patched = await app.inject({
        headers: scimHeaders(issued.token),
        method: "PATCH",
        payload: {
          Operations: [{ op: "replace", path: "name.formatted", value: "Alex A" }],
          schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
        },
        url: `/api/v1/scim/v2/Users/${createdBody.id}`
      });
      expect(patched.statusCode).toBe(200);
      expect(store.users.get(createdBody.id)?.name).toBe("Alex A");

      const disabled = await app.inject({
        headers: scimHeaders(issued.token),
        method: "PATCH",
        payload: {
          Operations: [{ op: "replace", path: "active", value: false }],
          schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
        },
        url: `/api/v1/scim/v2/Users/${createdBody.id}`
      });
      expect(disabled.statusCode).toBe(200);
      expect(disabled.json()).toMatchObject({ active: false });
      expect(membership && store.memberships.get(membership.membershipId)?.status).toBe(
        "Inactive"
      );
      expect(store.users.get(createdBody.id)).toBeTruthy();
      expect(store.evidence).toEqual([
        { evidenceArtifactId: EVIDENCE_ID, tenantId: TENANT_A }
      ]);
      expect(
        store.audits.some((event) => event.action === "user_scim_deprovisioned")
      ).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("maps provisioned group membership through tenant roleMappings", async () => {
    const store = createMemoryPrisma();
    store.seedRoleMappings(TENANT_A, [
      { claimValue: "periscan-admins", role: "Admin" }
    ]);
    const issued = await issueScimToken(store.prisma as never, {
      createdBy: OWNER_USER,
      name: "okta",
      tenantId: TENANT_A
    });
    const app = await buildScimApp(store);
    try {
      const created = await app.inject({
        headers: scimHeaders(issued.token),
        method: "POST",
        payload: {
          active: true,
          groups: [{ display: "periscan-admins" }],
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
          userName: "admin@a.example"
        },
        url: "/api/v1/scim/v2/Users"
      });
      expect(created.statusCode).toBe(201);
      const userId = (created.json() as { id: string }).id;
      const membership = [...store.memberships.values()].find(
        (row) => row.userId === userId
      );
      expect(membership?.role).toBe("Admin");

      const group = await app.inject({
        headers: scimHeaders(issued.token),
        method: "POST",
        payload: {
          displayName: "periscan-admins",
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"]
        },
        url: "/api/v1/scim/v2/Groups"
      });
      expect(group.statusCode).toBe(201);
      const groupId = (group.json() as { id: string }).id;
      const patched = await app.inject({
        headers: scimHeaders(issued.token),
        method: "PATCH",
        payload: {
          Operations: [
            {
              op: "add",
              path: "members",
              value: [{ value: userId }]
            }
          ],
          schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
        },
        url: `/api/v1/scim/v2/Groups/${groupId}`
      });
      expect(patched.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("refuses deprovisioning the last owner", async () => {
    const store = createMemoryPrisma();
    const issued = await issueScimToken(store.prisma as never, {
      createdBy: OWNER_USER,
      name: "okta",
      tenantId: TENANT_A
    });
    const app = await buildScimApp(store);
    try {
      const response = await app.inject({
        headers: scimHeaders(issued.token),
        method: "PATCH",
        payload: {
          Operations: [{ op: "replace", path: "active", value: false }],
          schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
        },
        url: `/api/v1/scim/v2/Users/${OWNER_USER}`
      });
      expect(response.statusCode).toBe(409);
      expect(
        store.memberships.get(OWNER_MEMBERSHIP)?.status
      ).toBe("Active");
    } finally {
      await app.close();
    }
  });

  it("returns 404 for another tenant's user id", async () => {
    const store = createMemoryPrisma();
    const issued = await issueScimToken(store.prisma as never, {
      createdBy: OWNER_USER,
      name: "okta",
      tenantId: TENANT_A
    });
    const app = await buildScimApp(store);
    try {
      const response = await app.inject({
        headers: scimHeaders(issued.token),
        method: "GET",
        url: `/api/v1/scim/v2/Users/${FOREIGN_USER}`
      });
      expect(response.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
