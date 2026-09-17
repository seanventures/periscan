import { z } from "zod";

/**
 * Scorecard id 47 — Execution Integrity honesty contract (Slice C).
 *
 * Periscan is a *verifier* of software and customer-supplied hardware evidence.
 * It does **not** host workloads inside a TEE/enclave or invent hardware-rooted
 * execution. Product surfaces must pin this language (see claim-deny-list TEE
 * host phrases).
 */

export const ExecutionIntegrityClaimClassSchema = z.enum([
  "software_chain",
  "agent_receipt",
  "customer_tee_verifier",
  "refused_host_tee"
]);
export type ExecutionIntegrityClaimClass = z.infer<
  typeof ExecutionIntegrityClaimClassSchema
>;

export const ExecutionIntegritySurfaceSchema = z.object({
  claimClass: ExecutionIntegrityClaimClassSchema,
  detail: z.string().min(1),
  href: z.string().min(1).nullable(),
  key: z.string().min(1),
  label: z.string().min(1),
  /** Product-ready path vs hardware-partner residual */
  state: z.enum(["Available", "PartnerHardware", "Refused"])
});
export type ExecutionIntegritySurface = z.infer<
  typeof ExecutionIntegritySurfaceSchema
>;

export const ExecutionIntegrityHonestySchema = z.object({
  scorecardId: z.literal(47),
  requirement: z.literal("Execution Integrity"),
  productRole: z.literal("verifier"),
  hostTeeWorkloads: z.literal(false),
  surfaces: z.array(ExecutionIntegritySurfaceSchema).min(1),
  foreverRefuse: z.array(z.string().min(1)).min(1),
  honestyNote: z.string().min(1)
});
export type ExecutionIntegrityHonesty = z.infer<
  typeof ExecutionIntegrityHonestySchema
>;

export function buildExecutionIntegrityHonesty(): ExecutionIntegrityHonesty {
  return ExecutionIntegrityHonestySchema.parse({
    scorecardId: 47,
    requirement: "Execution Integrity",
    productRole: "verifier",
    hostTeeWorkloads: false,
    surfaces: [
      {
        key: "evidence-chain",
        label: "Evidence content integrity",
        claimClass: "software_chain",
        state: "Available",
        href: "/evidence",
        detail:
          "Download verifies sha256 recorded-at-write vs recomputed content (integrityVerified)."
      },
      {
        key: "flight-recorder",
        label: "Workflow flight-recorder chain",
        claimClass: "software_chain",
        state: "Available",
        href: "/agent-workflows",
        detail:
          "Append-only hash-chained workflow events with seal/checkpoint verification."
      },
      {
        key: "agent-signed-receipts",
        label: "Agent signed receipts",
        claimClass: "agent_receipt",
        state: "Available",
        href: "/agent-trust",
        detail:
          "POST /api/v1/agent-trust/receipts/verify binds payload digest, nonce, audience, expiry."
      },
      {
        key: "customer-tee-verifier",
        label: "Customer TEE attestation (verifier)",
        claimClass: "customer_tee_verifier",
        state: "PartnerHardware",
        href: "/agent-trust",
        detail:
          "Veraison/NVIDIA relying-party qualification of customer-supplied attestation evidence only."
      },
      {
        key: "host-tee",
        label: "Host workloads inside TEE/enclave",
        claimClass: "refused_host_tee",
        state: "Refused",
        href: null,
        detail:
          "Periscan does not provision, host, or run customer agents inside a TEE/H100 confidential compute fabric."
      }
    ],
    foreverRefuse: [
      "We run your agents inside a TEE/enclave",
      "Hardware-rooted execution of Periscan-hosted workloads",
      "Confidential GPU hosting as a product capability"
    ],
    honestyNote:
      "Execution integrity = software chain + signed receipts + optional customer-supplied TEE verification. Hardware dependency residual is partner/lab qualification of verifier receipts — never invent host-TEE product claims."
  });
}
