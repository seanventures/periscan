import { describe, expect, it, vi } from "vitest";

import type {
  ModelProviderAdapter,
  ModelTurnResponse
} from "../adapters/types.js";
import {
  runModelGatewayTurn,
  type GatewayOrchestratorDeps,
  type GatewayToolOutcome
} from "./orchestrator.js";

function createScriptedAdapter(responses: ModelTurnResponse[]): {
  adapter: ModelProviderAdapter;
  calls: number;
} {
  const state = { calls: 0 };
  const adapter: ModelProviderAdapter = {
    providerType: "OpenAICompatible",
    async createTurn() {
      const response = responses[state.calls] ?? {
        assistantText: "done",
        finishReason: "stop",
        toolCalls: []
      };
      state.calls += 1;
      return response;
    },
    async testConnection() {
      return { message: "ok", ok: true };
    }
  };
  return {
    adapter,
    get calls() {
      return state.calls;
    }
  } as { adapter: ModelProviderAdapter; calls: number };
}

function baseDeps(
  overrides: Partial<GatewayOrchestratorDeps> = {}
): GatewayOrchestratorDeps {
  return {
    buildInitialMessages: async () => [{ content: "hi", role: "user" }],
    checkAbort: async () => ({ aborted: false }),
    evaluateToolCall: async (): Promise<GatewayToolOutcome> => ({
      status: "Allowed",
      toolRequestId: "tr-1"
    }),
    executeAllowedTool: async () => ({ content: "{}" }),
    listToolSchemas: () => [],
    maxIterations: 4,
    model: "test-model",
    ...overrides
  };
}

describe("runModelGatewayTurn", () => {
  it("completes when the model returns no tool calls", async () => {
    const { adapter } = createScriptedAdapter([
      { assistantText: "all done", finishReason: "stop", toolCalls: [] }
    ]);

    const result = await runModelGatewayTurn(adapter, baseDeps());

    expect(result.status).toBe("Completed");
    expect(result.assistantText).toBe("all done");
    expect(result.toolCallsHandled).toBe(0);
  });

  it("executes an allowed tool then completes, feeding the result back", async () => {
    const { adapter } = createScriptedAdapter([
      {
        assistantText: "let me look",
        finishReason: "tool_calls",
        toolCalls: [
          {
            arguments: { limit: 5 },
            id: "call-1",
            toolName: "list_assets_in_scope"
          }
        ]
      },
      {
        assistantText: "here is the summary",
        finishReason: "stop",
        toolCalls: []
      }
    ]);
    const executeAllowedTool = vi.fn(async () => ({
      content: '{"assets":[]}'
    }));

    const result = await runModelGatewayTurn(
      adapter,
      baseDeps({ executeAllowedTool })
    );

    expect(result.status).toBe("Completed");
    expect(result.toolCallsHandled).toBe(1);
    expect(executeAllowedTool).toHaveBeenCalledOnce();
  });

  it("never executes a denied tool and returns a denial message to the model", async () => {
    const { adapter } = createScriptedAdapter([
      {
        assistantText: "trying",
        finishReason: "tool_calls",
        toolCalls: [{ arguments: {}, id: "call-1", toolName: "blocked_tool" }]
      },
      { assistantText: "ok", finishReason: "stop", toolCalls: [] }
    ]);
    const executeAllowedTool = vi.fn(async () => ({ content: "{}" }));

    const result = await runModelGatewayTurn(
      adapter,
      baseDeps({
        evaluateToolCall: async () => ({
          denialReason: "Tool is blocked by policy.",
          status: "Denied",
          toolRequestId: "tr-denied"
        }),
        executeAllowedTool
      })
    );

    expect(result.status).toBe("Completed");
    expect(result.toolCallsHandled).toBe(1);
    expect(executeAllowedTool).not.toHaveBeenCalled();
  });

  it("blocks the turn when a tool requires approval, without executing it", async () => {
    const { adapter } = createScriptedAdapter([
      {
        assistantText: "requesting validation",
        finishReason: "tool_calls",
        toolCalls: [
          {
            arguments: {},
            id: "call-1",
            toolName: "request_exposure_validation"
          }
        ]
      }
    ]);
    const executeAllowedTool = vi.fn(async () => ({ content: "{}" }));

    const result = await runModelGatewayTurn(
      adapter,
      baseDeps({
        evaluateToolCall: async () => ({
          status: "RequiresApproval",
          toolRequestId: "tr-approval"
        }),
        executeAllowedTool
      })
    );

    expect(result.status).toBe("Blocked");
    expect(result.pendingToolRequestId).toBe("tr-approval");
    expect(executeAllowedTool).not.toHaveBeenCalled();
  });

  it("aborts before calling the provider when the kill switch is active", async () => {
    const createTurn = vi.fn();
    const adapter: ModelProviderAdapter = {
      createTurn,
      providerType: "OpenAICompatible",
      async testConnection() {
        return { message: "ok", ok: true };
      }
    };

    const result = await runModelGatewayTurn(
      adapter,
      baseDeps({
        checkAbort: async () => ({ aborted: true, reason: "kill_switch" })
      })
    );

    expect(result.status).toBe("Aborted");
    expect(result.abortReason).toBe("kill_switch");
    expect(createTurn).not.toHaveBeenCalled();
  });

  it("aborts with max_iterations_reached when the model never stops", async () => {
    const adapter: ModelProviderAdapter = {
      providerType: "OpenAICompatible",
      async createTurn() {
        return {
          assistantText: "looping",
          finishReason: "tool_calls",
          toolCalls: [
            { arguments: {}, id: "call-x", toolName: "list_assets_in_scope" }
          ]
        };
      },
      async testConnection() {
        return { message: "ok", ok: true };
      }
    };

    const result = await runModelGatewayTurn(
      adapter,
      baseDeps({ maxIterations: 3 })
    );

    expect(result.status).toBe("Aborted");
    expect(result.abortReason).toBe("max_iterations_reached");
    expect(result.iterations).toBe(3);
    expect(result.toolCallsHandled).toBe(3);
  });
});
