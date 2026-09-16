import {
  ToolIntakeManifestRequestSchema,
  type OpenSourceToolDefinition,
  type OpenSourceToolRuntime,
  type ToolIntakeManifestRequest,
  type ToolIntakeValidationReport
} from "@periscan/shared";

import { getOpenSourceToolDefinition } from "./toolchain.js";

const INSTALLABLE_RUNTIMES = new Set<OpenSourceToolRuntime>([
  "docker",
  "git",
  "pip"
]);

const PERMISSIVE_LICENSE_PATTERNS = [
  /^(apache-?2\.0|mit|bsd-[23]-clause|isc|mpl-2\.0)$/i
];

const LEGAL_REVIEW_LICENSE_PATTERNS = [
  /^gpl/i,
  /^lgpl/i,
  /^agpl/i,
  /unknown/i,
  /proprietary/i,
  /commercial/i
];

type IntakeCheck = ToolIntakeValidationReport["checks"][number];

function normalizeToolId(toolId: string) {
  return toolId.trim().toLowerCase();
}

function runtimeSources(input: ToolIntakeManifestRequest) {
  const sources = new Set<OpenSourceToolRuntime>();

  if (input.binaryName) {
    sources.add("binary");
  }
  if (input.dockerImage) {
    sources.add("docker");
  }
  if (input.gitRepo) {
    sources.add("git");
  }
  if (input.npmPackage) {
    sources.add("npx");
  }
  if (input.pipPackage) {
    sources.add("pip");
  }

  return sources;
}

function check(
  input: Omit<IntakeCheck, "checkId" | "remediation"> & {
    checkId: string;
    remediation?: string | null;
  }
): IntakeCheck {
  return {
    ...input,
    remediation: input.remediation ?? null
  };
}

function isPermissiveLicense(license: string) {
  return PERMISSIVE_LICENSE_PATTERNS.some((pattern) => pattern.test(license));
}

function requiresLegalReview(license: string) {
  return LEGAL_REVIEW_LICENSE_PATTERNS.some((pattern) => pattern.test(license));
}

function derivePolicyStatus(input: ToolIntakeManifestRequest) {
  if (requiresLegalReview(input.license)) {
    return "RequiresLegalReview" as const;
  }

  return "Enabled" as const;
}

function deriveDecision(checks: IntakeCheck[]) {
  if (
    checks.some((item) => item.severity === "Blocked" && item.status === "Fail")
  ) {
    return "Rejected" as const;
  }

  if (checks.some((item) => item.status !== "Pass")) {
    return "RequiresChanges" as const;
  }

  return "AcceptedForCatalogReview" as const;
}

function maxSeverity(checks: IntakeCheck[]) {
  const order = ["Info", "Low", "Medium", "High", "Blocked"] as const;
  return checks.reduce<(typeof order)[number]>(
    (current, item) =>
      order.indexOf(item.severity) > order.indexOf(current)
        ? item.severity
        : current,
    "Info"
  );
}

function buildRequiredActions(
  checks: IntakeCheck[],
  decision: ToolIntakeValidationReport["decision"]
) {
  const actions = checks
    .filter((item) => item.status !== "Pass")
    .map((item) => item.remediation ?? item.message);

  if (decision === "AcceptedForCatalogReview") {
    actions.push(
      "Open a reviewed code change that adds the tool definition, module manifest, parser, fixtures, policy tests, and license notice."
    );
  }

  return [...new Set(actions)];
}

function buildModuleRequiredFiles(moduleId: string) {
  return [
    "packages/modules/src/toolchain.ts",
    "packages/modules/src/index.ts",
    `packages/modules/src/fixtures/${moduleId}.json`,
    "packages/modules/src/toolchain.test.ts",
    "packages/modules/src/index.test.ts",
    "licenses/THIRD_PARTY_NOTICES.md",
    "docs/OPEN_SOURCE_VALIDATION_ENGINES.md"
  ];
}

export function evaluateToolIntakeManifest(
  rawInput: ToolIntakeManifestRequest,
  options: {
    now?: Date;
  } = {}
): ToolIntakeValidationReport {
  const input = ToolIntakeManifestRequestSchema.parse(rawInput);
  const normalizedToolId = normalizeToolId(input.toolId);
  const duplicate: OpenSourceToolDefinition | null =
    getOpenSourceToolDefinition(normalizedToolId as never) ?? null;
  const sources = runtimeSources(input);
  const installableRuntimes = input.runtimePreference.filter(
    (runtime) => INSTALLABLE_RUNTIMES.has(runtime) && sources.has(runtime)
  );
  const unsupportedRequestedRuntimes = input.runtimePreference.filter(
    (runtime) => !sources.has(runtime)
  );
  const checks: IntakeCheck[] = [];

  checks.push(
    duplicate
      ? check({
          checkId: "unique-tool-id",
          message: `${normalizedToolId} already exists in the reviewed Periscan tool catalog.`,
          remediation:
            "Choose a new tool ID or update the existing reviewed manifest through a code review.",
          severity: "High",
          status: "Fail",
          title: "Tool ID is unique"
        })
      : check({
          checkId: "unique-tool-id",
          message: "Tool ID is not currently present in the reviewed catalog.",
          severity: "Info",
          status: "Pass",
          title: "Tool ID is unique"
        })
  );

  checks.push(
    isPermissiveLicense(input.license)
      ? check({
          checkId: "license-policy",
          message: `${input.license} is treated as a generally acceptable open-source license for intake.`,
          severity: "Info",
          status: "Pass",
          title: "License is acceptable"
        })
      : requiresLegalReview(input.license)
        ? check({
            checkId: "license-policy",
            message: `${input.license} requires legal review before enablement or runtime installation.`,
            remediation:
              "Complete license/legal review and record approval before catalog enablement.",
            severity: input.license.toLowerCase().includes("agpl")
              ? "Blocked"
              : "High",
            status: "Fail",
            title: "License requires review"
          })
        : check({
            checkId: "license-policy",
            message: `${input.license} is not recognized by the automated intake policy.`,
            remediation:
              "Map this license to the allowed/legal-review/blocked policy table before adding the tool.",
            severity: "High",
            status: "Fail",
            title: "License is unknown"
          })
  );

  checks.push(
    installableRuntimes.length
      ? check({
          checkId: "runtime-installability",
          message: `Installable reviewed runtimes are available: ${installableRuntimes.join(", ")}.`,
          severity: "Low",
          status: "Pass",
          title: "Runtime has install plan"
        })
      : check({
          checkId: "runtime-installability",
          message:
            "No installable runtime was declared with matching package/image/repository metadata.",
          remediation:
            "Provide a Docker image, Git repository, or pip package managed by a reviewed manifest. Binary-only and npx-only candidates can be checked but not installed by the platform worker.",
          severity: "High",
          status: "Fail",
          title: "Runtime has install plan"
        })
  );

  if (unsupportedRequestedRuntimes.length) {
    checks.push(
      check({
        checkId: "runtime-metadata-completeness",
        message: `Requested runtimes are missing matching metadata: ${unsupportedRequestedRuntimes.join(", ")}.`,
        remediation:
          "Add the matching binary name, Docker image, Git repository, npm package, or pip package metadata.",
        severity: "Medium",
        status: "Warn",
        title: "Runtime metadata is complete"
      })
    );
  }

  checks.push(
    input.safetyLevel === "Disallowed" ||
      input.canExfiltrateData ||
      input.destructivePotential === "High" ||
      input.canModifyTarget ||
      input.writesToTarget
      ? check({
          checkId: "safety-boundary",
          message:
            "The proposed tool crosses a current Periscan safety boundary for customer execution.",
          remediation:
            "Remove destructive, mutating, persistence, or exfiltration behavior. Keep the tool as content/import-only if safe execution is not possible.",
          severity: "Blocked",
          status: "Fail",
          title: "Safety boundary"
        })
      : check({
          checkId: "safety-boundary",
          message:
            "No destructive, mutating, persistence, or exfiltration behavior was declared.",
          severity: "Info",
          status: "Pass",
          title: "Safety boundary"
        })
  );

  const runnerCompatible =
    input.executionMode === "InternalRunner"
      ? input.runMode === "AgentLocal" || !input.runMode
      : input.runMode !== "AgentLocal";

  checks.push(
    runnerCompatible
      ? check({
          checkId: "runner-compatibility",
          message:
            input.executionMode === "InternalRunner"
              ? "Internal runner execution is compatible with outbound signed-task polling."
              : "The proposed tool does not require in-network runner execution.",
          severity: "Info",
          status: "Pass",
          title: "Runner compatibility"
        })
      : check({
          checkId: "runner-compatibility",
          message:
            "Execution mode and run mode conflict with the outbound-only runner architecture.",
          remediation:
            "Use InternalRunner with AgentLocal for customer-network execution, or keep SaaS execution as ServiceDirect/ServiceViaProxy only when explicitly supported.",
          severity: "High",
          status: "Fail",
          title: "Runner compatibility"
        })
  );

  checks.push(
    input.requiredScopes.length || input.executionMode === "ContentPack"
      ? check({
          checkId: "scope-contract",
          message:
            input.executionMode === "ContentPack"
              ? "Content/import tools do not need customer target scope."
              : `Required scope types declared: ${input.requiredScopes.join(", ")}.`,
          severity: "Info",
          status: "Pass",
          title: "Scope contract"
        })
      : check({
          checkId: "scope-contract",
          message:
            "Executable validation tools must declare at least one required scope type.",
          remediation:
            "Declare the customer-authorized scope types that must be verified before execution.",
          severity: "High",
          status: "Fail",
          title: "Scope contract"
        })
  );

  const policyStatus = derivePolicyStatus(input);
  const approvalRequired =
    input.safetyLevel === "ControlledValidation" ||
    input.safetyLevel === "BASLite" ||
    input.safetyLevel === "AdvancedAdversarial";
  const liveExecutionAllowed =
    policyStatus === "Enabled" &&
    input.safetyLevel !== "AdvancedAdversarial" &&
    checks.every(
      (item) => item.severity !== "Blocked" || item.status === "Pass"
    );
  const decision = deriveDecision(checks);
  const requiredActions = buildRequiredActions(checks, decision);
  const severity = maxSeverity(checks);

  return {
    checks,
    decision,
    duplicateOf: duplicate?.toolId ?? null,
    generatedAt: (options.now ?? new Date()).toISOString(),
    governance: {
      allowedRuntimes: input.runtimePreference,
      approvalRequired,
      defaultEnabled:
        decision === "AcceptedForCatalogReview" && liveExecutionAllowed,
      installableRuntimes,
      legalReviewRequired: policyStatus === "RequiresLegalReview",
      liveExecutionAllowed,
      policyStatus,
      reason:
        decision === "AcceptedForCatalogReview"
          ? "Candidate can proceed to reviewed catalog/module implementation."
          : `Candidate needs remediation before catalog enablement; highest severity is ${severity}.`,
      requiresInternalRunner: input.executionMode === "InternalRunner",
      runnerCompatible,
      runnerExecutionMode: input.executionMode
    },
    moduleScaffold: {
      manifestStatus: decision === "Rejected" ? "Blocked" : "ReviewRequired",
      moduleId: input.moduleId,
      requiredFiles: buildModuleRequiredFiles(input.moduleId),
      requiredTests: [
        "Schema validation test",
        "Parser fixture test",
        "Policy denial/approval test",
        "Evidence redaction test",
        "Runtime readiness test",
        "Mission/runner dispatch boundary test when executable"
      ]
    },
    normalizedToolId,
    requiredActions,
    summary:
      decision === "AcceptedForCatalogReview"
        ? `${input.displayName} passed automated intake checks and can move to reviewed Periscan catalog/module implementation.`
        : `${input.displayName} is not ready for catalog enablement until ${requiredActions.length} intake action(s) are resolved.`
  };
}
