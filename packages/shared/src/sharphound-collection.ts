import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  deriveAttackPathClaim,
  projectPathValidationState,
  type AttackPathClaim
} from "./claim-language";
import {
  ValidationStateSchema,
  type AttackPath,
  type RiskBand,
  type ValidationState
} from "./domain";

export const SHARPHOUND_COLLECTOR_TOOL_ID = "sharphound";
export const BLOODHOUND_CE_TOOL_ID = "bloodhound-ce";
export const IDENTITY_GRAPH_IMPORT_MODULE_ID = "bloodhound.identity_pathing";

export const SHARPHOUND_COLLECTOR_LICENSE = {
  collectorExecutable: false,
  disposition: "RequiresLegalReview",
  redistributableInDefaultPack: false,
  spdxLicenseId: "GPL-3.0",
  toolId: "sharphound"
} as const;

export const BLOODHOUND_GRAPH_IMPORT_LICENSE = {
  spdxLicenseId: "Apache-2.0",
  toolId: "bloodhound-ce"
} as const;

export const SHARPHOUND_LDAP_READ_METHODS = [
  "Group",
  "ACL",
  "Container",
  "ObjectProps",
  "Trusts",
  "GPOLocalGroup",
  "CertServices"
] as const;

export const SHARPHOUND_DEFAULT_METHODS = [
  "Group",
  "ACL",
  "Container",
  "ObjectProps",
  "Trusts"
] as const;

export const SHARPHOUND_LEAST_PRIVILEGE_PRIVILEGES = [
  "LDAPRead",
  "DirectoryRead",
  "GroupMembershipRead"
] as const;

const LDAP_READ_METHOD_SET = new Set<string>(SHARPHOUND_LDAP_READ_METHODS);
const LEAST_PRIVILEGE_SET = new Set<string>(SHARPHOUND_LEAST_PRIVILEGE_PRIVILEGES);

const MAX_OBJECTS = 50_000;
const DEFAULT_MAX_OBJECTS = 5_000;
const MAX_DEPTH = 8;
const DEFAULT_MAX_DEPTH = 4;
const MAX_TIMEOUT_SECONDS = 300;
const DEFAULT_TIMEOUT_SECONDS = 120;
const MAX_DOMAIN_CONTROLLERS = 8;
const MAX_TARGETS = 64;
const MAX_IDENTITIES = 16;

export const SharpHoundCollectionMethodSchema = z.enum(SHARPHOUND_LDAP_READ_METHODS);
export const SharpHoundCollectorPrivilegeSchema = z.enum(
  SHARPHOUND_LEAST_PRIVILEGE_PRIVILEGES
);
export const SharpHoundIdentityKindSchema = z.enum([
  "User",
  "Group",
  "Computer",
  "Gmsa",
  "ServiceAccount"
]);
export const SharpHoundTargetKindSchema = z.enum([
  "Domain",
  "OrganizationalUnit",
  "Computer",
  "User",
  "Group"
]);

export const SharpHoundCollectorIdentitySchema = z.object({
  kind: SharpHoundIdentityKindSchema,
  objectId: z.string().min(1).max(512),
  privileges: z.array(SharpHoundCollectorPrivilegeSchema).min(1).max(8),
  samAccountName: z.string().min(1).max(256)
});

export const SharpHoundCollectionTargetSchema = z.object({
  displayName: z.string().min(1).max(256).optional(),
  dnsName: z.string().min(1).max(253).optional(),
  kind: SharpHoundTargetKindSchema,
  objectId: z.string().min(1).max(512)
});

export const SharpHoundCollectionBoundsSchema = z.object({
  domainControllers: z.array(z.string().min(1).max(253)).max(MAX_DOMAIN_CONTROLLERS),
  maxDepth: z.number().int().positive().max(MAX_DEPTH),
  maxObjects: z.number().int().positive().max(MAX_OBJECTS),
  timeoutSeconds: z.number().int().positive().max(MAX_TIMEOUT_SECONDS)
});

// ObjectProps can return LAPS/gMSA secrets; those stay redacted even for LDAP-read profiles.
export const SHARPHOUND_REQUIRED_REDACTION = {
  redactCredentialMaterial: true,
  redactLapsPasswords: true,
  redactPasswordHashes: true,
  redactSecrets: true
} as const;

export const SharpHoundRedactionPolicySchema = z.object({
  redactCredentialMaterial: z.literal(true),
  redactLapsPasswords: z.literal(true),
  redactPasswordHashes: z.literal(true),
  redactSecrets: z.literal(true)
});

export const SharpHoundLicenseDispositionSchema = z.object({
  collectorExecutable: z.literal(false),
  disposition: z.literal("RequiresLegalReview"),
  redistributableInDefaultPack: z.literal(false),
  spdxLicenseId: z.literal("GPL-3.0"),
  toolId: z.literal("sharphound")
});

export const SharpHoundCollectionProfileSchema = z.object({
  bounds: SharpHoundCollectionBoundsSchema,
  collector: z.literal("sharphound"),
  credentialTheft: z.literal(false),
  executable: z.literal(false),
  identities: z.array(SharpHoundCollectorIdentitySchema).min(1).max(MAX_IDENTITIES),
  leastPrivilege: z.literal(true),
  license: SharpHoundLicenseDispositionSchema,
  liveAdCollection: z.literal(false),
  liveSupported: z.literal(false),
  methods: z.array(SharpHoundCollectionMethodSchema).min(1).max(16),
  persistence: z.literal(false),
  profileId: z.string().min(1).max(128),
  redaction: SharpHoundRedactionPolicySchema,
  targets: z.array(SharpHoundCollectionTargetSchema).min(1).max(MAX_TARGETS)
});

export type SharpHoundCollectionProfile = z.infer<
  typeof SharpHoundCollectionProfileSchema
>;

export type SharpHoundCollectionCompileResult =
  | { ok: true; profile: SharpHoundCollectionProfile }
  | { ok: false; code: string; rationale: string };

const IndependentIdentityHopReceiptSchema = z.object({
  evidenceIds: z.array(z.string().uuid()).min(1),
  measurementMethod: z.string().min(1),
  moduleId: z.string().min(1),
  relationship: z.string().min(1),
  source: z.string().min(1),
  sourceKind: z.enum(["SafeProbe", "ControlObservation", "RunnerReachability"]),
  target: z.string().min(1),
  validationState: ValidationStateSchema
});

export type IndependentIdentityHopReceipt = z.infer<
  typeof IndependentIdentityHopReceiptSchema
>;

export type BloodHoundImportedNode = {
  criticality?: string;
  id: string;
  name: string;
  privilege?: string;
  type: string;
};

export type BloodHoundImportedEdge = {
  relationship: string;
  source: string;
  target: string;
};

export type BloodHoundImportedGraph = {
  edges: BloodHoundImportedEdge[];
  nodes: BloodHoundImportedNode[];
};

export type BloodHoundImportedEdgeHonesty = BloodHoundImportedEdge & {
  evidenceBasis: "Heuristic" | "Measured";
  evidenceIds: string[];
  hypothesis: boolean;
  independentlyMeasured: boolean;
};

export type BloodHoundPathHonesty = {
  claim: AttackPathClaim;
  claimSafeValidationState: AttackPath["validationState"];
  collectionIsNotExploitation: true;
  edges: BloodHoundImportedEdgeHonesty[];
  importedGraphIsNotProof: boolean;
  pathEdges: AttackPath["pathEdges"];
};

const NON_UPGRADING_STATES = new Set<string>([
  "NoEvidence",
  "Inconclusive",
  "NotConfigured",
  "RequiresIntegration",
  "RequiresVerifiedScope",
  "RequiresInternalRunner",
  "NeedsApproval",
  "NeedsInternalRunner"
]);

const ALLOWED_NODE_FIELDS = new Set(["id", "name", "type", "privilege", "criticality"]);
const ALLOWED_EDGE_FIELDS = new Set(["source", "target", "relationship"]);

function fail(code: string, rationale: string): SharpHoundCollectionCompileResult {
  return { ok: false, code, rationale };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnscopedSelector(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  return (
    trimmed === "*" ||
    trimmed.includes("*") ||
    trimmed.includes("://") ||
    trimmed.includes("..") ||
    /^entire[-_]?forest$/i.test(trimmed)
  );
}

function isHostname(value: string): boolean {
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

export function compileSharpHoundCollectionProfile(
  input: unknown
): SharpHoundCollectionCompileResult {
  if (!isRecord(input)) {
    return fail(
      "sharphound_profile_invalid",
      "SharpHound collection profile must be an object."
    );
  }

  if (
    input.liveAdCollection === true ||
    input.collectorExecution === true ||
    input.useSharpHound === true
  ) {
    return fail(
      "sharphound_live_ad_default_deny",
      "Live Active Directory SharpHound collection is default-deny. Compile a scoped profile for import/planning only."
    );
  }

  if (input.credentialTheft === true) {
    return fail(
      "sharphound_credential_theft_denied",
      "Credential theft is excluded from SharpHound collection profiles."
    );
  }

  if (input.persistence === true) {
    return fail(
      "sharphound_persistence_denied",
      "Persistence is excluded from SharpHound collection profiles."
    );
  }

  if (!Array.isArray(input.identities) || input.identities.length === 0) {
    return fail(
      "sharphound_identities_required",
      "A least-privilege collector identity is required."
    );
  }

  if (!Array.isArray(input.targets) || input.targets.length === 0) {
    return fail(
      "sharphound_targets_required",
      "At least one typed collection target is required."
    );
  }

  for (const identity of input.identities) {
    if (!isRecord(identity) || !Array.isArray(identity.privileges)) {
      return fail(
        "sharphound_privilege_not_least",
        "Collector identities must declare least-privilege LDAP read rights only."
      );
    }
    if (
      identity.privileges.some(
        (privilege) =>
          typeof privilege !== "string" || !LEAST_PRIVILEGE_SET.has(privilege)
      )
    ) {
      return fail(
        "sharphound_privilege_not_least",
        "Collector identities may only use LDAPRead, DirectoryRead, or GroupMembershipRead."
      );
    }
  }

  const methods = asStringArray(input.methods) ?? [...SHARPHOUND_DEFAULT_METHODS];
  if (methods.length === 0 || methods.some((method) => !LDAP_READ_METHOD_SET.has(method))) {
    return fail(
      "sharphound_method_not_least_privilege",
      "Collection methods must stay in the LDAP-read least-privilege allowlist."
    );
  }

  for (const target of input.targets) {
    if (!isRecord(target) || typeof target.objectId !== "string") {
      return fail(
        "sharphound_targets_unscoped",
        "Each target needs a typed kind and a concrete object id."
      );
    }
    const dnsName = typeof target.dnsName === "string" ? target.dnsName : undefined;
    if (isUnscopedSelector(target.objectId) || isUnscopedSelector(dnsName)) {
      return fail(
        "sharphound_targets_unscoped",
        "Collection targets cannot be wildcards or forest-wide aliases."
      );
    }
  }

  const boundsDraft = isRecord(input.bounds) ? input.bounds : {};
  const maxObjects =
    typeof boundsDraft.maxObjects === "number"
      ? boundsDraft.maxObjects
      : DEFAULT_MAX_OBJECTS;
  const maxDepth =
    typeof boundsDraft.maxDepth === "number" ? boundsDraft.maxDepth : DEFAULT_MAX_DEPTH;
  const timeoutSeconds =
    typeof boundsDraft.timeoutSeconds === "number"
      ? boundsDraft.timeoutSeconds
      : DEFAULT_TIMEOUT_SECONDS;
  const domainControllers = asStringArray(boundsDraft.domainControllers) ?? [];

  if (
    !Number.isInteger(maxObjects) ||
    maxObjects < 1 ||
    maxObjects > MAX_OBJECTS ||
    !Number.isInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > MAX_DEPTH ||
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > MAX_TIMEOUT_SECONDS
  ) {
    return fail(
      "sharphound_unbounded_collection",
      "Collection bounds must include finite maxObjects, maxDepth, and timeoutSeconds under the profile caps."
    );
  }

  if (
    domainControllers.length > MAX_DOMAIN_CONTROLLERS ||
    domainControllers.some((host) => isUnscopedSelector(host) || !isHostname(host))
  ) {
    return fail(
      "sharphound_unbounded_collection",
      "Domain controller list must be a bounded set of hostnames."
    );
  }

  if (isRecord(input.redaction)) {
    if (
      input.redaction.redactSecrets === false ||
      input.redaction.redactPasswordHashes === false ||
      input.redaction.redactCredentialMaterial === false ||
      input.redaction.redactLapsPasswords === false
    ) {
      return fail(
        "sharphound_redaction_required",
        "Secret, hash, credential, and LAPS/gMSA password redaction cannot be disabled."
      );
    }
  }

  if (input.license !== undefined) {
    if (!isRecord(input.license)) {
      return fail(
        "sharphound_license_disposition_blocked",
        "SharpHound collector license disposition must remain GPL-3.0 RequiresLegalReview."
      );
    }
    if (
      input.license.disposition !== "RequiresLegalReview" ||
      input.license.spdxLicenseId !== "GPL-3.0" ||
      (input.license.toolId !== undefined &&
        input.license.toolId !== SHARPHOUND_COLLECTOR_TOOL_ID)
    ) {
      return fail(
        "sharphound_license_disposition_blocked",
        "SharpHound collector license disposition must remain GPL-3.0 RequiresLegalReview."
      );
    }
  }

  const parsed = SharpHoundCollectionProfileSchema.safeParse({
    bounds: {
      domainControllers,
      maxDepth,
      maxObjects,
      timeoutSeconds
    },
    collector: "sharphound",
    credentialTheft: false,
    executable: false,
    identities: input.identities,
    leastPrivilege: true,
    license: SHARPHOUND_COLLECTOR_LICENSE,
    liveAdCollection: false,
    liveSupported: false,
    methods,
    persistence: false,
    profileId: input.profileId,
    redaction: { ...SHARPHOUND_REQUIRED_REDACTION },
    targets: input.targets
  });

  if (!parsed.success) {
    return fail(
      "sharphound_profile_invalid",
      "SharpHound collection profile failed typed validation."
    );
  }

  return { ok: true, profile: parsed.data };
}

function pickString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function redactBloodHoundGraph(raw: unknown): BloodHoundImportedGraph {
  const record = isRecord(raw) ? raw : {};
  const nodesIn = Array.isArray(record.nodes) ? record.nodes : [];
  const edgesIn = Array.isArray(record.edges) ? record.edges : [];

  const nodes: BloodHoundImportedNode[] = [];
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
    nodes.push({
      id: picked.id,
      name: picked.name,
      type: picked.type,
      ...(picked.privilege ? { privilege: picked.privilege } : {}),
      ...(picked.criticality ? { criticality: picked.criticality } : {})
    });
  }

  const edges: BloodHoundImportedEdge[] = [];
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

function hopIdentity(source: string, relationship: string, target: string): string {
  return `${source.trim().toLowerCase()}|${relationship.trim().toLowerCase()}|${target.trim().toLowerCase()}`;
}

function isGraphImportModule(moduleId: string): boolean {
  return (
    moduleId === IDENTITY_GRAPH_IMPORT_MODULE_ID ||
    moduleId === SHARPHOUND_COLLECTOR_TOOL_ID ||
    /sharphound|bloodhound/i.test(moduleId)
  );
}

function independentReceipt(
  raw: unknown
): IndependentIdentityHopReceipt | null {
  const parsed = IndependentIdentityHopReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  const receipt = parsed.data;
  if (isGraphImportModule(receipt.moduleId)) {
    return null;
  }
  if (NON_UPGRADING_STATES.has(receipt.validationState)) {
    return null;
  }
  return receipt;
}

function placeholderPathEdge(input: {
  evidenceBasis: "Heuristic" | "Measured";
  evidenceIds: string[];
  measurementMethod: string | null;
}): AttackPath["pathEdges"][number] {
  const timestamp = "2026-09-17T00:00:00.000Z";
  return {
    createdAt: timestamp,
    evidenceBasis: input.evidenceBasis,
    evidenceIds: input.evidenceIds,
    measurementMethod: input.measurementMethod,
    pathEdgeId: randomUUID(),
    pathId: randomUUID(),
    rationale: "Identity graph hop",
    relationship: "CAN_ACCESS",
    sourceNodeId: randomUUID(),
    targetNodeId: randomUUID(),
    tenantId: randomUUID(),
    updatedAt: timestamp
  };
}

export function classifyBloodHoundImportedPath(input: {
  graph: BloodHoundImportedGraph;
  hopReceipts?: readonly unknown[];
  requestedValidationState?: ValidationState;
  riskBand?: RiskBand;
}): BloodHoundPathHonesty {
  void input.riskBand;
  const graph = redactBloodHoundGraph(input.graph);
  const receipts = (input.hopReceipts ?? [])
    .map(independentReceipt)
    .filter((receipt): receipt is IndependentIdentityHopReceipt => receipt !== null);
  const receiptByHop = new Map<string, IndependentIdentityHopReceipt>();
  for (const receipt of receipts) {
    receiptByHop.set(
      hopIdentity(receipt.source, receipt.relationship, receipt.target),
      receipt
    );
  }

  const edges: BloodHoundImportedEdgeHonesty[] = graph.edges.map((edge) => {
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
      evidenceIds: edge.evidenceIds,
      measurementMethod: edge.independentlyMeasured
        ? "independent hop receipt"
        : null
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
  const importedGraphIsNotProof = !fullyMeasured;

  return {
    claim,
    claimSafeValidationState: projection.claimSafeValidationState,
    collectionIsNotExploitation: true,
    edges,
    importedGraphIsNotProof,
    pathEdges
  };
}
