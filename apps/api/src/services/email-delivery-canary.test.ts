import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EMAIL_DELIVERY_CANARY_COMMUNITY_START,
  EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED,
  EMAIL_DELIVERY_CANARY_MODULE_ID
} from "@periscan/shared";

import { buildApp } from "../app.js";
import { createSessionToken, SESSION_COOKIE_NAME } from "../security.js";
import { runEmailDeliveryCanaryProof } from "./email-delivery-canary.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const CONTROL_SOURCE_ID = "44444444-4444-4444-8444-444444444444";
const SESSION_SECRET = "email-delivery-canary-session-secret";
const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";
const ROUTE = `/api/v1/control-sources/${CONTROL_SOURCE_ID}/email-delivery-canary-proof`;

const ownerContext = {
  membership: {
    membershipId: "88888888-8888-4888-8888-888888888888",
    role: "Owner",
    tenantId: TENANT_ID,
    userId: USER_ID
  },
  session: {
    authMethod: "password" as const,
    defaultTenantId: TENANT_ID,
    userId: USER_ID
  },
  tenant: {
    name: "Email Canary Tenant",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Customer"
  },
  user: {
    email: "email-canary@periscan.test",
    mfaEnabledAt: null,
    name: "Email Canary Owner",
    userId: USER_ID
  }
};

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

async function buildCanaryApp() {
  return buildApp({
    services: {
      getSessionContext: async () => ownerContext
    } as never,
    sessionSecret: SESSION_SECRET
  });
}

async function authCookie() {
  const token = await createSessionToken(ownerContext.session, SESSION_SECRET);
  return { [SESSION_COOKIE_NAME]: token };
}

function qualifiedMailhogInput(
  overrides: Record<string, unknown> = {}
): Parameters<typeof runEmailDeliveryCanaryProof>[0] {
  return {
    controlSourceId: CONTROL_SOURCE_ID,
    domain: "customer.example",
    emitted: false,
    labSink: "MailHog",
    marker: "periscan-email-delivery-1",
    policyOutcome: "Allowed",
    qualified: true,
    recipient: "canary@customer.example",
    routingEvidence: false,
    scoped: true,
    tenantAuthorized: true,
    ...overrides
  };
}

describe("runEmailDeliveryCanaryProof", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("queues a MailHog lab-sink plan when qualified, authorized, scoped, and Allowed", () => {
    const result = runEmailDeliveryCanaryProof(qualifiedMailhogInput());

    expect(result.ok).toBe(true);
    expect(result.jobsQueued).toBe(1);
    expect(result.code).toBe("email_canary_compiled");
    expect(result.liveSupported).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.realDataExfiltrated).toBe(false);
    expect(result.smtpAttempted).toBe(false);
    expect(result.internetMail).toBe(false);
    expect(result.measured).toBe(false);
    expect(result.claimClass).toBe("benign_marker_only");
    expect(result.phishingSendCoverage).toBe("Missing");
    expect(result.malwareDropCoverage).toBe("Missing");
    expect(result.moduleId).toBe(EMAIL_DELIVERY_CANARY_MODULE_ID);
    expect(result.recordedPlan).toMatchObject({
      kind: "lab-mailhog-sink",
      liveSupported: false,
      realDataExfiltrated: false,
      sink: "MailHog",
      smtpAttempted: false
    });
    expect(EMAIL_DELIVERY_CANARY_LIVE_SUPPORTED).toBe(false);
    expect(EMAIL_DELIVERY_CANARY_COMMUNITY_START).toBe(false);
  });

  it("measures only with emit and routing evidence and still never exfiltrates", () => {
    const unmeasured = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ emitted: true, routingEvidence: false })
    );
    expect(unmeasured.measured).toBe(false);
    expect(unmeasured.jobsQueued).toBe(1);
    expect(unmeasured.realDataExfiltrated).toBe(false);

    const measured = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ emitted: true, routingEvidence: true })
    );
    expect(measured.measured).toBe(true);
    expect(measured.realDataExfiltrated).toBe(false);
    expect(measured.smtpAttempted).toBe(false);
    expect(measured.internetMail).toBe(false);
  });

  it("queues zero jobs when unscoped, unqualified, unauthorized, or policy is not Allowed", () => {
    const unscoped = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ scoped: false })
    );
    const unqualified = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ qualified: false })
    );
    const unauthorized = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ tenantAuthorized: false })
    );
    const deniedPolicy = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ policyOutcome: "Denied" })
    );

    expect(unscoped.jobsQueued).toBe(0);
    expect(unscoped.ok).toBe(false);
    expect(unscoped.code).toBe("email_canary_unscoped");
    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.code).toBe("email_canary_qualification_required");
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.code).toBe("email_canary_authorization_required");
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.recordedPlan).toBeNull();
    expect(deniedPolicy.code).toBe("email_canary_policy_not_allowed");
  });

  it("queues zero jobs for third-party mailboxes, attachments, harvest, and phishing-send", () => {
    const gmail = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ recipient: "user@gmail.com" })
    );
    const attachments = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ attachments: [{ filename: "payload.docm" }] })
    );
    const harvest = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ credentialHarvest: true })
    );
    const phishing = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ phishingSend: true })
    );

    expect(gmail.jobsQueued).toBe(0);
    expect(gmail.code).toBe("email_canary_owned_recipient_required");
    expect(gmail.realDataExfiltrated).toBe(false);
    expect(gmail.smtpAttempted).toBe(false);
    expect(attachments.jobsQueued).toBe(0);
    expect(attachments.code).toBe("email_canary_attachment_forbidden");
    expect(harvest.jobsQueued).toBe(0);
    expect(harvest.code).toBe("email_canary_credential_harvest_forbidden");
    expect(phishing.jobsQueued).toBe(0);
    expect(phishing.code).toBe("email_canary_phishing_send_missing");
    expect(phishing.phishingSendCoverage).toBe("Missing");
  });

  it("queues zero jobs for internet mail, live SMTP, Community start, or CoreDNS", () => {
    const internet = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ internetMail: true })
    );
    const liveSmtp = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ liveSmtp: true })
    );
    const community = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ communityStart: true })
    );
    const coredns = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ labSink: "CoreDNS" })
    );
    const compileOnly = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ labSink: "none" })
    );

    expect(internet.jobsQueued).toBe(0);
    expect(internet.code).toBe("email_canary_internet_mail_denied");
    expect(internet.internetMail).toBe(false);
    expect(liveSmtp.jobsQueued).toBe(0);
    expect(liveSmtp.code).toBe("email_canary_live_smtp_denied");
    expect(liveSmtp.smtpAttempted).toBe(false);
    expect(community.jobsQueued).toBe(0);
    expect(community.communityStart).toBe(false);
    expect(community.code).toBe("email_canary_community_start_denied");
    expect(coredns.jobsQueued).toBe(0);
    expect(coredns.ok).toBe(true);
    expect(coredns.code).toBe("email_canary_compiled");
    expect(coredns.recordedPlan).toBeNull();
    expect(compileOnly.jobsQueued).toBe(0);
    expect(compileOnly.ok).toBe(true);
    expect(compileOnly.recordedPlan).toBeNull();
  });

  it("does not enable denied starts when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");

    const gmail = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ recipient: "user@gmail.com" })
    );
    const internet = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ internetMail: true })
    );
    const liveOffensive = runEmailDeliveryCanaryProof(
      qualifiedMailhogInput({ liveOffensive: true })
    );

    expect(gmail.jobsQueued).toBe(0);
    expect(gmail.smtpAttempted).toBe(false);
    expect(internet.jobsQueued).toBe(0);
    expect(internet.internetMail).toBe(false);
    expect(liveOffensive.jobsQueued).toBe(0);
    expect(liveOffensive.code).toBe("email_canary_live_offensive_denied");
    expect(liveOffensive.liveSupported).toBe(false);
  });
});

describe("POST /api/v1/control-sources/:id/email-delivery-canary-proof", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("compiles an owned-recipient MailHog lab canary without SMTP or real exfil", async () => {
    const app = await buildCanaryApp();

    try {
      const response = await app.inject({
        cookies: await authCookie(),
        method: "POST",
        payload: {
          domain: "customer.example",
          emitted: false,
          labSink: "MailHog",
          marker: "periscan-email-delivery-1",
          policyOutcome: "Allowed",
          qualified: true,
          recipient: "canary@customer.example",
          routingEvidence: false,
          scoped: true,
          tenantAuthorized: true
        },
        url: ROUTE
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body.ok).toBe(true);
      expect(body.jobsQueued).toBe(1);
      expect(body.liveSupported).toBe(false);
      expect(body.communityStart).toBe(false);
      expect(body.realDataExfiltrated).toBe(false);
      expect(body.smtpAttempted).toBe(false);
      expect(body.internetMail).toBe(false);
      expect(body.measured).toBe(false);
      expect(body.claimClass).toBe("benign_marker_only");
      expect(body.phishingSendCoverage).toBe("Missing");
      expect(body.moduleId).toBe("periscan.email_delivery_canary");
      expect(body.recordedPlan).toMatchObject({
        kind: "lab-mailhog-sink",
        realDataExfiltrated: false,
        sink: "MailHog",
        smtpAttempted: false
      });
    } finally {
      await app.close();
    }
  });

  it("returns jobsQueued=0 for Gmail recipients and unscoped requests", async () => {
    const app = await buildCanaryApp();

    try {
      const cookies = await authCookie();
      const gmail = await app.inject({
        cookies,
        method: "POST",
        payload: {
          domain: "customer.example",
          labSink: "MailHog",
          policyOutcome: "Allowed",
          qualified: true,
          recipient: "user@gmail.com",
          scoped: true,
          tenantAuthorized: true
        },
        url: ROUTE
      });
      expect(gmail.statusCode).toBe(200);
      expect(gmail.json()).toMatchObject({
        code: "email_canary_owned_recipient_required",
        jobsQueued: 0,
        ok: false,
        realDataExfiltrated: false,
        smtpAttempted: false
      });

      const unscoped = await app.inject({
        cookies,
        method: "POST",
        payload: {
          domain: "customer.example",
          labSink: "MailHog",
          policyOutcome: "Allowed",
          qualified: true,
          recipient: "canary@customer.example",
          scoped: false,
          tenantAuthorized: true
        },
        url: ROUTE
      });
      expect(unscoped.statusCode).toBe(200);
      expect(unscoped.json()).toMatchObject({
        code: "email_canary_unscoped",
        jobsQueued: 0,
        ok: false
      });
    } finally {
      await app.close();
    }
  });

  it("requires authentication", async () => {
    const app = await buildCanaryApp();

    try {
      const response = await app.inject({
        method: "POST",
        payload: {
          domain: "customer.example",
          recipient: "canary@customer.example"
        },
        url: ROUTE
      });
      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("documents OpenAPI operationId, summary, and tags", async () => {
    const app = await buildCanaryApp();

    try {
      await app.ready();
      const document = app.swagger() as {
        paths?: Record<
          string,
          {
            post?: {
              operationId?: string;
              summary?: string;
              tags?: string[];
            };
          }
        >;
      };
      const operation =
        document.paths?.[
          "/api/v1/control-sources/{id}/email-delivery-canary-proof"
        ]?.post;

      expect(operation?.operationId).toBe("runEmailDeliveryCanaryProof");
      expect(operation?.summary ?? "").toMatch(/email delivery canary/i);
      expect(operation?.summary ?? "").toMatch(/never real SMTP|never.*exfil/i);
      expect(operation?.tags).toEqual(
        expect.arrayContaining(["control-sources"])
      );
    } finally {
      await app.close();
    }
  });
});
