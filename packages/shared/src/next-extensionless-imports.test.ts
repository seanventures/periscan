import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Next transpilePackages cannot resolve `./foo.js` inside @periscan/shared.
 * Production modules (not tests) must use extensionless relative imports.
 * Login 500 on :3000 is this miss (P0-LABNEXT class).
 */
describe("Next-consumed shared production imports", () => {
  it("does not use .js specifiers in packages/shared/src/*.ts (non-test)", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const hits: string[] = [];
    const specifier = /from ["']\.\/[^"']+\.js["']/;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      const text = readFileSync(join(dir, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
      if (specifier.test(text)) hits.push(name);
    }
    expect(hits).toEqual([]);
  });
});
