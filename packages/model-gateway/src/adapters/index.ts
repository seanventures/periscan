import type { ModelProviderType } from "@periscan/shared";

import { AnthropicCompatibleAdapter } from "./anthropic.js";
import { OpenAiCompatibleAdapter } from "./openai.js";
import { SpecializedCyberModelAdapter } from "./specialized-cyber.js";
import type {
  ModelProviderAdapter,
  ModelProviderAdapterConfig
} from "./types.js";

/**
 * Construct the correct provider adapter for a given provider type. New
 * provider families (e.g. a future specialized cyber model) are added here and
 * nowhere else — the orchestration loop, tool server, and policy enforcement
 * remain untouched.
 */
export function createModelProviderAdapter(
  providerType: ModelProviderType,
  config: ModelProviderAdapterConfig
): ModelProviderAdapter {
  switch (providerType) {
    case "AnthropicCompatible":
      return new AnthropicCompatibleAdapter(config);
    case "OpenAICompatible":
    case "LocalOpenAICompatible":
    case "CustomerPrivateEndpoint":
    case "GoogleCompatible":
    case "MicrosoftCompatible":
    case "AWSBedrockCompatible":
    case "Other":
      // OpenAI-compatible chat-completions is the lingua franca for these
      // deployments; customers point endpointUrl at their gateway.
      return new OpenAiCompatibleAdapter(config, providerType);
    case "SpecializedCyberModel":
      return new SpecializedCyberModelAdapter();
    default: {
      const exhaustive: never = providerType;
      throw new Error(`Unsupported model provider type: ${String(exhaustive)}`);
    }
  }
}

export { AnthropicCompatibleAdapter } from "./anthropic.js";
export { OpenAiCompatibleAdapter } from "./openai.js";
export {
  SpecializedCyberModelAdapter,
  SPECIALIZED_CYBER_MODEL_UNAVAILABLE_MESSAGE
} from "./specialized-cyber.js";
export type {
  FetchLike,
  ModelMessage,
  ModelProviderAdapter,
  ModelProviderAdapterConfig,
  ModelToolCall,
  ModelToolSchema,
  ModelTurnRequest,
  ModelTurnResponse,
  TestConnectionResult
} from "./types.js";
