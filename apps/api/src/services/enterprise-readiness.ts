import { getConnectorCatalogEntryByKey } from "@periscan/connectors";
import { getModuleById } from "@periscan/modules";
import {
  EnterpriseBreadthReadinessSchema,
  type EnterpriseBreadthReadiness,
  type EnterpriseReadinessCheck,
  type Integration
} from "@periscan/shared";

function integrationConnectorKey(integration: Integration) {
  const summary = integration.permissionsSummary;
  const config = integration.config;
  const key = summary.connectorKey ?? config?.connectorKey;
  return typeof key === "string" ? key : null;
}

function operationalConnectorKeys(integrations: Integration[]) {
  return new Set(
    integrations
      .filter(
        (integration) =>
          integration.status === "Connected" &&
          integration.healthStatus === "Healthy"
      )
      .map(integrationConnectorKey)
      .filter((key): key is string => key !== null)
  );
}

function connectorCheck(input: {
  connectorKey: string;
  label: string;
  operational: Set<string>;
}): EnterpriseReadinessCheck {
  const catalog = getConnectorCatalogEntryByKey(input.connectorKey);
  const configured = input.operational.has(input.connectorKey);

  return {
    actionHref: configured ? null : "/integrations",
    detail: configured
      ? "A healthy tenant connector is available for measured collection."
      : catalog?.connectable
        ? "The dedicated connector is implemented; add and health-check customer credentials."
        : "No connectable dedicated connector is available.",
    key: `connector.${input.connectorKey}`,
    label: input.label,
    state: configured ? "Satisfied" : "ActionRequired"
  };
}

function implementedModuleCheck(input: {
  label: string;
  moduleId: string;
}): EnterpriseReadinessCheck {
  const manifest = getModuleById(input.moduleId)?.manifest;
  return {
    actionHref: manifest ? null : "/registry",
    detail: manifest
      ? `${manifest.name} ${manifest.version} is registered as ${manifest.safetyLevel}.`
      : "The required validation module is not registered.",
    key: `module.${input.moduleId}`,
    label: input.label,
    state: manifest ? "Satisfied" : "ActionRequired"
  };
}

export function buildEnterpriseBreadthReadiness(input: {
  confidentialAttestation?: {
    checkedAt: string;
    outcome: "Verified" | "Rejected" | "NotConfigured";
    provider: string;
    workloadId: string;
  } | null;
  integrations: Integration[];
  nonHumanIdentityCount: number;
  now?: Date;
}): EnterpriseBreadthReadiness {
  const operational = operationalConnectorKeys(input.integrations);
  const sspmConnectors = [
    connectorCheck({
      connectorKey: "microsoft-entra-id",
      label: "Microsoft Entra / Microsoft 365 identity posture",
      operational
    }),
    connectorCheck({
      connectorKey: "google-workspace",
      label: "Google Workspace posture",
      operational
    }),
    connectorCheck({
      connectorKey: "salesforce",
      label: "Salesforce organization and identity posture",
      operational
    }),
    connectorCheck({
      connectorKey: "okta",
      label: "Okta identity and MFA posture",
      operational
    })
  ];
  const sscsConnectors = [
    connectorCheck({
      connectorKey: "github",
      label: "GitHub repository and workflow source",
      operational
    }),
    connectorCheck({
      connectorKey: "gitlab",
      label: "GitLab repository and pipeline source",
      operational
    }),
    connectorCheck({
      connectorKey: "jenkins",
      label: "Jenkins pipeline source",
      operational
    })
  ];
  const endpointTelemetryConnectors = [
    connectorCheck({
      connectorKey: "crowdstrike",
      label: "CrowdStrike endpoint telemetry",
      operational
    }),
    connectorCheck({
      connectorKey: "microsoft-defender-xdr",
      label: "Microsoft Defender XDR endpoint telemetry",
      operational
    }),
    connectorCheck({
      connectorKey: "sentinelone",
      label: "SentinelOne endpoint telemetry",
      operational
    })
  ];
  const kubernetesConnector = connectorCheck({
    connectorKey: "kubernetes",
    label: "Kubernetes read-only inventory and control source",
    operational
  });
  // P10-16: network / SSE enforcement pack — optional satisfied-if-connected.
  const networkEnforcementConnectors = [
    connectorCheck({
      connectorKey: "cisco-umbrella",
      label: "Cisco Umbrella DNS / SSE observer",
      operational
    }),
    connectorCheck({
      connectorKey: "zscaler-zia",
      label: "Zscaler Internet Access (ZIA) observer",
      operational
    }),
    connectorCheck({
      connectorKey: "palo-panorama",
      label: "Palo Alto Panorama / PAN-OS log observer",
      operational
    }),
    connectorCheck({
      connectorKey: "fortinet-fortigate",
      label: "Fortinet FortiGate firewall observer",
      operational
    }),
    connectorCheck({
      connectorKey: "cloudflare",
      label: "Cloudflare edge / SSE observer",
      operational
    })
  ];

  return EnterpriseBreadthReadinessSchema.parse({
    generatedAt: (input.now ?? new Date()).toISOString(),
    packs: [
      {
        checks: [
          {
            actionHref: "/workflows",
            detail: input.confidentialAttestation
              ? `${input.confidentialAttestation.provider} verifier result for ${input.confidentialAttestation.workloadId}: ${input.confidentialAttestation.outcome} at ${input.confidentialAttestation.checkedAt}.`
              : "No TEE or confidential-GPU attestation has been verified. OCI and container signatures remain software provenance only.",
            key: "agent-trust.confidential-attestation",
            label: "Confidential deployment attestation",
            state:
              input.confidentialAttestation?.outcome === "Verified"
                ? "Satisfied"
                : "ActionRequired"
          },
          {
            actionHref: "/workflows",
            detail:
              "External MCP and A2A endpoints are tenant-reviewed, capability-allowlisted, and bound to short-lived signed receipts before artifact exchange.",
            key: "agent-trust.interoperability",
            label: "Agent protocol trust boundary",
            state: "Satisfied"
          }
        ],
        description:
          "External agent interoperability and confidential-compute claims are admitted through explicit tenant trust, cryptographic freshness, and verifier evidence.",
        key: "agent-trust",
        name: "Agent interoperability & confidential proof",
        state:
          input.confidentialAttestation?.outcome === "Verified"
            ? "Operational"
            : "Configurable"
      },
      {
        checks: [
          {
            actionHref:
              input.nonHumanIdentityCount > 0 ? null : "/non-human-identities",
            detail:
              input.nonHumanIdentityCount > 0
                ? `${input.nonHumanIdentityCount} secret-free machine identity records are tenant-scoped and risk-ranked.`
                : "The inventory and risk engine are available; register or ingest machine identities to make it operational.",
            key: "nhi.inventory",
            label: "Non-human identity inventory",
            state:
              input.nonHumanIdentityCount > 0 ? "Satisfied" : "ActionRequired"
          }
        ],
        description:
          "Owner, privilege, rotation, expiry, public exposure, and resource-edge risk without storing reusable plaintext credentials.",
        key: "nhi",
        name: "Machine identity sprawl",
        state: input.nonHumanIdentityCount > 0 ? "Operational" : "Configurable"
      },
      {
        checks: [
          implementedModuleCheck({
            label: "Native normalized SaaS posture rules",
            moduleId: "sspm.saas_posture"
          }),
          ...sspmConnectors
        ],
        description:
          "Measured SaaS configuration posture for core identity and collaboration platforms; absent connector input remains Inconclusive.",
        key: "sspm",
        name: "Native SaaS posture",
        state: sspmConnectors.some((check) => check.state === "Satisfied")
          ? "Operational"
          : "Configurable"
      },
      {
        checks: [
          implementedModuleCheck({
            label:
              "Pipeline policy, OIDC, signing, provenance, and SLSA evaluator",
            moduleId: "sscs.pipeline_audit"
          }),
          ...sscsConnectors
        ],
        description:
          "Static pipeline-policy checks plus independently measured OIDC trust, artifact signatures, provenance, and SLSA policy evidence.",
        key: "sscs",
        name: "Software supply-chain validation",
        state: sscsConnectors.some((check) => check.state === "Satisfied")
          ? "Operational"
          : "Configurable"
      },
      {
        checks: [
          implementedModuleCheck({
            label: "macOS endpoint detection analytics",
            moduleId: "periscan.endpoint_macos_detection_analytics"
          }),
          implementedModuleCheck({
            label: "Linux endpoint detection analytics",
            moduleId: "periscan.endpoint_linux_detection_analytics"
          }),
          ...endpointTelemetryConnectors
        ],
        description:
          "Platform-specific ATT&CK and exact-canary correlation. A Missed verdict requires verified live telemetry, a matching emission receipt, and a completed observation window.",
        key: "endpoint-detection-analytics",
        name: "macOS & Linux detection analytics",
        state: endpointTelemetryConnectors.some(
          (check) => check.state === "Satisfied"
        )
          ? "Operational"
          : "Configurable"
      },
      {
        checks: [
          implementedModuleCheck({
            label: "Kubernetes CIS posture normalizer",
            moduleId: "periscan.kubernetes_cis_posture"
          }),
          implementedModuleCheck({
            label: "Trivy container image validation",
            moduleId: "trivy.container_scan"
          }),
          kubernetesConnector
        ],
        description:
          "Read-only Kubernetes CIS and container risk evidence. Supplied clean reports remain unverified until collection provenance is live and healthy.",
        key: "kubernetes-container",
        name: "Kubernetes & container validation",
        state:
          kubernetesConnector.state === "Satisfied"
            ? "Operational"
            : "Configurable"
      },
      {
        checks: networkEnforcementConnectors,
        description:
          "Network / SSE enforcement observers (Umbrella, Zscaler, Panorama, FortiGate, Cloudflare). Optional satisfied-if-connected — enterprise breadth stays Configurable until at least one healthy network-layer observer is present.",
        key: "network-sse-enforcement",
        name: "Network / SSE enforcement",
        state: networkEnforcementConnectors.some(
          (check) => check.state === "Satisfied"
        )
          ? "Operational"
          : "Configurable"
      },
      {
        checks: [
          implementedModuleCheck({
            label: "Non-disruptive industrial protocol exposure evaluator",
            moduleId: "ot_ics.protocol_exposure"
          }),
          {
            actionHref: null,
            detail:
              "Scorecard #26 OT/ICS Attack Packs: no partner-lab qualification receipt is configured. Periscan will not label this an OT attack pack or send industrial-protocol traffic (never speaks Modbus/DNP3).",
            key: "ot.partner-qualification",
            label: "Independent partner-lab qualification",
            state: "ExternalDependency"
          }
        ],
        description:
          "Scorecard #26 Partner-gated. Passive analysis of previously observed reachability; active protocol interaction stays excluded for fragile environments. Scaffold/gated until partner-lab qualification.",
        key: "ot-ics",
        name: "OT / ICS passive validation",
        state: "ExternallyGated"
      },
      {
        checks: [
          {
            actionHref: "/integrations",
            detail: operational.has("intel471")
              ? "Intel 471 finished-intelligence reporting is connected, but it is not a privacy-preserving credential-match feed (scorecard #2 dark-web monitoring remains Partner-gated)."
              : "Scorecard #2 Dark Web & Credential Monitoring: a real Intel 471 finished-intelligence connector is available, but no credential-match / dark-web feed is configured.",
            key: "credential.intelligence-source",
            label: "Licensed breach-corpus credential status",
            state: "ExternalDependency"
          },
          {
            actionHref: null,
            detail:
              "No contracted provider, k-anonymized match contract, or rotation-verification receipt exists; Periscan makes no dark-web or credential-exposure claim and will not invent a crawl product.",
            key: "credential.privacy-match",
            label: "Privacy-preserving matching and rotation proof",
            state: "ExternalDependency"
          }
        ],
        description:
          "Scorecard #2 Partner-gated. Licensed breach-corpus matching is intentionally distinct from general threat-intelligence reports and never stores reusable credentials. NotConfigured without partner contract.",
        key: "credential-exposure",
        name: "Credential exposure monitoring",
        state: "ExternallyGated"
      },
      {
        checks: [
          {
            actionHref: null,
            detail:
              "Scorecard #28 Crowdsourced HITL: no approved human-testing partner contract or vetted-operator roster is configured. Periscan will not present internal approvals as a crowdsourced marketplace.",
            key: "human.partner-contract",
            label: "Approved human-validation partner",
            state: "ExternalDependency"
          },
          {
            actionHref: null,
            detail:
              "Partner identity, scope acknowledgement, evidence custody, and finding-review handoff must be implemented and tested after partner selection. Programmatic HITL interrupts (row 42) are a separate product path.",
            key: "human.evidence-handoff",
            label: "Governed partner evidence handoff",
            state: "ExternalDependency"
          }
        ],
        description:
          "Scorecard #28 Partner-gated. Human expertise can augment automated validation only through a contracted, identity-bound, scope-aware evidence workflow — never a productized pentester marketplace.",
        key: "human-validation",
        name: "Human expert validation",
        state: "ExternallyGated"
      },
      {
        checks: [
          {
            actionHref: "/reports",
            detail:
              "A live tenant-isolation and data-protection proof pack can be generated from database policy, evidence-chain, region, encryption, and share state.",
            key: "assurance.isolation-proof",
            label: "Tenant-isolation proof pack",
            state: "Satisfied"
          },
          {
            actionHref: "/billing",
            detail:
              "Time-boxed trial entitlements, expiry, retention review, cancellation, and approved conversion are implemented without payment claims.",
            key: "commercial.trial",
            label: "Governed trial lifecycle",
            state: "Satisfied"
          },
          {
            actionHref: null,
            detail:
              "Cloud-marketplace procurement remains disabled until pricing, tax, support, legal, and data-processing approvals are recorded.",
            key: "commercial.marketplace",
            label: "Marketplace procurement",
            state: "ExternalDependency"
          }
        ],
        description:
          "Operational assurance and commercial workflows expose their approval boundaries rather than implying unavailable procurement automation.",
        key: "assurance-commercial",
        name: "Enterprise assurance & procurement",
        state: "ExternallyGated"
      }
    ]
  });
}
