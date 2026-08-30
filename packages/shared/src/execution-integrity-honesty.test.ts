import { describe, expect, it } from "vitest";

import {
  buildExecutionIntegrityHonesty,
  ExecutionIntegrityHonestySchema
} from "./execution-integrity-honesty";

describe("execution integrity honesty (scorecard #47)", () => {
  it("pins verifier role and refuses host TEE", () => {
    const honesty = buildExecutionIntegrityHonesty();
    expect(() => ExecutionIntegrityHonestySchema.parse(honesty)).not.toThrow();
    expect(honesty.scorecardId).toBe(47);
    expect(honesty.productRole).toBe("verifier");
    expect(honesty.hostTeeWorkloads).toBe(false);
    expect(honesty.foreverRefuse.join(" ")).toMatch(/TEE|enclave/i);

    const host = honesty.surfaces.find((s) => s.key === "host-tee");
    expect(host?.state).toBe("Refused");
    expect(host?.claimClass).toBe("refused_host_tee");

    const available = honesty.surfaces.filter((s) => s.state === "Available");
    expect(available.map((s) => s.key)).toEqual(
      expect.arrayContaining([
        "evidence-chain",
        "flight-recorder",
        "agent-signed-receipts"
      ])
    );
  });
});
