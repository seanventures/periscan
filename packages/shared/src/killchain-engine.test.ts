import { describe, expect, it } from "vitest";

import { BAS_DANGER_ACK_DENY_REASON } from "./bas-campaign";
import { COMMUNITY_FIRST_HOUR_MODULE_IDS } from "./community-edition";
import { HIGH_DANGER_ACK_DIGEST, listDangerCatalog } from "./danger-section";
import {
  KILLCHAIN_ENGINE_MODULE_ID,
  RANSOMWARE_TECHNIQUE_ID,
  compileKillChainEngineStart,
  isForbiddenKillChainCampaignToken
} from "./killchain-engine";
import { listExecutableSafeStages } from "./safe-stage-playbooks";

const T1486_HIGH_DANGER_PIN = {
  moduleId: "exploitation.impact_t1486",
  stepKey: "T1486",
  techniqueId: RANSOMWARE_TECHNIQUE_ID
} as const;

const HIGH_DANGER_GATE = {
  dangerAcknowledged: true,
  dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
  qualified: true,
  tenantAuthorized: true
} as const;

const REMAINING_HIGH_DANGER_PINS = [
  {
    moduleId: "identity.cred_spray",
    stepKey: "T1110-unscoped",
    techniqueId: "T1110"
  },
  {
    moduleId: "identity.credential_harvest",
    stepKey: "T1003",
    techniqueId: "T1003"
  },
  {
    moduleId: "exploitation.persistence",
    stepKey: "T1547",
    techniqueId: "T1547"
  },
  {
    moduleId: "exploit.metasploit_payload",
    stepKey: "T1203",
    techniqueId: "T1203"
  }
] as const;

const METASPLOIT_PAYLOAD_CLASS_PIN = {
  moduleId: "PAYLOAD",
  stepKey: "PAYLOAD",
  techniqueId: "T1203"
} as const;

const INCOMPLETE_HIGH_DANGER_GATES = [
  {
    dangerAcknowledged: true,
    dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
    qualified: true,
    tenantAuthorized: false
  },
  {
    dangerAcknowledged: true,
    dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
    qualified: false,
    tenantAuthorized: true
  },
  {
    dangerAcknowledged: false,
    dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
    qualified: true,
    tenantAuthorized: true
  },
  {
    dangerAcknowledged: true,
    qualified: true,
    tenantAuthorized: true
  },
  {
    dangerAcknowledged: true,
    dangerAckDigest: "short-digest",
    qualified: true,
    tenantAuthorized: true
  }
] as const;

describe("kill-chain engine start compiler", () => {
  it("is startable only as a DAG of already-qualified non-Forbidden pins", () => {
    const qualified = listExecutableSafeStages();
    expect(qualified.length).toBeGreaterThan(0);
    expect(qualified.some((stage) => stage.techniqueId === "T1486")).toBe(
      false
    );
    const pins = qualified.map((stage, index) => ({
      dependsOn: index === 0 ? [] : [qualified[0]!.techniqueId],
      moduleId: stage.defaultModuleId!,
      stepKey: stage.techniqueId,
      techniqueId: stage.techniqueId
    }));

    const compiled = compileKillChainEngineStart({ pins });
    expect(KILLCHAIN_ENGINE_MODULE_ID).toBe("exploitation.killchain.engine");
    expect(compiled.startable).toBe(true);
    expect(compiled.jobsQueued).toBe(pins.length);
    expect(compiled.queuedPins.map((pin) => pin.techniqueId).sort()).toEqual(
      qualified.map((stage) => stage.techniqueId).sort()
    );
    expect(
      compiled.queuedPins.every((pin) =>
        ["Exposure", "Detection", "Config"].includes(pin.measurementClass)
      )
    ).toBe(true);
    expect(compiled.graph?.executionOrder[0]).toBe(qualified[0]!.techniqueId);
    expect(compiled.ransomware).toMatchObject({
      measured: false,
      measurementClass: "Danger",
      startable: false,
      techniqueId: "T1486"
    });
  });

  it("denies T1486 High-danger without ack, never queues, and stays measured:false", () => {
    const ransomware = compileKillChainEngineStart({
      pins: [T1486_HIGH_DANGER_PIN]
    });
    expect(ransomware.startable).toBe(false);
    expect(ransomware.jobsQueued).toBe(0);
    expect(ransomware.queuedPins).toEqual([]);
    expect(
      ransomware.forbiddenPins.some((pin) => pin.techniqueId === "T1486")
    ).toBe(false);
    expect(ransomware.ransomware).toMatchObject({
      measured: false,
      measurementClass: "Danger",
      startable: false,
      techniqueId: "T1486"
    });
    expect(ransomware.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);

    const mixed = compileKillChainEngineStart({
      pins: [
        {
          moduleId: "gitleaks.repo_secrets",
          stepKey: "T1110",
          techniqueId: "T1110"
        },
        {
          ...T1486_HIGH_DANGER_PIN,
          dependsOn: ["T1110"]
        }
      ]
    });
    expect(mixed.startable).toBe(false);
    expect(mixed.jobsQueued).toBe(0);
    expect(mixed.queuedPins).toEqual([]);
    expect(mixed.ransomware.measured).toBe(false);
    expect(mixed.ransomware.measurementClass).toBe("Danger");
    expect(mixed.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);
  });

  it("still fail-closes T1486 when danger ack, qualification, or authorization is missing", () => {
    const incompleteGates = [
      {
        dangerAcknowledged: true,
        dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
        qualified: true,
        tenantAuthorized: false
      },
      {
        dangerAcknowledged: true,
        dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
        qualified: false,
        tenantAuthorized: true
      },
      {
        dangerAcknowledged: false,
        dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
        qualified: true,
        tenantAuthorized: true
      },
      {
        dangerAcknowledged: true,
        qualified: true,
        tenantAuthorized: true
      },
      {
        dangerAcknowledged: true,
        dangerAckDigest: "short-digest",
        qualified: true,
        tenantAuthorized: true
      }
    ] as const;

    for (const gate of incompleteGates) {
      const compiled = compileKillChainEngineStart({
        pins: [T1486_HIGH_DANGER_PIN],
        ...gate
      });
      expect(compiled.startable).toBe(false);
      expect(compiled.jobsQueued).toBe(0);
      expect(compiled.queuedPins).toEqual([]);
      expect(compiled.ransomware.measured).toBe(false);
      expect(compiled.ransomware.startable).toBe(false);
      expect(compiled.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);
    }
  });

  it("includes T1486 as a High-danger DAG pin after danger ack plus qualify and authorize", () => {
    const compiled = compileKillChainEngineStart({
      ...HIGH_DANGER_GATE,
      pins: [
        {
          moduleId: "gitleaks.repo_secrets",
          stepKey: "T1110",
          techniqueId: "T1110"
        },
        {
          ...T1486_HIGH_DANGER_PIN,
          dependsOn: ["T1110"]
        }
      ]
    });
    expect(compiled.startable).toBe(true);
    expect(compiled.jobsQueued).toBe(2);
    expect(compiled.denyReason).toBeNull();
    expect(compiled.queuedPins).toEqual([
      {
        measurementClass: "Exposure",
        moduleId: "gitleaks.repo_secrets",
        stepKey: "T1110",
        techniqueId: "T1110"
      },
      {
        measurementClass: "Danger",
        moduleId: "exploitation.impact_t1486",
        stepKey: "T1486",
        techniqueId: "T1486"
      }
    ]);
    expect(compiled.graph?.executionOrder).toEqual(["T1110", "T1486"]);
    expect(compiled.measured).toBe(false);
    expect(compiled.ransomware).toEqual({
      measured: false,
      measurementClass: "Danger",
      startable: true,
      techniqueId: "T1486"
    });
  });

  it("never marks ransomware measured and never queues live ransomware", () => {
    const highDanger = compileKillChainEngineStart({
      ...HIGH_DANGER_GATE,
      pins: [T1486_HIGH_DANGER_PIN]
    });
    expect(highDanger.startable).toBe(true);
    expect(highDanger.jobsQueued).toBe(1);
    expect(highDanger.measured).toBe(false);
    expect(highDanger.ransomware.measured).toBe(false);

    const liveRansomware = compileKillChainEngineStart({
      ...HIGH_DANGER_GATE,
      pins: [
        {
          moduleId: "ransomware.live",
          stepKey: "impact",
          techniqueId: RANSOMWARE_TECHNIQUE_ID
        }
      ]
    });
    expect(liveRansomware.startable).toBe(false);
    expect(liveRansomware.jobsQueued).toBe(0);
    expect(liveRansomware.queuedPins).toEqual([]);
    expect(liveRansomware.ransomware.measured).toBe(false);
    expect(liveRansomware.ransomware.startable).toBe(false);

    const previous = process.env.PERISCAN_LIVE_OFFENSIVE;
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    try {
      const flagged = compileKillChainEngineStart({
        pins: [T1486_HIGH_DANGER_PIN]
      });
      expect(flagged.startable).toBe(false);
      expect(flagged.jobsQueued).toBe(0);
      expect(flagged.ransomware.measured).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.PERISCAN_LIVE_OFFENSIVE;
      } else {
        process.env.PERISCAN_LIVE_OFFENSIVE = previous;
      }
    }
  });

  it("keeps Community first-hour catalog free of T1486", () => {
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).not.toContain(
      "exploitation.impact_t1486"
    );
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).not.toContain(
      KILLCHAIN_ENGINE_MODULE_ID
    );
    expect(
      listExecutableSafeStages().some((stage) => stage.techniqueId === "T1486")
    ).toBe(false);
    expect(isForbiddenKillChainCampaignToken("T1486")).toBe(false);
    expect(isForbiddenKillChainCampaignToken("ransomware.live")).toBe(true);
  });

  it("never starts the live kill-chain engine as APT execution", () => {
    const live = compileKillChainEngineStart({
      ...HIGH_DANGER_GATE,
      liveEngine: true,
      pins: [
        ...listExecutableSafeStages().map((stage) => ({
          moduleId: stage.defaultModuleId!,
          techniqueId: stage.techniqueId
        })),
        T1486_HIGH_DANGER_PIN
      ]
    });
    expect(live.startable).toBe(false);
    expect(live.jobsQueued).toBe(0);
    expect(live.queuedPins).toEqual([]);
    expect(live.ransomware.measured).toBe(false);
    expect(live.denyReason?.toLowerCase()).toMatch(/kill-chain|apt|planner/);
  });

  it("fails closed on unqualified or Forbidden hand-off pins", () => {
    const unreviewed = compileKillChainEngineStart({
      pins: [
        {
          moduleId: "atomic.control_validation_safe",
          stepKey: "atomic",
          techniqueId: "T1059"
        }
      ]
    });
    expect(unreviewed.startable).toBe(false);
    expect(unreviewed.jobsQueued).toBe(0);

    const forbiddenLateral = compileKillChainEngineStart({
      techniques: ["T1021"]
    });
    expect(forbiddenLateral.startable).toBe(false);
    expect(forbiddenLateral.jobsQueued).toBe(0);
    expect(
      forbiddenLateral.forbiddenPins.some((pin) => pin.techniqueId === "T1021")
    ).toBe(true);
    expect(forbiddenLateral.denyReason?.toLowerCase()).not.toMatch(
      /t1486 ransomware impact is never queued/
    );
  });

  it("denies remaining High-danger catalog pins without ack, never queues, and stays measured:false", () => {
    for (const pin of REMAINING_HIGH_DANGER_PINS) {
      const denied = compileKillChainEngineStart({ pins: [pin] });
      expect(denied.startable).toBe(false);
      expect(denied.jobsQueued).toBe(0);
      expect(denied.queuedPins).toEqual([]);
      expect(
        denied.forbiddenPins.some(
          (forbidden) => forbidden.techniqueId === pin.techniqueId
        )
      ).toBe(false);
      expect(denied.measured).toBe(false);
      expect(denied.ransomware.measured).toBe(false);
      expect(denied.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);

      const mixed = compileKillChainEngineStart({
        pins: [
          {
            moduleId: "gitleaks.repo_secrets",
            stepKey: "T1110",
            techniqueId: "T1110"
          },
          {
            ...pin,
            dependsOn: ["T1110"]
          }
        ]
      });
      expect(mixed.startable).toBe(false);
      expect(mixed.jobsQueued).toBe(0);
      expect(mixed.queuedPins).toEqual([]);
      expect(mixed.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);
    }
  });

  it("still fail-closes remaining High-danger catalog pins when ack, qualification, or authorization is missing", () => {
    for (const pin of REMAINING_HIGH_DANGER_PINS) {
      for (const gate of INCOMPLETE_HIGH_DANGER_GATES) {
        const compiled = compileKillChainEngineStart({
          pins: [pin],
          ...gate
        });
        expect(compiled.startable).toBe(false);
        expect(compiled.jobsQueued).toBe(0);
        expect(compiled.queuedPins).toEqual([]);
        expect(compiled.measured).toBe(false);
        expect(compiled.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);
      }
    }
  });

  it("includes remaining High-danger catalog pins as Danger DAG pins after ack plus qualify and authorize", () => {
    for (const pin of REMAINING_HIGH_DANGER_PINS) {
      const compiled = compileKillChainEngineStart({
        ...HIGH_DANGER_GATE,
        pins: [
          {
            moduleId: "gitleaks.repo_secrets",
            stepKey: "T1110",
            techniqueId: "T1110"
          },
          {
            ...pin,
            dependsOn: ["T1110"]
          }
        ]
      });
      expect(compiled.startable).toBe(true);
      expect(compiled.jobsQueued).toBe(2);
      expect(compiled.denyReason).toBeNull();
      expect(compiled.queuedPins).toEqual([
        {
          measurementClass: "Exposure",
          moduleId: "gitleaks.repo_secrets",
          stepKey: "T1110",
          techniqueId: "T1110"
        },
        {
          measurementClass: "Danger",
          moduleId: pin.moduleId,
          stepKey: pin.stepKey,
          techniqueId: pin.techniqueId
        }
      ]);
      expect(compiled.graph?.executionOrder).toEqual(["T1110", pin.stepKey]);
      expect(compiled.measured).toBe(false);
      expect(compiled.ransomware.measured).toBe(false);
      expect(compiled.ransomware.startable).toBe(false);
    }
  });

  it("maps remaining High-danger techniques and Metasploit PAYLOAD class to catalog modules, not Forbidden hide", () => {
    const techniqueOnlyPins = [
      { techniqueId: "T1003", moduleId: "identity.credential_harvest" },
      { techniqueId: "T1547", moduleId: "exploitation.persistence" },
      { techniqueId: "T1203", moduleId: "exploit.metasploit_payload" }
    ] as const;

    for (const pin of techniqueOnlyPins) {
      const denied = compileKillChainEngineStart({
        techniques: [pin.techniqueId]
      });
      expect(denied.startable).toBe(false);
      expect(denied.jobsQueued).toBe(0);
      expect(denied.queuedPins).toEqual([]);
      expect(
        denied.forbiddenPins.some(
          (forbidden) => forbidden.techniqueId === pin.techniqueId
        )
      ).toBe(false);
      expect(denied.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);

      const acked = compileKillChainEngineStart({
        ...HIGH_DANGER_GATE,
        techniques: [pin.techniqueId]
      });
      expect(acked.startable).toBe(true);
      expect(acked.jobsQueued).toBe(1);
      expect(acked.queuedPins).toEqual([
        {
          measurementClass: "Danger",
          moduleId: pin.moduleId,
          stepKey: pin.techniqueId,
          techniqueId: pin.techniqueId
        }
      ]);
      expect(acked.measured).toBe(false);
    }

    const payloadDenied = compileKillChainEngineStart({
      pins: [METASPLOIT_PAYLOAD_CLASS_PIN]
    });
    expect(payloadDenied.startable).toBe(false);
    expect(payloadDenied.jobsQueued).toBe(0);
    expect(payloadDenied.queuedPins).toEqual([]);
    expect(payloadDenied.forbiddenPins).toEqual([]);
    expect(payloadDenied.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);

    const payloadAcked = compileKillChainEngineStart({
      ...HIGH_DANGER_GATE,
      pins: [METASPLOIT_PAYLOAD_CLASS_PIN]
    });
    expect(payloadAcked.startable).toBe(true);
    expect(payloadAcked.jobsQueued).toBe(1);
    expect(payloadAcked.queuedPins).toEqual([
      {
        measurementClass: "Danger",
        moduleId: "exploit.metasploit_payload",
        stepKey: "PAYLOAD",
        techniqueId: "T1203"
      }
    ]);
    expect(payloadAcked.measured).toBe(false);
  });

  it("never puts remaining High-danger catalog pins on Community first-hour, Home, or unmarked Validate", () => {
    const remainingModuleIds = new Set<string>(
      REMAINING_HIGH_DANGER_PINS.map((pin) => pin.moduleId)
    );
    for (const moduleId of remainingModuleIds) {
      expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).not.toContain(moduleId);
    }
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).not.toContain("PAYLOAD");
    expect(
      listExecutableSafeStages().some((stage) =>
        remainingModuleIds.has(stage.defaultModuleId ?? "")
      )
    ).toBe(false);
    expect(
      listDangerCatalog()
        .filter((entry) => remainingModuleIds.has(entry.moduleId))
        .every((entry) => entry.section === "High danger")
    ).toBe(true);
    expect(isForbiddenKillChainCampaignToken("identity.cred_spray")).toBe(
      false
    );
    expect(isForbiddenKillChainCampaignToken("PAYLOAD")).toBe(false);
  });

  it("does not unlock remaining High-danger catalog pins via LIVE_OFFENSIVE and keeps T1110 Gitleaks Exposure", () => {
    const previous = process.env.PERISCAN_LIVE_OFFENSIVE;
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    try {
      for (const pin of REMAINING_HIGH_DANGER_PINS) {
        const flagged = compileKillChainEngineStart({ pins: [pin] });
        expect(flagged.startable).toBe(false);
        expect(flagged.jobsQueued).toBe(0);
        expect(flagged.queuedPins).toEqual([]);
        expect(flagged.measured).toBe(false);
        expect(flagged.denyReason).toBe(BAS_DANGER_ACK_DENY_REASON);
      }
      const payload = compileKillChainEngineStart({
        pins: [METASPLOIT_PAYLOAD_CLASS_PIN]
      });
      expect(payload.startable).toBe(false);
      expect(payload.jobsQueued).toBe(0);
    } finally {
      if (previous === undefined) {
        delete process.env.PERISCAN_LIVE_OFFENSIVE;
      } else {
        process.env.PERISCAN_LIVE_OFFENSIVE = previous;
      }
    }

    const gitleaks = compileKillChainEngineStart({
      pins: [
        {
          moduleId: "gitleaks.repo_secrets",
          stepKey: "T1110",
          techniqueId: "T1110"
        }
      ]
    });
    expect(gitleaks.startable).toBe(true);
    expect(gitleaks.jobsQueued).toBe(1);
    expect(gitleaks.queuedPins[0]).toMatchObject({
      measurementClass: "Exposure",
      moduleId: "gitleaks.repo_secrets",
      techniqueId: "T1110"
    });

    const unimplementedPersistence = compileKillChainEngineStart({
      techniques: ["T1543"]
    });
    expect(unimplementedPersistence.startable).toBe(false);
    expect(unimplementedPersistence.jobsQueued).toBe(0);
    expect(
      unimplementedPersistence.forbiddenPins.some(
        (pin) => pin.techniqueId === "T1543"
      )
    ).toBe(true);
  });
});
