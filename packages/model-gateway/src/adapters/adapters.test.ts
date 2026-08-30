import { describe, expect, it, vi } from "vitest";

import { createModelProviderAdapter } from "./index.js";
import { OpenAiCompatibleAdapter } from "./openai.js";
import { AnthropicCompatibleAdapter } from "./anthropic.js";
import { SpecializedCyberModelAdapter } from "./specialized-cyber.js";
import type { FetchLike } from "./types.js";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    json: async () => body,
    ok,
    status,
    text: async () => JSON.stringify(body)
  };
}

describe("OpenAiCompatibleAdapter", () => {
  it("lists models on testConnection without sending evidence", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toBe("https://api.test/v1/models");
      return jsonResponse({ data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }] });
    }) as unknown as FetchLike;

    const adapter = new OpenAiCompatibleAdapter({
      apiKey: "sk-key",
      authMethod: "bearer",
      endpointUrl: "https://api.test/v1/",
      fetchImpl
    });

    const result = await adapter.testConnection();
    expect(result.ok).toBe(true);
    expect(result.availableModels).toEqual(["gpt-4o", "gpt-4o-mini"]);
    // The body of a GET test must not exist (no evidence sent).
    expect(
      (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]
        ?.body
    ).toBeUndefined();
  });

  it("normalizes tool calls from a chat completion", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: { body?: string }) => {
      expect(url).toBe("https://api.test/v1/chat/completions");
      const parsed = JSON.parse(init?.body ?? "{}");
      expect(parsed.tools[0].function.name).toBe("list_assets_in_scope");
      return jsonResponse({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: "Looking at assets.",
              tool_calls: [
                {
                  function: {
                    arguments: JSON.stringify({ limit: 5 }),
                    name: "list_assets_in_scope"
                  },
                  id: "call_1"
                }
              ]
            }
          }
        ]
      });
    }) as unknown as FetchLike;

    const adapter = new OpenAiCompatibleAdapter({
      apiKey: "sk-key",
      authMethod: "bearer",
      endpointUrl: "https://api.test/v1",
      fetchImpl
    });

    const turn = await adapter.createTurn({
      messages: [{ content: "hello", role: "user" }],
      model: "gpt-4o",
      tools: [
        {
          description: "List assets",
          name: "list_assets_in_scope",
          parameters: { properties: {}, type: "object" }
        }
      ]
    });

    expect(turn.assistantText).toBe("Looking at assets.");
    expect(turn.toolCalls).toHaveLength(1);
    expect(turn.toolCalls[0]).toMatchObject({
      arguments: { limit: 5 },
      id: "call_1",
      toolName: "list_assets_in_scope"
    });
  });

  it("reports failure on non-OK test connection", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "unauthorized" }, false, 401)
    ) as unknown as FetchLike;
    const adapter = new OpenAiCompatibleAdapter({
      apiKey: "bad",
      authMethod: "bearer",
      endpointUrl: "https://api.test/v1",
      fetchImpl
    });

    const result = await adapter.testConnection();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });
});

describe("AnthropicCompatibleAdapter", () => {
  it("extracts text and tool_use blocks", async () => {
    const fetchImpl = vi.fn(
      async (url: string, init?: { headers?: Record<string, string> }) => {
        if (url.endsWith("/v1/messages")) {
          expect(init?.headers?.["x-api-key"]).toBe("anthropic-key");
          return jsonResponse({
            content: [
              { text: "Reviewing.", type: "text" },
              {
                id: "tool_1",
                input: { focus: "exposures" },
                name: "query_evidence_graph",
                type: "tool_use"
              }
            ],
            stop_reason: "tool_use"
          });
        }
        return jsonResponse({ data: [] });
      }
    ) as unknown as FetchLike;

    const adapter = new AnthropicCompatibleAdapter({
      apiKey: "anthropic-key",
      authMethod: "x-api-key",
      endpointUrl: "https://api.anthropic.test",
      fetchImpl
    });

    const turn = await adapter.createTurn({
      messages: [
        { content: "system rules", role: "system" },
        { content: "investigate", role: "user" }
      ],
      model: "claude-3-5-sonnet-latest",
      tools: [
        {
          description: "Query graph",
          name: "query_evidence_graph",
          parameters: { properties: {}, type: "object" }
        }
      ]
    });

    expect(turn.assistantText).toBe("Reviewing.");
    expect(turn.toolCalls[0]).toMatchObject({
      arguments: { focus: "exposures" },
      toolName: "query_evidence_graph"
    });
  });
});

describe("SpecializedCyberModelAdapter", () => {
  it("fails closed until an approved provider ships", async () => {
    const adapter = new SpecializedCyberModelAdapter();
    const result = await adapter.testConnection();
    expect(result.ok).toBe(false);
    await expect(adapter.createTurn()).rejects.toThrow(
      /not customer-connectable/i
    );
  });
});

describe("createModelProviderAdapter", () => {
  it("selects the right adapter per provider type", () => {
    const config = {
      apiKey: "k",
      authMethod: "bearer",
      endpointUrl: "https://x.test"
    };
    expect(
      createModelProviderAdapter("OpenAICompatible", config)
    ).toBeInstanceOf(OpenAiCompatibleAdapter);
    expect(
      createModelProviderAdapter("CustomerPrivateEndpoint", config)
    ).toBeInstanceOf(OpenAiCompatibleAdapter);
    expect(
      createModelProviderAdapter("AnthropicCompatible", config)
    ).toBeInstanceOf(AnthropicCompatibleAdapter);
    expect(
      createModelProviderAdapter("SpecializedCyberModel", config)
    ).toBeInstanceOf(SpecializedCyberModelAdapter);
  });
});
