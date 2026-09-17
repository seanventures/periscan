import { describe, expect, it } from "vitest";

import {
  CONTINUOUS_EASM_CHANGE_DETECTION_NOTE,
  CONTINUOUS_EASM_HONESTY_NOTE,
  CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST,
  enrichContinuousEasmDiffSummary,
  isContinuousEasmSafeModuleId,
  resolveContinuousEasmModuleIds
} from "./continuous-easm.js";

describe("continuous EASM allowlist (Wave C)", () => {
  it("includes nuclei external safe and rejects exploit modules", () => {
    expect(CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST).toContain(
      "nuclei.external_exposure_safe"
    );
    expect(isContinuousEasmSafeModuleId("nuclei.external_exposure_safe")).toBe(
      true
    );
    expect(isContinuousEasmSafeModuleId("atomic.control_validation_safe")).toBe(
      false
    );
    expect(isContinuousEasmSafeModuleId("exploitation.killchain.engine")).toBe(
      false
    );
  });

  it("defaults Domain/Subdomain to External PoA + passive posture modules", () => {
    expect(resolveContinuousEasmModuleIds({ scopeType: "Domain" })).toEqual([
      "nuclei.external_exposure_safe",
      "periscan.dns_resolution_check",
      "periscan.tls_certificate_check"
    ]);
    expect(resolveContinuousEasmModuleIds({ scopeType: "Subdomain" })[0]).toBe(
      "nuclei.external_exposure_safe"
    );
  });

  it("intersects config.moduleIds with the hard allowlist", () => {
    expect(
      resolveContinuousEasmModuleIds({
        configModuleIds: [
          "nuclei.external_exposure_safe",
          "atomic.control_validation_safe",
          "recon.dns_probe"
        ],
        scopeType: "Domain"
      })
    ).toEqual(["nuclei.external_exposure_safe", "recon.dns_probe"]);
  });

  it("falls back to defaults when config only has denied modules", () => {
    expect(
      resolveContinuousEasmModuleIds({
        configModuleIds: ["atomic.control_validation_safe"],
        scopeType: "Domain"
      })
    ).toContain("nuclei.external_exposure_safe");
  });

  it("enriches summaries with honest non-living-map change detection", () => {
    const summary = enrichContinuousEasmDiffSummary({
      baseSummary: "Scheduled validation result is unchanged.",
      moduleIds: ["nuclei.external_exposure_safe"],
      missionQueued: true
    });
    expect(summary).toContain("nuclei.external_exposure_safe");
    expect(summary).toContain(CONTINUOUS_EASM_CHANGE_DETECTION_NOTE);
    expect(summary).not.toMatch(/living map|autonomous terrain/i);
    expect(CONTINUOUS_EASM_HONESTY_NOTE).toMatch(/verified/i);
  });
});
