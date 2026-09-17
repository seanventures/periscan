/**
 * Architecture test (P03-20): service producers must not call
 * missionQueue.enqueueValidationJob directly — only the PEP module may.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC_ROOT = path.dirname(fileURLToPath(import.meta.url));

/** Files allowed to call missionQueue.enqueueValidationJob / .enqueueValidationJob( */
const ALLOWED_ENQUEUE_FILES = new Set([
  "mission-queue.ts",
  "policy-enforcement-point.ts"
]);

async function listTsFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...(await listTsFiles(full)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      files.push(full);
    }
  }
  return files;
}

describe("P03-20 PEP architecture — queue producers", () => {
  it("forbids direct enqueueValidationJob outside the PEP / queue module", async () => {
    const files = await listTsFiles(SRC_ROOT);
    const violations: string[] = [];

    for (const file of files) {
      const base = path.basename(file);
      if (ALLOWED_ENQUEUE_FILES.has(base)) continue;

      const content = await readFile(file, "utf8");
      // Match direct producer calls, not type mentions or interface definitions.
      if (
        /\.enqueueValidationJob\s*\(/.test(content) ||
        /missionQueue\.enqueueValidationJob/.test(content)
      ) {
        violations.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(
      violations,
      `Direct missionQueue.enqueueValidationJob is forbidden outside PEP. Use enqueueWithExecutionPolicy. Violations:\n${violations.join("\n")}`
    ).toEqual([]);
  });

  it("requires execution entrypoint services to import the PEP module", async () => {
    const requiredImporters = [
      "services/validation.ts",
      "services/schedules.ts",
      "services/remediation.ts",
      "services/runner.ts",
      "services/control-stimuli.ts"
    ];

    for (const rel of requiredImporters) {
      const content = await readFile(path.join(SRC_ROOT, rel), "utf8");
      expect(
        content.includes("policy-enforcement-point"),
        `${rel} must import policy-enforcement-point`
      ).toBe(true);
    }
  });
});
