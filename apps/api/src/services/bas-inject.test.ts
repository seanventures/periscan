import { describe, expect, it } from "vitest";

import {
  BAS_BENIGN_MARKER_MODULE_ID,
  BAS_BENIGN_MARKER_SCENARIO_ID,
  EMAIL_DELIVERY_CANARY_MODULE_ID
} from "@periscan/shared";

import { compileBasInjects, evaluateBasInjectDispatch } from "./bas-inject.js";

const ASSET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SCOPE_ID = "22222222-2222-4222-8222-222222222222";
const SHA = "a".repeat(64);
const T0 = "2026-09-17T14:00:00.000Z";
const T1 = "2026-09-17T14:05:00.000Z";

const markerInject = {
  actionRef: {
    moduleId: BAS_BENIGN_MARKER_MODULE_ID,
    pin: {
      contentSha256: SHA,
      provider: "ControlPlane" as const,
      typedInputs: {},
      upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
    }
  },
  expectedObservation: "logged" as const,
  kind: "technical" as const,
  scheduledAt: T0,
  stepKey: "recon",
  targetRef: { assetId: ASSET_ID, kind: "asset" as const }
};

describe("bas-inject API service", () => {
  it("compiles Injects into a campaign DAG without queueing or flipping liveSupported", () => {
    const compiled = compileBasInjects({
      injects: [
        markerInject,
        {
          ...markerInject,
          dependsOn: ["recon"],
          scheduledAt: T1,
          stepKey: "marker"
        }
      ],
      scopeId: SCOPE_ID
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.queued).toBe(false);
    expect(compiled.jobsQueued).toBe(0);
    expect(compiled.liveSupported).toBe(false);
    expect(compiled.campaignInput.scopeId).toBe(SCOPE_ID);
    expect(
      compiled.campaignInput.scenarioPins.map((pin) => pin.stepKey)
    ).toEqual(["recon", "marker"]);
    expect(compiled.graph?.executionOrder).toEqual(["recon", "marker"]);
  });

  it("does not queue Injects without policy Allowed and verified scope", () => {
    const denied = evaluateBasInjectDispatch({
      injects: [markerInject],
      policyOutcome: "Denied",
      scopeId: SCOPE_ID,
      scopeVerified: true
    });
    expect(denied.queued).toBe(false);
    expect(denied.jobsQueued).toBe(0);
    expect(denied.startable).toBe(false);
    expect(denied.liveSupported).toBe(false);

    const unverified = evaluateBasInjectDispatch({
      injects: [markerInject],
      policyOutcome: "Allowed",
      scopeId: SCOPE_ID,
      scopeVerified: false
    });
    expect(unverified.queued).toBe(false);
    expect(unverified.jobsQueued).toBe(0);
    expect(unverified.startable).toBe(false);
  });

  it("keeps email Injects on a synthetic canary unless High-danger ack", () => {
    const email = evaluateBasInjectDispatch({
      injects: [
        {
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
          expectedObservation: "alerted",
          kind: "email",
          scheduledAt: T0,
          stepKey: "email-canary",
          targetRef: { kind: "player", playerId: "soc-oncall" }
        }
      ],
      policyOutcome: "Allowed",
      scopeId: SCOPE_ID,
      scopeVerified: true
    });
    expect(email.deliveryMode).toBe("synthetic_canary");
    expect(email.startable).toBe(true);
    expect(email.queued).toBe(false);
    expect(email.liveSupported).toBe(false);

    const phishing = evaluateBasInjectDispatch({
      injects: [
        {
          actionRef: {
            moduleId: EMAIL_DELIVERY_CANARY_MODULE_ID,
            pin: {
              contentSha256: SHA,
              provider: "ControlPlane",
              typedInputs: {},
              upstreamId: "control.email.delivery-canary"
            }
          },
          channel: "phishing_send",
          expectedObservation: "alerted",
          kind: "email",
          scheduledAt: T0,
          stepKey: "email-phish",
          targetRef: { kind: "player", playerId: "soc-oncall" }
        }
      ],
      policyOutcome: "Allowed",
      scopeId: SCOPE_ID,
      scopeVerified: true
    });
    expect(phishing.startable).toBe(false);
    expect(phishing.queued).toBe(false);
    expect(phishing.jobsQueued).toBe(0);
    expect(phishing.liveSupported).toBe(false);
  });
});
