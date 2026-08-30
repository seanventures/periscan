import {
  COMMUNITY_VALIDATION_SUITE,
  communityValidationStartLane,
  listCommunityRunnerLaneEntries
} from "@periscan/shared";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_ALLOWLISTED_MODULE_IDS,
  loadRunnerAgentConfig
} from "./config.js";

const BASE_ENV = {
  PERISCAN_CONTROL_PLANE_URL: "https://control.periscan.test/",
  PERISCAN_RUNNER_AUTH_TOKEN: "runner-token",
  PERISCAN_RUNNER_ID: "runner-123",
  PERISCAN_TASK_SIGNING_PUBLIC_KEY_PEM:
    "-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----",
  PERISCAN_TENANT_ID: "tenant-123"
};

describe("loadRunnerAgentConfig", () => {
  it("defaults to safe passive and non-invasive modules only", () => {
    const config = loadRunnerAgentConfig(BASE_ENV);

    expect(config.controlPlaneUrl).toBe("https://control.periscan.test");
    expect(config.certificateExpiresAt).toBeNull();
    expect(config.version).toBe("0.1.0");
    expect([...config.allowedSafetyLevels].sort()).toEqual([
      "ActiveNonInvasive",
      "PassiveReadOnly"
    ]);
    for (const moduleId of [
      "runner.reachability_check",
      "gitleaks.repo_secrets",
      "trivy.repo_dependency_scan",
      "web.zap_baseline",
      "tlsx.tls_probe",
      "naabu.port_inventory",
      "amass.passive_enum",
      "cdxgen.sbom_generate",
      "checkov.iac_posture",
      "gosec.go_sast",
      "yara.repo_rules"
    ]) {
      expect(config.allowlistedModuleIds.has(moduleId)).toBe(true);
    }
    expect(config.allowlistedModuleIds.has("ot_ics.safe_baseline")).toBe(false);
    expect(config.allowlistedModuleIds.has("identity.cred_spray")).toBe(false);
    expect(config.allowlistedModuleIds.has("identity.kerberos_userenum")).toBe(
      false
    );
    expect(config.allowlistedModuleIds.has("exploit.metasploit_check")).toBe(
      false
    );
    expect(
      config.allowlistedModuleIds.has("atomic.control_validation_safe")
    ).toBe(false);
    expect(
      config.allowlistedModuleIds.has("caldera.advanced_adversarial")
    ).toBe(false);
    expect(config.allowlistedModuleIds.has("web.sqli_probe")).toBe(false);
  });

  it("covers every Community runner-lane engine on the default allowlist", () => {
    const config = loadRunnerAgentConfig(BASE_ENV);
    const runnerLaneIds = listCommunityRunnerLaneEntries().map(
      (entry) => entry.moduleId
    );
    expect(runnerLaneIds).toEqual(
      expect.arrayContaining([
        "syft.sbom_generate",
        "recon.subdomain_enum",
        "recon.http_probe",
        "recon.dns_probe",
        "recon.host_discovery",
        "recon.service_inventory",
        "tlsx.tls_probe",
        "naabu.port_inventory",
        "amass.passive_enum",
        "cdxgen.sbom_generate"
      ])
    );
    for (const moduleId of runnerLaneIds) {
      expect(
        config.allowlistedModuleIds.has(moduleId),
        `${moduleId} must be on the Node runner-agent default allowlist`
      ).toBe(true);
      expect(DEFAULT_ALLOWLISTED_MODULE_IDS).toContain(moduleId);
    }
    expect(config.allowlistedModuleIds.has("web.zap_baseline")).toBe(true);

    const firstPartyWorkerIds = COMMUNITY_VALIDATION_SUITE.filter(
      (entry) =>
        entry.moduleId.startsWith("periscan.") &&
        communityValidationStartLane(entry) === "worker"
    ).map((entry) => entry.moduleId);
    expect(firstPartyWorkerIds.length).toBeGreaterThan(0);
    for (const moduleId of firstPartyWorkerIds) {
      expect(
        config.allowlistedModuleIds.has(moduleId),
        `${moduleId} stays on the ControlPlane worker, not the Node default`
      ).toBe(false);
    }
  });

  it("requires explicit deployment-time opt-in for offensive local modules", () => {
    const config = loadRunnerAgentConfig({
      ...BASE_ENV,
      PERISCAN_RUNNER_ALLOWED_SAFETY_LEVELS:
        "PassiveReadOnly,ActiveNonInvasive,ControlledValidation",
      PERISCAN_RUNNER_ALLOWLISTED_MODULES:
        "runner.reachability_check,identity.kerberos_userenum"
    });

    expect(config.allowlistedModuleIds).toEqual(
      new Set(["runner.reachability_check", "identity.kerberos_userenum"])
    );
    expect(config.allowedSafetyLevels.has("ControlledValidation")).toBe(true);
  });

  it("loads first-class PERISCAN_RUNNER_PROXY_URL (P10-14 corporate proxy parity)", () => {
    const env: NodeJS.ProcessEnv = {
      ...BASE_ENV,
      PERISCAN_RUNNER_PROXY_URL: "http://proxy.corp.internal:8080"
    };
    const config = loadRunnerAgentConfig(env);
    expect(config.proxyUrl).toBe("http://proxy.corp.internal:8080");
    // Align ambient proxy env for undici/fetch consumers.
    expect(env.HTTPS_PROXY).toBe("http://proxy.corp.internal:8080");
    expect(env.HTTP_PROXY).toBe("http://proxy.corp.internal:8080");
  });

  it("falls back to HTTPS_PROXY when PERISCAN_RUNNER_PROXY_URL is unset", () => {
    const config = loadRunnerAgentConfig({
      ...BASE_ENV,
      HTTPS_PROXY: "http://swg.example:3128"
    });
    expect(config.proxyUrl).toBe("http://swg.example:3128");
  });

  it("defaults proxyUrl to null when no proxy env is set", () => {
    const config = loadRunnerAgentConfig({ ...BASE_ENV });
    expect(config.proxyUrl).toBeNull();
  });
});
