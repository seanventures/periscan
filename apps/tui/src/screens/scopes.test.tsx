import React from "react";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Scope } from "@periscan/shared";

import type { PeriscanApi } from "../lib/api.js";
import { ScopesScreen } from "./scopes.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-08-30T12:00:00.000Z";

function scope(
  overrides: Partial<Scope> & Pick<Scope, "scopeId" | "scopeType" | "value">
): Scope {
  return {
    assetClass: "Other",
    businessCriticality: "Moderate",
    createdAt: NOW,
    createdBy: null,
    effectiveMaxSafetyLevel: "BASLite",
    externalValidationProfileId: null,
    isOperationalTechnology: false,
    lastPostureCheckAt: null,
    maxSafetyLevel: "BASLite",
    nextPostureCheckAt: null,
    purdueLevel: null,
    safetyRestrictionReason: "This scope permits validation through BASLite.",
    segmentName: null,
    sensitivity: "Moderate",
    tags: [],
    tenantId: TENANT_ID,
    updatedAt: NOW,
    verificationExpiresAt: null,
    verificationMethod: null,
    verificationStale: false,
    verificationStatus: "Pending",
    verificationToken: "periscan-token",
    verifiedAt: null,
    verifiedBy: null,
    ...overrides
  };
}

function fakeApi(overrides: Partial<PeriscanApi> = {}): PeriscanApi {
  return {
    apiUrl: "http://tui.test",
    createScope: vi.fn(),
    health: vi.fn(),
    listScopes: vi.fn().mockResolvedValue([]),
    verifyScope: vi.fn(),
    ...overrides
  } as unknown as PeriscanApi;
}

async function frameContains(
  instance: ReturnType<typeof render>,
  text: string | RegExp
) {
  await vi.waitFor(() => {
    const frame = instance.lastFrame() ?? "";
    if (typeof text === "string") {
      expect(frame).toContain(text);
    } else {
      expect(frame).toMatch(text);
    }
  });
}

function press(instance: ReturnType<typeof render>, keys: string) {
  instance.stdin.write(keys);
}

describe("ScopesScreen", () => {
  const originalLabMode = process.env.PERISCAN_LAB_MODE;

  afterEach(() => {
    cleanup();
    if (originalLabMode === undefined) {
      delete process.env.PERISCAN_LAB_MODE;
    } else {
      process.env.PERISCAN_LAB_MODE = originalLabMode;
    }
  });

  it("lists scopes from the API", async () => {
    const domain = scope({
      scopeId: "33333333-3333-4333-8333-333333333333",
      scopeType: "Domain",
      value: "app.example.com"
    });
    const cidr = scope({
      scopeId: "44444444-4444-4444-8444-444444444444",
      scopeType: "IPRange",
      value: "203.0.113.0/24"
    });
    const api = fakeApi({
      listScopes: vi.fn().mockResolvedValue([domain, cidr])
    });
    const onStatus = vi.fn();
    const instance = render(<ScopesScreen api={api} onStatus={onStatus} />);

    await frameContains(instance, "app.example.com");
    const frame = instance.lastFrame() ?? "";
    expect(frame).toContain("Domain");
    expect(frame).toContain("Pending");
    expect(frame).toContain("203.0.113.0/24");
    expect(frame).toContain("CIDR");
    expect(api.listScopes).toHaveBeenCalledTimes(1);
    instance.unmount();
  });

  it("shows an empty state when there are no authorized scopes", async () => {
    const api = fakeApi();
    const instance = render(<ScopesScreen api={api} onStatus={vi.fn()} />);

    await frameContains(instance, "No authorized scopes yet");
    instance.unmount();
  });

  it("shows a load error from listScopes", async () => {
    const api = fakeApi({
      listScopes: vi.fn().mockRejectedValue(new Error("listScopes 401"))
    });
    const instance = render(<ScopesScreen api={api} onStatus={vi.fn()} />);

    await frameContains(instance, "listScopes 401");
    instance.unmount();
  });

  it.each([
    {
      assetClass: "BusinessApplication" as const,
      label: "Domain",
      scopeType: "Domain" as const,
      typeKey: "d",
      value: "app.example.com"
    },
    {
      assetClass: "Code" as const,
      label: "Repository",
      scopeType: "Repository" as const,
      typeKey: "r",
      value: "/opt/customer/repo"
    },
    {
      assetClass: "Cloud" as const,
      label: "CloudAccount",
      scopeType: "CloudAccount" as const,
      typeKey: "c",
      value: "123456789012"
    },
    {
      assetClass: "Network" as const,
      label: "CIDR",
      scopeType: "IPRange" as const,
      typeKey: "i",
      value: "203.0.113.0/24"
    }
  ])(
    "creates a $label scope",
    async ({ assetClass, label, scopeType, typeKey, value }) => {
      const created = scope({
        assetClass,
        scopeId: "55555555-5555-4555-8555-555555555555",
        scopeType,
        value
      });
      const createScope = vi.fn().mockResolvedValue(created);
      const api = fakeApi({ createScope });
      const instance = render(<ScopesScreen api={api} onStatus={vi.fn()} />);
      await frameContains(instance, "No authorized scopes yet");

      press(instance, "n");
      await frameContains(instance, "Type:");
      press(instance, typeKey);
      await frameContains(instance, label);
      press(instance, value);
      press(instance, "\r");

      await vi.waitFor(() => {
        expect(createScope).toHaveBeenCalledWith({
          assetClass,
          scopeType,
          value
        });
      });
      await frameContains(instance, value);
      instance.unmount();
    }
  );

  it("verifies the selected scope via DNS TXT and does not skip with devModeManual", async () => {
    delete process.env.PERISCAN_LAB_MODE;
    const pending = scope({
      scopeId: "33333333-3333-4333-8333-333333333333",
      scopeType: "Domain",
      value: "app.example.com",
      verificationToken: "tok-dns"
    });
    const verified = {
      ...pending,
      verificationMethod: "dns_txt",
      verificationStatus: "Verified" as const
    };
    const verifyScope = vi.fn().mockResolvedValue(verified);
    const api = fakeApi({
      listScopes: vi.fn().mockResolvedValue([pending]),
      verifyScope
    });
    const instance = render(<ScopesScreen api={api} onStatus={vi.fn()} />);
    await frameContains(instance, "app.example.com");
    await frameContains(instance, "DNS TXT");

    press(instance, "v");

    await vi.waitFor(() => {
      expect(verifyScope).toHaveBeenCalledTimes(1);
    });
    expect(verifyScope).toHaveBeenCalledWith(pending.scopeId, {});
    expect(
      (
        verifyScope.mock.calls[0]?.[1] as
          | { devModeManual?: boolean }
          | undefined
      )?.devModeManual
    ).not.toBe(true);
    await frameContains(instance, "Verified");
    instance.unmount();
  });

  it("does not offer lab-only verify when PERISCAN_LAB_MODE is unset", async () => {
    delete process.env.PERISCAN_LAB_MODE;
    const pending = scope({
      scopeId: "33333333-3333-4333-8333-333333333333",
      scopeType: "Domain",
      value: "app.example.com"
    });
    const verifyScope = vi.fn();
    const onStatus = vi.fn();
    const api = fakeApi({
      listScopes: vi.fn().mockResolvedValue([pending]),
      verifyScope
    });
    const instance = render(<ScopesScreen api={api} onStatus={onStatus} />);
    await frameContains(instance, "app.example.com");

    const frame = instance.lastFrame() ?? "";
    expect(frame.toLowerCase()).not.toContain("skip dns");
    expect(frame).toContain("DNS TXT");
    expect(
      onStatus.mock.calls.map((call) => String(call[0])).join("\n")
    ).not.toMatch(/lab only/i);

    press(instance, "m");
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(verifyScope).not.toHaveBeenCalled();
    instance.unmount();
  });

  it("lab-only verify uses devModeManual when PERISCAN_LAB_MODE=1", async () => {
    process.env.PERISCAN_LAB_MODE = "1";
    const pending = scope({
      scopeId: "33333333-3333-4333-8333-333333333333",
      scopeType: "Domain",
      value: "app.example.com"
    });
    const verified = {
      ...pending,
      verificationMethod: "dev_manual",
      verificationStatus: "Verified" as const
    };
    const verifyScope = vi.fn().mockResolvedValue(verified);
    const onStatus = vi.fn();
    const api = fakeApi({
      listScopes: vi.fn().mockResolvedValue([pending]),
      verifyScope
    });
    const instance = render(<ScopesScreen api={api} onStatus={onStatus} />);
    await frameContains(instance, "app.example.com");
    await frameContains(instance, "lab only");
    expect(instance.lastFrame() ?? "").toContain("DNS TXT");

    press(instance, "m");

    await vi.waitFor(() => {
      expect(verifyScope).toHaveBeenCalledWith(pending.scopeId, {
        devModeManual: true
      });
    });
    await frameContains(instance, "Verified");
    instance.unmount();
  });

  it("production copy mentions DNS TXT and does not tell operators to skip DNS", async () => {
    delete process.env.PERISCAN_LAB_MODE;
    const api = fakeApi();
    const instance = render(<ScopesScreen api={api} onStatus={vi.fn()} />);
    await frameContains(instance, "DNS TXT");
    const frame = (instance.lastFrame() ?? "").toLowerCase();
    expect(frame).not.toContain("skip dns");
    expect(frame).not.toContain("devmodemanual");
    instance.unmount();
  });
});
