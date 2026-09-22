import { createPublicDemoValidationSnapshot } from "@periscan/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportsWorkbench } from "./reports-workbench";

const timestamp = "2026-07-14T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const CTEM_PACK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const soc2PackId = "12121212-1212-4212-8212-121212121212";

function jsonResponse(
  payload: unknown,
  init?: { ok?: boolean; status?: number }
) {
  const status = init?.status ?? 200;
  return {
    json: async () => payload,
    ok: init?.ok ?? status < 400,
    status
  };
}

function htmlDownloadResponse(content: string, filename: string) {
  return {
    headers: {
      get(name: string) {
        const key = name.toLowerCase();
        if (key === "content-disposition") {
          return `attachment; filename="${filename}"`;
        }
        if (key === "content-type") {
          return "text/html; charset=utf-8";
        }
        return null;
      }
    },
    ok: true,
    status: 200,
    text: async () => content
  };
}

function postCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const init = call[1] as RequestInit | undefined;
    return (init?.method ?? "GET").toUpperCase() === "POST";
  });
}

function ctemPackFixture(overrides: Record<string, unknown> = {}) {
  return {
    audience: "Executive",
    createdAt: timestamp,
    evidenceIds: ["33333333-3333-4333-8333-333333333333"],
    evidencePackId: CTEM_PACK_ID,
    packType: "CTEMProgramSummary",
    redactionLevel: "Moderate",
    status: "Ready",
    storageUri: "memory://ctem-program-summary.html",
    tenantId,
    title: "CTEM Program Summary",
    updatedAt: timestamp,
    ...overrides
  };
}

function stubReportsApis(options?: {
  createdPack?: Record<string, unknown>;
  packs?: Array<Record<string, unknown>>;
  snapshots?: unknown[];
  onCreateReport?: (
    body: Record<string, unknown>
  ) => unknown | Promise<unknown>;
  onExportReport?: (
    reportId: string,
    body: Record<string, unknown>
  ) => unknown | Promise<unknown>;
}) {
  const packs = [...(options?.packs ?? [])];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const route = String(input).split("?")[0] ?? "";
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      if (route.endsWith("/api/v1/compliance/coverage")) {
        return {
          json: async () => ({
            catalogVersion: "periscan-2026.07",
            configured: false,
            controls: [],
            coverageRatio: 0,
            disclaimer:
              "Customer evidence support only (partial catalog). This pack is not a certification and not an audit opinion.",
            displayName:
              "Customer SOC 2 support evidence (partial Trust Services Criteria — not vendor attestation)",
            framework: "SOC2Attestation",
            metCount: 0,
            notCertification: true,
            partialCount: 0,
            snapshotId: null,
            unmetCount: 0
          }),
          ok: true,
          status: 200
        };
      }
      if (
        (route.endsWith("/api/v1/snapshots") || route.endsWith("/snapshots")) &&
        method === "GET"
      ) {
        return jsonResponse({ items: options?.snapshots ?? [] });
      }
      if (route.endsWith("/api/v1/snapshots") || route.endsWith("/snapshots")) {
        return {
          json: async () => ({ items: options?.snapshots ?? [] }),
          ok: true,
          status: 200
        };
      }
      if (
        (route.endsWith("/api/v1/reports") || route.endsWith("/reports")) &&
        method === "POST"
      ) {
        if (options?.onCreateReport) {
          return jsonResponse(await options.onCreateReport(body), {
            status: 201
          });
        }
        const created = options?.createdPack ?? ctemPackFixture();
        packs.unshift(created);
        return {
          json: async () => created,
          ok: true,
          status: 201
        };
      }
      if (route.endsWith("/api/v1/reports") || route.endsWith("/reports")) {
        return {
          json: async () => ({ items: packs }),
          ok: true,
          status: 200
        };
      }
      const exportMatch = /\/api\/v1\/reports\/([^/]+)\/export$/.exec(route);
      const exportPackId = exportMatch?.[1];
      if (exportPackId && method === "POST") {
        if (options?.onExportReport) {
          return await options.onExportReport(exportPackId, body);
        }
        if (exportPackId === CTEM_PACK_ID) {
          return {
            headers: new Headers({
              "content-disposition":
                'attachment; filename="ctem-program-summary.html"',
              "content-type": "text/html; charset=utf-8"
            }),
            json: async () => null,
            ok: true,
            status: 200,
            text: async () =>
              "<html><body>Periscan CTEM Program Summary</body></html>"
          };
        }
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
    }
  );
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
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
    expect(screen.getByTestId("report-preset-board-brief")).toBeInTheDocument();
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
    expect(screen.getByTestId("generate-isolation-proof")).toHaveTextContent(
      /Generate isolation proof/i
    );
    // Must not overclaim Type II from isolation pack alone.
    expect(panel).toHaveTextContent(/never assumes compliance/i);
    expect(panel).toHaveTextContent(/SOC 2 Type II/i);
  });

  it("offers CTEM Program Summary as authorized proof, not a certification", async () => {
    stubReportsApis();
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    const option = screen.getByRole("option", {
      name: "CTEM Program Summary"
    });
    expect(option).toHaveValue("CTEMProgramSummary");

    fireEvent.change(screen.getByLabelText("Pack type"), {
      target: { value: "CTEMProgramSummary" }
    });

    expect(screen.getByLabelText("Pack type")).toHaveValue(
      "CTEMProgramSummary"
    );
    expect(
      screen.getByText(/program summary of authorized proof/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/not a certification/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Generate CTEM program summary/i })
    ).toBeInTheDocument();
  });

  it("generates the CTEM pack through POST /api/v1/reports, not a sample", async () => {
    const fetchMock = stubReportsApis({
      createdPack: ctemPackFixture()
    });
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pack type"), {
      target: { value: "CTEMProgramSummary" }
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Generate CTEM program summary/i })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/reports",
        expect.objectContaining({
          body: expect.stringMatching(/"packType"\s*:\s*"CTEMProgramSummary"/),
          method: "POST"
        })
      );
    });

    expect(
      await screen.findByText(/CTEM Program Summary is ready to export/i)
    ).toBeInTheDocument();
    const sampleCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("sample")
    );
    expect(sampleCalls).toHaveLength(0);
  });

  it("downloads a CTEM pack from POST /api/v1/reports/:id/export", async () => {
    const fetchMock = stubReportsApis({
      packs: [ctemPackFixture()]
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:ctem-export");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<ReportsWorkbench />);

    expect(
      await screen.findByText(/CTEMProgramSummary · 1 evidence/)
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "HTML" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/reports/${CTEM_PACK_ID}/export`,
        expect.objectContaining({
          body: expect.stringMatching(/"format"\s*:\s*"html"/),
          method: "POST"
        })
      );
    });
    expect(createObjectURL).toHaveBeenCalled();

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });

  it("shows SOC 2 CC* control coverage from measured evidence, never certified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route.endsWith("/api/v1/compliance/coverage")) {
          return {
            json: async () => ({
              catalogVersion: "periscan-2026.07",
              configured: true,
              coverageRatio: 1 / 3,
              disclaimer:
                "Customer evidence support only (partial catalog). This pack is not a certification and not an audit opinion.",
              displayName:
                "Customer SOC 2 support evidence (partial Trust Services Criteria — not vendor attestation)",
              framework: "SOC2Attestation",
              metCount: 1,
              notCertification: true,
              partialCount: 1,
              snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              unmetCount: 1,
              controls: [
                {
                  controlId: "SOC 2 CC7.1 — Detection and monitoring",
                  evidencedBy: [
                    "control-detection-validation",
                    "continuous-validation"
                  ],
                  evidenceIds: ["22222222-2222-4222-8222-222222222222"],
                  lastValidatedAt: timestamp,
                  missing: ["continuous-validation"],
                  satisfiedBy: ["control-detection-validation"],
                  status: "Partial",
                  title: "Detect configuration changes and new vulnerabilities"
                },
                {
                  controlId: "SOC 2 CC7.2 — Security event monitoring",
                  evidencedBy: ["control-detection-validation"],
                  evidenceIds: ["22222222-2222-4222-8222-222222222222"],
                  lastValidatedAt: timestamp,
                  missing: [],
                  satisfiedBy: ["control-detection-validation"],
                  status: "Met",
                  title:
                    "Monitor system components for anomalies and security events"
                },
                {
                  controlId: "SOC 2 CC7.4 — Incident response",
                  evidencedBy: ["attack-path-analysis", "fix-verification"],
                  evidenceIds: [],
                  lastValidatedAt: null,
                  missing: ["attack-path-analysis", "fix-verification"],
                  satisfiedBy: [],
                  status: "Unmet",
                  title:
                    "Respond to identified security incidents and restore control"
                }
              ]
            }),
            ok: true,
            status: 200
          };
        }
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

    render(<ReportsWorkbench />);

    const panel = await screen.findByTestId("soc2-coverage-panel");
    expect(panel).toHaveTextContent(/SOC 2 CC7\.1/);
    expect(panel).toHaveTextContent(/SOC 2 CC7\.2/);
    expect(panel).toHaveTextContent(/SOC 2 CC7\.4/);
    expect(panel).toHaveTextContent("Partial");
    expect(panel).toHaveTextContent("Met");
    expect(panel).toHaveTextContent("Unmet");
    expect(panel).toHaveTextContent(/not a certification/i);
    expect(panel.textContent?.toLowerCase()).not.toMatch(/certified/);
  });

  it("offers Customer SOC 2 support pack (SOC2Support) with a visible not-certification disclaimer", async () => {
    stubReportsApis();
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    const option = screen.getByRole("option", {
      name: "Customer SOC 2 support pack"
    });
    expect(option).toHaveValue("SOC2Support");
    expect(
      screen.getByTestId("report-preset-soc-2-support")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Pack type"), {
      target: { value: "SOC2Support" }
    });

    const disclaimer = screen.getByTestId("soc2-support-disclaimer");
    expect(disclaimer).toHaveTextContent(/not a certification/i);
    expect(disclaimer).toHaveTextContent(/not an audit opinion/i);
    expect(disclaimer).toHaveTextContent(/not a vendor SOC 2 Type II/i);
    expect(
      screen.getByRole("button", { name: /Export SOC 2 support pack/i })
    ).toBeInTheDocument();
  });

  it("does not export a sample SOC 2 pack when snapshots are empty", async () => {
    const fetchMock = stubReportsApis({ snapshots: [] });
    render(<ReportsWorkbench />);

    expect(await screen.findByText("Proof composer")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pack type"), {
      target: { value: "SOC2Support" }
    });

    const exportButton = await screen.findByRole("button", {
      name: /Export SOC 2 support pack/i
    });
    expect(exportButton).toBeDisabled();
    expect(screen.getByTestId("soc2-export-disabled-reason")).toHaveTextContent(
      /no validation snapshot/i
    );
    expect(screen.getByTestId("soc2-export-disabled-reason")).toHaveTextContent(
      /never invent sample/i
    );
    fireEvent.click(exportButton);
    expect(postCalls(fetchMock)).toHaveLength(0);
  });

  it("exports Customer SOC 2 support pack from a real snapshot via create+export APIs", async () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const fetchMock = stubReportsApis({
      snapshots: [snapshot],
      onCreateReport: (body) => ({
        audience: body.audience ?? "Auditor",
        createdAt: timestamp,
        evidenceIds: snapshot.evidenceIds,
        evidencePackId: soc2PackId,
        packType: "SOC2Support",
        redactionLevel: "Moderate",
        status: "Ready",
        storageUri: "file:///tmp/soc2-support.html",
        tenantId: snapshot.tenantId,
        title: "Customer SOC 2 support evidence",
        updatedAt: timestamp
      }),
      onExportReport: () =>
        htmlDownloadResponse(
          "<html><body>Customer SOC 2 support evidence — not a certification and not an audit opinion.</body></html>",
          "soc2-support.html"
        )
    });
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:soc2-support");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<ReportsWorkbench />);
    expect(
      await screen.findByText(snapshot.evidencePack.title)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Pack type"), {
      target: { value: "SOC2Support" }
    });
    const exportButton = await screen.findByRole("button", {
      name: /Export SOC 2 support pack/i
    });
    await waitFor(() => {
      expect(exportButton).toBeEnabled();
    });
    fireEvent.click(exportButton);

    const success = await screen.findByRole("status");
    expect(success).toHaveTextContent(/Customer SOC 2 support/i);
    expect(success).toHaveTextContent(/not a certification/i);
    expect(createObjectURL).toHaveBeenCalled();

    const createCall = postCalls(fetchMock).find((call) =>
      String(call[0]).endsWith("/api/v1/reports")
    );
    expect(createCall).toBeTruthy();
    const createBody = JSON.parse(
      String((createCall?.[1] as RequestInit).body)
    );
    expect(createBody.packType).toBe("SOC2Support");
    expect(createBody.snapshotId).toBe(snapshot.snapshotId);

    const exportCall = postCalls(fetchMock).find((call) =>
      String(call[0]).endsWith(`/api/v1/reports/${soc2PackId}/export`)
    );
    expect(exportCall).toBeTruthy();
    const exportBody = JSON.parse(
      String((exportCall?.[1] as RequestInit).body)
    );
    expect(exportBody.format).toBe("html");

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });

  it("surfaces snapshot export errors without inventing a sample SOC 2 report", async () => {
    const snapshot = createPublicDemoValidationSnapshot();
    stubReportsApis({
      snapshots: [snapshot],
      onCreateReport: (body) => ({
        audience: body.audience ?? "Auditor",
        createdAt: timestamp,
        evidenceIds: snapshot.evidenceIds,
        evidencePackId: soc2PackId,
        packType: "SOC2Support",
        redactionLevel: "Moderate",
        status: "Ready",
        storageUri: "file:///tmp/soc2-support.html",
        tenantId: snapshot.tenantId,
        title: "Customer SOC 2 support evidence",
        updatedAt: timestamp
      }),
      onExportReport: () =>
        jsonResponse(
          { error: "Snapshot report not found." },
          { ok: false, status: 404 }
        )
    });

    render(<ReportsWorkbench />);
    expect(
      await screen.findByText(snapshot.evidencePack.title)
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pack type"), {
      target: { value: "SOC2Support" }
    });
    fireEvent.click(
      await screen.findByRole("button", { name: /Export SOC 2 support pack/i })
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Snapshot report not found/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByTitle("Snapshot report preview")
    ).not.toBeInTheDocument();
  });
});
