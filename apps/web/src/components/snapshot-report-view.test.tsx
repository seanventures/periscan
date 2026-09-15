import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SnapshotReportView } from "./snapshot-report-view";

function createJsonResponse(
  payload: unknown,
  init?: { ok?: boolean; status?: number }
) {
  return {
    json: async () => payload,
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => String(payload)
  };
}

function createDownloadResponse(
  content: string,
  filename = "periscan-snapshot.html",
  contentType = "text/html; charset=utf-8"
) {
  return {
    headers: new Headers({
      "content-disposition": `attachment; filename="${filename}"`,
      "content-type": contentType
    }),
    json: async () => content,
    ok: true,
    status: 200,
    text: async () => content
  };
}

describe("SnapshotReportView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads the report preview and saves analyst notes through the API", async () => {
    const snapshotId = "17171717-1717-4717-8717-171717171717";
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === `/api/v1/snapshots/${snapshotId}/report`) {
        const body = "<html><body><h1>Initial report</h1></body></html>";

        return {
          ok: true,
          status: 200,
          text: async () => body,
          json: async () => body
        };
      }

      if (input === "/api/v1/tenants/current/design-partner") {
        return createJsonResponse({
          analystEvidence: {
            modeEnabled: true,
            measuredAt: "2026-06-01T00:00:00.000Z",
            checklist: {
              onboardingComplete: 0,
              onboardingTotal: 1,
              integrationComplete: 0,
              integrationTotal: 1
            },
            proofLoop: {
              maturity: "New",
              completedMilestones: 1,
              totalMilestones: 9,
              measuredResultAt: null,
              revalidatedAt: null,
              proofDeliveredAt: null
            },
            counts: {
              verifiedScopes: 0,
              connectedIntegrations: 0,
              completedRunsWithEvidence: 0,
              verificationEvents: 0,
              exportedOrSharedPacks: 0
            },
            honesty: {
              marketPresenceEligible: false,
              publicReferenceCount: 0,
              waveMarketPresenceGate: "Fail",
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              referencePackStatus: "Empty",
              banner: "Zero customer references — Wave market presence not met",
              sessionLearningEvidenceInProduct: "ChecklistOnly",
              disclaimer:
                "Tenant checklist and proof-loop counts are not customer references."
            }
          },
          sessionLearning: {
            message:
              "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
            sessionCount: 0,
            sessions: [],
            sessionsGateMet: false,
            sessionsRequired: 5,
            sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
            waveMarketPresenceReady: false
          },
          integrationChecklist: [],
          latestAnalystNote: null,
          onboardingChecklist: [],
          settings: {
            createdAt: "2026-06-01T00:00:00.000Z",
            enabled: true,
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z"
          },
          snapshotRequest: {
            latestReportId: snapshotId,
            latestSnapshotId: snapshotId,
            previewPath: `/snapshots/${snapshotId}`,
            requestedAt: "2026-06-01T00:00:00.000Z",
            status: "Ready"
          },
          tenantId: "11111111-1111-4111-8111-111111111111"
        });
      }

      if (input === `/api/v1/reports/${snapshotId}/analyst-note`) {
        if (init?.method === "PUT") {
          return createJsonResponse({
            authorLabel: "Periscan Analyst",
            body: "Founder context for the customer review.",
            createdAt: "2026-06-01T00:00:00.000Z",
            reportId: snapshotId,
            tenantId: "11111111-1111-4111-8111-111111111111",
            title: "Founder note",
            updatedAt: "2026-06-01T00:00:00.000Z"
          });
        }

        return createJsonResponse(null);
      }

      throw new Error(`Unexpected request: ${input}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<SnapshotReportView snapshotId={snapshotId} />);

    const reportPage = document.querySelector(".report-page");
    expect(reportPage).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText("Loading validation snapshot report.")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Periscan Analyst Note")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", {
        name: "Back to workspace"
      })
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", {
        name: "Validation Ops"
      })
    ).toHaveAttribute("href", "/validation-ops");
    expect(
      screen.getByRole("link", {
        name: "Trust & Safety"
      })
    ).toHaveAttribute("href", "/trust-safety");
    expect(
      screen.getByRole("link", {
        name: "API reference"
      })
    ).toHaveAttribute("href", "/api-reference");
    expect(
      screen.getByRole("status", {
        name: "Report delivery status: API-backed report"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Analyst note report status: Report preview"
      })
    ).toBeInTheDocument();
    expect(document.querySelector(".report-page")).toHaveAttribute(
      "aria-busy",
      "false"
    );
    expect(
      screen.getByRole("region", {
        name: "Validation Snapshot report preview"
      })
    ).toHaveTextContent("Initial report");

    fireEvent.change(screen.getByLabelText("Note title"), {
      target: {
        value: "Founder note"
      }
    });
    fireEvent.change(screen.getByLabelText("Analyst note"), {
      target: {
        value: "Founder context for the customer review."
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save analyst note" }));

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        `/api/v1/reports/${snapshotId}/analyst-note`,
        expect.objectContaining({
          body: JSON.stringify({
            authorLabel: "Periscan Analyst",
            body: "Founder context for the customer review.",
            title: "Founder note"
          }),
          method: "PUT"
        })
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Analyst note saved and report preview refreshed.")
      ).toBeInTheDocument();
    });
  });

  it("keeps the loaded report visible when analyst note save fails", async () => {
    const snapshotId = "17171717-1717-4717-8717-171717171717";
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === `/api/v1/snapshots/${snapshotId}/report`) {
        const body = "<html><body><h1>Initial report</h1></body></html>";

        return {
          ok: true,
          status: 200,
          text: async () => body,
          json: async () => body
        };
      }

      if (input === "/api/v1/tenants/current/design-partner") {
        return createJsonResponse({
          analystEvidence: {
            modeEnabled: true,
            measuredAt: "2026-06-01T00:00:00.000Z",
            checklist: {
              onboardingComplete: 0,
              onboardingTotal: 1,
              integrationComplete: 0,
              integrationTotal: 1
            },
            proofLoop: {
              maturity: "New",
              completedMilestones: 1,
              totalMilestones: 9,
              measuredResultAt: null,
              revalidatedAt: null,
              proofDeliveredAt: null
            },
            counts: {
              verifiedScopes: 0,
              connectedIntegrations: 0,
              completedRunsWithEvidence: 0,
              verificationEvents: 0,
              exportedOrSharedPacks: 0
            },
            honesty: {
              marketPresenceEligible: false,
              publicReferenceCount: 0,
              waveMarketPresenceGate: "Fail",
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              referencePackStatus: "Empty",
              banner: "Zero customer references — Wave market presence not met",
              sessionLearningEvidenceInProduct: "ChecklistOnly",
              disclaimer:
                "Tenant checklist and proof-loop counts are not customer references."
            }
          },
          sessionLearning: {
            message:
              "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
            sessionCount: 0,
            sessions: [],
            sessionsGateMet: false,
            sessionsRequired: 5,
            sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
            waveMarketPresenceReady: false
          },
          integrationChecklist: [],
          latestAnalystNote: null,
          onboardingChecklist: [],
          settings: {
            createdAt: "2026-06-01T00:00:00.000Z",
            enabled: true,
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z"
          },
          snapshotRequest: {
            latestReportId: snapshotId,
            latestSnapshotId: snapshotId,
            previewPath: `/snapshots/${snapshotId}`,
            requestedAt: "2026-06-01T00:00:00.000Z",
            status: "Ready"
          },
          tenantId: "11111111-1111-4111-8111-111111111111"
        });
      }

      if (input === `/api/v1/reports/${snapshotId}/analyst-note`) {
        if (init?.method === "PUT") {
          return createJsonResponse(
            {
              error: "Analyst note save failed."
            },
            {
              ok: false,
              status: 503
            }
          );
        }

        return createJsonResponse(null);
      }

      throw new Error(`Unexpected request: ${input}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<SnapshotReportView snapshotId={snapshotId} />);

    await waitFor(() => {
      expect(screen.getByText("Initial report")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Analyst note"), {
      target: {
        value: "Founder context for the customer review."
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save analyst note" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Analyst note save failed."
      );
    });

    expect(screen.getByText("Initial report")).toBeInTheDocument();
    expect(
      screen.queryByText("Snapshot report unavailable.")
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss analyst note error"
      })
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a retryable error state when the report API fails", async () => {
    const snapshotId = "17171717-1717-4717-8717-171717171717";
    let reportAttempts = 0;
    const fetchImpl = vi.fn(async (input: string) => {
      if (input === `/api/v1/snapshots/${snapshotId}/report`) {
        reportAttempts += 1;

        if (reportAttempts === 1) {
          return createJsonResponse(
            {
              error: "Snapshot report was not found."
            },
            {
              ok: false,
              status: 404
            }
          );
        }

        return {
          json: async () =>
            "<html><body><h1>Recovered report</h1></body></html>",
          ok: true,
          status: 200,
          text: async () =>
            "<html><body><h1>Recovered report</h1></body></html>"
        };
      }

      if (input === "/api/v1/tenants/current/design-partner") {
        return createJsonResponse({
          analystEvidence: {
            modeEnabled: true,
            measuredAt: "2026-06-01T00:00:00.000Z",
            checklist: {
              onboardingComplete: 0,
              onboardingTotal: 1,
              integrationComplete: 0,
              integrationTotal: 1
            },
            proofLoop: {
              maturity: "New",
              completedMilestones: 1,
              totalMilestones: 9,
              measuredResultAt: null,
              revalidatedAt: null,
              proofDeliveredAt: null
            },
            counts: {
              verifiedScopes: 0,
              connectedIntegrations: 0,
              completedRunsWithEvidence: 0,
              verificationEvents: 0,
              exportedOrSharedPacks: 0
            },
            honesty: {
              marketPresenceEligible: false,
              publicReferenceCount: 0,
              waveMarketPresenceGate: "Fail",
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              referencePackStatus: "Empty",
              banner: "Zero customer references — Wave market presence not met",
              sessionLearningEvidenceInProduct: "ChecklistOnly",
              disclaimer:
                "Tenant checklist and proof-loop counts are not customer references."
            }
          },
          sessionLearning: {
            message:
              "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
            sessionCount: 0,
            sessions: [],
            sessionsGateMet: false,
            sessionsRequired: 5,
            sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
            waveMarketPresenceReady: false
          },
          integrationChecklist: [],
          latestAnalystNote: null,
          onboardingChecklist: [],
          settings: {
            createdAt: "2026-06-01T00:00:00.000Z",
            enabled: false,
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z"
          },
          snapshotRequest: {
            latestReportId: snapshotId,
            latestSnapshotId: snapshotId,
            previewPath: `/snapshots/${snapshotId}`,
            requestedAt: "2026-06-01T00:00:00.000Z",
            status: "Ready"
          },
          tenantId: "11111111-1111-4111-8111-111111111111"
        });
      }

      if (input === `/api/v1/reports/${snapshotId}/analyst-note`) {
        return createJsonResponse(null);
      }

      throw new Error(`Unexpected request: ${input}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);
    render(<SnapshotReportView snapshotId={snapshotId} />);

    await waitFor(() => {
      expect(
        screen.getAllByText("Snapshot report was not found.")
      ).toHaveLength(2);
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Retry report load" })[0]!
    );

    await waitFor(() => {
      expect(screen.getByText("Recovered report")).toBeInTheDocument();
    });
    expect(reportAttempts).toBe(2);
  });

  it("shows an actionable empty state when the report API returns no HTML", async () => {
    const snapshotId = "17171717-1717-4717-8717-171717171717";
    let reportAttempts = 0;
    const fetchImpl = vi.fn(async (input: string) => {
      if (input === `/api/v1/snapshots/${snapshotId}/report`) {
        reportAttempts += 1;

        return {
          json: async () => "",
          ok: true,
          status: 200,
          text: async () => ""
        };
      }

      if (input === "/api/v1/tenants/current/design-partner") {
        return createJsonResponse({
          analystEvidence: {
            modeEnabled: true,
            measuredAt: "2026-06-01T00:00:00.000Z",
            checklist: {
              onboardingComplete: 0,
              onboardingTotal: 1,
              integrationComplete: 0,
              integrationTotal: 1
            },
            proofLoop: {
              maturity: "New",
              completedMilestones: 1,
              totalMilestones: 9,
              measuredResultAt: null,
              revalidatedAt: null,
              proofDeliveredAt: null
            },
            counts: {
              verifiedScopes: 0,
              connectedIntegrations: 0,
              completedRunsWithEvidence: 0,
              verificationEvents: 0,
              exportedOrSharedPacks: 0
            },
            honesty: {
              marketPresenceEligible: false,
              publicReferenceCount: 0,
              waveMarketPresenceGate: "Fail",
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              referencePackStatus: "Empty",
              banner: "Zero customer references — Wave market presence not met",
              sessionLearningEvidenceInProduct: "ChecklistOnly",
              disclaimer:
                "Tenant checklist and proof-loop counts are not customer references."
            }
          },
          sessionLearning: {
            message:
              "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
            sessionCount: 0,
            sessions: [],
            sessionsGateMet: false,
            sessionsRequired: 5,
            sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
            waveMarketPresenceReady: false
          },
          integrationChecklist: [],
          latestAnalystNote: null,
          onboardingChecklist: [],
          settings: {
            createdAt: "2026-06-01T00:00:00.000Z",
            enabled: false,
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z"
          },
          snapshotRequest: {
            latestReportId: snapshotId,
            latestSnapshotId: snapshotId,
            previewPath: `/snapshots/${snapshotId}`,
            requestedAt: "2026-06-01T00:00:00.000Z",
            status: "Ready"
          },
          tenantId: "11111111-1111-4111-8111-111111111111"
        });
      }

      if (input === `/api/v1/reports/${snapshotId}/analyst-note`) {
        return createJsonResponse(null);
      }

      throw new Error(`Unexpected request: ${input}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<SnapshotReportView snapshotId={snapshotId} />);

    await waitFor(() => {
      expect(
        screen.getByText("No report content available.")
      ).toBeInTheDocument();
    });

    expect(document.querySelector(".report-page")).toHaveAttribute(
      "aria-busy",
      "false"
    );
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Retry report load"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Return to workspace"
      })
    ).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("region", {
        name: "Validation Snapshot report preview"
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retry report load"
      })
    );

    await waitFor(() => {
      expect(reportAttempts).toBe(2);
    });
  });

  it("exports and creates report share links through the report API", async () => {
    const snapshotId = "17171717-1717-4717-8717-171717171717";
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:periscan-snapshot")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    );
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === `/api/v1/snapshots/${snapshotId}/report`) {
        const body = "<html><body><h1>Initial report</h1></body></html>";

        return {
          json: async () => body,
          ok: true,
          status: 200,
          text: async () => body
        };
      }

      if (input === "/api/v1/tenants/current/design-partner") {
        return createJsonResponse({
          analystEvidence: {
            modeEnabled: true,
            measuredAt: "2026-06-01T00:00:00.000Z",
            checklist: {
              onboardingComplete: 0,
              onboardingTotal: 1,
              integrationComplete: 0,
              integrationTotal: 1
            },
            proofLoop: {
              maturity: "New",
              completedMilestones: 1,
              totalMilestones: 9,
              measuredResultAt: null,
              revalidatedAt: null,
              proofDeliveredAt: null
            },
            counts: {
              verifiedScopes: 0,
              connectedIntegrations: 0,
              completedRunsWithEvidence: 0,
              verificationEvents: 0,
              exportedOrSharedPacks: 0
            },
            honesty: {
              marketPresenceEligible: false,
              publicReferenceCount: 0,
              waveMarketPresenceGate: "Fail",
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              referencePackStatus: "Empty",
              banner: "Zero customer references — Wave market presence not met",
              sessionLearningEvidenceInProduct: "ChecklistOnly",
              disclaimer:
                "Tenant checklist and proof-loop counts are not customer references."
            }
          },
          sessionLearning: {
            message:
              "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
            sessionCount: 0,
            sessions: [],
            sessionsGateMet: false,
            sessionsRequired: 5,
            sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
            waveMarketPresenceReady: false
          },
          integrationChecklist: [],
          latestAnalystNote: null,
          onboardingChecklist: [],
          settings: {
            createdAt: "2026-06-01T00:00:00.000Z",
            enabled: false,
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z"
          },
          snapshotRequest: {
            latestReportId: snapshotId,
            latestSnapshotId: snapshotId,
            previewPath: `/snapshots/${snapshotId}`,
            requestedAt: "2026-06-01T00:00:00.000Z",
            status: "Ready"
          },
          tenantId: "11111111-1111-4111-8111-111111111111"
        });
      }

      if (input === `/api/v1/reports/${snapshotId}/analyst-note`) {
        return createJsonResponse(null);
      }

      if (
        input === `/api/v1/reports/${snapshotId}/export` &&
        init?.method === "POST"
      ) {
        return createDownloadResponse("<html>export</html>");
      }

      if (
        input === `/api/v1/reports/${snapshotId}/share-link` &&
        init?.method === "POST"
      ) {
        return createJsonResponse(
          {
            accessCount: 0,
            createdAt: "2026-06-01T00:00:00.000Z",
            expiresAt: "2026-06-08T00:00:00.000Z",
            lastAccessedAt: null,
            reportId: snapshotId,
            reportShareId: "22222222-2222-4222-8222-222222222222",
            revokedAt: null,
            tenantId: "11111111-1111-4111-8111-111111111111",
            token: "share-token",
            url: "/api/v1/public/reports/share/share-token"
          },
          {
            status: 201
          }
        );
      }

      throw new Error(`Unexpected request: ${input}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<SnapshotReportView snapshotId={snapshotId} />);

    await waitFor(() => {
      expect(
        screen.getByText("Export or share this evidence pack")
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Export report HTML"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Exported periscan-snapshot.html.")
      ).toBeInTheDocument();
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/reports/${snapshotId}/export`,
      expect.objectContaining({
        body: JSON.stringify({
          format: "html"
        }),
        method: "POST"
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create share link"
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Created a 7-day report share link.")
      ).toBeInTheDocument();
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/reports/${snapshotId}/share-link`,
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(
      screen.getByText(
        "http://localhost:3000/api/v1/public/reports/share/share-token"
      )
    ).toBeInTheDocument();
  });

  it("keeps the report visible when report delivery fails", async () => {
    const snapshotId = "17171717-1717-4717-8717-171717171717";
    let exportRequestCount = 0;
    let reportRequestCount = 0;

    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === `/api/v1/snapshots/${snapshotId}/report`) {
        reportRequestCount += 1;
        const body =
          reportRequestCount === 1
            ? "<html><body><h1>Initial report</h1></body></html>"
            : "<html><body><h1>Reloaded report</h1></body></html>";

        return {
          json: async () => body,
          ok: true,
          status: 200,
          text: async () => body
        };
      }

      if (input === "/api/v1/tenants/current/design-partner") {
        return createJsonResponse({
          analystEvidence: {
            modeEnabled: true,
            measuredAt: "2026-06-01T00:00:00.000Z",
            checklist: {
              onboardingComplete: 0,
              onboardingTotal: 1,
              integrationComplete: 0,
              integrationTotal: 1
            },
            proofLoop: {
              maturity: "New",
              completedMilestones: 1,
              totalMilestones: 9,
              measuredResultAt: null,
              revalidatedAt: null,
              proofDeliveredAt: null
            },
            counts: {
              verifiedScopes: 0,
              connectedIntegrations: 0,
              completedRunsWithEvidence: 0,
              verificationEvents: 0,
              exportedOrSharedPacks: 0
            },
            honesty: {
              marketPresenceEligible: false,
              publicReferenceCount: 0,
              waveMarketPresenceGate: "Fail",
              mqMarketPresenceGate: "Fail",
              peerDiligenceGate: "Fail",
              referencePackStatus: "Empty",
              banner: "Zero customer references — Wave market presence not met",
              sessionLearningEvidenceInProduct: "ChecklistOnly",
              disclaimer:
                "Tenant checklist and proof-loop counts are not customer references."
            }
          },
          sessionLearning: {
            message:
              "Need 5 sessions before Wave. Internal notes only; public references remain zero until written consent outside this product.",
            sessionCount: 0,
            sessions: [],
            sessionsGateMet: false,
            sessionsRequired: 5,
            sourceDoc: "docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md",
            waveMarketPresenceReady: false
          },
          integrationChecklist: [],
          latestAnalystNote: null,
          onboardingChecklist: [],
          settings: {
            createdAt: "2026-06-01T00:00:00.000Z",
            enabled: false,
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z"
          },
          snapshotRequest: {
            latestReportId: snapshotId,
            latestSnapshotId: snapshotId,
            previewPath: `/snapshots/${snapshotId}`,
            requestedAt: "2026-06-01T00:00:00.000Z",
            status: "Ready"
          },
          tenantId: "11111111-1111-4111-8111-111111111111"
        });
      }

      if (input === `/api/v1/reports/${snapshotId}/analyst-note`) {
        return createJsonResponse(null);
      }

      if (
        input === `/api/v1/reports/${snapshotId}/export` &&
        init?.method === "POST"
      ) {
        exportRequestCount += 1;

        return createJsonResponse(
          {
            error: "Report export failed."
          },
          {
            ok: false,
            status: 503
          }
        );
      }

      throw new Error(`Unexpected request: ${input}`);
    });

    vi.stubGlobal("fetch", fetchImpl as unknown as typeof fetch);

    render(<SnapshotReportView snapshotId={snapshotId} />);

    await waitFor(() => {
      expect(screen.getByText("Initial report")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Export report HTML"
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Report export failed."
      );
    });

    expect(screen.getByText("Initial report")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reload report preview"
      })
    );

    await waitFor(() => {
      expect(screen.getByText("Reloaded report")).toBeInTheDocument();
    });

    expect(exportRequestCount).toBe(1);
    expect(reportRequestCount).toBe(2);
    expect(
      screen.getByText("Report preview reloaded from the API.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
