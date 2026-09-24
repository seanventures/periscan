#!/usr/bin/env node
// Public source must not teach contributors to use private operator systems.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowedDetectionFiles = new Set([
  ".gitleaks.toml",
  "tests/security/gitleaks-config.test.ts",
  "scripts/public-tree-hygiene.mjs"
]);
const privatePaths = new Set([
  "app.env.tmpl",
  "compose.yaml",
  "docs/ops/PLANE.md",
  "docs/ops/PLANE_SYNC_2026-07-30.md",
  "skills/using-plane/SKILL.md"
]);
const forbidden = new RegExp(
  [
    "plane\\.local\\.sean\\.network",
    "goldeneye\\.tail",
    "PLANE_API_KEY",
    "OPS_TOKEN",
    "X-Ops-Token",
    "/root/projects/infra/plane/\\.plane-api-token"
  ].join("|"),
  "i"
);
const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8"
})
  .split("\0")
  .filter(Boolean);
const failures = [];

for (const path of tracked) {
  if (privatePaths.has(path)) {
    failures.push(`${path}: private-only path is tracked`);
    continue;
  }
  if (allowedDetectionFiles.has(path)) continue;
  if (!/\.(?:md|sh|ts|tsx|mjs|js|json|ya?ml|toml|txt)$/.test(path)) continue;
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  if (contents.includes("\0")) continue;
  contents.split(/\r?\n/).forEach((line, index) => {
    if (forbidden.test(line))
      failures.push(`${path}:${index + 1}: private operator reference`);
  });
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "Public tree hygiene passed: no private operator references in tracked source."
  );
}
