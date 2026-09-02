import type { ModelProviderType } from "@periscan/shared";

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

export type ModelMessageRole = "system" | "user" | "assistant" | "tool";

export interface ModelMessage {
  role: ModelMessageRole;
  content: string;
  /** Present on tool-result messages: the id of the tool call being answered. */
  toolCallId?: string;
  /** Optional tool name for tool-result messages. */
  name?: string;
}

export interface ModelToolSchema {
  name: string;
  description: string;
  /** JSON Schema object describing the tool input. */
  parameters: Record<string, unknown>;
}

export interface ModelToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ModelTurnRequest {
  model: string;
  messages: ModelMessage[];
  tools: ModelToolSchema[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface ModelTurnResponse {
  assistantText: string;
  toolCalls: ModelToolCall[];
  finishReason: string;
  usage?: {
    cachedInputTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  availableModels?: string[];
}

export interface ModelProviderAdapter {
  readonly providerType: ModelProviderType;
  /**
   * Lightweight reachability + credential check. MUST NOT send any customer
   * evidence or context to the provider.
   */
  testConnection(): Promise<TestConnectionResult>;
  /**
   * Run a single tool-calling turn. Returns the normalized assistant message
   * plus any tool calls the model requested.
   */
  createTurn(request: ModelTurnRequest): Promise<ModelTurnResponse>;
}

export interface ModelProviderAdapterConfig {
  endpointUrl: string;
  apiKey: string | null;
  authMethod: string;
  defaultModel?: string;
  /** Injectable fetch for testing. Defaults to global fetch. */
  fetchImpl?: FetchLike;
}

export function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as unknown as FetchLike;
  }
  throw new Error(
    "No fetch implementation available for model provider adapter."
  );
}

export function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
