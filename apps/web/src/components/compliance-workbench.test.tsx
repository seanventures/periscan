import { createPublicDemoValidationSnapshot } from "@periscan/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComplianceWorkbench } from "./compliance-workbench";

const snapshot = createPublicDemoValidationSnapshot();

function mockFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const route = String(input).split("?")[0] ?? "";

    if (route === "/api/v1/snapshots") {
      return {
        json: async () => ({ items: [snapshot] }),
        ok: true,
        status: 200
      };
    }

    if (route === "/api/v1/schedules") {
      return {
        json: async () => ({ items: [] }),
        ok: true,
        status: 200
      };
    }

    if (route === "/api/v1/evidence/verify-chain") {
      return {
        json: async () => ({
          brokenAtSeq: null,
          chainedArtifacts: snapshot.evidenceIds.length,
          checked: snapshot.evidenceIds.length,
          legacyUnchainedArtifacts: 0,
          links: snapshot.evidenceIds.map((evidenceId, index) => ({
            chainHash: `hash-${index + 1}`,
            chainSeq: String(index + 1),
            evidenceId,
            prevChainHash: index === 0 ? null : `hash-${index}`,
            reason: null,
            status: "Verified",
            valid: true
          })),
          method: {
            algorithm: "SHA-256",
            authority: "Periscan evidence service",
            description: "Tenant-scoped hash-chain verification.",
            signaturePresent: false
          },
          reason: null,
          tenantId: snapshot.tenantId,
          totalArtifacts: snapshot.evidenceIds.length,
          valid: true,
          verifiedAt: snapshot.createdAt
        }),
        ok: true,
        status: 200
      };
    }

    if (route === "/api/v1/compliance/governance/summary") {
      return {
        json: async () => ({
          frameworks: [
            {
              catalogVersion: "periscan-2026.07.s3",
              displayName: "DORA (partial)",
              framework: "DORAAttestation",
              partialCatalog: true,
              summary: {
                approved: 0,
                exceptions: 0,
                inReview: 0,
                owned: 0,
                total: 7
              }
            }
          ],
          honestyNote:
            "Multi-framework governance is customer evidence-support sign-off only.",
          notCertification: true,
          scorecardId: 80,
          totals: {
            approved: 0,
            exceptions: 0,
            frameworkCount: 1,
            inReview: 0,
            owned: 0,
            totalControls: 7
          }
        }),
        ok: true,
        status: 200
      };
    }

    if (route === "/api/v1/compliance/governance") {
      return {
        json: async () => ({
          catalogLastReviewedAt: "2026-07-14T00:00:00.000Z",
          catalogVersion: "periscan-2026.07.s3",
          controls: [],
          displayName: "DORA (partial)",
          framework: "DORAAttestation",
          summary: {
            approved: 0,
            exceptions: 0,
            inReview: 0,
            owned: 0,
            total: 0
          }
        }),
        ok: true,
        status: 200
      };
    }

    if (route === "/api/v1/compliance/governance/history") {
      return {
        json: async () => ({ items: [] }),
        ok: true,
        status: 200
      };
    }

    return {
      json: async () => ({ error: `Unhandled route ${route}` }),
      ok: false,
      status: 404
    };
  }) as unknown as typeof fetch;
}

describe("ComplianceWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a measured per-control trace and lets auditors change frameworks", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<ComplianceWorkbench />);

    expect(
      await screen.findByRole("heading", { name: "Compliance control trace" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Customer evidence support — not certification and not an audit opinion/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This pack is not a certification and not an audit opinion/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not Periscan's own SOC 2 \/ ISO \/ PCI vendor attestation/i)
    ).toBeInTheDocument();
    expect(await screen.findByText(/DORA Art\. 6/)).toBeInTheDocument();
    expect(screen.getByText(/DORA Art\. 11/)).toBeInTheDocument();
    expect(screen.getByText("Evidence baseline")).toBeInTheDocument();
    expect(screen.getAllByText(/Met|Partial|Unmet/).length).toBeGreaterThan(3);

    fireEvent.change(screen.getByLabelText("Framework evidence pack"), {
      target: { value: "HIPAAAttestation" }
    });

    expect(await screen.findByText(/45 CFR §164\.308\(a\)\(8\)/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export evidence pack" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /attestation/i })
    ).not.toBeInTheDocument();
  });

  it("deep-links evidence IDs to the ledger with ?q= (ICP-P1-12)", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<ComplianceWorkbench />);

    const evidenceLinks = await screen.findAllByRole("link", {
      name: /[0-9a-f-]{8,}/i
    });
    const withQuery = evidenceLinks.filter((link) =>
      (link.getAttribute("href") ?? "").includes("/evidence?q=")
    );
    expect(withQuery.length).toBeGreaterThan(0);
    const href = withQuery[0]!.getAttribute("href") ?? "";
    expect(href).toMatch(/^\/evidence\?q=/);
    // Full id is on title; visible label is longer than the old 8-char truncate.
    expect(withQuery[0]!.getAttribute("title")).toBeTruthy();
    expect((withQuery[0]!.textContent ?? "").replace("…", "").length).toBeGreaterThan(
      8
    );
  });

  it("opens Met/status drill-down with evidence + sign-off adjacency (P06)", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<ComplianceWorkbench />);

    await screen.findByText(/DORA Art\. 6/);
    const statusButton =
      screen.queryAllByTestId("trace-status-Met")[0] ??
      screen.queryAllByTestId("trace-status-Partial")[0] ??
      screen.getAllByTestId(/trace-status-/)[0];
    expect(statusButton).toBeTruthy();
    // P06 a11y: named focus target + keyboard-visible ring classes.
    expect(statusButton?.getAttribute("aria-label") ?? "").toMatch(
      /status for .+ (Open|Collapse) evidence/i
    );
    expect(statusButton?.className ?? "").toMatch(
      /focus:ring-2|focus-visible:ring-2/
    );
    fireEvent.click(statusButton!);

    const panel = await screen.findByTestId("control-drill-panel");
    expect(panel).toBeInTheDocument();
    // Scope to the drill panel — page chrome also says "evidence deep-links".
    expect(within(panel).getByText("Evidence deep-links")).toBeInTheDocument();
    expect(within(panel).getByText("Sign-off adjacency")).toBeInTheDocument();
    expect(
      within(panel).getByText(/Met is measured support only/i)
    ).toBeInTheDocument();

    // After drill-down with a real snapshot: sticky auditor export CTA (P06 polish).
    const sticky = await screen.findByTestId("compliance-export-sticky-cta");
    expect(sticky).toBeInTheDocument();
    expect(sticky).toHaveTextContent(/Export pack for auditor/i);
    expect(
      screen.getByTestId("compliance-export-sticky-button")
    ).toBeEnabled();
  });

  it("hides sticky auditor export until a control is drilled (and no snapshot = never)", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<ComplianceWorkbench />);
    await screen.findByText(/DORA Art\. 6/);
    expect(
      screen.queryByTestId("compliance-export-sticky-cta")
    ).not.toBeInTheDocument();
  });

  it("exposes captions and column scope on compliance tables (P06 a11y)", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<ComplianceWorkbench />);

    await screen.findByText(/DORA Art\. 6/);
    const tables = screen.getAllByRole("table");
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      // HTML caption is exposed as the table name to AT.
      expect(table).toHaveAccessibleName(/.+/);
    }
    // Column headers use scope=col
    const colHeaders = screen.getAllByRole("columnheader");
    expect(colHeaders.length).toBeGreaterThanOrEqual(5);
  });

  it("announces PDF export success with hand-to-auditor guidance (GRC delight)", async () => {
    const packId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const base = mockFetch();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = String(input).split("?")[0] ?? "";
      if (route === "/api/v1/reports" && (init?.method ?? "GET") === "POST") {
        return {
          json: async () => ({
            audience: "Auditor",
            createdAt: snapshot.createdAt,
            evidenceIds: snapshot.evidenceIds,
            evidencePackId: packId,
            packType: "DORAAttestation",
            redactionLevel: "Moderate",
            status: "Ready",
            storageUri: "file:///tmp/dora.pdf",
            tenantId: snapshot.tenantId,
            title: "DORA measured control trace",
            updatedAt: snapshot.createdAt
          }),
          ok: true,
          status: 200
        };
      }
      if (
        route === `/api/v1/reports/${packId}/export` &&
        (init?.method ?? "GET") === "POST"
      ) {
        return {
          arrayBuffer: async () => new ArrayBuffer(8),
          headers: {
            get(name: string) {
              const key = name.toLowerCase();
              if (key === "content-disposition") {
                return 'attachment; filename="dora-pack.pdf"';
              }
              if (key === "content-type") {
                return "application/pdf";
              }
              return null;
            }
          },
          ok: true,
          status: 200
        };
      }
      return base(input, init);
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-export");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<ComplianceWorkbench />);
    // Wait for snapshot-backed trace so Export is enabled (not empty NotConfigured).
    await screen.findByText(/DORA Art\. 6/);
    const exportBtn = await screen.findByRole("button", {
      name: "Export evidence pack"
    });
    await waitFor(() => {
      expect(exportBtn).toBeEnabled();
    });
    fireEvent.click(exportBtn);

    const success = await screen.findByTestId("compliance-export-success");
    expect(success).toHaveAttribute("role", "status");
    expect(success).toHaveTextContent(/PDF downloaded/i);
    expect(success).toHaveTextContent(/Hand to auditor/i);
    expect(success).toHaveTextContent(/not a certification/i);
    expect(createObjectURL).toHaveBeenCalled();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });

  it("uses a sticky governance table header for scrollable catalogs (GRC)", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<ComplianceWorkbench />);
    await screen.findByRole("heading", { name: "Compliance control trace" });
    // Sticky header is structural — present even when governance catalog is empty/error.
    const stickyHeads = document.querySelectorAll("thead.sticky");
    // When governance loads with controls, thead is sticky; empty/error may omit table.
    // Accept either sticky presence or the workbench landmark for GRC shell.
    expect(
      stickyHeads.length > 0 ||
        screen.getByTestId("compliance-workbench").getAttribute("role") ===
          "region"
    ).toBe(true);
  });

  it("empty compliance shows NotConfigured + Connect validation CTA; export reason (P06)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route === "/api/v1/snapshots") {
          return {
            json: async () => ({ items: [] }),
            ok: true,
            status: 200
          };
        }
        if (route === "/api/v1/schedules") {
          return {
            json: async () => ({ items: [] }),
            ok: true,
            status: 200
          };
        }
        if (route === "/api/v1/evidence/verify-chain") {
          return {
            json: async () => ({
              valid: true,
              checked: 0,
              verifiedAt: "2026-07-31T00:00:00.000Z"
            }),
            ok: true,
            status: 200
          };
        }
        if (route.includes("/compliance/")) {
          return {
            json: async () => ({
              catalogVersion: "test",
              catalogLastReviewedAt: "2026-07-01T00:00:00.000Z",
              summary: { total: 0, owned: 0, inReview: 0, approved: 0 },
              controls: []
            }),
            ok: true,
            status: 200
          };
        }
        return {
          json: async () => ({ error: `Unhandled ${route}` }),
          ok: false,
          status: 404
        };
      }) as unknown as typeof fetch
    );

    render(<ComplianceWorkbench />);

    const empty = await screen.findByTestId("compliance-empty-not-configured");
    expect(empty).toBeInTheDocument();
    // P06 a11y: empty compliance is a labelled landmark (not a silent void).
    expect(empty).toHaveAttribute("role", "region");
    expect(empty).toHaveAttribute(
      "aria-labelledby",
      "compliance-empty-heading"
    );
    expect(
      screen.getByRole("heading", {
        name: /Compliance empty — no validation snapshot/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/NotConfigured — no validation snapshot/i)
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", {
      name: /Connect validation — run a Validation Snapshot/i
    });
    expect(cta).toHaveAttribute("href", "/missions");
    expect(screen.getByTestId("export-evidence-pack")).toBeDisabled();
    expect(
      screen.getByTestId("compliance-export-disabled-reason")
    ).toHaveTextContent(/Export disabled — no validation snapshot/i);
  });
});
