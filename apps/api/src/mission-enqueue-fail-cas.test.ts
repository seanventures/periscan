import { describe, expect, it } from "vitest";

/**
 * Documents the enqueue-failure cleanup contract: only non-terminal rows created
 * by the current startMission may be marked Failed. A fast worker can Complete a
 * successfully enqueued sibling before Promise.all rejects.
 */
describe("mission enqueue failure CAS contract", () => {
  it("scopes Failed updates to created ids and non-terminal statuses", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.promises.readFile(
        new URL("./services/validation.ts", import.meta.url),
        "utf8"
      )
    );

    expect(source).toContain("createdJobIds");
    expect(source).toContain("createdRunIds");
    expect(source).toContain("ENQUEUE_FAILABLE_STATUSES");
    expect(source).toMatch(
      /job\.updateMany\(\{\s*where:\s*\{[\s\S]*?jobId:\s*\{\s*in:\s*createdJobIds/
    );
    expect(source).toMatch(
      /validationRun\.updateMany\(\{\s*where:\s*\{[\s\S]*?runId:\s*\{\s*in:\s*createdRunIds/
    );
    expect(source).toMatch(
      /status:\s*\{\s*in:\s*\[\.\.\.ENQUEUE_FAILABLE_STATUSES\]/
    );
    // Must not bulk-fail by missionId alone (wipes Completed siblings).
    expect(source).not.toMatch(
      /job\.updateMany\(\{\s*where:\s*\{\s*missionId:\s*mission\.missionId\s*\}/
    );
    expect(source).not.toMatch(
      /validationRun\.updateMany\(\{\s*where:\s*\{\s*missionId:\s*mission\.missionId\s*\}/
    );
  });
});
