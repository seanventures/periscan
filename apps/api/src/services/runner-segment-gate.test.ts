import { describe, expect, it } from "vitest";

import {
  assertRunnerAffinityAllowsTask,
  assertRunnerSegmentProfileAllowsTask
} from "./runner.js";
import { AppServiceError } from "../runtime-services.js";

describe("P10-1 segment profile create/lease gate", () => {
  it("allows unbound hybrid runners", () => {
    expect(
      assertRunnerSegmentProfileAllowsTask(
        { segmentProfileId: null },
        "runner.reachability_check",
        "ActiveNonInvasive"
      )
    ).toEqual({ forbidInternetEgress: false });
  });

  it("denies ActiveNonInvasive reachability on campus-passive", () => {
    expect(() =>
      assertRunnerSegmentProfileAllowsTask(
        { segmentProfileId: "campus-passive" },
        "runner.reachability_check",
        "ActiveNonInvasive"
      )
    ).toThrow(AppServiceError);
    try {
      assertRunnerSegmentProfileAllowsTask(
        { segmentProfileId: "campus-passive" },
        "runner.reachability_check",
        "ActiveNonInvasive"
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AppServiceError);
      expect((error as AppServiceError).code).toBe(
        "runner_segment_safety_denied"
      );
    }
  });

  it("denies OT active probes; allows TLS observe passive", () => {
    expect(() =>
      assertRunnerSegmentProfileAllowsTask(
        { segmentProfileId: "ot-safe-baseline" },
        "runner.reachability_check",
        "PassiveReadOnly"
      )
    ).toThrow(/does not allow module family/);

    const gate = assertRunnerSegmentProfileAllowsTask(
      { segmentProfileId: "ot-safe-baseline" },
      "runner.tls_certificate_check",
      "PassiveReadOnly"
    );
    expect(gate.forbidInternetEgress).toBe(true);
  });
});

describe("P10-2 affinity create gate", () => {
  const plantRunner = {
    networkSegment: "ot-cell-b",
    runnerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    segmentProfileId: "ot-safe-baseline" as const,
    siteId: "plant-3",
    status: "Active"
  };

  it("rejects wrong-site runner when task requires site", () => {
    expect(() =>
      assertRunnerAffinityAllowsTask(
        { ...plantRunner, siteId: "hq-1", networkSegment: "campus" },
        { siteId: "plant-3", networkSegment: "ot-cell-b" }
      )
    ).toThrow(/affinity/);
  });

  it("allows matching site/segment", () => {
    expect(() =>
      assertRunnerAffinityAllowsTask(plantRunner, {
        siteId: "plant-3",
        networkSegment: "ot-cell-b"
      })
    ).not.toThrow();
  });

  it("skips when no hard topology hint", () => {
    expect(() =>
      assertRunnerAffinityAllowsTask(plantRunner, {
        preferredRunnerId: plantRunner.runnerId
      })
    ).not.toThrow();
  });
});
