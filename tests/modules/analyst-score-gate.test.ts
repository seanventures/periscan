import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("analyst score gate (PERISCAN-490)", () => {
  it("skips missing PUBLIC_TREE-excluded lab-runs evidence so stranger verify can pass", async () => {
    const gate = await readRepoFile("scripts/analyst-score-gate.mjs");

    expect(gate).toContain('startsWith("lab-runs/")');
    expect(gate).toMatch(/lab-runs\/[\s\S]{0,200}continue/u);
    expect(gate).toMatch(/PUBLIC_TREE/u);
    expect(gate).toMatch(/skip/i);
  });
});
