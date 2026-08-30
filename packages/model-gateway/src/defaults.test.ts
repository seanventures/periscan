import { describe, expect, it } from "vitest";

import { resolveDefaultModelForProvider } from "./defaults.js";

describe("resolveDefaultModelForProvider", () => {
  it("defaults Anthropic providers to a Claude Opus model (not an OpenAI model)", () => {
    expect(resolveDefaultModelForProvider("AnthropicCompatible")).toMatch(
      /^claude-opus/u
    );
  });

  it("defaults OpenAI-family providers to a GPT model", () => {
    expect(resolveDefaultModelForProvider("OpenAICompatible")).toBe(
      "gpt-4o-mini"
    );
    expect(resolveDefaultModelForProvider("LocalOpenAICompatible")).toBe(
      "gpt-4o-mini"
    );
  });

  it("uses family-appropriate defaults for Google and Bedrock", () => {
    expect(resolveDefaultModelForProvider("GoogleCompatible")).toMatch(
      /^gemini/u
    );
    expect(resolveDefaultModelForProvider("AWSBedrockCompatible")).toMatch(
      /claude/u
    );
  });

  it("lets an explicit override win for any provider", () => {
    expect(
      resolveDefaultModelForProvider("AnthropicCompatible", "claude-sonnet-4-5")
    ).toBe("claude-sonnet-4-5");
    expect(
      resolveDefaultModelForProvider("OpenAICompatible", "  gpt-4o  ")
    ).toBe("gpt-4o");
    // Blank overrides fall back to the family default.
    expect(
      resolveDefaultModelForProvider("AnthropicCompatible", "   ")
    ).toMatch(/^claude-opus/u);
  });
});
