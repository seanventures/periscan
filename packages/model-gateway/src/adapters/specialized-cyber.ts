import type { ModelProviderType } from "@periscan/shared";

import type {
  ModelProviderAdapter,
  ModelTurnResponse,
  TestConnectionResult
} from "./types.js";

const NOT_AVAILABLE_MESSAGE =
  "Specialized cyber model providers are not customer-connectable yet. This adapter is a fail-closed extension point for a future approved provider.";

/**
 * Fail-closed extension point for a future approved specialized cyber model
 * provider. It remains non-connectable through customer-facing APIs until a
 * concrete provider implementation, tests, policy review, and documentation
 * land together.
 */
export class SpecializedCyberModelAdapter implements ModelProviderAdapter {
  readonly providerType: ModelProviderType = "SpecializedCyberModel";

  async testConnection(): Promise<TestConnectionResult> {
    return {
      message: NOT_AVAILABLE_MESSAGE,
      ok: false
    };
  }

  async createTurn(): Promise<ModelTurnResponse> {
    throw new Error(NOT_AVAILABLE_MESSAGE);
  }
}

export { NOT_AVAILABLE_MESSAGE as SPECIALIZED_CYBER_MODEL_UNAVAILABLE_MESSAGE };
