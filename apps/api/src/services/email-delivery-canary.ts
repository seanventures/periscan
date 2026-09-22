import { z } from "zod";

import {
  EMAIL_DELIVERY_CANARY_CLAIM_CLASS,
  EMAIL_DELIVERY_CANARY_COMMUNITY_START,
  EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED,
  EMAIL_DELIVERY_CANARY_MODULE_ID,
  compileEmailDeliveryCanary,
  evaluateEmailDeliveryCanary
} from "@periscan/shared";

/**
 * Fastify product path for the Wave 1 email delivery canary contract.
 *
 * Compile + evaluate only. MailHog is a disposable lab sink (not Community
 * start). Never real SMTP, never internet mail, never mailbox harvest.
 */

export const EmailDeliveryCanaryLabSinkSchema = z.enum([
  "MailHog",
  "CoreDNS",
  "none"
]);
export type EmailDeliveryCanaryLabSink = z.infer<
  typeof EmailDeliveryCanaryLabSinkSchema
>;

export const EmailDeliveryCanaryProofInputSchema = z.object({
  attachments: z.unknown().optional(),
  communityStart: z.boolean().optional(),
  credentialHarvest: z.boolean().optional(),
  deliveryEvidence: z.boolean().optional(),
  domain: z.string().min(1).max(253).optional(),
  emitted: z.boolean().optional(),
  internetMail: z.boolean().optional(),
  labSink: EmailDeliveryCanaryLabSinkSchema.optional(),
  liveOffensive: z.boolean().optional(),
  liveSmtp: z.boolean().optional(),
  marker: z
    .string()
    .min(8)
    .max(128)
    .regex(/^periscan-[A-Za-z0-9._:-]{4,120}$/u)
    .optional(),
  phishingSend: z.boolean().optional(),
  policyOutcome: z.enum(["Allowed", "Denied", "RequireApproval"]).optional(),
  qualified: z.boolean().optional(),
  recipient: z.string().min(1).max(320).optional(),
  routingEvidence: z.boolean().optional(),
  scoped: z.boolean().optional(),
  tenantAuthorized: z.boolean().optional()
});
export type EmailDeliveryCanaryProofInput = z.input<
  typeof EmailDeliveryCanaryProofInputSchema
> & {
  controlSourceId?: string;
};

export const EmailDeliveryCanaryLabPlanSchema = z.object({
  communityStart: z.literal(false),
  internetMail: z.literal(false),
  kind: z.literal("lab-mailhog-sink"),
  liveSupported: z.literal(false),
  realDataExfiltrated: z.literal(false),
  sink: z.literal("MailHog"),
  smtpAttempted: z.literal(false)
});
export type EmailDeliveryCanaryLabPlan = z.infer<
  typeof EmailDeliveryCanaryLabPlanSchema
>;

const emailCanaryProofCode = [
  "email_canary_compiled",
  "email_canary_owned_recipient_required",
  "email_canary_owned_domain_required",
  "email_canary_marker_not_allowlisted",
  "email_canary_attachment_forbidden",
  "email_canary_credential_harvest_forbidden",
  "email_canary_phishing_send_missing",
  "canary_marker_bulk_or_customer_data_forbidden",
  "email_canary_unscoped",
  "email_canary_qualification_required",
  "email_canary_authorization_required",
  "email_canary_policy_not_allowed",
  "email_canary_community_start_denied",
  "email_canary_internet_mail_denied",
  "email_canary_live_smtp_denied",
  "email_canary_live_offensive_denied"
] as const;

export const EmailDeliveryCanaryProofCodeSchema = z.enum(emailCanaryProofCode);
export type EmailDeliveryCanaryProofCode = z.infer<
  typeof EmailDeliveryCanaryProofCodeSchema
>;

export const EmailDeliveryCanaryProofResultSchema = z.object({
  claimClass: z.literal(EMAIL_DELIVERY_CANARY_CLAIM_CLASS),
  code: EmailDeliveryCanaryProofCodeSchema,
  communityStart: z.literal(false),
  controlSourceId: z.string().uuid().optional(),
  domain: z.string().optional(),
  emitted: z.boolean(),
  internetMail: z.literal(false),
  jobsQueued: z.union([z.literal(0), z.literal(1)]),
  liveSupported: z.literal(false),
  malwareDropCoverage: z.literal("Missing"),
  marker: z.string().optional(),
  measured: z.boolean(),
  moduleId: z.literal(EMAIL_DELIVERY_CANARY_MODULE_ID),
  ok: z.boolean(),
  phishingSendCoverage: z.literal("Missing"),
  realDataExfiltrated: z.literal(false),
  recipient: z.string().optional(),
  recordedPlan: EmailDeliveryCanaryLabPlanSchema.nullable(),
  routingEvidence: z.boolean(),
  smtpAttempted: z.literal(false)
});
export type EmailDeliveryCanaryProofResult = z.infer<
  typeof EmailDeliveryCanaryProofResultSchema
>;

const honestyPins = {
  claimClass: EMAIL_DELIVERY_CANARY_CLAIM_CLASS,
  communityStart: EMAIL_DELIVERY_CANARY_COMMUNITY_START,
  internetMail: false,
  liveSupported: false,
  malwareDropCoverage: "Missing" as const,
  moduleId: EMAIL_DELIVERY_CANARY_MODULE_ID,
  phishingSendCoverage: "Missing" as const,
  realDataExfiltrated: false,
  smtpAttempted: false
} as const;

function deny(
  code: EmailDeliveryCanaryProofCode,
  extras: {
    controlSourceId?: string;
    domain?: string;
    emitted: boolean;
    marker?: string;
    measured: boolean;
    recipient?: string;
    routingEvidence: boolean;
  }
): EmailDeliveryCanaryProofResult {
  return {
    ...honestyPins,
    code,
    controlSourceId: extras.controlSourceId,
    domain: extras.domain,
    emitted: extras.emitted,
    jobsQueued: 0,
    marker: extras.marker,
    measured: extras.measured,
    ok: false,
    recipient: extras.recipient,
    recordedPlan: null,
    routingEvidence: extras.routingEvidence
  };
}

export function runEmailDeliveryCanaryProof(
  input: EmailDeliveryCanaryProofInput
): EmailDeliveryCanaryProofResult {
  const compiled = compileEmailDeliveryCanary({
    attachments: input.attachments,
    credentialHarvest: input.credentialHarvest,
    domain: input.domain,
    marker: input.marker,
    phishingSend: input.phishingSend,
    recipient: input.recipient
  });
  const evaluation = evaluateEmailDeliveryCanary({
    deliveryEvidence: input.deliveryEvidence,
    emitted: input.emitted === true,
    routingEvidence: input.routingEvidence === true
  });
  const extras = {
    controlSourceId: input.controlSourceId,
    domain: compiled.ok ? compiled.domain : input.domain,
    emitted: evaluation.emitted,
    marker: compiled.ok ? compiled.marker : input.marker,
    measured: evaluation.measured,
    recipient: compiled.ok ? compiled.recipient : input.recipient,
    routingEvidence: evaluation.routingEvidence
  };

  if (input.internetMail === true) {
    return deny("email_canary_internet_mail_denied", extras);
  }
  if (input.liveSmtp === true) {
    return deny("email_canary_live_smtp_denied", extras);
  }
  if (input.liveOffensive === true) {
    return deny("email_canary_live_offensive_denied", extras);
  }
  if (input.communityStart === true) {
    return deny("email_canary_community_start_denied", extras);
  }
  if (!compiled.ok) {
    return deny(compiled.code, extras);
  }
  if (input.scoped !== true) {
    return deny("email_canary_unscoped", extras);
  }
  if (input.qualified !== true) {
    return deny("email_canary_qualification_required", extras);
  }
  if (input.tenantAuthorized !== true) {
    return deny("email_canary_authorization_required", extras);
  }
  if (input.policyOutcome !== "Allowed") {
    return deny("email_canary_policy_not_allowed", extras);
  }

  const queueLabMailhog = input.labSink === "MailHog";
  return {
    ...honestyPins,
    code: "email_canary_compiled",
    controlSourceId: extras.controlSourceId,
    domain: compiled.domain,
    emitted: evaluation.emitted,
    jobsQueued: queueLabMailhog ? 1 : 0,
    liveSupported: EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED,
    marker: compiled.marker,
    measured: evaluation.measured,
    ok: true,
    recipient: compiled.recipient,
    recordedPlan: queueLabMailhog
      ? {
          communityStart: false,
          internetMail: false,
          kind: "lab-mailhog-sink",
          liveSupported: false,
          realDataExfiltrated: false,
          sink: "MailHog",
          smtpAttempted: false
        }
      : null,
    routingEvidence: evaluation.routingEvidence
  };
}
