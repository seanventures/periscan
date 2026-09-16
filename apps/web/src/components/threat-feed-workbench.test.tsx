import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThreatFeedWorkbench } from "./threat-feed-workbench";

const timestamp = "2026-06-17T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const itemId = "44444444-4444-4444-8444-444444444444";
const alertId = "55555555-5555-4555-8555-555555555555";

const authPayload = {
  membership: {
    createdAt: timestamp,
    membershipId,
    role: "Owner",
    tenantId,
    updatedAt: timestamp,
    userId
  },
  tenant: {
    billingAccountId: null,
    createdAt: timestamp,
    dataRegion: "us-east-1",
    name: "Demo Security",
    parentTenantId: null,
    tenantId,
    type: "Organization",
    updatedAt: timestamp
  },
  user: {
    createdAt: timestamp,
    email: "owner@example.com",
    name: "Owner User",
    status: "Active",
    updatedAt: timestamp,
    userId
  }
};

const catalogItem = {
  threatIntelItemId: itemId,
  kind: "Indicator",
  canonicalKey: "ioc:domain:victim.example",
  title: "Phishing on victim.example",
  summary: "Active phishing URL.",
  cveIds: [],
  cvssScore: null,
  epssScore: null,
  severity: "High",
  kev: false,
  kevRansomware: false,
  iocType: "domain",
  iocValue: "victim.example",
  techniqueIds: ["T1566"],
  tags: ["openphish"],
  sourceCount: 1,
  sources: ["openphish"],
  publishedAt: null,
  firstSeenAt: timestamp,
  lastSeenAt: timestamp
};

function alert(status: "New" | "Acknowledged" | "Dismissed") {
  return {
    tenantThreatAlertId: alertId,
    threatIntelItemId: itemId,
    matchType: "ioc",
    matchedValue: "victim.example",
    matchedScopeId: "66666666-6666-4666-8666-666666666666",
    severity: "High",
    status,
    createdAt: timestamp,
    item: catalogItem
  };
}

const feedStatus = {
  sourceKey: "cisa-kev",
  name: "CISA Known Exploited Vulnerabilities",
  category: "Exploited",
  description: "Actively exploited CVEs.",
  cadenceMinutes: 60,
  keyRequired: false,
  keyConfigured: true,
  enabled: true,
  lastPolledAt: timestamp,
  nextPollAt: timestamp,
  lastStatus: "ok",
  lastError: null,
  lastItemCount: 1200,
  lastNewCount: 3,
  consecutiveErrors: 0
};

function jsonResponse(payload: unknown, ok = true, statusCode = 200) {
  return { json: async () => payload, ok, status: statusCode };
}

describe("ThreatFeedWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts unauthenticated visitors to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: "Authentication required" }, false, 401)
      ) as unknown as typeof fetch
    );

    render(<ThreatFeedWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByText("Sign in to watch the global threat feed.")
      ).toBeInTheDocument();
    });
  });

  it("renders feeds and catalog, and supports reversible alert triage", async () => {
    let currentStatus: "New" | "Acknowledged" | "Dismissed" = "New";
    let statusPostMethod: string | undefined;
    const postedStatuses: string[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const route = String(input).split("?")[0] ?? "";
        if (route.endsWith("/api/v1/me")) {
          return jsonResponse(authPayload);
        }
        if (route.endsWith("/threat-intel/feeds")) {
          return jsonResponse({ items: [feedStatus] });
        }
        if (route.endsWith("/threat-intel/catalog")) {
          return jsonResponse({ items: [catalogItem] });
        }
        if (route.endsWith(`/threat-intel/alerts/${alertId}/status`)) {
          statusPostMethod = init?.method;
          const body = JSON.parse(String(init?.body)) as {
            status: typeof currentStatus;
          };
          currentStatus = body.status;
          postedStatuses.push(body.status);
          return jsonResponse(alert(currentStatus));
        }
        if (route.endsWith("/threat-intel/alerts")) {
          return jsonResponse({
            items: [alert(currentStatus)]
          });
        }
        return jsonResponse({ error: `unhandled ${route}` }, false, 404);
      }
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<ThreatFeedWorkbench />);

    // Alert + catalog + feed all render.
    await waitFor(() => {
      expect(
        screen.getByText("CISA Known Exploited Vulnerabilities")
      ).toBeInTheDocument();
    });
    expect(
      screen.getAllByText("Phishing on victim.example").length
    ).toBeGreaterThan(0);
    // Accessible count badges (consistent with the app convention).
    expect(
      screen.getByRole("status", { name: "Open threat alert count: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Threat feed source count: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Threat catalog item count: 1" })
    ).toBeInTheDocument();

    // Acknowledge the alert -> POST status -> refetch -> open count drops to 0.
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Open threat alert count: 0" })
      ).toBeInTheDocument();
    });
    expect(statusPostMethod).toBe("POST");

    fireEvent.click(screen.getByRole("button", { name: "Re-open" }));
    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Open threat alert count: 1" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Undo dismissal" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Undo dismissal" }));
    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Open threat alert count: 1" })
      ).toBeInTheDocument();
    });
    expect(postedStatuses).toEqual(["Acknowledged", "New", "Dismissed", "New"]);
  });

  it("offers catalog pivot actions: copy IOC, search findings, search paths", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const route = String(input).split("?")[0] ?? "";
        if (route.endsWith("/api/v1/me")) {
          return jsonResponse(authPayload);
        }
        if (route.endsWith("/threat-intel/feeds")) {
          return jsonResponse({ items: [feedStatus] });
        }
        if (route.endsWith("/threat-intel/catalog")) {
          return jsonResponse({ items: [catalogItem] });
        }
        if (route.endsWith("/threat-intel/alerts")) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({ error: `unhandled ${route}` }, false, 404);
      }) as unknown as typeof fetch
    );

    render(<ThreatFeedWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Threat catalog item count: 1" })
      ).toBeInTheDocument();
    });

    const searchFindings = screen.getAllByRole("link", {
      name: "Search findings"
    });
    // Catalog row (alerts empty) should still expose the pivot.
    expect(
      searchFindings.some((el) =>
        el.getAttribute("href")?.includes("q=victim.example")
      )
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "Copy IOC" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Search paths" }).getAttribute("href")
    ).toContain("q=victim.example");
  });

  it("loads the full catalog window and paginates filtered results", async () => {
    let catalogUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const route = url.split("?")[0] ?? "";
        if (route.endsWith("/api/v1/me")) return jsonResponse(authPayload);
        if (route.endsWith("/threat-intel/feeds")) {
          return jsonResponse({ items: [feedStatus] });
        }
        if (route.endsWith("/threat-intel/catalog")) {
          catalogUrl = url;
          return jsonResponse({
            items: Array.from({ length: 26 }, (_, index) => ({
              ...catalogItem,
              canonicalKey: `ioc:domain:item-${index}.example`,
              threatIntelItemId: `${String(index + 1).padStart(8, "0")}-4444-4444-8444-444444444444`,
              title: `Threat ${String(index + 1).padStart(2, "0")}`
            }))
          });
        }
        if (route.endsWith("/threat-intel/alerts")) {
          return jsonResponse({ items: [] });
        }
        return jsonResponse({ error: `unhandled ${route}` }, false, 404);
      }) as unknown as typeof fetch
    );

    render(<ThreatFeedWorkbench />);

    await screen.findByText("Threat 01");
    expect(catalogUrl).toContain("limit=200");
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Threat 26")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Threat 26")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search world threats"), {
      target: { value: "Threat 03" }
    });
    expect(await screen.findByText("Threat 03")).toBeInTheDocument();
    expect(screen.queryByText("Threat 26")).not.toBeInTheDocument();
  });
});
