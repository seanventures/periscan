import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  EMAIL_CANARY_LAB_SINKS,
  compileEmailDeliveryCanary,
  evaluateEmailDeliveryCanary,
  planEmailDeliveryCanaryTransport
} from "./email-delivery-canary.js";

const COMMUNITY_COMPOSE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../infra/docker-compose/docker-compose.community.yml"
);

describe("email delivery canary module (PERISCAN-590/591)", () => {
  it("refuses a third-party recipient and never sets realDataExfiltrated", () => {
    const result = compileEmailDeliveryCanary({
      domain: "customer.example",
      recipient: "user@gmail.com"
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("email_canary_owned_recipient_required");
    expect(result.realDataExfiltrated).toBe(false);
    expect(result.smtpAttempted).toBe(false);
  });

  it("measures only with emit + routing evidence", () => {
    expect(
      evaluateEmailDeliveryCanary({ emitted: true, routingEvidence: false })
        .measured
    ).toBe(false);
    const closed = evaluateEmailDeliveryCanary({
      emitted: true,
      routingEvidence: true
    });
    expect(closed.measured).toBe(true);
    expect(closed.realDataExfiltrated).toBe(false);
  });

  it("never attempts SMTP to Gmail or O365", () => {
    for (const recipient of [
      "user@gmail.com",
      "user@outlook.com",
      "user@office365.com"
    ]) {
      const planned = planEmailDeliveryCanaryTransport({
        domain: "customer.example",
        recipient
      });
      expect(planned.smtpAttempted).toBe(false);
      expect(planned.realDataExfiltrated).toBe(false);
      expect(planned.allowed).toBe(false);
    }
  });

  it("documents MailHog and CoreDNS as lab-only sinks, not Community start", () => {
    expect(EMAIL_CANARY_LAB_SINKS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          communityStart: false,
          name: "MailHog",
          spdxLicenseId: "MIT"
        }),
        expect.objectContaining({
          communityStart: false,
          name: "CoreDNS",
          spdxLicenseId: "Apache-2.0"
        })
      ])
    );
    expect(
      EMAIL_CANARY_LAB_SINKS.every((sink) => sink.communityStart === false)
    ).toBe(true);

    const communityCompose = readFileSync(COMMUNITY_COMPOSE_PATH, "utf8");
    expect(communityCompose.toLowerCase()).not.toMatch(/mailhog/);
    expect(communityCompose).not.toMatch(/^\s+coredns:/m);
  });

  it("keeps phishing-send Missing on a compiled owned canary", () => {
    const compiled = compileEmailDeliveryCanary({
      domain: "customer.example",
      marker: "periscan-email-delivery-lab-1",
      recipient: "canary@customer.example"
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.phishingSendCoverage).toBe("Missing");
    expect(compiled.malwareDropCoverage).toBe("Missing");
    expect(compiled.communityStart).toBe(false);
    expect(compiled.liveSupported).toBe(false);
    expect(compiled.realDataExfiltrated).toBe(false);
  });
});
