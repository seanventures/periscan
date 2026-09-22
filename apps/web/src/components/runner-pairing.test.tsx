import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RunnerRecord } from "@periscan/shared";

import type { ApiResource } from "../hooks/use-api-resource";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { RunnerPairing } from "./runner-pairing";

function emptyRunners(): ApiResource<RunnerRecord[]> {
  return {
    data: [],
    loading: false,
    refreshing: false,
    error: null,
    errorStatus: null,
    lastUpdatedAt: null,
    refetch: async () => undefined
  };
}

function expectCommunityRunnerAgentHonesty() {
  const notes = screen.getAllByText(/Community InternalRunner OSS/i);
  expect(notes.length).toBeGreaterThan(0);
  for (const note of notes) {
    expect(note).toHaveTextContent(/nmap/i);
    expect(note).toHaveTextContent(/syft/i);
    expect(note).toHaveTextContent(/runner-agent/i);
    expect(note).toHaveTextContent(/Go/i);
  }
}

describe("RunnerPairing enroll honesty", () => {
  afterEach(() => vi.restoreAllMocks());

  it("tells operators Community InternalRunner OSS still needs runner-agent", () => {
    render(<RunnerPairing runners={emptyRunners()} />);
    expectCommunityRunnerAgentHonesty();
  });

  it("keeps that honesty after a Go Supported Customer Runner pairing token is issued", async () => {
    vi.spyOn(api, "createRunnerRegistrationToken").mockResolvedValue({
      registrationToken: "prrt_test_token",
      token: {
        createdAt: "2026-08-30T01:00:00.000Z",
        createdBy: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-08-30T02:00:00.000Z",
        labels: [],
        registrationTokenId: "22222222-2222-4222-8222-222222222222",
        runnerName: "plant",
        status: "Active",
        tenantId: "33333333-3333-4333-8333-333333333333",
        updatedAt: "2026-08-30T01:00:00.000Z"
      }
    });

    render(<RunnerPairing runners={emptyRunners()} />);
    fireEvent.change(screen.getByPlaceholderText(/dc-subnet-runner/i), {
      target: { value: "plant" }
    });
    fireEvent.click(screen.getByRole("button", { name: /start pairing/i }));

    await waitFor(() => {
      expect(screen.getByText(/Supported Customer Runner \(Go LTS\)/i)).toBeInTheDocument();
    });
    expectCommunityRunnerAgentHonesty();
  });
});
