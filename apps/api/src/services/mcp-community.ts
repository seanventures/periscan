import { z } from "zod";

import {
  StartCommunityValidationRequestSchema,
  type McpToolAnnotations,
  type McpToolInfo,
  type StartCommunityValidationRequest
} from "@periscan/shared";

import { AppServiceError } from "../runtime-services.js";
import type { AppServices, AuthenticatedContext } from "../runtime-services.js";
import {
  MCP_REQUIRED_SCOPES,
  MCP_TOOL_ANNOTATIONS,
  requireMcpReadAccess,
  type McpToolDefinition
} from "../mcp/tools.js";

const DENIED_NEVER_QUEUED = "Denied tasks are never queued.";

const NOT_LIVE_OFFENSIVE =
  "Not live Atomic, Caldera, SharpHound, Metasploit, or ransomware.";

const START_ANNOTATIONS: McpToolAnnotations = {
  ...MCP_TOOL_ANNOTATIONS,
  idempotentHint: false
};

const LIST_SUITE_ARGS = z
  .object({
    includeExternalPoa: z.boolean().optional(),
    scopeId: z.string().uuid().optional()
  })
  .strip();

const LIST_FINDINGS_ARGS = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    missionId: z.string().uuid(),
    severity: z
      .enum(["Critical", "High", "Medium", "Low", "Informational"])
      .optional(),
    status: z.string().optional()
  })
  .strip();

interface CommunityMcpToolDefinition extends McpToolDefinition {
  annotations: McpToolAnnotations;
}

const COMMUNITY_MCP_TOOL_DEFINITIONS: CommunityMcpToolDefinition[] = [
  {
    name: "list_community_suite",
    title: "List Community validation suite",
    description:
      "List the Community edition OSS/first-party validation suite (GET /api/v1/community/validation-suite). Optional scopeId narrows engines to that scope type. Apache-2.0 product source. " +
      NOT_LIVE_OFFENSIVE +
      " " +
      DENIED_NEVER_QUEUED +
      " This tool only inventories the pack; it does not start or queue validation.",
    inputSchema: {
      type: "object",
      properties: {
        scopeId: {
          type: "string",
          format: "uuid",
          description:
            "Optional verified-scope id. When omitted, the full Community suite is listed."
        },
        includeExternalPoa: {
          type: "boolean",
          description:
            "When true, include Nuclei as a second-mission ExternalPoA engine. Default false."
        }
      },
      additionalProperties: false
    },
    args: LIST_SUITE_ARGS,
    annotations: MCP_TOOL_ANNOTATIONS,
    async run(services, context, args) {
      const input = args as {
        includeExternalPoa?: boolean;
        scopeId?: string;
      };
      return services.getCommunityValidationSuite(context, {
        ...(typeof input.includeExternalPoa === "boolean"
          ? { includeExternalPoa: input.includeExternalPoa }
          : {}),
        ...(input.scopeId ? { scopeId: input.scopeId } : {})
      });
    }
  },
  {
    name: "start_community_validation",
    title: "Start Community validation",
    description:
      "Start Community edition validation (POST /api/v1/community/validation-runs) using a verified scopeId and policyDecisionId. Unverified scope returns scope_not_verified and does not queue. " +
      DENIED_NEVER_QUEUED +
      " " +
      NOT_LIVE_OFFENSIVE +
      " Theater and copyleft engines stay off unless separately licensed and opted in. MCP still requires coarse read or admin to invoke; startCommunityValidation then enforces editor role and mission:run.",
    inputSchema: {
      type: "object",
      properties: {
        scopeId: {
          type: "string",
          format: "uuid",
          description: "Verified scope id. Unverified scopes are refused."
        },
        policyDecisionId: {
          type: "string",
          format: "uuid",
          description:
            "Existing policy decision id bound to this start. Denied decisions never queue."
        },
        moduleIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional subset of Community suite module ids. Unknown or theater ids are refused."
        },
        includeCopyleftOptIn: {
          type: "boolean",
          description:
            "Include licensed copyleft engines (Engine Lab accept path). Default false."
        },
        includeExternalPoa: {
          type: "boolean",
          description:
            "Start Nuclei as a second mission. Default false so PoA kill-switch cannot deny the worker pack."
        },
        runnerId: {
          type: "string",
          description: "Optional enrolled runner id for InternalRunner engines."
        }
      },
      required: ["scopeId", "policyDecisionId"],
      additionalProperties: false
    },
    args: StartCommunityValidationRequestSchema,
    annotations: START_ANNOTATIONS,
    async run(services, context, args) {
      const input = args as StartCommunityValidationRequest;
      return services.startCommunityValidation(context, {
        policyDecisionId: input.policyDecisionId,
        scopeId: input.scopeId,
        ...(input.includeCopyleftOptIn !== undefined
          ? { includeCopyleftOptIn: input.includeCopyleftOptIn }
          : {}),
        ...(input.includeExternalPoa !== undefined
          ? { includeExternalPoa: input.includeExternalPoa }
          : {}),
        ...(input.moduleIds ? { moduleIds: input.moduleIds } : {}),
        ...(input.runnerId ? { runnerId: input.runnerId } : {})
      });
    }
  },
  {
    name: "list_findings_for_mission",
    title: "List findings for a mission",
    description:
      "List evidence-backed findings whose evidenceIds intersect this mission's validation-run evidence. Empty when the mission has no evidence — not the tenant-wide queue. " +
      NOT_LIVE_OFFENSIVE +
      " " +
      DENIED_NEVER_QUEUED +
      " This tool only reads measured results.",
    inputSchema: {
      type: "object",
      properties: {
        missionId: {
          type: "string",
          format: "uuid",
          description: "Mission id whose run evidence scopes the findings list."
        },
        severity: {
          type: "string",
          enum: ["Critical", "High", "Medium", "Low", "Informational"],
          description: "Only findings at this severity."
        },
        status: {
          type: "string",
          description:
            "Only findings at this derived status (e.g. Validated, Fixed)."
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Max findings to return (default 25)."
        }
      },
      required: ["missionId"],
      additionalProperties: false
    },
    args: LIST_FINDINGS_ARGS,
    annotations: MCP_TOOL_ANNOTATIONS,
    async run(services, context, args) {
      const input = args as {
        limit?: number;
        missionId: string;
        severity?: "Critical" | "High" | "Medium" | "Low" | "Informational";
        status?: string;
      };
      return services.listValidatedFindings(context, {
        missionId: input.missionId,
        limit: input.limit ?? 25,
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.status ? { status: input.status as never } : {})
      });
    }
  }
];

const COMMUNITY_MCP_TOOL_BY_NAME = new Map(
  COMMUNITY_MCP_TOOL_DEFINITIONS.map((tool) => [tool.name, tool])
);

export function listCommunityMcpToolInfo(): McpToolInfo[] {
  return COMMUNITY_MCP_TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    readOnly: true as const,
    requiredScopes: [...MCP_REQUIRED_SCOPES],
    annotations: tool.annotations
  }));
}

function isCommunityMcpTool(toolName: string): boolean {
  return COMMUNITY_MCP_TOOL_BY_NAME.has(toolName);
}

export async function runCommunityMcpTool(
  services: AppServices,
  context: AuthenticatedContext,
  toolName: string,
  rawArgs: unknown
): Promise<unknown> {
  requireMcpReadAccess(context);
  const tool = COMMUNITY_MCP_TOOL_BY_NAME.get(toolName);
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

export async function tryRunCommunityMcpTool(
  services: AppServices,
  context: AuthenticatedContext,
  toolName: string,
  rawArgs: unknown
): Promise<unknown | undefined> {
  if (!isCommunityMcpTool(toolName)) {
    return undefined;
  }
  return runCommunityMcpTool(services, context, toolName, rawArgs);
}
