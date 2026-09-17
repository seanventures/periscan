import type {
  OpenSourceCapability,
  OpenSourceToolDefinition
} from "@periscan/shared";

const COMMON_API_ROUTES = [
  "/api/v1/open-source-tools",
  "/api/v1/modules",
  "/api/v1/missions",
  "/api/v1/community/validation-suite",
  "/api/v1/community/validation-runs"
];

type CatalogTool = {
  binaryName: string;
  category: OpenSourceToolDefinition["category"];
  defaultVersion: string;
  displayName: string;
  dockerImage: string | null;
  docsUrl: string;
  gitRepo: string;
  license: string;
  moduleIds: string[];
  notes: string;
  npmPackage: string | null;
  pipPackage: string | null;
  runtimePreference: OpenSourceToolDefinition["runtimePreference"];
  toolId: OpenSourceToolDefinition["toolId"];
};

const TOOLS: CatalogTool[] = [
  {
    binaryName: "detect-secrets",
    category: "Secrets",
    defaultVersion: "1.5.0",
    displayName: "detect-secrets",
    dockerImage: null,
    docsUrl: "https://github.com/Yelp/detect-secrets",
    gitRepo: "https://github.com/Yelp/detect-secrets.git",
    license: "Apache-2.0",
    moduleIds: ["detect_secrets.repo_secrets"],
    notes: "Yelp detect-secrets. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: "detect-secrets",
    runtimePreference: ["binary", "pip"],
    toolId: "detect-secrets"
  },
  {
    binaryName: "bandit",
    category: "ExposureValidation",
    defaultVersion: "1.8.3",
    displayName: "Bandit",
    dockerImage: "cytopia/bandit",
    docsUrl: "https://bandit.readthedocs.io/",
    gitRepo: "https://github.com/PyCQA/bandit.git",
    license: "Apache-2.0",
    moduleIds: ["bandit.python_sast"],
    notes: "Python AST SAST. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: "bandit",
    runtimePreference: ["binary", "pip", "docker"],
    toolId: "bandit"
  },
  {
    binaryName: "checkov",
    category: "IaC",
    defaultVersion: "3.2.0",
    displayName: "Checkov",
    dockerImage: "bridgecrew/checkov",
    docsUrl: "https://www.checkov.io/",
    gitRepo: "https://github.com/bridgecrewio/checkov.git",
    license: "Apache-2.0",
    moduleIds: ["checkov.iac_posture"],
    notes: "IaC/policy-as-code posture. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: "checkov",
    runtimePreference: ["binary", "docker", "pip"],
    toolId: "checkov"
  },
  {
    binaryName: "pip-audit",
    category: "Dependency",
    defaultVersion: "2.9.0",
    displayName: "pip-audit",
    dockerImage: null,
    docsUrl: "https://pypi.org/project/pip-audit/",
    gitRepo: "https://github.com/pypa/pip-audit.git",
    license: "Apache-2.0",
    moduleIds: ["pip_audit.python_advisories"],
    notes: "Python advisory SCA. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: "pip-audit",
    runtimePreference: ["binary", "pip"],
    toolId: "pip-audit"
  },
  {
    binaryName: "sslyze",
    category: "WebAppScan",
    defaultVersion: "6.1.0",
    displayName: "SSLyze",
    dockerImage: null,
    docsUrl: "https://github.com/nabla-c0d3/sslyze",
    gitRepo: "https://github.com/nabla-c0d3/sslyze.git",
    license: "Apache-2.0",
    moduleIds: ["sslyze.tls_posture"],
    notes: "Non-invasive TLS posture. Apache-2.0 alternative to GPL testssl.",
    npmPackage: null,
    pipPackage: "sslyze",
    runtimePreference: ["binary", "pip"],
    toolId: "sslyze"
  },
  {
    binaryName: "tlsx",
    category: "NetworkRecon",
    defaultVersion: "1.1.9",
    displayName: "tlsx",
    dockerImage: "projectdiscovery/tlsx",
    docsUrl: "https://github.com/projectdiscovery/tlsx",
    gitRepo: "https://github.com/projectdiscovery/tlsx.git",
    license: "MIT",
    moduleIds: ["tlsx.tls_probe"],
    notes: "TLS handshake probe. Safe recon; MIT.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "tlsx"
  },
  {
    binaryName: "naabu",
    category: "NetworkRecon",
    defaultVersion: "2.3.4",
    displayName: "naabu",
    dockerImage: "projectdiscovery/naabu",
    docsUrl: "https://github.com/projectdiscovery/naabu",
    gitRepo: "https://github.com/projectdiscovery/naabu.git",
    license: "MIT",
    moduleIds: ["naabu.port_inventory"],
    notes: "Connect-scan port inventory. ActiveNonInvasive Community recon.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "naabu"
  },
  {
    binaryName: "dockle",
    category: "SupplyChain",
    defaultVersion: "0.4.15",
    displayName: "Dockle",
    dockerImage: "goodwithtech/dockle",
    docsUrl: "https://github.com/goodwithtech/dockle",
    gitRepo: "https://github.com/goodwithtech/dockle.git",
    license: "Apache-2.0",
    moduleIds: ["dockle.dockerfile_cis"],
    notes: "Dockerfile/container CIS lint. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "dockle"
  },
  {
    binaryName: "gosec",
    category: "ExposureValidation",
    defaultVersion: "2.22.0",
    displayName: "gosec",
    dockerImage: "securego/gosec",
    docsUrl: "https://github.com/securego/gosec",
    gitRepo: "https://github.com/securego/gosec.git",
    license: "Apache-2.0",
    moduleIds: ["gosec.go_sast"],
    notes: "Go AST SAST. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "gosec"
  },
  {
    binaryName: "kube-linter",
    category: "IaC",
    defaultVersion: "0.7.2",
    displayName: "KubeLinter",
    dockerImage: "stackrox/kube-linter",
    docsUrl: "https://github.com/stackrox/kube-linter",
    gitRepo: "https://github.com/stackrox/kube-linter.git",
    license: "Apache-2.0",
    moduleIds: ["kube_linter.manifest_posture"],
    notes: "Kubernetes YAML/Helm lint. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "kube-linter"
  },
  {
    binaryName: "terrascan",
    category: "IaC",
    defaultVersion: "1.19.9",
    displayName: "Terrascan",
    dockerImage: "tenable/terrascan",
    docsUrl: "https://runterrascan.io/",
    gitRepo: "https://github.com/tenable/terrascan.git",
    license: "Apache-2.0",
    moduleIds: ["terrascan.iac_posture"],
    notes: "IaC policy scan. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "terrascan"
  },
  {
    binaryName: "kics",
    category: "IaC",
    defaultVersion: "2.1.7",
    displayName: "KICS",
    dockerImage: "checkmarx/kics",
    docsUrl: "https://kics.io/",
    gitRepo: "https://github.com/Checkmarx/kics.git",
    license: "Apache-2.0",
    moduleIds: ["kics.iac_posture"],
    notes: "Checkmarx KICS IaC scanner. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "kics"
  },
  {
    binaryName: "kube-score",
    category: "IaC",
    defaultVersion: "1.19.0",
    displayName: "kube-score",
    dockerImage: "zegl/kube-score",
    docsUrl: "https://github.com/zegl/kube-score",
    gitRepo: "https://github.com/zegl/kube-score.git",
    license: "MIT",
    moduleIds: ["kube_score.manifest_score"],
    notes: "Kubernetes object scoring. Live Community engine; MIT.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "kube-score"
  },
  {
    binaryName: "kube-bench",
    category: "CloudSecurity",
    defaultVersion: "0.10.0",
    displayName: "kube-bench",
    dockerImage: "aquasec/kube-bench",
    docsUrl: "https://github.com/aquasecurity/kube-bench",
    gitRepo: "https://github.com/aquasecurity/kube-bench.git",
    license: "Apache-2.0",
    moduleIds: ["kube_bench.cis_cluster"],
    notes: "CIS Kubernetes benchmark. Live when kubeconfig exists; Apache-2.0.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "kube-bench"
  },
  {
    binaryName: "conftest",
    category: "IaC",
    defaultVersion: "0.56.0",
    displayName: "Conftest",
    dockerImage: "openpolicyagent/conftest",
    docsUrl: "https://www.conftest.dev/",
    gitRepo: "https://github.com/open-policy-agent/conftest.git",
    license: "Apache-2.0",
    moduleIds: ["conftest.policy_test"],
    notes: "OPA/Rego policy tests. Skips honestly when no policy/ dir.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "conftest"
  },
  {
    binaryName: "cdxgen",
    category: "SupplyChain",
    defaultVersion: "11.2.0",
    displayName: "cdxgen",
    dockerImage: "ghcr.io/cyclonedx/cdxgen",
    docsUrl: "https://cyclonedx.github.io/cdxgen/",
    gitRepo: "https://github.com/CycloneDX/cdxgen.git",
    license: "Apache-2.0",
    moduleIds: ["cdxgen.sbom_generate"],
    notes: "CycloneDX SBOM generator. Live Community engine; Apache-2.0.",
    npmPackage: "@cyclonedx/cdxgen",
    pipPackage: null,
    runtimePreference: ["binary", "npx", "docker"],
    toolId: "cdxgen"
  },
  {
    binaryName: "git-secrets",
    category: "Secrets",
    defaultVersion: "1.3.0",
    displayName: "git-secrets",
    dockerImage: null,
    docsUrl: "https://github.com/awslabs/git-secrets",
    gitRepo: "https://github.com/awslabs/git-secrets.git",
    license: "Apache-2.0",
    moduleIds: ["git_secrets.repo_secrets"],
    notes: "AWS git-secrets. Live Community engine; Apache-2.0.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary"],
    toolId: "git-secrets"
  },
  {
    binaryName: "secretlint",
    category: "Secrets",
    defaultVersion: "9.0.0",
    displayName: "secretlint",
    dockerImage: null,
    docsUrl: "https://github.com/secretlint/secretlint",
    gitRepo: "https://github.com/secretlint/secretlint.git",
    license: "MIT",
    moduleIds: ["secretlint.repo_secrets"],
    notes: "Pluggable secret lint. Live Community engine; MIT.",
    npmPackage: "secretlint",
    pipPackage: null,
    runtimePreference: ["binary", "npx"],
    toolId: "secretlint"
  },
  {
    binaryName: "retire",
    category: "Dependency",
    defaultVersion: "5.2.5",
    displayName: "retire.js",
    dockerImage: null,
    docsUrl: "https://retirejs.github.io/retire.js/",
    gitRepo: "https://github.com/RetireJS/retire.js.git",
    license: "Apache-2.0",
    moduleIds: ["retirejs.js_advisories"],
    notes: "JavaScript library CVE scan. Live Community engine; Apache-2.0.",
    npmPackage: "retire",
    pipPackage: null,
    runtimePreference: ["binary", "npx"],
    toolId: "retirejs"
  },
  {
    binaryName: "govulncheck",
    category: "Dependency",
    defaultVersion: "1.1.4",
    displayName: "govulncheck",
    dockerImage: "golang/govulncheck",
    docsUrl: "https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck",
    gitRepo: "https://github.com/golang/vuln.git",
    license: "BSD-3-Clause",
    moduleIds: ["govulncheck.go_advisories"],
    notes: "Official Go vulnerability checker. Live Community engine; BSD-3-Clause.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "govulncheck"
  },
  {
    binaryName: "cargo-audit",
    category: "Dependency",
    defaultVersion: "0.21.2",
    displayName: "cargo-audit",
    dockerImage: null,
    docsUrl: "https://github.com/rustsec/rustsec/tree/main/cargo-audit",
    gitRepo: "https://github.com/rustsec/rustsec.git",
    license: "Apache-2.0",
    moduleIds: ["cargo_audit.rust_advisories"],
    notes: "RustSec lockfile advisories. Live Community engine; Apache-2.0 OR MIT.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary"],
    toolId: "cargo-audit"
  },
  {
    binaryName: "yara",
    category: "DetectionRule",
    defaultVersion: "4.5.2",
    displayName: "YARA",
    dockerImage: null,
    docsUrl: "https://virustotal.github.io/yara/",
    gitRepo: "https://github.com/VirusTotal/yara.git",
    license: "BSD-3-Clause",
    moduleIds: ["yara.repo_rules"],
    notes: "Blue-team rule scan of an authorized repo. Skips without .yar files.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary"],
    toolId: "yara"
  },
  {
    binaryName: "amass",
    category: "ASV_EASM",
    defaultVersion: "4.2.0",
    displayName: "OWASP Amass",
    dockerImage: "caffix/amass",
    docsUrl: "https://owasp.org/www-project-amass/",
    gitRepo: "https://github.com/owasp-amass/amass.git",
    license: "Apache-2.0",
    moduleIds: ["amass.passive_enum"],
    notes: "Passive subdomain enum only. Safe red-adjacent Community recon.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "amass"
  },
  {
    binaryName: "falco",
    category: "DetectionRule",
    defaultVersion: "0.40.0",
    displayName: "Falco",
    dockerImage: "falcosecurity/falco",
    docsUrl: "https://falco.org/",
    gitRepo: "https://github.com/falcosecurity/falco.git",
    license: "Apache-2.0",
    moduleIds: ["falco.rules_validate"],
    notes: "Validates Falco rules in-repo. Does not attach to a live kernel.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "falco"
  },
  {
    binaryName: "kubescape",
    category: "CloudSecurity",
    defaultVersion: "3.0.20",
    displayName: "Kubescape",
    dockerImage: "quay.io/kubescape/kubescape",
    docsUrl: "https://kubescape.io/",
    gitRepo: "https://github.com/kubescape/kubescape.git",
    license: "Apache-2.0",
    moduleIds: ["kubescape.repo_posture"],
    notes: "Kubernetes posture on authorized manifests. Live Community engine.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary", "docker"],
    toolId: "kubescape"
  },
  {
    binaryName: "slsa-verifier",
    category: "SupplyChain",
    defaultVersion: "2.7.0",
    displayName: "SLSA verifier",
    dockerImage: null,
    docsUrl: "https://github.com/slsa-framework/slsa-verifier",
    gitRepo: "https://github.com/slsa-framework/slsa-verifier.git",
    license: "Apache-2.0",
    moduleIds: ["slsa_verifier.provenance"],
    notes: "Verifies SLSA provenance when present. Honest skip otherwise.",
    npmPackage: null,
    pipPackage: null,
    runtimePreference: ["binary"],
    toolId: "slsa-verifier"
  }
];

export const COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS = TOOLS.map((tool) => ({
  ...tool,
  phase: "Current" as const,
  policyStatus: "Enabled" as const
})) satisfies OpenSourceToolDefinition[];

export const COMMUNITY_POPULAR_OSS_CAPABILITIES = TOOLS.flatMap((tool) =>
  tool.moduleIds.map((moduleId) => ({
    apiRoutes: COMMON_API_ROUTES,
    capabilityId: `${tool.toolId}.${moduleId.replace(/[.]/g, "-")}`,
    description: tool.notes,
    evidenceTypes: ["NormalizedEvidence"] as const,
    executionMode: moduleId.includes("amass") ||
    moduleId.includes("tlsx") ||
    moduleId.includes("naabu") ||
    moduleId.includes("cdxgen")
      ? ("InternalRunner" as const)
      : ("ControlPlane" as const),
    featureTags: ["community", "oss", tool.category.toLowerCase()],
    inputSchemaRef: moduleId.includes("sslyze") ||
    moduleId.includes("tlsx") ||
    moduleId.includes("naabu") ||
    moduleId.includes("amass") ||
    moduleId.includes("kube_bench")
      ? "HostTargetSchema"
      : "RepoTargetSchema",
    interfaceKind: "ValidationModule" as const,
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ] as const,
    moduleId,
    name: tool.displayName,
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current" as const,
    requiredIntegrations: [],
    requiredScopes:
      moduleId.includes("kube_bench")
        ? (["InternalNetwork"] as const)
        : moduleId.includes("sslyze") ||
            moduleId.includes("tlsx") ||
            moduleId.includes("amass")
          ? (["Domain", "Subdomain"] as const)
          : moduleId.includes("naabu")
            ? (["IPRange", "InternalNetwork", "Domain", "Subdomain"] as const)
            : (["Repository"] as const),
    safetyLevels:
      moduleId.includes("sslyze") ||
      moduleId.includes("tlsx") ||
      moduleId.includes("naabu") ||
      moduleId.includes("amass")
        ? (["ActiveNonInvasive"] as const)
        : (["PassiveReadOnly"] as const),
    status: "Implemented" as const,
    toolId: tool.toolId
  }))
) satisfies OpenSourceCapability[];
