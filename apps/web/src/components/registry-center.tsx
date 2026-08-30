"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";

import type {
  OpenSourceCapability,
  OpenSourceToolCatalogEntry,
  OpenSourceToolId,
  ReviewThirdPartyToolCandidateRequest,
  ThirdPartyTool,
  ThirdPartyToolActivityEvent,
  ThirdPartyToolCandidate,
  ThirdPartyToolCandidateImportResponse,
  ThirdPartyToolCandidateReadiness,
  ThirdPartyToolCandidateReadinessSummary,
  ThirdPartyToolImplementationBundle,
  ThirdPartyToolImplementationWorkOrder,
  ThirdPartyToolPromotionCertification,
  ThirdPartyToolPromotionHandoff,
  ThirdPartyToolPromotionPackage,
  ThirdPartyToolRefreshDueResponse,
  ThirdPartyToolRunnerDispatchResponse,
  ThirdPartyToolRunnerEligibility,
  ThirdPartyToolUpstreamVersionCheck,
  ThirdPartyToolUpdateRecommendation,
  ToolIntakeManifestRequest,
  ToolIntakeValidationReport
} from "@periscan/shared";
import type { ModuleManifest } from "@periscan/modules";
import type {
  OperatorProfile,
  OperatorRecommendation
} from "@periscan/operators";

import {
  browserPeriscanApiClient,
  PeriscanApiClientError,
  type AuthSessionPayload
} from "../lib/periscan-api-client";
import { Button, Card, DistributionChart, buttonClassName } from "../ui";
import { StatusPanel } from "./status-panel";

// Module safety-level tones (least → most active) for the coverage chart.
const MODULE_SAFETY_LEVELS: Array<{ level: string; color: string }> = [
  { color: "var(--color-success)", level: "PassiveReadOnly" },
  { color: "var(--color-info)", level: "ActiveNonInvasive" },
  { color: "var(--color-brand)", level: "ControlledValidation" },
  { color: "var(--color-warning)", level: "BASLite" },
  { color: "var(--color-danger)", level: "AdvancedAdversarial" }
];

const TOOL_INTAKE_CATEGORIES: ToolIntakeManifestRequest["category"][] = [
  "Dependency",
  "Secrets",
  "ExternalExposure",
  "CloudPosture",
  "AIValidation",
  "ControlValidation",
  "IdentityPathing",
  "NetworkRecon",
  "WebAppScan",
  "ContentPack",
  // Mandatory 6 Pillars + emerging for marketplace "add more as they evolve"
  "ASV_EASM", // recon packs for passive+active swarm: OSINT/DNS/CT etc loaded here for EASM+CAASM+internal broad
  "AttackPath",
  "DetectionRule",
  "CloudSecurity",
  "ExposureValidation",
  "AttackPack",
  "PillarPack",
  "SSPM",
  "OTICS",
  "SupplyChain",
  "IdentityValidation"
];

const TOOL_INTAKE_EXECUTION_MODES: ToolIntakeManifestRequest["executionMode"][] =
  ["ControlPlane", "ExternalPoA", "InternalRunner", "ContentPack"];

const TOOL_INTAKE_SAFETY_LEVELS: ToolIntakeManifestRequest["safetyLevel"][] = [
  "PassiveReadOnly",
  "ActiveNonInvasive",
  "ControlledValidation",
  "BASLite",
  "AdvancedAdversarial",
  "Disallowed"
];

const TOOL_INTAKE_SCOPES: ToolIntakeManifestRequest["requiredScopes"][number][] =
  [
    "Repository",
    "Domain",
    "CloudAccount",
    "InternalNetwork",
    "AIApplicationEndpoint",
    "ControlSource"
  ];

interface IntakeFormState {
  category: ToolIntakeManifestRequest["category"];
  customerVisibleDescription: string;
  displayName: string;
  dockerImage: string;
  executionMode: ToolIntakeManifestRequest["executionMode"];
  gitRepo: string;
  license: string;
  moduleId: string;
  requiredScope: ToolIntakeManifestRequest["requiredScopes"][number];
  safetyLevel: ToolIntakeManifestRequest["safetyLevel"];
  toolId: string;
}

interface RunnerDispatchFormState {
  capabilityId: string;
  path: string;
  port: string;
  rateLimitPerMinute: string;
  runnerId: string;
  scheme: "" | "http" | "https";
  scopeId: string;
  target: string;
  timeoutSeconds: string;
  topPorts: string;
}

const DEFAULT_INTAKE_FORM: IntakeFormState = {
  category: "Dependency",
  customerVisibleDescription:
    "Safely imports dependency advisory evidence for tenant-owned repositories.",
  displayName: "Example Scanner",
  dockerImage: "ghcr.io/example/scanner",
  executionMode: "ControlPlane",
  gitRepo: "https://github.com/example/scanner.git",
  license: "Apache-2.0",
  moduleId: "example.scanner_import",
  requiredScope: "Repository",
  safetyLevel: "PassiveReadOnly",
  toolId: "example-scanner"
};

const DEFAULT_RUNNER_DISPATCH_FORM: RunnerDispatchFormState = {
  capabilityId: "",
  path: "",
  port: "",
  rateLimitPerMinute: "30",
  runnerId: "",
  scheme: "",
  scopeId: "",
  target: "",
  timeoutSeconds: "30",
  topPorts: ""
};

interface RegistryState {
  capabilities: OpenSourceCapability[];
  modules: ModuleManifest[];
  operatorProfiles: OperatorProfile[];
  operatorRecommendations: OperatorRecommendation[];
  toolCandidates: ThirdPartyToolCandidate[];
  thirdPartyTools: ThirdPartyTool[];
  tools: OpenSourceToolCatalogEntry[];
}

async function loadRegistryState(): Promise<RegistryState> {
  const [
    modules,
    tools,
    capabilities,
    thirdPartyTools,
    toolCandidates,
    operatorProfiles,
    operatorRecommendations
  ] = await Promise.all([
    browserPeriscanApiClient.listModules(),
    browserPeriscanApiClient.listOpenSourceTools({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    }),
    browserPeriscanApiClient.listOpenSourceCapabilities({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    }),
    browserPeriscanApiClient.listThirdPartyTools(),
    browserPeriscanApiClient.listThirdPartyToolCandidates(),
    browserPeriscanApiClient.listOperatorProfiles(),
    browserPeriscanApiClient.listOperatorRecommendations()
  ]);

  return {
    capabilities,
    modules,
    operatorProfiles,
    operatorRecommendations,
    toolCandidates,
    thirdPartyTools,
    tools
  };
}

// Registry-specific status vocabulary (readiness / policy status / safety
// levels) — distinct from the app-wide StatusPill vocabulary, so kept local.
function statusClass(status: string) {
  if (
    [
      "Enabled",
      "Implemented",
      "Proposed",
      "Ready",
      "ReadyForGovernance",
      "ReadyForImplementation",
      "Satisfied",
      "Passed",
      "CertifiedForUse",
      "Approved",
      "AcceptedForImplementation",
      "PromotedToCatalog",
      "UpToDate",
      "ReadyForPolicyApproval",
      "AlreadySatisfied"
    ].includes(status)
  ) {
    return "status-pill status-pill--ok";
  }

  if (
    [
      "Blocked",
      "BlockedLegalReview",
      "NotActionable",
      "RequiresLegalReview",
      "LegalReviewRequired",
      "Denied",
      "Failed",
      "Missing",
      "Rejected"
    ].includes(status)
  ) {
    return "status-pill status-pill--error";
  }

  if (
    [
      "CandidateAvailable",
      "ReadyForGovernanceAction",
      "NeedsRuntimeAction",
      "NeedsRunnerPrerequisite",
      "NeedsAction"
    ].includes(status)
  ) {
    return "status-pill status-pill--warning";
  }

  return "status-pill status-pill--pending";
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function joinOrNone(values: string[]) {
  return values.length ? values.join(", ") : "None declared";
}

function readinessLabel(value: string | null | undefined, fallback: string) {
  return value ?? fallback;
}

function optionalValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function buildToolIntakeRequest(
  form: IntakeFormState
): ToolIntakeManifestRequest {
  const runtimePreference: ToolIntakeManifestRequest["runtimePreference"] = [
    ...(optionalValue(form.dockerImage) ? (["docker"] as const) : []),
    ...(optionalValue(form.gitRepo) ? (["git"] as const) : [])
  ];

  return {
    binaryName: null,
    canExecuteCode: false,
    canExfiltrateData: false,
    canModifyTarget: false,
    category: form.category,
    customerVisibleDescription: form.customerVisibleDescription,
    dataSensitivity: "Moderate",
    defaultVersion: "latest",
    destructivePotential: "None",
    displayName: form.displayName,
    dockerImage: optionalValue(form.dockerImage),
    docsUrl: optionalValue(form.gitRepo) ?? "https://example.com/periscan-tool",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: form.executionMode,
    gitRepo: optionalValue(form.gitRepo),
    intendedUse: form.customerVisibleDescription,
    license: form.license,
    maintainer: "Periscan Security Engineering",
    moduleId: form.moduleId,
    name: `${form.displayName} Intake`,
    networkAccessRequired: false,
    npmPackage: null,
    pipPackage: null,
    proposedCapabilities: [`${form.displayName} validation`],
    requiredIntegrations: form.requiredScope === "Repository" ? ["github"] : [],
    requiredPermissions: ["read-only metadata"],
    requiredScopes:
      form.executionMode === "ContentPack" ? [] : [form.requiredScope],
    runMode:
      form.executionMode === "InternalRunner" ? "AgentLocal" : "ServiceDirect",
    runtimePreference: runtimePreference.length
      ? runtimePreference
      : ["docker"],
    safetyLevel: form.safetyLevel,
    sourceUrl: optionalValue(form.gitRepo),
    supportedMissionTypes: ["ValidationSnapshot", "ExposureValidation"],
    toolId: form.toolId,
    writesToTarget: false
  };
}

function EmptyLine(props: { children: string }) {
  return <p className="text-sm text-muted">{props.children}</p>;
}

export function RegistryCenter() {
  const [auth, setAuth] = useState<AuthSessionPayload | null>(null);
  const [registryState, setRegistryState] = useState<RegistryState | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAllModules, setShowAllModules] = useState(false);
  const [busyToolId, setBusyToolId] = useState<string | null>(null);
  const [intakeForm, setIntakeForm] =
    useState<IntakeFormState>(DEFAULT_INTAKE_FORM);
  const [intakeReport, setIntakeReport] =
    useState<ToolIntakeValidationReport | null>(null);
  const [isCandidateSubmitting, setIsCandidateSubmitting] = useState(false);
  const [candidateImportJson, setCandidateImportJson] = useState("[]");
  const [candidateImportResult, setCandidateImportResult] =
    useState<ThirdPartyToolCandidateImportResponse | null>(null);
  const [isCandidateImporting, setIsCandidateImporting] = useState(false);
  const [candidateReadinessById, setCandidateReadinessById] = useState<
    Record<string, ThirdPartyToolCandidateReadiness>
  >({});
  const [candidateReadinessSummary, setCandidateReadinessSummary] =
    useState<ThirdPartyToolCandidateReadinessSummary | null>(null);
  const [
    isCandidateReadinessSummaryLoading,
    setIsCandidateReadinessSummaryLoading
  ] = useState(false);
  const [candidateWorkOrderById, setCandidateWorkOrderById] = useState<
    Record<string, ThirdPartyToolImplementationWorkOrder>
  >({});
  const [
    implementationBundleByWorkOrderId,
    setImplementationBundleByWorkOrderId
  ] = useState<Record<string, ThirdPartyToolImplementationBundle>>({});
  const [candidatePromotionPackagesById, setCandidatePromotionPackagesById] =
    useState<Record<string, ThirdPartyToolPromotionPackage[]>>({});
  const [promotionHandoffByPackageId, setPromotionHandoffByPackageId] =
    useState<Record<string, ThirdPartyToolPromotionHandoff>>({});
  const [
    promotionCertificationByPackageId,
    setPromotionCertificationByPackageId
  ] = useState<Record<string, ThirdPartyToolPromotionCertification>>({});
  const [
    promotionCertificationHistoryByPackageId,
    setPromotionCertificationHistoryByPackageId
  ] = useState<Record<string, ThirdPartyToolPromotionCertification[]>>({});
  const [toolUpstreamCheckById, setToolUpstreamCheckById] = useState<
    Record<string, ThirdPartyToolUpstreamVersionCheck>
  >({});
  const [toolUpdateRecommendationById, setToolUpdateRecommendationById] =
    useState<Record<string, ThirdPartyToolUpdateRecommendation>>({});
  const [toolActivityById, setToolActivityById] = useState<
    Record<string, ThirdPartyToolActivityEvent[]>
  >({});
  const [toolRefreshDueResult, setToolRefreshDueResult] =
    useState<ThirdPartyToolRefreshDueResponse | null>(null);
  const [toolRunnerEligibilityById, setToolRunnerEligibilityById] = useState<
    Record<string, ThirdPartyToolRunnerEligibility>
  >({});
  // Marketplace UX state: search + filters make OSS package management feel
  // like an evolving app-store / catalog you can browse, enable, load and grow.
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [marketplaceFilter, setMarketplaceFilter] = useState<
    "all" | "enabled" | "available"
  >("all");
  const [marketplaceCategory, setMarketplaceCategory] = useState<string>("all");

  const filteredThirdPartyTools = useMemo(() => {
    if (!registryState) return [];
    const q = marketplaceSearch.trim().toLowerCase();
    let filtered = registryState.thirdPartyTools;
    if (q) {
      filtered = filtered.filter(
        (e) =>
          e.tool.tool.displayName.toLowerCase().includes(q) ||
          e.tool.tool.category.toLowerCase().includes(q) ||
          (e.tool.tool.license || "").toLowerCase().includes(q)
      );
    }
    if (marketplaceFilter === "enabled") {
      filtered = filtered.filter((e) => e.governance.enabled);
    } else if (marketplaceFilter === "available") {
      filtered = filtered.filter((e) => !e.governance.enabled);
    }
    if (marketplaceCategory !== "all") {
      filtered = filtered.filter(
        (e) => e.tool.tool.category === marketplaceCategory
      );
    }
    return filtered;
  }, [
    registryState,
    marketplaceSearch,
    marketplaceFilter,
    marketplaceCategory
  ]);
  const [toolRunnerDispatchFormById, setToolRunnerDispatchFormById] = useState<
    Record<string, RunnerDispatchFormState>
  >({});
  const [toolRunnerDispatchResultById, setToolRunnerDispatchResultById] =
    useState<Record<string, ThirdPartyToolRunnerDispatchResponse>>({});
  const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
  const [isIntakeSubmitting, setIsIntakeSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    void browserPeriscanApiClient
      .getMe()
      .then(async (nextAuth) => {
        if (!active) {
          return;
        }

        setAuth(nextAuth);

        const nextState = await loadRegistryState();

        if (active) {
          setRegistryState(nextState);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        if (error instanceof PeriscanApiClientError && error.status === 401) {
          setAuth(null);
          setIsLoading(false);
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Periscan registries."
        );
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function refreshRegistryState() {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      setRegistryState(await loadRegistryState());
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to refresh registries."
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  async function runToolAction(
    toolId: OpenSourceToolId,
    action: "check" | "install" | "enable" | "disable"
  ) {
    setBusyToolId(toolId);
    setErrorMessage(null);

    try {
      if (action === "check") {
        await browserPeriscanApiClient.checkThirdPartyTool(toolId);
      } else if (action === "install") {
        await browserPeriscanApiClient.installThirdPartyTool(toolId);
      } else if (action === "enable") {
        await browserPeriscanApiClient.enableThirdPartyTool(toolId);
      } else {
        await browserPeriscanApiClient.disableThirdPartyTool(toolId);
      }
      await refreshRegistryState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update third-party tool governance."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  // Marketplace "Load" = install the runtime then enable for use.
  // This gives the "enable/disable/load" marketplace action feel.
  async function loadTool(toolId: OpenSourceToolId) {
    setBusyToolId(toolId);
    setErrorMessage(null);
    try {
      await browserPeriscanApiClient.installThirdPartyTool(toolId);
      await browserPeriscanApiClient.enableThirdPartyTool(toolId);
      await refreshRegistryState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load (install+enable) third-party tool."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  async function checkToolUpdate(toolId: OpenSourceToolId) {
    setBusyToolId(toolId);
    setErrorMessage(null);

    try {
      const recommendation =
        await browserPeriscanApiClient.checkThirdPartyToolUpdateRecommendation(
          toolId
        );
      setToolUpdateRecommendationById((current) => ({
        ...current,
        [toolId]: recommendation
      }));
      await refreshRegistryState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to check third-party tool update recommendation."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  async function checkToolUpstreamVersion(toolId: OpenSourceToolId) {
    setBusyToolId(toolId);
    setErrorMessage(null);

    try {
      const check =
        await browserPeriscanApiClient.checkThirdPartyToolUpstreamVersion(
          toolId
        );
      setToolUpstreamCheckById((current) => ({
        ...current,
        [toolId]: check
      }));
      await refreshRegistryState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to check trusted upstream version."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  async function refreshDueThirdPartyTools() {
    setBusyToolId("refresh-due");
    setErrorMessage(null);

    try {
      const result = await browserPeriscanApiClient.refreshDueThirdPartyTools({
        maxTools: 25,
        minHoursSinceLastCheck: 24
      });
      setToolRefreshDueResult(result);
      setToolUpstreamCheckById((current) => {
        const next = { ...current };
        for (const tool of result.tools) {
          if (tool.upstreamCheck) {
            next[tool.toolId] = tool.upstreamCheck;
          }
        }
        return next;
      });
      setToolUpdateRecommendationById((current) => {
        const next = { ...current };
        for (const tool of result.tools) {
          if (tool.updateRecommendation) {
            next[tool.toolId] = tool.updateRecommendation;
          }
        }
        return next;
      });
      await refreshRegistryState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to refresh due third-party tools."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  async function loadToolActivity(toolId: OpenSourceToolId) {
    setBusyToolId(toolId);
    setErrorMessage(null);
    try {
      const activity =
        await browserPeriscanApiClient.listThirdPartyToolActivity(toolId, 10);
      setToolActivityById((previous) => ({
        ...previous,
        [toolId]: activity
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load third-party tool activity."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  async function loadToolRunnerEligibility(toolId: OpenSourceToolId) {
    setBusyToolId(toolId);
    setErrorMessage(null);
    try {
      const eligibility =
        await browserPeriscanApiClient.getThirdPartyToolRunnerEligibility(
          toolId
        );
      setToolRunnerEligibilityById((previous) => ({
        ...previous,
        [toolId]: eligibility
      }));
      const firstDispatchableCapability = eligibility.capabilities.find(
        (capability) => capability.dispatchable
      );
      if (firstDispatchableCapability) {
        setToolRunnerDispatchFormById((previous) => {
          const existing = previous[toolId] ?? DEFAULT_RUNNER_DISPATCH_FORM;

          if (existing.capabilityId) {
            return previous;
          }

          return {
            ...previous,
            [toolId]: {
              ...existing,
              capabilityId: firstDispatchableCapability.capabilityId
            }
          };
        });
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load third-party tool runner eligibility."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  function updateToolRunnerDispatchForm(
    toolId: OpenSourceToolId,
    patch: Partial<RunnerDispatchFormState>
  ) {
    setToolRunnerDispatchFormById((previous) => ({
      ...previous,
      [toolId]: {
        ...(previous[toolId] ?? DEFAULT_RUNNER_DISPATCH_FORM),
        ...patch
      }
    }));
  }

  async function dispatchToolRunnerTask(
    toolId: OpenSourceToolId,
    eligibility: ThirdPartyToolRunnerEligibility
  ) {
    const firstDispatchableCapability = eligibility.capabilities.find(
      (capability) => capability.dispatchable
    );
    const form = toolRunnerDispatchFormById[toolId] ?? {
      ...DEFAULT_RUNNER_DISPATCH_FORM,
      capabilityId: firstDispatchableCapability?.capabilityId ?? ""
    };
    const capabilityId =
      form.capabilityId || firstDispatchableCapability?.capabilityId;

    if (!capabilityId || !form.runnerId || !form.scopeId || !form.target) {
      setErrorMessage(
        "Runner dispatch requires a dispatchable capability, runner ID, scope ID, and target."
      );
      return;
    }

    setBusyToolId(toolId);
    setErrorMessage(null);

    try {
      const result =
        await browserPeriscanApiClient.dispatchThirdPartyToolRunnerTask(
          toolId,
          {
            capabilityId,
            ...(form.path.trim() ? { path: form.path.trim() } : {}),
            ...(form.port.trim()
              ? { port: Number.parseInt(form.port.trim(), 10) }
              : {}),
            rateLimitPerMinute: Number.parseInt(
              form.rateLimitPerMinute.trim() || "30",
              10
            ),
            runnerId: form.runnerId.trim(),
            ...(form.scheme ? { scheme: form.scheme } : {}),
            scopeId: form.scopeId.trim(),
            target: form.target.trim(),
            timeoutSeconds: Number.parseInt(
              form.timeoutSeconds.trim() || "30",
              10
            ),
            ...(form.topPorts.trim()
              ? { topPorts: Number.parseInt(form.topPorts.trim(), 10) }
              : {})
          }
        );

      setToolRunnerDispatchResultById((previous) => ({
        ...previous,
        [toolId]: result
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to dispatch third-party tool runner task."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  async function applyToolUpdate(
    toolId: OpenSourceToolId,
    recommendation: ThirdPartyToolUpdateRecommendation
  ) {
    setBusyToolId(toolId);
    setErrorMessage(null);

    try {
      const updated =
        await browserPeriscanApiClient.applyThirdPartyToolUpdateRecommendation(
          toolId,
          recommendation.recommendationId,
          {
            queueInstall: true,
            reason: "Applied from Registry Center reviewed-update action.",
            runtimeKind: recommendation.runtimeKind ?? undefined
          }
        );
      setToolUpdateRecommendationById((current) => ({
        ...current,
        [toolId]: updated
      }));
      await refreshRegistryState();
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to apply third-party tool update recommendation."
      );
    } finally {
      setBusyToolId(null);
    }
  }

  function updateIntakeForm<K extends keyof IntakeFormState>(
    key: K,
    value: IntakeFormState[K]
  ) {
    setIntakeForm((previous) => ({
      ...previous,
      [key]: value
    }));
  }

  async function submitToolIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsIntakeSubmitting(true);
    setErrorMessage(null);

    try {
      const report =
        await browserPeriscanApiClient.validateThirdPartyToolIntake(
          buildToolIntakeRequest(intakeForm)
        );
      setIntakeReport(report);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to validate tool intake."
      );
    } finally {
      setIsIntakeSubmitting(false);
    }
  }

  async function submitToolCandidate() {
    setIsCandidateSubmitting(true);
    setErrorMessage(null);

    try {
      const candidate =
        await browserPeriscanApiClient.submitThirdPartyToolCandidate(
          buildToolIntakeRequest(intakeForm)
        );
      setIntakeReport(candidate.validationReport);
      setRegistryState((previous) =>
        previous
          ? {
              ...previous,
              toolCandidates: [
                candidate,
                ...previous.toolCandidates.filter(
                  (existing) =>
                    existing.candidateId !== candidate.candidateId &&
                    existing.toolId !== candidate.toolId
                )
              ]
            }
          : previous
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to submit tool candidate."
      );
    } finally {
      setIsCandidateSubmitting(false);
    }
  }

  async function importToolCandidateBatch() {
    setIsCandidateImporting(true);
    setErrorMessage(null);

    try {
      const parsed = JSON.parse(candidateImportJson) as unknown;
      const parsedRecord =
        typeof parsed === "object" && parsed !== null
          ? (parsed as Record<string, unknown>)
          : null;
      const manifests = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsedRecord?.manifests)
          ? parsedRecord.manifests
          : null;

      if (!manifests) {
        throw new Error(
          "Batch import expects a JSON array of tool manifests or an object with a manifests array."
        );
      }

      const result =
        await browserPeriscanApiClient.importThirdPartyToolCandidates({
          importLabel: "Registry Center batch import",
          manifests
        });
      setCandidateImportResult(result);
      const importedCandidates = result.items
        .map((item) => item.candidate)
        .filter((candidate): candidate is ThirdPartyToolCandidate =>
          Boolean(candidate)
        );

      if (importedCandidates.length) {
        setRegistryState((previous) =>
          previous
            ? {
                ...previous,
                toolCandidates: [
                  ...importedCandidates,
                  ...previous.toolCandidates.filter(
                    (existing) =>
                      !importedCandidates.some(
                        (candidate) =>
                          candidate.candidateId === existing.candidateId ||
                          candidate.toolId === existing.toolId
                      )
                  )
                ]
              }
            : previous
        );
      }
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to import tool candidate batch."
      );
    } finally {
      setIsCandidateImporting(false);
    }
  }

  async function checkCandidateReadiness(candidateId: string) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const readiness =
        await browserPeriscanApiClient.getThirdPartyToolCandidateReadiness(
          candidateId
        );
      setCandidateReadinessById((previous) => ({
        ...previous,
        [candidateId]: readiness
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to check tool candidate readiness."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function loadCandidateReadinessSummary() {
    setIsCandidateReadinessSummaryLoading(true);
    setErrorMessage(null);

    try {
      const summary =
        await browserPeriscanApiClient.getThirdPartyToolCandidateReadinessSummary();
      setCandidateReadinessSummary(summary);
      setCandidateReadinessById((previous) => ({
        ...previous,
        ...Object.fromEntries(
          summary.items.map((item) => [
            item.candidate.candidateId,
            item.readiness
          ])
        )
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load tool candidate readiness summary."
      );
    } finally {
      setIsCandidateReadinessSummaryLoading(false);
    }
  }

  async function reviewToolCandidate(
    candidate: ThirdPartyToolCandidate,
    reviewStatus: ReviewThirdPartyToolCandidateRequest["reviewStatus"]
  ) {
    const reviewPayloadByStatus: Record<
      ReviewThirdPartyToolCandidateRequest["reviewStatus"],
      ReviewThirdPartyToolCandidateRequest
    > = {
      AcceptedForImplementation: {
        implementationOwner: "Platform Engineering",
        notes:
          "Accepted for reviewed implementation planning from Registry Center.",
        reviewStatus
      },
      NeedsChanges: {
        notes:
          "Needs catalog, module, parser, fixture, policy, or runner readiness work before implementation.",
        reviewStatus
      },
      PromotedToCatalog: {
        notes:
          "Promote only after readiness confirms catalog, module, governance, runner, and safety checks.",
        reviewStatus
      },
      Rejected: {
        notes: "Rejected from Registry Center review.",
        reviewStatus
      }
    };

    setBusyCandidateId(candidate.candidateId);
    setErrorMessage(null);

    try {
      const reviewedCandidate =
        await browserPeriscanApiClient.reviewThirdPartyToolCandidate(
          candidate.candidateId,
          reviewPayloadByStatus[reviewStatus]
        );
      setRegistryState((previous) =>
        previous
          ? {
              ...previous,
              toolCandidates: previous.toolCandidates.map((existing) =>
                existing.candidateId === reviewedCandidate.candidateId
                  ? reviewedCandidate
                  : existing
              )
            }
          : previous
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to review tool candidate."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function generateImplementationWorkOrder(candidateId: string) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const workOrder =
        await browserPeriscanApiClient.generateThirdPartyToolImplementationWorkOrder(
          candidateId
        );
      setCandidateWorkOrderById((previous) => ({
        ...previous,
        [candidateId]: workOrder
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate implementation work order."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function loadImplementationBundle(
    candidateId: string,
    workOrderId: string
  ) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const bundle =
        await browserPeriscanApiClient.getThirdPartyToolImplementationBundle(
          candidateId,
          workOrderId
        );
      setImplementationBundleByWorkOrderId((previous) => ({
        ...previous,
        [workOrderId]: bundle
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load implementation bundle."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function generatePromotionPackage(candidateId: string) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const promotionPackage =
        await browserPeriscanApiClient.generateThirdPartyToolPromotionPackage(
          candidateId
        );
      setCandidatePromotionPackagesById((previous) => {
        const existing = previous[candidateId] ?? [];
        return {
          ...previous,
          [candidateId]: [
            promotionPackage,
            ...existing.filter(
              (item) =>
                item.promotionPackageId !== promotionPackage.promotionPackageId
            )
          ]
        };
      });
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate promotion package."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function loadPromotionPackages(candidateId: string) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const promotionPackages =
        await browserPeriscanApiClient.listThirdPartyToolPromotionPackages(
          candidateId
        );
      setCandidatePromotionPackagesById((previous) => ({
        ...previous,
        [candidateId]: promotionPackages
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load promotion packages."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function loadPromotionHandoff(
    candidateId: string,
    promotionPackageId: string
  ) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const handoff =
        await browserPeriscanApiClient.getThirdPartyToolPromotionHandoff(
          candidateId,
          promotionPackageId
        );
      setPromotionHandoffByPackageId((previous) => ({
        ...previous,
        [promotionPackageId]: handoff
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load promotion governance handoff."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function loadPromotionCertification(
    candidateId: string,
    promotionPackageId: string
  ) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const certification =
        await browserPeriscanApiClient.getThirdPartyToolPromotionCertification(
          candidateId,
          promotionPackageId
        );
      setPromotionCertificationByPackageId((previous) => ({
        ...previous,
        [promotionPackageId]: certification
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load promotion certification report."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function loadPromotionCertificationHistory(
    candidateId: string,
    promotionPackageId: string
  ) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const certifications =
        await browserPeriscanApiClient.listThirdPartyToolPromotionCertifications(
          candidateId,
          promotionPackageId
        );
      setPromotionCertificationHistoryByPackageId((previous) => ({
        ...previous,
        [promotionPackageId]: certifications
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load promotion certification history."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  async function savePromotionCertificationSnapshot(
    candidateId: string,
    promotionPackageId: string
  ) {
    setBusyCandidateId(candidateId);
    setErrorMessage(null);

    try {
      const certification =
        await browserPeriscanApiClient.generateThirdPartyToolPromotionCertification(
          candidateId,
          promotionPackageId
        );
      setPromotionCertificationByPackageId((previous) => ({
        ...previous,
        [promotionPackageId]: certification
      }));
      setPromotionCertificationHistoryByPackageId((previous) => ({
        ...previous,
        [promotionPackageId]: [
          certification,
          ...(previous[promotionPackageId] ?? []).filter(
            (item) => item.certificationId !== certification.certificationId
          )
        ]
      }));
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save promotion certification snapshot."
      );
    } finally {
      setBusyCandidateId(null);
    }
  }

  const registryCounts = useMemo(() => {
    if (!registryState) {
      return {
        blockedTools: 0,
        executableModules: 0,
        implementedCapabilities: 0,
        readyTools: 0
      };
    }

    return {
      blockedTools: registryState.tools.filter(
        (entry) => entry.executionReadiness === "Blocked"
      ).length,
      executableModules: registryState.modules.filter(
        (module) => module.liveSupported || module.fixtureSupported
      ).length,
      implementedCapabilities: registryState.capabilities.filter(
        (capability) => capability.status === "Implemented"
      ).length,
      readyTools: registryState.thirdPartyTools.filter(
        (entry) =>
          entry.governance.enabled && entry.runtimeInstallation.runtimeAvailable
      ).length
    };
  }, [registryState]);

  if (isLoading) {
    return (
      <StatusPanel
        body="Periscan is reading module manifests, open-source readiness, capability metadata, and operator recommendations from the public API."
        eyebrow="Registry center"
        kind="loading"
        title="Loading registries."
      />
    );
  }

  if (!auth) {
    return (
      <StatusPanel
        actions={
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/"
          >
            Back to workspace
          </Link>
        }
        body="Registries are tenant-scoped. Authenticate from the workspace to review modules, tool readiness, and operator recommendations."
        eyebrow="Registry center"
        kind="info"
        title="Sign in to review Periscan registries."
      />
    );
  }

  if (!registryState) {
    return (
      <StatusPanel
        actions={
          <Button
            variant="secondary"
            onClick={() => startTransition(() => void refreshRegistryState())}
          >
            Retry
          </Button>
        }
        body={errorMessage ?? "Periscan registries are unavailable."}
        eyebrow="Registry center"
        kind="error"
        title="Unable to load Periscan registries."
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <Card
        elevated
        className="flex flex-wrap items-start justify-between gap-4"
      >
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand">
            Registry center
          </span>
          <h2 className="mt-1 text-xl font-semibold text-ink">
            Modules, OSS engines, and operators are API-governed.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Signed in as {auth.user.email} for {auth.tenant.name}. This page
            reads registry metadata, runtime readiness, policy status, and
            operator recommendations from /api/v1; it does not enable blocked or
            deferred capabilities.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={isRefreshing}
            onClick={() => startTransition(() => void refreshRegistryState())}
          >
            {isRefreshing ? "Refreshing..." : "Refresh registries"}
          </Button>
          <Link
            className={buttonClassName({ size: "sm", variant: "secondary" })}
            href="/api-reference"
          >
            API reference
          </Link>
        </div>
      </Card>

      {errorMessage ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-sm"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-danger">{errorMessage}</p>
          <Button
            variant="secondary"
            size="sm"
            disabled={isRefreshing}
            onClick={() => startTransition(() => void refreshRegistryState())}
          >
            {isRefreshing ? "Reloading..." : "Reload registries"}
          </Button>
          <button
            aria-label="Dismiss registry error"
            className="text-xs text-muted underline"
            onClick={() => setErrorMessage(null)}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <dl
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6"
        aria-label="Registry metrics"
      >
        {[
          { label: "Module manifests", value: registryState.modules.length },
          {
            label: "Executable modules",
            value: registryCounts.executableModules
          },
          { label: "Ready OSS tools", value: registryCounts.readyTools },
          { label: "Blocked tools", value: registryCounts.blockedTools },
          {
            label: "Implemented capabilities",
            value: registryCounts.implementedCapabilities
          },
          {
            label: "Operator recommendations",
            value: registryState.operatorRecommendations.length
          }
        ].map((metric) => (
          <div
            key={metric.label}
            className="metric flex flex-col gap-1 rounded-card border border-line bg-surface p-4"
          >
            <dt className="text-sm text-muted">{metric.label}</dt>
            <dd className="text-2xl font-semibold text-ink">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <Card
        className="flex flex-col gap-4"
        aria-labelledby="tool-intake-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h3
              id="tool-intake-heading"
              className="text-base font-semibold text-ink"
            >
              Tool onboarding intake
            </h3>
            <p className="mt-1 text-sm text-muted">
              Validate proposed OSS/security tools before adding reviewed
              catalog entries, modules, parsers, runner dispatch, or install
              jobs. This calls /api/v1/third-party-tools/intake/validate and
              never executes the proposed tool.
            </p>
          </div>
          {intakeReport ? (
            <span
              aria-label={`Tool intake decision: ${intakeReport.decision}`}
              className={statusClass(intakeReport.decision)}
              role="status"
            >
              {intakeReport.decision}
            </span>
          ) : null}
        </div>

        <form className="grid gap-3 lg:grid-cols-3" onSubmit={submitToolIntake}>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Tool ID
            <input
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="toolId"
              onChange={(event) =>
                updateIntakeForm("toolId", event.target.value)
              }
              required
              value={intakeForm.toolId}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Display name
            <input
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="displayName"
              onChange={(event) =>
                updateIntakeForm("displayName", event.target.value)
              }
              required
              value={intakeForm.displayName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Module ID
            <input
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="moduleId"
              onChange={(event) =>
                updateIntakeForm("moduleId", event.target.value)
              }
              required
              value={intakeForm.moduleId}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Category
            <select
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="category"
              onChange={(event) =>
                updateIntakeForm(
                  "category",
                  event.target.value as IntakeFormState["category"]
                )
              }
              value={intakeForm.category}
            >
              {TOOL_INTAKE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Execution plane
            <select
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="executionMode"
              onChange={(event) =>
                updateIntakeForm(
                  "executionMode",
                  event.target.value as IntakeFormState["executionMode"]
                )
              }
              value={intakeForm.executionMode}
            >
              {TOOL_INTAKE_EXECUTION_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Safety level
            <select
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="safetyLevel"
              onChange={(event) =>
                updateIntakeForm(
                  "safetyLevel",
                  event.target.value as IntakeFormState["safetyLevel"]
                )
              }
              value={intakeForm.safetyLevel}
            >
              {TOOL_INTAKE_SAFETY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Required scope
            <select
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="requiredScope"
              onChange={(event) =>
                updateIntakeForm(
                  "requiredScope",
                  event.target.value as IntakeFormState["requiredScope"]
                )
              }
              value={intakeForm.requiredScope}
            >
              {TOOL_INTAKE_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            License
            <input
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="license"
              onChange={(event) =>
                updateIntakeForm("license", event.target.value)
              }
              required
              value={intakeForm.license}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Docker image
            <input
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="dockerImage"
              onChange={(event) =>
                updateIntakeForm("dockerImage", event.target.value)
              }
              value={intakeForm.dockerImage}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink lg:col-span-2">
            Git repository
            <input
              className="rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="gitRepo"
              onChange={(event) =>
                updateIntakeForm("gitRepo", event.target.value)
              }
              value={intakeForm.gitRepo}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink lg:col-span-3">
            Intended safe use
            <textarea
              className="min-h-24 rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink"
              name="customerVisibleDescription"
              onChange={(event) =>
                updateIntakeForm(
                  "customerVisibleDescription",
                  event.target.value
                )
              }
              required
              value={intakeForm.customerVisibleDescription}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 lg:col-span-3">
            <Button type="submit" disabled={isIntakeSubmitting}>
              {isIntakeSubmitting ? "Validating..." : "Validate intake"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isCandidateSubmitting}
              onClick={submitToolCandidate}
            >
              {isCandidateSubmitting
                ? "Submitting..."
                : "Submit candidate to backlog"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIntakeForm(DEFAULT_INTAKE_FORM);
                setIntakeReport(null);
              }}
            >
              Reset example
            </Button>
          </div>
        </form>

        <section
          aria-label="Tool candidate batch import"
          className="rounded-card border border-line bg-surface-strong p-3"
        >
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-ink">
              Batch import candidate manifests
            </h4>
            <p className="text-xs text-muted">
              Paste a JSON array of tool manifests to create tenant-scoped
              review records through the API. Imports do not install, enable,
              queue, dispatch, or execute tools.
            </p>
          </div>
          <label className="mt-3 flex flex-col gap-2 text-xs font-semibold text-muted">
            Manifest JSON
            <textarea
              aria-label="Tool candidate batch manifest JSON"
              className="min-h-32 rounded-control border border-line bg-background p-3 font-mono text-xs text-ink"
              onChange={(event) => setCandidateImportJson(event.target.value)}
              placeholder='[{"toolId":"example-tool","displayName":"Example Tool", "...":"..."}]'
              value={candidateImportJson}
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              disabled={isCandidateImporting}
              onClick={() => void importToolCandidateBatch()}
              type="button"
              variant="secondary"
            >
              {isCandidateImporting ? "Importing..." : "Import candidate batch"}
            </Button>
            {candidateImportResult ? (
              <span
                aria-label={`Tool candidate batch import result: ${candidateImportResult.submittedCount} submitted, ${candidateImportResult.failedCount} failed`}
                className={
                  candidateImportResult.failedCount
                    ? "status-pill status-pill--warning"
                    : "status-pill status-pill--success"
                }
                role="status"
              >
                {candidateImportResult.submittedCount} submitted /{" "}
                {candidateImportResult.failedCount} failed
              </span>
            ) : null}
          </div>
          {candidateImportResult ? (
            <ul className="mt-3 grid gap-2 text-xs text-muted md:grid-cols-2">
              {candidateImportResult.items.slice(0, 6).map((item) => (
                <li
                  className="rounded-control border border-line bg-surface p-2"
                  key={`${item.index}-${item.toolId ?? "invalid"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {item.displayName ??
                        item.toolId ??
                        `Manifest ${item.index + 1}`}
                    </span>
                    <span className={statusClass(item.status)}>
                      {item.status}
                    </span>
                  </div>
                  {item.errors.length ? (
                    <p className="mt-1 text-warning">
                      {item.errors.join("; ")}
                    </p>
                  ) : (
                    <p className="mt-1">
                      {item.toolId} is now in the tenant review backlog.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {intakeReport ? (
          <section
            className="grid gap-3 rounded-card border border-line bg-surface-strong p-3 lg:grid-cols-3"
            aria-label="Tool intake certification report"
          >
            <div className="lg:col-span-3">
              <h4 className="text-sm font-semibold text-ink">
                Certification report
              </h4>
              <p className="mt-1 text-sm text-muted">{intakeReport.summary}</p>
            </div>
            <dl className="grid gap-2 text-xs text-muted sm:grid-cols-2 lg:col-span-1">
              <div>
                <dt className="font-semibold text-ink">Normalized tool ID</dt>
                <dd>{intakeReport.normalizedToolId}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Installable runtimes</dt>
                <dd>
                  {joinOrNone(intakeReport.governance.installableRuntimes)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Runner compatible</dt>
                <dd>{yesNo(intakeReport.governance.runnerCompatible)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-ink">Live execution</dt>
                <dd>{yesNo(intakeReport.governance.liveExecutionAllowed)}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2 lg:col-span-1">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                Checks
              </h5>
              {intakeReport.checks.map((check) => (
                <article
                  className="rounded-control border border-line bg-surface p-2"
                  key={check.checkId}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-ink">{check.title}</strong>
                    <span className={statusClass(check.status)} role="status">
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{check.message}</p>
                </article>
              ))}
            </div>
            <div className="flex flex-col gap-2 lg:col-span-1">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                Required actions
              </h5>
              {intakeReport.requiredActions.length ? (
                <ul className="flex flex-col gap-2 text-xs text-muted">
                  {intakeReport.requiredActions.map((action) => (
                    <li
                      className="rounded-control border border-line bg-surface p-2"
                      key={action}
                    >
                      {action}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No remediation actions required.</EmptyLine>
              )}
            </div>
          </section>
        ) : null}

        <section
          aria-label="Tool intake backlog"
          className="flex flex-col gap-3 rounded-card border border-line bg-surface-strong p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-ink">
                Tool intake backlog
              </h4>
              <p className="mt-1 text-xs text-muted">
                Submitted candidates are tenant-scoped review records. They do
                not become executable catalog tools until reviewed code, module
                manifests, fixtures, policy gates, and runner dispatch support
                are implemented.
              </p>
            </div>
            <span
              aria-label={`Tool intake candidate count: ${registryState.toolCandidates.length}`}
              className="status-pill status-pill--info"
              role="status"
            >
              {registryState.toolCandidates.length} candidates
            </span>
            <Button
              disabled={isCandidateReadinessSummaryLoading}
              onClick={() => void loadCandidateReadinessSummary()}
              type="button"
              variant="secondary"
            >
              {isCandidateReadinessSummaryLoading
                ? "Summarizing..."
                : "Summarize readiness"}
            </Button>
          </div>
          {candidateReadinessSummary ? (
            <section
              aria-label="Tool candidate readiness summary"
              className="grid gap-3 rounded-control border border-line bg-background/70 p-3 text-xs text-muted md:grid-cols-3"
            >
              <div>
                <h5 className="font-semibold text-ink">
                  Candidate readiness summary
                </h5>
                <p className="mt-1">
                  {candidateReadinessSummary.totalCandidates} candidate(s)
                  triaged from persisted backlog records.
                </p>
              </div>
              <dl className="grid gap-2 sm:grid-cols-3 md:col-span-2">
                <div>
                  <dt className="font-semibold text-ink">Ready</dt>
                  <dd>{candidateReadinessSummary.readyForGovernanceCount}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Needs work</dt>
                  <dd>{candidateReadinessSummary.needsImplementationCount}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink">Blocked</dt>
                  <dd>{candidateReadinessSummary.blockedCount}</dd>
                </div>
              </dl>
              <div className="md:col-span-3">
                <span
                  aria-label={`Tool candidate readiness summary: ${candidateReadinessSummary.readyForGovernanceCount} ready, ${candidateReadinessSummary.needsImplementationCount} needs implementation, ${candidateReadinessSummary.blockedCount} blocked`}
                  className={
                    candidateReadinessSummary.blockedCount
                      ? "status-pill status-pill--warning"
                      : "status-pill status-pill--info"
                  }
                  role="status"
                >
                  {candidateReadinessSummary.readyForGovernanceCount} ready /{" "}
                  {candidateReadinessSummary.needsImplementationCount} needs
                  implementation / {candidateReadinessSummary.blockedCount}{" "}
                  blocked
                </span>
                <p className="mt-2">
                  Read-only summary. No catalog entries, installs, enablement,
                  missions, runner tasks, or module executions are created.
                </p>
              </div>
              {candidateReadinessSummary.requiredActions.length ? (
                <div className="md:col-span-3">
                  <h6 className="font-semibold uppercase tracking-wide text-subtle">
                    Top required actions
                  </h6>
                  <ul className="mt-2 grid gap-2 md:grid-cols-2">
                    {candidateReadinessSummary.requiredActions
                      .slice(0, 4)
                      .map((action) => (
                        <li
                          className="rounded-control border border-line bg-surface p-2"
                          key={action}
                        >
                          {action}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
          {registryState.toolCandidates.length ? (
            <div className="grid gap-2 lg:grid-cols-2">
              {registryState.toolCandidates.slice(0, 6).map((candidate) => {
                const readiness = candidateReadinessById[candidate.candidateId];
                const workOrder = candidateWorkOrderById[candidate.candidateId];
                const implementationBundle = workOrder
                  ? implementationBundleByWorkOrderId[workOrder.workOrderId]
                  : null;
                const promotionPackages =
                  candidatePromotionPackagesById[candidate.candidateId] ?? [];
                const promotionPackage = promotionPackages[0];
                const promotionHandoff = promotionPackage
                  ? promotionHandoffByPackageId[
                      promotionPackage.promotionPackageId
                    ]
                  : null;
                const promotionCertification = promotionPackage
                  ? promotionCertificationByPackageId[
                      promotionPackage.promotionPackageId
                    ]
                  : null;
                const promotionCertificationHistory = promotionPackage
                  ? (promotionCertificationHistoryByPackageId[
                      promotionPackage.promotionPackageId
                    ] ?? [])
                  : [];

                return (
                  <article
                    aria-label={`${candidate.displayName} intake candidate`}
                    className="rounded-control border border-line bg-surface p-3"
                    key={candidate.candidateId}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-sm font-semibold text-ink">
                          {candidate.displayName}
                        </h5>
                        <p className="mt-1 text-xs text-muted">
                          {candidate.toolId} · {candidate.category}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          aria-label={`${candidate.displayName} intake status: ${candidate.status}`}
                          className={statusClass(candidate.status)}
                          role="status"
                        >
                          {candidate.status}
                        </span>
                        <span
                          aria-label={`${candidate.displayName} review status: ${candidate.reviewStatus}`}
                          className={statusClass(candidate.reviewStatus)}
                          role="status"
                        >
                          {candidate.reviewStatus}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {candidate.validationReport.summary}
                    </p>
                    <dl className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-ink">
                          Module scaffold
                        </dt>
                        <dd>
                          {candidate.validationReport.moduleScaffold.moduleId}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Updated</dt>
                        <dd>
                          {new Date(candidate.updatedAt).toLocaleDateString(
                            undefined,
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric"
                            }
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Owner</dt>
                        <dd>{candidate.implementationOwner ?? "Unassigned"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Reviewed</dt>
                        <dd>
                          {candidate.reviewedAt
                            ? new Date(candidate.reviewedAt).toLocaleDateString(
                                undefined,
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric"
                                }
                              )
                            : "Not reviewed"}
                        </dd>
                      </div>
                    </dl>
                    {candidate.reviewNotes ? (
                      <p className="mt-2 rounded-control border border-line bg-background/70 p-2 text-xs text-muted">
                        {candidate.reviewNotes}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        disabled={busyCandidateId === candidate.candidateId}
                        onClick={() =>
                          void checkCandidateReadiness(candidate.candidateId)
                        }
                        type="button"
                      >
                        {busyCandidateId === candidate.candidateId
                          ? "Checking readiness..."
                          : "Check implementation readiness"}
                      </Button>
                      <Button
                        disabled={
                          busyCandidateId === candidate.candidateId ||
                          candidate.status !== "AcceptedForCatalogReview"
                        }
                        onClick={() =>
                          void reviewToolCandidate(
                            candidate,
                            "AcceptedForImplementation"
                          )
                        }
                        type="button"
                        variant="secondary"
                      >
                        Accept for implementation
                      </Button>
                      <Button
                        disabled={busyCandidateId === candidate.candidateId}
                        onClick={() =>
                          void reviewToolCandidate(candidate, "NeedsChanges")
                        }
                        type="button"
                        variant="secondary"
                      >
                        Needs changes
                      </Button>
                      <Button
                        disabled={busyCandidateId === candidate.candidateId}
                        onClick={() =>
                          void reviewToolCandidate(candidate, "Rejected")
                        }
                        type="button"
                        variant="secondary"
                      >
                        Reject
                      </Button>
                      {readiness ? (
                        <span
                          aria-label={`${candidate.displayName} implementation readiness: ${readiness.status}`}
                          className={statusClass(readiness.status)}
                          role="status"
                        >
                          {readiness.status}
                        </span>
                      ) : null}
                      <Button
                        disabled={
                          busyCandidateId === candidate.candidateId ||
                          ![
                            "AcceptedForImplementation",
                            "PromotedToCatalog"
                          ].includes(candidate.reviewStatus)
                        }
                        onClick={() =>
                          void generateImplementationWorkOrder(
                            candidate.candidateId
                          )
                        }
                        type="button"
                        variant="secondary"
                      >
                        {busyCandidateId === candidate.candidateId
                          ? "Generating work order..."
                          : "Generate implementation work order"}
                      </Button>
                      <Button
                        disabled={
                          busyCandidateId === candidate.candidateId ||
                          candidate.reviewStatus !== "PromotedToCatalog"
                        }
                        onClick={() =>
                          void generatePromotionPackage(candidate.candidateId)
                        }
                        type="button"
                        variant="secondary"
                      >
                        {busyCandidateId === candidate.candidateId
                          ? "Generating package..."
                          : "Generate promotion package"}
                      </Button>
                      <Button
                        disabled={busyCandidateId === candidate.candidateId}
                        onClick={() =>
                          void loadPromotionPackages(candidate.candidateId)
                        }
                        type="button"
                        variant="secondary"
                      >
                        {busyCandidateId === candidate.candidateId
                          ? "Loading packages..."
                          : "Load promotion packages"}
                      </Button>
                    </div>
                    {readiness ? (
                      <div
                        aria-label={`${candidate.displayName} readiness checks`}
                        className="mt-3 rounded-control border border-line bg-background/70 p-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Implementation readiness
                        </p>
                        <ul className="mt-2 grid gap-2 text-xs text-muted">
                          {readiness.checks.map((check) => (
                            <li
                              className="rounded-control border border-line bg-surface p-2"
                              key={check.checkId}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-ink">
                                  {check.title}
                                </span>
                                <span className={statusClass(check.status)}>
                                  {check.status}
                                </span>
                              </div>
                              <p className="mt-1">{check.summary}</p>
                              {check.requiredAction ? (
                                <p className="mt-1 text-warning">
                                  {check.requiredAction}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {workOrder ? (
                      <div
                        aria-label={`${candidate.displayName} implementation work order`}
                        className="mt-3 rounded-control border border-line bg-background/70 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Implementation work order
                          </p>
                          <span
                            aria-label={`${candidate.displayName} implementation work order: ${workOrder.status}`}
                            className={statusClass(workOrder.status)}
                            role="status"
                          >
                            {workOrder.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          {workOrder.summary}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            disabled={busyCandidateId === candidate.candidateId}
                            onClick={() =>
                              void loadImplementationBundle(
                                candidate.candidateId,
                                workOrder.workOrderId
                              )
                            }
                            type="button"
                            variant="secondary"
                          >
                            {busyCandidateId === candidate.candidateId
                              ? "Loading bundle..."
                              : "Load implementation bundle"}
                          </Button>
                          {implementationBundle ? (
                            <span
                              aria-label={`${candidate.displayName} implementation bundle: ${implementationBundle.status}`}
                              className={statusClass(
                                implementationBundle.status
                              )}
                              role="status"
                            >
                              {implementationBundle.status}
                            </span>
                          ) : null}
                        </div>
                        {implementationBundle ? (
                          <div
                            aria-label={`${candidate.displayName} implementation bundle`}
                            className="mt-3 rounded-control border border-line bg-surface p-3 text-xs text-muted"
                          >
                            <p className="font-semibold uppercase tracking-wide text-muted">
                              Implementation bundle
                            </p>
                            <p className="mt-1">
                              {implementationBundle.summary}
                            </p>
                            <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                              <div>
                                <dt className="font-semibold text-ink">
                                  Files
                                </dt>
                                <dd>{implementationBundle.files.length}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Commands
                                </dt>
                                <dd>{implementationBundle.commands.length}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Executes tools
                                </dt>
                                <dd>
                                  {implementationBundle.doesNotExecute
                                    ? "No"
                                    : "Yes"}
                                </dd>
                              </div>
                            </dl>
                            <ul className="mt-2 grid gap-1 font-mono text-[11px]">
                              {implementationBundle.files
                                .slice(0, 3)
                                .map((file) => (
                                  <li
                                    key={`${file.path}-${file.contentSha256}`}
                                  >
                                    {file.path} ·{" "}
                                    {file.contentSha256.slice(0, 12)}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold text-ink">
                              Blocking tasks
                            </p>
                            <ul className="mt-2 grid gap-2 text-xs text-muted">
                              {workOrder.tasks.slice(0, 4).map((task) => (
                                <li
                                  className="rounded-control border border-line bg-surface p-2"
                                  key={task.taskId}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold text-ink">
                                      {task.title}
                                    </span>
                                    <span className={statusClass(task.status)}>
                                      {task.status}
                                    </span>
                                  </div>
                                  <p className="mt-1">{task.description}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-ink">
                              Scaffold map
                            </p>
                            <ul className="mt-2 grid gap-2 text-xs text-muted">
                              {workOrder.scaffoldFiles
                                .slice(0, 4)
                                .map((file) => (
                                  <li
                                    className="rounded-control border border-line bg-surface p-2"
                                    key={`${file.templateKind}-${file.path}`}
                                  >
                                    <span className="font-semibold text-ink">
                                      {file.templateKind}
                                    </span>
                                    <p className="mt-1 font-mono text-[11px]">
                                      {file.path}
                                    </p>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {promotionPackage ? (
                      <div
                        aria-label={`${candidate.displayName} promotion package`}
                        className="mt-3 rounded-control border border-line bg-background/70 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Promotion package
                          </p>
                          <span
                            aria-label={`${candidate.displayName} promotion package: ${promotionPackage.status}`}
                            className={statusClass(promotionPackage.status)}
                            role="status"
                          >
                            {promotionPackage.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted">
                          {promotionPackage.summary}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            disabled={busyCandidateId === candidate.candidateId}
                            onClick={() =>
                              void loadPromotionHandoff(
                                candidate.candidateId,
                                promotionPackage.promotionPackageId
                              )
                            }
                            type="button"
                            variant="secondary"
                          >
                            {busyCandidateId === candidate.candidateId
                              ? "Loading handoff..."
                              : "Load governance handoff"}
                          </Button>
                          <Button
                            disabled={busyCandidateId === candidate.candidateId}
                            onClick={() =>
                              void loadPromotionCertification(
                                candidate.candidateId,
                                promotionPackage.promotionPackageId
                              )
                            }
                            type="button"
                            variant="secondary"
                          >
                            {busyCandidateId === candidate.candidateId
                              ? "Loading certification..."
                              : "Load certification report"}
                          </Button>
                          <Button
                            disabled={busyCandidateId === candidate.candidateId}
                            onClick={() =>
                              void savePromotionCertificationSnapshot(
                                candidate.candidateId,
                                promotionPackage.promotionPackageId
                              )
                            }
                            type="button"
                            variant="secondary"
                          >
                            {busyCandidateId === candidate.candidateId
                              ? "Saving certification..."
                              : "Save certification snapshot"}
                          </Button>
                          <Button
                            disabled={busyCandidateId === candidate.candidateId}
                            onClick={() =>
                              void loadPromotionCertificationHistory(
                                candidate.candidateId,
                                promotionPackage.promotionPackageId
                              )
                            }
                            type="button"
                            variant="secondary"
                          >
                            {busyCandidateId === candidate.candidateId
                              ? "Loading history..."
                              : "Load certification history"}
                          </Button>
                          {promotionHandoff ? (
                            <span
                              aria-label={`${candidate.displayName} promotion handoff: ${promotionHandoff.status}`}
                              className={statusClass(promotionHandoff.status)}
                              role="status"
                            >
                              {promotionHandoff.status}
                            </span>
                          ) : null}
                          {promotionCertification ? (
                            <span
                              aria-label={`${candidate.displayName} promotion certification: ${promotionCertification.status}`}
                              className={statusClass(
                                promotionCertification.status
                              )}
                              role="status"
                            >
                              {promotionCertification.status}
                            </span>
                          ) : null}
                        </div>
                        {promotionPackages.length > 1 ? (
                          <p className="mt-1 text-xs text-muted">
                            Showing latest of {promotionPackages.length}{" "}
                            packages.
                          </p>
                        ) : null}
                        <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                          <div>
                            <dt className="font-semibold text-ink">Modules</dt>
                            <dd>{promotionPackage.moduleIds.length}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-ink">
                              Capabilities
                            </dt>
                            <dd>{promotionPackage.capabilityIds.length}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-ink">
                              Evidence requirements
                            </dt>
                            <dd>{promotionPackage.requiredEvidence.length}</dd>
                          </div>
                        </dl>
                        <ul className="mt-3 grid gap-2 text-xs text-muted">
                          {promotionPackage.safetyNotes
                            .slice(0, 2)
                            .map((note) => (
                              <li
                                className="rounded-control border border-line bg-surface p-2"
                                key={note}
                              >
                                {note}
                              </li>
                            ))}
                        </ul>
                        {promotionHandoff ? (
                          <div
                            aria-label={`${candidate.displayName} promotion governance handoff`}
                            className="mt-3 rounded-control border border-line bg-surface p-3"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Governance handoff
                            </p>
                            <p className="mt-2 text-xs text-muted">
                              {promotionHandoff.summary}
                            </p>
                            <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                              <div>
                                <dt className="font-semibold text-ink">
                                  Governance
                                </dt>
                                <dd>{promotionHandoff.governanceStatus}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Runtime
                                </dt>
                                <dd>{promotionHandoff.runtimeStatus}</dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Runner
                                </dt>
                                <dd>
                                  {promotionHandoff.runnerEligibility?.status ??
                                    "Not applicable"}
                                </dd>
                              </div>
                            </dl>
                            <ul className="mt-3 grid gap-2 text-xs text-muted">
                              {promotionHandoff.actions.map((action) => (
                                <li
                                  className="rounded-control border border-line bg-background/70 p-2"
                                  key={action.actionId}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold text-ink">
                                      {action.title}
                                    </span>
                                    <span
                                      className={statusClass(action.status)}
                                    >
                                      {action.status}
                                    </span>
                                  </div>
                                  <p className="mt-1">{action.summary}</p>
                                  {action.apiPath ? (
                                    <p className="mt-1 font-mono text-[11px]">
                                      {action.apiMethod} {action.apiPath}
                                    </p>
                                  ) : null}
                                  <ul className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
                                    {action.createsExecution ? (
                                      <li>Creates execution</li>
                                    ) : null}
                                    {action.policyGateRequired ? (
                                      <li>Policy gate required</li>
                                    ) : null}
                                  </ul>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {promotionCertification ? (
                          <div
                            aria-label={`${candidate.displayName} promotion certification report`}
                            className="mt-3 rounded-control border border-line bg-surface p-3"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Certification report
                            </p>
                            <p className="mt-2 text-xs text-muted">
                              {promotionCertification.summary}
                            </p>
                            <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-4">
                              <div>
                                <dt className="font-semibold text-ink">
                                  Governance
                                </dt>
                                <dd>
                                  {promotionCertification.certifiedForGovernance
                                    ? "Certified"
                                    : "Open"}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Runtime
                                </dt>
                                <dd>
                                  {promotionCertification.certifiedForRuntimeManagement
                                    ? "Managed"
                                    : "Open"}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Mission start
                                </dt>
                                <dd>
                                  {promotionCertification.certifiedForMissionStart
                                    ? "Policy-gated"
                                    : "Open"}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Side effects
                                </dt>
                                <dd>
                                  {promotionCertification.doesNotExecute
                                    ? "None"
                                    : "Creates execution"}
                                </dd>
                              </div>
                            </dl>
                            {promotionCertification.requiredActions.length ? (
                              <ul className="mt-3 grid gap-2 text-xs text-warning">
                                {promotionCertification.requiredActions
                                  .slice(0, 3)
                                  .map((action) => (
                                    <li
                                      className="rounded-control border border-line bg-background/70 p-2"
                                      key={action}
                                    >
                                      {action}
                                    </li>
                                  ))}
                              </ul>
                            ) : null}
                            <ul className="mt-3 grid gap-2 text-xs text-muted">
                              {promotionCertification.checks
                                .slice(0, 5)
                                .map((check) => (
                                  <li
                                    className="rounded-control border border-line bg-background/70 p-2"
                                    key={check.checkId}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-semibold text-ink">
                                        {check.title}
                                      </span>
                                      <span
                                        className={statusClass(check.status)}
                                      >
                                        {check.status}
                                      </span>
                                    </div>
                                    <p className="mt-1">{check.summary}</p>
                                  </li>
                                ))}
                            </ul>
                            <p className="mt-3 text-xs text-muted">
                              Read-only certification. No enablement, installs,
                              missions, runner dispatch, or module execution are
                              performed.
                            </p>
                          </div>
                        ) : null}
                        {promotionCertificationHistory.length ? (
                          <div
                            aria-label={`${candidate.displayName} promotion certification history`}
                            className="mt-3 rounded-control border border-line bg-surface p-3"
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                              Certification history
                            </p>
                            <ul className="mt-3 grid gap-2 text-xs text-muted">
                              {promotionCertificationHistory
                                .slice(0, 5)
                                .map((certification) => (
                                  <li
                                    className="rounded-control border border-line bg-background/70 p-2"
                                    key={certification.certificationId}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-semibold text-ink">
                                        {certification.status}
                                      </span>
                                      <span
                                        className={statusClass(
                                          certification.status
                                        )}
                                      >
                                        {certification.createdAt ??
                                          certification.generatedAt}
                                      </span>
                                    </div>
                                    <p className="mt-1">
                                      {certification.summary}
                                    </p>
                                    <p className="mt-1 text-[11px]">
                                      Generated by{" "}
                                      {certification.generatedBy ?? "system"} ·
                                      No installs, missions, runner dispatch, or
                                      module execution.
                                    </p>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyLine>No third-party tool candidates submitted yet.</EmptyLine>
          )}
        </section>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          className="flex flex-col gap-3"
          aria-labelledby="registry-modules"
        >
          <div className="flex items-center justify-between gap-4">
            <h3
              id="registry-modules"
              className="text-base font-semibold text-ink"
            >
              Module registry
            </h3>
            <span
              aria-label={`Module manifest count: ${registryState.modules.length}`}
              className="status-pill status-pill--ok"
              role="status"
            >
              {registryState.modules.length} manifests
            </span>
          </div>
          {(() => {
            const safetyDistribution = MODULE_SAFETY_LEVELS.map(
              ({ color, level }) => ({
                color,
                id: level,
                label: level,
                value: registryState.modules.filter(
                  (module) => module.safetyLevel === level
                ).length
              })
            ).filter((datum) => datum.value > 0);
            return safetyDistribution.length ? (
              <DistributionChart
                title="Modules by safety level"
                ariaLabel="Validation modules by safety level"
                data={safetyDistribution}
                variant="bar"
              />
            ) : null;
          })()}
          {registryState.modules.length ? (
            <div className="flex flex-col gap-2">
              {(showAllModules
                ? registryState.modules
                : registryState.modules.slice(0, 8)
              ).map((module) => (
                <article
                  className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
                  key={module.moduleId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-ink">{module.name}</strong>
                    <span
                      aria-label={`${module.name} safety level: ${module.safetyLevel}`}
                      className={statusClass(module.safetyLevel)}
                      role="status"
                    >
                      {module.safetyLevel}
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {module.customerVisibleDescription}
                  </p>
                  <ul className="flex flex-wrap gap-2 text-xs text-muted">
                    <li>Status: {module.status}</li>
                    <li>{module.executionMode}</li>
                    <li>License risk: {module.licenseRisk}</li>
                    <li>
                      Network:{" "}
                      {module.networkAccessRequired
                        ? "Required"
                        : "Not required"}
                    </li>
                    <li>
                      Destructive potential: {module.destructivePotential}
                    </li>
                    <li>Data sensitivity: {module.dataSensitivity}</li>
                    {module.fixtureSupported ? (
                      <li>Fixture supported</li>
                    ) : null}
                    {module.liveSupported ? <li>Live supported</li> : null}
                    {module.approvalRequired ? (
                      <li>Approval required</li>
                    ) : null}
                  </ul>
                  <dl
                    aria-label={`${module.name} safety metadata`}
                    className="grid gap-2 rounded-control border border-line bg-surface-strong p-2 text-xs text-muted sm:grid-cols-2"
                    role="group"
                  >
                    <div>
                      <dt className="font-semibold text-ink">Target writes</dt>
                      <dd>{yesNo(module.writesToTarget)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">
                        Target modification
                      </dt>
                      <dd>{yesNo(module.canModifyTarget)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Code execution</dt>
                      <dd>{yesNo(module.canExecuteCode)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">
                        Data exfiltration
                      </dt>
                      <dd>{yesNo(module.canExfiltrateData)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Tool version</dt>
                      <dd>{module.toolVersion ?? "Not pinned"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Runtime image</dt>
                      <dd>{module.containerImage ?? "No container image"}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Maintainer</dt>
                      <dd>{module.maintainer}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">
                        Redaction rules
                      </dt>
                      <dd>{joinOrNone(module.redactionRules)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
              {registryState.modules.length > 8 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAllModules((previous) => !previous)}
                  aria-expanded={showAllModules}
                >
                  {showAllModules
                    ? "Show fewer modules"
                    : `Show all ${registryState.modules.length} modules`}
                </Button>
              ) : null}
            </div>
          ) : (
            <EmptyLine>No module manifests are registered.</EmptyLine>
          )}
        </Card>

        <Card className="flex flex-col gap-3" aria-labelledby="registry-tools">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3
                  id="registry-tools"
                  className="text-base font-semibold text-ink"
                >
                  OSS Package Marketplace
                </h3>
                <p className="text-xs text-muted">
                  Browse, enable, load &amp; evolve open source packages (incl.
                  AttackPack / PillarPack for ATT&amp;CK-mapped, safety-gated
                  validation — AEV/CTEM proof, not full multi-vector BAS). Add
                  more as the catalog grows.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busyToolId === "refresh-due"}
                  onClick={() =>
                    startTransition(() => void refreshDueThirdPartyTools())
                  }
                >
                  {busyToolId === "refresh-due"
                    ? "Refreshing..."
                    : "Refresh due tools"}
                </Button>
                <span
                  aria-label={`Third-party tool count: ${registryState.thirdPartyTools.length}`}
                  className="status-pill status-pill--pending"
                  role="status"
                >
                  {registryState.thirdPartyTools.length} packages
                </span>
              </div>
            </div>

            {/* Marketplace controls: search + filters = app-store feel */}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
              <input
                type="search"
                placeholder="Search packages (name, category, license)..."
                className="min-w-[220px] flex-1 rounded-control border border-line bg-canvas px-3 py-1.5 text-sm text-ink placeholder:text-muted"
                value={marketplaceSearch}
                onChange={(e) => setMarketplaceSearch(e.target.value)}
                aria-label="Search OSS marketplace packages"
              />
              <div
                className="flex gap-1"
                role="group"
                aria-label="Marketplace filter"
              >
                {(["all", "enabled", "available"] as const).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant={marketplaceFilter === f ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setMarketplaceFilter(f)}
                  >
                    {f === "all"
                      ? "All"
                      : f === "enabled"
                        ? "Enabled"
                        : "Available"}
                  </Button>
                ))}
              </div>
              <select
                className="rounded-control border border-line bg-canvas px-2 py-1 text-sm text-ink"
                value={marketplaceCategory}
                onChange={(e) => setMarketplaceCategory(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {Array.from(
                  new Set(
                    registryState.thirdPartyTools.map(
                      (t) => t.tool.tool.category
                    )
                  )
                )
                  .sort()
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMarketplaceSearch("");
                  setMarketplaceFilter("all");
                  setMarketplaceCategory("all");
                }}
              >
                Reset
              </Button>
            </div>
          </div>
          {toolRefreshDueResult ? (
            <div
              aria-label="Third-party tool due refresh summary"
              className="rounded-control border border-line bg-canvas p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-ink">Due refresh summary</strong>
                <span className="status-pill status-pill--pending">
                  {toolRefreshDueResult.checkedCount} checked ·{" "}
                  {toolRefreshDueResult.skippedCount} skipped ·{" "}
                  {toolRefreshDueResult.failedCount} failed
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Generated {toolRefreshDueResult.generatedAt}; max{" "}
                {toolRefreshDueResult.maxTools} tools; refresh window{" "}
                {toolRefreshDueResult.minHoursSinceLastCheck}h.
              </p>
              <ol className="mt-2 grid gap-2 md:grid-cols-2">
                {toolRefreshDueResult.tools.slice(0, 6).map((tool) => (
                  <li
                    className="rounded-control border border-line bg-surface p-2"
                    key={`${tool.toolId}:${tool.status}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">
                        {tool.displayName}
                      </span>
                      <span className={statusClass(tool.status)}>
                        {tool.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{tool.reason}</p>
                    {tool.requiredActions.length ? (
                      <p className="mt-1 text-xs text-muted">
                        Next: {tool.requiredActions[0]}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* Filtered marketplace grid for app-store browse/enable/disable/load UX */}
          {filteredThirdPartyTools.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredThirdPartyTools.map((entry) => {
                const toolId = entry.tool.tool.toolId;
                const isBusy = busyToolId === toolId;
                const upstreamCheck = toolUpstreamCheckById[toolId];
                const updateRecommendation =
                  toolUpdateRecommendationById[toolId];
                const toolActivity = toolActivityById[toolId] ?? [];
                const runnerEligibility = toolRunnerEligibilityById[toolId];
                const dispatchableCapabilities =
                  runnerEligibility?.capabilities.filter(
                    (capability) => capability.dispatchable
                  ) ?? [];
                const runnerDispatchForm = toolRunnerDispatchFormById[
                  toolId
                ] ?? {
                  ...DEFAULT_RUNNER_DISPATCH_FORM,
                  capabilityId: dispatchableCapabilities[0]?.capabilityId ?? ""
                };
                const runnerDispatchResult =
                  toolRunnerDispatchResultById[toolId];
                const canEnable =
                  entry.governance.status !== "LegalReviewRequired" &&
                  entry.governance.status !== "Blocked";

                return (
                  <article
                    className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3 shadow-sm hover:border-brand/40 transition-colors"
                    key={toolId}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-ink">
                        {entry.tool.tool.displayName}
                      </strong>
                      <span
                        aria-label={`${entry.tool.tool.displayName} governance status: ${entry.governance.status}`}
                        className={statusClass(entry.governance.status)}
                        role="status"
                      >
                        {entry.governance.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {entry.tool.tool.category} ·{" "}
                      {entry.runtimeInstallation.installStatus} ·{" "}
                      {entry.runtimeInstallation.runtimeReason}
                    </p>
                    <ul className="flex flex-wrap gap-2 text-xs text-muted">
                      <li>{entry.tool.tool.license}</li>
                      <li>Pinned {entry.governance.pinnedVersion}</li>
                      <li>{entry.tool.tool.phase}</li>
                      <li>{entry.governance.source}</li>
                      <li>
                        Runtime:{" "}
                        {entry.runtimeInstallation.runtimeKind ??
                          "not selected"}
                      </li>
                      <li>
                        {entry.tool.capabilityCounts.implemented} implemented
                      </li>
                      <li>{entry.tool.capabilityCounts.blocked} blocked</li>
                    </ul>
                    <dl
                      aria-label={`${entry.tool.tool.displayName} governance metadata`}
                      className="grid gap-2 rounded-control border border-line bg-surface-strong p-2 text-xs text-muted sm:grid-cols-2"
                      role="group"
                    >
                      <div>
                        <dt className="font-semibold text-ink">
                          Allowed runtimes
                        </dt>
                        <dd>{joinOrNone(entry.governance.allowedRuntimes)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Last checked</dt>
                        <dd>
                          {entry.runtimeInstallation.lastCheckedAt ??
                            "Not checked"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Legal status</dt>
                        <dd>{entry.governance.legalReviewStatus}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-ink">Recent jobs</dt>
                        <dd>
                          {entry.recentJobs.length
                            ? entry.recentJobs
                                .slice(0, 2)
                                .map((job) => `${job.action}:${job.status}`)
                                .join(", ")
                            : "No jobs"}
                        </dd>
                      </div>
                    </dl>
                    {upstreamCheck ? (
                      <div className="rounded-control border border-line bg-canvas p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-ink">
                            Trusted upstream check
                          </strong>
                          <span className={statusClass(upstreamCheck.status)}>
                            {upstreamCheck.status}
                          </span>
                        </div>
                        <p className="mt-2 text-muted">
                          {upstreamCheck.reason}
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                          <li>Catalog {upstreamCheck.catalogVersion}</li>
                          <li>
                            Upstream{" "}
                            {upstreamCheck.discoveredVersion ?? "not available"}
                          </li>
                          <li>Source {upstreamCheck.sourceKind}</li>
                        </ul>
                        {upstreamCheck.requiredActions.length ? (
                          <p className="mt-2 text-xs text-muted">
                            Review gate: {upstreamCheck.requiredActions[0]}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {updateRecommendation ? (
                      <div className="rounded-control border border-line bg-canvas p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-ink">
                            Reviewed update recommendation
                          </strong>
                          <span
                            className={statusClass(updateRecommendation.status)}
                          >
                            {updateRecommendation.status}
                          </span>
                        </div>
                        <p className="mt-2 text-muted">
                          {updateRecommendation.reason}
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                          <li>
                            Current pin{" "}
                            {updateRecommendation.currentPinnedVersion}
                          </li>
                          <li>
                            Reviewed {updateRecommendation.reviewedVersion}
                          </li>
                          <li>
                            Runtime{" "}
                            {updateRecommendation.runtimeKind ?? "not selected"}
                          </li>
                        </ul>
                        {updateRecommendation.requiredActions.length ? (
                          <p className="mt-2 text-xs text-muted">
                            Next: {updateRecommendation.requiredActions[0]}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {toolActivity.length ? (
                      <div className="rounded-control border border-line bg-canvas p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-ink">Tool activity</strong>
                          <span className="text-xs text-muted">
                            {toolActivity.length} recent events
                          </span>
                        </div>
                        <ol className="mt-2 flex flex-col gap-2">
                          {toolActivity.slice(0, 5).map((activity) => (
                            <li
                              className="rounded-control border border-line bg-surface p-2"
                              key={activity.activityId}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-ink">
                                  {activity.title}
                                </span>
                                <span className={statusClass(activity.status)}>
                                  {activity.status}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted">
                                {activity.source} · {activity.category} ·{" "}
                                {activity.occurredAt}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                {activity.summary}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {runnerEligibility ? (
                      <div
                        aria-label={`${entry.tool.tool.displayName} runner eligibility`}
                        className="rounded-control border border-line bg-canvas p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-ink">
                            Runner eligibility
                          </strong>
                          <span
                            aria-label={`${entry.tool.tool.displayName} runner eligibility status: ${runnerEligibility.status}`}
                            className={statusClass(runnerEligibility.status)}
                            role="status"
                          >
                            {runnerEligibility.status}
                          </span>
                        </div>
                        <p className="mt-2 text-muted">
                          {runnerEligibility.eligible
                            ? "At least one governed capability can be dispatched through the signed internal runner path."
                            : (runnerEligibility.reasons[0] ??
                              "This tool is not currently dispatchable through the internal runner.")}
                        </p>
                        <dl className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <dt className="font-semibold text-ink">
                              Active runners
                            </dt>
                            <dd>{runnerEligibility.activeRunnerCount}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-ink">
                              Verified scopes
                            </dt>
                            <dd>{runnerEligibility.verifiedScopeCount}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-ink">Runtime</dt>
                            <dd>
                              {runnerEligibility.runtimeKind ?? "Not selected"}{" "}
                              ·{" "}
                              {runnerEligibility.runtimeAvailable
                                ? "available"
                                : "unavailable"}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-semibold text-ink">
                              Server allowlist
                            </dt>
                            <dd>
                              {runnerEligibility.serverAllowlistedModuleIds
                                .length
                                ? runnerEligibility.serverAllowlistedModuleIds
                                    .slice(0, 3)
                                    .join(", ")
                                : "No runner modules"}
                            </dd>
                          </div>
                        </dl>
                        {runnerEligibility.capabilities.length ? (
                          <div className="mt-3 flex flex-col gap-2">
                            <h5 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                              Capability readiness
                            </h5>
                            {runnerEligibility.capabilities
                              .slice(0, 4)
                              .map((capability) => (
                                <article
                                  className="rounded-control border border-line bg-surface p-2"
                                  key={capability.capabilityId}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <strong className="text-sm text-ink">
                                      {capability.name}
                                    </strong>
                                    <span
                                      className={statusClass(capability.status)}
                                      role="status"
                                    >
                                      {capability.status}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-muted">
                                    {capability.moduleId ?? "No module"} ·{" "}
                                    {capability.executionMode} ·{" "}
                                    {capability.dispatchRoute ??
                                      "No dispatch route"}
                                  </p>
                                  {capability.reasons.length ? (
                                    <p className="mt-1 text-xs text-muted">
                                      {capability.reasons[0]}
                                    </p>
                                  ) : null}
                                </article>
                              ))}
                          </div>
                        ) : null}
                        {runnerEligibility.requiredActions.length ? (
                          <p className="mt-3 text-xs text-muted">
                            Next: {runnerEligibility.requiredActions[0]}
                          </p>
                        ) : null}
                        {dispatchableCapabilities.length ? (
                          <form
                            aria-label={`${entry.tool.tool.displayName} runner dispatch form`}
                            className="mt-3 grid gap-3 rounded-control border border-line bg-surface p-3"
                            onSubmit={(event) => {
                              event.preventDefault();
                              startTransition(
                                () =>
                                  void dispatchToolRunnerTask(
                                    toolId,
                                    runnerEligibility
                                  )
                              );
                            }}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h5 className="text-xs font-semibold uppercase tracking-wide text-subtle">
                                  Dispatch runner task
                                </h5>
                                <p className="mt-1 text-xs text-muted">
                                  Creates a signed, policy-gated runner task
                                  using the existing dispatch API.
                                </p>
                              </div>
                              <span className="status-pill status-pill--warning">
                                Policy gated
                              </span>
                            </div>
                            <label className="grid gap-1 text-xs text-muted">
                              Capability
                              <select
                                aria-label={`${entry.tool.tool.displayName} dispatch capability`}
                                className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                value={runnerDispatchForm.capabilityId}
                                onChange={(event) =>
                                  updateToolRunnerDispatchForm(toolId, {
                                    capabilityId: event.target.value
                                  })
                                }
                              >
                                {dispatchableCapabilities.map((capability) => (
                                  <option
                                    key={capability.capabilityId}
                                    value={capability.capabilityId}
                                  >
                                    {capability.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="grid gap-2 md:grid-cols-3">
                              <label className="grid gap-1 text-xs text-muted">
                                Runner ID
                                <input
                                  aria-label={`${entry.tool.tool.displayName} runner ID`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  value={runnerDispatchForm.runnerId}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      runnerId: event.target.value
                                    })
                                  }
                                  placeholder="Runner UUID"
                                />
                              </label>
                              <label className="grid gap-1 text-xs text-muted">
                                Scope ID
                                <input
                                  aria-label={`${entry.tool.tool.displayName} scope ID`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  value={runnerDispatchForm.scopeId}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      scopeId: event.target.value
                                    })
                                  }
                                  placeholder="Verified scope UUID"
                                />
                              </label>
                              <label className="grid gap-1 text-xs text-muted">
                                Target
                                <input
                                  aria-label={`${entry.tool.tool.displayName} dispatch target`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  value={runnerDispatchForm.target}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      target: event.target.value
                                    })
                                  }
                                  placeholder="host, domain, or IP"
                                />
                              </label>
                            </div>
                            <div className="grid gap-2 md:grid-cols-5">
                              <label className="grid gap-1 text-xs text-muted">
                                Scheme
                                <select
                                  aria-label={`${entry.tool.tool.displayName} dispatch scheme`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  value={runnerDispatchForm.scheme}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      scheme: event.target.value as
                                        | ""
                                        | "http"
                                        | "https"
                                    })
                                  }
                                >
                                  <option value="">None</option>
                                  <option value="http">http</option>
                                  <option value="https">https</option>
                                </select>
                              </label>
                              <label className="grid gap-1 text-xs text-muted">
                                Port
                                <input
                                  aria-label={`${entry.tool.tool.displayName} dispatch port`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  inputMode="numeric"
                                  value={runnerDispatchForm.port}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      port: event.target.value
                                    })
                                  }
                                  placeholder="443"
                                />
                              </label>
                              <label className="grid gap-1 text-xs text-muted">
                                Path
                                <input
                                  aria-label={`${entry.tool.tool.displayName} dispatch path`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  value={runnerDispatchForm.path}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      path: event.target.value
                                    })
                                  }
                                  placeholder="/health"
                                />
                              </label>
                              <label className="grid gap-1 text-xs text-muted">
                                Timeout
                                <input
                                  aria-label={`${entry.tool.tool.displayName} dispatch timeout`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  inputMode="numeric"
                                  value={runnerDispatchForm.timeoutSeconds}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      timeoutSeconds: event.target.value
                                    })
                                  }
                                />
                              </label>
                              <label className="grid gap-1 text-xs text-muted">
                                Rate limit
                                <input
                                  aria-label={`${entry.tool.tool.displayName} dispatch rate limit`}
                                  className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                  inputMode="numeric"
                                  value={runnerDispatchForm.rateLimitPerMinute}
                                  onChange={(event) =>
                                    updateToolRunnerDispatchForm(toolId, {
                                      rateLimitPerMinute: event.target.value
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <label className="grid gap-1 text-xs text-muted md:max-w-xs">
                              Top ports
                              <input
                                aria-label={`${entry.tool.tool.displayName} dispatch top ports`}
                                className="rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink"
                                inputMode="numeric"
                                value={runnerDispatchForm.topPorts}
                                onChange={(event) =>
                                  updateToolRunnerDispatchForm(toolId, {
                                    topPorts: event.target.value
                                  })
                                }
                                placeholder="100"
                              />
                            </label>
                            <div>
                              <Button
                                type="submit"
                                variant="secondary"
                                size="sm"
                                disabled={isBusy}
                              >
                                {isBusy
                                  ? "Dispatching..."
                                  : "Dispatch runner task"}
                              </Button>
                            </div>
                          </form>
                        ) : null}
                        {runnerDispatchResult ? (
                          <div
                            aria-label={`${entry.tool.tool.displayName} runner dispatch result`}
                            className="mt-3 rounded-control border border-line bg-surface p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-ink">
                                Runner task dispatched
                              </strong>
                              <span
                                className={statusClass(
                                  runnerDispatchResult.result.task.status
                                )}
                              >
                                {runnerDispatchResult.result.task.status}
                              </span>
                            </div>
                            <dl className="mt-2 grid gap-2 text-xs text-muted sm:grid-cols-3">
                              <div>
                                <dt className="font-semibold text-ink">Task</dt>
                                <dd>
                                  {shortId(
                                    runnerDispatchResult.result.task.taskId
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">
                                  Mission
                                </dt>
                                <dd>
                                  {shortId(
                                    runnerDispatchResult.result.mission
                                      .missionId
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-semibold text-ink">Run</dt>
                                <dd>
                                  {shortId(
                                    runnerDispatchResult.result.run.runId
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {/* Marketplace primary actions: prominent Load (install+enable) + Enable/Disable like app store */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        variant={
                          entry.governance.enabled ? "secondary" : "primary"
                        }
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          startTransition(() => void loadTool(toolId))
                        }
                      >
                        {isBusy
                          ? "Loading..."
                          : entry.governance.enabled
                            ? "Reload"
                            : "Load"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          startTransition(
                            () => void runToolAction(toolId, "check")
                          )
                        }
                      >
                        {isBusy ? "Working..." : "Check"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          startTransition(() => void checkToolUpdate(toolId))
                        }
                      >
                        Check reviewed update
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          startTransition(
                            () => void checkToolUpstreamVersion(toolId)
                          )
                        }
                      >
                        Check upstream
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          startTransition(() => void loadToolActivity(toolId))
                        }
                      >
                        Load activity
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy}
                        onClick={() =>
                          startTransition(
                            () => void loadToolRunnerEligibility(toolId)
                          )
                        }
                      >
                        Check runner
                      </Button>
                      {updateRecommendation?.status === "UpdateAvailable" ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isBusy || !canEnable}
                          onClick={() =>
                            startTransition(
                              () =>
                                void applyToolUpdate(
                                  toolId,
                                  updateRecommendation
                                )
                            )
                          }
                        >
                          Apply reviewed update
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={isBusy || !canEnable}
                        onClick={() =>
                          startTransition(
                            () => void runToolAction(toolId, "install")
                          )
                        }
                      >
                        Install
                      </Button>
                      {entry.governance.enabled ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            startTransition(
                              () => void runToolAction(toolId, "disable")
                            )
                          }
                        >
                          Disable
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={isBusy || !canEnable}
                          onClick={() =>
                            startTransition(
                              () => void runToolAction(toolId, "enable")
                            )
                          }
                        >
                          Enable
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyLine>
              No matching OSS packages in marketplace (try reset filters or
              broaden search).
            </EmptyLine>
          )}

          {/* Marketplace "add more as they evolve" discover / contribute section */}
          <div className="mt-2 rounded-control border border-dashed border-line bg-canvas p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong className="text-ink">Add more packages</strong>
                <span className="text-xs text-muted ml-2">
                  Propose new OSS tools or updated versions. Catalog grows over
                  time via reviewed intake.
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  // Scroll to the intake section below for "add more"
                  const el = document.getElementById("tool-intake-heading");
                  if (el)
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Propose new tool
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted">
              Use upstream version checks and promotion workflow to evolve
              existing entries safely.
            </p>
          </div>
        </Card>

        <Card
          className="flex flex-col gap-3"
          aria-labelledby="registry-capabilities"
        >
          <div className="flex items-center justify-between gap-4">
            <h3
              id="registry-capabilities"
              className="text-base font-semibold text-ink"
            >
              Capabilities
            </h3>
            <span
              aria-label={`Capability count: ${registryState.capabilities.length}`}
              className="status-pill status-pill--pending"
              role="status"
            >
              {registryState.capabilities.length} capabilities
            </span>
          </div>
          {registryState.capabilities.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {registryState.capabilities.slice(0, 12).map((capability) => (
                <article
                  className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
                  key={capability.capabilityId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-subtle">
                        {capability.toolId}
                      </span>
                      <strong className="mt-1 block text-ink">
                        {capability.name}
                      </strong>
                    </div>
                    <span
                      aria-label={`${capability.name} execution readiness: ${readinessLabel(
                        capability.executionReadiness,
                        capability.status
                      )}`}
                      className={statusClass(
                        readinessLabel(
                          capability.executionReadiness,
                          capability.status
                        )
                      )}
                      role="status"
                    >
                      {readinessLabel(
                        capability.executionReadiness,
                        capability.status
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {capability.status} · {capability.interfaceKind} ·{" "}
                    {capability.executionMode}
                  </p>
                  <p className="text-xs text-muted">
                    {capability.runtimeReason ??
                      "Runtime readiness not checked."}
                  </p>
                  <ul className="flex flex-wrap gap-2 text-xs text-muted">
                    <li>Safety: {joinOrNone(capability.safetyLevels)}</li>
                    <li>Scopes: {joinOrNone(capability.requiredScopes)}</li>
                    <li>
                      Integrations:{" "}
                      {joinOrNone(capability.requiredIntegrations)}
                    </li>
                    <li>Evidence: {joinOrNone(capability.evidenceTypes)}</li>
                  </ul>
                </article>
              ))}
            </div>
          ) : (
            <EmptyLine>No capabilities are registered.</EmptyLine>
          )}
        </Card>

        <Card
          className="flex flex-col gap-3"
          aria-labelledby="registry-operators"
        >
          <div className="flex items-center justify-between gap-4">
            <h3
              id="registry-operators"
              className="text-base font-semibold text-ink"
            >
              Periscan operators
            </h3>
            <span
              aria-label={`Operator profile count: ${registryState.operatorProfiles.length}`}
              className="status-pill status-pill--pending"
              role="status"
            >
              {registryState.operatorProfiles.length} profiles
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">Profiles</h4>
              {registryState.operatorProfiles.length ? (
                registryState.operatorProfiles.map((profile) => (
                  <article
                    className="rounded-control border border-line bg-surface p-3"
                    key={profile.operatorType}
                  >
                    <strong className="text-ink">{profile.name}</strong>
                    <p className="text-sm text-muted">
                      {profile.defaultSafetyLevel} ·{" "}
                      {profile.supportedMissionTypes.join(", ")}
                    </p>
                  </article>
                ))
              ) : (
                <EmptyLine>No operator profiles are registered.</EmptyLine>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-ink">
                Recommendations
              </h4>
              {registryState.operatorRecommendations.length ? (
                registryState.operatorRecommendations.map((recommendation) => (
                  <article
                    className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3"
                    key={recommendation.recommendationId}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-ink">
                        {recommendation.title}
                      </strong>
                      <span
                        aria-label={`${recommendation.title} recommendation status: ${recommendation.status}`}
                        className={statusClass(recommendation.status)}
                        role="status"
                      >
                        {recommendation.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      {recommendation.rationale}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {recommendation.evidenceIds.map((evidenceId) => (
                        <span
                          className="rounded-pill bg-surface-strong px-2 py-0.5 text-xs text-muted"
                          key={evidenceId}
                        >
                          ev-{shortId(evidenceId)}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <EmptyLine>
                  No operator recommendations are available.
                </EmptyLine>
              )}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
