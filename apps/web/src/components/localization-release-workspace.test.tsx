import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalizationReleaseWorkspace } from "./localization-release-workspace";

const digest = "a".repeat(64);
const coverage = [
  {
    complete: true,
    completionPercent: 100,
    fallbackKeys: [],
    scope: "ProductShell",
    totalKeys: 39,
    translatedKeys: 39
  },
  {
    complete: true,
    completionPercent: 100,
    fallbackKeys: [],
    scope: "SnapshotReport",
    totalKeys: 16,
    translatedKeys: 16
  }
];
const workspace = {
  catalogs: ["en-US", "es-ES", "fr-FR", "de-DE", "ja-JP"].map((locale) => ({
    catalogDigest: digest,
    catalogVersion: "2026.07.29.1",
    coverage,
    locale,
    localeLabel: locale,
    readyForActivation: true
  })),
  contentBoundary:
    "The governed catalog covers product-shell navigation and Validation Snapshot report chrome. Page bodies and inline help remain in their reviewed source language.",
  dataRegion: "us-east-1",
  formatPreview: {
    dateTime: "Tuesday, July 15, 2026 at 12:00 PM",
    locale: "en-US",
    number: "1,234,567.89",
    relativeTime: "in 3 days",
    sampleNumber: 1234567.89,
    sampleTimestamp: "2026-07-15T16:00:00.000Z",
    timeZone: "UTC"
  },
  generatedAt: "2026-07-15T16:00:00.000Z",
  localization: {
    activeReleaseId: null,
    catalogCoverage: coverage,
    catalogDigest: digest,
    catalogVersion: "2026.07.29.1",
    evidenceIdentifiersLocalized: false,
    preferredLocale: "en-US",
    preferredTimeZone: "UTC",
    reportClaimSemanticsLocalized: false,
    reviewReference: null,
    reviewedAt: null,
    supportOwnerEmail: null,
    supportedLocales: ["en-US", "es-ES", "fr-FR", "de-DE", "ja-JP"]
  },
  releaseHistory: [],
  residencyBoundary:
    "Changing language or timezone changes presentation only. It does not move tenant data."
};

describe("LocalizationReleaseWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("previews regional formatting and activates a reviewed catalog", async () => {
    const preview = {
      dateTime: "2026年7月16日木曜日 1:00",
      locale: "ja-JP",
      number: "1,234,567.89",
      relativeTime: "3 日後",
      sampleNumber: 1234567.89,
      sampleTimestamp: "2026-07-15T16:00:00.000Z",
      timeZone: "Asia/Tokyo"
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input);
        if (route.endsWith("/localization/preview")) {
          return new Response(JSON.stringify(preview), { status: 200 });
        }
        if (route.endsWith("/localization") && init?.method === "PUT") {
          return new Response(
            JSON.stringify({
              ...workspace.localization,
              activeReleaseId: "11111111-1111-4111-8111-111111111111",
              preferredLocale: "ja-JP",
              preferredTimeZone: "Asia/Tokyo",
              reviewReference: "LOC-REVIEW-42",
              reviewedAt: "2026-07-15T16:00:00.000Z",
              supportOwnerEmail: "regional-support@example.test"
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify(workspace), { status: 200 });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalizationReleaseWorkspace />);

    expect(
      await screen.findByText("Language release desk")
    ).toBeInTheDocument();
    expect(screen.getByText("Review required")).toBeInTheDocument();
    expect(screen.getByText("Catalog assurance")).toBeInTheDocument();
    expect(screen.getByText(/does not move tenant data/i)).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Localization release language"
      }),
      { target: { value: "ja-JP" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Localization release timezone"
      }),
      { target: { value: "Asia/Tokyo" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Preview formatting" }));

    expect(
      await screen.findByText("2026年7月16日木曜日 1:00")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/tenants/current/localization/preview",
      expect.objectContaining({
        body: expect.stringContaining('"timeZone":"Asia/Tokyo"'),
        method: "POST"
      })
    );

    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Localization support owner email"
      }),
      { target: { value: "regional-support@example.test" } }
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Localization review reference" }),
      { target: { value: "LOC-REVIEW-42" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Activate localization release" })
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/tenants/current/localization",
        expect.objectContaining({
          body: expect.stringContaining('"reviewReference":"LOC-REVIEW-42"'),
          method: "PUT"
        })
      )
    );
  });
});
