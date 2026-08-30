import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { AIAppsWorkbench } from "./ai-apps-workbench";

const timestamp = "2026-07-14T16:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const appId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const missionId = "44444444-4444-4444-8444-444444444444";
const runId = "55555555-5555-4555-8555-555555555555";
const evidenceId = "66666666-6666-4666-8666-666666666666";

describe("AIAppsWorkbench", () => {
  afterEach(() => vi.restoreAllMocks());

  it("surfaces the suite, ATT&CK mapping, mission, signals, and evidence from a safe validation", async () => {
    vi.spyOn(api, "listAIApplications").mockResolvedValue([
      {
        aiAppId: appId,
        appType: "RAG",
        authMethod: "none",
        createdAt: timestamp,
        dataSourcesDescription: "Customer knowledge base",
        endpointUrl: "https://ai.example.com/chat",
        guardrailsDescription: "Tenant isolation",
        lastValidatedAt: null,
        latestValidation: null,
        name: "Support Copilot",
        owner: "AI Platform",
        ragEnabled: true,
        scopeId,
        tenantId,
        testAccountNotes: null,
        toolsEnabled: false,
        updatedAt: timestamp
      }
    ]);
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    const validate = vi.spyOn(api, "validateAIApplication").mockResolvedValue({
      attackTechniques: [
        {
          description: "Safe identity authorization validation.",
          safeExample: true,
          tacticId: "TA0001",
          tacticName: "Initial Access",
          techniqueId: "T1078",
          techniqueName: "Valid Accounts"
        }
      ],
      decision: {} as never,
      evidence: [{ evidenceId }] as never,
      mission: { missionId } as never,
      run: {
        missionId,
        runId,
        target: {
          harness: "periscan",
          validationCategory: "RAGAuthorization"
        },
        validationState: "Inconclusive"
      } as never,
      signals: [{ signalId: "77777777-7777-4777-8777-777777777777" }] as never
    });

    render(<AIAppsWorkbench />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Run safe validation" })
    );

    await waitFor(() =>
      expect(validate).toHaveBeenCalledWith(appId, {
        corpusVersion: "periscan-benign-v1",
        executionMode: "LiveSuite",
        harness: "periscan",
        maxRequests: 1,
        maxResponseBytes: 4096,
        validationCategory: "RAGAuthorization"
      })
    );
    expect(
      await screen.findByRole("region", {
        name: "Latest Support Copilot safe validation result"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("T1078 · Valid Accounts")).toBeInTheDocument();
    expect(screen.getByText("1 signal")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /mission 44444444/ })
    ).toHaveAttribute("href", `/missions/${missionId}`);
    expect(
      screen.getByRole("link", { name: /evidence 66666666/ })
    ).toHaveAttribute("href", `/evidence?evidenceId=${evidenceId}`);
  });

  it("blocks validation after the persisted kill switch is acknowledged", async () => {
    const baseApp = {
      aiAppId: appId,
      appType: "Agent" as const,
      authMethod: "none",
      createdAt: timestamp,
      dataSourcesDescription: "Synthetic test data only",
      endpointUrl: "https://ai.example.com/chat",
      guardrailsDescription: "Tool allowlist",
      lastValidatedAt: null,
      latestValidation: null,
      name: "Tool Agent",
      owner: "AI Platform",
      ragEnabled: false,
      scopeId,
      tenantId,
      testAccountNotes: "Disposable test account",
      toolsEnabled: true,
      updatedAt: timestamp,
      validationKillSwitch: {
        activatedAt: null,
        activatedBy: null,
        enabled: false,
        reason: null
      }
    };
    vi.spyOn(api, "listAIApplications")
      .mockResolvedValueOnce([baseApp])
      .mockResolvedValue([
        {
          ...baseApp,
          validationKillSwitch: {
            activatedAt: timestamp,
            activatedBy: tenantId,
            enabled: true,
            reason: "Operator safety drill"
          }
        }
      ]);
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    const setKillSwitch = vi
      .spyOn(api, "setAIValidationKillSwitch")
      .mockResolvedValue({
        ...baseApp,
        validationKillSwitch: {
          activatedAt: timestamp,
          activatedBy: tenantId,
          enabled: true,
          reason: "Operator safety drill"
        }
      });

    render(<AIAppsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Activate Tool Agent validation kill switch"
      })
    );
    await waitFor(() =>
      expect(setKillSwitch).toHaveBeenCalledWith(appId, {
        enabled: true,
        reason: "Operator safety drill"
      })
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Run safe validation" })
      ).toBeDisabled()
    );
    expect(screen.getByText("Acknowledged · runs blocked")).toBeInTheDocument();
  });
});
