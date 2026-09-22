import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Next turbopack transpiles `@periscan/shared` from TypeScript source
 * (`package.json` exports `./src/index.ts`, `transpilePackages`). A relative
 * `./foo.js` specifier with only `foo.ts` on disk is `Module not found` and
 * 500s `/login`, because the login layout and `app/api/v1/health/route.ts`
 * both import the fat barrel.
 *
 * Vitest remaps `.js` → `.ts`, so importing the barrel here would not catch it.
 * Later barrel exports (scenario-library, security-feed-registry) reintroduced
 * the same class after the mitre-attack.js fix; scan the barrel graph, not
 * only a flat directory listing.
 */
const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const BARREL = path.join(SRC_DIR, "index.ts");
const WEB_HEALTH_ROUTE = path.resolve(
  SRC_DIR,
  "../../../apps/web/app/api/v1/health/route.ts"
);
const WEB_LOGIN_PAGE = path.resolve(SRC_DIR, "../../../apps/web/app/login/page.tsx");

const RELATIVE_SPECIFIER_RE =
  /(?:from\s+["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)|import\s+["'](\.[^"']+)["'])/g;

function productionSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "fixtures" || entry.name === "node_modules") {
        return [];
      }
      return productionSourceFiles(fullPath);
    }
    if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".d.ts")
    ) {
      return [fullPath];
    }
    return [];
  });
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function specifiersIn(source: string): string[] {
  return [...stripComments(source).matchAll(RELATIVE_SPECIFIER_RE)].map(
    (match) => match[1] ?? match[2] ?? match[3]!
  );
}

function isInsideSrc(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return resolved === SRC_DIR || resolved.startsWith(`${SRC_DIR}${path.sep}`);
}

function nextUnresolvableJsSpecifiers(filePath: string): string[] {
  const dir = path.dirname(filePath);
  const bad: string[] = [];

  for (const specifier of specifiersIn(readFileSync(filePath, "utf8"))) {
    if (!specifier.endsWith(".js")) {
      continue;
    }

    const jsPath = path.resolve(dir, specifier);
    if (existsSync(jsPath)) {
      continue;
    }

    const tsPath = jsPath.replace(/\.js$/, ".ts");
    const tsxPath = jsPath.replace(/\.js$/, ".tsx");
    if (existsSync(tsPath) || existsSync(tsxPath)) {
      bad.push(specifier);
    }
  }

  return bad;
}

function resolveRelativeProductionTs(
  fromFile: string,
  specifier: string
): string | undefined {
  const dir = path.dirname(fromFile);
  const raw = path.resolve(dir, specifier);
  const withoutJs = specifier.endsWith(".js") ? raw.replace(/\.js$/, "") : raw;
  const candidates = [
    `${withoutJs}.ts`,
    `${withoutJs}.tsx`,
    path.join(withoutJs, "index.ts"),
    path.join(withoutJs, "index.tsx")
  ];

  for (const candidate of candidates) {
    if (!isInsideSrc(candidate)) {
      continue;
    }
    if (!existsSync(candidate)) {
      continue;
    }
    if (candidate.endsWith(".test.ts") || candidate.endsWith(".d.ts")) {
      continue;
    }
    return candidate;
  }

  return undefined;
}

function walkSharedBarrelGraph(entryFile: string): {
  files: string[];
  violations: string[];
} {
  const seen = new Set<string>();
  const stack = [path.resolve(entryFile)];
  const violations: string[] = [];

  while (stack.length > 0) {
    const filePath = stack.pop()!;
    if (seen.has(filePath)) {
      continue;
    }
    seen.add(filePath);

    const source = readFileSync(filePath, "utf8");
    for (const bad of nextUnresolvableJsSpecifiers(filePath)) {
      const label = `${path.relative(SRC_DIR, filePath)} → ${bad}`;
      if (!violations.includes(label)) {
        violations.push(label);
      }
    }
    for (const specifier of specifiersIn(source)) {
      const next = resolveRelativeProductionTs(filePath, specifier);
      if (next) {
        stack.push(next);
      }
    }
  }

  return { files: [...seen], violations: violations.sort() };
}

function violationLabels(filePath: string): string[] {
  return nextUnresolvableJsSpecifiers(filePath).map(
    (specifier) => `${path.relative(SRC_DIR, filePath)} → ${specifier}`
  );
}

describe("login/health shared barrel graph", () => {
  it("health and login web files import the shared package", () => {
    expect(readFileSync(WEB_HEALTH_ROUTE, "utf8")).toContain(
      'from "@periscan/shared"'
    );
    expect(existsSync(WEB_LOGIN_PAGE)).toBe(true);
  });

  it("keeps the ATT&CK coverage overlay on the shared barrel", () => {
    const barrel = readFileSync(BARREL, "utf8");
    expect(barrel).toMatch(/export \* from ["']\.\/attack-technique-coverage["']/);
    expect(barrel).toMatch(/export \* from ["']\.\/mitre-attack["']/);
    expect(
      existsSync(path.join(SRC_DIR, "attack-technique-coverage.ts"))
    ).toBe(true);
    expect(existsSync(path.join(SRC_DIR, "mitre-attack.ts"))).toBe(true);
  });

  it("keeps the BAS campaign and scenario-library overlays on the shared barrel", () => {
    const barrel = readFileSync(BARREL, "utf8");
    expect(barrel).toMatch(/export \* from ["']\.\/bas-campaign["']/);
    expect(barrel).toMatch(/export \* from ["']\.\/scenario-library["']/);
    expect(barrel).toMatch(/export \* from ["']\.\/bas-content["']/);
    expect(existsSync(path.join(SRC_DIR, "bas-campaign.ts"))).toBe(true);
    expect(existsSync(path.join(SRC_DIR, "scenario-library.ts"))).toBe(true);
  });

  it("walks every relative import the login/health barrel pulls with Next-resolvable specifiers", () => {
    const { files, violations } = walkSharedBarrelGraph(BARREL);
    const names = files.map((filePath) => path.basename(filePath));

    expect(names).toContain("index.ts");
    expect(names).toContain("scenario-library.ts");
    expect(names).toContain("bas-campaign.ts");
    expect(names).toContain("attack-technique-coverage.ts");
    expect(names).toContain("mitre-attack.ts");
    expect(violations).toEqual([]);
  });

  it("does not use .js specifiers Next turbopack cannot resolve from TypeScript source", () => {
    const violations = productionSourceFiles(SRC_DIR).flatMap(violationLabels);

    expect(violations).toEqual([]);
  });
});
