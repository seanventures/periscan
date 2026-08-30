import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  listModuleManifests,
  type ModuleManifest
} from "../packages/modules/src/index.ts";
import { listOpenSourceToolDefinitions } from "../packages/modules/src/toolchain.ts";
import type { OpenSourceToolDefinition } from "../packages/shared/src/open-source.ts";

type LicenseDisposition = "Allowed" | "RequiresLegalReview" | "Blocked";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  license?: unknown;
  name?: string;
  optionalDependencies?: Record<string, string>;
  private?: boolean;
  version?: string;
}

export interface LicensePolicyInput {
  license: string | null;
  name: string;
  policyStatus?: OpenSourceToolDefinition["policyStatus"];
  source: "node" | "tool" | "module";
}

export interface LicensePolicyResult extends LicensePolicyInput {
  disposition: LicenseDisposition;
  reason: string;
}

export interface NodeDependencyLicenseEntry {
  dependents: string[];
  license: string;
  name: string;
  version: string;
}

export interface LicenseInventory {
  generatedAt: string;
  moduleManifests: ModuleManifest[];
  nodeDependencies: NodeDependencyLicenseEntry[];
  tools: OpenSourceToolDefinition[];
}

const ROOT_MANIFEST_PATHS = ["package.json", "apps", "packages"] as const;
const NOTICE_PATH = "licenses/THIRD_PARTY_NOTICES.md";
const WORKSPACE_SPEC_PREFIXES = ["workspace:", "file:", "link:"];
const BLOCKED_LICENSE_PATTERNS = [
  /agpl/i,
  /sspl/i,
  /commons\s+clause/i,
  /polyform/i,
  /business\s+source/i,
  /\bbsl\b/i,
  /\bbusl\b/i
] as const;
const REVIEW_LICENSE_PATTERNS = [/(^|[^a])gpl/i, /lgpl/i] as const;
/** Not pure-permissive: Allowed only with explicit redistribution notice obligations. */
const OBLIGATION_LICENSE_PATTERNS = [/\bnpsl\b/i, /nmap\s+public\s+source/i] as const;

function normalizeLicense(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (value && typeof value === "object" && "type" in value) {
    const type = (value as { type?: unknown }).type;

    if (typeof type === "string" && type.trim().length > 0) {
      return type.trim();
    }
  }

  return null;
}

function isWorkspaceDependency(spec: string, packageName: string) {
  return (
    packageName.startsWith("@periscan/") ||
    WORKSPACE_SPEC_PREFIXES.some((prefix) => spec.startsWith(prefix))
  );
}

function normalizePackageJsonLicense(value: unknown) {
  return normalizeLicense(value) ?? "UNKNOWN";
}

function splitSimpleOrLicenseExpression(license: string) {
  if (!/\s+OR\s+/iu.test(license) || /\s+AND\s+/iu.test(license)) {
    return [];
  }

  return license
    .split(/\s+OR\s+/iu)
    .map((part) => part.replace(/[()]/gu, "").trim())
    .filter((part) => part.length > 0);
}

/**
 * Named exception (founder-approved 2026-08-22, Hybrid resolution of the
 * SETTLED PERISCAN-523 vs OPEN_SOURCE_POLICY AGPL conflict): TruffleHog
 * (AGPL-3.0) rides the same RequiresLegalReview accept->install path as
 * GPL/LGPL tools. Every other AGPL/SSPL/BSL/Commons Clause/PolyForm entry
 * stays Blocked with no legal-review path.
 */
function isNamedAgplReviewEntry(input: LicensePolicyInput, license: string) {
  return (
    /agpl/iu.test(license) &&
    input.policyStatus === "RequiresLegalReview" &&
    (input.name === "trufflehog" || input.name.startsWith("trufflehog."))
  );
}

function evaluateSimpleLicensePolicy(
  input: LicensePolicyInput,
  license: string
): Pick<LicensePolicyResult, "disposition" | "reason"> {
  if (
    !isNamedAgplReviewEntry(input, license) &&
    BLOCKED_LICENSE_PATTERNS.some((pattern) => pattern.test(license))
  ) {
    return {
      disposition: "Blocked",
      reason: `${license} is Blocked and never installable — replace the dependency. This is not a legal-review path.`
    };
  }

  if (REVIEW_LICENSE_PATTERNS.some((pattern) => pattern.test(license))) {
    if (input.policyStatus === "RequiresLegalReview") {
      return {
        disposition: "RequiresLegalReview",
        reason:
          "Non-permissive license is present but the tool is blocked behind legal review and excluded from default execution."
      };
    }

    return {
      disposition: "Blocked",
      reason: `${license} requires legal review before enabled product use.`
    };
  }

  if (OBLIGATION_LICENSE_PATTERNS.some((pattern) => pattern.test(license))) {
    return {
      disposition: "Allowed",
      reason:
        `${license} is allowed only with redistribution notice obligations ` +
        `(licenses/THIRD_PARTY_NOTICES.md and runner-agent/image docs). Not pure-permissive.`
    };
  }

  return {
    disposition: "Allowed",
    reason: "License is compatible with current Periscan OSS policy."
  };
}

export function evaluateLicensePolicy(
  input: LicensePolicyInput
): LicensePolicyResult {
  const license = input.license?.trim() || null;

  if (!license || /unknown/i.test(license)) {
    return {
      ...input,
      disposition: "Blocked",
      reason: "License metadata is missing or unknown."
    };
  }

  if (/^unlicensed$/i.test(license)) {
    return {
      ...input,
      disposition: "Blocked",
      reason: "Unlicensed third-party material cannot be used in Periscan."
    };
  }

  const orAlternatives = splitSimpleOrLicenseExpression(license);

  if (orAlternatives.length > 1) {
    const evaluatedAlternatives = orAlternatives.map((alternative) => ({
      alternative,
      ...evaluateSimpleLicensePolicy(input, alternative)
    }));
    const allowedAlternative = evaluatedAlternatives.find(
      (alternative) => alternative.disposition === "Allowed"
    );

    if (allowedAlternative) {
      return {
        ...input,
        disposition: "Allowed",
        reason: `License expression includes compatible selectable alternative ${allowedAlternative.alternative}.`
      };
    }

    const reviewAlternative = evaluatedAlternatives.find(
      (alternative) => alternative.disposition === "RequiresLegalReview"
    );

    if (reviewAlternative) {
      return {
        ...input,
        disposition: "RequiresLegalReview",
        reason: `License expression has no allowed alternative; ${reviewAlternative.reason}`
      };
    }

    return {
      ...input,
      disposition: "Blocked",
      reason: `${license} has no compatible selectable license alternative.`
    };
  }

  return {
    ...input,
    ...evaluateSimpleLicensePolicy(input, license)
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function readJsonFile<T>(pathname: string): Promise<T> {
  return JSON.parse(await readFile(pathname, "utf8")) as T;
}

async function pathExists(pathname: string) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function findPackageJsonFiles(rootDir: string) {
  const packageJsonPaths = new Set<string>();

  for (const root of ROOT_MANIFEST_PATHS) {
    const fullPath = path.join(rootDir, root);

    if (root.endsWith("package.json")) {
      if (await pathExists(fullPath)) {
        packageJsonPaths.add(fullPath);
      }
      continue;
    }

    if (!(await pathExists(fullPath))) {
      continue;
    }

    const entries = await readdir(fullPath, {
      withFileTypes: true
    });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = path.join(fullPath, entry.name, "package.json");

      if (await pathExists(candidate)) {
        packageJsonPaths.add(candidate);
      }
    }
  }

  return [...packageJsonPaths].sort((left, right) => left.localeCompare(right));
}

async function loadDependencyPackageJson(
  rootDir: string,
  packageDir: string,
  dependencyName: string
) {
  const candidates = [
    path.join(packageDir, "node_modules", dependencyName, "package.json"),
    path.join(rootDir, "node_modules", dependencyName, "package.json")
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return readJsonFile<PackageJson>(candidate);
    }
  }

  return null;
}

function collectDependencySpecs(manifest: PackageJson) {
  return {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies
  };
}

async function collectNodeDependencyLicenses(rootDir: string) {
  const dependencyEntries = new Map<
    string,
    {
      dependents: string[];
      license: string;
      name: string;
      version: string;
    }
  >();
  const packageJsonPaths = await findPackageJsonFiles(rootDir);

  for (const packageJsonPath of packageJsonPaths) {
    const manifest = await readJsonFile<PackageJson>(packageJsonPath);
    const packageDir = path.dirname(packageJsonPath);
    const dependent = manifest.name ?? path.relative(rootDir, packageDir);

    for (const [dependencyName, spec] of Object.entries(
      collectDependencySpecs(manifest)
    )) {
      if (isWorkspaceDependency(spec, dependencyName)) {
        continue;
      }

      const dependencyManifest = await loadDependencyPackageJson(
        rootDir,
        packageDir,
        dependencyName
      );
      const key = dependencyName;
      const existing = dependencyEntries.get(key);
      const license = dependencyManifest
        ? normalizePackageJsonLicense(dependencyManifest.license)
        : "UNKNOWN";
      const version = dependencyManifest?.version ?? spec;

      dependencyEntries.set(key, {
        dependents: uniqueSorted([...(existing?.dependents ?? []), dependent]),
        license: existing?.license ?? license,
        name: dependencyName,
        version: existing?.version ?? version
      });
    }
  }

  return [...dependencyEntries.values()].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export async function buildLicenseInventory(
  rootDir = process.cwd()
): Promise<LicenseInventory> {
  return {
    generatedAt: new Date().toISOString(),
    moduleManifests: listModuleManifests(),
    nodeDependencies: await collectNodeDependencyLicenses(rootDir),
    tools: listOpenSourceToolDefinitions({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    })
  };
}

function isReviewFamilyLicense(license: string) {
  return REVIEW_LICENSE_PATTERNS.some((pattern) => pattern.test(license));
}

export function resolveModuleLicensePolicyStatus(
  manifest: Pick<ModuleManifest, "license" | "toolIds">,
  tools: OpenSourceToolDefinition[]
): OpenSourceToolDefinition["policyStatus"] | undefined {
  const linkedTools = tools.filter((tool) =>
    manifest.toolIds.includes(tool.toolId)
  );

  if (linkedTools.length === 0) {
    return undefined;
  }

  const reviewTools = linkedTools.filter(
    (tool) =>
      isReviewFamilyLicense(tool.license) ||
      tool.policyStatus === "RequiresLegalReview"
  );
  const moduleNeedsReview =
    isReviewFamilyLicense(manifest.license) || reviewTools.length > 0;

  if (!moduleNeedsReview && reviewTools.length === 0) {
    return undefined;
  }

  const scoped = reviewTools.length > 0 ? reviewTools : linkedTools;

  if (scoped.some((tool) => tool.policyStatus === "Enabled")) {
    return "Enabled";
  }

  if (
    linkedTools.some(
      (tool) =>
        tool.policyStatus === "RequiresLegalReview" ||
        tool.policyStatus === "Deferred"
    )
  ) {
    return "RequiresLegalReview";
  }

  return undefined;
}

export interface ModuleToolLicenseMismatch {
  moduleId: string;
  moduleLicense: string;
  toolId: string;
  toolLicense: string;
}

/**
 * Dual-truth detector: tool-backed modules must declare the primary tool SPDX
 * (first toolIds entry), not Proprietary or another inventable license.
 */
export function findModuleToolLicenseMismatches(
  inventory: LicenseInventory
): ModuleToolLicenseMismatch[] {
  const toolById = new Map(
    inventory.tools.map((tool) => [tool.toolId, tool] as const)
  );
  const mismatches: ModuleToolLicenseMismatch[] = [];

  for (const manifest of inventory.moduleManifests) {
    if (manifest.toolIds.length === 0) {
      continue;
    }

    const primaryToolId = manifest.toolIds[0]!;
    const primaryTool = toolById.get(primaryToolId);
    if (!primaryTool) {
      continue;
    }

    if (manifest.license !== primaryTool.license) {
      mismatches.push({
        moduleId: manifest.moduleId,
        moduleLicense: manifest.license,
        toolId: primaryTool.toolId,
        toolLicense: primaryTool.license
      });
    }
  }

  return mismatches;
}

export function evaluateModuleLicensePolicy(
  manifest: Pick<ModuleManifest, "license" | "moduleId" | "toolIds">,
  tools: OpenSourceToolDefinition[]
): LicensePolicyResult {
  return evaluateLicensePolicy({
    license: manifest.license,
    name: manifest.moduleId,
    policyStatus: resolveModuleLicensePolicyStatus(manifest, tools),
    source: "module"
  });
}

export function evaluateInventory(inventory: LicenseInventory) {
  return [
    ...inventory.nodeDependencies.map((dependency) =>
      evaluateLicensePolicy({
        license: dependency.license,
        name: dependency.name,
        source: "node"
      })
    ),
    ...inventory.tools.map((tool) =>
      evaluateLicensePolicy({
        license: tool.license,
        name: tool.toolId,
        policyStatus: tool.policyStatus,
        source: "tool"
      })
    ),
    ...inventory.moduleManifests.map((manifest) =>
      evaluateModuleLicensePolicy(manifest, inventory.tools)
    )
  ];
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, "\\|");
}

function renderPolicySummary(results: LicensePolicyResult[]) {
  const blocked = results.filter((result) => result.disposition === "Blocked");
  const review = results.filter(
    (result) => result.disposition === "RequiresLegalReview"
  );

  return [
    `- Allowed entries: ${results.length - blocked.length - review.length}`,
    `- Legal-review blocked entries: ${review.length}`,
    `- Blocking entries: ${blocked.length}`,
    "- CI fails on blocking entries or stale notices."
  ].join("\n");
}

/**
 * Tools that may be redistributed in optional lab / Engine Lab images after
 * license acceptance. Default SaaS `runtime` stage does not ship review-gated
 * binaries; this section still documents attribution obligations.
 */
function isRedistributionCandidate(tool: OpenSourceToolDefinition) {
  return (
    tool.policyStatus === "RequiresLegalReview" ||
    tool.policyStatus === "Enabled" ||
    tool.policyStatus === "Deferred"
  );
}

export function renderThirdPartyNotices(inventory: LicenseInventory) {
  const results = evaluateInventory(inventory);
  const toolRows = inventory.tools.map((tool) =>
    [
      tool.toolId,
      tool.displayName,
      tool.defaultVersion,
      tool.license,
      tool.policyStatus,
      tool.moduleIds.join(", ")
    ].map(escapeMarkdown)
  );
  const firstPartyModules = inventory.moduleManifests.filter(
    (manifest) =>
      manifest.toolIds.length === 0 ||
      manifest.license.toLowerCase().includes("proprietary")
  );
  const thirdPartyModules = inventory.moduleManifests.filter(
    (manifest) =>
      manifest.toolIds.length > 0 &&
      !manifest.license.toLowerCase().includes("proprietary")
  );
  const moduleRow = (manifest: ModuleManifest) =>
    [
      manifest.moduleId,
      manifest.toolName,
      manifest.version,
      manifest.license,
      manifest.safetyLevel
    ].map(escapeMarkdown);
  const firstPartyRows = firstPartyModules.map(moduleRow);
  const thirdPartyRows = thirdPartyModules.map(moduleRow);
  const dependencyRows = inventory.nodeDependencies.map((dependency) =>
    [
      dependency.name,
      dependency.version,
      dependency.license,
      dependency.dependents.join(", ")
    ].map(escapeMarkdown)
  );
  const attributionRows = inventory.tools
    .filter(isRedistributionCandidate)
    .map((tool) =>
      [
        tool.displayName,
        tool.defaultVersion,
        tool.license,
        tool.docsUrl || tool.gitRepo || "—",
        tool.policyStatus === "RequiresLegalReview"
          ? "Optional lab / Engine Lab only (not default image)"
          : tool.policyStatus === "Deferred"
            ? "Deferred — not redistributed by default"
            : "May ship when Enabled in runtime allowlist"
      ].map(escapeMarkdown)
    );

  return `# Third-Party Notices

Generated by \`pnpm licenses:write\`.

Periscan product code is Apache-2.0 ([\`LICENSE\`](../LICENSE)). This file
attributes **third-party** validation engines and Node dependencies. Full
license texts live at each project's upstream repository (linked below). This
product includes software developed by the upstream projects named here.

## Policy Summary

${renderPolicySummary(results)}

## Redistributed / runtime validation engines (attribution)

This product incorporates or may optionally redistribute the following open-source
validation engines. Copyright remains with the respective upstream authors and
contributors. SPDX identifiers are authoritative; retrieve full license text from
the linked upstream project before redistribution.

| Project | Version | SPDX | Upstream | Redistribution posture |
| --- | --- | --- | --- | --- |
${attributionRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}

## Validation Toolchain (inventory)

| Tool ID | Tool | Version | License | Policy Status | Product Modules |
| --- | --- | --- | --- | --- | --- |
${toolRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}

## Third-party-backed module license metadata

Modules that wrap catalog tools must declare the **upstream SPDX** (not Proprietary).

| Module ID | Tool Name | Version | License | Safety Level |
| --- | --- | --- | --- | --- |
${thirdPartyRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}

## First-party module license metadata

Periscan-owned adapters and content with no third-party tool laundering.

| Module ID | Tool Name | Version | License | Safety Level |
| --- | --- | --- | --- | --- |
${firstPartyRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}

## Node Dependencies

| Package | Version | License | Referenced By |
| --- | --- | --- | --- |
${dependencyRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}
`;
}

function getBlockingResults(results: LicensePolicyResult[]) {
  return results.filter((result) => result.disposition === "Blocked");
}

export async function writeThirdPartyNotices(rootDir = process.cwd()) {
  const inventory = await buildLicenseInventory(rootDir);
  const content = renderThirdPartyNotices(inventory);
  const target = path.join(rootDir, NOTICE_PATH);

  await mkdir(path.dirname(target), {
    recursive: true
  });
  await writeFile(target, content, "utf8");

  return {
    content,
    inventory
  };
}

export async function checkLicenseInventory(rootDir = process.cwd()) {
  const inventory = await buildLicenseInventory(rootDir);
  const results = evaluateInventory(inventory);
  const blocking = getBlockingResults(results);
  const moduleToolLicenseMismatches =
    findModuleToolLicenseMismatches(inventory);
  const expectedNotices = renderThirdPartyNotices(inventory);
  const noticesPath = path.join(rootDir, NOTICE_PATH);
  const actualNotices = (await pathExists(noticesPath))
    ? await readFile(noticesPath, "utf8")
    : null;
  const staleNotices = actualNotices !== expectedNotices;

  return {
    blocking,
    expectedNotices,
    inventory,
    moduleToolLicenseMismatches,
    results,
    staleNotices
  };
}

async function main() {
  const command = process.argv[2] ?? "check";
  const rootDir = process.cwd();

  if (command === "write") {
    const { inventory } = await writeThirdPartyNotices(rootDir);
    console.log(
      `Wrote ${NOTICE_PATH} with ${inventory.nodeDependencies.length} Node dependencies, ${inventory.tools.length} tools, and ${inventory.moduleManifests.length} modules.`
    );
    return;
  }

  if (command !== "check") {
    throw new Error(`Unsupported license inventory command: ${command}`);
  }

  const result = await checkLicenseInventory(rootDir);

  if (result.staleNotices) {
    console.error(`Third-party notices are stale. Run: pnpm licenses:write`);
  }

  if (result.blocking.length > 0) {
    for (const item of result.blocking) {
      console.error(
        `${item.source}:${item.name} (${item.license ?? "UNKNOWN"}) blocked: ${item.reason}`
      );
    }
  }

  if (result.moduleToolLicenseMismatches.length > 0) {
    for (const mismatch of result.moduleToolLicenseMismatches) {
      console.error(
        `module:${mismatch.moduleId} license dual-truth: module declares ${mismatch.moduleLicense} but primary tool ${mismatch.toolId} is ${mismatch.toolLicense}`
      );
    }
  }

  if (
    result.staleNotices ||
    result.blocking.length > 0 ||
    result.moduleToolLicenseMismatches.length > 0
  ) {
    process.exitCode = 1;
    return;
  }

  console.log(
    `License inventory check passed for ${result.inventory.nodeDependencies.length} Node dependencies, ${result.inventory.tools.length} tools, and ${result.inventory.moduleManifests.length} modules.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
