import { describe, expect, it, vi } from "vitest";

import {
  ATOMIC_DATE_LAB,
  ATOMIC_ENV_LAB,
  ATOMIC_HOSTNAME_LAB
} from "@periscan/modules";
import {
  RunnerTaskEnvelopeSchema,
  type RunnerTaskEnvelope
} from "@periscan/shared";

import {
  hasAtomicQualificationTables,
  queueAtomicQualifiedStart,
  selectAtomicQualifiedCampaignStart
} from "./bas-atomic-start.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const MISSION_ID = "22222222-2222-4222-8222-222222222222";
const RUNNER_ID = "33333333-3333-4333-8333-333333333333";
const SCOPE_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "55555555-5555-4555-8555-555555555555";

const HOSTNAME_PIN = {
  provider: "AtomicRedTeam",
  upstreamId: ATOMIC_HOSTNAME_LAB.scenarioId
};

function signEnvelope(
  unsigned: Omit<RunnerTaskEnvelope, "signature">
): RunnerTaskEnvelope {
  return RunnerTaskEnvelopeSchema.parse({
    ...unsigned,
    signature: {
      algorithm: "EdDSA",
      digestSha256: "ab".repeat(32),
      keyId: "test-atomic-qualified-queue",
      nonce: unsigned.taskId,
      signature: "dGVzdC1hdG9taWMtcXVhbGlmaWVkLXF1ZXVl"
    }
  });
}

function queueInput(
  overrides: Partial<Parameters<typeof queueAtomicQualifiedStart>[0]> = {}
) {
  return {
    context: {
      controlPlaneUrl: "https://runner.periscan.cloud",
      missionId: MISSION_ID,
      now: new Date("2026-09-17T12:00:00.000Z"),
      runId: RUN_ID,
      runnerId: RUNNER_ID,
      scopeConstraints: {
        approvedCidrs: [],
        approvedDnsSuffixes: [],
        approvedHostnames: ["periscan-bas-lab"],
        approvedPorts: [],
        forbidInternetEgress: true
      },
      scopeId: SCOPE_ID,
      tenantId: TENANT_ID
    },
    pins: [HOSTNAME_PIN],
    qualificationTablesPresent: true,
    signEnvelope,
    startable: true,
    ...overrides
  };
}

describe("hasAtomicQualificationTables", () => {
  it("feature-detects missing Prisma qualification delegates as deny", () => {
    expect(hasAtomicQualificationTables(undefined)).toBe(false);
    expect(hasAtomicQualificationTables({})).toBe(false);
    expect(
      hasAtomicQualificationTables({ runnerTask: { create: () => undefined } })
    ).toBe(false);
  });

  it("returns true when a qualification table delegate exists", () => {
    expect(
      hasAtomicQualificationTables({
        basPackQualification: { findMany: async () => [] }
      })
    ).toBe(true);
    expect(
      hasAtomicQualificationTables({
        tenantBasPackAuthorization: { findFirst: async () => null }
      })
    ).toBe(true);
  });
});

describe("selectAtomicQualifiedCampaignStart", () => {
  it("falls through when startable is false so the existing deny path owns the reason", () => {
    expect(
      selectAtomicQualifiedCampaignStart({
        pins: [HOSTNAME_PIN],
        qualificationTablesPresent: true,
        startable: false
      })
    ).toBe("fallthrough");
  });

  it("falls through when there are no Atomic argv pins", () => {
    expect(
      selectAtomicQualifiedCampaignStart({
        pins: [
          {
            provider: "ControlPlane",
            upstreamId: "control.detection.benign-marker"
          }
        ],
        qualificationTablesPresent: true,
        startable: true
      })
    ).toBe("fallthrough");
  });

  it("selects queue when startable, qualification present, and argv is allowlisted", () => {
    expect(
      selectAtomicQualifiedCampaignStart({
        pins: [HOSTNAME_PIN],
        qualificationTablesPresent: true,
        startable: true
      })
    ).toBe("queue");
  });

  it("denies startable Atomic pins that are not allowlisted argv", () => {
    expect(
      selectAtomicQualifiedCampaignStart({
        pins: [
          {
            provider: "AtomicRedTeam",
            upstreamId: "cccb070c-df86-4216-a5bc-9fb60c74e27c"
          }
        ],
        qualificationTablesPresent: true,
        startable: true
      })
    ).toBe("deny");
  });

  it("denies startable Atomic when qualification tables are missing", () => {
    expect(
      selectAtomicQualifiedCampaignStart({
        pins: [HOSTNAME_PIN],
        qualificationTablesPresent: false,
        startable: true
      })
    ).toBe("deny");
  });
});

describe("queueAtomicQualifiedStart", () => {
  it("does not queue when startable is false", async () => {
    const persistTask = vi.fn();
    const executeInProcessLab = vi.fn();
    const result = await queueAtomicQualifiedStart(
      queueInput({
        executeInProcessLab,
        persistTask,
        startable: false
      })
    );
    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.envelopes).toEqual([]);
    expect(persistTask).not.toHaveBeenCalled();
    expect(executeInProcessLab).not.toHaveBeenCalled();
    expect(result.yamlEval).toBe(false);
  });

  it("does not queue when qualification tables are missing", async () => {
    const persistTask = vi.fn();
    const result = await queueAtomicQualifiedStart(
      queueInput({ persistTask, qualificationTablesPresent: false })
    );
    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(persistTask).not.toHaveBeenCalled();
  });

  it("queues a signed outbound HTTPS runner task for allowlisted argv when startable", async () => {
    const persistTask = vi.fn();
    const result = await queueAtomicQualifiedStart(queueInput({ persistTask }));
    expect(result.jobsQueued).toBeGreaterThanOrEqual(1);
    expect(result.queued).toBe(true);
    expect(result.denyReason).toBeNull();
    expect(result.envelopes).toHaveLength(1);
    const envelope = RunnerTaskEnvelopeSchema.parse(result.envelopes[0]);
    expect(envelope.executionEnvironment).toBe("InternalRunner");
    expect(envelope.signature.algorithm).toBe("EdDSA");
    expect(envelope.signature.signature.length).toBeGreaterThan(0);
    expect(envelope.artifactUpload.resultCallbackUrl).toMatch(/^https:\/\//);
    expect(envelope.artifactUpload.artifactUploadUrl).toMatch(/^https:\/\//);
    expect(envelope.inputs).toMatchObject({
      argv: ["/bin/hostname"],
      yamlEval: false
    });
    expect(envelope.target).toMatchObject({
      argv: ["/bin/hostname"],
      guid: "486e88ea-4f56-470f-9b57-3f4d73f39133"
    });
    expect(JSON.stringify(envelope)).not.toMatch(/hostname\\n/);
    expect(JSON.stringify(envelope)).not.toContain("sh -c");
    expect(persistTask).toHaveBeenCalledTimes(1);
  });

  it("queues hostname, env, and date argv and never copies YAML into a shell", async () => {
    const result = await queueAtomicQualifiedStart(
      queueInput({
        pins: [
          HOSTNAME_PIN,
          {
            provider: "AtomicRedTeam",
            upstreamId: ATOMIC_ENV_LAB.scenarioId
          },
          {
            provider: "AtomicRedTeam",
            upstreamId: ATOMIC_DATE_LAB.scenarioId
          }
        ]
      })
    );
    expect(result.jobsQueued).toBe(3);
    const argv = result.envelopes.map(
      (envelope) => (envelope.inputs as { argv: string[] }).argv[0]
    );
    expect(argv.sort()).toEqual(["/bin/date", "/bin/env", "/bin/hostname"]);
    const serialized = JSON.stringify(result.envelopes);
    expect(serialized).not.toMatch(/hostname\\n|env\\n|date\\n/);
    expect(serialized).not.toContain("sh -c");
    expect(serialized).not.toContain("Invoke-AtomicTest");
  });

  it("runs the in-process lab adapter only when the same startable policy allows queue", async () => {
    const executeInProcessLab = vi.fn();
    await queueAtomicQualifiedStart(
      queueInput({ executeInProcessLab, startable: false })
    );
    expect(executeInProcessLab).not.toHaveBeenCalled();

    await queueAtomicQualifiedStart(queueInput({ executeInProcessLab }));
    expect(executeInProcessLab).toHaveBeenCalledTimes(1);
    expect(executeInProcessLab).toHaveBeenCalledWith(
      expect.objectContaining({
        argv: ["/bin/hostname"],
        guid: "486e88ea-4f56-470f-9b57-3f4d73f39133"
      })
    );
  });

  it("does not queue unknown YAML pins even when startable", async () => {
    const persistTask = vi.fn();
    const result = await queueAtomicQualifiedStart(
      queueInput({
        persistTask,
        pins: [
          {
            provider: "AtomicRedTeam",
            upstreamId: "034fe21c-3186-49dd-8d5d-128b35f181c7"
          }
        ]
      })
    );
    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(persistTask).not.toHaveBeenCalled();
    expect(result.denyReason).toMatch(/never eval|argv/i);
  });

  it("does not set PERISCAN_LIVE_OFFENSIVE", () => {
    expect(process.env.PERISCAN_LIVE_OFFENSIVE).not.toBe("1");
  });
});
