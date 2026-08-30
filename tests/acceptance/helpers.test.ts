import { describe, expect, it, vi } from "vitest";

import * as helpers from "./helpers.js";

describe("acceptance/helpers (P3 acc hardening)", () => {
  it("uniqueEmail generates distinct emails matching pattern with prefix", () => {
    const e1 = helpers.uniqueEmail("acc-test");
    const e2 = helpers.uniqueEmail("acc-test");
    expect(e1).toMatch(/^acc-test-[0-9a-f-]+@periscan\.test$/);
    expect(e2).toMatch(/^acc-test-[0-9a-f-]+@periscan\.test$/);
    expect(e1).not.toBe(e2);
  });

  it("authHeaders and authCookies return the session cookie map (tolerant alias)", () => {
    const headers = helpers.authHeaders("sess-xyz");
    expect(headers).toEqual({ periscan_session: "sess-xyz" });
    expect(helpers.authCookies("sess-xyz")).toEqual(headers);
  });

  it("safeRequestedAction returns safe defaults and merges overrides (table-like)", () => {
    const base = helpers.safeRequestedAction();
    expect(base.credentialTheft).toBe(false);
    expect(base.destructive).toBe(false);
    const withOverride = helpers.safeRequestedAction({ destructive: true });
    expect(withOverride.destructive).toBe(true);
    expect(withOverride.persistence).toBe(false);
  });

  it("probeDatabaseConnection throws clear multi-line Error with exact 'To run' steps on failure (uses provided prisma)", async () => {
    const failingPrisma = {
      $queryRaw: vi
        .fn()
        .mockRejectedValueOnce(
          new Error("Authentication failed against database server")
        )
    } as any;

    let err: Error | undefined;
    try {
      await helpers.probeDatabaseConnection(failingPrisma);
    } catch (error: unknown) {
      err = error instanceof Error ? error : new Error(String(error));
    }
    expect(err).toBeDefined();
    expect(err!.message).toContain(
      "Acceptance tests require a reachable periscan postgres with matching credentials."
    );
    expect(err!.message).toContain("To run:");
    expect(err!.message).toContain(
      "docker compose -f infra/docker-compose/docker-compose.yml up -d"
    );
    expect(err!.message).toContain(
      "stop or remap the conflicting Postgres listener on 5432"
    );
    expect(err!.message).toContain(
      "export PERISCAN_POSTGRES_PUBLISHED_PORT=5434"
    );
    expect(err!.message).toContain(
      "export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan"
    );
    expect(err!.message).toContain("pnpm test:acceptance");
    expect(err!.message).toContain("Original error:");
    expect(err!.message).toContain("Authentication failed");
    // ensure it used the passed prisma instance (mock called)
    expect(failingPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("performSignup builds payload with tenantType when provided (for MSSP coverage)", async () => {
    const mockApp = {
      inject: vi.fn().mockResolvedValue({
        statusCode: 201,
        cookies: [{ name: "periscan_session", value: "mock-cookie" }]
      })
    };
    const res = await helpers.performSignup(
      mockApp as any,
      "mssp-prefix",
      "MSSP Test",
      "MSSP"
    );
    expect(mockApp.inject).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          tenantType: "MSSP",
          tenantName: "MSSP Test"
        })
      })
    );
    expect(res.cookie).toBe("mock-cookie");
  });

  it("cleanupTestDataByEmailPrefix calls deleteMany for users/tenants (best effort, does not throw on err)", async () => {
    const mockPrisma = {
      user: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      tenant: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }
    } as any;
    await expect(
      helpers.cleanupTestDataByEmailPrefix(mockPrisma, ["acc-", "edge-"])
    ).resolves.toBeUndefined();
    expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({
      where: { email: { startsWith: "acc-" } }
    });
    expect(mockPrisma.tenant.deleteMany).toHaveBeenCalled();
  });
});
