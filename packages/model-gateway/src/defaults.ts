import type { ModelProviderType } from "@periscan/shared";

/**
 * Resolve a sensible default model for a BYO provider when none is explicitly
 * configured. Critically, the default must match the PROVIDER FAMILY: previously
 * the gateway worker hard-coded an OpenAI model ("gpt-4o-mini") for every
 * provider, which fails outright against an Anthropic/Google/Bedrock endpoint.
 *
 * An explicit override (e.g. PERISCAN_MODEL_GATEWAY_DEFAULT_MODEL or a future
 * per-provider default) always wins; this is only the family fallback. Customers
 * connect their own endpoint + key (no Periscan-hosted model), so these are just
 * reasonable starting points they can override.
 */
export function resolveDefaultModelForProvider(
  providerType: ModelProviderType,
  override?: string | null
): string {
  const trimmed = override?.trim();
  if (trimmed) {
    return trimmed;
  }

  switch (providerType) {
    case "AnthropicCompatible":
      // Anthropic Claude Opus — the strongest reasoning model for the gateway's
      // evidence-reasoning workload.
      return "claude-opus-4-20250514";
    case "GoogleCompatible":
      return "gemini-1.5-pro";
    case "AWSBedrockCompatible":
      return "anthropic.claude-3-5-sonnet-20241022-v2:0";
    case "OpenAICompatible":
    case "LocalOpenAICompatible":
    case "MicrosoftCompatible":
    case "CustomerPrivateEndpoint":
    case "SpecializedCyberModel":
    case "Other":
    default:
      return "gpt-4o-mini";
  }
}
