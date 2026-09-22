import { z } from "zod";

/**
 * Synthetic email / DNS canary contracts (PERISCAN-590 / 591).
 *
 * Wave 1 is compile + evaluate only. No Fastify route, no third-party SMTP,
 * no mailbox harvest. `realDataExfiltrated` is always false. Phishing-send
 * and malware-drop stay Missing — this is not Cymulate multi-vector.
 */

export const EMAIL_DELIVERY_CANARY_MODULE_ID =
  "periscan.email_delivery_canary" as const;
export const DNS_EXFIL_CANARY_MODULE_ID = "periscan.dns_exfil_canary" as const;
export const EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED = false as const;
export const EMAIL_DELIVERY_CANARY_COMMUNITY_START = false as const;
export const EMAIL_DELIVERY_CANARY_CLAIM_CLASS = "benign_marker_only" as const;

/** Same allowlisted marker shape as DNS-exfil / DRV inject markers. */
export const CANARY_MARKER_PATTERN = /^periscan-[A-Za-z0-9._:-]{4,120}$/u;

/**
 * Bulk tunnel / customer-data / malware theater labels are forbidden even
 * when they match the periscan-* prefix.
 */
export const FORBIDDEN_CANARY_LABEL_PATTERN =
  /bulk|customer[-_]?data|tunnel|malware|phish|harvest|ssn|payload/iu;

export const THIRD_PARTY_MAILBOX_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "office365.com",
  "yahoo.com",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "gmx.com",
  "yandex.com",
  "onmicrosoft.com"
] as const;

const thirdPartyMailboxDomainSet = new Set<string>(THIRD_PARTY_MAILBOX_DOMAINS);

export const EmailCanaryDenialCodeSchema = z.enum([
  "email_canary_owned_recipient_required",
  "email_canary_owned_domain_required",
  "email_canary_marker_not_allowlisted",
  "email_canary_attachment_forbidden",
  "email_canary_credential_harvest_forbidden",
  "email_canary_phishing_send_missing",
  "canary_marker_bulk_or_customer_data_forbidden"
]);
export type EmailCanaryDenialCode = z.infer<typeof EmailCanaryDenialCodeSchema>;

export const EmailCanaryCompileCodeSchema = z.enum([
  "email_canary_compiled",
  ...EmailCanaryDenialCodeSchema.options
]);
export type EmailCanaryCompileCode = z.infer<
  typeof EmailCanaryCompileCodeSchema
>;

export const MultiVectorCoverageSchema = z.enum([
  "Missing",
  "Contract",
  "Partial"
]);
export type MultiVectorCoverage = z.infer<typeof MultiVectorCoverageSchema>;

export const MultiVectorCapabilityIdSchema = z.enum([
  "phishing_send",
  "malware_drop",
  "email_delivery_canary",
  "dns_exfil_canary"
]);
export type MultiVectorCapabilityId = z.infer<
  typeof MultiVectorCapabilityIdSchema
>;

export const CanaryMarkerClassificationSchema = z.discriminatedUnion("ok", [
  z.object({
    code: z.literal("canary_marker_allowlisted"),
    ok: z.literal(true)
  }),
  z.object({
    code: z.enum([
      "canary_marker_not_allowlisted",
      "canary_marker_bulk_or_customer_data_forbidden"
    ]),
    ok: z.literal(false)
  })
]);
export type CanaryMarkerClassification = z.infer<
  typeof CanaryMarkerClassificationSchema
>;

const honestyPins = {
  communityStart: EMAIL_DELIVERY_CANARY_COMMUNITY_START,
  jobsQueued: 0 as const,
  liveSupported: EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED,
  realDataExfiltrated: false as const,
  smtpAttempted: false as const
};

export type EmailDeliveryCanaryCompileSuccess = {
  attachments: false;
  claimClass: typeof EMAIL_DELIVERY_CANARY_CLAIM_CLASS;
  code: "email_canary_compiled";
  communityStart: false;
  credentialHarvest: false;
  domain: string;
  jobsQueued: 0;
  liveSupported: false;
  malwareDropCoverage: "Missing";
  marker: string;
  moduleId: typeof EMAIL_DELIVERY_CANARY_MODULE_ID;
  ok: true;
  phishingSendCoverage: "Missing";
  realDataExfiltrated: false;
  recipient: string;
  smtpAttempted: false;
};

export type EmailDeliveryCanaryCompileDenial = {
  code: EmailCanaryDenialCode;
  communityStart: false;
  jobsQueued: 0;
  liveSupported: false;
  ok: false;
  realDataExfiltrated: false;
  smtpAttempted: false;
};

export type EmailDeliveryCanaryCompileResult =
  | EmailDeliveryCanaryCompileSuccess
  | EmailDeliveryCanaryCompileDenial;

export type EmailDeliveryCanaryCompileInput = {
  attachments?: unknown;
  credentialHarvest?: boolean;
  domain?: string;
  marker?: string;
  phishingSend?: boolean;
  recipient?: string;
};

export type EmailDeliveryCanaryEvaluateInput = {
  deliveryEvidence?: boolean;
  emitted: boolean;
  routingEvidence: boolean;
};

export type EmailDeliveryCanaryEvaluateResult = {
  claimClass: typeof EMAIL_DELIVERY_CANARY_CLAIM_CLASS;
  emitted: boolean;
  measured: boolean;
  realDataExfiltrated: false;
  routingEvidence: boolean;
};

export type MultiVectorCapabilityClassification = {
  claimClass: "benign_marker_only" | "none";
  coverage: MultiVectorCoverage;
  id: MultiVectorCapabilityId;
};

let mintedMarkerSeq = 0;

function deny(code: EmailCanaryDenialCode): EmailDeliveryCanaryCompileDenial {
  return {
    code,
    ok: false,
    ...honestyPins
  };
}

function normalizeHost(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const host = value.trim().toLowerCase().replace(/\.$/u, "");
  return host.length > 0 ? host : null;
}

function mailboxDomain(recipient: string | undefined): string | null {
  if (typeof recipient !== "string") {
    return null;
  }
  const trimmed = recipient.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return null;
  }
  return normalizeHost(trimmed.slice(at + 1));
}

export function isThirdPartyMailboxDomain(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) {
    return false;
  }
  if (thirdPartyMailboxDomainSet.has(normalized)) {
    return true;
  }
  for (const thirdParty of THIRD_PARTY_MAILBOX_DOMAINS) {
    if (normalized.endsWith(`.${thirdParty}`)) {
      return true;
    }
  }
  return false;
}

export function isOwnedMailboxRecipient(
  recipient: string,
  ownedDomain: string
): boolean {
  const recipientHost = mailboxDomain(recipient);
  const domain = normalizeHost(ownedDomain);
  if (!recipientHost || !domain) {
    return false;
  }
  if (
    isThirdPartyMailboxDomain(recipientHost) ||
    isThirdPartyMailboxDomain(domain)
  ) {
    return false;
  }
  return recipientHost === domain || recipientHost.endsWith(`.${domain}`);
}

export function classifyCanaryMarker(
  marker: string
): CanaryMarkerClassification {
  if (!CANARY_MARKER_PATTERN.test(marker)) {
    return { code: "canary_marker_not_allowlisted", ok: false };
  }
  if (FORBIDDEN_CANARY_LABEL_PATTERN.test(marker)) {
    return {
      code: "canary_marker_bulk_or_customer_data_forbidden",
      ok: false
    };
  }
  return { code: "canary_marker_allowlisted", ok: true };
}

function mintUniqueCanaryMarker(): string {
  mintedMarkerSeq += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `periscan-email-${mintedMarkerSeq}-${rand}-${Date.now().toString(36)}`;
}

function hasForbiddenAttachments(attachments: unknown): boolean {
  if (attachments == null || attachments === false) {
    return false;
  }
  if (Array.isArray(attachments)) {
    return attachments.length > 0;
  }
  return true;
}

export function compileEmailDeliveryCanary(
  input: EmailDeliveryCanaryCompileInput
): EmailDeliveryCanaryCompileResult {
  const domain = normalizeHost(input.domain);
  if (!domain) {
    return deny("email_canary_owned_domain_required");
  }

  const recipient =
    typeof input.recipient === "string" ? input.recipient.trim() : "";
  if (!recipient || !isOwnedMailboxRecipient(recipient, domain)) {
    return deny("email_canary_owned_recipient_required");
  }

  if (input.phishingSend === true) {
    return deny("email_canary_phishing_send_missing");
  }

  if (hasForbiddenAttachments(input.attachments)) {
    return deny("email_canary_attachment_forbidden");
  }

  if (input.credentialHarvest === true) {
    return deny("email_canary_credential_harvest_forbidden");
  }

  const marker = input.marker?.trim()
    ? input.marker.trim()
    : mintUniqueCanaryMarker();
  const classified = classifyCanaryMarker(marker);
  if (!classified.ok) {
    return deny(
      classified.code === "canary_marker_bulk_or_customer_data_forbidden"
        ? "canary_marker_bulk_or_customer_data_forbidden"
        : "email_canary_marker_not_allowlisted"
    );
  }

  return {
    attachments: false,
    claimClass: EMAIL_DELIVERY_CANARY_CLAIM_CLASS,
    code: "email_canary_compiled",
    credentialHarvest: false,
    domain,
    malwareDropCoverage: "Missing",
    marker,
    moduleId: EMAIL_DELIVERY_CANARY_MODULE_ID,
    ok: true,
    phishingSendCoverage: "Missing",
    recipient: recipient.toLowerCase(),
    ...honestyPins
  };
}

export function evaluateEmailDeliveryCanary(
  input: EmailDeliveryCanaryEvaluateInput
): EmailDeliveryCanaryEvaluateResult {
  const routingEvidence =
    input.routingEvidence === true || input.deliveryEvidence === true;
  const emitted = input.emitted === true;
  return {
    claimClass: EMAIL_DELIVERY_CANARY_CLAIM_CLASS,
    emitted,
    measured: emitted && routingEvidence,
    realDataExfiltrated: false,
    routingEvidence
  };
}

export function classifyMultiVectorCapability(
  id: MultiVectorCapabilityId
): MultiVectorCapabilityClassification {
  switch (id) {
    case "phishing_send":
      return { claimClass: "none", coverage: "Missing", id };
    case "malware_drop":
      return { claimClass: "none", coverage: "Missing", id };
    case "email_delivery_canary":
      return {
        claimClass: "benign_marker_only",
        coverage: "Contract",
        id
      };
    case "dns_exfil_canary":
      return {
        claimClass: "benign_marker_only",
        coverage: "Partial",
        id
      };
  }
}
