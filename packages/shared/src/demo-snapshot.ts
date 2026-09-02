import { ValidationSnapshotSchema, type ValidationSnapshot } from "./domain";

export const PUBLIC_DEMO_SNAPSHOT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const PUBLIC_DEMO_TENANT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const PUBLIC_DEMO_GENERATED_AT = "2026-06-02T12:00:00.000Z";

const PUBLIC_DEMO_VALIDATION_SNAPSHOT = {
  aiAppRisks: [
    {
      confidence: 0.82,
      createdAt: PUBLIC_DEMO_GENERATED_AT,
      evidenceIds: ["33333333-3333-4333-8333-333333333333"],
      freshness: "Fixture response observed during sample AI validation run",
      rawPayloadPointer: null,
      redactionStatus: "Redacted",
      relatedAssetIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      relatedControlIds: [],
      relatedEvidenceIds: ["33333333-3333-4333-8333-333333333333"],
      relatedIdentityIds: [],
      relatedPathIds: ["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"],
      sensitivityLevel: "Moderate",
      signalCategory: "AIApplication",
      signalId: "44444444-4444-4444-8444-444444444444",
      signalSubcategory: "RAG authorization risk",
      sourceIntegrationId: "55555555-5555-4555-8555-555555555555",
      sourceType: "AI app safe validation fixture",
      sourceVendor: "Periscan",
      techniqueIds: ["T1071"],
      tenantId: PUBLIC_DEMO_TENANT_ID,
      timestampIngested: PUBLIC_DEMO_GENERATED_AT,
      timestampObserved: PUBLIC_DEMO_GENERATED_AT,
      updatedAt: PUBLIC_DEMO_GENERATED_AT
    }
  ],
  controlObservations: [
    {
      confidence: 0.88,
      createdAt: PUBLIC_DEMO_GENERATED_AT,
      evidenceIds: ["22222222-2222-4222-8222-222222222222"],
      freshness: "Fixture event window matched the sample validation run",
      rawPayloadPointer: null,
      redactionStatus: "Redacted",
      relatedAssetIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
      relatedControlIds: ["66666666-6666-4666-8666-666666666666"],
      relatedEvidenceIds: ["22222222-2222-4222-8222-222222222222"],
      relatedIdentityIds: [],
      relatedPathIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
      sensitivityLevel: "Moderate",
      signalCategory: "ControlObservation",
      signalId: "77777777-7777-4777-8777-777777777777",
      signalSubcategory: "Missed credential-use detection",
      sourceIntegrationId: "88888888-8888-4888-8888-888888888888",
      sourceType: "Mock SIEM observer",
      sourceVendor: "Splunk",
      techniqueIds: ["T1552", "T1078"],
      tenantId: PUBLIC_DEMO_TENANT_ID,
      timestampIngested: PUBLIC_DEMO_GENERATED_AT,
      timestampObserved: PUBLIC_DEMO_GENERATED_AT,
      updatedAt: PUBLIC_DEMO_GENERATED_AT
    }
  ],
  createdAt: PUBLIC_DEMO_GENERATED_AT,
  evidenceIds: [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "99999999-9999-4999-8999-999999999999"
  ],
  evidencePack: {
    audience: "Sample customer review",
    createdAt: PUBLIC_DEMO_GENERATED_AT,
    evidenceIds: [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "99999999-9999-4999-8999-999999999999"
    ],
    evidencePackId: PUBLIC_DEMO_SNAPSHOT_ID,
    packType: "ValidationSnapshotReport",
    redactionLevel: "Moderate",
    status: "Ready",
    storageUri: "sample://public-demo/validation-snapshot.html",
    tenantId: PUBLIC_DEMO_TENANT_ID,
    title: "Sample Validation Snapshot",
    updatedAt: PUBLIC_DEMO_GENERATED_AT
  },
  integrationIds: [
    "88888888-8888-4888-8888-888888888888",
    "55555555-5555-4555-8555-555555555555",
    "12121212-1212-4212-8212-121212121212"
  ],
  metrics: {
    aiRiskCount: 1,
    controlObservationCount: 1,
    correlatedThreatAdvisoryCount: 1,
    highRiskPathCount: 3,
    integrationCount: 3,
    openThreatAdvisoryCount: 1,
    remediationCount: 3,
    staleVerificationCount: 0,
    topPathCount: 3,
    verifiedScopeCount: 1
  },
  missionId: "13131313-1313-4313-8313-131313131313",
  remediationPriorities: [
    {
      createdAt: PUBLIC_DEMO_GENERATED_AT,
      dueAt: null,
      evidenceIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222"
      ],
      owner: "Security engineering",
      recommendedAction:
        "Rotate the exposed repository secret and remove the stale cloud role trust.",
      relatedExposureId: "14141414-1414-4414-8414-141414141414",
      relatedPathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      remediationId: "15151515-1515-4515-8515-151515151515",
      status: "Open",
      technicalSteps: [
        "Revoke and rotate the credential referenced by the redacted secret fingerprint.",
        "Remove the trust relationship from the sample production role.",
        "Rerun the GitHub secret and AWS posture validation modules."
      ],
      tenantId: PUBLIC_DEMO_TENANT_ID,
      ticketId: null,
      ticketSystem: null,
      updatedAt: PUBLIC_DEMO_GENERATED_AT,
      verificationMethod:
        "Rerun the GitHub secret validation and AWS role-access checks; mark fixed only after the old fingerprint is absent and the role path no longer resolves.",
      verificationRequired: true
    },
    {
      createdAt: PUBLIC_DEMO_GENERATED_AT,
      dueAt: null,
      evidenceIds: ["33333333-3333-4333-8333-333333333333"],
      owner: "AI platform owner",
      recommendedAction:
        "Restrict the RAG data source and reduce the AI assistant tool permissions.",
      relatedExposureId: null,
      relatedPathId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      remediationId: "16161616-1616-4616-8616-161616161616",
      status: "VerificationPending",
      technicalSteps: [
        "Limit the sample RAG collection to tenant-authorized documents.",
        "Require the assistant to call only scoped read-only tools for the sample workflow.",
        "Rerun the safe AI validation fixture with the same test account."
      ],
      tenantId: PUBLIC_DEMO_TENANT_ID,
      ticketId: "DEMO-1042",
      ticketSystem: "Jira",
      updatedAt: PUBLIC_DEMO_GENERATED_AT,
      verificationMethod:
        "Repeat the safe AI validation and confirm the unauthorized retrieval fixture is blocked with redacted evidence attached.",
      verificationRequired: true
    },
    {
      createdAt: PUBLIC_DEMO_GENERATED_AT,
      dueAt: null,
      evidenceIds: ["99999999-9999-4999-8999-999999999999"],
      owner: "Cloud platform owner",
      recommendedAction:
        "Restrict the sample public API exposure and rerun safe external validation.",
      relatedExposureId: "34343434-3434-4434-8434-343434343434",
      relatedPathId: "abababab-abab-4bab-8bab-abababababab",
      remediationId: "35353535-3535-4535-8535-353535353535",
      status: "Open",
      technicalSteps: [
        "Move the sample administration endpoint behind the approved access path.",
        "Attach the WAF rule group to the public edge service.",
        "Rerun the safe external exposure validation profile against the verified domain."
      ],
      tenantId: PUBLIC_DEMO_TENANT_ID,
      ticketId: null,
      ticketSystem: null,
      updatedAt: PUBLIC_DEMO_GENERATED_AT,
      verificationMethod:
        "Rerun the safe external validation module and confirm the sample administration endpoint no longer appears in redacted evidence.",
      verificationRequired: true
    }
  ],
  scopeIds: ["17171717-1717-4717-8717-171717171717"],
  snapshotId: PUBLIC_DEMO_SNAPSHOT_ID,
  summary: {
    headline: "Critical-risk path hypothesis requires validation.",
    overview:
      "This public demo uses labeled sample data to show two heuristic path hypotheses and one fully measured reachable path. Risk severity sets priority; only recorded edge evidence sets path certainty.",
    topRiskBand: "Critical"
  },
  tenantId: PUBLIC_DEMO_TENANT_ID,
  topAttackPaths: [
    {
      attackPath: {
        confidence: 0.92,
        createdAt: PUBLIC_DEMO_GENERATED_AT,
        entryNodeId: "18181818-1818-4818-8818-181818181818",
        evidenceBasis: "Heuristic",
        evidenceIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222"
        ],
        impactNodeId: "19191919-1919-4919-8919-191919191919",
        impactScore: 94,
        name: "Repository secret to production cloud role",
        pathBreakers: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            description:
              "Break the path by rotating the credential and removing the stale role trust before retesting.",
            evidenceIds: [
              "11111111-1111-4111-8111-111111111111",
              "22222222-2222-4222-8222-222222222222"
            ],
            pathBreakerId: "20202020-2020-4020-8020-202020202020",
            pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            priority: 1,
            relatedNodeId: "21212121-2121-4121-8121-212121212121",
            tenantId: PUBLIC_DEMO_TENANT_ID,
            title: "Rotate credential and remove role trust",
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        pathEdges: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            evidenceBasis: "Heuristic",
            evidenceIds: ["11111111-1111-4111-8111-111111111111"],
            pathEdgeId: "23232323-2323-4323-8323-232323232323",
            pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            rationale:
              "The redacted repository secret fingerprint matches the sample credential seed.",
            relationship: "LEADS_TO",
            sourceNodeId: "18181818-1818-4818-8818-181818181818",
            targetNodeId: "21212121-2121-4121-8121-212121212121",
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          },
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            evidenceBasis: "Heuristic",
            evidenceIds: ["22222222-2222-4222-8222-222222222222"],
            pathEdgeId: "24242424-2424-4424-8424-242424242424",
            pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            rationale:
              "The sample cloud role can reach the production artifact bucket in the fixture.",
            relationship: "CAN_ACCESS",
            sourceNodeId: "21212121-2121-4121-8121-212121212121",
            targetNodeId: "19191919-1919-4919-8919-191919191919",
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        pathNodes: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            entityId: "25252525-2525-4525-8525-252525252525",
            entityType: "Asset",
            evidenceIds: ["11111111-1111-4111-8111-111111111111"],
            label: "GitHub repo: periscan-fixtures/demo-app",
            pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            pathNodeId: "18181818-1818-4818-8818-181818181818",
            sequence: 0,
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          },
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            entityId: "26262626-2626-4626-8626-262626262626",
            entityType: "Identity",
            evidenceIds: [
              "11111111-1111-4111-8111-111111111111",
              "22222222-2222-4222-8222-222222222222"
            ],
            label: "Sample cloud role: prod-artifact-reader",
            pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            pathNodeId: "21212121-2121-4121-8121-212121212121",
            sequence: 1,
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          },
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            entityId: "27272727-2727-4727-8727-272727272727",
            entityType: "Asset",
            evidenceIds: ["22222222-2222-4222-8222-222222222222"],
            label: "Production artifact bucket",
            pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            pathNodeId: "19191919-1919-4919-8919-191919191919",
            sequence: 2,
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        tenantId: PUBLIC_DEMO_TENANT_ID,
        updatedAt: PUBLIC_DEMO_GENERATED_AT,
        validationState: "Validated"
      },
      risk: {
        band: "Critical",
        factors: [
          {
            contribution: 30,
            key: "path_hypothesis",
            label: "Path hypothesis",
            rationale:
              "The sample path correlates repository credential exposure with cloud access, but its hops are heuristic and still require measurement.",
            value: "Heuristic"
          },
          {
            contribution: 25,
            key: "control_response",
            label: "Control response",
            rationale:
              "The mock SIEM observer did not find a matching alert for the credential-use window.",
            value: "Missed"
          }
        ],
        score: 94,
        summary:
          "Critical-risk heuristic path hypothesis requires measurement before any reachable or validated-path claim."
      }
    },
    {
      attackPath: {
        confidence: 0.78,
        createdAt: PUBLIC_DEMO_GENERATED_AT,
        entryNodeId: "28282828-2828-4828-8828-282828282828",
        evidenceBasis: "Heuristic",
        evidenceIds: ["33333333-3333-4333-8333-333333333333"],
        impactNodeId: "29292929-2929-4929-8929-292929292929",
        impactScore: 82,
        name: "AI assistant RAG authorization gap",
        pathBreakers: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            description:
              "Break the path by enforcing tenant-scoped retrieval and limiting tool permissions for the assistant workflow.",
            evidenceIds: ["33333333-3333-4333-8333-333333333333"],
            pathBreakerId: "30303030-3030-4030-8030-303030303030",
            pathId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            priority: 1,
            relatedNodeId: "29292929-2929-4929-8929-292929292929",
            tenantId: PUBLIC_DEMO_TENANT_ID,
            title: "Restrict RAG retrieval and tool scope",
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        pathEdges: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            evidenceBasis: "Heuristic",
            evidenceIds: ["33333333-3333-4333-8333-333333333333"],
            pathEdgeId: "31313131-3131-4131-8131-313131313131",
            pathId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            rationale:
              "The safe fixture observed unauthorized retrieval risk against the sample RAG data source.",
            relationship: "LEADS_TO",
            sourceNodeId: "28282828-2828-4828-8828-282828282828",
            targetNodeId: "29292929-2929-4929-8929-292929292929",
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        pathId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        pathNodes: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            entityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            entityType: "AIApplication",
            evidenceIds: ["33333333-3333-4333-8333-333333333333"],
            label: "Customer support AI assistant",
            pathId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            pathNodeId: "28282828-2828-4828-8828-282828282828",
            sequence: 0,
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          },
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            entityId: "32323232-3232-4232-8232-323232323232",
            entityType: "Asset",
            evidenceIds: ["33333333-3333-4333-8333-333333333333"],
            label: "Restricted support knowledge base",
            pathId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            pathNodeId: "29292929-2929-4929-8929-292929292929",
            sequence: 1,
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        tenantId: PUBLIC_DEMO_TENANT_ID,
        updatedAt: PUBLIC_DEMO_GENERATED_AT,
        validationState: "Validated"
      },
      risk: {
        band: "High",
        factors: [
          {
            contribution: 22,
            key: "ai_app_scope",
            label: "AI app scope",
            rationale:
              "The sample assistant is connected to a RAG source and tool workflow.",
            value: "RAG enabled"
          },
          {
            contribution: 19,
            key: "verification_status",
            label: "Verification pending",
            rationale:
              "The remediation ticket is ready for retest but not yet proven fixed.",
            value: "VerificationPending"
          }
        ],
        score: 78,
        summary:
          "High-risk heuristic path hypothesis requires measurement before any reachable or validated-path claim."
      }
    },
    {
      attackPath: {
        confidence: 0.74,
        createdAt: PUBLIC_DEMO_GENERATED_AT,
        entryNodeId: "36363636-3636-4636-8636-363636363636",
        evidenceBasis: "Measured",
        evidenceIds: ["99999999-9999-4999-8999-999999999999"],
        impactNodeId: "37373737-3737-4737-8737-373737373737",
        impactScore: 76,
        name: "Verified external exposure to sample production API",
        pathBreakers: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            description:
              "Break the path by moving the administration endpoint behind approved access controls and retesting the verified domain.",
            evidenceIds: ["99999999-9999-4999-8999-999999999999"],
            pathBreakerId: "38383838-3838-4838-8838-383838383838",
            pathId: "abababab-abab-4bab-8bab-abababababab",
            priority: 2,
            relatedNodeId: "37373737-3737-4737-8737-373737373737",
            tenantId: PUBLIC_DEMO_TENANT_ID,
            title: "Restrict public administration exposure",
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        pathEdges: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            evidenceBasis: "Measured",
            evidenceIds: ["99999999-9999-4999-8999-999999999999"],
            measurementMethod: "safe-external-validation-fixture",
            pathEdgeId: "39393939-3939-4939-8939-393939393939",
            pathId: "abababab-abab-4bab-8bab-abababababab",
            rationale:
              "The safe external validation fixture observed a public administration route on the verified sample domain.",
            relationship: "EXPOSES",
            sourceNodeId: "36363636-3636-4636-8636-363636363636",
            targetNodeId: "37373737-3737-4737-8737-373737373737",
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        pathId: "abababab-abab-4bab-8bab-abababababab",
        pathNodes: [
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            entityId: "40404040-4040-4040-8040-404040404040",
            entityType: "Exposure",
            evidenceIds: ["99999999-9999-4999-8999-999999999999"],
            label: "Verified sample domain exposure",
            pathId: "abababab-abab-4bab-8bab-abababababab",
            pathNodeId: "36363636-3636-4636-8636-363636363636",
            sequence: 0,
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          },
          {
            createdAt: PUBLIC_DEMO_GENERATED_AT,
            entityId: "41414141-4141-4141-8141-414141414141",
            entityType: "Asset",
            evidenceIds: ["99999999-9999-4999-8999-999999999999"],
            label: "Sample production API administration route",
            pathId: "abababab-abab-4bab-8bab-abababababab",
            pathNodeId: "37373737-3737-4737-8737-373737373737",
            sequence: 1,
            tenantId: PUBLIC_DEMO_TENANT_ID,
            updatedAt: PUBLIC_DEMO_GENERATED_AT
          }
        ],
        tenantId: PUBLIC_DEMO_TENANT_ID,
        updatedAt: PUBLIC_DEMO_GENERATED_AT,
        validationState: "Reachable"
      },
      risk: {
        band: "High",
        factors: [
          {
            contribution: 21,
            key: "reachability",
            label: "Reachability",
            rationale:
              "The safe external validation fixture observed the route from outside the tenant boundary.",
            value: "Reachable"
          },
          {
            contribution: 16,
            key: "business_impact",
            label: "Business impact",
            rationale:
              "The route is attached to a sample production API administration surface.",
            value: "Production API"
          }
        ],
        score: 76,
        summary:
          "High-risk measured reachable path; validate exploitability before making an exploitable-path claim."
      }
    }
  ],
  updatedAt: PUBLIC_DEMO_GENERATED_AT,
  verificationPlan: [
    "Rerun GitHub secret validation and AWS posture checks after credential rotation.",
    "Query the mock SIEM observer for the same time window to verify the tuned control detects related activity.",
    "Rerun the safe AI app validation fixture and confirm unauthorized retrieval is blocked."
  ]
} satisfies ValidationSnapshot;

export function createPublicDemoValidationSnapshot(): ValidationSnapshot {
  return ValidationSnapshotSchema.parse(
    JSON.parse(JSON.stringify(PUBLIC_DEMO_VALIDATION_SNAPSHOT))
  );
}
