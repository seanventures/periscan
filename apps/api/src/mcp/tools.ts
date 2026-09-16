import { z } from "zod";

import type { McpToolAnnotations, McpToolInfo } from "@periscan/shared";

import { AppServiceError } from "../runtime-services.js";
import type { AppServices, AuthenticatedContext } from "../runtime-services.js";

// The MCP tool registry. Every tool is READ-ONLY and tenant-scoped: it maps to
// an existing AppServices read method, so a customer's AI client can query its
// own Periscan posture but can never mutate state or reach another tenant.
// Offensive/validation/remediation capabilities are deliberately excluded.
// Wave H: capability gate requires coarse `read` or `admin` on API keys; all
// tools advertise readOnlyHint so clients cannot assume mutate power.
export const MCP_TOOL_ANNOTATIONS: McpToolAnnotations = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true
};

export const MCP_REQUIRED_SCOPES = ["read", "admin"] as const;

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  // JSON Schema advertised to the client via tools/list.
  inputSchema: Record<string, unknown>;
  // Runtime validation of the client-supplied arguments.
  args: z.ZodTypeAny;
  run(
    services: AppServices,
    context: AuthenticatedContext,
    args: unknown
  ): Promise<unknown>;
}

const NO_ARGS = z.object({}).strip();
const NO_ARGS_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false
} as const;

const LIMIT_ARGS = z.object({
  limit: z.number().int().min(1).max(200).optional()
});

const LIMIT_SCHEMA = (defaultLimit: number) =>
  ({
    type: "object",
    properties: {
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 200,
        description: `Max rows to return (default ${defaultLimit}).`
      }
    },
    additionalProperties: false
  }) as const;

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "list_findings",
    title: "List validated findings",
    description:
      "List the tenant's evidence-backed findings, optionally filtered by severity or status. Each finding links to the path, remediation and evidence behind it.",
    inputSchema: {
      type: "object",
      properties: {
        severity: {
          type: "string",
          enum: ["Critical", "High", "Medium", "Low", "Informational"],
          description: "Only findings at this severity."
        },
        status: {
          type: "string",
          description: "Only findings at this derived status (e.g. Validated, Fixed)."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Max findings to return (default 25)."
        }
      },
      additionalProperties: false
    },
    args: z.object({
      severity: z
        .enum(["Critical", "High", "Medium", "Low", "Informational"])
        .optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional()
    }),
    async run(services, context, args) {
      const input = args as {
        severity?: string;
        status?: string;
        limit?: number;
      };
      const findings = await services.listValidatedFindings(context, {
        ...(input.severity
          ? { severity: input.severity as never }
          : {}),
        ...(input.status ? { status: input.status as never } : {})
      });
      return findings.slice(0, input.limit ?? 25);
    }
  },
  {
    name: "get_finding",
    title: "Get a finding",
    description: "Read a single validated finding by its id.",
    inputSchema: {
      type: "object",
      properties: {
        findingId: { type: "string", description: "The finding id." }
      },
      required: ["findingId"],
      additionalProperties: false
    },
    args: z.object({ findingId: z.string().min(1) }),
    async run(services, context, args) {
      const { findingId } = args as { findingId: string };
      const finding = await services.getValidatedFinding(context, findingId);
      if (!finding) {
        throw new AppServiceError("Finding not found.", 404, "not_found");
      }
      return finding;
    }
  },
  {
    name: "get_attack_paths",
    title: "Get attack paths",
    description:
      "List validated attack-path assessments (entry → objective), ranked by risk score.",
    inputSchema: LIMIT_SCHEMA(25),
    args: LIMIT_ARGS,
    async run(services, context, args) {
      const { limit } = args as { limit?: number };
      const paths = await services.listAttackPaths(context);
      return paths.slice(0, limit ?? 25);
    }
  },
  {
    name: "get_control_coverage",
    title: "Get control coverage",
    description:
      "Detection-control rule coverage per MITRE ATT&CK technique (Detected / Blocked / Missed) with tuning recommendations.",
    inputSchema: NO_ARGS_SCHEMA,
    args: NO_ARGS,
    async run(services, context) {
      return services.getControlRuleCoverage(context);
    }
  },
  {
    name: "list_scopes",
    title: "List scopes",
    description:
      "List the tenant's engagement scopes and their verification status.",
    inputSchema: NO_ARGS_SCHEMA,
    args: NO_ARGS,
    async run(services, context) {
      return services.listScopes(context);
    }
  },
  {
    name: "get_executive_posture",
    title: "Get executive posture",
    description:
      "Leadership posture summary: trend metrics with the change since last period, remediation velocity and proof-delivery counts.",
    inputSchema: NO_ARGS_SCHEMA,
    args: NO_ARGS,
    async run(services, context) {
      return services.getExecutiveTrends(context);
    }
  },
  {
    name: "search",
    title: "Search Periscan",
    description:
      "Cross-entity search over the tenant (scopes, assets, attack paths, remediations, AI apps, evidence packs).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text (min 2 chars)." }
      },
      required: ["query"],
      additionalProperties: false
    },
    args: z.object({ query: z.string() }),
    async run(services, context, args) {
      const { query } = args as { query: string };
      return services.globalSearch(context, query);
    }
  },
  // P20-6: proof-loop read surface for analyst copilots (still READ-ONLY).
  {
    name: "list_remediations",
    title: "List remediations",
    description:
      "List remediation tasks (what is open, ready for verify, or Fixed). Read-only — use REST to mutate.",
    inputSchema: LIMIT_SCHEMA(25),
    args: LIMIT_ARGS,
    async run(services, context, args) {
      const { limit } = args as { limit?: number };
      const items = await services.listRemediations(context);
      return items.slice(0, limit ?? 25);
    }
  },
  {
    name: "list_missions",
    title: "List missions",
    description:
      "List recent validation missions and their status for the proof loop.",
    inputSchema: LIMIT_SCHEMA(25),
    args: LIMIT_ARGS,
    async run(services, context, args) {
      const { limit } = args as { limit?: number };
      const page = await services.listMissions(context, {
        limit: limit ?? 25
      });
      return page;
    }
  },
  {
    name: "list_evidence",
    title: "List evidence",
    description:
      "List recent evidence artifacts (limit-capped). Useful for “show me the proof” copilots.",
    inputSchema: LIMIT_SCHEMA(25),
    args: LIMIT_ARGS,
    async run(services, context, args) {
      const { limit } = args as { limit?: number };
      const items = await services.listEvidence(context, {
        limit: limit ?? 25
      });
      return items;
    }
  }
];

const MCP_TOOL_BY_NAME = new Map(
  MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool])
);

export function listMcpToolInfo(): McpToolInfo[] {
  return MCP_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    readOnly: true as const,
    requiredScopes: [...MCP_REQUIRED_SCOPES],
    annotations: MCP_TOOL_ANNOTATIONS
  }));
}

/**
 * Wave H: API keys must hold coarse `read` or `admin` to use MCP. Fine-grained
 * mutate-only keys (e.g. mission:run, webhook:admin alone) are denied — MCP is
 * a read surface, not an offensive/mutate control plane. Session users no-op
 * here; interactive role gates remain authoritative.
 */
export function requireMcpReadAccess(context: AuthenticatedContext): void {
  if (!context.apiKeyScopes) {
    return;
  }
  const scopes = context.apiKeyScopes;
  if (scopes.includes("read") || scopes.includes("admin")) {
    return;
  }
  throw new AppServiceError(
    "API key lacks read access required for MCP tools. Grant the `read` or `admin` scope. MCP exposes only read-only, tenant-scoped tools — never mutate, validation dispatch, or remediation.",
    403,
    "mcp_read_access_denied"
  );
}

// Validate + dispatch a single MCP tool call against the read services. Pure of
// audit/side effects so both the real and in-memory service layers can reuse it;
// each wraps this with its own audit-event write.
export async function runMcpTool(
  services: AppServices,
  context: AuthenticatedContext,
  toolName: string,
  rawArgs: unknown
): Promise<unknown> {
  requireMcpReadAccess(context);
  const tool = MCP_TOOL_BY_NAME.get(toolName);
  if (!tool) {
    throw new AppServiceError(
      `Unknown MCP tool: ${toolName}`,
      404,
      "mcp_tool_not_found"
    );
  }
  const parsed = tool.args.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    throw new AppServiceError(
      `Invalid arguments for ${toolName}: ${parsed.error.issues
        .map((issue) => issue.message)
        .join("; ")}`,
      400,
      "mcp_invalid_arguments"
    );
  }
  return tool.run(services, context, parsed.data);
}
