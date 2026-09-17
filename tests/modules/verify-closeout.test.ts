import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("GA verify closeout", () => {
  it("caps acceptance file workers so Prisma test pools fit postgres max_connections", async () => {
    const pkg = JSON.parse(await readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const acc = pkg.scripts["test:acceptance"];
    expect(acc).toContain("--maxWorkers=2");
    expect(acc).toContain("tests/acceptance");
    expect(acc).toContain("--testTimeout=60000");
  });

  it("prunes node_modules when probing leftover dist/.next", async () => {
    const script = await readRepoFile("scripts/clean-build-artifacts.sh");
    expect(script).toMatch(/-name node_modules/);
    expect(script).toMatch(/-prune/);
    expect(script).not.toMatch(
      /leftover=\$\(find "\$ROOT_DIR\/apps" "\$ROOT_DIR\/packages" -type d \\( -name dist -o -name \.next \\) 2>\/dev\/null \| head -1/
    );
  });

  it("runs e2e with CI=1 only on that command and refuses a live Next lock", async () => {
    const verify = await readRepoFile("scripts/verify.sh");
    expect(verify).toMatch(/CI=1 pnpm test:e2e/);
    expect(verify).toMatch(/next dev already running in this checkout/i);
    expect(verify).not.toMatch(/^export CI=1/m);
  });
});
