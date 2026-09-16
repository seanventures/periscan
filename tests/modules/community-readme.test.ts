import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("Community GitHub README (PERISCAN-561)", () => {
  it("is a product landing: one-command start, Apache-2.0 slice, seanventures issues", async () => {
    const [readme, community, faq, using] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("COMMUNITY.md"),
      readRepoFile("FAQ.md"),
      readRepoFile("USING.md")
    ]);

    expect(readme).toContain(
      "Prove authorized exposures are real — and only mark them Fixed when a retest says so."
    );
    expect(readme).toContain(
      "git clone https://github.com/seanventures/periscan.git"
    );
    expect(readme).toContain("bash scripts/periscan.sh install");
    expect(readme).toContain("bash scripts/periscan.sh start");
    expect(readme).toMatch(/local clone path/i);
    expect(readme).toContain("github.com/org/repo");
    expect(readme).toContain("Apache-2.0");
    expect(readme).toContain("seanventures/periscan");
    expect(readme).toContain("docs/images/badge-not-measured.svg");
    expect(readme).toContain("[FAQ](FAQ.md)");
    expect(readme).toContain("[Using](USING.md)");
    expect(readme).toContain("[Community](COMMUNITY.md)");
    expect(readme).toContain("[Settled](docs/SETTLED.md)");

    expect(readme).not.toContain("seanheiney");
    expect(readme).not.toContain("goldeneye");
    expect(readme).not.toMatch(/we are open source now/i);
    expect(readme).not.toMatch(
      /\b95\+|Magic Quadrant|Forrester Wave progress/i
    );

    expect(community).toContain("bash scripts/periscan.sh start");
    expect(community).toContain("seanventures/periscan");
    expect(community).toMatch(/local clone path/i);
    expect(faq).toContain("seanventures/periscan");
    expect(using).toContain("bash scripts/periscan.sh install");
    expect(using).toContain("PERISCAN_API_PORT");
  });

  it("does not lead with the operator encyclopedia", async () => {
    const readme = await readRepoFile("README.md");
    const fold = readme.split("\n").slice(0, 40).join("\n");
    expect(fold).not.toContain("PRD_AUDIT_PROTOCOL.md");
    expect(fold).not.toContain("connector catalog");
    expect(fold).not.toContain("pnpm lab:dev");
    expect(fold).toContain("bash scripts/periscan.sh start");
  });
});
