import { describe, expect, it } from "vitest";

import {
  COPYLEFT_OPT_IN_MODULE_IDS,
  isCopyleftOptInModuleId,
  isEngineLabTheaterModuleId
} from "@periscan/shared";

import { countSemgrep, buildCopyleftOptInModules } from "./copyleft-opt-in.js";
import { evaluateModuleStartConstraints, getModuleById } from "./index.js";

describe("copyleft opt-in engines", () => {
  it("registers live Semgrep after license, not the catalog sim", () => {
    const module = getModuleById("semgrep.repo_sast");
    expect(module).not.toBeNull();
    expect(module?.manifest.liveSupported).toBe(true);
    expect(isCopyleftOptInModuleId("semgrep.repo_sast")).toBe(true);
    expect(isEngineLabTheaterModuleId("semgrep.repo_sast")).toBe(false);
    expect(COPYLEFT_OPT_IN_MODULE_IDS).not.toContain("web.sqli_probe");
  });

  it("still denies live testssl until the tenant license stamp is present", () => {
    const module = getModuleById("web.tls_audit");
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [module!.manifest],
        runnerId: null,
        target: { url: "https://app.example" }
      }).allowed
    ).toBe(false);
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "ControlPlane",
        moduleManifests: [module!.manifest],
        runnerId: null,
        target: {
          url: "https://app.example",
          upstreamLicenseAcceptedToolIds: ["testssl"]
        }
      }).allowed
    ).toBe(true);
  });

  it("counts Semgrep results without inventing findings", () => {
    expect(countSemgrep({ results: [{}, {}] })).toBe(2);
    expect(countSemgrep({})).toBe(0);
    expect(
      buildCopyleftOptInModules(((manifest: unknown) => ({
        manifest,
        execute: async () => {
          throw new Error("unused");
        }
      })) as never).length
    ).toBeGreaterThanOrEqual(7);
    for (const moduleId of [
      "sslscan.tls_probe",
      "lynis.host_audit",
      "rustscan.port_inventory",
      "cve_bin_tool.binary_cves"
    ]) {
      expect(getModuleById(moduleId)?.manifest.liveSupported).toBe(true);
    }
  });
});
