import { AppServiceError } from "../runtime-services.js";
import type { AppServices, AuthenticatedContext } from "../runtime-services.js";

// Minimal Model Context Protocol server (JSON-RPC 2.0 over streamable HTTP).
// We implement the core methods a data-provider server needs — initialize,
// tools/list, tools/call, ping — rather than pulling in the MCP SDK, so the
// server stays dependency-free and fully under our tenant-scoping + audit path.
// tools/list and tools/call go through AppServices so Wave H capability gates apply.
export const MCP_PROTOCOL_VERSION = "2024-11-05";
export const MCP_SERVER_INFO = { name: "Periscan", version: "1.0.0" } as const;

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

function ok(id: JsonRpcMessage["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function err(id: JsonRpcMessage["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/**
 * Handle a single JSON-RPC message. Returns the response object, or null for a
 * notification (no id) that gets no reply. Tool-execution failures are returned
 * in-band as `isError` content so the calling model sees them; only malformed
 * protocol requests become JSON-RPC errors.
 */
export async function handleMcpMessage(
  services: AppServices,
  context: AuthenticatedContext,
  message: JsonRpcMessage
): Promise<Record<string, unknown> | null> {
  const { id, method, params } = message;
  const isNotification = id === undefined;

  if (typeof method !== "string") {
    return isNotification ? null : err(id ?? null, -32600, "Invalid Request");
  }

  // Notifications (initialized, cancelled, …) get acknowledged with no response.
  if (method.startsWith("notifications/")) {
    return null;
  }

  switch (method) {
    case "initialize": {
      const requested = (params as { protocolVersion?: string } | undefined)
        ?.protocolVersion;
      return ok(id, {
        protocolVersion:
          typeof requested === "string" ? requested : MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list": {
      // Route through services so capability gates apply (Wave H read access).
      try {
        const tools = await services.listMcpTools(context);
        return ok(id, { tools });
      } catch (error) {
        const text =
          error instanceof AppServiceError
            ? error.message
            : "Unable to list MCP tools.";
        return err(id, -32003, text);
      }
    }
    case "tools/call": {
      const callParams = (params ?? {}) as {
        name?: unknown;
        arguments?: unknown;
      };
      if (typeof callParams.name !== "string") {
        return err(id, -32602, "tools/call requires a string 'name'.");
      }
      try {
        const result = await services.callMcpTool(
          context,
          callParams.name,
          callParams.arguments ?? {}
        );
        return ok(id, {
          content: [
            { type: "text", text: JSON.stringify(result, null, 2) }
          ],
          // Explicit honesty: every Periscan MCP tool is read-only by catalog.
          isError: false,
          _meta: {
            readOnly: true,
            requiredScopes: ["read", "admin"]
          }
        });
      } catch (error) {
        if (
          error instanceof AppServiceError &&
          error.code === "mcp_read_access_denied"
        ) {
          return err(id, -32003, error.message);
        }
        const text =
          error instanceof AppServiceError
            ? error.message
            : "The tool call failed.";
        return ok(id, {
          content: [{ type: "text", text }],
          isError: true
        });
      }
    }
    default:
      return isNotification ? null : err(id, -32601, `Unknown method: ${method}`);
  }
}
