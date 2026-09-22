import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";

import type { MembershipRole, TenantSsoRoleMappingRule } from "@periscan/shared";

import {
  createOpaqueToken,
  hashSecret,
  writeAuditEvent
} from "../runtime-services.js";
import {
  parseStoredRoleMappings,
  pickHighestPrivilegeRole
} from "./sso-role-mapping.js";

export const SCIM_TOKEN_PREFIX = "scim_";
export const SCIM_CONTENT_TYPE = "application/scim+json";
const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
const LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";
const PATCH_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";

type ScimPrisma = Pick<
  PrismaClient,
  | "auditEvent"
  | "membership"
  | "scimGroup"
  | "scimToken"
  | "tenantSsoConfig"
  | "user"
> & {
  $transaction: PrismaClient["$transaction"];
};

type ScimGroupMember = { display?: string; value: string };

export class ScimError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly scimType?: string
  ) {
    super(message);
  }
}

export function mapScimGroupsToMembershipRole(input: {
  groupNames: string[];
  roleMappings: TenantSsoRoleMappingRule[];
}): MembershipRole {
  if (input.roleMappings.length === 0) {
    return "Viewer";
  }
  const names = new Set(input.groupNames.map((name) => name.toLowerCase()));
  const matched = input.roleMappings
    .filter((rule) => names.has(rule.claimValue.toLowerCase()))
    .map((rule) => rule.role);
  return pickHighestPrivilegeRole(matched) ?? "Viewer";
}

export async function issueScimToken(
  prisma: Pick<PrismaClient, "scimToken">,
  input: { createdBy?: string | null; name: string; tenantId: string }
) {
  const token = createOpaqueToken(SCIM_TOKEN_PREFIX);
  const record = await prisma.scimToken.create({
    data: {
      createdBy: input.createdBy ?? null,
      name: input.name,
      tenantId: input.tenantId,
      tokenHash: hashSecret(token),
      tokenPrefix: token.slice(0, 8)
    }
  });
  return {
    name: record.name,
    scimTokenId: record.scimTokenId,
    tenantId: record.tenantId,
    token,
    tokenPrefix: record.tokenPrefix
  };
}

function scimErrorBody(error: ScimError) {
  return {
    detail: error.message,
    schemas: [ERROR_SCHEMA],
    ...(error.scimType ? { scimType: error.scimType } : {}),
    status: String(error.status)
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return fallback;
}

function extractUserName(body: Record<string, unknown>): string | null {
  const userName = asString(body.userName);
  if (userName) {
    return userName.toLowerCase();
  }
  const emails = body.emails;
  if (Array.isArray(emails)) {
    const primary = emails.find((item) => asRecord(item).primary === true);
    const first = emails[0];
    const value =
      asString(asRecord(primary).value) ?? asString(asRecord(first).value);
    return value ? value.toLowerCase() : null;
  }
  return null;
}

function extractDisplayName(
  body: Record<string, unknown>,
  fallback: string
): string {
  const formatted = asString(asRecord(body.name).formatted);
  const displayName = asString(body.displayName);
  return formatted ?? displayName ?? fallback;
}

function extractGroupNames(body: Record<string, unknown>): string[] {
  const groups = body.groups;
  if (!Array.isArray(groups)) {
    return [];
  }
  const names: string[] = [];
  for (const item of groups) {
    const record = asRecord(item);
    const name = asString(record.display) ?? asString(record.value);
    if (name) {
      names.push(name);
    }
  }
  return names;
}

function parseFilter(raw: unknown): { attribute: string; value: string } | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const match = /([A-Za-z]+)\s+eq\s+"([^"]+)"/iu.exec(raw);
  if (!match?.[1] || match[2] == null) {
    return null;
  }
  return { attribute: match[1], value: match[2] };
}

function parseMembers(value: unknown): ScimGroupMember[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const members: ScimGroupMember[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const memberValue = asString(record.value);
    if (!memberValue) {
      continue;
    }
    members.push({
      display: asString(record.display) ?? undefined,
      value: memberValue
    });
  }
  return members;
}

function membersFromJson(value: unknown): ScimGroupMember[] {
  return parseMembers(value);
}

function toScimUser(input: {
  active: boolean;
  email: string;
  groups: string[];
  name: string;
  userId: string;
}) {
  return {
    active: input.active,
    displayName: input.name,
    emails: [{ primary: true, type: "work", value: input.email }],
    groups: input.groups.map((display) => ({ display, value: display })),
    id: input.userId,
    meta: { resourceType: "User" },
    name: { formatted: input.name },
    schemas: [USER_SCHEMA],
    userName: input.email
  };
}

function toScimGroup(input: {
  displayName: string;
  members: ScimGroupMember[];
  scimGroupId: string;
}) {
  return {
    displayName: input.displayName,
    id: input.scimGroupId,
    members: input.members,
    meta: { resourceType: "Group" },
    schemas: [GROUP_SCHEMA]
  };
}

function listResponse(resources: unknown[]) {
  return {
    Resources: resources,
    itemsPerPage: resources.length,
    schemas: [LIST_SCHEMA],
    startIndex: 1,
    totalResults: resources.length
  };
}

async function authenticateScimToken(
  prisma: ScimPrisma,
  authorization: string | undefined
) {
  const header = authorization?.trim() ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    throw new ScimError("Authentication required.", 401);
  }
  const raw = header.slice("Bearer ".length).trim();
  if (!raw.startsWith(SCIM_TOKEN_PREFIX)) {
    throw new ScimError("Authentication required.", 401);
  }
  try {
    const record = await prisma.scimToken.findUnique({
      where: { tokenHash: hashSecret(raw) }
    });
    if (!record || record.revokedAt) {
      throw new ScimError("Authentication required.", 401);
    }
    await prisma.scimToken.update({
      data: { lastUsedAt: new Date() },
      where: { scimTokenId: record.scimTokenId }
    });
    return record;
  } catch (error) {
    if (error instanceof ScimError) {
      throw error;
    }
    throw new ScimError("Authentication required.", 401);
  }
}

async function loadRoleMappings(prisma: ScimPrisma, tenantId: string) {
  const config = await prisma.tenantSsoConfig.findUnique({
    where: { tenantId }
  });
  return parseStoredRoleMappings(config?.roleMappings);
}

async function groupNamesForUser(
  prisma: ScimPrisma,
  tenantId: string,
  userId: string
) {
  const groups = await prisma.scimGroup.findMany({ where: { tenantId } });
  const names: string[] = [];
  for (const group of groups) {
    const members = membersFromJson(group.members);
    if (members.some((member) => member.value === userId)) {
      names.push(group.displayName);
      if (group.externalId) {
        names.push(group.externalId);
      }
    }
  }
  return names;
}

async function countActiveOwners(
  tx: Pick<ScimPrisma, "membership">,
  tenantId: string
) {
  return tx.membership.count({
    where: { role: "Owner", status: "Active", tenantId }
  });
}

async function assertLastOwnerSafe(
  tx: Pick<ScimPrisma, "membership">,
  membership: { role: string; status: string; tenantId: string },
  next: { active: boolean; role: MembershipRole }
) {
  const demoteOrDisable =
    membership.role === "Owner" &&
    membership.status === "Active" &&
    (next.role !== "Owner" || !next.active);
  if (!demoteOrDisable) {
    return;
  }
  const owners = await countActiveOwners(tx, membership.tenantId);
  if (owners <= 1) {
    throw new ScimError("Cannot deprovision the last owner.", 409, "mutability");
  }
}

async function resolveRole(input: {
  explicitGroups: string[];
  prisma: ScimPrisma;
  tenantId: string;
  userId: string;
}): Promise<MembershipRole> {
  const stored = await groupNamesForUser(input.prisma, input.tenantId, input.userId);
  const mappings = await loadRoleMappings(input.prisma, input.tenantId);
  return mapScimGroupsToMembershipRole({
    groupNames: [...stored, ...input.explicitGroups],
    roleMappings: mappings
  });
}

async function loadTenantUser(
  prisma: ScimPrisma,
  tenantId: string,
  userId: string
) {
  const membership = await prisma.membership.findFirst({
    where: { tenantId, userId }
  });
  if (!membership) {
    throw new ScimError("Resource not found.", 404);
  }
  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user) {
    throw new ScimError("Resource not found.", 404);
  }
  return { membership, user };
}

async function renderUser(
  prisma: ScimPrisma,
  tenantId: string,
  userId: string
) {
  const { membership, user } = await loadTenantUser(prisma, tenantId, userId);
  const groups = await groupNamesForUser(prisma, tenantId, userId);
  return toScimUser({
    active: membership.status === "Active",
    email: user.email,
    groups,
    name: user.name,
    userId: user.userId
  });
}

async function provisionUser(
  prisma: ScimPrisma,
  input: {
    active: boolean;
    email: string;
    explicitGroups: string[];
    name: string;
    tenantId: string;
    tokenUserId: string | null;
  }
) {
  return prisma.$transaction(
    async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: input.email }
      });
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash: null,
            status: "Active"
          }
        }));

      if (existingUser && existingUser.name !== input.name) {
        await tx.user.update({
          data: { name: input.name },
          where: { userId: user.userId }
        });
      }

      const existingMembership = await tx.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: input.tenantId, userId: user.userId }
        }
      });

      const role = await resolveRole({
        explicitGroups: input.explicitGroups,
        prisma: tx as unknown as ScimPrisma,
        tenantId: input.tenantId,
        userId: user.userId
      });

      if (existingMembership) {
        if (!input.active) {
          await assertLastOwnerSafe(tx, existingMembership, {
            active: false,
            role
          });
        }
        const updated = await tx.membership.update({
          data: {
            role,
            status: input.active ? "Active" : "Inactive"
          },
          where: { membershipId: existingMembership.membershipId }
        });
        const action =
          updated.status === "Inactive"
            ? ("user.scim_deprovisioned" as const)
            : ("user.scim_provisioned" as const);
        await writeAuditEvent(tx, {
          action,
          actorType: "System",
          entityId: user.userId,
          entityType: "Tenant",
          metadata: {
            email: user.email,
            role: updated.role,
            source: "scim"
          },
          tenantId: input.tenantId,
          userId: input.tokenUserId
        });
        if (updated.status === "Inactive") {
          await tx.user.update({
            data: { sessionVersion: { increment: 1 } },
            where: { userId: user.userId }
          });
        }
        return { created: false, userId: user.userId };
      }

      const membership = await tx.membership.create({
        data: {
          role,
          status: input.active ? "Active" : "Inactive",
          tenantId: input.tenantId,
          userId: user.userId
        }
      });
      await writeAuditEvent(tx, {
        action: "user.scim_provisioned",
        actorType: "System",
        entityId: user.userId,
        entityType: "Tenant",
        metadata: {
          email: user.email,
          role: membership.role,
          source: "scim"
        },
        tenantId: input.tenantId,
        userId: input.tokenUserId
      });
      return { created: true, userId: user.userId };
    },
    { isolationLevel: "Serializable" }
  );
}

async function patchUser(
  prisma: ScimPrisma,
  input: {
    body: Record<string, unknown>;
    tenantId: string;
    tokenUserId: string | null;
    userId: string;
  }
) {
  const { membership, user } = await loadTenantUser(
    prisma,
    input.tenantId,
    input.userId
  );
  let active = membership.status === "Active";
  let name = user.name;
  let email = user.email;
  const explicitGroups = extractGroupNames(input.body);

  const operations = Array.isArray(input.body.Operations)
    ? input.body.Operations
    : Array.isArray(input.body.operations)
      ? input.body.operations
      : [];

  if (operations.length === 0 && input.body.schemas?.toString().includes(USER_SCHEMA)) {
    if ("active" in input.body) {
      active = coerceBoolean(input.body.active, active);
    }
    if (extractUserName(input.body)) {
      email = extractUserName(input.body) as string;
    }
    name = extractDisplayName(input.body, name);
  }

  for (const operation of operations) {
    const record = asRecord(operation);
    const op = asString(record.op)?.toLowerCase();
    const path = asString(record.path)?.toLowerCase() ?? "";
    const value = record.value;
    if (op === "replace" && (path === "active" || path === "")) {
      if (path === "active" || (value && typeof value === "object" && "active" in asRecord(value))) {
        active = coerceBoolean(
          path === "active" ? value : asRecord(value).active,
          active
        );
      }
    }
    if (op === "replace" && (path === "active" || path.endsWith("active"))) {
      active = coerceBoolean(value, active);
    }
    if (op === "replace" && (path === "name.formatted" || path === "displayname")) {
      const next = asString(value);
      if (next) {
        name = next;
      }
    }
    if (op === "replace" && path === "username") {
      const next = asString(value);
      if (next) {
        email = next.toLowerCase();
      }
    }
  }

  const role = await resolveRole({
    explicitGroups,
    prisma,
    tenantId: input.tenantId,
    userId: input.userId
  });

  await prisma.$transaction(
    async (tx) => {
      await assertLastOwnerSafe(tx, membership, { active, role });
      if (name !== user.name || email !== user.email) {
        await tx.user.update({
          data: { email, name },
          where: { userId: user.userId }
        });
      }
      const nextStatus = active ? "Active" : "Inactive";
      if (membership.status !== nextStatus || membership.role !== role) {
        await tx.membership.update({
          data: { role, status: nextStatus },
          where: { membershipId: membership.membershipId }
        });
      }
      if (membership.status === "Active" && nextStatus === "Inactive") {
        await tx.user.update({
          data: { sessionVersion: { increment: 1 } },
          where: { userId: user.userId }
        });
        await writeAuditEvent(tx, {
          action: "user.scim_deprovisioned",
          actorType: "System",
          entityId: user.userId,
          entityType: "Tenant",
          metadata: { email, role, source: "scim" },
          tenantId: input.tenantId,
          userId: input.tokenUserId
        });
      } else if (membership.status !== nextStatus || membership.role !== role) {
        await writeAuditEvent(tx, {
          action: "user.scim_provisioned",
          actorType: "System",
          entityId: user.userId,
          entityType: "Tenant",
          metadata: { email, role, source: "scim" },
          tenantId: input.tenantId,
          userId: input.tokenUserId
        });
      }
    },
    { isolationLevel: "Serializable" }
  );
}

async function applyGroupMemberPatch(
  prisma: ScimPrisma,
  input: {
    body: Record<string, unknown>;
    groupId: string;
    tenantId: string;
  }
) {
  const group = await prisma.scimGroup.findFirst({
    where: { scimGroupId: input.groupId, tenantId: input.tenantId }
  });
  if (!group) {
    throw new ScimError("Resource not found.", 404);
  }
  let members = membersFromJson(group.members);
  const operations = Array.isArray(input.body.Operations)
    ? input.body.Operations
    : Array.isArray(input.body.operations)
      ? input.body.operations
      : [];

  for (const operation of operations) {
    const record = asRecord(operation);
    const op = asString(record.op)?.toLowerCase();
    const path = asString(record.path)?.toLowerCase() ?? "";
    const value = parseMembers(record.value);
    if (path && path !== "members") {
      continue;
    }
    if (op === "add") {
      const seen = new Set(members.map((member) => member.value));
      for (const member of value) {
        if (!seen.has(member.value)) {
          members.push(member);
          seen.add(member.value);
        }
      }
    } else if (op === "remove") {
      const remove = new Set(value.map((member) => member.value));
      members = members.filter((member) => !remove.has(member.value));
    } else if (op === "replace") {
      members = value;
    }
  }

  if (operations.length === 0 && Array.isArray(input.body.members)) {
    members = parseMembers(input.body.members);
  }

  const updated = await prisma.scimGroup.update({
    data: { members: members as Prisma.InputJsonValue },
    where: { scimGroupId: group.scimGroupId }
  });

  for (const member of members) {
    const membership = await prisma.membership.findFirst({
      where: { tenantId: input.tenantId, userId: member.value }
    });
    if (!membership) {
      continue;
    }
    const role = await resolveRole({
      explicitGroups: [],
      prisma,
      tenantId: input.tenantId,
      userId: member.value
    });
    if (role !== membership.role) {
      try {
        await assertLastOwnerSafe(prisma, membership, {
          active: membership.status === "Active",
          role
        });
        await prisma.membership.update({
          data: { role },
          where: { membershipId: membership.membershipId }
        });
      } catch (error) {
        if (error instanceof ScimError && error.status === 409) {
          continue;
        }
        throw error;
      }
    }
  }
  return updated;
}

function serviceProviderConfig() {
  return {
    authenticationSchemes: [
      {
        description: "Tenant SCIM bearer token hashed at rest.",
        name: "OAuth Bearer Token",
        specUri: "http://www.rfc-editor.org/info/rfc6750",
        type: "oauthbearertoken"
      }
    ],
    bulk: { maxOperations: 0, maxPayloadSize: 0, supported: false },
    changePassword: { supported: false },
    etag: { supported: false },
    filter: { maxResults: 200, supported: true },
    patch: { supported: true },
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    sort: { supported: false }
  };
}

function resourceTypes() {
  return [
    {
      endpoint: "/Users",
      id: "User",
      name: "User",
      schema: USER_SCHEMA
    },
    {
      endpoint: "/Groups",
      id: "Group",
      name: "Group",
      schema: GROUP_SCHEMA
    }
  ];
}

async function handleAuthenticated(
  prisma: ScimPrisma,
  request: FastifyRequest,
  tenantId: string,
  tokenUserId: string | null
): Promise<{ body: unknown; status: number }> {
  const url = new URL(request.url, "http://periscan.local");
  const path = url.pathname.replace(/\/+$/u, "") || "/";
  const method = request.method.toUpperCase();
  const body = asRecord(request.body);
  const filter = parseFilter(
    typeof request.query === "object" && request.query
      ? (request.query as { filter?: unknown }).filter
      : url.searchParams.get("filter")
  );

  if (path.endsWith("/ServiceProviderConfig") && method === "GET") {
    return { body: serviceProviderConfig(), status: 200 };
  }
  if (path.endsWith("/ResourceTypes") && method === "GET") {
    return { body: listResponse(resourceTypes()), status: 200 };
  }
  if (path.endsWith("/Schemas") && method === "GET") {
    return {
      body: listResponse([
        { id: USER_SCHEMA, name: "User" },
        { id: GROUP_SCHEMA, name: "Group" }
      ]),
      status: 200
    };
  }

  const userMatch = /\/Users(?:\/([^/]+))?$/u.exec(path);
  const groupMatch = /\/Groups(?:\/([^/]+))?$/u.exec(path);

  if (userMatch) {
    const userId = userMatch[1];
    if (!userId) {
      if (method === "GET") {
        const memberships = await prisma.membership.findMany({
          where: { tenantId }
        });
        const resources = [];
        for (const membership of memberships) {
          const user = await prisma.user.findUnique({
            where: { userId: membership.userId }
          });
          if (!user) {
            continue;
          }
          if (
            filter?.attribute.toLowerCase() === "username" &&
            user.email.toLowerCase() !== filter.value.toLowerCase()
          ) {
            continue;
          }
          const groups = await groupNamesForUser(prisma, tenantId, user.userId);
          resources.push(
            toScimUser({
              active: membership.status === "Active",
              email: user.email,
              groups,
              name: user.name,
              userId: user.userId
            })
          );
        }
        return { body: listResponse(resources), status: 200 };
      }
      if (method === "POST") {
        const email = extractUserName(body);
        if (!email) {
          throw new ScimError("userName is required.", 400, "invalidValue");
        }
        const result = await provisionUser(prisma, {
          active: coerceBoolean(body.active, true),
          email,
          explicitGroups: extractGroupNames(body),
          name: extractDisplayName(body, email),
          tenantId,
          tokenUserId
        });
        return {
          body: await renderUser(prisma, tenantId, result.userId),
          status: result.created ? 201 : 200
        };
      }
    } else {
      if (method === "GET") {
        return { body: await renderUser(prisma, tenantId, userId), status: 200 };
      }
      if (method === "PUT") {
        await patchUser(prisma, {
          body: { ...body, schemas: [PATCH_SCHEMA], Operations: [] },
          tenantId,
          tokenUserId,
          userId
        });
        const email = extractUserName(body);
        const name = extractDisplayName(body, email ?? userId);
        const active = coerceBoolean(body.active, true);
        await prisma.$transaction(async (tx) => {
          const membership = await tx.membership.findFirst({
            where: { tenantId, userId }
          });
          if (!membership) {
            throw new ScimError("Resource not found.", 404);
          }
          const role = await resolveRole({
            explicitGroups: extractGroupNames(body),
            prisma: tx as unknown as ScimPrisma,
            tenantId,
            userId
          });
          await assertLastOwnerSafe(tx, membership, { active, role });
          await tx.user.update({
            data: {
              email: email ?? undefined,
              name
            },
            where: { userId }
          });
          await tx.membership.update({
            data: { role, status: active ? "Active" : "Inactive" },
            where: { membershipId: membership.membershipId }
          });
        });
        return { body: await renderUser(prisma, tenantId, userId), status: 200 };
      }
      if (method === "PATCH") {
        await patchUser(prisma, { body, tenantId, tokenUserId, userId });
        return { body: await renderUser(prisma, tenantId, userId), status: 200 };
      }
      if (method === "DELETE") {
        await patchUser(prisma, {
          body: {
            Operations: [{ op: "replace", path: "active", value: false }],
            schemas: [PATCH_SCHEMA]
          },
          tenantId,
          tokenUserId,
          userId
        });
        return { body: {}, status: 204 };
      }
    }
  }

  if (groupMatch) {
    const groupId = groupMatch[1];
    if (!groupId) {
      if (method === "GET") {
        const groups = await prisma.scimGroup.findMany({ where: { tenantId } });
        const resources = groups
          .filter((group) => {
            if (!filter) {
              return true;
            }
            if (filter.attribute.toLowerCase() === "displayname") {
              return group.displayName.toLowerCase() === filter.value.toLowerCase();
            }
            return true;
          })
          .map((group) =>
            toScimGroup({
              displayName: group.displayName,
              members: membersFromJson(group.members),
              scimGroupId: group.scimGroupId
            })
          );
        return { body: listResponse(resources), status: 200 };
      }
      if (method === "POST") {
        const displayName = asString(body.displayName);
        if (!displayName) {
          throw new ScimError("displayName is required.", 400, "invalidValue");
        }
        const created = await prisma.scimGroup.create({
          data: {
            displayName,
            externalId: asString(body.externalId),
            members: parseMembers(body.members) as Prisma.InputJsonValue,
            tenantId
          }
        });
        return {
          body: toScimGroup({
            displayName: created.displayName,
            members: membersFromJson(created.members),
            scimGroupId: created.scimGroupId
          }),
          status: 201
        };
      }
    } else {
      const group = await prisma.scimGroup.findFirst({
        where: { scimGroupId: groupId, tenantId }
      });
      if (!group) {
        throw new ScimError("Resource not found.", 404);
      }
      if (method === "GET") {
        return {
          body: toScimGroup({
            displayName: group.displayName,
            members: membersFromJson(group.members),
            scimGroupId: group.scimGroupId
          }),
          status: 200
        };
      }
      if (method === "PATCH" || method === "PUT") {
        const updated = await applyGroupMemberPatch(prisma, {
          body,
          groupId,
          tenantId
        });
        return {
          body: toScimGroup({
            displayName: asString(body.displayName) ?? updated.displayName,
            members: membersFromJson(updated.members),
            scimGroupId: updated.scimGroupId
          }),
          status: 200
        };
      }
      if (method === "DELETE") {
        await prisma.scimGroup.delete({ where: { scimGroupId: groupId } });
        return { body: {}, status: 204 };
      }
    }
  }

  throw new ScimError("Resource not found.", 404);
}

export function registerScimRoutes(
  app: FastifyInstance,
  deps: { prisma: ScimPrisma }
) {
  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token = await authenticateScimToken(
        deps.prisma,
        request.headers.authorization
      );
      const result = await handleAuthenticated(
        deps.prisma,
        request,
        token.tenantId,
        token.createdBy
      );
      return reply
        .status(result.status)
        .header("content-type", SCIM_CONTENT_TYPE)
        .send(result.body);
    } catch (error) {
      if (error instanceof ScimError) {
        return reply
          .status(error.status)
          .header("content-type", SCIM_CONTENT_TYPE)
          .send(scimErrorBody(error));
      }
      throw error;
    }
  };

  const paths = [
    "/api/v1/scim/v2/ServiceProviderConfig",
    "/api/v1/scim/v2/ResourceTypes",
    "/api/v1/scim/v2/Schemas",
    "/api/v1/scim/v2/Users",
    "/api/v1/scim/v2/Users/:id",
    "/api/v1/scim/v2/Groups",
    "/api/v1/scim/v2/Groups/:id"
  ];
  for (const path of paths) {
    app.all(
      path,
      {
        schema: {
          hide: true,
          tags: ["tenant"]
        }
      },
      handler
    );
  }
}
