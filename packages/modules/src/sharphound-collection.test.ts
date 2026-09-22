import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  classifyBloodHoundImportedPath,
  compileSharpHoundCollectionProfile
} from "@periscan/shared";

import {
  evaluateModuleStartConstraints,
  executeModuleById,
  getModuleById,
  ModuleExecutionContextSchema
} from "./index.js";
import {
  applyBloodHoundImportHonesty,
  evaluateSharpHoundLiveAdCollection
} from "./sharphound-collection.js";

const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";
const FIXTURE_GRAPH_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/bloodhound/identity-graph-fixture.json"
);

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

function createContext(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "PassiveReadOnly",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

function collectionDraft() {
  return {
    bounds: {
      domainControllers: ["dc01.lab.example.test"],
      maxDepth: 4,
      maxObjects: 2500,
      timeoutSeconds: 90
    },
    identities: [
      {
        kind: "ServiceAccount",
        objectId: "S-1-5-21-9-9-9-1105",
        privileges: ["LDAPRead"],
        samAccountName: "svc-lab-collector"
      }
    ],
    methods: ["Group", "ACL", "ObjectProps"],
    profileId: "lab-profile",
    targets: [
      {
        dnsName: "lab.example.test",
        kind: "Domain",
        objectId: "S-1-5-21-9-9-9"
      }
    ]
  };
}

function overclaimFromModuleOutput(output: {
  outcome: string;
  validationState?: string | null;
  evidence: Array<{ attributes?: Record<string, unknown> }>;
}) {
  const labels: string[] = [];
  const outcome = output.outcome.toLowerCase();
  const state = output.validationState ?? "";
  if (state === "Validated" || state === "Exploitable" || state === "Reachable") {
    labels.push(`state:${state}`);
  }
  if (/\b(validated|exploitable|proven)\b/.test(outcome)) {
    labels.push(`outcome:${output.outcome}`);
  }
  const attrs = output.evidence[0]?.attributes ?? {};
  if (attrs.measured === true) {
    labels.push("measured:true");
  }
  if (attrs.sharpHoundCollectorUsed === true) {
    labels.push("collector-used");
  }
  const honesty = attrs.pathHonesty as
    | { canClaimValidated?: boolean; canClaimExploitable?: boolean; kind?: string }
    | undefined;
  if (honesty?.canClaimValidated) {
    labels.push("path-validated");
  }
  if (honesty?.canClaimExploitable) {
    labels.push("path-exploitable");
  }
  if (honesty?.kind === "MeasuredValidated" || honesty?.kind === "MeasuredExploitable") {
    labels.push(`path-kind:${honesty.kind}`);
  }
  return labels;
}

describe("SharpHound live AD remains default-deny (PERISCAN-588)", () => {
  const bloodhound = () => getModuleById("bloodhound.identity_pathing");

  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("keeps collector start blocked, including liveAdCollection", () => {
    const module = bloodhound();
    expect(module).toBeDefined();
    expect(module!.manifest.liveSupported).toBe(false);
    expect(module!.manifest.license).toBe("Apache-2.0");

    for (const target of [
      { collector: "sharphound" },
      { collectorExecution: true },
      { useSharpHound: true },
      { liveAdCollection: true }
    ]) {
      expect(
        evaluateModuleStartConstraints({
          executionEnvironment: "ControlPlane",
          moduleManifests: [module!.manifest],
          runnerId: null,
          target
        })
      ).toMatchObject({
        allowed: false,
        code: "sharphound_collector_legal_review_blocked"
      });
      expect(evaluateSharpHoundLiveAdCollection(target)).toMatchObject({
        allowed: false,
        code: "sharphound_collector_legal_review_blocked"
      });
    }
  });

  it("does not lift collector deny when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");
    const module = bloodhound();
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [module!.manifest],
        runnerId: randomUUID(),
        target: {
          collector: "sharphound",
          collectionProfile: collectionDraft(),
          dryRun: false,
          sowId: "test-sow"
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "sharphound_collector_legal_review_blocked"
    });
  });

  it("execute path refuses collector flags instead of enumerating live AD", async () => {
    const output = await executeModuleById(
      "bloodhound.identity_pathing",
      createContext({
        target: {
          collector: "sharphound",
          collectorExecution: true,
          fixtureGraphPath: FIXTURE_GRAPH_PATH,
          liveAdCollection: true
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("sharphound_collector_denied");
    expect(output.signals).toHaveLength(0);
    expect(output.evidence[0]?.attributes.sharpHoundCollectorUsed).toBe(false);
    expect(output.evidence[0]?.attributes.liveAdCollection).toBe(false);
    expect(overclaimFromModuleOutput(output)).toEqual([]);
  });
});

describe("BloodHound import honesty + collection profile (PERISCAN-588)", () => {
  it("imports the fixture graph as hypotheses with collector license disposition", async () => {
    const output = await executeModuleById(
      "bloodhound.identity_pathing",
      createContext({
        target: {
          fixtureGraphPath: FIXTURE_GRAPH_PATH,
          graphName: "demo-identity"
        }
      })
    );

    expect(output.outcome).toBe("identity_path_observed");
    expect(output.validationState).toBe("Inconclusive");
    expect(overclaimFromModuleOutput(output)).toEqual([]);

    const attrs = output.evidence[0]?.attributes ?? {};
    expect(attrs.sharpHoundCollectorUsed).toBe(false);
    expect(attrs.measured).toBe(false);
    expect(attrs.importedEdgesAreHypotheses).toBe(true);
    expect(attrs.collectionIsNotExploitation).toBe(true);
    expect(attrs.licenseDisposition).toEqual({
      collectorExecutable: false,
      disposition: "RequiresLegalReview",
      redistributableInDefaultPack: false,
      spdxLicenseId: "GPL-3.0",
      toolId: "sharphound"
    });
    expect(attrs.graphImportLicense).toEqual({
      spdxLicenseId: "Apache-2.0",
      toolId: "bloodhound-ce"
    });

    const honesty = attrs.pathHonesty as {
      canClaimExploitable: boolean;
      canClaimValidated: boolean;
      kind: string;
    };
    expect(honesty.kind).toBe("HeuristicHypothesis");
    expect(honesty.canClaimValidated).toBe(false);
    expect(honesty.canClaimExploitable).toBe(false);
  });

  it("attaches a compiled least-privilege profile without enabling live collection", async () => {
    const compiled = compileSharpHoundCollectionProfile(collectionDraft());
    expect(compiled.ok).toBe(true);

    const output = await executeModuleById(
      "bloodhound.identity_pathing",
      createContext({
        target: {
          collectionProfile: collectionDraft(),
          fixtureGraphPath: FIXTURE_GRAPH_PATH,
          graphName: "profiled-import"
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("identity_path_observed");
    const attrs = output.evidence[0]?.attributes ?? {};
    expect(attrs.collectionProfile).toMatchObject({
      executable: false,
      leastPrivilege: true,
      liveAdCollection: false,
      profileId: "lab-profile"
    });
    expect(attrs.sharpHoundCollectorUsed).toBe(false);
    expect(overclaimFromModuleOutput(output)).toEqual([]);
  });

  it("fails closed when LAPS password redaction is disabled", async () => {
    const output = await executeModuleById(
      "bloodhound.identity_pathing",
      createContext({
        target: {
          collectionProfile: {
            ...collectionDraft(),
            redaction: {
              redactCredentialMaterial: true,
              redactLapsPasswords: false,
              redactPasswordHashes: true,
              redactSecrets: true
            }
          },
          fixtureGraphPath: FIXTURE_GRAPH_PATH
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("sharphound_collection_profile_rejected");
    expect(output.signals).toHaveLength(0);
    expect(overclaimFromModuleOutput(output)).toEqual([]);
    expect(output.errors[0]).toContain("sharphound_redaction_required");
    expect(output.evidence[0]?.attributes.collectionProfileCode).toBe(
      "sharphound_redaction_required"
    );
    expect(output.evidence[0]?.attributes.sharpHoundCollectorUsed).toBe(false);
    expect(output.evidence[0]?.attributes.liveAdCollection).toBe(false);
  });

  it("fails closed on an invalid collection profile instead of importing as proven", async () => {
    const output = await executeModuleById(
      "bloodhound.identity_pathing",
      createContext({
        target: {
          collectionProfile: {
            ...collectionDraft(),
            liveAdCollection: true
          },
          fixtureGraphPath: FIXTURE_GRAPH_PATH
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("sharphound_collection_profile_rejected");
    expect(output.signals).toHaveLength(0);
    expect(overclaimFromModuleOutput(output)).toEqual([]);
    expect(output.errors[0]).toContain("sharphound_live_ad_default_deny");
    expect(output.evidence[0]?.attributes.collectionProfileCode).toBe(
      "sharphound_live_ad_default_deny"
    );
  });

  it("redacts secrets from inline graph data", async () => {
    const output = await executeModuleById(
      "bloodhound.identity_pathing",
      createContext({
        target: {
          graphData: {
            edges: [
              {
                credential: "stolen",
                relationship: "MemberOf",
                source: "user:alice",
                target: "group:admins"
              }
            ],
            nodes: [
              {
                id: "user:alice",
                nTHash: "aabbcc",
                name: "alice",
                password: "hunter2",
                privilege: "Admin",
                type: "User"
              },
              {
                id: "group:admins",
                name: "Admins",
                privilege: "Privileged",
                type: "Group"
              }
            ]
          },
          graphName: "secret-graph"
        }
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    const blob = JSON.stringify(output);
    expect(blob).not.toMatch(/hunter2|aabbcc|stolen/i);
    expect(output.evidence[0]?.redactionStatus).toBe("Redacted");
  });

  it("applyBloodHoundImportHonesty refuses validated/exploitable labels on import", () => {
    const honesty = applyBloodHoundImportHonesty({
      graph: {
        edges: [
          {
            relationship: "CanAdmin",
            source: "user:alice",
            target: "asset:prod"
          }
        ],
        nodes: [
          { id: "user:alice", name: "alice", type: "User" },
          { id: "asset:prod", name: "prod", type: "CloudAccount" }
        ]
      },
      requestedValidationState: "Exploitable"
    });

    expect(honesty.importedGraphIsNotProof).toBe(true);
    expect(honesty.claim.canClaimExploitable).toBe(false);
    expect(honesty.claimSafeValidationState).toBe("Discovered");
    expect(classifyBloodHoundImportedPath({
      graph: honesty.redactedGraph,
      requestedValidationState: "Validated"
    }).claim.canClaimValidated).toBe(false);
  });
});
