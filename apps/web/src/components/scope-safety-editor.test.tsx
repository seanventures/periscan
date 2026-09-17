import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveScopeSafetyEnvelope, type Scope } from "@periscan/shared";

import { ScopeSafetyEditor } from "./scope-safety-editor";

describe("ScopeSafetyEditor", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists OT classification and previews the enforced passive ceiling", async () => {
    const now = "2026-07-14T14:00:00.000Z";
    const scope: Scope = {
      assetClass: "Network",
      businessCriticality: "High",
      createdAt: now,
      createdBy: "11111111-1111-4111-8111-111111111111",
      effectiveMaxSafetyLevel: "ActiveNonInvasive",
      externalValidationProfileId: null,
      isOperationalTechnology: false,
      lastPostureCheckAt: null,
      maxSafetyLevel: "ActiveNonInvasive",
      nextPostureCheckAt: null,
      purdueLevel: null,
      safetyRestrictionReason:
        "This scope permits validation through ActiveNonInvasive.",
      scopeId: "22222222-2222-4222-8222-222222222222",
      scopeType: "InternalNetwork",
      segmentName: "Corporate network",
      sensitivity: "High",
      tags: ["it"],
      tenantId: "33333333-3333-4333-8333-333333333333",
      updatedAt: now,
      value: "10.42.0.0/24",
      verificationExpiresAt: null,
      verificationMethod: "MANUAL",
      verificationStale: false,
      verificationStatus: "Verified",
      verificationToken: null,
      verifiedAt: now,
      verifiedBy: "11111111-1111-4111-8111-111111111111"
    };
    const requests: Array<{ method: string; payload?: unknown; route: string }> = [];
    const onSaved = vi.fn(async () => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ method: init?.method ?? "GET", payload, route });

        if (route === "/api/v1/external-validation/profiles") {
          return {
            json: async () => ({
              items: [
                {
                  defaultRateLimit: 10,
                  description: "Safe baseline",
                  displayName: "Safe Baseline",
                  maxRequestsPerTarget: 25,
                  profile: "safe-baseline",
                  safetyNotes: ["GET-only"],
                  templateIds: ["safe-http"]
                }
              ]
            }),
            ok: true,
            status: 200
          };
        }

        if (
          route === `/api/v1/scopes/${scope.scopeId}/classification` &&
          init?.method === "PATCH"
        ) {
          const classification = payload as Pick<
            Scope,
            | "assetClass"
            | "businessCriticality"
            | "externalValidationProfileId"
            | "maxSafetyLevel"
            | "purdueLevel"
            | "segmentName"
            | "sensitivity"
            | "tags"
          >;
          return {
            json: async () => ({
              ...scope,
              ...classification,
              ...resolveScopeSafetyEnvelope(classification),
              updatedAt: now
            }),
            ok: true,
            status: 200
          };
        }

        return { json: async () => ({ error: route }), ok: false, status: 404 };
      }) as unknown as typeof fetch
    );

    render(<ScopeSafetyEditor scope={scope} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText("Scope asset class"), {
      target: { value: "OT" }
    });
    fireEvent.change(screen.getByLabelText("Scope Purdue level"), {
      target: { value: "Level2SupervisoryControl" }
    });
    fireEvent.change(screen.getByLabelText("Scope classification tags"), {
      target: { value: "scada, production" }
    });

    expect(screen.getByText("OT protected")).toBeInTheDocument();
    expect(
      screen.getByText(/OT-classified scopes are hard-limited/)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Save safety envelope" })
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: "PATCH",
        payload: expect.objectContaining({
          assetClass: "OT",
          purdueLevel: "Level2SupervisoryControl",
          tags: ["scada", "production"]
        })
      })
    );
  });
});
