import { z } from "zod";

/**
 * Slice D — partner residual honesty for scorecard rows 2 / 26 / 28 / 38 / 51.
 *
 * Dark web, OT/ICS, and crowdsourced HITL stay Partner-gated forever without
 * contracted feeds/labs. A2A artifact exchange and AgentDID integration are
 * real product paths but remain partner/interop residual — never invent a
 * marketplace partner network or Leading joint-customer proof without evidence.
 */

export const PartnerCapabilityGateSchema = z.enum([
  "Partner",
  "ProductWithPartnerResidual"
]);
export type PartnerCapabilityGate = z.infer<typeof PartnerCapabilityGateSchema>;

export const PartnerCapabilityStateSchema = z.enum([
  "ExternallyGated",
  "AvailableWithHonesty",
  "NotConfigured"
]);
export type PartnerCapabilityState = z.infer<
  typeof PartnerCapabilityStateSchema
>;

export const PartnerCapabilityRowSchema = z.object({
  claimClass: z.enum([
    "forever_refuse_without_partner",
    "interoperability_with_residual",
    "trust_profile_with_residual"
  ]),
  detail: z.string().min(1),
  foreverRefuse: z.array(z.string().min(1)).min(1),
  gate: PartnerCapabilityGateSchema,
  href: z.string().min(1).nullable(),
  productSurfaces: z.array(z.string().min(1)),
  requirement: z.string().min(1),
  scorecardId: z.number().int().positive(),
  state: PartnerCapabilityStateSchema
});
export type PartnerCapabilityRow = z.infer<typeof PartnerCapabilityRowSchema>;

export const PartnerCapabilityHonestySchema = z.object({
  honestyNote: z.string().min(1),
  partnerGatedScorecardIds: z.array(z.number().int().positive()),
  rows: z.array(PartnerCapabilityRowSchema).min(1),
  scorecardIds: z.array(z.number().int().positive())
});
export type PartnerCapabilityHonesty = z.infer<
  typeof PartnerCapabilityHonestySchema
>;

export function buildPartnerCapabilityHonesty(): PartnerCapabilityHonesty {
  return PartnerCapabilityHonestySchema.parse({
    scorecardIds: [2, 26, 28, 38, 51],
    partnerGatedScorecardIds: [2, 26, 28],
    honestyNote:
      "Partner residual inventory (scorecard #2/#26/#28/#38/#51). Never invent live dark-web crawl, OT protocol speak, crowdsourced HITL marketplace, or Leading A2A/AgentDID joint-customer claims without contracted partners and measured proof.",
    rows: [
      {
        scorecardId: 2,
        requirement: "Dark Web & Credential Monitoring",
        gate: "Partner",
        state: "ExternallyGated",
        claimClass: "forever_refuse_without_partner",
        href: "/engines",
        productSurfaces: [
          "GET /api/v1/safety-equivalent-packs",
          "GET /api/v1/packs/enterprise-readiness",
          "GET /api/v1/partner-capabilities/honesty"
        ],
        foreverRefuse: [
          "Live dark-web crawl product",
          "Credential theft or bulk dump ingestion as Periscan feature",
          "In-product dark-web marketplace without partner contract"
        ],
        detail:
          "Intel connectors are finished-intelligence only. Credential-match / dark-web feed stays ExternallyGated until a contracted provider, k-anonymized match, and rotation proof exist."
      },
      {
        scorecardId: 26,
        requirement: "OT/ICS Attack Packs",
        gate: "Partner",
        state: "ExternallyGated",
        claimClass: "forever_refuse_without_partner",
        href: "/engines",
        productSurfaces: [
          "ot_ics.protocol_exposure (passive)",
          "GET /api/v1/safety-equivalent-packs",
          "GET /api/v1/partner-capabilities/honesty"
        ],
        foreverRefuse: [
          "Validated OT attack packs without partner-lab qualification",
          "Active Modbus/DNP3/S7comm protocol speak",
          "Industrial control disruption"
        ],
        detail:
          "Passive port classification only. Fixture OT baseline is Inconclusive. Partner-lab qualification required before any Validated OT claim."
      },
      {
        scorecardId: 28,
        requirement: "Crowdsourced Human-in-the-Loop",
        gate: "Partner",
        state: "ExternallyGated",
        claimClass: "forever_refuse_without_partner",
        href: "/engines",
        productSurfaces: [
          "GET /api/v1/safety-equivalent-packs",
          "GET /api/v1/packs/enterprise-readiness",
          "GET /api/v1/partner-capabilities/honesty"
        ],
        foreverRefuse: [
          "Crowdsourced pentester marketplace product launch",
          "Internal approvals rebranded as external HITL crowd",
          "Unvetted operator roster without partner contract"
        ],
        detail:
          "No crowdsourced marketplace is productized. Programmatic HITL interrupts (row 42) are a separate product path."
      },
      {
        scorecardId: 38,
        requirement: "A2A Artifact Exchange",
        gate: "ProductWithPartnerResidual",
        state: "AvailableWithHonesty",
        claimClass: "interoperability_with_residual",
        href: "/agent-trust",
        productSurfaces: [
          "A2A endpoint discovery + card conformance",
          "Typed task / message / artifact objects",
          "A2A TCK under policy authorize",
          "GET /api/v1/partner-capabilities/honesty"
        ],
        foreverRefuse: [
          "Leading A2A interchange without joint customer proof",
          "Unaudited partner artifact swap outside typed state machine",
          "Implicit trust of remote agent cards without tenant approval"
        ],
        detail:
          "Product path is tenant-reviewed A2A endpoints, structural card conformance, typed artifacts, and optional official TCK. Partner residual: multi-vendor production interchange remains joint-customer proof, not a default Leading claim."
      },
      {
        scorecardId: 51,
        requirement: "AgentDID Integration",
        gate: "ProductWithPartnerResidual",
        state: "AvailableWithHonesty",
        claimClass: "trust_profile_with_residual",
        href: "/agent-trust",
        productSurfaces: [
          "AgentDID trust profiles (issuer + subject)",
          "W3C VC delegation binding to receipts",
          "Credential verify / revoke",
          "GET /api/v1/partner-capabilities/honesty"
        ],
        foreverRefuse: [
          "Universal AgentDID federation marketplace",
          "Trust without approved A2A endpoint + conformant card",
          "Silent elevation of expired or rotated DIDs"
        ],
        detail:
          "Product path establishes did:web issuer/subject profiles, VC delegation, and receipt binding for approved endpoints. Residual: broader federation / multi-issuer production programs need partner ops proof — not invented by UI alone."
      }
    ]
  });
}
