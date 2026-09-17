#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEVERITY = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4
};

const GHSA_ID = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/iu;

/**
 * Scoped high/critical GHSA allowlist. Keys are GHSA ids; values must cite
 * PERISCAN-580 and why a bump is impossible. Unlisted criticals still fail.
 * Empty: PERISCAN-580 closed by bumping next / nodemailer / sharp.
 */
export const ALLOWED_GHSA = Object.freeze({
  // none — PERISCAN-580 closed by bumping next / nodemailer / sharp
});

export function parseArguments(argv) {
  const auditLevelIndex = argv.indexOf("--audit-level");
  const auditLevel =
    auditLevelIndex >= 0 ? argv[auditLevelIndex + 1] : "low";
  if (!(auditLevel in SEVERITY)) {
    throw new Error(`Unsupported audit level: ${auditLevel}`);
  }
  return { auditLevel, productionOnly: argv.includes("--prod") };
}

export function advisoryGhsaId(advisory) {
  if (
    typeof advisory?.github_advisory_id === "string" &&
    advisory.github_advisory_id.trim()
  ) {
    return advisory.github_advisory_id.trim().toUpperCase();
  }
  const fromUrl = String(advisory?.url ?? "").match(GHSA_ID);
  return fromUrl ? fromUrl[0].toUpperCase() : null;
}

export function selectBlockingFindings(
  findings,
  auditLevel,
  allowedGhsa = ALLOWED_GHSA
) {
  const allowed = new Set(
    Object.keys(allowedGhsa).map((id) => id.toUpperCase())
  );
  return findings.filter(({ advisory }) => {
    if ((SEVERITY[advisory.severity] ?? -1) < SEVERITY[auditLevel]) {
      return false;
    }
    const ghsa = advisoryGhsaId(advisory);
    return !(ghsa && allowed.has(ghsa));
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function workspaceRoots(root) {
  const roots = [root];
  for (const directory of ["apps", "packages"]) {
    const parent = join(root, directory);
    if (!existsSync(parent)) continue;
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(parent, entry.name, "package.json"))) {
        roots.push(join(parent, entry.name));
      }
    }
  }
  return roots;
}

function dependencyNames(packageJson, includeDevelopment) {
  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...(includeDevelopment ? Object.keys(packageJson.devDependencies ?? {}) : [])
  ]);
}

function resolveInstalledPackage(fromDirectory, dependencyName) {
  const packageJsonPath = [
    join(fromDirectory, "node_modules", dependencyName, "package.json"),
    join(dirname(fromDirectory), dependencyName, "package.json")
  ].find((candidate) => existsSync(candidate));
  if (!packageJsonPath) return null;
  const resolvedPackageJsonPath = realpathSync(packageJsonPath);
  return {
    directory: dirname(resolvedPackageJsonPath),
    packageJson: readJson(resolvedPackageJsonPath)
  };
}

function collectInstalledVersions(root, productionOnly) {
  const versionsByName = new Map();
  const visited = new Set();
  const queue = [];

  for (const workspaceRoot of workspaceRoots(root)) {
    const manifest = readJson(join(workspaceRoot, "package.json"));
    for (const dependencyName of dependencyNames(manifest, !productionOnly)) {
      queue.push({ dependencyName, fromDirectory: workspaceRoot });
    }
  }

  while (queue.length > 0) {
    const next = queue.pop();
    const installed = resolveInstalledPackage(
      next.fromDirectory,
      next.dependencyName
    );
    if (!installed) continue;

    const key = `${installed.packageJson.name}@${installed.packageJson.version}:${installed.directory}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (
      typeof installed.packageJson.name === "string" &&
      typeof installed.packageJson.version === "string"
    ) {
      const versions =
        versionsByName.get(installed.packageJson.name) ?? new Set();
      versions.add(installed.packageJson.version);
      versionsByName.set(installed.packageJson.name, versions);
    }

    for (const dependencyName of dependencyNames(
      installed.packageJson,
      false
    )) {
      queue.push({
        dependencyName,
        fromDirectory: installed.directory
      });
    }
  }

  return Object.fromEntries(
    [...versionsByName.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, versions]) => [name, [...versions].sort()])
  );
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

async function main() {
  const { auditLevel, productionOnly } = parseArguments(process.argv.slice(2));
  const root = resolve(import.meta.dirname, "..");
  const versionsByName = collectInstalledVersions(root, productionOnly);
  const registry = (
    process.env.PERISCAN_AUDIT_REGISTRY ?? "https://registry.npmjs.org"
  ).replace(/\/$/u, "");
  const response = await fetch(
    `${registry}/-/npm/v1/security/advisories/bulk`,
    {
      body: JSON.stringify(versionsByName),
      headers: {
        "content-type": "application/json",
        "user-agent": "periscan-dependency-audit/1"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Bulk advisory endpoint returned ${response.status}: ${await response.text()}`
    );
  }

  const advisoriesByPackage = await response.json();
  const findings = Object.entries(advisoriesByPackage).flatMap(
    ([packageName, advisories]) =>
      Array.isArray(advisories)
        ? advisories.map((advisory) => ({ advisory, packageName }))
        : []
  );
  const blocking = selectBlockingFindings(findings, auditLevel);

  for (const { advisory, packageName } of findings.sort(
    (left, right) =>
      SEVERITY[right.advisory.severity] - SEVERITY[left.advisory.severity]
  )) {
    console.log(
      `${advisory.severity.toUpperCase()} ${packageName}@${versionsByName[packageName]?.join(",")} — ${advisory.title}`
    );
    console.log(`  ${advisory.url}`);
  }

  console.log(
    `Dependency audit checked ${Object.keys(versionsByName).length} installed package names (${productionOnly ? "production" : "all"}); ${findings.length} advisories, ${blocking.length} at or above ${auditLevel}.`
  );

  if (blocking.length > 0) {
    process.exit(1);
  }
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
