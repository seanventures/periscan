import {
  EMAIL_DELIVERY_CANARY_COMMUNITY_START,
  EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED,
  EMAIL_DELIVERY_CANARY_MODULE_ID,
  classifyCanaryMarker,
  classifyMultiVectorCapability,
  compileEmailDeliveryCanary,
  evaluateEmailDeliveryCanary,
  type EmailDeliveryCanaryCompileInput
} from "@periscan/shared";

/**
 * Module-layer email delivery canary (PERISCAN-590 / 591).
 *
 * Wave 1 contract only: compile/evaluate, no SMTP, no Fastify route.
 * MailHog / CoreDNS are disposable lab sinks — not Community start.
 */

export {
  EMAIL_DELIVERY_CANARY_COMMUNITY_START,
  EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED,
  EMAIL_DELIVERY_CANARY_MODULE_ID,
  classifyCanaryMarker,
  classifyMultiVectorCapability,
  compileEmailDeliveryCanary,
  evaluateEmailDeliveryCanary
};

export const EMAIL_CANARY_LAB_SINKS = [
  {
    communityStart: false,
    name: "MailHog",
    role: "disposable_lab_smtp_sink",
    spdxLicenseId: "MIT"
  },
  {
    communityStart: false,
    name: "CoreDNS",
    role: "disposable_lab_resolver",
    spdxLicenseId: "Apache-2.0"
  }
] as const;

export type EmailCanaryLabSink = (typeof EMAIL_CANARY_LAB_SINKS)[number];

export type EmailDeliveryCanaryTransportPlan = {
  allowed: boolean;
  communityStart: false;
  realDataExfiltrated: false;
  smtpAttempted: false;
};

export function planEmailDeliveryCanaryTransport(
  input: EmailDeliveryCanaryCompileInput
): EmailDeliveryCanaryTransportPlan {
  const compiled = compileEmailDeliveryCanary(input);
  return {
    allowed: compiled.ok,
    communityStart: false,
    realDataExfiltrated: false,
    smtpAttempted: false
  };
}
