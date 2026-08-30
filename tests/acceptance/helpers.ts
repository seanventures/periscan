import { randomUUID } from "node:crypto";

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

/**
 * Basic cleanup to keep DB clean across acc runs (delete by email prefix).
 * Called in afterEach/try-finally. Best-effort (ignore constraint errs for safety in test).
 * Targets users by email prefix-*, and tenants by name prefix (rough match).
 */
export async function cleanupTestDataByEmailPrefix(
  prisma: PrismaClient,
  prefixes: string[]
): Promise<void> {
  for (const prefix of prefixes) {
    try {
      // delete users first (may have FKs)
      // prefix passed with trailing - e.g. "acceptance-" to match emails "acceptance-xxx@"
      await prisma.user.deleteMany({
        where: { email: { startsWith: prefix } }
      });
      // tenants by name (signup uses tenantName as prefix base)
      await prisma.tenant.deleteMany({
        where: { name: { startsWith: prefix } }
      });
      // also scopes/integrations etc could be cleaned but keep minimal per task
    } catch {
      // ignore to not mask primary test errors; real-first but test hygiene only
    }
  }
}
