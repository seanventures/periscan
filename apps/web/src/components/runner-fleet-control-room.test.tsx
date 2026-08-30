import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunnerFleetWorkspace } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { RunnerFleetControlRoom } from "./runner-fleet-control-room";

const timestamp = "2026-07-16T16:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const runnerId = "33333333-3333-4333-8333-333333333333";
const heartbeatId = "44444444-4444-4444-8444-444444444444";

function workspace(configured = true): RunnerFleetWorkspace {
  const runner = {
    arch: "amd64",
    certificateExpiresAt: "2027-01-01T00:00:00.000Z",
    certificateSha256: "a".repeat(64),
    createdAt: timestamp,
    createdBy: userId,
    deploymentMode: "Docker" as const,
    hostname: "runner.corp.internal",
    killSwitchActivatedAt: null,
    killSwitchActivatedBy: null,
    killSwitchAcknowledgedAt: null,
    killSwitchActive: false,
    killSwitchReason: null,
    labels: ["production"],
    lastSeenAt: timestamp,
    name: "East datacenter",
    networkProfile: {
      additionalEgressNotes: null,
      dnsResolutionRequired: true,
      explicitProxyUrl: null,
      gatewayHostnames: ["app.periscan.com"],
      httpConnectProxySupported: true,
      outboundHttpsPorts: [443]
    },
    os: "linux",
    revokedAt: null,
    revocationAcknowledgedAt: null,
    runnerId,
    status: "Active" as const,
    tenantId,
    transportMode: "LongPollHttps" as const,
    updatedAt: timestamp,
    version: "0.1.0"
  };
  const heartbeat = {
    activeTaskId: null,
    certificateExpiresAt: "2027-01-01T00:00:00.000Z",
    heartbeatSampleId: heartbeatId,
    lastTaskCompletedAt: null,
    observedAt: timestamp,
    queueDepth: 2,
    receivedAt: timestamp,
    runnerId,
    status: "Active" as const,
    tenantId,
    version: "0.1.0"
  };
  return {
    generatedAt: timestamp,
    policy: {
      attentionAfterSeconds: 90,
      certificateWarningDays: 14,
      configured,
      escalationReference: configured ? "SECOPS-123" : null,
      minimumAgentVersion: configured ? "0.1.0" : null,
      offlineAfterSeconds: 300,
      queueWarningDepth: 10,
      supportOwner: configured ? "Security Operations" : null,
      updatedAt: configured ? timestamp : null,
      updatedBy: configured ? userId : null
    },
    rulesVersion: "1.0",
    runners: [
      {
        alerts: [],
        certificateDaysRemaining: 169,
        engineInstallReadiness: [],
        healthState: "Healthy",
        heartbeatAgeSeconds: 22,
        heartbeatSeries: [heartbeat],
        latestHeartbeat: heartbeat,
        recentTasks: [],
        runner,
        taskSummary: {
          active: 0,
          completionRate24h: 1,
          counts: {
            Accepted: 0,
            Cancelled: 0,
            Completed: 3,
            DeniedByLocalPolicy: 0,
            DeniedByServerPolicy: 0,
            Expired: 0,
            Failed: 0,
            Leased: 0,
            Queued: 0,
            Rejected: 0,
            Running: 0
          },
          denied24h: 0,
          evidence24h: 3,
          failed24h: 0,
          oldestQueuedSeconds: null,
          p50DurationSeconds24h: 8,
          terminal24h: 3
        },
        versionCompliant: configured ? true : null
      }
    ],
    summary: {
      activeTasks: 0,
      attention: 0,
      completionRate24h: 1,
      evidence24h: 3,
      halted: 0,
      healthy: 1,
      offline: 0,
      revoked: 0,
      total: 1
    }
  };
}

describe("RunnerFleetControlRoom", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockReads(state: RunnerFleetWorkspace) {
    vi.spyOn(api, "getRunnerFleetWorkspace").mockResolvedValue(state);
    vi.spyOn(api, "listRunners").mockResolvedValue(
      state.runners.map((item) => item.runner)
    );
    vi.spyOn(api, "listRunnerTransportDecisions").mockResolvedValue([
      {
        channel: "LongPollHttps",
        notes: [],
        reason: "Outbound HTTPS is the primary control channel.",
        status: "Primary"
      },
      {
        channel: "WebSocketHttps",
        notes: [],
        reason: "Reserved for later use.",
        status: "SupportedLater"
      },
      {
        channel: "ReverseSsh",
        notes: [],
        reason: "Inbound remote access is disallowed.",
        status: "Disallowed"
      }
    ]);
  }

  it("renders a live fleet pulse, selected runner liveness, and honest task state", async () => {
    mockReads(workspace());

    render(<RunnerFleetControlRoom />);

    expect(await screen.findAllByText("East datacenter")).toHaveLength(2);
    // UX-W4 / #183: health framed as ops instrument
    expect(screen.getByText(/Ops instrument · Fleet health/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Treat fleet health as the primary ops instrument/i)
    ).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("Inside operating envelope")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No signed tasks have been persisted for this runner yet."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("server age 22s")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Emergency halt" })
    ).toBeEnabled();
  });

  it("seals a validated tenant fleet policy from the inline editor", async () => {
    const state = workspace(false);
    mockReads(state);
    vi.spyOn(api, "updateRunnerFleetPolicy").mockResolvedValue({
      ...state.policy,
      configured: true,
      escalationReference: "SECOPS-RUNNER",
      minimumAgentVersion: "0.1.0",
      supportOwner: "Security Operations",
      updatedAt: timestamp,
      updatedBy: userId
    });

    render(<RunnerFleetControlRoom />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Seal fleet policy" })
    );

    await waitFor(() =>
      expect(api.updateRunnerFleetPolicy).toHaveBeenCalledWith({
        attentionAfterSeconds: 90,
        certificateWarningDays: 14,
        escalationReference: "SECOPS-RUNNER",
        minimumAgentVersion: "0.1.0",
        offlineAfterSeconds: 300,
        queueWarningDepth: 10,
        supportOwner: "Security Operations"
      })
    );
  });
});
