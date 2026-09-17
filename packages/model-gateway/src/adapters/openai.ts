import type { ModelProviderType } from "@periscan/shared";

import {
  resolveFetch,
  trimTrailingSlash,
  type FetchLike,
  type ModelProviderAdapter,
  type ModelProviderAdapterConfig,
  type ModelToolCall,
  type ModelTurnRequest,
  type ModelTurnResponse,
  type TestConnectionResult
} from "./types.js";

function parseToolArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

interface OpenAiChatChoice {
  finish_reason?: string;
  message?: {
    content?: string | null;
    tool_calls?: Array<{
      id?: string;
      function?: { name?: string; arguments?: string };
    }>;
  };
}

/**
 * Adapter for any OpenAI-compatible chat-completions endpoint. This also backs
 * customer-private and local OpenAI-compatible deployments via a configurable
 * base URL.
 */
export class OpenAiCompatibleAdapter implements ModelProviderAdapter {
  readonly providerType: ModelProviderType;
  private readonly endpointUrl: string;
  private readonly apiKey: string | null;
  private readonly defaultModel: string;
  private readonly fetchImpl: FetchLike;

  constructor(
    config: ModelProviderAdapterConfig,
    providerType: ModelProviderType = "OpenAICompatible"
  ) {
    this.providerType = providerType;
    this.endpointUrl = trimTrailingSlash(config.endpointUrl);
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel ?? "gpt-4o-mini";
    this.fetchImpl = resolveFetch(config.fetchImpl);
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "content-type": "application/json"
    };
    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const response = await this.fetchImpl(`${this.endpointUrl}/models`, {
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
    const payload = {
      max_tokens: request.maxTokens,
      messages: request.messages.map((message) => {
        if (message.role === "tool") {
          return {
            content: message.content,
            role: "tool" as const,
            tool_call_id: message.toolCallId
          };
        }
        return { content: message.content, role: message.role };
      }),
      model: request.model || this.defaultModel,
      temperature: request.temperature,
      tool_choice: request.tools.length > 0 ? "auto" : undefined,
      tools:
        request.tools.length > 0
          ? request.tools.map((tool) => ({
              function: {
                description: tool.description,
                name: tool.name,
                parameters: tool.parameters
              },
              type: "function" as const
            }))
          : undefined
    };

    const response = await this.fetchImpl(
      `${this.endpointUrl}/chat/completions`,
      {
        body: JSON.stringify(payload),
        headers: this.headers(),
        method: "POST",
        signal: request.signal
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `OpenAI-compatible provider error HTTP ${response.status}: ${detail.slice(0, 500)}`
      );
    }

    const body = (await response.json()) as {
      choices?: OpenAiChatChoice[];
      usage?: {
        completion_tokens?: number;
        prompt_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    };
    const choice = body.choices?.[0];
    const toolCalls: ModelToolCall[] = (choice?.message?.tool_calls ?? [])
      .map((call, index) => ({
        arguments: parseToolArguments(call.function?.arguments),
        id: call.id ?? `tool_call_${index}`,
        toolName: call.function?.name ?? ""
      }))
      .filter((call) => call.toolName.length > 0);

    return {
      assistantText: choice?.message?.content ?? "",
      finishReason: choice?.finish_reason ?? "stop",
      toolCalls,
      usage: {
        cachedInputTokens:
          body.usage?.prompt_tokens_details?.cached_tokens ?? 0,
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0
      }
    };
  }
}
