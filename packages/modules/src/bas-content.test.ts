import { describe, expect, it } from "vitest";
import {
  BAS_CONTENT_MAX_BYTES,
  BasContentPreviewSchema
} from "@periscan/shared";
import { previewBasContent } from "./bas-content.js";

const guid = "11111111-1111-4111-8111-111111111111";
const atomic = {
  attack_technique: "T1082",
  atomic_tests: [
    {
      auto_generated_guid: guid,
      name: "System information",
      supported_platforms: ["linux", "macos"],
      dependencies: [{ prereq_command: "PRIVATE_PREREQ" }],
      input_arguments: { secret: { default: "PRIVATE_DEFAULT" } },
      executor: {
        name: "sh",
        command: "PRIVATE_COMMAND",
        cleanup_command: "PRIVATE_CLEANUP"
      }
    }
  ]
};
const input = {
  provider: "AtomicRedTeam" as const,
  format: "json" as const,
  sourceRevision: "test-revision",
  content: JSON.stringify(atomic)
};

describe("BAS content preview", () => {
  it("normalizes real supplied Atomic metadata without commands, defaults or evidence", () => {
    const result = previewBasContent(input);
    expect(BasContentPreviewSchema.safeParse(result).success).toBe(true);
    expect(result.scenarios).toEqual([
      {
        scenarioId: `atomic:${guid}`,
        upstreamId: guid,
        name: "System information",
        techniqueIds: ["T1082"],
        platforms: ["linux", "macos"],
        executors: ["sh"],
        hasPrerequisites: true,
        hasCleanup: true,
        reviewStatus: "Unreviewed",
        executable: false
      }
    ]);
    expect(result).toMatchObject({
      executable: false,
      evidenceProduced: false,
      provenance: "UserSuppliedUnverified"
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    expect(previewBasContent(input).contentSha256).toBe(result.contentSha256);
    expect(
      previewBasContent({ ...input, content: input.content + " " })
        .contentSha256
    ).not.toBe(result.contentSha256);
  });

  it("reads Atomic YAML and Caldera ability YAML with combined executor keys", () => {
    expect(
      previewBasContent({
        ...input,
        format: "yaml",
        content: `
attack_technique: T1082
atomic_tests:
  - auto_generated_guid: ${guid}
    name: System information
    supported_platforms: [linux]
    executor:
      name: sh
      command: PRIVATE_COMMAND
`
      }).scenarios[0]
    ).toMatchObject({ hasCleanup: false, hasPrerequisites: false });
    const result = previewBasContent({
      ...input,
      provider: "Caldera",
      format: "yaml",
      content: `
- id: ${guid}
  name: System information
  technique:
    attack_id: T1082
    name: System Information Discovery
  platforms:
    windows:
      psh,cmd:
        command: PRIVATE_COMMAND
        cleanup: [PRIVATE_CLEANUP]
    linux:
      sh:
        command: PRIVATE_COMMAND
  requirements: [{module: PRIVATE_PREREQ}]
`
    });
    expect(result.scenarios[0]).toMatchObject({
      scenarioId: `caldera:${guid}`,
      platforms: ["linux", "windows"],
      executors: ["cmd", "psh", "sh"],
      hasPrerequisites: true,
      hasCleanup: true,
      executable: false
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  });

  it.each([
    "attack_technique: T1082\nattack_technique: T1083",
    "a: &alias [one]\nb: *alias",
    "a: !!str PRIVATE_SECRET",
    "a: !execute PRIVATE_SECRET",
    "---\na: one\n---\na: two",
    "a: [PRIVATE_SECRET",
    "a: ".repeat(40) + "PRIVATE_SECRET"
  ])(
    "rejects unsafe or ambiguous YAML without source disclosure",
    (content) => {
      expect(() =>
        previewBasContent({ ...input, format: "yaml", content })
      ).toThrow("Invalid BAS content");
      try {
        previewBasContent({ ...input, format: "yaml", content });
      } catch (error) {
        expect(String(error)).not.toContain("PRIVATE_SECRET");
      }
    }
  );

  it("rejects duplicate JSON keys, IDs (including case variants), excess content and invalid provider data", () => {
    for (const content of [
      '{"attack_technique":"T1082","attack_technique":"T1083"}',
      JSON.stringify({
        ...atomic,
        atomic_tests: [atomic.atomic_tests[0], atomic.atomic_tests[0]]
      }),
      JSON.stringify({ ...atomic, attack_technique: "T1" }),
      JSON.stringify({ ...atomic, atomic_tests: [] }),
      JSON.stringify({
        ...atomic,
        atomic_tests: Array.from({ length: 201 }, () => atomic.atomic_tests[0])
      }),
      "x".repeat(BAS_CONTENT_MAX_BYTES + 1),
      "é".repeat(BAS_CONTENT_MAX_BYTES / 2 + 1)
    ])
      expect(() => previewBasContent({ ...input, content })).toThrow(
        "Invalid BAS content"
      );
    const test = {
      ...atomic.atomic_tests[0],
      auto_generated_guid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    };
    expect(() =>
      previewBasContent({
        ...input,
        content: JSON.stringify({
          ...atomic,
          atomic_tests: [
            test,
            {
              ...test,
              auto_generated_guid: test.auto_generated_guid.toUpperCase()
            }
          ]
        })
      })
    ).toThrow();
    expect(() =>
      previewBasContent({ ...input, provider: "Caldera" })
    ).toThrow();
  });
});
