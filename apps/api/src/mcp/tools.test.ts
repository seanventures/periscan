import { describe, expect, it } from "vitest";

import {
  listMcpToolInfo,
  requireMcpReadAccess,
  runMcpTool
} from "./tools.js";
import { AppServiceError } from "../runtime-services.js";
import type { AuthenticatedContext } from "../runtime-services.js";

function apiKeyContext(
  scopes: AuthenticatedContext["apiKeyScopes"]
): AuthenticatedContext {
  return {
    apiKeyScopes: scopes,
    membership: {
      createdAt: "2026-01-01T00:00:00.000Z",
      membershipId: "11111111-1111-4111-8111-111111111111",
      role: "Viewer",
      tenantId: "22222222-2222-4222-8222-222222222222",
      updatedAt: "2026-01-01T00:00:00.000Z",
      userId: "33333333-3333-4333-8333-333333333333"
    },
    session: {
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      membershipId: "11111111-1111-4111-8111-111111111111",
      role: "Viewer",
      tenantId: "22222222-2222-4222-8222-222222222222",
      userId: "33333333-3333-4333-8333-333333333333"
    },
    tenant: {
      billingAccountId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      dataRegion: "us-east-1",
      name: "Tenant",
      parentTenantId: null,
      tenantId: "22222222-2222-4222-8222-222222222222",
      type: "Organization",
      updatedAt: "2026-01-01T00:00:00.000Z"
    },
    user: {
      createdAt: "2026-01-01T00:00:00.000Z",
      email: "ops@example.com",
      name: "Ops",
      status: "Active",
      updatedAt: "2026-01-01T00:00:00.000Z",
      userId: "33333333-3333-4333-8333-333333333333"
    }
  } as AuthenticatedContext;
}

describe("MCP tool catalog + capability gates", () => {
  it("advertises read-only honesty on every tool", () => {
    const tools = listMcpToolInfo();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.readOnly).toBe(true);
      expect(tool.requiredScopes).toEqual(["read", "admin"]);
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
      expect(tool.annotations.openWorldHint).toBe(false);
    }
  });

  it("never registers mutate, dispatch, or offensive tool names", () => {
    const tools = listMcpToolInfo();
    // Read lists like list_remediations are allowed; verb prefixes that
    // mutate, dispatch validation, or expose offensive live tools are not.
    const banned = [
      /^(start|create|delete|update|patch|apply|dispatch|execute|launch|run|mitigate|remediate)_/i,
      /atomic|caldera|sharphound|swarm|ransomware/i
    ];
    for (const tool of tools) {
      for (const pattern of banned) {
        expect(tool.name).not.toMatch(pattern);
      }
    }
    expect(
      tools.every(
        (tool) =>
          tool.name.startsWith("list_") ||
          tool.name.startsWith("get_") ||
          tool.name === "search"
      )
    ).toBe(true);
  });

  it("allows session users and read/admin API keys", () => {
    expect(() => requireMcpReadAccess(apiKeyContext(undefined))).not.toThrow();
    expect(() => requireMcpReadAccess(apiKeyContext(["read"]))).not.toThrow();
    expect(() => requireMcpReadAccess(apiKeyContext(["admin"]))).not.toThrow();
    expect(() =>
      requireMcpReadAccess(apiKeyContext(["read", "mission:run"]))
    ).not.toThrow();
  });

  it("denies fine-grained mutate-only API keys", () => {
    try {
      requireMcpReadAccess(apiKeyContext(["mission:run"]));
      throw new Error("expected denial");
    } catch (error) {
      expect(error).toBeInstanceOf(AppServiceError);
      expect((error as AppServiceError).code).toBe("mcp_read_access_denied");
      expect((error as AppServiceError).statusCode).toBe(403);
    }

    try {
      requireMcpReadAccess(apiKeyContext(["webhook:admin"]));
      throw new Error("expected denial");
    } catch (error) {
      expect((error as AppServiceError).code).toBe("mcp_read_access_denied");
    }
  });

  it("runMcpTool enforces the same gate before dispatch", async () => {
    const services = {} as never;
    await expect(
      runMcpTool(
        services,
        apiKeyContext(["remediation:write"]),
        "list_findings",
        {}
      )
    ).rejects.toMatchObject({
      code: "mcp_read_access_denied",
      statusCode: 403
    });
  });
});
