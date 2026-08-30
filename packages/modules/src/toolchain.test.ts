import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  getDefaultDockerImageRef,
  getOpenSourceToolCatalogEntry,
  getOpenSourceToolCatalogEntryWithRuntime,
  getOpenSourceToolCheckoutPath,
  getOpenSourceToolDefinition,
  getOpenSourceToolHome,
  listOpenSourceCapabilities,
  listOpenSourceCapabilitiesWithRuntime,
  listOpenSourceToolCatalog,
  listOpenSourceToolDefinitions,
  listOpenSourceToolCatalogWithRuntime,
  resolveOpenSourceToolRuntime
} from "./toolchain.js";

async function createExecutable(dir: string, name: string) {
  const filePath = path.join(dir, name);

  await writeFile(filePath, "#!/bin/sh\nexit 0\n", "utf8");
  await chmod(filePath, 0o755);

  return filePath;
}

describe("open source toolchain registry", () => {
  it("defaults listings to current tools, excluding deferred and legal-review-only items", () => {
    const defaultTools = listOpenSourceToolDefinitions();
    const defaultCapabilities = listOpenSourceCapabilities();

    expect(defaultTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toolId: "gitleaks" }),
        expect.objectContaining({ toolId: "nuclei" }),
        expect.objectContaining({ toolId: "trivy" }),
        expect.objectContaining({ toolId: "syft" }),
        expect.objectContaining({ toolId: "cosign" }),
        expect.objectContaining({ toolId: "osv-scanner" }),
        expect.objectContaining({ toolId: "prowler" }),
        expect.objectContaining({ toolId: "promptfoo" }),
        expect.objectContaining({ toolId: "pyrit" }),
        expect.objectContaining({ toolId: "atomic-red-team" }),
        expect.objectContaining({ toolId: "invoke-atomicredteam" })
      ])
    );

    expect(defaultTools.some((tool) => tool.toolId === "sharphound")).toBe(
      false
    );

    expect(defaultTools.some((tool) => tool.toolId === "caldera")).toBe(false);

    expect(
      defaultCapabilities.some(
        (capability) =>
          capability.status === "BlockedLegalReview" ||
          capability.status === "Deferred"
      )
    ).toBe(false);

    expect(
      defaultCapabilities.some((capability) => capability.phase === "Current")
    ).toBe(true);
    expect(
      listOpenSourceToolDefinitions({ phase: "Current" }).map(
        (tool) => tool.toolId
      )
    ).toEqual(defaultTools.map((tool) => tool.toolId));
    expect(
      listOpenSourceToolDefinitions({ phase: "CurrentMvp" }).map(
        (tool) => tool.toolId
      )
    ).toEqual(defaultTools.map((tool) => tool.toolId));
    expect(
      defaultCapabilities.some(
        (capability) => capability.phase === "CurrentMvp"
      )
    ).toBe(false);
  });

  it("can include deferred and legal-review-only items when explicitly requested", () => {
    const allTools = listOpenSourceToolDefinitions({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });
    const allCapabilities = listOpenSourceCapabilities({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });

    expect(allTools.some((tool) => tool.toolId === "sharphound")).toBe(true);

    expect(allTools.some((tool) => tool.toolId === "caldera")).toBe(true);

    expect(
      allCapabilities.some(
        (capability) => capability.status === "BlockedLegalReview"
      )
    ).toBe(true);
  });

  it("can narrow catalog views to a specific phase", () => {
    const nearTermTools = listOpenSourceToolDefinitions({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "NearTerm"
    });

    expect(nearTermTools.some((tool) => tool.toolId === "promptfoo")).toBe(
      false
    );
    expect(nearTermTools.some((tool) => tool.toolId === "pyrit")).toBe(false);
    expect(nearTermTools.some((tool) => tool.toolId === "garak")).toBe(true);
    expect(nearTermTools.some((tool) => tool.toolId === "opencti")).toBe(true);
    expect(nearTermTools.some((tool) => tool.toolId === "sigma")).toBe(true);
    expect(nearTermTools.some((tool) => tool.toolId === "ocsf")).toBe(true);
    expect(nearTermTools.some((tool) => tool.toolId === "gitleaks")).toBe(
      false
    );
    expect(
      nearTermTools.some((tool) => tool.toolId === "atomic-red-team")
    ).toBe(false);
  });

  it("tracks the planned validation engines and policy state", () => {
    const tools = listOpenSourceToolDefinitions({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });

    expect(tools.map((tool) => tool.toolId)).toEqual(
      expect.arrayContaining([
        "gitleaks",
        "nuclei",
        "nuclei-templates",
        "trivy",
        "syft",
        "cosign",
        "prowler",
        "promptfoo",
        "pyrit",
        "garak",
        "opencti",
        "sigma",
        "ocsf",
        "atomic-red-team",
        "bloodhound-ce",
        "caldera"
      ])
    );
    expect(getOpenSourceToolDefinition("sharphound")?.policyStatus).toBe(
      "RequiresLegalReview"
    );
  });

  it("exposes capability interfaces for every visible tool", () => {
    const capabilities = listOpenSourceCapabilities({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });
    const catalogEntry = getOpenSourceToolCatalogEntry("promptfoo");
    const prowlerEntry = getOpenSourceToolCatalogEntry("prowler");
    const nucleiEntry = getOpenSourceToolCatalogEntry("nuclei");
    const nmapEntry = getOpenSourceToolCatalogEntry("nmap");
    const subfinderEntry = getOpenSourceToolCatalogEntry("subfinder");
    const httpxEntry = getOpenSourceToolCatalogEntry("httpx");
    const dnsxEntry = getOpenSourceToolCatalogEntry("dnsx");
    const zaproxyEntry = getOpenSourceToolCatalogEntry("zaproxy");
    const syftEntry = getOpenSourceToolCatalogEntry("syft");
    const cosignEntry = getOpenSourceToolCatalogEntry("cosign");
    const ffufEntry = getOpenSourceToolCatalogEntry("ffuf");
    const testsslEntry = getOpenSourceToolCatalogEntry("testssl");
    const sqlmapEntry = getOpenSourceToolCatalogEntry("sqlmap");
    const niktoEntry = getOpenSourceToolCatalogEntry("nikto");
    const whatwebEntry = getOpenSourceToolCatalogEntry("whatweb");
    const netexecEntry = getOpenSourceToolCatalogEntry("netexec");
    const scoutsuiteEntry = getOpenSourceToolCatalogEntry("scoutsuite");
    const metasploitEntry = getOpenSourceToolCatalogEntry("metasploit");
    const kerbruteEntry = getOpenSourceToolCatalogEntry("kerbrute");
    const zeroCapabilityTools = listOpenSourceToolCatalog({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    })
      .filter((entry) => entry.capabilityCounts.total === 0)
      .map((entry) => entry.tool.toolId);

    expect(zeroCapabilityTools).toEqual([]);
    expect(capabilities.some((item) => item.toolId === "gitleaks")).toBe(true);
    expect(capabilities.some((item) => item.toolId === "nuclei")).toBe(true);
    expect(capabilities.some((item) => item.toolId === "caldera")).toBe(true);
    for (const capabilityId of [
      "grype.cve-scan",
      "semgrep.code-exploit-scan",
      "proxmark3.physical-sim",
      "ollama.local-inference",
      "openapi-generator.sdk-gen"
    ]) {
      const capability = capabilities.find(
        (item) => item.capabilityId === capabilityId
      );

      expect(capability?.moduleId).toBeNull();
      expect(capability?.status).toBe("FixtureOnly");
      expect(capability?.apiRoutes).not.toContain("/api/v1/modules");
      expect(capability?.apiRoutes).not.toContain("/api/v1/missions");
    }
    expect(
      capabilities.find(
        (item) => item.capabilityId === "garak.llm-vulnerability-harness"
      )?.status
    ).toBe("Implemented");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "opencti.threat-context-import"
      )?.status
    ).toBe("Implemented");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "sigma.detection-rule-content"
      )?.status
    ).toBe("Implemented");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "ocsf.evidence-normalization"
      )?.status
    ).toBe("Implemented");
    expect(
      capabilities.find((item) => item.capabilityId === "prowler.aws-posture")
        ?.status
    ).toBe("Implemented");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "trivy.repo-dependency-scan"
      )?.status
    ).toBe("Implemented");
    expect(
      capabilities.find((item) => item.capabilityId === "osv.cross-check")
        ?.status
    ).toBe("Implemented");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "nuclei.safe-external-baseline"
      )?.status
    ).toBe("Implemented");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "nuclei.safe-http-header-review"
      )?.status
    ).toBe("Implemented");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "nuclei.safe-public-metadata"
      )?.status
    ).toBe("Implemented");
    for (const capabilityId of [
      "nmap.host-discovery",
      "nmap.service-inventory",
      "subfinder.passive-subdomain-enum",
      "httpx.http-service-probe",
      "dnsx.dns-resolution-probe",
      "zaproxy.passive-baseline",
      "syft.cyclonedx-sbom",
      "cosign.offline-blob-verification"
    ]) {
      expect(
        capabilities.find((item) => item.capabilityId === capabilityId)?.status
      ).toBe("Implemented");
    }
    for (const capabilityId of [
      "netexec.credential-validation-plan",
      "metasploit.exploitation-check-plan",
      "kerbrute.username-enumeration-plan"
    ]) {
      expect(
        capabilities.find((item) => item.capabilityId === capabilityId)?.status
      ).toBe("FixtureOnly");
    }
    expect(
      capabilities.find(
        (item) => item.capabilityId === "ffuf.content-discovery-import"
      )?.status
    ).toBe("FixtureOnly");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "testssl.tls-audit-import"
      )?.status
    ).toBe("BlockedLegalReview");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "sqlmap.sqli-probe-plan"
      )?.status
    ).toBe("BlockedLegalReview");
    expect(
      capabilities.find(
        (item) =>
          item.capabilityId === "nikto.web-server-misconfiguration-import"
      )?.status
    ).toBe("BlockedLegalReview");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "whatweb.technology-fingerprint-import"
      )?.status
    ).toBe("BlockedLegalReview");
    expect(
      capabilities.find(
        (item) => item.capabilityId === "scoutsuite.cloud-posture-import"
      )?.status
    ).toBe("BlockedLegalReview");
    expect(catalogEntry?.capabilityCounts.total).toBeGreaterThan(0);
    expect(catalogEntry?.capabilities.map((item) => item.capabilityId)).toEqual(
      expect.arrayContaining([
        "promptfoo.prompt-injection-suite",
        "promptfoo.rag-and-tool-suite"
      ])
    );
    expect(prowlerEntry?.readiness).toBe("Implemented");
    expect(nucleiEntry?.readiness).toBe("Implemented");
    expect(nmapEntry?.readiness).toBe("Implemented");
    expect(nmapEntry?.capabilityCounts.implemented).toBe(2);
    expect(subfinderEntry?.readiness).toBe("Implemented");
    expect(httpxEntry?.readiness).toBe("Implemented");
    expect(dnsxEntry?.readiness).toBe("Implemented");
    expect(zaproxyEntry?.readiness).toBe("Implemented");
    expect(syftEntry?.readiness).toBe("Implemented");
    expect(cosignEntry?.readiness).toBe("Implemented");
    expect(ffufEntry?.readiness).toBe("Partial");
    expect(ffufEntry?.capabilityCounts.fixtureOnly).toBe(1);
    expect(testsslEntry?.readiness).toBe("Blocked");
    expect(testsslEntry?.capabilityCounts.blocked).toBe(1);
    expect(sqlmapEntry?.readiness).toBe("Blocked");
    expect(sqlmapEntry?.capabilityCounts.blocked).toBe(1);
    expect(niktoEntry?.readiness).toBe("Blocked");
    expect(niktoEntry?.capabilityCounts.blocked).toBe(1);
    expect(whatwebEntry?.readiness).toBe("Blocked");
    expect(whatwebEntry?.capabilityCounts.blocked).toBe(1);
    expect(netexecEntry?.readiness).toBe("Partial");
    expect(netexecEntry?.capabilityCounts.fixtureOnly).toBe(1);
    expect(scoutsuiteEntry?.readiness).toBe("Blocked");
    expect(scoutsuiteEntry?.capabilityCounts.blocked).toBe(1);
    expect(metasploitEntry?.readiness).toBe("Partial");
    expect(metasploitEntry?.capabilityCounts.fixtureOnly).toBe(1);
    expect(kerbruteEntry?.readiness).toBe("Partial");
    expect(kerbruteEntry?.capabilityCounts.fixtureOnly).toBe(1);
  });

  it("enriches tools and capabilities with runtime readiness", async () => {
    const binDir = await mkdtemp(
      path.join(tmpdir(), "periscan-toolchain-ready-")
    );

    try {
      await createExecutable(binDir, "docker");
      await createExecutable(binDir, "scout");
      const tools = await listOpenSourceToolCatalogWithRuntime(
        {
          includeDeferred: true,
          includeLegalReview: true,
          phase: "all"
        },
        {
          PATH: binDir
        }
      );
      const capabilities = await listOpenSourceCapabilitiesWithRuntime(
        {
          includeDeferred: true,
          includeLegalReview: true,
          phase: "all"
        },
        {
          PATH: binDir
        }
      );
      const trivy = tools.find((item) => item.tool.toolId === "trivy");
      const osv = tools.find((item) => item.tool.toolId === "osv-scanner");
      const nmap = tools.find((item) => item.tool.toolId === "nmap");
      const zaproxy = tools.find((item) => item.tool.toolId === "zaproxy");
      const syft = tools.find((item) => item.tool.toolId === "syft");
      const cosign = tools.find((item) => item.tool.toolId === "cosign");
      const ffuf = tools.find((item) => item.tool.toolId === "ffuf");
      const testssl = tools.find((item) => item.tool.toolId === "testssl");
      const sqlmap = tools.find((item) => item.tool.toolId === "sqlmap");
      const nikto = tools.find((item) => item.tool.toolId === "nikto");
      const whatweb = tools.find((item) => item.tool.toolId === "whatweb");
      const netexec = tools.find((item) => item.tool.toolId === "netexec");
      const scoutsuite = tools.find(
        (item) => item.tool.toolId === "scoutsuite"
      );
      const metasploit = tools.find(
        (item) => item.tool.toolId === "metasploit"
      );
      const kerbrute = tools.find((item) => item.tool.toolId === "kerbrute");
      const sharphound = await getOpenSourceToolCatalogEntryWithRuntime(
        "sharphound",
        {
          PATH: binDir
        }
      );
      const calderaCapability = capabilities.find(
        (item) => item.toolId === "caldera"
      );

      expect(trivy?.runtimeAvailable).toBe(true);
      expect(trivy?.executionReadiness).toBe("Ready");
      expect(osv?.runtimeAvailable).toBe(true);
      expect(osv?.executionReadiness).toBe("Ready");
      expect(osv?.runtimeKind).toBe("docker");
      expect(nmap?.runtimeAvailable).toBe(true);
      expect(nmap?.executionReadiness).toBe("Ready");
      expect(zaproxy?.runtimeAvailable).toBe(true);
      expect(zaproxy?.executionReadiness).toBe("Ready");
      expect(syft?.runtimeAvailable).toBe(true);
      expect(syft?.executionReadiness).toBe("Ready");
      expect(cosign?.runtimeAvailable).toBe(true);
      expect(cosign?.executionReadiness).toBe("Ready");
      expect(ffuf?.runtimeAvailable).toBe(true);
      expect(ffuf?.executionReadiness).toBe("FixtureOnly");
      expect(ffuf?.capabilities[0]?.executionReadiness).toBe("FixtureOnly");
      expect(testssl?.runtimeAvailable).toBe(true);
      expect(testssl?.executionReadiness).toBe("Blocked");
      expect(testssl?.capabilities[0]?.executionReadiness).toBe("Blocked");
      expect(sqlmap?.runtimeAvailable).toBe(true);
      expect(sqlmap?.executionReadiness).toBe("Blocked");
      expect(sqlmap?.capabilities[0]?.executionReadiness).toBe("Blocked");
      expect(nikto?.runtimeAvailable).toBe(true);
      expect(nikto?.executionReadiness).toBe("Blocked");
      expect(nikto?.capabilities[0]?.executionReadiness).toBe("Blocked");
      expect(whatweb?.runtimeAvailable).toBe(true);
      expect(whatweb?.executionReadiness).toBe("Blocked");
      expect(whatweb?.capabilities[0]?.executionReadiness).toBe("Blocked");
      expect(netexec?.executionReadiness).toBe("FixtureOnly");
      expect(scoutsuite?.runtimeAvailable).toBe(true);
      expect(scoutsuite?.executionReadiness).toBe("Blocked");
      expect(scoutsuite?.capabilities[0]?.executionReadiness).toBe("Blocked");
      expect(metasploit?.executionReadiness).toBe("Blocked");
      expect(kerbrute?.executionReadiness).toBe("FixtureOnly");
      expect(sharphound?.executionReadiness).toBe("Blocked");
      expect(calderaCapability?.executionReadiness).toBe("Blocked");
      expect(trivy?.lastCheckedAt).toBeTruthy();
    } finally {
      await rm(binDir, {
        force: true,
        recursive: true
      });
    }
  });

  it("builds a pinned docker image reference for docker-backed tools", () => {
    const gitleaks = getOpenSourceToolDefinition("gitleaks");

    expect(gitleaks).not.toBeNull();
    expect(
      getDefaultDockerImageRef(gitleaks!, {
        PERISCAN_GITLEAKS_VERSION: "v8.30.1"
      })
    ).toBe("ghcr.io/gitleaks/gitleaks:v8.30.1");
  });

  it("resolves a binary runtime when an executable is available on PATH", async () => {
    const binDir = await mkdtemp(
      path.join(tmpdir(), "periscan-toolchain-bin-")
    );

    try {
      const binary = await createExecutable(binDir, "gitleaks");
      const resolution = await resolveOpenSourceToolRuntime("gitleaks", {
        PATH: binDir
      });

      expect(resolution.available).toBe(true);
      expect(resolution.runtime).toBe("binary");
      expect(resolution.command).toBe(binary);
      expect(resolution.imageRef).toBeNull();
    } finally {
      await rm(binDir, {
        force: true,
        recursive: true
      });
    }
  });

  it("resolves a docker runtime with an overridable image reference", async () => {
    const binDir = await mkdtemp(
      path.join(tmpdir(), "periscan-toolchain-docker-")
    );

    try {
      const docker = await createExecutable(binDir, "docker");
      const resolution = await resolveOpenSourceToolRuntime("nuclei", {
        PATH: binDir,
        PERISCAN_NUCLEI_IMAGE: "projectdiscovery/nuclei:v9.9.9",
        PERISCAN_NUCLEI_RUNTIME: "docker"
      });

      expect(resolution.available).toBe(true);
      expect(resolution.runtime).toBe("docker");
      expect(resolution.command).toBe(docker);
      expect(resolution.imageRef).toBe("projectdiscovery/nuclei:v9.9.9");
    } finally {
      await rm(binDir, {
        force: true,
        recursive: true
      });
    }
  });

  it("resolves npx, pip, and git backed runtimes for future tools", async () => {
    const binDir = await mkdtemp(
      path.join(tmpdir(), "periscan-toolchain-mixed-")
    );

    try {
      const npx = await createExecutable(binDir, "npx");
      const pip = await createExecutable(binDir, "pip");
      const git = await createExecutable(binDir, "git");

      const promptfoo = await resolveOpenSourceToolRuntime("promptfoo", {
        PATH: binDir,
        PERISCAN_PROMPTFOO_RUNTIME: "npx"
      });
      const pyrit = await resolveOpenSourceToolRuntime("pyrit", {
        PATH: binDir,
        PERISCAN_PYRIT_RUNTIME: "pip"
      });
      const atomic = await resolveOpenSourceToolRuntime("atomic-red-team", {
        PATH: binDir,
        PERISCAN_ATOMIC_RED_TEAM_RUNTIME: "git"
      });

      expect(promptfoo.command).toBe(npx);
      expect(promptfoo.runtime).toBe("npx");
      expect(pyrit.command).toBe(pip);
      expect(pyrit.runtime).toBe("pip");
      expect(atomic.command).toBe(git);
      expect(atomic.runtime).toBe("git");
    } finally {
      await rm(binDir, {
        force: true,
        recursive: true
      });
    }
  });

  it("resolves every bundled server-side tool the way the scan-executor image wires it", async () => {
    // Mirrors infra/docker/scan-executor.Dockerfile: the bundled binaries are on
    // PATH, docker-first tools are forced to `binary`, prowler has an explicit
    // binary path, and node/python/git back promptfoo/pyrit/nuclei-templates.
    const binDir = await mkdtemp(
      path.join(tmpdir(), "periscan-scan-executor-")
    );

    try {
      for (const name of [
        "gitleaks",
        "nuclei",
        "trivy",
        "osv-scanner",
        "prowler",
        "npx",
        "pip",
        "python",
        "git"
      ]) {
        await createExecutable(binDir, name);
      }

      const imageEnv = {
        PATH: binDir,
        // ENV set by the Dockerfile so docker-first tools use the bundled binary.
        PERISCAN_NUCLEI_RUNTIME: "binary",
        PERISCAN_TRIVY_RUNTIME: "binary",
        PERISCAN_PROWLER_RUNTIME: "binary",
        PERISCAN_PROWLER_BINARY: path.join(binDir, "prowler")
      };

      const expected: Array<[string, string]> = [
        ["gitleaks", "binary"],
        ["nuclei", "binary"],
        ["trivy", "binary"],
        ["osv-scanner", "binary"],
        ["prowler", "binary"],
        ["promptfoo", "npx"],
        ["pyrit", "pip"],
        ["nuclei-templates", "git"]
      ];

      for (const [toolId, runtime] of expected) {
        const resolution = await resolveOpenSourceToolRuntime(
          toolId as Parameters<typeof resolveOpenSourceToolRuntime>[0],
          imageEnv
        );
        expect(
          resolution.available,
          `${toolId} should resolve in the scan-executor image`
        ).toBe(true);
        expect(resolution.runtime, `${toolId} runtime`).toBe(runtime);
      }
    } finally {
      await rm(binDir, {
        force: true,
        recursive: true
      });
    }
  });

  it("derives a stable checkout path under the tool home", () => {
    expect(
      getOpenSourceToolHome({
        PERISCAN_OSS_TOOL_HOME: "/tmp/periscan-tools"
      })
    ).toBe("/tmp/periscan-tools");
    expect(
      getOpenSourceToolCheckoutPath("nuclei-templates", {
        PERISCAN_OSS_TOOL_HOME: "/tmp/periscan-tools"
      })
    ).toBe("/tmp/periscan-tools/nuclei-templates");
  });
});
