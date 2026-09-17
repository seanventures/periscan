#!/usr/bin/env node
/**
 * Mechanical tripwire for docs/SETTLED.md TELL phrases.
 *
 * Agents must not ship MQ / Wave / 95+ / "open source now" / live Atomic /
 * Fixed-without-verify language in product surfaces.
 *
 * Default: walk the working tree under apps/ and packages/.
 * --diff: only added lines vs origin/main (or --base).
 *
 * Fail on hits in product code. Exclude docs/qa memos, tests, node_modules,
 * dist, and enforcement catalogs that must quote the forbidden phrases.
 *
 *   pnpm settled:check
 *   node scripts/settled-tripwire.mjs
 *   node scripts/settled-tripwire.mjs --diff
 *   node scripts/settled-tripwire.mjs --base origin/main
 */

import { spawnSync } from "node:child_process";
import { extname, join, relative } from "node:path";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));

const PRODUCT_ROOTS = ["apps", "packages"];
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "fixtures",
  "generated",
  "node_modules"
]);
const TEXT_EXT = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx"
]);

// Files whose job is to name the forbidden claims so they can refuse them.
const ALLOWLIST = new Set([
  "packages/shared/src/claim-deny-list.ts",
  "packages/shared/src/fix-verification.ts",
  "packages/shared/src/gtm-claim-language.ts"
]);

const DENY_CONTEXT =
  /\b(not|never|deny|denied|refuse|forbidden|do not|don't|isn['’]t|is not|≠|forbids|must be false|must remain false|STOP)\b/i;

const RULES = [
  {
    id: "magic-quadrant",
    tell: "Magic Quadrant",
    re: /Magic Quadrant/i
  },
  {
    id: "wave-progress",
    tell: "Forrester Wave progress",
    re: /Forrester Wave progress|\bWave progress\b/i
  },
  {
    id: "ninety-five-plus",
    tell: "95+ as a ship gate",
    re: /95\+|\bpath[- ]to[- ]95\b|\bwe are at 95\b|\banalyst 95\b/i
  },
  {
    id: "oss-now",
    tell: "we are open source now",
    re: /we are open source now/i
  },
  {
    id: "enable-atomic",
    tell: "enable Atomic live",
    re: /enable Atomic|\benableAtomic\b/i
  }
];

function parseArgs(argv) {
  const args = { base: "origin/main", diff: false, selfCheck: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--diff") args.diff = true;
    else if (token === "--self-check") args.selfCheck = true;
    else if (token === "--base") {
      args.base = argv[i + 1] ?? args.base;
      i += 1;
    } else if (token === "--help" || token === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function posixRel(abs) {
  return relative(ROOT, abs).split("\\").join("/");
}

function isTestPath(rel) {
  return (
    /\.(test|spec)\.[^.]+$/.test(rel) ||
    /(^|\/)__tests__(\/|$)/.test(rel) ||
    /(^|\/)tests(\/|$)/.test(rel)
  );
}

function isProductPath(rel) {
  return PRODUCT_ROOTS.some((root) => rel === root || rel.startsWith(`${root}/`));
}

function shouldScanFile(rel) {
  if (!isProductPath(rel)) return false;
  if (ALLOWLIST.has(rel)) return false;
  if (isTestPath(rel)) return false;
  if (rel.includes("/docs/qa/") || rel.startsWith("docs/qa/")) return false;
  return TEXT_EXT.has(extname(rel));
}

function isUiProductPath(rel) {
  return rel.startsWith("apps/web/") && !isTestPath(rel);
}

function matchFixedWithoutVerify(rel, line) {
  if (!isUiProductPath(rel)) return null;
  // Query-string filter or equality check is a read, not a status write.
  if (/[?&]status=Fixed\b/.test(line)) return null;
  if (/status\s*===?\s*["']Fixed["']/.test(line)) return null;
  if (/status\s*!==?\s*["']Fixed["']/.test(line)) return null;

  const write =
    /(?<![?&=])\bstatus\s*=\s*["']Fixed["']/.test(line) ||
    /\bstatus\s*=\s*Fixed\b/.test(line) ||
    /\bstatus:\s*["']Fixed["']/.test(line) ||
    /\bmarkFixed\s*\(/.test(line) ||
    /["'>]\s*Mark Fixed\s*["'<]/.test(line);
  if (!write) return null;
  if (/\b(never|do not|don't|without verify|verif)/i.test(line)) return null;
  return "status = Fixed without verify";
}

function matchLine(rel, line) {
  if (ALLOWLIST.has(rel) || isTestPath(rel) || !isProductPath(rel)) return [];
  const hits = [];
  for (const rule of RULES) {
    if (!rule.re.test(line)) continue;
    if (DENY_CONTEXT.test(line)) continue;
    hits.push(rule.tell);
  }
  const fixed = matchFixedWithoutVerify(rel, line);
  if (fixed) hits.push(fixed);
  return hits;
}

function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    const rel = posixRel(full);
    if (shouldScanFile(rel)) out.push(full);
  }
  return out;
}

function scanWorkingTree() {
  const hits = [];
  const files = [];
  for (const root of PRODUCT_ROOTS) {
    walkFiles(join(ROOT, root), files);
  }
  for (const abs of files) {
    const rel = posixRel(abs);
    const text = readFileSync(abs, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const tells = matchLine(rel, lines[i]);
      for (const tell of tells) {
        hits.push({ file: rel, line: i + 1, tell, text: lines[i].trim() });
      }
    }
  }
  return hits;
}

function scanGitDiff(base) {
  const result = spawnSync(
    "git",
    ["diff", "--unified=0", base, "--", ...PRODUCT_ROOTS],
    { cwd: ROOT, encoding: "utf8" }
  );
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "git diff failed").trim();
    throw new Error(`git diff vs ${base} failed: ${detail}`);
  }
  const hits = [];
  let rel = "";
  let newLine = 0;
  for (const raw of result.stdout.split(/\r?\n/)) {
    if (raw.startsWith("+++ b/")) {
      rel = raw.slice("+++ b/".length);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      if (shouldScanFile(rel)) {
        const text = raw.slice(1);
        for (const tell of matchLine(rel, text)) {
          hits.push({ file: rel, line: newLine, tell, text: text.trim() });
        }
      }
      newLine += 1;
      continue;
    }
    if (raw.startsWith("-") && !raw.startsWith("---")) continue;
    if (raw.startsWith("\\")) continue;
    if (raw.startsWith("diff ") || raw.startsWith("index ") || raw.startsWith("--- ")) {
      continue;
    }
    if (rel && raw.length > 0 && !raw.startsWith("+") && !raw.startsWith("-")) {
      newLine += 1;
    }
  }
  return hits;
}

function selfCheck() {
  const cases = [
    {
      rel: "apps/web/src/copy.ts",
      line: "We are Magic Quadrant ready.",
      expect: true
    },
    {
      rel: "apps/web/src/copy.ts",
      line: "This is not Magic Quadrant progress.",
      expect: false
    },
    {
      rel: "packages/shared/src/gtm-claim-language.ts",
      line: "internal scorecard is not MQ/Wave progress",
      expect: false
    },
    {
      rel: "apps/api/src/app.ts",
      line: "Forrester Wave progress this quarter",
      expect: true
    },
    {
      rel: "apps/web/src/ga.ts",
      line: "ship gate is 95+",
      expect: true
    },
    {
      rel: "apps/web/src/help.ts",
      line: "we are open source now",
      expect: true
    },
    {
      rel: "packages/modules/src/index.ts",
      line: "enable Atomic live execution",
      expect: true
    },
    {
      rel: "tests/acceptance/control-source-observe-flow.test.ts",
      line: "Does NOT enable Atomic/Caldera",
      expect: false
    },
    {
      rel: "apps/web/src/components/remediation.tsx",
      line: 'status: "Fixed"',
      expect: true
    },
    {
      rel: "apps/web/src/components/dashboard-command-center.tsx",
      line: '"/remediation?status=Fixed"',
      expect: false
    },
    {
      rel: "apps/web/src/components/executive-overview.tsx",
      line: 'if (f.status === "Fixed") {',
      expect: false
    },
    {
      rel: "apps/web/src/components/attack-paths-workbench.tsx",
      line: "mark Fixed from this ranking alone.",
      expect: false
    },
    {
      rel: "apps/web/src/components/remediation.tsx",
      line: ">Mark Fixed<",
      expect: true
    },
    {
      rel: "apps/api/src/services/remediation.ts",
      line: 'status: "Fixed"',
      expect: false
    }
  ];
  const failures = [];
  for (const item of cases) {
    const hits = matchLine(item.rel, item.line);
    const found = hits.length > 0;
    if (found !== item.expect) {
      failures.push(
        `${item.rel}: expected ${item.expect ? "hit" : "clean"} for ${JSON.stringify(item.line)}; got ${JSON.stringify(hits)}`
      );
    }
  }
  return { failures, fixtureCount: cases.length };
}

function printHelp() {
  console.log(`Settled TELL tripwire (docs/SETTLED.md)

Usage:
  pnpm settled:check
  node scripts/settled-tripwire.mjs [--diff] [--base origin/main]
  node scripts/settled-tripwire.mjs --self-check

Scans apps/ and packages/ product code (not tests, not docs/qa).
Exit 0 when clean; exit 1 on TELL hits.`);
}

function report(hits, modeLabel) {
  if (hits.length === 0) {
    console.log(
      `Settled tripwire clean (${modeLabel}): no MQ/Wave/95+/OSS-now/Atomic-live/Fixed-without-verify TELL in apps/ + packages/ product code.`
    );
    return 0;
  }
  console.error(`Settled tripwire failed (${modeLabel}): ${hits.length} TELL hit(s). STOP.`);
  for (const hit of hits) {
    console.error(`- ${hit.file}:${hit.line}  [${hit.tell}]  ${hit.text}`);
  }
  console.error(
    "Settled axioms: docs/SETTLED.md — do not ship MQ/Wave/95+ as a gate, LICENSE flip copy, live Atomic, or Fixed without verify."
  );
  return 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const { failures: selfFailures, fixtureCount } = selfCheck();
  if (selfFailures.length > 0) {
    console.error("Settled tripwire self-check failed:");
    for (const failure of selfFailures) console.error(`- ${failure}`);
    return 1;
  }
  if (args.selfCheck) {
    console.log(`Settled tripwire self-check passed (${fixtureCount} fixtures).`);
    return 0;
  }

  const hits = args.diff ? scanGitDiff(args.base) : scanWorkingTree();
  const modeLabel = args.diff ? `diff vs ${args.base}` : "working tree";
  return report(hits, modeLabel);
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
