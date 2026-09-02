import type { OpenSourceToolId } from "./open-source.js";

export type SecurityCatalogPackId =
  | "secrets"
  | "sast"
  | "sca"
  | "iac"
  | "containers"
  | "cloud"
  | "recon"
  | "web"
  | "tls"
  | "detection"
  | "identity"
  | "supply-chain"
  | "endpoint"
  | "ai";

export type SecurityCatalogPack = {
  description: string;
  packId: SecurityCatalogPackId;
  title: string;
  toolIds: readonly OpenSourceToolId[];
};

/**
 * Package-manager grouping for Engine Lab. Tool IDs must exist on
 * OpenSourceToolIdSchema. Theater IDs may appear for honesty but stay
 * non-installable.
 */
export const SECURITY_CATALOG_PACKS: readonly SecurityCatalogPack[] = [
  {
    packId: "secrets",
    title: "Secrets",
    description: "Find leaked credentials in authorized repositories.",
    toolIds: [
      "gitleaks",
      "detect-secrets",
      "git-secrets",
      "secretlint",
      "talisman",
      "kingfisher",
      "whispers",
      "trufflehog"
    ]
  },
  {
    packId: "sast",
    title: "SAST",
    description: "Language-specific static analysis on authorized source.",
    toolIds: [
      "bandit",
      "gosec",
      "brakeman",
      "horusec",
      "sobelow",
      "insider",
      "security-code-scan",
      "semgrep",
      "nodejsscan"
    ]
  },
  {
    packId: "sca",
    title: "SCA / advisories",
    description: "Known-vulnerable dependencies and lockfile advisories.",
    toolIds: [
      "trivy",
      "osv-scanner",
      "grype",
      "pip-audit",
      "govulncheck",
      "cargo-audit",
      "retirejs",
      "dependency-check",
      "nancy",
      "bundler-audit",
      "osv-scalibr",
      "cve-bin-tool",
      "vuls"
    ]
  },
  {
    packId: "iac",
    title: "IaC / Kubernetes posture",
    description: "Misconfig and policy-as-code before deploy.",
    toolIds: [
      "checkov",
      "terrascan",
      "kics",
      "kube-linter",
      "kube-score",
      "kube-bench",
      "conftest",
      "kubescape",
      "tfsec",
      "cfn-nag",
      "cfn-lint",
      "tflint",
      "polaris",
      "kubeaudit",
      "popeye",
      "kyverno",
      "inspec",
      "terraform",
      "ansible"
    ]
  },
  {
    packId: "containers",
    title: "Containers / images",
    description: "Dockerfile, image, and runtime posture.",
    toolIds: [
      "dockle",
      "trivy",
      "grype",
      "dive",
      "clair",
      "hadolint",
      "falco",
      "tracee",
      "tetragon"
    ]
  },
  {
    packId: "cloud",
    title: "Cloud posture",
    description: "Account and IAM posture on connected cloud scope.",
    toolIds: [
      "prowler",
      "scoutsuite",
      "cloudlist",
      "parliament",
      "cartography",
      "cloudsploit",
      "cloudfox"
    ]
  },
  {
    packId: "recon",
    title: "Recon / inventory",
    description: "Authorized host, DNS, and asset inventory. Not exploit.",
    toolIds: [
      "nmap",
      "naabu",
      "amass",
      "subfinder",
      "httpx",
      "dnsx",
      "tlsx",
      "katana",
      "assetfinder",
      "gau",
      "uncover",
      "cloudlist",
      "zmap",
      "zgrab",
      "findomain",
      "theharvester",
      "recon-ng",
      "spiderfoot"
    ]
  },
  {
    packId: "web",
    title: "Web application",
    description: "Baseline web checks. Fuzzers stay catalog, not Community.",
    toolIds: [
      "zaproxy",
      "nuclei",
      "nuclei-templates",
      "nikto",
      "whatweb",
      "wapiti",
      "jaeles",
      "arjun",
      "ffuf",
      "gobuster",
      "feroxbuster",
      "dirsearch"
    ]
  },
  {
    packId: "tls",
    title: "TLS / certificates",
    description: "Handshake and configuration posture.",
    toolIds: ["sslyze", "tlsx", "testssl", "sslscan", "ssllabs-scan"]
  },
  {
    packId: "detection",
    title: "Detection / blue team",
    description: "Rules, telemetry, and content packs. Not live C2.",
    toolIds: [
      "yara",
      "sigma",
      "ocsf",
      "opencti",
      "falco",
      "zeek",
      "crowdsec",
      "osquery",
      "suricata",
      "wazuh",
      "ossec",
      "tshark",
      "tcpdump",
      "capa",
      "ghidra",
      "binwalk",
      "radare2",
      "volatility3",
      "clamav",
      "fail2ban"
    ]
  },
  {
    packId: "identity",
    title: "Identity",
    description: "Graph import and catalog-only identity tools.",
    toolIds: ["bloodhound-ce", "sharphound", "kerbrute", "netexec"]
  },
  {
    packId: "supply-chain",
    title: "Supply chain / SBOM",
    description: "SBOM, signing, and provenance.",
    toolIds: [
      "syft",
      "cdxgen",
      "cosign",
      "slsa-verifier",
      "notation",
      "in-toto",
      "helm",
      "kustomize"
    ]
  },
  {
    packId: "endpoint",
    title: "Endpoint / host audit",
    description: "Host CIS and audit CLIs. Runner-local after install.",
    toolIds: ["lynis", "inspec", "osquery", "openvas", "vuls"]
  },
  {
    packId: "ai",
    title: "AI / LLM validation",
    description: "Safe harnesses and local inference. Not a live jailbreak kit.",
    toolIds: ["promptfoo", "garak", "pyrit", "ollama", "a2a-tck"]
  }
];

export function listSecurityCatalogPacks(): SecurityCatalogPack[] {
  return SECURITY_CATALOG_PACKS.map((pack) => ({
    ...pack,
    toolIds: [...pack.toolIds]
  }));
}

export function securityCatalogPackForTool(
  toolId: string
): SecurityCatalogPack | undefined {
  return SECURITY_CATALOG_PACKS.find((pack) =>
    (pack.toolIds as readonly string[]).includes(toolId)
  );
}

export function listUniqueSecurityCatalogToolIds(): string[] {
  return [
    ...new Set(SECURITY_CATALOG_PACKS.flatMap((pack) => [...pack.toolIds]))
  ];
}
