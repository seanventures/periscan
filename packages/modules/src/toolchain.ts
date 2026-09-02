import path from "node:path";
import { access } from "node:fs/promises";

import {
  OpenSourceCapabilitySchema,
  OpenSourceToolCatalogEntrySchema,
  OpenSourceToolDefinitionSchema,
  OpenSourceToolRuntimeSchema,
  type OpenSourceCapability,
  type OpenSourceExecutionReadiness,
  type OpenSourceToolDefinition,
  type OpenSourceToolId,
  type OpenSourceToolRuntime
} from "@periscan/shared";
import { z } from "zod";

import {
  COMMUNITY_POPULAR_OSS_CAPABILITIES,
  COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS
} from "./community-popular-oss-catalog.js";
import {
  SECURITY_CATALOG_EXPANSION_CAPABILITIES,
  SECURITY_CATALOG_EXPANSION_TOOL_DEFINITIONS
} from "./security-catalog-expansion.js";

export const ToolRuntimeResolutionSchema = z.object({
  available: z.boolean(),
  command: z.string().min(1).nullish(),
  displayCommand: z.string().min(1),
  imageRef: z.string().min(1).nullish(),
  reason: z.string().min(1).nullish(),
  runtime: OpenSourceToolRuntimeSchema.nullish(),
  tool: OpenSourceToolDefinitionSchema,
  version: z.string().min(1)
});

export type ToolRuntimeResolution = z.infer<typeof ToolRuntimeResolutionSchema>;

const OPEN_SOURCE_TOOL_DEFINITIONS = [
  {
    binaryName: "gitleaks",
    category: "Secrets",
    defaultVersion: "v8.30.0",
    displayName: "Gitleaks",
    dockerImage: "ghcr.io/gitleaks/gitleaks",
    docsUrl: "https://github.com/gitleaks/gitleaks",
    gitRepo: "https://github.com/gitleaks/gitleaks.git",
    license: "MIT",
    moduleIds: ["gitleaks.repo_secrets"],
    notes:
      "Current repository secret scanning engine. Prefer pinned Docker or a local binary.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "gitleaks"
  },
  {
    binaryName: "nuclei",
    category: "ExternalExposure",
    defaultVersion: "v3.8.0",
    displayName: "Nuclei",
    dockerImage: "projectdiscovery/nuclei",
    docsUrl: "https://docs.projectdiscovery.io/opensource/nuclei/install",
    gitRepo: "https://github.com/projectdiscovery/nuclei.git",
    license: "MIT",
    moduleIds: ["nuclei.external_exposure_safe"],
    notes:
      "Safe external exposure engine. Must run only against verified scope and safe template profiles.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "nuclei"
  },
  {
    binaryName: null,
    category: "ContentPack",
    defaultVersion: "v10.4.4",
    displayName: "Nuclei Templates",
    dockerImage: null,
    docsUrl: "https://github.com/projectdiscovery/nuclei-templates/releases",
    gitRepo: "https://github.com/projectdiscovery/nuclei-templates.git",
    license: "MIT",
    moduleIds: ["nuclei.external_exposure_safe"],
    notes:
      "Template pack for Nuclei. Periscan should allowlist only safe, non-destructive templates.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git"],
    toolId: "nuclei-templates"
  },
  {
    binaryName: "trivy",
    category: "Dependency",
    defaultVersion: "0.70.0",
    displayName: "Trivy",
    dockerImage: "ghcr.io/aquasecurity/trivy",
    docsUrl: "https://trivy.dev/dev/getting-started/installation/",
    gitRepo: "https://github.com/aquasecurity/trivy.git",
    license: "Apache-2.0",
    moduleIds: [
      "trivy.repo_dependency_scan",
      "trivy.container_scan",
      "trivy.repo_misconfig"
    ],
    notes:
      "Dependency, image, IaC, and secret scanning engine. Pin explicit versions due recent supply-chain events.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "trivy"
  },
  {
    binaryName: "osv-scanner",
    category: "Dependency",
    defaultVersion: "v2.3.0",
    displayName: "OSV-Scanner",
    dockerImage: "ghcr.io/google/osv-scanner",
    docsUrl: "https://google.github.io/osv-scanner/",
    gitRepo: "https://github.com/google/osv-scanner.git",
    license: "Apache-2.0",
    moduleIds: ["osv.repo_dependency_scan"],
    notes:
      "Optional dependency advisory cross-check for repo scanning. Runtime is optional and fixture-backed tests cover normalization.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "osv-scanner"
  },
  {
    binaryName: "grype",
    category: "Dependency",
    defaultVersion: "v0.74.0",
    displayName: "Grype",
    dockerImage: "anchore/grype",
    docsUrl: "https://github.com/anchore/grype",
    gitRepo: "https://github.com/anchore/grype.git",
    license: "Apache-2.0",
    moduleIds: [
      "grype.repo_vulnerability_scan",
      "grype.cve_scan",
      "grype.exploit_template"
    ],
    notes:
      "Live PassiveReadOnly scanner is grype.repo_vulnerability_scan. Catalog sims grype.cve_scan / grype.exploit_template stay non-executable (P05-12).",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "grype"
  },
  {
    binaryName: "syft",
    category: "SupplyChain",
    defaultVersion: "v1.46.0",
    displayName: "Syft",
    dockerImage: "anchore/syft",
    docsUrl: "https://github.com/anchore/syft",
    gitRepo: "https://github.com/anchore/syft.git",
    license: "Apache-2.0",
    moduleIds: ["syft.sbom_generate"],
    notes:
      "Generates CycloneDX software bills of materials from authorized repository filesystems. The runner stages a filtered source archive through the Docker API, mounts it read-only, disables network access, and stores normalized package inventory plus the SBOM digest rather than raw tool output.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "syft"
  },
  {
    binaryName: "cosign",
    category: "SupplyChain",
    defaultVersion: "v3.0.6",
    displayName: "Sigstore Cosign",
    dockerImage: "ghcr.io/sigstore/cosign/cosign",
    docsUrl: "https://docs.sigstore.dev/cosign/verifying/verify-blob/",
    gitRepo: "https://github.com/sigstore/cosign.git",
    license: "Apache-2.0",
    moduleIds: ["sigstore.cosign_verify_blob"],
    notes:
      "Verifies a local artifact against a Sigstore bundle and an explicitly trusted public key. The current profile is offline, read-only, and pinned after the 2026 verification advisories.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "cosign"
  },
  {
    binaryName: "semgrep",
    category: "WebAppScan",
    defaultVersion: "1.45.0",
    displayName: "Semgrep",
    dockerImage: "semgrep/semgrep",
    docsUrl: "https://semgrep.dev/docs/",
    gitRepo: "https://github.com/semgrep/semgrep.git",
    license: "LGPL-2.1",
    licenseUrl: "https://github.com/semgrep/semgrep/blob/develop/LICENSE",
    moduleIds: [
      "semgrep.code_exploit_scan",
      "semgrep.web_api_exploit",
      "semgrep.repo_sast"
    ],
    notes:
      "LGPL SAST. Not redistributed by Periscan. Tenant accepts SPDX in Engine Lab, then we download the official pin. Live repo scan is semgrep.repo_sast after accept+install+enable.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["docker", "binary"],
    toolId: "semgrep",
    userLicenseAcceptanceRequired: true,
    upstreamLicenseUrl: "https://github.com/semgrep/semgrep/blob/develop/LICENSE"
  },
  {
    binaryName: "proxmark3",
    category: "Physical",
    defaultVersion: "latest",
    displayName: "Proxmark3",
    dockerImage: null,
    docsUrl: "https://github.com/RfidResearchGroup/proxmark3",
    gitRepo: "https://github.com/RfidResearchGroup/proxmark3.git",
    license: "GPL-2.0",
    moduleIds: ["physical.rfid_sim", "physical.access_proxy_sim"],
    notes:
      "RFID/NFC hardware tool for physical access proxy simulation. Periscan uses only safe simulated data/fixtures from OSS repo for physical proxy in kill-chains (no real hardware execution). For multi-modal supply/physical sims.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["git"],
    toolId: "proxmark3"
  },
  {
    binaryName: "hackrf",
    category: "Physical",
    defaultVersion: "2023.01.1",
    displayName: "HackRF",
    dockerImage: null,
    docsUrl: "https://github.com/greatscottgadgets/hackrf",
    gitRepo: "https://github.com/greatscottgadgets/hackrf.git",
    license: "GPL-2.0",
    moduleIds: ["physical.rf_sim"],
    notes:
      "SDR tool for RF/physical simulation data. Safe sim packs only for physical access proxy steps.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["git"],
    toolId: "hackrf"
  },
  {
    binaryName: "ansible",
    category: "IaC",
    defaultVersion: "2.16",
    displayName: "Ansible",
    dockerImage: "ansible/ansible-runner",
    docsUrl: "https://docs.ansible.com/",
    gitRepo: "https://github.com/ansible/ansible.git",
    license: "GPL-3.0",
    moduleIds: ["iac.ansible.playbook_sim", "iac.ansible.onprem_deploy_sim"],
    notes:
      "Ansible for on-prem / air-gapped deployment simulation and IaC playbooks in RemOps. Periscan uses only safe simulated/fixture playbooks (dry-run, no real execution). Supports zero-touch on-prem/MCP notes and air-gapped runner profiles.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["docker", "binary"],
    toolId: "ansible"
  },
  {
    binaryName: "terraform",
    category: "IaC",
    defaultVersion: "1.9",
    displayName: "Terraform",
    dockerImage: "hashicorp/terraform",
    docsUrl: "https://developer.hashicorp.com/terraform",
    gitRepo: "https://github.com/hashicorp/terraform.git",
    license: "MPL-2.0",
    moduleIds: ["iac.terraform.plan_sim", "iac.terraform.onprem_mcp_sim"],
    notes:
      "Terraform for IaC sims, on-prem/MCP deployment planning, and air-gapped provider mocks. Safe fixture mode only for RemOps prescriptive plans + one-click playbooks. Enhances zero-touch + on-prem options.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "terraform"
  },
  {
    binaryName: "ffmpeg",
    category: "ContentPack",
    defaultVersion: "6.1",
    displayName: "FFmpeg",
    dockerImage: "linuxserver/ffmpeg",
    docsUrl: "https://ffmpeg.org/",
    gitRepo: "https://git.ffmpeg.org/ffmpeg.git",
    license: "LGPL-2.1",
    moduleIds: ["reports.video.replay_export_sim", "reports.replay_video_pack"],
    notes:
      "FFmpeg for simulation replay video export from evidence/playwright runs (G5). Safe fixture only: generates metadata + simulated video artifact links. LGPL review noted; used for gamified training replays and NL campaign evidence.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["docker", "binary"],
    toolId: "ffmpeg"
  },
  {
    binaryName: null,
    category: "ContentPack",
    defaultVersion: "main",
    displayName: "CTF / Gamified Training Pack",
    dockerImage: null,
    docsUrl: "https://picoctf.org/ or https://overthewire.org/",
    gitRepo: null,
    license: "MIT",
    moduleIds: ["ctf.gamified_training_pack", "training.nl_campaign_sim"],
    notes:
      "CTF/OSS training data packs (picoCTF/overthewire style) as gamified Marketplace modules (G5). Safe simulated challenges for training mode, NL campaign builder. Ollama re-use for NL parsing of campaign prompts into packs.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git"],
    toolId: "ctf-pack"
  },
  {
    binaryName: null,
    category: "ContentPack",
    defaultVersion: "latest",
    displayName: "OpenAPI Generator",
    dockerImage: "openapitools/openapi-generator-cli",
    docsUrl: "https://openapi-generator.tech/",
    gitRepo: "https://github.com/OpenAPITools/openapi-generator.git",
    license: "Apache-2.0",
    moduleIds: [
      "integrations.openapi.sdk_gen_sim",
      "integrations.terraform.provider_scaffold"
    ],
    notes:
      "OpenAPI Generator for SDK generation (Go/Python/JS) from Periscan /openapi.json (G6). Safe sim/fixture mode only. Used in build scripts for full bi-di SDKs. Terraform re-use for Periscan provider scaffold.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "openapi-generator"
  },
  {
    binaryName: "prowler",
    category: "CloudPosture",
    defaultVersion: "5.28.1",
    displayName: "Prowler",
    dockerImage: "prowlercloud/prowler",
    docsUrl: "https://github.com/prowler-cloud/prowler",
    gitRepo: "https://github.com/prowler-cloud/prowler.git",
    license: "Apache-2.0",
    moduleIds: ["prowler.aws_posture"],
    notes:
      "Cloud posture engine for AWS and other providers. Current Periscan scope is read-only posture parsing.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "prowler"
  },
  {
    binaryName: null,
    category: "AIValidation",
    defaultVersion: "1.0.0.alpha2",
    displayName: "A2A Protocol TCK",
    dockerImage: null,
    docsUrl: "https://github.com/a2aproject/a2a-tck",
    gitRepo: "https://github.com/a2aproject/a2a-tck.git",
    license: "Apache-2.0",
    moduleIds: [],
    notes:
      "Official A2A protocol compatibility harness. Periscan pins the checkout, requires Python 3.11+ through uv, verified scope, tenant approval, and stores only normalized report evidence.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git"],
    toolId: "a2a-tck"
  },
  {
    binaryName: null,
    category: "AIValidation",
    defaultVersion: "0.121.6",
    displayName: "Promptfoo",
    dockerImage: "ghcr.io/promptfoo/promptfoo",
    docsUrl: "https://www.promptfoo.dev/docs/installation/",
    gitRepo: "https://github.com/promptfoo/promptfoo.git",
    license: "MIT",
    moduleIds: ["ai_app.safe_validation"],
    notes:
      "Primary AI app evaluation and red-team harness for safe, customer-scoped validation.",
    npmPackage: "promptfoo",
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["npx", "docker"],
    toolId: "promptfoo"
  },
  {
    binaryName: null,
    category: "AIValidation",
    defaultVersion: "0.13.0",
    displayName: "PyRIT",
    dockerImage: null,
    docsUrl:
      "https://microsoft.github.io/PyRIT/?OCID=InsideTrack_Product_10871",
    gitRepo: "https://github.com/microsoft/PyRIT.git",
    license: "MIT",
    moduleIds: ["ai_app.safe_validation"],
    notes:
      "Secondary AI red-team framework. Install with pip inside an isolated Python environment.",
    npmPackage: null,
    phase: "Current",
    pipPackage: "pyrit",
    policyStatus: "Enabled",
    runtimePreference: ["pip", "git"],
    toolId: "pyrit"
  },
  {
    binaryName: "garak",
    category: "AIValidation",
    defaultVersion: "0.15.1",
    displayName: "Garak",
    dockerImage: null,
    docsUrl: "https://github.com/NVIDIA/garak",
    gitRepo: "https://github.com/NVIDIA/garak.git",
    license: "Apache-2.0",
    moduleIds: ["ai_app.safe_validation"],
    notes:
      "Additional LLM vulnerability scanner harness. Periscan ingests safe, customer-scoped Garak reports through the AI app validation module; in-process adversarial suite execution stays approval-gated.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: "garak",
    policyStatus: "Enabled",
    runtimePreference: ["binary", "pip", "git"],
    toolId: "garak"
  },
  {
    binaryName: "ollama",
    category: "AIValidation",
    defaultVersion: "0.3.0",
    displayName: "Ollama",
    dockerImage: "ollama/ollama",
    docsUrl: "https://ollama.com/",
    gitRepo: "https://github.com/ollama/ollama.git",
    license: "MIT",
    moduleIds: ["ai_app.ollama_local_inference", "ai_app.ollama_whatif_verify"],
    notes:
      "Local LLM runner for self-improving collective intelligence and hallucination-reduced verification. Periscan uses it for local 'what-if' simulation and plan verification in swarm loops (no external API calls, reduces hallucination via local models). Safe, offline-capable for air-gapped.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "ollama"
  },
  {
    binaryName: null,
    category: "ContentPack",
    defaultVersion: "main",
    displayName: "OpenCTI",
    dockerImage: null,
    docsUrl: "https://docs.opencti.io/latest/",
    gitRepo: "https://github.com/OpenCTI-Platform/opencti.git",
    license: "Apache-2.0",
    moduleIds: ["opencti.threat_context_import"],
    notes:
      "Threat intelligence knowledge platform. Periscan imports customer-approved STIX/OpenCTI exports as context evidence only; it does not share indicators or claim validation proof from imported intelligence.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git"],
    toolId: "opencti"
  },
  {
    binaryName: null,
    category: "ContentPack",
    defaultVersion: "main",
    displayName: "Sigma Rules",
    dockerImage: null,
    docsUrl: "https://github.com/SigmaHQ/sigma",
    gitRepo: "https://github.com/SigmaHQ/sigma.git",
    license: "MIT",
    moduleIds: ["sigma.detection_rule_import"],
    notes:
      "Vendor-agnostic Sigma detection rule content. Periscan imports and normalizes rules for control coverage evidence; it does not deploy or modify SIEM rules.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git"],
    toolId: "sigma"
  },
  {
    binaryName: null,
    category: "ContentPack",
    defaultVersion: "v1.6.0",
    displayName: "Open Cybersecurity Schema Framework",
    dockerImage: null,
    docsUrl: "https://schema.ocsf.io/",
    gitRepo: "https://github.com/ocsf/ocsf-schema.git",
    license: "Apache-2.0",
    moduleIds: ["ocsf.evidence_mapping"],
    notes:
      "Vendor-neutral schema for cybersecurity event logging and normalization. Periscan maps normalized evidence into OCSF-compatible export envelopes; it does not treat schema mapping as validation proof.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git"],
    toolId: "ocsf"
  },
  {
    binaryName: null,
    category: "ContentPack",
    defaultVersion: "master",
    displayName: "Atomic Red Team",
    dockerImage: null,
    docsUrl: "https://www.atomicredteam.io/docs/atomic-red-team",
    gitRepo: "https://github.com/redcanaryco/atomic-red-team.git",
    license: "MIT",
    moduleIds: ["atomic.control_validation_safe"],
    notes:
      "ATT&CK scenario content pack for dry-run import only. Not live inject BAS: Periscan loads allowlisted scenarios as fixture/dry-run evidence and never executes Atomic techniques against customer endpoints.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Deferred",
    runtimePreference: ["git"],
    toolId: "atomic-red-team"
  },
  {
    binaryName: null,
    category: "ControlValidation",
    defaultVersion: "latest",
    displayName: "Invoke-AtomicRedTeam",
    dockerImage: "redcanary/invoke-atomicredteam",
    docsUrl:
      "https://www.atomicredteam.io/docs/invoke-atomicredteam/docker-containers",
    gitRepo: "https://github.com/redcanaryco/invoke-atomicredteam.git",
    license: "MIT",
    moduleIds: ["atomic.control_validation_safe"],
    notes:
      "Dry-run/fixture harness for Atomic Red Team content. Live Atomic execution is disabled; Periscan uses import-only control scenario library mode, not live inject.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Deferred",
    runtimePreference: ["docker", "git"],
    toolId: "invoke-atomicredteam"
  },
  {
    binaryName: null,
    category: "IdentityPathing",
    defaultVersion: "latest",
    displayName: "BloodHound Community Edition",
    dockerImage: null,
    docsUrl: "https://specterops.io/bloodhound-community-edition/",
    gitRepo: "https://github.com/SpecterOps/BloodHound.git",
    license: "Apache-2.0",
    moduleIds: ["bloodhound.identity_pathing"],
    notes:
      "Identity attack-path engine. Periscan imports approved BloodHound-compatible graph data; collectors like SharpHound need separate review.",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git", "docker"],
    toolId: "bloodhound-ce"
  },
  {
    binaryName: null,
    category: "IdentityPathing",
    defaultVersion: "latest",
    displayName: "SharpHound",
    dockerImage: null,
    docsUrl: "https://github.com/SpecterOps/SharpHound",
    gitRepo: "https://github.com/SpecterOps/SharpHound.git",
    license: "GPL-3.0",
    moduleIds: ["bloodhound.identity_pathing"],
    notes:
      "Collector for BloodHound. GPL-licensed collector requires explicit legal review before inclusion.",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["git"],
    toolId: "sharphound"
  },
  {
    binaryName: null,
    category: "AdvancedAdversarial",
    defaultVersion: "v5.3.0",
    displayName: "MITRE Caldera",
    dockerImage: null,
    docsUrl: "https://github.com/mitre/caldera",
    gitRepo: "https://github.com/mitre/caldera.git",
    license: "Apache-2.0",
    moduleIds: ["caldera.advanced_adversarial"],
    notes:
      "Advanced adversary emulation framework. Must stay disabled by default and never internet-exposed.",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: null,
    policyStatus: "Deferred",
    runtimePreference: ["git"],
    toolId: "caldera"
  },
  {
    binaryName: "nmap",
    category: "NetworkRecon",
    defaultVersion: "7.95",
    displayName: "Nmap",
    dockerImage: "instrumentisto/nmap",
    docsUrl: "https://nmap.org/book/man.html",
    gitRepo: "https://github.com/nmap/nmap.git",
    // Nmap Public Source License (a modified GPLv2) — redistribution carries
    // notice obligations; tracked in THIRD_PARTY_NOTICES. Runs in-network on the
    // runner agent (AgentLocal) against verified scope with safe, non-aggressive
    // profiles only.
    license: "NPSL",
    moduleIds: ["recon.host_discovery", "recon.service_inventory"],
    notes:
      "In-network host discovery + service inventory engine. Runner-agent only; safe profiles (ping sweep / TCP connect top-ports), no aggressive or intrusive scripts.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "nmap"
  },
  {
    binaryName: "subfinder",
    category: "NetworkRecon",
    defaultVersion: "2.6.6",
    displayName: "Subfinder",
    dockerImage: "projectdiscovery/subfinder",
    docsUrl: "https://github.com/projectdiscovery/subfinder",
    gitRepo: "https://github.com/projectdiscovery/subfinder.git",
    license: "MIT",
    moduleIds: ["recon.subdomain_enum"],
    notes:
      "Passive subdomain enumeration + OSINT/CT/shadow/SaaS/supply (ASV_EASM pillar, EASM+CAASM+internal+broad). Runner-agent (AgentLocal) against verified-scope domains. Fixture for CT log/people profiling.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "subfinder"
  },
  {
    binaryName: "httpx",
    category: "NetworkRecon",
    defaultVersion: "1.6.9",
    displayName: "httpx",
    dockerImage: "projectdiscovery/httpx",
    docsUrl: "https://github.com/projectdiscovery/httpx",
    gitRepo: "https://github.com/projectdiscovery/httpx.git",
    license: "MIT",
    moduleIds: ["recon.http_probe"],
    notes:
      "HTTP service probing/fingerprinting. Runner-agent (AgentLocal); non-intrusive metadata only.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "httpx"
  },
  {
    binaryName: "dnsx",
    category: "NetworkRecon",
    defaultVersion: "1.2.1",
    displayName: "dnsx",
    dockerImage: "projectdiscovery/dnsx",
    docsUrl: "https://github.com/projectdiscovery/dnsx",
    gitRepo: "https://github.com/projectdiscovery/dnsx.git",
    license: "MIT",
    moduleIds: ["recon.dns_probe"],
    notes:
      "DNS resolution/enumeration probing. Runner-agent (AgentLocal); read-only DNS queries.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "dnsx"
  },
  {
    binaryName: "testssl.sh",
    category: "WebAppScan",
    defaultVersion: "3.2",
    displayName: "testssl.sh",
    dockerImage: "drwetter/testssl.sh",
    docsUrl: "https://testssl.sh/",
    gitRepo: "https://github.com/drwetter/testssl.sh.git",
    // GPLv2 — redistribution notice obligations tracked in THIRD_PARTY_NOTICES.
    license: "GPL-2.0",
    licenseUrl: "https://github.com/drwetter/testssl.sh/blob/3.2/LICENSE",
    moduleIds: ["web.tls_audit"],
    notes:
      "GPL TLS auditor. Not redistributed by Periscan. After tenant license accept + install, live testssl.sh may run on verified scope.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["binary", "docker"],
    toolId: "testssl",
    userLicenseAcceptanceRequired: true,
    upstreamLicenseUrl: "https://github.com/drwetter/testssl.sh/blob/3.2/LICENSE"
  },
  {
    binaryName: "sqlmap",
    category: "WebAppScan",
    defaultVersion: "1.9",
    displayName: "sqlmap",
    dockerImage: "googlesky/sqlmap",
    docsUrl: "https://sqlmap.org/",
    gitRepo: "https://github.com/sqlmapproject/sqlmap.git",
    // GPLv2 — redistribution notice obligations tracked in THIRD_PARTY_NOTICES.
    license: "GPL-2.0",
    moduleIds: ["web.sqli_probe"],
    notes:
      "Offensive SQL-injection probe. Dry-run/fixture-only in the current release; live sqlmap probing remains blocked pending legal and safety review.",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["binary", "docker"],
    toolId: "sqlmap"
  },
  {
    binaryName: "ffuf",
    category: "WebAppScan",
    defaultVersion: "2.1.0",
    displayName: "ffuf",
    dockerImage: "secsi/ffuf",
    docsUrl: "https://github.com/ffuf/ffuf",
    gitRepo: "https://github.com/ffuf/ffuf.git",
    license: "MIT",
    moduleIds: ["web.content_discovery"],
    notes:
      "Web content/path discovery fuzzer. Cataloged as an internal engine, but live fuzzing is disabled by current product policy; only fixture/import paths are allowed.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary", "docker"],
    toolId: "ffuf"
  },
  {
    binaryName: "zap-baseline.py",
    category: "WebAppScan",
    defaultVersion: "2.17.0",
    displayName: "OWASP ZAP",
    dockerImage: "ghcr.io/zaproxy/zaproxy",
    docsUrl: "https://www.zaproxy.org/docs/docker/baseline-scan/",
    gitRepo: "https://github.com/zaproxy/zaproxy.git",
    license: "Apache-2.0",
    moduleIds: ["web.zap_baseline"],
    notes:
      "OWASP ZAP passive baseline scan. ServiceViaProxy; passive spider + passive rules only (no active attack rules).",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["docker", "binary"],
    toolId: "zaproxy"
  },
  {
    binaryName: "nikto",
    category: "WebAppScan",
    defaultVersion: "2.5.0",
    displayName: "Nikto",
    dockerImage: "frapsoft/nikto",
    docsUrl: "https://github.com/sullo/nikto",
    gitRepo: "https://github.com/sullo/nikto.git",
    // GPLv2 — redistribution notice obligations; tracked in THIRD_PARTY_NOTICES.
    license: "GPL-2.0",
    licenseUrl:
      "https://github.com/sullo/nikto/blob/master/program/docs/licenses/nikto.license",
    moduleIds: ["web.nikto_scan"],
    notes:
      "GPL web scanner. Not redistributed by Periscan. After tenant license accept + install, live Nikto may run on verified scope.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["binary", "docker"],
    toolId: "nikto",
    userLicenseAcceptanceRequired: true,
    upstreamLicenseUrl:
      "https://github.com/sullo/nikto/blob/master/program/docs/licenses/nikto.license"
  },
  {
    binaryName: "whatweb",
    category: "WebAppScan",
    defaultVersion: "0.5.5",
    displayName: "WhatWeb",
    dockerImage: "secsi/whatweb",
    docsUrl: "https://github.com/urbanadventurer/WhatWeb",
    gitRepo: "https://github.com/urbanadventurer/WhatWeb.git",
    // GPLv3 — redistribution notice obligations; tracked in THIRD_PARTY_NOTICES.
    license: "GPL-3.0",
    licenseUrl: "https://github.com/urbanadventurer/WhatWeb/blob/master/LICENSE",
    moduleIds: ["web.fingerprint"],
    notes:
      "GPL fingerprinting. Not redistributed by Periscan. After tenant license accept + install, live WhatWeb may run on verified scope.",
    npmPackage: null,
    phase: "NearTerm",
    pipPackage: null,
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["binary", "docker"],
    toolId: "whatweb",
    userLicenseAcceptanceRequired: true,
    upstreamLicenseUrl: "https://github.com/urbanadventurer/WhatWeb/blob/master/LICENSE"
  },
  {
    binaryName: "nxc",
    category: "IdentityPathing",
    defaultVersion: "1.3.0",
    displayName: "NetExec",
    dockerImage: null,
    docsUrl: "https://www.netexec.wiki/",
    gitRepo: "https://github.com/Pennyw0rth/NetExec.git",
    license: "BSD-2-Clause",
    moduleIds: ["identity.cred_spray"],
    notes:
      "AD/network credential validation (NetExec). Dry-run/fixture-only in the current release; live credential authentication attempts remain disabled by product policy.",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: "netexec",
    policyStatus: "Enabled",
    runtimePreference: ["binary", "pip"],
    toolId: "netexec"
  },
  {
    binaryName: "scout",
    category: "CloudPosture",
    defaultVersion: "5.14.0",
    displayName: "ScoutSuite",
    dockerImage: null,
    docsUrl: "https://github.com/nccgroup/ScoutSuite",
    gitRepo: "https://github.com/nccgroup/ScoutSuite.git",
    // GPL-2.0 — redistribution notice obligations; tracked in THIRD_PARTY_NOTICES.
    license: "GPL-2.0",
    licenseUrl: "https://github.com/nccgroup/ScoutSuite/blob/master/LICENSE",
    moduleIds: ["cloud.scoutsuite_posture"],
    notes:
      "GPL multi-cloud posture. Not redistributed by Periscan. After tenant license accept + install, live ScoutSuite may run against a Connected AWS account.",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: "scoutsuite",
    policyStatus: "RequiresLegalReview",
    runtimePreference: ["binary", "pip"],
    toolId: "scoutsuite",
    userLicenseAcceptanceRequired: true,
    upstreamLicenseUrl: "https://github.com/nccgroup/ScoutSuite/blob/master/LICENSE"
  },
  {
    binaryName: "msfconsole",
    category: "AdvancedAdversarial",
    defaultVersion: "6.4",
    displayName: "Metasploit Framework",
    dockerImage: "metasploitframework/metasploit-framework",
    docsUrl: "https://docs.metasploit.com/",
    gitRepo: "https://github.com/rapid7/metasploit-framework.git",
    license: "BSD-3-Clause",
    moduleIds: ["exploit.metasploit_check"],
    notes:
      "Exploitation framework (Metasploit). Dry-run/fixture-only in the current release; live exploitation checks remain disabled by product policy. Export-control + authorized-use notice applies (THIRD_PARTY_NOTICES).",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: null,
    policyStatus: "Deferred",
    runtimePreference: ["binary", "docker"],
    toolId: "metasploit"
  },
  {
    binaryName: "kerbrute",
    category: "IdentityPathing",
    defaultVersion: "1.0.3",
    displayName: "Kerbrute",
    dockerImage: null,
    docsUrl: "https://github.com/ropnop/kerbrute",
    gitRepo: "https://github.com/ropnop/kerbrute.git",
    license: "MIT",
    moduleIds: ["identity.kerberos_userenum"],
    notes:
      "Kerberos pre-auth username enumeration (Kerbrute). Dry-run/fixture-only in the current release; live username enumeration remains disabled by product policy.",
    npmPackage: null,
    phase: "LaterPhase",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["binary"],
    toolId: "kerbrute"
  },
  {
    binaryName: null,
    category: "OTICS",
    defaultVersion: "0.1.0",
    displayName: "Periscan OT/ICS Attack Pack",
    dockerImage: null,
    docsUrl: "https://example.internal/periscan/otics-pack",
    gitRepo: null,
    license: "Proprietary (internal content pack)",
    moduleIds: ["ot_ics.safe_baseline"],
    notes:
      "Scaffold marketplace content pack metadata only. Fixture-backed safe baseline returns Inconclusive; liveSupported is false until a non-disruptive runner profile exists. Not a live OT attack pack.",
    npmPackage: null,
    phase: "Current",
    pipPackage: null,
    policyStatus: "Enabled",
    runtimePreference: ["git"],
    toolId: "periscan-ot-ics-pack"
  },
  ...COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS,
  ...SECURITY_CATALOG_EXPANSION_TOOL_DEFINITIONS
] satisfies OpenSourceToolDefinition[];

const CATALOG_ONLY_SIMULATION_MODULE_IDS = new Set([
  "ai_app.ollama_local_inference",
  "ai_app.ollama_whatif_verify",
  "ctf.gamified_training_pack",
  "exploitation.killchain.engine",
  "grype.cve_scan",
  "grype.exploit_template",
  "iac.ansible.onprem_deploy_sim",
  "iac.ansible.playbook_sim",
  "iac.terraform.onprem_mcp_sim",
  "iac.terraform.plan_sim",
  "integrations.openapi.sdk_gen_sim",
  "integrations.terraform.provider_scaffold",
  "physical.access_proxy_sim",
  "physical.rf_sim",
  "physical.rfid_sim",
  "reports.video.replay_export_sim",
  "semgrep.code_exploit_scan",
  "semgrep.web_api_exploit",
  "reports.replay_video_pack",
  "training.nl_campaign_sim"
]);

function normalizeCatalogToolDefinition(
  tool: OpenSourceToolDefinition
): OpenSourceToolDefinition {
  return OpenSourceToolDefinitionSchema.parse({
    ...tool,
    moduleIds: tool.moduleIds.filter(
      (moduleId) => !CATALOG_ONLY_SIMULATION_MODULE_IDS.has(moduleId)
    )
  });
}

function normalizeCatalogCapability(
  capability: OpenSourceCapability
): OpenSourceCapability {
  const parsedCapability = OpenSourceCapabilitySchema.parse(capability);

  if (
    parsedCapability.moduleId &&
    CATALOG_ONLY_SIMULATION_MODULE_IDS.has(parsedCapability.moduleId)
  ) {
    const apiRoutes = parsedCapability.apiRoutes.filter(
      (route) =>
        route !== "/api/v1/modules" &&
        route !== "/api/v1/missions" &&
        route !== "/api/v1/runners"
    );

    return OpenSourceCapabilitySchema.parse({
      ...parsedCapability,
      apiRoutes:
        apiRoutes.length > 0
          ? apiRoutes
          : ["/api/v1/open-source-tools", "/api/v1/open-source-capabilities"],
      moduleId: null,
      status: "FixtureOnly"
    });
  }

  return parsedCapability;
}

const toolsById = new Map(
  OPEN_SOURCE_TOOL_DEFINITIONS.map((tool) => [
    tool.toolId,
    normalizeCatalogToolDefinition(OpenSourceToolDefinitionSchema.parse(tool))
  ])
);

const OPEN_SOURCE_CAPABILITY_DEFINITIONS = [
  {
    apiRoutes: [
      "/api/v1/agent-trust/endpoints/:endpointId/tck-runs",
      "/api/v1/agent-trust/tck-runs"
    ],
    capabilityId: "a2a-tck.protocol-conformance",
    description:
      "Runs the official A2A Protocol TCK against an approved, customer-authorized endpoint and preserves normalized per-requirement and per-transport proof.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ExternalService",
    featureTags: ["agents", "a2a", "conformance", "interoperability"],
    inputSchemaRef: "RunA2ATckInputSchema",
    interfaceKind: "ExecutionHarness",
    missionTypes: ["AIAppValidation"],
    moduleId: null,
    name: "A2A Protocol Conformance",
    outputSchemaRef: "A2ATckRunSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "AIApplicationEndpoint"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "a2a-tck"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/external-validation/profiles",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/snapshots"
    ],
    capabilityId: "gitleaks.repo-secrets",
    description:
      "Scans authorized repositories for secrets and emits redacted evidence-backed exposures.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["repository", "secrets", "redaction"],
    inputSchemaRef: "GitleaksTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "gitleaks.repo_secrets",
    name: "Repository Secret Scan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: ["github"],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "gitleaks"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/snapshots"
    ],
    capabilityId: "nuclei.safe-external-baseline",
    description:
      "Runs allowlisted safe Nuclei profiles against verified external scope with rate limits and audit coverage.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ExternalPoA",
    featureTags: ["external", "safe-templates", "service-observation"],
    inputSchemaRef: "VerifiedDomainTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "nuclei.external_exposure_safe",
    name: "Safe External Exposure Validation",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "nuclei"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/external-validation/profiles",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "nuclei.safe-service-fingerprinting",
    description:
      "Captures safe service observations and exposure fingerprints for validated internet-facing assets.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ExternalPoA",
    featureTags: ["fingerprinting", "external", "rate-limited"],
    inputSchemaRef: "VerifiedDomainTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "nuclei.external_exposure_safe",
    name: "Safe Service Fingerprinting",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "nuclei"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/external-validation/profiles",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "nuclei.safe-http-header-review",
    description:
      "Reviews response-header posture with a safe GET-only request against verified external scope.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ExternalPoA",
    featureTags: ["headers", "external", "rate-limited", "safe-templates"],
    inputSchemaRef: "VerifiedDomainTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "nuclei.external_exposure_safe",
    name: "Safe HTTP Header Review",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "nuclei"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/external-validation/profiles",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "nuclei.safe-public-metadata",
    description:
      "Reads standard public metadata paths such as robots.txt, sitemap.xml, and security.txt without crawling.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ExternalPoA",
    featureTags: ["metadata", "external", "rate-limited", "safe-templates"],
    inputSchemaRef: "VerifiedDomainTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "nuclei.external_exposure_safe",
    name: "Safe Public Metadata Review",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "nuclei"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/external-validation/profiles"
    ],
    capabilityId: "nuclei-templates.safe-template-pack",
    description:
      "Maintains the allowlisted Nuclei template corpus Periscan can execute for safe external validation.",
    evidenceTypes: [],
    executionMode: "ContentPack",
    featureTags: ["templates", "allowlist", "content-pack"],
    inputSchemaRef: "TemplateProfileConfig",
    interfaceKind: "ContentPack",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: null,
    name: "Safe Template Pack",
    outputSchemaRef: "TemplateSelection",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "nuclei-templates"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/snapshots"
    ],
    capabilityId: "trivy.repo-dependency-scan",
    description:
      "Scans repositories for dependency vulnerabilities and normalizes package risk into Periscan evidence.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["dependencies", "repository", "sbom"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "trivy.repo_dependency_scan",
    name: "Repository Dependency Scan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: ["github"],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "trivy"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners",
      "/api/v1/third-party-tools"
    ],
    capabilityId: "syft.cyclonedx-sbom",
    description:
      "Generates a CycloneDX software bill of materials from an authorized repository filesystem using a staged read-only, network-disabled runner execution and stores normalized component inventory plus the SBOM digest.",
    evidenceTypes: ["NormalizedEvidence", "Attachment"],
    executionMode: "InternalRunner",
    featureTags: ["sbom", "cyclonedx", "repository", "supply-chain"],
    inputSchemaRef: "SyftRepositoryTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "syft.sbom_generate",
    name: "CycloneDX SBOM Generation",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "syft"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners",
      "/api/v1/third-party-tools"
    ],
    capabilityId: "cosign.offline-blob-verification",
    description:
      "Verifies an authorized artifact against a Sigstore bundle and an explicitly trusted public key without network access, then stores artifact, bundle, and key digests plus the verification outcome.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: [
      "sigstore",
      "cosign",
      "artifact-integrity",
      "supply-chain",
      "offline"
    ],
    inputSchemaRef: "CosignBlobVerificationTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "FixVerification"
    ],
    moduleId: "sigstore.cosign_verify_blob",
    name: "Offline Signed Artifact Verification",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "cosign"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners",
      "/api/v1/third-party-tools"
    ],
    capabilityId: "trivy.container-image-scan",
    description:
      "Scans container images and reports package, OS, and misconfiguration risk through normalized evidence.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["containers", "images", "sbom"],
    inputSchemaRef: "ContainerImageTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "trivy.container_scan",
    name: "Container Image Scan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: ["aws"],
    requiredScopes: ["Repository", "CloudAccount"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "trivy"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/community/validation-suite",
      "/api/v1/community/validation-runs"
    ],
    capabilityId: "trivy.repo-misconfig",
    description:
      "Runs Trivy config against an authorized repository for IaC/misconfig findings.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["community", "iac", "misconfig"],
    inputSchemaRef: "RepoTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "trivy.repo_misconfig",
    name: "Trivy Repository Misconfig",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "trivy"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/snapshots"
    ],
    capabilityId: "grype.cve-scan",
    description:
      "Simulation / planning only (non-executable): fixture CVE inventory from Grype for planning. Not live vulnerability proof; catalog-only quarantine (P05-12).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["cve", "simulation", "planning-only", "catalog-only"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation", "ContinuousValidation"],
    moduleId: "grype.cve_scan",
    name: "CVE / Exploit Template Scan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Repository", "IPRange"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "grype"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "semgrep.code-exploit-scan",
    description:
      "Simulation / planning only (non-executable): fixture Semgrep rule matches for planning. Not live SAST proof; catalog-only quarantine (P05-12).",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["code", "web", "simulation", "planning-only", "catalog-only"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "semgrep.code_exploit_scan",
    name: "Code Exploit / Web API Rule Scan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: ["github"],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "semgrep"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "semgrep.web-api-exploit",
    description:
      "Semgrep web/API exploit rule pack (safe sim data). For kill-chain web/api/physical multi-modal.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["web", "exploit", "physical"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation"],
    moduleId: "semgrep.web_api_exploit",
    name: "Web/API Exploit Pack (Semgrep)",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["IPRange"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "semgrep"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "grype.exploit-template",
    description:
      "Simulation / planning only (non-executable): Grype-derived template content for planning. Catalog-only quarantine (P05-12).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["cve", "simulation", "planning-only", "catalog-only"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation"],
    moduleId: "grype.exploit_template",
    name: "Grype Exploit Template Pack",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "grype"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "proxmark3.physical-sim",
    description:
      "Safe simulated physical access proxy data from Proxmark3 OSS repo. For physical proxy sim in kill-chains (no real hardware).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["physical", "rfid", "access-proxy", "multi-modal"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation"],
    moduleId: "physical.rfid_sim",
    name: "Physical RFID Access Proxy Sim",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Physical"],
    safetyLevels: ["AdvancedAdversarial"],
    status: "Implemented",
    toolId: "proxmark3"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "proxmark3.access-proxy-sim",
    description:
      "Full physical access proxy (sim) pack. Integrates proxmark3 data for kill-chain Physical access proxy (sim) step (G3, safe only).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["physical", "access-proxy", "proxmark", "kill-chain"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation"],
    moduleId: "physical.access_proxy_sim",
    name: "Physical Access Proxy Sim Pack",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Physical"],
    safetyLevels: ["AdvancedAdversarial"],
    status: "Implemented",
    toolId: "proxmark3"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "hackrf.rf-sim",
    description:
      "Safe RF/physical simulation data packs from HackRF OSS. For physical access proxy in multi-modal sims.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["physical", "rf", "access-proxy"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation"],
    moduleId: "physical.rf_sim",
    name: "Physical RF Sim",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Physical"],
    safetyLevels: ["AdvancedAdversarial"],
    status: "Implemented",
    toolId: "hackrf"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "ansible.iac-playbook-sim",
    description:
      "Safe simulated Ansible playbooks for on-prem / air-gapped / MCP deployment in RemOps (G4). Fixture/dry-run only. No real changes. Enhances zero-touch + on-prem notes.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: [
      "iac",
      "ansible",
      "on-prem",
      "air-gapped",
      "playbook",
      "remops"
    ],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["FixVerification", "ControlValidation"],
    moduleId: "iac.ansible.playbook_sim",
    name: "Ansible IaC / On-Prem Playbook Sim",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "ansible"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "ansible.onprem-deploy-sim",
    description:
      "Ansible on-prem / air-gapped deployment simulation (safe fixtures). For MCP / HA + zero-touch internal deployment sims per G4.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["iac", "ansible", "on-prem", "mcp", "air-gapped"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["FixVerification"],
    moduleId: "iac.ansible.onprem_deploy_sim",
    name: "Ansible On-Prem / Air-Gapped Deploy Sim",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "ansible"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "terraform.iac-plan-sim",
    description:
      "Terraform plan / apply simulation for IaC and on-prem/MCP (G4/G6). Safe fixture mode. Integrates with RemOps prescriptive plans and one-click playbooks.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: [
      "iac",
      "terraform",
      "on-prem",
      "mcp",
      "air-gapped",
      "tf-provider"
    ],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["FixVerification", "ControlValidation"],
    moduleId: "iac.terraform.plan_sim",
    name: "Terraform IaC Plan / On-Prem Sim",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork", "CloudAccount"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "terraform"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "terraform.onprem-mcp-sim",
    description:
      "Terraform on-prem/MCP + air-gapped provider sim (safe data packs). Supports full integrations + TF provider notes for G4/G6.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["iac", "terraform", "mcp", "air-gapped"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["FixVerification"],
    moduleId: "iac.terraform.onprem_mcp_sim",
    name: "Terraform On-Prem / MCP Sim Pack",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "terraform"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "ffmpeg.video-replay-export",
    description:
      "Safe simulated video replay export using FFmpeg (G5). From evidence/playwright fixtures -> replay video artifact (metadata + link). For gamified training and reports. Fixture only.",
    evidenceTypes: ["NormalizedEvidence", "Attachment"],
    executionMode: "ControlPlane",
    featureTags: ["video", "replay", "gamified", "training", "ffmpeg"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["FixVerification", "ControlValidation"],
    moduleId: "reports.video.replay_export_sim",
    name: "FFmpeg Replay Video Export Sim",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "ffmpeg"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "ctf.gamified-pack",
    description:
      "Gamified CTF/OSS training packs (picoCTF style) via Marketplace (G5). Safe sim challenges for training mode + NL campaign builder (ollama).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["ctf", "gamified", "training", "nl-campaign"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ControlValidation"],
    moduleId: "ctf.gamified_training_pack",
    name: "CTF Gamified Training Pack",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "ctf-pack"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "openapi-generator.sdk-gen",
    description:
      "Safe simulated SDK generation using OpenAPI Generator from Periscan OpenAPI (G6). Produces Go/Python/JS client stubs (fixture). Full bi-di + SDK support.",
    evidenceTypes: ["NormalizedEvidence", "Attachment"],
    executionMode: "ControlPlane",
    featureTags: ["sdk", "openapi", "bi-di", "integrations"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot"],
    moduleId: "integrations.openapi.sdk_gen_sim",
    name: "OpenAPI Generator SDK Gen Sim",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "openapi-generator"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "terraform.periscan-provider",
    description:
      "Terraform provider scaffold sim for Periscan (G6, re-use terraform + openapi-gen). Safe manifest for managing resources via TF (bi-di).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["terraform", "provider", "bi-di", "integrations"],
    inputSchemaRef: "RepositoryScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["FixVerification"],
    moduleId: "integrations.terraform.provider_scaffold",
    name: "Periscan Terraform Provider Scaffold",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "openapi-generator"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners",
      "/api/v1/third-party-tools"
    ],
    capabilityId: "osv.cross-check",
    description:
      "Cross-checks repository dependency findings against OSV advisories for evidence-backed package risk validation.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["dependencies", "advisories", "cross-check"],
    inputSchemaRef: "RepositoryDependencyTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "osv.repo_dependency_scan",
    name: "OSV Advisory Cross-Check",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: ["github"],
    requiredScopes: ["Repository"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "osv-scanner"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/snapshots"
    ],
    capabilityId: "prowler.aws-posture",
    description:
      "Parses read-only AWS posture findings into exposures, control observations, and remediation hints.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["aws", "cloud-posture", "misconfiguration"],
    inputSchemaRef: "ProwlerTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "prowler.aws_posture",
    name: "AWS Posture Validation",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: ["aws"],
    requiredScopes: ["CloudAccount"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "prowler"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/ai-apps",
      "/api/v1/missions"
    ],
    capabilityId: "promptfoo.prompt-injection-suite",
    description:
      "Runs safe prompt-injection and policy-bound AI abuse cases against customer-provided AI endpoints.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["ai", "prompt-injection", "safe-validation"],
    inputSchemaRef: "AIAppValidationTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["AIAppValidation", "ValidationSnapshot"],
    moduleId: "ai_app.safe_validation",
    name: "Prompt Injection Suite",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["AIApplicationEndpoint"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "promptfoo"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/ai-apps",
      "/api/v1/missions"
    ],
    capabilityId: "promptfoo.rag-and-tool-suite",
    description:
      "Evaluates RAG authorization and unsafe tool invocation behavior through customer-scoped test cases.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["ai", "rag", "tool-calling", "guardrails"],
    inputSchemaRef: "AIAppValidationTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["AIAppValidation", "ValidationSnapshot"],
    moduleId: "ai_app.safe_validation",
    name: "RAG and Tool Invocation Suite",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["AIApplicationEndpoint"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "promptfoo"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/ai-apps",
      "/api/v1/missions"
    ],
    capabilityId: "pyrit.alt-ai-safety-harness",
    description:
      "Provides an alternate Python-based safe AI validation harness for customer-approved endpoints.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["ai", "python", "alternate-harness"],
    inputSchemaRef: "AIAppValidationTargetSchema",
    interfaceKind: "ExecutionHarness",
    missionTypes: ["AIAppValidation"],
    moduleId: "ai_app.safe_validation",
    name: "Alternate AI Safety Harness",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["AIApplicationEndpoint"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "pyrit"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/ai-apps",
      "/api/v1/missions"
    ],
    capabilityId: "garak.llm-vulnerability-harness",
    description:
      "Imports safe Garak LLM vulnerability scanner reports into Periscan's AI app validation evidence model.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["ai", "llm-security", "harness-import"],
    inputSchemaRef: "AIAppValidationTargetSchema",
    interfaceKind: "ExecutionHarness",
    missionTypes: ["AIAppValidation"],
    moduleId: "ai_app.safe_validation",
    name: "Garak AI Safety Harness",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["AIApplicationEndpoint"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "garak"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/ai-apps",
      "/api/v1/missions"
    ],
    capabilityId: "ollama.local-inference",
    description:
      "Uses local Ollama models for AI app validation, self-improving what-if simulations, and hallucination-reduced plan verification in swarm loops. Offline/air-gapped capable; reduces reliance on external GenAI for lower hallucination risk via verification against graph facts.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["ai", "local-llm", "what-if", "hallucination-reduction"],
    inputSchemaRef: "AIAppValidationTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["AIAppValidation", "ValidationSnapshot"],
    moduleId: "ai_app.ollama_local_inference",
    name: "Ollama Local LLM Inference",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["AIApplicationEndpoint"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "ollama"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/ai-apps",
      "/api/v1/missions"
    ],
    capabilityId: "ollama.whatif-verify",
    description:
      "Local what-if verification harness using Ollama to sanity-check proposed fixes/configs against the tenant's evidence graph and reduce model hallucinations before a remediation plan is surfaced.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["ai", "what-if", "self-improving", "verification"],
    inputSchemaRef: "AIAppValidationTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ContinuousValidation"],
    moduleId: "ai_app.ollama_whatif_verify",
    name: "Ollama What-If Verification",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["AIApplicationEndpoint"],
    safetyLevels: ["ControlledValidation"],
    status: "Implemented",
    toolId: "ollama"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/threat-intel/catalog",
      "/api/v1/evidence"
    ],
    capabilityId: "opencti.threat-context-import",
    description:
      "Imports approved OpenCTI/STIX threat-intel exports as normalized Periscan context evidence without treating indicators or advisories as validation proof.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["threat-intel", "stix", "context-import", "ioc"],
    inputSchemaRef: "OpenCtiThreatContextImportTargetSchema",
    interfaceKind: "KnowledgePack",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "opencti.threat_context_import",
    name: "OpenCTI Threat Context Import",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: [],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "opencti"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/control-sources"
    ],
    capabilityId: "sigma.detection-rule-content",
    description:
      "Imports Sigma YAML detection rules as normalized control-coverage evidence with ATT&CK technique tags.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["control-validation", "detection-rules", "attack-techniques"],
    inputSchemaRef: "SigmaDetectionRuleImportTargetSchema",
    interfaceKind: "ContentPack",
    missionTypes: ["ControlValidation", "ValidationSnapshot"],
    moduleId: "sigma.detection_rule_import",
    name: "Sigma Detection Rule Content",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["ControlSource"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "sigma"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/evidence",
      "/api/v1/reports"
    ],
    capabilityId: "ocsf.evidence-normalization",
    description:
      "Maps Periscan normalized signals and evidence into OCSF-compatible security finding envelopes for export and downstream analytics.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: ["evidence", "normalization", "export", "schema-mapping"],
    inputSchemaRef: "OcsfEvidenceMappingTargetSchema",
    interfaceKind: "ContentPack",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ControlValidation"
    ],
    moduleId: "ocsf.evidence_mapping",
    name: "OCSF Evidence Normalization Mapping",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: [],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "ocsf"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners"
    ],
    capabilityId: "nmap.host-discovery",
    description:
      "Runs safe in-network host discovery through the outbound internal runner against verified IP range or internal-network scope. ASV_EASM pillar support: full EASM+CAASM+internal+broad (Cloud/K8s/Containers/Serverless/Web/APIs/Mobile/IoT/OT/LLMs/Code/Backups/Hypervisors/IdPs/SaaS/3P/Email/Collaboration) + continuous inventory + fixtures for active recon.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: [
      "network",
      "runner",
      "host-discovery",
      "safe-recon",
      "asv_easm",
      "easm",
      "caasm",
      "ct",
      "osint",
      "supply-chain"
    ],
    inputSchemaRef: "ReconHostDiscoveryTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "recon.host_discovery",
    name: "Internal Host Discovery",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["IPRange", "InternalNetwork"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "nmap"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners"
    ],
    capabilityId: "nmap.service-inventory",
    description:
      "Runs safe TCP-connect service inventory through the outbound internal runner without intrusive scripts or aggressive timing. ASV_EASM: broad coverage (K8s/Containers/Serverless/IoT/OT/LLMs/Code/Backups/Hypervisors) for CAASM + internal recon swarm.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: [
      "network",
      "runner",
      "service-inventory",
      "safe-recon",
      "asv_easm",
      "k8s",
      "containers",
      "iot",
      "ot"
    ],
    inputSchemaRef: "ReconServiceInventoryTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "recon.service_inventory",
    name: "Internal Service Inventory",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["IPRange", "InternalNetwork"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "nmap"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners",
      "/api/v1/third-party-tools"
    ],
    capabilityId: "subfinder.passive-subdomain-enum",
    description:
      "Performs passive subdomain enumeration for verified domains without probing discovered hosts. ASV_EASM: OSINT/DNS/CT/people profiling/shadow IT/SaaS/supply chain + broad coverage recon swarm (passive+active safe fixtures).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: [
      "external",
      "osint",
      "subdomain",
      "safe-recon",
      "asv_easm",
      "ct-log",
      "people",
      "shadow-saas",
      "supply"
    ],
    inputSchemaRef: "ReconSubdomainEnumTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "recon.subdomain_enum",
    name: "Passive Subdomain Enumeration",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "subfinder"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners",
      "/api/v1/third-party-tools"
    ],
    capabilityId: "httpx.http-service-probe",
    description:
      "Probes verified-scope hosts for HTTP/HTTPS reachability and metadata without content fuzzing or attacks. ASV_EASM pillar: broad Web/APIs/Mobile/IoT/SaaS/Email/Collaboration + shadow IT recon swarm (passive+active fixtures for discovery).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: [
      "http",
      "service-probe",
      "safe-recon",
      "asv_easm",
      "web",
      "api",
      "saas",
      "shadow"
    ],
    inputSchemaRef: "ReconHttpProbeTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "recon.http_probe",
    name: "HTTP Service Probe",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "IPRange", "InternalNetwork"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "httpx"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners",
      "/api/v1/third-party-tools"
    ],
    capabilityId: "dnsx.dns-resolution-probe",
    description:
      "Performs read-only DNS resolution probes for verified domain, subdomain, or internal-network scope. ASV_EASM pillar: DNS/CT log recon, people profiling, supply chain, broad internal+cloud+idp+saas coverage for living inventory + change detection (safe fixtures only).",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: [
      "dns",
      "resolution",
      "safe-recon",
      "asv_easm",
      "ct",
      "supply",
      "idp"
    ],
    inputSchemaRef: "ReconDnsProbeTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "recon.dns_probe",
    name: "DNS Resolution Probe",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "InternalNetwork"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "dnsx"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "zaproxy.passive-baseline",
    description:
      "Runs OWASP ZAP passive baseline validation against verified web scope with passive rules only and no active attack rules.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["web", "passive-baseline", "safe-validation"],
    inputSchemaRef: "WebZapBaselineTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "FixVerification"
    ],
    moduleId: "web.zap_baseline",
    name: "ZAP Passive Baseline",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "IPRange"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "Implemented",
    toolId: "zaproxy"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "netexec.credential-validation-plan",
    description:
      "Produces dry-run credential-validation plans and fixture evidence while live credential authentication remains disabled by current product policy.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: ["identity", "dry-run", "credential-validation-disabled"],
    inputSchemaRef: "IdentityCredSprayTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation", "FixVerification"],
    moduleId: "identity.cred_spray",
    name: "Credential Validation Plan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "LaterPhase",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork", "IPRange"],
    safetyLevels: ["ControlledValidation"],
    status: "FixtureOnly",
    toolId: "netexec"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "metasploit.exploitation-check-plan",
    description:
      "Produces dry-run exploitation-check plans and fixture evidence while live Metasploit execution remains disabled by current product policy.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: ["advanced-adversarial", "dry-run", "exploitation-disabled"],
    inputSchemaRef: "ExploitMetasploitTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation", "FixVerification"],
    moduleId: "exploit.metasploit_check",
    name: "Exploitation Check Plan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "LaterPhase",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork", "IPRange"],
    safetyLevels: ["AdvancedAdversarial"],
    status: "FixtureOnly",
    toolId: "metasploit"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "kerbrute.username-enumeration-plan",
    description:
      "Produces dry-run Kerberos username-enumeration plans and fixture evidence while live enumeration remains disabled by current product policy.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: ["identity", "dry-run", "enumeration-disabled"],
    inputSchemaRef: "KerberosUserEnumTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation", "FixVerification"],
    moduleId: "identity.kerberos_userenum",
    name: "Kerberos Username Enumeration Plan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "LaterPhase",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork", "IPRange"],
    safetyLevels: ["ControlledValidation"],
    status: "FixtureOnly",
    toolId: "kerbrute"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/control-sources",
      "/api/v1/missions"
    ],
    capabilityId: "atomic.attack-technique-content",
    description:
      "Supplies ATT&CK-mapped control scenario content for dry-run import only. Not live inject BAS.",
    evidenceTypes: [],
    executionMode: "ContentPack",
    featureTags: ["control-validation", "attack-techniques", "content-pack", "dry-run-import"],
    inputSchemaRef: "AtomicTechniqueSelection",
    interfaceKind: "ContentPack",
    missionTypes: ["ControlValidation", "ValidationSnapshot"],
    moduleId: "atomic.control_validation_safe",
    name: "ATT&CK Scenario Content Pack (dry-run import)",
    outputSchemaRef: "AtomicScenarioDefinition",
    phase: "Current",
    requiredIntegrations: ["splunk", "crowdstrike"],
    requiredScopes: ["ControlSource"],
    safetyLevels: ["BASLite"],
    status: "Implemented",
    toolId: "atomic-red-team"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/control-sources",
      "/api/v1/missions"
    ],
    capabilityId: "invoke-atomicredteam.dry-run-executor",
    description:
      "Imports allowlisted Atomic scenarios in dry-run or fixture mode only. Live Atomic inject remains disabled.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: ["control-validation", "dry-run", "fixture", "import-only"],
    inputSchemaRef: "AtomicControlValidationTargetSchema",
    interfaceKind: "ExecutionHarness",
    missionTypes: ["ControlValidation"],
    moduleId: "atomic.control_validation_safe",
    name: "Dry-run scenario import (not live inject)",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: ["splunk", "crowdstrike"],
    requiredScopes: ["ControlSource", "InternalNetwork"],
    safetyLevels: ["BASLite"],
    status: "Implemented",
    toolId: "invoke-atomicredteam"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/attack-paths",
      "/api/v1/missions"
    ],
    capabilityId: "bloodhound.identity-path-analysis",
    description:
      "Builds identity access graphs and privileged path analysis from approved directory data sources.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["identity", "attack-paths", "graph"],
    inputSchemaRef: "IdentityGraphTargetSchema",
    interfaceKind: "PathEngine",
    missionTypes: ["ExposureValidation", "ValidationSnapshot"],
    moduleId: "bloodhound.identity_pathing",
    name: "Identity Path Analysis",
    outputSchemaRef: "AttackPathSchema",
    phase: "LaterPhase",
    requiredIntegrations: ["entra-id", "active-directory"],
    requiredScopes: ["InternalNetwork", "ControlSource"],
    safetyLevels: ["PassiveReadOnly"],
    status: "Implemented",
    toolId: "bloodhound-ce"
  },
  {
    apiRoutes: ["/api/v1/open-source-tools", "/api/v1/attack-paths"],
    capabilityId: "sharphound.directory-collection",
    description:
      "Collects Active Directory relationship data for BloodHound-style path analysis.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: ["identity", "collector", "active-directory"],
    inputSchemaRef: "DirectoryCollectionTargetSchema",
    interfaceKind: "Collector",
    missionTypes: ["ExposureValidation"],
    moduleId: "bloodhound.identity_pathing",
    name: "Directory Relationship Collection",
    outputSchemaRef: "GraphNodeSchema",
    phase: "LaterPhase",
    requiredIntegrations: ["active-directory"],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["PassiveReadOnly"],
    status: "BlockedLegalReview",
    toolId: "sharphound"
  },
  {
    apiRoutes: ["/api/v1/open-source-tools", "/api/v1/missions"],
    capabilityId: "caldera.advanced-adversarial-operations",
    description:
      "Provides advanced adversarial operation planning for explicitly approved internal runner scenarios.",
    evidenceTypes: ["RawModuleOutput", "NormalizedEvidence"],
    executionMode: "InternalRunner",
    featureTags: ["advanced-adversarial", "operations", "internal-runner"],
    inputSchemaRef: "AdvancedAdversarialTargetSchema",
    interfaceKind: "ExecutionHarness",
    missionTypes: ["ExposureValidation", "ControlValidation"],
    moduleId: "caldera.advanced_adversarial",
    name: "Advanced Adversarial Operations",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "LaterPhase",
    requiredIntegrations: ["crowdstrike", "splunk"],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["AdvancedAdversarial"],
    status: "Implemented",
    toolId: "caldera"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "ffuf.content-discovery-import",
    description:
      "Normalizes fixture or previously approved web path-discovery results while live ffuf fuzzing remains disabled by current product policy.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: [
      "web",
      "content-discovery",
      "fixture-only",
      "fuzzing-disabled"
    ],
    inputSchemaRef: "WebContentDiscoveryTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "web.content_discovery",
    name: "Web Content Discovery Import",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "IPRange"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "FixtureOnly",
    toolId: "ffuf"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "testssl.tls-audit-import",
    description:
      "Normalizes approved testssl.sh TLS audit outputs while live testssl.sh execution remains blocked pending legal and safety review.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["web", "tls", "import", "legal-review"],
    inputSchemaRef: "WebTlsAuditTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "FixVerification",
      "ContinuousValidation"
    ],
    moduleId: "web.tls_audit",
    name: "testssl.sh TLS Audit Import",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "IPRange"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "BlockedLegalReview",
    toolId: "testssl"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "sqlmap.sqli-probe-plan",
    description:
      "Exposes SQL-injection probe planning and fixture normalization while live sqlmap execution remains blocked pending legal and safety review.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["web", "sqli", "dry-run", "legal-review"],
    inputSchemaRef: "WebSqliProbeTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ExposureValidation", "FixVerification"],
    moduleId: "web.sqli_probe",
    name: "sqlmap SQLi Probe Plan",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "LaterPhase",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "IPRange"],
    safetyLevels: ["ControlledValidation"],
    status: "BlockedLegalReview",
    toolId: "sqlmap"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "nikto.web-server-misconfiguration-import",
    description:
      "Normalizes approved Nikto web-server scan outputs while live Nikto execution remains blocked pending legal and safety review.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["web", "misconfiguration", "import", "legal-review"],
    inputSchemaRef: "WebNiktoScanTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: ["ValidationSnapshot", "ExposureValidation"],
    moduleId: "web.nikto_scan",
    name: "Nikto Scan Import",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "IPRange"],
    safetyLevels: ["ActiveNonInvasive"],
    status: "BlockedLegalReview",
    toolId: "nikto"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "whatweb.technology-fingerprint-import",
    description:
      "Normalizes approved WhatWeb technology-fingerprint outputs while live WhatWeb execution remains blocked pending legal and safety review.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["web", "fingerprint", "import", "legal-review"],
    inputSchemaRef: "WebFingerprintTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "web.fingerprint",
    name: "WhatWeb Fingerprint Import",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "NearTerm",
    requiredIntegrations: [],
    requiredScopes: ["Domain", "Subdomain", "IPRange"],
    safetyLevels: ["PassiveReadOnly"],
    status: "BlockedLegalReview",
    toolId: "whatweb"
  },
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions"
    ],
    capabilityId: "scoutsuite.cloud-posture-import",
    description:
      "Normalizes approved ScoutSuite cloud-posture outputs while live ScoutSuite execution remains blocked pending legal and safety review.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ControlPlane",
    featureTags: ["cloud", "posture", "import", "legal-review"],
    inputSchemaRef: "CloudScoutsuiteTargetSchema",
    interfaceKind: "ValidationModule",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ContinuousValidation"
    ],
    moduleId: "cloud.scoutsuite_posture",
    name: "ScoutSuite Cloud Posture Import",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "LaterPhase",
    requiredIntegrations: ["Cloud"],
    requiredScopes: ["CloudAccount"],
    safetyLevels: ["PassiveReadOnly"],
    status: "BlockedLegalReview",
    toolId: "scoutsuite"
  },
  // Baseline emerging pack per PRD 3.13: OT/ICS safe Attack Pack (non-disruptive, marketplace-distributed, runner-supported)
  {
    apiRoutes: [
      "/api/v1/open-source-tools",
      "/api/v1/open-source-capabilities",
      "/api/v1/modules",
      "/api/v1/missions",
      "/api/v1/runners"
    ],
    capabilityId: "ot_ics.safe_baseline_attackpack",
    description:
      "Scaffold OT/ICS safe profile pack (marketplace metadata). Fixture-only Inconclusive path; live runner profile not implemented. Passive port classification exists separately (ot_ics.protocol_exposure). Partner-lab qualification required before Validated OT claims. No Modbus/DNP3 protocol speak.",
    evidenceTypes: ["NormalizedEvidence"],
    executionMode: "ContentPack",
    featureTags: [
      "ot-ics",
      "ics",
      "attack-pack",
      "edge",
      "marketplace",
      "scaffold",
      "non-disruptive",
      "safe-profile",
      "fixture-only"
    ],
    inputSchemaRef: "OTICSAttackPackTarget",
    interfaceKind: "ContentPack",
    missionTypes: [
      "ValidationSnapshot",
      "ExposureValidation",
      "ControlValidation"
    ],
    moduleId: "ot_ics.safe_baseline",
    name: "OT/ICS Safe Attack Pack (scaffold)",
    outputSchemaRef: "ModuleOutputSchema",
    phase: "Current",
    requiredIntegrations: [],
    requiredScopes: ["InternalNetwork"],
    safetyLevels: ["PassiveReadOnly"],
    status: "FixtureOnly",
    toolId: "periscan-ot-ics-pack"
  },
  ...COMMUNITY_POPULAR_OSS_CAPABILITIES,
  ...SECURITY_CATALOG_EXPANSION_CAPABILITIES
] satisfies OpenSourceCapability[];

const capabilitiesByToolId = new Map<
  OpenSourceToolId,
  OpenSourceCapability[]
>();

for (const capability of OPEN_SOURCE_CAPABILITY_DEFINITIONS) {
  const parsedCapability = normalizeCatalogCapability(capability);
  const existing = capabilitiesByToolId.get(parsedCapability.toolId) ?? [];

  existing.push(parsedCapability);
  capabilitiesByToolId.set(parsedCapability.toolId, existing);
}

function getCapabilityCounts(capabilities: OpenSourceCapability[]) {
  return {
    blocked: capabilities.filter((item) => item.status === "BlockedLegalReview")
      .length,
    deferred: capabilities.filter((item) => item.status === "Deferred").length,
    fixtureOnly: capabilities.filter((item) => item.status === "FixtureOnly")
      .length,
    implemented: capabilities.filter((item) => item.status === "Implemented")
      .length,
    planned: capabilities.filter((item) => item.status === "Planned").length,
    total: capabilities.length
  };
}

function getToolReadiness(capabilities: OpenSourceCapability[]) {
  if (capabilities.some((item) => item.status === "Implemented")) {
    return capabilities.every((item) => item.status === "Implemented")
      ? "Implemented"
      : "Partial";
  }

  if (capabilities.some((item) => item.status === "FixtureOnly")) {
    return "Partial";
  }

  if (capabilities.some((item) => item.status === "BlockedLegalReview")) {
    return "Blocked";
  }

  return "Planned";
}

function createToolCatalogEntry(tool: OpenSourceToolDefinition) {
  const capabilities = capabilitiesByToolId.get(tool.toolId) ?? [];
  const capabilityCounts = getCapabilityCounts(capabilities);

  return OpenSourceToolCatalogEntrySchema.parse({
    capabilities,
    capabilityCounts,
    readiness: getToolReadiness(capabilities),
    tool
  });
}

function getEnvPrefix(toolId: OpenSourceToolId) {
  return `PERISCAN_${toolId.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`;
}

export function getOpenSourceToolEnvPrefix(toolId: OpenSourceToolId) {
  return getEnvPrefix(toolId);
}

async function findExecutableOnPath(
  executableName: string,
  env: NodeJS.ProcessEnv
) {
  const pathEntries = (env.PATH ?? "").split(path.delimiter).filter(Boolean);

  for (const entry of pathEntries) {
    const candidate = path.join(entry, executableName);

    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function getConfiguredVersion(
  tool: OpenSourceToolDefinition,
  env: NodeJS.ProcessEnv
) {
  return env[`${getEnvPrefix(tool.toolId)}_VERSION`] ?? tool.defaultVersion;
}

export interface OpenSourceCatalogFilterOptions {
  includeDeferred?: boolean;
  includeLegalReview?: boolean;
  phase?: OpenSourceToolDefinition["phase"] | "all";
}

function isToolVisible(
  tool: OpenSourceToolDefinition,
  filters: OpenSourceCatalogFilterOptions = {}
) {
  const includeDeferred = filters.includeDeferred ?? false;
  const includeLegalReview = filters.includeLegalReview ?? false;
  const phase =
    filters.phase === "CurrentMvp" ? "Current" : (filters.phase ?? "Current");

  if (phase !== "all" && tool.phase !== phase) {
    return false;
  }

  if (tool.policyStatus === "RequiresLegalReview") {
    return includeLegalReview;
  }

  if (tool.policyStatus === "Deferred") {
    return includeDeferred;
  }

  return true;
}

export function listOpenSourceToolDefinitions(
  filters: OpenSourceCatalogFilterOptions = {}
) {
  return [...toolsById.values()].filter((tool) => isToolVisible(tool, filters));
}

export function getOpenSourceToolDefinition(toolId: OpenSourceToolId) {
  return toolsById.get(toolId) ?? null;
}

export function listOpenSourceCapabilities(
  filters: OpenSourceCatalogFilterOptions = {}
) {
  return OPEN_SOURCE_CAPABILITY_DEFINITIONS.filter((capability) => {
    const tool = getOpenSourceToolDefinition(capability.toolId);

    return tool ? isToolVisible(tool, filters) : false;
  }).map((capability) => normalizeCatalogCapability(capability));
}

export function listOpenSourceToolCatalog(
  filters: OpenSourceCatalogFilterOptions = {}
) {
  return [...toolsById.values()]
    .filter((tool) => isToolVisible(tool, filters))
    .map((tool) => createToolCatalogEntry(tool));
}

export function getOpenSourceToolCatalogEntry(toolId: OpenSourceToolId) {
  const tool = getOpenSourceToolDefinition(toolId);

  return tool ? createToolCatalogEntry(tool) : null;
}

function getExecutionReadiness(
  tool: OpenSourceToolDefinition,
  capability: OpenSourceCapability,
  runtime: ToolRuntimeResolution
): OpenSourceExecutionReadiness {
  if (
    tool.policyStatus === "RequiresLegalReview" ||
    capability.status === "BlockedLegalReview"
  ) {
    return "Blocked";
  }

  if (
    tool.toolId === "caldera" ||
    capability.safetyLevels.includes("AdvancedAdversarial")
  ) {
    return "Blocked";
  }

  if (tool.policyStatus === "Deferred" || capability.status === "Deferred") {
    return "Deferred";
  }

  if (capability.status === "FixtureOnly") {
    return "FixtureOnly";
  }

  return runtime.available ? "Ready" : "Unavailable";
}

function enrichCapabilityWithRuntime(
  tool: OpenSourceToolDefinition,
  capability: OpenSourceCapability,
  runtime: ToolRuntimeResolution,
  lastCheckedAt: string
) {
  return OpenSourceCapabilitySchema.parse({
    ...capability,
    executionReadiness: getExecutionReadiness(tool, capability, runtime),
    lastCheckedAt,
    runtimeAvailable: runtime.available,
    runtimeKind: runtime.runtime,
    runtimeReason: runtime.available ? runtime.displayCommand : runtime.reason
  });
}

function enrichCatalogEntryWithRuntime(
  entry: ReturnType<typeof createToolCatalogEntry>,
  runtime: ToolRuntimeResolution,
  lastCheckedAt: string
) {
  const capabilities = entry.capabilities.map((capability) =>
    enrichCapabilityWithRuntime(entry.tool, capability, runtime, lastCheckedAt)
  );
  const hasBlockedCapability = capabilities.some(
    (capability) => capability.executionReadiness === "Blocked"
  );
  const onlyFixtureOnlyCapabilities =
    capabilities.length > 0 &&
    capabilities.every(
      (capability) => capability.executionReadiness === "FixtureOnly"
    );
  const executionReadiness: OpenSourceExecutionReadiness =
    entry.tool.policyStatus === "RequiresLegalReview" || hasBlockedCapability
      ? "Blocked"
      : entry.tool.policyStatus === "Deferred"
        ? "Deferred"
        : onlyFixtureOnlyCapabilities
          ? "FixtureOnly"
          : runtime.available
            ? "Ready"
            : "Unavailable";

  return OpenSourceToolCatalogEntrySchema.parse({
    ...entry,
    capabilities,
    executionReadiness,
    lastCheckedAt,
    runtimeAvailable: runtime.available,
    runtimeKind: runtime.runtime,
    runtimeReason: runtime.available ? runtime.displayCommand : runtime.reason
  });
}

export async function listOpenSourceCapabilitiesWithRuntime(
  filters: OpenSourceCatalogFilterOptions = {},
  env: NodeJS.ProcessEnv = process.env
) {
  const lastCheckedAt = new Date().toISOString();
  const runtimeByToolId = new Map<OpenSourceToolId, ToolRuntimeResolution>();
  const capabilities = listOpenSourceCapabilities(filters);

  for (const capability of capabilities) {
    if (!runtimeByToolId.has(capability.toolId)) {
      runtimeByToolId.set(
        capability.toolId,
        await resolveOpenSourceToolRuntime(capability.toolId, env)
      );
    }
  }

  return capabilities.map((capability) => {
    const tool = getOpenSourceToolDefinition(capability.toolId);
    const runtime = runtimeByToolId.get(capability.toolId);

    if (!tool || !runtime) {
      return capability;
    }

    return enrichCapabilityWithRuntime(
      tool,
      capability,
      runtime,
      lastCheckedAt
    );
  });
}

export async function listOpenSourceToolCatalogWithRuntime(
  filters: OpenSourceCatalogFilterOptions = {},
  env: NodeJS.ProcessEnv = process.env
) {
  const lastCheckedAt = new Date().toISOString();
  const entries = listOpenSourceToolCatalog(filters);

  return Promise.all(
    entries.map(async (entry) =>
      enrichCatalogEntryWithRuntime(
        entry,
        await resolveOpenSourceToolRuntime(entry.tool.toolId, env),
        lastCheckedAt
      )
    )
  );
}

export async function getOpenSourceToolCatalogEntryWithRuntime(
  toolId: OpenSourceToolId,
  env: NodeJS.ProcessEnv = process.env
) {
  const entry = getOpenSourceToolCatalogEntry(toolId);

  if (!entry) {
    return null;
  }

  return enrichCatalogEntryWithRuntime(
    entry,
    await resolveOpenSourceToolRuntime(toolId, env),
    new Date().toISOString()
  );
}

export function getOpenSourceToolHome(env: NodeJS.ProcessEnv = process.env) {
  return path.resolve(env.PERISCAN_OSS_TOOL_HOME ?? ".periscan/oss");
}

export function getOpenSourceToolCheckoutPath(
  toolId: OpenSourceToolId,
  env: NodeJS.ProcessEnv = process.env
) {
  return path.join(getOpenSourceToolHome(env), toolId);
}

export function getDefaultDockerImageRef(
  tool: OpenSourceToolDefinition,
  env: NodeJS.ProcessEnv = process.env
) {
  const explicit = env[`${getEnvPrefix(tool.toolId)}_IMAGE`];

  if (explicit) {
    return explicit;
  }

  if (!tool.dockerImage) {
    return null;
  }

  return `${tool.dockerImage}:${getConfiguredVersion(tool, env)}`;
}

export async function resolveOpenSourceToolRuntime(
  toolId: OpenSourceToolId,
  env: NodeJS.ProcessEnv = process.env
): Promise<ToolRuntimeResolution> {
  const tool = getOpenSourceToolDefinition(toolId);

  if (!tool) {
    throw new Error(`Unknown OSS tool: ${toolId}`);
  }

  const envPrefix = getEnvPrefix(tool.toolId);
  const requestedRuntime = env[`${envPrefix}_RUNTIME`] as
    | OpenSourceToolRuntime
    | undefined;
  const runtimesToTry = requestedRuntime
    ? [requestedRuntime]
    : tool.runtimePreference;
  const version = getConfiguredVersion(tool, env);

  for (const runtime of runtimesToTry) {
    if (!tool.runtimePreference.includes(runtime)) {
      continue;
    }

    switch (runtime) {
      case "binary": {
        if (!tool.binaryName) {
          break;
        }

        const explicitBinary = env[`${envPrefix}_BINARY`] ?? null;
        const command =
          explicitBinary ?? (await findExecutableOnPath(tool.binaryName, env));

        if (!command) {
          break;
        }

        return ToolRuntimeResolutionSchema.parse({
          available: true,
          command,
          displayCommand: command,
          imageRef: null,
          reason: null,
          runtime,
          tool,
          version
        });
      }

      case "docker": {
        const docker = await findExecutableOnPath("docker", env);
        const imageRef = getDefaultDockerImageRef(tool, env);

        if (!docker || !imageRef) {
          break;
        }

        return ToolRuntimeResolutionSchema.parse({
          available: true,
          command: docker,
          displayCommand: `${docker} run --rm ${imageRef}`,
          imageRef,
          reason: null,
          runtime,
          tool,
          version
        });
      }

      case "npx": {
        if (!tool.npmPackage) {
          break;
        }

        const npx = await findExecutableOnPath("npx", env);

        if (!npx) {
          break;
        }

        return ToolRuntimeResolutionSchema.parse({
          available: true,
          command: npx,
          displayCommand: `${npx} ${tool.npmPackage}@${version}`,
          imageRef: null,
          reason: null,
          runtime,
          tool,
          version
        });
      }

      case "pip": {
        if (!tool.pipPackage) {
          break;
        }

        const pip = await findExecutableOnPath("pip", env);
        const python = await findExecutableOnPath("python", env);

        if (!pip && !python) {
          break;
        }

        const command = pip ?? python!;
        const displayCommand = pip
          ? `${pip} install ${tool.pipPackage}==${version}`
          : `${python} -m pip install ${tool.pipPackage}==${version}`;

        return ToolRuntimeResolutionSchema.parse({
          available: true,
          command,
          displayCommand,
          imageRef: null,
          reason: null,
          runtime,
          tool,
          version
        });
      }

      case "git": {
        if (!tool.gitRepo) {
          break;
        }

        const git = await findExecutableOnPath("git", env);

        if (!git) {
          break;
        }

        return ToolRuntimeResolutionSchema.parse({
          available: true,
          command: git,
          displayCommand: `${git} clone ${tool.gitRepo}`,
          imageRef: null,
          reason: null,
          runtime,
          tool,
          version
        });
      }
    }
  }

  return ToolRuntimeResolutionSchema.parse({
    available: false,
    command: null,
    displayCommand: `unavailable:${tool.toolId}`,
    imageRef: null,
    reason: `No supported runtime is currently available for ${tool.displayName}.`,
    runtime: null,
    tool,
    version
  });
}
