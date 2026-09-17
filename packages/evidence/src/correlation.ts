import { z } from "zod";

import {
  AssetTypeSchema,
  BusinessCriticalitySchema,
  EdgeRelationshipSchema,
  SeveritySchema,
  SignalEnvelopeSchema,
  ValidationStateSchema,
  type SignalEnvelope,
  type ValidationState
} from "@periscan/shared";

const SignalListSchema = z.array(SignalEnvelopeSchema);

const AssetNodeDraftSchema = z.object({
  assetType: AssetTypeSchema,
  businessCriticality: BusinessCriticalitySchema,
  entityType: z.literal("Asset"),
  // hypothesis=true marks a node that is NOT a discovered asset. The persistence
  // layer must NOT mint a placeholder Asset row for these; it links them to the
  // real source asset (or a real asset resolved via relatedAssetId) and labels
  // them as a heuristic reachability hypothesis (Real-First Rule, AGENTS.md).
  hypothesis: z.boolean().default(false),
  // Real discovered asset id (from a contributing signal's relatedAssetIds), when
  // known. Lets persistence bind a downstream node to a real asset instead of
  // fabricating one.
  relatedAssetId: z.string().uuid().nullish(),
  internetExposed: z.boolean(),
  key: z.string().min(1),
  label: z.string().min(1),
  tags: z.array(z.string().min(1)).default([])
});

const ExposureNodeDraftSchema = z.object({
  asset: z.object({
    assetType: AssetTypeSchema,
    businessCriticality: BusinessCriticalitySchema,
    internetExposed: z.boolean(),
    key: z.string().min(1),
    label: z.string().min(1),
    tags: z.array(z.string().min(1)).default([])
  }),
  confidence: z.number().min(0).max(1),
  entityType: z.literal("Exposure"),
  exposureType: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  severity: SeveritySchema,
  source: z.string().min(1),
  validationState: ValidationStateSchema
});

const CorrelatedPathNodeDraftSchema = z.discriminatedUnion("entityType", [
  AssetNodeDraftSchema,
  ExposureNodeDraftSchema
]);

const CorrelatedPathEdgeDraftSchema = z.object({
  evidenceBasis: z.enum(["Measured", "Heuristic"]).optional(),
  evidenceIds: z.array(z.string().uuid()).default([]),
  measurementMethod: z.string().min(1).optional(),
  rationale: z.string().min(1),
  relationship: EdgeRelationshipSchema,
  sourceKey: z.string().min(1),
  targetKey: z.string().min(1)
});

const CorrelatedPathBreakerDraftSchema = z.object({
  description: z.string().min(1),
  evidenceIds: z.array(z.string().uuid()).default([]),
  priority: z.number().int().min(1).max(5),
  relatedNodeKey: z.string().min(1).nullish(),
  title: z.string().min(1)
});

export const CorrelatedPathDraftSchema = z.object({
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string().uuid()).default([]),
  // heuristic=true means downstream reachability is inferred from a known
  // attack pattern, not measured end-to-end. impactScore is therefore a
  // heuristic estimate and must be surfaced/persisted as such.
  heuristic: z.boolean().default(true),
  methodology: z.string().min(1).default("heuristic-pattern-correlation"),
  impactScore: z.number().min(0).max(100),
  name: z.string().min(1),
  nodes: z.array(CorrelatedPathNodeDraftSchema).min(2),
  pathBreakers: z.array(CorrelatedPathBreakerDraftSchema).default([]),
  patternId: z.string().min(1),
  validationState: ValidationStateSchema,
  edges: z.array(CorrelatedPathEdgeDraftSchema).min(1)
});

export type CorrelatedPathNodeDraft = z.infer<
  typeof CorrelatedPathNodeDraftSchema
>;
export type CorrelatedPathEdgeDraft = z.infer<
  typeof CorrelatedPathEdgeDraftSchema
>;
export type CorrelatedPathBreakerDraft = z.infer<
  typeof CorrelatedPathBreakerDraftSchema
>;
export type CorrelatedPathDraft = z.infer<typeof CorrelatedPathDraftSchema>;

function appendUniqueIds(...lists: string[][]) {
  return [...new Set(lists.flat())];
}

function averageConfidence(signals: SignalEnvelope[]) {
  if (signals.length === 0) {
    return 0.5;
  }

  const total = signals.reduce(
    (sum, signal) => sum + (signal.confidence ?? 0.5),
    0
  );

  return Number((total / signals.length).toFixed(2));
}

function filterSignals(
  signals: SignalEnvelope[],
  signalCategory: SignalEnvelope["signalCategory"],
  signalSubcategory?: string
) {
  return signals.filter(
    (signal) =>
      signal.signalCategory === signalCategory &&
      (signalSubcategory
        ? signal.signalSubcategory === signalSubcategory
        : true)
  );
}

function signalText(signal: SignalEnvelope) {
  return [
    signal.signalCategory,
    signal.signalSubcategory ?? "",
    signal.sourceType,
    signal.sourceVendor,
    signal.freshness ?? ""
  ]
    .join(" ")
    .toLowerCase();
}

function isMissedControlSignal(signal: SignalEnvelope) {
  if (signal.signalCategory !== "ControlObservation") {
    return false;
  }

  const text = signalText(signal);

  return (
    text.includes("missed") ||
    text.includes("no evidence") ||
    text.includes("noevidence") ||
    text.includes("undetected")
  );
}

function createRepoSecretToRolePath(
  repoSignal: SignalEnvelope,
  cloudSignal: SignalEnvelope
): CorrelatedPathDraft {
  const evidenceIds = appendUniqueIds(
    repoSignal.evidenceIds,
    cloudSignal.evidenceIds
  );

  return CorrelatedPathDraftSchema.parse({
    confidence: averageConfidence([repoSignal, cloudSignal]),
    edges: [
      {
        evidenceIds,
        rationale:
          "A validated repository secret can seed cloud credential use against a production role.",
        relationship: "CAN_ACCESS",
        sourceKey: "exposure:repo-secret",
        targetKey: "asset:cloud-role"
      },
      {
        evidenceIds,
        rationale:
          "The assumed production role retains access into the target workload boundary.",
        relationship: "CAN_ACCESS",
        sourceKey: "asset:cloud-role",
        targetKey: "asset:prod-workload"
      }
    ],
    evidenceIds,
    heuristic: true,
    methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
    impactScore: 86,
    name: "Repository secret to production cloud role",
    nodes: [
      {
        asset: {
          assetType: "Repository",
          businessCriticality: "High",
          internetExposed: false,
          key: "asset:repo-scope",
          label: "Authorized repository scope",
          tags: ["code", "github", "seed"]
        },
        confidence: repoSignal.confidence,
        entityType: "Exposure",
        exposureType: "RepositorySecret",
        key: "exposure:repo-secret",
        label: "Repository secret exposure",
        severity: "Critical",
        source: repoSignal.sourceType,
        validationState: "Validated"
      },
      {
        assetType: "CloudResource",
        businessCriticality: "High",
        entityType: "Asset",
        hypothesis: true,
        relatedAssetId: cloudSignal.relatedAssetIds[0] ?? null,
        internetExposed: false,
        key: "asset:cloud-role",
        label: "Production cloud role (heuristic hypothesis)",
        tags: ["cloud", "iam", "privileged", "heuristic"]
      },
      {
        assetType: "CloudResource",
        businessCriticality: "Critical",
        entityType: "Asset",
        hypothesis: true,
        relatedAssetId: cloudSignal.relatedAssetIds[1] ?? null,
        internetExposed: false,
        key: "asset:prod-workload",
        label: "Production workload (heuristic hypothesis)",
        tags: ["cloud", "production", "heuristic"]
      }
    ],
    pathBreakers: [
      {
        description:
          "Rotate the secret, revoke the downstream session, and remove the role path from repository-derived credentials.",
        evidenceIds,
        priority: 1,
        relatedNodeKey: "exposure:repo-secret",
        title: "Rotate the exposed secret"
      }
    ],
    patternId: "repo-secret-cloud-role",
    // Heuristic pattern correlation: the seed exposure is measured, but the
    // path's downstream reachability/impact is INFERRED, not measured. Honest
    // proof state is "Discovered" (identified, not measured-validated) — never
    // "Validated", which is reserved for measured/confirmed paths. measured >
    // heuristic. (evidenceBasis is also surfaced as Heuristic downstream.)
    validationState: "Discovered"
  });
}

function createRepoSecretToDataPath(
  repoSignal: SignalEnvelope,
  cloudSignal: SignalEnvelope
): CorrelatedPathDraft {
  const evidenceIds = appendUniqueIds(
    repoSignal.evidenceIds,
    cloudSignal.evidenceIds
  );

  return CorrelatedPathDraftSchema.parse({
    confidence: averageConfidence([repoSignal, cloudSignal]),
    edges: [
      {
        evidenceIds,
        rationale:
          "The repository secret can be exchanged for production cloud access.",
        relationship: "CAN_ACCESS",
        sourceKey: "exposure:repo-secret",
        targetKey: "asset:cloud-role"
      },
      {
        evidenceIds,
        rationale:
          "The production role can reach a high-value data store inside the cloud account.",
        relationship: "CAN_ACCESS",
        sourceKey: "asset:cloud-role",
        targetKey: "asset:prod-data"
      }
    ],
    evidenceIds,
    heuristic: true,
    methodology: "heuristic-pattern-correlation:repo-secret-production-data",
    impactScore: 93,
    name: "Repository secret to production data store",
    nodes: [
      {
        asset: {
          assetType: "Repository",
          businessCriticality: "High",
          internetExposed: false,
          key: "asset:repo-scope",
          label: "Authorized repository scope",
          tags: ["code", "github", "seed"]
        },
        confidence: repoSignal.confidence,
        entityType: "Exposure",
        exposureType: "RepositorySecret",
        key: "exposure:repo-secret",
        label: "Repository secret exposure",
        severity: "Critical",
        source: repoSignal.sourceType,
        validationState: "Validated"
      },
      {
        assetType: "CloudResource",
        businessCriticality: "High",
        entityType: "Asset",
        hypothesis: true,
        relatedAssetId: cloudSignal.relatedAssetIds[0] ?? null,
        internetExposed: false,
        key: "asset:cloud-role",
        label: "Production cloud role (heuristic hypothesis)",
        tags: ["cloud", "iam", "privileged", "heuristic"]
      },
      {
        assetType: "CloudResource",
        businessCriticality: "Critical",
        entityType: "Asset",
        hypothesis: true,
        relatedAssetId: cloudSignal.relatedAssetIds[1] ?? null,
        internetExposed: false,
        key: "asset:prod-data",
        label: "Production data store (heuristic hypothesis)",
        tags: ["cloud", "database", "production", "heuristic"]
      }
    ],
    pathBreakers: [
      {
        description:
          "Rotate the secret, remove the role binding, and verify the production data store is no longer reachable from repository-derived credentials.",
        evidenceIds,
        priority: 1,
        relatedNodeKey: "asset:cloud-role",
        title: "Remove the role path"
      }
    ],
    patternId: "repo-secret-production-data",
    // Heuristic: downstream reach to production data is inferred, not measured.
    validationState: "Discovered"
  });
}

function createInternetExposurePath(
  externalSignal: SignalEnvelope,
  cloudSignal: SignalEnvelope
): CorrelatedPathDraft {
  const evidenceIds = appendUniqueIds(
    externalSignal.evidenceIds,
    cloudSignal.evidenceIds
  );

  return CorrelatedPathDraftSchema.parse({
    confidence: averageConfidence([externalSignal, cloudSignal]),
    edges: [
      {
        evidenceIds,
        rationale:
          "The external service remains internet-reachable and can lead toward the associated production workload.",
        relationship: "LEADS_TO",
        sourceKey: "exposure:internet-facing-service",
        targetKey: "asset:internet-service"
      },
      {
        evidenceIds,
        rationale:
          "The public service boundary still exposes a path into the production workload.",
        relationship: "CAN_ACCESS",
        sourceKey: "asset:internet-service",
        targetKey: "asset:prod-workload"
      }
    ],
    evidenceIds,
    heuristic: true,
    methodology:
      "heuristic-pattern-correlation:internet-facing-production-workload",
    impactScore: 78,
    name: "Internet-facing service to production workload",
    nodes: [
      {
        asset: {
          assetType: "Service",
          businessCriticality: "High",
          internetExposed: true,
          key: "asset:internet-service",
          label: "Internet-facing service",
          tags: ["external", "service"]
        },
        confidence: externalSignal.confidence,
        entityType: "Exposure",
        exposureType: "ExternalExposure",
        key: "exposure:internet-facing-service",
        label: "External exposure",
        severity: "High",
        source: externalSignal.sourceType,
        validationState: "Reachable"
      },
      {
        assetType: "Service",
        businessCriticality: "High",
        entityType: "Asset",
        relatedAssetId: externalSignal.relatedAssetIds[0] ?? null,
        internetExposed: true,
        key: "asset:internet-service",
        label: "Internet-facing service",
        tags: ["external", "service"]
      },
      {
        assetType: "CloudResource",
        businessCriticality: "Critical",
        entityType: "Asset",
        hypothesis: true,
        relatedAssetId: cloudSignal.relatedAssetIds[0] ?? null,
        internetExposed: false,
        key: "asset:prod-workload",
        label: "Production workload (heuristic hypothesis)",
        tags: ["cloud", "production", "heuristic"]
      }
    ],
    pathBreakers: [
      {
        description:
          "Restrict public exposure, tighten ingress controls, and rerun the external validation against the verified scope.",
        evidenceIds,
        priority: 1,
        relatedNodeKey: "exposure:internet-facing-service",
        title: "Restrict the public entry point"
      }
    ],
    patternId: "internet-facing-production-workload",
    validationState: "Reachable"
  });
}

function createAiAppRiskPath(aiSignal: SignalEnvelope): CorrelatedPathDraft {
  const evidenceIds = appendUniqueIds(aiSignal.evidenceIds);

  return CorrelatedPathDraftSchema.parse({
    confidence: aiSignal.confidence,
    edges: [
      {
        evidenceIds,
        rationale:
          "The AI app risk could lead to sensitive data access if the control path stays unchanged.",
        relationship: "LEADS_TO",
        sourceKey: "exposure:ai-app-risk",
        targetKey: "asset:sensitive-data"
      }
    ],
    evidenceIds,
    heuristic: true,
    methodology: "heuristic-pattern-correlation:ai-app-sensitive-data",
    impactScore: 74,
    name: "AI app risk to sensitive data access",
    nodes: [
      {
        asset: {
          assetType: "Application",
          businessCriticality: "High",
          internetExposed: true,
          key: "asset:ai-app",
          label: "Registered AI application",
          tags: ["ai", "application"]
        },
        confidence: aiSignal.confidence,
        entityType: "Exposure",
        exposureType: "AIAppRisk",
        key: "exposure:ai-app-risk",
        label: "AI application risk",
        severity: "High",
        source: aiSignal.sourceType,
        validationState: "Validated"
      },
      {
        assetType: "Application",
        businessCriticality: "Critical",
        entityType: "Asset",
        hypothesis: true,
        relatedAssetId: aiSignal.relatedAssetIds[0] ?? null,
        internetExposed: false,
        key: "asset:sensitive-data",
        label: "Sensitive data access surface (heuristic hypothesis)",
        tags: ["data", "sensitive", "heuristic"]
      }
    ],
    pathBreakers: [
      {
        description:
          "Restrict the AI app data source and rerun the safe validation harness with the same test account.",
        evidenceIds,
        priority: 1,
        relatedNodeKey: "exposure:ai-app-risk",
        title: "Restrict AI app data access"
      }
    ],
    patternId: "ai-app-sensitive-data",
    // Heuristic: AI-app reach to sensitive data is inferred, not measured.
    validationState: "Discovered"
  });
}

function createMissedControlToExposurePath(
  controlSignal: SignalEnvelope,
  exposureSignal: SignalEnvelope
): CorrelatedPathDraft {
  const evidenceIds = appendUniqueIds(
    controlSignal.evidenceIds,
    exposureSignal.evidenceIds
  );
  const controlLabel = controlSignal.signalSubcategory
    ? `Missed control response: ${controlSignal.signalSubcategory}`
    : `Missed control response from ${controlSignal.sourceVendor}`;
  const exposureLabel = exposureSignal.signalSubcategory
    ? `Real exposure: ${exposureSignal.signalSubcategory}`
    : "Real exposure with missing control response";

  return CorrelatedPathDraftSchema.parse({
    confidence: averageConfidence([controlSignal, exposureSignal]),
    edges: [
      {
        evidenceIds: controlSignal.evidenceIds,
        rationale:
          "Control-observation evidence shows the validation activity was missed or had no matching detection evidence.",
        relationship: "MISSED_BY",
        sourceKey: "exposure:missed-control-response",
        targetKey: "asset:undetected-activity"
      },
      {
        evidenceIds,
        rationale:
          "The missed control response leaves the related real exposure actionable until the control is tuned and the exposure is revalidated.",
        relationship: "LEADS_TO",
        sourceKey: "asset:undetected-activity",
        targetKey: "exposure:control-missed-real-exposure"
      }
    ],
    evidenceIds,
    heuristic: true,
    methodology: "heuristic-pattern-correlation:missed-control-real-exposure",
    impactScore: 82,
    name: "Missed control to real exposure",
    nodes: [
      {
        asset: {
          assetType: "Service",
          businessCriticality: "High",
          internetExposed: false,
          key: "asset:control-telemetry-gap",
          label: "Control telemetry gap",
          tags: ["control", "detection", "missed"]
        },
        confidence: controlSignal.confidence ?? 0.75,
        entityType: "Exposure",
        exposureType: "MissedControlObservation",
        key: "exposure:missed-control-response",
        label: controlLabel,
        severity: "High",
        source: controlSignal.sourceType,
        validationState: "Missed"
      },
      {
        assetType: "Service",
        businessCriticality: "High",
        entityType: "Asset",
        hypothesis: true,
        relatedAssetId: exposureSignal.relatedAssetIds[0] ?? null,
        internetExposed: false,
        key: "asset:undetected-activity",
        label: "Undetected validation activity (heuristic hypothesis)",
        tags: ["control", "undetected", "heuristic"]
      },
      {
        asset: {
          assetType: "Service",
          businessCriticality: "High",
          internetExposed:
            signalText(exposureSignal).includes("external") ||
            signalText(exposureSignal).includes("internet") ||
            signalText(exposureSignal).includes("public"),
          key: "asset:control-missed-real-exposure",
          label: "Real exposure associated with missed control response",
          tags: ["exposure", "control-response"]
        },
        confidence: exposureSignal.confidence ?? 0.75,
        entityType: "Exposure",
        exposureType: exposureSignal.signalSubcategory ?? "RealExposure",
        key: "exposure:control-missed-real-exposure",
        label: exposureLabel,
        severity: "High",
        source: exposureSignal.sourceType,
        validationState: signalText(exposureSignal).includes("reachable")
          ? "Reachable"
          : "Discovered"
      }
    ],
    pathBreakers: [
      {
        description:
          "Tune or enable the missed control, rerun the control validation, then revalidate the related exposure so closure is backed by fresh evidence.",
        evidenceIds,
        priority: 1,
        relatedNodeKey: "exposure:missed-control-response",
        title: "Tune the missed control and revalidate"
      }
    ],
    patternId: "missed-control-real-exposure",
    validationState: "Missed"
  });
}

// --- Measured (non-heuristic) correlation ---------------------------------
// The builders below derive paths from authoritative configuration rather than
// inferring downstream reachability from an attack pattern. They set
// heuristic=false and never emit a hypothesis node: every node is a real,
// measured entity. validationState is "Reachable" (the network path is open per
// authoritative config) and deliberately NOT "Exploitable", which would require
// an active probe against verified scope.

function parseDigitalOceanInternetOpenPointer(
  pointer: string | null | undefined
) {
  if (!pointer) {
    return null;
  }

  try {
    const url = new URL(pointer);
    const dropletName = url.searchParams.get("droplet");
    const portsDescriptor = url.searchParams.get("ports");

    if (!dropletName || !portsDescriptor) {
      return null;
    }

    return { dropletName, portsDescriptor };
  } catch {
    return null;
  }
}

function digitalOceanDescriptorPorts(descriptor: string): number[] {
  return descriptor
    .split(",")
    .map((entry) => {
      const match = entry.match(/\/(\d+)/u);

      return match ? Number(match[1]) : Number.NaN;
    })
    .filter((value) => Number.isFinite(value));
}

const DIGITALOCEAN_ADMIN_PORTS = new Set([22, 23, 135, 445, 2375, 2376, 3389]);
const DIGITALOCEAN_DATA_PORTS = new Set([
  1433, 1521, 3306, 5432, 5984, 6379, 9200, 11211, 27017
]);

function digitalOceanInternetOpenImpactScore(ports: number[]): number {
  let impactScore = 55;

  if (ports.some((port) => DIGITALOCEAN_ADMIN_PORTS.has(port))) {
    impactScore += 25;
  }

  if (ports.some((port) => DIGITALOCEAN_DATA_PORTS.has(port))) {
    impactScore += 15;
  }

  return Math.min(95, impactScore);
}

function createDigitalOceanInternetOpenPortPath(
  signal: SignalEnvelope
): CorrelatedPathDraft | null {
  const parsed = parseDigitalOceanInternetOpenPointer(signal.rawPayloadPointer);

  if (!parsed) {
    return null;
  }

  const evidenceIds = appendUniqueIds(signal.evidenceIds);
  const assetLabel = `digitalocean-droplet/${parsed.dropletName}`;
  const ports = digitalOceanDescriptorPorts(parsed.portsDescriptor);
  const impactScore = digitalOceanInternetOpenImpactScore(ports);
  const exposureKey = "exposure:do-internet-open-port";
  const assetKey = "asset:do-droplet";

  return CorrelatedPathDraftSchema.parse({
    confidence: signal.confidence ?? 0.95,
    edges: [
      {
        evidenceBasis: "Measured",
        evidenceIds,
        measurementMethod: "authoritative-config:digitalocean-firewall-ingress",
        rationale: `DigitalOcean firewall configuration permits the public internet (0.0.0.0/0 or ::/0) to reach ${parsed.portsDescriptor} on this Droplet. Measured directly from authoritative firewall configuration.`,
        relationship: "CAN_ACCESS",
        sourceKey: exposureKey,
        targetKey: assetKey
      }
    ],
    evidenceIds,
    heuristic: false,
    impactScore,
    methodology:
      "measured-config-analysis:digitalocean-firewall-internet-open-port",
    name: `Internet-exposed sensitive port on ${assetLabel}`,
    nodes: [
      {
        asset: {
          assetType: "CloudResource",
          businessCriticality: "High",
          internetExposed: true,
          key: assetKey,
          label: assetLabel,
          tags: ["digitalocean", "droplet"]
        },
        confidence: signal.confidence ?? 0.95,
        entityType: "Exposure",
        exposureType: "InternetReachablePort",
        key: exposureKey,
        label: `Sensitive service port open to the internet (${parsed.portsDescriptor})`,
        severity: "High",
        source: signal.sourceType,
        // Config proves the port is reachable from the internet, not that a
        // service is listening or exploitable.
        validationState: "Reachable"
      },
      {
        assetType: "CloudResource",
        businessCriticality: "High",
        entityType: "Asset",
        // A real, discovered Droplet — not a hypothesis. Persistence binds this
        // node to the existing asset by matching assetType + label.
        hypothesis: false,
        internetExposed: true,
        key: assetKey,
        label: assetLabel,
        tags: ["digitalocean", "droplet"]
      }
    ],
    pathBreakers: [
      {
        description: `Scope the DigitalOcean firewall inbound rule(s) for ${parsed.portsDescriptor} to trusted source ranges (remove 0.0.0.0/0 and ::/0), or place the Droplet behind a bastion/VPN, then re-run validation to confirm the port is no longer internet-reachable.`,
        evidenceIds,
        priority: 1,
        relatedNodeKey: exposureKey,
        title: `Restrict public ingress to ${parsed.portsDescriptor}`
      }
    ],
    patternId: "digitalocean-internet-open-sensitive-port",
    validationState: "Reachable"
  });
}

// --- Measured multi-hop edge: reachability → exploitation --------------------
// Fuses two RUNNER-MEASURED signals for the SAME host into one path whose every
// edge is measured, not inferred: a measured TCP-reachability probe (edge 1,
// Reachable) and an actively-confirmed credentialed-CORS exploit (edge 2,
// Exploitable). heuristic=false, so evidenceBasis persists as Measured — the
// path legitimately tops out at Exploitable because a real probe confirmed it.

function measuredPointerHost(
  pointer: string | null | undefined
): string | null {
  if (!pointer) {
    return null;
  }

  const match = pointer.match(/^periscan-[a-z]+:\/\/([^/?]+)/u);

  return match ? match[1]! : null;
}

function createMeasuredReachabilityExploitPath(
  host: string,
  reachabilitySignal: SignalEnvelope,
  exploitSignal: SignalEnvelope
): CorrelatedPathDraft {
  const reachEvidence = appendUniqueIds(reachabilitySignal.evidenceIds);
  const exploitEvidence = appendUniqueIds(exploitSignal.evidenceIds);
  const allEvidence = appendUniqueIds(
    reachabilitySignal.evidenceIds,
    exploitSignal.evidenceIds
  );
  const hostKey = `asset:measured-host:${host}`;
  const reachKey = `exposure:measured-reachable:${host}`;
  const exploitKey = `exposure:measured-cors-exploit:${host}`;
  const assetForExposure = {
    assetType: "CloudResource" as const,
    businessCriticality: "High" as const,
    internetExposed: true,
    key: hostKey,
    label: host,
    tags: ["measured"]
  };

  return CorrelatedPathDraftSchema.parse({
    confidence: Math.min(
      reachabilitySignal.confidence ?? 0.95,
      exploitSignal.confidence ?? 0.95
    ),
    edges: [
      {
        evidenceBasis: "Measured",
        evidenceIds: reachEvidence,
        measurementMethod: "runner-probe:tcp-connect",
        rationale: `Measured: a single TCP connection to ${host} succeeded — the port accepts connections. Runner-measured reachability, not inferred.`,
        relationship: "CAN_ACCESS",
        sourceKey: reachKey,
        targetKey: hostKey
      },
      {
        evidenceBasis: "Measured",
        evidenceIds: exploitEvidence,
        measurementMethod: "runner-probe:credentialed-cors",
        rationale: `Measured: a credentialed cross-origin request to ${host} was actively confirmed to succeed — a working CORS exploit that reads the authenticated response. Runner-measured exploitation, not inferred.`,
        relationship: "LEADS_TO",
        sourceKey: hostKey,
        targetKey: exploitKey
      }
    ],
    evidenceIds: allEvidence,
    heuristic: false,
    impactScore: 88,
    methodology: "measured-runner-probe:reachability-then-exploit",
    name: `Measured reachable → exploitable path on ${host}`,
    nodes: [
      {
        asset: assetForExposure,
        confidence: reachabilitySignal.confidence ?? 0.95,
        entityType: "Exposure",
        exposureType: "InternetReachablePort",
        key: reachKey,
        label: `TCP port reachable on ${host}`,
        severity: "Medium",
        source: reachabilitySignal.sourceType,
        // Reachability is measured, but reachability alone is not exploitable.
        validationState: "Reachable"
      },
      {
        assetType: "CloudResource",
        businessCriticality: "High",
        entityType: "Asset",
        hypothesis: false,
        internetExposed: true,
        key: hostKey,
        label: host,
        tags: ["measured"]
      },
      {
        asset: assetForExposure,
        confidence: exploitSignal.confidence ?? 0.98,
        entityType: "Exposure",
        exposureType: "CredentialedCorsExploit",
        key: exploitKey,
        label: `Credentialed CORS exploit confirmed on ${host}`,
        severity: "High",
        source: exploitSignal.sourceType,
        // Actively confirmed by a real probe → Exploitable (measured).
        validationState: "Exploitable"
      }
    ],
    pathBreakers: [
      {
        description: `Restrict CORS on ${host} to trusted origins and stop reflecting arbitrary Origin with Access-Control-Allow-Credentials: true, then re-run the measured probe to confirm the credentialed cross-origin read no longer succeeds.`,
        evidenceIds: exploitEvidence,
        priority: 1,
        relatedNodeKey: exploitKey,
        title: `Lock down credentialed CORS on ${host}`
      }
    ],
    patternId: "measured-reachability-exploit",
    validationState: "Exploitable"
  });
}

function isMeasuredKubernetesCisFailure(signal: SignalEnvelope) {
  return (
    signal.signalCategory === "Cloud" &&
    signal.signalSubcategory === "KubernetesCisControlFailed" &&
    signal.rawPayloadPointer?.startsWith("periscan-kubernetes://") === true &&
    signal.evidenceIds.length > 0 &&
    signal.relatedAssetIds.length > 0
  );
}

function isMeasuredPublicExposure(signal: SignalEnvelope) {
  return (
    signal.signalCategory === "Cloud" &&
    signal.signalSubcategory === "PublicExposure" &&
    signal.rawPayloadPointer !== null &&
    signal.evidenceIds.length > 0 &&
    signal.relatedAssetIds.length > 0
  );
}

function sharedAssetId(left: SignalEnvelope, right: SignalEnvelope) {
  const rightIds = new Set(right.relatedAssetIds);
  return left.relatedAssetIds.find((assetId) => rightIds.has(assetId)) ?? null;
}

function createMeasuredKubernetesExposurePath(
  assetId: string,
  exposureSignal: SignalEnvelope,
  cisSignal: SignalEnvelope
): CorrelatedPathDraft {
  const exposureEvidence = appendUniqueIds(exposureSignal.evidenceIds);
  const cisEvidence = appendUniqueIds(cisSignal.evidenceIds);
  const allEvidence = appendUniqueIds(exposureEvidence, cisEvidence);
  const suffix = assetId.slice(0, 8);
  const ingressKey = `asset:kubernetes-public-ingress:${assetId}`;
  const clusterKey = `asset:kubernetes-cluster:${assetId}`;
  const controlKey = `asset:kubernetes-cis-boundary:${assetId}`;

  return CorrelatedPathDraftSchema.parse({
    confidence: Math.min(
      exposureSignal.confidence ?? 0.9,
      cisSignal.confidence ?? 0.95
    ),
    edges: [
      {
        evidenceBasis: "Measured",
        evidenceIds: exposureEvidence,
        measurementMethod: `authoritative-config:${exposureSignal.sourceType}`,
        rationale:
          "Authoritative cloud or inventory evidence identifies this persisted Kubernetes asset as publicly exposed.",
        relationship: "EXPOSES",
        sourceKey: ingressKey,
        targetKey: clusterKey
      },
      {
        evidenceBasis: "Measured",
        evidenceIds: cisEvidence,
        measurementMethod: "live-collector:kubernetes-cis-posture",
        rationale:
          "A live Kubernetes posture collector measured one or more failed CIS controls on the same persisted asset.",
        relationship: "AFFECTED_BY",
        sourceKey: clusterKey,
        targetKey: controlKey
      }
    ],
    evidenceIds: allEvidence,
    heuristic: false,
    impactScore: 76,
    methodology:
      "measured-evidence-fusion:public-exposure-and-kubernetes-cis-failure",
    name: `Measured public Kubernetes exposure with failed CIS controls · ${suffix}`,
    nodes: [
      {
        assetType: "Service",
        businessCriticality: "High",
        entityType: "Asset",
        hypothesis: false,
        internetExposed: true,
        key: ingressKey,
        label: "Measured public ingress",
        relatedAssetId: assetId,
        tags: ["kubernetes", "public-exposure", "measured"]
      },
      {
        assetType: "CloudResource",
        businessCriticality: "High",
        entityType: "Asset",
        hypothesis: false,
        internetExposed: true,
        key: clusterKey,
        label: "Persisted Kubernetes cluster",
        relatedAssetId: assetId,
        tags: ["kubernetes", "cluster", "measured"]
      },
      {
        assetType: "CloudResource",
        businessCriticality: "High",
        entityType: "Asset",
        hypothesis: false,
        internetExposed: true,
        key: controlKey,
        label: "Measured failed Kubernetes CIS boundary",
        relatedAssetId: assetId,
        tags: ["kubernetes", "cis", "failed-control", "measured"]
      }
    ],
    pathBreakers: [
      {
        description:
          "Restrict public ingress to approved source ranges, remediate the failed CIS controls, and rerun both measurements against the same asset.",
        evidenceIds: allEvidence,
        priority: 1,
        relatedNodeKey: clusterKey,
        title: "Close public ingress and failed CIS controls"
      }
    ],
    patternId: "measured-kubernetes-exposure-cis",
    // This proves exposure plus a failed posture boundary. It does not claim a
    // container escape, compromise, or exploit.
    validationState: "Validated"
  });
}

export function correlateAttackPathsFromSignals(input: {
  signals: SignalEnvelope[];
}): CorrelatedPathDraft[] {
  const signals = SignalListSchema.parse(input.signals);
  const repoSecretSignals = filterSignals(
    signals,
    "Repository",
    "SecretScanCandidate"
  );
  const cloudSignals = filterSignals(signals, "Cloud", "PublicExposure");
  const externalSignals = filterSignals(
    signals,
    "Exposure",
    "ExternalExposure"
  );
  const exposureSignals = filterSignals(signals, "Exposure");
  const missedControlSignals = signals.filter(isMissedControlSignal);
  const aiRiskSignals = signals.filter(
    (signal) =>
      signal.signalCategory === "AIApplication" &&
      !["GuardrailHeld", "Passed"].includes(signal.signalSubcategory ?? "")
  );
  const drafts: CorrelatedPathDraft[] = [];

  if (repoSecretSignals[0] && cloudSignals[0]) {
    drafts.push(
      createRepoSecretToRolePath(repoSecretSignals[0], cloudSignals[0]),
      createRepoSecretToDataPath(repoSecretSignals[0], cloudSignals[0])
    );
  }

  if (externalSignals[0] && cloudSignals[0]) {
    drafts.push(
      createInternetExposurePath(externalSignals[0], cloudSignals[0])
    );
  }

  if (aiRiskSignals[0]) {
    drafts.push(createAiAppRiskPath(aiRiskSignals[0]));
  }

  if (missedControlSignals[0] && exposureSignals[0]) {
    drafts.push(
      createMissedControlToExposurePath(
        missedControlSignals[0],
        exposureSignals[0]
      )
    );
  }

  // Measured: one path per Droplet whose authoritative firewall config exposes a
  // sensitive port to the public internet.
  const digitalOceanInternetOpenSignals = signals.filter(
    (signal) =>
      signal.signalSubcategory === "DigitalOceanInternetOpenSensitivePort"
  );

  for (const signal of digitalOceanInternetOpenSignals) {
    const draft = createDigitalOceanInternetOpenPortPath(signal);

    if (draft) {
      drafts.push(draft);
    }
  }

  // Measured multi-hop: fuse a runner-measured reachability probe with a
  // runner-measured credentialed-CORS exploit for the SAME host into one path
  // whose edges are both measured (Reachable → Exploitable).
  const reachabilityByHost = new Map<string, SignalEnvelope>();
  for (const signal of signals) {
    if (signal.signalSubcategory !== "TcpPortReachable") {
      continue;
    }
    const host = measuredPointerHost(signal.rawPayloadPointer);
    if (host && !reachabilityByHost.has(host)) {
      reachabilityByHost.set(host, signal);
    }
  }
  const fusedHosts = new Set<string>();
  for (const signal of signals) {
    if (signal.signalSubcategory !== "HttpCredentialedCorsExploit") {
      continue;
    }
    const host = measuredPointerHost(signal.rawPayloadPointer);
    if (!host || fusedHosts.has(host)) {
      continue;
    }
    const reachability = reachabilityByHost.get(host);
    if (reachability) {
      fusedHosts.add(host);
      drafts.push(
        createMeasuredReachabilityExploitPath(host, reachability, signal)
      );
    }
  }

  const measuredPublicExposureSignals = signals.filter(
    isMeasuredPublicExposure
  );
  const fusedKubernetesAssets = new Set<string>();
  for (const cisSignal of signals.filter(isMeasuredKubernetesCisFailure)) {
    const matchingExposure = measuredPublicExposureSignals.find((signal) =>
      sharedAssetId(signal, cisSignal)
    );
    if (!matchingExposure) continue;
    const assetId = sharedAssetId(matchingExposure, cisSignal);
    if (!assetId || fusedKubernetesAssets.has(assetId)) continue;
    fusedKubernetesAssets.add(assetId);
    drafts.push(
      createMeasuredKubernetesExposurePath(assetId, matchingExposure, cisSignal)
    );
  }

  return drafts;
}

export function summarizeCorrelationState(
  paths: CorrelatedPathDraft[]
): ValidationState {
  if (paths.some((path) => path.validationState === "Validated")) {
    return "Validated";
  }

  if (paths.some((path) => path.validationState === "Reachable")) {
    return "Reachable";
  }

  return "Discovered";
}
