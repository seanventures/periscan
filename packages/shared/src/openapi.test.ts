import { describe, expect, it } from "vitest";
import {
  ImportThreatAdvisoryInputSchema,
  IntegrationSchema,
  ScopeSchema,
  ThreatFeedIngestionInputSchema,
  zodToJsonSchema
} from "./index.js";

describe("zodToJsonSchema", () => {
  it("converts response schemas", () => {
    const scope = zodToJsonSchema(ScopeSchema, "output") as {
      type?: string;
      properties?: Record<string, unknown>;
    };
    expect(scope.type).toBe("object");
    expect(Object.keys(scope.properties ?? {})).toContain("scopeId");
    expect(
      (zodToJsonSchema(IntegrationSchema, "output") as { type?: string }).type
    ).toBe("object");
  });
  it("converts request input schemas", () => {
    const imp = zodToJsonSchema(ImportThreatAdvisoryInputSchema, "input") as {
      type?: string;
      properties?: Record<string, unknown>;
    };
    expect(Object.keys(imp.properties ?? {})).toContain("sourceName");
    expect(
      (
        zodToJsonSchema(ThreatFeedIngestionInputSchema, "input") as {
          type?: string;
        }
      ).type
    ).toBe("object");
  });
});
