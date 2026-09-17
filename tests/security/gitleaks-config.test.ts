import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

function readRepo(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), "utf8");
}

function allowlistBlocks(toml: string): string[] {
  return toml.split(/\[\[(?:rules\.)?allowlists\]\]/u).slice(1);
}

function pathPatternsInBlock(block: string): string[] {
  const arrayMatch = block.match(/paths\s*=\s*\[([\s\S]*?)\]/u);
  if (!arrayMatch) {
    return [];
  }

  return [...arrayMatch[1].matchAll(/'''([^']+)'''/gu)].map(
    (match) => match[1]
  );
}

describe("committed gitleaks config", () => {
  it("exists at repo root and allowlists only labeled fixtures", () => {
    const configPath = path.join(repoRoot, ".gitleaks.toml");
    expect(
      existsSync(configPath),
      "history/public-tree scrub needs a committed .gitleaks.toml"
    ).toBe(true);

    const config = readRepo(".gitleaks.toml");

    expect(config).toMatch(/useDefault\s*=\s*true/u);

    const blocks = allowlistBlocks(config);
    const allPaths = blocks.flatMap(pathPatternsInBlock);

    expect(
      allPaths.some((pattern) => pattern.includes("packages/modules/fixtures"))
    ).toBe(true);

    const labRunBlocks = blocks.filter((block) =>
      pathPatternsInBlock(block).some((pattern) =>
        pattern.includes("docs/qa/lab-runs")
      )
    );
    expect(labRunBlocks.length).toBeGreaterThan(0);
    for (const block of labRunBlocks) {
      const labPaths = pathPatternsInBlock(block).filter((pattern) =>
        pattern.includes("docs/qa/lab-runs")
      );
      for (const pattern of labPaths) {
        expect(
          pattern,
          "lab-runs allowlist must be labeled (path contains fixture)"
        ).toMatch(/fixture/i);
      }
    }

    for (const pattern of allPaths) {
      expect(pattern).not.toMatch(/HANDOFF/i);
      expect(pattern).not.toMatch(/compose\.yaml/u);
      expect(pattern).not.toMatch(/app\.env\.tmpl/u);
    }

    expect(config).toMatch(/AWS|AKIA/u);
    expect(config).toMatch(/private key/i);
    expect(config).toMatch(/PLANE_API_KEY/u);
    expect(config).toMatch(/root@goldeneye/u);
  });

  it("documents history scrub and an optional working-tree scan", () => {
    const publicTree = readRepo("docs/PUBLIC_TREE.md");
    const pkg = JSON.parse(readRepo("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(publicTree).toContain("gitleaks detect");
    expect(publicTree).toContain("--log-opts='--all'");
    expect(publicTree).toContain(".gitleaks.toml");
    expect(publicTree).toMatch(/pnpm secrets:scan|optional/i);

    expect(pkg.scripts?.["secrets:scan"]).toBe(
      "gitleaks detect --source . --no-git"
    );
  });
});
