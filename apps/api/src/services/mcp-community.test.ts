import { describe, expect, it, vi } from "vitest";

import { McpToolInfoSchema } from "@periscan/shared";

import { AppServiceError } from "../runtime-services.js";
import type { AppServices, AuthenticatedContext } from "../runtime-services.js";
import { createMcpServices } from "./mcp.js";
import {
  listCommunityMcpToolInfo,
  runCommunityMcpTool,
  tryRunCommunityMcpTool
} from "./mcp-community.js";

const SCOPE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const POLICY_DECISION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MISSION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function apiKeyContext(
  scopes: AuthenticatedContext["apiKeyScopes"]
): AuthenticatedContext {
  return {
    apiKeyScopes: scopes,
    membership: {
      createdAt: "2026-01-01T00:00:00.000Z",
      membershipId: "11111111-1111-4111-8111-111111111111",
      role: "Owner",
      tenantId: "22222222-2222-4222-8222-222222222222",
      updatedAt: "2026-01-01T00:00:00.000Z",
      userId: "33333333-3333-4333-8333-333333333333"
    },
    session: {
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      membershipId: "11111111-1111-4111-8111-111111111111",
      role: "Owner",
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

describe("Community MCP tool catalog", () => {
  it("advertises list, start, and mission-findings tools wrapping Community API", () => {
    expect(listCommunityMcpToolInfo().map((tool) => tool.name)).toEqual([
      "list_community_suite",
      "start_community_validation",
      "list_findings_for_mission"
    ]);
  });

  it("does not invent live offensive tools", () => {
    const catalog = listCommunityMcpToolInfo();
    const banned = /atomic|caldera|sharphound|metasploit|ransomware|sqlmap/i;
    for (const tool of catalog) {
      expect(tool.name).not.toMatch(banned);
      expect(tool.title).not.toMatch(banned);
    }
  });

  it("parses as McpToolInfo so tools/list stays schema-honest", () => {
    for (const tool of listCommunityMcpToolInfo()) {
      expect(McpToolInfoSchema.parse(tool).name).toBe(tool.name);
    }
  });

  it("puts denied-never-queued honesty on every Community MCP description", () => {
    for (const tool of listCommunityMcpToolInfo()) {
      expect(tool.description.toLowerCase()).toMatch(/never queued/);
    }
  });

  it("requires verified scopeId and policyDecisionId to start Community validation", () => {
    const start = listCommunityMcpToolInfo().find(
      (tool) => tool.name === "start_community_validation"
    );
    expect(start).toBeDefined();
    expect(start!.description).toMatch(/verified scopeId/i);
    expect(start!.description).toMatch(/policyDecisionId/);
    expect(start!.description).toMatch(/not live/i);
    expect(start!.inputSchema).toEqual(
      expect.objectContaining({
        required: expect.arrayContaining(["scopeId", "policyDecisionId"])
      })
    );
  });
});

describe("Community MCP tool dispatch", () => {
  it("list_community_suite wraps getCommunityValidationSuite", async () => {
    const suite = { editionId: "community", modules: [] };
    const getCommunityValidationSuite = vi.fn(async () => suite);
    const result = await runCommunityMcpTool(
      { getCommunityValidationSuite } as unknown as AppServices,
      apiKeyContext(["read"]),
      "list_community_suite",
      { includeExternalPoa: false, scopeId: SCOPE_ID }
    );
    expect(getCommunityValidationSuite).toHaveBeenCalledWith(
      expect.anything(),
      { includeExternalPoa: false, scopeId: SCOPE_ID }
    );
    expect(result).toBe(suite);
  });

  it("start_community_validation rejects missing policyDecisionId before any queue", async () => {
    const startCommunityValidation = vi.fn();
    await expect(
      runCommunityMcpTool(
        { startCommunityValidation } as unknown as AppServices,
        apiKeyContext(["read"]),
        "start_community_validation",
        { scopeId: SCOPE_ID }
      )
    ).rejects.toMatchObject({ code: "mcp_invalid_arguments", statusCode: 400 });
    expect(startCommunityValidation).not.toHaveBeenCalled();
  });

  it("start_community_validation wraps startCommunityValidation", async () => {
    const started = {
      editionId: "community",
      moduleIds: ["gitleaks.repo_secrets"]
    };
    const startCommunityValidation = vi.fn(async () => started);
    const result = await runCommunityMcpTool(
      { startCommunityValidation } as unknown as AppServices,
      apiKeyContext(["read", "mission:run"]),
      "start_community_validation",
      { policyDecisionId: POLICY_DECISION_ID, scopeId: SCOPE_ID }
    );
    expect(startCommunityValidation).toHaveBeenCalledWith(expect.anything(), {
      policyDecisionId: POLICY_DECISION_ID,
      scopeId: SCOPE_ID
    });
    expect(result).toBe(started);
  });

  it("propagates scope_not_verified without inventing a queued mission", async () => {
    const startCommunityValidation = vi.fn(async () => {
      throw new AppServiceError(
        "Community validation requires a verified scope.",
        400,
        "scope_not_verified"
      );
    });
    await expect(
      runCommunityMcpTool(
        { startCommunityValidation } as unknown as AppServices,
        apiKeyContext(["read", "mission:run"]),
        "start_community_validation",
        { policyDecisionId: POLICY_DECISION_ID, scopeId: SCOPE_ID }
      )
    ).rejects.toMatchObject({ code: "scope_not_verified" });
  });

  it("list_findings_for_mission wraps listValidatedFindings with missionId", async () => {
    const findings = [{ findingId: "f1" }];
    const listValidatedFindings = vi.fn(async () => findings);
    const result = await runCommunityMcpTool(
      { listValidatedFindings } as unknown as AppServices,
      apiKeyContext(["read"]),
      "list_findings_for_mission",
      { limit: 10, missionId: MISSION_ID }
    );
    expect(listValidatedFindings).toHaveBeenCalledWith(expect.anything(), {
      limit: 10,
      missionId: MISSION_ID
    });
    expect(result).toBe(findings);
  });

  it("leaves the core read catalog to runMcpTool", async () => {
    await expect(
      tryRunCommunityMcpTool(
        {} as AppServices,
        apiKeyContext(["read"]),
        "list_findings",
        {}
      )
    ).resolves.toBeUndefined();
  });
});

describe("createMcpServices Community catalog", () => {
  it("lists Community tools next to the read catalog", async () => {
    const mcp = createMcpServices({
      prisma: { auditEvent: { create: vi.fn(), findMany: vi.fn() } }
    } as never);
    const names = (await mcp.listMcpTools(apiKeyContext(["read"]))).map(
      (tool) => tool.name
    );
    expect(names).toEqual(
      expect.arrayContaining([
        "list_findings",
        "list_community_suite",
        "start_community_validation",
        "list_findings_for_mission"
      ])
    );
  });

  it("dispatches start_community_validation through callMcpTool", async () => {
    const startCommunityValidation = vi.fn(async () => ({
      editionId: "community"
    }));
    const create = vi.fn(async () => ({}));
    const host = {
      ...createMcpServices({
        prisma: { auditEvent: { create } }
      } as never),
      startCommunityValidation
    };
    const result = await host.callMcpTool(
      apiKeyContext(["read", "mission:run"]),
      "start_community_validation",
      { policyDecisionId: POLICY_DECISION_ID, scopeId: SCOPE_ID }
    );
    expect(result).toEqual({ editionId: "community" });
    expect(startCommunityValidation).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalled();
  });
});
