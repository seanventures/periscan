import { describe, expect, it, vi } from "vitest";

import {
  CANARY_MARKER_PATTERN,
  EMAIL_DELIVERY_CANARY_COMMUNITY_START,
  EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED,
  EMAIL_DELIVERY_CANARY_MODULE_ID,
  classifyCanaryMarker,
  classifyMultiVectorCapability,
  compileEmailDeliveryCanary,
  evaluateEmailDeliveryCanary
} from "./email-dns-canary.js";

describe("email delivery canary contracts (PERISCAN-590/591)", () => {
  it("refuses a third-party recipient and never sets realDataExfiltrated", () => {
    const result = compileEmailDeliveryCanary({
      domain: "customer.example",
      recipient: "user@gmail.com"
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("email_canary_owned_recipient_required");
    expect(result.realDataExfiltrated).toBe(false);
    expect(result.jobsQueued).toBe(0);
  });

  it("refuses Outlook/O365 consumer mailboxes", () => {
    for (const recipient of [
      "user@outlook.com",
      "user@hotmail.com",
      "user@office365.com"
    ]) {
      const result = compileEmailDeliveryCanary({
        domain: "customer.example",
        recipient
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe("email_canary_owned_recipient_required");
      expect(result.realDataExfiltrated).toBe(false);
    }
  });

  it("fails closed when the recipient is not on the owned domain", () => {
    const result = compileEmailDeliveryCanary({
      domain: "customer.example",
      recipient: "canary@other.example"
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("email_canary_owned_recipient_required");
    expect(result.realDataExfiltrated).toBe(false);
  });

  it("fails closed when a third-party mailbox is claimed as the owned domain", () => {
    const result = compileEmailDeliveryCanary({
      domain: "gmail.com",
      recipient: "user@gmail.com"
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("email_canary_owned_recipient_required");
    expect(result.realDataExfiltrated).toBe(false);
  });

  it("compiles an owned recipient + owned domain + unique periscan-* marker", () => {
    const result = compileEmailDeliveryCanary({
      domain: "customer.example",
      marker: "periscan-email-delivery-1",
      recipient: "canary@customer.example"
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.code).toBe("email_canary_compiled");
    expect(result.marker).toBe("periscan-email-delivery-1");
    expect(result.marker).toMatch(CANARY_MARKER_PATTERN);
    expect(result.recipient).toBe("canary@customer.example");
    expect(result.domain).toBe("customer.example");
    expect(result.moduleId).toBe(EMAIL_DELIVERY_CANARY_MODULE_ID);
    expect(result.liveSupported).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.attachments).toBe(false);
    expect(result.credentialHarvest).toBe(false);
    expect(result.realDataExfiltrated).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.claimClass).toBe("benign_marker_only");
    expect(result.smtpAttempted).toBe(false);
  });

  it("mints unique periscan-* markers when omitted", () => {
    const first = compileEmailDeliveryCanary({
      domain: "customer.example",
      recipient: "a@customer.example"
    });
    const second = compileEmailDeliveryCanary({
      domain: "customer.example",
      recipient: "b@customer.example"
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(first.marker).toMatch(CANARY_MARKER_PATTERN);
    expect(second.marker).toMatch(CANARY_MARKER_PATTERN);
    expect(first.marker).not.toBe(second.marker);
  });

  it("never mints a forbidden label from random characters", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(
      Number.parseInt("ssn00000", 36) / 36 ** 8
    );
    try {
      const result = compileEmailDeliveryCanary({
        domain: "customer.example",
        recipient: "a@customer.example"
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(classifyCanaryMarker(result.marker).ok).toBe(true);
      }
    } finally {
      random.mockRestore();
    }
  });

  it("measures only with emit + routing evidence", () => {
    expect(
      evaluateEmailDeliveryCanary({ emitted: true, routingEvidence: false })
        .measured
    ).toBe(false);
    expect(
      evaluateEmailDeliveryCanary({ emitted: false, routingEvidence: true })
        .measured
    ).toBe(false);
    expect(
      evaluateEmailDeliveryCanary({ emitted: false, routingEvidence: false })
        .measured
    ).toBe(false);

    const closed = evaluateEmailDeliveryCanary({
      emitted: true,
      routingEvidence: true
    });
    expect(closed.measured).toBe(true);
    expect(closed.realDataExfiltrated).toBe(false);
    expect(closed.claimClass).toBe("benign_marker_only");
  });

  it("never marks measured from routing evidence without emit", () => {
    const result = evaluateEmailDeliveryCanary({
      deliveryEvidence: true,
      emitted: false,
      routingEvidence: true
    });
    expect(result.measured).toBe(false);
    expect(result.realDataExfiltrated).toBe(false);
  });

  it("rejects attachment payloads and credential harvest", () => {
    const attachments = compileEmailDeliveryCanary({
      attachments: [{ filename: "payload.docm" }],
      domain: "customer.example",
      recipient: "canary@customer.example"
    });
    expect(attachments.ok).toBe(false);
    expect(attachments.code).toBe("email_canary_attachment_forbidden");
    expect(attachments.realDataExfiltrated).toBe(false);

    const harvest = compileEmailDeliveryCanary({
      credentialHarvest: true,
      domain: "customer.example",
      recipient: "canary@customer.example"
    });
    expect(harvest.ok).toBe(false);
    expect(harvest.code).toBe("email_canary_credential_harvest_forbidden");
    expect(harvest.realDataExfiltrated).toBe(false);
  });

  it("labels phishing-send and malware-drop Missing, not Partial", () => {
    expect(classifyMultiVectorCapability("phishing_send")).toMatchObject({
      coverage: "Missing",
      id: "phishing_send"
    });
    expect(classifyMultiVectorCapability("malware_drop")).toMatchObject({
      coverage: "Missing",
      id: "malware_drop"
    });
    expect(
      classifyMultiVectorCapability("email_delivery_canary").coverage
    ).toBe("Contract");
    expect(
      classifyMultiVectorCapability("email_delivery_canary").coverage
    ).not.toBe("Partial");
    expect(classifyMultiVectorCapability("dns_exfil_canary")).toMatchObject({
      coverage: "Partial",
      claimClass: "benign_marker_only"
    });
  });

  it("fails closed when a compile requests phishing-send", () => {
    const result = compileEmailDeliveryCanary({
      domain: "customer.example",
      phishingSend: true,
      recipient: "canary@customer.example"
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("email_canary_phishing_send_missing");
    expect(result.realDataExfiltrated).toBe(false);
  });

  it("rejects bulk and customer-data labels even with a periscan- prefix", () => {
    expect(classifyCanaryMarker("periscan-dns-exfil-1").ok).toBe(true);
    expect(classifyCanaryMarker("periscan-email-delivery-1").ok).toBe(true);
    expect(classifyCanaryMarker("exfil-payload.bin").ok).toBe(false);
    for (const bad of [
      "periscan-bulk-tunnel",
      "periscan-customer-data",
      "periscan-customer-ssn-dump",
      "periscan-bulk-exfil"
    ]) {
      const classified = classifyCanaryMarker(bad);
      expect(classified.ok).toBe(false);
      expect(classified.code).toBe(
        "canary_marker_bulk_or_customer_data_forbidden"
      );
    }
  });

  it("does not enable Community start or live SMTP this wave", () => {
    expect(EMAIL_DELIVERY_CANARY_MODULE_ID).toBe(
      "periscan.email_delivery_canary"
    );
    expect(EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED).toBe(false);
    expect(EMAIL_DELIVERY_CANARY_COMMUNITY_START).toBe(false);
  });
});
