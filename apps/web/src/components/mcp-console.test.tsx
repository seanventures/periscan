import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { McpConsole } from "./mcp-console";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

function stubMcpConsoleApis() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (
        url.includes("/api/v1/tenants/current/api-keys") ||
        url.endsWith("/api-keys")
      ) {
        return json({ items: [] });
      }
      if (url.includes("/mcp/tools")) {
        return json({
          items: [
            {
              annotations: {
                destructiveHint: false,
                idempotentHint: true,
                openWorldHint: false,
                readOnlyHint: true
              },
              description: "List tenant findings.",
              inputSchema: { type: "object" },
              name: "list_findings",
              readOnly: true,
              requiredScopes: ["read", "admin"],
              title: "List validated findings"
            },
            {
              annotations: {
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
                readOnlyHint: true
              },
              description:
                "Start Community edition validation using a verified scopeId and policyDecisionId. Denied tasks are never queued. Not live Atomic, Caldera, SharpHound, Metasploit, or ransomware.",
              inputSchema: {
                type: "object",
                required: ["scopeId", "policyDecisionId"]
              },
              name: "start_community_validation",
              readOnly: true,
              requiredScopes: ["read", "admin"],
              title: "Start Community validation"
            }
          ]
        });
      }
      if (url.includes("/mcp/activity")) {
        return json({ items: [] });
      }
      return json({ error: `Unhandled ${url}` }, 404);
    })
  );
}

describe("McpConsole honesty (UX-W4 / #179)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("teaches Wave H read catalog plus policy-gated Community start, not a no-start lie", async () => {
    stubMcpConsoleApis();
    const { container } = render(<McpConsole />);

    expect(
      await screen.findByRole("heading", { name: "MCP Server" })
    ).toBeInTheDocument();

    expect(screen.getByText("Wave H read-only")).toBeInTheDocument();
    expect(screen.getByText("Community gated")).toBeInTheDocument();

    expect(
      screen.getByRole("note", { name: "MCP capability honesty" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Wave H catalog vs Community start")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Capability honesty/i })
    ).toHaveAttribute("href", "#mcp-honesty");
    expect(
      screen.getByRole("heading", { name: "Capability honesty" })
    ).toBeInTheDocument();

    const body = container.textContent ?? "";
    expect(body).toMatch(/Wave H/i);
    expect(body).toMatch(/read-only posture query/i);
    expect(body).toMatch(/list_community_suite/);
    expect(body).toMatch(/start_community_validation/);
    expect(body).toMatch(/list_findings_for_mission/);
    expect(body).toMatch(/verified scopeId/i);
    expect(body).toMatch(/policyDecisionId/);
    expect(body.toLowerCase()).toMatch(/never queue/);
    expect(body).toMatch(/readOnlyHint/);
    expect(body).toMatch(/Wave H catalog metadata/i);
    expect(body).toMatch(/policy-gated in the tool description and run path/i);
    expect(body).toMatch(/Atomic/);
    expect(body).toMatch(/Caldera/);
    expect(body).toMatch(/SharpHound/);
    expect(body).toMatch(/sqlmap/);
    expect(body).toMatch(/Metasploit/);
    expect(body).toMatch(/Remediation apply is still not an MCP tool/i);
    expect(body).toMatch(/Offensive multi-agent BAS swarm orchestration is/i);
    expect(body).not.toMatch(/never start missions/i);
    expect(body).not.toMatch(/no MCP path to start missions/i);
    expect(body).not.toMatch(/cannot start missions/i);
    expect(body).not.toMatch(/never mutate state/i);
    expect(body).not.toMatch(/MCP tools never start/i);

    expect(screen.getAllByText(/readOnlyHint:\s*true/i).length).toBeGreaterThan(
      0
    );
    expect(
      screen.getAllByText(/destructiveHint:\s*false/i).length
    ).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("List validated findings")).toBeInTheDocument();
    });
    expect(screen.getByText("list_findings")).toBeInTheDocument();
    expect(
      screen.getAllByText("start_community_validation").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Start Community validation")).toBeInTheDocument();
  });
});
