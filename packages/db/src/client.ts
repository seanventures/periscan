import { AsyncLocalStorage } from "node:async_hooks";

import { type Prisma, PrismaClient } from "@prisma/client";
import { resolveDatabaseUrlFromEnv } from "./database-env.js";

let prismaClientSingleton: PrismaClient | undefined;

/**
 * Per-request tenant binding for the Postgres row-level-security backstop.
 *
 * A value with a non-null `tenantId` means "every query in this async context
 * must run bound to that tenant" — the RLS-extended client (below) transparently
 * drops to the `periscan_rls` role and sets both tenant GUCs
 * (`app.current_tenant` and `app.current_tenant_id`) so the tenant-isolation
 * policies actually bite. `tenantId: null` means "explicitly cross-tenant"
 * (login/SSO/MSSP rollups) and the query runs as the owner (RLS permits every
 * row when the GUC is unset). No store at all → same as null.
 *
 * `inManagedTx` marks that we are already inside a tenant-bound transaction, so
 * nested query wrapping is suppressed (the enclosing tx already set the GUC).
 */
interface TenantRlsStore {
  tenantId: string | null;
  inManagedTx: boolean;
}

const tenantRlsStore = new AsyncLocalStorage<TenantRlsStore>();

/**
 * Bind the current async context (a request handler, after auth resolves the
 * tenant) to `tenantId`. Uses `enterWith` so it persists for the remainder of
 * the request's async chain without wrapping every handler in a callback.
 */
export function enterTenantRlsContext(tenantId: string): void {
  tenantRlsStore.enterWith({ inManagedTx: false, tenantId });
}

/**
 * Reset the binding to explicitly unbound. Call this at the START of every
 * request (before auth runs) so a binding set by a previous request on the same
 * async context — `enterWith` is sticky and can outlive its intended scope —
 * cannot leak into an unauthenticated or different-tenant request. Auth then
 * re-binds via `enterTenantRlsContext` once the tenant is known.
 */
export function resetTenantRlsContext(): void {
  tenantRlsStore.enterWith({ inManagedTx: false, tenantId: null });
}

/**
 * Run `fn` with tenant binding explicitly cleared — for the legitimately
 * cross-tenant paths (MSSP portfolio rollups, platform reads) that must see more
 * than one tenant's rows. Queries inside run as the owner with the GUC unset, so
 * RLS permits every row and the code's own filters govern.
 */
export function runWithoutTenantRls<T>(fn: () => Promise<T>): Promise<T> {
  return tenantRlsStore.run({ inManagedTx: false, tenantId: null }, fn);
}

/** The tenant currently bound to this async context, if any. */
export function getCurrentTenantRls(): string | null {
  return tenantRlsStore.getStore()?.tenantId ?? null;
}

/**
 * Build a Prisma client that binds the app's own interactive transactions to the
 * async-context tenant (when one is set via `enterTenantRlsContext`). Every
 * mutation the app performs already runs inside a `$transaction`; the override
 * below sets `SET LOCAL ROLE periscan_rls` + both tenant GUCs on that
 * transaction's connection, so the RLS policies actively enforce for the writes
 * inside it — a cross-tenant INSERT/UPDATE/DELETE is rejected by the DB even if a
 * hand-written filter is wrong or missing.
 *
 * DELIBERATELY scoped to transactions (writes), NOT every query. Wrapping each
 * standalone read in its own transaction was measured to exhaust the connection
 * pool and deadlock when a transaction's callback fans out reads on the pool
 * (classic per-query-RLS-transaction failure mode). Reads therefore continue to
 * rely on the app's explicit tenant filters plus the permissive-when-unset
 * policy; read-path binding, where wanted, uses `runWithTenantRls` to share one
 * bound transaction across a handler rather than one transaction per query.
 *
 * HONESTY (panel P03-3 / P04-7): this is a write-path RLS backstop, not
 * default-read isolation. Product docs and threat models must not claim
 * "every Prisma query is RLS-bound." Cross-tenant read leaks remain a
 * convention risk mitigated by filters + selective runWithTenantRls.
 */

/** Stable honesty note for OpenAPI / readiness docs that mention multi-tenant isolation. */
export const RLS_ISOLATION_HONESTY =
  "Postgres RLS actively enforces tenant isolation on write transactions (SET LOCAL ROLE periscan_rls + app.current_tenant). Standalone reads remain correct-by-convention via explicit tenantId filters unless runWithTenantRls is used.";
function createRlsExtendedClient(base: PrismaClient): PrismaClient {
  const extended = base.$extends({
    client: {
      $transaction(...txArgs: unknown[]) {
        const store = tenantRlsStore.getStore();
        const tenantId = store?.tenantId;

        // Interactive (callback) form under a tenant binding: run the app's
        // callback inside a tenant-bound tx so its writes enforce RLS. `tx` is
        // the base transaction client (no query extension), so inner ops run on
        // this one bound connection and cannot spawn nested transactions.
        if (
          typeof txArgs[0] === "function" &&
          tenantId &&
          !store?.inManagedTx
        ) {
          const fn = txArgs[0] as (
            tx: Prisma.TransactionClient
          ) => Promise<unknown>;
          const options = txArgs[1] as
            | { maxWait?: number; timeout?: number; isolationLevel?: unknown }
            | undefined;

          return base.$transaction(async (tx) => {
            await tx.$executeRaw`SET LOCAL ROLE periscan_rls`;
            // Bind both historical (`app.current_tenant`) and later
            // (`app.current_tenant_id`) policy GUCs. Many feature-table policies
            // only read the `_id` name; setting only the legacy key made those
            // same-tenant transactional writes fail under FORCE RLS.
            await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

            return tenantRlsStore.run({ inManagedTx: true, tenantId }, () =>
              fn(tx)
            );
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }, options as any);
        }

        // Sequential-array form, or no tenant binding → delegate unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (base.$transaction as any)(txArgs[0], txArgs[1]);
      }
    }
  });

  return extended as unknown as PrismaClient;
}

export function createPrismaClient() {
  process.env.DATABASE_URL ??= resolveDatabaseUrlFromEnv();

  return createRlsExtendedClient(new PrismaClient());
}

export function getPrismaClient() {
  if (!prismaClientSingleton) {
    prismaClientSingleton = createPrismaClient();
  }

  return prismaClientSingleton;
}

/**
 * Run `fn` inside a transaction bound to `tenantId` via the Postgres tenant
 * GUCs (`app.current_tenant` and `app.current_tenant_id`), so the
 * row-level-security tenant-isolation backstop is ACTIVELY enforced for every
 * query inside it.
 *
 * This is the explicit, imperative form of the binding the RLS-extended client
 * applies automatically from async-context; it remains available for call sites
 * (jobs, scripts, tests) that want to bind a block without an ambient context.
 *
 * The GUC is set with `set_config(..., is_local => true)` so it is scoped to this
 * transaction only and cannot leak onto a pooled connection.
 */
export async function runWithTenantRls<T>(
  prisma: PrismaClient,
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // Drop to the non-superuser, non-bypassrls role for this transaction so RLS
      // actually enforces (the app's own role is the owner/superuser and bypasses
      // it). SET LOCAL scopes both the role and the GUC to this transaction.
      await tx.$executeRaw`SET LOCAL ROLE periscan_rls`;
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;

      return fn(tx);
    },
    // The default five-second interactive timeout is too short when a release
    // gate is concurrently exercising migrations, browser traffic, and RLS.
    // Keep the bounded transaction while allowing ordinary pool contention.
    { timeout: 15_000 }
  );
}
