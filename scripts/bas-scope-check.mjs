#!/usr/bin/env node
// Enforce development scope across tracked guidance, checks and product copy.
import { execFileSync } from "node:child_process";
import console from "node:console";
import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rules = [
  ["BAS development positioning", /anti-scanner\/pentest\/BAS/i],
  [
    "generic offensive development restriction",
    /\b(?:do not enable|do not build|never (?:run|enable|build))\s+(?:live\s+)?(?:offensive|adversarial)\s+(?:packs|tools|capabilities)/i
  ],
  [
    "unconditional adapter restriction",
    /\b(?:Atomic|Caldera|SharpHound|Metasploit)\b[^.;]{0,110}\b(?:remain disabled|stay disabled)\b/i
  ],
  [
    "category exclusion",
    /\bnot (?:a )?(?:full[- ]|full multi-vector )BAS(?:\b|[- ])(?:\s+(?:library|platform|peer|appliance))?/i
  ],
  [
    "BAS refusal",
    /\b(?:refus\w*|walk away from|do not compete as|never)\s+(?:full[- ]|full multi-vector |scenario-library )?BAS\b/i
  ],
  [
    "tool category ban",
    /\b(?:do not build|do not enable|do not implement|never build|never enable|never include|do not file requests to enable)\b[^.;]{0,100}\b(?:Atomic|Caldera|SharpHound|Metasploit)\b/i
  ],
  [
    "permanent tool exclusion",
    /\b(?:Atomic|Caldera|SharpHound|Metasploit)\b[^.;]{0,120}\b(?:forever[-_]refuse|never default|never Community|stay catalog|stay off|never install)\b/i
  ],
  [
    "catalog exclusion",
    /catalog theater|never installable as validation|catalog only\s*[·/]\s*never install/i
  ],
  [
    "development ban in table",
    /do not build[^|]{0,80}\|[^|]{0,100}(?:BAS|Atomic|Caldera|SharpHound|Metasploit)/i
  ],
  [
    "removed authorization document",
    /(?:LIVE_OFFENSIVE_SOW|WAVE_D_INJECT_SOW_TEMPLATE)\.md/
  ],
  [
    "permanent BAS catalog state",
    /(?:Atomic[^.;]{0,80}forever_refuse|permanent floor[^.]{0,80}Atomic)/i
  ]
];

export function findBasScopeContradictions(content) {
  const findings = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    // Inspect wrapped prose/comments as well as single lines. Empty lines and
    // Markdown table rows terminate the window to avoid joining unrelated rows.
    const window = [lines[index]];
    for (
      let next = index + 1;
      next < Math.min(lines.length, index + 4);
      next += 1
    ) {
      if (!lines[next].trim() || /^\s*[|#]/.test(lines[next])) break;
      window.push(lines[next]);
    }
    const normalize = (value) =>
      value.replace(/(?:[*`]|__)/g, "").replace(/\s+/g, " ");
    const first = normalize(lines[index]);
    const joined = normalize(
      window.map((line) => line.replace(/^\s*(?:\/\/|\*)\s*/, "")).join(" ")
    );
    for (const [rule, pattern] of rules) {
      // Attribute wrapped matches to the line where the match starts.
      const match = pattern.exec(joined);
      if (match && match.index < first.length)
        findings.push({ line: index + 1, rule });
    }
  }
  return findings;
}

export function shouldScanBasScope(file) {
  // Raw QA captures, binary evidence and vendored scenario definitions are
  // historical receipts, not instructions. Keep their bytes intact.
  if (/^docs\/qa\/.*\.(?:json|html)$/.test(file)) return false;
  if (/^docs\/qa\/ux-validation/.test(file)) return false;
  if (/(?:^|\/)fixtures\//.test(file)) return false;
  if (/^scripts\/bas-scope-check(?:\.test)?\.mjs$/.test(file)) return false;
  return (
    /\.(?:md|mdc|mdx|txt|csv|ya?ml|[cm]?js|jsx|ts|tsx|sh|json)$/.test(file) ||
    file === ".env.example"
  );
}

export function checkBasScope(repoRoot = root) {
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8"
  })
    .split("\0")
    .filter((file) => file && shouldScanBasScope(file));
  return files.flatMap((file) => {
    const path = resolve(repoRoot, file);
    return existsSync(path)
      ? findBasScopeContradictions(readFileSync(path, "utf8")).map(
          (finding) => ({ file, ...finding })
        )
      : [];
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = checkBasScope();
  if (errors.length) {
    console.error(
      errors
        .map(
          ({ file, line, rule }) =>
            `${file}:${line}: ${rule}; describe qualified capability status`
        )
        .join("\n")
    );
    process.exitCode = 1;
  } else {
    console.log(
      "BAS scope check passed: tracked guidance and product copy permit qualified BAS/AEV development."
    );
  }
}
