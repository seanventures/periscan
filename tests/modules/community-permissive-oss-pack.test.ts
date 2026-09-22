import { describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_HOUR_MODULE_IDS,
  COMMUNITY_VALIDATION_SUITE,
  communityFirstHourStartModuleIds,
  isCommunityValidationModuleId,
  isCommunityValidationToolId,
  listCommunityValidationStartModules
} from "../../packages/shared/src/community-edition.js";
import { getModuleById } from "../../packages/modules/src/index.js";
import { listOpenSourceToolDefinitions } from "../../packages/modules/src/toolchain.js";

const PERMISSIVE_PACK_EXPANSION = [
  {
    license: "Apache-2.0",
    moduleId: "kingfisher.repo_secrets",
    scopeType: "Repository",
    toolId: "kingfisher"
  },
  {
    license: "Apache-2.0",
    moduleId: "kyverno.repo_policy",
    scopeType: "Repository",
    toolId: "kyverno"
  },
  {
    license: "Apache-2.0",
    moduleId: "inspec.repo_profile",
    scopeType: "Repository",
    toolId: "inspec"
  },
  {
    license: "MIT",
    moduleId: "assetfinder.passive_enum",
    scopeType: "Domain",
    toolId: "assetfinder"
  },
  {
    license: "MIT",
    moduleId: "gau.known_urls",
    scopeType: "Domain",
    toolId: "gau"
  },
  {
    license: "Apache-2.0",
    moduleId: "detect_secrets.repo_secrets",
    scopeType: "Repository",
    toolId: "detect-secrets"
  },
  {
    license: "Apache-2.0",
    moduleId: "bandit.python_sast",
    scopeType: "Repository",
    toolId: "bandit"
  },
  {
    license: "Apache-2.0",
    moduleId: "gosec.go_sast",
    scopeType: "Repository",
    toolId: "gosec"
  },
  {
    license: "Apache-2.0",
    moduleId: "kube_linter.manifest_posture",
    scopeType: "Repository",
    toolId: "kube-linter"
  },
  {
    license: "Apache-2.0",
    moduleId: "checkov.iac_posture",
    scopeType: "Repository",
    toolId: "checkov"
  },
  {
    license: "Apache-2.0",
    moduleId: "terrascan.iac_posture",
    scopeType: "Repository",
    toolId: "terrascan"
  },
  {
    license: "Apache-2.0",
    moduleId: "kics.iac_posture",
    scopeType: "Repository",
    toolId: "kics"
  },
  {
    license: "Apache-2.0",
    moduleId: "kube_bench.cis_cluster",
    scopeType: "InternalNetwork",
    toolId: "kube-bench"
  },
  {
    license: "MIT",
    moduleId: "brakeman.ruby_sast",
    scopeType: "Repository",
    toolId: "brakeman"
  },
  {
    license: "Apache-2.0",
    moduleId: "talisman.repo_secrets",
    scopeType: "Repository",
    toolId: "talisman"
  },
  {
    license: "Apache-2.0",
    moduleId: "dependency_check.sca",
    scopeType: "Repository",
    toolId: "dependency-check"
  },
  {
    license: "BSD-3-Clause",
    moduleId: "yara.repo_rules",
    scopeType: "Repository",
    toolId: "yara"
  },
  {
    license: "Apache-2.0",
    moduleId: "falco.rules_validate",
    scopeType: "Repository",
    toolId: "falco"
  },
  {
    license: "Apache-2.0",
    moduleId: "amass.passive_enum",
    scopeType: "Domain",
    toolId: "amass"
  },
  {
    license: "Apache-2.0",
    moduleId: "horusec.multi_sast",
    scopeType: "Repository",
    toolId: "horusec"
  },
  {
    license: "MIT",
    moduleId: "naabu.port_inventory",
    scopeType: "Domain",
    toolId: "naabu"
  },
  {
    license: "MIT",
    moduleId: "tfsec.iac_posture",
    scopeType: "Repository",
    toolId: "tfsec"
  },
  {
    license: "MIT",
    moduleId: "cfn_nag.cloudformation",
    scopeType: "Repository",
    toolId: "cfn-nag"
  },
  {
    license: "Apache-2.0",
    moduleId: "whispers.repo_secrets",
    scopeType: "Repository",
    toolId: "whispers"
  },
  {
    license: "Apache-2.0",
    moduleId: "nancy.go_advisories",
    scopeType: "Repository",
    toolId: "nancy"
  },
  {
    license: "Apache-2.0",
    moduleId: "sobelow.elixir_sast",
    scopeType: "Repository",
    toolId: "sobelow"
  },
  {
    license: "Apache-2.0",
    moduleId: "polaris.k8s_posture",
    scopeType: "Repository",
    toolId: "polaris"
  },
  {
    license: "MIT",
    moduleId: "kubeaudit.k8s_posture",
    scopeType: "Repository",
    toolId: "kubeaudit"
  },
  {
    license: "Apache-2.0",
    moduleId: "popeye.cluster_sanitizer",
    scopeType: "InternalNetwork",
    toolId: "popeye"
  },
  {
    license: "MIT",
    moduleId: "katana.web_crawl",
    scopeType: "Domain",
    toolId: "katana"
  },
  {
    license: "MIT",
    moduleId: "cloudlist.cloud_assets",
    scopeType: "CloudAccount",
    toolId: "cloudlist"
  },
  {
    license: "Apache-2.0",
    moduleId: "pip_audit.python_advisories",
    scopeType: "Repository",
    toolId: "pip-audit"
  },
  {
    license: "Apache-2.0",
    moduleId: "dockle.dockerfile_cis",
    scopeType: "Repository",
    toolId: "dockle"
  },
  {
    license: "MIT",
    moduleId: "tlsx.tls_probe",
    scopeType: "Domain",
    toolId: "tlsx"
  },
  {
    license: "MIT",
    moduleId: "kube_score.manifest_score",
    scopeType: "Repository",
    toolId: "kube-score"
  },
  {
    license: "Apache-2.0",
    moduleId: "conftest.policy_test",
    scopeType: "Repository",
    toolId: "conftest"
  },
  {
    license: "Apache-2.0",
    moduleId: "cdxgen.sbom_generate",
    scopeType: "Repository",
    toolId: "cdxgen"
  },
  {
    license: "Apache-2.0",
    moduleId: "git_secrets.repo_secrets",
    scopeType: "Repository",
    toolId: "git-secrets"
  },
  {
    license: "MIT",
    moduleId: "secretlint.repo_secrets",
    scopeType: "Repository",
    toolId: "secretlint"
  },
  {
    license: "Apache-2.0",
    moduleId: "retirejs.js_advisories",
    scopeType: "Repository",
    toolId: "retirejs"
  },
  {
    license: "BSD-3-Clause",
    moduleId: "govulncheck.go_advisories",
    scopeType: "Repository",
    toolId: "govulncheck"
  },
  {
    license: "Apache-2.0",
    moduleId: "cargo_audit.rust_advisories",
    scopeType: "Repository",
    toolId: "cargo-audit"
  },
  {
    license: "Apache-2.0",
    moduleId: "kubescape.repo_posture",
    scopeType: "Repository",
    toolId: "kubescape"
  },
  {
    license: "Apache-2.0",
    moduleId: "slsa_verifier.provenance",
    scopeType: "Repository",
    toolId: "slsa-verifier"
  }
] as const;

describe("permissive Community OSS pack (PERISCAN-490)", () => {
  it("first hour stays Gitleaks-class secrets, not the expanded pack", () => {
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).toEqual([
      "gitleaks.repo_secrets"
    ]);
    const startable = [
      "gitleaks.repo_secrets",
      ...PERMISSIVE_PACK_EXPANSION.map((row) => row.moduleId)
    ];
    expect(communityFirstHourStartModuleIds(startable)).toEqual([
      "gitleaks.repo_secrets"
    ]);
    expect(communityFirstHourStartModuleIds(startable)).toHaveLength(1);
  });

  it("wires toolchain MIT/Apache catalog holes into the full Community pack", () => {
    const tools = listOpenSourceToolDefinitions({
      includeDeferred: true,
      phase: "all"
    });
    for (const row of PERMISSIVE_PACK_EXPANSION) {
      const tool = tools.find((entry) => entry.toolId === row.toolId);
      expect(tool?.license, row.toolId).toBe(row.license);
      expect(tool?.moduleIds, row.toolId).toEqual([row.moduleId]);
      expect(isCommunityValidationToolId(row.toolId)).toBe(true);
      expect(isCommunityValidationModuleId(row.moduleId)).toBe(true);
      const module = getModuleById(row.moduleId);
      expect(module, row.moduleId).not.toBeNull();
      expect(module?.manifest.liveSupported).toBe(true);
      expect(module?.manifest.fixtureSupported).toBe(true);
      expect(module?.manifest.license).toBe(row.license);
      expect(
        COMMUNITY_VALIDATION_SUITE.some(
          (entry) =>
            entry.moduleId === row.moduleId && entry.toolLicense === row.license
        )
      ).toBe(true);
    }
  });

  it("starts repo holes on Repository and host holes on Domain only with a runner", () => {
    const repo = listCommunityValidationStartModules({
      scopeType: "Repository"
    }).map((entry) => entry.moduleId);
    expect(repo).toEqual(
      expect.arrayContaining([
        "kingfisher.repo_secrets",
        "kyverno.repo_policy",
        "inspec.repo_profile",
        "detect_secrets.repo_secrets",
        "bandit.python_sast",
        "gosec.go_sast",
        "kube_linter.manifest_posture",
        "checkov.iac_posture",
        "terrascan.iac_posture",
        "kics.iac_posture",
        "brakeman.ruby_sast",
        "talisman.repo_secrets",
        "dependency_check.sca",
        "yara.repo_rules",
        "falco.rules_validate",
        "horusec.multi_sast",
        "tfsec.iac_posture",
        "cfn_nag.cloudformation",
        "whispers.repo_secrets",
        "nancy.go_advisories",
        "sobelow.elixir_sast",
        "polaris.k8s_posture",
        "kubeaudit.k8s_posture",
        "pip_audit.python_advisories",
        "dockle.dockerfile_cis",
        "kube_score.manifest_score",
        "conftest.policy_test",
        "git_secrets.repo_secrets",
        "secretlint.repo_secrets",
        "retirejs.js_advisories",
        "govulncheck.go_advisories",
        "cargo_audit.rust_advisories",
        "kubescape.repo_posture",
        "slsa_verifier.provenance"
      ])
    );
    expect(repo).not.toContain("cdxgen.sbom_generate");
    expect(repo).not.toContain("assetfinder.passive_enum");
    expect(repo).not.toContain("gau.known_urls");
    expect(repo).not.toContain("kube_bench.cis_cluster");
    expect(repo).not.toContain("amass.passive_enum");
    expect(repo).not.toContain("naabu.port_inventory");
    expect(repo).not.toContain("popeye.cluster_sanitizer");
    expect(repo).not.toContain("katana.web_crawl");
    expect(repo).not.toContain("cloudlist.cloud_assets");
    expect(repo).not.toContain("tlsx.tls_probe");

    const network = listCommunityValidationStartModules({
      scopeType: "InternalNetwork"
    }).map((entry) => entry.moduleId);
    expect(network).toEqual(
      expect.arrayContaining([
        "kube_bench.cis_cluster",
        "popeye.cluster_sanitizer"
      ])
    );
    expect(network).not.toContain("naabu.port_inventory");

    const networkWithRunner = listCommunityValidationStartModules({
      runnerAvailable: true,
      scopeType: "InternalNetwork"
    }).map((entry) => entry.moduleId);
    expect(networkWithRunner).toEqual(
      expect.arrayContaining([
        "kube_bench.cis_cluster",
        "popeye.cluster_sanitizer",
        "naabu.port_inventory"
      ])
    );

    const domainWithoutRunner = listCommunityValidationStartModules({
      runnerAvailable: false,
      scopeType: "Domain"
    }).map((entry) => entry.moduleId);
    expect(domainWithoutRunner).not.toContain("assetfinder.passive_enum");
    expect(domainWithoutRunner).not.toContain("gau.known_urls");
    expect(domainWithoutRunner).not.toContain("amass.passive_enum");
    expect(domainWithoutRunner).not.toContain("naabu.port_inventory");
    expect(domainWithoutRunner).not.toContain("katana.web_crawl");
    expect(domainWithoutRunner).not.toContain("tlsx.tls_probe");

    const domainWithRunner = listCommunityValidationStartModules({
      runnerAvailable: true,
      scopeType: "Domain"
    }).map((entry) => entry.moduleId);
    expect(domainWithRunner).toEqual(
      expect.arrayContaining([
        "assetfinder.passive_enum",
        "gau.known_urls",
        "amass.passive_enum",
        "naabu.port_inventory",
        "katana.web_crawl",
        "tlsx.tls_probe"
      ])
    );

    const cloudWithoutRunner = listCommunityValidationStartModules({
      runnerAvailable: false,
      scopeType: "CloudAccount"
    }).map((entry) => entry.moduleId);
    expect(cloudWithoutRunner).not.toContain("cloudlist.cloud_assets");

    const cloudWithRunner = listCommunityValidationStartModules({
      runnerAvailable: true,
      scopeType: "CloudAccount"
    }).map((entry) => entry.moduleId);
    expect(cloudWithRunner).toEqual(
      expect.arrayContaining(["cloudlist.cloud_assets"])
    );

    const repoWithRunner = listCommunityValidationStartModules({
      runnerAvailable: true,
      scopeType: "Repository"
    }).map((entry) => entry.moduleId);
    expect(repoWithRunner).toEqual(
      expect.arrayContaining(["cdxgen.sbom_generate"])
    );
  });

  it("does not put GPL, Semgrep-as-default, or live BAS into the Community pack", () => {
    expect(
      COMMUNITY_VALIDATION_SUITE.some((entry) =>
        /GPL|LGPL|AGPL/i.test(entry.toolLicense)
      )
    ).toBe(false);
    expect(isCommunityValidationToolId("semgrep")).toBe(false);
    expect(isCommunityValidationModuleId("semgrep.repo_sast")).toBe(false);
    expect(isCommunityValidationToolId("sqlmap")).toBe(false);
    expect(isCommunityValidationToolId("metasploit")).toBe(false);
    expect(isCommunityValidationToolId("caldera")).toBe(false);
    expect(isCommunityValidationToolId("atomic-red-team")).toBe(false);
    expect(isCommunityValidationModuleId("web.sqli_probe")).toBe(false);
    expect(
      isCommunityValidationModuleId("atomic.control_validation_safe")
    ).toBe(false);
  });
});
