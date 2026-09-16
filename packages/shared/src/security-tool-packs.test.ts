import { describe, expect, it } from "vitest";

import {
  ENGINE_LAB_THEATER_TOOL_IDS,
  OpenSourceToolIdSchema,
  isCommunityValidationToolId,
  isCopyleftOptInToolId,
  listSecurityCatalogPacks,
  listUniqueSecurityCatalogToolIds
} from "./index.js";

describe("security tool package manager catalog", () => {
  it("lists at least 100 unique popular OSS tools across packs", () => {
    const ids = listUniqueSecurityCatalogToolIds();
    expect(ids.length).toBeGreaterThanOrEqual(100);
    expect(listSecurityCatalogPacks().length).toBeGreaterThanOrEqual(10);
    for (const toolId of ids) {
      expect(OpenSourceToolIdSchema.safeParse(toolId).success).toBe(true);
    }
  });

  it("does not Community-start copyleft or theater tools", () => {
    expect(isCommunityValidationToolId("trufflehog")).toBe(false);
    expect(isCommunityValidationToolId("hadolint")).toBe(false);
    expect(isCommunityValidationToolId("sqlmap")).toBe(false);
    expect(isCopyleftOptInToolId("trufflehog")).toBe(true);
    expect(isCopyleftOptInToolId("sqlmap")).toBe(false);
    expect(
      ENGINE_LAB_THEATER_TOOL_IDS.some((toolId) =>
        isCommunityValidationToolId(toolId)
      )
    ).toBe(false);
  });

  it("auto-includes major permissive engines in Community", () => {
    expect(isCommunityValidationToolId("gitleaks")).toBe(true);
    expect(isCommunityValidationToolId("brakeman")).toBe(true);
    expect(isCommunityValidationToolId("dependency-check")).toBe(true);
    expect(isCommunityValidationToolId("tfsec")).toBe(true);
    expect(isCommunityValidationToolId("katana")).toBe(true);
  });
});
