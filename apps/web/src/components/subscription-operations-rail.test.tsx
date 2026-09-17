import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubscriptionOperationsRail } from "./subscription-operations-rail";

const tenantId = "11111111-1111-4111-8111-111111111111";
const lifecycleId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const workspace = {
  chainValid: true,
  commercialBoundary:
    "Periscan records approved entitlement terms; it does not charge cards or calculate tax.",
  currentPeriod: {
    closedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    endsAt: "2027-07-01T00:00:00.000Z",
    packageKey: "Enterprise",
    sequence: 1,
    startsAt: "2026-07-01T00:00:00.000Z",
    status: "Open",
    subscriptionLifecycleId: lifecycleId,
    subscriptionPeriodId: "44444444-4444-4444-8444-444444444444",
    tenantId,
    usageSnapshot: null
  },
  daysRemaining: 351,
  events: [
    {
      action: "Started",
      createdAt: "2026-07-01T00:00:00.000Z",
      createdBy: userId,
      eventHash: "a".repeat(64),
      metadata: { packageKey: "Enterprise" },
      nextStatus: "Active",
      previousEventHash: null,
      previousStatus: null,
      reason:
        "Reviewed direct agreement recorded for continuous entitlement operations.",
      reference: "ORDER-42",
      sequence: 1,
      subscriptionEventId: "55555555-5555-4555-8555-555555555555",
      subscriptionLifecycleId: lifecycleId,
      tenantId
    }
  ],
  generatedAt: "2026-07-15T00:00:00.000Z",
  nextAction: "Monitor usage and prepare the renewal decision.",
  paymentProcessorStatus: "NotConfigured",
  periods: [],
  renewalCheckpoints: [
    {
      daysBeforeEnd: 60,
      dueAt: "2027-05-02T00:00:00.000Z",
      label: "60-day review",
      state: "Upcoming"
    },
    {
      daysBeforeEnd: 0,
      dueAt: "2027-07-01T00:00:00.000Z",
      label: "Term boundary",
      state: "Upcoming"
    }
  ],
  subscription: {
    agreementReference: "ORDER-42",
    cancellationReason: null,
    cancellationReference: null,
    cancellationScheduledAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    createdBy: userId,
    endedAt: null,
    graceEndsAt: null,
    graceReference: null,
    packageKey: "Enterprise",
    renewalAgreementReference: null,
    renewalDecision: "Unreviewed",
    renewalDecisionReason: null,
    renewalLeadDays: 60,
    renewalPackageKey: null,
    source: "DirectAgreement",
    status: "Active",
    subscriptionLifecycleId: lifecycleId,
    supportOwnerEmail: "success@example.com",
    tenantId,
    updatedAt: "2026-07-01T00:00:00.000Z",
    version: 1
  }
};

const enterprisePackage = {
  apiAccess: "Enterprise",
  audiences: ["Enterprise security teams"],
  description: "Continuous validation operations.",
  includedCapabilities: ["Validation Snapshot"],
  includedMeterNames: ["ValidationMissions"],
  label: "Enterprise",
  packageKey: "Enterprise",
  paymentProcessorStatus: "NotConfigured",
  publicPricingLanguage: "Contact us for usage-based pricing.",
  status: "ContactSales",
  supportedOutcomes: ["Continuous validation"]
};

describe("SubscriptionOperationsRail", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the continuity boundary and records a reviewed renewal", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input);
        if (route === "/api/v1/billing/packages") {
          return new Response(JSON.stringify({ items: [enterprisePackage] }), {
            status: 200
          });
        }
        if (
          route === "/api/v1/billing/subscription/renewal" &&
          init?.method === "POST"
        ) {
          return new Response(JSON.stringify(workspace), { status: 200 });
        }
        return new Response(JSON.stringify(workspace), { status: 200 });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<SubscriptionOperationsRail />);

    expect(await screen.findByText("Renewal continuity")).toBeInTheDocument();
    expect(screen.getByText("Ledger verified")).toBeInTheDocument();
    expect(
      screen.getByTestId("subscription-payment-processor-status")
    ).toHaveTextContent("Payment processor · NotConfigured");
    expect(screen.getByText("60-day review")).toBeInTheDocument();
    expect(screen.getByText("Immutable lifecycle ledger")).toBeInTheDocument();
    expect(screen.getByText(/does not charge cards/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Payment processor · NotConfigured/i).length
    ).toBeGreaterThanOrEqual(1);

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Renewal agreement reference"
      }),
      { target: { value: "RENEWAL-43" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve next term" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/billing/subscription/renewal",
        expect.objectContaining({
          body: expect.stringContaining('"agreementReference":"RENEWAL-43"'),
          method: "POST"
        })
      )
    );
  });
});
