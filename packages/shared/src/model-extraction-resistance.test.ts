import { describe, expect, it } from "vitest";

import {
  MODEL_EXTRACTION_CEILINGS,
  MODEL_EXTRACTION_PROBE_ORDER,
  buildModelExtractionHonesty,
  listModelExtractionProbes,
  resolveModelExtractionProbe
} from "./model-extraction-resistance";

describe("model extraction resistance honesty (scorecard #64)", () => {
  it("never claims weight recovery and keeps single-digit ceilings", () => {
    const honesty = buildModelExtractionHonesty();
    expect(honesty.weightExtractionAttempted).toBe(false);
    expect(honesty.modelWeightRecovery).toBe(false);
    expect(honesty.highVolumeCampaign).toBe(false);
    expect(honesty.maxRequests).toBeLessThanOrEqual(5);
    expect(honesty.maxRequests).toBe(MODEL_EXTRACTION_CEILINGS.maxRequests);
    expect(honesty.foreverRefuse.join(" ")).toMatch(/weight|gradient/i);
    expect(honesty.probes).toHaveLength(MODEL_EXTRACTION_PROBE_ORDER.length);
  });

  it("resolves sequential probe classes without inventing extraction", () => {
    const probes = listModelExtractionProbes();
    expect(probes.map((p) => p.probeClass)).toEqual([
      ...MODEL_EXTRACTION_PROBE_ORDER
    ]);
    expect(resolveModelExtractionProbe(0).probeClass).toBe("fingerprint_hold");
    expect(resolveModelExtractionProbe(4).probeClass).toBe("weight_refuse");
    expect(resolveModelExtractionProbe(99).probeClass).toBe("weight_refuse");
  });
});
