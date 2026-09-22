import { describe, expect, it } from "vitest";

import {
  BAS_BENIGN_MARKER_MODULE_ID,
  BAS_BENIGN_MARKER_SCENARIO_ID,
  LIVE_OFFENSIVE_PACK_DENY_REASONS
} from "./bas-control-plane.js";
import {
  BAS_CAMPAIGN_DAG_CYCLE_MESSAGE,
  BAS_CAMPAIGN_DAG_TOO_LARGE_MESSAGE,
  MAX_BAS_CAMPAIGN_DAG_NODES
} from "./bas-campaign.js";
import { EMAIL_DELIVERY_CANARY_MODULE_ID } from "./email-dns-canary.js";
import {
  BAS_INJECT_COPY_FORBIDDEN,
  BAS_INJECT_LIVE_SUPPORTED,
  BAS_INJECT_PRODUCT_COPY,
  BAS_INJECT_PRODUCT_NOUN,
  BAS_INJECT_TIMELINE_INVERSION_MESSAGE,
  BasInjectSchema,
  CompileBasInjectCampaignResultSchema,
  EvaluateBasInjectQueueResultSchema,
  StartBasInjectResultSchema,
  basInjectProductCopyContainsVendor,
  basInjectToCampaignPin,
  compileBasInjectCampaign,
  evaluateBasInjectQueue,
  formatBasInjectLabel,
  importBasInjects,
  mapExpectedObservationToCorrelationVerdict,
  startBasInject,
  type BasInject
} from "./bas-inject.js";

const ASSET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHA = "a".repeat(64);
const T0 = "2026-09-17T14:00:00.000Z";
const T1 = "2026-09-17T14:05:00.000Z";
const DANGER_ACK = "danger-ack-digest1";

function technicalInject(overrides: Record<string, unknown> = {}): BasInject {
  return BasInjectSchema.parse({
    actionRef: {
      moduleId: BAS_BENIGN_MARKER_MODULE_ID,
      pin: {
        contentSha256: SHA,
        provider: "ControlPlane",
        typedInputs: {},
        upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
      }
    },
    dependsOn: [],
    expectedObservation: "logged",
    kind: "technical",
    scheduledAt: T0,
    stepKey: "marker",
    targetRef: { assetId: ASSET_ID, kind: "asset" },
    ...overrides
  });
}

function emailInject(overrides: Record<string, unknown> = {}): BasInject {
  return BasInjectSchema.parse({
    actionRef: {
      moduleId: EMAIL_DELIVERY_CANARY_MODULE_ID,
      pin: {
        contentSha256: SHA,
        provider: "ControlPlane",
        typedInputs: {},
        upstreamId: "control.email.delivery-canary"
      }
    },
    channel: "synthetic_canary",
    dependsOn: [],
    expectedObservation: "alerted",
    kind: "email",
    scheduledAt: T0,
    stepKey: "email-canary",
    targetRef: { kind: "player", playerId: "soc-oncall" },
    ...overrides
  });
}

function tabletopInject(overrides: Record<string, unknown> = {}): BasInject {
  return BasInjectSchema.parse({
    actionRef: {
      moduleId: "periscan.tabletop_canary",
      pin: {
        contentSha256: SHA,
        provider: "ControlPlane",
        typedInputs: {},
        upstreamId: "control.tabletop.canary"
      }
    },
    channel: "synthetic_canary",
    dependsOn: [],
    expectedObservation: "logged",
    kind: "tabletop",
    scheduledAt: T1,
    stepKey: "tabletop-canary",
    targetRef: { kind: "player", playerId: "crisis-cell" },
    ...overrides
  });
}

describe("BasInject contract", () => {
  it("wraps a technical action with who, when, and expected observation", () => {
    const inject = technicalInject({
      expectedObservation: "prevented",
      scheduledAt: T1,
      stepKey: "endpoint-marker"
    });

    expect(inject.actionRef.moduleId).toBe(BAS_BENIGN_MARKER_MODULE_ID);
    expect(inject.actionRef.pin?.upstreamId).toBe(
      BAS_BENIGN_MARKER_SCENARIO_ID
    );
    expect(inject.targetRef).toEqual({ assetId: ASSET_ID, kind: "asset" });
    expect(inject.scheduledAt).toBe(T1);
    expect(inject.expectedObservation).toBe("prevented");
    expect(inject.kind).toBe("technical");
  });

  it("accepts a player target for email and tabletop Injects", () => {
    expect(emailInject().targetRef).toEqual({
      kind: "player",
      playerId: "soc-oncall"
    });
    expect(tabletopInject().targetRef.kind).toBe("player");
  });

  it("rejects liveSupported, vendor fields, and extra compile claims on the Inject", () => {
    const base = {
      actionRef: {
        moduleId: BAS_BENIGN_MARKER_MODULE_ID,
        pin: {
          contentSha256: SHA,
          provider: "ControlPlane",
          typedInputs: {},
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      },
      expectedObservation: "logged",
      scheduledAt: T0,
      stepKey: "marker",
      targetRef: { assetId: ASSET_ID, kind: "asset" }
    };
    expect(BasInjectSchema.safeParse(base).success).toBe(true);
    for (const extra of [
      { liveSupported: true },
      { OpenAEV: true },
      { openaevInjectId: "inj" },
      { queued: true },
      { jobsQueued: 1 },
      { executable: true }
    ]) {
      expect(BasInjectSchema.safeParse({ ...base, ...extra }).success).toBe(
        false
      );
    }
    expect(
      BasInjectSchema.safeParse({
        ...base,
        expectedObservation: "executed"
      }).success
    ).toBe(false);
  });

  it("maps expected observations to correlation verdicts without inventing Missed", () => {
    expect(mapExpectedObservationToCorrelationVerdict("logged")).toBe("Logged");
    expect(mapExpectedObservationToCorrelationVerdict("alerted")).toBe(
      "Alerted"
    );
    expect(mapExpectedObservationToCorrelationVerdict("prevented")).toBe(
      "Prevented"
    );
    expect(mapExpectedObservationToCorrelationVerdict("inconclusive")).toBe(
      "Inconclusive"
    );
  });
});

describe("BasInject product copy", () => {
  it("uses Inject, not OpenAEV, in product-facing copy", () => {
    expect(BAS_INJECT_PRODUCT_NOUN).toBe("Inject");
    expect(formatBasInjectLabel(technicalInject())).toBe("Inject marker");
    expect(BAS_INJECT_COPY_FORBIDDEN).toEqual(["OpenAEV", "OpenBAS"]);
    for (const value of Object.values(BAS_INJECT_PRODUCT_COPY)) {
      expect(basInjectProductCopyContainsVendor(value)).toBe(false);
      expect(value).toMatch(/Inject/);
      expect(value).not.toMatch(/OpenAEV/i);
    }
    expect(basInjectProductCopyContainsVendor("OpenAEV inject")).toBe(true);
    expect(basInjectProductCopyContainsVendor("Inject marker")).toBe(false);
  });
});

describe("compileBasInjectCampaign", () => {
  it("compiles Injects through the existing campaign DAG compiler", () => {
    const compiled = compileBasInjectCampaign({
      injects: [
        technicalInject({ stepKey: "recon" }),
        technicalInject({
          dependsOn: ["recon"],
          scheduledAt: T1,
          stepKey: "marker"
        })
      ]
    });

    expect(compiled.error).toBeNull();
    expect(compiled.queued).toBe(false);
    expect(compiled.jobsQueued).toBe(0);
    expect(compiled.liveSupported).toBe(false);
    expect(compiled.graph).toEqual({
      edges: [{ from: "marker", to: "recon" }],
      executionOrder: ["recon", "marker"],
      nodes: ["recon", "marker"]
    });
    expect(compiled.pins.map((pin) => pin.stepKey)).toEqual([
      "recon",
      "marker"
    ]);
    expect(compiled.pins[0]?.upstreamId).toBe(BAS_BENIGN_MARKER_SCENARIO_ID);
    expect(CompileBasInjectCampaignResultSchema.parse(compiled).queued).toBe(
      false
    );
  });

  it("fails closed on cycles, oversized graphs, and timeline inversions", () => {
    const cyclic = compileBasInjectCampaign({
      injects: [
        technicalInject({ dependsOn: ["b"], stepKey: "a" }),
        technicalInject({ dependsOn: ["a"], stepKey: "b" })
      ]
    });
    expect(cyclic.graph).toBeNull();
    expect(cyclic.error).toBe(BAS_CAMPAIGN_DAG_CYCLE_MESSAGE);
    expect(cyclic.queued).toBe(false);
    expect(cyclic.jobsQueued).toBe(0);

    const oversized = compileBasInjectCampaign({
      injects: Array.from(
        { length: MAX_BAS_CAMPAIGN_DAG_NODES + 1 },
        (_, index) =>
          technicalInject({
            dependsOn: index === 0 ? [] : [`step-${index}`],
            stepKey: `step-${index + 1}`
          })
      )
    });
    expect(oversized.error).toBe(BAS_CAMPAIGN_DAG_TOO_LARGE_MESSAGE);
    expect(oversized.graph).toBeNull();

    const inverted = compileBasInjectCampaign({
      injects: [
        technicalInject({ scheduledAt: T1, stepKey: "recon" }),
        technicalInject({
          dependsOn: ["recon"],
          scheduledAt: T0,
          stepKey: "marker"
        })
      ]
    });
    expect(inverted.graph).toBeNull();
    expect(inverted.error).toBe(BAS_INJECT_TIMELINE_INVERSION_MESSAGE);
    expect(inverted.jobsQueued).toBe(0);
  });

  it("never lets compile results claim queued work or liveSupported", () => {
    expect(BAS_INJECT_LIVE_SUPPORTED).toBe(false);
    const compiled = compileBasInjectCampaign({
      injects: [technicalInject()]
    });
    expect(compiled.liveSupported).toBe(false);
    expect(
      CompileBasInjectCampaignResultSchema.safeParse({
        ...compiled,
        jobsQueued: 1,
        queued: true
      }).success
    ).toBe(false);
    expect(
      CompileBasInjectCampaignResultSchema.safeParse({
        ...compiled,
        liveSupported: true
      }).success
    ).toBe(false);
  });

  it("projects an Inject actionRef onto a campaign pin", () => {
    const pin = basInjectToCampaignPin(technicalInject());
    expect(pin).toMatchObject({
      contentSha256: SHA,
      dependsOn: [],
      provider: "ControlPlane",
      stepKey: "marker",
      upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
    });
  });
});

describe("evaluateBasInjectQueue", () => {
  it("never queues without policy Allowed and verified scope", () => {
    const denied = evaluateBasInjectQueue({
      injects: [technicalInject()],
      policyOutcome: "Denied",
      scopeVerified: true
    });
    expect(denied.startable).toBe(false);
    expect(denied.queueable).toBe(false);
    expect(denied.queued).toBe(false);
    expect(denied.jobsQueued).toBe(0);
    expect(denied.liveSupported).toBe(false);
    expect(denied.denyReason).toMatch(/policy/i);

    const unverified = evaluateBasInjectQueue({
      injects: [technicalInject()],
      policyOutcome: "Allowed",
      scopeVerified: false
    });
    expect(unverified.startable).toBe(false);
    expect(unverified.queued).toBe(false);
    expect(unverified.jobsQueued).toBe(0);
    expect(unverified.denyReason).toMatch(/verified scope/i);

    expect(
      EvaluateBasInjectQueueResultSchema.safeParse({
        ...denied,
        jobsQueued: 1,
        queued: true
      }).success
    ).toBe(false);
  });

  it("marks a verified Allowed benign-marker Inject queueable without enqueueing", () => {
    const result = evaluateBasInjectQueue({
      injects: [technicalInject()],
      policyOutcome: "Allowed",
      scopeVerified: true
    });
    expect(result.startable).toBe(true);
    expect(result.queueable).toBe(true);
    expect(result.queued).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.liveSupported).toBe(false);
    expect(result.denyReason).toBeNull();
    expect(result.deliveryMode).toBe("technical");
  });

  it("does not queue live Atomic Injects even with Allowed and verified scope", () => {
    const result = evaluateBasInjectQueue({
      injects: [
        technicalInject({
          actionRef: {
            moduleId: "atomic.control_validation_safe",
            pin: {
              contentSha256: SHA,
              provider: "AtomicRedTeam",
              typedInputs: {},
              upstreamId: "atomic.live"
            }
          },
          stepKey: "atomic"
        })
      ],
      policyOutcome: "Allowed",
      scopeVerified: true
    });
    expect(result.startable).toBe(false);
    expect(result.queueable).toBe(false);
    expect(result.queued).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.denyReason).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);
  });

  it("keeps email and tabletop Injects on synthetic canary unless High-danger ack", () => {
    const email = evaluateBasInjectQueue({
      injects: [emailInject()],
      policyOutcome: "Allowed",
      scopeVerified: true
    });
    expect(email.startable).toBe(true);
    expect(email.deliveryMode).toBe("synthetic_canary");
    expect(email.queued).toBe(false);
    expect(email.jobsQueued).toBe(0);
    expect(email.liveSupported).toBe(false);

    const phishing = evaluateBasInjectQueue({
      injects: [emailInject({ channel: "phishing_send" })],
      policyOutcome: "Allowed",
      scopeVerified: true
    });
    expect(phishing.startable).toBe(false);
    expect(phishing.queued).toBe(false);
    expect(phishing.jobsQueued).toBe(0);
    expect(phishing.denyReason).toMatch(/canary|danger/i);

    const tabletopLive = evaluateBasInjectQueue({
      injects: [tabletopInject({ channel: "tabletop_live" })],
      policyOutcome: "Allowed",
      scopeVerified: true
    });
    expect(tabletopLive.startable).toBe(false);
    expect(tabletopLive.jobsQueued).toBe(0);

    const gated = evaluateBasInjectQueue({
      dangerAckDigest: DANGER_ACK,
      dangerAcknowledged: true,
      injects: [
        emailInject({
          actionRef: {
            moduleId: "identity.cred_spray",
            pin: {
              contentSha256: SHA,
              provider: "ControlPlane",
              typedInputs: {},
              upstreamId: "identity.cred_spray"
            }
          },
          channel: "phishing_send",
          stepKey: "spray"
        })
      ],
      policyOutcome: "Allowed",
      qualified: true,
      scopeVerified: true,
      tenantAuthorized: true
    });
    expect(gated.startable).toBe(true);
    expect(gated.deliveryMode).toBe("high_danger_gated");
    expect(gated.queued).toBe(false);
    expect(gated.jobsQueued).toBe(0);
    expect(gated.liveSupported).toBe(false);
  });

  it("does not queue a High-danger email Inject when ack is missing even if policy Allowed", () => {
    const result = evaluateBasInjectQueue({
      dangerAcknowledged: false,
      injects: [
        emailInject({
          actionRef: {
            moduleId: "identity.cred_spray",
            pin: {
              contentSha256: SHA,
              provider: "ControlPlane",
              typedInputs: {},
              upstreamId: "identity.cred_spray"
            }
          },
          channel: "phishing_send"
        })
      ],
      policyOutcome: "Allowed",
      qualified: true,
      scopeVerified: true,
      tenantAuthorized: true
    });
    expect(result.startable).toBe(false);
    expect(result.queued).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.liveSupported).toBe(false);
  });
});

describe("importBasInjects", () => {
  it("normalizes OpenAEV-shaped inject JSON into who/when/expected Injects without executing", () => {
    const result = importBasInjects({
      originAt: T0,
      scenario_injects: [
        {
          inject_assets: [{ asset_id: ASSET_ID }],
          inject_depends_duration: 300,
          inject_depends_on: [],
          inject_expectations: [{ inject_expectation_type: "DETECTION" }],
          inject_id: "inj-hostname",
          inject_injector_contract: {
            injector_contract_payload: {
              payload_id: BAS_BENIGN_MARKER_MODULE_ID,
              payload_type: "Command"
            }
          },
          inject_title: "Hostname discovery",
          inject_type: "Command"
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.executed).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.liveSupported).toBe(false);
    expect(result.injects).toHaveLength(1);
    expect(result.injects[0]).toMatchObject({
      expectedObservation: "alerted",
      kind: "technical",
      scheduledAt: "2026-09-17T14:05:00.000Z",
      stepKey: "inj-hostname",
      targetRef: { assetId: ASSET_ID, kind: "asset" }
    });
    expect(result.injects[0]?.actionRef.moduleId).toBe(
      BAS_BENIGN_MARKER_MODULE_ID
    );
  });

  it("maps a team target and PREVENTION expectation onto a player Inject", () => {
    const result = importBasInjects({
      originAt: T0,
      scenario_injects: [
        {
          inject_depends_duration: 0,
          inject_expectations: [{ inject_expectation_type: "PREVENTION" }],
          inject_id: "inj-email",
          inject_teams: [{ team_id: "soc-oncall" }],
          inject_title: "Email canary",
          inject_type: "openbas_email"
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.injects[0]?.kind).toBe("email");
    expect(result.injects[0]?.expectedObservation).toBe("prevented");
    expect(result.injects[0]?.targetRef).toEqual({
      kind: "player",
      playerId: "soc-oncall"
    });
    expect(result.executed).toBe(false);
  });

  it("fails closed without a who-target and never queues", () => {
    const result = importBasInjects({
      originAt: T0,
      scenario_injects: [
        {
          inject_depends_duration: 0,
          inject_expectations: [{ inject_expectation_type: "DETECTION" }],
          inject_id: "inj-orphan",
          inject_title: "No target"
        }
      ]
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.executed).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.liveSupported).toBe(false);
    expect(result.rationale).toMatch(/target/i);
    expect(basInjectProductCopyContainsVendor(result.rationale)).toBe(false);
  });

  it("rejects executed-coverage claims and live vendor SaaS fields", () => {
    for (const boast of [
      { executed: true, injects: [technicalInject()] },
      { executedCoverage: true, injects: [technicalInject()] },
      { liveSupported: true, injects: [technicalInject()] },
      {
        injects: [technicalInject()],
        openaevUrl: "https://cloud.filigran.io"
      }
    ]) {
      const result = importBasInjects(boast);
      expect(result.ok).toBe(false);
      if (result.ok) {
        continue;
      }
      expect(result.executed).toBe(false);
      expect(result.jobsQueued).toBe(0);
      expect(result.liveSupported).toBe(false);
      expect(basInjectProductCopyContainsVendor(result.rationale)).toBe(false);
    }
  });
});

describe("startBasInject", () => {
  it("plans an Allowed verified-scope Inject without queueing or executing", () => {
    const result = startBasInject({
      injects: [technicalInject()],
      policyOutcome: "Allowed",
      scopeVerified: true
    });

    expect(result.startable).toBe(true);
    expect(result.outcome).toBe("Allowed");
    expect(result.queued).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.executed).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.denyReason).toBeNull();
    expect(result.rationale).toMatch(/planned/i);
    expect(basInjectProductCopyContainsVendor(result.rationale)).toBe(false);
    expect(StartBasInjectResultSchema.parse(result).queued).toBe(false);
  });

  it("never queues denied live Atomic or unverified-scope Inject starts", () => {
    const live = startBasInject({
      injects: [
        technicalInject({
          actionRef: {
            moduleId: "atomic.control_validation_safe",
            pin: {
              contentSha256: SHA,
              provider: "AtomicRedTeam",
              typedInputs: {},
              upstreamId: "atomic.live"
            }
          },
          stepKey: "atomic"
        })
      ],
      policyOutcome: "Allowed",
      scopeVerified: true
    });
    expect(live.outcome).toBe("Denied");
    expect(live.startable).toBe(false);
    expect(live.queued).toBe(false);
    expect(live.jobsQueued).toBe(0);
    expect(live.executed).toBe(false);
    expect(live.liveSupported).toBe(false);
    expect(live.denyReason).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);

    const unverified = startBasInject({
      injects: [technicalInject()],
      policyOutcome: "Allowed",
      scopeVerified: false
    });
    expect(unverified.outcome).toBe("RequiresVerifiedScope");
    expect(unverified.queued).toBe(false);
    expect(unverified.jobsQueued).toBe(0);
    expect(unverified.executed).toBe(false);

    expect(
      StartBasInjectResultSchema.safeParse({
        ...live,
        jobsQueued: 1,
        queued: true
      }).success
    ).toBe(false);
    expect(
      StartBasInjectResultSchema.safeParse({
        ...live,
        liveSupported: true
      }).success
    ).toBe(false);
    expect(
      StartBasInjectResultSchema.safeParse({
        ...live,
        executed: true
      }).success
    ).toBe(false);
  });

  it("starts an imported OpenAEV-shaped Atomic Inject as a denied plan, never live SaaS", () => {
    const imported = importBasInjects({
      originAt: T0,
      scenario_injects: [
        {
          inject_assets: [{ asset_id: ASSET_ID }],
          inject_depends_duration: 0,
          inject_expectations: [{ inject_expectation_type: "DETECTION" }],
          inject_id: "inj-atomic",
          inject_title: "Atomic hostname",
          inject_type: "openbas_atomic"
        }
      ]
    });
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      return;
    }

    const started = startBasInject({
      injects: imported.injects,
      policyOutcome: "Allowed",
      scopeVerified: true
    });
    expect(started.startable).toBe(false);
    expect(started.outcome).toBe("Denied");
    expect(started.queued).toBe(false);
    expect(started.jobsQueued).toBe(0);
    expect(started.executed).toBe(false);
    expect(started.liveSupported).toBe(false);
    expect(started.denyReason).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);
    expect(basInjectProductCopyContainsVendor(started.rationale)).toBe(false);
  });
});
