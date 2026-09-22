import { describe, expect, it } from "vitest";

import { OPERATE_SCREEN_JOBS, operateScreenJob } from "./operate-screen-jobs";

const PLATFORM_LEAK =
  /CTEM|Automated Security Validation platform|Connect a source|Mark Fixed|4\.0|5\.0/iu;

describe("OPERATE_SCREEN_JOBS", () => {
  it("gives every Operate spine screen exactly one job", () => {
    expect(OPERATE_SCREEN_JOBS.map((row) => row.href)).toEqual([
      "/dashboard",
      "/scopes",
      "/missions",
      "/findings",
      "/remediation",
      "/evidence",
      "/schedules"
    ]);
    for (const row of OPERATE_SCREEN_JOBS) {
      expect(row.job.trim().length).toBeGreaterThan(8);
      expect(row.job).not.toMatch(PLATFORM_LEAK);
    }
  });

  it("keeps Home and Validate on the Gitleaks door as a board you live in", () => {
    expect(operateScreenJob("/dashboard")).toMatch(/Gitleaks/i);
    expect(operateScreenJob("/dashboard")).toMatch(/keep proving/i);
    expect(operateScreenJob("/missions")).toMatch(/Gitleaks/i);
    expect(operateScreenJob("/findings")).toMatch(/path/i);
    expect(operateScreenJob("/remediation")).toMatch(/Re-verify|verif/i);
    expect(operateScreenJob("/remediation")).not.toMatch(/Mark Fixed/i);
    expect(operateScreenJob("/schedules")).toMatch(/cadence|schedule/i);
  });

  it("does not treat CTEM or Connect as an Operate job", () => {
    expect(operateScreenJob("/ctem")).toBeUndefined();
    expect(operateScreenJob("/integrations")).toBeUndefined();
    const blob = OPERATE_SCREEN_JOBS.map((row) => row.job).join("\n");
    expect(blob).not.toMatch(/CTEM/u);
    expect(blob).not.toMatch(/Connect a source/iu);
    expect(blob).not.toMatch(/High-danger/iu);
    expect(blob).not.toMatch(/Prowler/iu);
    expect(blob).not.toMatch(/first[- ]hour/i);
  });
});
