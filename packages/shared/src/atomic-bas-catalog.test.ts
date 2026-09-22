import { describe, expect, it } from "vitest";

import {
  AtomicLabAdapterBindingSchema,
  AtomicLabReceiptSchema,
  BasAtomicScenarioRunResultSchema,
  classifyAtomicActivity,
  denyLiveAtomicCustomerStart
} from "./atomic-bas-catalog";

describe("Atomic activity accounting", () => {
  it("does not count catalog imports, previews, or dry-run modules as executions", () => {
    for (const kind of [
      "catalog_import",
      "content_preview",
      "content_registry",
      "dry_run_module"
    ] as const) {
      expect(classifyAtomicActivity(kind)).toEqual({
        countedAsExecution: false,
        countedAsLocalLabQualification: false,
        jobsQueued: 0,
        liveSupported: false
      });
    }
  });

  it("denies customer live start with jobsQueued=0 and liveSupported false", () => {
    expect(classifyAtomicActivity("customer_live_start")).toEqual({
      countedAsExecution: false,
      countedAsLocalLabQualification: false,
      jobsQueued: 0,
      liveSupported: false
    });
    expect(
      BasAtomicScenarioRunResultSchema.parse(
        denyLiveAtomicCustomerStart({
          scenarioId: "atomic.live",
          techniqueId: "T1082"
        })
      )
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled",
      executionMode: "live",
      jobsQueued: 0,
      liveExecutionDisabled: true
    });
  });

  it("treats local lab qualification as lab-only, not customer execution", () => {
    expect(classifyAtomicActivity("local_lab_qualification")).toEqual({
      countedAsExecution: false,
      countedAsLocalLabQualification: true,
      jobsQueued: 0,
      liveSupported: false
    });
  });
});

describe("Atomic lab adapter binding contract", () => {
  const hostnameBinding = {
    argv: ["/bin/hostname"],
    cleanup: {
      requiredAfterCreate: true,
      strategy: "remove_labelled_container",
      yamlCleanupCommand: false
    },
    customerLiveSupported: false,
    expectedTelemetry: {
      detection: "NotMeasured",
      observerRequired: false,
      processName: "hostname",
      techniqueId: "T1082"
    },
    guid: "486e88ea-4f56-470f-9b57-3f4d73f39133",
    image:
      "busybox@sha256:9db7b59979c38555a39def84a31fb98b5296952f9e3afd4f6f11f05b07adfab0",
    labOnly: true,
    name: "Hostname Discovery",
    os: "linux",
    prerequisites: {
      dockerUnixSocket: true,
      elevationRequired: false,
      pinnedImageMustBePresent: true,
      yamlDependencies: false,
      yamlInputArguments: false
    },
    queueable: false,
    scenarioId: "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133",
    sourcePin: {
      contentSha256:
        "6cfdcdd8d114195f788bf719baecda1a95363d904316a156c8f44e45e71e9f29",
      sourcePath: "atomics/T1082/T1082.yaml",
      sourceRevision: "11ff111ace63e02825dd44ce8246800203a10ce8"
    },
    techniqueId: "T1082",
    typedInputs: {}
  };

  it("pins guid, OS, argv, prerequisites, cleanup, and expected telemetry", () => {
    expect(AtomicLabAdapterBindingSchema.parse(hostnameBinding)).toMatchObject({
      argv: ["/bin/hostname"],
      customerLiveSupported: false,
      guid: "486e88ea-4f56-470f-9b57-3f4d73f39133",
      labOnly: true,
      os: "linux",
      queueable: false
    });
    expect(
      AtomicLabAdapterBindingSchema.parse({
        ...hostnameBinding,
        customerLiveSupported: true,
        labOnly: false,
        queueable: true
      })
    ).toMatchObject({
      customerLiveSupported: true,
      labOnly: false,
      queueable: true
    });
  });

  it("rejects YAML-eval style command strings in argv", () => {
    expect(
      AtomicLabAdapterBindingSchema.safeParse({
        ...hostnameBinding,
        argv: ["hostname\n"]
      }).success
    ).toBe(false);
    expect(
      AtomicLabAdapterBindingSchema.safeParse({
        ...hostnameBinding,
        argv: ["sh", "-c", "hostname"]
      }).success
    ).toBe(false);
  });

  it("allowlists date as a third Linux-safe argv and still rejects shell eval", () => {
    expect(
      AtomicLabAdapterBindingSchema.parse({
        ...hostnameBinding,
        argv: ["/bin/date"],
        expectedTelemetry: {
          ...hostnameBinding.expectedTelemetry,
          processName: "date",
          techniqueId: "T1124"
        },
        guid: "f449c933-0891-407f-821e-7916a21a1a6f",
        name: "System Time Discovery in FreeBSD/macOS",
        scenarioId: "atomic:f449c933-0891-407f-821e-7916a21a1a6f",
        sourcePin: {
          ...hostnameBinding.sourcePin,
          sourcePath: "atomics/T1124/T1124.yaml"
        },
        techniqueId: "T1124"
      }).argv
    ).toEqual(["/bin/date"]);
    expect(
      AtomicLabAdapterBindingSchema.safeParse({
        ...hostnameBinding,
        argv: ["sh", "-c", "date"]
      }).success
    ).toBe(false);
    expect(
      AtomicLabAdapterBindingSchema.safeParse({
        ...hostnameBinding,
        argv: ["/bin/bash"]
      }).success
    ).toBe(false);
  });

  it("keeps receipts to output hashes, not raw stdout", () => {
    const receipt = AtomicLabReceiptSchema.parse({
      cleanup: "Verified",
      completedAt: "2026-09-17T18:31:14.577Z",
      containerName: "periscan-bas-9010a5e4-2bd8-48a7-9a54-11572a7ed466",
      countedAsCustomerExecution: false,
      customerLiveSupported: false,
      detection: "NotMeasured",
      execution: {
        exitCode: 0,
        expectedOutputMatched: true,
        status: "Completed",
        stdoutBytes: 17,
        stdoutSha256:
          "df9950cc5d67bae7ffa419b755ea984ee2c52d01ece1c3184568198aef6a8822"
      },
      guid: "486e88ea-4f56-470f-9b57-3f4d73f39133",
      image: hostnameBinding.image,
      kind: "AtomicLocalLabQualification",
      planSha256:
        "dfb5a23f88acc2c3fff36ae5023b923f968afd4abf2ccc3d6b09d771c4436da6",
      policyDecision: {
        outcome: "Allowed",
        reason: "Exact reviewed source and plan.",
        scope: "DisposableLocalContainer"
      },
      qualification: "Passed",
      runId: "9010a5e4-2bd8-48a7-9a54-11572a7ed466",
      scenarioId: hostnameBinding.scenarioId,
      sourceRevision: hostnameBinding.sourcePin.sourceRevision,
      sourceSha256: hostnameBinding.sourcePin.contentSha256,
      sourceVerified: true,
      startedAt: "2026-09-17T18:31:13.155Z"
    });
    expect(receipt.execution).not.toHaveProperty("stdout");
    expect(receipt.execution).not.toHaveProperty("stderr");
    expect(
      AtomicLabReceiptSchema.safeParse({
        ...receipt,
        execution: {
          ...receipt.execution,
          stdout: "periscan-bas-lab\n"
        }
      }).success
    ).toBe(false);
  });
});
