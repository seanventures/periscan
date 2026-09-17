import type { ModelSessionMode, ModelToolDefinition } from "@periscan/shared";

/**
 * Canonical, code-defined tool catalog for the Frontier Gateway. The database
 * only stores per-tenant overrides (enabled / approvalRequired / allowedModes)
 * keyed by toolName; the authoritative schema, safety classification, and
 * required role for every tool live here so they cannot be tampered with at
 * runtime.
 *
 * Read-only and plan tools are implemented first (safety order). Validation,
 * remediation, and reporting (action) tools are added in a later phase and
 * route through the existing policy/mission/runner/approval machinery.
 */

const ALL_MODES: ModelSessionMode[] = [
  "PlanOnly",
  "ReadOnlyEvidence",
  "SafeValidation",
  "GuidedRemediation",
  "HighAssurance"
];

const READ_MODES: ModelSessionMode[] = [
  "ReadOnlyEvidence",
  "SafeValidation",
  "GuidedRemediation",
  "HighAssurance"
];

const PLAN_MODES: ModelSessionMode[] = ALL_MODES;

const READ_ONLY_TOOLS: ModelToolDefinition[] = [
  {
    toolName: "list_assets_in_scope",
    title: "List assets in scope",
    description:
      "Return the normalized assets that belong to the session scopes, with type, criticality, and status. Read-only.",
    safetyClass: "ReadOnly",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "Viewer",
    approvalRequiredByDefault: false,
    allowedModes: READ_MODES,
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        assets: { type: "array" }
      }
    }
  },
  {
    toolName: "get_asset_context",
    title: "Get asset context",
    description:
      "Return redacted context for a single asset: exposures, related identities, and recent validation outcomes. Read-only.",
    safetyClass: "ReadOnly",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "Viewer",
    approvalRequiredByDefault: false,
    allowedModes: READ_MODES,
    inputSchema: {
      type: "object",
      properties: {
        assetId: { type: "string", format: "uuid" }
      },
      required: ["assetId"],
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        asset: { type: "object" }
      }
    }
  },
  {
    toolName: "query_evidence_graph",
    title: "Query evidence graph",
    description:
      "Query the redacted evidence/risk graph for the session scopes. Returns nodes and edges only; never raw scanner output. Read-only.",
    safetyClass: "ReadOnly",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "Viewer",
    approvalRequiredByDefault: false,
    allowedModes: READ_MODES,
    inputSchema: {
      type: "object",
      properties: {
        focus: { type: "string", maxLength: 256 },
        limit: { type: "integer", minimum: 1, maximum: 200 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        nodes: { type: "array" },
        edges: { type: "array" }
      }
    }
  },
  {
    toolName: "get_attack_paths",
    title: "Get attack paths",
    description:
      "Return validated attack paths for the session scopes, including entry, impact, and breaker nodes. Read-only.",
    safetyClass: "ReadOnly",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "Viewer",
    approvalRequiredByDefault: false,
    allowedModes: READ_MODES,
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        paths: { type: "array" }
      }
    }
  },
  {
    toolName: "get_control_results",
    title: "Get control results",
    description:
      "Return the latest control validation results (detection/prevention outcomes) for the session scopes. Read-only.",
    safetyClass: "ReadOnly",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "Viewer",
    approvalRequiredByDefault: false,
    allowedModes: READ_MODES,
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        controls: { type: "array" }
      }
    }
  },
  {
    toolName: "get_missing_signals",
    title: "Get missing signals",
    description:
      "Return telemetry/coverage gaps (missing signals) relevant to the session scopes. Read-only.",
    safetyClass: "ReadOnly",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "Viewer",
    approvalRequiredByDefault: false,
    allowedModes: READ_MODES,
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        missingSignals: { type: "array" }
      }
    }
  }
];

const PLAN_TOOLS: ModelToolDefinition[] = [
  {
    toolName: "summarize_evidence",
    title: "Summarize evidence",
    description:
      "Produce a deterministic, evidence-grounded summary for the session scopes using Periscan's operator summarizer. Planning only; produces no actions.",
    safetyClass: "Plan",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: false,
    allowedModes: PLAN_MODES,
    inputSchema: {
      type: "object",
      properties: {
        focus: { type: "string", maxLength: 512 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        summary: { type: "object" }
      }
    }
  },
  {
    toolName: "recommend_validation_missions",
    title: "Recommend validation missions",
    description:
      "Return deterministic operator recommendations for validation missions given the current evidence. Planning only; queues nothing.",
    safetyClass: "Plan",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: false,
    allowedModes: PLAN_MODES,
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        recommendations: { type: "array" }
      }
    }
  },
  {
    toolName: "create_validation_plan",
    title: "Create validation plan",
    description:
      "Draft a structured, ordered validation plan from recommendations. Planning only; does not create or start missions.",
    safetyClass: "Plan",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: false,
    allowedModes: PLAN_MODES,
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string", maxLength: 1024 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        plan: { type: "object" }
      }
    }
  }
];

const VALIDATION_MODES: ModelSessionMode[] = [
  "SafeValidation",
  "HighAssurance"
];

const REMEDIATION_MODES: ModelSessionMode[] = [
  "GuidedRemediation",
  "HighAssurance"
];

/**
 * Action tools route through Periscan's existing policy/mission/runner/approval
 * machinery. They are approval-gated by default and only surface in the higher
 * session modes. The orchestration loop never executes them inline: a request
 * sets the session Blocked until a human approves, after which the control-plane
 * re-previews the policy decision before anything is queued. No model can mark a
 * risk fixed without a real verification event.
 */
const ACTION_TOOLS: ModelToolDefinition[] = [
  {
    toolName: "request_exposure_validation",
    title: "Request exposure validation",
    description:
      "Request a controlled validation mission for an exposure in scope. Approval-gated; routes through the policy engine and never runs destructive actions.",
    safetyClass: "Validation",
    safetyLevel: "ControlledValidation",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: true,
    allowedModes: VALIDATION_MODES,
    inputSchema: {
      type: "object",
      properties: {
        exposureId: { type: "string", format: "uuid" },
        assetId: { type: "string", format: "uuid" },
        reason: { type: "string", maxLength: 1024 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: {
        missionId: { type: "string" },
        policyDecisionId: { type: "string" },
        outcome: { type: "string" }
      }
    }
  },
  {
    toolName: "request_control_validation",
    title: "Request control validation",
    description:
      "Request a controlled validation mission for a detection/prevention control in scope. Approval-gated; routes through the policy engine.",
    safetyClass: "Validation",
    safetyLevel: "ControlledValidation",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: true,
    allowedModes: VALIDATION_MODES,
    inputSchema: {
      type: "object",
      properties: {
        controlId: { type: "string" },
        reason: { type: "string", maxLength: 1024 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: { missionId: { type: "string" } }
    }
  },
  {
    toolName: "request_attack_path_validation",
    title: "Request attack path validation",
    description:
      "Request a controlled validation mission to verify a hypothesized attack path in scope. Approval-gated; routes through the policy engine.",
    safetyClass: "Validation",
    safetyLevel: "ControlledValidation",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: true,
    allowedModes: VALIDATION_MODES,
    inputSchema: {
      type: "object",
      properties: {
        pathId: { type: "string", format: "uuid" },
        reason: { type: "string", maxLength: 1024 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: { missionId: { type: "string" } }
    }
  },
  {
    toolName: "request_fix_verification",
    title: "Request fix verification",
    description:
      "Request a verification mission to confirm a remediation actually closed a risk. Approval-gated. A risk can only be marked fixed by a real verification event, never by the model.",
    safetyClass: "Validation",
    safetyLevel: "ControlledValidation",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: true,
    allowedModes: ["SafeValidation", ...REMEDIATION_MODES],
    inputSchema: {
      type: "object",
      properties: {
        remediationId: { type: "string", format: "uuid" },
        exposureId: { type: "string", format: "uuid" },
        reason: { type: "string", maxLength: 1024 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: { missionId: { type: "string" } }
    }
  },
  {
    toolName: "create_remediation_plan",
    title: "Create remediation plan",
    description:
      "Draft a structured remediation plan from deterministic operator recommendations. Approval-gated. Produces a draft only; it never applies changes or marks anything fixed.",
    safetyClass: "Remediation",
    safetyLevel: "ActiveNonInvasive",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: true,
    allowedModes: REMEDIATION_MODES,
    inputSchema: {
      type: "object",
      properties: {
        objective: { type: "string", maxLength: 1024 }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: { plan: { type: "object" } }
    }
  },
  {
    toolName: "generate_evidence_pack_draft",
    title: "Generate evidence pack draft",
    description:
      "Produce a deterministic, evidence-grounded report draft for review. Approval-gated. Read-only with respect to customer systems; cites evidence ids.",
    safetyClass: "Reporting",
    safetyLevel: "PassiveReadOnly",
    requiredRole: "SecurityEngineer",
    approvalRequiredByDefault: true,
    allowedModes: ["SafeValidation", ...REMEDIATION_MODES],
    inputSchema: {
      type: "object",
      properties: {
        useCase: {
          type: "string",
          enum: [
            "ExecutiveSummary",
            "RemediationSummary",
            "AttackPathExplanation",
            "EvidencePackSummary"
          ]
        }
      },
      additionalProperties: false
    },
    outputSchema: {
      type: "object",
      properties: { summary: { type: "object" } }
    }
  }
];

export const MODEL_TOOL_CATALOG: ModelToolDefinition[] = [
  ...READ_ONLY_TOOLS,
  ...PLAN_TOOLS,
  ...ACTION_TOOLS
];

const CATALOG_BY_NAME = new Map<string, ModelToolDefinition>(
  MODEL_TOOL_CATALOG.map((tool) => [tool.toolName, tool])
);

export function listModelToolDefinitions(): ModelToolDefinition[] {
  return MODEL_TOOL_CATALOG.map((tool) => ({ ...tool }));
}

export function getModelToolDefinition(
  toolName: string
): ModelToolDefinition | undefined {
  const found = CATALOG_BY_NAME.get(toolName);
  return found ? { ...found } : undefined;
}

export function isKnownModelTool(toolName: string): boolean {
  return CATALOG_BY_NAME.has(toolName);
}
