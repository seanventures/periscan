/**
 * Working tenant context for MSSP operators (ICP-P0-1 / PERISCAN-486).
 *
 * When set, browser API calls send `x-periscan-tenant-id` so the session
 * resolves into a managed client tenant. Storage is dual (localStorage +
 * non-httpOnly cookie) so reloads keep context; the proxy already forwards the
 * request header when the client attaches it.
 *
 * Parent-scoped portfolio APIs must not run under the client context — see
 * `resolveTenantHeaderForPath` in the API client.
 */

export const WORKING_TENANT_STORAGE_KEY = "periscan-working-tenant";
export const WORKING_TENANT_COOKIE = "periscan-working-tenant";
export const WORKING_TENANT_CHANGE_EVENT = "periscan-working-tenant-change";
/** One-shot toast after Open client success — consumed once by shell chrome. */
export const WORKING_TENANT_ENTER_TOAST_KEY =
  "periscan-working-tenant-enter-toast";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkingTenantContext = {
  /** Client (or switched) tenant id */
  tenantId: string;
  /** Display name for chrome ("Working as: …") */
  name: string;
  /** MSSP parent tenant to restore for portfolio / Leave */
  homeTenantId?: string;
  homeTenantName?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function parseWorkingTenant(raw: unknown): WorkingTenantContext | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (
    typeof record.tenantId !== "string" ||
    !isUuid(record.tenantId) ||
    typeof record.name !== "string" ||
    !record.name.trim()
  ) {
    return null;
  }
  const ctx: WorkingTenantContext = {
    tenantId: record.tenantId,
    name: record.name.trim()
  };
  if (
    typeof record.homeTenantId === "string" &&
    isUuid(record.homeTenantId)
  ) {
    ctx.homeTenantId = record.homeTenantId;
  }
  if (
    typeof record.homeTenantName === "string" &&
    record.homeTenantName.trim()
  ) {
    ctx.homeTenantName = record.homeTenantName.trim();
  }
  return ctx;
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return null;
}

function writeCookie(name: string, value: string | null) {
  if (typeof document === "undefined") {
    return;
  }
  if (value == null) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  // 7-day persistence; not httpOnly so the browser client can manage it.
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function emitChange() {
  if (!isBrowser()) {
    return;
  }
  try {
    window.dispatchEvent(new Event(WORKING_TENANT_CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function readWorkingTenant(): WorkingTenantContext | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    const fromStorage = localStorage.getItem(WORKING_TENANT_STORAGE_KEY);
    if (fromStorage) {
      const parsed = parseWorkingTenant(JSON.parse(fromStorage));
      if (parsed) {
        return parsed;
      }
    }
  } catch {
    // fall through to cookie
  }
  try {
    const fromCookie = readCookieValue(WORKING_TENANT_COOKIE);
    if (fromCookie) {
      return parseWorkingTenant(JSON.parse(fromCookie));
    }
  } catch {
    // ignore corrupt cookie
  }
  return null;
}

export function setWorkingTenant(ctx: WorkingTenantContext): void {
  if (!isBrowser()) {
    return;
  }
  const normalized = parseWorkingTenant(ctx);
  if (!normalized) {
    return;
  }
  const payload = JSON.stringify(normalized);
  try {
    localStorage.setItem(WORKING_TENANT_STORAGE_KEY, payload);
  } catch {
    // private mode / quota — still try cookie
  }
  writeCookie(WORKING_TENANT_COOKIE, payload);
  emitChange();
}

export function clearWorkingTenant(): void {
  if (!isBrowser()) {
    return;
  }
  try {
    localStorage.removeItem(WORKING_TENANT_STORAGE_KEY);
  } catch {
    // ignore
  }
  writeCookie(WORKING_TENANT_COOKIE, null);
  try {
    sessionStorage.removeItem(WORKING_TENANT_ENTER_TOAST_KEY);
  } catch {
    // ignore
  }
  emitChange();
}

/**
 * Arm a one-shot "Working as {name}" status after Open client succeeds.
 * Shell chrome consumes it once so the operator sees confirmation without
 * inventing a second persistent banner.
 */
export function markWorkingTenantEnterToast(name: string): void {
  if (!isBrowser()) {
    return;
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return;
  }
  try {
    sessionStorage.setItem(WORKING_TENANT_ENTER_TOAST_KEY, trimmed);
  } catch {
    // private mode — toast is best-effort
  }
  emitChange();
}

/** Read and clear the one-shot enter toast. Returns null if none armed. */
export function consumeWorkingTenantEnterToast(): string | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    const value = sessionStorage.getItem(WORKING_TENANT_ENTER_TOAST_KEY);
    if (!value) {
      return null;
    }
    sessionStorage.removeItem(WORKING_TENANT_ENTER_TOAST_KEY);
    return value;
  } catch {
    return null;
  }
}

/**
 * Tenant id to send as `x-periscan-tenant-id`.
 *
 * Parent-scoped MSSP management routes must run against the home/parent MSSP
 * tenant (or the session default when no home is stored), never the client
 * working tenant — otherwise create/list portfolio fail closed.
 */
export function resolveTenantHeaderForPath(
  path: string,
  working: WorkingTenantContext | null = readWorkingTenant()
): string | undefined {
  if (!working) {
    return undefined;
  }
  const normalized = path.includes("/api/v1")
    ? path.slice(path.indexOf("/api/v1") + "/api/v1".length)
    : path.startsWith("/")
      ? path
      : `/${path}`;
  const pathOnly = normalized.split("?")[0] ?? normalized;
  const parentScoped =
    pathOnly === "/tenants/current/client-portfolio" ||
    pathOnly === "/tenants/current/clients";

  if (parentScoped) {
    return working.homeTenantId;
  }
  return working.tenantId;
}
