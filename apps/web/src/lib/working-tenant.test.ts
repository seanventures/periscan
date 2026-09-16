import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WORKING_TENANT_CHANGE_EVENT,
  WORKING_TENANT_COOKIE,
  WORKING_TENANT_ENTER_TOAST_KEY,
  WORKING_TENANT_STORAGE_KEY,
  clearWorkingTenant,
  consumeWorkingTenantEnterToast,
  markWorkingTenantEnterToast,
  readWorkingTenant,
  resolveTenantHeaderForPath,
  setWorkingTenant,
  type WorkingTenantContext
} from "./working-tenant";

const CLIENT_ID = "44444444-4444-4444-8444-444444444444";
const PARENT_ID = "11111111-1111-4111-8111-111111111111";

const sample: WorkingTenantContext = {
  tenantId: CLIENT_ID,
  name: "Customer One",
  homeTenantId: PARENT_ID,
  homeTenantName: "Partner MSSP"
};

describe("working-tenant", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `${WORKING_TENANT_COOKIE}=; Path=/; Max-Age=0`;
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `${WORKING_TENANT_COOKIE}=; Path=/; Max-Age=0`;
  });

  it("writes and reads working tenant from storage", () => {
    setWorkingTenant(sample);
    expect(readWorkingTenant()).toEqual(sample);
    expect(localStorage.getItem(WORKING_TENANT_STORAGE_KEY)).toContain(
      CLIENT_ID
    );
  });

  it("clears working tenant from storage and cookie", () => {
    setWorkingTenant(sample);
    clearWorkingTenant();
    expect(readWorkingTenant()).toBeNull();
    expect(localStorage.getItem(WORKING_TENANT_STORAGE_KEY)).toBeNull();
  });

  it("rejects invalid tenant ids", () => {
    setWorkingTenant({
      tenantId: "not-a-uuid",
      name: "Bad"
    });
    expect(readWorkingTenant()).toBeNull();
  });

  it("ignores corrupt storage payloads", () => {
    localStorage.setItem(WORKING_TENANT_STORAGE_KEY, "{not-json");
    expect(readWorkingTenant()).toBeNull();
  });

  it("emits a change event on set and clear", () => {
    const handler = vi.fn();
    window.addEventListener(WORKING_TENANT_CHANGE_EVENT, handler);
    setWorkingTenant(sample);
    clearWorkingTenant();
    window.removeEventListener(WORKING_TENANT_CHANGE_EVENT, handler);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("resolveTenantHeaderForPath uses client id for product routes", () => {
    expect(resolveTenantHeaderForPath("/findings", sample)).toBe(CLIENT_ID);
    expect(
      resolveTenantHeaderForPath("/api/v1/validated-findings", sample)
    ).toBe(CLIENT_ID);
  });

  it("resolveTenantHeaderForPath uses home parent for MSSP portfolio APIs", () => {
    expect(
      resolveTenantHeaderForPath("/tenants/current/client-portfolio", sample)
    ).toBe(PARENT_ID);
    expect(resolveTenantHeaderForPath("/tenants/current/clients", sample)).toBe(
      PARENT_ID
    );
  });

  it("resolveTenantHeaderForPath omits header when no working tenant", () => {
    expect(resolveTenantHeaderForPath("/findings", null)).toBeUndefined();
  });

  it("parent-scoped path without home falls back to session default (no header)", () => {
    const orphan: WorkingTenantContext = {
      tenantId: CLIENT_ID,
      name: "Customer One"
    };
    expect(
      resolveTenantHeaderForPath("/tenants/current/clients", orphan)
    ).toBeUndefined();
  });

  it("arms and consumes one-shot Working as enter toast (P05)", () => {
    markWorkingTenantEnterToast("Customer One Security");
    expect(sessionStorage.getItem(WORKING_TENANT_ENTER_TOAST_KEY)).toBe(
      "Customer One Security"
    );
    expect(consumeWorkingTenantEnterToast()).toBe("Customer One Security");
    expect(consumeWorkingTenantEnterToast()).toBeNull();
    expect(sessionStorage.getItem(WORKING_TENANT_ENTER_TOAST_KEY)).toBeNull();
  });

  it("clearWorkingTenant also clears enter toast", () => {
    markWorkingTenantEnterToast("Customer One");
    clearWorkingTenant();
    expect(consumeWorkingTenantEnterToast()).toBeNull();
  });
});
