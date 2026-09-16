import { describe, expect, it, vi } from "vitest";

import {
  CaptureEmailTransport,
  ConsoleEmailTransport,
  createEmailTransportFromEnv,
  NoopEmailTransport,
  resolveEmailFromAddress,
  SmtpEmailTransport,
  type EmailTransport
} from "./email.js";

const message = {
  subject: "Reset your password",
  text: "Use this link",
  to: "user@example.com"
};

describe("resolveEmailFromAddress", () => {
  it("defaults when unset and honors PERISCAN_EMAIL_FROM", () => {
    expect(resolveEmailFromAddress({})).toContain("@");
    expect(
      resolveEmailFromAddress({ PERISCAN_EMAIL_FROM: "Ops <ops@corp.com>" })
    ).toBe("Ops <ops@corp.com>");
  });
});

describe("ConsoleEmailTransport", () => {
  it("logs and returns an accepted result", async () => {
    const log = vi.fn();
    const transport = new ConsoleEmailTransport("from@corp.com", log);

    const result = await transport.send(message);

    expect(result.transport).toBe("console");
    expect(result.accepted).toBe(true);
    expect(result.id).toMatch(/[0-9a-f-]{36}/u);
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[0]).toContain("to=user@example.com");
  });
});

describe("CaptureEmailTransport", () => {
  it("records messages and applies the default + per-message from", async () => {
    const transport = new CaptureEmailTransport("default@corp.com");

    await transport.send(message);
    await transport.send({ ...message, from: "override@corp.com" });

    expect(transport.messages).toHaveLength(2);
    expect(transport.messages[0]?.from).toBe("default@corp.com");
    expect(transport.messages[1]?.from).toBe("override@corp.com");
    expect(transport.messages[0]?.to).toBe("user@example.com");
  });
});

describe("NoopEmailTransport", () => {
  it("drops mail (accepted=false)", async () => {
    const transport: EmailTransport = new NoopEmailTransport();
    const result = await transport.send(message);
    expect(result.transport).toBe("noop");
    expect(result.accepted).toBe(false);
  });
});

describe("createEmailTransportFromEnv", () => {
  it("defaults to console outside production", () => {
    const transport = createEmailTransportFromEnv({});
    expect(transport.kind).toBe("console");
  });

  it("refuses to silently default in production", () => {
    expect(() =>
      createEmailTransportFromEnv({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production"
      })
    ).toThrow(/PERISCAN_EMAIL_TRANSPORT/u);
  });

  it("rejects console transport in production", () => {
    expect(() =>
      createEmailTransportFromEnv({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_EMAIL_TRANSPORT: "console"
      })
    ).toThrow(/console is not allowed in production/u);
  });

  it("requires an explicit sender for production SMTP", () => {
    expect(() =>
      createEmailTransportFromEnv({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_EMAIL_TRANSPORT: "smtp",
        PERISCAN_SMTP_HOST: "smtp.example.com"
      })
    ).toThrow(/PERISCAN_EMAIL_FROM/u);

    const transport = createEmailTransportFromEnv({
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_EMAIL_FROM: "Security <security@example.com>",
      PERISCAN_EMAIL_TRANSPORT: "smtp",
      PERISCAN_SMTP_HOST: "smtp.example.com"
    });
    expect(transport).toBeInstanceOf(SmtpEmailTransport);
  });

  it("builds an SMTP transport and requires a host", () => {
    const transport = createEmailTransportFromEnv({
      PERISCAN_EMAIL_TRANSPORT: "smtp",
      PERISCAN_SMTP_HOST: "smtp.example.com",
      PERISCAN_SMTP_PORT: "587"
    });
    expect(transport).toBeInstanceOf(SmtpEmailTransport);

    expect(() =>
      createEmailTransportFromEnv({ PERISCAN_EMAIL_TRANSPORT: "smtp" })
    ).toThrow(/PERISCAN_SMTP_HOST/u);
  });

  it("supports noop and rejects unknown transports", () => {
    expect(
      createEmailTransportFromEnv({ PERISCAN_EMAIL_TRANSPORT: "noop" }).kind
    ).toBe("noop");
    expect(() =>
      createEmailTransportFromEnv({
        PERISCAN_EMAIL_TRANSPORT: "carrier-pigeon"
      })
    ).toThrow(/Unknown PERISCAN_EMAIL_TRANSPORT/u);
  });
});
