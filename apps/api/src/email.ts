import { randomUUID } from "node:crypto";

import nodemailer from "nodemailer";

// Provider-agnostic transactional email layer. Onboarding/recovery flows
// (invites, password reset, email verification) send through an EmailTransport
// resolved from the environment. The SMTP transport is the real production path;
// the console transport is the default for local/dev (logs the message instead
// of sending); the capture transport is for tests; noop silently drops.
//
// Mirrors the fail-closed env posture of integration-credentials.ts: production
// must configure a real transport rather than silently dropping mail.

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Overrides the configured default From address when set. */
  from?: string;
}

export interface EmailSendResult {
  /** Provider/message id (or a generated id for console/capture transports). */
  id: string;
  /** Which transport handled the send — useful for tests + structured logs. */
  transport: EmailTransportKind;
  accepted: boolean;
}

export type EmailTransportKind = "smtp" | "console" | "capture" | "noop";

export interface EmailTransport {
  readonly kind: EmailTransportKind;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

const DEFAULT_FROM_ADDRESS = "Periscan <no-reply@periscan.local>";

export function resolveEmailFromAddress(
  env: NodeJS.ProcessEnv = process.env
): string {
  return env.PERISCAN_EMAIL_FROM?.trim() || DEFAULT_FROM_ADDRESS;
}

function withFrom(message: EmailMessage, defaultFrom: string): EmailMessage {
  return { ...message, from: message.from ?? defaultFrom };
}

// Logs the rendered message instead of sending. Default for non-production so
// local/dev never needs an SMTP server, but every send is still observable.
export class ConsoleEmailTransport implements EmailTransport {
  readonly kind = "console" as const;

  constructor(
    private readonly defaultFrom: string,
    private readonly log: (message: string) => void = (line) =>
      console.log(line)
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const resolved = withFrom(message, this.defaultFrom);
    const id = randomUUID();
    this.log(
      `[email:console] id=${id} from=${resolved.from} to=${resolved.to} subject=${JSON.stringify(
        resolved.subject
      )}`
    );
    return { accepted: true, id, transport: this.kind };
  }
}

// Keeps every message in memory; used by tests to assert what would be sent.
export class CaptureEmailTransport implements EmailTransport {
  readonly kind = "capture" as const;
  readonly messages: Array<EmailMessage & { from: string; id: string }> = [];

  constructor(private readonly defaultFrom: string = DEFAULT_FROM_ADDRESS) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const resolved = withFrom(message, this.defaultFrom);
    const id = randomUUID();
    this.messages.push({ ...resolved, from: resolved.from!, id });
    return { accepted: true, id, transport: this.kind };
  }
}

// Silently drops mail. Only selected explicitly (PERISCAN_EMAIL_TRANSPORT=noop)
// for environments that intentionally disable outbound email.
export class NoopEmailTransport implements EmailTransport {
  readonly kind = "noop" as const;

  // Param-less: a noop ignores the message. Satisfies EmailTransport.send
  // (an implementation may take fewer parameters than the interface declares).
  async send(): Promise<EmailSendResult> {
    return { accepted: false, id: randomUUID(), transport: this.kind };
  }
}

export interface SmtpEmailTransportConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  defaultFrom: string;
}

// Real production transport via SMTP (nodemailer). Any RFC-compliant provider
// (SES, SendGrid, Postmark, Mailgun, self-hosted) is reached through SMTP creds.
export class SmtpEmailTransport implements EmailTransport {
  readonly kind = "smtp" as const;
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: SmtpEmailTransportConfig) {
    this.transporter = nodemailer.createTransport({
      auth:
        config.user && config.pass
          ? { pass: config.pass, user: config.user }
          : undefined,
      host: config.host,
      port: config.port,
      secure: config.secure
    });
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const resolved = withFrom(message, this.config.defaultFrom);
    const info = await this.transporter.sendMail({
      from: resolved.from,
      html: resolved.html,
      subject: resolved.subject,
      text: resolved.text,
      to: resolved.to
    });
    const accepted = (info.accepted?.length ?? 0) > 0;
    return {
      accepted,
      id: info.messageId ?? randomUUID(),
      transport: this.kind
    };
  }
}

function parseSmtpConfig(
  env: NodeJS.ProcessEnv,
  defaultFrom: string
): SmtpEmailTransportConfig {
  const host = env.PERISCAN_SMTP_HOST?.trim();
  if (!host) {
    throw new Error(
      "PERISCAN_EMAIL_TRANSPORT=smtp requires PERISCAN_SMTP_HOST (and PERISCAN_SMTP_PORT)."
    );
  }
  const port = Number(env.PERISCAN_SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PERISCAN_SMTP_PORT must be a positive integer.");
  }
  // Implicit TLS on 465; STARTTLS (secure:false then upgrade) on 587/others.
  const secure = env.PERISCAN_SMTP_SECURE
    ? env.PERISCAN_SMTP_SECURE === "true"
    : port === 465;
  return {
    defaultFrom,
    host,
    pass: env.PERISCAN_SMTP_PASSWORD?.trim() || undefined,
    port,
    secure,
    user: env.PERISCAN_SMTP_USER?.trim() || undefined
  };
}

// Resolves the active transport from the environment. Default is console in
// dev; production must pick a real transport (smtp/noop) explicitly — it will
// not silently fall back to logging customer mail to stdout.
export function createEmailTransportFromEnv(
  env: NodeJS.ProcessEnv = process.env
): EmailTransport {
  const defaultFrom = resolveEmailFromAddress(env);
  const selected = env.PERISCAN_EMAIL_TRANSPORT?.trim().toLowerCase();
  const isProduction = env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production";

  if (isProduction && selected === "console") {
    throw new Error(
      "PERISCAN_EMAIL_TRANSPORT=console is not allowed in production; use smtp for delivery or noop to intentionally disable outbound email."
    );
  }

  if (isProduction && selected === "smtp" && !env.PERISCAN_EMAIL_FROM?.trim()) {
    throw new Error(
      "PERISCAN_EMAIL_TRANSPORT=smtp requires PERISCAN_EMAIL_FROM in production."
    );
  }

  switch (selected) {
    case "smtp":
      return new SmtpEmailTransport(parseSmtpConfig(env, defaultFrom));
    case "console":
      return new ConsoleEmailTransport(defaultFrom);
    case "noop":
      return new NoopEmailTransport();
    case undefined:
    case "":
      if (isProduction) {
        throw new Error(
          "Set PERISCAN_EMAIL_TRANSPORT (smtp recommended) in production; refusing to default to the console transport, which would log customer mail instead of delivering it."
        );
      }
      return new ConsoleEmailTransport(defaultFrom);
    default:
      throw new Error(
        `Unknown PERISCAN_EMAIL_TRANSPORT=${selected}. Use smtp, console, or noop.`
      );
  }
}
