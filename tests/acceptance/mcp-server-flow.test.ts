import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
  return buildApp({
    devMode: true,
    services: createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: {
        async enqueueValidationJob() {
          return;
        }
      },
      prisma
    })
  });
}

describe("MCP server flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["mcp-owner"]);
      await prisma.$disconnect();
    }
  });

  it("serves JSON-RPC over an API key, scopes tools to the tenant, and audits calls", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "mcp-owner",
        "MCP Tenant"
      );
      const auth = authCookies(cookie);

      // Mint a read-scope API key — this is the MCP credential.
      const keyResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { name: "MCP client", scopes: ["read"] },
        url: "/api/v1/tenants/current/api-keys"
      });
      expect(keyResponse.statusCode).toBe(201);
      const secret = keyResponse.json().secret as string;
      expect(secret.startsWith("psk_")).toBe(true);

      const mcp = (payload: unknown, token = secret) =>
        app.inject({
          headers: { authorization: `Bearer ${token}` },
          method: "POST",
          payload,
          url: "/mcp"
        });

      // initialize
      const init = await mcp({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" }
      });
      expect(init.statusCode).toBe(200);
      expect(init.json().result.serverInfo.name).toBe("Periscan");

      // tools/list
      const list = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      const tools = list.json().result.tools as Array<{
        name: string;
        readOnly?: boolean;
        requiredScopes?: string[];
        annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
      }>;
      const names = tools.map((tool) => tool.name);
      expect(names).toContain("get_attack_paths");
      expect(names).toContain("list_findings");
      expect(names).toContain("search");
      // Wave H: every catalog entry is honest about read-only + required scopes.
      for (const tool of tools) {
        expect(tool.readOnly).toBe(true);
        expect(tool.requiredScopes).toEqual(
          expect.arrayContaining(["read", "admin"])
        );
        expect(tool.annotations?.readOnlyHint).toBe(true);
        expect(tool.annotations?.destructiveHint).toBe(false);
      }

      // tools/call get_attack_paths — tenant-scoped, returns JSON text content.
      const call = await mcp({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_attack_paths", arguments: {} }
      });
      expect(call.statusCode).toBe(200);
      const callResult = call.json().result;
      expect(callResult.isError).toBe(false);
      const parsed = JSON.parse(callResult.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);

      // A search call also succeeds.
      const search = await mcp({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "search", arguments: { query: "example" } }
      });
      expect(search.json().result.isError).toBe(false);

      // Unknown tool → in-band tool error, not a crash.
      const bad = await mcp({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "delete_everything", arguments: {} }
      });
      expect(bad.json().result.isError).toBe(true);

      // A notification gets a 202 with no body.
      const note = await mcp({
        jsonrpc: "2.0",
        method: "notifications/initialized"
      });
      expect(note.statusCode).toBe(202);

      // No credential → 401.
      const unauth = await app.inject({
        method: "POST",
        payload: { jsonrpc: "2.0", id: 9, method: "tools/list" },
        url: "/mcp"
      });
      expect(unauth.statusCode).toBe(401);

      // Activity log is derived from real audit events.
      const activity = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/mcp/activity"
      });
      expect(activity.statusCode).toBe(200);
      const items = activity.json().items as Array<{
        toolName: string;
        status: string;
      }>;
      expect(items.some((item) => item.toolName === "get_attack_paths")).toBe(
        true
      );
      expect(items.some((item) => item.toolName === "delete_everything")).toBe(
        true
      );
      const badEntry = items.find(
        (item) => item.toolName === "delete_everything"
      );
      expect(badEntry?.status).toBe("error");

      // Wave H: fine-grained mutate-only keys cannot list or call MCP tools.
      const writeOnly = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { name: "Mission only", scopes: ["mission:run"] },
        url: "/api/v1/tenants/current/api-keys"
      });
      expect(writeOnly.statusCode).toBe(201);
      const missionSecret = writeOnly.json().secret as string;

      const deniedList = await mcp(
        { jsonrpc: "2.0", id: 20, method: "tools/list" },
        missionSecret
      );
      expect(deniedList.statusCode).toBe(200);
      expect(deniedList.json().error?.message ?? "").toMatch(/read access/i);

      const deniedCall = await mcp(
        {
          jsonrpc: "2.0",
          id: 21,
          method: "tools/call",
          params: { name: "list_findings", arguments: {} }
        },
        missionSecret
      );
      expect(deniedCall.statusCode).toBe(200);
      expect(deniedCall.json().error?.message ?? "").toMatch(/read access/i);
    } finally {
      await app.close();
    }
  });
});
