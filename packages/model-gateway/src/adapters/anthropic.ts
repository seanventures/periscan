import type { ModelProviderType } from "@periscan/shared";

import {
  resolveFetch,
  trimTrailingSlash,
  type FetchLike,
  type ModelProviderAdapter,
  type ModelProviderAdapterConfig,
  type ModelMessage,
  type ModelToolCall,
  type ModelTurnRequest,
  type ModelTurnResponse,
  type TestConnectionResult
} from "./types.js";

const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicContentBlock {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Adapter for Anthropic-compatible Messages API endpoints (function/tool
 * calling via tool_use content blocks).
 */
export class AnthropicCompatibleAdapter implements ModelProviderAdapter {
  readonly providerType: ModelProviderType = "AnthropicCompatible";
  private readonly endpointUrl: string;
  private readonly apiKey: string | null;
  private readonly defaultModel: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: ModelProviderAdapterConfig) {
    this.endpointUrl = trimTrailingSlash(config.endpointUrl);
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel ?? "claude-3-5-sonnet-latest";
    this.fetchImpl = resolveFetch(config.fetchImpl);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json"
    };
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    return headers;
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const response = await this.fetchImpl(`${this.endpointUrl}/v1/models`, {
        headers: this.headers(),
        method: "GET"
      });

      if (!response.ok) {
        return {
          message: `Provider returned HTTP ${response.status}.`,
          ok: false
        };
      }

      const body = (await response.json()) as {
        data?: Array<{ id?: string }>;
      };
      const availableModels = (body.data ?? [])
        .map((entry) => entry.id)
        .filter((id): id is string => typeof id === "string")
        .slice(0, 50);

      return {
        availableModels,
        message: "Connection succeeded.",
        ok: true
      };
    } catch (error) {
      return {
        message:
          error instanceof Error ? error.message : "Failed to reach provider.",
        ok: false
      };
    }
  }

  async createTurn(request: ModelTurnRequest): Promise<ModelTurnResponse> {
    const systemPrompt = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");

    const conversation = request.messages.filter(
      (message) => message.role !== "system"
    );

    const payload = {
      max_tokens: request.maxTokens ?? 1024,
      messages: conversation.map((message) => toAnthropicMessage(message)),
      model: request.model || this.defaultModel,
      system: systemPrompt || undefined,
      temperature: request.temperature,
      tools:
        request.tools.length > 0
          ? request.tools.map((tool) => ({
              description: tool.description,
              input_schema: tool.parameters,
              name: tool.name
            }))
          : undefined
    };

    const response = await this.fetchImpl(`${this.endpointUrl}/v1/messages`, {
      body: JSON.stringify(payload),
      headers: this.headers(),
      method: "POST",
      signal: request.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Anthropic-compatible provider error HTTP ${response.status}: ${detail.slice(0, 500)}`
      );
    }

    const body = (await response.json()) as {
      content?: AnthropicContentBlock[];
      stop_reason?: string;
      usage?: {
        cache_read_input_tokens?: number;
        input_tokens?: number;
        output_tokens?: number;
      };
    };
    const blocks = body.content ?? [];
    const assistantText = blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
    const toolCalls: ModelToolCall[] = blocks
      .filter((block) => block.type === "tool_use")
      .map((block, index) => ({
        arguments: block.input ?? {},
        id: block.id ?? `tool_use_${index}`,
        toolName: block.name ?? ""
      }))
      .filter((call) => call.toolName.length > 0);

    return {
      assistantText,
      finishReason: body.stop_reason ?? "end_turn",
      toolCalls,
      usage: {
        cachedInputTokens: body.usage?.cache_read_input_tokens ?? 0,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0
      }
    };
  }
}

function toAnthropicMessage(message: ModelMessage) {
  if (message.role === "tool") {
    return {
      content: [
        {
          content: message.content,
          tool_use_id: message.toolCallId,
          type: "tool_result" as const
        }
      ],
      role: "user" as const
    };
  }

  return {
    content: message.content,
    role:
      message.role === "assistant" ? ("assistant" as const) : ("user" as const)
  };
}
