import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  deriveAttackPathClaim,
  projectPathValidationState,
  type AttackPathClaim
} from "./claim-language";
import { evaluateDangerStart } from "./danger-section";
import {
  ValidationStateSchema,
  type AttackPath,
  type ValidationState
} from "./domain";

export const INFECTION_MONKEY_TOOL_ID = "infection-monkey";
export const INFECTION_MONKEY_DISCOVER_MODULE_ID = "infection-monkey.discover";
export const INFECTION_MONKEY_MIMIKATZ_MODULE_ID = "infection-monkey.mimikatz";

export const COPYLEFT_ENGINE_LAB_MODULE_IDS = [
  INFECTION_MONKEY_DISCOVER_MODULE_ID
] as const;

export function isCopyleftEngineLabModuleId(moduleId: string): boolean {
  return (COPYLEFT_ENGINE_LAB_MODULE_IDS as readonly string[]).includes(
    moduleId
  );
}

export const INFECTION_MONKEY_LICENSE = {
  collectorExecutable: false,
  disposition: "RequiresLegalReview",
  redistributableInDefaultPack: false,
  spdxLicenseId: "GPL-3.0",
  toolId: INFECTION_MONKEY_TOOL_ID
} as const;

export const INFECTION_MONKEY_ALLOWLISTED_DISCOVER_PLUGINS = [
  "http_fingerprinter",
  "mssql_fingerprinter",
  "ping_scanner",
  "smb_fingerprinter",
  "ssh_fingerprinter",
  "tcp_scanner"
] as const;

export const INFECTION_MONKEY_DENIED_PLUGINS = [
  "hadoop_exploiter",
  "log4shell",
  "mimikatz",
  "mssql_exploiter",
  "powershell_exploiter",
  "ransomware",
  "rdp_exploiter",
  "redis_exploiter",
  "smb_exploiter",
  "ssh_collector",
  "ssh_exploiter",
  "wmi_exploiter",
  "zerologon"
] as const;

const ALLOWLIST = new Set<string>(INFECTION_MONKEY_ALLOWLISTED_DISCOVER_PLUGINS);
const DENIED = new Set<string>(INFECTION_MONKEY_DENIED_PLUGINS);
const CREDENTIAL_STEAL = new Set(["mimikatz", "ssh_collector"]);
const DEFAULT_PLUGINS = ["ping_scanner", "tcp_scanner"] as const;
const MAX_HOSTS = 64;
const DEFAULT_TIMEOUT_SECONDS = 90;
const MAX_TIMEOUT_SECONDS = 300;

const PLUGIN_ALIASES: Record<string, string> = {
  httpfingerprinter: "http_fingerprinter",
  log4shellexploiter: "log4shell",
  mimikatzcollector: "mimikatz",
  mssqlfingerprinter: "mssql_fingerprinter",
  pingscanner: "ping_scanner",
  smbfingerprinter: "smb_fingerprinter",
  sshcollector: "ssh_collector",
  sshfingerprinter: "ssh_fingerprinter",
  tcpscanner: "tcp_scanner",
  zerologonexploiter: "zerologon"
};

export function isInfectionMonkeyCredentialStealPlugin(plugin: string): boolean {
  return CREDENTIAL_STEAL.has(canonicalizePlugin(plugin));
}

function slugPlugin(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

export function canonicalizePlugin(plugin: string): string {
  const slugged = slugPlugin(plugin);
  const compact = slugged.replace(/_/g, "");
  if (PLUGIN_ALIASES[slugged]) {
    return PLUGIN_ALIASES[slugged];
  }
  if (PLUGIN_ALIASES[compact]) {
    return PLUGIN_ALIASES[compact];
  }
  if (slugged.endsWith("_exploiter")) {
    const base = slugged.slice(0, -"_exploiter".length);
    if (base === "zerologon" || base === "log4shell") {
      return base;
    }
    return slugged;
  }
  if (slugged.endsWith("_collector") && slugged.startsWith("mimikatz")) {
    return "mimikatz";
  }
  return slugged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnscopedHost(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length === 0 ||
    trimmed === "*" ||
    trimmed.includes("*") ||
    trimmed.includes("://") ||
    trimmed.includes("..") ||
    trimmed === "0.0.0.0/0" ||
    trimmed === "::/0" ||
    /^entire[-_]?network$/i.test(trimmed)
  );
}

function isConcreteHost(value: string): boolean {
  if (isUnscopedHost(value)) {
    return false;
  }
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split(".").every((octet) => {
      const n = Number(octet);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(
    value
  );
}

function asStringArray(value: unknown): string[] | null {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return value;
}

export const InfectionMonkeyCandidateSchema = z.object({
  autoAddedToScope: z.literal(false),
  host: z.string().min(1),
  inVerifiedScope: z.boolean(),
  promotion: z.literal("promote-to-scope")
});
export type InfectionMonkeyCandidate = z.infer<
  typeof InfectionMonkeyCandidateSchema
>;

export const InfectionMonkeyLicenseDispositionSchema = z.object({
  collectorExecutable: z.literal(false),
  disposition: z.literal("RequiresLegalReview"),
  redistributableInDefaultPack: z.literal(false),
  spdxLicenseId: z.literal("GPL-3.0"),
  toolId: z.literal("infection-monkey")
});

export const InfectionMonkeyDiscoverProfileSchema = z.object({
  candidates: z.array(InfectionMonkeyCandidateSchema).min(1).max(MAX_HOSTS),
  communityDefaultPack: z.literal(false),
  credentialTheft: z.literal(false),
  executable: z.literal(false),
  license: InfectionMonkeyLicenseDispositionSchema,
  liveSupported: z.literal(false),
  plugins: z.array(z.string().min(1)).min(1),
  propagation: z.literal(false),
  ransomwarePayload: z.literal(false),
  timeoutSeconds: z.number().int().positive().max(MAX_TIMEOUT_SECONDS),
  verifiedScopeHosts: z.array(z.string().min(1)).min(1).max(MAX_HOSTS)
});
export type InfectionMonkeyDiscoverProfile = z.infer<
  typeof InfectionMonkeyDiscoverProfileSchema
>;

export type InfectionMonkeyDiscoverCompileResult =
  | { ok: true; profile: InfectionMonkeyDiscoverProfile }
  | { ok: false; code: string; rationale: string };

function fail(code: string, rationale: string): InfectionMonkeyDiscoverCompileResult {
  return { ok: false, code, rationale };
}

function denyCodeForPlugin(plugin: string): string {
  if (plugin === "ransomware") {
    return "infection_monkey_ransomware_denied";
  }
  if (CREDENTIAL_STEAL.has(plugin)) {
    return "infection_monkey_credential_steal_denied";
  }
  return "infection_monkey_exploiter_denied";
}

export function compileInfectionMonkeyDiscoverProfile(
  input: unknown
): InfectionMonkeyDiscoverCompileResult {
  if (!isRecord(input)) {
    return fail(
      "infection_monkey_profile_invalid",
      "Infection Monkey discover profile must be an object."
    );
  }

  if (
    input.propagation === true ||
    input.propagate === true ||
    input.exploitersEnabled === true
  ) {
    return fail(
      "infection_monkey_exploiter_denied",
      "Infection Monkey propagation and exploiters are default-deny."
    );
  }

  const hosts = asStringArray(input.verifiedScopeHosts);
  if (!hosts || hosts.length === 0) {
    return fail(
      "infection_monkey_scope_required",
      "Infection Monkey discover requires a non-empty verified-scope host list."
    );
  }
  if (hosts.length > MAX_HOSTS || hosts.some((host) => !isConcreteHost(host))) {
    return fail(
      "infection_monkey_targets_unscoped",
      "Discover targets must be concrete verified-scope hosts, not wildcards."
    );
  }

  const rawPlugins = asStringArray(input.plugins) ?? [...DEFAULT_PLUGINS];
  if (rawPlugins.length === 0) {
    return fail(
      "infection_monkey_plugins_required",
      "At least one discover plugin is required."
    );
  }
  const plugins = rawPlugins.map(canonicalizePlugin);
  for (const plugin of plugins) {
    if (DENIED.has(plugin) || !ALLOWLIST.has(plugin)) {
      const code = DENIED.has(plugin)
        ? denyCodeForPlugin(plugin)
        : "infection_monkey_exploiter_denied";
      return fail(
        code,
        `Infection Monkey plugin ${plugin} is not an allowlisted discoverer.`
      );
    }
  }

  const timeoutSeconds =
    typeof input.timeoutSeconds === "number"
      ? input.timeoutSeconds
      : DEFAULT_TIMEOUT_SECONDS;
  if (
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > MAX_TIMEOUT_SECONDS
  ) {
    return fail(
      "infection_monkey_unbounded_crawl",
      "Discover timeoutSeconds must be a finite bound under the profile cap."
    );
  }

  const candidates: InfectionMonkeyCandidate[] = hosts.map((host) => ({
    autoAddedToScope: false,
    host,
    inVerifiedScope: true,
    promotion: "promote-to-scope"
  }));

  const parsed = InfectionMonkeyDiscoverProfileSchema.safeParse({
    candidates,
    communityDefaultPack: false,
    credentialTheft: false,
    executable: false,
    license: INFECTION_MONKEY_LICENSE,
    liveSupported: false,
    plugins,
    propagation: false,
    ransomwarePayload: false,
    timeoutSeconds,
    verifiedScopeHosts: hosts
  });
  if (!parsed.success) {
    return fail(
      "infection_monkey_profile_invalid",
      "Infection Monkey discover profile failed typed validation."
    );
  }
  return { ok: true, profile: parsed.data };
}

export type InfectionMonkeyIslandNode = {
  id: string;
  name: string;
  type: string;
};

export type InfectionMonkeyIslandEdge = {
  relationship: string;
  source: string;
  target: string;
};

export type InfectionMonkeyIslandReport = {
  edges: InfectionMonkeyIslandEdge[];
  nodes: InfectionMonkeyIslandNode[];
};

export type InfectionMonkeyIslandEdgeHonesty = InfectionMonkeyIslandEdge & {
  evidenceBasis: "Heuristic" | "Measured";
  evidenceIds: string[];
  hypothesis: boolean;
  independentlyMeasured: boolean;
};

export type InfectionMonkeyIslandHonesty = {
  claim: AttackPathClaim;
  claimSafeValidationState: AttackPath["validationState"];
  edges: InfectionMonkeyIslandEdgeHonesty[];
  importedGraphIsHypothesis: boolean;
  islandC2IsNotMeasuredHops: true;
  pathEdges: AttackPath["pathEdges"];
};

const ALLOWED_NODE_FIELDS = new Set(["id", "name", "type"]);
const ALLOWED_EDGE_FIELDS = new Set(["source", "target", "relationship"]);

const IndependentHopReceiptSchema = z.object({
  evidenceIds: z.array(z.string().uuid()).min(1),
  measurementMethod: z.string().min(1),
  moduleId: z.string().min(1),
  relationship: z.string().min(1),
  source: z.string().min(1),
  sourceKind: z.enum(["SafeProbe", "ControlObservation", "RunnerReachability"]),
  target: z.string().min(1),
  validationState: ValidationStateSchema
});

const NON_UPGRADING_STATES = new Set([
  "NoEvidence",
  "Inconclusive",
  "NotConfigured",
  "RequiresIntegration",
  "RequiresVerifiedScope",
  "RequiresInternalRunner",
  "NeedsApproval",
  "NeedsInternalRunner"
]);

function pickString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function redactInfectionMonkeyIslandReport(
  raw: unknown
): InfectionMonkeyIslandReport {
  const record = isRecord(raw) ? raw : {};
  const nodesIn = Array.isArray(record.nodes) ? record.nodes : [];
  const edgesIn = Array.isArray(record.edges) ? record.edges : [];

  const nodes: InfectionMonkeyIslandNode[] = [];
  for (const node of nodesIn) {
    if (!isRecord(node)) {
      continue;
    }
    const picked: Record<string, string> = {};
    for (const field of ALLOWED_NODE_FIELDS) {
      const value = pickString(node, field);
      if (value) {
        picked[field] = value;
      }
    }
    if (!picked.id || !picked.name || !picked.type) {
      continue;
    }
    nodes.push({ id: picked.id, name: picked.name, type: picked.type });
  }

  const edges: InfectionMonkeyIslandEdge[] = [];
  for (const edge of edgesIn) {
    if (!isRecord(edge)) {
      continue;
    }
    const picked: Record<string, string> = {};
    for (const field of ALLOWED_EDGE_FIELDS) {
      const value = pickString(edge, field);
      if (value) {
        picked[field] = value;
      }
    }
    if (!picked.source || !picked.target || !picked.relationship) {
      continue;
    }
    edges.push({
      relationship: picked.relationship,
      source: picked.source,
      target: picked.target
    });
  }

  return { edges, nodes };
}

function isIslandModule(moduleId: string): boolean {
  return (
    moduleId === INFECTION_MONKEY_DISCOVER_MODULE_ID ||
    moduleId === INFECTION_MONKEY_TOOL_ID ||
    /infection[-_]?monkey|monkey[-_]?island|guardicore/i.test(moduleId)
  );
}

function hopIdentity(source: string, relationship: string, target: string): string {
  return `${source.trim().toLowerCase()}|${relationship.trim().toLowerCase()}|${target.trim().toLowerCase()}`;
}

function placeholderPathEdge(input: {
  evidenceBasis: "Heuristic" | "Measured";
  evidenceIds: string[];
}): AttackPath["pathEdges"][number] {
  const timestamp = "2026-09-17T00:00:00.000Z";
  return {
    createdAt: timestamp,
    evidenceBasis: input.evidenceBasis,
    evidenceIds: input.evidenceIds,
    measurementMethod:
      input.evidenceBasis === "Measured" ? "independent hop receipt" : null,
    pathEdgeId: randomUUID(),
    pathId: randomUUID(),
    rationale: "Infection Monkey Island hop",
    relationship: "CAN_ACCESS",
    sourceNodeId: randomUUID(),
    targetNodeId: randomUUID(),
    tenantId: randomUUID(),
    updatedAt: timestamp
  };
}

export function classifyInfectionMonkeyIslandReport(input: {
  hopReceipts?: readonly unknown[];
  report: unknown;
  requestedValidationState?: ValidationState;
}): InfectionMonkeyIslandHonesty {
  const graph = redactInfectionMonkeyIslandReport(input.report);
  const receipts = (input.hopReceipts ?? [])
    .map((raw) => IndependentHopReceiptSchema.safeParse(raw))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
    .filter(
      (receipt) =>
        !isIslandModule(receipt.moduleId) &&
        !NON_UPGRADING_STATES.has(receipt.validationState)
    );

  const receiptByHop = new Map<string, (typeof receipts)[number]>();
  for (const receipt of receipts) {
    receiptByHop.set(
      hopIdentity(receipt.source, receipt.relationship, receipt.target),
      receipt
    );
  }

  const edges: InfectionMonkeyIslandEdgeHonesty[] = graph.edges.map((edge) => {
    const receipt = receiptByHop.get(
      hopIdentity(edge.source, edge.relationship, edge.target)
    );
    if (receipt) {
      return {
        ...edge,
        evidenceBasis: "Measured",
        evidenceIds: [...receipt.evidenceIds],
        hypothesis: false,
        independentlyMeasured: true
      };
    }
    return {
      ...edge,
      evidenceBasis: "Heuristic",
      evidenceIds: [],
      hypothesis: true,
      independentlyMeasured: false
    };
  });

  const pathEdges = edges.map((edge) =>
    placeholderPathEdge({
      evidenceBasis: edge.evidenceBasis,
      evidenceIds: edge.evidenceIds
    })
  );
  const fullyMeasured =
    pathEdges.length > 0 &&
    pathEdges.every(
      (edge) => edge.evidenceBasis === "Measured" && edge.evidenceIds.length > 0
    );
  const requested = input.requestedValidationState ?? "Discovered";
  const claimInput = {
    evidenceBasis: fullyMeasured ? ("Measured" as const) : ("Heuristic" as const),
    pathEdges,
    validationState: requested
  };
  const claim = deriveAttackPathClaim(claimInput);
  const projection = projectPathValidationState(claimInput);

  return {
    claim,
    claimSafeValidationState: projection.claimSafeValidationState,
    edges,
    importedGraphIsHypothesis: !fullyMeasured,
    islandC2IsNotMeasuredHops: true,
    pathEdges
  };
}

export type InfectionMonkeyDiscoverStartInput = {
  copyleftOptIn: boolean;
  dangerAckDigest?: string;
  dangerAcknowledged?: boolean;
  hopReceipts?: readonly unknown[];
  islandReport?: unknown;
  liveOffensive?: boolean;
  plugins?: readonly string[];
  qualified: boolean;
  startable: boolean;
  tenantAuthorized: boolean;
  timeoutSeconds?: number;
  verifiedScopeHosts: readonly string[];
};

export type InfectionMonkeyDiscoverStartResult = {
  candidates: InfectionMonkeyCandidate[];
  communityDefaultPack: false;
  copyleftOptIn: boolean;
  credentialTheft: false;
  denyCode: string | null;
  denyReason: string | null;
  discoverPlan: InfectionMonkeyDiscoverProfile | null;
  executable: false;
  exploitersEnabled: false;
  importedGraphIsHypothesis: boolean;
  islandHonesty: InfectionMonkeyIslandHonesty | null;
  jobsQueued: number;
  license: typeof INFECTION_MONKEY_LICENSE;
  liveSupported: false;
  propagation: false;
  queued: boolean;
  ransomwarePayload: false;
  recorded: boolean;
};

function deniedStart(input: {
  code: string;
  copyleftOptIn: boolean;
  hopReceipts?: readonly unknown[];
  islandReport?: unknown;
  rationale: string;
}): InfectionMonkeyDiscoverStartResult {
  const islandHonesty = input.islandReport
    ? classifyInfectionMonkeyIslandReport({
        hopReceipts: input.hopReceipts,
        report: input.islandReport
      })
    : null;
  return {
    candidates: [],
    communityDefaultPack: false,
    copyleftOptIn: input.copyleftOptIn,
    credentialTheft: false,
    denyCode: input.code,
    denyReason: input.rationale,
    discoverPlan: null,
    executable: false,
    exploitersEnabled: false,
    importedGraphIsHypothesis: islandHonesty?.importedGraphIsHypothesis ?? true,
    islandHonesty,
    jobsQueued: 0,
    license: INFECTION_MONKEY_LICENSE,
    liveSupported: false,
    propagation: false,
    queued: false,
    ransomwarePayload: false,
    recorded: false
  };
}

export function planInfectionMonkeyDiscoverStart(
  input: InfectionMonkeyDiscoverStartInput
): InfectionMonkeyDiscoverStartResult {
  void input.liveOffensive;

  if (input.startable !== true) {
    return deniedStart({
      code: "infection_monkey_not_startable",
      copyleftOptIn: input.copyleftOptIn,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale:
        "Infection Monkey discover is not startable. Denied tasks are never queued."
    });
  }
  if (input.copyleftOptIn !== true) {
    return deniedStart({
      code: "infection_monkey_license_required",
      copyleftOptIn: false,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale:
        "Infection Monkey is GPL-3.0. Accept the upstream license in Engine Lab before a discover plan can be recorded."
    });
  }
  if (input.qualified !== true) {
    return deniedStart({
      code: "infection_monkey_qualification_required",
      copyleftOptIn: true,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale:
        "Infection Monkey discover requires a qualified Engine Lab adapter before a plan can be queued."
    });
  }
  if (input.tenantAuthorized !== true) {
    return deniedStart({
      code: "infection_monkey_authorization_required",
      copyleftOptIn: true,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale:
        "Infection Monkey discover requires tenant authorization. Denied tasks are never queued."
    });
  }

  const requestedPlugins = [...(input.plugins ?? DEFAULT_PLUGINS)];
  const wantsCredentialSteal = requestedPlugins.some(
    isInfectionMonkeyCredentialStealPlugin
  );
  if (wantsCredentialSteal) {
    const danger = evaluateDangerStart({
      dangerAckDigest: input.dangerAckDigest,
      dangerAcknowledged: input.dangerAcknowledged === true,
      policyAllowed: true,
      qualified: true,
      scenarioId: INFECTION_MONKEY_MIMIKATZ_MODULE_ID,
      scopeVerified: input.verifiedScopeHosts.length > 0,
      tenantAuthorized: true
    });
    if (!danger.startable) {
      return deniedStart({
        code: danger.denyReason ?? "danger_acknowledgement_required",
        copyleftOptIn: true,
        hopReceipts: input.hopReceipts,
        islandReport: input.islandReport,
        rationale:
          "Infection Monkey credential-steal plugins require high-danger acknowledgement."
      });
    }
  }

  const compiled = compileInfectionMonkeyDiscoverProfile({
    plugins: requestedPlugins,
    timeoutSeconds: input.timeoutSeconds,
    verifiedScopeHosts: [...input.verifiedScopeHosts]
  });
  if (!compiled.ok) {
    return deniedStart({
      code: compiled.code,
      copyleftOptIn: true,
      hopReceipts: input.hopReceipts,
      islandReport: input.islandReport,
      rationale: compiled.rationale
    });
  }

  const islandHonesty = input.islandReport
    ? classifyInfectionMonkeyIslandReport({
        hopReceipts: input.hopReceipts,
        report: input.islandReport
      })
    : null;

  return {
    candidates: compiled.profile.candidates,
    communityDefaultPack: false,
    copyleftOptIn: true,
    credentialTheft: false,
    denyCode: null,
    denyReason: null,
    discoverPlan: compiled.profile,
    executable: false,
    exploitersEnabled: false,
    importedGraphIsHypothesis: islandHonesty?.importedGraphIsHypothesis ?? true,
    islandHonesty,
    jobsQueued: 1,
    license: INFECTION_MONKEY_LICENSE,
    liveSupported: false,
    propagation: false,
    queued: true,
    ransomwarePayload: false,
    recorded: true
  };
}
