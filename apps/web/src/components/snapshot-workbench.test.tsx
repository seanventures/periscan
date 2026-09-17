import { randomUUID } from "node:crypto";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DesignPartnerWorkspace,
  ValidationSnapshot
} from "@periscan/shared";

import { SnapshotWorkbench } from "./snapshot-workbench";

function createJsonResponse(
  payload: unknown,
  init?: { ok?: boolean; status?: number }
) {
  return {
    json: async () => payload,
    ok: init?.ok ?? true,
    status: init?.status ?? 200
  };
}

function createAuthPayload() {
  return {
    membership: {
      createdAt: "2026-06-01T00:00:00.000Z",
      membershipId: "12121212-1212-4212-8212-121212121212",
      role: "Owner",
      tenantId: "11111111-1111-4111-8111-111111111111",
      updatedAt: "2026-06-01T00:00:00.000Z",
      userId: "22222222-2222-4222-8222-222222222222"
    },
    tenant: {
      billingAccountId: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      dataRegion: "us-east-1",
      name: "Demo Tenant",
      parentTenantId: null,
      tenantId: "11111111-1111-4111-8111-111111111111",
      type: "Organization",
      updatedAt: "2026-06-01T00:00:00.000Z"
    },
    user: {
      createdAt: "2026-06-01T00:00:00.000Z",
      email: "demo@periscan.local",
      name: "Demo User",
      status: "Active",
      updatedAt: "2026-06-01T00:00:00.000Z",
      userId: "22222222-2222-4222-8222-222222222222"
    }
  };
}

function createSnapshotFixture(): ValidationSnapshot {
  const timestamp = "2026-06-01T00:00:00.000Z";
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const evidenceId = randomUUID();

  return {
    aiAppRisks: [],
    controlObservations: [],
    createdAt: timestamp,
    evidenceIds: [evidenceId],
    evidencePack: {
      audience: "Security Team",
      createdAt: timestamp,
      evidenceIds: [evidenceId],
      evidencePackId: randomUUID(),
      packType: "ValidationSnapshotReport",
      redactionLevel: "Moderate",
      status: "Ready",
      storageUri: "file:///tmp/report.html",
      tenantId,
      title: "Validation Snapshot",
      updatedAt: timestamp
    },
    integrationIds: [randomUUID(), randomUUID()],
    metrics: {
      aiRiskCount: 0,
      controlObservationCount: 0,
      correlatedThreatAdvisoryCount: 1,
      highRiskPathCount: 1,
      integrationCount: 2,
      openThreatAdvisoryCount: 3,
      remediationCount: 1,
      staleVerificationCount: 2,
      topPathCount: 1,
      verifiedScopeCount: 1
    },
    missionId: randomUUID(),
    remediationPriorities: [
      {
        createdAt: timestamp,
        dueAt: null,
        evidenceIds: [evidenceId],
        latestVerification: {
          measuredRevalidation: true,
          outcome: "Fixed",
          retestMethod: "Rerun the GitHub and AWS checks.",
          verifiedAt: timestamp
        },
        owner: "Security engineering",
        recommendedAction: "Rotate the exposed secret",
        relatedExposureId: randomUUID(),
        relatedPathEvidenceBasis: "Measured",
        relatedPathId: "44444444-4444-4444-8444-444444444444",
        remediationId: randomUUID(),
        status: "Open",
        technicalSteps: ["Rotate the secret", "Rerun validation"],
        tenantId,
        ticketId: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod: "Rerun the GitHub and AWS checks.",
        verificationRequired: true
      }
    ],
    scopeIds: ["33333333-3333-4333-8333-333333333333"],
    snapshotId: randomUUID(),
    summary: {
      headline: "Validated repository-to-cloud path",
      overview:
        "The latest snapshot includes evidence-linked path and remediation data.",
      topRiskBand: "Critical"
    },
    tenantId,
    topAttackPaths: [
      {
        attackPath: {
          confidence: 0.91,
          createdAt: timestamp,
          entryNodeId: randomUUID(),
          evidenceBasis: "Heuristic",
          evidenceIds: [evidenceId],
          impactNodeId: randomUUID(),
          impactScore: 88,
          name: "Repository secret to production role",
          pathBreakers: [
            {
              createdAt: timestamp,
              description: "Rotate the secret.",
              evidenceIds: [evidenceId],
              pathBreakerId: randomUUID(),
              pathId: "44444444-4444-4444-8444-444444444444",
              priority: 1,
              relatedNodeId: null,
              tenantId,
              title: "Rotate secret",
              updatedAt: timestamp
            }
          ],
          pathEdges: [],
          pathId: "44444444-4444-4444-8444-444444444444",
          pathNodes: [],
          tenantId,
          updatedAt: timestamp,
          validationState: "Validated"
        },
        risk: {
          band: "Critical",
          factors: [],
          score: 91,
          summary: "Evidence-linked production path."
        }
      }
    ],
    updatedAt: timestamp,
    verificationPlan: [
      "Rerun GitHub and AWS validations after secret rotation."
    ]
  };
}

function createDesignPartnerWorkspaceFixture(): DesignPartnerWorkspace {
  const timestamp = "2026-06-01T00:00:00.000Z";
  const tenantId = "11111111-1111-4111-8111-111111111111";

  return {
    analystEvidence: {
      modeEnabled: true,
      measuredAt: timestamp,
      checklist: {
        onboardingComplete: 1,
        onboardingTotal: 1,
        integrationComplete: 1,
        integrationTotal: 1
      },
      proofLoop: {
        maturity: "Activating",
        completedMilestones: 3,
        totalMilestones: 9,
        measuredResultAt: null,
        revalidatedAt: null,
        proofDeliveredAt: null
      },
      counts: {
        verifiedScopes: 1,
        connectedIntegrations: 1,
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
          "Tenant checklist and proof-loop counts are not customer references, Wave/MQ market presence, or five-session research scorecards. Public references require written consent outside this product."
      }
    },
    integrationChecklist: [
      {
        description:
          "Connect GitHub so repository evidence can seed attack paths.",
        itemId: "github-connected",
        label: "GitHub connected",
        status: "Complete"
      }
    ],
    latestAnalystNote: null,
    onboardingChecklist: [
      {
        description:
          "Verify at least one customer-authorized scope before validation.",
        itemId: "verified-scope",
        label: "Verified scope",
        status: "Complete"
      }
    ],
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
    settings: {
      createdAt: timestamp,
      enabled: true,
      tenantId,
      updatedAt: timestamp
    },
    snapshotRequest: {
      latestReportId: null,
      latestSnapshotId: null,
      previewPath: null,
      requestedAt: null,
      status: "NotRequested"
    },
    tenantId
  };
}

describe("SnapshotWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading state while the API session check is pending", async () => {
    let resolveSession!: (
      response: ReturnType<typeof createJsonResponse>
    ) => void;
    const sessionPromise = new Promise<ReturnType<typeof createJsonResponse>>(
      (resolve) => {
        resolveSession = resolve;
      }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return sessionPromise;
        }

        return Promise.resolve(
          createJsonResponse({
            items: []
          })
        );
      }) as unknown as typeof fetch
    );

    render(<SnapshotWorkbench />);

    expect(screen.getByText("Loading workspace...")).toBeInTheDocument();

    resolveSession(
      createJsonResponse(
        {
          error: "Authentication required."
        },
        {
          ok: false,
          status: 401
        }
      )
    );

    await waitFor(() => {
      expect(
        screen.getByText("Authenticate into the API-backed workspace")
      ).toBeInTheDocument();
    });
  });

  it("shows the auth panel when no session exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse(
          {
            error: "Authentication required."
          },
          {
            ok: false,
            status: 401
          }
        )
      )
    );

    render(<SnapshotWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByText("Authenticate into the API-backed workspace")
      ).toBeInTheDocument();
    });
  });

  it("renders explicit accessible auth labels and tab state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createJsonResponse(
          {
            error: "Authentication required."
          },
          {
            ok: false,
            status: 401
          }
        )
      )
    );

    render(<SnapshotWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("form", {
          name: "Workspace authentication"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Name").closest("label")).toHaveAttribute(
      "for",
      "workspace-auth-name"
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute(
      "id",
      "workspace-auth-name"
    );
    expect(screen.getByLabelText("Tenant")).toHaveAttribute(
      "id",
      "workspace-auth-tenant"
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "id",
      "workspace-auth-email"
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "id",
      "workspace-auth-password"
    );
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Tenant")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByPlaceholderText("you@company.com")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Company or team name")
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Create tenant" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(screen.getByRole("tab", { name: "Sign in" }));

    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByLabelText("Tenant")).not.toBeInTheDocument();
  });

  it("shows dashboard actions after the API session loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/me") {
          return createJsonResponse(createAuthPayload());
        }

        if (input === "/api/v1/tenants/current/design-partner") {
          return createJsonResponse(createDesignPartnerWorkspaceFixture());
        }

        return createJsonResponse({
          items: []
        });
      }) as unknown as typeof fetch
    );

    render(<SnapshotWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Run Validation Snapshot")).toBeInTheDocument();
    });

    const flow = screen.getByLabelText("Validation Snapshot flow");
    for (const step of [
      "1. Define scope",
      "2. Connect systems",
      "3. Run validation",
      "4. Review report",
      "5. Create remediation",
      "6. Verify fix",
      "7. Export evidence"
    ]) {
      expect(flow).toHaveTextContent(step);
    }
    expect(screen.getByText("Design Partner Mode")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Disable design partner mode" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open Integration Marketplace" })
    ).toHaveAttribute("href", "/integrations");
    expect(
      screen.getByRole("link", { name: "Review Trust & Safety" })
    ).toHaveAttribute("href", "/trust-safety");
    expect(screen.getByLabelText("Domain scope")).toHaveAttribute(
      "id",
      "workspace-domain-scope"
    );
    expect(
      screen.getByRole("status", {
        name: "Scope verification status: Required"
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("status", {
        name: "Connected integration count: 0"
      })
    ).toHaveLength(2);
    expect(
      screen.getByRole("status", {
        name: "Fixture connector shortcut status: disabled"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Configure live GitHub, AWS, and workflow integrations/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Validation Snapshot status: Awaiting run"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Design partner mode dashboard status: On"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Design partner mode status: Enabled"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Design-partner session learning count: 0 of 5"
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Need 5 sessions before Wave/i).length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/No session notes yet/i)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("session-learning-empty-state")
    ).toHaveTextContent(/Next action/i);
    expect(
      screen.getByTestId("session-learning-empty-state")
    ).toHaveTextContent("docs/DESIGN_PARTNER/REFERENCE_FACTORY.md");
    expect(
      screen.getByTestId("design-partner-session-note-form")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Save internal note/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Onboarding checklist complete count: 1 of 1"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Onboarding checklist Verified scope status: Complete"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Integration setup checklist complete count: 1 of 1"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Integration setup GitHub connected status: Complete"
      })
    ).toBeInTheDocument();
  });

  it("shows fixture connector shortcuts only when explicitly enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/me") {
          return createJsonResponse(createAuthPayload());
        }

        if (input === "/api/v1/tenants/current/design-partner") {
          return createJsonResponse(createDesignPartnerWorkspaceFixture());
        }

        return createJsonResponse({
          items: []
        });
      }) as unknown as typeof fetch
    );

    render(<SnapshotWorkbench fixtureConnectorShortcutsEnabled />);

    await waitFor(() => {
      expect(screen.getByText("Run Validation Snapshot")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "GitHub fixture connection status: Not connected"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "AWS fixture connection status: Not connected"
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Connect fixture" })
    ).toHaveLength(2);
  });

  it("shows DNS TXT instructions and verifies scopes without dev-mode bypass", async () => {
    const scopeId = "33333333-3333-4333-8333-333333333333";
    let verified = false;
    let verifyInit: RequestInit | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        if (input === "/api/v1/me") {
          return createJsonResponse(createAuthPayload());
        }

        if (input === `/api/v1/scopes/${scopeId}/verify`) {
          verified = true;
          verifyInit = init;

          return createJsonResponse({
            createdAt: "2026-06-01T00:00:00.000Z",
            createdBy: "22222222-2222-4222-8222-222222222222",
            scopeId,
            scopeType: "Domain",
            tenantId: "11111111-1111-4111-8111-111111111111",
            updatedAt: "2026-06-01T00:00:00.000Z",
            value: "demo.example.com",
            verificationMethod: "DNS_TXT",
            verificationStatus: "Verified",
            verificationToken: "periscan-token",
            verifiedAt: "2026-06-01T00:00:00.000Z",
            verifiedBy: "22222222-2222-4222-8222-222222222222"
          });
        }

        if (input === "/api/v1/scopes") {
          return createJsonResponse({
            items: [
              {
                createdAt: "2026-06-01T00:00:00.000Z",
                createdBy: "22222222-2222-4222-8222-222222222222",
                scopeId,
                scopeType: "Domain",
                tenantId: "11111111-1111-4111-8111-111111111111",
                updatedAt: "2026-06-01T00:00:00.000Z",
                value: "demo.example.com",
                verificationMethod: "DNS_TXT",
                verificationStatus: verified ? "Verified" : "Pending",
                verificationToken: "periscan-token",
                verifiedAt: verified ? "2026-06-01T00:00:00.000Z" : null,
                verifiedBy: verified
                  ? "22222222-2222-4222-8222-222222222222"
                  : null
              }
            ]
          });
        }

        if (input === "/api/v1/tenants/current/design-partner") {
          return createJsonResponse(createDesignPartnerWorkspaceFixture());
        }

        return createJsonResponse({
          items: []
        });
      }) as unknown as typeof fetch
    );

    render(<SnapshotWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByText("Publish this DNS TXT record before verifying:")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("_periscan.demo.example.com TXT periscan-token")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await waitFor(() => {
      expect(verified).toBe(true);
    });
    expect(verifyInit).toMatchObject({
      body: "{}",
      method: "POST"
    });
  });

  it("renders the latest snapshot coverage and evidence-linked cards", async () => {
    const snapshot = createSnapshotFixture();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/me") {
          return createJsonResponse(createAuthPayload());
        }

        if (input === "/api/v1/scopes") {
          return createJsonResponse({
            items: [
              {
                createdAt: "2026-06-01T00:00:00.000Z",
                createdBy: "22222222-2222-4222-8222-222222222222",
                scopeId: "33333333-3333-4333-8333-333333333333",
                scopeType: "Domain",
                tenantId: "11111111-1111-4111-8111-111111111111",
                updatedAt: "2026-06-01T00:00:00.000Z",
                value: "demo.example.com",
                verificationMethod: "DNS",
                verificationStatus: "Verified",
                verifiedAt: "2026-06-01T00:00:00.000Z",
                verifiedBy: "22222222-2222-4222-8222-222222222222"
              }
            ]
          });
        }

        if (input === "/api/v1/tenants/current/design-partner") {
          return createJsonResponse({
            ...createDesignPartnerWorkspaceFixture(),
            latestAnalystNote: {
              authorLabel: "Periscan Analyst",
              body: "Preview the latest report before sending it.",
              createdAt: "2026-06-01T00:00:00.000Z",
              reportId: snapshot.snapshotId,
              tenantId: "11111111-1111-4111-8111-111111111111",
              title: "Founder note",
              updatedAt: "2026-06-01T00:00:00.000Z"
            },
            snapshotRequest: {
              latestReportId: snapshot.snapshotId,
              latestSnapshotId: snapshot.snapshotId,
              previewPath: `/snapshots/${snapshot.snapshotId}`,
              requestedAt: "2026-06-01T00:00:00.000Z",
              status: "Ready"
            }
          });
        }

        if (input === "/api/v1/integrations") {
          return createJsonResponse({
            items: []
          });
        }

        if (input === "/api/v1/attack-paths") {
          return createJsonResponse({
            items: []
          });
        }

        if (input === "/api/v1/remediations") {
          return createJsonResponse({
            items: []
          });
        }

        if (input === "/api/v1/snapshots") {
          return createJsonResponse({
            items: [snapshot]
          });
        }

        return createJsonResponse({
          items: []
        });
      }) as unknown as typeof fetch
    );

    render(<SnapshotWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Snapshot coverage")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "No control validation signals are attached to this snapshot yet."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No AI validation signals are attached to this snapshot yet."
      )
    ).toBeInTheDocument();
    // Threat exposure distinguishes open advisories from those that actually
    // correlate to this tenant's evidence (truthful "are we exposed?").
    expect(screen.getByText("Threat exposure")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Open threat advisories tracked · 1 correlate to this tenant's validation evidence."
      )
    ).toBeInTheDocument();
    // Stale verifications surfaces settled fixes whose re-verification is overdue
    // ("is our Fixed still true?") rather than trusting a stale outcome.
    expect(screen.getByText("Stale verifications")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Settled fixes whose re-verification is overdue — confirm a claimed “Fixed” still holds."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Repository secret to production role")
    ).toBeInTheDocument();
    expect(screen.getByText("Rotate the exposed secret")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Last verification for Rotate the exposed secret: Fixed (measured re-validation)"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Periscan analyst note")).toBeInTheDocument();
    expect(screen.getAllByText(/1 evidence link/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("status", {
        name: "Scope verification status: Ready"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Validation Snapshot status: Latest ready"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Design partner snapshot request status: Ready"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Periscan analyst note status: Attached"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Latest snapshot attack path count: 1"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Attack path Repository secret to production role risk band: Critical"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: "Latest snapshot remediation count: 1"
      })
    ).toBeInTheDocument();
  });

  it("verifies a remediation fix and shows previous-vs-current evidence", async () => {
    const snapshot = createSnapshotFixture();
    const remediation = snapshot.remediationPriorities[0]!;
    const previousEvidenceId = remediation.evidenceIds[0]!;
    const newEvidenceId = randomUUID();
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const timestamp = "2026-06-01T00:00:00.000Z";
    const verifyUrl = `/api/v1/remediations/${remediation.remediationId}/verify`;
    const missionId = randomUUID();
    const runId = randomUUID();
    const scopeId = "33333333-3333-4333-8333-333333333333";

    const verifyResponse = {
      attackPath: null,
      mission: {
        completedAt: timestamp,
        createdAt: timestamp,
        evidenceIds: [newEvidenceId],
        missionId,
        missionType: "FixVerification",
        policyDecisionId: null,
        policyProfile: null,
        requestedBy: "22222222-2222-4222-8222-222222222222",
        safetyLevel: "ActiveNonInvasive",
        scopeId,
        scopeIds: [scopeId],
        startedAt: timestamp,
        status: "Completed",
        tenantId,
        updatedAt: timestamp
      },
      remediation: {
        ...remediation,
        status: "Fixed"
      },
      run: {
        completedAt: timestamp,
        createdAt: timestamp,
        errorSummary: null,
        evidenceIds: [newEvidenceId],
        missionId,
        moduleId: "fix.verification",
        outcome: "Fixed",
        policyDecisionId: null,
        runId,
        runnerId: null,
        safetyLevel: "ActiveNonInvasive",
        scopeId,
        startedAt: timestamp,
        status: "Completed",
        target: {},
        tenantId,
        updatedAt: timestamp,
        validationState: "Blocked"
      },
      verificationEvent: {
        createdAt: timestamp,
        evidenceIds: [newEvidenceId],
        newState: "Blocked",
        outcome: "Fixed",
        previousState: "Validated",
        remediationId: remediation.remediationId,
        tenantId,
        updatedAt: timestamp,
        validationRunId: runId,
        verificationId: randomUUID(),
        verifiedAt: timestamp
      }
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/me") {
          return createJsonResponse(createAuthPayload());
        }

        if (input === "/api/v1/tenants/current/design-partner") {
          return createJsonResponse(createDesignPartnerWorkspaceFixture());
        }

        if (input === "/api/v1/snapshots") {
          return createJsonResponse({ items: [snapshot] });
        }

        if (input === verifyUrl) {
          return createJsonResponse(verifyResponse);
        }

        return createJsonResponse({ items: [] });
      }) as unknown as typeof fetch
    );

    render(<SnapshotWorkbench />);

    await waitFor(() => {
      expect(screen.getByText("Rotate the exposed secret")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Verify fix" }));

    await waitFor(() => {
      expect(
        screen.getByText("Verification event recorded")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", { name: "Verification outcome: Fixed" })
    ).toBeInTheDocument();
    expect(screen.getByText(`Previous evidence (1)`)).toBeInTheDocument();
    expect(screen.getByText(`Current proof (1)`)).toBeInTheDocument();
    expect(
      screen.getByText("1 new evidence artifact captured during verification.")
    ).toBeInTheDocument();
    expect(previousEvidenceId).not.toEqual(newEvidenceId);
  });

  it("runs a posture check on a verified scope and renders measured module results", async () => {
    const scopeId = "33333333-3333-4333-8333-333333333333";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("/posture-check")) {
          return createJsonResponse(
            {
              checks: [
                {
                  exposure: true,
                  moduleId: "periscan.tls_certificate_check",
                  outcome: "tls_certificate_expired",
                  signalCount: 1,
                  validationState: "Validated"
                },
                {
                  exposure: false,
                  moduleId: "periscan.dns_resolution_check",
                  outcome: "dns_resolved",
                  signalCount: 0,
                  validationState: "Fixed"
                },
                {
                  exposure: false,
                  moduleId: "periscan.http_health_check",
                  outcome: "http_unreachable",
                  signalCount: 0,
                  validationState: "Inconclusive"
                }
              ],
              scopeId
            },
            { status: 201 }
          );
        }
        if (input === "/api/v1/me") {
          return createJsonResponse(createAuthPayload());
        }
        if (input === "/api/v1/scopes") {
          return createJsonResponse({
            items: [
              {
                createdAt: "2026-06-01T00:00:00.000Z",
                createdBy: "22222222-2222-4222-8222-222222222222",
                scopeId,
                scopeType: "Domain",
                tenantId: "11111111-1111-4111-8111-111111111111",
                updatedAt: "2026-06-01T00:00:00.000Z",
                value: "demo.example.com",
                verificationMethod: "DNS",
                verificationStatus: "Verified",
                verifiedAt: "2026-06-01T00:00:00.000Z",
                verifiedBy: "22222222-2222-4222-8222-222222222222"
              }
            ]
          });
        }
        if (input === "/api/v1/tenants/current/design-partner") {
          return createJsonResponse(createDesignPartnerWorkspaceFixture());
        }

        return createJsonResponse({ items: [] });
      }) as unknown as typeof fetch
    );

    render(<SnapshotWorkbench />);

    const button = await screen.findByRole("button", {
      name: "Run posture check"
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(/Exposure \(tls_certificate_expired\)/)
      ).toBeInTheDocument();
    });
    expect(
      screen.getByLabelText("Posture check results for demo.example.com")
    ).toBeInTheDocument();
    // The healthy module renders an OK status, not an exposure.
    expect(screen.getByText("OK")).toBeInTheDocument();
    // An Inconclusive (unmeasurable) module is NOT collapsed into "OK" — it is
    // shown honestly as Inconclusive.
    expect(
      screen.getByText(/Inconclusive \(http_unreachable\)/)
    ).toBeInTheDocument();
  });
});
