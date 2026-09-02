import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContinuousValidationHub } from "./continuous-validation-hub";

const timestamp = "2026-07-14T12:00:00.000Z";

describe("ContinuousValidationHub", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows schedule operations depth from live schedules", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/schedules") {
          return {
            json: async () => ({
              items: [
                {
                  config: {},
                  createdAt: timestamp,
                  createdBy: "22222222-2222-4222-8222-222222222222",
                  frequency: "Daily",
                  lastDiff: { verificationOutcome: "Fixed" },
                  lastMissionId: null,
                  lastRunAt: timestamp,
                  lastSnapshotId: null,
                  missionType: "ContinuousValidation",
                  nextRunAt: "2026-07-30T09:00:00.000Z",
                  scheduleId: "33333333-3333-4333-8333-333333333333",
                  scopeIds: ["44444444-4444-4444-8444-444444444444"],
                  status: "Active",
                  tenantId: "11111111-1111-4111-8111-111111111111",
                  updatedAt: timestamp
                }
              ]
            }),
            ok: true,
            status: 200
          };
        }
        throw new Error(`Unhandled route ${route}`);
      }) as unknown as typeof fetch
    );

    render(<ContinuousValidationHub />);

    const summary = await screen.findByRole("region", {
      name: "Schedule operations summary"
    });
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent("ContinuousValidation");
    expect(summary).toHaveTextContent(/never silently replayed/i);
    expect(screen.getByTestId("continuous-easm-honesty")).toHaveTextContent(
      /verified customer scopes/i
    );
    expect(screen.getByTestId("continuous-easm-honesty")).toHaveTextContent(
      /not an autonomous living external map/i
    );
    expect(
      screen.getByRole("link", { name: /External PoA/i })
    ).toHaveAttribute("href", "/external-validation");
    expect(
      screen.getByRole("link", { name: /^Open blue shift$/i })
    ).toHaveAttribute("href", "/shift");
    // Run section card still lists Blue shift as a plan/run destination.
    expect(
      screen.getAllByRole("link", { name: /blue shift/i }).length
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByRole("link", { name: /Authorized scope/i })
    ).toHaveAttribute("href", "/scopes");
    expect(
      screen.getByRole("link", { name: /Measure multi-hop paths/i })
    ).toHaveAttribute("href", "/attack-paths");
    // UX-W6 punch #5: Validation Ops demoted into Continuous Health as Labs deep-link.
    expect(
      screen.getByRole("link", { name: /Live validation ops \(Labs\)/i })
    ).toHaveAttribute("href", "/validation-ops");
    expect(screen.getByTestId("continuous-multihop-journey")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Operator journey help/i })
    ).toHaveAttribute("href", "/getting-started");
    expect(
      screen.getByRole("link", { name: /Open attack paths/i })
    ).toHaveAttribute("href", "/attack-paths");
    // ICP-P1-7: Sales walk demoted behind Labs details — not a default analyst board.
    const salesWalk = screen.getByTestId("continuous-sales-walk");
    expect(salesWalk).toBeInTheDocument();
    expect(salesWalk.tagName.toLowerCase()).toBe("details");
    expect(salesWalk).toHaveTextContent(/Sales walk \(honest\)/i);
    expect(salesWalk).toHaveTextContent(/Labs/i);
    // Steps stay in the DOM for SE walk; collapsed by default.
    expect(
      salesWalk.querySelector('a[href="/scopes"]')
    ).toBeTruthy();
    expect(
      salesWalk.querySelector('a[href="/engines"]')
    ).toBeTruthy();
    expect(
      salesWalk.querySelector('a[href="/controls"]')
    ).toBeTruthy();
    expect(
      salesWalk.querySelector('a[href="/findings"]')
    ).toBeTruthy();
    expect(
      salesWalk.querySelector('a[href="/attack-paths"]')
    ).toBeTruthy();
    expect(
      salesWalk.querySelector('a[href="/continuous"]')
    ).toBeTruthy();
    expect(salesWalk).toHaveTextContent(/no fake demo data/i);
    expect(salesWalk).toHaveTextContent(/no inject claims/i);
    expect(
      screen.getByRole("region", {
        name: "Specialist and partner-gated coverage"
      })
    ).toBeInTheDocument();
  });
});
