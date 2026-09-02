/**
 * External integration maturity tiers (P12-14).
 *
 * Customer/analyst-facing Production / Beta / Planned table. Distinct from
 * internal implementationTier (DedicatedClient / StandardizedCatalog).
 *
 * Production requires customer-credential evidence + live-smoke qualification.
 * Catalog breadth remains honest: Planned stays non-connectable.
 */

import { z } from "zod";

export const ExternalIntegrationTierSchema = z.enum([
  "Production",
  "Beta",
  "Planned"
]);
export type ExternalIntegrationTier = z.infer<
  typeof ExternalIntegrationTierSchema
>;

export const EXTERNAL_INTEGRATION_TIER_LAW =
  "External tier is Production only after customer-credential live-smoke certification; dedicated live clients default to Beta; Planned catalog entries are non-connectable until a dedicated client exists.";

/**
 * Top-10 stack targets for Production certification (SIEM/EDR/CNAPP/ITSM/IdP
 * plus cloud/code signal leaders). Status is NotCertified until real
 * customer-credential evidence is attached — never claim Production from
 * fixture contract tests alone.
 */
export const TOP_10_PRODUCTION_CERT_TARGETS = [
  {
    connectorKey: "splunk",
    vendor: "Splunk",
    product: "Splunk",
    stackClass: "SIEM" as const,
    priority: 1
  },
  {
    connectorKey: "microsoft-sentinel",
    vendor: "Microsoft",
    product: "Microsoft Sentinel",
    stackClass: "SIEM" as const,
    priority: 2
  },
  {
    connectorKey: "crowdstrike",
    vendor: "CrowdStrike",
    product: "Falcon",
    stackClass: "EDR" as const,
    priority: 3
  },
  {
    connectorKey: "microsoft-defender-xdr",
    vendor: "Microsoft",
    product: "Microsoft Defender XDR",
    stackClass: "EDR" as const,
    priority: 4
  },
  {
    connectorKey: "wiz",
    vendor: "Wiz",
    product: "Wiz",
    stackClass: "CNAPP" as const,
    priority: 5
  },
  {
    connectorKey: "tenable",
    vendor: "Tenable",
    product: "Tenable",
    stackClass: "CNAPP" as const,
    priority: 6
  },
  {
    connectorKey: "jira",
    vendor: "Atlassian",
    product: "Jira Cloud",
    stackClass: "ITSM" as const,
    priority: 7
  },
  {
    connectorKey: "servicenow",
    vendor: "ServiceNow",
    product: "ServiceNow",
    stackClass: "ITSM" as const,
    priority: 8
  },
  {
    connectorKey: "okta",
    vendor: "Okta",
    product: "Okta",
    stackClass: "IdP" as const,
    priority: 9
  },
  {
    connectorKey: "microsoft-entra-id",
    vendor: "Microsoft",
    product: "Microsoft Entra ID",
    stackClass: "IdP" as const,
    priority: 10
  }
] as const;

export type Top10ProductionCertTarget =
  (typeof TOP_10_PRODUCTION_CERT_TARGETS)[number];

export const ProductionCertStatusSchema = z.enum([
  "NotCertified",
  "ContractTestedOnly",
  "CustomerCredentialPending",
  "Production"
]);
export type ProductionCertStatus = z.infer<typeof ProductionCertStatusSchema>;

export const ProductionCertTargetStatusSchema = z.object({
  connectorKey: z.string().min(1),
  vendor: z.string().min(1),
  product: z.string().min(1),
  stackClass: z.enum(["SIEM", "EDR", "CNAPP", "ITSM", "IdP"]),
  priority: z.number().int().min(1).max(10),
  externalTier: ExternalIntegrationTierSchema,
  certStatus: ProductionCertStatusSchema,
  /** Honest note: fixture contract tests ≠ Production. */
  evidenceNote: z.string().min(1)
});
export type ProductionCertTargetStatus = z.infer<
  typeof ProductionCertTargetStatusSchema
>;

/**
 * Map catalog availability + connectability to the external tier table.
 * Never upgrades to Production without explicit productionCertified flag.
 *
 * productionCertified must only be true after design-partner live-smoke
 * (health, technique observe, redaction, rate limits, tenant isolation,
 * audit) with evidence on a Plane issue — see
 * docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md. Fixture contract tests
 * alone stay ContractTestedOnly / Beta.
 */
export function resolveExternalIntegrationTier(input: {
  availability?: string | null;
  connectable?: boolean | null;
  live?: boolean | null;
  executionReadiness?: string | null;
  /** Only true after customer-credential live-smoke qualification. */
  productionCertified?: boolean;
}): ExternalIntegrationTier {
  if (input.productionCertified === true) {
    return "Production";
  }
  if (
    input.availability === "Planned" ||
    input.connectable === false ||
    input.executionReadiness === "NotConnectable" ||
    input.live === false
  ) {
    // Dedicated live clients can be live:false only when planned; prefer Planned
    // when explicitly non-connectable, else Beta for dedicated Beta clients.
    if (
      input.availability === "Planned" ||
      input.connectable === false ||
      input.executionReadiness === "NotConnectable"
    ) {
      return "Planned";
    }
  }
  // Manifest may say Production, but without productionCertified (handled above)
  // we stay Beta — fixture/contract tests never mint Production.
  return "Beta";
}

/**
 * Build honest top-10 Production cert board. Defaults every target to
 * NotCertified / Beta (or Planned if catalog says so). Callers may pass
 * per-key overrides when real customer-credential evidence lands.
 */
export function buildTop10ProductionCertBoard(options?: {
  overrides?: Partial<
    Record<
      string,
      {
        productionCertified?: boolean;
        contractTested?: boolean;
        externalTier?: ExternalIntegrationTier;
        certStatus?: ProductionCertStatus;
        evidenceNote?: string;
      }
    >
  >;
}): ProductionCertTargetStatus[] {
  return TOP_10_PRODUCTION_CERT_TARGETS.map((target) => {
    const override = options?.overrides?.[target.connectorKey];
    const productionCertified = override?.productionCertified === true;
    const externalTier =
      override?.externalTier ??
      (productionCertified ? "Production" : "Beta");
    const certStatus =
      override?.certStatus ??
      (productionCertified
        ? "Production"
        : override?.contractTested
          ? "ContractTestedOnly"
          : "NotCertified");
    const evidenceNote =
      override?.evidenceNote ??
      (productionCertified
        ? "Customer-credential live-smoke certified."
        : override?.contractTested
          ? "Fixture contract tests only — not Production. Customer-credential live-smoke required."
          : "Not Production-certified. Dedicated client may be Beta; Planned entries stay non-connectable.");

    return ProductionCertTargetStatusSchema.parse({
      connectorKey: target.connectorKey,
      vendor: target.vendor,
      product: target.product,
      stackClass: target.stackClass,
      priority: target.priority,
      externalTier,
      certStatus,
      evidenceNote
    });
  });
}

export function summarizeExternalTierCounts(
  tiers: readonly ExternalIntegrationTier[]
): Record<ExternalIntegrationTier, number> {
  const counts: Record<ExternalIntegrationTier, number> = {
    Production: 0,
    Beta: 0,
    Planned: 0
  };
  for (const tier of tiers) {
    counts[tier] += 1;
  }
  return counts;
}
