import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportsWorkbench } from "./reports-workbench";

const timestamp = "2026-07-14T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";

function stubReportsApis() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      if (route.endsWith("/api/v1/snapshots") || route.endsWith("/snapshots")) {
        return {
          json: async () => ({ items: [] }),
          ok: true,
          status: 200
        };
      }
      if (route.endsWith("/api/v1/reports") || route.endsWith("/reports")) {
        return {
          json: async () => ({ items: [] }),
          ok: true,
          status: 200
        };
      }
      if (
        route.endsWith("/api/v1/evidence/verify-chain") ||
        route.endsWith("/evidence/verify-chain")
      ) {
        return {
          json: async () => ({
            brokenAtSeq: null,
            chainedArtifacts: 0,
            checked: 0,
            legacyUnchainedArtifacts: 0,
            links: [],
            method: {
              algorithm: "SHA-256",
              authority: "Periscan evidence service",
              description:
                "Tenant-scoped hash-chain verification. This is a tamper-evident commitment, not an external digital signature.",
              signaturePresent: false
            },
            reason: null,
            tenantId,
            totalArtifacts: 0,
            valid: true,
            verifiedAt: timestamp
          }),
          ok: true,
          status: 200
        };
      }
      return {
        json: async () => ({ items: [] }),
        ok: true,
        status: 200
      };
    }) as unknown as typeof fetch
  );
}

describe("ReportsWorkbench", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/reports");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/reports");
  });

  it("surfaces integrity watermark note for claim-safe exports (UX-W9 / #199)", async () => {
    stubReportsApis();
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    const note = screen.getByTestId("export-integrity-note");
    expect(note).toBeInTheDocument();
    expect(note.textContent).toMatch(/claim-safe language/i);
    expect(note.textContent).toMatch(/integrity hashes when available/i);
  });

  it("exposes ExecutiveRiskSummary board pack and Board brief preset (ICP-P1-5)", async () => {
    stubReportsApis();
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    const packSelect = screen.getByDisplayValue(
      "Board pack (Executive Risk Summary)"
    ) as HTMLSelectElement;
    expect(packSelect.value).toBe("ExecutiveRiskSummary");
    expect(
      screen.getByRole("option", {
        name: "Board pack (Executive Risk Summary)"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("report-preset-board-brief")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generate board pack/i })
    ).toBeInTheDocument();
  });

  it("honors ?pack=board deep link from Executive Build board pack", async () => {
    window.history.replaceState({}, "", "/reports?pack=board");
    stubReportsApis();
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    await waitFor(() => {
      const packSelect = screen.getByDisplayValue(
        "Board pack (Executive Risk Summary)"
      ) as HTMLSelectElement;
      expect(packSelect.value).toBe("ExecutiveRiskSummary");
    });
    expect(
      screen.getByRole("button", { name: /Generate board pack/i })
    ).toBeInTheDocument();
  });

  it("surfaces isolation proof as a primary MSSP/CISO diligence CTA (P03/P05)", async () => {
    stubReportsApis();
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    const panel = screen.getByTestId("isolation-proof-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveTextContent(/MSSP \/ CISO diligence/i);
    expect(
      screen.getByTestId("isolation-proof-diligence-callout")
    ).toHaveTextContent(/Primary diligence CTA/i);
    expect(
      screen.getByTestId("generate-isolation-proof")
    ).toHaveTextContent(/Generate isolation proof/i);
    // Must not overclaim Type II from isolation pack alone.
    expect(panel).toHaveTextContent(/never assumes compliance/i);
    expect(panel).toHaveTextContent(/SOC 2 Type II/i);
  });
});
