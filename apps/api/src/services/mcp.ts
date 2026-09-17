import type { McpActivityEntry, McpToolInfo } from "@periscan/shared";

import {
  listMcpToolInfo,
  requireMcpReadAccess,
  runMcpTool
} from "../mcp/tools.js";
import { writeAuditEvent } from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import {
  listCommunityMcpToolInfo,
  tryRunCommunityMcpTool
} from "./mcp-community.js";

// MCP server-management service group. The MCP protocol endpoint (POST /mcp)
// calls callMcpTool for each tools/call; the console reads listMcpTools +
// listMcpActivity. Every invocation is audited (mcp.tool_invoked), so the
// activity log is derived from real audit events, never fabricated.
// Wave H: list + call enforce requireMcpReadAccess so fine-grained mutate-only
// keys cannot inventory or invoke MCP. Community tools merge here and wrap
// getCommunityValidationSuite / startCommunityValidation / listValidatedFindings
// (verified scope + policy; denied never queued; no live offensive tools).
export function createMcpServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "listMcpTools" | "listMcpActivity" | "callMcpTool"> {
  const { prisma } = deps;

  return {
    async listMcpTools(context): Promise<McpToolInfo[]> {
      requireMcpReadAccess(context);
      return [...listMcpToolInfo(), ...listCommunityMcpToolInfo()];
    },

    async callMcpTool(this: AppServices, context, toolName, args) {
      let status: "ok" | "error" = "ok";
      try {
        return (
          (await tryRunCommunityMcpTool(this, context, toolName, args)) ??
          (await runMcpTool(this, context, toolName, args))
        );
      } catch (error) {
        status = "error";
        throw error;
      } finally {
        await writeAuditEvent(prisma, {
          action: "mcp.tool_invoked",
          actorType: "ApiKey",
          entityId: context.tenant.tenantId,
          entityType: "Tenant",
          metadata: { status, toolName },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      }
    },

    async listMcpActivity(context): Promise<McpActivityEntry[]> {
      const rows = await prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        where: {
          action: "mcp_tool_invoked",
          tenantId: context.tenant.tenantId
        }
      });
      return rows.map((row) => {
        const metadata = (row.metadata ?? {}) as {
          status?: string;
          toolName?: string;
        };
        return {
          invokedAt: row.createdAt.toISOString(),
          status: metadata.status === "error" ? "error" : "ok",
          toolName: metadata.toolName ?? "unknown"
        };
      });
    }
  };
}
