import { describe, expect, it } from "vitest";

import {
  CreateExtensionProjectInputSchema,
  ReviewExtensionReleaseInputSchema,
  SubmitExtensionReleaseInputSchema
} from "./extensions";

describe("extension developer lifecycle contracts", () => {
  it("accepts reviewed project metadata and semantic release versions", () => {
    expect(
      CreateExtensionProjectInputSchema.parse({
        description:
          "Normalize an approved evidence source into typed findings.",
        displayName: "Safe source adapter",
        licenseSpdx: "Apache-2.0",
        packageName: "safe-source-adapter",
        repositoryUrl: "https://github.com/example/safe-source-adapter",
        supportUrl: "https://support.example/extensions/safe-source-adapter"
      }).packageName
    ).toBe("safe-source-adapter");

    expect(
      SubmitExtensionReleaseInputSchema.safeParse({
        contract: {},
        version: "release-one"
      }).success
    ).toBe(false);
  });

  it("requires a meaningful human reason for certification decisions", () => {
    expect(
      ReviewExtensionReleaseInputSchema.safeParse({
        decision: "Certify",
        reason: "ok"
      }).success
    ).toBe(false);
    expect(
      ReviewExtensionReleaseInputSchema.safeParse({
        decision: "Reject",
        reason: "Network permission is broader than the reviewed purpose."
      }).success
    ).toBe(true);
  });
});
