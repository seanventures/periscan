import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
  checkBasScope,
  findBasScopeContradictions,
  shouldScanBasScope
} from "./bas-scope-check.mjs";

test("detects wrapped and emphasized development exclusions", () => {
  for (const text of [
    "Periscan is **not** a full\nBAS platform.",
    "// Do not build\n// Caldera adapters.",
    "Do **not** enable SharpHound.",
    "Do not enable live offensive packs.",
    "The anti-scanner/pentest/BAS positioning must stay.",
    "CI must never run live offensive tools.",
    "Atomic and Caldera live execution remain disabled.",
    "Live Atomic, Caldera and\nSharpHound stay off.",
    'Atomic: "forever_refuse"',
    "See docs/legal/LIVE_OFFENSIVE_SOW.md.",
    "Refuse full-BAS library RFPs.",
    "| Do not build | Full BAS library |"
  ])
    assert.ok(findBasScopeContradictions(text).length > 0, text);
});

test("permits runtime eligibility, truthful readiness and measured-claim gates", () => {
  for (const text of [
    "Full BAS and AEV are explicit product objectives.",
    "Atomic execution requires a qualified adapter. Denied tasks never queue.",
    "The current release imports Caldera plans; live operations require qualification.",
    "Do not claim shipped BAS parity without measured receipts.",
    "Customer-data destruction and credential theft remain excluded.",
    "claimClass: qualification_required",
    "Atomic returned atomic_live_disabled in the recorded run.",
    "Category: production-safe automated pentest + CTEM, not a BAS library.",
    "### Tenable One — Exposure / ASM (not BAS)",
    "This is the Community proof loop, not BAS."
  ])
    assert.deepEqual(findBasScopeContradictions(text), [], text);
});

test("scans historical recommendations, hidden guidance, scripts and product copy", () => {
  for (const file of [
    ".ai/handoff.md",
    ".github/ISSUE_TEMPLATE/feature.yml",
    "docs/qa/review.md",
    "docs/ops/setup.md",
    "skills/build/SKILL.md",
    "apps/api/src/policy.ts",
    "tests/modules/docs.test.ts",
    "scripts/deploy.sh",
    ".env.example"
  ])
    assert.equal(shouldScanBasScope(file), true, file);
  for (const file of [
    "docs/qa/walk.json",
    "docs/qa/receipt.html",
    "packages/modules/src/fixtures/atomic/T1082.yaml",
    "docs/qa/screenshot.png",
    "docs/qa/ux-validation-2026-09-18-public/README-main.md",
    "docs/qa/ux-validation-2026-09-18-public/README-tag.md",
    "docs/qa/ux-validation-2026-09-18-inapp/public-readme-snip.txt",
    "docs/qa/ux-validation-2026-09-18-public-f34/COMMUNITY.md",
    "docs/qa/ux-validation-2026-09-18-public-f34/SECURITY.md",
    "docs/qa/ux-validation-2026-09-18-public-f34/CHANGELOG-tag-head.txt"
  ])
    assert.equal(shouldScanBasScope(file), false, file);
});

test("checks every tracked guidance file, including new filenames and removed files", () => {
  const root = mkdtempSync(join(tmpdir(), "periscan-bas-scope-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    for (const file of [
      ".ai/next.md",
      "docs/legal/new.md",
      "docs/qa/advice.md",
      "apps/web/src/new.tsx",
      "removed.md"
    ]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      writeFileSync(join(root, file), "Do not build Atomic adapters.\n");
    }
    execFileSync("git", ["add", "."], { cwd: root });
    rmSync(join(root, "removed.md"));
    const findings = checkBasScope(root);
    assert.deepEqual(findings.map((row) => row.file).sort(), [
      ".ai/next.md",
      "apps/web/src/new.tsx",
      "docs/legal/new.md",
      "docs/qa/advice.md"
    ]);
    assert.ok(findings.every((row) => row.line === 1));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
