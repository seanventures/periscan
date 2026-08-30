import { z } from "zod";

import {
  MissionStartResultSchema,
  PolicyRequestedActionSchema,
  ScopeTypeSchema,
  type PolicyRequestedAction
} from "./domain";
import { isRunnerDispatchableModuleId } from "./runner";

export const CommunityModuleExecutionModeSchema = z.enum([
  "ControlPlane",
  "InternalRunner",
  "ExternalPoA"
]);

/**
 * Periscan Community edition is the open-core *product slice*: authorized
 * scope + policy + safe OSS/first-party engines + evidence. Source is
 * Apache-2.0. Third-party engines keep their own SPDX.
 */
export const COMMUNITY_EDITION_ID = "community" as const;

/** First-party Community mission stamp. Unused by other createMission callers. */
export const COMMUNITY_MISSION_POLICY_PROFILE = "community" as const;

/** Nuclei second-mission stamp. Reconstruction still works without it. */
export const COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE =
  "community-nuclei" as const;

export const COMMUNITY_NUCLEI_MODULE_ID =
  "nuclei.external_exposure_safe" as const;

/** How far before the primary a Nuclei sibling may still count as "around". */
export const COMMUNITY_NUCLEI_SIBLING_WINDOW_MS = 5 * 60 * 1000;

export const COMMUNITY_EDITION_VALUE_LINE =
  "Community edition is the open-core validation pack: secrets (Gitleaks, detect-secrets, git-secrets, secretlint), SCA (Trivy, OSV, Grype, pip-audit, govulncheck, cargo-audit, retire.js), SAST (Bandit, gosec), IaC (Checkov, Terrascan, KICS, kube-linter, kube-score, Kubescape, Conftest), SBOM (Syft, cdxgen), containers (Dockle, Trivy), TLS (SSLyze/tlsx), ZAP, Nuclei (second mission), Prowler, kube CIS/kube-bench, YARA/Falco rules, MIT recon, nmap/naabu/amass when a runner is enrolled. Apache-2.0 product source. Not live Atomic/Caldera/Metasploit. GPL/LGPL engines stay Engine Lab + license accept.";

export const COMMUNITY_EDITION_LICENSE_NOTE =
  "Community edition is the open-core validation slice. Source is Apache-2.0. Third-party engines keep their own SPDX. Not full BAS. Not live Atomic/Caldera/Metasploit.";

/** Local file Community uses to prove repository authorization (not a LICENSE flip). */
export const COMMUNITY_REPOSITORY_AUTH_FILENAME = ".periscan-authorization";

export const CommunityProductEditionSchema = z.enum([
  "community",
  "commercial"
]);

export const CommunityValidationTargetKindSchema = z.enum([
  "hostname",
  "repositoryPath",
  "url",
  "cidr"
]);

export const CommunityValidationStartLaneSchema = z.enum([
  "worker",
  "runner",
  "externalPoa",
  "cloud"
]);

export const CommunityValidationSuiteEntrySchema = z.object({
  defaultSafetyLevel: z.enum(["PassiveReadOnly", "ActiveNonInvasive"]),
  executionMode: CommunityModuleExecutionModeSchema,
  moduleId: z.string().min(1),
  requiredScopeTypes: z.array(ScopeTypeSchema).min(1),
  targetKind: CommunityValidationTargetKindSchema,
  title: z.string().min(1),
  toolId: z.string().min(1).nullable(),
  toolLicense: z.string().min(1)
});

export type CommunityProductEdition = z.infer<
  typeof CommunityProductEditionSchema
>;
export type CommunityValidationTargetKind = z.infer<
  typeof CommunityValidationTargetKindSchema
>;
export type CommunityValidationSuiteEntry = z.infer<
  typeof CommunityValidationSuiteEntrySchema
>;

/**
 * Engines Community edition may start as a Validation Snapshot. Permissive
 * SPDX + first-party checks only. No Atomic/Caldera/SharpHound/sqlmap/
 * Metasploit/cred-spray. GPL RequiresLegalReview tools stay out of the default
 * suite (Engine Lab + license accept remains the path).
 */
export const COMMUNITY_VALIDATION_SUITE = [
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "gitleaks.repo_secrets",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Repository secret scan",
    toolId: "gitleaks",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "trivy.repo_dependency_scan",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Repository dependency scan",
    toolId: "trivy",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "osv.repo_dependency_scan",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "OSV advisory scan",
    toolId: "osv-scanner",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "grype.repo_vulnerability_scan",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Grype vulnerability inventory",
    toolId: "grype",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "InternalRunner",
    moduleId: "syft.sbom_generate",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Syft CycloneDX SBOM",
    toolId: "syft",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "prowler.aws_posture",
    requiredScopeTypes: ["CloudAccount"],
    targetKind: "hostname",
    title: "Prowler AWS posture",
    toolId: "prowler",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "periscan.dns_resolution_check",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "DNS resolution",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "periscan.dns_email_security_check",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "DNS email SPF/DMARC",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "periscan.dns_caa_check",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "DNS CAA issuance control",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "periscan.well_known_security_txt",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "security.txt disclosure channel",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "periscan.tls_certificate_check",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "TLS certificate check",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "periscan.tls_protocol_audit",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "TLS protocol audit",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "periscan.http_health_check",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "HTTP health and headers",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "periscan.http_cookie_security",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "HTTP cookie security",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "periscan.http_redirect_enforcement",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "HTTP redirect enforcement",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "periscan.http_cors_audit",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "HTTP CORS audit",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "periscan.tcp_reachability",
    requiredScopeTypes: ["Domain", "Subdomain", "IPRange", "InternalNetwork"],
    targetKind: "hostname",
    title: "TCP reachability",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ExternalPoA",
    moduleId: "nuclei.external_exposure_safe",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "Nuclei safe external exposure",
    toolId: "nuclei",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "web.zap_baseline",
    requiredScopeTypes: ["Domain", "Subdomain", "IPRange"],
    targetKind: "url",
    title: "ZAP baseline",
    toolId: "zaproxy",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "recon.subdomain_enum",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "Subfinder subdomain enum",
    toolId: "subfinder",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "recon.http_probe",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "httpx HTTP probe",
    toolId: "httpx",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "recon.dns_probe",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "dnsx DNS probe",
    toolId: "dnsx",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "recon.host_discovery",
    requiredScopeTypes: ["IPRange", "InternalNetwork"],
    targetKind: "cidr",
    title: "nmap host discovery",
    toolId: "nmap",
    toolLicense: "NPSL"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "recon.service_inventory",
    requiredScopeTypes: ["IPRange", "InternalNetwork", "Domain", "Subdomain"],
    targetKind: "hostname",
    title: "nmap service inventory",
    toolId: "nmap",
    toolLicense: "NPSL"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "trivy.repo_misconfig",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Trivy IaC/misconfig",
    toolId: "trivy",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "detect_secrets.repo_secrets",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "detect-secrets scan",
    toolId: "detect-secrets",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "bandit.python_sast",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Bandit Python SAST",
    toolId: "bandit",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "checkov.iac_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Checkov IaC posture",
    toolId: "checkov",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "pip_audit.python_advisories",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "pip-audit Python advisories",
    toolId: "pip-audit",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "dockle.dockerfile_cis",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Dockle Dockerfile CIS",
    toolId: "dockle",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "ControlPlane",
    moduleId: "sslyze.tls_posture",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "SSLyze TLS posture",
    toolId: "sslyze",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "tlsx.tls_probe",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "tlsx TLS probe",
    toolId: "tlsx",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "naabu.port_inventory",
    requiredScopeTypes: ["IPRange", "InternalNetwork", "Domain", "Subdomain"],
    targetKind: "hostname",
    title: "naabu port inventory",
    toolId: "naabu",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "periscan.kubernetes_cis_posture",
    requiredScopeTypes: ["InternalNetwork"],
    targetKind: "hostname",
    title: "Kubernetes CIS posture",
    toolId: null,
    toolLicense: "Proprietary"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "gosec.go_sast",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "gosec Go SAST",
    toolId: "gosec",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "kube_linter.manifest_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "KubeLinter manifest posture",
    toolId: "kube-linter",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "terrascan.iac_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Terrascan IaC posture",
    toolId: "terrascan",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "kics.iac_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "KICS IaC posture",
    toolId: "kics",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "kube_score.manifest_score",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "kube-score manifest score",
    toolId: "kube-score",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "kube_bench.cis_cluster",
    requiredScopeTypes: ["InternalNetwork"],
    targetKind: "hostname",
    title: "kube-bench CIS cluster",
    toolId: "kube-bench",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "conftest.policy_test",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Conftest OPA policy test",
    toolId: "conftest",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "InternalRunner",
    moduleId: "cdxgen.sbom_generate",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "cdxgen CycloneDX SBOM",
    toolId: "cdxgen",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "git_secrets.repo_secrets",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "git-secrets scan",
    toolId: "git-secrets",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "secretlint.repo_secrets",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "secretlint scan",
    toolId: "secretlint",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "retirejs.js_advisories",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "retire.js JS advisories",
    toolId: "retirejs",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "govulncheck.go_advisories",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "govulncheck Go advisories",
    toolId: "govulncheck",
    toolLicense: "BSD-3-Clause"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "cargo_audit.rust_advisories",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "cargo-audit Rust advisories",
    toolId: "cargo-audit",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "yara.repo_rules",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "YARA repository rules",
    toolId: "yara",
    toolLicense: "BSD-3-Clause"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "amass.passive_enum",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "Amass passive enum",
    toolId: "amass",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "falco.rules_validate",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Falco rules validate",
    toolId: "falco",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "kubescape.repo_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Kubescape repo posture",
    toolId: "kubescape",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "slsa_verifier.provenance",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "SLSA provenance verify",
    toolId: "slsa-verifier",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "brakeman.ruby_sast",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Brakeman Ruby SAST",
    toolId: "brakeman",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "horusec.multi_sast",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Horusec multi SAST",
    toolId: "horusec",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "dependency_check.sca",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "OWASP Dependency-Check",
    toolId: "dependency-check",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "talisman.repo_secrets",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Talisman secret scan",
    toolId: "talisman",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "tfsec.iac_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "tfsec IaC posture",
    toolId: "tfsec",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "cfn_nag.cloudformation",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "cfn-nag CloudFormation",
    toolId: "cfn-nag",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "cfn_lint.cloudformation",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "cfn-lint CloudFormation",
    toolId: "cfn-lint",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "parliament.iam_policy",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Parliament IAM policy lint",
    toolId: "parliament",
    toolLicense: "BSD-3-Clause"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "whispers.repo_secrets",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Whispers secret scan",
    toolId: "whispers",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "nancy.go_advisories",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Nancy Go advisories",
    toolId: "nancy",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "sobelow.elixir_sast",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Sobelow Elixir SAST",
    toolId: "sobelow",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "polaris.k8s_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "Polaris Kubernetes posture",
    toolId: "polaris",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "kubeaudit.k8s_posture",
    requiredScopeTypes: ["Repository"],
    targetKind: "repositoryPath",
    title: "kubeaudit Kubernetes posture",
    toolId: "kubeaudit",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "ControlPlane",
    moduleId: "popeye.cluster_sanitizer",
    requiredScopeTypes: ["InternalNetwork"],
    targetKind: "hostname",
    title: "Popeye cluster sanitizer",
    toolId: "popeye",
    toolLicense: "Apache-2.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive",
    executionMode: "InternalRunner",
    moduleId: "katana.web_crawl",
    requiredScopeTypes: ["Domain", "Subdomain"],
    targetKind: "hostname",
    title: "Katana web crawl",
    toolId: "katana",
    toolLicense: "MIT"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly",
    executionMode: "InternalRunner",
    moduleId: "cloudlist.cloud_assets",
    requiredScopeTypes: ["CloudAccount"],
    targetKind: "hostname",
    title: "cloudlist cloud assets",
    toolId: "cloudlist",
    toolLicense: "MIT"
  }
] as const satisfies readonly CommunityValidationSuiteEntry[];

export const COMMUNITY_VALIDATION_MODULE_IDS = COMMUNITY_VALIDATION_SUITE.map(
  (entry) => entry.moduleId
);

export const COMMUNITY_VALIDATION_TOOL_IDS = [
  ...new Set(
    COMMUNITY_VALIDATION_SUITE.flatMap((entry) =>
      entry.toolId ? [entry.toolId] : []
    )
  )
];

/** Never Community-start, even when catalog policyStatus is Enabled. */
export const ENGINE_LAB_THEATER_TOOL_IDS = [
  "atomic-red-team",
  "invoke-atomicredteam",
  "caldera",
  "sharphound",
  "sqlmap",
  "metasploit",
  "netexec",
  "promptfoo"
] as const;

export const ENGINE_LAB_THEATER_MODULE_IDS = [
  "atomic.control_validation_safe",
  "caldera.advanced_adversarial",
  "exploit.metasploit_check",
  "identity.cred_spray",
  "web.sqli_probe"
] as const;

/**
 * Copyleft engines the tenant may add themselves after an explicit SPDX
 * accept. Periscan does not redistribute these in the default image.
 * Never includes theater/offensive IDs.
 */
export const COPYLEFT_OPT_IN_SUITE = [
  {
    defaultSafetyLevel: "PassiveReadOnly" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "semgrep.repo_sast",
    requiredScopeTypes: ["Repository"] as const,
    targetKind: "repositoryPath" as const,
    title: "Semgrep SAST",
    toolId: "semgrep",
    toolLicense: "LGPL-2.1"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "web.tls_audit",
    requiredScopeTypes: ["Domain", "Subdomain", "IPRange"] as const,
    targetKind: "url" as const,
    title: "testssl.sh TLS audit",
    toolId: "testssl",
    toolLicense: "GPL-2.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "web.nikto_scan",
    requiredScopeTypes: ["Domain", "Subdomain", "IPRange"] as const,
    targetKind: "url" as const,
    title: "Nikto web scan",
    toolId: "nikto",
    toolLicense: "GPL-2.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "web.fingerprint",
    requiredScopeTypes: ["Domain", "Subdomain", "IPRange"] as const,
    targetKind: "url" as const,
    title: "WhatWeb fingerprint",
    toolId: "whatweb",
    toolLicense: "GPL-3.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "cloud.scoutsuite_posture",
    requiredScopeTypes: ["CloudAccount"] as const,
    targetKind: "hostname" as const,
    title: "ScoutSuite cloud posture",
    toolId: "scoutsuite",
    toolLicense: "GPL-2.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "trufflehog.repo_secrets",
    requiredScopeTypes: ["Repository"] as const,
    targetKind: "repositoryPath" as const,
    title: "TruffleHog secrets",
    toolId: "trufflehog",
    toolLicense: "AGPL-3.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "hadolint.dockerfile",
    requiredScopeTypes: ["Repository"] as const,
    targetKind: "repositoryPath" as const,
    title: "Hadolint Dockerfile",
    toolId: "hadolint",
    toolLicense: "GPL-3.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "sslscan.tls_probe",
    requiredScopeTypes: ["Domain", "Subdomain"] as const,
    targetKind: "hostname" as const,
    title: "sslscan TLS probe",
    toolId: "sslscan",
    toolLicense: "GPL-3.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly" as const,
    executionMode: "InternalRunner" as const,
    moduleId: "lynis.host_audit",
    requiredScopeTypes: ["InternalNetwork"] as const,
    targetKind: "hostname" as const,
    title: "Lynis host audit",
    toolId: "lynis",
    toolLicense: "GPL-3.0"
  },
  {
    defaultSafetyLevel: "ActiveNonInvasive" as const,
    executionMode: "InternalRunner" as const,
    moduleId: "rustscan.port_inventory",
    requiredScopeTypes: ["IPRange", "InternalNetwork"] as const,
    targetKind: "hostname" as const,
    title: "RustScan port inventory",
    toolId: "rustscan",
    toolLicense: "GPL-3.0"
  },
  {
    defaultSafetyLevel: "PassiveReadOnly" as const,
    executionMode: "ControlPlane" as const,
    moduleId: "cve_bin_tool.binary_cves",
    requiredScopeTypes: ["Repository"] as const,
    targetKind: "repositoryPath" as const,
    title: "CVE Binary Tool",
    toolId: "cve-bin-tool",
    toolLicense: "GPL-3.0"
  }
] as const satisfies readonly CommunityValidationSuiteEntry[];

export const COPYLEFT_OPT_IN_TOOL_IDS = [
  ...new Set(COPYLEFT_OPT_IN_SUITE.map((entry) => entry.toolId))
];

export const COPYLEFT_OPT_IN_MODULE_IDS = COPYLEFT_OPT_IN_SUITE.map(
  (entry) => entry.moduleId
);

export const COPYLEFT_OPT_IN_VALUE_LINE =
  "Copyleft engines (GPL/LGPL) are not in the Community start set and are not redistributed by Periscan. You accept each SPDX, then Engine Lab downloads the official pin. After accept + install + enable they may run on verified scope. sqlmap/SharpHound/Atomic/Caldera/Metasploit stay blocked.";

export function isCopyleftOptInToolId(toolId: string): boolean {
  return (COPYLEFT_OPT_IN_TOOL_IDS as readonly string[]).includes(toolId);
}

export function isCopyleftOptInModuleId(moduleId: string): boolean {
  return (COPYLEFT_OPT_IN_MODULE_IDS as readonly string[]).includes(moduleId);
}

export function listCopyleftOptInSuiteForScopeType(
  scopeType: string
): CommunityValidationSuiteEntry[] {
  return COPYLEFT_OPT_IN_SUITE.filter((entry) =>
    (entry.requiredScopeTypes as readonly string[]).includes(scopeType)
  );
}

export const UPSTREAM_LICENSE_ACCEPTED_TOOL_IDS_KEY =
  "upstreamLicenseAcceptedToolIds" as const;

export function listUpstreamLicenseAcceptedToolIds(
  target: Record<string, unknown> | null | undefined
): string[] {
  const raw = target?.[UPSTREAM_LICENSE_ACCEPTED_TOOL_IDS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string");
}

export function targetHasUpstreamLicense(
  target: Record<string, unknown> | null | undefined,
  toolId: string
): boolean {
  return listUpstreamLicenseAcceptedToolIds(target).includes(toolId);
}

export const EngineLabHonestyClassSchema = z.enum([
  "community",
  "legal_review",
  "theater",
  "catalog"
]);

export type EngineLabHonestyClass = z.infer<typeof EngineLabHonestyClassSchema>;

export type EngineLabHonesty = {
  class: EngineLabHonestyClass;
  communityStartable: boolean;
  hint: string;
  label: string;
  legalReview: boolean;
  secondMission: boolean;
};

export function isCommunityValidationModuleId(moduleId: string): boolean {
  return (COMMUNITY_VALIDATION_MODULE_IDS as readonly string[]).includes(
    moduleId
  );
}

/** First-run / activation CTA while Community has not yet produced evidence. */
export const COMMUNITY_FIRST_RUN_START_LABEL = "Run Community validation";
export const COMMUNITY_FIRST_RUN_WATCH_LABEL = "Watch Community validation";
export const COMMUNITY_FIRST_RUN_REVIEW_LABEL = "Review failed Community run";
export const COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL = "Review Community run";

export const COMMUNITY_NUCLEI_DENIED_SKIP_REASON =
  "Nuclei External PoA was denied (kill switch, rate, or hostname guard). The rest of the Community pack still queued.";

const COMMUNITY_ACTIVATION_REVIEW_STATUSES = new Set([
  "Completed",
  "DeniedByPolicy",
  "Cancelled",
  "RequiresApproval"
]);

export type CommunityActivationRun = {
  errorSummary?: string | null;
  missionId: string;
  moduleId: string;
  status: string;
};

/**
 * Latest Community-relevant run, detected only via moduleId.
 * Callers must pass runs already ordered newest-first.
 */
export function latestCommunityActivationRun<T extends CommunityActivationRun>(
  runs: readonly T[]
): T | null {
  return (
    runs.find((run) => isCommunityValidationModuleId(run.moduleId)) ?? null
  );
}

/**
 * Honest next action after Community start and before a measured evidence run.
 * Does not mark MeasuredResult complete.
 */
export function resolveCommunityActivationNextAction(
  run: Pick<
    CommunityActivationRun,
    "errorSummary" | "missionId" | "status"
  > | null
): {
  href: string;
  label: string;
  reason: string;
} {
  if (run && (run.status === "Queued" || run.status === "Running")) {
    return {
      href: `/missions/${run.missionId}`,
      label: COMMUNITY_FIRST_RUN_WATCH_LABEL,
      reason:
        "Community validation is already in flight. Watch the mission until it captures evidence."
    };
  }
  if (run && run.status === "Failed") {
    return {
      href: `/missions/${run.missionId}`,
      label: COMMUNITY_FIRST_RUN_REVIEW_LABEL,
      reason:
        run.errorSummary ??
        "The latest Community validation run failed before it produced measured evidence."
    };
  }
  if (run && COMMUNITY_ACTIVATION_REVIEW_STATUSES.has(run.status)) {
    return {
      href: `/missions/${run.missionId}`,
      label: COMMUNITY_FIRST_RUN_REVIEW_EMPTY_LABEL,
      reason:
        run.errorSummary ??
        "The latest Community run finished without measured evidence. Review it before starting another pack."
    };
  }
  return {
    href: "/missions",
    label: COMMUNITY_FIRST_RUN_START_LABEL,
    reason:
      "Community edition starts live OSS/first-party engines on verified scope."
  };
}

export function communityValidationSuiteEntry(
  moduleId: string
): CommunityValidationSuiteEntry | undefined {
  return COMMUNITY_VALIDATION_SUITE.find(
    (entry) => entry.moduleId === moduleId
  );
}

export type CommunityMissionRunInput = {
  errorSummary?: string | null;
  moduleId: string;
  status: string;
};

export type CommunityMissionRunEngine = {
  errorSummary: string | null;
  moduleId: string;
  secondMission: boolean;
  status: string;
  title: string;
};

export type CommunityMissionRunSummary = {
  engines: CommunityMissionRunEngine[];
  failedErrors: string[];
  hasCommunityPack: boolean;
  mixed: boolean;
  valueLine: string | null;
};

/**
 * Detect Community pack membership from live mission run moduleIds.
 * Mixed means Community and non-Community engines share the same mission.
 */
export function summarizeCommunityMissionRuns(
  runs: readonly CommunityMissionRunInput[]
): CommunityMissionRunSummary {
  const communityRuns = runs.filter((run) =>
    isCommunityValidationModuleId(run.moduleId)
  );
  const hasCommunityPack = communityRuns.length > 0;
  const mixed = hasCommunityPack && communityRuns.length !== runs.length;
  const engines = communityRuns.map((run) => {
    const entry = communityValidationSuiteEntry(run.moduleId);
    return {
      errorSummary: run.errorSummary ?? null,
      moduleId: run.moduleId,
      secondMission: entry?.executionMode === "ExternalPoA",
      status: run.status,
      title: entry?.title ?? run.moduleId
    };
  });
  const failedErrors = engines
    .filter((engine) => engine.status === "Failed")
    .map((engine) => engine.errorSummary ?? "No error summary recorded.");

  return {
    engines,
    failedErrors,
    hasCommunityPack,
    mixed,
    valueLine: hasCommunityPack ? COMMUNITY_EDITION_VALUE_LINE : null
  };
}

export function isCommunityValidationToolId(toolId: string): boolean {
  return (COMMUNITY_VALIDATION_TOOL_IDS as readonly string[]).includes(toolId);
}

export function isEngineLabTheaterToolId(toolId: string): boolean {
  return (ENGINE_LAB_THEATER_TOOL_IDS as readonly string[]).includes(toolId);
}

export function isEngineLabTheaterModuleId(moduleId: string): boolean {
  return (ENGINE_LAB_THEATER_MODULE_IDS as readonly string[]).includes(
    moduleId
  );
}

export function classifyEngineLabHonesty(input: {
  governanceStatus?: string | null;
  moduleIds?: readonly string[] | null;
  policyStatus?: string | null;
  toolId: string;
}): EngineLabHonesty {
  const moduleIds = input.moduleIds ?? [];
  const communityStartable =
    isCommunityValidationToolId(input.toolId) ||
    moduleIds.some((moduleId) => isCommunityValidationModuleId(moduleId));
  const theater =
    isEngineLabTheaterToolId(input.toolId) ||
    moduleIds.some((moduleId) => isEngineLabTheaterModuleId(moduleId));
  const legalReview =
    input.policyStatus === "RequiresLegalReview" ||
    input.governanceStatus === "LegalReviewRequired";
  const secondMission = COMMUNITY_VALIDATION_SUITE.some(
    (entry) =>
      entry.toolId === input.toolId && entry.executionMode === "ExternalPoA"
  );

  const honestyClass: EngineLabHonestyClass = communityStartable
    ? "community"
    : theater
      ? "theater"
      : legalReview
        ? "legal_review"
        : "catalog";

  const label =
    honestyClass === "community"
      ? "Community"
      : honestyClass === "legal_review"
        ? "Legal review"
        : honestyClass === "theater"
          ? "Catalog only"
          : "Catalog";

  const hint =
    honestyClass === "community"
      ? secondMission
        ? "Community — second mission"
        : "Starts from Validate"
      : honestyClass === "legal_review"
        ? "Not Community"
        : honestyClass === "theater"
          ? "Not Community validation"
          : "Not in the Community pack";

  return {
    class: honestyClass,
    communityStartable,
    hint,
    label,
    legalReview,
    secondMission
  };
}

export function listCommunityValidationSuiteForScopeType(
  scopeType: string
): CommunityValidationSuiteEntry[] {
  return COMMUNITY_VALIDATION_SUITE.filter((entry) =>
    (entry.requiredScopeTypes as readonly string[]).includes(scopeType)
  );
}

export function communityValidationStartLane(
  entry: CommunityValidationSuiteEntry
): "worker" | "runner" | "externalPoa" | "cloud" {
  if (entry.moduleId.startsWith("prowler.")) {
    return "cloud";
  }
  if (entry.executionMode === "ExternalPoA") {
    return "externalPoa";
  }
  if (entry.executionMode === "InternalRunner") {
    return "runner";
  }
  return "worker";
}

/**
 * Modules that should share one startMission call. ExternalPoA (Nuclei) is
 * started as a second mission so a PoA kill-switch cannot deny the worker pack.
 */
export function listCommunityValidationStartModules(input: {
  cloudAwsAvailable?: boolean;
  includeExternalPoa?: boolean;
  runnerAvailable?: boolean;
  scopeType: string;
}): CommunityValidationSuiteEntry[] {
  return listCommunityValidationSuiteForScopeType(input.scopeType).filter(
    (entry) => {
      const lane = communityValidationStartLane(entry);
      if (lane === "externalPoa") {
        return input.includeExternalPoa === true;
      }
      if (lane === "runner") {
        return input.runnerAvailable === true;
      }
      if (lane === "cloud") {
        return input.cloudAwsAvailable === true;
      }
      return true;
    }
  );
}

/** Honest reason when CloudAccount Prowler cannot start yet. */
export const COMMUNITY_PROWLER_AWS_CONNECT_REASON =
  "Connect an AWS integration to start Prowler.";

/**
 * Prowler starts only from a Connected CloudAccount AWS integration.
 * Vendor/product must mention AWS (existing contract) and the product must
 * be the account connector (`AWS`), not AWS WAF / Bedrock / ECR.
 */
export function isConnectedAwsIntegrationForProwler(integration: {
  product: string;
  status: string;
  vendor: string;
}): boolean {
  if (integration.status !== "Connected") {
    return false;
  }
  const vendor = integration.vendor.trim().toLowerCase();
  const product = integration.product.trim().toLowerCase();
  const mentionsAws = vendor.includes("aws") || product.includes("aws");
  return mentionsAws && product === "aws";
}

export function selectConnectedAwsIntegrationForProwler<
  T extends { product: string; status: string; vendor: string }
>(integrations: readonly T[]): T | null {
  return integrations.find(isConnectedAwsIntegrationForProwler) ?? null;
}

export function listCommunityValidationDeferredModules(input: {
  cloudAwsAvailable?: boolean;
  runnerAvailable?: boolean;
  scopeType: string;
}): Array<{ moduleId: string; reason: string; title: string }> {
  return listCommunityValidationSuiteForScopeType(input.scopeType)
    .map((entry) => {
      const lane = communityValidationStartLane(entry);
      if (lane === "runner" && input.runnerAvailable !== true) {
        return {
          moduleId: entry.moduleId,
          reason: "Enroll an internal runner to start this engine.",
          title: entry.title
        };
      }
      if (lane === "cloud" && input.cloudAwsAvailable !== true) {
        return {
          moduleId: entry.moduleId,
          reason: COMMUNITY_PROWLER_AWS_CONNECT_REASON,
          title: entry.title
        };
      }
      if (lane === "externalPoa") {
        return {
          moduleId: entry.moduleId,
          reason:
            "Started as a second mission so a PoA deny cannot block the rest of the pack.",
          title: entry.title
        };
      }
      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export function communityValidationSafetyLevel(
  entries: readonly CommunityValidationSuiteEntry[]
): "PassiveReadOnly" | "ActiveNonInvasive" {
  return entries.some(
    (entry) => entry.defaultSafetyLevel === "ActiveNonInvasive"
  )
    ? "ActiveNonInvasive"
    : "PassiveReadOnly";
}

const SAFE_COMMUNITY_REQUESTED_ACTION = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
} as const;

export const CommunityPolicyPreviewRequestSchema = z.object({
  executionEnvironment: z.enum(["ControlPlane", "InternalRunner"]),
  requestedAction: PolicyRequestedActionSchema,
  safetyLevel: z.enum(["PassiveReadOnly", "ActiveNonInvasive"])
});

export type CommunityPolicyPreviewRequest = z.infer<
  typeof CommunityPolicyPreviewRequestSchema
>;

/**
 * Environment the selected Community start set actually needs. Runner-lane
 * modules require InternalRunner; worker/cloud stay ControlPlane. ExternalPoA
 * Nuclei is never part of this primary set.
 */
export function communityStartSetExecutionEnvironment(
  entries: readonly CommunityValidationSuiteEntry[]
): "ControlPlane" | "InternalRunner" {
  return entries.some(
    (entry) => communityValidationStartLane(entry) === "runner"
  )
    ? "InternalRunner"
    : "ControlPlane";
}

/**
 * Primary Validate policy preview for the engines that will start — never
 * ExternalPoA, even when includeExternalPoa is true (Nuclei is a second
 * mission).
 */
export function communityPolicyPreviewRequest(input: {
  cloudAwsAvailable?: boolean;
  includeExternalPoa?: boolean;
  runnerAvailable?: boolean;
  scopeType: string;
}): CommunityPolicyPreviewRequest {
  const entries = listCommunityValidationStartModules({
    cloudAwsAvailable: input.cloudAwsAvailable,
    includeExternalPoa: false,
    runnerAvailable: input.runnerAvailable,
    scopeType: input.scopeType
  });
  const executionEnvironment = communityStartSetExecutionEnvironment(entries);
  const requestedAction: PolicyRequestedAction = {
    ...SAFE_COMMUNITY_REQUESTED_ACTION,
    requiresInternalRunner: executionEnvironment === "InternalRunner"
  };
  return {
    executionEnvironment,
    requestedAction,
    safetyLevel: communityValidationSafetyLevel(entries)
  };
}

/**
 * ControlPlane cannot start InternalRunner modules. InternalRunner can cover
 * a worker-only set. ExternalPoA never covers the primary start set.
 */
export function communityPolicyCoversStartSet(
  executionEnvironment: string,
  entries: readonly CommunityValidationSuiteEntry[]
): boolean {
  const required = communityStartSetExecutionEnvironment(entries);
  if (required === "InternalRunner") {
    return executionEnvironment === "InternalRunner";
  }
  return (
    executionEnvironment === "ControlPlane" ||
    executionEnvironment === "InternalRunner"
  );
}

function stripUrlToHostname(value: string): string {
  const trimmed = value.trim();
  const withoutScheme = trimmed.includes("://")
    ? trimmed.slice(trimmed.indexOf("://") + 3)
    : trimmed;
  const host = withoutScheme.replace(/\/+$/u, "").split("/")[0] ?? trimmed;
  return host.split(":")[0] ?? host;
}

export function buildCommunityValidationTarget(input: {
  awsIntegrationId?: string;
  entries: readonly CommunityValidationSuiteEntry[];
  scopeType: string;
  scopeValue: string;
}): Record<string, unknown> {
  if (input.scopeType === "CloudAccount") {
    const target: Record<string, unknown> = {
      awsAccountId: input.scopeValue.trim()
    };
    if (input.awsIntegrationId) {
      target.awsIntegrationId = input.awsIntegrationId;
    }
    return target;
  }

  const hostname = stripUrlToHostname(input.scopeValue);
  const needsUrl = input.entries.some((entry) => entry.targetKind === "url");
  const needsRepo = input.entries.some(
    (entry) => entry.targetKind === "repositoryPath"
  );

  if (needsRepo || input.scopeType === "Repository") {
    const repositoryPath = input.scopeValue.trim();
    const segments = repositoryPath.split("/").filter(Boolean);
    const target: Record<string, unknown> = {
      repositoryName: segments.at(-1) ?? repositoryPath,
      repositoryPath
    };
    if (input.awsIntegrationId) {
      target.awsIntegrationId = input.awsIntegrationId;
    }
    return target;
  }

  const target: Record<string, unknown> = {
    domain: hostname,
    host: hostname,
    hostname,
    port: 443,
    protocol: "https",
    targetHost: hostname,
    targets: input.scopeValue.trim(),
    templateProfile: "safe-baseline"
  };
  if (needsUrl) {
    target.url = `https://${hostname}`;
  }
  if (input.scopeType === "IPRange" || input.scopeType === "InternalNetwork") {
    target.cidr = input.scopeValue.trim();
    target.targets = input.scopeValue.trim();
  }
  if (input.awsIntegrationId) {
    target.awsIntegrationId = input.awsIntegrationId;
  }
  return target;
}

export function communityEditionExcludesOffensivePacks(): boolean {
  const offensive = [
    "atomic.control_validation_safe",
    "caldera.advanced_adversarial",
    "exploit.metasploit_check",
    "identity.cred_spray",
    "web.sqli_probe"
  ];
  return offensive.every(
    (moduleId) => !isCommunityValidationModuleId(moduleId)
  );
}

export function listCommunityRunnerLaneEntries(): CommunityValidationSuiteEntry[] {
  return COMMUNITY_VALIDATION_SUITE.filter(
    (entry) => communityValidationStartLane(entry) === "runner"
  );
}

export function communitySuiteUsesRunnerOssAllowlist(): boolean {
  return listCommunityRunnerLaneEntries().every((entry) =>
    isRunnerDispatchableModuleId(entry.moduleId)
  );
}

export const CommunityScopeVerificationKindSchema = z.enum([
  "dns_txt",
  "repository_token_file",
  "aws_integration",
  "operator_attestation",
  "unsupported"
]);

export type CommunityScopeVerificationKind = z.infer<
  typeof CommunityScopeVerificationKindSchema
>;

export function communityScopeVerificationKind(
  scopeType: string
): CommunityScopeVerificationKind {
  if (scopeType === "Domain" || scopeType === "Subdomain") {
    return "dns_txt";
  }
  if (scopeType === "Repository") {
    return "repository_token_file";
  }
  if (scopeType === "CloudAccount") {
    return "aws_integration";
  }
  if (scopeType === "IPRange" || scopeType === "InternalNetwork") {
    return "operator_attestation";
  }
  return "unsupported";
}

export function communityScopeAuthorizationHint(scopeType: string): string {
  switch (communityScopeVerificationKind(scopeType)) {
    case "dns_txt":
      return "Publish the DNS TXT record shown on this scope, then verify.";
    case "repository_token_file":
      return `Write the verification token to ${COMMUNITY_REPOSITORY_AUTH_FILENAME} at the repository root the control plane can read, or have an Owner/Admin attest if the path lives only on a runner.`;
    case "aws_integration":
      return "Connect an AWS integration whose account id matches this scope, or have an Owner/Admin attest the account is authorized.";
    case "operator_attestation":
      return "An Owner or Admin must attest this CIDR or internal network is customer-authorized. The attestation is audited.";
    default:
      return "This scope type needs a connector-specific verification flow.";
  }
}

const IPV4_CIDR =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\/(?:3[0-2]|[12]?\d)$/u;
const IPV6_CIDR = /^[0-9a-f:]+\/(?:12[0-8]|1[01]\d|\d{1,2})$/iu;

export function extractAwsAccountId(value: string): string | null {
  const trimmed = value.trim();
  const direct = trimmed.match(/^(\d{12})$/u);
  if (direct) {
    return direct[1] ?? null;
  }
  const arn = trimmed.match(/arn:aws:[^:]*:[^:]*:(\d{12}):/u);
  if (arn) {
    return arn[1] ?? null;
  }
  const labeled = trimmed.match(/account[:\s_-]*(\d{12})/iu);
  if (labeled) {
    return labeled[1] ?? null;
  }
  return null;
}

/**
 * Best-effort paste classifier for Community scope add. Returns null when the
 * value is ambiguous — the operator must pick a type.
 */
export function inferCommunityScopeType(
  value: string
): "Domain" | "IPRange" | "CloudAccount" | "Repository" | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (IPV4_CIDR.test(trimmed) || IPV6_CIDR.test(trimmed)) {
    return "IPRange";
  }
  if (extractAwsAccountId(trimmed)) {
    return "CloudAccount";
  }
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("~/") ||
    trimmed.endsWith(".git") ||
    /^[A-Za-z]:[\\/]/u.test(trimmed)
  ) {
    return "Repository";
  }
  const withoutScheme = trimmed.includes("://")
    ? trimmed.slice(trimmed.indexOf("://") + 3)
    : trimmed;
  const host = withoutScheme.split("/")[0]?.split(":")[0] ?? "";
  if (
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu.test(
      host
    )
  ) {
    return "Domain";
  }
  return null;
}

export function defaultAssetClassForCommunityScope(
  scopeType: string
): "Code" | "Cloud" | "Network" | "BusinessApplication" | "Other" {
  if (scopeType === "Repository") {
    return "Code";
  }
  if (scopeType === "CloudAccount") {
    return "Cloud";
  }
  if (scopeType === "IPRange" || scopeType === "InternalNetwork") {
    return "Network";
  }
  if (scopeType === "Domain" || scopeType === "Subdomain") {
    return "BusinessApplication";
  }
  return "Other";
}

export const CommunityValidationDeferredModuleSchema = z.object({
  moduleId: z.string().min(1),
  reason: z.string().min(1),
  title: z.string().min(1)
});

export const CommunityValidationSuiteResponseSchema = z.object({
  cloudAwsAvailable: z.boolean(),
  copyleftOptIn: z
    .object({
      hint: z.string().min(1),
      licensedToolIds: z.array(z.string().min(1)),
      modules: z.array(CommunityValidationSuiteEntrySchema)
    })
    .default({
      hint: COPYLEFT_OPT_IN_VALUE_LINE,
      licensedToolIds: [],
      modules: []
    }),
  deferredModules: z.array(CommunityValidationDeferredModuleSchema),
  editionId: z.literal(COMMUNITY_EDITION_ID),
  includeExternalPoa: z.boolean(),
  licenseNote: z.string().min(1),
  modules: z.array(CommunityValidationSuiteEntrySchema),
  runnerAvailable: z.boolean(),
  scopeType: ScopeTypeSchema.nullable(),
  startableModuleIds: z.array(z.string().min(1)),
  valueLine: z.string().min(1)
});

export const StartCommunityValidationRequestSchema = z.object({
  includeCopyleftOptIn: z.boolean().optional(),
  includeExternalPoa: z.boolean().optional(),
  moduleIds: z.array(z.string().min(1)).optional(),
  policyDecisionId: z.string().uuid(),
  runnerId: z.string().min(1).optional(),
  scopeId: z.string().uuid()
});

export const CommunityValidationStartResultSchema =
  MissionStartResultSchema.extend({
    editionId: z.literal(COMMUNITY_EDITION_ID),
    moduleIds: z.array(z.string().min(1)),
    nucleiMissionId: z.string().uuid().nullable(),
    nucleiSkipReason: z.string().min(1).nullable(),
    scopeType: ScopeTypeSchema,
    target: z.record(z.string(), z.unknown())
  });

/**
 * Reconstructed Nuclei sibling for a Community primary. Skip reason comes
 * from the persisted Nuclei run errorSummary when the second mission was
 * denied or failed to start.
 */
export const CommunityValidationCompanionSchema = z.object({
  nucleiMissionId: z.string().uuid().nullable(),
  nucleiSkipReason: z.string().min(1).nullable()
});

export const CommunityMissionRemediationsResultSchema = z.object({
  createdCount: z.number().int().nonnegative(),
  missionId: z.string().uuid(),
  remediationIds: z.array(z.string().uuid())
});

export type CommunityMissionRemediationsResult = z.infer<
  typeof CommunityMissionRemediationsResultSchema
>;

export type CommunityNucleiCompanionCandidate = {
  createdAt: Date | string;
  missionId: string;
};

function communityCompanionTimestampMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

/**
 * Pick the Nuclei second mission for a Community primary: same-window or any
 * later sibling, never the primary itself, never an older unrelated start.
 */
export function selectCommunityNucleiCompanionMissionId(input: {
  candidates: readonly CommunityNucleiCompanionCandidate[];
  primaryCreatedAt: Date | string;
  primaryMissionId: string;
}): string | null {
  const primaryTime = communityCompanionTimestampMs(input.primaryCreatedAt);
  if (!Number.isFinite(primaryTime)) {
    return null;
  }

  const windowStart = primaryTime - COMMUNITY_NUCLEI_SIBLING_WINDOW_MS;
  const eligible = input.candidates.filter((candidate) => {
    if (candidate.missionId === input.primaryMissionId) {
      return false;
    }
    const createdAt = communityCompanionTimestampMs(candidate.createdAt);
    return Number.isFinite(createdAt) && createdAt >= windowStart;
  });
  if (eligible.length === 0) {
    return null;
  }

  const later = eligible.filter(
    (candidate) =>
      communityCompanionTimestampMs(candidate.createdAt) >= primaryTime
  );
  const pool = later.length > 0 ? later : eligible;
  const ranked = [...pool].sort((left, right) => {
    const leftDelta = Math.abs(
      communityCompanionTimestampMs(left.createdAt) - primaryTime
    );
    const rightDelta = Math.abs(
      communityCompanionTimestampMs(right.createdAt) - primaryTime
    );
    if (leftDelta !== rightDelta) {
      return leftDelta - rightDelta;
    }
    return left.missionId.localeCompare(right.missionId);
  });

  return ranked[0]?.missionId ?? null;
}

export type CommunityValidationSuiteResponse = z.infer<
  typeof CommunityValidationSuiteResponseSchema
>;
export type StartCommunityValidationRequest = z.infer<
  typeof StartCommunityValidationRequestSchema
>;
export type CommunityValidationStartResult = z.infer<
  typeof CommunityValidationStartResultSchema
>;
export type CommunityValidationCompanion = z.infer<
  typeof CommunityValidationCompanionSchema
>;

/**
 * Explicit schedule-config opt-in. ValidationSnapshot fires still compose a
 * snapshot report unless this is the boolean `true`. Other mission types
 * ignore the key so ContinuousValidation / execution schedules stay put.
 */
export const COMMUNITY_VALIDATION_SCHEDULE_FLAG =
  "communityValidation" as const;

export function scheduleRequestsCommunityValidation(
  missionType: string | undefined,
  config: unknown
): boolean {
  if (missionType !== "ValidationSnapshot") {
    return false;
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }
  return (
    (config as Record<string, unknown>)[COMMUNITY_VALIDATION_SCHEDULE_FLAG] ===
    true
  );
}
