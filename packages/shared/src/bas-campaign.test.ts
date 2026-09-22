import { describe, expect, it } from "vitest";

import {
  BAS_BENIGN_MARKER_MODULE_ID,
  BAS_BENIGN_MARKER_SCENARIO_ID,
  LIVE_OFFENSIVE_PACK_DENY_REASONS
} from "./bas-control-plane.js";
import {
  BAS_CAMPAIGN_DAG_CYCLE_MESSAGE,
  BAS_CAMPAIGN_DAG_TOO_LARGE_MESSAGE,
  BAS_DANGER_ACK_DENY_REASON,
  AuthorizeBasPackInputSchema,
  BasCampaignListSchema,
  BasCampaignPlanSchema,
  BasCampaignPreviewSchema,
  BasCampaignStepCleanupSchema,
  BasPackQualificationSchema,
  CancelBasCampaignResultSchema,
  CompileBasCampaignInputSchema,
  CompileBasCampaignResultSchema,
  MAX_BAS_CAMPAIGN_DAG_NODES,
  QualifyBasPackInputSchema,
  StartBasCampaignInputSchema,
  StartBasCampaignResultSchema,
  TenantBasPackAuthorizationSchema,
  campaignApprovalDigest,
  campaignCompiledDigest,
  compileBasCampaignDag,
  evaluateBasCampaignStartability,
  livePackFromCampaignPins,
  resolveBasCampaignStepCleanup,
  tenantBasPackAuthorizationDigest,
  walkBasCampaignStartPins
} from "./bas-campaign.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const SCOPE_ID = "22222222-2222-4222-8222-222222222222";
const POLICY_ID = "33333333-3333-4333-8333-333333333333";
const PLAN_ID = "44444444-4444-4444-8444-444444444444";
const APPROVER_ID = "55555555-5555-4555-8555-555555555555";
const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);

const benignPin = {
  provider: "ControlPlane" as const,
  contentSha256: SHA,
  dependsOn: [] as string[],
  upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID,
  typedInputs: {}
};

const atomicContentPin = {
  provider: "AtomicRedTeam" as const,
  contentSha256: SHA,
  dependsOn: [] as string[],
  upstreamId: "T1082-1",
  typedInputs: { timeout: 30 }
};

const atomicLivePin = {
  provider: "ControlPlane" as const,
  contentSha256: SHA,
  dependsOn: [] as string[],
  upstreamId: "atomic.live",
  typedInputs: {}
};

const ransomwarePin = {
  provider: "ControlPlane" as const,
  contentSha256: SHA,
  dependsOn: [] as string[],
  upstreamId: "T1486",
  typedInputs: {}
};

function atomicQualification(
  overrides: Partial<{
    labReceiptHash: string;
    pack: "atomic" | "caldera" | "metasploit";
    pinIds: string[];
    qualifiedAt: string;
  }> = {}
) {
  return BasPackQualificationSchema.parse({
    labReceiptHash: SHA,
    pack: "atomic",
    pinIds: ["atomic.live"],
    qualifiedAt: "2026-09-17T00:00:00.000Z",
    ...overrides
  });
}

function atomicAuthorization(
  overrides: Partial<{
    expiresAt: string;
    pack: "atomic" | "caldera" | "metasploit";
    scopeId: string;
    tenantId: string;
    approver: string;
  }> = {}
) {
  const base = {
    approver: APPROVER_ID,
    expiresAt: "2026-12-01T00:00:00.000Z",
    pack: "atomic" as const,
    scopeId: SCOPE_ID,
    tenantId: TENANT_ID,
    ...overrides
  };
  return TenantBasPackAuthorizationSchema.parse({
    ...base,
    digest: tenantBasPackAuthorizationDigest(base)
  });
}

function digestInput(
  overrides: Partial<Parameters<typeof campaignCompiledDigest>[0]> = {}
) {
  return {
    tenantId: TENANT_ID,
    scopeId: SCOPE_ID,
    scopeVersion: "2026-09-17T00:00:00.000Z",
    scopeVerificationStatus: "Verified",
    runnerId: null,
    contentVersionIds: [] as string[],
    scenarioPins: [benignPin],
    cleanupPolicy: {
      onCancel: "request_then_record" as const,
      requireVerifiedCleanup: true
    },
    ...overrides
  };
}

describe("BAS campaign compiler contracts", () => {
  it("rejects client approval, executable, tenant override, and extra compile fields", () => {
    const input = {
      scopeId: SCOPE_ID,
      scenarioPins: [
        {
          provider: "ControlPlane",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      ]
    };
    expect(CompileBasCampaignInputSchema.safeParse(input).success).toBe(true);
    for (const extra of [
      { executable: true },
      { startable: true },
      { tenantId: TENANT_ID },
      { liveSupported: true },
      { jobsQueued: 1 }
    ]) {
      expect(
        CompileBasCampaignInputSchema.safeParse({ ...input, ...extra }).success
      ).toBe(false);
    }
  });

  it("hashes canonical campaign JSON stably and changes when inputs, pins, or scope version change", () => {
    const first = campaignCompiledDigest(digestInput());
    const replay = campaignCompiledDigest(
      digestInput({
        contentVersionIds: [],
        scenarioPins: [{ ...benignPin, typedInputs: {} }]
      })
    );
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(replay).toBe(first);
    expect(
      campaignCompiledDigest(
        digestInput({
          scenarioPins: [{ ...benignPin, typedInputs: { k: "v" } }]
        })
      )
    ).not.toBe(first);
    expect(
      campaignCompiledDigest(digestInput({ scopeVersion: "unverified" }))
    ).not.toBe(first);
    expect(
      campaignCompiledDigest(digestInput({ scenarioPins: [atomicContentPin] }))
    ).not.toBe(first);
    expect(
      campaignCompiledDigest(
        digestInput({
          scenarioPins: [
            { ...benignPin, dependsOn: [], stepKey: "marker" },
            {
              ...benignPin,
              contentSha256: OTHER_SHA,
              dependsOn: ["marker"],
              stepKey: "follow-on",
              upstreamId: "control.detection.benign-marker"
            }
          ]
        })
      )
    ).not.toBe(first);
  });

  it("binds approval digest to the policy decision and compiled digest", () => {
    const compiledDigest = campaignCompiledDigest(digestInput());
    const first = campaignApprovalDigest({
      compiledDigest,
      expiresAt: "2026-09-18T00:00:00.000Z",
      outcome: "Allowed",
      policyDecisionId: POLICY_ID
    });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(
      campaignApprovalDigest({
        compiledDigest,
        expiresAt: "2026-09-18T00:00:00.000Z",
        outcome: "Allowed",
        policyDecisionId: POLICY_ID
      })
    ).toBe(first);
    expect(
      campaignApprovalDigest({
        compiledDigest,
        expiresAt: "2026-09-19T00:00:00.000Z",
        outcome: "Allowed",
        policyDecisionId: POLICY_ID
      })
    ).not.toBe(first);
    expect(
      campaignApprovalDigest({
        compiledDigest: OTHER_SHA,
        expiresAt: "2026-09-18T00:00:00.000Z",
        outcome: "Allowed",
        policyDecisionId: POLICY_ID
      })
    ).not.toBe(first);
  });

  it("allows a verified-scope ControlPlane benign marker campaign to be startable", () => {
    const result = evaluateBasCampaignStartability({
      pins: [benignPin],
      runnerStatus: null,
      scopeVerified: true
    });
    expect(result).toEqual({ denyReason: null, startable: true });
  });

  it("does not start unreviewed content, live Atomic/Caldera/Metasploit, unverified scope, or a lost runner", () => {
    expect(
      evaluateBasCampaignStartability({
        pins: [atomicContentPin],
        runnerStatus: null,
        scopeVerified: true
      })
    ).toMatchObject({ startable: false });
    expect(
      evaluateBasCampaignStartability({
        pins: [
          {
            contentSha256: SHA,
            provider: "ControlPlane",
            typedInputs: {},
            upstreamId: "atomic.live"
          }
        ],
        runnerStatus: null,
        scopeVerified: true
      }).denyReason
    ).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);
    expect(
      evaluateBasCampaignStartability({
        pins: [benignPin],
        runnerStatus: null,
        scopeVerified: false
      }).startable
    ).toBe(false);
    expect(
      evaluateBasCampaignStartability({
        pins: [benignPin],
        runnerStatus: "Revoked",
        scopeVerified: true
      })
    ).toMatchObject({ startable: false });
    expect(
      evaluateBasCampaignStartability({
        hasUnreviewedContent: true,
        pins: [benignPin],
        runnerStatus: null,
        scopeVerified: true
      })
    ).toEqual({
      denyReason:
        "Unreviewed BAS content cannot execute. Campaign start is denied and jobs are not queued.",
      startable: false
    });
    expect(
      evaluateBasCampaignStartability({
        hasUnreviewedContent: false,
        pins: [atomicContentPin],
        runnerStatus: null,
        scopeVerified: true
      })
    ).toEqual({
      denyReason: LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic,
      startable: false
    });
    expect(livePackFromCampaignPins([atomicContentPin])).toBe("atomic");
    expect(
      livePackFromCampaignPins([
        {
          contentSha256: SHA,
          provider: "ControlPlane",
          typedInputs: {},
          upstreamId: "caldera.live"
        }
      ])
    ).toBe("caldera");
  });

  it("never lets compile results or denied starts claim queued work", () => {
    const compiledDigest = campaignCompiledDigest(digestInput());
    const plan = BasCampaignPlanSchema.parse({
      approvalDigest: campaignApprovalDigest({
        compiledDigest,
        expiresAt: "2026-09-18T00:00:00.000Z",
        outcome: "Allowed",
        policyDecisionId: POLICY_ID
      }),
      basCampaignPlanId: PLAN_ID,
      cleanupPolicy: {
        onCancel: "request_then_record",
        requireVerifiedCleanup: true
      },
      compiledDigest,
      contentVersionIds: [],
      createdAt: "2026-09-17T00:00:00.000Z",
      policyDecisionId: POLICY_ID,
      runnerId: null,
      scenarioPins: [benignPin],
      scopeId: SCOPE_ID,
      scopeVerificationStatus: "Verified",
      scopeVersion: "2026-09-17T00:00:00.000Z",
      startable: true,
      tenantId: TENANT_ID
    });
    expect(
      CompileBasCampaignResultSchema.parse({
        denyReason: null,
        jobsQueued: 0,
        plan,
        queued: false,
        startable: true
      }).queued
    ).toBe(false);
    expect(
      CompileBasCampaignResultSchema.safeParse({
        denyReason: null,
        jobsQueued: 1,
        plan,
        queued: true,
        startable: true
      }).success
    ).toBe(false);

    expect(StartBasCampaignInputSchema.parse({ compiledDigest })).toEqual({
      compiledDigest
    });
    expect(
      StartBasCampaignInputSchema.parse({
        compiledDigest,
        dangerAckDigest: "a".repeat(16),
        dangerAcknowledged: true
      })
    ).toEqual({
      compiledDigest,
      dangerAckDigest: "a".repeat(16),
      dangerAcknowledged: true
    });
    expect(
      StartBasCampaignResultSchema.safeParse({
        campaignPlanId: PLAN_ID,
        compiledDigest,
        denyReason: "stale approval",
        jobsQueued: 1,
        mission: null,
        outcome: "Denied",
        policyDecisionId: POLICY_ID,
        queued: true,
        rationale: "stale approval",
        runs: [],
        startable: false
      }).success
    ).toBe(false);
    expect(
      StartBasCampaignResultSchema.parse({
        campaignPlanId: PLAN_ID,
        compiledDigest,
        denyReason: "stale approval",
        jobsQueued: 0,
        mission: null,
        outcome: "Denied",
        policyDecisionId: POLICY_ID,
        queued: false,
        rationale: "stale approval",
        runs: [],
        startable: false
      }).queued
    ).toBe(false);
  });

  it("emits a from→to edge for a 2-pin compile with a declared dependency", () => {
    const compiled = compileBasCampaignDag([
      {
        dependsOn: [],
        stepKey: "recon",
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      },
      {
        dependsOn: ["recon"],
        stepKey: "marker",
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      }
    ]);
    expect(compiled.error).toBeNull();
    expect(compiled.graph?.edges).toEqual([{ from: "marker", to: "recon" }]);
    expect(compiled.graph?.executionOrder).toEqual(["recon", "marker"]);
    expect(compiled.graph?.nodes).toEqual(["recon", "marker"]);
  });

  it("emits no edges for a 1-node compile", () => {
    const compiled = compileBasCampaignDag([
      {
        dependsOn: [],
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      }
    ]);
    expect(compiled.error).toBeNull();
    expect(compiled.graph?.edges).toEqual([]);
    expect(compiled.graph?.executionOrder).toEqual([
      BAS_BENIGN_MARKER_SCENARIO_ID
    ]);
    expect(compiled.graph?.nodes).toEqual([BAS_BENIGN_MARKER_SCENARIO_ID]);
  });

  it("compiles a bounded acyclic campaign DAG and fails closed on cycles or oversized graphs", () => {
    const acyclic = compileBasCampaignDag([
      {
        dependsOn: [],
        stepKey: "recon",
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      },
      {
        dependsOn: ["recon"],
        stepKey: "marker",
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      }
    ]);
    expect(acyclic.error).toBeNull();
    expect(acyclic.graph).toEqual({
      edges: [{ from: "marker", to: "recon" }],
      executionOrder: ["recon", "marker"],
      nodes: ["recon", "marker"]
    });

    const cyclicInput = {
      scopeId: SCOPE_ID,
      scenarioPins: [
        {
          dependsOn: ["b"],
          provider: "ControlPlane" as const,
          stepKey: "a",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        },
        {
          dependsOn: ["a"],
          provider: "ControlPlane" as const,
          stepKey: "b",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      ]
    };
    const cyclic = compileBasCampaignDag(cyclicInput.scenarioPins);
    expect(cyclic.graph).toBeNull();
    expect(cyclic.error).toBe(BAS_CAMPAIGN_DAG_CYCLE_MESSAGE);
    expect(CompileBasCampaignInputSchema.safeParse(cyclicInput).success).toBe(
      false
    );
    expect(
      CompileBasCampaignInputSchema.safeParse({
        scopeId: SCOPE_ID,
        scenarioPins: [
          {
            dependsOn: ["missing"],
            provider: "ControlPlane",
            upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
          }
        ]
      }).success
    ).toBe(false);

    const oversized = Array.from(
      { length: MAX_BAS_CAMPAIGN_DAG_NODES + 1 },
      (_, index) => ({
        dependsOn: index === 0 ? [] : [`step-${index}`],
        stepKey: `step-${index + 1}`,
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      })
    );
    expect(compileBasCampaignDag(oversized)).toEqual({
      error: BAS_CAMPAIGN_DAG_TOO_LARGE_MESSAGE,
      graph: null
    });
  });

  it("never claims cleanup succeeded without an adapter receipt", () => {
    const pending = resolveBasCampaignStepCleanup({
      delayed: true,
      dispatched: true,
      stepKey: "marker"
    });
    expect(pending.status).toBe("pending");
    expect(pending.receiptSha256).toBeNull();

    const idle = resolveBasCampaignStepCleanup({
      delayed: false,
      dispatched: false,
      stepKey: "marker"
    });
    expect(idle.status).toBe("not_required");

    const receipt = {
      adapter: "ControlPlane" as const,
      outputHash: OTHER_SHA,
      receiptSha256: SHA,
      status: "succeeded" as const,
      stepKey: "marker",
      verifiedAt: "2026-09-17T00:00:00.000Z"
    };
    const verified = resolveBasCampaignStepCleanup({
      delayed: true,
      dispatched: true,
      receipt,
      stepKey: "marker"
    });
    expect(verified.status).toBe("succeeded");
    expect(verified.receiptSha256).toBe(SHA);

    expect(
      BasCampaignStepCleanupSchema.safeParse({
        detail: "claimed clean",
        status: "succeeded",
        stepKey: "marker"
      }).success
    ).toBe(false);
    expect(
      CancelBasCampaignResultSchema.safeParse({
        cancelCompleted: true,
        cancelRequested: true,
        cleanup: [
          {
            detail: "claimed clean",
            status: "succeeded",
            stepKey: "marker"
          }
        ],
        compiledDigest: SHA,
        delayedCancel: false,
        dispatchPrevented: true,
        mission: null
      }).success
    ).toBe(false);
  });

  it("records honest delayed cancel cleanup statuses", () => {
    const compiledDigest = campaignCompiledDigest(digestInput());
    const result = CancelBasCampaignResultSchema.parse({
      cancelCompleted: false,
      cancelRequested: true,
      cleanup: [
        {
          detail: "Runner task still leased; cancel requested.",
          status: "pending",
          stepKey: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      ],
      compiledDigest,
      delayedCancel: true,
      dispatchPrevented: true,
      mission: null
    });
    expect(result.dispatchPrevented).toBe(true);
    expect(result.delayedCancel).toBe(true);
    expect(result.cleanup[0]?.status).toBe("pending");
  });

  it("lists campaign previews with digest, typed inputs, policy, cleanup, and no liveSupported flip", () => {
    const compiledDigest = campaignCompiledDigest(digestInput());
    const plan = BasCampaignPlanSchema.parse({
      approvalDigest: campaignApprovalDigest({
        compiledDigest,
        expiresAt: "2026-09-18T00:00:00.000Z",
        outcome: "Allowed",
        policyDecisionId: POLICY_ID
      }),
      basCampaignPlanId: PLAN_ID,
      cleanupPolicy: {
        onCancel: "request_then_record",
        requireVerifiedCleanup: true
      },
      compiledDigest,
      contentVersionIds: [],
      createdAt: "2026-09-17T00:00:00.000Z",
      policyDecisionId: POLICY_ID,
      runnerId: null,
      scenarioPins: [
        {
          ...atomicContentPin,
          typedInputs: { timeout: 30 }
        }
      ],
      scopeId: SCOPE_ID,
      scopeVerificationStatus: "Verified",
      scopeVersion: "2026-09-17T00:00:00.000Z",
      startable: false,
      tenantId: TENANT_ID
    });
    const preview = BasCampaignPreviewSchema.parse({
      cancelledAt: null,
      cleanup: [
        {
          detail: null,
          status: "not_required",
          stepKey: "T1082-1"
        }
      ],
      denyReason:
        "Unreviewed BAS content cannot execute. Campaign start is denied and jobs are not queued.",
      dispatchPrevented: false,
      jobsQueued: 0,
      missionId: null,
      plan,
      policyOutcome: "Denied",
      policyRationale: "Live Atomic is not executable."
    });
    expect(preview.plan.compiledDigest).toBe(compiledDigest);
    expect(preview.plan.scenarioPins[0]?.typedInputs).toEqual({ timeout: 30 });
    expect(preview.policyOutcome).toBe("Denied");
    expect(preview.cleanup[0]?.status).toBe("not_required");
    expect(preview.jobsQueued).toBe(0);
    expect(preview.plan.startable).toBe(false);
    expect(
      BasCampaignPreviewSchema.safeParse({
        ...preview,
        liveSupported: true
      }).success
    ).toBe(false);
    expect(
      BasCampaignListSchema.parse({ items: [preview] }).items
    ).toHaveLength(1);
  });

  it("walks startable pins in topological order and never queues live, unreviewed, or extra DAG nodes", () => {
    const reverseListed = compileBasCampaignDag([
      {
        dependsOn: ["recon"],
        stepKey: "marker",
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      },
      {
        dependsOn: [],
        stepKey: "recon",
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      }
    ]);
    expect(reverseListed.error).toBeNull();
    const allowed = walkBasCampaignStartPins({
      executionOrder: reverseListed.graph?.executionOrder,
      pins: [
        {
          ...benignPin,
          dependsOn: ["recon"],
          stepKey: "marker"
        },
        {
          ...benignPin,
          dependsOn: [],
          stepKey: "recon"
        }
      ]
    });
    expect(allowed.failClosed).toBe(false);
    expect(allowed.queuedPins.map((pin) => pin.stepKey)).toEqual([
      "recon",
      "marker"
    ]);
    expect(allowed.queuedPins.map((pin) => pin.moduleId)).toEqual([
      BAS_BENIGN_MARKER_MODULE_ID,
      BAS_BENIGN_MARKER_MODULE_ID
    ]);
    expect(allowed.skippedStepKeys).toEqual([]);

    const mixedLive = walkBasCampaignStartPins({
      pins: [
        { ...benignPin, stepKey: "marker" },
        {
          contentSha256: SHA,
          dependsOn: ["marker"],
          provider: "ControlPlane",
          stepKey: "atomic",
          typedInputs: {},
          upstreamId: "atomic.live"
        }
      ]
    });
    expect(mixedLive.failClosed).toBe(true);
    expect(mixedLive.queuedPins).toEqual([]);
    expect(mixedLive.denyReason).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);

    const unreviewed = walkBasCampaignStartPins({
      hasUnreviewedContent: true,
      pins: [{ ...benignPin, stepKey: "marker" }]
    });
    expect(unreviewed.failClosed).toBe(true);
    expect(unreviewed.queuedPins).toEqual([]);

    const skippedUnknown = walkBasCampaignStartPins({
      pins: [
        { ...benignPin, stepKey: "marker" },
        {
          contentSha256: OTHER_SHA,
          provider: "ControlPlane",
          stepKey: "unknown",
          typedInputs: {},
          upstreamId: "control.unknown.not-in-catalog"
        }
      ]
    });
    expect(skippedUnknown.failClosed).toBe(false);
    expect(skippedUnknown.queuedPins.map((pin) => pin.stepKey)).toEqual([
      "marker"
    ]);
    expect(skippedUnknown.skippedStepKeys).toEqual(["unknown"]);

    const oversized = Array.from(
      { length: MAX_BAS_CAMPAIGN_DAG_NODES + 1 },
      (_, index) => ({
        ...benignPin,
        stepKey: `step-${index + 1}`
      })
    );
    const capped = walkBasCampaignStartPins({ pins: oversized });
    expect(capped.failClosed).toBe(false);
    expect(capped.queuedPins).toHaveLength(MAX_BAS_CAMPAIGN_DAG_NODES);
    expect(capped.queuedPins.map((pin) => pin.stepKey)).toEqual(
      oversized.slice(0, MAX_BAS_CAMPAIGN_DAG_NODES).map((pin) => pin.stepKey)
    );
    expect(capped.skippedStepKeys).toEqual(["step-13"]);
  });

  it("parses pack qualification and tenant authorization contracts and rejects enablement flags", () => {
    const qualification = atomicQualification();
    expect(qualification).toEqual({
      labReceiptHash: SHA,
      pack: "atomic",
      pinIds: ["atomic.live"],
      qualifiedAt: "2026-09-17T00:00:00.000Z"
    });
    const authorization = atomicAuthorization();
    expect(authorization.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(authorization.digest).toBe(
      tenantBasPackAuthorizationDigest({
        approver: APPROVER_ID,
        expiresAt: "2026-12-01T00:00:00.000Z",
        pack: "atomic",
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID
      })
    );
    expect(
      QualifyBasPackInputSchema.safeParse({
        labReceiptHash: SHA,
        pack: "atomic",
        pinIds: ["atomic.live"]
      }).success
    ).toBe(true);
    expect(
      AuthorizeBasPackInputSchema.safeParse({
        expiresAt: "2026-12-01T00:00:00.000Z",
        pack: "atomic",
        scopeId: SCOPE_ID
      }).success
    ).toBe(true);
    for (const extra of [
      { liveSupported: true },
      { startable: true },
      { PERISCAN_LIVE_OFFENSIVE: "1" },
      { jobsQueued: 1 }
    ]) {
      expect(
        QualifyBasPackInputSchema.safeParse({
          labReceiptHash: SHA,
          pack: "atomic",
          pinIds: ["atomic.live"],
          ...extra
        }).success
      ).toBe(false);
      expect(
        AuthorizeBasPackInputSchema.safeParse({
          expiresAt: "2026-12-01T00:00:00.000Z",
          pack: "atomic",
          scopeId: SCOPE_ID,
          ...extra
        }).success
      ).toBe(false);
    }
    expect(
      QualifyBasPackInputSchema.safeParse({
        pack: "atomic",
        pinIds: ["atomic.live"]
      }).success
    ).toBe(false);
  });

  it("starts only a live pin that is qualified, tenant-authorized, and policy-allowed", () => {
    const allowed = evaluateBasCampaignStartability({
      authorizations: [atomicAuthorization()],
      pins: [atomicLivePin],
      policyOutcome: "Allowed",
      qualifications: [atomicQualification()],
      runnerStatus: null,
      scopeId: SCOPE_ID,
      scopeVerified: true,
      tenantId: TENANT_ID
    });
    expect(allowed).toEqual({ denyReason: null, startable: true });

    const onlyThatPin = evaluateBasCampaignStartability({
      authorizations: [atomicAuthorization()],
      pins: [
        atomicLivePin,
        { ...atomicLivePin, upstreamId: "caldera.live", stepKey: "caldera" }
      ],
      policyOutcome: "Allowed",
      qualifications: [atomicQualification()],
      runnerStatus: null,
      scopeId: SCOPE_ID,
      scopeVerified: true,
      tenantId: TENANT_ID
    });
    expect(onlyThatPin.startable).toBe(false);
  });

  it("denies live packs without qualification or authorization and ignores PERISCAN_LIVE_OFFENSIVE", () => {
    const previous = process.env.PERISCAN_LIVE_OFFENSIVE;
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    try {
      expect(
        evaluateBasCampaignStartability({
          pins: [atomicLivePin],
          policyOutcome: "Allowed",
          runnerStatus: null,
          scopeId: SCOPE_ID,
          scopeVerified: true,
          tenantId: TENANT_ID
        })
      ).toEqual({
        denyReason: LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic,
        startable: false
      });
      expect(
        evaluateBasCampaignStartability({
          authorizations: [atomicAuthorization()],
          pins: [atomicLivePin],
          policyOutcome: "Allowed",
          qualifications: [],
          runnerStatus: null,
          scopeId: SCOPE_ID,
          scopeVerified: true,
          tenantId: TENANT_ID
        }).startable
      ).toBe(false);
      expect(
        evaluateBasCampaignStartability({
          authorizations: [],
          pins: [atomicLivePin],
          policyOutcome: "Allowed",
          qualifications: [atomicQualification()],
          runnerStatus: null,
          scopeId: SCOPE_ID,
          scopeVerified: true,
          tenantId: TENANT_ID
        }).startable
      ).toBe(false);
      expect(
        evaluateBasCampaignStartability({
          authorizations: [
            atomicAuthorization({ expiresAt: "2020-01-01T00:00:00.000Z" })
          ],
          now: "2026-09-17T00:00:00.000Z",
          pins: [atomicLivePin],
          policyOutcome: "Allowed",
          qualifications: [atomicQualification()],
          runnerStatus: null,
          scopeId: SCOPE_ID,
          scopeVerified: true,
          tenantId: TENANT_ID
        }).startable
      ).toBe(false);
      expect(
        evaluateBasCampaignStartability({
          authorizations: [atomicAuthorization()],
          pins: [atomicLivePin],
          policyOutcome: "Denied",
          qualifications: [atomicQualification()],
          runnerStatus: null,
          scopeId: SCOPE_ID,
          scopeVerified: true,
          tenantId: TENANT_ID
        }).startable
      ).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.PERISCAN_LIVE_OFFENSIVE;
      } else {
        process.env.PERISCAN_LIVE_OFFENSIVE = previous;
      }
    }
  });

  it("places T1486, persistence, and unrestricted Metasploit PAYLOAD in High danger (extra ack)", () => {
    const gate = {
      authorizations: [
        atomicAuthorization(),
        atomicAuthorization({ pack: "metasploit" })
      ],
      policyOutcome: "Allowed" as const,
      qualifications: [
        atomicQualification(),
        atomicQualification({ pack: "metasploit", pinIds: ["metasploit.live"] })
      ],
      runnerStatus: null,
      scopeId: SCOPE_ID,
      scopeVerified: true,
      tenantId: TENANT_ID
    };
    expect(
      evaluateBasCampaignStartability({ ...gate, pins: [ransomwarePin] })
    ).toEqual({
      denyReason: BAS_DANGER_ACK_DENY_REASON,
      startable: false
    });
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        dangerAcknowledged: true,
        dangerAckDigest: "a".repeat(16),
        pins: [ransomwarePin],
        qualifications: [atomicQualification({ pinIds: ["T1486"] })]
      }).startable
    ).toBe(true);
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        pins: [
          {
            ...atomicLivePin,
            typedInputs: { persistence: true },
            upstreamId: "atomic.live"
          }
        ]
      }).startable
    ).toBe(false);
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        dangerAcknowledged: true,
        dangerAckDigest: "a".repeat(16),
        pins: [
          {
            ...atomicLivePin,
            typedInputs: { persistence: true },
            upstreamId: "atomic.live"
          }
        ]
      }).startable
    ).toBe(true);
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        pins: [
          {
            contentSha256: SHA,
            provider: "ControlPlane",
            typedInputs: { credentialTheft: true },
            upstreamId: "atomic.live"
          }
        ]
      }).startable
    ).toBe(false);
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        pins: [
          {
            contentSha256: SHA,
            provider: "ControlPlane",
            typedInputs: { PAYLOAD: "windows/meterpreter/reverse_tcp" },
            upstreamId: "metasploit.live"
          }
        ]
      }).startable
    ).toBe(false);
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        dangerAcknowledged: true,
        dangerAckDigest: "a".repeat(16),
        pins: [
          {
            contentSha256: SHA,
            provider: "ControlPlane",
            typedInputs: { PAYLOAD: "windows/meterpreter/reverse_tcp" },
            upstreamId: "metasploit.live"
          }
        ]
      }).startable
    ).toBe(true);
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        qualifications: [atomicQualification({ pinIds: ["T1110-1"] })],
        pins: [
          {
            contentSha256: SHA,
            provider: "AtomicRedTeam",
            typedInputs: { spray: true },
            upstreamId: "T1110-1"
          }
        ]
      }).startable
    ).toBe(false);
    expect(
      evaluateBasCampaignStartability({
        ...gate,
        qualifications: [
          atomicQualification({ pinIds: ["T1110-1"] })
        ],
        pins: [
          {
            contentSha256: SHA,
            provider: "AtomicRedTeam",
            typedInputs: {
              ownedAccount: true,
              verifiedScopeIdentity: "user@verified.example"
            },
            upstreamId: "T1110-1"
          }
        ]
      }).startable
    ).toBe(true);
  });

  it("walks a qualified live pin and still fail-closes unqualified live, forbidden, and unreviewed pins", () => {
    const walked = walkBasCampaignStartPins({
      authorizations: [atomicAuthorization()],
      pins: [{ ...atomicLivePin, stepKey: "atomic" }],
      policyOutcome: "Allowed",
      qualifications: [atomicQualification()],
      scopeId: SCOPE_ID,
      tenantId: TENANT_ID
    });
    expect(walked.failClosed).toBe(false);
    expect(walked.queuedPins).toEqual([
      {
        moduleId: "atomic.control_validation_safe",
        stepKey: "atomic",
        upstreamId: "atomic.live"
      }
    ]);

    const mixedUnqualified = walkBasCampaignStartPins({
      pins: [
        { ...benignPin, stepKey: "marker" },
        { ...atomicLivePin, dependsOn: ["marker"], stepKey: "atomic" }
      ]
    });
    expect(mixedUnqualified.failClosed).toBe(true);
    expect(mixedUnqualified.queuedPins).toEqual([]);

    const forbidden = walkBasCampaignStartPins({
      authorizations: [atomicAuthorization()],
      pins: [ransomwarePin],
      policyOutcome: "Allowed",
      qualifications: [atomicQualification({ pinIds: ["T1486"] })],
      scopeId: SCOPE_ID,
      tenantId: TENANT_ID
    });
    expect(forbidden.failClosed).toBe(true);
    expect(forbidden.queuedPins).toEqual([]);
    expect(forbidden.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);
  });
});
