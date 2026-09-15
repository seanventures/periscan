import { randomUUID } from "node:crypto";
import type { Server } from "node:http";

import type { PrismaClient } from "@prisma/client";

import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

export function getSessionCookie(response: {
  cookies: Array<{
    name: string;
    value: string;
  }>;
}): string {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );

  if (!cookie) {
    throw new Error(
      "Expected API response to include a Periscan session cookie."
    );
  }

  return cookie.value;
}

export function authHeaders(cookie: string): Record<string, string> {
  return {
    [SESSION_COOKIE_NAME]: cookie
  };
}

// Alias for compatibility with existing test code
export const authCookies = authHeaders;

export function safeRequestedAction(overrides: Record<string, boolean> = {}) {
  return {
    credentialTheft: false,
    destructive: false,
    persistence: false,
    realDataExfiltration: false,
    requiresInternalRunner: false,
    requiresTimeWindow: false,
    uncontrolledExploitChaining: false,
    ...overrides
  };
}

/**
 * DB probe that MUST use the *same* prisma instance the test will pass to runtime-services.
 * Throws a clear, multi-line actionable Error (never lets Prisma init error become 500 in signup etc).
 * Exact steps per task spec for noisy dev envs with multiple postgres instances.
 */
export async function probeDatabaseConnection(
  prisma: PrismaClient
): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const guidance = `Acceptance tests require a reachable periscan postgres with matching credentials.
To run:
1. docker compose -f infra/docker-compose/docker-compose.yml up -d
2. stop or remap the conflicting Postgres listener on 5432 (run 'docker ps | grep postgres' or 'lsof -i:5432' then stop the relevant process), or export PERISCAN_POSTGRES_PUBLISHED_PORT=5434 + DATABASE_URL for alt port 5434, then pnpm test:acceptance
   e.g.
   export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
   docker compose -f infra/docker-compose/docker-compose.yml up -d
   export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
3. pnpm test:acceptance
Original error: ${errorMessage}`;
    throw new Error(guidance);
  }
}

/**
 * Small signup helper to DRY creation of test tenants/users + cookie.
 * Supports tenantType for MSSP/Organization coverage.
 */
export async function performSignup(
  app: any,
  prefix: string,
  tenantName = "Test Tenant",
  tenantType?: "Organization" | "MSSP"
): Promise<{ email: string; cookie: string; response: any }> {
  const email = uniqueEmail(prefix);
  const payload: any = {
    email,
    name: `${prefix} Owner`,
    password: "periscan-acceptance-password",
    tenantName
  };
  if (tenantType) {
    payload.tenantType = tenantType;
  }
  const response = await app.inject({
    method: "POST",
    payload,
    url: "/api/v1/auth/signup"
  });
  if (response.statusCode !== 201) {
    // surface for great DX on failure in acc
    throw new Error(
      `Signup failed with ${response.statusCode}: ${response.body}`
    );
  }
  const cookie = getSessionCookie(response);
  return { email, cookie, response };
}

function quotePgIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to interpolate unexpected identifier: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Close a Node HTTP test double. `server.close()` waits for keep-alive
 * sockets, which Fastify/undici leave open — that hangs Vitest afterEach
 * (default hookTimeout 10s). Drop idle connections first.
 */
export async function closeHttpServer(server: Server): Promise<void> {
  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function disconnectPrismaClient(
  prisma: PrismaClient
): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    // Engine never started or already disconnected.
  }
}

/**
 * Best-effort acc teardown by email/name prefix.
 *
 * Resolve tenantIds from users/memberships (email prefix) plus tenants (name
 * prefix), then DELETE WHERE tenant_id = ANY(...) so fat lab tables use the
 * tenant_id index. A metadata/email filter on audit_events seq-scans ~7M rows
 * and hangs afterEach (default hookTimeout 10s).
 *
 * Tenant/user deletes fire unindexed ON DELETE SET NULL on fat tables
 * (policy_decisions.approved_by, validation_missions.policy_decision_id,
 * validation_runs.policy_decision_id). Replica-role skips those triggers after
 * the indexed tenant_id deletes.
 */
export async function cleanupTestDataByEmailPrefix(
  prisma: PrismaClient,
  prefixes: string[]
): Promise<void> {
  try {
    if (typeof prisma.$connect === "function") {
      await prisma.$connect();
    }
  } catch {
    // Reconnect is best-effort; prefix deletes still run and are swallowed.
  }
  for (const prefix of prefixes) {
    try {
      const users = await prisma.user.findMany({
        select: {
          memberships: { select: { tenantId: true } },
          userId: true
        },
        where: { email: { startsWith: prefix } }
      });
      const userIds = users.map((user) => user.userId);
      const namedTenants = await prisma.tenant.findMany({
        select: { tenantId: true },
        where: { name: { startsWith: prefix } }
      });
      const tenantIds = [
        ...new Set([
          ...users.flatMap((user) =>
            user.memberships.map((membership) => membership.tenantId)
          ),
          ...namedTenants.map((tenant) => tenant.tenantId)
        ])
      ];

      if (tenantIds.length === 0 && userIds.length === 0) {
        continue;
      }

      await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
          if (tenantIds.length > 0) {
            const tables = await tx.$queryRaw<{ relname: string }[]>`
              SELECT c.relname
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              JOIN pg_attribute a
                ON a.attrelid = c.oid
                AND a.attname = 'tenant_id'
                AND NOT a.attisdropped
              WHERE n.nspname = 'public'
                AND c.relkind = 'r'
                AND c.relname <> 'tenants'
              ORDER BY c.relname
            `;
            for (const table of tables) {
              await tx.$executeRawUnsafe(
                `DELETE FROM ${quotePgIdent(table.relname)} WHERE tenant_id = ANY($1::uuid[])`,
                tenantIds
              );
            }
            await tx.tenant.deleteMany({
              where: { tenantId: { in: tenantIds } }
            });
          }
          if (userIds.length > 0) {
            await tx.user.deleteMany({
              where: { userId: { in: userIds } }
            });
          }
        },
        { timeout: 8_000 }
      );
    } catch {
      // ignore to not mask primary test errors; real-first but test hygiene only
    }
  }
}
