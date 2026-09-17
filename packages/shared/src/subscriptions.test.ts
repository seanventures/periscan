import { describe, expect, it } from "vitest";

import {
  CreateSubscriptionLifecycleInputSchema,
  RecordSubscriptionRenewalInputSchema,
  SubscriptionOperationsWorkspaceSchema
} from "./subscriptions";

describe("subscription operations contracts", () => {
  it("requires an explicit direct agreement and a bounded term", () => {
    expect(
      CreateSubscriptionLifecycleInputSchema.parse({
        agreementReference: "ORDER-2026-0042",
        endsAt: "2027-07-15T00:00:00.000Z",
        packageKey: "Enterprise",
        renewalLeadDays: 60,
        source: "DirectAgreement",
        supportOwnerEmail: "success@example.com"
      })
    ).toMatchObject({ packageKey: "Enterprise", renewalLeadDays: 60 });
    expect(() =>
      CreateSubscriptionLifecycleInputSchema.parse({
        agreementReference: "ORDER-2026-0042",
        endsAt: "2027-07-15T00:00:00.000Z",
        packageKey: "Enterprise",
        source: "Stripe",
        supportOwnerEmail: "success@example.com"
      })
    ).toThrow();
  });

  it("keeps approval and decline inputs mutually exclusive", () => {
    expect(
      RecordSubscriptionRenewalInputSchema.parse({
        agreementReference: "RENEWAL-2027-0042",
        decision: "Approve",
        packageKey: "Enterprise",
        reason: "Procurement and support renewal were approved.",
        termMonths: 12
      }).decision
    ).toBe("Approve");
    expect(() =>
      RecordSubscriptionRenewalInputSchema.parse({
        decision: "Decline",
        packageKey: "Enterprise",
        reason: "The customer elected not to renew the subscription."
      })
    ).toThrow();
  });

  it("makes the unconfigured payment boundary part of every workspace", () => {
    expect(
      SubscriptionOperationsWorkspaceSchema.parse({
        chainValid: true,
        commercialBoundary: "Commercial settlement remains outside Periscan.",
        currentPeriod: null,
        daysRemaining: 0,
        events: [],
        generatedAt: "2026-07-15T00:00:00.000Z",
        nextAction: "Create a reviewed direct-agreement lifecycle.",
        paymentProcessorStatus: "NotConfigured",
        periods: [],
        renewalCheckpoints: [],
        subscription: null
      }).paymentProcessorStatus
    ).toBe("NotConfigured");
  });

  it("PERISCAN-469: refuses non-NotConfigured paymentProcessorStatus (no live bank)", () => {
    expect(() =>
      SubscriptionOperationsWorkspaceSchema.parse({
        chainValid: true,
        commercialBoundary: "Commercial settlement remains outside Periscan.",
        currentPeriod: null,
        daysRemaining: 0,
        events: [],
        generatedAt: "2026-07-15T00:00:00.000Z",
        nextAction: "Create a reviewed direct-agreement lifecycle.",
        paymentProcessorStatus: "Connected",
        periods: [],
        renewalCheckpoints: [],
        subscription: null
      })
    ).toThrow();
    expect(() =>
      SubscriptionOperationsWorkspaceSchema.parse({
        chainValid: true,
        commercialBoundary: "Commercial settlement remains outside Periscan.",
        currentPeriod: null,
        daysRemaining: 0,
        events: [],
        generatedAt: "2026-07-15T00:00:00.000Z",
        nextAction: "Create a reviewed direct-agreement lifecycle.",
        paymentProcessorStatus: "Live",
        periods: [],
        renewalCheckpoints: [],
        subscription: null
      })
    ).toThrow();
  });
});
