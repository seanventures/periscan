import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkflowFeedback } from "./workflow-feedback";

describe("WorkflowFeedback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists a rating with the proof-loop route and stage context", async () => {
    const now = "2026-07-14T20:00:00.000Z";
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/v1/experience/feedback" && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            comment: "The evidence link was easy to follow.",
            createdAt: now,
            evidencePackId: null,
            feedbackId: "11111111-1111-4111-8111-111111111111",
            maturity: "Measured",
            missionId: null,
            persona: "GrcAuditor",
            rating: 4,
            route: "/snapshots/example/report",
            stage: "Prove",
            tenantId: "22222222-2222-4222-8222-222222222222",
            updatedAt: now,
            userId: "33333333-3333-4333-8333-333333333333"
          }),
          { status: 201 }
        );
      }

      return new Response(JSON.stringify({ error: "unexpected" }), {
        status: 404
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(
      <WorkflowFeedback route="/snapshots/example/report" stage="Prove" />
    );

    fireEvent.click(screen.getByRole("button", { name: "4 out of 5" }));
    fireEvent.change(screen.getByLabelText(/What slowed you down/), {
      target: { value: "The evidence link was easy to follow." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));

    await waitFor(() => {
      expect(
        screen.getByText("Feedback saved with this prove workflow context.")
      ).toBeInTheDocument();
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/experience/feedback",
      expect.objectContaining({
        body: JSON.stringify({
          comment: "The evidence link was easy to follow.",
          evidencePackId: null,
          missionId: null,
          rating: 4,
          route: "/snapshots/example/report",
          stage: "Prove"
        }),
        method: "POST"
      })
    );
  });
});
