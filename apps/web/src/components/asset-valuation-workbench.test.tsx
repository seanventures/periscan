import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetValuationWorkbench } from "./asset-valuation-workbench";

describe("AssetValuationWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves explicit asset loss ranges without inventing financial values", async () => {
    const now = "2026-07-14T12:00:00.000Z";
    const asset = {
      assetId: "11111111-1111-4111-8111-111111111111",
      assetType: "Application",
      businessCriticality: "Critical",
      createdAt: now,
      environment: "production",
      firstSeenAt: now,
      identifiers: { service: "payments" },
      internetExposed: true,
      lastSeenAt: now,
      name: "Production payments API",
      owner: "Payments engineering",
      status: "Active",
      tags: ["payments"],
      tenantId: "22222222-2222-4222-8222-222222222222",
      updatedAt: now,
      valuation: null
    };
    const requests: Array<{ method: string; payload?: unknown; route: string }> = [];
    const onSaved = vi.fn(async () => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        requests.push({
          method: init?.method ?? "GET",
          payload: init?.body ? JSON.parse(String(init.body)) : undefined,
          route
        });
        if (route === "/api/v1/assets" && !init?.method) {
          return { json: async () => ({ items: [asset] }), ok: true, status: 200 };
        }
        if (
          route === `/api/v1/assets/${asset.assetId}/valuation` &&
          init?.method === "PATCH"
        ) {
          return {
            json: async () => ({
              ...asset,
              updatedAt: now,
              valuation: {
                ...(JSON.parse(String(init.body)) as object),
                updatedAt: now,
                updatedBy: "33333333-3333-4333-8333-333333333333"
              }
            }),
            ok: true,
            status: 200
          };
        }
        return { json: async () => ({ error: route }), ok: false, status: 404 };
      }) as unknown as typeof fetch
    );

    render(<AssetValuationWorkbench onSaved={onSaved} />);

    expect(await screen.findByLabelText("Asset to value")).toHaveValue(
      asset.assetId
    );
    fireEvent.change(await screen.findByLabelText("Business service name"), {
      target: { value: "Payments" }
    });
    fireEvent.change(
      screen.getByLabelText("Loss-event frequency per year minimum"),
      { target: { value: "0.5" } }
    );
    fireEvent.change(
      screen.getByLabelText("Loss-event frequency per year most likely"),
      { target: { value: "1" } }
    );
    fireEvent.change(
      screen.getByLabelText("Loss-event frequency per year maximum"),
      { target: { value: "2" } }
    );
    fireEvent.change(screen.getByLabelText("Loss magnitude (USD) minimum"), {
      target: { value: "100000" }
    });
    fireEvent.change(
      screen.getByLabelText("Loss magnitude (USD) most likely"),
      { target: { value: "200000" } }
    );
    fireEvent.change(screen.getByLabelText("Loss magnitude (USD) maximum"), {
      target: { value: "400000" }
    });
    fireEvent.change(screen.getByLabelText("Financial assumption notes"), {
      target: {
        value:
          "Includes lost transactions, incident response, and customer notification."
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save assumptions" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(requests).toContainEqual(
      expect.objectContaining({
        method: "PATCH",
        payload: expect.objectContaining({
          businessServiceName: "Payments",
          currency: "USD",
          lossEventFrequencyPerYear: {
            maximum: 2,
            minimum: 0.5,
            mostLikely: 1
          }
        })
      })
    );
  });
});
