import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { deriveAttackPathClaim } from "./claim-language";
import {
  SharpHoundCollectionProfileSchema,
  classifyBloodHoundImportedPath,
  compileSharpHoundCollectionProfile,
  redactBloodHoundGraph
} from "./sharphound-collection";

const FIXTURE_GRAPH = {
  edges: [
    {
      relationship: "MemberOf",
      source: "user:dev-admin",
      target: "group:cloud-admins"
    },
    {
      relationship: "CanAdmin",
      source: "group:cloud-admins",
      target: "asset:prod-account"
    }
  ],
  nodes: [
    {
      id: "user:dev-admin",
      name: "dev-admin@example.com",
      privilege: "Admin",
      type: "User"
    },
    {
      id: "group:cloud-admins",
      name: "Cloud Admins",
      privilege: "Privileged",
      type: "Group"
    },
    {
      criticality: "High",
      id: "asset:prod-account",
      name: "Production AWS Account",
      type: "CloudAccount"
    }
  ]
};

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    bounds: {
      domainControllers: ["dc01.lab.example.test"],
      maxDepth: 4,
      maxObjects: 5000,
      timeoutSeconds: 120
    },
    identities: [
      {
        kind: "ServiceAccount",
        objectId: "S-1-5-21-1-2-3-1105",
        privileges: ["LDAPRead", "DirectoryRead", "GroupMembershipRead"],
        samAccountName: "svc-periscan-collector"
      }
    ],
    methods: ["Group", "ACL", "Container", "ObjectProps", "Trusts"],
    profileId: "lab-contoso-least-privilege",
    targets: [
      {
        dnsName: "lab.example.test",
        kind: "Domain",
        objectId: "S-1-5-21-1-2-3"
      },
      {
        displayName: "Servers",
        kind: "OrganizationalUnit",
        objectId: "OU=Servers,DC=lab,DC=example,DC=test"
      }
    ],
    ...overrides
  };
}

function overclaimLabels(result: ReturnType<typeof classifyBloodHoundImportedPath>) {
  const labels: string[] = [];
  if (result.claim.canClaimValidated) {
    labels.push("validated");
  }
  if (result.claim.canClaimExploitable) {
    labels.push("exploitable");
  }
  if (result.claim.kind === "MeasuredValidated") {
    labels.push("proven-validated-kind");
  }
  if (result.claim.kind === "MeasuredExploitable") {
    labels.push("proven-exploitable-kind");
  }
  if (result.claimSafeValidationState === "Validated") {
    labels.push("validated-state");
  }
  if (result.claimSafeValidationState === "Exploitable") {
    labels.push("exploitable-state");
  }
  if (result.claimSafeValidationState === "Reachable" && !result.claim.fullyMeasured) {
    labels.push("reachable-unmeasured");
  }
  return labels;
}

describe("SharpHound scoped collection profile (PERISCAN-588)", () => {
  it("compiles typed targets, identities, least privilege, bounds, redaction, and license disposition", () => {
    const result = compileSharpHoundCollectionProfile(validDraft());

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.rationale);
    }

    const profile = SharpHoundCollectionProfileSchema.parse(result.profile);
    expect(profile.profileId).toBe("lab-contoso-least-privilege");
    expect(profile.collector).toBe("sharphound");
    expect(profile.liveAdCollection).toBe(false);
    expect(profile.executable).toBe(false);
    expect(profile.liveSupported).toBe(false);
    expect(profile.leastPrivilege).toBe(true);
    expect(profile.credentialTheft).toBe(false);
    expect(profile.persistence).toBe(false);
    expect(profile.targets).toHaveLength(2);
    expect(profile.targets.map((target) => target.kind).sort()).toEqual([
      "Domain",
      "OrganizationalUnit"
    ]);
    expect(profile.identities[0]?.privileges).toEqual([
      "LDAPRead",
      "DirectoryRead",
      "GroupMembershipRead"
    ]);
    expect(profile.methods).toEqual([
      "Group",
      "ACL",
      "Container",
      "ObjectProps",
      "Trusts"
    ]);
    expect(profile.bounds.maxObjects).toBe(5000);
    expect(profile.bounds.maxDepth).toBe(4);
    expect(Object.keys(profile.redaction).sort()).toEqual([
      "redactCredentialMaterial",
      "redactLapsPasswords",
      "redactPasswordHashes",
      "redactSecrets"
    ]);
    expect(profile.redaction).toEqual({
      redactCredentialMaterial: true,
      redactLapsPasswords: true,
      redactPasswordHashes: true,
      redactSecrets: true
    });
    expect(profile.license).toEqual({
      collectorExecutable: false,
      disposition: "RequiresLegalReview",
      redistributableInDefaultPack: false,
      spdxLicenseId: "GPL-3.0",
      toolId: "sharphound"
    });
  });

  it("defaults to LDAP-read methods and bounded limits when omitted", () => {
    const result = compileSharpHoundCollectionProfile({
      identities: validDraft().identities,
      profileId: "defaults",
      targets: validDraft().targets
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.rationale);
    }
    expect(result.profile.methods).toEqual([
      "Group",
      "ACL",
      "Container",
      "ObjectProps",
      "Trusts"
    ]);
    expect(result.profile.bounds.maxObjects).toBeLessThanOrEqual(5000);
    expect(result.profile.bounds.maxDepth).toBeLessThanOrEqual(4);
    expect(result.profile.bounds.timeoutSeconds).toBeLessThanOrEqual(120);
  });

  it("rejects Domain Admin / DCSync privileges as not least privilege", () => {
    for (const privilege of [
      "DomainAdmin",
      "EnterpriseAdmin",
      "DCSync",
      "ReplicatingDirectoryChangesAll",
      "Administrator"
    ]) {
      const result = compileSharpHoundCollectionProfile(
        validDraft({
          identities: [
            {
              kind: "User",
              objectId: "S-1-5-21-1-2-3-512",
              privileges: [privilege],
              samAccountName: "admin"
            }
          ]
        })
      );
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error(`expected deny for ${privilege}`);
      }
      expect(result.code).toBe("sharphound_privilege_not_least");
    }
  });

  it("rejects credential theft, persistence, and non-LDAP collection methods", () => {
    expect(
      compileSharpHoundCollectionProfile(validDraft({ credentialTheft: true }))
    ).toMatchObject({
      code: "sharphound_credential_theft_denied",
      ok: false
    });
    expect(
      compileSharpHoundCollectionProfile(validDraft({ persistence: true }))
    ).toMatchObject({
      code: "sharphound_persistence_denied",
      ok: false
    });
    for (const method of [
      "CredentialDump",
      "DCSync",
      "Kerberoast",
      "PasswordSpray",
      "Session",
      "LoggedOn"
    ]) {
      const result = compileSharpHoundCollectionProfile(
        validDraft({ methods: [method] })
      );
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error(`expected deny for ${method}`);
      }
      expect(result.code).toBe("sharphound_method_not_least_privilege");
    }
  });

  it("rejects unbounded collection and missing typed targets/identities", () => {
    expect(
      compileSharpHoundCollectionProfile(
        validDraft({ bounds: { maxObjects: 500_000, maxDepth: 4, timeoutSeconds: 120 } })
      )
    ).toMatchObject({
      code: "sharphound_unbounded_collection",
      ok: false
    });
    expect(
      compileSharpHoundCollectionProfile(validDraft({ targets: [] }))
    ).toMatchObject({
      code: "sharphound_targets_required",
      ok: false
    });
    expect(
      compileSharpHoundCollectionProfile(validDraft({ identities: [] }))
    ).toMatchObject({
      code: "sharphound_identities_required",
      ok: false
    });
    expect(
      compileSharpHoundCollectionProfile(
        validDraft({
          targets: [{ kind: "Domain", objectId: "*", dnsName: "*" }]
        })
      )
    ).toMatchObject({
      code: "sharphound_targets_unscoped",
      ok: false
    });
  });

  it("default-denies live AD collection flags", () => {
    for (const overrides of [
      { liveAdCollection: true },
      { collectorExecution: true },
      { useSharpHound: true }
    ]) {
      expect(compileSharpHoundCollectionProfile(validDraft(overrides))).toMatchObject({
        code: "sharphound_live_ad_default_deny",
        ok: false
      });
    }
  });

  it("will not stamp Apache-2.0 Enabled as SharpHound collector license disposition", () => {
    const result = compileSharpHoundCollectionProfile(
      validDraft({
        license: {
          disposition: "Enabled",
          spdxLicenseId: "Apache-2.0",
          toolId: "sharphound"
        }
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected license deny");
    }
    expect(result.code).toBe("sharphound_license_disposition_blocked");
  });

  it("rejects turning redaction off", () => {
    expect(
      compileSharpHoundCollectionProfile(
        validDraft({
          redaction: {
            redactCredentialMaterial: false,
            redactPasswordHashes: true,
            redactSecrets: true
          }
        })
      )
    ).toMatchObject({
      code: "sharphound_redaction_required",
      ok: false
    });
  });

  it("requires LAPS password redaction as a fourth collection bound (PERISCAN-588 wave 2)", () => {
    const result = compileSharpHoundCollectionProfile(validDraft());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.rationale);
    }

    expect(Object.keys(result.profile.redaction)).toHaveLength(4);
    expect(result.profile.redaction.redactLapsPasswords).toBe(true);
    expect(result.profile.leastPrivilege).toBe(true);
    expect(result.profile.liveAdCollection).toBe(false);
    expect(result.profile.credentialTheft).toBe(false);
    expect(result.profile.liveSupported).toBe(false);
  });

  it("rejects turning LAPS password redaction off", () => {
    expect(
      compileSharpHoundCollectionProfile(
        validDraft({
          redaction: {
            redactCredentialMaterial: true,
            redactLapsPasswords: false,
            redactPasswordHashes: true,
            redactSecrets: true
          }
        })
      )
    ).toMatchObject({
      code: "sharphound_redaction_required",
      ok: false
    });
  });
});

describe("BloodHound imported graph path honesty (PERISCAN-588)", () => {
  it("treats imported edges as hypotheses, never validated/exploitable/proven", () => {
    const honesty = classifyBloodHoundImportedPath({
      graph: FIXTURE_GRAPH,
      requestedValidationState: "Validated"
    });

    expect(honesty.collectionIsNotExploitation).toBe(true);
    expect(honesty.importedGraphIsNotProof).toBe(true);
    expect(honesty.edges).toHaveLength(2);
    expect(honesty.edges.every((edge) => edge.hypothesis)).toBe(true);
    expect(honesty.edges.every((edge) => edge.evidenceBasis === "Heuristic")).toBe(
      true
    );
    expect(honesty.edges.every((edge) => edge.evidenceIds.length === 0)).toBe(
      true
    );
    expect(honesty.claim.kind).toBe("HeuristicHypothesis");
    expect(honesty.claim.canClaimValidated).toBe(false);
    expect(honesty.claim.canClaimExploitable).toBe(false);
    expect(honesty.claim.canClaimReachable).toBe(false);
    expect(honesty.claimSafeValidationState).toBe("Discovered");
    expect(overclaimLabels(honesty)).toEqual([]);
  });

  it("fails closed when import is labeled exploitable or proven without hop receipts", () => {
    for (const requestedValidationState of ["Exploitable", "Validated", "Reachable"] as const) {
      const honesty = classifyBloodHoundImportedPath({
        graph: FIXTURE_GRAPH,
        requestedValidationState
      });
      expect(overclaimLabels(honesty)).toEqual([]);
      expect(honesty.claimSafeValidationState).not.toBe("Validated");
      expect(honesty.claimSafeValidationState).not.toBe("Exploitable");
      expect(honesty.claim.fullyMeasured).toBe(false);
    }
  });

  it("does not treat graph-import or SharpHound collector receipts as hop measurement", () => {
    const evidenceId = randomUUID();
    const honesty = classifyBloodHoundImportedPath({
      graph: FIXTURE_GRAPH,
      hopReceipts: FIXTURE_GRAPH.edges.map((edge) => ({
        evidenceIds: [evidenceId],
        measurementMethod: "bloodhound graph import",
        moduleId: "bloodhound.identity_pathing",
        relationship: edge.relationship,
        source: edge.source,
        sourceKind: "GraphImport" as const,
        target: edge.target,
        validationState: "Validated" as const
      })),
      requestedValidationState: "Exploitable"
    });

    expect(honesty.edges.every((edge) => edge.independentlyMeasured === false)).toBe(
      true
    );
    expect(honesty.claim.kind).toBe("HeuristicHypothesis");
    expect(overclaimLabels(honesty)).toEqual([]);
  });

  it("measures only independently receipted hops; weakest hop still gates path claims", () => {
    const evidenceId = randomUUID();
    const honesty = classifyBloodHoundImportedPath({
      graph: FIXTURE_GRAPH,
      hopReceipts: [
        {
          evidenceIds: [evidenceId],
          measurementMethod: "signed safe probe",
          moduleId: "periscan.tcp_reachability",
          relationship: "CanAdmin",
          source: "group:cloud-admins",
          sourceKind: "SafeProbe",
          target: "asset:prod-account",
          validationState: "Reachable"
        }
      ],
      requestedValidationState: "Validated"
    });

    const measured = honesty.edges.filter((edge) => edge.independentlyMeasured);
    const hypotheses = honesty.edges.filter((edge) => edge.hypothesis);
    expect(measured).toHaveLength(1);
    expect(hypotheses).toHaveLength(1);
    expect(honesty.claim.kind).toBe("PartiallyMeasuredHypothesis");
    expect(honesty.claim.measuredEdgeCount).toBe(1);
    expect(honesty.claim.totalEdgeCount).toBe(2);
    expect(honesty.claim.canClaimValidated).toBe(false);
    expect(honesty.claimSafeValidationState).toBe("Discovered");
    expect(overclaimLabels(honesty)).toEqual([]);
  });

  it("allows validated language only after every hop has an independent receipt", () => {
    const evidenceA = randomUUID();
    const evidenceB = randomUUID();
    const honesty = classifyBloodHoundImportedPath({
      graph: FIXTURE_GRAPH,
      hopReceipts: [
        {
          evidenceIds: [evidenceA],
          measurementMethod: "signed safe probe",
          moduleId: "periscan.tcp_reachability",
          relationship: "MemberOf",
          source: "user:dev-admin",
          sourceKind: "SafeProbe",
          target: "group:cloud-admins",
          validationState: "Reachable"
        },
        {
          evidenceIds: [evidenceB],
          measurementMethod: "control observation",
          moduleId: "periscan.http_health_check",
          relationship: "CanAdmin",
          source: "group:cloud-admins",
          sourceKind: "ControlObservation",
          target: "asset:prod-account",
          validationState: "Validated"
        }
      ],
      requestedValidationState: "Validated"
    });

    expect(honesty.edges.every((edge) => edge.independentlyMeasured)).toBe(true);
    expect(honesty.claim.fullyMeasured).toBe(true);
    expect(honesty.claim.canClaimValidated).toBe(true);
    expect(honesty.claim.canClaimExploitable).toBe(false);
    expect(honesty.claimSafeValidationState).toBe("Validated");
    expect(deriveAttackPathClaim({
      evidenceBasis: "Measured",
      pathEdges: honesty.pathEdges,
      validationState: "Validated"
    }).canClaimValidated).toBe(true);
  });

  it("never upgrades certainty from Critical severity / risk band", () => {
    const honesty = classifyBloodHoundImportedPath({
      graph: FIXTURE_GRAPH,
      requestedValidationState: "Validated",
      riskBand: "Critical"
    });
    expect(honesty.claim.kind).toBe("HeuristicHypothesis");
    expect(honesty.claim.canClaimValidated).toBe(false);
    expect(overclaimLabels(honesty)).toEqual([]);
  });
});

describe("BloodHound graph redaction", () => {
  it("drops secrets, hashes, and credential material from imported nodes and edges", () => {
    const redacted = redactBloodHoundGraph({
      edges: [
        {
          credential: "stolen-ticket",
          relationship: "MemberOf",
          source: "user:alice",
          target: "group:admins"
        }
      ],
      nodes: [
        {
          id: "user:alice",
          nTHash: "aabbccddeeff",
          name: "alice",
          password: "hunter2",
          privilege: "Admin",
          type: "User",
          unicodePwd: "secret"
        }
      ]
    });

    expect(redacted.nodes[0]).toEqual({
      id: "user:alice",
      name: "alice",
      privilege: "Admin",
      type: "User"
    });
    expect(redacted.edges[0]).toEqual({
      relationship: "MemberOf",
      source: "user:alice",
      target: "group:admins"
    });
    expect(JSON.stringify(redacted)).not.toMatch(
      /hunter2|aabbccddeeff|stolen-ticket|unicodePwd|nTHash/i
    );
  });

  it("drops LAPS and gMSA secret attributes from imported graph nodes", () => {
    const redacted = redactBloodHoundGraph({
      edges: [],
      nodes: [
        {
          id: "computer:ws01",
          "ms-Mcs-AdmPwd": "LapsSecretValue!",
          "msDS-ManagedPassword": "GmsaBlob==",
          name: "WS01$",
          privilege: "Workstation",
          type: "Computer",
          unicodePwd: "also-secret"
        }
      ]
    });

    expect(redacted.nodes[0]).toEqual({
      id: "computer:ws01",
      name: "WS01$",
      privilege: "Workstation",
      type: "Computer"
    });
    expect(JSON.stringify(redacted)).not.toMatch(
      /LapsSecretValue|GmsaBlob==|also-secret|ms-Mcs-AdmPwd|msDS-ManagedPassword/i
    );
  });
});
