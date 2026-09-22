import { describe, expect, it } from "vitest";
import {
  BasContentReviewStatusSchema,
  BasContentSourcePathSchema,
  BasContentVersionFilterSchema,
  BasContentVersionSummarySchema,
  PromoteBasContentInputSchema,
  PromoteBasContentResultSchema,
  RegisterBasContentInputSchema
} from "./bas-content.js";

describe("BAS version registry contracts", () => {
  it("accepts logical upstream paths and rejects filesystem/URL/traversal aliases", () => {
    expect(BasContentSourcePathSchema.parse("atomics/T1082/T1082.yaml")).toBe(
      "atomics/T1082/T1082.yaml"
    );
    for (const path of [
      "/tmp/content",
      "../content",
      "a/../b",
      "./content",
      "a//b",
      "a\\b",
      "https://example.com/content",
      "a/",
      "a\u0000b"
    ]) {
      expect(BasContentSourcePathSchema.safeParse(path).success).toBe(false);
    }
  });

  it("bounds page sizes and rejects extra filters and malformed cursors", () => {
    expect(BasContentVersionFilterSchema.parse({})).toEqual({ limit: 25 });
    expect(
      BasContentVersionFilterSchema.parse({ limit: "2", provider: "Caldera" })
    ).toEqual({ limit: 2, provider: "Caldera" });
    for (const query of [
      { limit: 0 },
      { limit: 51 },
      { limit: 1.1 },
      { cursor: "invalid" },
      { tenantId: "elsewhere" }
    ]) {
      expect(BasContentVersionFilterSchema.safeParse(query).success).toBe(
        false
      );
    }
  });

  it("does not accept client approval, executable status, or a tenant override", () => {
    const input = {
      provider: "Caldera",
      sourceRevision: "abc",
      sourcePath: "abilities/test.yml",
      format: "json",
      content: "[]"
    };
    expect(RegisterBasContentInputSchema.safeParse(input).success).toBe(true);
    for (const extra of [
      { executable: true },
      { reviewStatus: "Approved" },
      { tenantId: "elsewhere" }
    ]) {
      expect(
        RegisterBasContentInputSchema.safeParse({ ...input, ...extra }).success
      ).toBe(false);
    }
  });

  it("promotes a content version to Reviewed without flipping executable or live gates", () => {
    expect(BasContentReviewStatusSchema.options).toEqual([
      "Unreviewed",
      "Reviewed"
    ]);
    expect(PromoteBasContentInputSchema.parse({ reviewStatus: "Reviewed" })).toEqual({
      reviewStatus: "Reviewed"
    });
    for (const extra of [
      {},
      { reviewStatus: "Unreviewed" },
      { reviewStatus: "Reviewed", executable: true },
      { reviewStatus: "Reviewed", liveSupported: true },
      { reviewStatus: "Reviewed", startable: true },
      { reviewStatus: "Reviewed", typedInputs: { target: "1.2.3.4" } }
    ]) {
      expect(PromoteBasContentInputSchema.safeParse(extra).success).toBe(false);
    }

    const version = {
      basContentVersionId: "99999999-9999-4999-8999-999999999999",
      tenantId: "11111111-1111-4111-8111-111111111111",
      provider: "AtomicRedTeam",
      sourceRevision: "pin-1",
      sourcePath: "atomics/T1082/T1082.yaml",
      contentSha256: "ab".repeat(32),
      scenarioCount: 1,
      provenance: "UserSuppliedUnverified",
      executable: false,
      evidenceProduced: false,
      registeredByUserId: "22222222-2222-4222-8222-222222222222",
      createdAt: "2026-09-17T00:00:00.000Z",
      reviewStatus: "Reviewed",
      reviewedByUserId: "22222222-2222-4222-8222-222222222222",
      reviewedAt: "2026-09-17T01:00:00.000Z"
    };
    expect(BasContentVersionSummarySchema.parse(version).executable).toBe(false);
    expect(BasContentVersionSummarySchema.parse(version).reviewStatus).toBe(
      "Reviewed"
    );
    expect(
      PromoteBasContentResultSchema.parse({
        created: true,
        version: {
          ...version,
          preview: {
            provider: "AtomicRedTeam",
            sourceRevision: "pin-1",
            provenance: "UserSuppliedUnverified",
            contentSha256: "ab".repeat(32),
            executable: false,
            evidenceProduced: false,
            scenarios: [
              {
                scenarioId: "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133",
                upstreamId: "486e88ea-4f56-470f-9b57-3f4d73f39133",
                name: "Hostname Discovery",
                techniqueIds: ["T1082"],
                platforms: ["linux"],
                executors: ["sh"],
                hasPrerequisites: false,
                hasCleanup: true,
                reviewStatus: "Reviewed",
                executable: false
              }
            ]
          }
        }
      })
    ).toMatchObject({
      created: true,
      version: { executable: false, reviewStatus: "Reviewed" }
    });
    expect(
      PromoteBasContentResultSchema.safeParse({
        created: true,
        version: { ...version, executable: true }
      }).success
    ).toBe(false);
  });
});
