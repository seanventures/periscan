import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrustSafetyDashboard } from "./trust-safety-dashboard";

describe("TrustSafetyDashboard v2", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("discloses tenant storage routing, encryption, subprocessors, and BAA state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/security-settings/require-mfa")) {
          return new Response(
            JSON.stringify({
              effectiveRequireMfa: true,
              envRequireMfa: false,
              requireMfa: true
            }),
            { status: 200 }
          );
        }
        if (url.includes("/safety-settings")) {
          return new Response(
            JSON.stringify({
              authorizationReference: null,
              authorizedAt: null,
              authorizedBy: null,
              destructiveAuthorizationReference: null,
              destructiveAuthorizedAt: null,
              destructiveAuthorizedBy: null,
              destructiveValidationEnabled: false,
              effectiveMaxSafetyLevel: "BASLite",
              offensiveValidationEnabled: false
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            auditLogPath: "/api/v1/audit-events",
            connectedIntegrations: [],
            dataGovernance: {
              availableRegions: [
                { id: "eu-central-1", label: "European Union · Frankfurt" },
                { id: "us-east-1", label: "United States · East" }
              ],
              baaReferenceUrl: null,
              baaStatus: "NotConfigured",
              dataCategoriesProcessed: [
                "Account identity (email, display name)",
                "Tenant membership and role assignments",
                "Authorized scope metadata and verification state",
                "Validation findings, attack paths, and remediation records",
                "Evidence metadata and redacted artifacts",
                "Integration configuration (credentials encrypted at rest when keys are set)",
                "Security audit events"
              ],
              dataSubjectRequestProcess:
                "Data subject access, export, and deletion requests are sales-assisted until a published DPA is linked.",
              dpaReferenceUrl: null,
              dpaStatus: "NotConfigured",
              encryptionAtRestDetails: "Provider-managed AES-256 encryption.",
              encryptionAtRestStatus: "Configured",
              routingStatus: "RegionRouted",
              selectedRegion: "eu-central-1",
              selectedRegionStorageConfigured: true,
              subprocessors: [
                {
                  name: "Example Storage",
                  privacyUrl: "https://storage.example.com/privacy",
                  purpose: "Evidence object storage"
                }
              ],
              subprocessorsHonesty:
                "Subprocessor list is deployment-configured. Confirm completeness against the live MSA/DPA annex before production use.",
              subprocessorsStatus: "Configured"
            },
            evidenceRetention: {
              artifactStorage: "S3-compatible object storage",
              notes: "Configured.",
              redactionEnabled: true,
              retentionPeriodDays: 90,
              retentionPolicyStatus: "Configured",
              tenantScopedAccess: true
            },
            identityProvisioning: {
              planeStatus: "Partial",
              planeStatusDetail:
                "Partial IdP plane: SSO/MFA/role map ship; SCIM/JIT NotConfigured.",
              orderFormDoc: "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md",
              residualDoc: "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
              advancedRbac: {
                availableRoles: ["Owner", "Admin", "SecurityEngineer", "Viewer", "MSSPOwner", "ClientAdmin"],
                customRolesSupported: false,
                detail: "Baseline multi-role only.",
                status: "BaselineRolesOnly"
              },
              jitProvisioning: {
                defaultRoleIfEnabled: "Viewer",
                detail: "JIT membership on first SSO is NotConfigured.",
                requiresDomainAllowlist: true,
                status: "NotConfigured"
              },
              scimInbound: {
                discoveryPath: "/api/v1/scim/v2/ServiceProviderConfig",
                detail: "NotConfigured.",
                inventoryConnectorsNote: "Inventory only.",
                status: "NotConfigured"
              }
            },
            enterpriseCommercial: {
              auditStreaming: {
                continuousStreamStatus: "NotConfigured",
                detail: "Pull-export only.",
                exportPath: "/api/v1/audit-events",
                maxExportEvents: 5000,
                status: "PullExportOnly",
                webhookCatalogNote: "Selected product events only."
              },
              multiRegionResidency: {
                detail: "Multi-region configured.",
                status: "RegionRouted"
              },
              paymentSettlement: {
                detail: "Ledger without bank.",
                status: "NotConfigured"
              },
              publicSlaStatusPage: {
                detail: "No public status page.",
                status: "NotConfigured"
              },
              rfpDefaultScope: {
                detail: "Proof loop default.",
                excludedLabsSurfaces: ["MCP Server"],
                includedSurfaces: ["Validation Snapshot"]
              },
              vendorSoc2Attestation: {
                detail: "Not vendor Type II.",
                status: "NotClaimed"
              }
            },
            marketPresence: {
              banner: "Zero customer references — Wave market presence not met",
              disclaimer:
                "Product alone never grants Wave or MQ market presence.",
              marketPresenceEligible: false,
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              publicCaseStudyCount: 0,
              publicLogoCount: 0,
              publicReferenceCount: 0,
              productionDesignPartnerReferenceCount: 0,
              referencePack: {
                inventoryEmpty: true,
                kpis: {
                  icpSessionsCompleted: 0,
                  icpSessionsTarget: 5,
                  paidInvoiceConversions: 0,
                  publicCaseStudies: 0,
                  publicLogos: 0,
                  referenceableProductionTenants: 0,
                  signedReferenceCallPermissions: 0
                },
                gates: [
                  {
                    gateId: "G0",
                    label: "Honest pre-commercial posture",
                    status: "RequiredNow",
                    notes: "Zero references = market presence fail."
                  }
                ],
                packStatus: "Empty",
                sourceDoc: "docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md"
              },
              signedReferencePermissionCount: 0,
              waveMarketPresenceGate: "Fail"
            },
            operationalReadiness: {
              controls: [
                {
                  controlId: "object-storage-retention",
                  notes: "Configured.",
                  status: "Configured",
                  title: "Object storage retention",
                  value: "90 days"
                }
              ],
              environment: "production",
              notes: "Configured.",
              overallStatus: "Configured"
            },
            runnerSecurityModel: {
              gatewayHostnames: ["app.periscan.com"],
              inboundFirewallRuleRequired: false,
              killSwitchAvailable: true,
              localAuditLogsRequired: true,
              outboundOnly: true,
              scopeEnforcementRequired: true,
              taskSigningRequired: true,
              transport: "Outbound HTTPS"
            },
            vendorAssurance: {
              customerEvidencePacksNote:
                "Product SOC 2 packs are customer evidence support only, not vendor Type II.",
              detail:
                "Periscan does not currently publish a vendor SOC 2 Type II report.",
              soc2TypeIiStatus: "None"
            },
            tenantId: "11111111-1111-4111-8111-111111111111",
            validationSafetyPrinciples: [
              {
                description: "Verified scope is required.",
                principleId: "verified-scope",
                title: "Verified scope"
              }
            ]
          }),
          { status: 200 }
        );
      })
    );

    render(<TrustSafetyDashboard />);

    expect(
      await screen.findByRole("heading", {
        name: "Data residency & processing"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("eu-central-1")).toBeInTheDocument();
    expect(
      screen.getByText("Provider-managed AES-256 encryption.")
    ).toBeInTheDocument();
    expect(screen.getByText("Enterprise commercial honesty")).toBeInTheDocument();
    expect(screen.getAllByText("NotClaimed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("PullExportOnly")).toBeInTheDocument();
    expect(screen.getByText("Example Storage")).toBeInTheDocument();
    expect(screen.getByText("Not published")).toBeInTheDocument();
    expect(
      screen.getByText(/Partial — not full IdP lifecycle/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Inbound SCIM for Periscan users/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Not SCIM for Periscan users/i)).toBeInTheDocument();
    // PERISCAN-30: Partial plane vs NotConfigured SCIM/JIT + order-form CTA
    expect(
      screen.getByTestId("identity-lifecycle-trust-panel")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("identity-plane-status-legend")
    ).toHaveTextContent(/NotConfigured/i);
    expect(screen.getByTestId("identity-order-form-cta")).toHaveTextContent(
      /order form|ENTERPRISE_IDENTITY_LIFECYCLE|order-form next steps/i
    );
    expect(screen.getByTestId("identity-order-form-cta")).toHaveTextContent(
      /ENTERPRISE_TRUST_RESIDUAL/i
    );
    // Identity panel: order-form next steps ≤3 bullets (P03 polish).
    const nextSteps = screen.getByTestId("identity-order-form-next-steps");
    expect(nextSteps.tagName.toLowerCase()).toBe("ol");
    expect(nextSteps.querySelectorAll("li").length).toBeLessThanOrEqual(3);
    expect(nextSteps.querySelectorAll("li").length).toBe(3);
    expect(screen.getAllByText("NotConfigured").length).toBeGreaterThanOrEqual(
      2
    );
    // E13 trust pack surface + GTM claim language (shared contract)
    expect(screen.getByText("Enterprise trust pack")).toBeInTheDocument();
    expect(screen.getByText("Zero references (fail)")).toBeInTheDocument();
    // P03: procurement fill checklist — honest NotConfigured + doc links
    expect(screen.getByTestId("trust-pack-checklist")).toBeInTheDocument();
    expect(screen.getByTestId("trust-pack-item-dpa")).toHaveTextContent(
      /NotConfigured/i
    );
    expect(screen.getByTestId("trust-pack-item-dpa")).toHaveTextContent(
      "docs/trust/LEGAL_PACK.md"
    );
    expect(screen.getByTestId("trust-pack-item-pen-test")).toHaveTextContent(
      /NotConfigured/i
    );
    expect(screen.getByTestId("trust-pack-item-pen-test")).toHaveTextContent(
      "docs/trust/PEN_TEST_ENGAGEMENT.md"
    );
    expect(screen.getByTestId("trust-pack-item-subprocessors")).toHaveTextContent(
      /Configured|NotConfigured/i
    );
    expect(screen.getByTestId("trust-pack-item-subprocessors")).toHaveTextContent(
      "docs/trust/LEGAL_PACK.md"
    );
    expect(screen.getByText("GTM claim language")).toBeInTheDocument();
    expect(
      screen.getByText(/Measured exposure on verified authorized scope/i)
    ).toBeInTheDocument();
    expect(screen.getByText("BaselineRolesOnly")).toBeInTheDocument();
    // P12-6 / PERISCAN-431: live market presence surface (not fabricated refs)
    expect(
      screen.getByTestId("market-presence-zero-refs-banner")
    ).toHaveTextContent(
      "Zero customer references — Wave market presence not met"
    );
    expect(screen.getByText("Market presence readiness")).toBeInTheDocument();
    expect(
      screen.getByTestId("market-presence-readiness-panel")
    ).toBeInTheDocument();
    expect(screen.getByText("Reference pack checklist")).toBeInTheDocument();
    expect(screen.getByText(/inventory empty/i)).toBeInTheDocument();
    expect(
      screen.getAllByText("docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md")
        .length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Not Leaders-ready while/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/MQ Fail|MQ market presence/i).length
    ).toBeGreaterThanOrEqual(1);
    // G1 path-to-first design partner CTA (protocol, not fake logos)
    expect(
      screen.getByTestId("path-to-first-design-partner-cta")
    ).toHaveTextContent(/Path to first design partner/i);
    expect(
      screen.getByTestId("path-to-first-design-partner-cta")
    ).toHaveTextContent("docs/DESIGN_PARTNER/REFERENCE_FACTORY.md");
    expect(
      screen.getByRole("link", { name: /Validation Snapshot/i })
    ).toHaveAttribute("href", "/missions");
  });
});
