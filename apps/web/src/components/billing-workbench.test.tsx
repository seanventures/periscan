import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillingWorkbench } from "./billing-workbench";

const snapshotPlan = {
  apiAccess: "Included",
  audiences: ["Security teams"],
  description: "A focused proof loop.",
  includedCapabilities: ["Validation Snapshot"],
  includedMeterNames: ["ValidationMissions"],
  label: "Validation Snapshot",
  packageKey: "ValidationSnapshot",
  paymentProcessorStatus: "NotConfigured",
  publicPricingLanguage: "Contact us for usage-based pricing.",
  status: "Available",
  supportedOutcomes: ["Validate priority paths"]
};

describe("BillingWorkbench", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers honest sales-assisted plan actions without a fake checkout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input);
        if (route === "/api/v1/billing/packages") {
          return new Response(JSON.stringify({ items: [snapshotPlan] }), {
            status: 200
          });
        }
        if (route === "/api/v1/billing/active-package") {
          return new Response(JSON.stringify(snapshotPlan), { status: 200 });
        }
        if (route === "/api/v1/billing/subscription") {
          return new Response(
            JSON.stringify({
              chainValid: true,
              commercialBoundary:
                "Payment processing remains outside Periscan.",
              currentPeriod: null,
              daysRemaining: 0,
              events: [],
              generatedAt: "2026-07-15T00:00:00.000Z",
              nextAction: "Create a reviewed direct-agreement lifecycle.",
              paymentProcessorStatus: "NotConfigured",
              periods: [],
              renewalCheckpoints: [],
              subscription: null
            }),
            { status: 200 }
          );
        }
        if (route === "/api/v1/billing/limits") {
          return new Response(
            JSON.stringify({
              limits: {
                evidenceArtifacts: 100,
                missionsPerMonth: 10,
                runners: 1
              },
              usage: {
                evidenceArtifacts: 2,
                missionsThisMonth: 1,
                runners: 0
              },
              withinLimits: true
            }),
            { status: 200 }
          );
        }
        if (route === "/api/v1/billing/aws-marketplace") {
          return new Response(
            JSON.stringify({
              configured: false,
              dimensionMappings: [],
              listingState: "NotConfigured",
              publicMarketplaceAvailabilityProven: false,
              recentMeteringRecords: [],
              subscription: null
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            billingAccountId: null,
            meteringPeriodEnd: "2026-08-01T00:00:00.000Z",
            meteringPeriodStart: "2026-07-01T00:00:00.000Z",
            meters: [],
            tenantId: "11111111-1111-4111-8111-111111111111"
          }),
          { status: 200 }
        );
      })
    );

    render(<BillingWorkbench />);

    const banner = await screen.findByTestId("billing-sales-led-banner");
    expect(banner).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Sales-led billing — no card checkout/i
      })
    ).toBeInTheDocument();
    expect(banner).toHaveTextContent(/does not collect card details/i);
    expect(banner).toHaveTextContent(/start self-serve checkout/i);
    expect(banner).toHaveTextContent(/approval-reference design partners/i);
    expect(banner).toHaveTextContent(/Payment processor · NotConfigured/i);
    expect(
      screen.getByRole("link", { name: "Contact sales about billing" })
    ).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:sales@periscan.com")
    );
    expect(
      screen.getByRole("link", { name: "Contact Periscan to connect billing" })
    ).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:sales@periscan.com")
    );
    expect(
      screen.getByRole("link", {
        name: "Talk to sales about Validation Snapshot"
      })
    ).toHaveTextContent("Manage with sales");
    expect(
      screen.getAllByText(/Payment processor · NotConfigured/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByTestId("billing-package-card-ValidationSnapshot")
    ).toHaveTextContent("NotConfigured");
    expect(screen.queryByText(/checkout now/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /pay|buy|subscribe|checkout/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Seller integration not configured")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not prove seller approval or public listing/i)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("billing-marketplace-not-configured")
    ).toHaveTextContent(/Marketplace listing · NotConfigured/i);
    expect(
      screen.getByTestId("billing-marketplace-panel")
    ).toHaveTextContent(/publicMarketplaceAvailabilityProven is false/i);
    expect(
      screen.getByTestId("billing-marketplace-panel")
    ).toHaveTextContent(/do not claim a live public Marketplace/i);
    expect(screen.queryByText(/marketplace\.amazon\.com/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /public listing|buy on aws/i })
    ).not.toBeInTheDocument();
  });

  it("keeps NotConfigured honesty when active package is null (no fake free plan)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input);
        if (route === "/api/v1/billing/packages") {
          return new Response(JSON.stringify({ items: [snapshotPlan] }), {
            status: 200
          });
        }
        if (route === "/api/v1/billing/active-package") {
          return new Response(JSON.stringify(null), { status: 200 });
        }
        if (route === "/api/v1/billing/subscription") {
          return new Response(
            JSON.stringify({
              chainValid: true,
              commercialBoundary:
                "Payment processing remains outside Periscan.",
              currentPeriod: null,
              daysRemaining: 0,
              events: [],
              generatedAt: "2026-07-15T00:00:00.000Z",
              nextAction: "Create a reviewed direct-agreement lifecycle.",
              paymentProcessorStatus: "NotConfigured",
              periods: [],
              renewalCheckpoints: [],
              subscription: null
            }),
            { status: 200 }
          );
        }
        if (route === "/api/v1/billing/limits") {
          return new Response(
            JSON.stringify({
              limits: {
                evidenceArtifacts: null,
                missionsPerMonth: null,
                runners: null
              },
              usage: {
                evidenceArtifacts: 0,
                missionsThisMonth: 0,
                runners: 0
              },
              withinLimits: true
            }),
            { status: 200 }
          );
        }
        if (route === "/api/v1/billing/aws-marketplace") {
          return new Response(
            JSON.stringify({
              configured: false,
              dimensionMappings: [],
              listingState: "NotConfigured",
              publicMarketplaceAvailabilityProven: false,
              recentMeteringRecords: [],
              subscription: null
            }),
            { status: 200 }
          );
        }
        if (route === "/api/v1/billing/trial") {
          return new Response(
            JSON.stringify({
              status: "NotStarted"
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            billingAccountId: null,
            meteringPeriodEnd: "2026-08-01T00:00:00.000Z",
            meteringPeriodStart: "2026-07-01T00:00:00.000Z",
            meters: [],
            tenantId: "11111111-1111-4111-8111-111111111111"
          }),
          { status: 200 }
        );
      })
    );

    render(<BillingWorkbench />);

    expect(
      await screen.findByTestId("billing-sales-led-banner")
    ).toBeInTheDocument();
    expect(await screen.findByText("No active plan")).toBeInTheDocument();
    expect(
      screen.getByText(/not a silent free plan or completed purchase/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /pay|buy|subscribe|checkout/i })
    ).not.toBeInTheDocument();
  });
});
