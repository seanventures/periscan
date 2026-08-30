import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { AttackPath, RiskScore, SignalEnvelope } from "@periscan/shared";

import { correlateAttackPathsFromSignals } from "./correlation";
import { generateRemediationTaskDraft } from "./remediation";
import { assessAttackPathRisk, calculateRiskScore } from "./risk";

function createSignal(
  input: Pick<SignalEnvelope, "signalCategory" | "signalSubcategory"> & {
    confidence?: number;
    evidenceIds?: string[];
    relatedAssetIds?: string[];
    relatedControlIds?: string[];
    sourceType?: string;
    sourceVendor?: string;
    techniqueIds?: string[];
  }
): SignalEnvelope {
  const timestamp = new Date().toISOString();

  return {
    confidence: input.confidence ?? 0.85,
    createdAt: timestamp,
    evidenceIds: input.evidenceIds ?? [randomUUID()],
    freshness: "Fresh",
    rawPayloadPointer: null,
    redactionStatus: "Redacted",
    relatedAssetIds: input.relatedAssetIds ?? [],
    relatedControlIds: input.relatedControlIds ?? [],
    relatedEvidenceIds: [],
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate",
    signalCategory: input.signalCategory,
    signalId: randomUUID(),
    signalSubcategory: input.signalSubcategory,
    sourceIntegrationId: null,
    sourceType:
      input.sourceType ?? `fixture.${input.signalCategory.toLowerCase()}`,
    sourceVendor: input.sourceVendor ?? "Periscan",
    tenantId: randomUUID(),
    techniqueIds: input.techniqueIds,
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp
  };
}

function createAttackPathFixture(): AttackPath {
  const timestamp = new Date().toISOString();
  const tenantId = randomUUID();
  const pathId = randomUUID();
  const exposureNodeId = randomUUID();
  const roleNodeId = randomUUID();
  const assetNodeId = randomUUID();
  const evidenceId = randomUUID();

  return {
    confidence: 0.92,
    createdAt: timestamp,
    entryNodeId: exposureNodeId,
    evidenceBasis: "Heuristic",
    evidenceIds: [evidenceId],
    impactNodeId: assetNodeId,
    impactScore: 91,
    name: "Repository secret to production cloud role",
    pathBreakers: [
      {
        createdAt: timestamp,
        description: "Rotate the secret.",
        evidenceIds: [evidenceId],
        pathBreakerId: randomUUID(),
        pathId,
        priority: 1,
        relatedNodeId: exposureNodeId,
        tenantId,
        title: "Rotate secret",
        updatedAt: timestamp
      }
    ],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        pathEdgeId: randomUUID(),
        pathId,
        rationale: "Fixture",
        relationship: "CAN_ACCESS",
        sourceNodeId: exposureNodeId,
        targetNodeId: roleNodeId,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        pathEdgeId: randomUUID(),
        pathId,
        rationale: "Fixture",
        relationship: "CAN_ACCESS",
        sourceNodeId: roleNodeId,
        targetNodeId: assetNodeId,
        tenantId,
        updatedAt: timestamp
      }
    ],
    pathId,
    pathNodes: [
      {
        createdAt: timestamp,
        entityId: randomUUID(),
        entityType: "Exposure",
        evidenceIds: [evidenceId],
        label: "Repository secret exposure",
        pathId,
        pathNodeId: exposureNodeId,
        sequence: 0,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        entityId: randomUUID(),
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "Production cloud role",
        pathId,
        pathNodeId: roleNodeId,
        sequence: 1,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        entityId: randomUUID(),
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "Production workload",
        pathId,
        pathNodeId: assetNodeId,
        sequence: 2,
        tenantId,
        updatedAt: timestamp
      }
    ],
    tenantId,
    updatedAt: timestamp,
    validationState: "Validated"
  };
}

describe("attack path engine", () => {
  it("correlates fixture signals into at least three attack paths", () => {
    const paths = correlateAttackPathsFromSignals({
      signals: [
        createSignal({
          signalCategory: "Repository",
          signalSubcategory: "SecretScanCandidate"
        }),
        createSignal({
          signalCategory: "Cloud",
          signalSubcategory: "PublicExposure"
        }),
        createSignal({
          signalCategory: "Exposure",
          signalSubcategory: "ExternalExposure"
        })
      ]
    });

    expect(paths).toHaveLength(3);
    expect(paths.map((path) => path.patternId)).toEqual([
      "repo-secret-cloud-role",
      "repo-secret-production-data",
      "internet-facing-production-workload"
    ]);
    // P0.3: correlated paths are heuristic and downstream production nodes are
    // explicitly labeled as hypotheses (never fabricated/measured assets).
    expect(paths.every((path) => path.heuristic)).toBe(true);
    expect(paths.every((path) => path.methodology.length > 0)).toBe(true);
    // Proof-core honesty: a heuristic (inferred, not measured) correlation must
    // NEVER claim validationState "Validated" — that state is reserved for
    // measured/confirmed paths. Pattern-only reach is "Discovered"; a path with
    // a real reachability basis (internet-facing) may be "Reachable".
    expect(paths.every((path) => path.validationState !== "Validated")).toBe(
      true
    );
    expect(
      paths.find((path) => path.patternId === "repo-secret-cloud-role")
        ?.validationState
    ).toBe("Discovered");
    expect(
      paths.find((path) => path.patternId === "repo-secret-production-data")
        ?.validationState
    ).toBe("Discovered");
    for (const path of paths) {
      const downstream = path.nodes.filter(
        (node) => node.entityType === "Asset" && node.hypothesis
      );
      expect(downstream.length).toBeGreaterThan(0);
      for (const node of downstream) {
        expect(node.label).toMatch(/heuristic hypothesis/i);
      }
    }
  });

  it("builds a measured (non-heuristic) path from a DigitalOcean internet-open port signal", () => {
    const signal: SignalEnvelope = {
      ...createSignal({
        confidence: 0.95,
        signalCategory: "Exposure",
        signalSubcategory: "DigitalOceanInternetOpenSensitivePort"
      }),
      rawPayloadPointer:
        "digitalocean://droplets/102/firewall/internet-open?droplet=db-01&ports=tcp%2F22%2Ctcp%2F5432",
      sourceType: "digitalocean.firewall.internet_open_sensitive_port"
    };

    const paths = correlateAttackPathsFromSignals({ signals: [signal] });

    expect(paths).toHaveLength(1);
    const [path] = paths;
    expect(path?.patternId).toBe("digitalocean-internet-open-sensitive-port");
    // Measured, not heuristic: real config analysis, no hypothesis nodes.
    expect(path?.heuristic).toBe(false);
    expect(path?.methodology).toContain("measured-config-analysis");
    expect(path?.validationState).toBe("Reachable");
    expect(
      path?.nodes.some((node) => "hypothesis" in node && node.hypothesis)
    ).toBe(false);
    // The asset node must be labeled to bind to the real persisted Droplet asset.
    expect(
      path?.nodes.some(
        (node) =>
          node.entityType === "Asset" &&
          node.label === "digitalocean-droplet/db-01"
      )
    ).toBe(true);
    // Impact is derived from the actual ports (admin SSH + database PostgreSQL),
    // not a hardcoded constant.
    expect(path?.impactScore).toBe(95);
    expect(path?.name).toContain("db-01");
  });

  it("fuses a measured reachability probe + measured CORS exploit into one Exploitable path (per-edge measured)", () => {
    const reachEvidence = randomUUID();
    const exploitEvidence = randomUUID();
    const host = "app.range.test";

    const reachability: SignalEnvelope = {
      ...createSignal({
        confidence: 0.95,
        evidenceIds: [reachEvidence],
        signalCategory: "Exposure",
        signalSubcategory: "TcpPortReachable"
      }),
      rawPayloadPointer: `periscan-reachability://${host}?port=443`,
      sourceType: "periscan.tcp_reachability.tcp_reachability"
    };
    const exploit: SignalEnvelope = {
      ...createSignal({
        confidence: 0.98,
        evidenceIds: [exploitEvidence],
        signalCategory: "Exposure",
        signalSubcategory: "HttpCredentialedCorsExploit"
      }),
      rawPayloadPointer: `periscan-cors://${host}`,
      sourceType: "periscan.http_cors_audit.http_cors_audit"
    };

    const paths = correlateAttackPathsFromSignals({
      signals: [reachability, exploit]
    });
    const fused = paths.find(
      (path) => path.patternId === "measured-reachability-exploit"
    );

    expect(fused).toBeDefined();
    // Both edges are measured, not inferred.
    expect(fused?.heuristic).toBe(false);
    expect(fused?.methodology).toContain("measured-runner-probe");
    // The path legitimately tops out at Exploitable (a real probe confirmed it).
    expect(fused?.validationState).toBe("Exploitable");
    expect(fused?.name).toContain(host);

    // Edge 1 carries the reachability evidence; edge 2 the exploit evidence —
    // per-edge measured provenance.
    expect(fused?.edges).toHaveLength(2);
    expect(
      fused?.edges.every((edge) => edge.evidenceBasis === "Measured")
    ).toBe(true);
    expect(fused?.edges[0]?.evidenceIds).toContain(reachEvidence);
    expect(fused?.edges[0]?.measurementMethod).toBe("runner-probe:tcp-connect");
    expect(fused?.edges[1]?.evidenceIds).toContain(exploitEvidence);
    expect(fused?.edges[1]?.measurementMethod).toBe(
      "runner-probe:credentialed-cors"
    );

    // A Reachable node and an Exploitable node, both measured.
    const states = fused?.nodes
      .filter((node) => node.entityType === "Exposure")
      .map((node) => (node as { validationState: string }).validationState);
    expect(states).toContain("Reachable");
    expect(states).toContain("Exploitable");
    // No hypothesis (inferred) nodes — everything is a measured entity.
    expect(
      fused?.nodes.some((node) => "hypothesis" in node && node.hypothesis)
    ).toBe(false);
  });

  it("does not fuse when reachability and exploit are on different hosts", () => {
    const reachability: SignalEnvelope = {
      ...createSignal({
        signalCategory: "Exposure",
        signalSubcategory: "TcpPortReachable"
      }),
      rawPayloadPointer: "periscan-reachability://host-a.test?port=443"
    };
    const exploit: SignalEnvelope = {
      ...createSignal({
        signalCategory: "Exposure",
        signalSubcategory: "HttpCredentialedCorsExploit"
      }),
      rawPayloadPointer: "periscan-cors://host-b.test"
    };

    const paths = correlateAttackPathsFromSignals({
      signals: [reachability, exploit]
    });

    expect(
      paths.some((path) => path.patternId === "measured-reachability-exploit")
    ).toBe(false);
  });

  it("fuses measured public exposure and live Kubernetes CIS failure on the same persisted asset", () => {
    const assetId = randomUUID();
    const exposureEvidence = randomUUID();
    const cisEvidence = randomUUID();
    const publicExposure: SignalEnvelope = {
      ...createSignal({
        confidence: 0.91,
        evidenceIds: [exposureEvidence],
        relatedAssetIds: [assetId],
        signalCategory: "Cloud",
        signalSubcategory: "PublicExposure",
        sourceType: "azure.resources.public_exposure"
      }),
      rawPayloadPointer: `azure://${assetId}/public-exposure`
    };
    const cisFailure: SignalEnvelope = {
      ...createSignal({
        confidence: 0.95,
        evidenceIds: [cisEvidence],
        relatedAssetIds: [assetId],
        signalCategory: "Cloud",
        signalSubcategory: "KubernetesCisControlFailed",
        sourceType: "periscan.kubernetes_cis_posture.kubernetes_cis_posture"
      }),
      rawPayloadPointer: `periscan-kubernetes://${assetId}?cluster=payments-prod`
    };

    const path = correlateAttackPathsFromSignals({
      signals: [publicExposure, cisFailure]
    }).find(
      (candidate) => candidate.patternId === "measured-kubernetes-exposure-cis"
    );

    expect(path).toBeDefined();
    expect(path?.heuristic).toBe(false);
    expect(path?.validationState).toBe("Validated");
    expect(path?.validationState).not.toBe("Exploitable");
    expect(path?.evidenceIds.sort()).toEqual(
      [exposureEvidence, cisEvidence].sort()
    );
    expect(path?.edges).toHaveLength(2);
    expect(path?.edges.every((edge) => edge.evidenceBasis === "Measured")).toBe(
      true
    );
    expect(path?.edges[0]?.evidenceIds).toEqual([exposureEvidence]);
    expect(path?.edges[1]?.evidenceIds).toEqual([cisEvidence]);
    expect(
      path?.nodes.every(
        (node) =>
          node.entityType === "Asset" &&
          node.relatedAssetId === assetId &&
          node.hypothesis === false
      )
    ).toBe(true);
  });

  it("correlates missed control observations into an evidence-backed real exposure path", () => {
    const controlEvidenceId = randomUUID();
    const exposureEvidenceId = randomUUID();
    const paths = correlateAttackPathsFromSignals({
      signals: [
        createSignal({
          evidenceIds: [controlEvidenceId],
          relatedControlIds: [randomUUID()],
          signalCategory: "ControlObservation",
          signalSubcategory: "Missed credential-use detection",
          sourceType: "fixture.siem.observer",
          sourceVendor: "Splunk",
          techniqueIds: ["T1552", "T1078"]
        }),
        createSignal({
          confidence: 0.9,
          evidenceIds: [exposureEvidenceId],
          relatedAssetIds: [randomUUID()],
          signalCategory: "Exposure",
          signalSubcategory: "ExternalExposure",
          sourceType: "fixture.external.validation",
          sourceVendor: "Nuclei"
        })
      ]
    });

    const path = paths.find(
      (candidate) => candidate.patternId === "missed-control-real-exposure"
    );

    expect(path).toBeDefined();
    expect(path?.heuristic).toBe(true);
    expect(path?.methodology).toContain("missed-control-real-exposure");
    expect(path?.name).toBe("Missed control to real exposure");
    expect(path?.validationState).toBe("Missed");
    expect(path?.evidenceIds.sort()).toEqual(
      [controlEvidenceId, exposureEvidenceId].sort()
    );
    expect(path?.nodes.map((node) => node.entityType)).toEqual([
      "Exposure",
      "Asset",
      "Exposure"
    ]);
    expect(path?.nodes.map((node) => node.label).join(" ")).toContain(
      "Undetected validation activity"
    );
    expect(path?.edges.map((edge) => edge.relationship)).toEqual([
      "MISSED_BY",
      "LEADS_TO"
    ]);
    expect(path?.edges.every((edge) => edge.evidenceIds.length > 0)).toBe(true);
    expect(path?.pathBreakers[0]?.title).toContain("Tune the missed control");
    expect(path?.pathBreakers[0]?.evidenceIds.sort()).toEqual(
      [controlEvidenceId, exposureEvidenceId].sort()
    );
  });

  it("calculates explainable risk scores", () => {
    const risk = calculateRiskScore({
      businessCriticality: "Critical",
      confidence: 0.94,
      controlResponse: "Missed",
      impactScore: 91,
      internetExposed: true,
      privilegedPath: true,
      validationState: "Validated",
      verificationStatus: null
    });

    expect(risk.band).toBe("Critical");
    expect(risk.score).toBeGreaterThanOrEqual(85);
    expect(
      risk.factors.some((factor) => factor.key === "control-response")
    ).toBe(true);
  });

  it("derives remediation guidance from a correlated path", () => {
    const path = createAttackPathFixture();
    const assessment = assessAttackPathRisk(path);
    const remediation = generateRemediationTaskDraft(path, assessment.risk);

    expect(assessment.attackPath.pathId).toBe(path.pathId);
    expect(assessment.risk.band).toBe("Critical");
    expect(remediation.recommendedAction).toContain(
      "Rotate the exposed secret"
    );
    expect(remediation.verificationMethod).toContain("Rerun");
    expect(remediation.relatedExposureId).toBe(path.pathNodes[0]?.entityId);
  });
});

describe("generateRemediationTaskDraft branch coverage", () => {
  // Override the secret-path fixture's name + node labels to steer the
  // keyword-based recommendation routing (haystack = name + node labels).
  function pathWith(name: string, labels: string[]): AttackPath {
    const path = createAttackPathFixture();
    path.name = name;
    path.pathNodes.forEach((node, index) => {
      if (labels[index] !== undefined) {
        node.label = labels[index]!;
      }
    });
    return path;
  }

  function riskWith(band: RiskScore["band"]): RiskScore {
    return { band, factors: [], score: 50, summary: "Fixture risk." };
  }

  it("routes a public/external exposure path to the cloud platform owner", () => {
    const draft = generateRemediationTaskDraft(
      pathWith("Public internet ingress to production app", [
        "Public load balancer",
        "Production gateway",
        "Production database"
      ]),
      riskWith("High")
    );
    expect(draft.owner).toBe("Cloud platform");
    expect(draft.recommendedAction).toContain("public entry point");
  });

  it("routes an AI-application path to the AI application owner", () => {
    const draft = generateRemediationTaskDraft(
      pathWith("AI assistant exposure to customer data", [
        "AI application endpoint",
        "Customer knowledge base",
        "Tenant data store"
      ]),
      riskWith("High")
    );
    expect(draft.owner).toBe("AI application owner");
    expect(draft.recommendedAction).toContain("AI app data path");
  });

  it("assigns the default path owner by risk band (Critical/High -> Platform owner, else null)", () => {
    const neutralPath = pathWith("Lateral path to database cluster", [
      "Workload node",
      "Service role",
      "Data store"
    ]);
    expect(
      generateRemediationTaskDraft(neutralPath, riskWith("Critical")).owner
    ).toBe("Platform owner");
    expect(
      generateRemediationTaskDraft(neutralPath, riskWith("High")).owner
    ).toBe("Platform owner");
    const lowDraft = generateRemediationTaskDraft(neutralPath, riskWith("Low"));
    expect(lowDraft.owner).toBeNull();
    expect(lowDraft.recommendedAction).toContain("highest-confidence edge");
  });
});
